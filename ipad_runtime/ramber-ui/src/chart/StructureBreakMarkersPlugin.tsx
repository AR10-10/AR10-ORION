// StructureBreakMarkersPlugin.tsx — Ordem "Ciborgue Vivo" §1: anotação
// temporária do rompimento de estrutura mais recente (BOS/CHOCH real,
// bos-choch-engine.js via engine-bridge.ts's computeBosChoch) — "o sistema
// pensa" (marca o rompimento no instante em que a varredura real o
// encontra) "e depois esquece" (mesma decadência por idade real em candles
// que LiquidityZonesPlugin já usa, nunca acumula peso na tela). Mesma
// arquitetura de desenho (Canvas 2D próprio, dirty-flag + rAF,
// ResizeObserver, fio de seda 1px sólido) já estabelecida por
// LiquidityZonesPlugin (V-MAX Fase 0.7) — zero segunda arquitetura de
// overlay, só uma segunda instância dela para um dado real diferente.
//
// LEI 24: display only. BOS/CHOCH é confluência/contexto sobre a estrutura
// do mercado, nunca uma segunda decisão de trading — o único LONG/SHORT/
// WAIT real continua sendo o Core Engine.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { StructureBreak } from "../engine-bridge";
import { ageAlpha, type DecayConfig } from "./annotation-decay";

// BOS/CHOCH é um evento mais "urgente" que uma zona de preço parada — janela
// de destaque pleno mais curta antes de começar a esmaecer (20 candles vs
// os 30 do LiquidityZonesPlugin); mesmo teto final e piso (ver
// annotation-decay.ts — função compartilhada, zero duplicação), mesma
// unidade honesta de "idade" (candles reais desde o rompimento, não
// relógio de parede — funciona igual em qualquer timeframe).
const BREAK_DECAY: DecayConfig = { fadeStartCandles: 20, expireCandles: 100, minAlpha: 0.15 };

interface StructureBreakMarkersPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number }[];
  structureBreak: StructureBreak | null;
}

export function StructureBreakMarkersPlugin({ chart, series, data, structureBreak }: StructureBreakMarkersPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ structureBreak, data });
  const markDirtyRef = useRef<(() => void) | null>(null);

  // Sempre a versão mais recente para o loop de desenho ler — mesmo padrão
  // do LiquidityZonesPlugin (nunca reabre a conexão com o chart a cada
  // atualização de dado).
  stateRef.current = { structureBreak, data };

  useEffect(() => {
    markDirtyRef.current?.();
  }, [structureBreak, data]);

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

      const { structureBreak: brk, data: candles } = stateRef.current;
      if (!brk) return; // sem rompimento real na amostra — nada a desenhar, honesto.
      const point = candles[brk.index];
      if (!point) return; // índice fora da janela real de candles carregada.
      const age = candles.length - 1 - brk.index;
      const alpha = ageAlpha(age, BREAK_DECAY);
      if (alpha <= 0) return; // "esquecido" — só da tela, o dado real segue intacto em engine-bridge.ts.

      const timeScale = chart.timeScale();
      const x1 = timeScale.timeToCoordinate(point.time as unknown as Time);
      const y = series.priceToCoordinate(brk.level);
      if (x1 === null || y === null) return; // fora da área visível agora — Fail-Closed: nunca extrapola.

      const bullish = brk.direction === "ALTA";
      const color = bullish ? "rgba(0, 255, 170, 0.75)" : "rgba(255, 0, 85, 0.75)";
      const yLine = Math.round(y) + 0.5;

      ctx.globalAlpha = alpha;
      // Fio de Seda (Regra de Ouro 2): 1px sólida real, do ponto real de
      // rompimento até a borda direita — mesma primitiva do
      // LiquidityZonesPlugin, nunca setLineDash.
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x1, yLine);
      ctx.lineTo(cssWidth, yLine);
      ctx.stroke();

      // Label elegante: BOS ou CHOCH, no ponto real de rompimento — nunca
      // um ícone genérico, o texto já diz exatamente o que aconteceu.
      ctx.font = "10px -apple-system, sans-serif";
      ctx.fillStyle = color;
      ctx.textBaseline = bullish ? "bottom" : "top";
      ctx.fillText(brk.type, Math.min(x1 + 4, cssWidth - 40), bullish ? y - 3 : y + 3);
      ctx.globalAlpha = 1;
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
