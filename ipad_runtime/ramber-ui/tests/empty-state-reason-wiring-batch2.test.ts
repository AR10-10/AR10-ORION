// empty-state-reason-wiring-batch2.test.ts — ORDEM DE SERVIÇO (Frente 1,
// §2.2): 3 achados de auditoria fechados nesta rodada — Trade Plan ausente
// no modal de Paper Trading (função real já existia, só não estava
// conectada aqui), Radar de Consenso cruzando o rationale real do
// Conselho para 4/6 raios, e o fallback "!council" ganhando uma frase
// honesta em vez de um AWAIT sozinho. Trava por padrão de código (App.tsx
// não é montável neste repo).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");

describe("PaperTradingPanel: Trade Plan ausente reaproveita tradePlanAbsenceReason — zero segunda regra", () => {
  it("chama tradePlanAbsenceReason(council, engine?.direction ?? null) — mesma função de TradePlanTopStrip/chart canvas", () => {
    expect(app).toContain("tradePlanAbsenceReason(council, engine?.direction ?? null)");
  });

  it("o modal mostra absence.reason (com absence.tooltip), nunca mais um texto genérico fixo", () => {
    const idx = app.indexOf("function PaperTradingPanel(");
    expect(idx).toBeGreaterThan(-1);
    const bloco = app.slice(idx, idx + 6000);
    expect(bloco).toContain('{absence?.reason ?? "DADOS INSUFICIENTES — sem Trade Plan ativo agora."}');
    expect(bloco).toContain("title={absence?.tooltip}");
  });
});

describe("RADAR DE CONSENSO: 4 dos 6 raios cruzam o rationale REAL do mesmo voto do Conselho já exibido no widget", () => {
  it("RADAR_SPOKE_TO_COUNCIL_AGENT mapeia exatamente as 4 categorias derivadas de voteMagnitude (consensus-radar.ts)", () => {
    expect(app).toMatch(/const RADAR_SPOKE_TO_COUNCIL_AGENT: Partial<Record<ConsensusRadarCategory, string>> = \{\s*ESTRUTURA: "STRUCTURE",\s*LIQUIDEZ: "LIQUIDITY",\s*FLUXO: "ORDERFLOW",\s*MOMENTUM: "MOMENTUM",\s*\};/);
  });

  it("cada spoke sem valor busca o rationale do voto mapeado, nunca fabrica um texto novo", () => {
    expect(app).toMatch(/council\?\.votes\.find\(\(v\) => v\.agent === spokeAgent\)\?\.rationale \?\? null/);
  });

  it("VOLATILIDADE e GMIL ficam de fora do mapa de propósito (sem voto real do Conselho por trás)", () => {
    const idx = app.indexOf("const RADAR_SPOKE_TO_COUNCIL_AGENT");
    const bloco = app.slice(idx, idx + 400);
    expect(bloco).not.toContain("VOLATILIDADE:");
    expect(bloco).not.toContain("GMIL:");
  });
});

describe("Council !council fallback: frase honesta em vez de AWAIT sozinho", () => {
  it("mantém o AWAIT (nunca remove o sinal existente) e soma uma explicação estática real", () => {
    expect(app).toContain("Conselho ainda não computou o primeiro ciclo real nesta sessão.");
  });
});
