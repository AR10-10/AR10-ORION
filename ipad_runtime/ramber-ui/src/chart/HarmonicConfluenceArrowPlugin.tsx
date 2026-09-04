// HarmonicConfluenceArrowPlugin.tsx — pedido direto do Operador ("SMC
// Harmonic Fusion"): quando um padrão harmônico XABCD/Wolfe real
// (harmonic-patterns.ts) tem confluência institucional real e suficiente
// no ponto D (smc-harmonic-fusion.ts — Order Block, Fair Value Gap, POC,
// candle de exaustão, sweep de liquidez), o gráfico ganha uma SETA
// triangular clara no ponto de entrada — verde/para cima em LONG, vermelha
// /para baixo em SHORT. Mesma arquitetura de overlay já estabelecida por
// CandlePatternMarkersPlugin/StructureBreakMarkersPlugin (canvas próprio,
// dirty-flag + rAF, ResizeObserver, fio de seda) — zero segunda
// arquitetura, e MESMA linguagem visual de triângulo (só maior: um sinal
// de alta convicção institucional merece mais peso visual que um padrão
// de vela isolado).
//
// Regra de Ouro do Operador, aplicada literalmente: SEM confluência real
// suficiente, esta camada não desenha NADA — o `fusion` recebido já vem
// filtrado por App.tsx (só o melhor hit CONFIRMADO, ou null). Esta camada
// nunca decide sozinha o que é "confirmado" — só desenha o que já foi
// decidido rio acima, mesma separação de responsabilidade que o resto do
// canvas já segue (motor decide, plugin só desenha).
//
// LEI 24: display only. Confluência/contexto sobre o Núcleo — nunca uma
// segunda decisão de trading, nunca bloqueia/substitui LONG/SHORT/WAIT.
import { useEffect, useRef } from "react";
import { getChartLayerZIndex } from "./chart-layer-depth";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { SmcHarmonicFusionResult } from "../nexus/smc-harmonic-fusion";
import { drawCanvasLabel } from "../nexus/canvas-label";
import { chartPaletteRgba } from "./canvas-palette";

interface HarmonicConfluenceArrowPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number }[];
  fusion: SmcHarmonicFusionResult | null;
}

export function HarmonicConfluenceArrowPlugin({ chart, series, data, fusion }: HarmonicConfluenceArrowPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ fusion, data });
  const markDirtyRef = useRef<(() => void) | null>(null);

  stateRef.current = { fusion, data };

  useEffect(() => {
    markDirtyRef.current?.();
  }, [fusion, data]);

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

      const { fusion: f, data: candles } = stateRef.current;
      if (!f || !f.confirmed) return; // sem confluência real suficiente — nada desenhado, honesto.
      const point = candles[f.hit.completedAtIndex];
      if (!point) return; // índice D fora da janela real carregada.

      const timeScale = chart.timeScale();
      const x = timeScale.timeToCoordinate(point.time as unknown as Time);
      const yAnchor = series.priceToCoordinate(f.hit.points.D.price);
      if (x === null || yAnchor === null) return; // fora da área visível agora — fail-closed, nunca extrapola.

      const bullish = f.hit.direction === "BULLISH";
      const color = bullish ? chartPaletteRgba("bullish", 0.95) : chartPaletteRgba("bearish", 0.95);
      // Mesma convenção real de terminal já usada por CandlePatternMarkersPlugin
      // (nunca escolha estética): viés de alta nasce ABAIXO do ponto, viés de
      // baixa nasce ACIMA — a seta aponta na direção de onde o movimento vem.
      const OFFSET = 18; // maior que os 14px do padrão de vela: sinal de convicção mais alta.
      const y = bullish ? yAnchor + OFFSET : yAnchor - OFFSET;

      const H = 9; // maior que os 5px do padrão de vela isolado — mesmo motivo do offset.
      ctx.beginPath();
      if (bullish) {
        ctx.moveTo(x, y - H);
        ctx.lineTo(x - H, y + H);
        ctx.lineTo(x + H, y + H);
      } else {
        ctx.moveTo(x, y + H);
        ctx.lineTo(x - H, y - H);
        ctx.lineTo(x + H, y - H);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Rótulo: só a contagem de confluência (o nome do padrão + fitScore já
      // aparece na etiqueta PRZ ao lado, desenhada pela linha de preço do
      // próprio harmônico — repetir aqui seria a poluição que a disciplina
      // de compactação (EPC §4) já pede para evitar).
      const label = `SMC ${f.matchedCount}/5`;
      const labelY = bullish ? y + H + 2 : y - H - 12;
      drawCanvasLabel(ctx, x - 14, labelY, { fill: color, text: label });
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

    const timeScale = chart.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(markDirty);
    const resizeObserver = new ResizeObserver(markDirty);
    resizeObserver.observe(canvas);
    markDirty();

    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(markDirty);
      resizeObserver.disconnect();
      markDirtyRef.current = null;
    };
  }, [chart, series]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: getChartLayerZIndex("harmonics") }}
    />
  );
}
