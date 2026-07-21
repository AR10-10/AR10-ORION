// layer-relevance.test.ts — NÚCLEO GRAVITACIONAL AUTÔNOMO §1/§6: prova por
// execução real do motor puro de relevância (matemática de fronteira —
// mesma convenção do resto da suíte: execução real para "a matemática
// está sutilmente errada", nunca padrão de fonte para um motor isolado
// como este). Cada teste alimenta um input real e verifica o SIM/NÃO e o
// motivo — nunca um score fabricado, sempre a mesma regra declarada em
// layer-relevance.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  computeLayerRelevance,
  RELEVANCE_LAYER_IDS,
  LIQUIDITY_PROXIMITY_PCT,
  VOLUME_PROFILE_PROXIMITY_PCT,
  FIBONACCI_PROXIMITY_PCT,
  HARMONIC_MIN_RELEVANT_FIT,
  TREND_CHANNEL_TIGHT_BANDWIDTH_PCT,
  type LayerRelevanceInput,
} from '../src/nexus/layer-relevance';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

// Baseline honesto: "nenhum sinal real disponível ainda" — todo teste
// parte daqui e liga só o sinal que quer verificar (nunca um input
// parcial que deixaria campos undefined).
const BASE: LayerRelevanceInput = {
  tradePlanActive: false,
  obstacleZoneCount: 0,
  unsweptLiquidityNearPrice: false,
  structureBreakAlpha: null,
  volumeProfileNearPrice: false,
  harmonicBestFitScore: null,
  fibonacciNearPrice: false,
  premiumDiscountZone: null,
  vwapState: null,
  nexusLineState: null,
  trendChannelBandwidthPct: null,
  orderflowTrendActive: false,
  hasOrderBook: false,
};

describe('RELEVANCE_LAYER_IDS espelha exatamente CHART_LAYER_IDS (EnhancedChart_110_Percent.tsx) — sem drift silencioso', () => {
  it('as 15 chaves batem 1:1, mesma ordem não é exigida mas o conjunto sim', () => {
    const chartSrc = read('../src/chart/EnhancedChart_110_Percent.tsx');
    const m = chartSrc.match(/export const CHART_LAYER_IDS = \[([\s\S]*?)\] as const;/);
    expect(m, 'CHART_LAYER_IDS não encontrado em EnhancedChart_110_Percent.tsx').not.toBeNull();
    const chartIds = Array.from(m![1].matchAll(/"([a-z_]+)"/g)).map((x) => x[1]);
    expect(new Set(chartIds)).toEqual(new Set(RELEVANCE_LAYER_IDS));
    expect(chartIds.length).toBe(15);
    expect(RELEVANCE_LAYER_IDS.length).toBe(15);
  });
});

describe('computeLayerRelevance: completude — sempre devolve as 15 chaves, nunca uma faltando', () => {
  it('baseline vazio ainda produz um resultado para cada uma das 15 camadas', () => {
    const reading = computeLayerRelevance(BASE);
    for (const id of RELEVANCE_LAYER_IDS) {
      expect(reading[id], `faltando chave ${id}`).toBeDefined();
      expect(typeof reading[id].relevant).toBe('boolean');
      expect(typeof reading[id].reason).toBe('string');
      expect(reading[id].reason.length).toBeGreaterThan(0);
    }
  });
});

describe('liquidity_zones: obstáculo real no caminho OU liquidez real próxima, nunca inventado', () => {
  it('sem plano ativo e sem liquidez próxima => não relevante', () => {
    expect(computeLayerRelevance(BASE).liquidity_zones.relevant).toBe(false);
  });
  it('plano ativo mas 0 obstáculos reais no caminho => não relevante por obstáculo (obstacleZoneCount governa, não só tradePlanActive)', () => {
    const r = computeLayerRelevance({ ...BASE, tradePlanActive: true, obstacleZoneCount: 0 });
    expect(r.liquidity_zones.relevant).toBe(false);
  });
  it('plano ativo com >=1 obstáculo real no caminho => relevante, motivo cita a contagem real', () => {
    const r = computeLayerRelevance({ ...BASE, tradePlanActive: true, obstacleZoneCount: 2 });
    expect(r.liquidity_zones.relevant).toBe(true);
    expect(r.liquidity_zones.reason).toContain('2 obstáculo');
  });
  it('sem plano mas liquidez real não varrida perto do preço => relevante mesmo assim', () => {
    const r = computeLayerRelevance({ ...BASE, unsweptLiquidityNearPrice: true });
    expect(r.liquidity_zones.relevant).toBe(true);
  });
});

describe('structure_breaks: reusa o MESMO alpha de decaimento real (annotation-decay.ts), nunca uma segunda curva', () => {
  it('sem rompimento registrado (alpha null) => não relevante, motivo honesto', () => {
    const r = computeLayerRelevance(BASE);
    expect(r.structure_breaks.relevant).toBe(false);
    expect(r.structure_breaks.reason).toContain('nenhum rompimento');
  });
  it('rompimento jovem (alpha=1, dentro da janela real) => relevante', () => {
    expect(computeLayerRelevance({ ...BASE, structureBreakAlpha: 1 }).structure_breaks.relevant).toBe(true);
  });
  it('rompimento totalmente esmaecido (alpha=0, expirou de verdade) => não relevante', () => {
    const r = computeLayerRelevance({ ...BASE, structureBreakAlpha: 0 });
    expect(r.structure_breaks.relevant).toBe(false);
    expect(r.structure_breaks.reason).toContain('esmaeceu');
  });
});

describe('order_flow_heatmap: só quando há livro de ofertas ao vivo REAL', () => {
  it('sem livro real => não relevante', () => {
    expect(computeLayerRelevance(BASE).order_flow_heatmap.relevant).toBe(false);
  });
  it('com livro real => relevante', () => {
    expect(computeLayerRelevance({ ...BASE, hasOrderBook: true }).order_flow_heatmap.relevant).toBe(true);
  });
});

describe('volume_profile: proximidade real a POC/HVN', () => {
  it('longe de qualquer POC/HVN real => não relevante', () => {
    expect(computeLayerRelevance(BASE).volume_profile.relevant).toBe(false);
  });
  it('dentro da faixa real de proximidade => relevante, motivo cita o limiar declarado', () => {
    const r = computeLayerRelevance({ ...BASE, volumeProfileNearPrice: true });
    expect(r.volume_profile.relevant).toBe(true);
    expect(r.volume_profile.reason).toContain(`${VOLUME_PROFILE_PROXIMITY_PCT.toFixed(1)}%`);
  });
});

describe('trade_plan_zone / neural_market_aura: NUNCA sujeitos ao gate — próprio ciclo de vida real', () => {
  it('trade_plan_zone segue tradePlanActive diretamente (Conselho ou fallback do Núcleo, já resolvido pelo chamador)', () => {
    expect(computeLayerRelevance(BASE).trade_plan_zone.relevant).toBe(false);
    expect(computeLayerRelevance({ ...BASE, tradePlanActive: true }).trade_plan_zone.relevant).toBe(true);
  });
  it('neural_market_aura é sempre relevante — motivo explicita que não é sujeito ao gate', () => {
    const r = computeLayerRelevance(BASE).neural_market_aura;
    expect(r.relevant).toBe(true);
    expect(r.reason).toContain('nunca sujeito ao gate');
  });
});

describe('ema: acompanha VWAP/Nexus Line direcionais, fail-open só quando NENHUM dos dois tem leitura real ainda', () => {
  it('sem nenhuma leitura real ainda (ambos null) => relevante por padrão (fail-open documentado)', () => {
    expect(computeLayerRelevance(BASE).ema.relevant).toBe(true);
  });
  it('VWAP e Nexus Line ambos NEUTRAL (leitura real, mas sem direção) => não relevante', () => {
    const r = computeLayerRelevance({ ...BASE, vwapState: 'NEUTRAL', nexusLineState: 'NEUTRAL' });
    expect(r.ema.relevant).toBe(false);
  });
  it('VWAP direcional real (BULLISH) já basta, mesmo com Nexus Line neutro', () => {
    const r = computeLayerRelevance({ ...BASE, vwapState: 'BULLISH', nexusLineState: 'NEUTRAL' });
    expect(r.ema.relevant).toBe(true);
  });
});

describe('trend_channel: banda real estreita = estruturalmente informativo', () => {
  it('sem canal real detectado => não relevante', () => {
    expect(computeLayerRelevance(BASE).trend_channel.relevant).toBe(false);
  });
  it(`banda exatamente no limiar declarado (${TREND_CHANNEL_TIGHT_BANDWIDTH_PCT}%) => relevante (<=, não <)`, () => {
    const r = computeLayerRelevance({ ...BASE, trendChannelBandwidthPct: TREND_CHANNEL_TIGHT_BANDWIDTH_PCT });
    expect(r.trend_channel.relevant).toBe(true);
  });
  it('banda real larga (acima do limiar) => não relevante', () => {
    const r = computeLayerRelevance({ ...BASE, trendChannelBandwidthPct: TREND_CHANNEL_TIGHT_BANDWIDTH_PCT + 5 });
    expect(r.trend_channel.relevant).toBe(false);
  });
});

describe('vwap / nexus_line: relevante só quando a leitura real é direcional (nunca NEUTRAL)', () => {
  it('vwap NEUTRAL real => não relevante', () => {
    expect(computeLayerRelevance({ ...BASE, vwapState: 'NEUTRAL' }).vwap.relevant).toBe(false);
  });
  it('vwap BEARISH real => relevante, motivo cita o estado real', () => {
    const r = computeLayerRelevance({ ...BASE, vwapState: 'BEARISH' });
    expect(r.vwap.relevant).toBe(true);
    expect(r.vwap.reason).toContain('BEARISH');
  });
  it('nexus_line segue a mesma regra, independente do estado do vwap', () => {
    expect(computeLayerRelevance({ ...BASE, nexusLineState: 'BULLISH' }).nexus_line.relevant).toBe(true);
    expect(computeLayerRelevance({ ...BASE, nexusLineState: 'NEUTRAL' }).nexus_line.relevant).toBe(false);
  });
});

describe('cvd: tendência real do fluxo (fortalecendo/enfraquecendo), nunca a leitura instantânea', () => {
  it('sem tendência de fluxo ativa => não relevante', () => {
    expect(computeLayerRelevance(BASE).cvd.relevant).toBe(false);
  });
  it('com tendência real ativa => relevante', () => {
    expect(computeLayerRelevance({ ...BASE, orderflowTrendActive: true }).cvd.relevant).toBe(true);
  });
});

describe('fibonacci: proximidade real a um nível confirmado da Matriz de Confluência', () => {
  it('sem nível próximo real => não relevante', () => {
    expect(computeLayerRelevance(BASE).fibonacci.relevant).toBe(false);
  });
  it('com nível real próximo => relevante, motivo cita o limiar declarado', () => {
    const r = computeLayerRelevance({ ...BASE, fibonacciNearPrice: true });
    expect(r.fibonacci.relevant).toBe(true);
    expect(r.fibonacci.reason).toContain(`${FIBONACCI_PROXIMITY_PCT.toFixed(1)}%`);
  });
});

describe('premium_discount: relevante só fora do equilíbrio real (nunca em EQUILIBRIUM)', () => {
  it('sem dealing range real confirmado ainda => não relevante', () => {
    expect(computeLayerRelevance(BASE).premium_discount.relevant).toBe(false);
  });
  it('zona real EQUILIBRIUM => não relevante (sem vantagem de zona)', () => {
    const r = computeLayerRelevance({ ...BASE, premiumDiscountZone: 'EQUILIBRIUM' });
    expect(r.premium_discount.relevant).toBe(false);
  });
  it('zona real PREMIUM ou DISCOUNT => relevante', () => {
    expect(computeLayerRelevance({ ...BASE, premiumDiscountZone: 'PREMIUM' }).premium_discount.relevant).toBe(true);
    expect(computeLayerRelevance({ ...BASE, premiumDiscountZone: 'DISCOUNT' }).premium_discount.relevant).toBe(true);
  });
});

describe('harmonics: fitScore real (aderência geométrica) — nunca tratado como probabilidade (Regra de Ouro 2)', () => {
  it('sem padrão vivo real => não relevante', () => {
    expect(computeLayerRelevance(BASE).harmonics.relevant).toBe(false);
  });
  it(`fitScore real abaixo do limiar (${HARMONIC_MIN_RELEVANT_FIT}) => não relevante`, () => {
    const r = computeLayerRelevance({ ...BASE, harmonicBestFitScore: HARMONIC_MIN_RELEVANT_FIT - 0.01 });
    expect(r.harmonics.relevant).toBe(false);
  });
  it(`fitScore real no limiar ou acima => relevante`, () => {
    const r = computeLayerRelevance({ ...BASE, harmonicBestFitScore: HARMONIC_MIN_RELEVANT_FIT });
    expect(r.harmonics.relevant).toBe(true);
    expect(r.harmonics.reason).not.toMatch(/probabilidade/i);
  });
});

describe('equal_highs_lows: mesma proximidade real de liquidez usada por liquidity_zones (uma leitura, dois lugares — zero duplicação)', () => {
  it('sem EQH/EQL real não varrida próxima => não relevante', () => {
    expect(computeLayerRelevance(BASE).equal_highs_lows.relevant).toBe(false);
  });
  it('com EQH/EQL real não varrida próxima => relevante', () => {
    expect(computeLayerRelevance({ ...BASE, unsweptLiquidityNearPrice: true }).equal_highs_lows.relevant).toBe(true);
  });
});

describe('honestidade: nenhum motivo textual usa a palavra "probabilidade" (Regra de Ouro 2 é sobre confluência, nunca calibração)', () => {
  it('varredura de todos os motivos possíveis nos casos já exercitados acima', () => {
    const cases: LayerRelevanceInput[] = [
      BASE,
      { ...BASE, tradePlanActive: true, obstacleZoneCount: 3 },
      { ...BASE, harmonicBestFitScore: 0.9 },
      { ...BASE, vwapState: 'BULLISH', nexusLineState: 'BEARISH' },
      { ...BASE, premiumDiscountZone: 'PREMIUM' },
    ];
    for (const c of cases) {
      const reading = computeLayerRelevance(c);
      for (const id of RELEVANCE_LAYER_IDS) {
        expect(reading[id].reason.toLowerCase()).not.toContain('probabilidade');
      }
    }
  });
});
