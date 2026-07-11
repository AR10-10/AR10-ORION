// council.ts — V-MAX Fase 1 item 4: Conselho Multi-Agente.
//
// Seis agentes nomeados (Liquidity, Structure, Orderflow, Risk,
// Manipulation, Fibonacci), cada um uma FUNÇÃO PURA que vota LONG/SHORT/
// NEUTRAL a partir do dado real do seu domínio — ou ABSTAIN honesto quando
// o dado real não existe ainda (Fail-Closed: nenhum agente jamais fabrica
// um voto). Cada voto carrega rationale + evidence: o "debate" auditável
// que o Blueprint pede, citando os números reais que sustentam a postura.
//
// META-AGENT (zero repetição, auditado antes de construir): a AGREGAÇÃO
// não reimplementa matemática de comitê — delega ao linear opinion pool
// REAL já em produção e testado desde a Fase F (src/consensus/
// ensemble-engine.js, Stone 1961/DeGroot 1974). O que este módulo
// acrescenta é o que NÃO existia: os seis agentes de domínio com
// abstenção, o quórum, o gate de risco fail-closed e o contrato
// versionado. O Comitê da Fase F (opiniões GMIL/estrutura/regime) continua
// intocado — mesmo algoritmo, conselho diferente, membros diferentes.
//
// CRUZAMENTO TRANSVERSAL VIA WASM: o FibonacciAgent vota a partir da
// Matriz de Confluência da Fase 1.4, cujas fontes já incluem POC/HVN
// computados pelo WASM Quant Core (volume_profile) — o cruzamento
// transversal pedido pela diretriz acontece nos DADOS (a matriz), sem
// empurrar lógica de votação O(6) para dentro do binário Rust: a diretriz
// exige "WASM leve", e votação trivial em Rust seria peso sem ganho.
//
// HIERARQUIA INVIOLÁVEL (LEI 24, mesma regra do Comitê da Fase F): o
// Conselho NUNCA gera, altera ou bloqueia o LONG/SHORT/WAIT do Core
// Engine — é camada de análise/exibição, read-only por construção.
import { buildEnsembleConsensus, opinionFromVote } from "../../../src/consensus/index.js";
import type { FibonacciConfluenceMatrix } from "./fibonacci-confluence";

// Contrato versionado (diretriz: "tipagem estrita, contratos versionados").
// Qualquer mudança de forma incrementa a versão — consumidores checam.
export const COUNCIL_CONTRACT_VERSION = 1 as const;

export type CouncilAgentId =
  | "LIQUIDITY"
  | "STRUCTURE"
  | "ORDERFLOW"
  | "RISK"
  | "MANIPULATION"
  | "FIBONACCI";

export type CouncilStance = "LONG" | "SHORT" | "NEUTRAL" | "ABSTAIN";

export interface CouncilVote {
  agent: CouncilAgentId;
  stance: CouncilStance;
  // 0..1 real, derivada do desequilíbrio do dado do próprio agente;
  // null quando ABSTAIN (sem dado não existe confiança a reportar).
  confidence: number | null;
  rationale: string; // o "debate": por que este agente votou assim
  evidence: string[]; // números/fatos reais citados
}

export interface CouncilDecision {
  contractVersion: typeof COUNCIL_CONTRACT_VERSION;
  stance: CouncilStance; // ABSTAIN = conselho sem base real (quórum 0 ou gate de risco)
  // Desequilíbrio direcional real do pool (0 = dividido, 1 = unânime) —
  // NÃO é probabilidade de acerto (mesma honestidade da Fase F). null
  // quando o conselho absteve.
  agreement: number | null;
  quorum: number; // votos não-ABSTAIN entre os agentes direcionais
  riskGated: boolean; // true = RiskAgent absteve por dado degradado e travou o conselho
  votes: CouncilVote[]; // sempre os 6, na ordem fixa — o debate completo
  computedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Formas de entrada (estruturais e mínimas — nunca importam engine-bridge
// para não criar ciclo; App.tsx já tem todos estes dados reais).
// ─────────────────────────────────────────────────────────────────────────
export interface CouncilLiquidityZone {
  type: "EQUAL_HIGH" | "EQUAL_LOW";
  price: number;
  swept: boolean;
}

export interface CouncilOrderflowSignal {
  type: string; // 'OFI' | 'ABSORPTION' | 'EXHAUSTION'
  metadata?: Record<string, unknown>;
}

export interface CouncilInputs {
  price: number | null;
  liquidityZones: CouncilLiquidityZone[];
  structure15: string | null; // ALTA | BAIXA | LATERAL | null (rótulo real do motor)
  structure1h: string | null;
  cvd: number | null;
  orderflowSignals: CouncilOrderflowSignal[];
  offline: boolean;
  isDataFresh: boolean;
  engineStatus: "pending" | "ok" | "error";
  fibonacci: FibonacciConfluenceMatrix | null;
}

const abstain = (agent: CouncilAgentId, rationale: string): CouncilVote => ({
  agent, stance: "ABSTAIN", confidence: null, rationale, evidence: [],
});

/** Desequilíbrio real entre dois lados como confiança 0..1. */
function imbalanceConfidence(a: number, b: number): number {
  const total = a + b;
  return total > 0 ? Math.abs(a - b) / total : 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Agentes
// ─────────────────────────────────────────────────────────────────────────

/** LiquidityAgent — "draw on liquidity" real: pools de liquidez NÃO
 *  varridos (EQH acima do preço = liquidez compradora acima; EQL abaixo =
 *  vendedora abaixo). O preço tende a ser atraído para o lado com mais
 *  pools intactos — leitura SMC clássica sobre as zonas reais do motor. */
export function liquidityAgentVote(zones: CouncilLiquidityZone[], price: number | null): CouncilVote {
  if (price === null || !Number.isFinite(price)) {
    return abstain("LIQUIDITY", "sem preço real de referência ainda — impossível situar os pools");
  }
  const eqhAbove = zones.filter((z) => z.type === "EQUAL_HIGH" && !z.swept && z.price > price).length;
  const eqlBelow = zones.filter((z) => z.type === "EQUAL_LOW" && !z.swept && z.price < price).length;
  if (eqhAbove === 0 && eqlBelow === 0) {
    return abstain("LIQUIDITY", "nenhum pool de liquidez real (EQH/EQL não varrido) mapeado nesta janela");
  }
  const evidence = [`EQH intactos acima: ${eqhAbove}`, `EQL intactos abaixo: ${eqlBelow}`];
  if (eqhAbove === eqlBelow) {
    return { agent: "LIQUIDITY", stance: "NEUTRAL", confidence: 0, rationale: "pools equilibrados dos dois lados — sem atração dominante", evidence };
  }
  const stance: CouncilStance = eqhAbove > eqlBelow ? "LONG" : "SHORT";
  return {
    agent: "LIQUIDITY",
    stance,
    confidence: imbalanceConfidence(eqhAbove, eqlBelow),
    rationale: stance === "LONG"
      ? "mais liquidez intacta ACIMA do preço — atração para cima (draw on liquidity)"
      : "mais liquidez intacta ABAIXO do preço — atração para baixo (draw on liquidity)",
    evidence,
  };
}

/** StructureAgent — rótulos reais de estrutura do motor (15m + 1H).
 *  Confiança = desequilíbrio direcional entre as leituras disponíveis. */
export function structureAgentVote(structure15: string | null, structure1h: string | null): CouncilVote {
  const reads: Array<{ tf: string; label: string }> = [];
  if (structure15) reads.push({ tf: "15m", label: structure15 });
  if (structure1h) reads.push({ tf: "1H", label: structure1h });
  if (reads.length === 0) {
    return abstain("STRUCTURE", "nenhum rótulo real de estrutura disponível ainda (motor sem ciclo ok)");
  }
  const longs = reads.filter((r) => r.label === "ALTA").length;
  const shorts = reads.filter((r) => r.label === "BAIXA").length;
  const evidence = reads.map((r) => `estrutura ${r.tf}: ${r.label}`);
  const net = longs - shorts;
  const stance: CouncilStance = net > 0 ? "LONG" : net < 0 ? "SHORT" : "NEUTRAL";
  return {
    agent: "STRUCTURE",
    stance,
    confidence: Math.abs(net) / reads.length,
    rationale: stance === "NEUTRAL"
      ? (longs === shorts && longs > 0 ? "timeframes reais em conflito direto — estrutura sem direção" : "estrutura lateral nas leituras reais disponíveis")
      : `estrutura real ${stance === "LONG" ? "de alta" : "de baixa"} nas leituras disponíveis`,
    evidence,
  };
}

/** OrderflowAgent — CVD real da sessão dá a direção; sinais OFI reais
 *  (metadata.imbalance assinado) corroboram: confiança = fração dos OFI
 *  recentes cujo desequilíbrio concorda com o sinal do CVD. Sem OFI na
 *  janela, confiança 0 honesta (direção nua sem corroboração). */
export function orderflowAgentVote(cvd: number | null, signals: CouncilOrderflowSignal[]): CouncilVote {
  if (cvd === null || !Number.isFinite(cvd)) {
    return abstain("ORDERFLOW", "CVD real ainda não disponível (nenhum lote de trades ingerido)");
  }
  if (cvd === 0) {
    return { agent: "ORDERFLOW", stance: "NEUTRAL", confidence: 0, rationale: "CVD da sessão exatamente zero — fluxo equilibrado", evidence: ["CVD 0"] };
  }
  const stance: CouncilStance = cvd > 0 ? "LONG" : "SHORT";
  const ofi = signals.filter((s) => s.type === "OFI" && Number.isFinite((s.metadata as any)?.imbalance));
  const agreeing = ofi.filter((s) => {
    const imb = (s.metadata as any).imbalance as number;
    return cvd > 0 ? imb > 0 : imb < 0;
  }).length;
  const confidence = ofi.length > 0 ? agreeing / ofi.length : 0;
  return {
    agent: "ORDERFLOW",
    stance,
    confidence,
    rationale: ofi.length > 0
      ? `CVD ${cvd > 0 ? "positivo" : "negativo"} com ${agreeing}/${ofi.length} sinais OFI reais concordando`
      : `CVD ${cvd > 0 ? "positivo" : "negativo"} sem sinais OFI na janela para corroborar (confiança 0 honesta)`,
    evidence: [`CVD ${cvd.toFixed(2)}`, ...(ofi.length > 0 ? [`OFI concordantes: ${agreeing}/${ofi.length}`] : [])],
  };
}

/** RiskAgent — não vota direção (função de um risk officer real: avaliar
 *  viabilidade, não escolher lado). Dado degradado (offline/stale/motor em
 *  erro) => ABSTAIN, e o Meta-Agent trava o conselho inteiro (gate
 *  fail-closed: nenhuma opinião de conselho sobre dado que não é confiável
 *  AGORA). Operação viável => NEUTRAL com confiança 1. */
export function riskAgentVote(input: { offline: boolean; isDataFresh: boolean; engineStatus: "pending" | "ok" | "error" }): CouncilVote {
  const failures: string[] = [];
  if (input.offline) failures.push("conexão offline (navigator.onLine real)");
  if (!input.isDataFresh) failures.push("dados não frescos (Health Monitor real)");
  if (input.engineStatus === "error") failures.push("motor em erro no último ciclo real");
  if (input.engineStatus === "pending") failures.push("motor ainda sem primeiro ciclo ok");
  if (failures.length > 0) {
    return { agent: "RISK", stance: "ABSTAIN", confidence: null, rationale: "condições operacionais degradadas — conselho travado (fail-closed)", evidence: failures };
  }
  return {
    agent: "RISK",
    stance: "NEUTRAL",
    confidence: 1,
    rationale: "operação viável (online, dados frescos, motor ok) — risco não vota direção",
    evidence: ["online", "dados frescos", "engineStatus ok"],
  };
}

/** ManipulationAgent — evidência real de manipulação: pools de liquidez
 *  VARRIDOS (swept real do motor SMC). EQH varrido = liquidez compradora
 *  tomada (stop hunt acima) => leitura baixista; EQL varrido => altista.
 *  Sem sweep real na janela, ABSTAIN — nunca "detecta" manipulação sem
 *  evento real. */
export function manipulationAgentVote(zones: CouncilLiquidityZone[]): CouncilVote {
  const sweptEqh = zones.filter((z) => z.type === "EQUAL_HIGH" && z.swept).length;
  const sweptEql = zones.filter((z) => z.type === "EQUAL_LOW" && z.swept).length;
  if (sweptEqh === 0 && sweptEql === 0) {
    return abstain("MANIPULATION", "nenhum sweep real de liquidez na janela — sem evidência de manipulação");
  }
  const evidence = [`EQH varridos: ${sweptEqh}`, `EQL varridos: ${sweptEql}`];
  if (sweptEqh === sweptEql) {
    return { agent: "MANIPULATION", stance: "NEUTRAL", confidence: 0, rationale: "sweeps reais dos dois lados em igual número — manipulação sem direção líquida", evidence };
  }
  const stance: CouncilStance = sweptEqh > sweptEql ? "SHORT" : "LONG";
  return {
    agent: "MANIPULATION",
    stance,
    confidence: imbalanceConfidence(sweptEqh, sweptEql),
    rationale: stance === "SHORT"
      ? "liquidez compradora acima foi tomada (sweep de EQH) — padrão real de stop hunt altista esgotado"
      : "liquidez vendedora abaixo foi tomada (sweep de EQL) — padrão real de stop hunt baixista esgotado",
    evidence,
  };
}

// 3+ fontes independentes confluindo no mesmo nível = confluência plena —
// parâmetro documentado (mesma natureza do percentil 90 do orderflow e da
// janela de 2% da matriz), nunca uma medição.
const FIB_FULL_CONFLUENCE_SOURCES = 3;

/** FibonacciAgent — vota a partir da Matriz de Confluência real (Fase
 *  1.4), cujas fontes já incluem POC/HVN computados pelo WASM Quant Core:
 *  este é o cruzamento transversal da diretriz. Retração confluente numa
 *  perna de alta = zona de continuação altista (leitura clássica);
 *  espelhado para perna de baixa. Sem matriz ou sem nenhuma confluência
 *  real => ABSTAIN. */
export function fibonacciAgentVote(matrix: FibonacciConfluenceMatrix | null): CouncilVote {
  if (!matrix) {
    return abstain("FIBONACCI", "sem perna real confirmada — matriz de confluência indisponível");
  }
  const best = matrix.levels.reduce((a, b) => (b.score > a.score ? b : a), matrix.levels[0]);
  if (!best || best.score < 1) {
    return abstain("FIBONACCI", "níveis de retração reais existem, mas nenhuma fonte independente conflui neles nesta janela");
  }
  const stance: CouncilStance = matrix.legIsUp ? "LONG" : "SHORT";
  return {
    agent: "FIBONACCI",
    stance,
    confidence: Math.min(1, best.score / FIB_FULL_CONFLUENCE_SOURCES),
    rationale: `retração ${(best.ratio * 100).toFixed(1)}% da perna ${matrix.legIsUp ? "de alta" : "de baixa"} com ${best.score} fonte(s) real(is) confluente(s) — zona de continuação`,
    evidence: [
      `nível ${(best.ratio * 100).toFixed(1)}% @ ${best.price.toFixed(2)}`,
      ...best.matches.map((m) => m.kind),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Meta-Agent
// ─────────────────────────────────────────────────────────────────────────

const POOL_DIRECTION_TO_STANCE: Record<string, CouncilStance> = {
  ALTA: "LONG",
  BAIXA: "SHORT",
  NEUTRO: "NEUTRAL",
};

/** Agrega os votos: gate de risco primeiro (fail-closed), depois quórum,
 *  depois o linear opinion pool REAL da Fase F sobre os votos direcionais
 *  (opinionFromVote: postura+confiança => distribuição; massa desconhecida
 *  vira NEUTRO, conservador). O debate completo (votes) sai sempre. */
export function aggregateCouncil(votes: CouncilVote[], computedAt: number): CouncilDecision {
  const risk = votes.find((v) => v.agent === "RISK");
  const riskGated = risk?.stance === "ABSTAIN";
  const directional = votes.filter((v) => v.agent !== "RISK" && v.stance !== "ABSTAIN");
  const quorum = directional.length;

  if (riskGated || quorum === 0) {
    return {
      contractVersion: COUNCIL_CONTRACT_VERSION,
      stance: "ABSTAIN",
      agreement: null,
      quorum,
      riskGated,
      votes,
      computedAt,
    };
  }

  const pool = buildEnsembleConsensus({
    members: directional.map((v) => ({
      id: `council_${v.agent.toLowerCase()}`,
      familia: null, // agentes do conselho não pertencem às famílias da matriz de regime — peso 1 real, sem modulação
      opiniao: opinionFromVote(v.stance, v.confidence ?? 0),
    })),
  });

  if (pool.status !== "OK") {
    return {
      contractVersion: COUNCIL_CONTRACT_VERSION,
      stance: "ABSTAIN",
      agreement: null,
      quorum,
      riskGated: false,
      votes,
      computedAt,
    };
  }

  return {
    contractVersion: COUNCIL_CONTRACT_VERSION,
    stance: POOL_DIRECTION_TO_STANCE[pool.direcao as string] ?? "NEUTRAL",
    agreement: pool.forca as number,
    quorum,
    riskGated: false,
    votes,
    computedAt,
  };
}

/** Conveniência: os 6 agentes + Meta-Agent numa chamada, ordem fixa. */
export function buildCouncilDecision(inputs: CouncilInputs, computedAt: number = Date.now()): CouncilDecision {
  const votes: CouncilVote[] = [
    liquidityAgentVote(inputs.liquidityZones, inputs.price),
    structureAgentVote(inputs.structure15, inputs.structure1h),
    orderflowAgentVote(inputs.cvd, inputs.orderflowSignals),
    riskAgentVote({ offline: inputs.offline, isDataFresh: inputs.isDataFresh, engineStatus: inputs.engineStatus }),
    manipulationAgentVote(inputs.liquidityZones),
    fibonacciAgentVote(inputs.fibonacci),
  ];
  return aggregateCouncil(votes, computedAt);
}
