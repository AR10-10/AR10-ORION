// cross-exchange-service.ts — V-MAX Fase 0.5 (Blueprint §2.2): serviço real
// de dados multi-exchange. Escopo honesto, não o pleno "kline+L2 em toda
// exchange" aspiracional do Blueprint: nesta árvore, só a Binance tem
// stream real de kline+L2 (o mesmo WS combinado que App.tsx já mantém para
// ticker+depth, aqui ganhando também `@kline_<tf>`); Bybit/OKX continuam
// sendo, de verdade, sondas REST de markPrice (bybit-futures.ts/
// okx-futures.ts, reaproveitadas aqui sem duplicar lógica) — nunca kline,
// nunca L2, porque isso não existe hoje para elas neste código. Fingir uma
// API uniforme de "kline+L2" para as três seria a mesma dívida de mock que
// a Regra de Ouro 1 proíbe, só que arquitetural em vez de num valor.
//
// MEXC (Ordem "Multi-Source Data Ingestion Layer", fonte prioritária do
// Operador): sonda REST de preço SPOT (mesmo padrão de Bybit/OKX) + a
// PRIMEIRA profundidade L2 real de uma exchange além da Binance neste
// código (mexc-spot.ts) — instrumento SPOT, não Futures, então o
// cross-check de preço carrega uma base real (prêmio/desconto de
// perpétuo) contra o markPrice de Futures da Binance; ver o header de
// mexc-spot.ts para o porquê disso NÃO alimentar o TrustScoreEngine ainda.
//
// Deliberadamente NÃO iniciado por App.tsx nesta fase (isso é a Fase 0.6,
// escopada à parte por ser o passo de maior risco: substituir o WS/REST
// inline que já funciona em produção). Este arquivo entrega o serviço
// real, testado e correto, pronto para ser ligado — não uma reescrita
// simultânea do caminho que já está no ar.
import { ConnectionManager, type WebSocketLike } from "./connection-manager";
import type { TypedEventBus } from "./event-bus";
import type { Candle, Exchange, L2Snapshot, Timeframe } from "./types";
import { useUnifiedSnapshotStore } from "../store/unified-snapshot-store";
import { fetchBybitPerpTicker } from "../cross-exchange/bybit-futures";
import { fetchOkxPerpTicker } from "../cross-exchange/okx-futures";
// Ordem "Multi-Source Data Ingestion Layer": MEXC como fonte prioritária
// (preço SPOT via REST, mesmo padrão de Bybit/OKX) + profundidade L2 REAL
// — capacidade que nem Bybit nem OKX têm hoje neste código. Ver o header
// de mexc-spot.ts para o porquê de MEXC não alimentar TrustScoreEngine
// ainda (spot-vs-perp é base real, não ruído de confiança).
import { fetchMexcPerpTicker, fetchMexcDepth } from "../cross-exchange/mexc-spot";
import type { PerpTicker } from "../cross-exchange/shared";

const CHART_CANDLE_LIMIT = 200; // mesmo teto real já usado por App.tsx/o Bus — nunca um segundo número solto.

/** Funde um candle ao vivo (fechado ou ainda em formação) no ring real já
 *  carregado — nunca duplica a mesma vela, nunca aceita uma vela mais
 *  antiga que a última conhecida (frame fora de ordem/atrasado). Função
 *  pura: testável sem WebSocket nenhum. */
export function mergeLiveCandle(existing: Candle[], incoming: Candle, limit = CHART_CANDLE_LIMIT): Candle[] {
  if (existing.length === 0) return [incoming];
  const last = existing[existing.length - 1];
  if (incoming.time === last.time) {
    return [...existing.slice(0, -1), incoming];
  }
  if (incoming.time > last.time) {
    const next = [...existing, incoming];
    return next.length > limit ? next.slice(next.length - limit) : next;
  }
  return existing; // vela mais antiga que a última conhecida — descartada, nunca reordenada às cegas.
}

const BINANCE_WS_BASE = "wss://stream.binance.com:9443/stream?streams=";
const REST_POLL_MS_DEFAULT = 60_000; // igual ao derivInterval real já em produção (App.tsx).

export interface CrossExchangeServiceOptions {
  symbol: string;
  timeframe: Timeframe;
  bus: TypedEventBus;
  wsFactory?: (url: string) => WebSocketLike;
  restPollMs?: number;
}

interface DepthLevel {
  price: number;
  size: number;
}

/** Serviço real (Blueprint §2.2): Binance kline+L2 via WebSocket supervisionado
 *  (reconnect+heartbeat via ConnectionManager); Bybit/OKX via REST poll —
 *  todos publicando no mesmo UnifiedGlobalSnapshot (Single Source of
 *  Truth) e no mesmo Nexus Event Bus tipado, nunca um caminho paralelo. */
export class CrossExchangeService {
  private symbol: string;
  private timeframe: Timeframe;
  private readonly bus: TypedEventBus;
  private readonly wsFactory: (url: string) => WebSocketLike;
  private readonly restPollMs: number;

  private binanceManager: ConnectionManager | null = null;
  private bybitTimer: ReturnType<typeof setInterval> | null = null;
  private okxTimer: ReturnType<typeof setInterval> | null = null;
  private mexcTimer: ReturnType<typeof setInterval> | null = null;
  private lastBybitOk: boolean | null = null;
  private lastOkxOk: boolean | null = null;
  private lastMexcOk: boolean | null = null;
  private running = false;

  constructor(options: CrossExchangeServiceOptions) {
    this.symbol = options.symbol;
    this.timeframe = options.timeframe;
    this.bus = options.bus;
    this.wsFactory = options.wsFactory ?? ((url) => new WebSocket(url) as unknown as WebSocketLike);
    this.restPollMs = options.restPollMs ?? REST_POLL_MS_DEFAULT;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startBinance();
    this.pollBybit();
    this.bybitTimer = setInterval(() => this.pollBybit(), this.restPollMs);
    this.pollOkx();
    this.okxTimer = setInterval(() => this.pollOkx(), this.restPollMs);
    this.pollMexc();
    this.mexcTimer = setInterval(() => this.pollMexc(), this.restPollMs);
  }

  stop(): void {
    this.running = false;
    this.binanceManager?.stop();
    this.binanceManager = null;
    if (this.bybitTimer) {
      clearInterval(this.bybitTimer);
      this.bybitTimer = null;
    }
    if (this.okxTimer) {
      clearInterval(this.okxTimer);
      this.okxTimer = null;
    }
    if (this.mexcTimer) {
      clearInterval(this.mexcTimer);
      this.mexcTimer = null;
    }
  }

  /** Troca de ativo real (mesmo gesto do usuário que hoje reinicia o WS
   *  inline em App.tsx) — reabre a conexão Binance com o novo par; Bybit/OKX
   *  simplesmente passam a sondar o novo símbolo no próximo poll. */
  setSymbol(symbol: string): void {
    if (symbol === this.symbol) return;
    this.symbol = symbol;
    if (this.running) this.startBinance();
  }

  /** Troca de timeframe real — a stream de kline é por intervalo; só ela
   *  precisa reabrir (mesmo padrão: reconectar é mais simples e honesto que
   *  tentar re-subscrever um stream combinado já aberto). */
  setTimeframe(tf: Timeframe): void {
    if (tf === this.timeframe) return;
    this.timeframe = tf;
    if (this.running) this.startBinance();
  }

  getBinanceState() {
    return this.binanceManager?.getState() ?? "IDLE";
  }

  private streamNames() {
    const s = this.symbol.toLowerCase();
    return {
      depthStream: `${s}usdt@depth10@100ms`,
      klineStream: `${s}usdt@kline_${this.timeframe}`,
    };
  }

  private startBinance(): void {
    this.binanceManager?.stop();
    const { depthStream, klineStream } = this.streamNames();
    const url = `${BINANCE_WS_BASE}${depthStream}/${klineStream}`;
    this.binanceManager = new ConnectionManager({
      connect: () => this.wsFactory(url),
      onMessage: (raw) => this.handleBinanceMessage(raw),
      onStateChange: (state) => {
        const prev = useUnifiedSnapshotStore.getState().connections.BINANCE;
        if (prev === state) return;
        useUnifiedSnapshotStore.getState().setConnectionState("BINANCE", state);
        this.bus.emit({ type: "DATA.CONNECTION_CHANGED", payload: { exchange: "BINANCE", state } });
      },
    });
    this.binanceManager.start();
  }

  private handleBinanceMessage(raw: unknown): void {
    let msg: any;
    try {
      msg = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return; // frame malformado — descarta, mantém a conexão (mesmo princípio de App.tsx).
    }
    const { depthStream, klineStream } = this.streamNames();
    if (msg?.stream === depthStream) {
      this.handleDepth(msg.data);
    } else if (msg?.stream === klineStream) {
      this.handleKline(msg.data);
    }
  }

  private handleDepth(d: any): void {
    if (!d?.bids || !d?.asks) return;
    const bids: DepthLevel[] = d.bids.slice(0, 8).map((b: string[]) => ({ price: Number(b[0]), size: Number(b[1]) }));
    const asks: DepthLevel[] = d.asks.slice(0, 8).map((a: string[]) => ({ price: Number(a[0]), size: Number(a[1]) })).reverse();
    const snapshot: L2Snapshot = { bids, asks, updatedAt: Date.now() };
    useUnifiedSnapshotStore.getState().setExchangeOrderBook("BINANCE", snapshot);
    this.bus.emit({ type: "DATA.ORDERBOOK_UPDATED", payload: { exchange: "BINANCE" } });
  }

  private handleKline(d: any): void {
    const k = d?.k;
    if (!k) return;
    const candle: Candle = {
      time: Math.round(Number(k.t) / 1000), // ms → s, mesma conversão real do conector REST (binance-futures-candle-connector.js).
      open: Number(k.o),
      high: Number(k.h),
      low: Number(k.l),
      close: Number(k.c),
    };
    if (![candle.time, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)) return;
    const symbol = this.symbol;
    const tf = this.timeframe;
    const existing = useUnifiedSnapshotStore.getState().candles[symbol]?.[tf] ?? [];
    const merged = mergeLiveCandle(existing, candle);
    useUnifiedSnapshotStore.getState().setCandles(symbol, tf, merged);
    this.bus.emit({ type: "DATA.CANDLES_UPDATED", payload: { symbol, tf, exchange: "BINANCE" } });
  }

  private async pollBybit(): Promise<void> {
    await this.pollRestExchange("BYBIT", (symbol) => fetchBybitPerpTicker(symbol));
  }

  private async pollOkx(): Promise<void> {
    await this.pollRestExchange("OKX", (symbol) => fetchOkxPerpTicker(symbol));
  }

  // MEXC: preço SPOT real (mesmo padrão de ticker que Bybit/OKX, via
  // pollRestExchange abaixo) + profundidade L2 real — capacidade que nem
  // Bybit nem OKX têm hoje. Duas buscas reais por ciclo, deliberadamente
  // sequenciais (nunca Promise.all): se o ticker cair a depth ainda roda,
  // e vice-versa — uma falha nunca esconde a outra atrás de um catch
  // combinado.
  private async pollMexc(): Promise<void> {
    await this.pollRestExchange("MEXC", (symbol) => fetchMexcPerpTicker(symbol));
    await this.pollMexcDepth();
  }

  private async pollMexcDepth(): Promise<void> {
    const symbol = this.symbol;
    const depth = await fetchMexcDepth(symbol);
    if (!this.running || symbol !== this.symbol || !depth.ok) return; // fail-closed: mantém o último snapshot real em vez de apagar por uma falha pontual — connections.MEXC/updatedAt já contam a idade honestamente.
    const snapshot: L2Snapshot = { bids: depth.bids, asks: depth.asks, updatedAt: Date.now() };
    useUnifiedSnapshotStore.getState().setExchangeOrderBook("MEXC", snapshot);
    this.bus.emit({ type: "DATA.ORDERBOOK_UPDATED", payload: { exchange: "MEXC" } });
  }

  private async pollRestExchange(exchange: Exchange, fetcher: (symbol: string) => Promise<PerpTicker>): Promise<void> {
    const symbol = this.symbol;
    const ticker = await fetcher(symbol);
    if (!this.running || symbol !== this.symbol) return; // resposta tardia de um símbolo já trocado — descarta.
    const last = exchange === "BYBIT" ? this.lastBybitOk : exchange === "OKX" ? this.lastOkxOk : this.lastMexcOk;
    if (last === ticker.ok) return; // sem transição real — nunca reescreve a store/emite evento à toa.
    if (exchange === "BYBIT") this.lastBybitOk = ticker.ok;
    else if (exchange === "OKX") this.lastOkxOk = ticker.ok;
    else this.lastMexcOk = ticker.ok;
    const state = ticker.ok ? "LIVE" : "DEGRADED";
    useUnifiedSnapshotStore.getState().setConnectionState(exchange, state);
    this.bus.emit({ type: "DATA.CONNECTION_CHANGED", payload: { exchange, state } });
  }
}
