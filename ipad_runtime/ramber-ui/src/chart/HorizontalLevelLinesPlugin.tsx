// HorizontalLevelLinesPlugin.tsx — GRADUAÇÃO (2026-09-07, "resíduo honesto"
// documentado em chart-layer-depth.ts): substitui `series.createPriceLine(...)`
// nativo por canvas próprio para os consumidores cujo desenho inteiro já era
// "linha horizontal de 1px, axisLabelVisible:false" — premium_discount,
// scenario_projection e pivot_points. Mesma arquitetura de sempre
// (StructureTracePlugin/LiquidityZonesPlugin: canvas próprio, dirty-flag +
// rAF, ResizeObserver) — zero segunda arquitetura.
//
// Por que UM plugin para 3 consumidores: os 3 desenham exatamente a MESMA
// geometria (reta horizontal, 0 até a borda real do plot, 1px sólida) —
// só o preço/cor mudam, e cada chamador já os calcula (Regra de Ouro 4: o
// agrupamento/desenho é compartilhado, a REDUÇÃO — que preço, que cor —
// continua de cada consumidor, mesmo precedente de fractal-swings.js/
// price-clustering.js). Uma segunda implementação da mesma reta seria
// exatamente a duplicação que este projeto audita antes de escrever.
//
// SEM TEXTO, de propósito: as 3 fontes originais já eram
// `axisLabelVisible: false` — o `title` nativo nunca chegava à tela (mesma
// classe de achado já documentada para harmônicos/EQH-EQL antes da correção
// deles). Nenhuma das 3 ganha um rótulo novo aqui, nenhuma perde um rótulo
// que já era visível (Regra de Ouro 4) — pivot_points já tem os PRÓPRIOS
// rótulos "PVT R1"/"PVT PP"/etc. desenhados por quem já os monta hoje;
// scenario_projection/premium_discount são deliberadamente sem rótulo
// (cor é o único sinal, ver comentário original em EnhancedChart_110_Percent.tsx).
//
// LARGURA TOTAL é o comportamento CORRETO aqui — ao contrário do EQH/EQL
// (equal-level-span.ts), pivô/faixa de negociação/projeção não são evidência
// de um trecho específico de candles: valem para toda a janela visível.
// Nunca encurtar por engano.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { getChartLayerZIndex } from "./chart-layer-depth";

export interface HorizontalLevel {
  price: number;
  color: string;
}

interface HorizontalLevelLinesPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  levels: HorizontalLevel[];
  layerId: string;
}

export function HorizontalLevelLinesPlugin({ chart, series, levels, layerId }: HorizontalLevelLinesPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelsRef = useRef(levels);
  const markDirtyRef = useRef<(() => void) | null>(null);

  levelsRef.current = levels;

  useEffect(() => {
    markDirtyRef.current?.();
  }, [levels]);

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
      ctx.lineWidth = 1;
      for (const level of levelsRef.current) {
        if (!Number.isFinite(level.price)) continue;
        const y = series.priceToCoordinate(level.price);
        if (y === null) continue;
        // Fail-closed (Regra de Ouro 3): fora da faixa de preço visível
        // atual, a lib devolve null — nunca extrapolamos pra fora do plot.
        // Meio-pixel pro traço de 1px cair exatamente numa linha de grade
        // física do canvas (Fio de Seda nítido, mesmo truque já usado nos
        // irmãos deste diretório).
        const yCrisp = Math.round(y) + 0.5;
        ctx.strokeStyle = level.color;
        ctx.beginPath();
        ctx.moveTo(0, yCrisp);
        ctx.lineTo(cssWidth, yCrisp);
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
  // não o estica (mesmo achado já documentado no VolumeProfilePlugin).
  return (
    <canvas
      ref={canvasRef}
      data-plugin={layerId}
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex(layerId) }}
    />
  );
}
