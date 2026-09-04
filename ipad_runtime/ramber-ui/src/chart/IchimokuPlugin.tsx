// IchimokuPlugin.tsx — graduação de research/engines/ichimoku-engine.js
// (Ichimoku Kinko Hyo, Hosoda). Mesma arquitetura provada de todo overlay
// deste projeto (canvas próprio, dirty-flag + rAF, ResizeObserver, cache
// por identidade de referência, fio de seda 1px) — nova instância do
// padrão, nunca uma arquitetura nova.
//
// A TÉCNICA QUE ESTE PLUGIN INTRODUZ, E POR QUE ELA FOI NECESSÁRIA:
// a nuvem (Kumo) do Ichimoku avança 26 barras ALÉM do último candle — é a
// característica que define o indicador, não um detalhe. Este projeto
// nunca tinha desenhado além do fim da série: o precedente registrado (o
// ápice do Triângulo, a EPA da Wolfe) resolve o futuro mostrando o PREÇO
// como nível + ETA em texto, justamente por não ter candle onde pendurar
// o ponto. Aqui isso não serviria: um Ichimoku sem a nuvem projetada é
// outro indicador.
//
// A saída é `timeScale().logicalToCoordinate(logical)` — API pública da
// lightweight-charts (v5.2) que mapeia um índice LÓGICO, inclusive além do
// último dado real, para coordenada de tela. É a mesma timeScale de sempre,
// só a função de mapeamento que muda; nada aqui inventa candle.
//
// O que fica fora da tela fica recortado, não extrapolado: o gráfico
// reserva 8-12 barras de folga à direita (chart-ultrawide-scale.ts), então
// parte da projeção de 26 barras só aparece quando o Operador arrasta —
// exatamente como em qualquer plataforma profissional.
//
// COR: família "measurement" (canvas-palette.ts) — a mesma de Fibonacci/
// VWAP/ZigZag, que o próprio arquivo define como "MEDIÇÃO e referência sem
// viés direcional... tudo que mede onde o preço esteve sem opinar para onde
// vai". É exatamente o papel do Ichimoku aqui. Deliberadamente NÃO usa o
// par verde/vermelho para nuvem de alta/baixa: nesta paleta esse par
// significa LONG/SHORT, e pintar a nuvem com ele faria uma leitura de
// contexto parecer sinal de entrada (LEI 24). A torção da nuvem (Senkou A
// abaixo de B) continua sendo um fato real — só é reportada como leitura
// (`ichimokuCloudPosition`), nunca codificada numa cor que se leria errado.
import { useEffect, useRef } from "react";
import { getChartLayerZIndex } from "./chart-layer-depth";
import type { IChartApi, ISeriesApi, Time, Logical } from "lightweight-charts";
import { computeIchimoku, type IchimokuResult } from "../engine-bridge";
import { chartPaletteRgba } from "./canvas-palette";

const LINE_TENKAN = chartPaletteRgba("measurement", 0.75);
const LINE_KIJUN = chartPaletteRgba("measurement", 0.5);
const LINE_CHIKOU = chartPaletteRgba("measurement", 0.35);
const CLOUD_FILL = chartPaletteRgba("measurement", 0.1);
const CLOUD_EDGE = chartPaletteRgba("measurement", 0.28);

interface IchimokuPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number; open: number; high: number; low: number; close: number }[];
}

export function IchimokuPlugin({ chart, series, data }: IchimokuPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef(data);
  const markDirtyRef = useRef<(() => void) | null>(null);
  const cacheRef = useRef<{ data: typeof data; result: IchimokuResult | null }>({ data: [], result: null });

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

      const candles = dataRef.current;
      let result: IchimokuResult | null;
      if (cacheRef.current.data === candles) {
        result = cacheRef.current.result;
      } else {
        result = computeIchimoku(candles);
        cacheRef.current = { data: candles, result };
      }
      if (!result) return; // DADOS_INSUFICIENTES — nada desenhado, nunca uma nuvem parcial fabricada

      const timeScale = chart.timeScale();
      const n = candles.length;

      /** x de um candle REAL (índice dentro da série). */
      const xOf = (i: number): number | null => {
        const c = candles[i];
        if (!c) return null;
        return timeScale.timeToCoordinate(c.time as unknown as Time);
      };
      /** x de uma barra FUTURA (índice lógico além do último dado real).
       *  É aqui que a nuvem projetada ganha posição sem inventar candle. */
      const xFuture = (k: number): number | null =>
        timeScale.logicalToCoordinate((n - 1 + k) as Logical);
      const yOf = (price: number): number | null =>
        Number.isFinite(price) ? series.priceToCoordinate(price) : null;

      // ── NUVEM (Kumo) ──────────────────────────────────────────────────
      // Um polígono por trecho CONTÍNUO em que A e B existem: quebrar no
      // buraco é o que impede a lib de "fechar" a nuvem por cima de um vão
      // de dado que não existe.
      type Pt = { x: number; a: number; b: number };
      const segment: Pt[] = [];
      const flushCloud = () => {
        if (segment.length < 2) {
          segment.length = 0;
          return;
        }
        ctx.beginPath();
        ctx.moveTo(segment[0].x, segment[0].a);
        for (let i = 1; i < segment.length; i++) ctx.lineTo(segment[i].x, segment[i].a);
        for (let i = segment.length - 1; i >= 0; i--) ctx.lineTo(segment[i].x, segment[i].b);
        ctx.closePath();
        ctx.fillStyle = CLOUD_FILL;
        ctx.fill();
        // Bordas 1px sólidas (Regra de Ouro 5) — as duas Senkou.
        ctx.lineWidth = 1;
        ctx.strokeStyle = CLOUD_EDGE;
        for (const key of ["a", "b"] as const) {
          ctx.beginPath();
          ctx.moveTo(segment[0].x, segment[0][key]);
          for (let i = 1; i < segment.length; i++) ctx.lineTo(segment[i].x, segment[i][key]);
          ctx.stroke();
        }
        segment.length = 0;
      };

      const pushCloud = (x: number | null, aPrice: number, bPrice: number) => {
        const ya = yOf(aPrice);
        const yb = yOf(bPrice);
        if (x === null || ya === null || yb === null) {
          flushCloud();
          return;
        }
        segment.push({ x, a: ya, b: yb });
      };

      for (let i = 0; i < n; i++) pushCloud(xOf(i), result.senkouA[i], result.senkouB[i]);
      // A projeção continua o MESMO polígono: k=0 é a barra do último
      // candle, então a nuvem histórica e a futura se emendam sem costura.
      for (let k = 0; k < result.futureSenkouA.length; k++) {
        pushCloud(xFuture(k), result.futureSenkouA[k], result.futureSenkouB[k]);
      }
      flushCloud();

      // ── LINHAS (fio de seda 1px sólida) ───────────────────────────────
      const drawSeries = (values: number[], color: string) => {
        ctx.lineWidth = 1;
        ctx.strokeStyle = color;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < values.length; i++) {
          const y = yOf(values[i]);
          const x = xOf(i);
          if (x === null || y === null) {
            started = false; // fail-closed: nunca reconecta através do buraco
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

      drawSeries(result.tenkan, LINE_TENKAN);
      drawSeries(result.kijun, LINE_KIJUN);
      drawSeries(result.chikou, LINE_CHIKOU);
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
      data-plugin="ichimoku"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex("ichimoku") }}
    />
  );
}
