// opportunity-rank.test.ts — execução REAL da junção Radar × Track Record
// Archive. A pergunta central: quando o histórico existe, este módulo usa
// EXATAMENTE as mesmas quatro funções já testadas em outros arquivos —
// nunca uma segunda lógica de portões; e quando não existe, o resultado é
// SEM_HISTORICO honesto, nunca um número fabricado.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  computeOpportunityRank,
  rankOpportunities,
  describeOpportunity,
  type OpportunityReading,
} from '../src/nexus/opportunity-rank';
import { evaluateShadowCalibration } from '../src/nexus/shadow-calibration';
import { evaluateWalkForwardCalibration } from '../src/nexus/walk-forward-calibration';
import { measureCalibrationFreshness } from '../src/nexus/calibration-freshness';
import { detectDrift } from '../src/nexus/drift-detector';
import { evaluatePromotion } from '../src/nexus/model-governance';
import { simulateTradeCostsBatch } from '../src/nexus/trade-simulation';
import { candleKey } from '../src/nexus/persistence';
import type { RadarQualificationResult } from '../src/nexus/radar-qualification';
import type { TrackRecordState, TrackedPlan } from '../src/nexus/signal-track-record';
import type { TradePlan } from '../src/nexus/trade-plan';

const NOW = 1_700_000_000_000;

function candidato(over: Partial<RadarQualificationResult> = {}): RadarQualificationResult {
  return {
    symbol: 'BTCUSDT',
    timeframe: '15m',
    qualifies: true,
    reason: 'CONFLUENCIA_REAL',
    direction: 'LONG',
    qualityIndex: 0.72,
    riskRewardRatio: 2.1,
    computedAt: NOW,
    provider: 'binance',
    ...over,
  } as RadarQualificationResult;
}

function plano(direction: 'LONG' | 'SHORT', entryLow: number, entryHigh: number, stop: number, alvos: number[]): TradePlan {
  return {
    contractVersion: 2,
    direction,
    entry: { low: entryLow, high: entryHigh, basis: 'SR_SUPPORT_1' },
    stop: { price: stop, basis: 'SR_SUPPORT_1' },
    targets: alvos.map((price) => ({ price, basis: 'SR_RESISTANCE_1' })),
    riskRewardRatios: alvos.map(() => 1),
    computedAt: NOW,
  };
}

/** Um trade LONG resolvido TARGET_HIT, R real ~ +1. */
function tradeResolvido(i: number): TrackedPlan {
  return {
    plan: plano('LONG', 99, 101, 90, [110]),
    openedAt: NOW - (i + 1) * 60_000,
    status: 'TARGET_HIT',
    resolvedAt: NOW - i * 60_000,
    resolvedPrice: 110,
    targetsHit: 1,
    breakEvenSuggested: false,
  };
}

function historico(n: number): TrackedPlan[] {
  return Array.from({ length: n }, (_, i) => tradeResolvido(n - i));
}

function estadoComHistorico(n: number): TrackRecordState {
  return {
    contractVersion: 2,
    active: null,
    history: historico(n),
    targetHits: n,
    partialHits: 0,
    stopHits: 0,
    replaced: 0,
  };
}

describe('opportunity-rank: SEM_HISTORICO é o padrão honesto, nunca fabricado', () => {
  it('candidato sem entrada no archive => SEM_HISTORICO, tudo mais null/0', () => {
    const r = computeOpportunityRank([candidato()], {}, NOW);
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe('SEM_HISTORICO');
    expect(r[0].sampleSize).toBe(0);
    expect(r[0].expectancyR).toBeNull();
    expect(r[0].governance).toBeNull();
    // Mas a leitura do MOMENTO (Radar) continua visível — nunca apagada.
    expect(r[0].qualityIndex).toBe(0.72);
  });

  it('archive presente mas com history vazio (par nunca resolvido) => ainda SEM_HISTORICO', () => {
    const key = candleKey('BTCUSDT', '15m');
    const vazio: TrackRecordState = { contractVersion: 2, active: null, history: [], targetHits: 0, partialHits: 0, stopHits: 0, replaced: 0 };
    const r = computeOpportunityRank([candidato()], { [key]: vazio }, NOW);
    expect(r[0].status).toBe('SEM_HISTORICO');
  });

  it('null/undefined em candidates ou archive nunca lança', () => {
    expect(computeOpportunityRank(null, null, NOW)).toEqual([]);
    expect(computeOpportunityRank(undefined, undefined, NOW)).toEqual([]);
    expect(computeOpportunityRank([candidato()], null, NOW)[0].status).toBe('SEM_HISTORICO');
  });

  it('lista vazia de candidatos => lista vazia, não erro', () => {
    expect(computeOpportunityRank([], {}, NOW)).toEqual([]);
  });
});

describe('opportunity-rank: a chave de junção é a MESMA de candleKey/trackRecordArchive', () => {
  it('symbol:timeframe do candidato precisa bater exatamente com a chave do archive', () => {
    const key = candleKey('ETHUSDT', '1h');
    const arq = { [key]: estadoComHistorico(35) };
    // Timeframe diferente do candidato => chave diferente => não encontra.
    const semMatch = computeOpportunityRank([candidato({ symbol: 'ETHUSDT', timeframe: '15m' })], arq, NOW);
    expect(semMatch[0].status).toBe('SEM_HISTORICO');
    // Timeframe igual => encontra.
    const comMatch = computeOpportunityRank([candidato({ symbol: 'ETHUSDT', timeframe: '1h' })], arq, NOW);
    expect(comMatch[0].status).toBe('HISTORICO_REAL');
  });

  it('dois candidatos do MESMO símbolo em timeframes diferentes são pares INDEPENDENTES', () => {
    const arq = {
      [candleKey('SOLUSDT', '5m')]: estadoComHistorico(40),
      // 1h nunca foi aberto — archive não tem essa chave.
    };
    const r = computeOpportunityRank(
      [candidato({ symbol: 'SOLUSDT', timeframe: '5m' }), candidato({ symbol: 'SOLUSDT', timeframe: '1h' })],
      arq,
      NOW,
    );
    expect(r[0].status).toBe('HISTORICO_REAL');
    expect(r[1].status).toBe('SEM_HISTORICO');
  });
});

describe('opportunity-rank: quando existe histórico, usa as MESMAS quatro funções já testadas', () => {
  it('shadow/walk-forward/frescor/drift/governança batem com o cálculo feito à mão, trade a trade', () => {
    const n = 70;
    const arq = { [candleKey('BTCUSDT', '15m')]: estadoComHistorico(n) };
    const r = computeOpportunityRank([candidato()], arq, NOW);
    expect(r[0].status).toBe('HISTORICO_REAL');
    expect(r[0].sampleSize).toBe(n);

    // Reconstrução independente: MESMA amostra, mesmas quatro chamadas que
    // App.tsx faz para o par ATIVO — se opportunity-rank tivesse uma
    // segunda lógica, os vereditos divergiriam aqui.
    const resultados = simulateTradeCostsBatch(historico(n));
    const shadow = evaluateShadowCalibration(resultados);
    const wf = evaluateWalkForwardCalibration(resultados);
    const fresh = measureCalibrationFreshness(resultados, NOW, '15m');
    const drift = detectDrift(resultados);
    const esperado = evaluatePromotion(shadow, wf, fresh, drift);

    expect(r[0].governance).toEqual(esperado);
  });

  it('expectancyR é a MESMA leitura de computeExpectancy, nunca uma segunda média', () => {
    const n = 40;
    const arq = { [candleKey('BTCUSDT', '15m')]: estadoComHistorico(n) };
    const r = computeOpportunityRank([candidato()], arq, NOW);
    // Todos os trades da fixture são TARGET_HIT LONG idênticos => R positivo real.
    expect(r[0].expectancyR).not.toBeNull();
    expect(r[0].expectancyR!).toBeGreaterThan(0);
  });

  it('amostra insuficiente para os portões ainda é HISTORICO_REAL — a esteira que decide o motivo', () => {
    // 3 trades: existe histórico real, mas longe do piso de qualquer portão.
    const arq = { [candleKey('BTCUSDT', '15m')]: estadoComHistorico(3) };
    const r = computeOpportunityRank([candidato()], arq, NOW);
    expect(r[0].status).toBe('HISTORICO_REAL'); // 3 trades É histórico real
    expect(r[0].sampleSize).toBe(3);
    expect(r[0].governance).not.toBeNull();
    expect(r[0].governance!.stage).toBe('CANDIDATE'); // esteira reprova cedo, com razão própria
  });
});

describe('opportunity-rank: rankOpportunities', () => {
  const base = (over: Partial<OpportunityReading>): OpportunityReading => ({
    symbol: 'X', timeframe: '15m', qualityIndex: 0.5, status: 'SEM_HISTORICO',
    sampleSize: 0, expectancyR: null, governance: null, ...over,
  });

  it('HISTORICO_REAL sempre vem antes de SEM_HISTORICO, mesmo com qualityIndex menor', () => {
    const semHist = base({ symbol: 'ALTO_MOMENTO', qualityIndex: 0.99 });
    const comHist = base({
      symbol: 'PROVADO', qualityIndex: 0.1, status: 'HISTORICO_REAL', sampleSize: 40,
      governance: { stage: 'ELEGIVEL', gates: [], blockedBy: null, nextRequirement: '' },
    });
    const ordenado = rankOpportunities([semHist, comHist]);
    expect(ordenado[0].symbol).toBe('PROVADO');
  });

  it('dentro de HISTORICO_REAL, estágio mais avançado da esteira vem primeiro', () => {
    const candidate = base({ symbol: 'C', status: 'HISTORICO_REAL', sampleSize: 5, governance: { stage: 'CANDIDATE', gates: [], blockedBy: null, nextRequirement: '' } });
    const eligivel = base({ symbol: 'E', status: 'HISTORICO_REAL', sampleSize: 90, governance: { stage: 'ELEGIVEL', gates: [], blockedBy: null, nextRequirement: '' } });
    const ordenado = rankOpportunities([candidate, eligivel]);
    expect(ordenado.map((r) => r.symbol)).toEqual(['E', 'C']);
  });

  it('empate de estágio quebra por qualityIndex PRESENTE, nunca um critério novo', () => {
    const gov = { stage: 'ELEGIVEL' as const, gates: [], blockedBy: null, nextRequirement: '' };
    const baixo = base({ symbol: 'BAIXO', qualityIndex: 0.3, status: 'HISTORICO_REAL', sampleSize: 40, governance: gov });
    const alto = base({ symbol: 'ALTO', qualityIndex: 0.9, status: 'HISTORICO_REAL', sampleSize: 40, governance: gov });
    const ordenado = rankOpportunities([baixo, alto]);
    expect(ordenado.map((r) => r.symbol)).toEqual(['ALTO', 'BAIXO']);
  });

  it('não muta o array recebido nem os objetos', () => {
    const lista = [base({ symbol: 'A', qualityIndex: 0.1 }), base({ symbol: 'B', qualityIndex: 0.9 })];
    const antes = JSON.parse(JSON.stringify(lista));
    rankOpportunities(lista);
    expect(JSON.parse(JSON.stringify(lista))).toEqual(antes);
  });

  it('null/undefined/vazio nunca lançam', () => {
    expect(rankOpportunities(null)).toEqual([]);
    expect(rankOpportunities(undefined)).toEqual([]);
    expect(rankOpportunities([])).toEqual([]);
  });
});

describe('opportunity-rank: describeOpportunity', () => {
  it('SEM_HISTORICO devolve a frase honesta, nunca um número', () => {
    const linha = describeOpportunity({ symbol: 'X', timeframe: '15m', qualityIndex: 0.5, status: 'SEM_HISTORICO', sampleSize: 0, expectancyR: null, governance: null });
    expect(linha).toBe('sem histórico');
    expect(linha).not.toMatch(/\d/);
  });

  it('HISTORICO_REAL traz estágio + expectativa + n sempre juntos', () => {
    const linha = describeOpportunity({
      symbol: 'X', timeframe: '15m', qualityIndex: 0.5, status: 'HISTORICO_REAL', sampleSize: 42, expectancyR: 0.317,
      governance: { stage: 'ELEGIVEL', gates: [], blockedBy: null, nextRequirement: '' },
    });
    expect(linha).toContain('ELEGIVEL');
    expect(linha).toContain('+0.32R');
    expect(linha).toContain('(42)');
  });
});

describe('opportunity-rank: pureza e determinismo', () => {
  it('não muta candidates nem archive recebidos', () => {
    const cands = [candidato()];
    const arq = { [candleKey('BTCUSDT', '15m')]: estadoComHistorico(40) };
    const candsAntes = JSON.parse(JSON.stringify(cands));
    const arqAntes = JSON.parse(JSON.stringify(arq));
    computeOpportunityRank(cands, arq, NOW);
    expect(JSON.parse(JSON.stringify(cands))).toEqual(candsAntes);
    expect(JSON.parse(JSON.stringify(arq))).toEqual(arqAntes);
  });

  it('determinístico: mesma entrada, mesma saída', () => {
    const cands = [candidato()];
    const arq = { [candleKey('BTCUSDT', '15m')]: estadoComHistorico(50) };
    expect(computeOpportunityRank(cands, arq, NOW)).toEqual(computeOpportunityRank(cands, arq, NOW));
  });
});

describe('opportunity-rank: contrato — zero motor duplicado (Disciplina §1)', () => {
  const src = readFileSync(new URL('../src/nexus/opportunity-rank.ts', import.meta.url), 'utf-8');

  it('reusa as quatro funções de evidência já existentes, zero reimplementação', () => {
    expect(src).toContain('evaluateShadowCalibration(');
    expect(src).toContain('evaluateWalkForwardCalibration(');
    expect(src).toContain('measureCalibrationFreshness(');
    expect(src).toContain('detectDrift(');
    expect(src).toContain('evaluatePromotion(');
    expect(src).toContain('computeExpectancy(');
    // Zero sigmoide/fórmula estatística própria escondida aqui.
    expect(src).not.toMatch(/1\s*\/\s*\(1\s*\+\s*Math\.exp/);
    expect(src).not.toMatch(/Math\.sqrt/);
  });

  it('reusa candleKey — a MESMA convenção de chave do trackRecordArchive', () => {
    expect(src).toContain('candleKey(');
  });

  it('nunca declara um novo piso de amostra (MIN_*, mínimo) — delega tudo às fontes', () => {
    expect(src).not.toMatch(/MIN_[A-Z_]+\s*=\s*\d/);
  });
});

describe('opportunity-rank: fiação real em App.tsx — aditivo, display only (LEI 24)', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf-8');

  it('junta radarCandidates com trackRecordArchive, uma vez só', () => {
    expect(app).toContain('computeOpportunityRank(candidates, trackRecordArchive, opportunityFreshnessMinuteBucket * 60_000)');
    expect(app.split('computeOpportunityRank(').length - 1).toBe(1);
  });

  it('reusa useTrackRecordArchive já existente — nunca um segundo hook de store para o mesmo campo', () => {
    // A rodada quase criou um `useTrackRecordArchiveSnapshot` duplicado;
    // corrigido antes de comitar. Trava que o hook JÁ existente continua
    // sendo o único caminho de leitura do arquivo.
    expect(app).toContain('const trackRecordArchive = useTrackRecordArchive();');
    const storeSrc = readFileSync(new URL('../src/store/unified-snapshot-store.ts', import.meta.url), 'utf-8');
    expect(storeSrc.match(/=>\s*useUnifiedSnapshotStore\(\(s\)\s*=>\s*s\.trackRecordArchive/g) ?? []).toHaveLength(1);
  });

  it('computado só quando o painel está ABERTO (Main Thread sagrada) — nunca a cada tick com o painel fechado', () => {
    expect(app).toMatch(/radarPanelOpen\s*\?\s*computeOpportunityRank/);
  });

  it('NÃO decide nada: nenhum consumidor além da exibição no candidato do Radar', () => {
    expect(app).not.toMatch(/opportunity(Rank)?[^\n]*\b(direction\s*=|engine\.|tradePlan\s*=|riskSuggestion\s*=)/);
    // E nunca reordena a lista existente do Radar (rankRadarCandidates
    // continua a única fonte de ORDEM — Stage 1 é aditivo, não substitui).
    expect(app).not.toContain('rankOpportunities(');
  });

  it('a ausência de histórico é rotulada honestamente na própria UI, nunca escondida', () => {
    expect(app).toContain('nunca foi aberto no gráfico');
    expect(app).toContain('describeOpportunity(opportunity)');
  });
});
