// tpo-profile.ts — Entrega 41 (TPO / Market Profile, gap real nomeado
// desde a auditoria v16.0 ULTRA §12.2/12.3: "só precisa de OHLC de
// candle, sem tick stream" — confirmado de novo por um 2º documento
// externo, "DOCUMENTACAO_FINAL", cujas alegações de conclusão eram
// fabricadas — ver commit desta entrega). Metodologia real
// (Steidlmayer/CBOT), confirmada via pesquisa real antes de implementar
// (WebSearch: Sierra Chart, CQG, eminimind — Disciplina item 2):
//
// - Cada período fixo (default 30min, padrão real da literatura) do dia
//   recebe uma letra sequencial: A..Z, depois AA..ZZ se a sessão passar
//   de 26 períodos (sessões cripto 24h/30min chegam a 48 períodos — o
//   alfabeto simples não cobre isso, dobrar as letras é o esquema real
//   usado por mercados 24h, não uma variante inventada aqui).
// - A letra de um período marca TODA linha de preço tocada por QUALQUER
//   candle daquele período — uma letra por período por linha, nunca uma
//   letra por candle (vários candles no mesmo período de 30min não
//   duplicam a letra na mesma linha).
// - POC = linha com mais letras (TPO count); empate = linha mais perto
//   do meio do range real observado.
// - Value Area = expande 1 linha por vez a partir do POC, sempre para o
//   lado com MAIS TPOs na próxima linha adjacente, até somar 70% do TPO
//   total; empate real expande os dois lados (regra simétrica,
//   documentada, nunca um viés fabricado); lado esgotado (borda do
//   range) força a expansão pelo outro lado.
// - Initial Balance = high/low real dos candles dos 2 primeiros períodos
//   (a 1ª hora, com o default de 30min) — via excursão real de preço, não
//   via grid de linhas (evita erro de quantização num nível pensado pra
//   ser exato).
// - Single print = linha tocada por exatamente 1 período.
//
// Reaproveita filterSessionCandles/bucketMidPrice (volume-profile.ts) —
// MESMO escopo de sessão que o Volume Profile já usa (nunca uma 2ª
// partição de sessão) e MESMA técnica de bucket por CONTAGEM real do
// range observado (cripto não tem tick nativo conhecido por este código,
// então o grid nasce do range real, nunca de um tick fabricado). TPO é
// deliberadamente só "session" (nunca um modo "fixed range" multi-dia —
// períodos/letras resetam por dia por definição real do método; um TPO
// de vários dias não teria sentido canônico).
import { bucketMidPrice, filterSessionCandles } from "./volume-profile";

export const TPO_DEFAULT_PERIOD_MINUTES = 30;
export const TPO_DEFAULT_ROW_COUNT = 40;
export const TPO_VALUE_AREA_TARGET = 0.7;
const TPO_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function periodLetter(periodIndex: number): string {
  const cycle = Math.floor(periodIndex / TPO_LETTERS.length) + 1;
  const letter = TPO_LETTERS[periodIndex % TPO_LETTERS.length];
  return letter.repeat(cycle);
}

export interface TpoRow {
  price: number; // centro real da linha (bucketMidPrice)
  letters: string[]; // ordem cronológica, 1 entrada por período que tocou esta linha
}

export interface TpoProfileResult {
  rows: TpoRow[]; // preço ascendente
  rangeMin: number;
  rangeMax: number;
  rowCount: number;
  periodMinutes: number;
  periodCount: number;
  pocIndex: number;
  pocPrice: number;
  valueAreaHighIndex: number;
  valueAreaLowIndex: number;
  valueAreaHighPrice: number;
  valueAreaLowPrice: number;
  totalTpoCount: number;
  initialBalanceHigh: number;
  initialBalanceLow: number;
  // false enquanto a sessão ainda não completou os 2 primeiros períodos —
  // IB parcial nunca é apresentado como final (mesmo padrão de
  // SessionKeyLevel.closed em market-session.ts).
  initialBalanceComplete: boolean;
  singlePrintIndices: number[];
  candleCount: number;
  computedAt: number;
}

export type TpoProfileReading =
  | { status: "OK"; result: TpoProfileResult }
  | { status: "DADOS_INSUFICIENTES"; reason: string };

/** `candles` deve vir cronológico ascendente — mesmo contrato de entrada
 *  de todo outro motor puro deste projeto (fractal-swings, zigzag,
 *  volume-profile). */
export function computeTpoProfile(
  candles: { time: number; high: number; low: number }[],
  periodMinutes: number = TPO_DEFAULT_PERIOD_MINUTES,
  rowCount: number = TPO_DEFAULT_ROW_COUNT,
): TpoProfileReading {
  if (!Number.isFinite(periodMinutes) || periodMinutes <= 0) {
    return { status: "DADOS_INSUFICIENTES", reason: "periodMinutes inválido" };
  }
  if (!Number.isFinite(rowCount) || rowCount < 2) {
    return { status: "DADOS_INSUFICIENTES", reason: "rowCount inválido" };
  }

  const session = filterSessionCandles(candles);
  if (session.length === 0) {
    return { status: "DADOS_INSUFICIENTES", reason: "sem candles reais na sessão atual" };
  }

  const rangeMin = session.reduce((m, c) => Math.min(m, c.low), Infinity);
  const rangeMax = session.reduce((m, c) => Math.max(m, c.high), -Infinity);
  if (!(rangeMax > rangeMin)) {
    return { status: "DADOS_INSUFICIENTES", reason: "faixa de preço degenerada (sem variação real na sessão)" };
  }

  const sessionStart = session[0].time;
  const periodSeconds = periodMinutes * 60;
  const rowWidth = (rangeMax - rangeMin) / rowCount;
  const rowIndexFor = (price: number) => {
    const idx = Math.floor((price - rangeMin) / rowWidth);
    return Math.min(rowCount - 1, Math.max(0, idx));
  };

  const rowLetters: string[][] = Array.from({ length: rowCount }, () => []);
  const seenPeriodPerRow: Set<number>[] = Array.from({ length: rowCount }, () => new Set());

  let maxPeriodIndex = -1;
  let ibHigh = -Infinity;
  let ibLow = Infinity;

  for (const c of session) {
    const periodIndex = Math.floor((c.time - sessionStart) / periodSeconds);
    maxPeriodIndex = Math.max(maxPeriodIndex, periodIndex);
    if (periodIndex <= 1) {
      ibHigh = Math.max(ibHigh, c.high);
      ibLow = Math.min(ibLow, c.low);
    }
    const lowRow = rowIndexFor(c.low);
    const highRow = rowIndexFor(c.high);
    const letter = periodLetter(periodIndex);
    for (let r = lowRow; r <= highRow; r++) {
      if (!seenPeriodPerRow[r].has(periodIndex)) {
        seenPeriodPerRow[r].add(periodIndex);
        rowLetters[r].push(letter);
      }
    }
  }

  const periodCount = maxPeriodIndex + 1;
  const counts = rowLetters.map((l) => l.length);
  const totalTpoCount = counts.reduce((s, n) => s + n, 0);
  if (totalTpoCount === 0) {
    return { status: "DADOS_INSUFICIENTES", reason: "nenhum TPO real computado" };
  }

  const mid = (rangeMin + rangeMax) / 2;
  let pocIndex = 0;
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] > counts[pocIndex]) {
      pocIndex = i;
    } else if (counts[i] === counts[pocIndex] && counts[i] > 0) {
      const distI = Math.abs(bucketMidPrice(i, rangeMin, rangeMax, rowCount) - mid);
      const distPoc = Math.abs(bucketMidPrice(pocIndex, rangeMin, rangeMax, rowCount) - mid);
      if (distI < distPoc) pocIndex = i;
    }
  }

  let vaHigh = pocIndex;
  let vaLow = pocIndex;
  let vaTotal = counts[pocIndex];
  const target = totalTpoCount * TPO_VALUE_AREA_TARGET;
  while (vaTotal < target && (vaHigh < rowCount - 1 || vaLow > 0)) {
    const aboveCount = vaHigh < rowCount - 1 ? counts[vaHigh + 1] : -1;
    const belowCount = vaLow > 0 ? counts[vaLow - 1] : -1;
    if (aboveCount < 0 && belowCount < 0) break; // defensivo — inalcançável (ver prova no commit)
    if (aboveCount > belowCount) {
      vaHigh += 1;
      vaTotal += counts[vaHigh];
    } else if (belowCount > aboveCount) {
      vaLow -= 1;
      vaTotal += counts[vaLow];
    } else {
      // Empate real (ambos os lados válidos e iguais) — expande os dois,
      // simétrico, nunca um viés fabricado para um lado.
      vaHigh += 1;
      vaTotal += counts[vaHigh];
      vaLow -= 1;
      vaTotal += counts[vaLow];
    }
  }

  const singlePrintIndices: number[] = [];
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] === 1) singlePrintIndices.push(i);
  }

  return {
    status: "OK",
    result: {
      rows: rowLetters.map((letters, i) => ({ price: bucketMidPrice(i, rangeMin, rangeMax, rowCount), letters })),
      rangeMin,
      rangeMax,
      rowCount,
      periodMinutes,
      periodCount,
      pocIndex,
      pocPrice: bucketMidPrice(pocIndex, rangeMin, rangeMax, rowCount),
      valueAreaHighIndex: vaHigh,
      valueAreaLowIndex: vaLow,
      valueAreaHighPrice: bucketMidPrice(vaHigh, rangeMin, rangeMax, rowCount),
      valueAreaLowPrice: bucketMidPrice(vaLow, rangeMin, rangeMax, rowCount),
      totalTpoCount,
      initialBalanceHigh: ibHigh,
      initialBalanceLow: ibLow,
      initialBalanceComplete: periodCount >= 2,
      singlePrintIndices,
      candleCount: session.length,
      computedAt: Date.now(),
    },
  };
}
