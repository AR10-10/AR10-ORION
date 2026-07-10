// types.ts — V-MAX Fase 0: tipos compartilhados do Nexus Core. Fonte única
// para Exchange/Timeframe/Candle/L2 em todo o módulo nexus/ — evita cada
// arquivo reinventar sua própria forma do mesmo dado real (Regra de Ouro
// 9, "Backward-compatible... aditivas").
//
// Exchange: só as 3 fontes REAIS que este sistema já tem conector para
// (Binance Futures = fonte primária de candles/L2/Core Engine; Bybit/OKX =
// cross-check de markPrice via REST, ver cross-exchange/). Nenhuma quarta
// exchange é declarada aqui até que exista um conector real para ela —
// declarar o tipo sem o conector seria a mesma dívida de "zero mocks" que
// as Regras de Ouro proíbem, só que no nível de tipos.
export type Exchange = "BINANCE" | "BYBIT" | "OKX";

// Os 14 timeframes reais já aceitos pela API pública de klines de Futuros
// da Binance e já expostos na régua de timeframe do gráfico
// (App.tsx's CHART_TIMEFRAMES) — mesma lista, mesma convenção de "m"
// minúsculo = minuto / "M" maiúsculo = mês.
export type Timeframe =
  | "1m" | "3m" | "5m" | "15m" | "30m"
  | "1h" | "2h" | "4h" | "6h" | "8h" | "12h"
  | "1d" | "1w" | "1M";

export interface Candle {
  time: number; // Unix segundos real
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface L2Level {
  price: number;
  size: number;
}

export interface L2Snapshot {
  bids: L2Level[];
  asks: L2Level[];
  updatedAt: number;
}

// Estado de conexão honesto por exchange — nunca "conectado" sem uma
// abertura real de socket/resposta HTTP 2xx confirmada.
export type ExchangeConnectionState =
  | "IDLE" // nunca solicitado nesta sessão
  | "CONNECTING"
  | "LIVE" // WS aberto e recebendo frames, ou REST respondendo dentro do maxAge
  | "STALE" // conectado mas sem frame novo além do heartbeat esperado
  | "DEGRADED" // reconectando após falha, último dado bom ainda em cache
  | "OFFLINE"; // sem conexão e sem fallback possível no momento

export interface HealthSnapshot {
  fps: number | null;
  cycleLatencyMs: number | null;
  memoryMb: number | null; // null quando performance.memory não existe (Safari) — nunca fabricado
  workersAlive: number;
  isOnline: boolean;
  lastUpdatedAt: number;
}
