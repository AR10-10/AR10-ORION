// chart-integrity.test.ts — ADITIVO V-MAX Etapa 17 (Chart Integrity
// Engine): execução real da função pura. Cobre os 4 estados honestos:
// sem ciclo ainda (DADOS_INSUFICIENTES), símbolo/timeframe selecionado
// diverge do último ciclo real (SYMBOL_MISMATCH), candle mais velho que
// o limiar do próprio timeframe (STALE_DATA), e o caso são (SYNCED).
import { describe, it, expect } from 'vitest';
import { computeChartIntegrity } from '../src/nexus/chart-integrity';
import { TIMEFRAME_MS } from '../src/nexus/aura-lifecycle';

const base = {
  selectedSymbol: 'BTC',
  selectedTimeframe: '15m',
  cycleSymbol: 'BTC',
  cycleTimeframe: '15m',
  candleAgeMs: 60_000,
};

describe('computeChartIntegrity: DADOS_INSUFICIENTES honesto antes do 1º ciclo real', () => {
  it('qualquer um dos 4 campos de identidade ausente => DADOS_INSUFICIENTES, nunca um veredito chutado', () => {
    expect(computeChartIntegrity({ ...base, selectedSymbol: null }).status).toBe('DADOS_INSUFICIENTES');
    expect(computeChartIntegrity({ ...base, selectedTimeframe: null }).status).toBe('DADOS_INSUFICIENTES');
    expect(computeChartIntegrity({ ...base, cycleSymbol: null }).status).toBe('DADOS_INSUFICIENTES');
    expect(computeChartIntegrity({ ...base, cycleTimeframe: null }).status).toBe('DADOS_INSUFICIENTES');
  });

  it('candleAgeMs ausente/não-finito com identidade completa => DADOS_INSUFICIENTES (nunca assume fresco)', () => {
    expect(computeChartIntegrity({ ...base, candleAgeMs: null }).status).toBe('DADOS_INSUFICIENTES');
    expect(computeChartIntegrity({ ...base, candleAgeMs: NaN }).status).toBe('DADOS_INSUFICIENTES');
  });

  it('timeframe fora do vocabulário conhecido (TIMEFRAME_MS) => DADOS_INSUFICIENTES honesto, nunca um limiar chutado', () => {
    const r = computeChartIntegrity({ ...base, selectedTimeframe: '7m', cycleTimeframe: '7m' });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
  });
});

describe('computeChartIntegrity: SYMBOL_MISMATCH — o gancho real contra a classe de bug que o cancelled de App.tsx já mitiga, agora verificável', () => {
  it('símbolo selecionado diferente do símbolo do último ciclo real => SYMBOL_MISMATCH, mesmo com timeframe igual', () => {
    const r = computeChartIntegrity({ ...base, selectedSymbol: 'ETH' });
    expect(r.status).toBe('SYMBOL_MISMATCH');
    expect(r.reason).toContain('ETH:15m');
    expect(r.reason).toContain('BTC:15m');
  });

  it('timeframe selecionado diferente do timeframe do último ciclo real => SYMBOL_MISMATCH, mesmo com símbolo igual', () => {
    const r = computeChartIntegrity({ ...base, selectedTimeframe: '1h' });
    expect(r.status).toBe('SYMBOL_MISMATCH');
  });

  it('SYMBOL_MISMATCH nunca reporta candleAgeMs/maxAgeMs — a idade do candle do ciclo ERRADO não é informação útil aqui', () => {
    const r = computeChartIntegrity({ ...base, selectedSymbol: 'ETH' });
    expect(r.candleAgeMs).toBeNull();
    expect(r.maxAgeMs).toBeNull();
  });
});

describe('computeChartIntegrity: STALE_DATA — limiar real MÚLTIPLO do intervalo do próprio timeframe, nunca um número fixo', () => {
  it('candle com idade exatamente 3x o intervalo do timeframe (15m => 45min) ainda não é STALE (limite inclusivo)', () => {
    const barMs = TIMEFRAME_MS['15m'];
    const r = computeChartIntegrity({ ...base, candleAgeMs: barMs * 3 });
    expect(r.status).toBe('SYNCED');
  });

  it('candle com idade acima de 3x o intervalo do timeframe => STALE_DATA', () => {
    const barMs = TIMEFRAME_MS['15m'];
    const r = computeChartIntegrity({ ...base, candleAgeMs: barMs * 3 + 1 });
    expect(r.status).toBe('STALE_DATA');
    expect(r.reason).toContain('acima_do_limiar_de_3x');
    expect(r.maxAgeMs).toBe(barMs * 3);
  });

  it('o mesmo múltiplo de idade é SYNCED num timeframe maior (1h) — o limiar escala com o timeframe, nunca fixo em ms', () => {
    const barMs1h = TIMEFRAME_MS['1h'];
    // idade que seria STALE em 15m (>45min) é perfeitamente normal em 1h
    // (candle de 1h formando há 45min é só ~75% do próprio intervalo).
    const r = computeChartIntegrity({
      ...base,
      selectedTimeframe: '1h',
      cycleTimeframe: '1h',
      candleAgeMs: TIMEFRAME_MS['15m'] * 3, // 45min
    });
    expect(r.status).toBe('SYNCED');
    expect(r.maxAgeMs).toBe(barMs1h * 3);
  });
});

describe('computeChartIntegrity: SYNCED — o caso são, real e mais comum', () => {
  it('símbolo/timeframe iguais + candle fresco (idade 0) => SYNCED, reason null', () => {
    const r = computeChartIntegrity({ ...base, candleAgeMs: 0 });
    expect(r.status).toBe('SYNCED');
    expect(r.reason).toBeNull();
    expect(r.candleAgeMs).toBe(0);
  });
});
