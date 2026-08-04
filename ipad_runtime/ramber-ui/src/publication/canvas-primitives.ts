// publication/canvas-primitives.ts — Ordem "AR10 PUBLICATION STUDIO" §9:
// identidade própria do AR10, nunca copiada de terceiros. A paleta abaixo
// reusa EXATAMENTE os mesmos tons já usados no terminal ao vivo (chart/,
// App.tsx) — zero cor nova inventada só para a exportação, porque a
// identidade visual do AR10 já existe e a peça publicada precisa parecer
// a MESMA marca do terminal, não uma segunda skin.
export const PUB_COLORS = {
  bg: "#010308",
  bgGradientEnd: "#050b16",
  panel: "#0a1220",
  border: "rgba(0, 240, 255, 0.18)",
  cyan: "#00f0ff",
  long: "#00ffaa",
  short: "#ff0055",
  neutral: "#f0d06f",
  textPrimary: "#e8f6ff",
  textMuted: "rgba(138, 180, 248, 0.65)",
  textFaint: "rgba(138, 180, 248, 0.4)",
  candleUp: "#00ffaa",
  candleDown: "#ff0055",
  gridLine: "rgba(138, 180, 248, 0.08)",
} as const;

// Fio de Seda (Regra de Ouro 5): toda linha de marcação é 1px sólida —
// nunca setLineDash, nem no gráfico ao vivo nem na exportação.
export function drawSilkLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function fmtPrice(v: number): string {
  return v.toFixed(v >= 1000 ? 0 : 2);
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

export interface TextOpts {
  font: string;
  color: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  letterSpacing?: number;
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opts: TextOpts): void {
  ctx.save();
  ctx.font = opts.font;
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = opts.baseline ?? "alphabetic";
  if (opts.letterSpacing && "letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${opts.letterSpacing}px`;
  }
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, PUB_COLORS.bg);
  grad.addColorStop(1, PUB_COLORS.bgGradientEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// Chip colorido (bias, badges) — mesma linguagem visual do terminal
// (cyber-panel com borda translúcida), nunca um elemento decorativo novo.
export function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  fontSize: number,
): { width: number; height: number } {
  ctx.save();
  ctx.font = `700 ${fontSize}px "IBM Plex Mono", "SF Mono", monospace`;
  const textWidth = ctx.measureText(text).width;
  ctx.restore();
  const paddingX = fontSize * 0.7;
  const paddingY = fontSize * 0.55;
  const w = textWidth + paddingX * 2;
  const h = fontSize + paddingY * 2;
  drawRoundedRect(ctx, x, y, w, h, h / 2, `${color}22`, `${color}88`);
  drawText(ctx, text, x + w / 2, y + h / 2 + fontSize * 0.35, {
    font: `700 ${fontSize}px "IBM Plex Mono", "SF Mono", monospace`,
    color,
    align: "center",
  });
  return { width: w, height: h };
}

export const MONO_FONT = '"IBM Plex Mono", "SF Mono", ui-monospace, monospace';

// Basis/regime/structure labels são texto real de comprimento variável —
// trunca com reticência real em vez de deixar transbordar por cima de
// outro elemento (mesma disciplina anti-colisão que o eixo do gráfico ao
// vivo já aplica, só que aqui a "colisão" é com a borda do card).
export function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, font: string, maxWidth: number): string {
  ctx.save();
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.restore();
    return text;
  }
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  ctx.restore();
  return `${out}…`;
}
