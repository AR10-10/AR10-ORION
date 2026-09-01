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
  HARMONIC_HIGHLIGHT_FIT,
  TREND_CHANNEL_HIGHLIGHT_BANDWIDTH_PCT,
  STRUCTURE_BREAK_HIGHLIGHT_MIN_ALPHA,
  LIQUIDITY_HIGHLIGHT_MIN_OBSTACLES,
  MARKET_REGIME_TREND_LABELS,
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
  hasUnmitigatedStructuralZone: false,
  structureBreakAlpha: null,
  volumeProfileNearPrice: false,
  harmonicBestFitScore: null,
  fibonacciNearPrice: false,
  hasFibonacciLevels: false,
  premiumDiscountZone: null,
  vwapState: null,
  nexusLineState: null,
  trendChannelBandwidthPct: null,
  orderflowTrendActive: false,
  hasOrderBook: false,
  hasTpoProfile: false,
  hasZigZagPivots: false,
  hasSuperTrend: false,
  hasRecentLiquidation: false,
  hasRecentLiquiditySweep: false,
  recentSessionBoundary: false,
  hasActiveKillZone: false,
  hasSessionKeyLevelNearPrice: false,
  marketRegime: null,
  hasScenario: false,
  hasCandlePatterns: false,
  institutionalZoneCount: 0,
  hasAuraSignal: false,
  hasPivotPoints: false,
};

describe('RELEVANCE_LAYER_IDS espelha CHART_LAYER_IDS (EnhancedChart_110_Percent.tsx) 1:1 — zero drift, zero gap', () => {
  // Declutter do gráfico (pedido direto do Operador): os 3 gaps antigos
  // (liquidation_heatmap/liquidity_sweep/market_sessions sem regra própria
  // de relevância, caindo no fallback `relevance?.relevant ?? true` do
  // ChartLayersPanel) foram fechados — as 24 camadas reais agora têm
  // cobertura 1:1, sem exceção documentada nenhuma (kill_zones/
  // session_key_levels/institutional_zones/order_book_depth/tpo_profile/
  // zigzag somaram-se depois, mesma disciplina desde o nascimento de cada
  // camada — zigzag graduado do Laboratório na Entrega 47).
  it('toda chave de CHART_LAYER_IDS está em RELEVANCE_LAYER_IDS — nunca esquecida silenciosamente', () => {
    const chartSrc = read('../src/chart/EnhancedChart_110_Percent.tsx');
    const m = chartSrc.match(/export const CHART_LAYER_IDS = \[([\s\S]*?)\] as const;/);
    expect(m, 'CHART_LAYER_IDS não encontrado em EnhancedChart_110_Percent.tsx').not.toBeNull();
    const chartIds = Array.from(m![1].matchAll(/"([a-z_]+)"/g)).map((x) => x[1]);
    const relevanceSet = new Set<string>(RELEVANCE_LAYER_IDS);
    for (const id of chartIds) {
      expect(relevanceSet.has(id), `camada "${id}" existe em CHART_LAYER_IDS mas não em RELEVANCE_LAYER_IDS`).toBe(true);
    }
    expect(chartIds.length).toBe(28); // +pivot_points (auditoria do ecossistema de indicadores)
  });

  it('toda chave de RELEVANCE_LAYER_IDS é uma camada real de CHART_LAYER_IDS — nunca uma chave órfã', () => {
    const chartSrc = read('../src/chart/EnhancedChart_110_Percent.tsx');
    const m = chartSrc.match(/export const CHART_LAYER_IDS = \[([\s\S]*?)\] as const;/);
    const chartIds = new Set(Array.from(m![1].matchAll(/"([a-z_]+)"/g)).map((x) => x[1]));
    for (const id of RELEVANCE_LAYER_IDS) {
      expect(chartIds.has(id), `RELEVANCE_LAYER_IDS tem "${id}" que não existe mais em CHART_LAYER_IDS`).toBe(true);
    }
    expect(RELEVANCE_LAYER_IDS.length).toBe(28); // +pivot_points
  });
});

describe('computeLayerRelevance: completude — sempre devolve as 25 chaves, nunca uma faltando', () => {
  it('baseline vazio ainda produz um resultado para cada camada real', () => {
    const reading = computeLayerRelevance(BASE);
    for (const id of RELEVANCE_LAYER_IDS) {
      expect(reading[id], `faltando chave ${id}`).toBeDefined();
      expect(typeof reading[id].relevant).toBe('boolean');
      expect(typeof reading[id].reason).toBe('string');
      expect(reading[id].reason.length).toBeGreaterThan(0);
      expect(['normal', 'highlight']).toContain(reading[id].emphasis);
    }
  });
});

describe('EPC FINAL §3/§12: emphasis (destaque) — só sobre um gradiente REAL já presente no input, nunca um sinal fabricado', () => {
  it('liquidity_zones: 1 obstáculo real = normal, >=2 obstáculos reais = highlight (mesmo obstacleZoneCount que já decide relevant)', () => {
    const r1 = computeLayerRelevance({ ...BASE, tradePlanActive: true, obstacleZoneCount: 1 });
    expect(r1.liquidity_zones.emphasis).toBe('normal');
    const r2 = computeLayerRelevance({ ...BASE, tradePlanActive: true, obstacleZoneCount: LIQUIDITY_HIGHLIGHT_MIN_OBSTACLES });
    expect(r2.liquidity_zones.emphasis).toBe('highlight');
  });
  it('liquidity_zones por proximidade (sem obstáculo real) nunca é highlight — não há gradiente real nesse caminho', () => {
    const r = computeLayerRelevance({ ...BASE, unsweptLiquidityNearPrice: true });
    expect(r.liquidity_zones.relevant).toBe(true);
    expect(r.liquidity_zones.emphasis).toBe('normal');
  });

  it('structure_breaks: alpha alto (rompimento ainda fresco) = highlight; alpha baixo mas > 0 (esmaecendo) = normal', () => {
    const fresh = computeLayerRelevance({ ...BASE, structureBreakAlpha: STRUCTURE_BREAK_HIGHLIGHT_MIN_ALPHA });
    expect(fresh.structure_breaks.emphasis).toBe('highlight');
    const fading = computeLayerRelevance({ ...BASE, structureBreakAlpha: STRUCTURE_BREAK_HIGHLIGHT_MIN_ALPHA - 0.5 });
    expect(fading.structure_breaks.relevant).toBe(true);
    expect(fading.structure_breaks.emphasis).toBe('normal');
  });

  it('trend_channel: banda MUITO estreita (metade do limiar de relevância) = highlight; só dentro do limiar = normal', () => {
    const tight = computeLayerRelevance({ ...BASE, trendChannelBandwidthPct: TREND_CHANNEL_HIGHLIGHT_BANDWIDTH_PCT });
    expect(tight.trend_channel.emphasis).toBe('highlight');
    const loose = computeLayerRelevance({ ...BASE, trendChannelBandwidthPct: TREND_CHANNEL_TIGHT_BANDWIDTH_PCT });
    expect(loose.trend_channel.relevant).toBe(true);
    expect(loose.trend_channel.emphasis).toBe('normal');
  });

  it('harmonics: fitScore real muito alto (>= HARMONIC_HIGHLIGHT_FIT) = highlight; só acima do limiar de relevância = normal', () => {
    const strong = computeLayerRelevance({ ...BASE, harmonicBestFitScore: HARMONIC_HIGHLIGHT_FIT });
    expect(strong.harmonics.emphasis).toBe('highlight');
    const justAbove = computeLayerRelevance({ ...BASE, harmonicBestFitScore: HARMONIC_MIN_RELEVANT_FIT });
    expect(justAbove.harmonics.relevant).toBe(true);
    expect(justAbove.harmonics.emphasis).toBe('normal');
  });

  it('camadas sem gradiente real (booleano puro) nunca ficam highlight — honesto, não fabricado', () => {
    const r = computeLayerRelevance({
      ...BASE,
      volumeProfileNearPrice: true,
      fibonacciNearPrice: true,
      hasOrderBook: true,
      orderflowTrendActive: true,
      premiumDiscountZone: 'PREMIUM',
      vwapState: 'BULLISH',
      nexusLineState: 'BEARISH',
      hasRecentLiquidation: true,
      hasRecentLiquiditySweep: true,
      recentSessionBoundary: true,
      hasActiveKillZone: true,
      hasSessionKeyLevelNearPrice: true,
    });
    for (const id of ['volume_profile', 'fibonacci', 'order_flow_heatmap', 'cvd', 'premium_discount', 'vwap', 'nexus_line', 'ema', 'equal_highs_lows', 'liquidation_heatmap', 'liquidity_sweep', 'market_sessions', 'kill_zones', 'session_key_levels'] as const) {
      expect(r[id].emphasis, `${id} não deveria ter highlight fabricado`).toBe('normal');
    }
  });
});

describe('liquidity_zones: obstáculo real no caminho OU liquidez real próxima OU FVG/OB real não mitigado, nunca inventado', () => {
  it('sem plano ativo, sem liquidez próxima e sem FVG/OB real => não relevante', () => {
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
  // Achado real (relato do Operador após captura de tela real: FVG/Order
  // Blocks somem do gráfico depois de um movimento forte de preço) —
  // existência real de uma zona não mitigada já basta, mesmo longe do
  // preço vivo e sem obstáculo no caminho do plano.
  it('sem obstáculo, sem liquidez próxima, mas com FVG/Order Block real não mitigado (longe do preço) => relevante mesmo assim', () => {
    const r = computeLayerRelevance({ ...BASE, hasUnmitigatedStructuralZone: true });
    expect(r.liquidity_zones.relevant).toBe(true);
    expect(r.liquidity_zones.reason).toContain('não mitigado');
  });
  it('nenhum dos 3 sinais reais (obstáculo/proximidade/zona não mitigada) => motivo honesto cita os 3', () => {
    const r = computeLayerRelevance(BASE).liquidity_zones;
    expect(r.relevant).toBe(false);
    expect(r.reason).toContain('nenhuma zona real no caminho');
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

// Achado 2.1 (ORDEM DEFINITIVA — MAPEAMENTO_VISUAL_CANVAS_2026-08-17.md):
// Volume Profile e TPO Profile calculam o MESMO conceito (Point of
// Control/Value Area) por 2 metodologias reais diferentes — a regra
// nova exige 1 representação visual canônica, nunca as 2 automáticas ao
// mesmo tempo. TPO continua 100% calculado (hasTpoProfile só descreve
// disponibilidade real do dado) — só para de entrar em modo automático.
describe('tpo_profile: nunca automático — Volume Profile é o Point of Control canônico (Achado 2.1)', () => {
  it('perfil TPO disponível, mas nunca relevante em modo automático (Volume Profile já é o canônico)', () => {
    const r = computeLayerRelevance({ ...BASE, hasTpoProfile: true }).tpo_profile;
    expect(r.relevant).toBe(false);
    expect(r.reason).toContain('canônico');
  });
  it('sem perfil TPO real disponível => motivo honesto de DADOS_INSUFICIENTES, nunca o mesmo motivo de cima', () => {
    const r = computeLayerRelevance(BASE).tpo_profile;
    expect(r.relevant).toBe(false);
    expect(r.reason).toContain('candle real suficiente');
  });
  it('volume_profile permanece o único gate por proximidade real — nada mudou no lado canônico', () => {
    expect(computeLayerRelevance({ ...BASE, volumeProfileNearPrice: true }).volume_profile.relevant).toBe(true);
  });
});

// Achado 2.5 (Visual Cleanup & Rendering Audit — pedido do Operador:
// "tirar os excessos de linha"): grep confirmou que o Motor de Cenários
// (SCENARIO A/B, "Future Path Map") era a ÚNICA camada real do gráfico
// sem NENHUM controle — nem toggle manual (CHART_LAYER_IDS), nem regra
// de relevância automática. Mesma disciplina de existência real de
// hasFibonacciLevels/hasZigZagPivots/hasTpoProfile — nunca proximidade.
describe('scenario_projection: existência real (Achado 2.5) — mesmo padrão de hasFibonacciLevels/hasZigZagPivots', () => {
  it('sem nenhum alvo real projetado em nenhum caminho => não relevante, motivo honesto', () => {
    const r = computeLayerRelevance(BASE).scenario_projection;
    expect(r.relevant).toBe(false);
    expect(r.reason).toContain('nenhum alvo real projetado');
  });
  it('com pelo menos 1 alvo real projetado => relevante, motivo cita o Motor de Cenários', () => {
    const r = computeLayerRelevance({ ...BASE, hasScenario: true }).scenario_projection;
    expect(r.relevant).toBe(true);
    expect(r.reason).toContain('Motor de Cenários');
  });
  it('nunca fica highlight — sem gradiente real de força pra medir (booleano puro, mesma honestidade das outras camadas de existência)', () => {
    expect(computeLayerRelevance({ ...BASE, hasScenario: true }).scenario_projection.emphasis).toBe('normal');
  });
});

// Auditoria do ecossistema de indicadores (pedido direto do Operador: "qual
// ferramenta que está faltando"): mesma disciplina de existência real de
// hasZigZagPivots/hasTpoProfile/hasScenario acima — nunca proximidade, um
// nível diário estático continua útil o dia inteiro.
describe('pivot_points: existência real (candle diário fechado disponível) — mesmo padrão de hasZigZagPivots/hasTpoProfile', () => {
  it('sem candle diário fechado real ainda => não relevante, motivo honesto', () => {
    const r = computeLayerRelevance(BASE).pivot_points;
    expect(r.relevant).toBe(false);
    expect(r.reason).toContain('sem candle diário fechado real');
  });
  it('com Pivot Points reais disponíveis => relevante', () => {
    const r = computeLayerRelevance({ ...BASE, hasPivotPoints: true }).pivot_points;
    expect(r.relevant).toBe(true);
    expect(r.reason).toContain('Pivot Points reais');
  });
  it('nunca fica highlight — booleano puro, mesma honestidade de scenario_projection/zigzag', () => {
    expect(computeLayerRelevance({ ...BASE, hasPivotPoints: true }).pivot_points.emphasis).toBe('normal');
  });
});

describe('trade_plan_zone / neural_market_aura / institutional_zones: existência real, nunca "sem gate"', () => {
  it('trade_plan_zone segue tradePlanActive diretamente (Conselho ou fallback do Núcleo, já resolvido pelo chamador)', () => {
    expect(computeLayerRelevance(BASE).trade_plan_zone.relevant).toBe(false);
    expect(computeLayerRelevance({ ...BASE, tradePlanActive: true }).trade_plan_zone.relevant).toBe(true);
  });

  // CORRIGIDO (achado medido desta rodada): neural_market_aura e
  // institutional_zones eram relevant:true INCONDICIONAL — "ciclo de vida
  // próprio, nunca sujeito ao gate". O raciocínio original estava certo
  // sobre o DESENHO (uma Aura sem plano / uma lista de zonas vazia não
  // pinta nada) e errado sobre a DISPUTA: relevant:true incondicional fazia
  // a camada vencer SEMPRE uma vaga no teto do modo automático
  // (resolveAutoLayerVisibility), mesmo sem nada real pra mostrar —
  // institutional_zones é rank 3 em AUTO_LAYER_PRECISION_ORDER, então uma
  // zona vazia (comum: exige ≥2 fontes em confluência) empurrava pra fora
  // uma camada de posição mais baixa com CONTEÚDO real. Estes dois testes
  // agora provam o invariante oposto do original: nada real -> IRrelevante.
  it('neural_market_aura exige sinal real da Aura (status OK e um plano geométrico presente)', () => {
    const semSinal = computeLayerRelevance({ ...BASE, hasAuraSignal: false }).neural_market_aura;
    expect(semSinal.relevant, 'Aura vazia não pode vencer vaga no teto automático').toBe(false);

    const comSinal = computeLayerRelevance({ ...BASE, hasAuraSignal: true }).neural_market_aura;
    expect(comSinal.relevant).toBe(true);
    expect(comSinal.reason).toContain('corredor real');
  });

  it('institutional_zones exige contagem real de confluência (>0), nunca relevante com lista vazia', () => {
    const vazia = computeLayerRelevance({ ...BASE, institutionalZoneCount: 0 }).institutional_zones;
    expect(vazia.relevant, 'lista vazia não pode vencer vaga no teto automático').toBe(false);
    expect(vazia.reason).toContain('vazia');

    const comZonas = computeLayerRelevance({ ...BASE, institutionalZoneCount: 2 }).institutional_zones;
    expect(comZonas.relevant).toBe(true);
    expect(comZonas.reason).toContain('2');
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

// "HOMOLOGAÇÃO DA ORDEM Nº 03 / ORGANISMO INTELIGENTE ADAPTATIVO":
// contexto operacional real (regime-engine.js) como 2ª justificativa
// INDEPENDENTE de relevância — banda larga não invalida um regime real
// de momentum confirmado (o canal pode estar largo justamente porque
// está expandindo COM a tendência).
describe('trend_channel: regime real (contexto operacional) confirma relevância mesmo com banda larga/desconhecida', () => {
  it('MARKET_REGIME_TREND_LABELS contém exatamente os 2 rótulos reais de momentum confirmado', () => {
    expect(MARKET_REGIME_TREND_LABELS).toEqual(new Set(['TENDENCIA_FORTE', 'BREAKOUT']));
  });

  it('regime TENDENCIA_FORTE real, banda ainda null (não calculada) => relevante mesmo assim', () => {
    const r = computeLayerRelevance({ ...BASE, marketRegime: 'TENDENCIA_FORTE' });
    expect(r.trend_channel.relevant).toBe(true);
    expect(r.trend_channel.reason).toContain('TENDENCIA_FORTE');
  });

  it('regime BREAKOUT real, banda real LARGA (acima do limiar) => relevante mesmo assim (momentum vence banda larga)', () => {
    const r = computeLayerRelevance({ ...BASE, marketRegime: 'BREAKOUT', trendChannelBandwidthPct: TREND_CHANNEL_TIGHT_BANDWIDTH_PCT + 10 });
    expect(r.trend_channel.relevant).toBe(true);
  });

  it('regime BREAKOUT real sozinho (banda null) => highlight direto — o rótulo mais extremo do motor não precisa de banda estreita também', () => {
    const r = computeLayerRelevance({ ...BASE, marketRegime: 'BREAKOUT' });
    expect(r.trend_channel.emphasis).toBe('highlight');
  });

  it('regime TENDENCIA_FORTE real sozinho (banda null) => relevante mas SEM highlight — só BREAKOUT confirma o extremo sozinho', () => {
    const r = computeLayerRelevance({ ...BASE, marketRegime: 'TENDENCIA_FORTE' });
    expect(r.trend_channel.relevant).toBe(true);
    expect(r.trend_channel.emphasis).toBe('normal');
  });

  it('regime CONSOLIDACAO/COMPRESSAO real (sem momentum confirmado) => nunca confirma relevância sozinho', () => {
    expect(computeLayerRelevance({ ...BASE, marketRegime: 'CONSOLIDACAO' }).trend_channel.relevant).toBe(false);
    expect(computeLayerRelevance({ ...BASE, marketRegime: 'COMPRESSAO' }).trend_channel.relevant).toBe(false);
  });

  it('regime TENDENCIA_MODERADA real (ambíguo por design do próprio motor) => nunca confirma relevância sozinho', () => {
    expect(computeLayerRelevance({ ...BASE, marketRegime: 'TENDENCIA_MODERADA' }).trend_channel.relevant).toBe(false);
  });

  it('banda estreita real E regime real confirmado juntos => reason honesto cita as DUAS justificativas, nunca uma só', () => {
    const r = computeLayerRelevance({ ...BASE, marketRegime: 'TENDENCIA_FORTE', trendChannelBandwidthPct: TREND_CHANNEL_TIGHT_BANDWIDTH_PCT });
    expect(r.trend_channel.relevant).toBe(true);
    expect(r.trend_channel.reason).toContain('banda real estreita');
    expect(r.trend_channel.reason).toContain('TENDENCIA_FORTE');
  });

  it('nunca usa `!` não-nulo sobre trendChannelBandwidthPct — banda null com regime confirmado não pode virar highlight por coerção null->0', () => {
    // Regressão real: null <= N avalia true em JS (null vira 0 na
    // comparação) — se o motor ainda usasse `input.trendChannelBandwidthPct!`
    // aqui, regime TENDENCIA_FORTE sozinho (banda null) acenderia
    // highlight por acidente. Trava o comportamento correto (§ acima:
    // TENDENCIA_FORTE sozinho fica normal, nunca highlight).
    const r = computeLayerRelevance({ ...BASE, marketRegime: 'TENDENCIA_FORTE', trendChannelBandwidthPct: null });
    expect(r.trend_channel.emphasis).toBe('normal');
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

describe('fibonacci: existência real de nível na Matriz de Confluência decide relevant; proximidade decide só o destaque', () => {
  // Achado real (relato do Operador após captura de tela real: a grade de
  // Fibonacci some do gráfico depois de um movimento forte de preço) —
  // a Matriz de Confluência é referência estrutural válida a partir do
  // swing que a originou, não só quando o preço está em cima dela agora.
  it('sem nenhum nível real calculado ainda => não relevante', () => {
    expect(computeLayerRelevance(BASE).fibonacci.relevant).toBe(false);
  });
  it('nível(is) real(is) calculado(s) mas longe do preço vivo => relevante mesmo assim, emphasis normal', () => {
    const r = computeLayerRelevance({ ...BASE, hasFibonacciLevels: true });
    expect(r.fibonacci.relevant).toBe(true);
    expect(r.fibonacci.emphasis).toBe('normal');
    expect(r.fibonacci.reason).toContain('grade de retração');
  });
  it('nível real E perto do preço vivo => relevante COM destaque, motivo cita o limiar declarado', () => {
    const r = computeLayerRelevance({ ...BASE, hasFibonacciLevels: true, fibonacciNearPrice: true });
    expect(r.fibonacci.relevant).toBe(true);
    expect(r.fibonacci.emphasis).toBe('highlight');
    expect(r.fibonacci.reason).toContain(`${FIBONACCI_PROXIMITY_PCT.toFixed(1)}%`);
  });
  it('fail-closed defensivo: fibonacciNearPrice sozinho (sem hasFibonacciLevels) nunca basta — existência real governa relevant, nunca proximidade isolada', () => {
    const r = computeLayerRelevance({ ...BASE, fibonacciNearPrice: true });
    expect(r.fibonacci.relevant).toBe(false);
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

describe('liquidation_heatmap: mesma condição real que o painel de lista já usa (liquidations.length > 0)', () => {
  it('sem liquidação forçada real no feed => não relevante', () => {
    const r = computeLayerRelevance(BASE);
    expect(r.liquidation_heatmap.relevant).toBe(false);
    expect(r.liquidation_heatmap.reason).toContain('nenhuma liquidação');
  });
  it('com pelo menos 1 liquidação forçada real => relevante', () => {
    const r = computeLayerRelevance({ ...BASE, hasRecentLiquidation: true });
    expect(r.liquidation_heatmap.relevant).toBe(true);
    expect(r.liquidation_heatmap.reason).toContain('liquidação forçada');
  });
});

describe('liquidity_sweep: mesmo filtro STOP_HUNT_TOPO/FUNDO que o canvas (EnhancedChart) já usa pra desenhar', () => {
  it('sem trap real STOP_HUNT no momento => não relevante', () => {
    const r = computeLayerRelevance(BASE);
    expect(r.liquidity_sweep.relevant).toBe(false);
    expect(r.liquidity_sweep.reason).toContain('nenhum sweep');
  });
  it('com trap real STOP_HUNT no momento => relevante', () => {
    const r = computeLayerRelevance({ ...BASE, hasRecentLiquiditySweep: true });
    expect(r.liquidity_sweep.relevant).toBe(true);
    expect(r.liquidity_sweep.reason).toContain('STOP_HUNT');
  });
});

describe('market_sessions: mesma computeSessionBoundaries pura que MarketSessionBandsPlugin já usa pra desenhar', () => {
  it('sem transição de sessão recente => não relevante, sessão vigente estável', () => {
    const r = computeLayerRelevance(BASE);
    expect(r.market_sessions.relevant).toBe(false);
    expect(r.market_sessions.reason).toContain('estável');
  });
  it('com transição real dentro da janela declarada => relevante, motivo cita a janela', () => {
    const r = computeLayerRelevance({ ...BASE, recentSessionBoundary: true });
    expect(r.market_sessions.relevant).toBe(true);
    expect(r.market_sessions.reason).toContain('candles');
  });
});

describe('kill_zones: mesma condição real (activeKillZones) que o badge do header (§6.48) já usa', () => {
  it('sem kill zone ICT ativa agora => não relevante', () => {
    const r = computeLayerRelevance(BASE);
    expect(r.kill_zones.relevant).toBe(false);
    expect(r.kill_zones.reason).toContain('nenhuma kill zone');
  });
  it('com pelo menos 1 kill zone ICT ativa agora => relevante', () => {
    const r = computeLayerRelevance({ ...BASE, hasActiveKillZone: true });
    expect(r.kill_zones.relevant).toBe(true);
    expect(r.kill_zones.reason).toContain('institucional');
  });
});

describe('session_key_levels: mesmo papel estrutural de liquidity_zones (relevante só quando o preço vivo está PERTO de um Key Level real)', () => {
  it('sem Key Level de sessão real próximo => não relevante', () => {
    const r = computeLayerRelevance(BASE);
    expect(r.session_key_levels.relevant).toBe(false);
    expect(r.session_key_levels.reason).toContain('nenhum Key Level');
  });
  it('com preço vivo real perto de uma máxima/mínima de sessão => relevante, motivo cita o limiar declarado', () => {
    const r = computeLayerRelevance({ ...BASE, hasSessionKeyLevelNearPrice: true });
    expect(r.session_key_levels.relevant).toBe(true);
    expect(r.session_key_levels.reason).toContain(`${LIQUIDITY_PROXIMITY_PCT.toFixed(1)}%`);
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
