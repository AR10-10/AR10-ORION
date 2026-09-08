// outcome-matrix.ts — MATRIZ DE RESULTADOS (§46 da §2 de "EVOLUÇÃO COMPLETA").
//
// ── A PERGUNTA ─────────────────────────────────────────────────────────
// A expectativa agregada responde "este symbol:timeframe é viável?". O que
// ela nunca respondeu é onde a viabilidade REALMENTE está:
//
//     "os LONG rendem como os SHORT? o sistema ganha em tendência e devolve
//      em lateralização? score alto rende mais que score baixo?"
//
// Uma expectativa de +0.10R pode ser +0.45R nos LONG e −0.25R nos SHORT.
// Agregada, essa informação some — e é exatamente a que muda decisão.
//
// ── MARGINAL, NUNCA PRODUTO CARTESIANO ─────────────────────────────────
// A §46 pede direção × timeframe × ativo × regime × volatilidade ×
// qualidade × confluência. O produto cartesiano desses eixos seria uma
// tabela de centenas de células sobre um histórico de no máximo
// TRACK_RECORD_HISTORY_CAP (100) trades — ou seja, ~0 a 1 trade por célula.
// Cada célula seria ruído puro apresentado com cara de estatística, que é
// precisamente o que a Regra de Ouro 2 proíbe.
//
// Então a matriz é de FATIAS MARGINAIS: um eixo por vez, cada célula com o
// seu próprio n visível. É a leitura que a amostra real deste projeto
// sustenta hoje. O cruzamento de fatores continua existindo e continua
// sendo o trabalho de scenario-fingerprint.ts (que agrupa pela conjunção
// dos 4 fatores) — os dois são complementares, não redundantes: aqui se
// pergunta "o eixo X importa?", lá "esta configuração exata já aconteceu?".
//
// ── PISO DE AMOSTRA: MARCA, NUNCA ESCONDE ──────────────────────────────
// Cada célula declara se cruzou MIN_TRADES_FOR_VALID_EXPECTANCY (30,
// importado de expectancy.ts — zero segunda constante). Abaixo do piso a
// célula NÃO some: ela aparece com `established: false` e o n real, porque
// "5 trades, ainda não sei" é informação, e apagá-la faria o painel mentir
// por omissão. Quem consome decide o peso visual; quem mede nunca esconde.
//
// ── OS EIXOS SÃO SÓ OS QUE TÊM DADO REAL ───────────────────────────────
// Auditoria antes de construir, eixo por eixo da §46:
//
//   direção      → TradeCostResult.direction ................ REAL
//   regime       → TradeCostResult.regime (carimbado na abertura)  REAL
//   qualidade    → TradeCostResult.institutionalScore ....... REAL (esta
//                  rodada: o campo existia em PlanOpenContext e morria na
//                  fronteira de simulateTradeCosts — ver trade-simulation.ts)
//   confluência  → TradeCostResult.modelAgreement ........... REAL
//   ativo/timeframe → NÃO está no TradeCostResult: a amostra JÁ é de um
//                  symbol:timeframe só (trackRecordArchive é keyed por ele).
//                  O eixo existe no arquivo, não nesta lista — por isso
//                  buildArchiveOutcomeMatrix() abaixo é uma função separada.
//   volatilidade → REAL desde o §41 (MASTER ORDER "VOLATILITY AT OPEN"):
//                  `contextAtOpen.atrPercent` é congelado no instante da
//                  abertura, do MESMO regime-engine.js já lido ali. Antes
//                  disto o eixo não existia, e a razão está registrada:
//                  derivar a volatilidade do candle de HOJE para avaliar um
//                  plano de ontem seria olhar o futuro do trade (§40).
//                  Consequência aceita: planos abertos antes do carimbo
//                  ficam null PARA SEMPRE — este campo não pode ser
//                  preenchido retroativamente, e null é excluído da
//                  estatística, nunca lido como "volatilidade zero".
//
// ── OS CORTES NÃO INVENTAM LIMIAR ──────────────────────────────────────
// Os dois eixos numéricos são cortados por fronteiras JÁ DECLARADAS em
// outro lugar do código, nunca por um número escolhido aqui:
//   qualidade   → DEFAULT_MIN_OPPORTUNITY_SCORE (institutional-score.ts),
//                 o mesmo piso que plan-markers.ts já usa para decidir se
//                 desenha a seta de um plano.
//   confluência → o SINAL de modelAgreement, cuja semântica o próprio
//                 trade-simulation.ts declara: "positivo = modelos a favor
//                 da direção efetivamente tomada, negativo = contra".
//
// Toda a matemática por célula é computeExpectancy() (expectancy.ts) —
// zero segunda implementação. Este módulo só FATIA; expectancy.ts calcula.
//
// LEI 24: leitura de histórico. Zero direção, zero decisão.
import type { TradeCostResult } from "./trade-simulation";
import { computeExpectancy, MIN_TRADES_FOR_VALID_EXPECTANCY, type ExpectancyStats } from "./expectancy";
import { DEFAULT_MIN_OPPORTUNITY_SCORE } from "./institutional-score";

/** Eixos com leitura real hoje. `VOLATILIDADE` deliberadamente ausente —
 *  ver o cabeçalho: nenhum motor a congela na abertura. */
export type OutcomeAxis = "DIRECAO" | "REGIME" | "QUALIDADE" | "CONFLUENCIA" | "VOLATILIDADE" | "ATIVO_TIMEFRAME";

/** Os eixos que uma amostra ÚNICA consegue cortar. `ATIVO_TIMEFRAME` fica
 *  de fora por construção, não por esquecimento: a amostra ao vivo é
 *  sempre de um symbol:timeframe só, então cortá-la por esse eixo daria
 *  sempre uma célula — a agregada de novo com outro nome. Esse eixo
 *  atravessa VÁRIAS amostras e tem sua própria função
 *  (buildArchiveOutcomeMatrix). O tipo separado é o que impede um
 *  chamador de pedir o impossível. */
export type MarginalOutcomeAxis = Exclude<OutcomeAxis, "ATIVO_TIMEFRAME">;

export interface OutcomeCell {
  /** Rótulo real da fatia ("LONG", "TENDENCIA_ALTA", "SCORE >= 60"...). */
  label: string;
  trades: number;
  /** Estatística real da fatia — sempre computeExpectancy(), nunca uma 2ª
   *  fórmula. null só com fatia vazia (que este módulo nunca emite). */
  stats: ExpectancyStats | null;
  /** true quando a fatia cruzou MIN_TRADES_FOR_VALID_EXPECTANCY. false NÃO
   *  significa "ruim": significa "ainda não sei", e a célula continua
   *  visível com o n real. */
  established: boolean;
}

export interface OutcomeSlice {
  axis: OutcomeAxis;
  /** Nome legível do eixo, para a UI não reimplementar o mapeamento. */
  title: string;
  /** Trades da amostra que este eixo NÃO conseguiu classificar (campo
   *  ausente no registro). Nunca redistribuídos numa célula "outros" —
   *  ausência não é uma categoria. */
  unclassified: number;
  cells: OutcomeCell[];
}

export interface OutcomeMatrix {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  /** Trades resolvidos que entraram na matriz. */
  sample: number;
  slices: OutcomeSlice[];
}

const AXIS_TITLE: Record<OutcomeAxis, string> = {
  ATIVO_TIMEFRAME: "Ativo × timeframe (arquivo)",
  VOLATILIDADE: "Volatilidade na abertura (ATR%)",
  DIRECAO: "Direção",
  REGIME: "Regime na abertura",
  QUALIDADE: "Qualidade (Institutional Score na abertura)",
  CONFLUENCIA: "Confluência de modelos na abertura",
};

/** Rótulo da fatia, ou null quando o registro não tem o dado real — nunca
 *  um rótulo "DESCONHECIDO", que viraria uma categoria fabricada com
 *  estatística própria. */
type AxisLabeller = (r: TradeCostResult) => string | null;

/** Fábrica: recebe a amostra inteira antes de rotular. Existe por causa da
 *  VOLATILIDADE — o corte dela é a MEDIANA da própria amostra, e mediana
 *  não é decidível olhando um resultado por vez. Os outros eixos ignoram o
 *  argumento (o corte deles vem de limiar já declarado em outro módulo). */
type AxisLabellerFactory = (sample: readonly TradeCostResult[]) => AxisLabeller;

/** Mediana real dos ATR% congelados na abertura. null quando nenhum trade
 *  da amostra tem a leitura (histórico anterior ao carimbo do §41). */
function medianVolatility(sample: readonly TradeCostResult[]): number | null {
  const vals = sample
    .map((r) => r.volatilityAtOpen)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (vals.length === 0) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
}

const AXIS_LABELLER: Record<MarginalOutcomeAxis, AxisLabellerFactory> = {
  DIRECAO: () => (r) => (r.direction === "LONG" || r.direction === "SHORT" ? r.direction : null),
  REGIME: () => (r) => (typeof r.regime === "string" && r.regime.length > 0 ? r.regime : null),
  QUALIDADE: () => (r) =>
    typeof r.institutionalScore === "number" && Number.isFinite(r.institutionalScore)
      ? r.institutionalScore >= DEFAULT_MIN_OPPORTUNITY_SCORE
        ? `SCORE >= ${DEFAULT_MIN_OPPORTUNITY_SCORE}`
        : `SCORE < ${DEFAULT_MIN_OPPORTUNITY_SCORE}`
      : null,
  // O sinal, e só o sinal — a semântica já declarada em trade-simulation.ts.
  // Exatamente 0 é "nenhum modelo pendeu para nenhum lado": categoria real
  // e distinta, nunca somada a favor nem contra.
  // O corte é a MEDIANA DA PRÓPRIA AMOSTRA, nunca um "ATR% alto" universal
  // — que não existe: 1.2% é calmaria num timeframe e tempestade noutro.
  // Auto-referente pela terceira vez neste projeto (calibration-freshness,
  // independent-reference-price), e pelo mesmo motivo: o limiar honesto é o
  // que os próprios dados declaram, não um número escolhido por mim.
  VOLATILIDADE: (sample) => {
    const mediana = medianVolatility(sample);
    return (r) => {
      if (mediana === null) return null;
      const v = r.volatilityAtOpen;
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
      return v >= mediana ? "ACIMA DA MEDIANA" : "ABAIXO DA MEDIANA";
    };
  },
  CONFLUENCIA: () => (r) =>
    typeof r.modelAgreement === "number" && Number.isFinite(r.modelAgreement)
      ? r.modelAgreement > 0
        ? "MODELOS A FAVOR"
        : r.modelAgreement < 0
          ? "MODELOS CONTRA"
          : "MODELOS DIVIDIDOS"
      : null,
};

/** Ordem estável e legível por eixo. Eixos de rótulo fixo têm ordem
 *  declarada (LONG antes de SHORT, score alto antes de baixo — a leitura
 *  que o Operador espera); eixos de rótulo aberto (regime) saem por
 *  amostra decrescente, que é a ordem em que a evidência importa. */
const DECLARED_ORDER: Partial<Record<MarginalOutcomeAxis, string[]>> = {
  DIRECAO: ["LONG", "SHORT"],
  QUALIDADE: [`SCORE >= ${DEFAULT_MIN_OPPORTUNITY_SCORE}`, `SCORE < ${DEFAULT_MIN_OPPORTUNITY_SCORE}`],
  CONFLUENCIA: ["MODELOS A FAVOR", "MODELOS DIVIDIDOS", "MODELOS CONTRA"],
  VOLATILIDADE: ["ACIMA DA MEDIANA", "ABAIXO DA MEDIANA"],
};

/** Uma fatia marginal real. Função pura. */
export function sliceOutcomes(results: readonly TradeCostResult[], axis: MarginalOutcomeAxis): OutcomeSlice {
  const buckets = new Map<string, TradeCostResult[]>();
  let unclassified = 0;
  // A fábrica vê a amostra INTEIRA antes de rotular — é o que permite à
  // VOLATILIDADE usar a mediana real em vez de um limiar inventado.
  const label_de = AXIS_LABELLER[axis](results);

  for (const r of results) {
    const label = label_de(r);
    if (label === null) {
      unclassified++;
      continue;
    }
    const bucket = buckets.get(label);
    if (bucket) bucket.push(r);
    else buckets.set(label, [r]);
  }

  const declared = DECLARED_ORDER[axis];
  const cells: OutcomeCell[] = [...buckets.entries()]
    .map(([label, rows]) => ({
      label,
      trades: rows.length,
      stats: computeExpectancy(rows),
      established: rows.length >= MIN_TRADES_FOR_VALID_EXPECTANCY,
    }))
    .sort((a, b) => {
      if (declared) {
        const ia = declared.indexOf(a.label);
        const ib = declared.indexOf(b.label);
        // Rótulo fora da ordem declarada vai para o fim, nunca some.
        if (ia !== ib) return (ia < 0 ? Number.MAX_SAFE_INTEGER : ia) - (ib < 0 ? Number.MAX_SAFE_INTEGER : ib);
      }
      if (b.trades !== a.trades) return b.trades - a.trades;
      return a.label.localeCompare(b.label);
    });

  return { axis, title: AXIS_TITLE[axis], unclassified, cells };
}

export const ALL_OUTCOME_AXES: MarginalOutcomeAxis[] = ["DIRECAO", "REGIME", "QUALIDADE", "CONFLUENCIA", "VOLATILIDADE"];

/**
 * A matriz inteira sobre uma amostra JÁ simulada (trade-simulation.ts).
 * Função pura, zero recomputação de custo, zero segunda amostra.
 *
 * Um eixo cujo dado nenhum registro tem (regime/score/agreement em
 * histórico anterior ao carimbo) sai com `cells: []` e `unclassified` igual
 * ao tamanho da amostra — visível como "este eixo ainda não tem dado", que
 * é a leitura honesta, nunca uma fatia única fabricada.
 */
export function buildOutcomeMatrix(
  results: readonly TradeCostResult[] | null | undefined,
  axes: readonly MarginalOutcomeAxis[] = ALL_OUTCOME_AXES,
): OutcomeMatrix {
  const sample = Array.isArray(results) ? results : [];
  if (sample.length === 0) {
    return {
      status: "DADOS_INSUFICIENTES",
      reason: "Nenhum trade resolvido ainda — sem amostra para estratificar.",
      sample: 0,
      slices: [],
    };
  }
  return {
    status: "OK",
    reason: null,
    sample: sample.length,
    slices: axes.map((axis) => sliceOutcomes(sample, axis)),
  };
}

/** Fatias que realmente separaram a amostra em 2+ células com dado real —
 *  as únicas que respondem "este eixo importa?". Um eixo com uma célula só
 *  não é comparação, é a agregada de novo com outro nome. */
export function informativeSlices(matrix: OutcomeMatrix): OutcomeSlice[] {
  return matrix.slices.filter((s) => s.cells.length >= 2);
}

/** Maior diferença real de expectativa dentro de uma fatia, em R. null
 *  quando a fatia não tem ao menos 2 células ESTABELECIDAS — comparar uma
 *  célula de 40 trades com uma de 3 produziria um "spread" que é ruído com
 *  cara de achado. */
export function establishedSpreadR(slice: OutcomeSlice): number | null {
  const firmes = slice.cells.filter((c) => c.established && c.stats !== null);
  if (firmes.length < 2) return null;
  const valores = firmes.map((c) => c.stats!.expectancyR);
  return Math.max(...valores) - Math.min(...valores);
}

// ── EIXO ATIVO × TIMEFRAME ─────────────────────────────────────────────
// Separado das fatias acima por um motivo estrutural, não estético: as
// fatias marginais cortam UMA amostra; este eixo atravessa VÁRIAS. O Track
// Record ao vivo é sempre de um symbol:timeframe só — o histórico dos
// outros vive em `trackRecordArchive`, que a store escreve desde a Entrega
// "Memória real" e que NENHUM consumidor lia até aqui (achado desta
// auditoria: dado real acumulando sem ninguém perguntar nada a ele).
//
// R-múltiplo é o que torna a comparação honesta: já vem normalizado pelo
// risco real de cada plano, então BTC 15m e ETH 1h são comparáveis em R
// mesmo com preços e volatilidades completamente diferentes. Comparar em
// pontos de preço seria ilegítimo; em R, não é.
import { simulateTradeCostsBatch } from "./trade-simulation";
import type { TrackRecordState } from "./signal-track-record";

/**
 * Uma célula por chave `symbol:timeframe` do arquivo, com a mesma
 * matemática (computeExpectancy) e o mesmo piso das fatias acima.
 * Chaves sem nenhum trade resolvido são omitidas — nunca uma linha de
 * zeros para um ativo que o Operador só visitou.
 */
export function buildArchiveOutcomeMatrix(
  archive: Record<string, TrackRecordState> | null | undefined,
): OutcomeSlice {
  const entradas = archive && typeof archive === "object" ? Object.entries(archive) : [];
  const cells: OutcomeCell[] = [];

  for (const [key, state] of entradas) {
    if (!state || !Array.isArray(state.history)) continue;
    const rows = simulateTradeCostsBatch(state.history);
    if (rows.length === 0) continue;
    cells.push({
      label: key,
      trades: rows.length,
      stats: computeExpectancy(rows),
      established: rows.length >= MIN_TRADES_FOR_VALID_EXPECTANCY,
    });
  }

  cells.sort((a, b) => (b.trades !== a.trades ? b.trades - a.trades : a.label.localeCompare(b.label)));

  return {
    // Mesmo contrato OutcomeSlice das fatias marginais para a UI não
    // precisar de um 2º renderizador — mas com o SEU PRÓPRIO rótulo de
    // eixo. Reaproveitar "DIRECAO" aqui deixaria o tipo mentindo, e
    // qualquer consumidor que despachasse por `axis` trataria a tabela do
    // arquivo como se fosse a de LONG/SHORT.
    axis: "ATIVO_TIMEFRAME",
    title: AXIS_TITLE.ATIVO_TIMEFRAME,
    unclassified: 0,
    cells,
  };
}
