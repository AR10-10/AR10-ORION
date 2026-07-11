// VolumeProfilePlugin.tsx — V-MAX Fase 1 (superfície visual): desenha o
// Volume Profile REAL (WASM Quant Core, Fase 1.3) como barras horizontais
// ancoradas à direita do gráfico — a representação clássica de VP — mais a
// linha do POC. Mesma arquitetura provada do LiquidityZonesPlugin/
// OrderFlowHeatmapPlugin: <canvas> overlay próprio, dirty-flag +
// requestAnimationFrame (nunca loop perpétuo), geometria SEMPRE resolvida
// via series.priceToCoordinate() real da lib — as barras nunca "descolam"
// no pan/zoom vertical.
//
// Fonte de dado: a store (useVolumeProfileSnapshot) — diferente das zonas
// SMC (que chegam por props já filtradas pelo ChartWidget), o VP é
// propriedade da store desde a Fase 1.3; assinar o seletor aqui evita
// prop-drilling por dois níveis sem nenhum ganho.
//
// Só o perfil FIXED RANGE é desenhado — sobrepor também o de sessão
// duplicaria barras na mesma faixa de preço e viraria ruído visual; o
// perfil de sessão continua real na store para HUD/agentes (decisão de
// legibilidade documentada, não uma omissão de dado).
//
// "Fio de Seda" (Regra de Ouro 2): a linha do POC é lineWidth = 1 sólida
// (nunca setLineDash). Hierarquia visual por cor/opacidade: HVN mais
// presente, LVN mais tênue — nunca pelo estilo do traço.
//
// Largura máxima das barras: fração documentada da largura do chart
// (legibilidade — o perfil contextualiza, nunca cobre as velas). O VALOR
// de cada barra continua 100% real (proporção volume/maxVolume).
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { useVolumeProfileSnapshot } from "../store/unified-snapshot-store";
import { bucketMidPrice } from "../nexus/volume-profile";

const MAX_BAR_WIDTH_FRACTION = 0.16; // 16% da largura do chart para a barra de maior volume real
const BAR_FILL = "rgba(0, 240, 255, 0.10)";
const BAR_FILL_HVN = "rgba(0, 240, 255, 0.22)";
const BAR_FILL_LVN = "rgba(0, 240, 255, 0.04)";
const POC_LINE = "rgba(0, 240, 255, 0.65)";

interface VolumeProfilePluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
}

export function VolumeProfilePlugin({ chart, series }: VolumeProfilePluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const profile = useVolumeProfileSnapshot();
  const profileRef = useRef(profile);
  const markDirtyRef = useRef<(() => void) | null>(null);

  // Mesmo padrão do LiquidityZonesPlugin: o loop de desenho lê sempre a
  // versão mais recente via ref; o efeito de setup nunca reassina por
  // mudança de dado.
  profileRef.current = profile;

  useEffect(() => {
    markDirtyRef.current?.();
  }, [profile]);

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

      const vp = profileRef.current?.fixedRange;
      if (!vp || vp.histogram.length === 0) return; // sem perfil real => nada desenhado, nunca um exemplo

      const maxVolume = vp.histogram.reduce((a, b) => (b > a ? b : a), 0);
      if (!(maxVolume > 0)) return;

      const maxBarWidth = cssWidth * MAX_BAR_WIDTH_FRACTION;
      const hvn = new Set(vp.hvnIndices);
      const lvn = new Set(vp.lvnIndices);

      for (let i = 0; i < vp.histogram.length; i++) {
        const volume = vp.histogram[i];
        if (!(volume > 0)) continue; // bucket sem negociação real => sem barra
        // Bordas reais do bucket em preço → pixels via a própria lib.
        const bucketWidth = (vp.rangeMax - vp.rangeMin) / vp.bucketCount;
        const priceLow = vp.rangeMin + i * bucketWidth;
        const priceHigh = priceLow + bucketWidth;
        const yLow = series.priceToCoordinate(priceLow);
        const yHigh = series.priceToCoordinate(priceHigh);
        if (yLow === null || yHigh === null) continue; // fora da área visível — Fail-Closed, nunca extrapola
        const y = Math.min(yLow, yHigh);
        const h = Math.max(1, Math.abs(yLow - yHigh) - 0.5);
        const w = (volume / maxVolume) * maxBarWidth;
        ctx.fillStyle = hvn.has(i) ? BAR_FILL_HVN : lvn.has(i) ? BAR_FILL_LVN : BAR_FILL;
        ctx.fillRect(cssWidth - w, y, w, h);
      }

      // POC: linha horizontal fio de seda no preço real do bucket de maior
      // volume — 1px sólida, nunca pontilhada.
      const pocY = series.priceToCoordinate(bucketMidPrice(vp.pocIndex, vp.rangeMin, vp.rangeMax, vp.bucketCount));
      if (pocY !== null) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = POC_LINE;
        ctx.beginPath();
        ctx.moveTo(cssWidth - maxBarWidth, pocY + 0.5);
        ctx.lineTo(cssWidth, pocY + 0.5);
        ctx.stroke();
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

  // width/height explícitos: <canvas> é replaced element — inset:0 sozinho
  // não o estica (achado real da Fase 0.7, verificado via Playwright).
  return (
    <canvas
      ref={canvasRef}
      data-plugin="volume-profile"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
