// liquidity-void-engine.test.ts — pesquisa real confirmou (WebSearch,
// citada no cabeçalho do motor) que um Liquidity Void é um deslocamento
// de MÚLTIPLOS candles com participação de volume anormalmente baixa
// para o alcance percorrido (Volume Efficiency Ratio), distinto de um
// Fair Value Gap (imbalance de 3 candles). Fixtures constroem um período
// "quieto" real (range/volume estáveis, calibra ATR/volume médio) seguido
// de candles reais de deslocamento (alcance grande, volume baixo) — os
// números exatos foram validados por execução direta do motor antes de
// travar aqui como asserção (nunca um valor adivinhado).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { analyze } from '../../src/research/engines/liquidity-void-engine.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const T0 = 1_700_000_000;
const STEP = 900; // 15m em segundos, mesma convenção canônica dos outros testes de engine

function quietCandle(i: number, mid: number, volume = 100) {
  return { t: T0 + i * STEP, o: mid - 0.4, h: mid + 0.5, l: mid - 0.5, c: mid + 0.3, v: volume };
}

// Alcance ~8 (bem acima do ATR real do trecho quieto, ~1) com volume 20
// (bem abaixo da média real do trecho quieto, 100) — Volume Efficiency
// Ratio real cai bem abaixo do limiar declarado (0.5).
function voidCandle(i: number, mid: number, dir: 'up' | 'down', volume = 20) {
  const half = 4;
  return dir === 'up'
    ? { t: T0 + i * STEP, o: mid - half, h: mid + half, l: mid - half - 0.1, c: mid + half - 0.1, v: volume }
    : { t: T0 + i * STEP, o: mid + half, h: mid + half + 0.1, l: mid - half, c: mid - half + 0.1, v: volume };
}

function quietBaseline(n: number, startMid: number, driftPerCandle: number) {
  return Array.from({ length: n }, (_, i) => quietCandle(i, startMid + i * driftPerCandle));
}

describe('liquidity-void-engine: fail-closed honesto sem candles reais suficientes', () => {
  it('array vazio => DADOS_INSUFICIENTES (aquecimento real do ATR de Wilder, ATR_PERIOD=14 + folga)', () => {
    const result = analyze({ ohlcv_series: [] });
    expect(result.status).toBe('DADOS_INSUFICIENTES');
    expect(result.reason).toBe('apenas_0_candles_abaixo_do_minimo_19');
  });

  it('candles reais mas abaixo do mínimo (10 < 19) => DADOS_INSUFICIENTES honesto', () => {
    const result = analyze({ ohlcv_series: Array.from({ length: 10 }, (_, i) => quietCandle(i, 100)) });
    expect(result.status).toBe('DADOS_INSUFICIENTES');
  });
});

describe('liquidity-void-engine: mercado quieto real, sem deslocamento real algum', () => {
  it('30 candles com range/volume estáveis => zero voids (nenhum candle atinge 1x ATR de deslocamento)', () => {
    const result = analyze({ ohlcv_series: quietBaseline(30, 100, 0.05) });
    expect(result.status).toBe('OK');
    expect(result.liquidity_voids).toEqual([]);
    expect(result.unmitigated_void_count).toBe(0);
  });
});

describe('liquidity-void-engine: void real (deslocamento de múltiplos candles reais, baixa participação de volume)', () => {
  it('3 candles consecutivos de deslocamento real pra cima => 1 zona BULLISH real, envelope = high/low real dos 3 candles', () => {
    const baseline = quietBaseline(30, 100, 0.05);
    const lastMid = 100 + 29 * 0.05;
    const candles = [
      ...baseline,
      voidCandle(30, lastMid + 8, 'up'),
      voidCandle(31, lastMid + 16, 'up'),
      voidCandle(32, lastMid + 24, 'up'),
    ];
    const result = analyze({ ohlcv_series: candles });
    expect(result.status).toBe('OK');
    expect(result.liquidity_voids).toHaveLength(1);
    const zone = result.liquidity_voids[0];
    expect(zone.type).toBe('BULLISH');
    expect(zone.index).toBe(30); // âncora = candle MAIS ANTIGO do run real, nunca o mais recente
    expect(zone.candleCount).toBe(3);
    expect(zone.top).toBeCloseTo(lastMid + 24 + 4, 6);
    expect(zone.bottom).toBeCloseTo(lastMid + 8 - 4 - 0.1, 6);
  });

  it('1 único candle fino isolado (sem confirmação de um 2º candle consecutivo) NUNCA forma zona real — void é deslocamento de VÁRIOS candles, não 1', () => {
    const baseline = quietBaseline(30, 100, 0.05);
    const lastMid = 100 + 29 * 0.05;
    const candles = [...baseline, voidCandle(30, lastMid + 8, 'up')];
    for (let i = 31; i < 40; i++) candles.push(quietCandle(i, lastMid + i * 0.01));
    const result = analyze({ ohlcv_series: candles });
    expect(result.status).toBe('OK');
    expect(result.liquidity_voids).toEqual([]);
  });

  it('void BEARISH real: candles de deslocamento pra baixo formam zona com type BEARISH', () => {
    const baseline = quietBaseline(30, 100, -0.05);
    const lastMid = 100 - 29 * 0.05;
    const candles = [...baseline, voidCandle(30, lastMid - 8, 'down'), voidCandle(31, lastMid - 16, 'down')];
    const result = analyze({ ohlcv_series: candles });
    expect(result.liquidity_voids).toHaveLength(1);
    expect(result.liquidity_voids[0].type).toBe('BEARISH');
  });

  it('mitigated=true quando um candle POSTERIOR real já voltou a tocar dentro da zona (mesma definição de FVG/Order Block)', () => {
    const baseline = quietBaseline(30, 100, 0.05);
    const lastMid = 100 + 29 * 0.05;
    const candles = [
      ...baseline,
      voidCandle(30, lastMid + 8, 'up'),
      voidCandle(31, lastMid + 16, 'up'),
      voidCandle(32, lastMid + 24, 'up'),
    ];
    // Candle logo após o run com mid ainda dentro do envelope real da zona.
    for (let i = 33; i < 40; i++) candles.push(quietCandle(i, lastMid + 24 + (i - 33) * 0.05));
    const result = analyze({ ohlcv_series: candles });
    expect(result.liquidity_voids[0].mitigated).toBe(true);
    expect(result.unmitigated_void_count).toBe(0);
  });

  it('mitigated=false quando o preço real nunca mais retorna à zona (continua se afastando)', () => {
    const baseline = quietBaseline(30, 100, -0.05);
    const lastMid = 100 - 29 * 0.05;
    const candles = [...baseline, voidCandle(30, lastMid - 8, 'down'), voidCandle(31, lastMid - 16, 'down')];
    const zoneBottomApprox = lastMid - 20;
    for (let i = 32; i < 45; i++) candles.push(quietCandle(i, zoneBottomApprox - 6 - (i - 32) * 1));
    const result = analyze({ ohlcv_series: candles });
    expect(result.liquidity_voids[0].mitigated).toBe(false);
    expect(result.unmitigated_void_count).toBe(1);
  });
});

describe('liquidity-void-engine: fail-closed honesto sem volume real (Regra de Ouro 1 — nunca aproxima volume a partir de outro dado)', () => {
  it('candles sem campo de volume algum => zero voids, nunca lança/quebra', () => {
    const baseline = Array.from({ length: 30 }, (_, i) => ({ t: T0 + i * STEP, o: 100, h: 100.5, l: 99.5, c: 100.2 }));
    const candles = [
      ...baseline,
      { t: T0 + 30 * STEP, o: 96, h: 104, l: 95.9, c: 103.9 },
      { t: T0 + 31 * STEP, o: 104, h: 112, l: 103.9, c: 111.9 },
    ];
    expect(() => analyze({ ohlcv_series: candles })).not.toThrow();
    const result = analyze({ ohlcv_series: candles });
    expect(result.status).toBe('OK');
    expect(result.liquidity_voids).toEqual([]);
  });
});

// Fiação real ponta a ponta (convenção mista deste repositório: matemática
// pura ganha execução real acima; "esqueceram de ligar A com B" ganha trava
// de padrão no código-fonte). Caminho completo:
// liquidity-void-engine.js → engine-bridge.computeLiquidityVoids →
// App.tsx useMemo → WidgetContext → ChartWidget → EnhancedChart →
// LiquidityZonesPlugin (3º kind "VOID").
describe('Liquidity Void: graduação real ponta a ponta (QUARANTINE.md + bridge + App + chart + plugin)', () => {
  it('QUARANTINE.md documenta o engine como graduado no MESMO commit (disciplina obrigatória do CLAUDE.md)', () => {
    const quarantine = read('../../src/research/QUARANTINE.md');
    expect(quarantine).toContain('liquidity-void-engine.js       ACTIVE_READ_ONLY (graduado 2026-08-04)');
    expect(quarantine).toContain('**`engines/liquidity-void-engine.js`**');
    expect(quarantine).toContain('Zero `fetch()` novo, zero\n  credencial, zero `order_send`.');
  });

  it('engine-bridge: wrapper fino sobre o motor real (nunca uma segunda implementação), fail-closed em status != OK', () => {
    const bridge = read('../src/engine-bridge.ts');
    expect(bridge).toContain("import { analyze as analyzeLiquidityVoids } from '../../src/research/engines/liquidity-void-engine.js';");
    expect(bridge).toContain('export function computeLiquidityVoids(');
    expect(bridge).toContain('const result = analyzeLiquidityVoids({ ohlcv_series: candles });');
    expect(bridge).toContain("if (result.status !== 'OK') return [];");
    // Exige `volume` real na assinatura — diferente de computeSmcZones/
    // computeBosChoch, que só precisam de OHLC (Regra de Ouro 1: o motor
    // nunca aproxima volume a partir de outro dado).
    expect(bridge).toContain('candles: Array<{ open: number; high: number; low: number; close: number; volume: number }>,');
  });

  it('App.tsx: useMemo sobre o MESMO chartData de smcZones/bosChoch (index alinhado ao array desenhado), só zonas não mitigadas chegam ao gráfico', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const liquidityVoids = useMemo<PriceZone[]>(');
    expect(app).toContain('() => (chartData && chartData.length > 0 ? computeLiquidityVoids(chartData) : []),');
    expect(app).toContain('const unmitigatedVoidsAll = (liquidityVoids ?? []).filter((z: PriceZone) => !z.mitigated);');
    // O teto do Void era o único que escolhia por ORDEM DE CHEGADA pura
    // (`i < 3`), sem sequer olhar a largura. Agora ele disputa o mesmo
    // orçamento das outras quatro famílias, por largura real em ATR — e a
    // união de obstáculos reais continua: um void que o plano ativo cruza
    // nunca fica invisível por causa do decluttering.
    expect(app).toContain('const unmitigatedVoids = unmitigatedVoidsAll.filter(emDestaque);');
    expect(app).not.toContain('i < 3 || isRealObstacle(z)');
    expect(app).toContain('liquidityVoids={unmitigatedVoids}');
  });

  it('EnhancedChart: prop repassada ao LiquidityZonesPlugin com o mesmo fallback honesto de FVG/OB', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('liquidityVoids?: EnhancedChartZone[];');
    // O `?? []` inline virou constante de módulo (NO_FILLABLE_ZONES): um
    // array literal novo a cada render marcava o canvas como sujo
    // eternamente. O fallback honesto que este teste protege continua lá.
    expect(chart).toMatch(/liquidityVoids=\{.*liquidityVoids \?\? NO_FILLABLE_ZONES.*\}/);
  });
});
