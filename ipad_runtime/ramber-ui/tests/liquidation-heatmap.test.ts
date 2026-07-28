// liquidation-heatmap.test.ts — OMEGA CORE V-MAX Fase 8.1. Execução real
// da função pura (convenção deste repo para lógica de fronteira).
import { describe, it, expect } from 'vitest';
import {
  computeLiquidationHeatmap,
  LIQUIDATION_HEATMAP_CONTRACT_VERSION,
  MIN_EVENTS_FOR_HEATMAP,
  DEFAULT_LIQUIDATION_BUCKET_COUNT,
} from '../src/nexus/liquidation-heatmap';
import type { LiquidationEvent } from '../src/engine-bridge';

const ev = (
  symbol: string,
  side: 'LONG_LIQUIDATED' | 'SHORT_LIQUIDATED',
  price: number,
  notionalUsd: number,
  timestamp = Date.now(),
): LiquidationEvent => ({ symbol, side, price, qty: notionalUsd / price, notionalUsd, timestamp });

describe('computeLiquidationHeatmap: fail-closed honesto', () => {
  it('symbol null => DADOS_INSUFICIENTES, mesmo com eventos reais presentes', () => {
    const r = computeLiquidationHeatmap([ev('BTCUSDT', 'LONG_LIQUIDATED', 50000, 100000)], null);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('sem_ativo_selecionado');
    expect(r.buckets).toHaveLength(0);
  });

  it('lista de eventos vazia => DADOS_INSUFICIENTES honesto', () => {
    const r = computeLiquidationHeatmap([], 'BTC');
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('nenhum_evento_real_recebido_ainda_nesta_sessao');
  });

  it('eventos reais existem mas nenhum é do símbolo ativo => DADOS_INSUFICIENTES honesto (nunca mistura ativos)', () => {
    const events = [
      ev('ETHUSDT', 'LONG_LIQUIDATED', 3000, 80000),
      ev('ETHUSDT', 'SHORT_LIQUIDATED', 3010, 90000),
      ev('ETHUSDT', 'LONG_LIQUIDATED', 2990, 70000),
    ];
    const r = computeLiquidationHeatmap(events, 'BTC');
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('eventos_reais_insuficientes_para_este_ativo_nesta_janela');
  });

  it(`menos de ${MIN_EVENTS_FOR_HEATMAP} eventos reais do símbolo ativo => DADOS_INSUFICIENTES (nunca "heatmap" de 1-2 pontos)`, () => {
    const events = [ev('BTCUSDT', 'LONG_LIQUIDATED', 50000, 100000), ev('BTCUSDT', 'SHORT_LIQUIDATED', 50100, 60000)];
    const r = computeLiquidationHeatmap(events, 'BTC');
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.eventCount).toBe(0);
  });

  it('todos os eventos reais no MESMO preço exato => sem faixa real para bucketizar, DADOS_INSUFICIENTES honesto', () => {
    const events = [
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50000, 100000),
      ev('BTCUSDT', 'SHORT_LIQUIDATED', 50000, 60000),
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50000, 70000),
    ];
    const r = computeLiquidationHeatmap(events, 'BTC');
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('faixa_de_preco_real_insuficiente_para_bucketizar');
  });
});

describe('computeLiquidationHeatmap: filtragem real por símbolo (exchange-wide feed)', () => {
  it('ignora eventos reais de OUTROS símbolos mesmo quando o ativo pedido também tem eventos reais suficientes', () => {
    const events = [
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50000, 100000),
      ev('BTCUSDT', 'SHORT_LIQUIDATED', 50500, 90000),
      ev('BTCUSDT', 'LONG_LIQUIDATED', 49500, 80000),
      ev('ETHUSDT', 'LONG_LIQUIDATED', 3000, 500000), // não deve contar
      ev('ETHUSDT', 'SHORT_LIQUIDATED', 3050, 500000), // não deve contar
    ];
    const r = computeLiquidationHeatmap(events, 'BTC');
    expect(r.status).toBe('OK');
    expect(r.eventCount).toBe(3);
    expect(r.symbol).toBe('BTC');
  });

  it('constrói o símbolo esperado como base+USDT (mesma convenção real de bybit-futures.ts/binance-futures-public.js)', () => {
    const events = [
      ev('SOLUSDT', 'LONG_LIQUIDATED', 100, 60000),
      ev('SOLUSDT', 'SHORT_LIQUIDATED', 102, 55000),
      ev('SOLUSDT', 'LONG_LIQUIDATED', 98, 65000),
    ];
    const r = computeLiquidationHeatmap(events, 'SOL');
    expect(r.status).toBe('OK');
    expect(r.eventCount).toBe(3);
  });
});

describe('computeLiquidationHeatmap: bucketização real por preço', () => {
  it('cada evento real cai no bucket correto (soma real, nunca interpolada)', () => {
    const events = [
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50000, 100000),
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50010, 50000), // mesmo bucket que o de cima, se width > 10
      ev('BTCUSDT', 'SHORT_LIQUIDATED', 51000, 200000), // faixa alta, provavelmente outro bucket
    ];
    const r = computeLiquidationHeatmap(events, 'BTC', 4);
    expect(r.status).toBe('OK');
    const totalEvents = r.buckets.reduce((sum, b) => sum + b.eventCount, 0);
    expect(totalEvents).toBe(3);
    const totalNotional = r.buckets.reduce((sum, b) => sum + b.totalNotionalUsd, 0);
    expect(totalNotional).toBeCloseTo(350000, 5);
  });

  it('separa longNotionalUsd de shortNotionalUsd corretamente dentro do mesmo bucket', () => {
    const events = [
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50000, 100000),
      ev('BTCUSDT', 'SHORT_LIQUIDATED', 50001, 40000),
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50002, 20000),
    ];
    const r = computeLiquidationHeatmap(events, 'BTC', 1); // 1 bucket força todos juntos
    expect(r.status).toBe('OK');
    expect(r.buckets).toHaveLength(1);
    expect(r.buckets[0].longNotionalUsd).toBeCloseTo(120000, 5);
    expect(r.buckets[0].shortNotionalUsd).toBeCloseTo(40000, 5);
    expect(r.buckets[0].totalNotionalUsd).toBeCloseTo(160000, 5);
  });

  it('rangeMin/rangeMax são o preço real mínimo/máximo dos eventos do símbolo ativo', () => {
    const events = [
      ev('BTCUSDT', 'LONG_LIQUIDATED', 49000, 10000),
      ev('BTCUSDT', 'SHORT_LIQUIDATED', 51000, 20000),
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50000, 15000),
    ];
    const r = computeLiquidationHeatmap(events, 'BTC');
    expect(r.rangeMin).toBe(49000);
    expect(r.rangeMax).toBe(51000);
  });

  it('maxBucketNotionalUsd é o real maior total entre os buckets — nunca um teto fabricado', () => {
    const events = [
      ev('BTCUSDT', 'LONG_LIQUIDATED', 49000, 500000),
      ev('BTCUSDT', 'SHORT_LIQUIDATED', 50999, 10000),
      ev('BTCUSDT', 'LONG_LIQUIDATED', 49010, 300000),
    ];
    const r = computeLiquidationHeatmap(events, 'BTC', 4);
    expect(r.status).toBe('OK');
    const realMax = Math.max(...r.buckets.map((b) => b.totalNotionalUsd));
    expect(r.maxBucketNotionalUsd).toBeCloseTo(realMax, 5);
    expect(r.maxBucketNotionalUsd).toBeCloseTo(800000, 5); // os 2 primeiros eventos ficam próximos o bastante para o mesmo bucket
  });

  it('evento no preço MÁXIMO exato cai no último bucket (borda superior inclusiva, nunca perdido)', () => {
    const events = [
      ev('BTCUSDT', 'LONG_LIQUIDATED', 49000, 10000),
      ev('BTCUSDT', 'SHORT_LIQUIDATED', 50000, 20000), // igual a rangeMax
      ev('BTCUSDT', 'LONG_LIQUIDATED', 49500, 15000),
    ];
    const r = computeLiquidationHeatmap(events, 'BTC', 2);
    expect(r.status).toBe('OK');
    const totalEvents = r.buckets.reduce((sum, b) => sum + b.eventCount, 0);
    expect(totalEvents).toBe(3); // nenhum evento real perdido por arredondamento de borda
  });

  it('usa DEFAULT_LIQUIDATION_BUCKET_COUNT quando bucketCount não é passado', () => {
    const events = Array.from({ length: MIN_EVENTS_FOR_HEATMAP }, (_, i) => ev('BTCUSDT', 'LONG_LIQUIDATED', 50000 + i * 10, 60000));
    const r = computeLiquidationHeatmap(events, 'BTC');
    expect(r.status).toBe('OK');
    expect(r.buckets).toHaveLength(DEFAULT_LIQUIDATION_BUCKET_COUNT);
  });
});

describe('computeLiquidationHeatmap: peso de idade real (Diretriz Final de Lapidação Visual, Parte 4)', () => {
  it('evento recente (idade 0) pesa exatamente notionalUsd cheio — mesmo comportamento de antes da Parte 4', () => {
    const now = Date.now();
    const events = [
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50000, 100000, now),
      ev('BTCUSDT', 'SHORT_LIQUIDATED', 50010, 50000, now),
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50020, 30000, now),
    ];
    const r = computeLiquidationHeatmap(events, 'BTC', 1, now);
    expect(r.status).toBe('OK');
    expect(r.buckets[0].totalNotionalUsd).toBeCloseTo(180000, 5);
  });

  it('evento bem além de expireCandles (60min) pesa 0 no agregado VISUAL deste render — mesmo comportamento real de ageAlpha já usado por LiquidityZonesPlugin/StructureBreakMarkersPlugin/KillZoneBandsPlugin (decai até minAlpha, depois cai a 0)', () => {
    const now = Date.now();
    const oldTimestamp = now - 120 * 60_000; // 2h atrás, bem além de expireCandles=60min
    const events = [
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50000, 100000, oldTimestamp),
      ev('BTCUSDT', 'SHORT_LIQUIDATED', 50010, 50000, oldTimestamp),
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50020, 30000, oldTimestamp),
    ];
    const r = computeLiquidationHeatmap(events, 'BTC', 1, now);
    expect(r.status).toBe('OK');
    expect(r.buckets[0].totalNotionalUsd).toBe(0); // peso visual real 0 — mesma disciplina do resto do codebase
    // mas o evento real nunca é apagado do FEED — eventCount continua contando os 3.
    expect(r.buckets[0].eventCount).toBe(3);
    expect(r.eventCount).toBe(3);
  });

  it('evento DENTRO da janela de fade (entre 10 e 60min) pesa menos que um recente com o MESMO notionalUsd real — decaimento real, não fabricação', () => {
    const now = Date.now();
    const events = [
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50000, 100000, now), // recente, bucket 0
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50000, 100000, now - 35 * 60_000), // 35min atrás — dentro da janela 10-60min, ainda pesa >0
      ev('BTCUSDT', 'SHORT_LIQUIDATED', 51000, 10000, now), // bucket distante só pra passar do mínimo de faixa
    ];
    const r = computeLiquidationHeatmap(events, 'BTC', 2, now);
    expect(r.status).toBe('OK');
    // eventCount real não muda com idade — 2 eventos reais no bucket 0.
    expect(r.buckets[0].eventCount).toBe(2);
    // total pesado é MENOS que a soma bruta (200000, o 2º evento decaiu),
    // mas MAIS que só o evento recente sozinho (o 2º ainda pesa algo, não zerou).
    expect(r.buckets[0].totalNotionalUsd).toBeLessThan(200000);
    expect(r.buckets[0].totalNotionalUsd).toBeGreaterThan(100000);
  });

  it('eventCount nunca é afetado pelo peso de idade (contagem real, sempre)', () => {
    const now = Date.now();
    const events = [
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50000, 100000, now - 500 * 60_000), // muito antigo
      ev('BTCUSDT', 'SHORT_LIQUIDATED', 50010, 50000, now),
      ev('BTCUSDT', 'LONG_LIQUIDATED', 50020, 30000, now),
    ];
    const r = computeLiquidationHeatmap(events, 'BTC', 1, now);
    expect(r.eventCount).toBe(3);
    expect(r.buckets[0].eventCount).toBe(3);
  });
});

describe('computeLiquidationHeatmap: contrato estável', () => {
  it('contractVersion sempre presente e estável', () => {
    const events = [
      ev('BTCUSDT', 'LONG_LIQUIDATED', 49000, 10000),
      ev('BTCUSDT', 'SHORT_LIQUIDATED', 50000, 20000),
      ev('BTCUSDT', 'LONG_LIQUIDATED', 49500, 15000),
    ];
    const r = computeLiquidationHeatmap(events, 'BTC');
    expect(r.contractVersion).toBe(LIQUIDATION_HEATMAP_CONTRACT_VERSION);
    expect(LIQUIDATION_HEATMAP_CONTRACT_VERSION).toBe(1);
  });

  it('nunca expõe nenhum campo chamado probability/probabilidade/chance/prediction/preditivo (Regra de Ouro 2 + honestidade retrospectiva)', () => {
    const events = [
      ev('BTCUSDT', 'LONG_LIQUIDATED', 49000, 10000),
      ev('BTCUSDT', 'SHORT_LIQUIDATED', 50000, 20000),
      ev('BTCUSDT', 'LONG_LIQUIDATED', 49500, 15000),
    ];
    const r = computeLiquidationHeatmap(events, 'BTC');
    const keys = JSON.stringify(Object.keys(r)) + JSON.stringify(Object.keys(r.buckets[0]));
    expect(keys.toLowerCase()).not.toMatch(/probab|chance|odds|predict|preditiv/);
  });
});
