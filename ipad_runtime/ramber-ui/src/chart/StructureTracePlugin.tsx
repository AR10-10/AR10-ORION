// StructureTracePlugin.tsx — MD-7 (Visual Confidence Trace), pedido direto
// do Operador: "restaurar o traçado roxo dos pivôs e torná-lo parte padrão
// da Análise de Confiança". Desenha uma polyline fina conectando os swing
// highs/lows CONFIRMADOS reais (research/engines/fractal-swings.js, via
// engine-bridge.ts's computeStructuralSwings — mesmo motor compartilhado
// que market-structure-engine.js/support-resistance-engine.js/fvg-order-
// block-engine.js já usam, nunca um segundo ZigZag). Mesma arquitetura de
// overlay já estabelecida por ZigZagPlugin (canvas próprio, dirty-flag +
// rAF, cache por identidade de referência, ResizeObserver) — zero segunda
// arquitetura, só mais uma instância dela para uma fonte de pivô diferente.
//
// SEPARAÇÃO DE CONCEITOS (memo do Operador, item 13): este arquivo é
// SÓ o STRUCTURE_TRACE — "como o mercado está se estruturando?". A
// pergunta "qual é a direção da decisão atual?" é CONFIDENCE_DIRECTION
// (ConfidenceDirectionArrowPlugin.tsx), um arquivo à parte de propósito:
// os dois nunca se misturam num componente só.
//
// COR: paleta canônica travada por teste (canvas-palette.ts) — só 6
// famílias existem, nenhuma sétima "roxo" pode ser inventada sem quebrar
// canvas-palette.test.ts. A família "projection" (lavanda, matiz 255°) já
// É o "roxo" deste projeto na prática: EnhancedChart_110_Percent.tsx já
// comenta, em 4 lugares reais, "roxo=harmônicos/EQH-EQL" e "cor de acento
// roxo do padrão geométrico" referindo-se exatamente a este mesmo matiz —
// reusar a família existente em vez de inventar uma nova é o que a
// disciplina de auditoria deste projeto pede (CLAUDE.md, "audite antes de
// construir"), e mantém o teste de trava intacto.
//
// ZERO LOOK-AHEAD: findSwings (fractal-swings.js) só confirma um pivô no
// índice i quando existem FRACTAL_K candles reais DEPOIS dele — a borda
// viva do gráfico nunca aparece até confirmar. Esta camada não adiciona
// nem remove essa garantia, só desenha o que o motor já devolve confirmado.
//
// "Fio de Seda" (Regra de Ouro 5): 1px sólido real, nunca setLineDash. Sem
// preenchimento, sem glow, sem etiqueta, sem seta — só a linha, exatamente
// como o memo pediu ("sem objetos adicionais").
import { useEffect, useRef } from "react";
import { getChartLayerZIndex } from "./chart-layer-depth";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { computeStructuralSwings, type ZigZagPoint } from "../engine-bridge";
import { chartPaletteRgba } from "./canvas-palette";

const LINE_COLOR = chartPaletteRgba("projection", 0.5);

interface StructureTracePluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number; high: number; low: number }[];
}

export function StructureTracePlugin({ chart, series, data }: StructureTracePluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef(data);
  const markDirtyRef = useRef<(() => void) | null>(null);
  const cacheRef = useRef<{ data: typeof data; points: ZigZagPoint[] }>({
    data: [],
    points: [],
  });

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
        points = computeStructuralSwings(dataRef.current);
        cacheRef.current = { data: dataRef.current, points };
      }
      if (points.length < 2) return; // sem pivô confirmado suficiente pra uma linha real — nada desenhado, nunca uma linha fabricada

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
      data-plugin="structure-trace"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex("structure_trace") }}
    />
  );
}
