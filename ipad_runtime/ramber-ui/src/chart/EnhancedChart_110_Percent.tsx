// EnhancedChart_110_Percent.tsx — V18 Sprint 1, Tarefa B: "Destravar o
// Gráfico Institucional". Substitui o SVG feito à mão (que só desenhava as
// últimas N velas com espaçamento igual, sem pan, sem zoom real, sem eixo
// temporal de verdade) por lightweight-charts — pan (handleScroll) e zoom
// (handleScale) nativos da própria lib, nunca reimplementados à mão aqui.
//
// Escopo desta Tarefa B (diretriz explícita: "não tente reescrever o
// sistema inteiro de uma vez"): candles reais com pan/zoom/crosshair
// nativos + S1/R1 e zonas SMC reais como price lines nativas
// (createPriceLine) — sempre sincronizadas com pan/zoom porque são
// primitivas da própria lib, nunca posicionadas manualmente em pixels.
// Isto preserva a garantia já estabelecida nesta sessão ("os overlays do
// gráfico — SMC, S/R, FVG — devem continuar existindo e processando dados
// reais"), só muda COMO são desenhados. Fica como próximo passo (não
// fabricado às pressas aqui): um retângulo real por zona (via Plugin API
// de primitives da lightweight-charts) mostrando também ONDE no tempo a
// zona se formou — por ora, price lines de largura total mostram o
// preço real top/bottom de cada zona ainda não mitigada/varrida, o
// mesmo filtro (!mitigated / !swept) e o mesmo cap de contagem que o
// componente antigo já usava.
import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";

export interface EnhancedChartCandle {
  time: number; // Unix segundos real (Bus/Binance) — nunca sintetizado
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface EnhancedChartZone {
  type: "BULLISH" | "BEARISH";
  top: number;
  bottom: number;
}

export interface EnhancedChartLiquidity {
  type: "EQUAL_HIGH" | "EQUAL_LOW";
  price: number;
  touches: number;
}

export interface LevelStrength {
  label: "FORTE" | "FRACA";
  touches: number;
}

interface EnhancedChartProps {
  data: EnhancedChartCandle[];
  support?: number | null;
  resistance?: number | null;
  supportStrength?: LevelStrength | null;
  resistanceStrength?: LevelStrength | null;
  supportBreakouts?: number;
  resistanceBreakouts?: number;
  fairValueGaps?: EnhancedChartZone[];
  orderBlocks?: EnhancedChartZone[];
  liquidityZones?: EnhancedChartLiquidity[];
}

// Mesmo formato de texto que o gráfico antigo já usava para S1/R1 — só a
// primitiva que desenha muda (createPriceLine em vez de <span> em pixel
// fixo), a informação real (força/retest/rompimentos) continua idêntica.
function levelTitle(base: string, strength: LevelStrength | null | undefined, breakouts: number | undefined): string {
  if (!strength) return base;
  return `${base} ${strength.label} ${strength.touches}x/${breakouts ?? 0}x`;
}

export function EnhancedChart_110_Percent({
  data,
  support,
  resistance,
  supportStrength,
  resistanceStrength,
  supportBreakouts,
  resistanceBreakouts,
  fairValueGaps,
  orderBlocks,
  liquidityZones,
}: EnhancedChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const supportLineRef = useRef<IPriceLine | null>(null);
  const resistanceLineRef = useRef<IPriceLine | null>(null);
  const zoneLinesRef = useRef<IPriceLine[]>([]);

  // Cria o chart UMA vez por montagem — nunca recriado por troca de
  // timeframe/dado (isso destruiria o estado de pan/zoom do operador a
  // cada atualização, exatamente o "reload"/"reinicializar o gráfico" que
  // a diretriz proíbe). autoSize:true usa o ResizeObserver interno da
  // própria lib — sem media query manual, sem listener de resize próprio.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8ab4f8",
        fontFamily: "ui-monospace, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(0, 240, 255, 0.06)" },
        horzLines: { color: "rgba(0, 240, 255, 0.06)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(138, 180, 248, 0.15)" },
      timeScale: {
        borderColor: "rgba(138, 180, 248, 0.15)",
        timeVisible: true,
        secondsVisible: false,
      },
      // Diretriz explícita do Sprint 1: pan/zoom real e nativo — nunca
      // hand-rolled. handleScroll cobre arrastar (mouse + touch);
      // handleScale cobre roda do mouse + pinça (iPad).
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
      autoSize: true,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#00ffaa",
      downColor: "#ff0055",
      borderVisible: false,
      wickUpColor: "#00ffaa",
      wickDownColor: "#ff0055",
      priceLineVisible: true,
      lastValueVisible: true,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      supportLineRef.current = null;
      resistanceLineRef.current = null;
      zoneLinesRef.current = [];
    };
  }, []);

  // Atualiza a série EXISTENTE com o candle real — nunca recria o chart.
  // Isto é o que satisfaz "transição suave entre timeframes (sem
  // recarregar tudo)": trocar chartTimeframe em App.tsx só troca o
  // conteúdo de `data`, este efeito só chama setData() na mesma série, e o
  // pan/zoom/crosshair do operador nunca são resetados por isso.
  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) return;
    const formatted = data
      .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
      .map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
    seriesRef.current.setData(formatted);
  }, [data]);

  // S1/R1 reais — o MESMO engine.support/resistance que os outros widgets
  // já exibem, aqui como price lines nativas (createPriceLine), nunca uma
  // linha desenhada à mão em cima do canvas.
  useEffect(() => {
    if (!seriesRef.current) return;
    if (supportLineRef.current) {
      seriesRef.current.removePriceLine(supportLineRef.current);
      supportLineRef.current = null;
    }
    if (Number.isFinite(support)) {
      supportLineRef.current = seriesRef.current.createPriceLine({
        price: support as number,
        color: "#00ffaa",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: levelTitle("S1", supportStrength, supportBreakouts),
      });
    }
  }, [support, supportStrength, supportBreakouts]);

  useEffect(() => {
    if (!seriesRef.current) return;
    if (resistanceLineRef.current) {
      seriesRef.current.removePriceLine(resistanceLineRef.current);
      resistanceLineRef.current = null;
    }
    if (Number.isFinite(resistance)) {
      resistanceLineRef.current = seriesRef.current.createPriceLine({
        price: resistance as number,
        color: "#ff0055",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: levelTitle("R1", resistanceStrength, resistanceBreakouts),
      });
    }
  }, [resistance, resistanceStrength, resistanceBreakouts]);

  // Zonas SMC reais (FVG/Order Blocks bullish|bearish, Equal High/Low de
  // liquidez) — mesmo dado real de computeSmcZones (engine-bridge.ts) que
  // o gráfico antigo já filtrava (só zonas ainda !mitigated/!swept) e
  // limitava em contagem; aqui como price lines, então nunca "ficam
  // presas" durante pan/zoom (são recalculadas pela própria lib a cada
  // frame, não posicionadas em pixel fixo por este componente).
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    zoneLinesRef.current.forEach((line) => series.removePriceLine(line));
    zoneLinesRef.current = [];

    (fairValueGaps ?? []).forEach((z) => {
      const color = z.type === "BULLISH" ? "#00ffaa" : "#ff0055";
      zoneLinesRef.current.push(
        series.createPriceLine({ price: z.top, color, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "FVG" }),
        series.createPriceLine({ price: z.bottom, color, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: "FVG" }),
      );
    });
    (orderBlocks ?? []).forEach((z) => {
      const color = z.type === "BULLISH" ? "#00ffaa" : "#ff0055";
      zoneLinesRef.current.push(
        series.createPriceLine({ price: z.top, color, lineWidth: 1, lineStyle: LineStyle.LargeDashed, axisLabelVisible: false, title: "OB" }),
        series.createPriceLine({ price: z.bottom, color, lineWidth: 1, lineStyle: LineStyle.LargeDashed, axisLabelVisible: false, title: "OB" }),
      );
    });
    (liquidityZones ?? []).forEach((z) => {
      zoneLinesRef.current.push(
        series.createPriceLine({
          price: z.price,
          color: "#c86bff",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: `${z.type === "EQUAL_HIGH" ? "EQH" : "EQL"} x${z.touches}`,
        }),
      );
    });
  }, [fairValueGaps, orderBlocks, liquidityZones]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
