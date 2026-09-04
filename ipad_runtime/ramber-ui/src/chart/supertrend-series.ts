// supertrend-series.ts — separa a leitura do SuperTrend nas DUAS séries
// nativas que o gráfico desenha.
//
// POR QUE DUAS SÉRIES: a lightweight-charts não colore segmentos distintos
// de uma mesma LineSeries. Uma série desenha os trechos de tendência de
// ALTA, a outra os de BAIXA, e cada uma recebe a série COMPLETA de tempos —
// com *whitespace* (`{ time }` sem `value`) onde a outra manda. Sem esses
// buracos a lib interpola uma reta ligando os trechos e desenha um stop que
// nunca existiu.
//
// POR QUE PURO E SEPARADO: esta é a única parte não-óbvia do desenho, e
// dentro do objeto de efeito do chart ela era inalcançável por teste. Aqui
// ganha execução real — e o harness de verificação visual
// (`scripts/verify-equal-levels/`) usa exatamente esta função, nunca uma
// cópia que poderia divergir do que o app faz de verdade.

export interface SuperTrendReadingPoint {
  index: number;
  line: number;
  trend: "UP" | "DOWN";
  flipped: boolean;
}

/** Ponto de LineSeries com `value` opcional — sem `value` é whitespace. */
export interface SeriesPoint<T> {
  time: T;
  value?: number;
}

export interface SuperTrendSeriesSplit<T> {
  up: SeriesPoint<T>[];
  down: SeriesPoint<T>[];
}

/**
 * @param points leitura real do motor (engine-bridge `computeSuperTrend`).
 * @param timeAt resolve o tempo do candle daquele índice, ou `undefined`
 *   quando o índice está fora da janela real de candles.
 */
export function splitSuperTrendSeries<T>(
  points: SuperTrendReadingPoint[],
  timeAt: (index: number) => T | undefined,
): SuperTrendSeriesSplit<T> {
  const up: SeriesPoint<T>[] = [];
  const down: SeriesPoint<T>[] = [];
  for (const p of points) {
    const t = timeAt(p.index);
    if (t === undefined) continue; // fora da janela real — nunca um palpite.
    if (!Number.isFinite(p.line)) continue; // fail-closed: nada fabricado.
    const naAlta = p.trend === "UP";
    // O candle do FLIP entra nas DUAS de propósito: é o mesmo preço, e sem
    // ele haveria um vão de 1 candle exatamente no instante que mais
    // importa ler — o da virada.
    up.push(naAlta || p.flipped ? { time: t, value: p.line } : { time: t });
    down.push(!naAlta || p.flipped ? { time: t, value: p.line } : { time: t });
  }
  return { up, down };
}
