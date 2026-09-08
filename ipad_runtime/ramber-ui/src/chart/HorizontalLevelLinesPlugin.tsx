// HorizontalLevelLinesPlugin.tsx — GRADUAÇÃO (2026-09-07, "resíduo honesto"
// documentado em chart-layer-depth.ts): substitui `series.createPriceLine(...)`
// nativo por canvas próprio para os consumidores cujo desenho inteiro já era
// "linha horizontal de 1px, axisLabelVisible:false" — premium_discount,
// scenario_projection e pivot_points. Mesma arquitetura de sempre
// (StructureTracePlugin/LiquidityZonesPlugin: canvas próprio, dirty-flag +
// rAF, ResizeObserver) — zero segunda arquitetura.
//
// Por que UM plugin para 3 consumidores: os 3 desenham exatamente a MESMA
// geometria (reta horizontal, 0 até a borda real do plot, 1px sólida) —
// só o preço/cor mudam, e cada chamador já os calcula (Regra de Ouro 4: o
// agrupamento/desenho é compartilhado, a REDUÇÃO — que preço, que cor —
// continua de cada consumidor, mesmo precedente de fractal-swings.js/
// price-clustering.js). Uma segunda implementação da mesma reta seria
// exatamente a duplicação que este projeto audita antes de escrever.
//
// SEM TEXTO, de propósito: as 3 fontes originais já eram
// `axisLabelVisible: false` — o `title` nativo nunca chegava à tela (mesma
// classe de achado já documentada para harmônicos/EQH-EQL antes da correção
// deles). Nenhuma das 3 ganha um rótulo novo aqui, nenhuma perde um rótulo
// que já era visível (Regra de Ouro 4) — pivot_points já tem os PRÓPRIOS
// rótulos "PVT R1"/"PVT PP"/etc. desenhados por quem já os monta hoje;
// scenario_projection/premium_discount são deliberadamente sem rótulo
// (cor é o único sinal, ver comentário original em EnhancedChart_110_Percent.tsx).
//
// LARGURA TOTAL é o comportamento CORRETO para os 3 consumidores ORIGINAIS
// — ao contrário do EQH/EQL (equal-level-span.ts), pivô/faixa de negociação/
// projeção não são evidência de um trecho específico de candles: valem para
// toda a janela visível. Nunca encurtar por engano.
//
// ── EXTENSÃO §4 (2026-09-08, ordem "NÚCLEO + POSICIONAMENTO INTELIGENTE") ──
// "as linhas não devem atravessar o gráfico inteiro — limitar a 2-3 toques
// relevantes". Isso NÃO revoga o parágrafo acima: ele continua valendo, e é
// exatamente por isso que o trecho é OPT-IN. Um nível entra em modo
// "trecho" só quando o chamador entrega os índices dos toques REAIS que o
// motor mediu (`touchIndices`); sem eles, o desenho é byte a byte o de
// sempre. Os 3 consumidores originais não passam nada e não mudam em nada.
//
// O primeiro (e por ora único) consumidor do modo trecho é S1/R1, que É
// evidência de toque — cada "toque" é um swing fractal confirmado dentro de
// ±0.15% do nível (support-resistance-engine.js). Mesma doutrina já escrita
// em equal-level-span.ts: "o trecho desenha o que foi medido"; uma linha de
// largura total afirma visualmente algo que o motor nunca calculou.
//
// A geometria NÃO se reescreve aqui: `resolveEqualLevelSegment` (piso de
// legibilidade + sobra à direita + recorte no canvas) é a mesma função que
// o LiquidityZonesPlugin já usa ao vivo para EQH/EQL. A escolha de QUAIS
// toques entram vive em level-touch-window.ts. Este arquivo só desenha.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { getChartLayerZIndex } from "./chart-layer-depth";
import { resolveEqualLevelSegment } from "./equal-level-span";
import { resolveLevelTouchWindow } from "./level-touch-window";

export interface HorizontalLevel {
  price: number;
  color: string;
  /** OPT-IN (§4): índices de candle dos toques reais. Presente => a linha
   *  cobre só o trecho dos toques recentes em vez da largura total.
   *  Ausente => comportamento original, inalterado. */
  touchIndices?: number[];
}

interface HorizontalLevelLinesPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  levels: HorizontalLevel[];
  layerId: string;
  /** Candles reais da série, necessários só para traduzir índice de toque
   *  em coordenada X. Opcional: sem eles nenhum nível entra em modo trecho
   *  (fail-closed — nunca um trecho posicionado por estimativa). */
  candles?: readonly { time: unknown }[];
}

export function HorizontalLevelLinesPlugin({ chart, series, levels, layerId, candles }: HorizontalLevelLinesPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelsRef = useRef(levels);
  const candlesRef = useRef(candles);
  const markDirtyRef = useRef<(() => void) | null>(null);

  levelsRef.current = levels;
  candlesRef.current = candles;

  useEffect(() => {
    markDirtyRef.current?.();
  }, [levels, candles]);

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
      ctx.lineWidth = 1;
      const timeScale = chart.timeScale();
      const seriesCandles = candlesRef.current;
      for (const level of levelsRef.current) {
        if (!Number.isFinite(level.price)) continue;
        const y = series.priceToCoordinate(level.price);
        if (y === null) continue;
        // Fail-closed (Regra de Ouro 3): fora da faixa de preço visível
        // atual, a lib devolve null — nunca extrapolamos pra fora do plot.
        // Meio-pixel pro traço de 1px cair exatamente numa linha de grade
        // física do canvas (Fio de Seda nítido, mesmo truque já usado nos
        // irmãos deste diretório).
        const yCrisp = Math.round(y) + 0.5;
        ctx.strokeStyle = level.color;

        // §4: trecho real quando o chamador entregou toques medidos; caso
        // contrário, a largura total de sempre. Cada `continue` implícito
        // abaixo cai de volta na largura total em vez de sumir com o nível
        // (Regra de Ouro 4: um nível real nunca desaparece por falta de
        // geometria — ele só deixa de ser encurtado).
        let x1 = 0;
        let x2 = cssWidth;
        const window = resolveLevelTouchWindow(level.touchIndices);
        if (window && seriesCandles && seriesCandles.length > 0) {
          const first = seriesCandles[window.firstIndex];
          const last = seriesCandles[window.lastIndex];
          if (first && last) {
            const xFirst = timeScale.timeToCoordinate(first.time as Time);
            const xLast = timeScale.timeToCoordinate(last.time as Time);
            if (xFirst !== null && xLast !== null) {
              const seg = resolveEqualLevelSegment(xFirst, xLast, cssWidth);
              // `seg === null` = a janela inteira está fora da tela (o
              // Operador rolou o gráfico para longe dos toques). Aí o
              // honesto é NÃO desenhar: uma linha de largura total ali
              // afirmaria um trecho que não está sendo mostrado.
              if (!seg) continue;
              x1 = seg.x1;
              x2 = seg.x2;
            }
          }
        }

        ctx.beginPath();
        ctx.moveTo(x1, yCrisp);
        ctx.lineTo(x2, yCrisp);
        ctx.stroke();
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

  // width/height explícitos: <canvas> é replaced element — inset:0 sozinho
  // não o estica (mesmo achado já documentado no VolumeProfilePlugin).
  return (
    <canvas
      ref={canvasRef}
      data-plugin={layerId}
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex(layerId) }}
    />
  );
}
