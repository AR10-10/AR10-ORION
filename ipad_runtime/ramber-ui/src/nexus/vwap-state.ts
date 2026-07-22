// vwap-state.ts — Diretriz Mestra de Consolidação Final §22-§24: estados
// visuais da VWAP + distância contínua.
//
// A MATEMÁTICA da VWAP (nexus/vwap.ts) fica INTOCADA (§20 "não alterar sua
// matemática... não modificar seu núcleo") — este módulo só CLASSIFICA a
// relação entre o preço vivo e a VWAP já calculada, e mede a distância
// (§24: percentual, absoluta, lado). Contexto display-only: alimenta
// header/assistente/leitura — NUNCA decide operação (§25, LEI 24).
//
// Histerese de duas bandas (§22 "Nunca trocar de estado a cada candle"):
//   · ENTRA num estado direcional só quando o desvio passa da banda de
//     ENTRADA (0.30·ATR);
//   · só VOLTA a NEUTRAL quando o desvio recua aquém da banda de SAÍDA
//     (0.10·ATR) — entre as duas bandas o estado anterior é mantido
//     (sticky real, o mesmo princípio do inEntryZone do App).
// Banda proporcional ao ATR real quando disponível; fallback documentado
// em fração da própria referência (0.10% / 0.03%) enquanto o ATR não tem
// leitura — nunca um estado fabricado sem dado (sem preço ou sem VWAP,
// o contexto inteiro é null, fail-closed).
export type DirectionalLineState = "BULLISH" | "BEARISH" | "NEUTRAL";

export const LINE_STATE_ENTER_ATR = 0.3; // banda de entrada: 0.30 × ATR absoluto
export const LINE_STATE_EXIT_ATR = 0.1; // banda de saída: 0.10 × ATR absoluto
export const LINE_STATE_ENTER_PCT_FALLBACK = 0.001; // 0.10% da referência, sem ATR
export const LINE_STATE_EXIT_PCT_FALLBACK = 0.0003; // 0.03% da referência, sem ATR

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Máquina de estado pura e compartilhada (VWAP §22 e Nexus Line §29 usam a
 *  MESMA histerese — nunca duas implementações). `prev` é o estado da
 *  leitura anterior; entradas inválidas devolvem NEUTRAL (sem leitura
 *  direcional real, nunca um lado inventado). */
export function directionalStateWithHysteresis(
  prev: DirectionalLineState,
  price: number,
  reference: number,
  atrAbs: number | null,
): DirectionalLineState {
  if (!fin(price) || !fin(reference) || reference <= 0) return "NEUTRAL";
  const atrOk = atrAbs !== null && fin(atrAbs) && atrAbs > 0;
  const enter = atrOk ? LINE_STATE_ENTER_ATR * atrAbs : LINE_STATE_ENTER_PCT_FALLBACK * reference;
  const exit = atrOk ? LINE_STATE_EXIT_ATR * atrAbs : LINE_STATE_EXIT_PCT_FALLBACK * reference;
  const d = price - reference;
  if (d >= enter) return "BULLISH";
  if (d <= -enter) return "BEARISH";
  if (prev === "BULLISH" && d > exit) return "BULLISH";
  if (prev === "BEARISH" && d < -exit) return "BEARISH";
  return "NEUTRAL";
}

export interface VwapContext {
  state: DirectionalLineState;
  // Diretriz de Continuidade §5: o cartão do header exibe o próprio VALOR
  // real da VWAP — carregado aqui para o consumidor nunca precisar de uma
  // segunda leitura/derivação (Single Source of Truth).
  vwap: number;
  distanceAbs: number; // preço − VWAP, com sinal (moeda de cotação)
  distancePct: number; // (preço − VWAP)/VWAP × 100, com sinal
  side: "ACIMA" | "ABAIXO" | "NA_LINHA";
}

/** §23/§24: contexto completo Preço × VWAP para header/painéis. null quando
 *  não existe preço ou VWAP reais (fail-closed — o cartão mostra o dash,
 *  nunca um zero fabricado). */
export function computeVwapContext(
  prevState: DirectionalLineState,
  price: number | null,
  vwap: number | null,
  atrAbs: number | null,
): VwapContext | null {
  if (!fin(price) || !fin(vwap) || vwap <= 0) return null;
  const distanceAbs = price - vwap;
  // multiplica antes de dividir — mesma lição de FP do premium-discount.ts
  const distancePct = (distanceAbs * 100) / vwap;
  return {
    state: directionalStateWithHysteresis(prevState, price, vwap, atrAbs),
    vwap,
    distanceAbs,
    distancePct,
    side: distanceAbs > 0 ? "ACIMA" : distanceAbs < 0 ? "ABAIXO" : "NA_LINHA",
  };
}
