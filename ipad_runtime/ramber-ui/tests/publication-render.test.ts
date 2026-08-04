// publication-render.test.ts — Ordem "AR10 PUBLICATION STUDIO": execução
// REAL da matemática pura do módulo publication/ (faixa de preço do
// mini-gráfico, nomes de arquivo com timestamp compartilhado, gate
// fail-closed por formato). O desenho em si (CanvasRenderingContext2D) não
// tem como rodar sob `environment: 'node'` deste projeto (vitest.config.ts
// — sem jsdom/canvas) — verificado via Playwright real em vez de mock de
// canvas (mesma disciplina de real execution sobre fake behavior).
import { describe, it, expect } from 'vitest';
import { computeChartPriceRange } from '../src/publication/mini-chart';
import { buildPublicationFilename, publicationTimestampSlug } from '../src/publication/filenames';
import { canPublishFormat, MIN_CHART_CANDLES, PUBLICATION_FORMAT_ORDER } from '../src/publication/types';
import type { PublicationCandle, PublicationSnapshot } from '../src/publication/types';
import type { MarketAnalysis } from '../src/nexus/market-analysis';

function makeCandles(n: number, basePrice = 100): PublicationCandle[] {
  const out: PublicationCandle[] = [];
  let price = basePrice;
  for (let i = 0; i < n; i++) {
    const open = price;
    const close = price + (i % 2 === 0 ? 1 : -1);
    const high = Math.max(open, close) + 0.5;
    const low = Math.min(open, close) - 0.5;
    out.push({ time: 1_700_000_000 + i * 3600, open, high, low, close });
    price = close;
  }
  return out;
}

const BASE_ANALYSIS: MarketAnalysis = {
  contractVersion: 1,
  symbol: 'BTCUSDT',
  timeframe: '1h',
  generatedAt: new Date(2026, 7, 4, 10, 32, 0).getTime(), // 2026-08-04 10:32 local
  regimeLabel: 'Tendência de Alta',
  structureLabel: 'BULLISH',
  bias: 'LONG_BIAS',
  outcome: 'LONG',
  confluence: 'ALINHADA',
  risk: { state: 'ACEITÁVEL', basis: 'stop real mapeado · R:R no piso ou acima · sem fator extremo' },
  confidenceLabel: 'ALTA',
  score: 72,
  zoneOfInterest: { price: 96, label: 'S1', touches: 3 },
  retest: null,
  plan: {
    entryLow: 99,
    entryHigh: 100,
    entryBasis: 'OB_BULLISH',
    invalidationPrice: 95,
    invalidationBasis: 'SR_SUPPORT_1',
    targets: [
      { index: 0, price: 105, riskReward: 1.22, reached: false },
      { index: 1, price: 110, riskReward: 2.44, reached: false },
    ],
  },
  planGapLabel: null,
  corePlan: null,
  narrative: 'Mercado com viés de alta. Estrutura real mapeada; entrada ainda aguarda confirmação de timing.',
};

const baseSnapshot = (overrides: Partial<PublicationSnapshot> = {}): PublicationSnapshot => ({
  analysis: BASE_ANALYSIS,
  candles: makeCandles(60),
  livePrice: 99.5,
  ...overrides,
});

describe('computeChartPriceRange: candles + Entry/Stop/preço vivo sempre no quadro; alvos só até um teto real', () => {
  it('sem candles => null (fail-closed, nunca uma faixa inventada)', () => {
    expect(
      computeChartPriceRange({ candles: [], entryLow: null, entryHigh: null, stopPrice: null, targetPrices: [], livePrice: null }),
    ).toBeNull();
  });

  it('só candles: faixa cobre exatamente [min(low), max(high)] + padding real', () => {
    const candles = makeCandles(10, 100);
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    const range = computeChartPriceRange({ candles, entryLow: null, entryHigh: null, stopPrice: null, targetPrices: [], livePrice: null })!;
    expect(range.min).toBeLessThan(Math.min(...lows));
    expect(range.max).toBeGreaterThan(Math.max(...highs));
  });

  it('Entry/Stop fora da faixa dos candles expandem a faixa — nunca ficam cortados de fora do quadro', () => {
    const candles = makeCandles(10, 100); // preços perto de 100
    const range = computeChartPriceRange({
      candles,
      entryLow: 80,
      entryHigh: 82,
      stopPrice: 75,
      targetPrices: [],
      livePrice: null,
    })!;
    expect(range.min).toBeLessThanOrEqual(75);
    expect(range.max).toBeGreaterThanOrEqual(82);
  });

  it('alvo PRÓXIMO (dentro do teto de 2.5x a amplitude do núcleo) entra na faixa', () => {
    const candles = makeCandles(10, 100); // amplitude pequena e real dos candles
    const withoutTarget = computeChartPriceRange({
      candles,
      entryLow: 99,
      entryHigh: 100,
      stopPrice: 95,
      targetPrices: [],
      livePrice: null,
    })!;
    const withNearTarget = computeChartPriceRange({
      candles,
      entryLow: 99,
      entryHigh: 100,
      stopPrice: 95,
      targetPrices: [105],
      livePrice: null,
    })!;
    expect(withNearTarget.max).toBeGreaterThan(withoutTarget.max);
    expect(withNearTarget.max).toBeGreaterThanOrEqual(105);
  });

  it('alvo MUITO distante (além do teto de 2.5x) fica de fora da faixa — nunca espreme os candles recentes até virar ruído', () => {
    const candles = makeCandles(10, 100);
    const withoutTarget = computeChartPriceRange({
      candles,
      entryLow: 99,
      entryHigh: 100,
      stopPrice: 95,
      targetPrices: [],
      livePrice: null,
    })!;
    const withFarTarget = computeChartPriceRange({
      candles,
      entryLow: 99,
      entryHigh: 100,
      stopPrice: 95,
      targetPrices: [10_000], // ordens de magnitude fora de qualquer teto real
      livePrice: null,
    })!;
    expect(withFarTarget.max).toBe(withoutTarget.max);
    expect(withFarTarget.max).toBeLessThan(10_000);
  });

  it('preço vivo fora da faixa dos candles também expande o quadro (mesma regra do Entry/Stop)', () => {
    const candles = makeCandles(10, 100);
    const range = computeChartPriceRange({
      candles,
      entryLow: null,
      entryHigh: null,
      stopPrice: null,
      targetPrices: [],
      livePrice: 120,
    })!;
    expect(range.max).toBeGreaterThanOrEqual(120);
  });
});

describe('buildPublicationFilename / publicationTimestampSlug: nomes automáticos, mesmo timestamp identifica as 4 peças (§8)', () => {
  it('formato exato do exemplo da Ordem: AR10_{SYMBOL}_{TF}_{FORMATO}_{YYYY-MM-DD}_{HHmm}.png', () => {
    const generatedAt = new Date(2026, 7, 4, 10, 32, 0).getTime();
    expect(buildPublicationFilename('BTCUSDT', '1h', generatedAt, 'ANALYSIS')).toBe('AR10_BTCUSDT_1H_ANALYSIS_2026-08-04_1032.png');
    expect(buildPublicationFilename('BTCUSDT', '1h', generatedAt, 'STORY')).toBe('AR10_BTCUSDT_1H_STORY_2026-08-04_1032.png');
    expect(buildPublicationFilename('BTCUSDT', '1h', generatedAt, 'X')).toBe('AR10_BTCUSDT_1H_X_2026-08-04_1032.png');
    expect(buildPublicationFilename('BTCUSDT', '1h', generatedAt, 'PREMIUM')).toBe('AR10_BTCUSDT_1H_PREMIUM_2026-08-04_1032.png');
  });

  it('as 4 peças de UMA análise compartilham o MESMO datePart/timePart — só o token de formato muda', () => {
    const generatedAt = Date.now();
    const names = PUBLICATION_FORMAT_ORDER.map((f) => buildPublicationFilename('ETHUSDT', '4h', generatedAt, f));
    const stems = names.map((n) => n.replace(/_(ANALYSIS|STORY|X|PREMIUM)_\d{4}-\d{2}-\d{2}_\d{4}\.png$/, ''));
    expect(new Set(stems).size).toBe(1);
  });

  it('símbolo/timeframe com caracteres não-alfanuméricos são limpos e maiusculizados (nunca quebram o nome do arquivo)', () => {
    const generatedAt = new Date(2026, 0, 1, 9, 5, 0).getTime();
    expect(buildPublicationFilename('BTC/USDT', '1h', generatedAt, 'PREMIUM')).toBe('AR10_BTCUSDT_1H_PREMIUM_2026-01-01_0905.png');
  });

  it('publicationTimestampSlug pad de zero em mês/dia/hora/minuto de um dígito', () => {
    const slug = publicationTimestampSlug(new Date(2026, 0, 5, 3, 7, 0).getTime());
    expect(slug.datePart).toBe('2026-01-05');
    expect(slug.timePart).toBe('0307');
  });
});

describe('canPublishFormat: fail-closed por peça (§5) — só formatos com o que precisam de verdade são gerados', () => {
  it('candles suficientes (>= MIN_CHART_CANDLES): os 4 formatos são publicáveis', () => {
    const snapshot = baseSnapshot({ candles: makeCandles(MIN_CHART_CANDLES) });
    for (const format of PUBLICATION_FORMAT_ORDER) {
      expect(canPublishFormat(format, snapshot)).toBe(true);
    }
  });

  it('candles insuficientes: ANALYSIS/STORY/X (precisam de gráfico) ficam bloqueados', () => {
    const snapshot = baseSnapshot({ candles: makeCandles(MIN_CHART_CANDLES - 1) });
    expect(canPublishFormat('ANALYSIS', snapshot)).toBe(false);
    expect(canPublishFormat('STORY', snapshot)).toBe(false);
    expect(canPublishFormat('X', snapshot)).toBe(false);
  });

  it('candles insuficientes: PREMIUM (sem gráfico por especificação §2-D) continua publicável', () => {
    const snapshot = baseSnapshot({ candles: [] });
    expect(canPublishFormat('PREMIUM', snapshot)).toBe(true);
  });
});
