// candle-countdown.test.ts — pedido direto do Operador: "não mostra quanto
// tempo um [candle de] 1 minuto tá mostrando" — confirmado por leitura de
// código que o app não tinha nenhuma contagem regressiva até a vela atual
// fechar (recurso padrão de terminal profissional). Lógica pura de
// fronteira (aritmética de tempo) — teste de execução real, mesma
// disciplina de reason-vocabulary.test.ts.
import { describe, it, expect } from "vitest";
import { computeCandleCountdown } from "../src/nexus/candle-countdown";

describe("computeCandleCountdown: fail-closed — nunca uma contagem fabricada", () => {
  it("candle ausente/inválido devolve null", () => {
    expect(computeCandleCountdown(null, "1m", Date.now())).toBeNull();
    expect(computeCandleCountdown(undefined, "1m", Date.now())).toBeNull();
    expect(computeCandleCountdown(NaN, "1m", Date.now())).toBeNull();
  });

  it("timeframe ausente/desconhecido devolve null — nunca uma duração de barra inventada", () => {
    const nowMs = 1_000_000_000_000;
    expect(computeCandleCountdown(nowMs / 1000, null, nowMs)).toBeNull();
    expect(computeCandleCountdown(nowMs / 1000, "3.5m", nowMs)).toBeNull(); // timeframe real não existe na régua
  });
});

describe("computeCandleCountdown: aritmética real sobre TIMEFRAME_MS (fonte única, nunca uma segunda tabela)", () => {
  it("1m: vela aberta há 18s → faltam 42s reais", () => {
    const openTimeSec = 1_700_000_000;
    const nowMs = openTimeSec * 1000 + 18_000; // 18s depois da abertura
    const r = computeCandleCountdown(openTimeSec, "1m", nowMs);
    expect(r).not.toBeNull();
    expect(r!.msRemaining).toBe(42_000);
    expect(r!.label).toBe("0:42");
  });

  it("15m: vela aberta há 1min13s → faltam 13min47s reais, label mm:ss", () => {
    const openTimeSec = 1_700_000_000;
    const nowMs = openTimeSec * 1000 + 73_000; // 1min13s
    const r = computeCandleCountdown(openTimeSec, "15m", nowMs);
    expect(r!.msRemaining).toBe(15 * 60_000 - 73_000);
    expect(r!.label).toBe("13:47");
  });

  it("1h: vela aberta há 12min → faltam 48min reais, label sem segundos (horas+minutos)", () => {
    const openTimeSec = 1_700_000_000;
    const nowMs = openTimeSec * 1000 + 12 * 60_000;
    const r = computeCandleCountdown(openTimeSec, "1h", nowMs);
    expect(r!.msRemaining).toBe(48 * 60_000);
    expect(r!.label).toBe("48m");
  });

  it("4h: vela aberta há 30min → faltam 3h30m reais, label 'Xh Ym'", () => {
    const openTimeSec = 1_700_000_000;
    const nowMs = openTimeSec * 1000 + 30 * 60_000;
    const r = computeCandleCountdown(openTimeSec, "4h", nowMs);
    expect(r!.msRemaining).toBe(3.5 * 60 * 60_000);
    expect(r!.label).toBe("3h 30m");
  });

  it("exatamente no instante de abertura: falta a barra inteira", () => {
    const openTimeSec = 1_700_000_000;
    const r = computeCandleCountdown(openTimeSec, "5m", openTimeSec * 1000);
    expect(r!.msRemaining).toBe(300_000);
    expect(r!.label).toBe("5:00");
  });
});

describe("computeCandleCountdown: fail-closed em vez de negativo (feed atrasado/candle já devia ter fechado)", () => {
  it("nunca devolve msRemaining negativo — clampado em 0, nunca uma segunda detecção de staleness", () => {
    const openTimeSec = 1_700_000_000;
    const nowMs = openTimeSec * 1000 + 999_000; // bem depois do fechamento real de uma vela de 1m
    const r = computeCandleCountdown(openTimeSec, "1m", nowMs);
    expect(r!.msRemaining).toBe(0);
    expect(r!.label).toBe("0:00");
  });
});
