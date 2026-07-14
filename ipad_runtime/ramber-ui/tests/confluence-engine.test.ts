// confluence-engine.test.ts — Phase Ω Priority 2 ("Probability Engine" no
// pedido original, entregue honestamente como Confluence/Conviction Engine
// — ver o cabeçalho de confluence-engine.ts para o racional completo).
// Real-execution tests: constrói fixtures no formato REAL de saída de cada
// subsistema (CouncilDecision, MultiTimeframeMatrix, ensembleConsensus) e
// chama a função de produção — nunca reimplementa a matemática esperada à
// parte, já que o pool em si (buildEnsembleConsensus) já tem sua própria
// suíte real em ensemble-consensus.test.ts.
import { describe, it, expect } from 'vitest';
import { buildConvictionReading } from '../src/nexus/confluence-engine';
import type { CouncilDecision } from '../src/nexus/council';
import type { MultiTimeframeMatrix, MultiTimeframeId, TimeframeContext } from '../src/nexus/multi-timeframe-engine';
import { MULTI_TIMEFRAME_LIST } from '../src/nexus/multi-timeframe-engine';

function council(stance: CouncilDecision['stance'], agreement: number | null, quorum = 5): CouncilDecision {
  return {
    contractVersion: 2,
    stance,
    agreement,
    opinionMass: agreement === null ? null : { long: stance === 'LONG' ? agreement : 0, short: stance === 'SHORT' ? agreement : 0, neutral: 1 - agreement },
    quorum,
    riskGated: stance === 'ABSTAIN' && quorum === 0,
    votes: [],
    computedAt: Date.now(),
  };
}

function tfContext(status: 'OK' | 'DADOS_INSUFICIENTES', confidenceStance: 'LONG' | 'SHORT' | 'NEUTRAL' | null, confidence: number | null): TimeframeContext {
  return {
    timeframe: '15m',
    status,
    reason: status === 'OK' ? null : 'sem_candles_reais_para_este_timeframe',
    structureLabel: null,
    regime: null,
    regimeDirection: null,
    atrPercent: null,
    rsi: null,
    support1: null,
    resistance1: null,
    confidence,
    confidenceStance,
    candlesUsed: status === 'OK' ? 50 : 0,
    computedAt: Date.now(),
  };
}

/** Matriz real com os 6 prazos, todos na mesma leitura por padrão —
 *  `overrides` substitui prazos específicos por outra leitura. */
function matrix(
  defaultStance: 'LONG' | 'SHORT' | 'NEUTRAL' | null,
  overrides: Partial<Record<MultiTimeframeId, 'LONG' | 'SHORT' | 'NEUTRAL' | null>> = {},
): MultiTimeframeMatrix {
  const out = {} as MultiTimeframeMatrix;
  for (const tf of MULTI_TIMEFRAME_LIST) {
    const stance = tf in overrides ? overrides[tf]! : defaultStance;
    out[tf] = stance === null
      ? tfContext('DADOS_INSUFICIENTES', null, null)
      : tfContext('OK', stance, 0.6);
  }
  return out;
}

const ensembleOk = (direcao: 'ALTA' | 'BAIXA' | 'NEUTRO', forca: number) => ({ status: 'OK', direcao, forca });

describe('buildConvictionReading: fail-closed sem direção ativa do Core Engine', () => {
  it('WAIT => DADOS_INSUFICIENTES honesto, nunca uma leitura fabricada', () => {
    const r = buildConvictionReading({
      coreDirection: 'WAIT',
      ensembleConsensus: ensembleOk('ALTA', 0.8),
      council: council('LONG', 0.7),
      multiTimeframe: matrix('LONG'),
      trustScore: 0.9,
    });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('core_engine_sem_direcao_ativa_no_momento_(WAIT)');
    expect(r.conviction).toBeNull();
    expect(r.members).toEqual([]);
  });

  it('coreDirection null (mesma semântica de WAIT) => idêntico', () => {
    const r = buildConvictionReading({
      coreDirection: null,
      ensembleConsensus: null,
      council: null,
      multiTimeframe: null,
      trustScore: null,
    });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
  });

  it('nenhum dos 3 subsistemas com leitura real => DADOS_INSUFICIENTES, nunca 0 fabricado', () => {
    const r = buildConvictionReading({
      coreDirection: 'LONG',
      ensembleConsensus: null,
      council: council('ABSTAIN', null, 0),
      multiTimeframe: null,
      trustScore: null,
    });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('nenhum_subsistema_com_leitura_real_nesta_janela');
    expect(r.members).toHaveLength(3);
    expect(r.members.every((m) => m.agreesWithCore === null)).toBe(true);
  });
});

describe('buildConvictionReading: unanimidade real', () => {
  it('3 subsistemas concordam com LONG => verdict CONFIRMS, conviction alta', () => {
    const r = buildConvictionReading({
      coreDirection: 'LONG',
      ensembleConsensus: ensembleOk('ALTA', 0.8),
      council: council('LONG', 0.75),
      multiTimeframe: matrix('LONG'),
      trustScore: null,
    });
    expect(r.status).toBe('OK');
    expect(r.verdict).toBe('CONFIRMS');
    expect(r.agreeingCount).toBe(3);
    expect(r.totalReadable).toBe(3);
    expect(r.conviction).toBeGreaterThan(0.5);
    // Sem TrustScore real medido => ajustada permanece null, nunca 0 fabricado.
    expect(r.convictionAdjusted).toBeNull();
  });

  it('3 subsistemas discordam de LONG (todos SHORT) => verdict CONTRADICTS', () => {
    const r = buildConvictionReading({
      coreDirection: 'LONG',
      ensembleConsensus: ensembleOk('BAIXA', 0.8),
      council: council('SHORT', 0.75),
      multiTimeframe: matrix('SHORT'),
      trustScore: null,
    });
    expect(r.status).toBe('OK');
    expect(r.verdict).toBe('CONTRADICTS');
    expect(r.agreeingCount).toBe(0);
    expect(r.totalReadable).toBe(3);
  });
});

describe('buildConvictionReading: mistura real (nem unânime, nem vazio)', () => {
  it('2 concordam, 1 discorda => agreeingCount real, verdict pode ser CONFIRMS ou MIXED conforme a força relativa (nunca CONTRADICTS)', () => {
    const r = buildConvictionReading({
      coreDirection: 'LONG',
      ensembleConsensus: ensembleOk('ALTA', 0.8),
      council: council('LONG', 0.75),
      multiTimeframe: matrix('SHORT'), // discorda
      trustScore: null,
    });
    expect(r.status).toBe('OK');
    expect(r.agreeingCount).toBe(2);
    expect(r.totalReadable).toBe(3);
    expect(r.verdict).not.toBe('CONTRADICTS');
  });
});

describe('buildConvictionReading: TrustScore amortece, nunca vota direção', () => {
  it('convictionAdjusted = mesma força real do pool amortecida (forca_ajustada), nunca uma escala inventada', () => {
    const r = buildConvictionReading({
      coreDirection: 'LONG',
      ensembleConsensus: ensembleOk('ALTA', 1),
      council: council('LONG', 1),
      multiTimeframe: matrix('LONG'),
      trustScore: 0.5,
    });
    expect(r.status).toBe('OK');
    expect(r.conviction).not.toBeNull();
    expect(r.convictionAdjusted).not.toBeNull();
    // forca_ajustada = forca * dataQualityWeight (mesmo contrato de
    // ensemble-engine.js) — amortece, nunca amplifica nem inverte.
    expect(r.convictionAdjusted as number).toBeCloseTo((r.conviction as number) * 0.5, 10);
    expect(r.convictionAdjusted as number).toBeLessThanOrEqual(r.conviction as number);
  });

  it('TrustScore ruim não muda o verdict (concordância unânime continua CONFIRMS, só mais fraca)', () => {
    const r = buildConvictionReading({
      coreDirection: 'LONG',
      ensembleConsensus: ensembleOk('ALTA', 1),
      council: council('LONG', 1),
      multiTimeframe: matrix('LONG'),
      trustScore: 0.1,
    });
    expect(r.verdict).toBe('CONFIRMS');
    expect(r.convictionAdjusted as number).toBeCloseTo((r.conviction as number) * 0.1, 10);
  });
});

describe('buildConvictionReading: membro ENSEMBLE prefere forca_ajustada do próprio pool quando disponível (achado real de auditoria, FASE Ω Priority 3)', () => {
  it('forca_ajustada real e diferente de forca => strength do membro ENSEMBLE usa a ajustada, não a bruta', () => {
    const r = buildConvictionReading({
      coreDirection: 'LONG',
      ensembleConsensus: { status: 'OK', direcao: 'ALTA', forca: 0.8, forca_ajustada: 0.3 },
      council: null,
      multiTimeframe: null,
      trustScore: null,
    });
    const ensembleMember = r.members.find((m) => m.id === 'ENSEMBLE')!;
    expect(ensembleMember.strength).toBeCloseTo(0.3, 10);
    expect(ensembleMember.detail).toContain('ajustada por qualidade de dados');
  });

  it('forca_ajustada null (Data Quality Weight não medido nesta janela) => cai honestamente para forca bruta, nunca 0 fabricado', () => {
    const r = buildConvictionReading({
      coreDirection: 'LONG',
      ensembleConsensus: { status: 'OK', direcao: 'ALTA', forca: 0.8, forca_ajustada: null },
      council: null,
      multiTimeframe: null,
      trustScore: null,
    });
    const ensembleMember = r.members.find((m) => m.id === 'ENSEMBLE')!;
    expect(ensembleMember.strength).toBeCloseTo(0.8, 10);
    expect(ensembleMember.detail).not.toContain('ajustada por qualidade de dados');
  });

  it('forca_ajustada ausente do objeto (formato antigo, ex.: ensembleOk() de outros testes) => mesmo fallback honesto para forca bruta', () => {
    const r = buildConvictionReading({
      coreDirection: 'LONG',
      ensembleConsensus: ensembleOk('ALTA', 0.8),
      council: null,
      multiTimeframe: null,
      trustScore: null,
    });
    const ensembleMember = r.members.find((m) => m.id === 'ENSEMBLE')!;
    expect(ensembleMember.strength).toBeCloseTo(0.8, 10);
  });
});

describe('buildConvictionReading: Multi-Timeframe entra como UM voto real (fração dos prazos), nunca 6 votos', () => {
  it('7 de 9 prazos concordam com LONG => membro MULTI_TIMEFRAME strength=7/9, agreesWithCore=true (lista §7 ampliada)', () => {
    const r = buildConvictionReading({
      coreDirection: 'LONG',
      ensembleConsensus: null,
      council: null,
      multiTimeframe: matrix('LONG', { '1m': 'SHORT', '5m': 'SHORT' }),
      trustScore: null,
    });
    const mtfMember = r.members.find((m) => m.id === 'MULTI_TIMEFRAME')!;
    expect(mtfMember.agreesWithCore).toBe(true);
    expect(mtfMember.strength).toBeCloseTo(7 / 9, 10);
  });

  it('minoria logo abaixo da maioria (4 de 9) => agreesWithCore false (só maioria ESTRITA concorda)', () => {
    const r = buildConvictionReading({
      coreDirection: 'LONG',
      ensembleConsensus: null,
      council: null,
      multiTimeframe: matrix('LONG', { '30m': 'SHORT', '1h': 'SHORT', '4h': 'SHORT', '1d': 'SHORT', '1w': 'SHORT' }),
      trustScore: null,
    });
    const mtfMember = r.members.find((m) => m.id === 'MULTI_TIMEFRAME')!;
    expect(mtfMember.agreesWithCore).toBe(false);
    expect(mtfMember.strength).toBeCloseTo(4 / 9, 10);
  });

  it('nenhum prazo com leitura real => membro MULTI_TIMEFRAME null honesto, resto do pool continua', () => {
    const r = buildConvictionReading({
      coreDirection: 'LONG',
      ensembleConsensus: ensembleOk('ALTA', 0.9),
      council: null,
      multiTimeframe: matrix(null),
      trustScore: null,
    });
    const mtfMember = r.members.find((m) => m.id === 'MULTI_TIMEFRAME')!;
    expect(mtfMember.agreesWithCore).toBeNull();
    expect(r.status).toBe('OK'); // ensemble sozinho ainda sustenta uma leitura real
    expect(r.totalReadable).toBe(1);
  });
});

describe('buildConvictionReading: LEI 24 — read-only por construção', () => {
  it('nunca devolve um campo que se pareça com um sinal de trading próprio (direção sempre ecoa o Core Engine de entrada)', () => {
    const r = buildConvictionReading({
      coreDirection: 'SHORT',
      ensembleConsensus: ensembleOk('BAIXA', 0.6),
      council: council('SHORT', 0.6),
      multiTimeframe: matrix('SHORT'),
      trustScore: 0.8,
    });
    expect(r.coreDirection).toBe('SHORT');
    expect(Object.keys(r)).not.toContain('direction');
    expect(Object.keys(r)).not.toContain('signal');
  });
});
