// SupertrendPlugin.tsx — GRADUAÇÃO (2026-09-07, "resíduo honesto" de
// chart-layer-depth.ts): migra as 2 LineSeries NATIVAS
// (chart.addSeries(LineSeries)) do SuperTrend (Olivier Seban) para canvas
// próprio — mesmo motivo de premium_discount/scenario_projection/
// pivot_points na mesma rodada: séries nativas competem pelo z=35
// compartilhado do canvas de velas, em vez de terem seu próprio z=40 real
// via getChartLayerZIndex.
//
// Zero segunda matemática: reusa splitSuperTrendSeries (supertrend-series.ts,
// já com execução real testada, é a MESMA função que o harness de
// verificação visual usa) para separar a leitura em dois trechos (ALTA/
// BAIXA) com whitespace onde a outra tendência manda — o candle do FLIP
// entra nas duas de propósito (mesmo preço, sem buraco no instante que mais
// importa). Este plugin só troca COMO o resultado dela é desenhado —
// LineSeries nativa vira polyline de canvas — nunca reimplementa a
// separação em si.
//
// Mesma arquitetura de sempre (StructureTracePlugin: canvas próprio,
// dirty-flag + rAF, ResizeObserver) — zero segunda arquitetura.
//
// "Fio de Seda" (Regra de Ouro 5): 1px sólido real, nunca setLineDash.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time, UTCTimestamp } from "lightweight-charts";
import { splitSuperTrendSeries, type SuperTrendReadingPoint, type SeriesPoint } from "./supertrend-series";
import { getChartLayerZIndex } from "./chart-layer-depth";

// Mesma família verde/vermelho já usada para alta/baixa em todo o gráfico
// (FVG/OB/sessão) — a linha diz "o stop que trilha está embaixo (alta)" ou
// "está em cima (baixa)", exatamente a mesma semântica de direção. Cores
// preservadas byte a byte das LineSeries nativas que este plugin substitui.
const COLOR_UP = "rgba(8, 153, 129, 0.70)";
const COLOR_DOWN = "rgba(242, 54, 69, 0.70)";

interface SupertrendPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number }[];
  points: SuperTrendReadingPoint[];
}

export function SupertrendPlugin({ chart, series, data, points }: SupertrendPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef(data);
  const pointsRef = useRef(points);
  const markDirtyRef = useRef<(() => void) | null>(null);

  dataRef.current = data;
  pointsRef.current = points;

  useEffect(() => {
    markDirtyRef.current?.();
  }, [data, points]);

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

      // Fail-closed: sem aquecimento real de Wilder (pontos vazios), nada é
      // desenhado — nunca uma linha extrapolada sobre janela insuficiente.
      if (pointsRef.current.length === 0) return;

      const { up, down } = splitSuperTrendSeries<UTCTimestamp>(
        pointsRef.current,
        (i) => (dataRef.current[i] ? (dataRef.current[i].time as UTCTimestamp) : undefined),
      );

      const timeScale = chart.timeScale();
      const drawSegment = (segment: SeriesPoint<UTCTimestamp>[], color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        let started = false;
        for (const point of segment) {
          if (point.value === undefined) {
            // Whitespace real (trecho da OUTRA tendência): nunca interpola
            // através do buraco — o próximo trecho começa um traço novo.
            started = false;
            continue;
          }
          const x = timeScale.timeToCoordinate(point.time as unknown as Time);
          const y = series.priceToCoordinate(point.value);
          if (x === null || y === null) {
            // Fora da janela real de tempo/preço — Fail-Closed (Regra de
            // Ouro 3): nunca extrapola nem reconecta através do gap.
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

      drawSegment(up, COLOR_UP);
      drawSegment(down, COLOR_DOWN);
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
      data-plugin="supertrend"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex("supertrend") }}
    />
  );
}
