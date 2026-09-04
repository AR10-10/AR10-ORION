// schema-tradfi.test.ts — extensão real de js/real-data/schema.js para a
// Ordem Market Data Fabric (Fase 1): vocabulário DATA_FRESHNESS/READ_STATUS
// (§3/§8), a entrada tradfi_futures em STRUCTURAL_NAO_APLICAVEL_BY_INSTRUMENT
// e detectSourceConflict (§7 — "nunca escolher um valor silenciosamente
// quando as fontes divergem"). Execução real das funções puras, mesma
// convenção do resto da suíte — sem arquivo de teste prévio para
// schema.js, este é o primeiro.
import { describe, it, expect } from 'vitest';
import {
  DATA_FRESHNESS, READ_STATUS, FONTE_INDISPONIVEL, CONFLITO_DE_FONTES,
  DADOS_INSUFICIENTES, NAO_APLICAVEL, createEmptyEvidence, detectSourceConflict,
} from '../../js/real-data/schema.js';

describe('schema.js: DATA_FRESHNESS/READ_STATUS — vocabulário obrigatório do Ordem §2/§3', () => {
  it('DATA_FRESHNESS cobre os 4 estados temporais reais exigidos pelo Ordem §3/§8', () => {
    expect(DATA_FRESHNESS).toEqual({ REAL_TIME: 'REAL_TIME', DELAYED: 'DELAYED', END_OF_DAY: 'END_OF_DAY', HISTORICAL: 'HISTORICAL' });
    expect(Object.isFrozen(DATA_FRESHNESS)).toBe(true);
  });

  it('READ_STATUS reaproveita DADOS_INSUFICIENTES (nunca um segundo termo pro mesmo conceito) e adiciona FONTE_INDISPONIVEL/CONFLITO_DE_FONTES', () => {
    expect(READ_STATUS.DADOS_INSUFICIENTES).toBe(DADOS_INSUFICIENTES);
    expect(READ_STATUS.FONTE_INDISPONIVEL).toBe(FONTE_INDISPONIVEL);
    expect(READ_STATUS.CONFLITO_DE_FONTES).toBe(CONFLITO_DE_FONTES);
    expect(FONTE_INDISPONIVEL).toBe('FONTE_INDISPONIVEL');
    expect(CONFLITO_DE_FONTES).toBe('CONFLITO_DE_FONTES');
    expect(Object.isFrozen(READ_STATUS)).toBe(true);
  });
});

describe('schema.js: STRUCTURAL_NAO_APLICAVEL_BY_INSTRUMENT.tradfi_futures (via createEmptyEvidence)', () => {
  it('funding/liquidations/long_short_ratio nascem NAO_APLICAVEL (mecânica de perpétuo cripto, estruturalmente impossível num futuro datado da CME)', () => {
    const evidence = createEmptyEvidence({ source_id: 's', source_name: 'S', endpoint_kind: 'e', symbol: 'CME_ES', instrument_type: 'tradfi_futures' });
    expect(evidence.funding).toBe(NAO_APLICAVEL);
    expect(evidence.liquidations).toBe(NAO_APLICAVEL);
    expect(evidence.long_short_ratio).toBe(NAO_APLICAVEL);
  });

  it('open_interest/order_book/candles/ticker/volume NÃO são NAO_APLICAVEL — nascem DADOS_INSUFICIENTES (conceitos reais para um futuro CME, só não confirmados ainda por sonda nenhuma)', () => {
    const evidence = createEmptyEvidence({ source_id: 's', source_name: 'S', endpoint_kind: 'e', symbol: 'CME_ES', instrument_type: 'tradfi_futures' });
    for (const field of ['open_interest', 'order_book', 'candles', 'ticker', 'volume']) {
      expect(evidence[field]).toBe(DADOS_INSUFICIENTES);
    }
  });

  it('instrument_type desconhecido continua sem nenhum NAO_APLICAVEL estrutural (comportamento pré-existente, preservado)', () => {
    const evidence = createEmptyEvidence({ source_id: 's', source_name: 'S', endpoint_kind: 'e', symbol: 'X', instrument_type: 'tipo_desconhecido' });
    expect(evidence.funding).toBe(DADOS_INSUFICIENTES);
  });
});

describe('schema.js: STRUCTURAL_NAO_APLICAVEL_BY_INSTRUMENT.tradfi_equity (via createEmptyEvidence) — expansão TradFi, ações NASDAQ', () => {
  it('funding/liquidations/long_short_ratio nascem NAO_APLICAVEL (mesma mecânica de perpétuo cripto, estruturalmente impossível numa ação à vista)', () => {
    const evidence = createEmptyEvidence({ source_id: 's', source_name: 'S', endpoint_kind: 'e', symbol: 'NASDAQ_AAPL', instrument_type: 'tradfi_equity' });
    expect(evidence.funding).toBe(NAO_APLICAVEL);
    expect(evidence.liquidations).toBe(NAO_APLICAVEL);
    expect(evidence.long_short_ratio).toBe(NAO_APLICAVEL);
  });

  it('open_interest TAMBÉM nasce NAO_APLICAVEL aqui (diferente de tradfi_futures) — é conceito de derivativo (futuro/opção), uma ação à vista não tem esse número', () => {
    const evidence = createEmptyEvidence({ source_id: 's', source_name: 'S', endpoint_kind: 'e', symbol: 'NASDAQ_AAPL', instrument_type: 'tradfi_equity' });
    expect(evidence.open_interest).toBe(NAO_APLICAVEL);
  });

  it('order_book/candles/ticker/volume continuam DADOS_INSUFICIENTES — conceitos reais e aplicáveis a uma ação, só não confirmados ainda por nenhuma sonda', () => {
    const evidence = createEmptyEvidence({ source_id: 's', source_name: 'S', endpoint_kind: 'e', symbol: 'NASDAQ_AAPL', instrument_type: 'tradfi_equity' });
    for (const field of ['order_book', 'candles', 'ticker', 'volume']) {
      expect(evidence[field]).toBe(DADOS_INSUFICIENTES);
    }
  });
});

describe('schema.js: detectSourceConflict — Ordem §7 ("nunca escolher um valor silenciosamente")', () => {
  it('2 leituras dentro da tolerância => conflict:false, com o spread real calculado', () => {
    const result = detectSourceConflict([{ source_id: 'a', value: 100 }, { source_id: 'b', value: 100.1 }], 0.5);
    expect(result.conflict).toBe(false);
    expect(result.max).toBe(100.1);
    expect(result.min).toBe(100);
    expect(result.spreadPct).toBeCloseTo(0.1, 6);
  });

  it('2 leituras além da tolerância => conflict:true', () => {
    const result = detectSourceConflict([{ source_id: 'a', value: 100 }, { source_id: 'b', value: 102 }], 0.5);
    expect(result.conflict).toBe(true);
    expect(result.spreadPct).toBe(2);
  });

  it('menos de 2 leituras numéricas reais => conflict:false honesto (não há segunda fonte pra comparar, nunca um falso "sem conflito" disfarçado de confirmação)', () => {
    expect(detectSourceConflict([{ source_id: 'a', value: 100 }], 0.5)).toMatchObject({ conflict: false, reason: 'leituras_insuficientes_para_comparar' });
    expect(detectSourceConflict([], 0.5)).toMatchObject({ conflict: false, reason: 'leituras_insuficientes_para_comparar' });
    expect(detectSourceConflict(null, 0.5)).toMatchObject({ conflict: false, reason: 'leituras_insuficientes_para_comparar' });
  });

  it('valores não-numéricos (ex. DADOS_INSUFICIENTES vindo de uma fonte que falhou) são ignorados na comparação, nunca tratados como 0', () => {
    const result = detectSourceConflict(
      [{ source_id: 'a', value: 100 }, { source_id: 'b', value: DADOS_INSUFICIENTES }, { source_id: 'c', value: 100.05 }],
      0.5,
    );
    expect(result.conflict).toBe(false);
    expect(result.readings).toHaveLength(2);
  });

  it('min=0 e max>0 é sempre conflito (divisão por zero evitada sem fingir 0% de spread)', () => {
    const result = detectSourceConflict([{ source_id: 'a', value: 0 }, { source_id: 'b', value: 5 }], 0.5);
    expect(result.conflict).toBe(true);
    expect(result.spreadPct).toBeNull();
  });

  it('min=0 e max=0 nunca é conflito', () => {
    const result = detectSourceConflict([{ source_id: 'a', value: 0 }, { source_id: 'b', value: 0 }], 0.5);
    expect(result.conflict).toBe(false);
  });
});
