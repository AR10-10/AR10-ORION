// hmm-regime-wiring.test.ts — GRADUAÇÃO 2026-09-07: trava a fiação real de
// computeHmmRegimeReading (Laboratório de Evolução, Entrega 43) até
// engine-bridge.ts e o card em App.tsx. A matemática pura já tem execução
// real em hmm-regime-model.test.ts; aqui o bug mais provável é "esqueceram
// de conectar A com B" (CLAUDE.md), mesma convenção de
// cross-venue-intelligence-wiring.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const engineBridgeSrc = () => readFileSync(resolve(__dirname, "../src/engine-bridge.ts"), "utf-8");
const appSrc = () => readFileSync(resolve(__dirname, "../src/App.tsx"), "utf-8");

describe("engine-bridge.ts: runRealAnalysisCycle computa hmmRegime sobre os MESMOS candles do ciclo", () => {
  it("importa computeHmmRegimeReading do motor real, nunca uma segunda implementação inline", () => {
    const src = engineBridgeSrc();
    expect(src).toContain("import { computeHmmRegimeReading } from '../../src/research/engines/hmm-regime-model.js';");
  });

  it("chama computeHmmRegimeReading(snapshot.candles) — a MESMA janela que classifyMarketRegime já usa, zero segundo fetch", () => {
    const src = engineBridgeSrc();
    expect(src).toContain("const hmmResult = computeHmmRegimeReading(snapshot.candles);");
  });

  it("hmmRegime entra no retorno do ciclo (RealCycleResult), fail-closed para null quando o status não é OK", () => {
    const src = engineBridgeSrc();
    const start = src.indexOf("const hmmResult = computeHmmRegimeReading(snapshot.candles);");
    const end = src.indexOf("return {", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);
    expect(body).toContain("hmmResult.status === 'OK'");
    expect(body).toContain(": null");
    expect(src).toContain("      hmmRegime,");
  });
});

describe("App.tsx: engine.hmmRegime passthrough + card REGIME PROBABILÍSTICO (HMM)", () => {
  it("engine.hmmRegime é puro passthrough de realCycle?.hmmRegime — mesma disciplina de marketRegime, nunca recomputado na UI", () => {
    const src = appSrc();
    expect(src).toContain("hmmRegime: cycleOk ? (realCycle?.hmmRegime ?? null) : null,");
  });

  it('card real "REGIME PROBABILÍSTICO (HMM)" monta com o aviso honesto (posterior do modelo, nunca probabilidade de acerto de mercado)', () => {
    const src = appSrc();
    expect(src).toContain("REGIME PROBABILÍSTICO (HMM)");
    expect(src).toContain("nunca uma probabilidade calibrada de acerto de mercado");
  });

  it("hmmLabel nunca fabrica um rótulo quando labelHmmStates devolve null para o estado atual — usa um texto honesto, não um regime inventado", () => {
    const src = appSrc();
    expect(src).toContain('"ESTADO SEM CONCORDÂNCIA REAL"');
  });

  it("LEI 24 / fora da contagem de confluência: o card HMM nunca entra no array `checks` (disponibilidade de fonte), é contexto — não uma camada de opinião sobre LONG/SHORT", () => {
    const src = appSrc();
    const start = src.indexOf("const checks: { label: string; available: boolean | null }[] = [");
    const end = src.indexOf("];", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);
    expect(body).not.toContain("HMM");
    expect(body).not.toContain("hmmRegime");
  });
});
