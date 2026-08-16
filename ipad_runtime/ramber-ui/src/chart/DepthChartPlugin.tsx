// DepthChartPlugin.tsx — Entrega 40 (Order Book Depth Overlay, gap real
// nomeado desde a Entrega 35 §4): livro de ofertas REAL (WebSocket
// depth10@100ms, App.tsx → store.orderBook) desenhado como camada de
// gráfico — barras ancoradas à direita, no preço real de cada nível via
// series.priceToCoordinate, mesma arquitetura provada do
// VolumeProfilePlugin/LiquidityZonesPlugin (<canvas> overlay próprio,
// dirty-flag + requestAnimationFrame, ResizeObserver, zero loop perpétuo).
//
// Fonte de dado: a store (useOrderBookSnapshot) — mesmo padrão do VP
// (useVolumeProfileSnapshot), zero prop-drilling e zero segunda
// assinatura de WebSocket. É o MESMO orderBook que OrderBookWidget
// (painel separado, ladder) já desenha — aqui é a versão overlay-no-
// gráfico, a fatia que faltava.
//
// Nota honesta de escopo (auditoria antes de construir): o stream real
// mantém 8 níveis por lado, não 20 (ver header de nexus/order-book-
// depth.ts). Bids e asks desenham no MESMO lado direito do canvas —
// nunca "crescendo de lados opostos" como um widget de ladder autônomo
// faria: aqui a camada está ancorada ao eixo de PREÇO real do
// candlestick, então bid/ask já ocupam faixas de Y diferentes por
// definição (bids sempre abaixo do preço vivo, asks sempre acima) e
// nunca colidem visualmente. Achado de auditoria (não corrigido nesta
// rodada, fora de escopo de uma camada de desenho): o WebSocket de
// ticker+depth conecta em stream.binance.com (Binance SPOT), enquanto
// os candles do gráfico vêm de fapi.binance.com (Futures) — livro real,
// mas de um mercado tecnicamente diferente do candle. Pré-existente,
// documentado, não uma decisão desta entrega.
//
// "Fio de Seda" (Regra de Ouro 5): a borda de destaque de wall é 1px
// sólida (strokeRect, nunca setLineDash).
//
// Lane própria (achado real, ver chart-profile-lanes.ts): este plugin
// ancorava em cssWidth — mesma faixa de pixels de VolumeProfilePlugin/
// TpoProfilePlugin sempre que mais de um estava visível ao mesmo tempo
// (o caso comum, os 3 defaults são true). Order Book Depth agora é a 3ª
// lane (mais larga das três — poucos níveis reais, cada um precisa de
// espaço legível — mesma razão de sempre, valor só realocado pra fonte
// única).
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { useOrderBookSnapshot, type OrderBookLevel } from "../store/unified-snapshot-store";
import { detectWalls } from "../nexus/order-book-depth";
import { drawCanvasLabel, measureCanvasLabel } from "../nexus/canvas-label";
import { chartBullishRgba, chartBearishRgba } from "./canvas-palette";
import { getProfileLaneRightEdgePx, getProfileLaneMaxBarWidthPx } from "./chart-profile-lanes";
// Achado da AUDITORIA TÉCNICA COMPLETA (item B12): bid/ask usavam Tailwind
// green-500/red-500, um par DIFERENTE do verde/vermelho universal que todo
// o resto do gráfico usa para o mesmo conceito alta/baixa (candles, FVG/OB,
// structure breaks, sweep) — drift real, sem nenhuma justificativa no
// código. Bid (pressão de compra) e ask (pressão de venda) são o mesmo
// conceito bullish/bearish, então agora reusam o par canônico
// (canvas-palette.ts) em vez de um segundo par nascido por acidente.
const BID_FILL = chartBullishRgba(0.22);
const ASK_FILL = chartBearishRgba(0.22);
// Mesmo âmbar já usado nas classificações de atenção deste codebase
// (FPS/latência do ciclo, TelemetryHealthWidget) — nenhum tom novo.
const WALL_BORDER = "rgba(240, 208, 111, 0.9)";

interface DepthChartPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
}

export function DepthChartPlugin({ chart, series }: DepthChartPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const book = useOrderBookSnapshot();
  const bookRef = useRef(book);
  const markDirtyRef = useRef<(() => void) | null>(null);

  bookRef.current = book;

  useEffect(() => {
    markDirtyRef.current?.();
  }, [book]);

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

      const { bids, asks } = bookRef.current;
      if (bids.length === 0 && asks.length === 0) return; // sem livro real => nada desenhado

      const maxSize = Math.max(
        bids.reduce((m, l) => Math.max(m, l.size), 0),
        asks.reduce((m, l) => Math.max(m, l.size), 0),
      );
      if (!(maxSize > 0)) return;

      const laneRight = getProfileLaneRightEdgePx("order_book_depth", cssWidth);
      const maxBarWidth = getProfileLaneMaxBarWidthPx("order_book_depth", cssWidth);
      const barHeight = Math.max(2, cssHeight / 40); // faixa fina real por nível
      const bidWalls = detectWalls(bids);
      const askWalls = detectWalls(asks);

      const drawSide = (levels: OrderBookLevel[], walls: boolean[], fill: string, sideLabel: "BID" | "ASK") => {
        levels.forEach((lvl, i) => {
          const y = series.priceToCoordinate(lvl.price);
          if (y === null) return; // fora da área visível agora — Fail-Closed, nunca extrapola
          const w = (lvl.size / maxSize) * maxBarWidth;
          ctx.fillStyle = fill;
          ctx.fillRect(laneRight - w, y - barHeight / 2, w, barHeight);
          if (!walls[i]) return;
          // Fio de Seda: 1px sólida real, nunca tracejada.
          ctx.lineWidth = 1;
          ctx.strokeStyle = WALL_BORDER;
          ctx.strokeRect(laneRight - w + 0.5, y - barHeight / 2 + 0.5, Math.max(0, w - 1), Math.max(0, barHeight - 1));
          const text = `WALL ${sideLabel}`;
          const size = measureCanvasLabel(ctx, text);
          // Achado real de screenshot (Operador): a etiqueta WALL BID/WALL
          // ASK usava o MESMO âmbar do destaque de barra pros dois lados —
          // a própria barra já é bullish/bearish (fill acima), só a
          // etiqueta não seguia. Reusa os mesmos helpers canônicos
          // (chartBullishRgba/chartBearishRgba, já importados, já usados
          // pela barra) em vez de inventar uma 3ª cor — zero par novo, só
          // a etiqueta alinhada à barra que ela rotula. WALL_BORDER
          // continua servindo só o contorno de destaque da barra (papel
          // diferente: "isto é uma wall", não direção).
          const labelFill = sideLabel === "BID" ? chartBullishRgba(0.85) : chartBearishRgba(0.85);
          drawCanvasLabel(ctx, laneRight - w - size.width - 4, y - size.height / 2, { fill: labelFill, text });
        });
      };

      drawSide(bids, bidWalls, BID_FILL, "BID");
      drawSide(asks, askWalls, ASK_FILL, "ASK");
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

  // width/height explícitos: <canvas> é replaced element — inset:0 sozinho
  // não o estica (mesmo achado já documentado no VolumeProfilePlugin).
  return (
    <canvas
      ref={canvasRef}
      data-plugin="depth-chart"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
