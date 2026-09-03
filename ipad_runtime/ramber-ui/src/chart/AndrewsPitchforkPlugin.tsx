// AndrewsPitchforkPlugin.tsx — graduação de
// research/engines/andrews-pitchfork-engine.js (Median Line Analysis,
// Alan H. Andrews). Mesma arquitetura provada de todo overlay deste
// projeto (canvas próprio, dirty-flag + rAF, ResizeObserver, cache por
// identidade de referência, fio de seda 1px) — nova instância do padrão,
// nunca uma arquitetura nova.
//
// PROJEÇÃO PARA FRENTE: o garfo só serve projetado. As três retas são
// infinitas por definição, e o que interessa ao Operador é onde elas
// estarão nas próximas barras — não onde estiveram. Reaproveita a técnica
// que o IchimokuPlugin introduziu neste repositório
// (`timeScale().logicalToCoordinate()`), que mapeia um índice LÓGICO
// inclusive além do último candle real para coordenada de tela. Nenhum
// candle é inventado: o motor devolve uma reta em preço-por-BARRA e este
// arquivo só pergunta à timeScale onde a barra k cairia.
//
// FRONTEIRA DO EIXO: as retas param em `plotRight` (chart-plot-area.ts) —
// nunca correm por baixo dos números do preço. Mesma disciplina dos demais
// overlays desde a auditoria da barra lateral.
//
// COR: família "measurement" (canvas-palette.ts), a mesma de Fibonacci/
// VWAP/ZigZag/Ichimoku — "MEDIÇÃO e referência sem viés direcional... tudo
// que mede onde o preço esteve sem opinar para onde vai". É exatamente o
// papel do garfo aqui. A mediana leva mais peso que as paralelas porque é
// ela que define a construção inteira; deliberadamente NÃO usa o par
// verde/vermelho, que nesta paleta significa LONG/SHORT (LEI 24).
//
// O QUE ESTE OVERLAY NÃO DESENHA: nenhum texto de probabilidade. A
// literatura repete "~80% de retorno à mediana" atribuído a Andrews; sem
// backtest real neste repositório isso seria um número fabricado (Regra de
// Ouro 2), e o motor já se recusa a produzi-lo. Ver o cabeçalho dele.
import { useEffect, useRef } from "react";
import { getChartLayerZIndex } from "./chart-layer-depth";
import { measurePlotArea } from "./chart-plot-area";
import type { ChartProfileLaneId } from "./chart-profile-lanes";
import type { IChartApi, ISeriesApi, Time, Logical } from "lightweight-charts";
import { computeAndrewsPitchfork, type AndrewsPitchforkReading } from "../engine-bridge";
import { chartPaletteRgba } from "./canvas-palette";

const LINE_MEDIAN = chartPaletteRgba("measurement", 0.7);
const LINE_PARALLEL = chartPaletteRgba("measurement", 0.4);
const PIVOT_DOT = chartPaletteRgba("measurement", 0.85);
const RAIO_PIVO = 2.5;

/** Quantas barras à frente do último candle o garfo se projeta. O gráfico já
 *  reserva 8-12 barras de folga à direita (chart-ultrawide-scale.ts); 60 é
 *  bem mais que isso de propósito — o que passa da tela fica RECORTADO, não
 *  extrapolado, e aparece quando o Operador arrasta. Mesmo comportamento de
 *  qualquer plataforma profissional. */
const BARRAS_PROJETADAS = 60;

interface AndrewsPitchforkPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number; open: number; high: number; low: number; close: number }[];
  // Achado real (auditoria "cada item no seu canto, nada cobrindo nada"):
  // sem isto o garfo projetado ia até plotRight puro — cruzando a lane
  // do Volume Profile/TPO/Order Book Depth quando ativas. Opcional/
  // fail-closed.
  activeLanes?: readonly ChartProfileLaneId[];
}

export function AndrewsPitchforkPlugin({ chart, series, data, activeLanes }: AndrewsPitchforkPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef(data);
  const activeLanesRef = useRef(activeLanes);
  const markDirtyRef = useRef<(() => void) | null>(null);
  const cacheRef = useRef<{ data: typeof data; reading: AndrewsPitchforkReading | null }>({
    data: [],
    reading: null,
  });

  dataRef.current = data;
  activeLanesRef.current = activeLanes;

  useEffect(() => {
    markDirtyRef.current?.();
  }, [data, activeLanes]);

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
      let reading: AndrewsPitchforkReading | null;
      if (cacheRef.current.data === candles) {
        reading = cacheRef.current.reading;
      } else {
        reading = computeAndrewsPitchfork(candles);
        cacheRef.current = { data: candles, reading };
      }
      // DADOS_INSUFICIENTES (menos de 3 pivôs alternados confirmados) desenha
      // NADA — nunca um garfo com 2 pontos ou uma reta chutada.
      if (!reading || reading.status !== "OK" || !reading.pitchfork) return;

      const { plotRight } = measurePlotArea(chart, cssWidth, activeLanesRef.current);
      const timeScale = chart.timeScale();
      const n = candles.length;
      const fork = reading.pitchfork;

      /** x de um índice de barra, REAL ou projetado. Para barra real usa o
       *  tempo do candle; além do fim da série usa o índice lógico. */
      const xOf = (barIndex: number): number | null => {
        if (barIndex >= 0 && barIndex < n) {
          const c = candles[Math.round(barIndex)];
          if (!c) return null;
          return timeScale.timeToCoordinate(c.time as unknown as Time);
        }
        return timeScale.logicalToCoordinate(barIndex as Logical);
      };
      const yOf = (price: number): number | null =>
        Number.isFinite(price) ? series.priceToCoordinate(price) : null;

      /** Uma das 3 retas, do seu pivô de origem até a projeção. */
      const drawRay = (
        anchor: { index: number; price: number },
        color: string,
      ) => {
        const iDe = fork.p0.index;
        const iAte = n - 1 + BARRAS_PROJETADAS;
        const precoEm = (i: number) => anchor.price + fork.slope * (i - anchor.index);
        const x1 = xOf(iDe);
        const y1 = yOf(precoEm(iDe));
        const x2 = xOf(iAte);
        const y2 = yOf(precoEm(iAte));
        if (x1 === null || y1 === null || x2 === null || y2 === null) return;
        // Recorte na fronteira do eixo: a reta para ali, nunca corre por
        // baixo dos números do preço.
        const xFim = Math.min(x2, plotRight);
        if (xFim <= x1) return;
        const t = (xFim - x1) / (x2 - x1);
        ctx.lineWidth = 1; // fio de seda, sólida (Regra de Ouro 5)
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(xFim, y1 + (y2 - y1) * t);
        ctx.stroke();
      };

      drawRay(fork.median, LINE_MEDIAN);
      drawRay(fork.upper, LINE_PARALLEL);
      drawRay(fork.lower, LINE_PARALLEL);

      // Os 3 pivôs que produziram o garfo. Sem eles a construção é uma
      // afirmação sem endereço — o Operador não consegue conferir de onde
      // saiu a inclinação.
      ctx.fillStyle = PIVOT_DOT;
      for (const p of [fork.p0, fork.p1, fork.p2]) {
        const x = xOf(p.index);
        const y = yOf(p.price);
        if (x === null || y === null || x > plotRight) continue;
        ctx.beginPath();
        ctx.arc(x, y, RAIO_PIVO, 0, Math.PI * 2);
        ctx.fill();
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

  return (
    <canvas
      ref={canvasRef}
      data-plugin="andrews-pitchfork"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex("andrews_pitchfork") }}
    />
  );
}
