// orderflow-heatmap-draw.ts — V-MAX Fase 1.2: primitiva de desenho REAL e
// PURA do OrderFlowHeatmapPlugin, compartilhada pelos dois caminhos de
// render (Worker via OffscreenCanvas e fallback no main thread) — "zero
// repetição": a lógica de fillRect/arc é escrita uma única vez aqui, nunca
// duplicada entre orderflow-heatmap-worker.ts e OrderFlowHeatmapPlugin.tsx.
//
// Este módulo nunca toca `chart`/`series` da lightweight-charts (esses só
// existem no main thread) — recebe descritores JÁ resolvidos em pixels
// (HeatmapCell/HeatmapBubble), preparados pelo componente React via
// timeScale.timeToCoordinate()/series.priceToCoordinate() reais. Isto é o
// que torna o protocolo do Worker "postMessage-safe": HeatmapFrame é um
// objeto plano (structured-clone-safe), nunca uma referência a `chart`.
//
// "Fio de Seda" (Regra de Ouro 2): o traço de cada bolha de trade grande é
// sempre lineWidth=1 sólido — nunca um traço pontilhado/tracejado. A
// hierarquia entre bolhas (tamanho do trade) vem só do RAIO real
// (computeBubbleRadius), nunca do estilo do traço.
export interface HeatmapCell {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string; // rgba(...) já resolvida — nunca calculada dentro do draw.
}

export interface HeatmapBubble {
  x: number;
  y: number;
  r: number;
  fill: string;
  stroke: string;
}

export interface HeatmapFrame {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  cells: HeatmapCell[];
  bubbles: HeatmapBubble[];
}

// Protocolo real do Worker (Fase 1.2) — tipos compartilhados pelos dois
// lados (plugin + worker) para o postMessage nunca dessincronizar.
export type HeatmapWorkerInMessage =
  | { type: "init"; canvas: OffscreenCanvas }
  | { type: "resize"; pxWidth: number; pxHeight: number }
  | { type: "draw"; frame: HeatmapFrame };

export type HeatmapWorkerOutMessage = { type: "ready"; ok: boolean };

// Subconjunto real de CanvasRenderingContext2D/OffscreenCanvasRenderingContext2D
// que este módulo usa — os dois tipos da lib DOM já são estruturalmente
// compatíveis com isto, então a mesma função serve os dois contextos sem
// nenhum cast/duplicação.
export interface DrawableContext2D {
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  arc(x: number, y: number, r: number, startAngle: number, endAngle: number): void;
  fill(): void;
  stroke(): void;
  // Tipo exatamente igual ao real (CanvasRenderingContext2D/
  // OffscreenCanvasRenderingContext2D aceitam CanvasGradient/CanvasPattern
  // além de string) — mesmo só escrevendo string aqui, estreitar o tipo
  // quebraria a compatibilidade estrutural (propriedade mutável é
  // invariante em TS) com os dois contextos reais da DOM.
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
}

export function drawHeatmapFrame(ctx: DrawableContext2D, frame: HeatmapFrame): void {
  const { cssWidth, cssHeight, dpr, cells, bubbles } = frame;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  for (const cell of cells) {
    ctx.fillStyle = cell.color;
    ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
  }
  for (const b of bubbles) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.fill;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = b.stroke;
    ctx.stroke();
  }
}

// Opacidade real proporcional ao tamanho do nível DENTRO do frame atual
// (nunca um limiar fixo — Regra de Ouro 1): sem profundidade real (size<=0
// ou amostra sem máximo real ainda), zero alpha — nunca um valor de
// exemplo só para o nível aparecer. minAlpha/maxAlpha são uma janela de
// legibilidade (o menor nível real ainda precisa ser visível a olho nu, o
// maior não pode ofuscar as velas por trás), não uma medição.
export function computeCellAlpha(size: number, maxSize: number, minAlpha = 0.04, maxAlpha = 0.30): number {
  if (!(maxSize > 0) || !(size > 0)) return 0;
  const ratio = Math.min(1, size / maxSize);
  return minAlpha + ratio * (maxAlpha - minAlpha);
}

// Raio real proporcional ao volume do trade DENTRO da amostra atual de
// trades grandes. Diferente de computeCellAlpha: um trade só chega aqui
// depois de já ter sido classificado "grande" de verdade (percentil real,
// orderflow-history.ts) — é sempre um evento real que aconteceu, então o
// caso degenerado (maxVolume indisponível) devolve o raio MÍNIMO visível
// em vez de 0: esconder um trade grande real seria descartar dado real,
// pior do que exibi-lo pequeno demais por falta de uma escala melhor.
export function computeBubbleRadius(volume: number, maxVolume: number, minR = 3, maxR = 11): number {
  if (!(maxVolume > 0) || !(volume > 0)) return minR;
  const ratio = Math.min(1, volume / maxVolume);
  return minR + ratio * (maxR - minR);
}
