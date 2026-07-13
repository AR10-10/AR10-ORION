// confluence-engine.ts — AR10 CYBORG Phase Ω Priority 2 ("Probability
// Engine" no pedido original do Operador — entregue honestamente como
// Confluence/Conviction Engine: NUNCA uma probabilidade calibrada, mesma
// razão já documentada em ensemble-engine.js/council.ts/scenario-engine.ts —
// este repositório não tem histórico de acerto real (backtest) que sustente
// essa afirmação).
//
// AUDITORIA ANTES DE CONSTRUIR (achado real, vale registrar mesmo não sendo
// o foco direto do pedido — CLAUDE.md, Disciplina de trabalho item 1): o
// sistema já roda TRÊS pools de opinião reais e independentes, cada um já
// testado e em produção, que NUNCA se cruzam entre si:
//   1. ensembleConsensus (Fase F, useMemo em App.tsx) — Lorentzian k-NN +
//      Estrutura 15m/1H + CVD + contexto GMIL.
//   2. council (V-MAX Fase 1) — 7 agentes de domínio (Liquidez/Estrutura/
//      Orderflow/Risco/Manipulação/Fibonacci/Momentum).
//   3. multiTimeframeContext (Phase Ω Priority 1) — 6 prazos independentes
//      (1m/5m/15m/1h/4h/1d).
// Hoje o Operador só consegue cruzar isso manualmente entre 3 widgets
// separados. Este motor NÃO inventa uma quarta forma de medir confiança —
// ele reaplica o MESMO linear opinion pool (buildEnsembleConsensus, Stone
// 1961/DeGroot 1974) um nível acima: cada um dos 3 pools vira UM membro
// (uma opinião degenerada "concorda"/"discorda" com a direção real que o
// Core Engine já emitiu), exatamente como cada timeframe da Matriz já é uma
// opinião de um membro dentro de multi-timeframe-engine.ts. Zero segunda
// matemática de consenso.
//
// Por que 3 membros e não 8 (um voto por timeframe + Comitê + Ensemble):
// dar um voto a cada um dos 6 prazos ao lado de 1 voto do Comitê e 1 do
// Ensemble deixaria a Matriz dominar a votação 6-contra-2 só por ter mais
// linhas — o mesmo problema que a matriz de pesos por família (Fase D) já
// resolve para o pool original. A Matriz entra como UM voto (a fração real
// dos prazos com leitura real que concordam com o Core Engine), no mesmo pé
// que Ensemble e Comitê.
//
// TrustScore (Fase 2, WASM) nunca vota direção — só amortece a força final,
// o mesmo padrão já usado por dataQualityWeight em buildEnsembleConsensus
// (dado pouco confiável enfraquece a leitura, nunca inverte a direção).
//
// HIERARQUIA INVIOLÁVEL (LEI 24, mesma regra do Comitê/Cenários/Matriz):
// esta leitura NUNCA altera engine.direction — ela responde só "quantos dos
// próprios subsistemas independentes concordam com o que o Core Engine JÁ
// decidiu?", puro contexto exibido, nunca um segundo motor de decisão.
import { buildEnsembleConsensus, opinionFromVote } from '../../../src/consensus/index.js';
import type { CouncilDecision } from './council';
import type { MultiTimeframeMatrix } from './multi-timeframe-engine';

export type CoreActiveDirection = 'LONG' | 'SHORT';

export type ConfluenceMemberId = 'ENSEMBLE' | 'COUNCIL' | 'MULTI_TIMEFRAME';

export interface ConfluenceMemberReading {
  id: ConfluenceMemberId;
  // null = subsistema sem leitura real disponível nesta janela (nunca um
  // voto fabricado). true/false = concorda/discorda da direção real do
  // Core Engine.
  agreesWithCore: boolean | null;
  // Força real do PRÓPRIO subsistema (0..1) — nunca fabricada quando
  // agreesWithCore é null.
  strength: number | null;
  detail: string;
}

export type ConvictionVerdict = 'CONFIRMS' | 'CONTRADICTS' | 'MIXED';

export interface ConvictionReading {
  status: 'OK' | 'DADOS_INSUFICIENTES';
  reason: string | null;
  coreDirection: CoreActiveDirection | null;
  // Fração real de massa de opinião ALINHADA com o Core Engine entre os
  // subsistemas legíveis (0 = todos discordam, 1 = todos concordam
  // integralmente) — NUNCA probabilidade de acerto de mercado.
  conviction: number | null;
  // Mesma leitura amortecida pelo TrustScore real (Fase 2) — null quando
  // TrustScore ainda não foi medido, nunca 0 fabricado.
  convictionAdjusted: number | null;
  verdict: ConvictionVerdict | null;
  agreeingCount: number;
  totalReadable: number;
  members: ConfluenceMemberReading[];
  computedAt: number;
}

function insufficient(
  reason: string,
  coreDirection: CoreActiveDirection | null,
  members: ConfluenceMemberReading[],
  computedAt: number,
): ConvictionReading {
  return {
    status: 'DADOS_INSUFICIENTES',
    reason,
    coreDirection,
    conviction: null,
    convictionAdjusted: null,
    verdict: null,
    agreeingCount: 0,
    totalReadable: 0,
    members,
    computedAt,
  };
}

/** Massa real de opinião do Ensemble Consensus (Fase F) sobre a direção
 *  ativa real do Core Engine. */
function readEnsembleMember(
  ensembleConsensus: { status: string; direcao: string; forca: number } | null,
  coreDirection: CoreActiveDirection,
): ConfluenceMemberReading {
  if (!ensembleConsensus || ensembleConsensus.status !== 'OK') {
    return { id: 'ENSEMBLE', agreesWithCore: null, strength: null, detail: 'sem leitura real do Ensemble Consensus nesta janela' };
  }
  const dir = ensembleConsensus.direcao === 'ALTA' ? 'LONG' : ensembleConsensus.direcao === 'BAIXA' ? 'SHORT' : null;
  if (dir === null) {
    return { id: 'ENSEMBLE', agreesWithCore: null, strength: null, detail: 'Ensemble Consensus real, mas dividido (NEUTRO) — sem direção para comparar' };
  }
  return {
    id: 'ENSEMBLE',
    agreesWithCore: dir === coreDirection,
    strength: ensembleConsensus.forca,
    detail: `Ensemble real: ${ensembleConsensus.direcao} · força ${(ensembleConsensus.forca * 100).toFixed(0)}%`,
  };
}

/** Massa real de opinião do Comitê (7 agentes) sobre a direção ativa real
 *  do Core Engine. */
function readCouncilMember(council: CouncilDecision | null, coreDirection: CoreActiveDirection): ConfluenceMemberReading {
  if (!council || council.stance === 'ABSTAIN' || council.agreement === null) {
    return { id: 'COUNCIL', agreesWithCore: null, strength: null, detail: 'Comitê absteve (gate de risco ou quórum 0) — sem leitura real' };
  }
  if (council.stance !== 'LONG' && council.stance !== 'SHORT') {
    return { id: 'COUNCIL', agreesWithCore: null, strength: null, detail: 'Comitê real, mas dividido (NEUTRAL) — sem direção para comparar' };
  }
  return {
    id: 'COUNCIL',
    agreesWithCore: council.stance === coreDirection,
    strength: council.agreement,
    detail: `Comitê real: ${council.stance} · agreement ${(council.agreement * 100).toFixed(0)}% (quórum ${council.quorum})`,
  };
}

/** Fração real dos prazos da Matriz (Phase Ω P1) com leitura real que
 *  concordam com a direção ativa do Core Engine — UM voto (não 6, ver
 *  racional no cabeçalho do arquivo). */
function readMultiTimeframeMember(
  matrix: MultiTimeframeMatrix | null,
  coreDirection: CoreActiveDirection,
): ConfluenceMemberReading {
  if (!matrix) {
    return { id: 'MULTI_TIMEFRAME', agreesWithCore: null, strength: null, detail: 'Matriz Multi-Timeframe ainda sem primeiro ciclo real' };
  }
  const readings = Object.values(matrix).filter((tf) => tf.status === 'OK' && tf.confidenceStance !== null);
  if (readings.length === 0) {
    return { id: 'MULTI_TIMEFRAME', agreesWithCore: null, strength: null, detail: 'nenhum prazo real com confidence disponível nesta janela' };
  }
  const agreeing = readings.filter((tf) => tf.confidenceStance === coreDirection).length;
  return {
    id: 'MULTI_TIMEFRAME',
    agreesWithCore: agreeing > readings.length / 2,
    strength: agreeing / readings.length,
    detail: `${agreeing}/${readings.length} prazos reais concordam com ${coreDirection}`,
  };
}

/** Motor de Confluência Cruzada — reaplica o pool linear real (Stone/
 *  DeGroot) sobre os 3 subsistemas independentes já reais no sistema.
 *  FAIL_CLOSED: sem direção ativa do Core Engine (WAIT) => DADOS_
 *  INSUFICIENTES honesto — não há "concordância" a medir sem uma direção
 *  real para comparar. */
export function buildConvictionReading(input: {
  coreDirection: 'LONG' | 'SHORT' | 'WAIT' | null;
  ensembleConsensus: { status: string; direcao: string; forca: number } | null;
  council: CouncilDecision | null;
  multiTimeframe: MultiTimeframeMatrix | null;
  trustScore: number | null;
}): ConvictionReading {
  const computedAt = Date.now();
  const coreDirection: CoreActiveDirection | null =
    input.coreDirection === 'LONG' || input.coreDirection === 'SHORT' ? input.coreDirection : null;

  if (coreDirection === null) {
    return insufficient('core_engine_sem_direcao_ativa_no_momento_(WAIT)', null, [], computedAt);
  }

  const members: ConfluenceMemberReading[] = [
    readEnsembleMember(input.ensembleConsensus, coreDirection),
    readCouncilMember(input.council, coreDirection),
    readMultiTimeframeMember(input.multiTimeframe, coreDirection),
  ];

  const readable = members.filter((m) => m.agreesWithCore !== null && m.strength !== null);
  if (readable.length === 0) {
    return insufficient('nenhum_subsistema_com_leitura_real_nesta_janela', coreDirection, members, computedAt);
  }

  // Cada subsistema legível vira uma opinião degenerada real: "ALTA" =
  // concorda com o Core Engine, "BAIXA" = discorda — ponderada pela força
  // REAL daquele subsistema (um subsistema fraco/dividido pesa menos, nunca
  // é excluído só por isso). Zero segunda matemática de consenso.
  const pool = buildEnsembleConsensus({
    members: readable.map((m) => ({
      id: m.id,
      familia: null,
      opiniao: opinionFromVote(m.agreesWithCore ? 'ALTA' : 'BAIXA', m.strength as number),
    })),
    dataQualityWeight: input.trustScore,
  }) as any;

  const agreeingCount = readable.filter((m) => m.agreesWithCore).length;

  if (pool.status !== 'OK') {
    return insufficient('pool_sem_leitura_real', coreDirection, members, computedAt);
  }

  const verdict: ConvictionVerdict = pool.direcao === 'ALTA' ? 'CONFIRMS' : pool.direcao === 'BAIXA' ? 'CONTRADICTS' : 'MIXED';

  return {
    status: 'OK',
    reason: null,
    coreDirection,
    conviction: pool.forca as number,
    convictionAdjusted: pool.forca_ajustada as number | null,
    verdict,
    agreeingCount,
    totalReadable: readable.length,
    members,
    computedAt,
  };
}
