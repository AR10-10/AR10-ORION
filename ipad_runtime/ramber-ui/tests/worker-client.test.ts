// worker-client.test.ts — trava o bug real corrigido em terminate(): antes,
// terminate() só matava o Worker nativo sem nunca resolver/rejeitar as
// Promises pendentes em this.pending — qualquer chamador que já tivesse
// disparado call() (ping/computeSeries/...) ficava esperando para sempre
// uma resposta que o worker morto nunca mais enviaria. Correção usa o
// MESMO padrão já existente no onerror (rejeita tudo, limpa o Map).
// Execução real do módulo — mocka só o global Worker (fronteira nativa,
// mesmo espírito do fetch() mockado nos testes de conector; ambiente
// vitest é 'node', que não tem Worker nativo).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QuantWorkerClient } from '../../js/worker-client.js';

class FakeWorker {
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  posted: unknown[] = [];
  terminated = false;
  constructor(public url: unknown, public opts: unknown) {}
  postMessage(msg: unknown) {
    this.posted.push(msg);
  }
  terminate() {
    this.terminated = true;
  }
}

describe('QuantWorkerClient.terminate(): nenhuma chamada pendente fica presa para sempre', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejeita TODAS as promises pendentes de call() em aberto, mesmo padrão do onerror', async () => {
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
    const client = new QuantWorkerClient('fake-worker-url');
    const p1 = client.call('ping');
    const p2 = client.call('init_wasm');

    client.terminate();

    await expect(p1).rejects.toThrow();
    await expect(p2).rejects.toThrow();
  });

  it('esvazia this.pending — nenhuma promise fantasma sobrevive ao terminate', () => {
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
    const client = new QuantWorkerClient('fake-worker-url');
    client.call('ping').catch(() => {});
    client.call('ping').catch(() => {});
    expect((client as unknown as { pending: Map<number, unknown> }).pending.size).toBe(2);

    client.terminate();

    expect((client as unknown as { pending: Map<number, unknown> }).pending.size).toBe(0);
  });

  it('chama worker.terminate() de verdade — o worker nativo morre, não só as promises são liberadas', () => {
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
    const client = new QuantWorkerClient('fake-worker-url');
    client.terminate();
    expect((client as unknown as { worker: FakeWorker }).worker.terminated).toBe(true);
  });

  it('terminate() sem nenhuma chamada pendente não lança (worker recém-criado, nunca usado)', () => {
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
    const client = new QuantWorkerClient('fake-worker-url');
    expect(() => client.terminate()).not.toThrow();
  });
});
