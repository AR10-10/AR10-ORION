// canvas-label.ts — Diretriz Final de Lapidação Visual, Adendo, Parte 11
// ("etiquetas profissionais... nenhuma etiqueta poderá parecer
// improvisada").
//
// AUDITORIA ANTES DE CONSTRUIR (CLAUDE.md, Disciplina de trabalho item 1):
// grep real por `ctx.font` em todo `chart/*.tsx` confirmou a tipografia JÁ
// 100% unificada (7 de 7 ocorrências usam "9px -apple-system, sans-serif",
// exceto 1 sublabel deliberadamente menor a 8px) — zero trabalho necessário
// aí. Mas `roundRect`: ZERO ocorrências em todo o diretório — nenhum canto
// suavizado em lugar nenhum. E de 6 pontos reais de `fillText`, só
// PriceLabelStackPlugin.tsx já desenhava uma caixa sólida (padding
// consistente, contraste garantido); os outros 5 (KillZoneBandsPlugin,
// LiquidationHeatmapPlugin, LiquidityZonesPlugin, InstitutionalZonePlugin,
// e as 2 linhas de MarketSessionBandsPlugin) desenhavam texto NU direto
// sobre o preenchimento da zona, cada um com seu próprio padding ad-hoc
// (rectX+3/rectY+2, clippedX+3/3, 6/rectY+h/2, peakW+3/y-1) — a
// inconsistência real que a diretiva descreve.
//
// Esta função centraliza o desenho de etiqueta em caixa: cantos suavizados
// via roundRect REAL do Canvas 2D quando o motor suporta (feature-detect
// honesto, mesmo padrão já usado por
// OrderFlowHeatmapPlugin::supportsOffscreenWorker — nunca uma suposição de
// suporte), fallback para retângulo comum quando não (Safari mais antigo
// ainda desenha a etiqueta, só sem o canto redondo — nunca fica sem
// etiqueta por causa de um recurso opcional). Padding/altura/fonte
// consistentes, contraste garantido (texto escuro sobre fundo colorido —
// mesma regra já real de PriceLabelStackPlugin).
export const CANVAS_LABEL_FONT = "9px -apple-system, sans-serif";
export const CANVAS_LABEL_TEXT_COLOR = "#050810";
export const CANVAS_LABEL_PAD_X = 4;
export const CANVAS_LABEL_PAD_Y = 2;
export const CANVAS_LABEL_RADIUS = 3; // suave e discreto — nunca uma "pílula" que compete com o preço (Parte 13 da diretiva).
const CANVAS_LABEL_FONT_SIZE_PX = 9;

export interface CanvasLabelOptions {
  fill: string; // rgba já resolvida — decaimento/ênfase do chamador (ageAlpha, globalAlpha) continua funcionando por cima, zero mudança de contrato.
  text: string;
  padX?: number;
  padY?: number;
  radius?: number;
}

export interface CanvasLabelSize {
  width: number;
  height: number;
}

// Subconjunto real de CanvasRenderingContext2D que esta primitiva usa —
// mesmo espírito de DrawableContext2D em orderflow-heatmap-draw.ts.
// roundRect é opcional de propósito: Safari < 16.4 não implementa, o
// feature-detect abaixo decide em runtime, nunca aqui.
// fillStyle tipado exatamente como o real CanvasRenderingContext2D/
// OffscreenCanvasRenderingContext2D (string | CanvasGradient |
// CanvasPattern) — mesmo achado já documentado em
// nexus/orderflow-heatmap-draw.ts: estreitar pra só `string` quebraria a
// compatibilidade estrutural (propriedade mutável é invariante em TS) com
// os contextos reais da DOM, mesmo só escrevendo string aqui.
export interface DrawableLabelContext2D {
  measureText(text: string): { width: number };
  font: string;
  fillStyle: string | CanvasGradient | CanvasPattern;
  textBaseline: string;
  beginPath(): void;
  rect(x: number, y: number, w: number, h: number): void;
  roundRect?(x: number, y: number, w: number, h: number, radius: number): void;
  fill(): void;
  fillText(text: string, x: number, y: number): void;
}

/** Mede a etiqueta real (mesmo texto/fonte que será desenhado) sem
 *  desenhar nada — quem chama usa isto para decidir se cabe espaço antes
 *  de comprometer com a posição final (mesmo padrão de honestidade que
 *  MIN_LABEL_WIDTH_PX já aplica nos outros plugins). */
export function measureCanvasLabel(ctx: DrawableLabelContext2D, text: string, padX = CANVAS_LABEL_PAD_X, padY = CANVAS_LABEL_PAD_Y): CanvasLabelSize {
  ctx.font = CANVAS_LABEL_FONT;
  const width = ctx.measureText(text).width + padX * 2;
  const height = CANVAS_LABEL_FONT_SIZE_PX + padY * 2;
  return { width, height };
}

/** Desenha a etiqueta institucional real: caixa sólida com cantos
 *  suavizados (quando suportado) + texto de alto contraste garantido.
 *  (x, y) é o canto SUPERIOR ESQUERDO real da caixa — quem chama já
 *  resolveu a posição via priceToCoordinate/timeToCoordinate como sempre,
 *  esta função nunca inventa geometria própria. */
export function drawCanvasLabel(ctx: DrawableLabelContext2D, x: number, y: number, opts: CanvasLabelOptions): CanvasLabelSize {
  const padX = opts.padX ?? CANVAS_LABEL_PAD_X;
  const padY = opts.padY ?? CANVAS_LABEL_PAD_Y;
  const radius = opts.radius ?? CANVAS_LABEL_RADIUS;
  const size = measureCanvasLabel(ctx, opts.text, padX, padY);

  ctx.fillStyle = opts.fill;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, size.width, size.height, radius);
  } else {
    ctx.rect(x, y, size.width, size.height); // fallback honesto — motor sem roundRect ainda ganha a etiqueta, só sem o canto suave.
  }
  ctx.fill();

  ctx.fillStyle = CANVAS_LABEL_TEXT_COLOR;
  ctx.textBaseline = "middle";
  ctx.fillText(opts.text, x + padX, y + size.height / 2 + 0.5);

  return size;
}
