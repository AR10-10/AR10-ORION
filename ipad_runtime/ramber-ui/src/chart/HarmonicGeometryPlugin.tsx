// HarmonicGeometryPlugin.tsx — pendência #6 ("chegar na perfeição"), a
// perna remanescente do `harmonics` documentada em chart-layer-depth.ts
// desde a §21 desta trilha: a seta de confluência (Harmonic
// ConfluenceArrowPlugin) já tinha canvas próprio, mas o zigue-zague
// XABCD/Wolfe/Ombro-Cabeça-Ombro, a PRZ/EPA/NECKLINE/APEX e o triângulo
// continuavam desenhados por primitiva NATIVA da lib
// (chart.addSeries(LineSeries)/series.createPriceLine em
// EnhancedChart_110_Percent.tsx), presas ao mesmo z=35 compartilhado que
// `liquidity_sweep` já saiu (§25) — abaixo dos eventos reais de canvas
// (BOS/CHOCH, padrão de vela, a própria seta de confluência harmônica).
// Fecha o resíduo por completo: `harmonics` passa a ter UM canvas
// próprio real, z=50 (event), como já declarado em LAYER_TIER.
//
// ACHADO REAL AUDITANDO O CÓDIGO NATIVO ANTES DE MIGRAR: os 4 rótulos de
// texto (PRZ/EPA/NECKLINE/APEX) desenhados pelo `mkH()` nativo via
// `series.createPriceLine({ axisLabelVisible: false, title })` NUNCA
// apareciam em lugar nenhum da tela — mesma classe de defeito já
// documentada e corrigida para Fibonacci/scenario_projection/POC-VAH-
// VAL-IB/WALL no próprio EnhancedChart_110_Percent.tsx ("o título só
// aparece via axisLabelVisible:true ou uma legenda de hover que este
// gráfico não tem"): com `axisLabelVisible:false` e sem hover, o `title`
// nunca chega à tela — só a cor/posição da linha eram um sinal real.
// `mkH` nunca tinha sido incluído na correção quando ela foi aplicada aos
// outros consumidores. Migrar para canvas é a oportunidade natural de
// consertar isso junto (o mesmo código está sendo reescrito de qualquer
// forma): os 4 rótulos agora desenham de verdade via `drawCanvasLabel`
// (mesma primitiva de HarmonicConfluenceArrowPlugin) — decisão
// deliberada de escopo: NÃO passa pelo sistema de eixo
// (PriceLabelStackPlugin/priceAxisLabels), que exigiria tocar o
// orçamento/anti-colisão do componente pai — mudança maior que esta
// migração não se propôs a fazer de carona. No máximo 3 rótulos
// concorrentes por desenho (PRZ+EPA ou NECKLINE, mais APEX do triângulo),
// nunca a dúzia que motivou SessionKeyLevelsPlugin a mover a dele pro
// eixo.
//
// ZERO SEGUNDA MATEMÁTICA (Regra de Ouro 4): winner-selection entre
// HARMONIC/HEAD_SHOULDERS por fitScore, geometria do zigue-zague,
// slope/intercept do triângulo e da neckline — tudo o MESMO código que já
// vivia no useEffect nativo que este plugin substitui, só movido pra cá.
// Nenhuma fórmula nova.
//
// Mesma arquitetura de canvas já estabelecida (StructureTracePlugin/
// SessionKeyLevelsPlugin/LiquiditySweepLinesPlugin): canvas próprio,
// dirty-flag + rAF, ResizeObserver, subscribeVisibleLogicalRangeChange,
// measurePlotArea (nunca corre por baixo do eixo), Fio de Seda (1px
// sólido, zero setLineDash).
//
// GEOMETRIA FULL-WIDTH preservada para PRZ/EPA/NECKLINE/APEX (0 até a
// fronteira real do eixo) — exatamente o que `series.createPriceLine`
// sempre desenhou. O zigue-zague/triângulo/extensão da neckline são
// segmentos reais entre pontos: fail-closed quando um dos dois extremos
// cai fora da janela visível (nunca extrapola através do gap) — mesma
// convenção já usada por StructureTracePlugin para a mesma classe de
// geometria.
//
// LEI 24: display only. Confluência/contexto sobre o Núcleo — nunca uma
// segunda decisão de trading.
import { useEffect, useRef } from "react";
import { getChartLayerZIndex } from "./chart-layer-depth";
import { measurePlotArea } from "./chart-plot-area";
import { chartPaletteRgba } from "./canvas-palette";
import { drawCanvasLabel, measureCanvasLabel } from "../nexus/canvas-label";
import { formatEtaDuration } from "../nexus/eta-engine";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { HarmonicPatternHit, HarmonicPoint } from "../nexus/harmonic-patterns";
import type { TrianglePatternHit } from "../nexus/triangle-pattern";
import type { HeadShouldersHit } from "../nexus/head-shoulders-pattern";

// Mesma cor roxa exata (rgb(167,139,250) = família canônica "projection",
// travada por canvas-palette.test.ts) que a polilinha/triângulo nativos já
// usavam — zero mudança de identidade visual, só o mecanismo de desenho.
const LINE_COLOR = chartPaletteRgba("projection", 0.55);
const LEVEL_LINE_COLOR = chartPaletteRgba("projection", 0.4);
const LABEL_FILL = chartPaletteRgba("projection", 0.85);

interface HarmonicGeometryPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number }[];
  harmonicHits: HarmonicPatternHit[] | null | undefined;
  trianglePattern: TrianglePatternHit | null | undefined;
  headShouldersPattern: HeadShouldersHit | null | undefined;
}

export function HarmonicGeometryPlugin({
  chart,
  series,
  data,
  harmonicHits,
  trianglePattern,
  headShouldersPattern,
}: HarmonicGeometryPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ data, harmonicHits, trianglePattern, headShouldersPattern });
  const markDirtyRef = useRef<(() => void) | null>(null);

  stateRef.current = { data, harmonicHits, trianglePattern, headShouldersPattern };

  useEffect(() => {
    markDirtyRef.current?.();
  }, [data, harmonicHits, trianglePattern, headShouldersPattern]);

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

      const { data: candles, harmonicHits: hits, trianglePattern: triangle, headShouldersPattern: hs } = stateRef.current;
      const timeScale = chart.timeScale();
      const { plotRight } = measurePlotArea(chart, cssWidth);

      const harmonicTop = hits && hits.length > 0 ? hits[0] : null;
      const harmonicValid = harmonicTop && Number.isFinite(harmonicTop.points.D.price) ? harmonicTop : null;

      // MESMA disputa por fitScore do useEffect nativo original: só as 2
      // famílias de MESMA geometria (zigue-zague por pivôs alternados)
      // competem entre si; o Triângulo desenha sempre que o motor o
      // encontrou, geometria diferente, nunca disputa a mesma área.
      const candidates: Array<{ family: "HARMONIC" | "HEAD_SHOULDERS"; fitScore: number }> = [];
      if (harmonicValid) candidates.push({ family: "HARMONIC", fitScore: harmonicValid.fitScore });
      if (hs) candidates.push({ family: "HEAD_SHOULDERS", fitScore: hs.fitScore });
      let winner: { family: "HARMONIC" | "HEAD_SHOULDERS"; fitScore: number } | null = candidates[0] ?? null;
      for (const c of candidates.slice(1)) {
        if (winner && c.fitScore > winner.fitScore) winner = c;
      }

      const drawZigzagOutline = (points: Array<HarmonicPoint | undefined>) => {
        const polylinePoints = points
          .filter((p): p is HarmonicPoint => p !== undefined)
          .map((p) => {
            const candle = candles[p.index];
            return candle && Number.isFinite(p.price) ? { time: candle.time, value: p.price } : null;
          })
          .filter((p): p is { time: number; value: number } => p !== null)
          .sort((a, b) => a.time - b.time)
          .filter((p, i, arr) => i === 0 || p.time !== arr[i - 1].time);
        if (polylinePoints.length < 2) return;
        ctx.lineWidth = 1;
        ctx.strokeStyle = LINE_COLOR;
        ctx.beginPath();
        let started = false;
        for (const point of polylinePoints) {
          const x = timeScale.timeToCoordinate(point.time as unknown as Time);
          const y = series.priceToCoordinate(point.value);
          if (x === null || y === null) {
            started = false; // Fail-Closed (Regra de Ouro 3): nunca extrapola através do gap.
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

      // Segmento real entre 2 pontos (triângulo/neckline) — fail-closed
      // quando qualquer extremo cai fora da janela visível de tempo/preço.
      const drawSegment = (startPrice: number, startTime: number, endPrice: number, endTime: number) => {
        const x1 = timeScale.timeToCoordinate(startTime as unknown as Time);
        const y1 = series.priceToCoordinate(startPrice);
        const x2 = timeScale.timeToCoordinate(endTime as unknown as Time);
        const y2 = series.priceToCoordinate(endPrice);
        if (x1 === null || y1 === null || x2 === null || y2 === null) return;
        ctx.lineWidth = 1;
        ctx.strokeStyle = LINE_COLOR;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };

      // Linha horizontal FULL-WIDTH (0 até a fronteira real do eixo) — o
      // MESMO comportamento visual de series.createPriceLine que
      // substitui. Rótulo ancorado perto da borda direita (fronteira do
      // eixo), nunca em cima da área de candles.
      const drawLevelWithLabel = (price: number, label: string) => {
        const y = series.priceToCoordinate(price);
        if (y === null) return; // fora da faixa de preço visível agora — fail-closed.
        const yLine = Math.round(y) + 0.5;
        ctx.lineWidth = 1;
        ctx.strokeStyle = LEVEL_LINE_COLOR;
        ctx.beginPath();
        ctx.moveTo(0, yLine);
        ctx.lineTo(plotRight, yLine);
        ctx.stroke();

        const size = measureCanvasLabel(ctx, label);
        const boxX = Math.max(0, plotRight - size.width - 6);
        const boxY = y - size.height / 2;
        drawCanvasLabel(ctx, boxX, boxY, { fill: LABEL_FILL, text: label });
      };

      if (winner?.family === "HARMONIC" && harmonicValid) {
        const top = harmonicValid;
        drawZigzagOutline([top.points.X, top.points.A, top.points.B, top.points.C, top.points.D]);
        const hDirGlyph = top.direction === "BULLISH" ? "↑" : "↓";
        drawLevelWithLabel(top.points.D.price, `${top.pattern} ${hDirGlyph} PRZ ${(top.fitScore * 100).toFixed(0)}%`);
        if (top.pattern === "WOLFE" && typeof top.epaPrice === "number" && Number.isFinite(top.epaPrice)) {
          const barSec = candles.length >= 2 ? candles[candles.length - 1].time - candles[candles.length - 2].time : null;
          const remainingBars = typeof top.etaIndex === "number" ? top.etaIndex - (candles.length - 1) : null;
          const etaLabel =
            barSec !== null && remainingBars !== null && remainingBars > 0 ? formatEtaDuration(remainingBars * barSec * 1000) : null;
          drawLevelWithLabel(top.epaPrice, `WOLFE EPA${etaLabel ? ` · ETA ${etaLabel}` : ""}`);
        }
      } else if (winner?.family === "HEAD_SHOULDERS" && hs) {
        drawZigzagOutline([hs.leftShoulder, hs.neckline1, hs.head, hs.neckline2, hs.rightShoulder]);
        const necklineStartCandle = candles[hs.neckline1.index];
        const lastCandle = candles[candles.length - 1];
        if (necklineStartCandle && lastCandle && Number.isFinite(hs.necklineAtLastCandle) && necklineStartCandle.time < lastCandle.time) {
          drawSegment(hs.neckline1.price, necklineStartCandle.time, hs.necklineAtLastCandle, lastCandle.time);
        }
        const hsDirGlyph = hs.direction === "BULLISH" ? "↑" : "↓";
        drawLevelWithLabel(hs.necklineAtLastCandle, `${hs.kind === "REGULAR" ? "H&S" : "INV H&S"} ${hsDirGlyph} NECKLINE ${(hs.fitScore * 100).toFixed(0)}%`);
      }

      // TRIÂNGULO — desenha sempre que o motor o encontrou, independente
      // de qual ziguezague venceu acima (justificativa completa no
      // useEffect nativo original que este plugin substitui).
      if (triangle) {
        const lastIndex = candles.length - 1;
        const lastCandle = candles[lastIndex];
        const firstRes = triangle.resistancePoints[0];
        const firstSup = triangle.supportPoints[0];
        const resCandle = firstRes ? candles[firstRes.index] : null;
        const supCandle = firstSup ? candles[firstSup.index] : null;
        if (resCandle && lastCandle && Number.isFinite(triangle.resistanceAtLastCandle) && resCandle.time < lastCandle.time) {
          drawSegment(
            triangle.resistanceSlope * firstRes.index + triangle.resistanceIntercept,
            resCandle.time,
            triangle.resistanceAtLastCandle,
            lastCandle.time,
          );
        }
        if (supCandle && lastCandle && Number.isFinite(triangle.supportAtLastCandle) && supCandle.time < lastCandle.time) {
          drawSegment(
            triangle.supportSlope * firstSup.index + triangle.supportIntercept,
            supCandle.time,
            triangle.supportAtLastCandle,
            lastCandle.time,
          );
        }
        // Ápice real: no cruzamento das 2 retas — número honesto mesmo
        // sem um candle futuro pra plotar o ponto (mesma técnica de
        // EPA/ETA da Wolfe: preço real conhecido agora, tempo mostrado
        // via ETA em texto, nunca uma coordenada X fabricada pra um
        // índice de barra que ainda não existe).
        if (triangle.apexIndex !== null) {
          const apexPrice = triangle.resistanceSlope * triangle.apexIndex + triangle.resistanceIntercept;
          const barSec = candles.length >= 2 ? candles[candles.length - 1].time - candles[candles.length - 2].time : null;
          const remainingBars = triangle.apexIndex - lastIndex;
          const etaLabel = barSec !== null && remainingBars > 0 ? formatEtaDuration(remainingBars * barSec * 1000) : null;
          const dirGlyph = triangle.direction === "BULLISH" ? "↑" : triangle.direction === "BEARISH" ? "↓" : "↔";
          drawLevelWithLabel(
            apexPrice,
            `${triangle.kind} ${dirGlyph} APEX ${(triangle.fitScore * 100).toFixed(0)}%${etaLabel ? ` · ETA ${etaLabel}` : ""}`,
          );
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
      data-plugin="harmonic-geometry"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex("harmonics") }}
    />
  );
}
