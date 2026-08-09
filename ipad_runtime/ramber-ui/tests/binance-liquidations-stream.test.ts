// binance-liquidations-stream.test.ts — primeira suíte real deste conector.
// parseLiquidationMessage (função pura, execução real) + o BUG real
// corrigido em startLiquidationStream: ws.onopen não tinha a mesma guarda
// `if (stopped) return;` que ws.onclose já tinha — numa corrida real de
// rede (stop() chamado enquanto a conexão ainda está CONNECTING), um
// onopen tardio reportava ACTIVE_READ_ONLY para uma stream que o
// chamador já mandou parar. Mocka só o global WebSocket (fronteira
// nativa, mesmo espírito do Worker mockado em worker-client.test.ts —
// ambiente vitest é 'node', sem WebSocket real utilizável offline).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseLiquidationMessage, startLiquidationStream, LiquidationSide } from '../../js/real-data/binance-liquidations-stream.js';
import { CONNECTOR_STATES } from '../../js/real-data/schema.js';

describe('parseLiquidationMessage: mapeia forceOrder real para evento, fail-closed sobre schema inesperado', () => {
  it('S:SELL (posição LONG liquidada) mapeia campos reais corretamente', () => {
    const raw = { e: 'forceOrder', o: { s: 'BTCUSDT', S: 'SELL', q: '0.5', ap: '50000', T: 1_700_000_000_000 } };
    const parsed = parseLiquidationMessage(raw);
    expect(parsed).toEqual({
      symbol: 'BTCUSDT',
      side: LiquidationSide.LONG_LIQUIDATED,
      price: 50000,
      qty: 0.5,
      notionalUsd: 25000,
      timestamp: 1_700_000_000_000,
    });
  });

  it('S:BUY (posição SHORT liquidada) mapeia o lado oposto', () => {
    const raw = { e: 'forceOrder', o: { s: 'ETHUSDT', S: 'BUY', q: '2', ap: '3000', T: 1_700_000_000_000 } };
    expect(parseLiquidationMessage(raw)?.side).toBe(LiquidationSide.SHORT_LIQUIDATED);
  });

  it('usa z/p como fallback real quando ap/q não vêm (mesma convenção documentada no header)', () => {
    const raw = { e: 'forceOrder', o: { s: 'BTCUSDT', S: 'SELL', p: '100', z: '1', T: 1 } };
    const parsed = parseLiquidationMessage(raw);
    expect(parsed?.price).toBe(100);
    expect(parsed?.qty).toBe(1);
  });

  it('mensagem de outro tipo, sem o campo o, ou com S inválido => null honesto, nunca um evento inventado', () => {
    expect(parseLiquidationMessage(null)).toBeNull();
    expect(parseLiquidationMessage({ e: 'outroTipo', o: {} })).toBeNull();
    expect(parseLiquidationMessage({ e: 'forceOrder' })).toBeNull();
    expect(parseLiquidationMessage({ e: 'forceOrder', o: { s: 'BTCUSDT', S: 'HOLD' } })).toBeNull();
  });

  it('campos numéricos não-finitos => null honesto', () => {
    expect(parseLiquidationMessage({ e: 'forceOrder', o: { s: 'BTCUSDT', S: 'SELL', q: 'abc', ap: '100', T: 1 } })).toBeNull();
  });
});

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  closeCalls = 0;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  close() {
    this.closeCalls += 1;
  }
}

describe('startLiquidationStream: BUG real corrigido — onopen não reporta ACTIVE_READ_ONLY numa corrida pós-stop()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeWebSocket.instances.length = 0;
  });

  it('stop() chamado ANTES do onopen disparar (corrida real de rede): onState nunca recebe ACTIVE_READ_ONLY', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
    const states: unknown[] = [];
    const stop = startLiquidationStream({ onEvent: () => {}, onState: (s) => states.push(s) });

    stop(); // simula o Operador saindo da tela antes da conexão terminar de abrir
    const ws = FakeWebSocket.instances[0];
    ws.onopen?.(); // evento nativo "atrasado" que o navegador pode entregar mesmo após close()

    expect(states).not.toContain(CONNECTOR_STATES.ACTIVE_READ_ONLY);
  });

  it('caminho normal (sem stop): onopen ainda reporta ACTIVE_READ_ONLY corretamente — a guarda não quebra o caso são', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
    const states: unknown[] = [];
    startLiquidationStream({ onEvent: () => {}, onState: (s) => states.push(s) });
    const ws = FakeWebSocket.instances[0];
    ws.onopen?.();
    expect(states).toContain(CONNECTOR_STATES.ACTIVE_READ_ONLY);
  });

  it('stop() real fecha o WebSocket em voo', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
    const stop = startLiquidationStream({ onEvent: () => {}, onState: () => {} });
    const ws = FakeWebSocket.instances[0];
    stop();
    expect(ws.closeCalls).toBeGreaterThan(0);
  });
});
