// reversal-detector.ts — Laboratório de Evolução (CLAUDE.md, Disciplina de
// Trabalho §3): motor PURO, ISOLADO, sem nenhuma ligação com o Core Engine.
//
// ORIGEM: o Operador pediu que o organismo "se vire sozinho — veja que é
// reversão e já mude a posição de long ou short". O mapa do ecossistema
// (docs/MAPA_ECOSSISTEMA_2026-08-17.md, Parte 1) mediu por que ele ainda não
// faz isso: a decisão INTEIRA do Núcleo é `trendBias()` em
// js/research/research-engine.js:35 — preço vs SMA e EMA vs SMA. Um cruzamento
// de médias é, por construção, o detector de reversão mais lento que existe:
// a média só cruza depois que o preço já andou o bastante para arrastá-la.
//
// Enquanto isso, o CHoCH — que é a definição literal de reversão estrutural, e
// dispara ANTES de cruzamento de média/MACD/divergência de RSI — já está
// construído, testado e desenhado na tela (bos-choch-engine.js), sem qualquer
// permissão de influenciar a decisão (LEI 24).
//
// O QUE ESTE MÓDULO É, E O QUE NÃO É:
//   É   — a leitura de reversão a partir da evidência REAL já calculada, mais
//         o INSTRUMENTO DE MEDIÇÃO que responde "quantas barras antes?".
//   NÃO É — uma segunda decisão de trading. Nada aqui é lido pelo Núcleo.
//         A hierarquia da LEI 24 continua intacta até o Operador decidir,
//         COM O NÚMERO NA MÃO, se muda.
//
// DISTINÇÃO ANALÍTICA CRÍTICA (a mais fácil de errar aqui): **BOS não é
// reversão.** Break of Structure é CONTINUAÇÃO — o preço rompe na direção da
// tendência que já existia. Change of Character é a inversão: o primeiro
// rompimento CONTRA a estrutura vigente. bos-choch-engine.js já classifica os
// dois corretamente (comparando o rompimento com `structure_label`); tratar
// BOS como evidência de reversão inverteria o sinal justamente quando a
// tendência está mais forte. Só CHOCH conta aqui.
//
// Regra de Ouro 2: `strength` é MASSA DE EVIDÊNCIA CONCORDANTE, nunca uma
// probabilidade de acerto. Este repositório não tem backtest calibrado que
// sustente a segunda coisa — e este módulo existe justamente para produzir a
// medição que hoje falta.
//
// Regra de Ouro 3: sem detector legível, DADOS_INSUFICIENTES com a razão real.

/** Rompimento estrutural real, como bos-choch-engine.js o devolve. */
export interface StructuralBreak {
  type: "BOS" | "CHOCH";
  direction: "ALTA" | "BAIXA";
  level: number;
  index: number;
  time: number;
}

/** Saída real de bos-choch-engine.js. */
export interface BosChochResult {
  status: string;
  break?: StructuralBreak | null;
  structure_label?: string;
}

/** Ponto real do supertrend-engine.js. */
export interface SuperTrendPoint {
  index: number;
  line: number;
  trend: "UP" | "DOWN";
  flipped: boolean;
}

export interface SuperTrendResult {
  status: string;
  points?: SuperTrendPoint[];
}

export type ReversalDirection = "LONG" | "SHORT";

/** Uma evidência real que disparou, com a barra em que disparou. */
export interface ReversalEvidence {
  source: "CHOCH" | "SUPERTREND";
  direction: ReversalDirection;
  /** Índice da barra em que o evento realmente ocorreu. */
  atIndex: number;
  /** Quantas barras atrás — 0 = agora. Frescor real, nunca suposto. */
  barsAgo: number;
}

export interface ReversalReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  /** Direção para onde a evidência de reversão aponta. */
  direction: ReversalDirection | null;
  /** Evidências que dispararam nesta janela, mais recente primeiro. */
  evidence: ReversalEvidence[];
  /** Quantos detectores concordam com `direction`. */
  agreeingCount: number;
  /** Quantos detectores tinham leitura utilizável (denominador honesto). */
  totalReadable: number;
  /** Massa de evidência concordante em [0,1]. NUNCA uma probabilidade. */
  strength: number | null;
  /** Barras desde a evidência mais recente. Reversão velha não é reversão. */
  barsAgo: number | null;
  /** true quando a evidência aponta CONTRA a direção que o Núcleo emite hoje.
   *  null quando o Núcleo está em WAIT/sem direção — não há o que contradizer. */
  contradictsCore: boolean | null;
}

/** Acima disto o evento estrutural virou história, não leitura de agora.
 *  20 barras é a MESMA janela que o Núcleo usa (`windowSize: 20` em
 *  engine-bridge.ts:499) — não um número novo inventado, e sim "o evento
 *  ainda está dentro da janela que a própria decisão enxerga". */
export const REVERSAL_MAX_BARS_AGO = 20;

function insufficient(reason: string): ReversalReading {
  return {
    status: "DADOS_INSUFICIENTES",
    reason,
    direction: null,
    evidence: [],
    agreeingCount: 0,
    totalReadable: 0,
    strength: null,
    barsAgo: null,
    contradictsCore: null,
  };
}

const dirOf = (d: "ALTA" | "BAIXA"): ReversalDirection => (d === "ALTA" ? "LONG" : "SHORT");

/**
 * Leitura de reversão a partir da evidência real já calculada pelo ciclo.
 * Puro: mesma entrada, mesma saída, zero rede, zero estado, zero Date.now().
 *
 * `lastIndex` é a barra mais recente da série analisada — usado para calcular
 * frescor real. `coreDirection` é o que o Núcleo emite AGORA, só para relatar
 * contradição; este módulo nunca escreve nele.
 */
export function computeReversalReading(input: {
  bosChoch: BosChochResult | null;
  superTrend: SuperTrendResult | null;
  lastIndex: number;
  coreDirection: ReversalDirection | null;
  maxBarsAgo?: number;
}): ReversalReading {
  const { bosChoch, superTrend, lastIndex, coreDirection } = input;
  const maxBarsAgo = input.maxBarsAgo ?? REVERSAL_MAX_BARS_AGO;

  if (!Number.isFinite(lastIndex) || lastIndex < 0) {
    return insufficient("série sem barra de referência para medir frescor");
  }

  const evidence: ReversalEvidence[] = [];
  let totalReadable = 0;

  // --- Detector 1: CHoCH ----------------------------------------------------
  // Só CHOCH. BOS é continuação (ver cabeçalho) e seria o sinal invertido.
  if (bosChoch && bosChoch.status === "OK") {
    totalReadable++;
    const brk = bosChoch.break;
    if (
      brk &&
      brk.type === "CHOCH" &&
      Number.isFinite(brk.index) &&
      (brk.direction === "ALTA" || brk.direction === "BAIXA")
    ) {
      const barsAgo = lastIndex - brk.index;
      if (barsAgo >= 0 && barsAgo <= maxBarsAgo) {
        evidence.push({ source: "CHOCH", direction: dirOf(brk.direction), atIndex: brk.index, barsAgo });
      }
    }
  }

  // --- Detector 2: flip do SuperTrend ---------------------------------------
  // `flipped: true` é literalmente a barra em que a tendência inverteu.
  if (superTrend && superTrend.status === "OK" && Array.isArray(superTrend.points)) {
    totalReadable++;
    let lastFlip: SuperTrendPoint | null = null;
    for (const p of superTrend.points) {
      if (p && p.flipped === true && Number.isFinite(p.index)) {
        if (lastFlip === null || p.index > lastFlip.index) lastFlip = p;
      }
    }
    if (lastFlip) {
      const barsAgo = lastIndex - lastFlip.index;
      if (barsAgo >= 0 && barsAgo <= maxBarsAgo) {
        evidence.push({
          source: "SUPERTREND",
          direction: lastFlip.trend === "UP" ? "LONG" : "SHORT",
          atIndex: lastFlip.index,
          barsAgo,
        });
      }
    }
  }

  if (totalReadable === 0) {
    return insufficient("nenhum detector de reversão com leitura real nesta janela");
  }
  if (evidence.length === 0) {
    return {
      ...insufficient(`nenhuma reversão real nas últimas ${maxBarsAgo} barras`),
      totalReadable,
    };
  }

  evidence.sort((a, b) => a.barsAgo - b.barsAgo);

  // A direção é a da evidência MAIS RECENTE — não um voto majoritário. Num
  // empate 1×1 (CHoCH pra um lado, SuperTrend pro outro), o evento mais novo é
  // o que descreve o mercado agora; o outro já foi superado. `strength` então
  // cai para 0.5 e a discordância fica visível, nunca escondida atrás de uma
  // "média" que não significaria nada.
  const direction = evidence[0].direction;
  const agreeingCount = evidence.filter((e) => e.direction === direction).length;

  return {
    status: "OK",
    reason: null,
    direction,
    evidence,
    agreeingCount,
    totalReadable,
    strength: agreeingCount / totalReadable,
    barsAgo: evidence[0].barsAgo,
    contradictsCore: coreDirection === null ? null : direction !== coreDirection,
  };
}

// ============================================================================
// INSTRUMENTO DE MEDIÇÃO — a razão de este módulo existir
// ============================================================================

export interface ReversalLeadSample {
  /** Barra em que a evidência estrutural virou. */
  evidenceIndex: number;
  /** Barra em que o `trendBias` do Núcleo virou para a mesma direção. */
  coreIndex: number;
  /** coreIndex − evidenceIndex. POSITIVO = a evidência chegou antes. */
  leadBars: number;
  direction: ReversalDirection;
}

export interface ReversalLeadMeasurement {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  samples: ReversalLeadSample[];
  /** Mediana da vantagem em barras. Mediana e não média: um único caso
   *  extremo (o Núcleo demorando 40 barras uma vez) não pode definir o
   *  resultado — mesmo cuidado já aplicado no Achado 3.3 e no
   *  cross-exchange-book. */
  medianLeadBars: number | null;
  /** Quantas vezes a evidência chegou ANTES (leadBars > 0). */
  earlierCount: number;
  /** Quantas vezes chegou DEPOIS. Contado e exposto de propósito: se este
   *  número for alto, a resposta honesta é que a troca não vale a pena. */
  laterCount: number;
}

/**
 * A medição que o Operador precisa para decidir: sobre uma série REAL, quantas
 * barras ANTES a evidência estrutural virou, comparada com a virada do
 * `trendBias` que o Núcleo usa hoje.
 *
 * Recebe as duas sequências já calculadas (`biasByBar` vindo do trendBias REAL
 * exportado de research-engine.js — nunca reimplementado aqui) e emparelha cada
 * virada de bias com a evidência de reversão mais próxima ANTERIOR na mesma
 * direção.
 *
 * Puro e determinístico. Zero rede.
 */
export function measureReversalLead(input: {
  /** Bias real por barra, na ordem cronológica. 'ALTA'|'BAIXA'|outro. */
  biasByBar: string[];
  /** Eventos de reversão reais detectados na série, em qualquer ordem. */
  events: { direction: ReversalDirection; atIndex: number }[];
  /** Janela máxima para considerar que um evento "explica" a virada do bias. */
  maxLookbackBars?: number;
}): ReversalLeadMeasurement {
  const { biasByBar, events } = input;
  const maxLookback = input.maxLookbackBars ?? REVERSAL_MAX_BARS_AGO;

  if (!Array.isArray(biasByBar) || biasByBar.length < 2) {
    return { status: "DADOS_INSUFICIENTES", reason: "série de bias curta demais para ter uma virada", samples: [], medianLeadBars: null, earlierCount: 0, laterCount: 0 };
  }
  if (!Array.isArray(events) || events.length === 0) {
    return { status: "DADOS_INSUFICIENTES", reason: "nenhum evento de reversão real na série", samples: [], medianLeadBars: null, earlierCount: 0, laterCount: 0 };
  }

  const biasToDir = (b: string): ReversalDirection | null =>
    b === "ALTA" ? "LONG" : b === "BAIXA" ? "SHORT" : null;

  const samples: ReversalLeadSample[] = [];
  for (let i = 1; i < biasByBar.length; i++) {
    const prev = biasToDir(biasByBar[i - 1]);
    const curr = biasToDir(biasByBar[i]);
    // Virada real do Núcleo: entrou numa direção acionável diferente da
    // anterior. NEUTRO->LONG conta (o Núcleo passou a emitir), LONG->NEUTRO
    // não (parou de emitir, não inverteu).
    if (curr === null || curr === prev) continue;

    // Evidência mais PRÓXIMA desta virada, na mesma direção — antes OU depois.
    //
    // A janela é SIMÉTRICA de propósito, e isto é a decisão metodológica mais
    // importante desta medição. A versão anterior deste código só aceitava
    // `lead >= 0` (evidência anterior à virada). Isso é viés de seleção puro:
    // descartaria silenciosamente todo caso em que a estrutura chegou ATRASADA
    // e devolveria uma vantagem média favorável POR CONSTRUÇÃO — um número que
    // pareceria medido e seria fabricado. Com a janela simétrica, `leadBars`
    // pode ser negativo, `laterCount` pode ser maior que zero, e a mediana pode
    // honestamente dizer "não vale a pena".
    let best: { direction: ReversalDirection; atIndex: number } | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const e of events) {
      if (e.direction !== curr) continue;
      if (!Number.isFinite(e.atIndex)) continue;
      const distance = Math.abs(i - e.atIndex);
      if (distance > maxLookback) continue;
      if (distance < bestDistance) {
        best = e;
        bestDistance = distance;
      }
    }
    if (best === null) continue;

    samples.push({ evidenceIndex: best.atIndex, coreIndex: i, leadBars: i - best.atIndex, direction: curr });
  }

  if (samples.length === 0) {
    return { status: "DADOS_INSUFICIENTES", reason: "nenhuma virada do Núcleo teve evidência de reversão emparelhável na janela", samples: [], medianLeadBars: null, earlierCount: 0, laterCount: 0 };
  }

  const leads = samples.map((s) => s.leadBars).sort((a, b) => a - b);
  const mid = Math.floor(leads.length / 2);
  const medianLeadBars = leads.length % 2 === 0 ? (leads[mid - 1] + leads[mid]) / 2 : leads[mid];

  return {
    status: "OK",
    reason: null,
    samples,
    medianLeadBars,
    earlierCount: samples.filter((s) => s.leadBars > 0).length,
    laterCount: samples.filter((s) => s.leadBars < 0).length,
  };
}

/** Frase honesta para relatório/UI. Nunca inventa número. */
export function describeReversalReading(r: ReversalReading): string {
  if (r.status !== "OK" || r.direction === null) return r.reason ?? "sem leitura de reversão";
  const fontes = r.evidence.map((e) => e.source).join("+");
  const conflito = r.contradictsCore === true ? " · CONTRA o sinal atual" : "";
  return `reversão ${r.direction} há ${r.barsAgo} barra(s) · ${r.agreeingCount}/${r.totalReadable} (${fontes})${conflito}`;
}
