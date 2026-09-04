// CandlePatternMarkersPlugin.tsx — marca no gráfico os PADRÕES DE VELA
// reais detectados por research/engines/candlestick-patterns.js (via
// engine-bridge.ts's computeCandlePatterns).
//
// Pedido direto do Operador: "no gráfico tem que refletir os padrão das
// vela também — quando dá tipo tantas velas fazem um padrão, ele tem de
// analisar tudo isso aí". A rodada anterior construiu e graduou o motor,
// mas ligou-o só às peças publicáveis — o GRÁFICO, que é onde ele pediu,
// tinha ficado de fora. Esta camada fecha esse gap.
//
// Mesma arquitetura de overlay já estabelecida por LiquidityZonesPlugin e
// StructureBreakMarkersPlugin (canvas próprio, dirty-flag + rAF,
// ResizeObserver, fio de seda 1px) — zero segunda arquitetura, só mais uma
// instância dela para um dado real diferente.
//
// ONDE O MARCADOR FICA (convenção real de terminal, não escolha estética):
// padrão de viés de ALTA marca ABAIXO da mínima da vela (é ali que o
// movimento nasce), viés de BAIXA marca ACIMA da máxima. Indecisão (Doji)
// marca acima, em âmbar, sem seta — porque não aponta lado nenhum.
//
// LEI 24: display only. O padrão é confluência/contexto — o único emissor
// de LONG/SHORT/WAIT continua sendo o Core Engine. Um Engolfo de Alta
// contra um SHORT do Núcleo aparece na tela como contradição para o
// Operador LER, nunca como um segundo sinal.
import { useEffect, useRef } from "react";
import { getChartLayerZIndex } from "./chart-layer-depth";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { CandlePattern } from "../engine-bridge";
import { ageAlpha, type DecayConfig } from "./annotation-decay";
import { drawCanvasLabel } from "../nexus/canvas-label";
import { chartPaletteRgba } from "./canvas-palette";

// Um padrão de vela é um evento pontual e perecível — mesma classe do
// BOS/CHOCH (20 candles de destaque pleno), não de uma zona de preço
// parada. Reusa a curva compartilhada de annotation-decay.ts, zero segunda
// matemática de esmaecimento.
export const PATTERN_DECAY: DecayConfig = { fadeStartCandles: 20, expireCandles: 60, minAlpha: 0.15 };

// Teto de marcadores simultâneos. O motor já varre só uma janela recente
// (PATTERN_SCAN_WINDOW=40) e emite no máximo 1 padrão por candle, mas numa
// janela agitada isso ainda pode render uma dúzia — e encher o gráfico de
// setas é exatamente a "poluição" que o Operador já pediu para evitar. Os
// mais RECENTES vencem: um padrão de 35 candles atrás não muda a decisão
// de agora.
export const MAX_PATTERN_MARKERS = 4;

// Sigla curta de 3 letras para o rótulo no canvas. Vocabulário de
// APRESENTAÇÃO (o motor guarda code+name completos) — mesma disciplina de
// compactação já aplicada a EN/ST/TP1 e a FVG↑/OB↓: no canvas o espaço
// horizontal é o recurso escasso, e o nome inteiro ("Engolfo de Alta")
// roubaria a faixa das velas. O nome completo continua real e visível nas
// peças publicáveis e no tooltip do painel.
const SHORT_LABEL: Record<string, string> = {
  BULLISH_ENGULFING: "ENG",
  BEARISH_ENGULFING: "ENG",
  BULLISH_HARAMI: "HAR",
  BEARISH_HARAMI: "HAR",
  PIERCING_LINE: "PRC",
  DARK_CLOUD: "NUV",
  MORNING_STAR: "EST",
  EVENING_STAR: "EST",
  HAMMER: "MAR",
  HANGING_MAN: "ENF",
  SHOOTING_STAR: "ESC",
  INVERTED_HAMMER: "MRI",
  MARUBOZU_BULL: "MBZ",
  MARUBOZU_BEAR: "MBZ",
  DOJI: "DOJ",
};

interface CandlePatternMarkersPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number; high: number; low: number }[];
  patterns: CandlePattern[];
}

export function CandlePatternMarkersPlugin({ chart, series, data, patterns }: CandlePatternMarkersPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ patterns, data });
  const markDirtyRef = useRef<(() => void) | null>(null);

  // Sempre a versão mais recente para o loop de desenho ler — nunca reabre
  // a conexão com o chart a cada atualização de dado (mesmo padrão dos
  // outros overlays).
  stateRef.current = { patterns, data };

  useEffect(() => {
    markDirtyRef.current?.();
  }, [patterns, data]);

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

      const { patterns: list, data: candles } = stateRef.current;
      if (!Array.isArray(list) || list.length === 0) return; // nada real — nada desenhado.
      const timeScale = chart.timeScale();
      const lastIndex = candles.length - 1;

      // Os mais recentes primeiro; o teto corta a cauda antiga.
      const recent = [...list].sort((a, b) => b.index - a.index).slice(0, MAX_PATTERN_MARKERS);

      for (const p of recent) {
        const point = candles[p.index];
        if (!point) continue; // índice fora da janela real carregada.
        const alpha = ageAlpha(lastIndex - p.index, PATTERN_DECAY);
        if (alpha <= 0) continue; // "esquecido" — só da tela; o dado segue real no motor.

        const x = timeScale.timeToCoordinate(point.time as unknown as Time);
        if (x === null) continue; // fora da área visível — fail-closed, nunca extrapola.

        const bullish = p.direction === "ALTA";
        const bearish = p.direction === "BAIXA";
        // Cor real do viés — mesma paleta do resto do canvas. Indecisão
        // (Doji) NUNCA ganha verde nem vermelho: seria afirmar um lado que
        // o padrão explicitamente não tem (Regra de Ouro 3).
        // Paleta canônica (canvas-palette.ts) — nunca um rgba redigitado de
        // memória, que é a causa raiz medida do drift de cor no canvas.
        // Doji cai em "attention" (âmbar: observar, sem viés direcional) —
        // a família certa para indecisão.
        const color = bullish
          ? chartPaletteRgba("bullish", 0.9)
          : bearish
            ? chartPaletteRgba("bearish", 0.9)
            : chartPaletteRgba("attention", 0.9);

        // Âncora no preço REAL da vela: abaixo da mínima para viés de alta,
        // acima da máxima para baixa/indecisão.
        const anchorPrice = bullish ? point.low : point.high;
        const yAnchor = series.priceToCoordinate(anchorPrice);
        if (yAnchor === null) continue;
        const OFFSET = 14;
        const y = bullish ? yAnchor + OFFSET : yAnchor - OFFSET;

        ctx.globalAlpha = alpha;

        // Seta só quando há lado real. Mesma geometria do marcador de
        // BOS/CHOCH — zero segunda linguagem visual de direção.
        const H = 5;
        if (bullish || bearish) {
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
        } else {
          // Doji: losango neutro, sem apontar lado.
          ctx.beginPath();
          ctx.moveTo(x, y - H);
          ctx.lineTo(x + H, y);
          ctx.lineTo(x, y + H);
          ctx.lineTo(x - H, y);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        }

        // Sigla + marca de confirmação real. `confirmed === true` (a vela
        // seguinte fechou a favor) ganha ✓; `null` (padrão recém-formado,
        // ainda sem vela seguinte) não ganha nada — nunca um ✗ que se
        // leria como "foi negado".
        const label = `${SHORT_LABEL[p.code] ?? "PAD"}${p.confirmed === true ? "✓" : ""}`;
        const labelY = bullish ? y + H + 2 : y - H - 12;
        drawCanvasLabel(ctx, x - 12, labelY, { fill: color, text: label });

        ctx.globalAlpha = 1;
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
      style={{ zIndex: getChartLayerZIndex("candle_patterns") }}
    />
  );
}
