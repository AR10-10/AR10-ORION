// CvdLinePlugin.tsx — GRADUAÇÃO (2026-09-07, "resíduo honesto" de
// chart-layer-depth.ts): migra a linha de CVD, a ÚLTIMA das 5 camadas
// nativas restantes, para canvas próprio — mesmo motivo de premium_discount/
// scenario_projection/pivot_points/supertrend na mesma rodada: a série
// nativa competia pelo z=35 compartilhado do canvas de velas, em vez de ter
// seu próprio z=40 real via getChartLayerZIndex.
//
// NATUREZA DIFERENTE dos 4 irmãos anteriores (por isso ficou pra última):
// CVD é volume assinado, não preço — vive numa escala de preço PRÓPRIA
// ('cvd', overlay), não na escala das velas. `series.priceToCoordinate()`
// só existe de verdade enquanto HOUVER uma série ligada àquela escala; não
// dá pra converter preço→coordenada de uma escala vazia. Por isso
// EnhancedChart_110_Percent.tsx mantém `cvdSeriesRef` — a MESMA LineSeries
// nativa de sempre, recebendo os MESMOS dados de sempre via setData — só
// com a cor virada TOTALMENTE transparente (zero pixel desenhado por ela).
// Essa série "fantasma" é quem passa aqui como `scaleSeries`: este plugin
// nunca cria uma segunda série nem uma segunda escala, só pede à MESMA
// série sua conversão de coordenada — zero segunda matemática, zero
// segunda fonte de verdade sobre "onde fica o preço 'cvd' tal na tela".
//
// Mesma arquitetura de sempre (StructureTracePlugin/SupertrendPlugin:
// canvas próprio, dirty-flag + rAF, ResizeObserver) — zero segunda
// arquitetura.
//
// "Fio de Seda" (Regra de Ouro 5): 1px sólido real, nunca setLineDash.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time, UTCTimestamp } from "lightweight-charts";
import { getChartLayerZIndex } from "./chart-layer-depth";

// MESMA cor de sempre (byte a byte) — só quem desenha mudou, o sinal visual
// da linha (família neutra de texto, #8ab4f8) continua o mesmo.
const CVD_COLOR = "rgba(138, 180, 248, 0.85)";

interface CvdPoint {
  time: UTCTimestamp;
  value: number;
}

interface CvdLinePluginProps {
  chart: IChartApi | null;
  // A série NATIVA transparente ligada à escala 'cvd' — usada só pela sua
  // API de conversão de coordenada, nunca desenhada diretamente.
  scaleSeries: ISeriesApi<"Line"> | null;
  points: CvdPoint[];
}

export function CvdLinePlugin({ chart, scaleSeries, points }: CvdLinePluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef(points);
  const markDirtyRef = useRef<(() => void) | null>(null);

  pointsRef.current = points;

  useEffect(() => {
    markDirtyRef.current?.();
  }, [points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!chart || !scaleSeries || !canvas) return;

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

      // Fail-closed: sem histórico real de orderflow, nada é desenhado —
      // nunca uma linha extrapolada sobre janela insuficiente.
      if (pointsRef.current.length === 0) return;

      const timeScale = chart.timeScale();
      ctx.strokeStyle = CVD_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let started = false;
      for (const point of pointsRef.current) {
        const x = timeScale.timeToCoordinate(point.time as unknown as Time);
        const y = scaleSeries.priceToCoordinate(point.value);
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
  }, [chart, scaleSeries]);

  // width/height explícitos: <canvas> é replaced element — inset:0 sozinho
  // não o estica (mesmo achado já documentado no VolumeProfilePlugin).
  return (
    <canvas
      ref={canvasRef}
      data-plugin="cvd"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex("cvd") }}
    />
  );
}
