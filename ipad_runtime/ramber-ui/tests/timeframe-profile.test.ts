// timeframe-profile.test.ts — Diretriz Complementar (Evolução da
// Inteligência Operacional §7, "Inteligência Temporal"): execução real de
// timeframeProfile() em nexus/timeframe-profile.ts.
import { describe, it, expect } from 'vitest';
import { timeframeProfile, TIMEFRAME_PROFILES } from '../src/nexus/timeframe-profile';
import type { Timeframe } from '../src/nexus/types';

const ALL_TIMEFRAMES: Timeframe[] = [
  '1m', '3m', '5m', '15m', '30m',
  '1h', '2h', '4h', '6h', '8h', '12h',
  '1d', '1w', '1M',
];

describe('timeframeProfile: os 14 timeframes reais já aceitos (mesma lista de nexus/types.ts + App.tsx CHART_TIMEFRAMES)', () => {
  it('todo timeframe real tem um perfil real — nenhum buraco na tabela', () => {
    for (const tf of ALL_TIMEFRAMES) {
      const profile = timeframeProfile(tf);
      expect(profile, `perfil ausente para ${tf}`).not.toBeNull();
      expect(profile!.style.length).toBeGreaterThan(0);
      expect(profile!.etaHorizon.length).toBeGreaterThan(0);
    }
  });

  it('os exemplos LITERAIS da diretriz §7 batem exatamente: 1m/5m/15m/1h/4h/1d/1w/1M', () => {
    expect(timeframeProfile('1m')!.style).toBe('Trade Extremamente Curto');
    expect(timeframeProfile('5m')!.style).toBe('Scalp');
    expect(timeframeProfile('15m')!.style).toBe('Intraday');
    expect(timeframeProfile('1h')!.style).toBe('Swing Trade');
    expect(timeframeProfile('4h')!.style).toBe('Swing Prolongado');
    expect(timeframeProfile('1d')!.style).toBe('Posicional');
    expect(timeframeProfile('1w')!.style).toBe('Macroestrutura');
    expect(timeframeProfile('1M')!.style).toBe('Visão Institucional de Longo Prazo');
  });

  it('FAIL_CLOSED: string fora dos 14 timeframes reais => null, nunca um perfil fabricado', () => {
    expect(timeframeProfile('7m')).toBeNull();
    expect(timeframeProfile('')).toBeNull();
    expect(timeframeProfile('1Y')).toBeNull();
  });

  it('TIMEFRAME_PROFILES tem exatamente as 14 chaves reais, nunca mais nem menos', () => {
    expect(Object.keys(TIMEFRAME_PROFILES).sort()).toEqual([...ALL_TIMEFRAMES].sort());
  });
});
