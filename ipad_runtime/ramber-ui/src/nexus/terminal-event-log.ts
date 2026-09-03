// terminal-event-log.ts — ORDEM 3 (PROFESSIONAL MARKET TERMINAL) §17
// ("Terminal Event Log"): formata eventos REAIS do organismo em linhas de
// log legíveis — "esse terminal deve mostrar o que o sistema está
// realmente fazendo. NÃO escrever mensagens falsas de processamento. Cada
// evento deve nascer de um evento real do sistema."
//
// ZERO MOTOR NOVO, ZERO EVENTO FABRICADO. Este módulo não decide nada e
// não escuta nada sozinho — ele só FORMATA o `NexusEvent` real que o
// chamador já recebeu de `event-bus.ts` (o TypedEventBus real do Nexus
// Core, publicado hoje por OrganismOrchestrator/CrossExchangeService/
// Health Monitor — ver o comentário de auditoria no topo de event-bus.ts).
// Nenhuma string aqui é gerada por um timer nem por suposição: cada
// `formatTerminalLogEntry()` recebe o payload REAL já emitido e só lê
// campos que esse payload já carrega.
//
// CATEGORIA — mapeamento honesto, não uma reclassificação por análise: o
// rótulo entre colchetes vem do PRÓPRIO nome do tipo de evento (o mesmo
// domínio já documentado em event-bus.ts — §1 Mercado/DATA, §3 Motores
// Quant/QUANT, §4 Cérebro/BRAIN, §5 Organismo/ORGANISM — a mesma
// organização de unified-snapshot-store.ts). Onde o nome do evento já cita
// o conceito que a Ordem 3 pede (RISK_SUGGESTION→RISK, TRADE_PLAN→TRADE
// PLAN, NEXUS_DECISION→DECISION, CANDLES→MARKET), o rótulo usa esse
// conceito; para o resto, cai no domínio real do bus (QUANT/BRAIN/
// ORGANISM/DATA/HEALTH/UI) em vez de forçar uma categoria (STRUCTURE vs
// LIQUIDITY vs ORDER FLOW) que exigiria uma leitura de conteúdo que este
// formatter não faz.
//
// GAP HONESTO, REGISTRADO: os eventos DATA.* não têm publicador vivo hoje
// (cross-exchange-service.ts não é iniciado por App.tsx nesta fase — ver
// event-bus.ts) — o formatter cobre o tipo mesmo assim (nunca lança), mas
// na prática essas 3 linhas nunca aparecem no log real até aquele serviço
// ligar.
import type { NexusEvent, NexusEventType } from "./event-bus";

export const TERMINAL_LOG_MAX_ENTRIES = 200;

export interface TerminalLogEntry {
  timestamp: number;
  category: string;
  eventType: NexusEventType;
  message: string;
}

// Rótulo por tipo de evento — string literal, nunca calculado a partir do
// conteúdo do payload (isso ficaria fabricação de categoria).
const CATEGORY_BY_EVENT_TYPE: Record<NexusEventType, string> = {
  "DATA.CANDLES_UPDATED": "MARKET",
  "DATA.ORDERBOOK_UPDATED": "MARKET",
  "DATA.CONNECTION_CHANGED": "MARKET",
  "HEALTH.CHANGED": "SYSTEM",
  "UI.TIMEFRAME_CHANGED": "TERMINAL",
  "UI.SYMBOL_CHANGED": "TERMINAL",
  "OFFLINE.CHANGED": "SYSTEM",
  "QUANT.VOLUME_PROFILE.UPDATED": "QUANT",
  "QUANT.FIBONACCI.UPDATED": "QUANT",
  "QUANT.SMC.UPDATED": "QUANT",
  "QUANT.CVD.UPDATED": "ORDERFLOW",
  "QUANT.ORDERFLOW_SIGNALS.UPDATED": "ORDERFLOW",
  "QUANT.CONFLUENCE_CORRIDOR.UPDATED": "QUANT",
  "QUANT.INSTITUTIONAL_ZONES.UPDATED": "QUANT",
  "QUANT.RISK_SUGGESTION.UPDATED": "RISK",
  "BRAIN.COUNCIL.UPDATED": "BRAIN",
  "BRAIN.SCENARIO.UPDATED": "BRAIN",
  "BRAIN.TRAPS.UPDATED": "BRAIN",
  "BRAIN.TRADE_PLAN.UPDATED": "TRADE PLAN",
  "BRAIN.RADAR_CANDIDATES.UPDATED": "BRAIN",
  "BRAIN.NEXUS_DECISION.UPDATED": "DECISION",
  "BRAIN.INSTITUTIONAL_SCORE.UPDATED": "BRAIN",
  "BRAIN.HEAT_SCORE.UPDATED": "BRAIN",
  "BRAIN.GMIL.UPDATED": "BRAIN",
  "ORGANISM.TRUST.UPDATED": "ORGANISM",
  "ORGANISM.AFFECT.UPDATED": "ORGANISM",
  "ORGANISM.TRACK_RECORD.UPDATED": "TRADE PLAN",
};

/** Uma linha real por tipo de evento — cada campo lido já existe no
 *  payload real (nunca uma 2ª medição). `null`/ausência vira uma frase
 *  honesta ("cleared"/"unavailable"), nunca um valor fabricado. */
function messageFor(event: NexusEvent): string {
  switch (event.type) {
    case "DATA.CANDLES_UPDATED":
      return `${event.payload.symbol} ${event.payload.tf} snapshot updated (${event.payload.exchange})`;
    case "DATA.ORDERBOOK_UPDATED":
      return `order book updated (${event.payload.exchange})`;
    case "DATA.CONNECTION_CHANGED":
      return `${event.payload.exchange} connection: ${event.payload.state}`;
    case "HEALTH.CHANGED": {
      const h = event.payload;
      const fps = h.fps === null ? "n/d" : `${h.fps}fps`;
      const lat = h.cycleLatencyMs === null ? "n/d" : `${h.cycleLatencyMs}ms`;
      return `health snapshot: ${fps} · cycle ${lat} · ${h.workersAlive} workers alive`;
    }
    case "UI.TIMEFRAME_CHANGED":
      return `timeframe changed to ${event.payload.tf}`;
    case "UI.SYMBOL_CHANGED":
      return `symbol changed to ${event.payload.symbol}`;
    case "OFFLINE.CHANGED":
      return event.payload.offline ? "connectivity: OFFLINE" : "connectivity: ONLINE";
    case "QUANT.VOLUME_PROFILE.UPDATED":
      return event.payload.profile ? "volume profile updated" : "volume profile cleared";
    case "QUANT.FIBONACCI.UPDATED":
      return event.payload.matrix ? "fibonacci confluence updated" : "fibonacci confluence cleared";
    case "QUANT.SMC.UPDATED":
      return event.payload.zones ? "SMC zones (FVG/OB) updated" : "SMC zones cleared";
    case "QUANT.CVD.UPDATED":
      return event.payload.cvd === null ? "CVD unavailable" : `CVD updated: ${event.payload.cvd}`;
    case "QUANT.ORDERFLOW_SIGNALS.UPDATED":
      return `orderflow signals updated (${event.payload.signals.length})`;
    case "QUANT.CONFLUENCE_CORRIDOR.UPDATED":
      return event.payload.reading ? "confluence corridor updated" : "confluence corridor cleared";
    case "QUANT.INSTITUTIONAL_ZONES.UPDATED":
      return `institutional zones updated (${event.payload.zones.length})`;
    case "QUANT.RISK_SUGGESTION.UPDATED":
      return event.payload.suggestion ? "risk suggestion recalculated" : "risk suggestion cleared";
    case "BRAIN.COUNCIL.UPDATED":
      return event.payload.decision ? `council updated: ${event.payload.decision.stance}` : "council decision cleared";
    case "BRAIN.SCENARIO.UPDATED":
      return event.payload.projection ? "scenario projection updated" : "scenario projection cleared";
    case "BRAIN.TRAPS.UPDATED":
      return `liquidity sweep traps updated (${event.payload.traps.length})`;
    case "BRAIN.TRADE_PLAN.UPDATED":
      return event.payload.plan
        ? `T1 updated (${event.payload.plan.direction}, entry ${event.payload.plan.entry.low}-${event.payload.plan.entry.high})`
        : "trade plan cleared";
    case "BRAIN.RADAR_CANDIDATES.UPDATED":
      return `radar candidates updated (${event.payload.candidates.length})`;
    case "BRAIN.NEXUS_DECISION.UPDATED":
      return event.payload.decision ? `${event.payload.decision.operation}` : "decision cleared";
    case "BRAIN.INSTITUTIONAL_SCORE.UPDATED":
      return event.payload.reading ? `institutional score updated: ${event.payload.reading.score}` : "institutional score unavailable";
    case "BRAIN.HEAT_SCORE.UPDATED":
      return event.payload.reading ? `heat score updated: ${event.payload.reading.tier}` : "heat score unavailable";
    case "BRAIN.GMIL.UPDATED":
      return event.payload.snapshot ? "GMIL context updated" : "GMIL context unavailable";
    case "ORGANISM.TRUST.UPDATED":
      return event.payload.score ? "trust score updated" : "trust score unavailable";
    case "ORGANISM.AFFECT.UPDATED":
      return event.payload.cpi === null ? "affective memory updated" : `affective memory updated: cpi=${event.payload.cpi}`;
    case "ORGANISM.TRACK_RECORD.UPDATED":
      return "track record recalculated";
  }
}

/** Compositor puro: NexusEvent real -> linha real de log. Mesmo evento,
 *  mesmo timestamp de entrada, mesma saída — nenhum I/O, nenhum relógio
 *  próprio (o chamador fornece `timestamp`, real, no instante em que o
 *  evento chegou ao assinante). */
export function formatTerminalLogEntry(event: NexusEvent, timestamp: number): TerminalLogEntry {
  return {
    timestamp,
    category: CATEGORY_BY_EVENT_TYPE[event.type],
    eventType: event.type,
    message: messageFor(event),
  };
}

/** Ring buffer real: anexa uma entrada, descarta as mais antigas além do
 *  piso de memória declarado (TERMINAL_LOG_MAX_ENTRIES — mesma natureza de
 *  outros pisos deste repositório, ex. SHARED_ZONE_HIGHLIGHT_SLOTS: convenção
 *  documentada, não medição). Nunca reescreve o histórico já anexado. */
export function appendTerminalLogEntry(
  log: readonly TerminalLogEntry[],
  entry: TerminalLogEntry,
  max: number = TERMINAL_LOG_MAX_ENTRIES,
): TerminalLogEntry[] {
  const next = [...log, entry];
  const limite = Number.isFinite(max) && max > 0 ? Math.floor(max) : TERMINAL_LOG_MAX_ENTRIES;
  return next.length > limite ? next.slice(next.length - limite) : next;
}
