// smc-harmonic-fusion.ts — fusão ADITIVA entre a geometria harmônica pura
// (harmonic-patterns.ts, jamais reescrita aqui) e as confluências
// institucionais SMC/ICT já computadas em paralelo no mesmo ciclo de
// render (App.tsx): Order Block, Fair Value Gap, Point of Control, candle
// de exaustão (Doji) e sweep de liquidez (Equal High/Low) — pedido direto
// do Operador ("SMC Harmonic Fusion").
//
// Antes desta peça os 5 motores rodavam lado a lado sem nunca se
// cruzarem: harmonic-patterns.ts detecta um XABCD/Wolfe só pela razão de
// Fibonacci/geometria, e o gráfico desenhava QUALQUER padrão com
// fitScore >= MIN_FIT_SCORE, sem checar nenhuma confluência real. Esta
// camada não muda o motor geométrico (continua emitindo exatamente os
// mesmos hits de sempre — Regra de Ouro 4: nunca apaga funcionalidade) —
// só decide, com evidência real, se o ponto D tem confluência
// institucional suficiente para o gráfico DESENHAR a estrutura e (função
// irmã em smc-harmonic-arrow.ts) plotar uma seta.
//
// Calibração confirmada com o Operador via AskUserQuestion: exigir os 5
// fatores SIMULTANEAMENTE (leitura literal de "OB + FVG + POC
// obrigatórios") tende a nunca dispar em dado real — três zonas de tipos
// diferentes raramente ocupam exatamente o mesmo preço. A opção escolhida
// foi "mínimo N de 5 fatores": cada fator é checado contra o dado real
// (nunca um placeholder) e CONTADO; MIN_CONFLUENCE_FACTORS é o piso
// exigido. Nenhum backtest real sustenta que este N específico é "ótimo"
// (Regra de Ouro 2) — é um parâmetro de calibração documentado, ajustável
// com dado real depois, nunca uma probabilidade calibrada.
import type { HarmonicPatternHit } from "./harmonic-patterns";
import type { PriceZone, LiquidityZone, CandlePattern } from "../engine-bridge";
// Mesma tolerância já documentada como reusável para "preço real X está
// perto o bastante de Y para contar como a mesma referência" —
// institutional-zones.ts e layer-relevance.ts já a citam uma da outra;
// esta é a terceira aplicação do mesmo precedente, nunca um novo número
// inventado.
import { INSTITUTIONAL_ZONE_PROXIMITY_PCT } from "./institutional-zones";

export const SMC_FUSION_CONTRACT_VERSION = 1 as const;

export type SmcFusionFactorId =
  | "ORDER_BLOCK"
  | "FAIR_VALUE_GAP"
  | "POINT_OF_CONTROL"
  | "EXHAUSTION_CANDLE"
  | "LIQUIDITY_SWEEP";

export const SMC_FUSION_FACTOR_IDS: SmcFusionFactorId[] = [
  "ORDER_BLOCK",
  "FAIR_VALUE_GAP",
  "POINT_OF_CONTROL",
  "EXHAUSTION_CANDLE",
  "LIQUIDITY_SWEEP",
];

// Piso padrão: mais da metade dos 5 fatores reais. Documentado como
// calibração, não medição (ver cabeçalho) — ajustável via parâmetro sem
// tocar nesta constante.
export const MIN_CONFLUENCE_FACTORS = 3;

// Janela de candles ao redor de D em que uma vela de exaustão (Doji) real
// ainda conta como "no vértice" — o próprio Doji pode SER a vela D, ou a
// confirmação pode levar 1 candle a mais para fechar. Não é uma tolerância
// de preço (os outros 4 fatores usam INSTITUTIONAL_ZONE_PROXIMITY_PCT);
// é uma janela de índice, porque exaustão é um evento de TEMPO, não de
// zona de preço.
export const EXHAUSTION_INDEX_WINDOW = 1;

export interface SmcFusionFactorResult {
  factor: SmcFusionFactorId;
  matched: boolean;
}

export interface SmcHarmonicFusionResult {
  hit: HarmonicPatternHit; // passthrough puro — o motor geométrico não muda
  factors: SmcFusionFactorResult[];
  matchedCount: number;
  minFactors: number;
  confirmed: boolean; // matchedCount >= minFactors
}

export interface SmcFusionInputs {
  harmonicHits: HarmonicPatternHit[];
  orderBlocks: PriceZone[];
  fairValueGaps: PriceZone[];
  liquidityZones: LiquidityZone[];
  /** null = POC real indisponível nesta janela — o fator simplesmente não
   *  pode bater (fail-closed), nunca tratado como "bateu". */
  pocPrice: number | null;
  candlePatterns: CandlePattern[];
  minFactors?: number;
  proximityPct?: number;
}

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Mesma fórmula de distância percentual já usada em toda a base (ex.:
// withinPct em App.tsx, EQUAL_TOLERANCE_PCT em fvg-order-block-engine.js)
// — reimplementada aqui como função nomeada e pura porque a versão de
// App.tsx é uma closure privada sobre o preço AO VIVO, não exportável, e
// esta camada compara contra o preço HISTÓRICO do ponto D.
function pctDistance(a: number, b: number): number | null {
  if (!fin(a) || !fin(b) || b === 0) return null;
  return (Math.abs(a - b) * 100) / Math.abs(b);
}

function zoneContainsPrice(zone: PriceZone, price: number, proximityPct: number): boolean {
  if (!fin(zone.top) || !fin(zone.bottom) || !fin(price)) return false;
  const top = Math.max(zone.top, zone.bottom);
  const bottom = Math.min(zone.top, zone.bottom);
  if (price >= bottom && price <= top) return true;
  const nearestEdge = price > top ? top : bottom;
  const dist = pctDistance(price, nearestEdge);
  return dist !== null && dist <= proximityPct;
}

function matchOrderBlock(hit: HarmonicPatternHit, zones: PriceZone[], proximityPct: number): boolean {
  const d = hit.points.D.price;
  return zones.some((z) => z.type === hit.direction && zoneContainsPrice(z, d, proximityPct));
}

function matchFairValueGap(hit: HarmonicPatternHit, zones: PriceZone[], proximityPct: number): boolean {
  const d = hit.points.D.price;
  return zones.some((z) => z.type === hit.direction && zoneContainsPrice(z, d, proximityPct));
}

function matchPointOfControl(hit: HarmonicPatternHit, pocPrice: number | null, proximityPct: number): boolean {
  if (!fin(pocPrice)) return false; // fail-closed: POC indisponível nunca conta como confluência
  const dist = pctDistance(hit.points.D.price, pocPrice);
  return dist !== null && dist <= proximityPct;
}

function matchExhaustionCandle(hit: HarmonicPatternHit, patterns: CandlePattern[]): boolean {
  const dIndex = hit.completedAtIndex;
  return patterns.some(
    (p) => p.kind === "INDECISION" && Math.abs(p.index - dIndex) <= EXHAUSTION_INDEX_WINDOW,
  );
}

// BULLISH (reversão pra cima esperada em D) precisa de um EQUAL_LOW
// varrido (stop-hunt abaixo, o "combustível" clássico do fundo em D);
// BEARISH espelhado com EQUAL_HIGH.
function matchLiquiditySweep(hit: HarmonicPatternHit, zones: LiquidityZone[], proximityPct: number): boolean {
  const wantType = hit.direction === "BULLISH" ? "EQUAL_LOW" : "EQUAL_HIGH";
  const d = hit.points.D.price;
  return zones.some((z) => z.type === wantType && z.swept && fin(z.price) && (pctDistance(d, z.price) ?? Infinity) <= proximityPct);
}

/** Avalia CADA hit harmônico recebido contra as 5 confluências reais e
 *  devolve, para todos eles, quais fatores bateram e se o piso mínimo foi
 *  atingido — nunca filtra a lista de entrada, nunca esconde um fator que
 *  não bateu (a lista `factors` sempre tem os 5, `matched: false` incluso,
 *  para o painel poder mostrar honestamente o que faltou). O CHAMADOR
 *  decide o que fazer com `confirmed` (desenhar ou não) — esta função é
 *  pura avaliação, zero desenho, zero estado. */
export function evaluateSmcHarmonicFusion(inputs: SmcFusionInputs): SmcHarmonicFusionResult[] {
  const minFactors = inputs.minFactors ?? MIN_CONFLUENCE_FACTORS;
  const proximityPct = inputs.proximityPct ?? INSTITUTIONAL_ZONE_PROXIMITY_PCT;
  const orderBlocks = inputs.orderBlocks ?? [];
  const fairValueGaps = inputs.fairValueGaps ?? [];
  const liquidityZones = inputs.liquidityZones ?? [];
  const candlePatterns = inputs.candlePatterns ?? [];

  return (inputs.harmonicHits ?? []).map((hit) => {
    const factors: SmcFusionFactorResult[] = [
      { factor: "ORDER_BLOCK", matched: matchOrderBlock(hit, orderBlocks, proximityPct) },
      { factor: "FAIR_VALUE_GAP", matched: matchFairValueGap(hit, fairValueGaps, proximityPct) },
      { factor: "POINT_OF_CONTROL", matched: matchPointOfControl(hit, inputs.pocPrice ?? null, proximityPct) },
      { factor: "EXHAUSTION_CANDLE", matched: matchExhaustionCandle(hit, candlePatterns) },
      { factor: "LIQUIDITY_SWEEP", matched: matchLiquiditySweep(hit, liquidityZones, proximityPct) },
    ];
    const matchedCount = factors.filter((f) => f.matched).length;
    return { hit, factors, matchedCount, minFactors, confirmed: matchedCount >= minFactors };
  });
}
