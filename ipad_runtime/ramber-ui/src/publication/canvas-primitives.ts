// publication/canvas-primitives.ts — Ordem "AR10 PUBLICATION STUDIO" §9:
// identidade própria do AR10, nunca copiada de terceiros. A paleta abaixo
// reusa EXATAMENTE os mesmos tons já usados no terminal ao vivo (chart/,
// App.tsx) — zero cor nova inventada só para a exportação, porque a
// identidade visual do AR10 já existe e a peça publicada precisa parecer
// a MESMA marca do terminal, não uma segunda skin.
import { formatPrice as sharedFormatPrice } from "../nexus/price-format";

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
  // Delega à fonte única — esta função era uma das TRÊS cópias byte a byte
  // de `v.toFixed(v >= 1000 ? 0 : 2)` espalhadas pelo app.
  return sharedFormatPrice(v);
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

// ═══ O AVISO LEGAL — UMA FONTE ÚNICA, NUNCA COPIADA ═══
//
// Pedido direto do Operador: "o nome lá embaixo que não é recomendação de
// investimento tem que estar perfeito também".
//
// ACHADO REAL DA AUDITORIA (o defeito mais grave desta rodada): o aviso
// existia escrito à mão em renderAnalysis e renderStory, mas estava
// SIMPLESMENTE AUSENTE em renderX e renderPremium — e esses dois são
// exatamente os formatos de rede social (imagem do X e card quadrado de
// feed). Ou seja: metade das peças publicáveis saía para o público sem o
// aviso, e a razão era estrutural — cada formato reescrevia a marca à mão,
// então "esquecer" era o caminho de menor resistência.
//
// A correção real não é escrever o texto mais duas vezes: é existir UM só
// lugar onde ele mora. Todo formato chama drawBrandLockup — quem escrever
// um 5º formato amanhã ganha o aviso de graça, e o teste de publicação
// varre as 4 funções exigindo esta chamada.
export const PUBLICATION_DISCLAIMER = "confluência real, não é recomendação de investimento";
export const PUBLICATION_BRAND = "AR10 CYBORG";

/**
 * Assinatura de marca + aviso legal, em uma primitiva única.
 *
 * `align: "center"` centraliza os dois no eixo x dado; `align: "left"`
 * alinha ambos à esquerda de x (usado no formato X, cuja coluna de texto é
 * alinhada à esquerda). Devolve o y final para quem precisa continuar
 * empilhando conteúdo abaixo.
 */
export function drawBrandLockup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: { brandSize: number; disclaimerSize: number; align?: "left" | "center"; letterSpacing?: number },
): number {
  const align: CanvasTextAlign = opts.align === "left" ? "left" : "center";
  drawText(ctx, PUBLICATION_BRAND, x, y, {
    font: `800 ${opts.brandSize}px ${MONO_FONT}`,
    color: PUB_COLORS.cyan,
    align,
    letterSpacing: opts.letterSpacing ?? 2,
  });
  const next = y + opts.brandSize * 1.15;
  drawText(ctx, PUBLICATION_DISCLAIMER, x, next, {
    font: `500 ${opts.disclaimerSize}px ${MONO_FONT}`,
    color: PUB_COLORS.textFaint,
    align,
  });
  return next + opts.disclaimerSize;
}

// ═══ AURA DIRECIONAL — efeito que CARREGA informação ═══
//
// Pedido do Operador: "com os efeito bonito pra chamar atenção de quem vê
// meus post... bem profissional de elite".
//
// A regra do Ω-INFINITY ("aumentar a compreensão real do Operador, nunca só
// efeito estético") vale igual aqui: este brilho não é decoração neutra —
// ele é pintado NA COR DO VIÉS REAL (verde em LONG, vermelho em SHORT,
// âmbar em conflito). Quem vê o post lê a direção da peça antes de ler uma
// única palavra, que é exatamente o que um card de rede social precisa
// fazer nos primeiros 200ms de atenção.
export function paintDirectionalAura(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  intensity = 0.16,
): void {
  // Brilho radial no topo — origem da leitura (o símbolo e o viés moram
  // ali). Raio proporcional à peça para funcionar igual em 1920x1080 e em
  // 1080x1920, sem número mágico por formato.
  const radius = Math.max(w, h) * 0.6;
  const grad = ctx.createRadialGradient(w / 2, h * 0.12, 0, w / 2, h * 0.12, radius);
  grad.addColorStop(0, withAlpha(color, intensity));
  grad.addColorStop(0.55, withAlpha(color, intensity * 0.28));
  grad.addColorStop(1, withAlpha(color, 0));
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Barra de acento de 1 borda na cor do viés — a "faixa de identidade" que
 *  terminais e cards editoriais usam para marcar a lateral da peça. */
export function paintAccentEdge(ctx: CanvasRenderingContext2D, w: number, h: number, color: string): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, withAlpha(color, 0.85));
  grad.addColorStop(1, withAlpha(color, 0.05));
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, Math.max(3, Math.round(w * 0.004)), h);
  ctx.restore();
}

/** Converte um hex #rrggbb da paleta em rgba com alpha real. Aceita já-rgba
 *  de volta sem alterar (as cores da paleta são as duas formas). */
export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return color;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

// Evolução Final §11 (narrativa consolidada no formato Análise): quebra de
// linha real por largura medida (nunca um chute de caracteres por linha —
// fontes mono/negrito variam largura por peso/tamanho). Além de
// `maxLines`, a última linha ganha reticência real via truncateToWidth
// (nunca um corte silencioso no meio de uma palavra).
export function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  ctx.save();
  ctx.font = font;
  const words = text.split(/\s+/).filter(Boolean);
  const allLines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      allLines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) allLines.push(current);

  let lines = allLines;
  if (allLines.length > maxLines) {
    const kept = allLines.slice(0, maxLines - 1);
    const remainder = allLines.slice(maxLines - 1).join(" ");
    kept.push(truncateToWidth(ctx, remainder, font, maxWidth));
    lines = kept;
  }
  ctx.restore();
  return lines;
}
