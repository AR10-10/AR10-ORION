// plan-markers.ts — SETAS de entrada e saída no gráfico.
//
// PEDIDO DO OPERADOR: "com as setinhas indicando a entrada e saída, todo no
// gráfico, bem perfeitamente".
//
// AUDITORIA ANTES DE CONSTRUIR (Disciplina §1): `grep -rn "setMarkers|
// createSeriesMarkers|SeriesMarker"` no repositório inteiro voltou ZERO
// ocorrências. Entrada/Stop/Alvo já existiam como ETIQUETAS no eixo de
// preço (EN/ST/TP, nível `critical`) — mas etiqueta de eixo responde
// "a que PREÇO", nunca "em QUAL MOMENTO". A seta responde a segunda
// pergunta, e é ela que faltava: sem marcador temporal, o Operador não vê
// no gráfico onde o plano abriu nem onde fechou.
//
// DADO REAL, NUNCA UMA PREVISÃO: cada seta vem de um evento JÁ REGISTRADO
// pelo Track Record (nexus/signal-track-record.ts) — `openedAt` real do
// plano e `resolvedAt`/`resolvedPrice`/`status` reais da resolução. Este
// módulo não decide entrada nem saída, não estima, não projeta: ele
// converte um histórico real em marcadores. LEI 24 intacta — o Núcleo
// continua sendo o único emissor de decisão, e uma seta é o registro do
// que ele já disse, nunca uma segunda decisão.
//
// FAIL-CLOSED DELIBERADO (a parte fácil de errar em silêncio): um evento
// cujo tempo está FORA da janela de candles carregada NÃO vira marcador.
// A alternativa preguiçosa — prender na primeira/última vela — poria a
// seta numa vela onde nada aconteceu, e o Operador leria uma entrada num
// momento que nunca existiu.

import type { SeriesMarker, Time, UTCTimestamp } from "lightweight-charts";

/** Só o que este módulo realmente lê de um TrackedPlan — declarado
 *  estruturalmente para o módulo continuar puro e testável sem arrastar o
 *  contrato inteiro do Track Record. */
export interface PlanMarkerSource {
  plan: { direction: "LONG" | "SHORT" };
  openedAt: number; // ms real
  status: "OPEN" | "TARGET_HIT" | "PARTIAL_HIT" | "STOP_HIT" | "REPLACED";
  resolvedAt: number | null; // ms real
}

export interface MarkerCandle {
  time: number; // SEGUNDOS (o schema do Bus e da lib)
}

// Mesma família de cor que o resto do gráfico já usa para direção e
// resultado — nenhum matiz novo para o Operador aprender.
const COR_LONG = "rgba(8, 153, 129, 0.95)";
const COR_SHORT = "rgba(242, 54, 69, 0.95)";
const COR_ALVO = "rgba(8, 153, 129, 0.95)";
const COR_STOP = "rgba(242, 54, 69, 0.95)";
/** REPLACED não é ganho nem perda: o plano foi substituído por uma leitura
 *  nova antes de resolver. Pintá-lo de verde ou vermelho seria afirmar um
 *  resultado que nunca houve. */
const COR_NEUTRA = "rgba(138, 180, 248, 0.85)";

/**
 * Índice da vela que CONTÉM o instante — nunca a mais próxima.
 *
 * @param candles velas ordenadas por tempo crescente, `time` em SEGUNDOS
 * @param ms instante real em MILISSEGUNDOS
 * @returns índice, ou -1 quando o instante cai fora da janela carregada
 */
export function candleIndexAt(candles: readonly MarkerCandle[], ms: number): number {
  if (!Array.isArray(candles) || candles.length === 0) return -1;
  if (!Number.isFinite(ms)) return -1;
  const segundos = ms / 1000;
  // Anterior à primeira vela: o evento existe, mas não nesta janela.
  if (segundos < candles[0].time) return -1;
  // BUG REAL PEGO PELO PRÓPRIO TESTE DESTE MÓDULO: a borda ESQUERDA estava
  // guardada e a DIREITA não. A busca binária abaixo devolve "a última vela
  // com time <= t", então um evento muito depois do fim da janela era
  // grudado na última vela — exatamente o clamp que o cabeçalho deste
  // arquivo promete nunca fazer, e o Operador leria uma saída numa vela
  // onde nada aconteceu.
  //
  // A última vela cobre [t_último, t_último + passo). O passo vem da
  // MEDIANA dos intervalos reais: um buraco isolado no histórico (paragem
  // de exchange) não a desloca, e ela não depende de o chamador informar o
  // timeframe.
  const ultimo = candles[candles.length - 1].time;
  if (segundos >= ultimo) {
    const passo = medianStepSeconds(candles);
    if (passo === null) return segundos === ultimo ? candles.length - 1 : -1;
    if (segundos >= ultimo + passo) return -1;
    return candles.length - 1;
  }
  let lo = 0;
  let hi = candles.length - 1;
  let achou = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = candles[mid].time;
    if (!Number.isFinite(t)) return -1;
    if (t <= segundos) {
      achou = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return achou;
}

/** Passo típico entre velas, em segundos. Mediana e não média: um buraco
 *  real no histórico não deve alterar a duração de uma vela. `null` com
 *  amostra curta demais para afirmar um passo — e aí a função que chama
 *  cai no comportamento mais conservador, nunca num palpite. */
function medianStepSeconds(candles: readonly MarkerCandle[]): number | null {
  if (candles.length < 3) return null;
  const passos: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const d = candles[i].time - candles[i - 1].time;
    if (d > 0) passos.push(d);
  }
  if (passos.length === 0) return null;
  passos.sort((a, b) => a - b);
  return passos[Math.floor(passos.length / 2)];
}

function corDeSaida(status: PlanMarkerSource["status"]): string {
  if (status === "TARGET_HIT" || status === "PARTIAL_HIT") return COR_ALVO;
  if (status === "STOP_HIT") return COR_STOP;
  return COR_NEUTRA;
}

function textoDeSaida(status: PlanMarkerSource["status"]): string {
  if (status === "TARGET_HIT") return "SAÍDA · ALVO";
  if (status === "PARTIAL_HIT") return "SAÍDA · PARCIAL";
  if (status === "STOP_HIT") return "SAÍDA · STOP";
  return "SUBSTITUÍDO";
}

/**
 * Setas reais de entrada e saída para uma lista de planos registrados.
 *
 * A seta de ENTRADA aponta no sentido da operação (LONG = ↑ abaixo da
 * vela, SHORT = ↓ acima) — a mesma convenção direcional que o gráfico
 * inteiro já usa. A de SAÍDA aponta no sentido CONTRÁRIO: é o fechamento
 * da mesma posição, e usar a mesma seta das duas pontas faria entrada e
 * saída ficarem visualmente idênticas.
 */
export function buildPlanMarkers(
  plans: readonly PlanMarkerSource[],
  candles: readonly MarkerCandle[],
): SeriesMarker<Time>[] {
  if (!Array.isArray(plans) || plans.length === 0) return [];
  if (!Array.isArray(candles) || candles.length === 0) return [];

  const out: SeriesMarker<Time>[] = [];

  plans.forEach((p, i) => {
    const long = p?.plan?.direction === "LONG";

    const iEntrada = candleIndexAt(candles, p?.openedAt);
    if (iEntrada !== -1) {
      out.push({
        time: candles[iEntrada].time as UTCTimestamp,
        position: long ? "belowBar" : "aboveBar",
        shape: long ? "arrowUp" : "arrowDown",
        color: long ? COR_LONG : COR_SHORT,
        // id estável por plano+papel: sem ele a lib não consegue
        // diferenciar dois marcadores na MESMA vela (entrada de um plano e
        // saída do anterior caem juntas com frequência real).
        id: `plan-${i}-entry`,
        text: `ENTRADA ${p.plan.direction}`,
      });
    }

    // Plano ainda aberto não tem saída — e inventar uma seria afirmar um
    // fechamento que não aconteceu.
    if (p?.status === "OPEN" || p?.resolvedAt === null || p?.resolvedAt === undefined) return;
    const iSaida = candleIndexAt(candles, p.resolvedAt);
    if (iSaida === -1) return;
    out.push({
      time: candles[iSaida].time as UTCTimestamp,
      position: long ? "aboveBar" : "belowBar",
      shape: long ? "arrowDown" : "arrowUp",
      color: corDeSaida(p.status),
      id: `plan-${i}-exit`,
      text: textoDeSaida(p.status),
    });
  });

  // A lib exige tempos não-decrescentes. O histórico já chega em ordem,
  // mas a entrada de um plano pode cair depois da saída de outro quando
  // eles se sobrepõem — ordenar aqui é mais barato e mais seguro do que
  // confiar na ordem de quem chama.
  return out.sort((a, b) => (a.time as number) - (b.time as number));
}
