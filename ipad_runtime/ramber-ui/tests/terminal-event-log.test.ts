// terminal-event-log.test.ts — Ordem 3 §17 (Terminal Event Log): execução
// real do formatter puro. Zero motor novo aqui, então o teste cobre
// exatamente o que o módulo faz — formatar eventos REAIS do bus em linhas
// legíveis, sem fabricar nenhuma mensagem que o evento não sustente.
import { describe, it, expect } from "vitest";
import {
  formatTerminalLogEntry,
  appendTerminalLogEntry,
  TERMINAL_LOG_MAX_ENTRIES,
  type TerminalLogEntry,
} from "../src/nexus/terminal-event-log";
import type { NexusEvent } from "../src/nexus/event-bus";

describe("formatTerminalLogEntry: cada tipo de evento real produz uma linha honesta, nunca fabricada", () => {
  it("DATA.CANDLES_UPDATED — mesmo formato do exemplo literal da Ordem 3 (§17)", () => {
    const event: NexusEvent = { type: "DATA.CANDLES_UPDATED", payload: { symbol: "BTCUSDT", tf: "5m", exchange: "BINANCE" } };
    const entry = formatTerminalLogEntry(event, 1000);
    expect(entry.category).toBe("MARKET");
    expect(entry.message).toBe("BTCUSDT 5m snapshot updated (BINANCE)");
    expect(entry.timestamp).toBe(1000);
    expect(entry.eventType).toBe("DATA.CANDLES_UPDATED");
  });

  it("UI.SYMBOL_CHANGED / UI.TIMEFRAME_CHANGED — categoria TERMINAL, mensagem real do payload", () => {
    expect(formatTerminalLogEntry({ type: "UI.SYMBOL_CHANGED", payload: { symbol: "ETHUSDT" } }, 1).message).toBe(
      "symbol changed to ETHUSDT",
    );
    expect(formatTerminalLogEntry({ type: "UI.TIMEFRAME_CHANGED", payload: { tf: "1h" } }, 1).message).toBe(
      "timeframe changed to 1h",
    );
  });

  it("OFFLINE.CHANGED — reflete o booleano real, nunca invertido", () => {
    expect(formatTerminalLogEntry({ type: "OFFLINE.CHANGED", payload: { offline: true } }, 1).message).toBe("connectivity: OFFLINE");
    expect(formatTerminalLogEntry({ type: "OFFLINE.CHANGED", payload: { offline: false } }, 1).message).toBe("connectivity: ONLINE");
  });

  it("BRAIN.NEXUS_DECISION.UPDATED — categoria DECISION, texto é o operation real, nunca reinterpretado", () => {
    const long = formatTerminalLogEntry(
      { type: "BRAIN.NEXUS_DECISION.UPDATED", payload: { decision: { operation: "LONG" } as any } },
      1,
    );
    expect(long.category).toBe("DECISION");
    expect(long.message).toBe("LONG");
    const cleared = formatTerminalLogEntry({ type: "BRAIN.NEXUS_DECISION.UPDATED", payload: { decision: null } }, 1);
    expect(cleared.message).toBe("decision cleared");
  });

  it("BRAIN.TRADE_PLAN.UPDATED — categoria TRADE PLAN, entry real citada, nunca inventada", () => {
    const plan = {
      direction: "LONG",
      entry: { low: 78200, high: 78350, basis: "OB_BULLISH" },
    } as any;
    const entry = formatTerminalLogEntry({ type: "BRAIN.TRADE_PLAN.UPDATED", payload: { plan } }, 1);
    expect(entry.category).toBe("TRADE PLAN");
    expect(entry.message).toBe("T1 updated (LONG, entry 78200-78350)");
    const cleared = formatTerminalLogEntry({ type: "BRAIN.TRADE_PLAN.UPDATED", payload: { plan: null } }, 1);
    expect(cleared.message).toBe("trade plan cleared");
  });

  it("QUANT.RISK_SUGGESTION.UPDATED — categoria RISK (nome do próprio evento, nunca uma reclassificação)", () => {
    const entry = formatTerminalLogEntry({ type: "QUANT.RISK_SUGGESTION.UPDATED", payload: { suggestion: {} as any } }, 1);
    expect(entry.category).toBe("RISK");
  });

  it("payload nulo em evento QUANT/BRAIN produz mensagem 'cleared'/'unavailable' honesta, nunca um valor fabricado", () => {
    expect(formatTerminalLogEntry({ type: "QUANT.VOLUME_PROFILE.UPDATED", payload: { profile: null } }, 1).message).toBe(
      "volume profile cleared",
    );
    expect(formatTerminalLogEntry({ type: "QUANT.CVD.UPDATED", payload: { cvd: null } }, 1).message).toBe("CVD unavailable");
    expect(formatTerminalLogEntry({ type: "BRAIN.HEAT_SCORE.UPDATED", payload: { reading: null } }, 1).message).toBe(
      "heat score unavailable",
    );
  });

  it("eventos com array real no payload contam o array real, nunca um número redigitado à parte", () => {
    const entry = formatTerminalLogEntry(
      { type: "BRAIN.RADAR_CANDIDATES.UPDATED", payload: { candidates: [{}, {}, {}] as any } },
      1,
    );
    expect(entry.message).toBe("radar candidates updated (3)");
  });

  it("HEALTH.CHANGED — campos reais citados (fps/latência/workers), null vira 'n/d' honesto", () => {
    const entry = formatTerminalLogEntry(
      {
        type: "HEALTH.CHANGED",
        payload: { fps: 60, cycleLatencyMs: null, memoryMb: null, workersAlive: 3, lastUpdatedAt: 1 },
      },
      1,
    );
    expect(entry.message).toBe("health snapshot: 60fps · cycle n/d · 3 workers alive");
  });

  it("DATA.* está coberto (nunca lança), mesmo sem publicador vivo hoje — gap documentado no próprio módulo", () => {
    expect(() =>
      formatTerminalLogEntry({ type: "DATA.CONNECTION_CHANGED", payload: { exchange: "BINANCE", state: "CONNECTED" as any } }, 1),
    ).not.toThrow();
  });
});

describe("appendTerminalLogEntry: ring buffer real, piso de memória respeitado", () => {
  const mk = (i: number): TerminalLogEntry => ({ timestamp: i, category: "MARKET", eventType: "UI.SYMBOL_CHANGED", message: `m${i}` });

  it("anexa em ordem, sem limite ainda atingido", () => {
    let log: TerminalLogEntry[] = [];
    log = appendTerminalLogEntry(log, mk(1));
    log = appendTerminalLogEntry(log, mk(2));
    expect(log.map((e) => e.timestamp)).toEqual([1, 2]);
  });

  it("descarta as entradas mais antigas além do máximo, mantendo as mais recentes", () => {
    let log: TerminalLogEntry[] = [];
    for (let i = 0; i < 5; i++) log = appendTerminalLogEntry(log, mk(i), 3);
    expect(log.map((e) => e.timestamp)).toEqual([2, 3, 4]);
  });

  it("default real é TERMINAL_LOG_MAX_ENTRIES quando o chamador não especifica", () => {
    let log: TerminalLogEntry[] = [];
    for (let i = 0; i < TERMINAL_LOG_MAX_ENTRIES + 10; i++) log = appendTerminalLogEntry(log, mk(i));
    expect(log.length).toBe(TERMINAL_LOG_MAX_ENTRIES);
    expect(log[log.length - 1].timestamp).toBe(TERMINAL_LOG_MAX_ENTRIES + 9);
  });

  it("nunca muta o array original — imutabilidade real", () => {
    const original: TerminalLogEntry[] = [mk(1)];
    const next = appendTerminalLogEntry(original, mk(2));
    expect(original.length).toBe(1);
    expect(next.length).toBe(2);
  });

  it("fail-closed: max inválido (0, negativo, NaN) cai no default, nunca produz um buffer vazio ou infinito por engano", () => {
    let log: TerminalLogEntry[] = [mk(1)];
    log = appendTerminalLogEntry(log, mk(2), 0);
    expect(log.length).toBe(2); // caiu no default (200), não truncou pra 0
    log = appendTerminalLogEntry(log, mk(3), NaN);
    expect(log.length).toBe(3);
  });
});
