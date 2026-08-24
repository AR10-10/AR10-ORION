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
//   order_book_depth) — o histórico real retido cobre ~60 minutos
//   (ORDERFLOW_HISTORY_CAPACITY = 900 em nexus/orderflow-history.ts, a
//   ~4s por ciclo). Isso é a vela INTEIRA até 1h, um pedaço real dela em
//   2h/4h, e nada abaixo de um quarto de vela em 1D+. Não é opinião sobre
//   utilidade: é a tradução direta do que o sistema guarda.
//
//   ERA ~8 minutos (capacidade 120), e essa era a limitação mais citada do
//   projeto. A retenção subiu depois que a medição mostrou que o custo por
//   push é irrelevante (~0,0085 ms a cada 4 s) e que o bloqueio real era
//   outro: computeOrderflowTrend lia o histórico INTEIRO, então subir a
//   retenção mudaria em silêncio o significado de uma leitura já exibida.
//   Ver o cabeçalho de ORDERFLOW_HISTORY_CAPACITY para a medição completa.
//
//   LIMITE QUE PERMANECE, e nenhuma mudança de código encurta: o ring
//   começa VAZIO a cada sessão e enche a 4s/ciclo — ter 1 hora de fluxo
//   exige a aba aberta por 1 hora. Até lá as camadas valem pelo que já
//   couber, e os motores que dependem disso continuam fail-closed.
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

/** ~60 minutos reais de CVD/fluxo retido (ORDERFLOW_HISTORY_CAPACITY = 900
 *  a ~4s por ciclo). É o teto de honestidade das camadas de fluxo.
 *
 *  Era 8 (capacidade 120). Subiu junto com a retenção real — este número
 *  nunca é uma opinião sobre utilidade, é a tradução direta do que o
 *  sistema de fato guarda, e por isso os dois andam sempre juntos (há teste
 *  travando a correspondência). */
export const ORDER_FLOW_COVERAGE_MINUTES = 60;

/** Quantas janelas retidas ainda contam como CONTEXTO. Convenção declarada,
 *  nunca medição: a janela cobre pelo menos 1/4 da vela em formação — o
 *  suficiente para descrever o trecho mais recente dela, longe de descrever
 *  a vela inteira.
 *
 *  ANTES este limiar era o literal `60` cravado no código. Ele foi escrito
 *  quando a cobertura era de 8 minutos e, por coincidência, produzia uma
 *  faixa razoável; mas era um número solto que NÃO acompanhava a retenção —
 *  com a cobertura em 60 min ele tornaria o ramo de contexto inalcançável
 *  (core já cobriria tudo até 1h) e faria 2h/4h caírem direto em "unfit",
 *  afirmando ausência de dado onde há meia vela e um quarto de vela de
 *  fluxo real. Derivar da cobertura corrige isso e mantém a regra honesta
 *  para qualquer capacidade futura. */
export const ORDER_FLOW_CONTEXT_MULTIPLE = 4;

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
    // A janela ainda cobre um pedaço reconhecível da vela atual (>= 1/4).
    if (min <= ORDER_FLOW_COVERAGE_MINUTES * ORDER_FLOW_CONTEXT_MULTIPLE) return "context";
    // Abaixo disso o dado retido não cobre nem um quarto da vela em formação.
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
      ? `fluxo real retido cobre ~${ORDER_FLOW_COVERAGE_MINUTES} min — não cobre nem um quarto de uma vela de ${timeframe}`
      : `fluxo real retido cobre ~${ORDER_FLOW_COVERAGE_MINUTES} min — cobre só parte de uma vela de ${timeframe}`;
  }
  if (INTRADAY_ANCHORED_LAYERS.has(layerId)) {
    return fit === "unfit"
      ? `ancorada na sessão do dia — uma vela de ${timeframe} já contém o dia inteiro`
      : `ancorada na sessão do dia — em ${timeframe} vira contexto, não leitura principal`;
  }
  return null;
}
