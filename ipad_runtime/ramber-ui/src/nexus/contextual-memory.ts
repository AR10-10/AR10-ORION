// contextual-memory.ts — MEMÓRIA CONTEXTUAL: o que o histórico real diz
// sobre contextos parecidos com o de agora.
//
// POR QUE ESTE ARQUIVO EXISTE (achado medido, auditoria de memória e
// aprendizado): o sistema JÁ carimba a assinatura do cenário em que cada
// plano foi aberto (`scenario-fingerprint.ts`, gravada em cada
// `TradeCostResult` por `trade-simulation.ts:137`) e JÁ agrupa resultados
// por essa assinatura (`groupResultsByFingerprint`). Mas
// `groupResultsByFingerprint` era chamada **só pelo próprio teste** — zero
// consumidores de produção. O próprio header do scenario-fingerprint.ts
// dizia que a fingerprint serviria para "um painel futuro"; esse painel
// nunca foi construído.
//
// Ou seja: o organismo gravava a experiência e nunca a relia. Este módulo
// é a releitura.
//
// O QUE ISTO É — e o que NÃO É:
//
//   É: uma contagem real sobre trades reais já resolvidos, filtrados pelo
//      contexto em que foram abertos, com o custo real (comissão +
//      slippage + funding) já embutido pelo trade-simulation.ts.
//
//   NÃO É: aprendizado automático. Nada aqui treina, ajusta peso ou
//      realimenta o Core Engine. O sistema não fica "mais inteligente
//      sozinho" — ele passa a LEMBRAR, que é uma coisa diferente e
//      honesta. LEI 24 intacta: isto é confluência/contexto exibido,
//      nunca um segundo emissor de direção.
//
//   NUNCA É: probabilidade. "8 de 12 resolveram no alvo" é uma contagem
//      observada; "67% de chance" seria uma afirmação sobre o futuro que
//      esta amostra não sustenta. A distinção é a Regra de Ouro 2, e por
//      isso este módulo devolve `sample`/`targetHits` e um rótulo de
//      FORÇA DE AMOSTRA — nunca um percentual de acerto projetado.
//
// ZERO MATEMÁTICA NOVA: a estatística vem de `computeExpectancy`
// (expectancy.ts, intocado — ele já é agnóstico de proveniência e só soma
// a lista que o chamador filtrar). O agrupamento vem de
// `groupResultsByFingerprint`. Este módulo só escolhe QUAL grupo ler e
// declara honestamente o quanto ele sustenta.
import { computeExpectancy, MIN_TRADES_FOR_VALID_EXPECTANCY, type ExpectancyStats } from "./expectancy";
import { groupResultsByFingerprint } from "./scenario-fingerprint";
import type { TradeCostResult } from "./trade-simulation";

/** Piso para a memória sequer ABRIR a boca. Convenção declarada, nunca uma
 *  medição estatística — mesma natureza dos limiares de expectancy.ts.
 *  Abaixo disso o grupo existe mas não diz nada: 2 trades não são memória,
 *  são anedota. */
export const MEMORY_MIN_SAMPLE = 5;

/** Quão forte é a amostra deste contexto. Vocabulário de FORÇA, nunca de
 *  probabilidade — é isto que aparece ao lado do número. */
export type MemoryStrength =
  | "AMOSTRA_INSUFICIENTE" // < MEMORY_MIN_SAMPLE: nem conta o resultado
  | "AMOSTRA_PRELIMINAR" //   >= piso, < MIN_TRADES_FOR_VALID_EXPECTANCY
  | "AMOSTRA_VALIDA"; //      >= MIN_TRADES_FOR_VALID_EXPECTANCY

/** Quanto do contexto de agora foi realmente reencontrado no histórico. */
export type MemoryMatchLevel =
  | "EXATO" //   os 4 fatores idênticos
  | "PARCIAL"; // só um subconjunto declarado bateu — e quais, fica dito

export interface ContextualRecall {
  /** A assinatura procurada — legível, como o scenario-fingerprint produz. */
  fingerprint: string;
  matchLevel: MemoryMatchLevel;
  /** Exatamente quais tags casaram. Num match PARCIAL isto é a diferença
   *  entre "o sistema lembrou de algo parecido" e "o sistema fingiu uma
   *  semelhança". */
  matchedFactors: string[];
  /** Trades REAIS resolvidos neste grupo. É o número honesto, sempre
   *  presente — mesmo quando a força não autoriza ler a estatística. */
  sample: number;
  strength: MemoryStrength;
  /** null enquanto AMOSTRA_INSUFICIENTE — fail-closed: sem amostra que
   *  sustente, a memória não devolve número nenhum em vez de devolver um
   *  número frágil sem aviso. */
  stats: ExpectancyStats | null;
}

function strengthFor(sample: number): MemoryStrength {
  if (sample < MEMORY_MIN_SAMPLE) return "AMOSTRA_INSUFICIENTE";
  if (sample < MIN_TRADES_FOR_VALID_EXPECTANCY) return "AMOSTRA_PRELIMINAR";
  return "AMOSTRA_VALIDA";
}

/** Quebra "regime:X|structure:Y|vwap:Z|nl:W" nas tags individuais. */
export function fingerprintFactors(fingerprint: string): string[] {
  return fingerprint.split("|").filter((t) => t.length > 0);
}

/** Tags com leitura real — as ausentes vêm marcadas com "—" pelo
 *  scenario-fingerprint e não contam como fator casado (casar dois
 *  "ausente" não é semelhança observada, é ausência compartilhada). */
function realFactors(fingerprint: string): string[] {
  return fingerprintFactors(fingerprint).filter((t) => !t.endsWith(":—"));
}

/**
 * O que o histórico real diz sobre este contexto.
 *
 * Tenta primeiro o match EXATO (os 4 fatores). Se esse grupo não alcança
 * o piso, cai para PARCIAL: agrupa todo resultado que compartilhe **pelo
 * menos** `minSharedFactors` fatores REAIS com o contexto de agora, e
 * declara quais foram. Nunca mistura silenciosamente.
 *
 * @returns null quando não existe nem um único trade resolvido comparável
 *   — ausência honesta, nunca um objeto vazio que se leria como "memória
 *   consultada e nada encontrado de relevante".
 */
export function recallContext(
  results: TradeCostResult[],
  fingerprint: string | null,
  minSharedFactors = 2,
): ContextualRecall | null {
  if (!fingerprint || !Array.isArray(results) || results.length === 0) return null;

  const groups = groupResultsByFingerprint(results);

  // 1. Match exato.
  const exact = groups.get(fingerprint) ?? [];
  if (exact.length >= MEMORY_MIN_SAMPLE) {
    return {
      fingerprint,
      matchLevel: "EXATO",
      matchedFactors: realFactors(fingerprint),
      sample: exact.length,
      strength: strengthFor(exact.length),
      stats: computeExpectancy(exact),
    };
  }

  // 2. Match parcial — só sobre fatores com leitura real, e só quando o
  //    número de fatores compartilhados alcança o mínimo pedido.
  const wanted = new Set(realFactors(fingerprint));
  if (wanted.size < minSharedFactors) {
    // Nem o contexto de agora tem fatores reais suficientes para procurar
    // semelhança sem inventá-la.
    return exact.length > 0
      ? {
          fingerprint,
          matchLevel: "EXATO",
          matchedFactors: realFactors(fingerprint),
          sample: exact.length,
          strength: strengthFor(exact.length),
          stats: null,
        }
      : null;
  }

  let best: { factors: string[]; rows: TradeCostResult[] } | null = null;
  const buckets = new Map<string, { factors: string[]; rows: TradeCostResult[] }>();

  for (const [fp, rows] of groups) {
    const shared = realFactors(fp).filter((t) => wanted.has(t));
    if (shared.length < minSharedFactors) continue;
    const key = shared.slice().sort().join("|");
    const bucket = buckets.get(key);
    if (bucket) bucket.rows.push(...rows);
    else buckets.set(key, { factors: shared, rows: [...rows] });
  }

  for (const bucket of buckets.values()) {
    // Prefere o grupo com MAIS fatores em comum; empate desempata pela
    // amostra maior. Nunca o maior grupo genérico sobre o mais parecido.
    if (
      best === null ||
      bucket.factors.length > best.factors.length ||
      (bucket.factors.length === best.factors.length && bucket.rows.length > best.rows.length)
    ) {
      best = bucket;
    }
  }

  if (best === null) {
    return exact.length > 0
      ? {
          fingerprint,
          matchLevel: "EXATO",
          matchedFactors: realFactors(fingerprint),
          sample: exact.length,
          strength: strengthFor(exact.length),
          stats: null,
        }
      : null;
  }

  const strength = strengthFor(best.rows.length);
  return {
    fingerprint,
    matchLevel: "PARCIAL",
    matchedFactors: best.factors,
    sample: best.rows.length,
    strength,
    stats: strength === "AMOSTRA_INSUFICIENTE" ? null : computeExpectancy(best.rows),
  };
}

/**
 * Frase curta e honesta para a UI. Sempre diz o TAMANHO da amostra junto
 * com o resultado — um número sem amostra ao lado é exatamente o tipo de
 * afirmação que este projeto não faz.
 */
export function describeRecall(recall: ContextualRecall | null): string | null {
  if (recall === null) return null;
  const escopo = recall.matchLevel === "EXATO" ? "neste contexto" : "em contexto parecido";

  if (recall.strength === "AMOSTRA_INSUFICIENTE" || recall.stats === null) {
    return `${recall.sample} operação(ões) real(is) ${escopo} — amostra insuficiente para leitura`;
  }

  const wins = Math.round(recall.stats.winRate * recall.stats.totalTrades);
  const preliminar = recall.strength === "AMOSTRA_PRELIMINAR" ? ", amostra preliminar" : "";
  // Contagem observada + expectância em R. Nunca "% de chance".
  return `${wins} de ${recall.stats.totalTrades} ${escopo} fecharam no ganho · expectativa real ${recall.stats.expectancyR.toFixed(2)}R${preliminar}`;
}
