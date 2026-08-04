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

export interface ChartRangeInput {
  candles: PublicationCandle[];
  entryLow: number | null;
  entryHigh: number | null;
  stopPrice: number | null;
  targetPrices: number[];
  livePrice: number | null;
}

export interface PriceRange {
  min: number;
  max: number;
}

export function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Faixa de preço real do mini-gráfico. Candles + Entry/Stop/preço vivo
 * SEMPRE entram (o núcleo do plano nunca fica cortado de fora do quadro).
 * Alvos só esticam a escala até um teto de 2.5x a amplitude do núcleo —
 * um Target 3 muito distante permanece um NÚMERO real no bloco de texto de
 * cada formato (nunca escondido/fabricado), só não força o mini-gráfico a
 * espremer os candles recentes até virar ruído ilegível.
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

  for (const v of [input.entryLow, input.entryHigh, input.stopPrice, input.livePrice]) {
    if (isFiniteNum(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  // Achado real da verificação visual: 3 alvos R:R igualmente espaçados
  // (o caso mais comum de um Trade Plan real) esbarravam no teto de 2.5x
  // quase sempre — TP1/TP2 entravam, TP3 ficava de fora por uma margem
  // pequena (achado concreto: candle range ~4250, TP3 a 10700 do mínimo,
  // teto de 2.5x = 10625 — falhava por 0.7%). 4x mantém o mesmo princípio
  // (nunca deixar um alvo isolado e distante esmagar os candles recentes)
  // sem cortar o caso comum de 3 alvos reais igualmente espaçados.
  const coreRange = max - min || Math.abs(max) * 0.01 || 1;
  const cap = coreRange * 4;
  for (const t of input.targetPrices) {
    if (!isFiniteNum(t)) continue;
    const candidateMin = Math.min(min, t);
    const candidateMax = Math.max(max, t);
    if (candidateMax - candidateMin <= cap) {
      min = candidateMin;
      max = candidateMax;
    }
  }

  const pad = (max - min) * 0.08 || Math.abs(max) * 0.01 || 1;
  return { min: min - pad, max: max + pad };
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

  // Candles reais — textura de fundo, deliberadamente sem grid/eixo (§3:
  // composição editorial, não um clone do terminal com réguas).
  const slot = rect.width / candles.length;
  const bodyWidth = Math.max(1, slot * 0.62);
  candles.forEach((c, i) => {
    const cx = rect.x + slot * i + slot / 2;
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

  const withinRange = (p: number) => p >= range.min && p <= range.max;
  const labelPad = 6;

  const drawLevelLine = (price: number, color: string, label: string, lineWidth: number) => {
    if (!withinRange(price)) return;
    const y = priceToY(price);
    drawSilkLine(ctx, rect.x, y, rect.x + rect.width, y, color, lineWidth);
    const textW = ctx.measureText(label).width;
    drawText(ctx, label, rect.x + rect.width - textW - labelPad, y - labelPad, {
      font: `700 ${labelFontSize}px ${MONO_FONT}`,
      color,
      align: "left",
    });
  };

  // Entry (zona) — linha superior/inferior da zona real, nunca um único
  // preço fabricado quando o plano é uma faixa.
  if (isFiniteNum(plan.entryLow) && isFiniteNum(plan.entryHigh)) {
    drawLevelLine(plan.entryHigh!, PUB_COLORS.cyan, `ENTRY ${fmtPrice(plan.entryHigh!)}`, 2);
    if (plan.entryHigh !== plan.entryLow) {
      drawLevelLine(plan.entryLow!, PUB_COLORS.cyan, `ENTRY ${fmtPrice(plan.entryLow!)}`, 2);
    }
  }
  if (isFiniteNum(plan.stopPrice)) {
    drawLevelLine(plan.stopPrice!, PUB_COLORS.short, `STOP ${fmtPrice(plan.stopPrice!)}`, 2);
  }
  plan.targets.forEach((t) => {
    drawLevelLine(t.price, PUB_COLORS.long, `TP${t.index + 1} ${fmtPrice(t.price)}`, 2);
  });

  // Preço vivo — a MESMA leitura do topo do card, nunca uma segunda fonte.
  if (isFiniteNum(plan.livePrice) && withinRange(plan.livePrice!)) {
    const y = priceToY(plan.livePrice!);
    drawSilkLine(ctx, rect.x, y, rect.x + rect.width, y, PUB_COLORS.textPrimary, 1);
  }
}
