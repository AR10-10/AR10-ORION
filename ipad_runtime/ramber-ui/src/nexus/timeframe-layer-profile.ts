// timeframe-layer-profile.ts — QUAIS ferramentas fazem sentido em CADA
// tempo gráfico.
//
// PEDIDO DO OPERADOR: "o que é necessário pra operar em cada tempo gráfico
// perfeitamente, pra não ter dúvida de decisão... o gráfico não ficar
// poluído com o que não é necessário".
//
// DEFEITO REAL: o modo automático não tinha NENHUMA consciência de
// timeframe. `AUTO_LAYER_PRECISION_ORDER` e o teto de simultaneidade eram
// os MESMOS em 1m e em 1W — então um gráfico semanal disputava espaço com
// camadas de fluxo de curtíssimo prazo, e um gráfico de 1m com camadas de
// estrutura macro. `grep -n "timeframe" layer-relevance.ts` voltou zero.
//
// O CRITÉRIO NÃO É GOSTO — É COBERTURA REAL DE DADO. Cada regra abaixo tem
// uma razão verificável no próprio repositório:
//
//   ORDER FLOW (cvd, order_flow_heatmap, liquidation_heatmap,
//   order_book_depth) — o histórico real retido cobre ~8 minutos
//   (ORDERFLOW_HISTORY_CAPACITY em nexus/orderflow-history.ts). Isso é
//   várias velas em 1m, menos de UMA vela em 15m, e nada em 4H+. A mesma
//   limitação já está documentada em nexus/multi-timeframe-engine.ts, com
//   estas palavras: "não existe dado real retido para calcular Order Flow
//   honesto em 1H/4H/1D". Não é opinião sobre utilidade: é ausência de
//   dado.
//
//   VWAP — ancorada ao DIA UTC (nexus/vwap.ts: "Session-anchored to the UTC
//   calendar day"). Num gráfico de 1D cada vela JÁ É um dia inteiro, então
//   a VWAP tem no máximo um ponto por vela e deixa de dizer qualquer coisa
//   sobre onde o preço está dentro da sessão. Em 1W é pior ainda.
//
//   SESSÕES / KILL ZONES — partições de HORAS dentro do dia. Numa vela
//   diária a sessão inteira está dentro de uma vela só: a marcação não tem
//   onde existir.
//
// REGRA DE OURO 4 — NADA É REMOVIDO. `unfit` não apaga camada nenhuma: ela
// só vai para o FIM da ordem de precisão, e o Operador pode fixá-la à mão a
// qualquer momento (o override manual nunca passa pelo teto automático).
// Isto reordena a competição por espaço; não decide o que existe.

/** Ajuste de uma camada a um horizonte. */
export type LayerHorizonFit = "core" | "context" | "unfit";

/** Duração de uma vela, em minutos, por timeframe real do gráfico. */
const TIMEFRAME_MINUTES: Record<string, number> = {
  "1m": 1, "3m": 3, "5m": 5, "15m": 15, "30m": 30,
  "1h": 60, "2h": 120, "4h": 240, "6h": 360, "8h": 480, "12h": 720,
  "1d": 1440, "1w": 10080, "1M": 43200,
};

/** ~8 minutos reais de CVD/fluxo retido (ORDERFLOW_HISTORY_CAPACITY = 120
 *  a ~4s por ciclo). É o teto de honestidade das camadas de fluxo. */
export const ORDER_FLOW_COVERAGE_MINUTES = 8;

/** Camadas cuja leitura vem da janela curta de fluxo real. */
const ORDER_FLOW_LAYERS = new Set([
  "cvd",
  "order_flow_heatmap",
  "liquidation_heatmap",
  "order_book_depth",
]);

/** Camadas ancoradas ao DIA (ou a partições dele). */
const INTRADAY_ANCHORED_LAYERS = new Set([
  "vwap",
  "market_sessions",
  "kill_zones",
  "session_key_levels",
  "tpo_profile",
]);

export function timeframeMinutes(timeframe: string | null | undefined): number | null {
  if (typeof timeframe !== "string") return null;
  const m = TIMEFRAME_MINUTES[timeframe.toLowerCase()] ?? TIMEFRAME_MINUTES[timeframe];
  return typeof m === "number" && Number.isFinite(m) ? m : null;
}

/**
 * Ajuste de uma camada ao timeframe atual.
 *
 * Fail-closed: timeframe desconhecido devolve "core" para TODAS as camadas
 * — sem saber o horizonte, este módulo não reordena nada, e o
 * comportamento fica idêntico ao de antes dele existir.
 */
export function layerHorizonFit(layerId: string, timeframe: string | null | undefined): LayerHorizonFit {
  const min = timeframeMinutes(timeframe);
  if (min === null) return "core";

  if (ORDER_FLOW_LAYERS.has(layerId)) {
    // A vela cabe inteira dentro da janela retida: o fluxo descreve a vela.
    if (min <= ORDER_FLOW_COVERAGE_MINUTES) return "core";
    // A janela ainda cobre um pedaço reconhecível da vela atual.
    if (min <= 60) return "context";
    // Acima disso o dado retido não cobre nem a vela em formação.
    return "unfit";
  }

  if (INTRADAY_ANCHORED_LAYERS.has(layerId)) {
    // Uma vela diária ou maior CONTÉM o dia inteiro: a âncora de sessão
    // deixa de ter onde existir dentro do gráfico.
    if (min >= TIMEFRAME_MINUTES["1d"]) return "unfit";
    // Numa vela de 4h a sessão ainda é uma partição visível do gráfico,
    // mas já não é o que decide a leitura.
    if (min >= 240) return "context";
    return "core";
  }

  // Estrutura (S/R, FVG/OB, BOS/CHOCH, Fibonacci, zonas institucionais,
  // plano ativo…) é escalável por definição: o mesmo conceito vale em
  // qualquer horizonte.
  return "core";
}

const PESO: Record<LayerHorizonFit, number> = { core: 0, context: 1, unfit: 2 };

/**
 * A ordem de precisão declarada, REORDENADA pelo horizonte atual.
 *
 * Estável dentro de cada grupo: a ordem relativa original é preservada
 * (ordenação estável do JS sobre a chave de ajuste), então este módulo
 * nunca inventa uma hierarquia própria — ele só empurra para trás o que o
 * dado não sustenta neste horizonte.
 */
export function resolveTimeframePrecisionOrder(
  baseOrder: readonly string[],
  timeframe: string | null | undefined,
): string[] {
  if (!Array.isArray(baseOrder)) return [];
  if (timeframeMinutes(timeframe) === null) return [...baseOrder];
  return [...baseOrder].sort((a, b) => PESO[layerHorizonFit(a, timeframe)] - PESO[layerHorizonFit(b, timeframe)]);
}

/** Razão legível de uma camada ter sido empurrada para trás — para o painel
 *  poder DIZER o porquê em vez de a camada só sumir. */
export function horizonFitReason(layerId: string, timeframe: string | null | undefined): string | null {
  const fit = layerHorizonFit(layerId, timeframe);
  if (fit === "core") return null;
  if (ORDER_FLOW_LAYERS.has(layerId)) {
    return fit === "unfit"
      ? `fluxo real retido cobre ~${ORDER_FLOW_COVERAGE_MINUTES} min — não cobre uma vela de ${timeframe}`
      : `fluxo real retido cobre ~${ORDER_FLOW_COVERAGE_MINUTES} min — cobre só parte de uma vela de ${timeframe}`;
  }
  if (INTRADAY_ANCHORED_LAYERS.has(layerId)) {
    return fit === "unfit"
      ? `ancorada na sessão do dia — uma vela de ${timeframe} já contém o dia inteiro`
      : `ancorada na sessão do dia — em ${timeframe} vira contexto, não leitura principal`;
  }
  return null;
}
