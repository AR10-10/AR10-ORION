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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

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

describe('zigzag-engine: propriedades do motor puro (zero rede/relógio/aleatoriedade)', () => {
  it('o próprio fonte declara zero rede/relógio/aleatoriedade (função pura de cálculo)', () => {
    const src = read('../../src/research/engines/zigzag-engine.js');
    expect(src).not.toMatch(/fetch\(|WebSocket|Math\.random|Date\.now/);
  });
});

// Fiação real ponta a ponta (convenção mista deste repositório: matemática
// pura ganha execução real acima; "esqueceram de ligar A com B" ganha trava
// de padrão no código-fonte — mesmo molde de liquidity-void-engine.test.ts).
// Caminho completo (Entrega 47, pedido direto do Operador — graduação do
// Laboratório de Evolução): zigzag-engine.js → engine-bridge.computeZigZag
// → App.tsx (relevanceInput.hasZigZagPivots + painel Camadas do Gráfico) →
// EnhancedChart_110_Percent (CHART_LAYER_IDS/visibility) → ZigZagPlugin.
describe('ZigZag: graduação real ponta a ponta (QUARANTINE.md + bridge + App + chart)', () => {
  it('QUARANTINE.md documenta o engine como graduado no MESMO commit (disciplina obrigatória do CLAUDE.md)', () => {
    const quarantine = read('../../src/research/QUARANTINE.md');
    expect(quarantine).toContain('zigzag-engine.js               ACTIVE_READ_ONLY (graduado 2026-08-10)');
    expect(quarantine).toContain('**`engines/zigzag-engine.js`** (graduado 2026-08-10, Entrega 47');
  });

  it('engine-bridge: wrapper fino sobre o motor real (nunca uma segunda implementação), fail-closed em status != OK', () => {
    const bridge = read('../src/engine-bridge.ts');
    // Independente de formatação: o import virou multilinha quando a perna do
    // Fibonacci passou a consumir o mesmo motor (ZIGZAG_DEFAULT_* entraram
    // junto). O que este teste guarda é o CONTRATO — o alias vem do motor
    // real —, nunca o estilo de quebra de linha.
    expect(bridge).toMatch(
      /import\s*\{[^}]*computeZigZag as computeZigZagPure[^}]*\}\s*from\s*'\.\.\/\.\.\/src\/research\/engines\/zigzag-engine\.js'/s,
    );
    expect(bridge).toContain('export function computeZigZag(');
    expect(bridge).toContain('const result = computeZigZagPure(candles, deviationPct, depth);');
    expect(bridge).toContain("if (result.status !== 'OK') return [];");
  });

  it('App.tsx: relevância real (>=2 pivôs) sobre o MESMO chartData, e entrada no painel Camadas do Gráfico', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('computeZigZag,');
    expect(app).toContain('const hasZigZagPivots = Array.isArray(chartData) && computeZigZag(chartData).length >= 2;');
    expect(app).toContain('{ id: "zigzag", label: "ZIGZAG" },');
  });

  it('EnhancedChart: CHART_LAYER_IDS + visibilidade padrão + plugin de canvas montado condicionalmente', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('"zigzag",');
    expect(chart).toContain('zigzag: true,');
    expect(chart).toContain('import { ZigZagPlugin } from "./ZigZagPlugin";');
    expect(chart).toContain('visibility.zigzag && (');
  });

  it('layer-relevance: existência real de pivôs (>=2), nunca proximidade — mesmo padrão de tpo_profile', () => {
    const relevance = read('../src/nexus/layer-relevance.ts');
    expect(relevance).toContain('hasZigZagPivots: boolean;');
    expect(relevance).toContain('zigzag: input.hasZigZagPivots');
  });
});
