// shared-symbols.test.ts — BUG real corrigido: SYMBOL_TO_PAIR era o mesmo
// objeto literal duplicado byte-a-byte em 3 conectores (binance-public.js,
// binance-futures-public.js, mexc-trades-stream.js). Execução real do
// módulo compartilhado + padrão no código-fonte confirmando que os 3
// conectores agora importam em vez de redeclarar.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SYMBOL_TO_USDT_PAIR } from '../../js/shared/symbols.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('shared/symbols.js: fonte única real do mapeamento symbol curto -> par USDT', () => {
  it('mapeia os 5 pares reais conhecidos (mesmo conteúdo já usado nos 3 conectores)', () => {
    expect(SYMBOL_TO_USDT_PAIR).toEqual({ BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', BNB: 'BNBUSDT', XRP: 'XRPUSDT' });
  });

  it('é imutável — nenhum conector pode mutar o mapa compartilhado por engano', () => {
    expect(Object.isFrozen(SYMBOL_TO_USDT_PAIR)).toBe(true);
  });
});

describe('os 3 conectores reais importam de shared/symbols.js, nunca redeclaram o mapa localmente', () => {
  const consumers = [
    '../../js/real-data/binance-public.js',
    '../../js/real-data/binance-futures-public.js',
    '../../js/real-data/mexc-trades-stream.js',
  ];

  for (const rel of consumers) {
    it(`${rel} importa SYMBOL_TO_USDT_PAIR de shared/symbols.js`, () => {
      const code = read(rel);
      expect(code).toContain("import { SYMBOL_TO_USDT_PAIR as SYMBOL_TO_PAIR } from '../shared/symbols.js';");
      expect(code).not.toMatch(/const SYMBOL_TO_PAIR = Object\.freeze\(\{\s*BTC:/);
    });
  }
});
