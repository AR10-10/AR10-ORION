// DeltaDivergencePlugin.tsx — graduação de
// research/engines/delta-divergence-engine.js (divergência preço × CVD).
//
// POR QUE SÓ AGORA. Este motor nasceu em 2026-08-24 e ficou registrado como
// "EM QUARENTENA" por uma razão real: o CVD retido cobria ~8 minutos
// (ORDERFLOW_HISTORY_CAPACITY = 120), menos de uma vela em 15m. A retenção
// subiu para 900 (~1 hora, 4 velas inteiras em 15m) no mesmo dia, e o
// registro não acompanhou — ficou uma semana mandando a próxima sessão nem
// olhar para um motor já destravado. O bloqueio virou decisão em aberto; o
// Operador pediu evolução em carta branca, e esta é a decisão.
//
// O DADO VEM DA STORE, NÃO DE PROP. Mesmo padrão já provado pelo
// OrderFlowHeatmapPlugin (`useOrderflowHistory()`): a série de CVD é um ring
// buffer que cresce a cada 4s, e passá-la por prop obrigaria
// EnhancedChart_110_Percent a re-renderizar inteiro a cada ciclo do poller
// só para alimentar um overlay. Regra de Ouro 6/7.
//
// COR: o par bullish/bearish, seguindo o precedente REAL do
// StructureBreakMarkersPlugin (BOS/CHOCH), que é a mesma categoria — um
// EVENTO pontual com direção intrínseca ("aconteceu AQUI, e tem um lado").
// É deliberadamente o oposto da decisão tomada para o Ichimoku na mesma
// rodada, e a diferença é a categoria, não capricho: a nuvem é um CAMPO
// contínuo de fundo que ficaria permanentemente aceso na tela inteira, e
// pintá-la de verde/vermelho leria como um sinal parado; uma divergência é
// uma marca pontual, do mesmo tipo que o BOS já pinta assim desde sempre.
// LEI 24 continua intacta nos dois casos: nenhum dos dois emite direção.
import { useEffect, useRef } from "react";
import { getChartLayerZIndex } from "./chart-layer-depth";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { computeDeltaDivergence, type DeltaDivergenceReading } from "../engine-bridge";
import { useOrderflowHistory } from "../store/unified-snapshot-store";
import { chartPaletteRgba } from "./canvas-palette";

const RAIO_PONTO = 3;

interface DeltaDivergencePluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number; open: number; high: number; low: number; close: number }[];
}

export function DeltaDivergencePlugin({ chart, series, data }: DeltaDivergencePluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orderflowHistory = useOrderflowHistory();
  const dataRef = useRef({ data, orderflowHistory });
  const markDirtyRef = useRef<(() => void) | null>(null);
  const cacheRef = useRef<{
    data: typeof data;
    samples: typeof orderflowHistory;
    reading: DeltaDivergenceReading | null;
  }>({ data: [], samples: [], reading: null });

  dataRef.current = { data, orderflowHistory };

  useEffect(() => {
    markDirtyRef.current?.();
  }, [data, orderflowHistory]);

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

      const { data: candles, orderflowHistory: samples } = dataRef.current;
      let reading: DeltaDivergenceReading | null;
      if (cacheRef.current.data === candles && cacheRef.current.samples === samples) {
        reading = cacheRef.current.reading;
      } else {
        reading = computeDeltaDivergence(candles, samples);
        cacheRef.current = { data: candles, samples, reading };
      }
      // DADOS_INSUFICIENTES (o caso NORMAL em timeframe alto, e o caso
      // inicial em qualquer sessão até o ring encher) desenha NADA — nunca
      // uma divergência sobre CVD extrapolado. O motivo real fica visível
      // no painel de camadas, não escondido aqui.
      if (!reading || reading.status !== "OK" || !reading.divergence) return;

      const d = reading.divergence;
      const de = candles[d.fromIndex];
      const ate = candles[d.toIndex];
      if (!de || !ate) return;

      const timeScale = chart.timeScale();
      const x1 = timeScale.timeToCoordinate(de.time as unknown as Time);
      const x2 = timeScale.timeToCoordinate(ate.time as unknown as Time);
      const y1 = series.priceToCoordinate(d.fromPrice);
      const y2 = series.priceToCoordinate(d.toPrice);
      if (x1 === null || x2 === null || y1 === null || y2 === null) return;

      const baixista = d.type === "BAIXISTA";
      const cor = chartPaletteRgba(baixista ? "bearish" : "bullish", 0.85);

      // A linha de preço: 1px sólida (Regra de Ouro 5, fio de seda).
      ctx.lineWidth = 1;
      ctx.strokeStyle = cor;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Os dois swings confirmados que produziram a leitura. O ponto marca
      // exatamente ONDE o motor olhou — sem eles a linha seria uma
      // afirmação sem endereço.
      ctx.fillStyle = cor;
      for (const [x, y] of [
        [x1, y1],
        [x2, y2],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x, y, RAIO_PONTO, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rótulo curto no swing mais recente. Diz o que É (exaustão de um
      // lado), nunca o que fazer — a divergência marca um LOCAL, não um
      // gatilho, e é essa a própria definição pesquisada do motor.
      const texto = baixista ? "DIV · EXAUSTÃO COMPRADORA" : "DIV · EXAUSTÃO VENDEDORA";
      ctx.font = "10px ui-monospace, monospace";
      ctx.textBaseline = "middle";
      ctx.textAlign = x2 >= cssWidth / 2 ? "right" : "left";
      const dx = x2 >= cssWidth / 2 ? -(RAIO_PONTO + 4) : RAIO_PONTO + 4;
      ctx.fillText(texto, x2 + dx, baixista ? y2 - 9 : y2 + 9);
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
      data-plugin="delta-divergence"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex("delta_divergence") }}
    />
  );
}
