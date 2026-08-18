// decision-distance.ts — "quanto por cento falta pra LONG e pra SHORT"
// (pedido direto do Operador, no cabeçalho, ao lado do orbe de voz).
//
// O PROBLEMA COM A PERGUNTA, E A RESPOSTA HONESTA
// ------------------------------------------------------------------
// "Quanto falta pra LONG" tem duas leituras possíveis:
//
//   (a) "qual a PROBABILIDADE de virar LONG" — proibida neste repositório
//       (CLAUDE.md, Regra de Ouro 2). Não existe backtest real aqui que
//       sustente uma probabilidade calibrada; qualquer número desses seria
//       inventado.
//
//   (b) "qual a DISTÂNCIA até o limiar real que faria o Núcleo emitir
//       LONG" — determinística, medível, verificável, e é exatamente a
//       pergunta que um operador faz olhando a tela.
//
// Este motor responde (b). Nada aqui é uma previsão.
//
// DE ONDE VEM O LIMIAR (medido, não suposto)
// ------------------------------------------------------------------
// A cadeia real de decisão do Core Engine é curta e foi rastreada
// inteira:
//
//   js/real-data/analysis-frame.js   → produz last_price / sma / ema
//   js/research/research-engine.js   → trendBias(frame) decide ALTA/BAIXA/
//                                      NEUTRO a partir SÓ desses 3 números
//   js/research/trade-setup-matrix.js→ ALTA ⇒ 'LONG', BAIXA ⇒ 'SHORT',
//                                      resto ⇒ 'WAIT'
//   ramber-ui/src/engine-bridge.ts   → repassa como realCycle.signal
//   App.tsx                          → engine.direction (CoreSignalBadge)
//
// Ou seja, o limiar REAL é literalmente:
//
//   LONG  ⇔ last_price > sma  E  ema >= sma
//   SHORT ⇔ last_price < sma  E  ema <= sma
//
// Nenhuma outra camada participa (LEI 24). Então "quanto falta" é uma
// subtração, não uma opinião — e é a leitura mais honesta que este
// terminal pode dar dessa pergunta.
//
// AS DUAS CONDIÇÕES, E POR QUE O MAIOR GAP MANDA
// ------------------------------------------------------------------
// São DUAS desigualdades simultâneas, não uma. Para virar LONG faltam as
// duas coisas ao mesmo tempo:
//   • preço acima da SMA        → gap de PREÇO
//   • EMA em cima ou acima da SMA → gap de MÉDIA
//
// Uma condição já satisfeita tem gap 0. A distância até a decisão é a
// condição AINDA NÃO satisfeita que está MAIS LONGE — o max, nunca a
// média (uma média diria "falta pouco" quando uma das duas condições
// está longe, o que seria falso). Devolvemos junto QUAL das duas está
// mandando (`binding`), porque essa é a informação acionável: dizer "0,4%"
// sem dizer se é o preço ou a média que está travando é meia leitura.
//
// UNIDADE
// ------------------------------------------------------------------
// Os dois gaps são expressos como % do preço atual, na MESMA escala, de
// propósito: são grandezas de preço (a SMA e a EMA vivem em unidade de
// preço), e o operador pensa em "quanto por cento". Comparar um contra o
// outro em unidades diferentes daria um max sem sentido.
//
// LIMITAÇÃO REAL, DECLARADA (nunca escondida no tooltip)
// ------------------------------------------------------------------
// Esta é uma distância ESTÁTICA, medida no instante da leitura. Ela NÃO
// diz que o preço vai andar essa distância, nem quando. E o próprio
// limiar se move: last_price, sma e ema saem todos da mesma série de
// candles fechados (analysis-frame.js), então no próximo candle os três
// mudam juntos — a fronteira anda. É "onde estou em relação à linha
// AGORA", não "quanto falta pra cruzar" no sentido temporal.
//
// Por isso o rótulo na tela nunca diz "chance"; diz distância.

/** Entrada: os 3 números REAIS que o Core Engine já usa. Nada mais.
 *  Se algum não for finito, a leitura inteira fail-closes. */
export interface DecisionDistanceInput {
  lastPrice: number | null | undefined;
  sma: number | null | undefined;
  ema: number | null | undefined;
  /** ATR% REAL de Wilder (período 14), do Market Regime Engine
   *  (src/market-regime/regime-engine.js::atrPercent). Auditado nesta rodada
   *  como a ÚNICA implementação de ATR do repositório inteiro — todos os
   *  consumidores (eta-engine, aura-lifecycle, multi-timeframe, risk) são
   *  passthrough dela, zero segunda fórmula. Opcional de propósito: sem ATR
   *  real, a leitura em ATR não existe; nunca é estimada. */
  atrPercent?: number | null;
}

/** Qual das duas desigualdades está travando o lado. `null` quando o lado
 *  já está satisfeito (distância 0). */
export type DecisionDistanceBinding = "price" | "ema" | null;

export interface DecisionDistanceSide {
  /** % do preço atual que falta para ESTE lado passar a valer. 0 = já vale. */
  gapPercent: number;
  /** A MESMA distância, medida em ATR de Wilder. `null` sem ATR real. */
  atrUnits: number | null;
  /** Qual condição manda nessa distância — a que está mais longe. */
  binding: DecisionDistanceBinding;
  /** As duas parcelas cruas, para o tooltip poder explicar sem recalcular. */
  pricePercent: number;
  emaPercent: number;
}

export interface DecisionDistanceReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  /** O lado que JÁ está satisfeito agora — o mesmo veredito de trendBias(). */
  current: "LONG" | "SHORT" | "NEUTRO" | null;
  long: DecisionDistanceSide | null;
  short: DecisionDistanceSide | null;
}

const INSUFFICIENT: DecisionDistanceReading = {
  status: "DADOS_INSUFICIENTES",
  current: null,
  long: null,
  short: null,
};

/** Gap não-negativo em % do preço: quanto `from` precisa andar para
 *  alcançar `to`. Já satisfeito ⇒ 0 exato (nunca um negativo disfarçado). */
function gapPct(distance: number, price: number): number {
  if (distance <= 0) return 0;
  return (distance / price) * 100;
}

/** A distância em UNIDADES DE VOLATILIDADE REALIZADA.
 *
 *  POR QUE ISTO TORNA A LEITURA MAIS INTELIGENTE (e não é enfeite): "falta
 *  0,84%" é um número sem escala. 0,84% é quase nada num mercado que anda 3%
 *  por vela e é uma eternidade num que anda 0,2%. O operador que olha só o
 *  percentual precisa ter a volatilidade na cabeça para interpretá-lo — e é
 *  exatamente isso que o terminal deveria fazer por ele.
 *
 *  Normalizar distância por ATR é prática padrão de mesa (é a mesma unidade
 *  que o próprio Risk Engine deste repositório já usa para dimensionar risco:
 *  "unidade de risco = max(distância do stop, ATR%)"), nunca uma métrica
 *  inventada aqui. A conta é uma divisão — ambos já estão em % do preço, então
 *  a razão é adimensional e direta.
 *
 *  Fail-closed: ATR ausente, não-finito ou <= 0 devolve null. Um ATR zero
 *  dividiria por zero e produziria Infinity, que a UI mostraria como um número
 *  gigante e falso. */
function atrUnitsOf(gapPercent: number, atrPercent: number | null | undefined): number | null {
  if (!Number.isFinite(atrPercent as number)) return null;
  const atr = atrPercent as number;
  if (atr <= 0) return null;
  return gapPercent / atr;
}

function side(pricePercent: number, emaPercent: number, atrPercent?: number | null): DecisionDistanceSide {
  // O max manda: as duas condições são simultâneas (E lógico), então a
  // que está mais longe é a que define quando o lado passa a valer.
  const gapPercent = Math.max(pricePercent, emaPercent);
  // Já satisfeito nas duas ⇒ nada travando. Empate exato entre as duas
  // (as duas travando igualmente) resolve para "price": é a que o
  // Operador consegue observar direto na tela, e a EMA se move como
  // consequência do preço, nunca ao contrário.
  const binding: DecisionDistanceBinding =
    gapPercent === 0 ? null : pricePercent >= emaPercent ? "price" : "ema";
  return { gapPercent, atrUnits: atrUnitsOf(gapPercent, atrPercent), binding, pricePercent, emaPercent };
}

/**
 * Distância real até cada lado da decisão do Core Engine.
 *
 * Fail-closed (Regra de Ouro 3): sem os 3 números reais e finitos, ou com
 * preço <= 0 (divisão por zero / preço impossível), devolve
 * DADOS_INSUFICIENTES explícito — nunca um 0% que o Operador leria como
 * "está colado no limiar".
 */
export function computeDecisionDistance(input: DecisionDistanceInput): DecisionDistanceReading {
  const price = input.lastPrice;
  const sma = input.sma;
  const ema = input.ema;
  if (!Number.isFinite(price) || !Number.isFinite(sma) || !Number.isFinite(ema)) return INSUFFICIENT;
  const p = price as number;
  const s = sma as number;
  const e = ema as number;
  if (p <= 0) return INSUFFICIENT;

  // LONG exige  p > s  E  e >= s.
  const longSide = side(gapPct(s - p, p), gapPct(s - e, p), input.atrPercent);
  // SHORT exige p < s  E  e <= s.
  const shortSide = side(gapPct(p - s, p), gapPct(e - s, p), input.atrPercent);

  // `current` reproduz trendBias() EXATAMENTE — mesma desigualdade, mesma
  // ordem, incluindo o caso de borda p === s (que não satisfaz nem > nem <,
  // e portanto é NEUTRO nos dois lados). Nunca uma segunda classificação:
  // se este veredito divergisse do badge do Núcleo, a tela mostraria duas
  // verdades diferentes sobre a mesma coisa.
  const current: DecisionDistanceReading["current"] =
    p > s && e >= s ? "LONG" : p < s && e <= s ? "SHORT" : "NEUTRO";

  return { status: "OK", current, long: longSide, short: shortSide };
}

/** Formatação única da distância — uma decisão só de arredondamento para
 *  toda a UI (badge, tooltip, qualquer consumidor futuro). Abaixo de
 *  0.01% o número arredondado viraria "0.00%", que se confunde com "já
 *  satisfeito": esse caso vira "<0.01%", nunca um zero enganoso. */
export function formatDecisionDistance(gapPercent: number | null | undefined): string {
  if (!Number.isFinite(gapPercent)) return "—";
  const g = gapPercent as number;
  if (g === 0) return "0%";
  if (g < 0.01) return "<0.01%";
  return `${g.toFixed(2)}%`;
}

/** A distância em ATR, formatada. Uma decisão só de arredondamento, como o
 *  formatador de porcentagem irmão. "0.3× ATR" lê-se direto: "menos de um
 *  terço de uma vela típica". Abaixo de 0.05× vira "<0.05×" pelo mesmo motivo
 *  que o percentual tem piso: um "0.00×" arredondado se confundiria com
 *  "já satisfeito". */
export function formatAtrUnits(atrUnits: number | null | undefined): string {
  if (!Number.isFinite(atrUnits)) return "—";
  const u = atrUnits as number;
  if (u === 0) return "0×";
  if (u < 0.05) return "<0.05×";
  return `${u.toFixed(2)}× ATR`;
}

/** Frase honesta do que está travando este lado — o texto real que vai ao
 *  tooltip. Nunca fala em chance/probabilidade. */
export function describeDecisionDistance(
  reading: DecisionDistanceReading,
  which: "long" | "short",
): string {
  if (reading.status !== "OK") return "Sem leitura real do Núcleo ainda (candles insuficientes).";
  const s = which === "long" ? reading.long : reading.short;
  if (!s) return "Sem leitura real do Núcleo ainda.";
  const label = which === "long" ? "LONG" : "SHORT";
  if (s.gapPercent === 0) {
    return `${label} já satisfeito: as duas condições reais do Núcleo (preço vs SMA e EMA vs SMA) valem agora.`;
  }
  const what =
    s.binding === "price"
      ? `o preço precisa andar ${formatDecisionDistance(s.pricePercent)}`
      : `a EMA precisa andar ${formatDecisionDistance(s.emaPercent)} em relação à SMA`;
  // A leitura em ATR entra SÓ quando existe ATR real. Sem ela, a frase
  // simplesmente não menciona volatilidade — nunca uma escala inventada.
  const escala = s.atrUnits === null ? "" : ` Em volatilidade real: ${formatAtrUnits(s.atrUnits)} (ATR de Wilder 14).`;
  return (
    `Distância real até o limiar de ${label} do Núcleo: ${what}. ` +
    `Preço/SMA: ${formatDecisionDistance(s.pricePercent)} · EMA/SMA: ${formatDecisionDistance(s.emaPercent)}.` +
    escala +
    ` É distância medida agora, não probabilidade — e o limiar se move a cada candle novo.`
  );
}
