// publication/mini-chart.ts — Ordem "AR10 PUBLICATION STUDIO" §4: o gráfico
// é protagonista, mas só desenha PREÇO REAL (candles) + o Trade Plan real
// (Entry/Stop/Target) — nunca VWAP/EMA/sessões/sweeps/BOS-CHOCH/zonas/
// Fibonacci/S-R. A hierarquia pedida ("Entry/Stop/Target não podem ter o
// mesmo peso visual que contexto") é satisfeita da forma mais literal
// possível: o contexto simplesmente não entra na composição publicável —
// decisão documentada, não uma omissão por esquecimento. Isso também
// cumpre §3 (peça editorial, não screenshot do terminal): nenhum destes
// overlays do terminal é reproduzido aqui.
import { PUB_COLORS, drawSilkLine, drawText, fmtPrice, MONO_FONT } from "./canvas-primitives";
import type { PublicationCandle } from "./types";
import { MIN_CHART_CANDLES, RECENT_CANDLES_FOR_EXPORT } from "./types";
import { computeAutoFitPriceRange, isFiniteNum, type PriceRange } from "../nexus/price-range-fit";

export interface ChartRangeInput {
  candles: PublicationCandle[];
  entryLow: number | null;
  entryHigh: number | null;
  stopPrice: number | null;
  targetPrices: number[];
  livePrice: number | null;
}

export type { PriceRange };
export { isFiniteNum };

/**
 * Faixa de preço real do mini-gráfico. Candles + Entry/Stop/preço vivo
 * SEMPRE entram (o núcleo do plano nunca fica cortado de fora do quadro).
 * Alvos só esticam a escala até um teto real (nexus/price-range-fit.ts —
 * MESMO núcleo usado pelo Smart Auto-Fit do gráfico ao vivo) — um Target 3
 * muito distante permanece um NÚMERO real no bloco de texto de cada
 * formato (nunca escondido/fabricado), só não força o mini-gráfico a
 * espremer os candles recentes até virar ruído ilegível. Padding de 8%:
 * exclusivo desta exportação estática (o gráfico ao vivo já tem
 * scaleMargins nativo da lib cuidando do respiro visual).
 */
export function computeChartPriceRange(input: ChartRangeInput): PriceRange | null {
  const { candles } = input;
  if (candles.length === 0) return null;

  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }

  return computeAutoFitPriceRange(
    { min, max },
    {
      entryLow: input.entryLow,
      entryHigh: input.entryHigh,
      stopPrice: input.stopPrice,
      targetPrices: input.targetPrices,
      livePrice: input.livePrice,
    },
    { paddingRatio: 0.08 },
  );
}

export interface MiniChartPlan {
  entryLow: number | null;
  entryHigh: number | null;
  stopPrice: number | null;
  targets: { price: number; index: number; reached: boolean }[];
  livePrice: number | null;
}

export interface MiniChartRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Desenha candles reais (últimos RECENT_CANDLES_FOR_EXPORT) + linhas do
 * plano — a ÚNICA leitura de mercado desenhada é a que já existe em
 * MarketAnalysisPlan (zero segunda fórmula). Entry/Stop/Target ganham
 * linha mais espessa + rótulo cheio; candles são a textura de fundo —
 * essa é a hierarquia pedida (§4), sem precisar de uma segunda camada de
 * "ênfase" — a própria ausência de qualquer overlay concorrente já garante
 * que nada compete com o plano.
 */
export function drawMiniChart(
  ctx: CanvasRenderingContext2D,
  rect: MiniChartRect,
  allCandles: PublicationCandle[],
  plan: MiniChartPlan,
  labelFontSize: number,
): void {
  const candles = allCandles.slice(-RECENT_CANDLES_FOR_EXPORT);
  if (candles.length < MIN_CHART_CANDLES) {
    drawText(ctx, "SEM DADOS DE GRÁFICO SUFICIENTES", rect.x + rect.width / 2, rect.y + rect.height / 2, {
      font: `700 ${labelFontSize}px ${MONO_FONT}`,
      color: PUB_COLORS.textFaint,
      align: "center",
    });
    return;
  }

  const range = computeChartPriceRange({
    candles,
    entryLow: plan.entryLow,
    entryHigh: plan.entryHigh,
    stopPrice: plan.stopPrice,
    targetPrices: plan.targets.map((t) => t.price),
    livePrice: plan.livePrice,
  });
  if (!range) return;

  const priceToY = (price: number) => rect.y + rect.height * (1 - (price - range.min) / (range.max - range.min));

  // Evolução Final §9 (referência visual: eixo de preço discreto de
  // terminais reais): poucos ticks (5 rótulos), só na margem ESQUERDA — o
  // lado DIREITO permanece exclusivo de Entry/Stop/Target (abaixo), nunca
  // dividindo peso com um nível de contexto. Margem medida pela LARGURA
  // REAL do rótulo mais largo (nunca um chute fixo) e RESERVADA antes de
  // plotar os candles — a régua nunca fica por cima de um candle (§8 da
  // Evolução Final: "rótulos sobre velas" é o exato erro a evitar).
  const AXIS_TICKS = 4;
  const axisFont = `500 ${Math.max(9, labelFontSize - 6)}px ${MONO_FONT}`;
  const axisPrices: number[] = [];
  for (let i = 0; i <= AXIS_TICKS; i++) {
    axisPrices.push(range.max - ((range.max - range.min) * i) / AXIS_TICKS);
  }
  ctx.save();
  ctx.font = axisFont;
  const axisLabelMaxWidth = axisPrices.reduce((max, price) => Math.max(max, ctx.measureText(fmtPrice(price)).width), 0);
  ctx.restore();
  const axisMargin = axisLabelMaxWidth + 16;
  const plotX = rect.x + axisMargin;
  const plotWidth = rect.width - axisMargin;

  // Candles reais — textura de fundo. Sem grid cruzando a região
  // operacional (§3 original: composição editorial; §8 da Evolução Final:
  // "evitar linhas cruzando a região operacional sem necessidade") — só um
  // traço curto de 6px por tick, contido na margem do eixo.
  const slot = plotWidth / candles.length;
  const bodyWidth = Math.max(1, slot * 0.62);
  candles.forEach((c, i) => {
    const cx = plotX + slot * i + slot / 2;
    const up = c.close >= c.open;
    const color = up ? PUB_COLORS.candleUp : PUB_COLORS.candleDown;
    const yHigh = priceToY(c.high);
    const yLow = priceToY(c.low);
    const yOpen = priceToY(c.open);
    const yClose = priceToY(c.close);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, yHigh);
    ctx.lineTo(cx, yLow);
    ctx.stroke();
    ctx.fillStyle = color;
    const bodyTop = Math.min(yOpen, yClose);
    const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
    ctx.fillRect(cx - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    ctx.restore();
  });

  axisPrices.forEach((price, i) => {
    const y = rect.y + (rect.height * i) / AXIS_TICKS;
    drawSilkLine(ctx, plotX - 6, y, plotX, y, PUB_COLORS.textFaint, 1);
    drawText(ctx, fmtPrice(price), plotX - 10, y, {
      font: axisFont,
      color: PUB_COLORS.textFaint,
      align: "right",
      baseline: i === 0 ? "top" : i === AXIS_TICKS ? "bottom" : "middle",
    });
  });

  const withinRange = (p: number) => p >= range.min && p <= range.max;
  const labelPad = 6;

  // Entry/Stop/Target continuam cruzando a largura TOTAL do rect (inclusive
  // por trás da margem do eixo) — são o plano REAL, prioridade máxima (§8),
  // a única camada com licença para atravessar a régua de contexto.
  const drawLevelLine = (price: number, color: string, label: string, lineWidth: number) => {
    if (!withinRange(price)) return;
    const y = priceToY(price);
    drawSilkLine(ctx, rect.x, y, rect.x + rect.width, y, color, lineWidth);
    const font = `700 ${labelFontSize}px ${MONO_FONT}`;
    ctx.save();
    ctx.font = font;
    const textW = ctx.measureText(label).width;
    ctx.restore();
    drawText(ctx, label, rect.x + rect.width - textW - labelPad, y - labelPad, {
      font,
      color,
      align: "left",
    });
  };

  // Entry (zona) — linha superior/inferior da zona real, nunca um único
  // preço fabricado quando o plano é uma faixa.
  if (isFiniteNum(plan.entryLow) && isFiniteNum(plan.entryHigh)) {
    drawLevelLine(plan.entryHigh!, PUB_COLORS.cyan, "EN", 2);
    if (plan.entryHigh !== plan.entryLow) {
      drawLevelLine(plan.entryLow!, PUB_COLORS.cyan, "EN", 2);
    }
  }
  if (isFiniteNum(plan.stopPrice)) {
    drawLevelLine(plan.stopPrice!, PUB_COLORS.short, "ST", 2);
  }
  plan.targets.forEach((t) => {
    drawLevelLine(t.price, PUB_COLORS.long, `TP${t.index + 1}`, 2);
  });

  // Preço vivo — a MESMA leitura do topo do card, nunca uma segunda fonte.
  if (isFiniteNum(plan.livePrice) && withinRange(plan.livePrice!)) {
    const y = priceToY(plan.livePrice!);
    drawSilkLine(ctx, rect.x, y, rect.x + rect.width, y, PUB_COLORS.textPrimary, 1);
  }
}
