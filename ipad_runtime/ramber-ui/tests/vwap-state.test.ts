// vwap-state.test.ts — Consolidação Final §22-§24: execução real da
// histerese de duas bandas e do contexto Preço×VWAP. O ponto crítico é o
// §22 ("Nunca trocar de estado a cada candle"): a zona entre a banda de
// saída e a de entrada mantém o estado anterior — travado aqui para sempre.
import { describe, it, expect } from 'vitest';
import {
  directionalStateWithHysteresis,
  computeVwapContext,
  LINE_STATE_ENTER_ATR,
  LINE_STATE_EXIT_ATR,
} from '../src/nexus/vwap-state';

describe('directionalStateWithHysteresis: duas bandas reais (entra 0.30·ATR, sai 0.10·ATR)', () => {
  // referência 100, ATR 10 => banda de entrada ±3, banda de saída ±1
  it('só entra em BULLISH além da banda de entrada; a zona morta não muda nada', () => {
    expect(directionalStateWithHysteresis('NEUTRAL', 102, 100, 10)).toBe('NEUTRAL'); // 2 < 3
    expect(directionalStateWithHysteresis('NEUTRAL', 103.5, 100, 10)).toBe('BULLISH'); // 3.5 >= 3
  });

  it('sticky real: entre a saída e a entrada, o estado anterior é mantido (§22)', () => {
    expect(directionalStateWithHysteresis('BULLISH', 101.5, 100, 10)).toBe('BULLISH'); // 1 < 1.5 < 3
    expect(directionalStateWithHysteresis('BULLISH', 100.5, 100, 10)).toBe('NEUTRAL'); // 0.5 <= 1: solta
    expect(directionalStateWithHysteresis('BEARISH', 98.5, 100, 10)).toBe('BEARISH'); // espelho
    expect(directionalStateWithHysteresis('BEARISH', 99.5, 100, 10)).toBe('NEUTRAL');
    // NEUTRAL na mesma zona intermediária NÃO vira direcional (assimetria da histerese)
    expect(directionalStateWithHysteresis('NEUTRAL', 101.5, 100, 10)).toBe('NEUTRAL');
  });

  it('cruzamento completo troca de lado direto (atravessou as duas bandas)', () => {
    expect(directionalStateWithHysteresis('BULLISH', 96.5, 100, 10)).toBe('BEARISH');
  });

  it('sem ATR: bandas de fallback proporcionais à referência (0.10%/0.03%)', () => {
    expect(directionalStateWithHysteresis('NEUTRAL', 100.05, 100, null)).toBe('NEUTRAL'); // 0.05 < 0.1
    expect(directionalStateWithHysteresis('NEUTRAL', 100.2, 100, null)).toBe('BULLISH');
    expect(directionalStateWithHysteresis('BULLISH', 100.05, 100, null)).toBe('BULLISH'); // 0.03 < 0.05 < 0.1
    expect(directionalStateWithHysteresis('BULLISH', 100.02, 100, null)).toBe('NEUTRAL');
  });

  it('entrada inválida => NEUTRAL (nunca um lado inventado)', () => {
    expect(directionalStateWithHysteresis('BULLISH', NaN, 100, 10)).toBe('NEUTRAL');
    expect(directionalStateWithHysteresis('BULLISH', 100, 0, 10)).toBe('NEUTRAL');
  });

  it('constantes documentadas são reais', () => {
    expect(LINE_STATE_ENTER_ATR).toBe(0.3);
    expect(LINE_STATE_EXIT_ATR).toBe(0.1);
  });
});

describe('computeVwapContext (§23/§24): distância percentual/absoluta/lado, fail-closed', () => {
  it('acima da VWAP: sinais e lado corretos, pct exato', () => {
    const ctx = computeVwapContext('NEUTRAL', 100.35, 100, 10);
    expect(ctx).not.toBeNull();
    expect(ctx!.distanceAbs).toBeCloseTo(0.35, 10);
    expect(ctx!.distancePct).toBeCloseTo(0.35, 10);
    expect(ctx!.side).toBe('ACIMA');
  });

  it('abaixo da VWAP: pct negativo e lado ABAIXO; na linha exata => NA_LINHA', () => {
    const below = computeVwapContext('NEUTRAL', 99, 100, null);
    expect(below!.distancePct).toBeCloseTo(-1, 10);
    expect(below!.side).toBe('ABAIXO');
    expect(computeVwapContext('NEUTRAL', 100, 100, null)!.side).toBe('NA_LINHA');
  });

  it('sem preço ou sem VWAP => null honesto (o cartão mostra dash, nunca 0 fabricado)', () => {
    expect(computeVwapContext('NEUTRAL', null, 100, 10)).toBeNull();
    expect(computeVwapContext('NEUTRAL', 100, null, 10)).toBeNull();
    expect(computeVwapContext('NEUTRAL', 100, NaN, 10)).toBeNull();
  });
});
