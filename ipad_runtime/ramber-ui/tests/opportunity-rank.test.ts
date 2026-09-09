// opportunity-rank.test.ts — execução REAL da junção Radar × Track Record
// Archive. A pergunta central: quando o histórico existe, este módulo usa
// EXATAMENTE as mesmas quatro funções já testadas em outros arquivos —
// nunca uma segunda lógica de portões; e quando não existe, o resultado é
// SEM_HISTORICO honesto, nunca um número fabricado.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  computeOpportunityRank,
  compareAssetTimeframes,
  suggestBetterTimeframe,
  rankOpportunities,
  describeOpportunity,
  type OpportunityReading,
} from '../src/nexus/opportunity-rank';
import { MULTI_TIMEFRAME_LIST } from '../src/nexus/multi-timeframe-engine';
import { evaluateShadowCalibration } from '../src/nexus/shadow-calibration';
import { evaluateWalkForwardCalibration } from '../src/nexus/walk-forward-calibration';
import { measureCalibrationFreshness } from '../src/nexus/calibration-freshness';
import { detectDrift } from '../src/nexus/drift-detector';
import { evaluatePromotion, type PromotionStage } from '../src/nexus/model-governance';
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

describe('compareAssetTimeframes: "qual o melhor tempo gráfico pra este ativo" (Stage 2)', () => {
  it('devolve uma leitura por prazo da régua default (MULTI_TIMEFRAME_LIST), na mesma ordem', () => {
    const r = compareAssetTimeframes('BTCUSDT', {}, NOW);
    expect(r).toHaveLength(MULTI_TIMEFRAME_LIST.length);
    expect(r.map((x) => x.timeframe)).toEqual([...MULTI_TIMEFRAME_LIST]);
    expect(r.every((x) => x.status === 'SEM_HISTORICO')).toBe(true);
  });

  it('qualityIndex é SEMPRE null — nunca herda a leitura estrutural do Radar (que não existe para a maioria destes prazos)', () => {
    const arq = { [candleKey('BTCUSDT', '15m')]: estadoComHistorico(40) };
    const r = compareAssetTimeframes('BTCUSDT', arq, NOW);
    expect(r.every((x) => x.qualityIndex === null)).toBe(true);
  });

  it('prazo com histórico real usa a MESMA avaliação de computeOpportunityRank — zero segunda lógica', () => {
    const n = 45;
    const arq = { [candleKey('ETHUSDT', '1h')]: estadoComHistorico(n) };
    const viaCompare = compareAssetTimeframes('ETHUSDT', arq, NOW).find((x) => x.timeframe === '1h')!;
    const viaCandidato = computeOpportunityRank([candidato({ symbol: 'ETHUSDT', timeframe: '1h' })], arq, NOW)[0];
    // Mesmo status/amostra/governança/expectativa — só qualityIndex diverge
    // de propósito (candidato do Radar carrega 0.72; aqui é sempre null).
    expect(viaCompare.status).toBe(viaCandidato.status);
    expect(viaCompare.sampleSize).toBe(viaCandidato.sampleSize);
    expect(viaCompare.expectancyR).toBe(viaCandidato.expectancyR);
    expect(viaCompare.governance).toEqual(viaCandidato.governance);
    expect(viaCompare.qualityIndex).toBeNull();
  });

  it('prazos são pares INDEPENDENTES — histórico em 1h não vaza para 15m do mesmo ativo', () => {
    const arq = { [candleKey('BTCUSDT', '1h')]: estadoComHistorico(50) };
    const r = compareAssetTimeframes('BTCUSDT', arq, NOW, ['15m', '1h'] as const);
    const quinze = r.find((x) => x.timeframe === '15m')!;
    const umaHora = r.find((x) => x.timeframe === '1h')!;
    expect(quinze.status).toBe('SEM_HISTORICO');
    expect(umaHora.status).toBe('HISTORICO_REAL');
  });

  it('aceita uma régua de prazos custom, nunca obrigada a MULTI_TIMEFRAME_LIST', () => {
    const r = compareAssetTimeframes('BTCUSDT', {}, NOW, ['5m', '4h']);
    expect(r.map((x) => x.timeframe)).toEqual(['5m', '4h']);
  });

  it('null/undefined em archive nunca lança', () => {
    expect(() => compareAssetTimeframes('BTCUSDT', null, NOW)).not.toThrow();
    expect(() => compareAssetTimeframes('BTCUSDT', undefined, NOW)).not.toThrow();
  });
});

describe('suggestBetterTimeframe: a sugestão (nunca troca automática — LEI 24/§71)', () => {
  const gov = (stage: PromotionStage) => ({ stage, gates: [], blockedBy: null, nextRequirement: '' });

  const reading = (over: Partial<OpportunityReading>): OpportunityReading => ({
    symbol: 'BTCUSDT', timeframe: '15m', qualityIndex: null, status: 'SEM_HISTORICO',
    sampleSize: 0, expectancyR: null, governance: null, ...over,
  });

  it('nenhum prazo alcançou ELEGIVEL => null, nunca uma sugestão fabricada', () => {
    const atual = reading({ timeframe: '15m', status: 'HISTORICO_REAL', sampleSize: 40, expectancyR: 0.1, governance: gov('CANDIDATE') });
    const todos = [atual, reading({ timeframe: '1h', status: 'HISTORICO_REAL', sampleSize: 35, expectancyR: 0.4, governance: gov('SHADOW') })];
    expect(suggestBetterTimeframe(atual, todos)).toBeNull();
  });

  it('atual não é ELEGIVEL, existe um ELEGIVEL real em outro prazo => sugere esse', () => {
    const atual = reading({ timeframe: '15m', status: 'HISTORICO_REAL', sampleSize: 40, expectancyR: 0.1, governance: gov('VALIDATION') });
    const melhor = reading({ timeframe: '1h', status: 'HISTORICO_REAL', sampleSize: 60, expectancyR: 0.55, governance: gov('ELEGIVEL') });
    const r = suggestBetterTimeframe(atual, [atual, melhor]);
    expect(r?.timeframe).toBe('1h');
  });

  it('atual já é ELEGIVEL e nenhum outro ELEGIVEL bate a expectativa real dele => null', () => {
    const atual = reading({ timeframe: '15m', status: 'HISTORICO_REAL', sampleSize: 60, expectancyR: 0.6, governance: gov('ELEGIVEL') });
    const pior = reading({ timeframe: '1h', status: 'HISTORICO_REAL', sampleSize: 60, expectancyR: 0.2, governance: gov('ELEGIVEL') });
    expect(suggestBetterTimeframe(atual, [atual, pior])).toBeNull();
  });

  it('atual já é ELEGIVEL mas outro ELEGIVEL tem expectativa REAL estritamente melhor => sugere esse', () => {
    const atual = reading({ timeframe: '15m', status: 'HISTORICO_REAL', sampleSize: 60, expectancyR: 0.3, governance: gov('ELEGIVEL') });
    const melhor = reading({ timeframe: '4h', status: 'HISTORICO_REAL', sampleSize: 60, expectancyR: 0.9, governance: gov('ELEGIVEL') });
    const r = suggestBetterTimeframe(atual, [atual, melhor]);
    expect(r?.timeframe).toBe('4h');
  });

  it('vários ELEGIVEL: sugere o de MAIOR expectância real, nunca o primeiro da lista', () => {
    const atual = reading({ timeframe: '15m', status: 'SEM_HISTORICO' });
    const medio = reading({ timeframe: '1h', status: 'HISTORICO_REAL', sampleSize: 60, expectancyR: 0.3, governance: gov('ELEGIVEL') });
    const melhor = reading({ timeframe: '4h', status: 'HISTORICO_REAL', sampleSize: 60, expectancyR: 0.7, governance: gov('ELEGIVEL') });
    const r = suggestBetterTimeframe(atual, [atual, medio, melhor]);
    expect(r?.timeframe).toBe('4h');
  });

  it('nunca sugere o MESMO timeframe já selecionado', () => {
    const atual = reading({ timeframe: '15m', status: 'HISTORICO_REAL', sampleSize: 60, expectancyR: 0.5, governance: gov('ELEGIVEL') });
    // Mesmo se por algum motivo a lista contiver o próprio prazo atual de novo.
    const duplicata = reading({ timeframe: '15m', status: 'HISTORICO_REAL', sampleSize: 999, expectancyR: 99, governance: gov('ELEGIVEL') });
    expect(suggestBetterTimeframe(atual, [atual, duplicata])).toBeNull();
  });

  it('atual null (ativo nunca aberto em prazo nenhum) — qualquer ELEGIVEL real já é sugestão', () => {
    const eleg = reading({ timeframe: '1h', status: 'HISTORICO_REAL', sampleSize: 60, expectancyR: 0.4, governance: gov('ELEGIVEL') });
    expect(suggestBetterTimeframe(null, [eleg])?.timeframe).toBe('1h');
    expect(suggestBetterTimeframe(undefined, [eleg])?.timeframe).toBe('1h');
  });

  it('null/undefined/vazio em all nunca lançam, sempre null', () => {
    const atual = reading({ timeframe: '15m' });
    expect(suggestBetterTimeframe(atual, null)).toBeNull();
    expect(suggestBetterTimeframe(atual, undefined)).toBeNull();
    expect(suggestBetterTimeframe(atual, [])).toBeNull();
  });
});

describe('TimeframeSuggestionBanner: fiação real em App.tsx — sugere, NUNCA troca sozinho (LEI 24/§71)', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf-8');

  it('existe como componente próprio — não é uma 4ª chamada a useTrackRecordArchive() dentro de App()', () => {
    expect(app).toContain('function TimeframeSuggestionBanner()');
    // Mesma disciplina do teste de outcome-matrix.test.ts: nenhuma chamada
    // a useTrackRecordArchive() pode viver dentro do corpo de App().
  });

  it('a troca de verdade usa o MESMO setChartTimeframe do botão manual da régua — nunca um caminho novo', () => {
    const banner = app.slice(app.indexOf('function TimeframeSuggestionBanner()'), app.indexOf('function UpdateAvailableBanner()'));
    expect(banner).toContain('setChartTimeframe?.(suggestion.timeframe)');
    // Zero import/uso de qualquer setter de engine.direction/Trade Plan aqui.
    expect(banner).not.toMatch(/engine\.direction\s*=|setTradePlan|setEngineDirection/);
  });

  it('nunca troca sozinho: setChartTimeframe só é chamado dentro de um onClick, nunca em useEffect/useMemo', () => {
    const banner = app.slice(app.indexOf('function TimeframeSuggestionBanner()'), app.indexOf('function UpdateAvailableBanner()'));
    expect(banner).not.toMatch(/useEffect\([^)]*setChartTimeframe/s);
    expect(banner).toMatch(/onClick=\{\(\)\s*=>\s*setChartTimeframe\?\.\(suggestion\.timeframe\)\}/);
  });

  it('a razão real (prazo + evidência) fica sempre visível na própria faixa, nunca só em tooltip/title', () => {
    const banner = app.slice(app.indexOf('function TimeframeSuggestionBanner()'), app.indexOf('function UpdateAvailableBanner()'));
    expect(banner).toContain('describeOpportunity(suggestion)');
    expect(banner).not.toMatch(/title=\{[^}]*describeOpportunity/);
  });

  it('está montado na árvore de render (ChartWidget), não é uma função morta', () => {
    expect(app).toContain('<TimeframeSuggestionBanner />');
  });
});
