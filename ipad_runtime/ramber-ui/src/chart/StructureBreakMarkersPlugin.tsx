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
import { getChartLayerZIndex } from "./chart-layer-depth";
import { measurePlotArea } from "./chart-plot-area";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import type { StructureBreak } from "../engine-bridge";
import { ageAlpha, type DecayConfig } from "./annotation-decay";

// BOS/CHOCH é um evento mais "urgente" que uma zona de preço parada — janela
// de destaque pleno mais curta antes de começar a esmaecer (20 candles vs
// os 30 do LiquidityZonesPlugin); mesmo teto final e piso (ver
// annotation-decay.ts — função compartilhada, zero duplicação), mesma
// unidade honesta de "idade" (candles reais desde o rompimento, não
// relógio de parede — funciona igual em qualquer timeframe).
// Exportada (achado real de captura de tela do Operador: o rótulo "CHOC"
// desenhado aqui colidia com a caixa "EMA 21" do eixo — este canvas não
// tinha NENHUMA consciência da posição dos outros rótulos): o TEXTO migrou
// para priceAxisLabels (EnhancedChart_110_Percent.tsx), que reusa esta
// MESMA config de decaimento — zero segunda curva de esmaecimento.
export const BREAK_DECAY: DecayConfig = { fadeStartCandles: 20, expireCandles: 100, minAlpha: 0.15 };

interface StructureBreakMarkersPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number }[];
  structureBreak: StructureBreak | null;
  // Ordem Nº 03 / Homologação: peso visual final real, já resolvido por
  // resolveVisualBudget (nexus/visual-budget.ts) — competição CRUZADA com
  // Zonas Institucionais/Trade Plan, nunca só a idade PRÓPRIA do
  // rompimento. undefined/null = sem competição real ainda resolvida pelo
  // chamador; cai de volta em ageAlpha(age, BREAK_DECAY) (comportamento já
  // validado antes desta rodada, nunca um valor fabricado).
  visualWeight?: number | null;
}

export function StructureBreakMarkersPlugin({ chart, series, data, structureBreak, visualWeight }: StructureBreakMarkersPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ structureBreak, data, visualWeight });
  const markDirtyRef = useRef<(() => void) | null>(null);

  // Sempre a versão mais recente para o loop de desenho ler — mesmo padrão
  // do LiquidityZonesPlugin (nunca reabre a conexão com o chart a cada
  // atualização de dado).
  stateRef.current = { structureBreak, data, visualWeight };

  useEffect(() => {
    markDirtyRef.current?.();
  }, [structureBreak, data, visualWeight]);

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

      // Fronteira medida do eixo (chart-plot-area.ts): o desenho para na
      // borda do eixo, nunca corre por baixo dos numeros do preco. Achado
      // medido: nenhum dos 18 overlays deste projeto media isso — todos
      // iam ate `cssWidth`, que inclui os ~72px da faixa do eixo.
      const { plotRight } = measurePlotArea(chart, cssWidth);

      const { structureBreak: brk, data: candles, visualWeight: resolvedWeight } = stateRef.current;
      if (!brk) return; // sem rompimento real na amostra — nada a desenhar, honesto.
      const point = candles[brk.index];
      if (!point) return; // índice fora da janela real de candles carregada.
      const age = candles.length - 1 - brk.index;
      // Ordem Nº 03: resolvedWeight (já competido contra outras categorias
      // reais) vence quando o chamador o forneceu; senão cai na idade
      // PRÓPRIA de sempre.
      const alpha = resolvedWeight !== undefined && resolvedWeight !== null ? resolvedWeight : ageAlpha(age, BREAK_DECAY);
      if (alpha <= 0) return; // "esquecido" — só da tela, o dado real segue intacto em engine-bridge.ts.

      const timeScale = chart.timeScale();
      const x1 = timeScale.timeToCoordinate(point.time as unknown as Time);
      const y = series.priceToCoordinate(brk.level);
      if (x1 === null || y === null) return; // fora da área visível agora — Fail-Closed: nunca extrapola.

      const bullish = brk.direction === "ALTA";
      const color = bullish ? "rgba(8, 153, 129, 0.75)" : "rgba(242, 54, 69, 0.75)";
      const yLine = Math.round(y) + 0.5;

      ctx.globalAlpha = alpha;
      // Ordem "FECHAMENTO INTEGRAL" §12: seta de direção pequena e precisa
      // no ponto real do rompimento — ↑ para BOS/CHOCH de alta, ↓ para
      // baixa. Zero dado novo: MESMA direção/preço/tempo que a linha ao
      // lado já usa (brk.direction/x1/y), só um segundo traço geométrico
      // no mesmo ponto. Desenhada ANTES da linha começar (a linha nasce em
      // x1 + ARROW_HALF_SIZE + ARROW_GAP_PX, nunca em x1) para os dois
      // elementos nunca se sobreporem — "não deixar setas atravessarem...
      // textos" também vale para a própria linha companheira.
      const ARROW_HALF_SIZE = 4;
      const ARROW_GAP_PX = 3;
      ctx.beginPath();
      if (bullish) {
        ctx.moveTo(x1, y - ARROW_HALF_SIZE);
        ctx.lineTo(x1 - ARROW_HALF_SIZE, y + ARROW_HALF_SIZE);
        ctx.lineTo(x1 + ARROW_HALF_SIZE, y + ARROW_HALF_SIZE);
      } else {
        ctx.moveTo(x1, y + ARROW_HALF_SIZE);
        ctx.lineTo(x1 - ARROW_HALF_SIZE, y - ARROW_HALF_SIZE);
        ctx.lineTo(x1 + ARROW_HALF_SIZE, y - ARROW_HALF_SIZE);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      // Fio de Seda (Regra de Ouro 2): 1px sólida real, do ponto real de
      // rompimento até a borda direita — mesma primitiva do
      // LiquidityZonesPlugin, nunca setLineDash. O TEXTO ("BOS"/"CHOCH")
      // não é mais desenhado aqui — achado real de captura de tela do
      // Operador: este canvas próprio não tinha nenhuma consciência da
      // posição dos rótulos do eixo (S1/R1/VWAP/NL/EMA/...), então "CHOC"
      // colidia/ficava atrás da caixa opaca de "EMA 21" sempre que o
      // rompimento acontecia perto de um nível já rotulado — o caso
      // COMUM, não raro. O rótulo migrou para priceAxisLabels
      // (EnhancedChart_110_Percent.tsx), que reusa brk.level/brk.type/
      // esta MESMA cor e o MESMO ageAlpha(age, BREAK_DECAY) — zero segunda
      // fonte — e agora participa do resolvedor de colisão real
      // (PriceLabelStackPlugin) como qualquer outro rótulo do eixo.
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x1 + ARROW_HALF_SIZE + ARROW_GAP_PX, yLine);
      ctx.lineTo(plotRight, yLine);
      ctx.stroke();
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
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex("structure_breaks") }}
    />
  );
}
