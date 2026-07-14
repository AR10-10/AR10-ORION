// institutional-conviction-trend.test.ts — Diretriz Complementar
// (Nexus Predictive Engine §18 / Evolução da Inteligência Operacional §4,
// "Conviction Engine"): execução real de pushConvictionHistory() e
// computeConvictionTrend() em institutional-score.ts. Mesmo score real
// 0-100 já testado em institutional-confidence-zone.test.ts, agora
// reduzido a uma tendência real (FORTALECENDO/ENFRAQUECENDO/ESTAVEL).
import { describe, it, expect } from 'vitest';
import {
  pushConvictionHistory,
  computeConvictionTrend,
  CONVICTION_HISTORY_CAPACITY,
  type ConvictionScoreSample,
} from '../src/nexus/institutional-score';

const sample = (score: number, at: number): ConvictionScoreSample => ({ score, at });

describe('pushConvictionHistory: ring real do Score Geral, nunca acumula sem limite', () => {
  it('ring vazio aceita a primeira amostra real', () => {
    expect(pushConvictionHistory([], sample(70, 1000))).toEqual([sample(70, 1000)]);
  });

  it('respeita o teto real de capacidade — amostra mais antiga cai', () => {
    let ring: ConvictionScoreSample[] = [];
    for (let i = 0; i < 5; i++) ring = pushConvictionHistory(ring, sample(i, i), 3);
    expect(ring).toHaveLength(3);
    expect(ring.map((s) => s.score)).toEqual([2, 3, 4]);
  });

  it('usa CONVICTION_HISTORY_CAPACITY por padrão quando nenhum teto é passado', () => {
    let ring: ConvictionScoreSample[] = [];
    for (let i = 0; i < CONVICTION_HISTORY_CAPACITY + 5; i++) ring = pushConvictionHistory(ring, sample(i, i));
    expect(ring).toHaveLength(CONVICTION_HISTORY_CAPACITY);
  });
});

describe('computeConvictionTrend: média recente vs. anterior da MESMA série real (Regra de Ouro 2: nunca probabilidade)', () => {
  it('FAIL_CLOSED: histórico curto demais (< 10 amostras) => DADOS_INSUFICIENTES, nunca uma tendência fabricada', () => {
    const short = Array.from({ length: 9 }, (_, i) => sample(50, i));
    const r = computeConvictionTrend(short);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('historico_real_insuficiente_para_tendencia');
    expect(r.trend).toBeNull();
  });

  it('FORTALECENDO: a média da metade recente sobe bem além da zona-morta real (3 pontos)', () => {
    const history = [
      ...Array.from({ length: 10 }, () => sample(50, 1)), // metade anterior: média 50
      ...Array.from({ length: 10 }, () => sample(80, 2)), // metade recente: média 80
    ];
    const r = computeConvictionTrend(history);
    expect(r.status).toBe('OK');
    expect(r.trend).toBe('FORTALECENDO');
    expect(r.priorAverage).toBeCloseTo(50, 10);
    expect(r.recentAverage).toBeCloseTo(80, 10);
  });

  it('ENFRAQUECENDO: a média da metade recente cai bem além da zona-morta real', () => {
    const history = [
      ...Array.from({ length: 10 }, () => sample(85, 1)),
      ...Array.from({ length: 10 }, () => sample(55, 2)),
    ];
    const r = computeConvictionTrend(history);
    expect(r.status).toBe('OK');
    expect(r.trend).toBe('ENFRAQUECENDO');
  });

  it('ESTAVEL: a diferença entre as médias fica dentro da zona-morta real de 3 pontos', () => {
    const history = [
      ...Array.from({ length: 10 }, () => sample(70, 1)),
      ...Array.from({ length: 10 }, () => sample(71, 2)), // +1 ponto, dentro da zona-morta
    ];
    const r = computeConvictionTrend(history);
    expect(r.status).toBe('OK');
    expect(r.trend).toBe('ESTAVEL');
  });

  it('fronteira exata: delta > 3.0 é a fronteira real (3.0 fica ESTAVEL, 3.01 já muda)', () => {
    const atBoundary = [
      ...Array.from({ length: 10 }, () => sample(70, 1)),
      ...Array.from({ length: 10 }, () => sample(73, 2)),
    ];
    expect(computeConvictionTrend(atBoundary).trend).toBe('ESTAVEL');
    const justOver = [
      ...Array.from({ length: 10 }, () => sample(70, 1)),
      ...Array.from({ length: 10 }, () => sample(73.02, 2)),
    ];
    expect(computeConvictionTrend(justOver).trend).toBe('FORTALECENDO');
  });

  it('amostras não-finitas nunca entram na conta (filtradas, nunca corrompem a média)', () => {
    const history: ConvictionScoreSample[] = [
      ...Array.from({ length: 10 }, () => sample(60, 1)),
      sample(NaN, 2),
      ...Array.from({ length: 9 }, () => sample(60, 2)),
    ];
    const r = computeConvictionTrend(history);
    expect(r.status).toBe('OK');
    expect(r.trend).toBe('ESTAVEL');
  });

  it('determinística: mesma série real, mesma leitura', () => {
    const history = Array.from({ length: 20 }, (_, i) => sample(50 + (i % 5), i));
    expect(computeConvictionTrend(history, 9_000)).toEqual(computeConvictionTrend(history, 9_000));
  });

  it('"probabilidade de acerto" nunca aparece na leitura — tendência de convicção é média real, nunca chance de acerto (Regra de Ouro 2)', () => {
    const history = Array.from({ length: 20 }, (_, i) => sample(50 + i, i));
    const r = computeConvictionTrend(history);
    expect(JSON.stringify(r).toLowerCase()).not.toContain('probabilidade');
  });
});
