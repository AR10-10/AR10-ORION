// zigzag-engine.test.ts — execução REAL do motor puro ZigZag clássico
// (v16.0 PRO MAX §4/§6.3). Prova o comportamento que o distingue de
// fractal-swings.js: reversão por limiar percentual + profundidade
// mínima, nunca uma janela fixa de K candles. Imports o módulo real pelo
// caminho real (mesmo padrão de fractal-swings.test.ts) — nunca uma
// cópia/mock do motor.
//
// Nota sobre o "pivô inicial" que aparece em vários casos abaixo: o
// candle 0 é sempre o candidato inicial de AMBOS os lados (alta e
// baixa) simultaneamente. Assim que a série se afasta dele por
// deviation% (com `depth` barras satisfeitas), esse candle 0 vira um
// pivô CONFIRMADO de verdade — não é artefato de teste, é o mesmo
// comportamento de ancoragem no início da série usado por
// implementações de referência do indicador. Cada expectativa abaixo
// foi confirmada por execução real do motor (nunca hand-trace assumido)
// antes de entrar neste arquivo.
import { describe, it, expect } from 'vitest';
import {
  computeZigZag,
  ZIGZAG_DEFAULT_DEVIATION_PCT,
  ZIGZAG_DEFAULT_DEPTH,
} from '../../src/research/engines/zigzag-engine.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

type Candle = { h?: number; l?: number; high?: number; low?: number };

function flat(n: number, price: number): Candle[] {
  return Array.from({ length: n }, () => ({ h: price, l: price }));
}

describe('zigzag-engine: defaults', () => {
  it('deviation padrão é 5% (faixa usual de mercado 5-30%), depth padrão é 3 barras', () => {
    expect(ZIGZAG_DEFAULT_DEVIATION_PCT).toBe(5);
    expect(ZIGZAG_DEFAULT_DEPTH).toBe(3);
  });
});

describe('zigzag-engine: computeZigZag — fail-closed (DADOS_INSUFICIENTES)', () => {
  it('candles menor que depth+1 => DADOS_INSUFICIENTES, points vazio', () => {
    const r = computeZigZag(flat(2, 100), 5, 3);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.points).toEqual([]);
  });

  it('não é array => DADOS_INSUFICIENTES', () => {
    expect(computeZigZag(null as unknown as Candle[], 5, 3).status).toBe('DADOS_INSUFICIENTES');
    expect(computeZigZag(undefined as unknown as Candle[], 5, 3).status).toBe('DADOS_INSUFICIENTES');
  });

  it('deviationPct inválido (<=0, NaN, não finito) => DADOS_INSUFICIENTES', () => {
    const candles = flat(20, 100);
    expect(computeZigZag(candles, 0, 3).status).toBe('DADOS_INSUFICIENTES');
    expect(computeZigZag(candles, -5, 3).status).toBe('DADOS_INSUFICIENTES');
    expect(computeZigZag(candles, NaN, 3).status).toBe('DADOS_INSUFICIENTES');
    expect(computeZigZag(candles, Infinity, 3).status).toBe('DADOS_INSUFICIENTES');
  });

  it('depth inválido (negativo, NaN, não finito) => DADOS_INSUFICIENTES', () => {
    const candles = flat(20, 100);
    expect(computeZigZag(candles, 5, -1).status).toBe('DADOS_INSUFICIENTES');
    expect(computeZigZag(candles, 5, NaN).status).toBe('DADOS_INSUFICIENTES');
    expect(computeZigZag(candles, 5, Infinity).status).toBe('DADOS_INSUFICIENTES');
  });

  it('candle com high/low não finito em qualquer posição => DADOS_INSUFICIENTES (nunca aproxima dado ausente)', () => {
    const candles = flat(20, 100);
    candles[10] = { h: undefined, l: 100 };
    expect(computeZigZag(candles, 5, 3).status).toBe('DADOS_INSUFICIENTES');
  });

  it('aceita tanto {h,l} quanto {high,low} — mesmo resultado independente do shape', () => {
    const short: Candle[] = flat(20, 100);
    short[10] = { h: 130, l: 100 };
    const long: Candle[] = Array.from({ length: 20 }, () => ({ high: 100, low: 100 }));
    long[10] = { high: 130, low: 100 };
    expect(computeZigZag(short, 5, 1)).toEqual(computeZigZag(long, 5, 1));
  });
});

describe('zigzag-engine: computeZigZag — série sem reversão relevante', () => {
  it('série totalmente plana => OK com points vazio (nunca DADOS_INSUFICIENTES: dado real, só sem pivô)', () => {
    const r = computeZigZag(flat(30, 100), 5, 3);
    expect(r.status).toBe('OK');
    expect(r.points).toEqual([]);
  });

  it('oscilação abaixo do limiar de deviation nunca confirma pivô', () => {
    // Oscila +-2% em torno de 100 — sempre abaixo do limiar de 5%.
    const candles: Candle[] = Array.from({ length: 30 }, (_, i) => {
      const c = 100 + (i % 2 === 0 ? 2 : -2);
      return { h: c, l: c };
    });
    const r = computeZigZag(candles, 5, 1);
    expect(r.status).toBe('OK');
    expect(r.points).toEqual([]);
  });
});

describe('zigzag-engine: computeZigZag — detecção de pivô confirmado', () => {
  it('sobe e reverte => confirma o LOW inicial (candle 0, ancoragem de início de série) e depois o HIGH no topo real', () => {
    const candles: Candle[] = [
      { h: 100, l: 99 },
      { h: 110, l: 109 }, // +11.1% desde o low inicial (99) já cruza os 5% => confirma LOW@0
      { h: 120, l: 119 }, // topo real, ainda em formação
      { h: 100, l: 95 },  // reversão de >5% desde 120 => confirma HIGH no topo
      { h: 90, l: 85 },
    ];
    const r = computeZigZag(candles, 5, 1);
    expect(r.status).toBe('OK');
    expect(r.points).toEqual([
      { index: 0, price: 99, kind: 'LOW' },
      { index: 2, price: 120, kind: 'HIGH' },
    ]);
  });

  it('desce e reverte => confirma o HIGH inicial (candle 0, ancoragem de início de série) e depois o LOW no fundo real', () => {
    const candles: Candle[] = [
      { h: 101, l: 100 },
      { h: 91, l: 90 },
      { h: 81, l: 80 }, // fundo real, ainda em formação
      { h: 100, l: 85 }, // reversão de >5% desde 80 => confirma LOW no fundo
      { h: 110, l: 105 },
    ];
    const r = computeZigZag(candles, 5, 1);
    expect(r.status).toBe('OK');
    expect(r.points).toEqual([
      { index: 0, price: 101, kind: 'HIGH' },
      { index: 2, price: 80, kind: 'LOW' },
    ]);
  });

  it('perna em formação (ainda sem reversão de deviation% oposta) nunca aparece na saída, mesmo sendo o valor mais extremo da série — fail-closed, nunca mostra um pivô que ainda pode mudar', () => {
    const candles: Candle[] = [
      { h: 100, l: 99 },
      { h: 110, l: 109 }, // confirma LOW@0 (mesma ancoragem dos casos acima)
      { h: 130, l: 129 }, // estica o topo em formação — MAIOR valor da série, nunca revertido
    ];
    const r = computeZigZag(candles, 5, 1);
    expect(r.status).toBe('OK');
    expect(r.points).toEqual([{ index: 0, price: 99, kind: 'LOW' }]);
  });

  it('zigue-zague de mão com 3 pivôs confirmados (LOW inicial + 2 pernas completas), em ordem cronológica e com kind sempre alternando', () => {
    const candles: Candle[] = [
      { h: 100, l: 99 },
      { h: 120, l: 119 }, // confirma LOW@0 (99) e passa a rastrear o topo
      { h: 100, l: 95 },  // reversão -20% confirma HIGH@1 (120)
      { h: 80, l: 79 },   // fundo (index 3)
      { h: 100, l: 95 },  // reversão +25% confirma LOW@3 (79)
    ];
    const r = computeZigZag(candles, 5, 1);
    expect(r.status).toBe('OK');
    expect(r.points).toEqual([
      { index: 0, price: 99, kind: 'LOW' },
      { index: 1, price: 120, kind: 'HIGH' },
      { index: 3, price: 79, kind: 'LOW' },
    ]);
    for (let i = 1; i < r.points.length; i++) {
      expect(r.points[i].kind).not.toBe(r.points[i - 1].kind);
      expect(r.points[i].index).toBeGreaterThan(r.points[i - 1].index);
    }
  });
});

describe('zigzag-engine: computeZigZag — parâmetro depth (profundidade mínima)', () => {
  it('reversão que cruzaria o limiar % cedo demais (menos de `depth` barras do pivô) NUNCA confirma antes do depth ser satisfeito — só confirma no candle em que index - extIdx >= depth', () => {
    const candles: Candle[] = [
      { h: 100, l: 99 },
      { h: 120, l: 119 }, // topo candidato (index 1)
      { h: 100, l: 95 },  // reversão de -20% já no candle seguinte (i=2, i-extIdx=1) — cruza o limiar de 5% mas depth=3 exige >=3
      { h: 100, l: 95 },  // i=3, i-extIdx=2 — ainda < depth=3
      { h: 100, l: 95 },  // i=4, i-extIdx=3 — agora satisfaz depth=3, confirma aqui
    ];
    const withDepth3 = computeZigZag(candles, 5, 3);
    expect(withDepth3.status).toBe('OK');
    expect(withDepth3.points).toEqual([{ index: 1, price: 120, kind: 'HIGH' }]);
  });

  it('mesmo limiar %, depth menor confirma mais cedo — comparação direta contra o caso depth=3 acima (mesmo deviation, tail estabilizado para não recruzar o limiar repetidamente)', () => {
    const candles: Candle[] = [
      { h: 100, l: 99 },
      { h: 120, l: 119 },
      { h: 100, l: 95 }, // reversão -20% confirma o HIGH do topo
      { h: 97, l: 96 },  // tail estabilizado perto do fundo, nunca recruza os 5% de volta
      { h: 97, l: 96 },
    ];
    const r = computeZigZag(candles, 5, 1);
    expect(r.status).toBe('OK');
    // depth=1 confirma o LOW inicial (ancoragem) além do HIGH do topo —
    // ambos mais cedo que a versão depth=3 (que só confirma o HIGH).
    expect(r.points).toEqual([
      { index: 0, price: 99, kind: 'LOW' },
      { index: 1, price: 120, kind: 'HIGH' },
    ]);
  });

  it('depth=0 confirma no mesmo candle em que o limiar % é cruzado, sem exigir barras extras', () => {
    const candles: Candle[] = [
      { h: 100, l: 99 },
      { h: 120, l: 119 },
      { h: 100, l: 95 },
    ];
    const r = computeZigZag(candles, 5, 0);
    expect(r.status).toBe('OK');
    expect(r.points).toEqual([
      { index: 0, price: 99, kind: 'LOW' },
      { index: 1, price: 120, kind: 'HIGH' },
    ]);
  });
});

describe('zigzag-engine: computeZigZag — determinismo', () => {
  it('mesma entrada duas vezes => saída idêntica (função pura, zero estado global)', () => {
    const candles: Candle[] = [
      { h: 100, l: 99 },
      { h: 120, l: 119 },
      { h: 100, l: 95 },
      { h: 80, l: 79 },
      { h: 100, l: 95 },
    ];
    const a = computeZigZag(candles, 5, 1);
    const b = computeZigZag(candles, 5, 1);
    expect(a).toEqual(b);
  });
});

describe('zigzag-engine: FRONTEIRA (Laboratório de Evolução) — nenhum módulo de produção importa ainda', () => {
  it('zigzag-engine.js não é importado por engine-bridge.ts, CHART_LAYER_IDS nem qualquer outro caminho de produção — só testes (ver QUARANTINE.md)', () => {
    const roots = [resolve(here, '../src'), resolve(here, '../../src')];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') continue;
          walk(p);
        } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name) && p !== resolve(here, '../../src/research/engines/zigzag-engine.js')) {
          const src = readFileSync(p, 'utf8');
          if (src.includes('research/engines/zigzag-engine')) offenders.push(p);
        }
      }
    };
    for (const root of roots) walk(root);
    expect(offenders).toEqual([]);
  });

  it('o próprio fonte declara zero rede/relógio/aleatoriedade (função pura de cálculo)', () => {
    const src = readFileSync(resolve(here, '../../src/research/engines/zigzag-engine.js'), 'utf8');
    expect(src).not.toMatch(/fetch\(|WebSocket|Math\.random|Date\.now/);
  });
});
