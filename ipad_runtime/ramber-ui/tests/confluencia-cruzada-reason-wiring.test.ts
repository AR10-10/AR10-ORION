// confluencia-cruzada-reason-wiring.test.ts — ORDEM DE SERVIÇO (Frente 1,
// §2.2): convictionReading.reason tem 3 valores reais possíveis quando o
// status não é OK; só o primeiro tinha tradução, os outros 2 caíam num
// AWAIT genérico. E convictionReading.members[*].detail (explicação real
// por subsistema) nunca era lida em lugar nenhum. Trava por padrão de
// código (mesma disciplina de directional-sync-reason-wiring.test.ts).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");

describe("convictionLabel: as 3 razões reais de status !== OK têm tradução — nenhuma cai mais num AWAIT cego", () => {
  it("o rótulo dedicado SEM DIREÇÃO ATIVA (WAIT) continua para o caso mais comum", () => {
    expect(app).toContain('? "SEM DIREÇÃO ATIVA (WAIT)"');
  });

  it("as outras 2 razões (nenhum_subsistema.../pool_sem_leitura_real) usam humanizeReasonCode em vez de colapsar pro AWAIT genérico", () => {
    expect(app).toMatch(/: \(humanizeReasonCode\(convictionReading\.reason\) \?\? AWAIT\)/);
  });
});

describe("convictionMembersDetail: o detalhe real por subsistema (antes 100% não lido) chega ao tooltip", () => {
  it("é construído a partir de convictionReading.members[*].detail — o mesmo array já computado, zero segundo cálculo", () => {
    expect(app).toMatch(
      /convictionReading\.members\.map\(\(m\) => `\$\{m\.id\}: \$\{m\.detail\}`\)\.join\(" · "\)/,
    );
  });

  it("só aparece quando o veredito NÃO é OK (com OK o número já é a informação relevante)", () => {
    const idx = app.indexOf("const convictionMembersDetail =");
    expect(idx).toBeGreaterThan(-1);
    const bloco = app.slice(idx, idx + 300);
    expect(bloco).toContain('convictionReading.status !== "OK"');
  });

  it("o tooltip do selo de Confluência Cruzada usa convictionMembersDetail", () => {
    expect(app).toMatch(
      /title=\{convictionMembersDetail \?\? undefined\} className=\{`text-\[0\.55rem\] font-mono font-black \$\{convictionColor\}`\}>\{convictionLabel\}/,
    );
  });
});

describe("import real de humanizeReasonCode existe (zero segunda tradução de motivo)", () => {
  it("App.tsx importa de nexus/reason-vocabulary", () => {
    expect(app).toContain('import { humanizeReasonCode } from "./nexus/reason-vocabulary";');
  });
});
