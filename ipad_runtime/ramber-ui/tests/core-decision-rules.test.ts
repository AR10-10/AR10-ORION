// core-decision-rules.test.ts — Fase G (V15): testes de CARACTERIZAÇÃO das
// regras de decisão consolidadas do Core Engine (trendBias → rotas →
// LONG/SHORT/WAIT → caps de confiança → analysis-frame). Imports the REAL
// modules — nada é mock exceto o workerClient injetado em
// buildRealAnalysisFrame (parâmetro de injeção que a própria assinatura da
// função expõe; os números que ele devolve são controlados pelo teste para
// exercitar cada ramo REAL do código de rotulagem).
//
// TRAVA DE GOVERNANÇA (diretriz 2): estes testes NÃO mudam uma linha das
// regras — eles as congelam. Qualquer mudança futura de comportamento nas
// "regras lucrativas" derruba o CI e exige justificativa explícita.
import { describe, it, expect } from 'vitest';
import { buildResearchEngineFrame } from '../../js/research/research-engine.js';
import { buildTradeSetupMatrix } from '../../js/research/trade-setup-matrix.js';
import { computeDataSufficiency } from '../../js/research/data-sufficiency.js';
import { buildRealAnalysisFrame } from '../../js/real-data/analysis-frame.js';
import { DADOS_INSUFICIENTES, NAO_APLICAVEL } from '../../js/real-data/schema.js';

// Frame/Evidence realistas de instrumento crypto_spot (derivativos
// estruturalmente NAO_APLICAVEL — ver schema.js), como o ciclo real produz.
function okFrame(overrides: Record<string, unknown> = {}) {
  return {
    status: 'OK',
    status_reason: 'teste',
    asset: 'BTC',
    last_price: 50_000,
    sma: 49_500,
    ema: 49_700,
    volume_status: 'REAL',
    support: 49_000,
    resistance: 51_000,
    support_2: 48_000,
    resistance_2: 52_000,
    fib_extension_long_target: 53_000,
    fib_extension_short_target: 47_000,
    market_structure: 'ESTRUTURA_ALTA',
    volatility_state: 'MEDIA',
    ...overrides,
  };
}

function spotEvidence(overrides: Record<string, unknown> = {}) {
  return {
    source_id: 'market-data-bus',
    instrument_type: 'crypto_spot',
    timestamp: new Date().toISOString(),
    data_quality: 'COMPLETA_PARA_CAPACIDADES_TENTADAS',
    missing_fields: [],
    raw_sample_hash: 'hash_teste',
    order_book: DADOS_INSUFICIENTES,
    funding: NAO_APLICAVEL,
    open_interest: NAO_APLICAVEL,
    liquidations: NAO_APLICAVEL,
    long_short_ratio: NAO_APLICAVEL,
    ...overrides,
  };
}

function research(frameOverrides = {}, evidenceOverrides = {}, context = {}) {
  return buildResearchEngineFrame({
    frame: okFrame(frameOverrides),
    evidence: spotEvidence(evidenceOverrides),
    context,
  });
}

describe('core-rules: trendBias — a heurística consolidada de tendência (congelada)', () => {
  it('preço > SMA com EMA >= SMA => vies ALTA => SIGNAL LONG', () => {
    const r = research({ last_price: 50_000, sma: 49_500, ema: 49_700 });
    expect(r.trend_bias_heuristico).toBe('ALTA');
    expect(buildTradeSetupMatrix({ research: r }).signal).toBe('LONG');
  });

  it('preço < SMA com EMA <= SMA => vies BAIXA => SIGNAL SHORT', () => {
    const r = research({ last_price: 49_000, sma: 49_500, ema: 49_300 });
    expect(r.trend_bias_heuristico).toBe('BAIXA');
    expect(buildTradeSetupMatrix({ research: r }).signal).toBe('SHORT');
  });

  it('sinais mistos (preço acima da SMA mas EMA abaixo) => NEUTRO => WAIT', () => {
    const r = research({ last_price: 50_000, sma: 49_500, ema: 49_400 });
    expect(r.trend_bias_heuristico).toBe('NEUTRO');
    expect(buildTradeSetupMatrix({ research: r }).signal).toBe('WAIT');
  });

  it('SMA/EMA não-finitos => INDEFINIDO => WAIT (nunca um vies chutado)', () => {
    const r = research({ sma: DADOS_INSUFICIENTES, ema: DADOS_INSUFICIENTES });
    expect(r.trend_bias_heuristico).toBe('INDEFINIDO');
    expect(buildTradeSetupMatrix({ research: r }).signal).toBe('WAIT');
  });
});

describe('core-rules: matrix é apresentação pura — passthrough das rotas, nunca uma 4ª heurística', () => {
  it('LONG copia entry/TP1/TP2/SL/confiança/condição EXATAMENTE da rota_a_long', () => {
    const r = research();
    const m = buildTradeSetupMatrix({ research: r });
    expect(m.entry_zone).toBe(r.rota_a_long.entry_zone);
    expect(m.take_profit_1).toBe(r.rota_a_long.target_1);
    expect(m.take_profit_2).toBe(r.rota_a_long.target_2);
    expect(m.stop_loss).toBe(r.rota_a_long.invalidation);
    expect(m.confidence).toBe(r.rota_a_long.confidence);
    expect(m.condition).toBe(r.rota_a_long.required_confirmation);
  });

  it('as 3 rotas continuam TODAS presentes no research frame, mesmo com um SIGNAL escolhido', () => {
    const r = research();
    expect(r.rota_a_long).toBeDefined();
    expect(r.rota_b_short).toBeDefined();
    expect(r.rota_c_wait).toBeDefined();
  });

  it('research inválido => matriz vazia com SIGNAL DADOS_INSUFICIENTES, nunca um sinal fabricado', () => {
    const m = buildTradeSetupMatrix({ research: null });
    expect(m.signal).toBe(DADOS_INSUFICIENTES);
    expect(m.execution).toBe('DISABLED_BY_POLICY');
  });

  it('toda saída carrega read_only:true e execution:DISABLED_BY_POLICY — a constituição do núcleo', () => {
    const r = research();
    const m = buildTradeSetupMatrix({ research: r });
    expect(r.read_only).toBe(true);
    expect(r.execution).toBe('DISABLED_BY_POLICY');
    expect(m.read_only).toBe(true);
    expect(m.execution).toBe('DISABLED_BY_POLICY');
  });
});

describe('core-rules: capConfidenceBySufficiency — só rebaixa, nunca promove (congelado)', () => {
  it('spot sem order book nem multi-fonte (score 55) rebaixa HIGH para MEDIUM', () => {
    const suff = computeDataSufficiency({ frame: okFrame(), evidence: spotEvidence(), historical: false });
    expect(suff.score).toBe(55); // 25 candles + 20 preço + 10 volume
    // bias ALTA + volume REAL daria HIGH, mas o cap de 55 (<70) segura em MEDIUM
    const r = research();
    expect(r.rota_a_long.confidence).toBe('MEDIUM');
  });

  it('com order book real + 2 fontes frescas (score 80) o HIGH sobrevive', () => {
    const evidence = spotEvidence({ order_book: { bids: 10, asks: 10 } });
    const suff = computeDataSufficiency({ frame: okFrame(), evidence, historical: false, freshSourceCount: 2 });
    expect(suff.score).toBe(80);
    const r = research({}, { order_book: { bids: 10, asks: 10 } }, { freshSourceCount: 2 });
    expect(r.rota_a_long.confidence).toBe('HIGH');
  });

  it('sem volume real o teto otimista já nasce MEDIUM (nunca HIGH)', () => {
    const r = research(
      { volume_status: DADOS_INSUFICIENTES },
      { order_book: { bids: 10, asks: 10 } },
      { freshSourceCount: 2 },
    );
    expect(r.rota_a_long.confidence).toBe('MEDIUM');
  });

  it('vies contrário deixa a rota oposta em LOW — a confiança é por rota, não global', () => {
    const r = research(); // vies ALTA
    expect(r.rota_b_short.confidence).toBe('LOW');
  });

  it('buildResearchEngineFrame explode sem {frame, evidence} — contrato duro, nunca default silencioso', () => {
    expect(() => buildResearchEngineFrame({} as any)).toThrow();
  });
});

describe('core-rules: analysis-frame — portões de amostra e rótulos descritivos (congelados)', () => {
  const busCandles = (n: number, close = 50_000) =>
    Array.from({ length: n }, (_, i) => ({ t: 1_700_000_000 + i * 900, o: close, h: close + 50, l: close - 50, c: close, v: 5 }));

  // Cast deliberado: buildRealAnalysisFrame só chama .computeSeries() (a
  // própria assinatura injeta o cliente); tipar o RPC completo do worker
  // real aqui não acrescentaria cobertura nenhuma.
  const fakeWorker = (result: Record<string, number>) =>
    ({ computeSeries: async () => ({ result: { engineVersion: 1000, ...result } }) }) as any;

  it('abaixo de 10 candles => DADOS_INSUFICIENTES com motivo, WASM nem é chamado', async () => {
    const frame = await buildRealAnalysisFrame({
      evidence: { symbol: 'BTC', instrument_type: 'crypto_spot', timeframe: '15m', candles: busCandles(9), volume: NAO_APLICAVEL, missing_fields: [] },
      workerClient: fakeWorker({ sma: 1, ema: 1, stddev: 0, zscoreLast: 0 }),
    });
    expect(frame.status).toBe(DADOS_INSUFICIENTES);
    expect(frame.status_reason).toContain('abaixo_do_minimo_10');
  });

  it('sem workerClient => DADOS_INSUFICIENTES honesto (worker indisponível)', async () => {
    const frame = await buildRealAnalysisFrame({
      evidence: { symbol: 'BTC', instrument_type: 'crypto_spot', timeframe: '15m', candles: busCandles(50), volume: NAO_APLICAVEL, missing_fields: [] },
      workerClient: null,
    });
    expect(frame.status).toBe(DADOS_INSUFICIENTES);
    expect(frame.status_reason).toContain('worker_quant_engine_indisponivel');
  });

  it('volatility_state usa os limiares consolidados: <0.5% BAIXA, <2% MEDIA, senão ALTA', async () => {
    const evidence = { symbol: 'BTC', instrument_type: 'crypto_spot', timeframe: '15m', candles: busCandles(50), volume: { v: 1 }, missing_fields: [] };
    const low = await buildRealAnalysisFrame({ evidence, workerClient: fakeWorker({ sma: 50_000, ema: 50_000, stddev: 100, zscoreLast: 0 }) });
    const mid = await buildRealAnalysisFrame({ evidence, workerClient: fakeWorker({ sma: 50_000, ema: 50_000, stddev: 600, zscoreLast: 0 }) });
    const high = await buildRealAnalysisFrame({ evidence, workerClient: fakeWorker({ sma: 50_000, ema: 50_000, stddev: 1_500, zscoreLast: 0 }) });
    expect(low.volatility_state).toBe('BAIXA');   // 100/50000 = 0.2%
    expect(mid.volatility_state).toBe('MEDIA');   // 1.2%
    expect(high.volatility_state).toBe('ALTA');   // 3%
  });

  it('trend_direction descreve posição vs SMA com faixa morta de 0.1% (vocabulário fechado)', async () => {
    const evidence = { symbol: 'BTC', instrument_type: 'crypto_spot', timeframe: '15m', candles: busCandles(50, 50_000), volume: { v: 1 }, missing_fields: [] };
    const above = await buildRealAnalysisFrame({ evidence, workerClient: fakeWorker({ sma: 49_000, ema: 49_000, stddev: 1, zscoreLast: 0 }) });
    const lateral = await buildRealAnalysisFrame({ evidence, workerClient: fakeWorker({ sma: 50_010, ema: 50_010, stddev: 1, zscoreLast: 0 }) });
    expect(above.trend_direction).toBe('ACIMA_DA_MEDIA');
    expect(lateral.trend_direction).toBe('LATERAL_PROXIMO_DA_MEDIA'); // |Δ| = 0.02% < 0.1%
  });

  it('todo frame OK herda read_only:true + execution:DISABLED_BY_POLICY', async () => {
    const frame = await buildRealAnalysisFrame({
      evidence: { symbol: 'BTC', instrument_type: 'crypto_spot', timeframe: '15m', candles: busCandles(50), volume: { v: 1 }, missing_fields: [] },
      workerClient: fakeWorker({ sma: 50_000, ema: 50_000, stddev: 100, zscoreLast: 0.5 }),
    });
    expect(frame.status).toBe('OK');
    expect(frame.read_only).toBe(true);
    expect(frame.execution).toBe('DISABLED_BY_POLICY');
  });
});
