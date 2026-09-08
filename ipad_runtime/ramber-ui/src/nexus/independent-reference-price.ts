// independent-reference-price.ts — REFERÊNCIA DE PREÇO INDEPENDENTE DE
// QUALQUER CORRETORA.
//
// ── O PEDIDO E A LACUNA REAL ───────────────────────────────────────────
// Pedido direto do Operador: "localiza qualquer fonte de usar com dados
// reais... pra nós não só depender das corretoras".
//
// Auditoria antes de construir (Disciplina §1 / MASTER ORDER §79) mediu o
// estado real, e ele é mais sutil do que "falta uma fonte":
//
//   Binance · MEXC · Bybit · OKX ....... QUATRO fontes, TODAS corretoras.
//   CoinGecko `/global` ................ JÁ integrado, mas só macro
//                                        (dominância/volume), nunca preço.
//   detectSourceConflict (schema.js) ... JÁ construído e testado, e NUNCA
//                                        exercitado — "com uma única fonte
//                                        real não há ainda um par de
//                                        leituras vivas para comparar"
//                                        (docs/MARKET_DATA_FABRIC.md).
//
// Ou seja: o número de fontes nunca foi o problema. O problema é que todas
// pertencem à MESMA classe. Se as corretaras concordarem num preço errado
// (feed degradado, símbolo trocado, book travado), quatro fontes concordam
// e ninguém percebe. Uma referência AGREGADA fora dessa classe é a única
// leitura capaz de contradizê-las.
//
// Revisão declarada de uma decisão anterior: `coingecko-provider.ts` diz no
// cabeçalho "não um segundo feed de preço BTC/USDT — isso já existe via
// Binance/MEXC". Aquela decisão respondia OUTRA pergunta ("falta preço?").
// A pergunta de agora é "falta preço que não venha de corretora?" — e aí a
// resposta muda. Não é a decisão anterior estando errada; é o requisito
// que mudou.
//
// ── A TOLERÂNCIA NÃO É INVENTADA: É AUTO-REFERENTE ─────────────────────
// Comparar duas fontes exige uma tolerância, e este projeto proíbe fabricar
// limiar. Varredura confirmou que não existe nenhuma constante declarada
// para divergência entre fontes de preço. Então a regra é auto-referente,
// mesma técnica de calibration-freshness.ts:
//
//   > A referência está DIVERGENTE quando cai FORA do spread que as
//   > próprias corretoras já exibem entre si, agora.
//
// Se Binance e MEXC discordam 0.12% entre elas, uma leitura independente a
// 0.08% do meio delas está DENTRO do ruído que o próprio mercado mostra —
// não é conflito. A 0.9%, está fora, e isso é informação real. Zero
// constante, e o piso se adapta sozinho à condição de mercado (spread
// aperta em calmaria, abre em estresse).
//
// Consequência aceita e declarada: com UMA corretora só não há spread para
// medir, e o módulo devolve DADOS_INSUFICIENTES em vez de escolher um
// limiar. Ausência de piso não vira piso fabricado (Regra de Ouro 3).
//
// ── ZERO SEGUNDA IMPLEMENTAÇÃO ─────────────────────────────────────────
// A comparação em si é `detectSourceConflict` (js/real-data/schema.js), que
// já existe, já é testada, e cuja documentação diz exatamente o que este
// módulo precisa: "nunca escolher um valor silenciosamente quando as fontes
// divergem". Este módulo só DECIDE A TOLERÂNCIA e nomeia o resultado.
//
// ── ISOLAMENTO (mesma regra da Ordem A2.1 §16) ─────────────────────────
// A referência NUNCA é fundida no book/preço de nenhuma venue, nem entra
// no Core Engine. É uma segunda opinião exibida ao lado, jamais um valor
// que substitui outro.
//
// LEI 24: leitura de contexto. Zero direção, zero decisão.
// schema.js é JS puro; o projeto resolve com allowJs, então o import é
// direto — mesma fronteira que tests/schema-tradfi.test.ts já atravessa.
// O `as` no ponto de uso é o único lugar que precisa tipar o retorno.
import { detectSourceConflict } from "../../../js/real-data/schema.js";

export interface VenuePriceReading {
  /** Nome real da corretora — sempre preservado, nunca anonimizado. */
  venue: string;
  price: number;
}

export type ReferenceVerdict =
  | "DENTRO_DO_RUIDO_DAS_CORRETORAS"
  | "FORA_DO_RUIDO_DAS_CORRETORAS"
  | "DADOS_INSUFICIENTES";

export interface IndependentReferenceReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  /** Preço agregado real da fonte independente (CoinGecko). */
  referencePrice: number | null;
  /** Meio real das corretoras — (max+min)/2, nunca uma média ponderada
   *  fabricada de fontes com liquidez desconhecida. */
  venueMid: number | null;
  /** Spread REAL entre as corretoras agora. É a tolerância. */
  venueSpreadPct: number | null;
  /** Distância real da referência ao meio das corretoras. */
  divergencePct: number | null;
  /** Quantas corretaras entraram na conta (sempre visível junto do número). */
  venueCount: number;
  verdict: ReferenceVerdict;
}

const INSUFICIENTE = (reason: string, venueCount: number): IndependentReferenceReading => ({
  status: "DADOS_INSUFICIENTES",
  reason,
  referencePrice: null,
  venueMid: null,
  venueSpreadPct: null,
  divergencePct: null,
  venueCount,
  verdict: "DADOS_INSUFICIENTES",
});

const finito = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * Confronta a referência independente com o conjunto real de corretoras.
 * Função pura.
 *
 * @param venues leituras reais por corretora (preço > 0)
 * @param referencePrice preço agregado da fonte independente, ou null
 */
export function evaluateIndependentReference(
  venues: readonly VenuePriceReading[] | null | undefined,
  referencePrice: number | null | undefined,
): IndependentReferenceReading {
  const validas = (Array.isArray(venues) ? venues : []).filter(
    (v) => v && typeof v.venue === "string" && v.venue.length > 0 && finito(v.price),
  );

  if (!finito(referencePrice)) {
    return INSUFICIENTE("Sem leitura da fonte independente agora.", validas.length);
  }
  // Com uma corretora só não há spread real para servir de tolerância, e
  // este módulo NUNCA escolhe um limiar no lugar dele.
  if (validas.length < 2) {
    return INSUFICIENTE(
      `Tolerância vem do spread real entre corretoras — são necessárias 2, há ${validas.length}.`,
      validas.length,
    );
  }

  const precos = validas.map((v) => v.price);
  const max = Math.max(...precos);
  const min = Math.min(...precos);
  const venueMid = (max + min) / 2;
  const venueSpreadPct = ((max - min) / min) * 100;
  const divergencePct = (Math.abs(referencePrice - venueMid) / venueMid) * 100;

  // A comparação é de schema.js — zero segunda implementação. A tolerância
  // é o spread real medido acima.
  const conflito = detectSourceConflict(
    [
      ...validas.map((v) => ({ source_id: v.venue, value: v.price })),
      { source_id: "REFERENCIA_INDEPENDENTE", value: referencePrice },
    ],
    venueSpreadPct,
  ) as { conflict: boolean };

  return {
    status: "OK",
    reason: null,
    referencePrice,
    venueMid,
    venueSpreadPct,
    divergencePct,
    venueCount: validas.length,
    verdict: conflito.conflict === true ? "FORA_DO_RUIDO_DAS_CORRETORAS" : "DENTRO_DO_RUIDO_DAS_CORRETORAS",
  };
}

/** Linha curta para a UI, com os n sempre junto do número. */
export function describeIndependentReference(r: IndependentReferenceReading): string {
  if (r.status !== "OK") return r.reason ?? "sem referência independente";
  const lado = r.verdict === "FORA_DO_RUIDO_DAS_CORRETORAS" ? "FORA" : "dentro";
  return `${lado} do ruído · Δ ${r.divergencePct!.toFixed(3)}% vs spread ${r.venueSpreadPct!.toFixed(3)}% (${r.venueCount} corretoras)`;
}
