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
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { computeLiquidationHeatmap, type LiquidationHeatmapResult } from "../nexus/liquidation-heatmap";
import type { LiquidationEvent } from "../engine-bridge";
// Diretriz Final de Lapidação Visual, Adendo, Parte 11: rótulo de pico
// virou caixa real (mesma primitiva de LiquidityZonesPlugin/
// KillZoneBandsPlugin/InstitutionalZonePlugin).
import { drawCanvasLabel, measureCanvasLabel } from "../nexus/canvas-label";

const MAX_BAR_WIDTH_FRACTION = 0.14; // fração da largura do chart — camada secundária, nunca compete com o Volume Profile
const LONG_FILL = "rgba(8, 153, 129, 0.28)";
const SHORT_FILL = "rgba(242, 54, 69, 0.28)";
// Lapidação institucional (§9.4/§9.7 de AUDITORIA_ECOSSISTEMA_VISUAL.md):
// H50 puro ("ouro") — era H47 (255,200,0), a 2° de Liquidity Sweep (H45,
// EnhancedChart_110_Percent.tsx). 2° de matiz na mesma luminosidade/
// saturação/alpha é indistinguível a olho; agora a 17° real de Sweep
// (H33, laranja), que segue sendo o mais quente da dupla "evento pontual"
// (ver comentário completo no site do Sweep). Kill Zones (H39, âmbar)
// não entra nesta diferenciação: geometria diferente (banda vertical de
// fundo, alpha 0.06-0.22) nunca compete lado a lado com estas duas linhas.
const PEAK_LABEL_COLOR = "rgba(255, 162, 0, 0.85)";

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
      style={{ width: "100%", height: "100%" }}
    />
  );
}
