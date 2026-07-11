// nexus-connection-manager.test.ts — V-MAX Fase 0.5: trava a máquina de
// estados de conexão (reconnect/backoff/heartbeat) com um transporte fake
// determinístico + timers fake do vitest. Testa a LÓGICA DE ESTADOS, nunca
// fabrica dado de mercado — mesmo espírito de nexus-core.test.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionManager, type WebSocketLike, type ConnectionManagerOptions } from '../src/nexus/connection-manager';

class FakeSocket implements WebSocketLike {
  onopen: ((ev: any) => void) | null = null;
  onclose: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;
  onmessage: ((ev: any) => void) | null = null;
  closed = false;
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.({});
  }
}

describe('ConnectionManager: nunca finge LIVE sem uma mensagem/abertura real', () => {
  let sockets: FakeSocket[];
  let states: string[];
  let manager: ConnectionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    states = [];
  });

  afterEach(() => {
    manager?.stop();
    vi.useRealTimers();
  });

  function makeManager(overrides: Partial<ConnectionManagerOptions> = {}) {
    manager = new ConnectionManager({
      connect: () => {
        const s = new FakeSocket();
        sockets.push(s);
        return s;
      },
      onMessage: () => {},
      onStateChange: (s) => states.push(s),
      ...overrides,
    });
    return manager;
  }

  it('estado inicial é IDLE — nunca CONNECTING/LIVE antes de start()', () => {
    makeManager();
    expect(manager.getState()).toBe('IDLE');
  });

  it('start() vai para CONNECTING e só chega a LIVE quando o socket real dispara onopen', () => {
    makeManager();
    manager.start();
    expect(manager.getState()).toBe('CONNECTING');
    sockets[0].onopen?.({});
    expect(manager.getState()).toBe('LIVE');
  });

  it('start() chamado duas vezes seguidas não abre um segundo socket (idempotente)', () => {
    makeManager();
    manager.start();
    manager.start();
    expect(sockets).toHaveLength(1);
  });

  it('onmessage entrega o payload real ao callback e atualiza o relógio de silêncio', () => {
    const received: any[] = [];
    makeManager({ onMessage: (d) => received.push(d) });
    manager.start();
    sockets[0].onopen?.({});
    sockets[0].onmessage?.({ data: '{"real":true}' });
    expect(received).toEqual(['{"real":true}']);
  });

  it('onclose real agenda reconexão com backoff exponencial (1s → 2s → 4s ...), nunca imediato', () => {
    makeManager({ initialBackoffMs: 1000, maxBackoffMs: 15000 });
    manager.start();
    sockets[0].onopen?.({});
    sockets[0].close(); // onclose real
    expect(manager.getState()).toBe('OFFLINE');
    expect(sockets).toHaveLength(1); // ainda não reconectou

    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(sockets).toHaveLength(2); // reconectou após ~1s
    expect(manager.getState()).toBe('CONNECTING');

    sockets[1].close(); // cai de novo antes de abrir
    vi.advanceTimersByTime(1999);
    expect(sockets).toHaveLength(2); // backoff dobrou para ~2s, ainda não
    vi.advanceTimersByTime(2);
    expect(sockets).toHaveLength(3);
  });

  it('onopen real reseta o backoff de volta ao valor inicial (uma conexão saudável não deve herdar backoff acumulado)', () => {
    makeManager({ initialBackoffMs: 1000, maxBackoffMs: 15000 });
    manager.start();
    sockets[0].close(); // queda antes de abrir — backoff ainda no inicial, mas exercita o caminho
    vi.advanceTimersByTime(1001);
    sockets[1].onopen?.({}); // agora abre de verdade — reseta backoff
    sockets[1].close();
    expect(manager.getState()).toBe('OFFLINE');
    vi.advanceTimersByTime(1001); // se o backoff NÃO tivesse resetado, isto ainda seria cedo demais (precisaria ~2s)
    expect(sockets).toHaveLength(3);
  });

  it('silêncio maior que staleAfterMs mas menor que heartbeatMs vira STALE, sem forçar reconexão', () => {
    makeManager({ staleAfterMs: 10_000, heartbeatMs: 20_000, heartbeatCheckIntervalMs: 1_000 });
    manager.start();
    sockets[0].onopen?.({});
    vi.advanceTimersByTime(11_000);
    expect(manager.getState()).toBe('STALE');
    expect(sockets).toHaveLength(1); // nenhum reconnect ainda
  });

  it('uma mensagem real depois de STALE volta para LIVE (recuperação honesta)', () => {
    makeManager({ staleAfterMs: 10_000, heartbeatMs: 20_000, heartbeatCheckIntervalMs: 1_000 });
    manager.start();
    sockets[0].onopen?.({});
    vi.advanceTimersByTime(11_000);
    expect(manager.getState()).toBe('STALE');
    sockets[0].onmessage?.({ data: 'ping' });
    expect(manager.getState()).toBe('LIVE');
  });

  it('silêncio maior que heartbeatMs força reconexão mesmo sem onclose/onerror (conexão muda sem avisar)', () => {
    makeManager({ staleAfterMs: 10_000, heartbeatMs: 20_000, heartbeatCheckIntervalMs: 1_000 });
    manager.start();
    sockets[0].onopen?.({});
    // A checagem roda a cada 1000ms; a marca de 20000ms exatos ainda NÃO
    // excede heartbeatMs (>, não >=) — precisa passar do próximo tick
    // (21000ms) para de fato ultrapassar o limite.
    vi.advanceTimersByTime(21_000);
    expect(manager.getState()).toBe('OFFLINE');
    vi.advanceTimersByTime(1_001); // backoff inicial (default 1000ms) já passou
    expect(sockets).toHaveLength(2); // reconectou de verdade
  });

  it('stop() é honesto e definitivo: nenhum reconnect agendado dispara depois, mesmo esperando muito tempo', () => {
    makeManager({ initialBackoffMs: 1000 });
    manager.start();
    sockets[0].onopen?.({});
    sockets[0].close();
    manager.stop();
    expect(manager.getState()).toBe('OFFLINE');
    const countBefore = sockets.length;
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(countBefore); // nada novo foi aberto
  });

  it('stop() sem nunca ter dado start() não lança e fica OFFLINE', () => {
    makeManager();
    expect(() => manager.stop()).not.toThrow();
    expect(manager.getState()).toBe('OFFLINE');
  });
});
