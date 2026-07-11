// orderflow-heatmap-worker.ts — V-MAX Fase 1.2 (Blueprint §3.2:
// "OffscreenCanvas quando suportado"). Este worker só executa desenho —
// nenhum cálculo de preço→pixel acontece aqui (isso depende do estado
// vivo do chart — pan/zoom/price scale — que só existe no main thread).
// O componente React já resolve tudo em pixels reais via lightweight-
// charts (as funções de conversão tempo/preço→pixel da própria lib,
// chamadas do lado de lá) antes de mandar o frame; este worker só tira do
// main thread a parte genuinamente cara (centenas a milhares de
// fillRect/arc por redraw — "Main thread sagrado", Blueprint preâmbulo).
//
// Mesmo padrão de handshake real usado no resto do sistema (nunca supõe
// sucesso): reporta { type: 'ready', ok } de volta depois de tentar obter
// o contexto 2D real do OffscreenCanvas transferido — se `getContext('2d')`
// devolver null (engine sem suporte real, apesar de expor a API), o
// componente que criou este worker recebe ok:false e cai para o fallback
// Canvas2D no main thread em vez de ficar com um heatmap mudo.
import { drawHeatmapFrame, type HeatmapWorkerInMessage, type HeatmapWorkerOutMessage } from "../nexus/orderflow-heatmap-draw";

let ctx: OffscreenCanvasRenderingContext2D | null = null;
let canvas: OffscreenCanvas | null = null;

function post(msg: HeatmapWorkerOutMessage): void {
  (self as unknown as Worker).postMessage(msg);
}

self.onmessage = (ev: MessageEvent<HeatmapWorkerInMessage>) => {
  const msg = ev.data;
  if (msg.type === "init") {
    canvas = msg.canvas;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      ctx = null;
    }
    post({ type: "ready", ok: !!ctx });
    return;
  }
  if (msg.type === "resize") {
    if (!canvas) return;
    canvas.width = msg.pxWidth;
    canvas.height = msg.pxHeight;
    return;
  }
  if (msg.type === "draw") {
    if (!ctx) return;
    drawHeatmapFrame(ctx, msg.frame);
  }
};
