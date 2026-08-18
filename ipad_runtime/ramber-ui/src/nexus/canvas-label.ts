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
// CORREÇÃO DE DOCUMENTAÇÃO (raio-X do ecossistema): o parágrafo acima é o
// registro HISTÓRICO de quando este módulo nasceu e ficou desatualizado —
// KillZoneBandsPlugin e MarketSessionBandsPlugin foram redesenhados depois
// (faixa de lane fina, Achado 2.6) e hoje NÃO usam drawCanvasLabel: desenham
// texto simples via ctx.fillText, mas ambos já consomem activeCanvasLabelFont()
// desta mesma casa — o que importava (uma decisão de tamanho, não duas) está
// unificado. Consumidores REAIS de drawCanvasLabel hoje, verificados por grep:
// DepthChartPlugin, LiquidationHeatmapPlugin e LiquidityZonesPlugin — três,
// não cinco. Documentação que envelhece em silêncio é a mesma classe de
// defeito que este arquivo existe para evitar.
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
// ESCALA POR TELA (pedido do Operador: "tamanho padrão de qualquer terminal
// pra qualquer tela, qualquer monitor, iPad").
//
// ACHADO MEDIDO: esta primitiva tinha a fonte CONGELADA em 9px, enquanto o
// eixo nativo do gráfico e o PriceLabelStackPlugin JÁ escalavam via
// resolveChartUltraWideScale. Num
// monitor >= 2560px o tick do eixo virava 13px e a etiqueta de zona continuava
// 9px — 4px de diferença entre dois textos lado a lado. Não era "fonte
// pequena": eram DUAS decisões de tamanho para a mesma pergunta, e só uma
// escutava a tela.
//
// Agora é uma decisão só, na mesma fonte de verdade.
import { resolveCanvasLabelFont, resolveCanvasLabelFontPx, CANVAS_LABEL_BASE_FONT_PX } from "../chart/chart-ultrawide-scale";

/** Largura real da viewport, com fallback honesto fora do browser (vitest,
 *  Worker, SSR): cai no piso de produção, nunca quebra e nunca inventa. */
function viewportWidth(): number {
  return typeof window !== "undefined" && Number.isFinite(window.innerWidth) ? window.innerWidth : 0;
}

/** Fonte da etiqueta NESTA tela. Mantido como função (não constante) porque o
 *  Operador pode mover a janela entre monitores de tamanhos diferentes com o
 *  app aberto — uma constante capturada no import ficaria errada para sempre. */
export function activeCanvasLabelFont(): string {
  return resolveCanvasLabelFont(viewportWidth());
}

/** @deprecated Use activeCanvasLabelFont(). Mantido só porque outros módulos
 *  já importam este nome; agora resolve pela tela real em vez de congelar 9px. */
export const CANVAS_LABEL_FONT = `${CANVAS_LABEL_BASE_FONT_PX}px -apple-system, sans-serif`;
export const CANVAS_LABEL_TEXT_COLOR = "#050810";
export const CANVAS_LABEL_PAD_X = 4;
export const CANVAS_LABEL_PAD_Y = 2;
export const CANVAS_LABEL_RADIUS = 3; // suave e discreto — nunca uma "pílula" que compete com o preço (Parte 13 da diretiva).

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
  // Medida e desenho usam a MESMA fonte resolvida — se divergissem, a caixa
  // sairia com largura errada para o texto (o defeito clássico de etiqueta).
  ctx.font = activeCanvasLabelFont();
  const width = ctx.measureText(text).width + padX * 2;
  const height = resolveCanvasLabelFontPx(viewportWidth()) + padY * 2;
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
