// LiquiditySweepLinesPlugin.tsx — fecha o resíduo documentado em
// chart-layer-depth.ts (CHART_NATIVE_CANVAS_Z_INDEX): `liquidity_sweep`
// era a última camada declarada "event" (z=50) mas desenhada por
// `series.createPriceLine(...)` nativo, preso ao z=35 compartilhado das
// 6 primitivas nativas restantes — abaixo dos eventos de canvas reais
// (BOS/CHOCH, padrão de vela, harmônico). Mesma arquitetura de overlay já
// estabelecida por SessionKeyLevelsPlugin (linha horizontal real via
// canvas, measurePlotArea pra nunca correr por baixo do eixo, rAF +
// ResizeObserver) — zero segunda arquitetura, só mais uma instância dela
// pra este dado real.
//
// FONTE: os MESMOS traps (TrapSignal[], trap-detection.ts) + o MESMO
// clusterSweptPrices/LIQUIDITY_PROXIMITY_PCT + o MESMO SWEEP_DECAY/
// ageAlpha que já geravam a price line nativa (removidos de
// EnhancedChart_110_Percent.tsx neste mesmo commit) — zero segunda
// lógica de clusterização/decaimento, só migra o DESENHO.
//
// GEOMETRIA: full-width (x=0 até plotRight), exatamente como a price
// line nativa sempre desenhou — nunca truncada pelo instante do evento
// (diferente de SessionKeyLevelsPlugin, que começa a linha na hora real
// em que a sessão abriu). Um sweep é um evento pontual, mas a REFERÊNCIA
// de preço que ele deixou sempre foi mostrada por onde o Operador olhar
// no histórico — mudar isso não fazia parte do pedido (só o z-index).
//
// COR: canônica `attention` (matiz 38°) — o rgba(255,162,0,...) nativo
// que este plugin substitui já MEDIA matiz 38° (chartRgbToHsl(255,162,0)
// = 38°, idêntico ao canônico attention 245,158,11 = 38° depois de
// arredondar) — nunca foi realmente "2° do Liquidation Heatmap" como o
// comentário antigo dizia; ver correção em LiquidationHeatmapPlugin.tsx.
// Usar chartPaletteRgba() em vez do triplo redigitado fecha esse resíduo
// junto.
import { useEffect, useRef } from "react";
import { getChartLayerZIndex } from "./chart-layer-depth";
import { measurePlotArea } from "./chart-plot-area";
import type { ChartProfileLaneId } from "./chart-profile-lanes";
import { ageAlpha, type DecayConfig } from "./annotation-decay";
import { chartPaletteRgba } from "./canvas-palette";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { TrapSignal } from "../nexus/trap-detection";
import { clusterSweptPrices } from "../nexus/trap-detection";
import { LIQUIDITY_PROXIMITY_PCT } from "../nexus/layer-relevance";

// Fonte única do decaimento real (Etapa 10 EPC OMEGA FINAL) — exportada
// porque EnhancedChart_110_Percent.tsx também precisa dela para as
// etiquetas do eixo (priceAxisLabels), mesmo cluster/mesma idade, nunca
// uma segunda constante que poderia divergir em silêncio.
export const SWEEP_DECAY: DecayConfig = { fadeStartCandles: 50, expireCandles: 200, minAlpha: 0.12 };

interface LiquiditySweepLinesPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { length: number };
  traps: TrapSignal[] | undefined;
  // Achado real (auditoria "cada item no seu canto, nada cobrindo nada"):
  // sem isto a linha de sweep ia de x=0 até plotRight puro — cruzando a
  // lane do Volume Profile/TPO/Order Book Depth quando ativas.
  // Opcional/fail-closed.
  activeLanes?: readonly ChartProfileLaneId[];
}

export function LiquiditySweepLinesPlugin({ chart, series, data, traps, activeLanes }: LiquiditySweepLinesPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ data, traps, activeLanes });
  const markDirtyRef = useRef<(() => void) | null>(null);

  stateRef.current = { data, traps, activeLanes };

  useEffect(() => {
    markDirtyRef.current?.();
  }, [data, traps, activeLanes]);

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

      const { data: candles, traps: list, activeLanes: lanes } = stateRef.current;
      if (!Array.isArray(list) || list.length === 0) return;

      const { plotRight } = measurePlotArea(chart, cssWidth, lanes);

      // Mesma dedup por preço + clusterização real já usada pelo bloco de
      // etiquetas do eixo (priceAxisLabels) — 1 cluster real = 1 linha,
      // nunca 1 linha por nível bruto (achado real do Operador, ver
      // histórico do commit que introduziu clusterSweptPrices aqui).
      const seenSweepPrices = new Set<number>();
      ctx.lineWidth = 1;
      for (const t of list) {
        if (t.kind !== "STOP_HUNT_TOPO" && t.kind !== "STOP_HUNT_FUNDO") continue;
        const uniqueLevels = t.sweptLevels.filter((l) => Number.isFinite(l.price) && !seenSweepPrices.has(l.price));
        uniqueLevels.forEach((l) => seenSweepPrices.add(l.price));

        for (const cluster of clusterSweptPrices(uniqueLevels, LIQUIDITY_PROXIMITY_PCT)) {
          const age = candles.length - 1 - cluster.latestIndex;
          const alpha = ageAlpha(age, SWEEP_DECAY);
          if (alpha <= 0) continue; // expirado (>200 candles) — some da tela, dado real intacto em trap-detection.ts.

          const y = series.priceToCoordinate(cluster.avgPrice);
          if (y === null) continue; // fora da faixa de preço visível agora — fail-closed, nunca extrapola.
          const yLine = Math.round(y) + 0.5;

          // Fio de Seda (Regra de Ouro 5): 1px sólida real, nunca setLineDash.
          ctx.strokeStyle = chartPaletteRgba("attention", alpha * 0.85);
          ctx.beginPath();
          ctx.moveTo(0, yLine);
          ctx.lineTo(plotRight, yLine);
          ctx.stroke();
        }
      }
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

    markDirty();

    return () => {
      markDirtyRef.current = null;
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      resizeObserver.disconnect();
    };
  }, [chart, series]);

  return (
    <canvas
      ref={canvasRef}
      data-plugin="liquidity-sweep-lines"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex("liquidity_sweep") }}
    />
  );
}
