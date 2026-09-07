// directional-sync-reason-wiring.test.ts — ORDEM DE SERVIÇO (Frente 1,
// §2.2, pedido direto do Operador: "quando não houver sinal, o sistema
// deve explicar claramente o que está aguardando"). Trava por padrão de
// código (App.tsx não é montável de verdade neste repo — mesma disciplina
// de directional-sync-wiring.test.ts) que cada fonte sem leitura real
// ganhou um motivo REAL, lido de um campo já computado por outro motor —
// nunca um texto inventado.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");

describe("DirectionalSource.reason: cada fonte lê um motivo REAL já computado, nunca fabricado", () => {
  it("CONS: motivo vem do RISK.rationale (gate) ou do quórum real do Conselho — nunca um texto novo", () => {
    expect(app).toMatch(/councilFromSnapshot\.votes\.find\(\(v\) => v\.agent === "RISK"\)\?\.rationale/);
    expect(app).toMatch(/`\$\{councilFromSnapshot\.quorum\}\/6 agentes direcionais com leitura real nesta janela`/);
  });

  it("REG: motivo vem do MESMO objeto engine.marketRegime já lido para o side (regime + ADX reais)", () => {
    expect(app).toMatch(/engine\.marketRegime\s*\n?\s*\?\s*`regime atual: \$\{engine\.marketRegime\.regime\}/);
  });

  it("kNN: motivo vem de humanizeReasonCode sobre realCycle.lorentzian.reason (o mesmo objeto já lido para o side)", () => {
    expect(app).toMatch(/reason: humanizeReasonCode\(realCycle\?\.lorentzian\?\.reason\)/);
  });

  it("LIVR: motivo vem de engine.hasBook — mesmo campo real já usado em outros painéis (nunca recalculado)", () => {
    expect(app).toMatch(/reason: engine\.hasBook \? null : "aguardando a primeira leitura real do livro de ofertas \(WebSocket depth\)"/);
  });

  it("FLUX: motivo reaproveita o rationale REAL do agente ORDERFLOW do Conselho quando ele absteve pela mesma causa (CVD ausente) — zero segunda fonte", () => {
    expect(app).toMatch(/councilFromSnapshot\?\.votes\.find\(\(v\) => v\.agent === "ORDERFLOW" && v\.stance === "ABSTAIN"\)\?\.rationale/);
  });

  it("ESTR/HTF NÃO ganham reason nesta rodada — o motivo real é descartado antes de chegar aqui (documentado como pendência, nunca escondido)", () => {
    const bloco = app.slice(
      app.indexOf("const directionalConsensus = useMemo("),
      app.indexOf("return computeDirectionalConsensus("),
    );
    // Âncora estrutural: dentro do objeto ESTR (entre "code: \"ESTR\"" e o
    // próximo "code:"), nunca deve existir uma linha "reason:" — só o
    // measures genérico, porque o dado real ainda não existe neste ponto
    // do pipeline (ver comentário no próprio bloco).
    const estrIdx = bloco.indexOf('code: "ESTR"');
    const htfIdx = bloco.indexOf('code: "HTF"');
    const regIdx = bloco.indexOf('code: "REG"');
    expect(estrIdx).toBeGreaterThan(-1);
    expect(htfIdx).toBeGreaterThan(-1);
    const estrObjeto = bloco.slice(estrIdx, regIdx);
    expect(estrObjeto).not.toContain("reason:");
    const consIdx = bloco.indexOf('code: "CONS"');
    const htfObjeto = bloco.slice(htfIdx, consIdx);
    expect(htfObjeto).not.toContain("reason:");
    // A pendência precisa estar documentada em prosa, não só ausente.
    expect(bloco).toMatch(/ESTR\/HTF NÃO têm reason/);
  });

  it("import real de humanizeReasonCode existe (zero segunda implementação de tradução de motivo)", () => {
    expect(app).toContain('import { humanizeReasonCode } from "./nexus/reason-vocabulary";');
  });
});

describe("DirectionalSyncPanel: o tooltip usa o motivo real quando a fonte está sem leitura", () => {
  it("title troca measures pelo reason só quando side é null E existe um reason real", () => {
    expect(app).toMatch(
      /title=\{s\.side === null && s\.reason \? `\$\{s\.name\} — \$\{s\.reason\}` : `\$\{s\.name\} — \$\{s\.measures\}`\}/,
    );
  });
});
