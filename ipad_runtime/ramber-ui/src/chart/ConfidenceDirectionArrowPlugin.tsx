// ConfidenceDirectionArrowPlugin.tsx — MD-7 (Visual Confidence Trace),
// pedido direto do Operador: uma única seta discreta perto do preço atual
// que aponta a DIREÇÃO DA DECISÃO oficial já existente — nunca uma nova
// decisão, nunca a entrada.
//
// FONTE ÚNICA (memo do Operador, item 6): "Decision Engine / decisão atual
// de confiança... Não calcular a direção pelo ZigZag. Não calcular a
// direção pela seta. Não criar uma regra paralela." `direction` recebido
// aqui é literalmente o MESMO `effectiveDirection` que CoreSignalBadge
// (App.tsx) já calcula e exibe como "a ÚNICA leitura do Core Engine em
// toda a tela" — passthrough de engine.direction (LEI 24) já com a
// exceção pontual da Entrega 42 aplicada (LEI 24, expectancyFilter). Esta
// camada NUNCA recalcula suppressed/effectiveDirection por conta própria:
// se calculasse de novo a partir de engine.direction bruto, um LONG/SHORT
// suprimido pelo badge (NEUTRO) apareceria como seta real no gráfico —
// exatamente a "regra paralela" que o memo proíbe, e uma contradição
// visual direta com o único badge do Núcleo. Reusar o mesmo valor já
// computado é o que garante UMA decisão em toda a tela, nunca duas.
//
// SEPARAÇÃO DE CONCEITOS (item 13): este arquivo é só CONFIDENCE_DIRECTION
// — "qual é a direção da decisão atual?". A pergunta "como o mercado está
// se estruturando?" é STRUCTURE_TRACE (StructureTracePlugin.tsx), um
// arquivo à parte de propósito.
//
// POSICIONAMENTO ≠ ENTRADA (item 7, "DIRECTION ≠ ENTRY" do P0): as setas
// de ENTRADA/SAÍDA reais (plan-markers.ts) ancoram no lado de ORIGEM do
// movimento (LONG nasce abaixo da vela). Esta seta faz o OPOSTO de
// propósito — LONG desenha ACIMA do preço atual, SHORT ABAIXO — para nunca
// ser lida como um marcador de entrada por engano: é uma bússola sobre o
// preço, não um evento no tempo.
//
// ANTI-COLISÃO (item 10, "aplicar o sistema de anti-colisão existente"):
// mesmo mecanismo já em uso entre CandlePatternMarkersPlugin (OFFSET=14,
// H=5) e HarmonicConfluenceArrowPlugin (OFFSET=18, H=9) — cada camada de
// marcador pontual usa um deslocamento maior que a anterior para nunca
// desenhar por cima da irmã quando ambas caem na mesma vela. Esta é a
// camada de MAIOR prioridade da hierarquia (item 11: "3. DECISÃO/SETA"
// vem antes de "5. INDICADORES SECUNDÁRIOS"), então usa o maior offset dos
// três — 40px, H=11 — deliberadamente maior que os 27px de alcance
// máximo do triângulo harmônico (18+9), com folga real. As etiquetas do
// eixo de preço (EN/ST/TP/S1/R1, price-label-stack.ts) vivem numa região
// espacial diferente (o gutter do eixo, à direita da área de plotagem,
// chart-plot-area.ts) — não competem por pixel com um marcador ancorado na
// última vela.
//
// MINIMALISMO (item 12): sem label (o texto LONG/SHORT já existe no
// CoreSignalBadge — repeti-lo aqui seria a "poluição" que o memo pede para
// evitar), sem círculo, sem glow — só o triângulo.
//
// LEI 24: display only. Não decide nada — só desenha a decisão que o
// Núcleo (via App.tsx) já tomou.
import { useEffect, useRef } from "react";
import { getChartLayerZIndex } from "./chart-layer-depth";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { chartPaletteRgba } from "./canvas-palette";

const OFFSET = 40; // maior que os 18px do harmônico — esta é a camada de maior prioridade da hierarquia (item 11).
const H = 11; // maior que os 9px do harmônico, mesmo motivo do offset.

interface ConfidenceDirectionArrowPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number; close: number }[];
  // Passthrough EXATO de CoreSignalBadge's effectiveDirection — nunca
  // recalculado aqui. null cobre WAIT/AGUARDANDO e o caso suprimido (LEI
  // 24, Entrega 42) igualmente: nenhuma seta em nenhum dos dois casos.
  direction: "LONG" | "SHORT" | null | undefined;
}

export function ConfidenceDirectionArrowPlugin({ chart, series, data, direction }: ConfidenceDirectionArrowPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ data, direction });
  const markDirtyRef = useRef<(() => void) | null>(null);

  stateRef.current = { data, direction };

  useEffect(() => {
    markDirtyRef.current?.();
  }, [data, direction]);

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

      const { data: candles, direction: dir } = stateRef.current;
      // WAIT (null) ou decisão ausente (undefined): nenhuma seta — nunca
      // uma direção inventada (item 7/9 do memo).
      if (dir !== "LONG" && dir !== "SHORT") return;
      if (!Array.isArray(candles) || candles.length === 0) return;

      const last = candles[candles.length - 1];
      const timeScale = chart.timeScale();
      const x = timeScale.timeToCoordinate(last.time as unknown as Time);
      const yAnchor = series.priceToCoordinate(last.close);
      if (x === null || yAnchor === null) return; // fora da área visível agora — fail-closed, nunca extrapola.

      const long = dir === "LONG";
      const color = long ? chartPaletteRgba("bullish", 0.95) : chartPaletteRgba("bearish", 0.95);
      // Oposto da convenção de plan-markers.ts de propósito — ver cabeçalho
      // ("POSICIONAMENTO ≠ ENTRADA"): LONG aponta pra cima E fica ACIMA do
      // preço; SHORT aponta pra baixo E fica ABAIXO.
      const y = long ? yAnchor - OFFSET : yAnchor + OFFSET;

      ctx.beginPath();
      if (long) {
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
      data-plugin="confidence-direction"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: getChartLayerZIndex("confidence_direction") }}
    />
  );
}
