// connection-manager.ts — V-MAX Fase 0.5: máquina de estados de conexão
// genérica (reconnect + backoff + heartbeat), exchange-agnóstica.
//
// Extraída como peça própria e testável porque é exatamente a parte que o
// código real de WS já tinha (App.tsx: reconnect com backoff exponencial
// 1s→15s em onclose/onerror) MAS sem heartbeat — uma conexão que para de
// mandar mensagens sem nunca fechar o socket (silêncio, não erro) ficava
// presa em "aberta" para sempre. Esta peça generaliza o reconnect real já
// comprovado e ACRESCENTA a detecção de silêncio que faltava — mesmos
// números reais já em produção (1000ms inicial, dobra até 15000ms), não
// valores inventados para esta peça nova.
//
// Transporte injetável (WebSocketLike) por design: em produção é
// `(url) => new WebSocket(url)` — um adaptador trivial, real. Em teste é um
// fake determinístico que dispara os mesmos callbacks (onopen/onmessage/
// onclose) que um WebSocket real dispararia. Isto testa a MÁQUINA DE
// ESTADOS (a lógica nova e não-trivial), nunca fabrica dado de mercado —
// mesma categoria do harness Playwright isolado já usado nesta sessão para
// o gráfico, e do fake-indexeddb já usado para a persistência.
import type { ExchangeConnectionState } from "./types";

export interface WebSocketLike {
  onopen: ((ev: any) => void) | null;
  onclose: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
  onmessage: ((ev: any) => void) | null;
  close(): void;
}

export interface ConnectionManagerOptions {
  connect: () => WebSocketLike;
  onMessage: (data: any) => void;
  onStateChange?: (state: ExchangeConnectionState) => void;
  /** Silêncio total (sem nenhuma mensagem) além disto força um reconnect —
   *  a conexão pode estar "aberta" mas já não está entregando dado real. */
  heartbeatMs?: number;
  /** Silêncio mais curto que heartbeatMs já rebaixa o estado para STALE
   *  (aviso honesto), sem ainda forçar reconexão. */
  staleAfterMs?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  /** Intervalo real de checagem do heartbeat — não precisa ser fino, só
   *  mais curto que staleAfterMs. */
  heartbeatCheckIntervalMs?: number;
  now?: () => number;
}

const DEFAULTS = {
  heartbeatMs: 20_000,
  staleAfterMs: 10_000,
  initialBackoffMs: 1_000,
  maxBackoffMs: 15_000,
  heartbeatCheckIntervalMs: 2_000,
};

/** Supervisiona UMA conexão real (WebSocket ou equivalente): abre, escuta,
 *  detecta silêncio, reconecta com backoff exponencial, nunca finge estar
 *  "LIVE" sem uma mensagem real recebida dentro da janela de heartbeat. */
export class ConnectionManager {
  private readonly opts: Required<Omit<ConnectionManagerOptions, "onStateChange">> & Pick<ConnectionManagerOptions, "onStateChange">;
  private socket: WebSocketLike | null = null;
  private state: ExchangeConnectionState = "IDLE";
  private backoffMs: number;
  private lastMessageAt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private deliberatelyStopped = true;

  constructor(options: ConnectionManagerOptions) {
    this.opts = { ...DEFAULTS, now: Date.now, ...options };
    this.backoffMs = this.opts.initialBackoffMs;
  }

  getState(): ExchangeConnectionState {
    return this.state;
  }

  start(): void {
    if (!this.deliberatelyStopped) return; // já rodando — idempotente
    this.deliberatelyStopped = false;
    this.backoffMs = this.opts.initialBackoffMs;
    this.openSocket();
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => this.checkHeartbeat(), this.opts.heartbeatCheckIntervalMs);
    }
  }

  stop(): void {
    this.deliberatelyStopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.closeSocket();
    this.setState("OFFLINE");
  }

  private openSocket(): void {
    this.setState("CONNECTING");
    const socket = this.opts.connect();
    this.socket = socket;
    socket.onopen = () => {
      this.lastMessageAt = this.opts.now();
      this.backoffMs = this.opts.initialBackoffMs;
      this.setState("LIVE");
    };
    socket.onmessage = (ev: any) => {
      this.lastMessageAt = this.opts.now();
      if (this.state === "STALE") this.setState("LIVE");
      this.opts.onMessage(ev?.data !== undefined ? ev.data : ev);
    };
    const handleDrop = () => {
      if (this.socket !== socket) return; // socket já trocado — evento tardio, ignora
      this.socket = null;
      if (this.deliberatelyStopped) return;
      this.setState("OFFLINE");
      this.scheduleReconnect();
    };
    socket.onclose = handleDrop;
    socket.onerror = () => {
      socket.close();
      handleDrop();
    };
  }

  private closeSocket(): void {
    if (!this.socket) return;
    const socket = this.socket;
    this.socket = null;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    try {
      socket.close();
    } catch {
      // já fechado — sem problema.
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.deliberatelyStopped) return;
      this.backoffMs = Math.min(this.backoffMs * 2, this.opts.maxBackoffMs);
      this.openSocket();
    }, this.backoffMs);
  }

  private checkHeartbeat(): void {
    if (this.deliberatelyStopped || this.state === "OFFLINE" || this.state === "CONNECTING") return;
    const silenceMs = this.opts.now() - this.lastMessageAt;
    if (silenceMs > this.opts.heartbeatMs) {
      // Silêncio longo demais: a conexão pode estar tecnicamente aberta mas
      // não está entregando dado real — força o mesmo caminho de queda que
      // um onclose real dispararia, com o mesmo backoff.
      this.closeSocket();
      this.setState("OFFLINE");
      this.scheduleReconnect();
    } else if (silenceMs > this.opts.staleAfterMs && this.state === "LIVE") {
      this.setState("STALE");
    }
  }

  private setState(next: ExchangeConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.opts.onStateChange?.(next);
  }
}
