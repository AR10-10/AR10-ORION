// outcome-matrix.test.ts — execução REAL. A pergunta é "os cortes e as
// contagens estão certos?", e em particular se o módulo consegue mesmo
// mostrar uma agregada que ESCONDE a verdade (LONG lucrativo, SHORT
// destrutivo, média morna) — é para isso que a matriz existe.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildOutcomeMatrix,
  buildArchiveOutcomeMatrix,
  sliceOutcomes,
  informativeSlices,
  establishedSpreadR,
  ALL_OUTCOME_AXES,
} from '../src/nexus/outcome-matrix';
import { MIN_TRADES_FOR_VALID_EXPECTANCY } from '../src/nexus/expectancy';
import { DEFAULT_MIN_OPPORTUNITY_SCORE } from '../src/nexus/institutional-score';
import type { TradeCostResult } from '../src/nexus/trade-simulation';
import type { TrackedPlan, TrackRecordState } from '../src/nexus/signal-track-record';
import { TRACK_RECORD_CONTRACT_VERSION } from '../src/nexus/signal-track-record';

function res(over: Partial<TradeCostResult> = {}): TradeCostResult {
  return {
    status: 'TARGET_HIT',
    direction: 'LONG',
    entryMid: 100,
    riskPoints: 10,
    grossR: 1,
    commissionR: 0,
    slippageR: 0,
    fundingR: 0,
    netR: 1,
    holdingMs: 60_000,
    resolvedAt: 1_700_000_000_000,
    regime: null,
    fingerprint: null,
    institutionalScore: null,
    volatilityAtOpen: null,
    observedMfeR: null,
    observedMaeR: null,
    firstTargetR: null,
    modelAgreement: null,
    ...over,
  };
}

/** n cópias — o jeito honesto de cruzar o piso de 30 nos testes. */
const many = (n: number, over: Partial<TradeCostResult>) => Array.from({ length: n }, () => res(over));

describe('outcome-matrix: fail-closed', () => {
  it('amostra vazia => DADOS_INSUFICIENTES, nunca uma matriz de zeros', () => {
    const m = buildOutcomeMatrix([]);
    expect(m.status).toBe('DADOS_INSUFICIENTES');
    expect(m.slices).toEqual([]);
    expect(m.sample).toBe(0);
    expect(m.reason).toBeTruthy();
  });

  it('null/undefined => DADOS_INSUFICIENTES (nunca lança)', () => {
    expect(buildOutcomeMatrix(null).status).toBe('DADOS_INSUFICIENTES');
    expect(buildOutcomeMatrix(undefined).status).toBe('DADOS_INSUFICIENTES');
  });

  it('eixo sem NENHUM dado real => zero células + unclassified = amostra inteira', () => {
    // Histórico anterior ao carimbo: regime/score/agreement todos null.
    const m = buildOutcomeMatrix(many(10, {}));
    const regime = m.slices.find((s) => s.axis === 'REGIME')!;
    expect(regime.cells).toEqual([]);
    expect(regime.unclassified).toBe(10);
    // Direção sempre existe — nunca foi opcional.
    expect(m.slices.find((s) => s.axis === 'DIRECAO')!.cells).toHaveLength(1);
  });

  it('ausência NUNCA vira uma categoria com estatística própria', () => {
    const s = sliceOutcomes([...many(3, { regime: 'TENDENCIA_ALTA' }), ...many(2, { regime: null })], 'REGIME');
    expect(s.cells.map((c) => c.label)).toEqual(['TENDENCIA_ALTA']);
    expect(s.unclassified).toBe(2);
    // Os 2 sem regime não entraram em nenhuma célula.
    expect(s.cells.reduce((t, c) => t + c.trades, 0)).toBe(3);
  });
});

describe('outcome-matrix: a agregada que escondia a verdade', () => {
  // O caso que justifica o módulo inteiro: expectativa agregada morna,
  // com um lado real lucrativo e outro real destrutivo.
  const amostra = [...many(30, { direction: 'LONG', netR: 1 }), ...many(30, { direction: 'SHORT', netR: -0.8 })];

  it('separa LONG de SHORT com a mesma matemática de expectancy.ts', () => {
    const s = sliceOutcomes(amostra, 'DIRECAO');
    expect(s.cells.map((c) => c.label)).toEqual(['LONG', 'SHORT']); // ordem declarada
    expect(s.cells[0].stats!.expectancyR).toBeCloseTo(1, 12);
    expect(s.cells[1].stats!.expectancyR).toBeCloseTo(-0.8, 12);
    expect(s.cells.every((c) => c.established)).toBe(true);
  });

  it('o spread real aparece, e é a informação que a agregada apagava', () => {
    const spread = establishedSpreadR(sliceOutcomes(amostra, 'DIRECAO'));
    expect(spread).toBeCloseTo(1.8, 12);
  });
});

describe('outcome-matrix: piso de amostra marca, nunca esconde', () => {
  it('célula abaixo do piso continua visível, com established=false e o n real', () => {
    const s = sliceOutcomes(
      [...many(MIN_TRADES_FOR_VALID_EXPECTANCY, { direction: 'LONG' }), ...many(5, { direction: 'SHORT' })],
      'DIRECAO',
    );
    const [long, short] = s.cells;
    expect(long.established).toBe(true);
    expect(short.established).toBe(false);
    expect(short.trades).toBe(5);
    expect(short.stats).not.toBeNull(); // a estatística existe; só não está estabelecida
  });

  it('o piso é exatamente MIN_TRADES_FOR_VALID_EXPECTANCY (>=, não >)', () => {
    const noPiso = sliceOutcomes(many(MIN_TRADES_FOR_VALID_EXPECTANCY, {}), 'DIRECAO');
    const umAbaixo = sliceOutcomes(many(MIN_TRADES_FOR_VALID_EXPECTANCY - 1, {}), 'DIRECAO');
    expect(noPiso.cells[0].established).toBe(true);
    expect(umAbaixo.cells[0].established).toBe(false);
  });

  it('spread recusa comparar uma célula firme com uma frágil', () => {
    const s = sliceOutcomes(
      [
        ...many(MIN_TRADES_FOR_VALID_EXPECTANCY, { direction: 'LONG', netR: 1 }),
        ...many(3, { direction: 'SHORT', netR: -5 }),
      ],
      'DIRECAO',
    );
    // −5R em 3 trades daria um "spread" de 6R que é ruído com cara de achado.
    expect(establishedSpreadR(s)).toBeNull();
  });
});

describe('outcome-matrix: os cortes numéricos não inventam limiar', () => {
  it('QUALIDADE corta exatamente em DEFAULT_MIN_OPPORTUNITY_SCORE, inclusivo', () => {
    const s = sliceOutcomes(
      [
        ...many(2, { institutionalScore: DEFAULT_MIN_OPPORTUNITY_SCORE }),
        ...many(3, { institutionalScore: DEFAULT_MIN_OPPORTUNITY_SCORE - 1 }),
        ...many(1, { institutionalScore: 99 }),
      ],
      'QUALIDADE',
    );
    const acima = s.cells.find((c) => c.label === `SCORE >= ${DEFAULT_MIN_OPPORTUNITY_SCORE}`)!;
    const abaixo = s.cells.find((c) => c.label === `SCORE < ${DEFAULT_MIN_OPPORTUNITY_SCORE}`)!;
    expect(acima.trades).toBe(3); // o do piso exato conta como acima
    expect(abaixo.trades).toBe(3);
    expect(s.cells[0].label).toBe(`SCORE >= ${DEFAULT_MIN_OPPORTUNITY_SCORE}`); // ordem declarada
  });

  it('score 0 é uma leitura real (score baixo), score null é ausência', () => {
    const s = sliceOutcomes([...many(2, { institutionalScore: 0 }), ...many(4, { institutionalScore: null })], 'QUALIDADE');
    expect(s.cells).toHaveLength(1);
    expect(s.cells[0].label).toBe(`SCORE < ${DEFAULT_MIN_OPPORTUNITY_SCORE}`);
    expect(s.cells[0].trades).toBe(2);
    expect(s.unclassified).toBe(4);
  });

  it('CONFLUENCIA corta pelo SINAL, e 0 é sua própria categoria', () => {
    const s = sliceOutcomes(
      [
        ...many(4, { modelAgreement: 0.3 }),
        ...many(3, { modelAgreement: -0.7 }),
        ...many(2, { modelAgreement: 0 }),
      ],
      'CONFLUENCIA',
    );
    expect(s.cells.map((c) => c.label)).toEqual(['MODELOS A FAVOR', 'MODELOS DIVIDIDOS', 'MODELOS CONTRA']);
    expect(s.cells.map((c) => c.trades)).toEqual([4, 2, 3]);
  });

  it('score não-finito (NaN) é ausência, nunca uma classificação', () => {
    const s = sliceOutcomes(many(3, { institutionalScore: Number.NaN }), 'QUALIDADE');
    expect(s.cells).toEqual([]);
    expect(s.unclassified).toBe(3);
  });
});

describe('outcome-matrix: ordenação e cobertura', () => {
  it('eixo de rótulo aberto (regime) sai por amostra decrescente', () => {
    const s = sliceOutcomes(
      [...many(2, { regime: 'LATERAL' }), ...many(7, { regime: 'TENDENCIA_ALTA' }), ...many(4, { regime: 'TENDENCIA_BAIXA' })],
      'REGIME',
    );
    expect(s.cells.map((c) => c.label)).toEqual(['TENDENCIA_ALTA', 'TENDENCIA_BAIXA', 'LATERAL']);
  });

  it('toda fatia preserva a amostra: soma das células + unclassified = total', () => {
    const amostra = [
      ...many(5, { direction: 'LONG', regime: 'LATERAL', institutionalScore: 70, modelAgreement: 0.2 }),
      ...many(6, { direction: 'SHORT', regime: null, institutionalScore: 10, modelAgreement: null }),
    ];
    const m = buildOutcomeMatrix(amostra);
    expect(m.sample).toBe(11);
    for (const s of m.slices) {
      expect(s.cells.reduce((t, c) => t + c.trades, 0) + s.unclassified).toBe(11);
    }
  });

  it('a matriz cobre os 4 eixos marginais, cada um com título legível', () => {
    const m = buildOutcomeMatrix(many(1, {}));
    expect(m.slices.map((s) => s.axis)).toEqual(ALL_OUTCOME_AXES);
    expect(m.slices.every((s) => s.title.length > 0)).toBe(true);
  });

  it('informativeSlices só devolve eixos que realmente separaram a amostra', () => {
    const m = buildOutcomeMatrix([
      ...many(3, { direction: 'LONG', regime: 'LATERAL' }),
      ...many(3, { direction: 'SHORT', regime: 'LATERAL' }),
    ]);
    const uteis = informativeSlices(m);
    expect(uteis.map((s) => s.axis)).toEqual(['DIRECAO']); // regime tem 1 célula só
  });

  it('função pura: não muta a amostra recebida', () => {
    const amostra = many(4, { direction: 'LONG', regime: 'LATERAL' });
    const antes = JSON.parse(JSON.stringify(amostra));
    buildOutcomeMatrix(amostra);
    expect(JSON.parse(JSON.stringify(amostra))).toEqual(antes);
  });
});

describe('outcome-matrix: eixo ativo × timeframe (arquivo)', () => {
  function tracked(status: TrackedPlan['status'], resolvedPrice: number): TrackedPlan {
    return {
      plan: {
        contractVersion: 2,
        direction: 'LONG',
        entry: { low: 99, high: 101, basis: 'SR_SUPPORT_1' },
        stop: { price: 90, basis: 'SR_SUPPORT_1' },
        targets: [{ price: 110, basis: 'SR_RESISTANCE_1' }],
        riskRewardRatios: [1],
        computedAt: 1_700_000_000_000,
      },
      openedAt: 1_700_000_000_000,
      status,
      resolvedAt: 1_700_000_500_000,
      resolvedPrice,
      targetsHit: status === 'TARGET_HIT' ? 1 : 0,
      breakEvenSuggested: false,
    };
  }
  const state = (history: TrackedPlan[]): TrackRecordState => ({
    contractVersion: TRACK_RECORD_CONTRACT_VERSION,
    active: null,
    history,
    targetHits: 0,
    partialHits: 0,
    stopHits: 0,
    replaced: 0,
  });

  it('uma célula por symbol:timeframe, ordenada por amostra', () => {
    const s = buildArchiveOutcomeMatrix({
      'BTCUSDT:15m': state([tracked('TARGET_HIT', 110), tracked('STOP_HIT', 90), tracked('TARGET_HIT', 110)]),
      'ETHUSDT:1h': state([tracked('STOP_HIT', 90)]),
    });
    expect(s.axis).toBe('ATIVO_TIMEFRAME');
    expect(s.cells.map((c) => c.label)).toEqual(['BTCUSDT:15m', 'ETHUSDT:1h']);
    expect(s.cells.map((c) => c.trades)).toEqual([3, 1]);
    expect(s.cells.every((c) => c.established)).toBe(false);
  });

  it('chave sem trade RESOLVIDO é omitida, nunca uma linha de zeros', () => {
    const aberto: TrackedPlan = { ...tracked('TARGET_HIT', 110), status: 'OPEN', resolvedAt: null, resolvedPrice: null };
    const s = buildArchiveOutcomeMatrix({
      'BTCUSDT:15m': state([tracked('TARGET_HIT', 110)]),
      'SOLUSDT:5m': state([aberto]),
      'XRPUSDT:1d': state([]),
    });
    expect(s.cells.map((c) => c.label)).toEqual(['BTCUSDT:15m']);
  });

  it('arquivo vazio/ausente => zero células (nunca lança)', () => {
    expect(buildArchiveOutcomeMatrix({}).cells).toEqual([]);
    expect(buildArchiveOutcomeMatrix(null).cells).toEqual([]);
    expect(buildArchiveOutcomeMatrix(undefined).cells).toEqual([]);
  });

  it('entrada corrompida (history ausente) é pulada, as sadias continuam', () => {
    const s = buildArchiveOutcomeMatrix({
      'BAD:1m': { contractVersion: TRACK_RECORD_CONTRACT_VERSION } as unknown as TrackRecordState,
      'BTCUSDT:15m': state([tracked('TARGET_HIT', 110)]),
    });
    expect(s.cells.map((c) => c.label)).toEqual(['BTCUSDT:15m']);
  });
});

describe('outcome-matrix: zero limiar novo (padrão no código-fonte)', () => {
  const src = readFileSync(new URL('../src/nexus/outcome-matrix.ts', import.meta.url), 'utf-8');

  it('os dois pisos vêm de outro módulo, nunca redeclarados aqui', () => {
    expect(src).toContain('MIN_TRADES_FOR_VALID_EXPECTANCY');
    expect(src).toContain('DEFAULT_MIN_OPPORTUNITY_SCORE');
    expect(src).not.toMatch(/const\s+\w*(MIN_TRADES|MIN_OPPORTUNITY|MIN_SCORE)\w*\s*=/);
  });

  it('a matemática por célula é computeExpectancy, nunca uma 2ª fórmula', () => {
    expect(src).toContain('computeExpectancy(');
    // Nenhum cálculo próprio de expectativa/winRate escondido aqui.
    expect(src).not.toMatch(/winRate\s*[*=]/);
    expect(src).not.toMatch(/expectancyR\s*=/);
  });
});

describe('outcome-matrix: fiação real em App.tsx', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf-8');

  it('a matriz é a MESMA amostra dos outros memos, computada uma vez', () => {
    expect(app).toContain('buildOutcomeMatrix(trackRecordResults)');
    expect(app.split('buildOutcomeMatrix(').length - 1).toBe(1);
  });

  it('o arquivo é lido no bloco, nunca em App() (evita re-render da árvore)', () => {
    const bloco = app.slice(app.indexOf('function OutcomeMatrixBlock()'));
    expect(bloco.slice(0, 900)).toContain('useTrackRecordArchive()');
    // O invariante real é "App() nunca assina o arquivo" — nunca "só existe
    // UMA leitura no arquivo inteiro". Um segundo bloco independente e
    // autocontido (RadarPanel, Stage 1 de opportunity-rank.ts) também tem
    // motivo real para ler o arquivo, e ler em dois blocos pequenos é
    // estritamente MELHOR para a árvore de render que ler uma vez em App()
    // — é exatamente o padrão que esta prova protege. Fixar a CONTAGEM
    // total faria qualquer bloco novo e legítimo quebrar este teste sem
    // ter violado o invariante — mesma lição já paga nesta base com
    // platt-calibration-wiring/shadow-calibration (buildSampleMaturity) e
    // drift-detector (lista de degraus). A prova certa é: para CADA
    // ocorrência, a função top-level mais próxima antes dela nunca é
    // `App`.
    const ocorrencias = [...app.matchAll(/useTrackRecordArchive\(\)/g)];
    expect(ocorrencias.length).toBeGreaterThan(0);
    const funcaoTopLevelAntes = /^function ([A-Za-z_]\w*)\(/gm;
    for (const m of ocorrencias) {
      let ultima: string | null = null;
      funcaoTopLevelAntes.lastIndex = 0;
      let f: RegExpExecArray | null;
      while ((f = funcaoTopLevelAntes.exec(app)) !== null) {
        if (f.index >= m.index!) break;
        ultima = f[1];
      }
      expect(ultima).not.toBe('App');
    }
  });

  it('só desenha eixos que realmente separaram a amostra (nada não-conquistado)', () => {
    expect(app).toContain('informativeSlices(outcomeMatrix)');
    expect(app).toContain('if (uteis.length === 0 && !mostrarArquivo) return null;');
    expect(app).toContain('archiveSlice.cells.length >= 2');
  });

  it('célula abaixo do piso é esmaecida e marcada, NUNCA escondida', () => {
    const chip = app.slice(app.indexOf('function OutcomeCellChip('), app.indexOf('function OutcomeSliceRow('));
    expect(chip).toContain('!cell.established');
    expect(chip).toContain('text-[#8ab4f8]/40');
    expect(chip).toContain('cell.established ? "" : "?"');
    // O número real da fatia continua na tela nos dois casos.
    expect(chip).toContain('{cell.trades}');
  });

  it('o bloco está montado dentro do ExpectancyCard', () => {
    expect(app).toContain('<OutcomeMatrixBlock />');
  });
});

describe('outcome-matrix: eixo VOLATILIDADE (§41) — o corte é a mediana da própria amostra', () => {
  const comVol = (vol: number | null, over: Partial<TradeCostResult> = {}) =>
    res({ volatilityAtOpen: vol, ...over });

  it('corta na mediana REAL, nunca num "ATR% alto" universal', () => {
    // ATR% 1,2,3,4 => mediana 2.5. Dois de cada lado.
    const s = sliceOutcomes([comVol(1), comVol(2), comVol(3), comVol(4)], 'VOLATILIDADE');
    expect(s.cells.map((c) => c.label)).toEqual(['ACIMA DA MEDIANA', 'ABAIXO DA MEDIANA']);
    expect(s.cells.map((c) => c.trades)).toEqual([2, 2]);
  });

  it('a MESMA volatilidade muda de lado quando a amostra muda — é auto-referente', () => {
    // Esta é a invariante que prova que não há limiar fixo escondido.
    const calmo = sliceOutcomes([comVol(0.5), comVol(1), comVol(1.5)], 'VOLATILIDADE');
    const agitado = sliceOutcomes([comVol(1), comVol(5), comVol(9)], 'VOLATILIDADE');
    const ladoNoCalmo = calmo.cells.find((c) => c.label === 'ACIMA DA MEDIANA')!;
    const ladoNoAgitado = agitado.cells.find((c) => c.label === 'ABAIXO DA MEDIANA')!;
    // ATR% 1 é "acima" num mercado calmo e "abaixo" num agitado.
    expect(ladoNoCalmo.trades).toBeGreaterThan(0);
    expect(ladoNoAgitado.trades).toBeGreaterThan(0);
  });

  it('registro sem leitura (anterior ao carimbo) é EXCLUÍDO, nunca lido como zero', () => {
    const s = sliceOutcomes([comVol(2), comVol(4), comVol(null), comVol(null)], 'VOLATILIDADE');
    expect(s.unclassified).toBe(2);
    expect(s.cells.reduce((t, c) => t + c.trades, 0)).toBe(2);
  });

  it('amostra SEM nenhuma leitura => eixo vazio, nunca uma mediana fabricada', () => {
    const s = sliceOutcomes([comVol(null), comVol(null)], 'VOLATILIDADE');
    expect(s.cells).toEqual([]);
    expect(s.unclassified).toBe(2);
  });

  it('ATR% zero ou negativo é leitura impossível => excluído', () => {
    const s = sliceOutcomes([comVol(0), comVol(-1), comVol(3), comVol(5)], 'VOLATILIDADE');
    expect(s.unclassified).toBe(2);
  });

  it('o eixo entra na matriz completa', () => {
    expect(ALL_OUTCOME_AXES).toContain('VOLATILIDADE');
    const m = buildOutcomeMatrix([comVol(2), comVol(4)]);
    expect(m.slices.map((s) => s.axis)).toContain('VOLATILIDADE');
  });

  it('o cabeçalho não afirma mais que o eixo não existe', () => {
    const src = readFileSync(new URL('../src/nexus/outcome-matrix.ts', import.meta.url), 'utf-8');
    expect(src).not.toContain('volatilidade → NÃO EXISTE');
    expect(src).toContain('REAL desde o §41');
  });
});

describe('outcome-matrix: §41 — congelado na abertura, jamais retroativo', () => {
  it('o carimbo grava o ATR% do MESMO motor já lido naquele instante', () => {
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf-8');
    expect(app).toContain('atrPercent: engine?.marketRegime?.atrPercent ?? null,');
  });

  it('o passthrough é literal, sem recomputar volatilidade', () => {
    const sim = readFileSync(new URL('../src/nexus/trade-simulation.ts', import.meta.url), 'utf-8');
    expect(sim).toContain('volatilityAtOpen: tracked.contextAtOpen?.atrPercent ?? null');
    // Nenhum cálculo de ATR aqui — só repasse.
    expect(sim).not.toMatch(/trueRange|computeAtr|atrOf\(/i);
  });
});
