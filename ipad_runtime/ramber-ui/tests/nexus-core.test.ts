// nexus-core.test.ts — V-MAX Fase 0.2: trava o Event Bus tipado e o
// ciclo de vida do Nexus Core. Mesmo espírito do resto da suíte: lógica
// pura, sem rede real.
import { describe, it, expect, vi } from 'vitest';
import { TypedEventBus } from '../src/nexus/event-bus';
import { NexusCore } from '../src/nexus/nexus-core';

describe('TypedEventBus: publica só para assinantes do tipo certo, nunca cross-talk entre tipos', () => {
  it('emit entrega o payload exato para on() do mesmo tipo', () => {
    const bus = new TypedEventBus();
    const received: any[] = [];
    bus.on('UI.SYMBOL_CHANGED', (p) => received.push(p));
    bus.emit({ type: 'UI.SYMBOL_CHANGED', payload: { symbol: 'ETH' } });
    expect(received).toEqual([{ symbol: 'ETH' }]);
  });

  it('assinante de um tipo nunca recebe evento de outro tipo', () => {
    const bus = new TypedEventBus();
    const received: any[] = [];
    bus.on('UI.SYMBOL_CHANGED', (p) => received.push(p));
    bus.emit({ type: 'UI.TIMEFRAME_CHANGED', payload: { tf: '1h' } });
    expect(received).toEqual([]);
  });

  it('off() (o cancelamento retornado por on()) para de receber eventos', () => {
    const bus = new TypedEventBus();
    const received: any[] = [];
    const off = bus.on('OFFLINE.CHANGED', (p) => received.push(p));
    bus.emit({ type: 'OFFLINE.CHANGED', payload: { offline: true } });
    off();
    bus.emit({ type: 'OFFLINE.CHANGED', payload: { offline: false } });
    expect(received).toEqual([{ offline: true }]);
  });

  it('um assinante que lança exceção nunca impede os demais de receber o evento (mesmo princípio de bus.js)', () => {
    const bus = new TypedEventBus();
    const received: any[] = [];
    bus.on('DATA.ORDERBOOK_UPDATED', () => {
      throw new Error('assinante com bug');
    });
    bus.on('DATA.ORDERBOOK_UPDATED', (p) => received.push(p));
    expect(() => bus.emit({ type: 'DATA.ORDERBOOK_UPDATED', payload: { exchange: 'BINANCE' } })).not.toThrow();
    expect(received).toEqual([{ exchange: 'BINANCE' }]);
  });

  it('emit em tipo sem nenhum assinante nunca lança', () => {
    const bus = new TypedEventBus();
    expect(() => bus.emit({ type: 'HEALTH.CHANGED', payload: { fps: 60, cycleLatencyMs: 10, memoryMb: null, workersAlive: 1, isOnline: true, lastUpdatedAt: Date.now() } })).not.toThrow();
  });

  it('clear() remove todos os assinantes de todos os tipos', () => {
    const bus = new TypedEventBus();
    bus.on('UI.SYMBOL_CHANGED', () => {});
    bus.on('UI.TIMEFRAME_CHANGED', () => {});
    bus.clear();
    expect(bus.listenerCount('UI.SYMBOL_CHANGED')).toBe(0);
    expect(bus.listenerCount('UI.TIMEFRAME_CHANGED')).toBe(0);
  });
});

describe('NexusCore: ciclo de vida real (start/pause/resume/stop), nunca lógica de negócio própria', () => {
  it('start() chama onStart de todo serviço registrado, uma vez cada', () => {
    const core = new NexusCore();
    const onStart = vi.fn();
    core.register({ onStart });
    core.start();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(core.getState()).toBe('running');
  });

  it('start() chamado duas vezes seguidas não dispara onStart de novo (idempotente)', () => {
    const core = new NexusCore();
    const onStart = vi.fn();
    core.register({ onStart });
    core.start();
    core.start();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('pause() só tem efeito vindo de running; resume() só tem efeito vindo de paused', () => {
    const core = new NexusCore();
    const onPause = vi.fn();
    const onResume = vi.fn();
    core.register({ onPause, onResume });
    core.pause(); // ainda idle — não deve disparar
    expect(onPause).not.toHaveBeenCalled();
    core.start();
    core.pause();
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(core.getState()).toBe('paused');
    core.resume();
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(core.getState()).toBe('running');
  });

  it('stop() dispara onStop, limpa hooks e limpa o Event Bus', () => {
    const core = new NexusCore();
    const onStop = vi.fn();
    core.register({ onStop });
    core.bus.on('OFFLINE.CHANGED', () => {});
    core.start();
    core.stop();
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(core.getState()).toBe('stopped');
    expect(core.bus.listenerCount('OFFLINE.CHANGED')).toBe(0);
  });

  it('o cancelamento retornado por register() remove o hook antes do próximo start/stop', () => {
    const core = new NexusCore();
    const onStart = vi.fn();
    const unregister = core.register({ onStart });
    unregister();
    core.start();
    expect(onStart).not.toHaveBeenCalled();
  });
});
