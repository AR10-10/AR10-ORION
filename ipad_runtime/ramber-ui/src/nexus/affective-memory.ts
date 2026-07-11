// affective-memory.ts — V-MAX Fase 1 item 5: fundação da Memória Afetiva
// (Reward/Pain com decaimento exponencial) + CPI (Cognitive Performance
// Index).
//
// HONESTIDADE DE ESCOPO (Regra de Ouro 1): este sistema é READ_ONLY por
// projeto — não existem posições nem PnL reais para medir "dor" de
// trading. Os eventos afetivos reais que EXISTEM nesta árvore são
// operacionais/cognitivos: ciclos reais do motor (ok/erro), quedas e
// retornos reais de feed (WS de preço, poller de order flow), transições
// reais de freshness (Health Monitor). O CPI v1 mede portanto a
// performance COGNITIVA do organismo — quão bem ele está percebendo o
// mercado — nunca uma performance de trading fabricada. Quando existir
// execução real (fase futura, travada), a mesma fundação recebe esses
// eventos sem mudança de contrato.
//
// DECAIMENTO EXPONENCIAL, APLICADO NA INGESTÃO (lazy): reward e pain
// decaem com meia-vida documentada. Propriedade matemática real que
// dispensa qualquer tick periódico: sob decaimento IGUAL, a razão
// reward/(reward+pain) é INVARIANTE — o CPI só muda quando um evento novo
// chega, e o decaimento faz exatamente o que a memória afetiva pede:
// eventos RECENTES pesam mais que os antigos no momento em que um novo
// evento é somado. Zero trabalho ocioso na main thread ("Main Thread
// absolutamente inviolada").
export const AFFECTIVE_CONTRACT_VERSION = 1 as const;

// Meia-vida da memória: 10 minutos — um incidente isolado para de dominar
// o índice depois de ~3-4 meias-vidas de operação saudável (30-40 min),
// rápido o bastante para o orb refletir recuperação real, lento o
// bastante para dor real não sumir num piscar. Parâmetro documentado
// (mesma natureza do percentil 90/janela de 2%), não uma medição.
export const AFFECTIVE_HALF_LIFE_MS = 10 * 60_000;

export type AffectiveEventSource =
  | "ENGINE_CYCLE_OK"
  | "ENGINE_CYCLE_ERROR"
  | "FEED_WS_UP"
  | "FEED_WS_DOWN"
  | "ORDERFLOW_FEED_ERROR"
  | "DATA_STALE"
  | "DATA_FRESH_AGAIN";

export type AffectiveKind = "REWARD" | "PAIN";

// Pesos por fonte: ORDENAÇÃO de severidade documentada (erro de motor >
// queda de WS > staleness > erro do poller; recuperações recompensam menos
// do que a falha doeu — recuperar não apaga o incidente, só o decaimento
// apaga). Os valores são parâmetros de julgamento documentados, nunca
// medições — o que é medido de verdade são os EVENTOS.
export const AFFECTIVE_EVENT_WEIGHTS: Record<AffectiveEventSource, { kind: AffectiveKind; weight: number }> = {
  ENGINE_CYCLE_OK: { kind: "REWARD", weight: 0.1 },
  ENGINE_CYCLE_ERROR: { kind: "PAIN", weight: 0.6 },
  FEED_WS_UP: { kind: "REWARD", weight: 0.25 },
  FEED_WS_DOWN: { kind: "PAIN", weight: 0.5 },
  ORDERFLOW_FEED_ERROR: { kind: "PAIN", weight: 0.35 },
  DATA_STALE: { kind: "PAIN", weight: 0.45 },
  DATA_FRESH_AGAIN: { kind: "REWARD", weight: 0.2 },
};

export interface AffectiveMemoryState {
  contractVersion: typeof AFFECTIVE_CONTRACT_VERSION;
  reward: number; // acumulador decaído
  pain: number; // acumulador decaído
  lastEventAt: number | null; // ms real do último evento ingerido
  eventCount: number; // eventos reais desde o boot da sessão
}

export const EMPTY_AFFECTIVE_STATE: AffectiveMemoryState = Object.freeze({
  contractVersion: AFFECTIVE_CONTRACT_VERSION,
  reward: 0,
  pain: 0,
  lastEventAt: null,
  eventCount: 0,
});

/** Fator real de decaimento exponencial para um intervalo dt. */
function decayFactor(dtMs: number): number {
  if (!(dtMs > 0)) return 1;
  return Math.pow(0.5, dtMs / AFFECTIVE_HALF_LIFE_MS);
}

/** Ingestão pura: decai os acumuladores até `at` e soma o peso do evento
 *  no acumulador do tipo. `at` anterior ao último evento (relógio andou
 *  para trás) não decai (fator 1) — nunca amplifica retroativamente. */
export function ingestAffectiveEvent(
  state: AffectiveMemoryState,
  source: AffectiveEventSource,
  at: number,
): AffectiveMemoryState {
  const spec = AFFECTIVE_EVENT_WEIGHTS[source];
  const dt = state.lastEventAt === null ? 0 : at - state.lastEventAt;
  const f = decayFactor(dt);
  const reward = state.reward * f + (spec.kind === "REWARD" ? spec.weight : 0);
  const pain = state.pain * f + (spec.kind === "PAIN" ? spec.weight : 0);
  return {
    contractVersion: AFFECTIVE_CONTRACT_VERSION,
    reward,
    pain,
    lastEventAt: at,
    eventCount: state.eventCount + 1,
  };
}

/** CPI (Cognitive Performance Index): fração 0..1 da massa afetiva que é
 *  reward. null honesto antes de QUALQUER evento real — nunca um índice
 *  de exemplo. 1.0 = só reward na memória; 0.0 = só pain. */
export function computeCpi(state: AffectiveMemoryState): number | null {
  const total = state.reward + state.pain;
  if (state.eventCount === 0 || !(total > 0)) return null;
  return state.reward / total;
}
