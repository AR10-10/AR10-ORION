// MarketSessionBandsPlugin.tsx — EPC OMEGA FINAL, Etapa 10 ("Institutional
// Session Engine: marcar Ásia/Londres/Nova York e mudanças de sessão").
// market-session.ts já calculava a sessão real (Refinamento Final §1) mas
// só aparecia como texto no header — auditoria da Etapa 1 confirmou que a
// mudança de sessão nunca tinha uma marca própria no gráfico. Mesma
// arquitetura de overlay (Canvas 2D próprio, dirty-flag + rAF,
// ResizeObserver, fio de seda 1px sólido) de LiquidityZonesPlugin/
// StructureBreakMarkersPlugin — zero segunda arquitetura, uma terceira
// instância dela para um dado real diferente (transição no tempo, não
// preço/zona).
//
// LEI 24: display only, puro contexto temporal — nunca uma decisão.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { computeSessionBoundaries } from "../nexus/market-session";

// Discreto de propósito — contexto de fundo, nunca compete visualmente com
// estrutura (BOS/CHOCH), liquidez (EQH/EQL) ou o Trade Plan.
const LINE_COLOR = "rgba(148, 163, 184, 0.28)";
const LABEL_COLOR = "rgba(148, 163, 184, 0.75)";
// Evita texto sobreposto em timeframes com transições densas (ex. 4h) — a
// LINHA sempre desenha (informação real), só o TEXTO pode pular quando o
// rótulo anterior está a menos deste tanto de pixels.
const MIN_LABEL_GAP_PX = 56;

interface MarketSessionBandsPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number }[];
}

export function MarketSessionBandsPlugin({ chart, series, data }: MarketSessionBandsPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef(data);
  const markDirtyRef = useRef<(() => void) | null>(null);

  // Sempre a versão mais recente dos candles para o loop de desenho ler —
  // mesmo padrão de LiquidityZonesPlugin/StructureBreakMarkersPlugin.
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

      const boundaries = computeSessionBoundaries(dataRef.current);
      if (boundaries.length === 0) return; // timeframe sem transição real na amostra (ex. candles diários) — honesto, nada a marcar.

      const timeScale = chart.timeScale();
      let lastLabelX = -Infinity;
      ctx.font = "9px -apple-system, sans-serif";
      ctx.textBaseline = "top";

      for (const b of boundaries) {
        const x = timeScale.timeToCoordinate(b.time as unknown as Time);
        if (x === null) continue; // fora da área visível agora — Fail-Closed: nunca extrapola.
        const xLine = Math.round(x) + 0.5;

        // Fio de Seda (Regra de Ouro 5): 1px sólida real, nunca setLineDash.
        ctx.lineWidth = 1;
        ctx.strokeStyle = LINE_COLOR;
        ctx.beginPath();
        ctx.moveTo(xLine, 0);
        ctx.lineTo(xLine, cssHeight);
        ctx.stroke();

        if (x - lastLabelX >= MIN_LABEL_GAP_PX) {
          ctx.fillStyle = LABEL_COLOR;
          ctx.fillText(b.session.label.toUpperCase(), x + 3, 3);
          lastLabelX = x;
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

    markDirty(); // primeiro desenho real assim que o chart/série existem.

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
