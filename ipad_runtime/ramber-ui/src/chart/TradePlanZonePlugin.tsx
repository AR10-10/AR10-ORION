// TradePlanZonePlugin.tsx — chart-side companion to the Trade Plan price
// lines already drawn in EnhancedChart_110_Percent.tsx. Ordem Final
// Autonomia Evolução §1: "No gráfico, usar anotações sutis e elegantes
// (linhas finas, caixas semi-transparentes, labels bem posicionados)".
// The entry ZONE (a real low/high range, not a single price) gets a
// translucent fill + 1px solid border ("fio de seda", Regra de Ouro 2) —
// same canvas-overlay technique already proven by LiquidityZonesPlugin
// (dirty-flag + rAF, real price<->pixel conversion via
// series.priceToCoordinate, ResizeObserver). Stop and Target stay as
// single price lines (EnhancedChart_110_Percent) — they are precise
// levels, not ranges, so a box there would fabricate a width the real
// plan doesn't have.
//
// Unlike FVG/Order Block zones, the entry zone has no historical
// "formation candle" to anchor a left edge to — it is a forward-looking,
// currently-valid range, not something that formed at a point in the
// past. It spans the full visible width, matching how the price lines it
// complements already render (createPriceLine is full-width by nature).
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { InstitutionalConfidenceZone } from "../nexus/institutional-score";

interface TradePlanZonePluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  entryLow: number | null;
  entryHigh: number | null;
  // Diretriz Complementar §17 ("Projeção Visual Inteligente"): a MESMA
  // Zona de Confiança Institucional já real (§16, institutional-score.ts)
  // — nunca uma segunda fonte, nunca uma "probabilidade" codificada em
  // opacidade (Regra de Ouro 2). null quando não há score real a bandar
  // (WAIT/DADOS_INSUFICIENTES) — usa o peso neutro default.
  confidenceZone: InstitutionalConfidenceZone | null;
}

// Same exact amber already used for the entry price lines in
// EnhancedChart_110_Percent.tsx (entryColor) — one color per role across
// the whole chart, never a second palette for the same concept.
const ZONE_FILL = "rgba(240, 208, 111, 0.10)";
const ZONE_BORDER = "rgba(240, 208, 111, 0.45)";

// §17: peso visual real por tier — a confluência mais forte lê mais
// nítida, a mais fraca nunca desaparece (piso legível: mesmo a leitura
// "Inválida" ainda é um nível real do plano, nunca deve ficar invisível).
// Parâmetros documentados (mesma natureza dos limiares 70/30 do RSI), não
// uma medição.
const OPACITY_BY_TIER: Record<InstitutionalConfidenceZone["tier"], number> = {
  MUITO_FORTE: 1,
  FORTE: 0.85,
  MODERADA: 0.7,
  FRACA: 0.55,
  INVALIDA: 0.4,
};
// Sem zona real ainda (Core Engine em WAIT/dados insuficientes) — peso
// neutro, nem o teto nem o piso.
const DEFAULT_OPACITY_MULTIPLIER = 0.7;

function opacityMultiplierFor(zone: InstitutionalConfidenceZone | null): number {
  return zone ? OPACITY_BY_TIER[zone.tier] : DEFAULT_OPACITY_MULTIPLIER;
}

function alphaOf(rgba: string): number {
  const m = rgba.match(/,\s*([0-9.]+)\)$/);
  return m ? Number(m[1]) : 1;
}

function withAlpha(rgba: string, alpha: number): string {
  return rgba.replace(/,\s*[0-9.]+\)$/, `, ${alpha.toFixed(3)})`);
}

export function TradePlanZonePlugin({ chart, series, entryLow, entryHigh, confidenceZone }: TradePlanZonePluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rangeRef = useRef({ entryLow, entryHigh, confidenceZone });
  const markDirtyRef = useRef<(() => void) | null>(null);

  // Always the latest range/zone for the draw loop to read — never
  // re-triggers the setup effect below (same technique as LiquidityZonesPlugin).
  rangeRef.current = { entryLow, entryHigh, confidenceZone };

  useEffect(() => {
    markDirtyRef.current?.();
  }, [entryLow, entryHigh, confidenceZone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!chart || !series || !canvas) return;

    let rafScheduled = false;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      if (cssWidth === 0 || cssHeight === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const pxWidth = Math.round(cssWidth * dpr);
      const pxHeight = Math.round(cssHeight * dpr);
      if (canvas.width !== pxWidth || canvas.height !== pxHeight) {
        canvas.width = pxWidth;
        canvas.height = pxHeight;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const { entryLow: low, entryHigh: high, confidenceZone: zone } = rangeRef.current;
      // No plan, or a zero-width zone (single acceptance price): the
      // existing price line already covers it — a box here would
      // fabricate a width the real plan doesn't have.
      if (low === null || high === null || !Number.isFinite(low) || !Number.isFinite(high) || low === high) return;

      const y1 = series.priceToCoordinate(high);
      const y2 = series.priceToCoordinate(low);
      if (y1 === null || y2 === null) return; // outside the visible price range right now — fail-closed, never extrapolate.
      const rectY = Math.min(y1, y2);
      const rectHeight = Math.max(1, Math.abs(y2 - y1));

      // §17: mesma hierarquia fill<border de sempre, só reescalada pela
      // confluência real — nunca um segundo esquema de cor.
      const multiplier = opacityMultiplierFor(zone);
      ctx.fillStyle = withAlpha(ZONE_FILL, alphaOf(ZONE_FILL) * multiplier);
      ctx.fillRect(0, rectY, cssWidth, rectHeight);
      // Fio de Seda: 1px solid real border (Canvas 2D, never setLineDash).
      ctx.lineWidth = 1;
      ctx.strokeStyle = withAlpha(ZONE_BORDER, alphaOf(ZONE_BORDER) * multiplier);
      ctx.strokeRect(0.5, rectY + 0.5, Math.max(0, cssWidth - 1), Math.max(0, rectHeight - 1));
    };

    const markDirty = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        draw();
      });
    };
    markDirtyRef.current = markDirty;

    const onRangeChange = () => markDirty();
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    const resizeObserver = new ResizeObserver(() => markDirty());
    resizeObserver.observe(canvas);

    markDirty(); // first real draw as soon as chart/series exist.

    return () => {
      markDirtyRef.current = null;
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      resizeObserver.disconnect();
    };
  }, [chart, series]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
