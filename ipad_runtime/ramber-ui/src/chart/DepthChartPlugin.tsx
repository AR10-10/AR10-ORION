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
import { getChartLayerZIndex } from "./chart-layer-depth";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { useOrderBookSnapshot, type OrderBookLevel } from "../store/unified-snapshot-store";
import { detectWalls } from "../nexus/order-book-depth";
import { drawCanvasLabel, measureCanvasLabel } from "../nexus/canvas-label";
import { chartBullishRgba, chartBearishRgba } from "./canvas-palette";
import { getProfileLaneRightEdgePx, getProfileLaneMaxBarWidthPx, type ChartProfileLaneId } from "./chart-profile-lanes";
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
const WALL_BORDER = "rgba(240, 193, 111, 0.9)";

// Achado real (task #285, auditoria "Ajuste Visual"): a etiqueta WALL BID/
// WALL ASK nunca mostrava o preço real do nível — só o lado. Mesmo gap de
// classe já fechado para POC/VAH/VAL/IB (task #341): uma zona de preço real
// desenhada no gráfico sem número legível, o Operador precisava passar o
// mouse pra saber o valor exato. Mesma lógica de fmtAxisLabelPrice
// (EnhancedChart_110_Percent.tsx) — duplicada aqui de propósito, não
// importada: aquele arquivo já importa DepthChartPlugin, então o sentido
// contrário criaria um ciclo real (mesmo cuidado já registrado para
// chart-ultrawide-scale.ts).
function fmtWallPrice(v: number): string {
  if (v >= 1000) return v.toFixed(0);
  const withDecimals = v.toFixed(2);
  return withDecimals.endsWith(".00") ? v.toFixed(0) : withDecimals;
}

// ---------------------------------------------------------------------------
// Achado 3.2 — DUAS capturas reais do terminal ao vivo enviadas pelo Operador
// (BTC/USDT 1H e 15m) mostraram o pior objeto do gráfico, e nenhum teste ou
// auditoria anterior tinha pegado porque ambos só aparecem com livro REAL
// conectado (o ambiente de desenvolvimento aqui não alcança a Binance):
//
//   1. ETIQUETA DUPLICADA. Na captura de 15m aparecem TRÊS etiquetas quase
//      no mesmo pixel: "WALL BID 63570", "WALL BID 63570" (literalmente o
//      mesmo texto duas vezes) e "WALL ASK 63570". Causa raiz: detectWalls()
//      devolve um boolean POR NÍVEL, sem teto e sem agrupamento, então vários
//      níveis adjacentes do livro passam do multiplicador ao mesmo tempo — e
//      fmtWallPrice() arredonda para inteiro acima de 1000, então 63570.1 e
//      63570.4 renderizam a MESMA string. O desenho não deduplicava nada.
//   2. ETIQUETA FORA DA PRÓPRIA LANE. O x era `laneRight - w - largura - 4`,
//      isto é, à ESQUERDA da barra — para dentro da área dos candles. O
//      plugin calcula `laneRight`/`maxBarWidth` via chart-profile-lanes.ts
//      exatamente para não invadir vizinho, e então a etiqueta ignorava a
//      lane que ele mesmo computou. É o que se vê nas 2 capturas: caixas
//      largas atravessando a ação do preço na horizontal.
//
// Correção: as etiquetas passam a competir entre si (força real do nível
// decide), deduplicadas por texto renderizado e por proximidade vertical, com
// teto — mesma disciplina que price-label-stack.ts já aplica no eixo de preço
// e que o dedup do Sweep já aplica por preço. E o x fica ancorado DENTRO da
// lane, nunca mais sobre os candles.
//
// A resolução é uma função pura exportada porque a matemática é a parte que
// pode estar sutilmente errada (CLAUDE.md: fronteira ganha teste de execução
// real, não só padrão de código).
export const MAX_WALL_LABELS = 3;
export const WALL_LABEL_MIN_GAP_PX = 2;

export interface WallLabelCandidate {
  /** Texto já renderizado — é o que o Operador lê, e a chave de deduplicação:
   *  dois níveis distintos que arredondam para o mesmo preço são, na tela, a
   *  mesma etiqueta. */
  text: string;
  /** Coordenada y real da barra (series.priceToCoordinate). */
  y: number;
  /** Tamanho real do nível no livro — a força que decide quem vence a
   *  competição. Nunca fabricado: é o `lvl.size` do livro real. */
  size: number;
  /** Altura real da caixa de rótulo (measureCanvasLabel). */
  height: number;
  /** rgba já resolvida do lado (bid/ask) — passthrough. */
  fill: string;
}

/** Resolve QUAIS etiquetas de wall desenhar. Ordem de vitória: força real do
 *  nível (maior `size` primeiro). Descarta texto repetido e qualquer candidata
 *  que colidiria verticalmente com uma já aceita. Fail-closed por construção:
 *  lista vazia entra, lista vazia sai. */
export function resolveWallLabels(
  candidates: readonly WallLabelCandidate[],
  maxLabels: number = MAX_WALL_LABELS,
  minGapPx: number = WALL_LABEL_MIN_GAP_PX,
): WallLabelCandidate[] {
  const byStrength = [...candidates].sort((a, b) => b.size - a.size);
  const kept: WallLabelCandidate[] = [];
  const seenText = new Set<string>();
  for (const c of byStrength) {
    if (kept.length >= maxLabels) break;
    if (seenText.has(c.text)) continue; // mesmo preço na tela — 1 etiqueta só
    const collides = kept.some((k) => Math.abs(k.y - c.y) < (k.height + c.height) / 2 + minGapPx);
    if (collides) continue; // encostaria numa já aceita e mais forte
    seenText.add(c.text);
    kept.push(c);
  }
  return kept;
}

interface DepthChartPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  /** Quais lanes de perfil estão REALMENTE sendo desenhadas agora. Sem
   *  isto cada plugin assumia que as outras duas sempre existiam e
   *  reservava espaço para lanes ocultas — a causa raiz da etiqueta do
   *  livro flutuando no meio das velas (captura real do Operador). */
  activeLanes?: readonly ChartProfileLaneId[];
}

export function DepthChartPlugin({ chart, series, activeLanes }: DepthChartPluginProps) {
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

      const laneRight = getProfileLaneRightEdgePx("order_book_depth", cssWidth, activeLanes);
      const maxBarWidth = getProfileLaneMaxBarWidthPx("order_book_depth", cssWidth, activeLanes);
      const barHeight = Math.max(2, cssHeight / 40); // faixa fina real por nível
      const bidWalls = detectWalls(bids);
      const askWalls = detectWalls(asks);

      // Achado 3.2: as candidatas dos DOIS lados entram na mesma competição —
      // a captura de 15m mostrou uma etiqueta BID e uma ASK colidindo no mesmo
      // preço, então deduplicar por lado separadamente não resolveria nada.
      const wallCandidates: WallLabelCandidate[] = [];

      const drawSide = (levels: OrderBookLevel[], walls: boolean[], fill: string, sideLabel: "BID" | "ASK") => {
        levels.forEach((lvl, i) => {
          const y = series.priceToCoordinate(lvl.price);
          if (y === null) return; // fora da área visível agora — Fail-Closed, nunca extrapola
          const w = (lvl.size / maxSize) * maxBarWidth;
          ctx.fillStyle = fill;
          ctx.fillRect(laneRight - w, y - barHeight / 2, w, barHeight);
          if (!walls[i]) return;
          // Fio de Seda: 1px sólida real, nunca tracejada. O CONTORNO de
          // destaque continua em toda wall real — quem foi filtrado no
          // Achado 3.2 é só a ETIQUETA de texto, nunca o dado (Regra de
          // Ouro 4: a wall segue visível e marcada, só não repete o número).
          ctx.lineWidth = 1;
          ctx.strokeStyle = WALL_BORDER;
          ctx.strokeRect(laneRight - w + 0.5, y - barHeight / 2 + 0.5, Math.max(0, w - 1), Math.max(0, barHeight - 1));
          const text = `WALL ${sideLabel} ${fmtWallPrice(lvl.price)}`;
          const size = measureCanvasLabel(ctx, text);
          // A etiqueta segue a direção da própria barra (bid=alta, ask=baixa),
          // reusando o par canônico de canvas-palette.ts — zero cor nova.
          // WALL_BORDER continua servindo só o contorno ("isto é uma wall",
          // papel diferente de direção).
          const labelFill = sideLabel === "BID" ? chartBullishRgba(0.85) : chartBearishRgba(0.85);
          wallCandidates.push({ text, y, size: lvl.size, height: size.height, fill: labelFill });
        });
      };

      drawSide(bids, bidWalls, BID_FILL, "BID");
      drawSide(asks, askWalls, ASK_FILL, "ASK");

      // Achado 3.2: desenha só as vencedoras, e SEMPRE dentro da própria lane.
      // O x é ancorado à direita da lane (`laneRight`), nunca mais à esquerda
      // da barra — era isso que jogava a caixa por cima dos candles nas 2
      // capturas do Operador.
      for (const c of resolveWallLabels(wallCandidates)) {
        const size = measureCanvasLabel(ctx, c.text);
        drawCanvasLabel(ctx, laneRight - size.width - 2, c.y - c.height / 2, { fill: c.fill, text: c.text });
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
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex("order_book_depth") }}
    />
  );
}
