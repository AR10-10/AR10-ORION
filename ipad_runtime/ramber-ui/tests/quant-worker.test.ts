// quant-worker.test.ts — trava o bug real corrigido no handler
// 'compute_series': ao contrário dos irmãos compute_volume_profile e
// compute_trust_score (ambos com guarda upfront + result:null em entrada
// inválida), compute_series chamava o WASM direto com qualquer `window`
// (0, negativo, não-inteiro, ou maior que `len`) — na melhor hipótese o
// WASM já devolve NaN internamente (ver wasm-quant-core.test.ts), mas esse
// NaN vazava sem checagem para o objeto `result` do postMessage, e um
// `window` muito negativo fazia o loop `for (let i = window; i <= len;
// i++)` iterar um intervalo enorme e sem sentido antes de chegar lá.
// Teste de PADRÃO NO CÓDIGO-FONTE (mesmo espírito de diretriz3-fixes.
// test.ts): self.onmessage não é uma função exportável isoladamente —
// wiring de worker, não matemática pura — e o handler já tem uma trava
// numérica equivalente coberta em wasm-quant-core.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('quant-worker.js compute_series: guarda upfront, mesmo padrão dos irmãos compute_volume_profile/compute_trust_score', () => {
  it('valida len/window ANTES do loop de rolling stats e do result — nunca deixa window>len (ou <=0, ou não-inteiro) alcançar o WASM', () => {
    const worker = read('../../workers/quant-worker.js');
    const start = worker.indexOf("if (type === 'compute_series')");
    const end = worker.indexOf('unknown message type', start);
    expect(start, "handler 'compute_series' não encontrado").toBeGreaterThan(-1);
    expect(end, 'fim do onmessage (fallback unknown message type) não encontrado após compute_series').toBeGreaterThan(start);
    const body = worker.slice(start, end);

    const guardIdx = body.indexOf('if (len === 0 || !Number.isInteger(window) || window <= 0 || window > len)');
    const loopIdx = body.indexOf('for (let i = window; i <= len; i++)');
    expect(guardIdx, 'guarda upfront não encontrada').toBeGreaterThan(-1);
    expect(loopIdx, 'loop de rolling stats não encontrado').toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(loopIdx);

    // mesma forma de saída fail-closed dos 2 irmãos: result:null explícito,
    // nunca um objeto parcial nem um NaN escapando pro postMessage.
    expect(body).toContain("self.postMessage({ id, type: 'compute_series_result', result: null });");
  });

  it('a guarda cobre exatamente as 4 entradas inválidas: len 0, window não-inteiro, window<=0, window>len (mesma cobertura testada ao nível do WASM em wasm-quant-core.test.ts)', () => {
    const worker = read('../../workers/quant-worker.js');
    const guardLine = "if (len === 0 || !Number.isInteger(window) || window <= 0 || window > len) {";
    expect(worker).toContain(guardLine);
  });

  it('os 3 handlers de cálculo (compute_volume_profile, compute_trust_score, compute_series) agora seguem o MESMO formato de guarda: condição de entrada inválida -> result:null -> return, antes de tocar o WASM', () => {
    const worker = read('../../workers/quant-worker.js');
    const nullResultPatterns = [
      "self.postMessage({ id, type: 'volume_profile_result', result: null });",
      "self.postMessage({ id, type: 'trust_score_result', result: null });",
      "self.postMessage({ id, type: 'compute_series_result', result: null });",
    ];
    for (const pattern of nullResultPatterns) {
      expect(worker, `padrão ausente: ${pattern}`).toContain(pattern);
    }
  });
});
