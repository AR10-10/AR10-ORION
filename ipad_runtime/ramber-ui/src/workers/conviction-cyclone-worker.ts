// conviction-cyclone-worker.ts — "Ciclone de Convicção": mesmo protocolo
// de handshake real já usado por orderflow-heatmap-worker.ts (init/resize,
// reporta { type: 'ready', ok } depois de tentar getContext('2d') real no
// OffscreenCanvas transferido — nunca supõe sucesso). A diferença real
// deste worker: é o PRIMEIRO desta base com um laço de animação PRÓPRIO
// (setInterval interno) — Main Thread sagrada (CLAUDE.md) pedia
// exatamente isto, "iniciativa própria e isolada", nunca uma pulsação
// perpétua enxertada no thread principal. O laço só roda quando existe
// dado real: chega uma vez por `update` real (dirty-flag do plugin, raro
// — muda só quando plano/convicção/pulso real mudam), e a partir daí o
// worker mesmo avança seu relógio interno (`performance.now()`, local ao
// worker) e redesenha em ~25fps — suficiente pra um espiral lento parecer
// vivo, bem mais barato que 60fps, e inteiramente fora do main thread
// (quando este handshake é aceito; ver o comentário em
// NeuralMarketAuraPlugin.tsx sobre por que o fallback do main thread
// NUNCA roda este mesmo laço).
import {
  computeCycloneFrame,
  drawCycloneFrame,
  type CycloneRealParams,
  type CycloneWorkerInMessage,
  type CycloneWorkerOutMessage,
} from "../nexus/conviction-cyclone-draw";

let ctx: OffscreenCanvasRenderingContext2D | null = null;
let canvas: OffscreenCanvas | null = null;
let lastReal: CycloneRealParams | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let startedAt = 0;

// ~25fps — parâmetro visual documentado (mesma natureza dos outros
// limiares desta sessão), não uma medição: um espiral lento não precisa
// de 60fps pra parecer vivo, e o custo real por tick já está fora do main
// thread de qualquer forma quando este caminho é usado.
const TICK_MS = 40;

function post(msg: CycloneWorkerOutMessage): void {
  (self as unknown as Worker).postMessage(msg);
}

function stopTicking(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function startTicking(): void {
  if (intervalId !== null) return; // já rodando — nunca duplica o laço
  startedAt = performance.now();
  intervalId = setInterval(() => {
    if (!ctx || !lastReal) return;
    const tMs = performance.now() - startedAt;
    drawCycloneFrame(ctx, computeCycloneFrame(lastReal, tMs));
  }, TICK_MS);
}

self.onmessage = (ev: MessageEvent<CycloneWorkerInMessage>) => {
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
  if (msg.type === "update") {
    lastReal = msg.real;
    if (lastReal === null) {
      // Sem leitura real (status != OK, sem plano, ou fadeAlpha 0) — para
      // de ticar e limpa o canvas: nunca desenha um ciclone fabricado sem
      // operação real por trás, e nunca queima ciclo de CPU nenhum sem
      // dado real pra mostrar.
      stopTicking();
      if (ctx && canvas) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    startTicking();
  }
};
