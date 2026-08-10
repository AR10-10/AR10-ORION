// ZigZagPlugin.tsx — Entrega 47 (pedido direto do Operador): graduação do
// research/engines/zigzag-engine.js do Laboratório de Evolução (isolado e
// testado desde a Entrega 35, nunca ligado ao gráfico ao vivo até aqui —
// ver QUARANTINE.md). Desenha os pivôs CONFIRMADOS reais (deviation% +
// depth, pesquisa real documentada no header do motor) como uma linha
// poligonal conectando HIGH/LOW alternados — mesma arquitetura provada de
// todo overlay deste projeto (canvas próprio, dirty-flag + rAF, cache por
// identidade de referência, ResizeObserver).
//
// Fonte de dado: `data`, a MESMA série real de candles já threadada aos
// demais plugins de estrutura (TpoProfilePlugin/StructureBreakMarkers
// Plugin) — zero fetch novo, zero segunda detecção de swing (distinto do
// fractal de K fixo em fractal-swings.js — ZigZag usa limiar %+depth, os
// parâmetros reais do indicador nomeado).
//
// "Fio de Seda" (Regra de Ouro 5): a linha poligonal é 1px sólida real —
// nunca setLineDash. Cor azul-neutro (#8ab4f8), mesma família já usada
// para "estrutura" no resto do HUD (ver TpoProfilePlugin) — deliberado:
// ZigZag é leitura de estrutura de swing, nunca um nível de preço isolado
// (que usaria a família âmbar/liquidez) nem uma direção (verde/vermelho).
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { computeZigZag, type ZigZagPoint } from "../engine-bridge";

const LINE_COLOR = "rgba(138, 180, 248, 0.55)";

interface ZigZagPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number; open: number; high: number; low: number; close: number }[];
}

export function ZigZagPlugin({ chart, series, data }: ZigZagPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef(data);
  const markDirtyRef = useRef<(() => void) | null>(null);
  const cacheRef = useRef<{ data: typeof data; points: ZigZagPoint[] }>({ data: [], points: [] });

  dataRef.current = data;

  useEffect(() => {
    markDirtyRef.current?.();
  }, [data]);

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

      let points: ZigZagPoint[];
      if (cacheRef.current.data === dataRef.current) {
        points = cacheRef.current.points;
      } else {
        points = computeZigZag(dataRef.current);
        cacheRef.current = { data: dataRef.current, points };
      }
      if (points.length < 2) return; // sem pivô suficiente pra uma linha real — nada desenhado, nunca uma linha fabricada

      const timeScale = chart.timeScale();
      ctx.lineWidth = 1;
      ctx.strokeStyle = LINE_COLOR;
      ctx.beginPath();
      let started = false;
      for (const point of points) {
        const candle = dataRef.current[point.index];
        if (!candle) continue;
        const x = timeScale.timeToCoordinate(candle.time as unknown as Time);
        const y = series.priceToCoordinate(point.price);
        if (x === null || y === null) {
          // Fora da janela real de tempo/preço — Fail-Closed (Regra de
          // Ouro 3): nunca extrapola nem reconecta através do gap, a linha
          // só recomeça no próximo pivô realmente visível.
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
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
      data-plugin="zigzag"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
