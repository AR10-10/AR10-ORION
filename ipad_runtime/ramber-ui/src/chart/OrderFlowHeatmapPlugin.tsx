// OrderFlowHeatmapPlugin.tsx — V-MAX Fase 1.2 (Blueprint §3.1: "Densidade
// Institucional | OrderFlowHeatmapPlugin | OffscreenCanvas + fallback").
// Desenha DUAS coisas reais, nenhuma delas existia como visual até aqui:
//   1. Densidade de profundidade L2 (bids/asks) ao longo do tempo — o
//      histórico real de nexus/l2-history.ts (Fase 1.1), amostrado do
//      mesmo WS de livro que já alimenta as fileiras de bids/asks da UI.
//   2. Bolhas de trades grandes — nexus/orderflow-history.ts (Fase 1.2),
//      percentil real da amostra de volumes observada (nunca um limiar
//      fixo), nunca um trade fabricado.
// Lê os dois diretamente da store via hooks (useL2History/
// useOrderflowHistory) — mesmo padrão já usado em App.tsx
// (useOfflineSnapshot/useDataFreshSnapshot), não via props: estes dados já
// são globais por design (Fase 1.1/1.2), então um componente que os
// consome assina a fatia direto, sem prop-drilling por 3 camadas.
//
// Nota de escopo (fechada na superfície visual da Fase 1): a linha de CVD
// vive no EnhancedChart_110_Percent como série NATIVA da lib em escala de
// preço própria ('cvd', banda inferior) — uma série real com eixo real,
// não um traço em canvas — alimentada pelo MESMO orderflowHistory real
// deste plugin. Este plugin cobre só "Densidade": livro + trades grandes.
//
// Geometria SEMPRE via priceToCoordinate/timeToCoordinate reais da própria
// lib (nunca pixel fixo) — mesma garantia Fail-Closed do LiquidityZonesPlugin:
// amostra fora da janela visível (x/y null) nunca é desenhada, nunca
// extrapolada.
//
// "Fio de Seda" (Regra de Ouro 2): o traço de cada bolha é 1px sólido real
// (drawHeatmapFrame nunca chama setLineDash) — a hierarquia entre trades
// vem só do raio (computeBubbleRadius), nunca do estilo do traço.
//
// OffscreenCanvas + fallback (Blueprint §3.2, "Main Thread sagrado"): dois
// <canvas> são montados, um candidato a ser transferido para um Worker
// dedicado (orderflow-heatmap-worker.ts) e um de reserva para desenho
// direto no main thread. A decisão de qual usar é um HANDSHAKE real, não
// uma suposição de suporte — transferControlToOffscreen() é irreversível
// (uma vez chamado, aquele elemento nunca mais devolve um contexto 2D
// normal), então o candidato só é mostrado depois que o worker confirma
// de volta que conseguiu um contexto real; qualquer falha/timeout (achado
// documentado na Fase 0.7: suporte de OffscreenCanvas 2D em Worker no
// Safari/iPad não é confiável hoje) esconde o candidato (agora inerte, mas
// inofensivo) e usa o canvas de reserva — o mesmo caminho de desenho
// direto já comprovado em produção pelo LiquidityZonesPlugin.
import { useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { useL2History, useOrderflowHistory } from "../store/unified-snapshot-store";
import {
  drawHeatmapFrame,
  computeCellAlpha,
  computeBubbleRadius,
  computeRecencyWeight,
  type HeatmapCell,
  type HeatmapBubble,
  type HeatmapFrame,
  type HeatmapWorkerOutMessage,
} from "../nexus/orderflow-heatmap-draw";

interface OrderFlowHeatmapPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
}

// Altura fixa de cada célula de profundidade (px CSS) — um nível L2 é um
// preço exato, não uma faixa; sem uma altura mínima ele seria 1 sub-pixel
// invisível. Isto é uma escolha de legibilidade documentada, não uma
// medição fabricada — o VALOR desenhado (opacidade) continua 100% real.
const CELL_HEIGHT = 3;
// Largura de célula quando não há próxima amostra real para medir a
// distância (última amostra do ring) — mesma ordem de grandeza do
// intervalo real de amostragem (l2-history.ts, 2s) convertido em pixels
// típicos de zoom, nunca usada quando dá para medir a distância real.
const CELL_WIDTH_FALLBACK = 6;
const HANDOFF_TIMEOUT_MS = 800;

type RendererMode = "pending" | "worker" | "main";

function supportsOffscreenWorker(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof (HTMLCanvasElement.prototype as unknown as { transferControlToOffscreen?: unknown }).transferControlToOffscreen === "function"
  );
}

export function OrderFlowHeatmapPlugin({ chart, series }: OrderFlowHeatmapPluginProps) {
  const l2History = useL2History("BINANCE");
  const orderflowHistory = useOrderflowHistory();
  const dataRef = useRef({ l2History, orderflowHistory });
  dataRef.current = { l2History, orderflowHistory };

  const workerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const markDirtyRef = useRef<(() => void) | null>(null);
  // modeRef é o que o loop de desenho lê (nunca re-executa o efeito de
  // setup abaixo ao mudar) — `mode` (state) existe só para alternar QUAL
  // <canvas> fica visível no JSX. Ver comentário no efeito: incluir `mode`
  // nas dependências do efeito reiniciaria o próprio Worker que acabou de
  // decidir esse mode (loop de recriação).
  const modeRef = useRef<RendererMode>("pending");
  const [mode, setMode] = useState<RendererMode>("pending");

  useEffect(() => {
    markDirtyRef.current?.();
  }, [l2History, orderflowHistory]);

  useEffect(() => {
    if (!chart || !series) return;
    let cancelled = false;
    let worker: Worker | null = null;
    let rafScheduled = false;
    let lastPxSize = { w: 0, h: 0 };

    const buildFrame = (cssWidth: number, cssHeight: number, dpr: number): HeatmapFrame => {
      const timeScale = chart.timeScale();
      const { l2History: l2, orderflowHistory: of } = dataRef.current;

      let maxBid = 0;
      let maxAsk = 0;
      for (const entry of l2) {
        for (const lvl of entry.bids) if (lvl.size > maxBid) maxBid = lvl.size;
        for (const lvl of entry.asks) if (lvl.size > maxAsk) maxAsk = lvl.size;
      }

      // Diretriz Final de Lapidação Visual, Partes 3/4 ("ciclo de vida
      // automático, sem corte abrupto"): computeRecencyWeight pondera pela
      // POSIÇÃO real de cada amostra no ring buffer (l2/orderflowHistory
      // são capacidade fixa, não janela de tempo) — a amostra mais antiga
      // já esmaece ANTES de ser evictada, então sair do buffer nunca é um
      // corte visual perceptível de um frame pro outro.
      const cells: HeatmapCell[] = [];
      for (let i = 0; i < l2.length; i++) {
        const entry = l2[i];
        const recency = computeRecencyWeight(i, l2.length);
        const x1 = timeScale.timeToCoordinate((Math.floor(entry.time / 1000)) as unknown as Time);
        if (x1 === null) continue;
        const next = l2[i + 1];
        let cellWidth = CELL_WIDTH_FALLBACK;
        if (next) {
          const x2 = timeScale.timeToCoordinate((Math.floor(next.time / 1000)) as unknown as Time);
          if (x2 !== null) cellWidth = Math.max(2, x2 - x1);
        }
        for (const lvl of entry.bids) {
          const y = series.priceToCoordinate(lvl.price);
          if (y === null) continue;
          const alpha = computeCellAlpha(lvl.size, maxBid) * recency;
          if (alpha <= 0) continue;
          cells.push({ x: x1, y: y - CELL_HEIGHT / 2, w: cellWidth, h: CELL_HEIGHT, color: `rgba(0, 255, 170, ${alpha.toFixed(3)})` });
        }
        for (const lvl of entry.asks) {
          const y = series.priceToCoordinate(lvl.price);
          if (y === null) continue;
          const alpha = computeCellAlpha(lvl.size, maxAsk) * recency;
          if (alpha <= 0) continue;
          cells.push({ x: x1, y: y - CELL_HEIGHT / 2, w: cellWidth, h: CELL_HEIGHT, color: `rgba(255, 0, 85, ${alpha.toFixed(3)})` });
        }
      }

      let maxVolume = 0;
      for (const entry of of) for (const t of entry.largeTrades) if (t.volume > maxVolume) maxVolume = t.volume;
      const bubbles: HeatmapBubble[] = [];
      for (let i = 0; i < of.length; i++) {
        const entry = of[i];
        const recency = computeRecencyWeight(i, of.length);
        for (const t of entry.largeTrades) {
          const x = timeScale.timeToCoordinate((Math.floor(t.time / 1000)) as unknown as Time);
          const y = series.priceToCoordinate(t.price);
          if (x === null || y === null) continue;
          const r = computeBubbleRadius(t.volume, maxVolume);
          const bullish = t.side === "BUY";
          // Pedido do Operador: camada estava "atrapalhando a visão"
          // (hasOrderBook é quase sempre true ao vivo, então isto aparece
          // quase o tempo todo) — coeficientes reduzidos de 0.35/0.85 para
          // 0.22/0.55, mesmo espírito de computeCellAlpha acima.
          const fillAlpha = (0.22 * recency).toFixed(3);
          const strokeAlpha = (0.55 * recency).toFixed(3);
          bubbles.push({
            x, y, r,
            fill: bullish ? `rgba(0, 255, 170, ${fillAlpha})` : `rgba(255, 0, 85, ${fillAlpha})`,
            stroke: bullish ? `rgba(0, 255, 170, ${strokeAlpha})` : `rgba(255, 0, 85, ${strokeAlpha})`,
          });
        }
      }

      return { cssWidth, cssHeight, dpr, cells, bubbles };
    };

    const drawMain = () => {
      const canvas = mainCanvasRef.current;
      if (!canvas) return;
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
      drawHeatmapFrame(ctx, buildFrame(cssWidth, cssHeight, dpr));
    };

    const drawWorker = () => {
      const canvas = workerCanvasRef.current;
      if (!canvas || !worker) return;
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      if (cssWidth === 0 || cssHeight === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const pxWidth = Math.round(cssWidth * dpr);
      const pxHeight = Math.round(cssHeight * dpr);
      if (pxWidth !== lastPxSize.w || pxHeight !== lastPxSize.h) {
        lastPxSize = { w: pxWidth, h: pxHeight };
        worker.postMessage({ type: "resize", pxWidth, pxHeight });
      }
      worker.postMessage({ type: "draw", frame: buildFrame(cssWidth, cssHeight, dpr) });
    };

    const markDirty = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        if (modeRef.current === "worker") drawWorker();
        else if (modeRef.current === "main") drawMain();
      });
    };
    markDirtyRef.current = markDirty;

    const onRangeChange = () => markDirty();
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);
    const resizeObserver = new ResizeObserver(() => markDirty());
    if (workerCanvasRef.current) resizeObserver.observe(workerCanvasRef.current);
    if (mainCanvasRef.current) resizeObserver.observe(mainCanvasRef.current);

    const decideRenderer = async () => {
      if (supportsOffscreenWorker() && workerCanvasRef.current) {
        try {
          const candidateWorker = new Worker(new URL("../workers/orderflow-heatmap-worker.ts", import.meta.url), { type: "module" });
          const offscreen = (workerCanvasRef.current as unknown as { transferControlToOffscreen: () => OffscreenCanvas }).transferControlToOffscreen();
          const ok = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(false), HANDOFF_TIMEOUT_MS);
            candidateWorker.onmessage = (ev: MessageEvent<HeatmapWorkerOutMessage>) => {
              if (ev.data?.type === "ready") {
                clearTimeout(timer);
                resolve(!!ev.data.ok);
              }
            };
            candidateWorker.onerror = () => {
              clearTimeout(timer);
              resolve(false);
            };
            candidateWorker.postMessage({ type: "init", canvas: offscreen }, [offscreen]);
          });
          if (cancelled) {
            candidateWorker.terminate();
            return;
          }
          if (ok) {
            worker = candidateWorker;
            modeRef.current = "worker";
            setMode("worker");
            markDirty();
            return;
          }
          candidateWorker.terminate();
        } catch {
          // Falha real ao tentar o caminho OffscreenCanvas (Worker
          // indisponível, construção lançou, etc.) — cai para o fallback
          // abaixo, nunca fica sem heatmap por causa disto.
        }
      }
      if (!cancelled) {
        modeRef.current = "main";
        setMode("main");
        markDirty();
      }
    };
    void decideRenderer();

    return () => {
      cancelled = true;
      markDirtyRef.current = null;
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      resizeObserver.disconnect();
      worker?.terminate();
    };
    // Deliberadamente SEM `mode` aqui — decideRenderer() escreve em
    // modeRef/setMode DENTRO deste mesmo efeito; incluir `mode` reiniciaria
    // o efeito (e recriaria o Worker) assim que ele próprio decide o modo,
    // um loop de recriação. chart/série são as únicas dependências reais.
  }, [chart, series]);

  return (
    <>
      <canvas
        ref={workerCanvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%", display: mode === "worker" ? "block" : "none" }}
      />
      <canvas
        ref={mainCanvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%", display: mode === "main" ? "block" : "none" }}
      />
    </>
  );
}
