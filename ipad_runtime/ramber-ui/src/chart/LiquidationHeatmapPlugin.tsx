// LiquidationHeatmapPlugin.tsx — OMEGA CORE V-MAX Fase 8.1 ("heatmap real
// de liquidação"). Mesma arquitetura já provada de VolumeProfilePlugin/
// LiquidityZonesPlugin: <canvas> overlay próprio, dirty-flag +
// requestAnimationFrame (nunca loop perpétuo), geometria SEMPRE via
// series.priceToCoordinate() real da lib — as barras nunca "descolam" no
// pan/zoom vertical, e o zoom naturalmente revela mais intensidade por
// nível (buckets ficam mais altos/separados) sem nenhum código extra.
//
// Honestidade retrospectiva (ver nexus/liquidation-heatmap.ts): isto é
// densidade real de liquidações que JÁ ACONTECERAM nesta sessão — nunca
// um mapa preditivo de onde posições SERIAM liquidadas (esse tipo de
// produto exige dados privados de leverage/OI por posição que nenhuma
// exchange publica). Barras ancoradas à ESQUERDA (Volume Profile já
// ancora à direita) — de propósito, para os dois heatmaps por preço
// coexistirem sem se sobrepor visualmente (FASE 4, "um objeto gráfico por
// evento real").
//
// Composição real por bucket: cada barra é 2 segmentos empilhados — LONG
// (verde, mesma paleta LONG_RGB de NeuralMarketAuraPlugin) desenhado
// primeiro, SHORT (vermelho, SHORT_RGB) continuando de onde o segmento
// LONG termina. O comprimento total = magnitude real (longNotionalUsd +
// shortNotionalUsd) / maxBucketNotionalUsd — mostra volume real E
// composição real no mesmo traço, nunca dois desenhos concorrentes.
//
// "Fio de Seda" (Regra de Ouro 5): zero setLineDash, zero lineWidth != 1
// — só o rótulo do bucket de maior notional real (mesmo papel do POC do
// Volume Profile) usa uma linha, 1px sólida.
import { useEffect, useRef } from "react";
import { getChartLayerZIndex } from "./chart-layer-depth";
import { CHART_LEFT_EDGE_FRACTION } from "./chart-profile-lanes";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { computeLiquidationHeatmap, type LiquidationHeatmapResult } from "../nexus/liquidation-heatmap";
import type { LiquidationEvent } from "../engine-bridge";
// Diretriz Final de Lapidação Visual, Adendo, Parte 11: rótulo de pico
// virou caixa real (mesma primitiva de LiquidityZonesPlugin/
// KillZoneBandsPlugin/InstitutionalZonePlugin).
import { drawCanvasLabel, measureCanvasLabel } from "../nexus/canvas-label";
import { chartPaletteRgba } from "./canvas-palette";

// Faixa ESQUERDA declarada (chart-profile-lanes.ts). O 0.14 continua o mesmo
// número que este plugin sempre usou — mudou de dono: agora é a reserva
// compartilhada da borda esquerda, não uma constante local que ninguém mais
// enxergava. Foi justamente isso que produziu a colisão com as etiquetas
// estruturais do lado esquerdo (LEFT_MARGIN_PX = 2 no PriceLabelStackPlugin):
// o comentário antigo dizia "nunca compete com o Volume Profile" — verdade, o
// VP está à direita; ninguém tinha olhado a ESQUERDA.
const MAX_BAR_WIDTH_FRACTION = CHART_LEFT_EDGE_FRACTION;
const LONG_FILL = "rgba(8, 153, 129, 0.28)";
const SHORT_FILL = "rgba(242, 54, 69, 0.28)";
// Correção real (auditoria de conteúdo, 2026-09-02 — "remove o que não
// tem utilidade"): este comentário dizia "H50 puro... a 17° real de
// Liquidity Sweep (H33)" — não bate com o código real. O tom aqui e o do
// Sweep (LiquiditySweepLinesPlugin.tsx) sempre foram o MESMO triplo
// (255,162,0) desde antes desta migração — nunca 17° apart. Medido:
// chartRgbToHsl(255,162,0) = 38°, idêntico à família canônica `attention`
// (245,158,11 = 38°) depois de canvas-palette.ts consolidar as 6 famílias
// — a diferenciação de 17° descrita aqui foi superada por essa
// consolidação numa rodada posterior e a prosa nunca foi atualizada. Os
// dois eventos (pico de liquidação ao vivo, sweep já ocorrido) hoje se
// distinguem por FORMA/papel visual (rótulo de pico vs. linha horizontal
// de referência), nunca por sub-matiz — mesmo princípio que `bullish`/
// `bearish` já aplicam a dezenas de elementos diferentes no resto do
// canvas. Kill Zones (âmbar, banda vertical de fundo) nunca competiu com
// nenhum dos dois — geometria diferente, isso continua verdade.
const PEAK_LABEL_COLOR = chartPaletteRgba("attention", 0.85);

interface LiquidationHeatmapPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  liquidations: LiquidationEvent[];
  symbol: string | null;
}

// Formata um valor real em USD de forma honesta — nunca infla a
// magnitude ("$1.4M" só quando a soma real bate 1 milhão de verdade, ver
// header do arquivo/diretiva Fase 8: "never inflate millions/billions if
// the source doesn't provide it").
function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}

export function LiquidationHeatmapPlugin({ chart, series, liquidations, symbol }: LiquidationHeatmapPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef({ liquidations, symbol });
  const markDirtyRef = useRef<(() => void) | null>(null);

  dataRef.current = { liquidations, symbol };

  useEffect(() => {
    markDirtyRef.current?.();
  }, [liquidations, symbol]);

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

      const { liquidations: events, symbol: sym } = dataRef.current;
      const heat: LiquidationHeatmapResult = computeLiquidationHeatmap(events, sym);
      if (heat.status !== "OK" || heat.maxBucketNotionalUsd === null) return; // sem densidade real ainda => nada desenhado, nunca um exemplo

      const maxBarWidth = cssWidth * MAX_BAR_WIDTH_FRACTION;
      let peakBucket = heat.buckets[0];
      for (const b of heat.buckets) if (b.totalNotionalUsd > peakBucket.totalNotionalUsd) peakBucket = b;

      for (const bucket of heat.buckets) {
        if (bucket.totalNotionalUsd <= 0) continue; // bucket sem evento real => sem barra
        const yLow = series.priceToCoordinate(bucket.priceLow);
        const yHigh = series.priceToCoordinate(bucket.priceHigh);
        if (yLow === null || yHigh === null) continue; // fora da área visível — Fail-Closed, nunca extrapola
        const y = Math.min(yLow, yHigh);
        const h = Math.max(1, Math.abs(yLow - yHigh) - 0.5);

        const longW = (bucket.longNotionalUsd / heat.maxBucketNotionalUsd!) * maxBarWidth;
        const shortW = (bucket.shortNotionalUsd / heat.maxBucketNotionalUsd!) * maxBarWidth;
        if (longW > 0) {
          ctx.fillStyle = LONG_FILL;
          ctx.fillRect(0, y, longW, h);
        }
        if (shortW > 0) {
          ctx.fillStyle = SHORT_FILL;
          ctx.fillRect(longW, y, shortW, h);
        }
      }

      // Rótulo real do bucket de maior notional (mesmo papel do POC no
      // Volume Profile) — um único número honesto, nunca um por bucket.
      // Diretriz Final Adendo Parte 11: caixa real (canto suave +
      // contraste garantido) em vez de texto nu — posição igual a antes
      // (base da caixa 1px acima da barra), só a primitiva de desenho
      // muda; measureCanvasLabel resolve a altura real antes de
      // posicionar, nunca um deslocamento aproximado.
      if (peakBucket.totalNotionalUsd > 0) {
        const yLow = series.priceToCoordinate(peakBucket.priceLow);
        const yHigh = series.priceToCoordinate(peakBucket.priceHigh);
        if (yLow !== null && yHigh !== null) {
          const y = Math.min(yLow, yHigh);
          const peakW = (peakBucket.totalNotionalUsd / heat.maxBucketNotionalUsd!) * maxBarWidth;
          const text = formatUsd(peakBucket.totalNotionalUsd);
          const size = measureCanvasLabel(ctx, text);
          drawCanvasLabel(ctx, Math.max(2, peakW + 3), y - 1 - size.height, { fill: PEAK_LABEL_COLOR, text });
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
      data-plugin="liquidation-heatmap"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex("liquidation_heatmap") }}
    />
  );
}
