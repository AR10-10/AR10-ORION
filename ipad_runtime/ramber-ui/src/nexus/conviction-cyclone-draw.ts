// conviction-cyclone-draw.ts — "Ciclone de Convicção": evolução visual da
// Neural Market Aura pedida diretamente pelo Operador ("não um túnel... um
// ciclone, levando até o alvo"). Primitiva PURA e postMessage-safe,
// compartilhada pelos dois caminhos de render (Worker via OffscreenCanvas
// e o fallback estático já existente no main thread) — mesmo princípio de
// "zero repetição" já usado por orderflow-heatmap-draw.ts.
//
// HONESTIDADE (Regra de Ouro 2, reforçada pelo próprio pedido — "previsão
// mais precisa"): nenhum parâmetro abaixo é uma previsão nova. Cada um
// mapeia 1:1 para um dado JÁ real, já computado por aura-lifecycle.ts:
//   conviction real (Confluence Engine, 0..1)   -> nº de partículas +
//     velocidade de rotação + intensidade da atração espiral.
//   turbulência real (Market Pulse/ATR% normalizado, 0..1) -> ruído no
//     caminho de cada partícula — mercado volátil = ciclone mais caótico,
//     leitura honesta da volatilidade REAL agora, nunca uma previsão dela.
//   fase real (BIRTH/ESTABLISHED/TARGET_HIT/STOP_HIT/REPLACED) -> cor
//     (mesmo phaseRgb role-based já corrigido nesta sessão em
//     NeuralMarketAuraPlugin.tsx — este módulo recebe a cor JÁ resolvida,
//     nunca decide role/direção aqui).
//   proximidade real do alvo (ATR-escalada, aura-lifecycle.ts) -> `collapse`
//     0..1: o funil encolhe conforme o preço real se aproxima do alvo
//     real — um FATO geométrico ao vivo (coordenadas já resolvidas via
//     priceToCoordinate no plugin), nunca uma contagem regressiva
//     inventada nem um "X% de chance de bater o alvo".
// A forma "funil estreitando até o alvo" nasce de `progress` (0..1, cada
// partícula andando do lado da entrada até o lado do alvo, renascendo ao
// cruzar) elevado a uma potência — largo perto da entrada, afunila perto
// do alvo. É o "ciclone levando até o alvo" pedido, com zero número
// fabricado: só forma visual nova sobre dado que já era real.
//
// Determinístico por design (nunca Math.random() — Regra de Ouro 1 é
// sobre dado de MERCADO real; isto é só a semente de um efeito visual,
// sem nenhuma relação com preço/decisão, mas ainda assim determinístico
// de propósito): cada partícula tem uma fase inicial fixa por índice
// (ângulo áureo, distribuição tipo phyllotaxis clássica) — resultado
// reproduzível, testável em execução real sem mock de RNG.
//
// Fio de Seda (Regra de Ouro 5, zero exceção): a ÚNICA linha de marcação
// real deste módulo é a borda do lado do alvo — 1px sólida, nunca
// tracejada, nunca escalada por convicção/turbulência. As partículas são
// PONTOS preenchidos (fills), nunca uma segunda linha de marcação — a
// convicção fala pela contagem/raio/velocidade dos pontos, exatamente
// como a versão estática anterior já fazia falar pela largura do
// preenchimento.

export interface CyclonePoint {
  x: number;
  y: number;
  alpha: number; // 0..1, já multiplicado pelo fadeAlpha real
  r: number; // raio real do ponto em px CSS
}

// O que o main thread manda pro worker quando um dado REAL muda (raro,
// mesmo dirty-flag de todo overlay do gráfico) — geometria já resolvida
// via priceToCoordinate (este módulo nunca toca `chart`/`series`, mesmo
// princípio de orderflow-heatmap-draw.ts: só recebe pixels reais prontos).
export interface CycloneRealParams {
  bandX: number; // borda esquerda real do corredor (lado da entrada)
  cssWidth: number; // largura real do canvas — borda direita = lado do alvo (preço atual)
  cssHeight: number;
  dpr: number;
  top: number; // y real do topo (min(yEntry, yTarget))
  bottom: number; // y real do fundo (max(yEntry, yTarget))
  edgeY: number | null; // y real da linha de marcação do alvo (Fio de Seda)
  color: string; // "R, G, B" já resolvido (phaseRgb) — nunca recalculado aqui
  conviction: number; // 0..1, fallback honesto já aplicado por quem monta isto (mesmo padrão de corridorWidthPx)
  turbulence: number; // 0..1, fallback honesto já aplicado (pulseIntensity ?? 0.3)
  fadeAlpha: number; // 0..1 — birth/dissolve real
  collapse: number; // 0..1 — 0 = funil totalmente aberto (WAITING/sem proximidade real), 1 = colapsado no alvo (HIT)
}

export interface CycloneFrame {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  color: string;
  points: CyclonePoint[];
  edgeY: number | null;
  bandX: number;
  fadeAlpha: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // phyllotaxis clássico — distribuição determinística, nunca aleatória

const MIN_PARTICLES = 8;
const MAX_PARTICLES = 40;
const ROTATION_SPEED = 0.0022; // rad/ms na convicção máxima — parâmetro visual documentado, não medição
const FUNNEL_POWER = 1.6; // >1 concentra o afunilamento perto do alvo (visual de "sucção" real do ciclone)
const NOISE_FREQ = 0.006;

function particleCount(conviction: number): number {
  const c = Math.max(0, Math.min(1, conviction));
  return Math.round(MIN_PARTICLES + c * (MAX_PARTICLES - MIN_PARTICLES));
}

/** Frame real e determinístico para um instante `tMs` (relógio interno do
 *  Worker, nunca Date.now() do main thread) — mesmos parâmetros sempre
 *  devolvem o mesmo frame, testável sem mock de tempo. */
export function computeCycloneFrame(real: CycloneRealParams, tMs: number): CycloneFrame {
  const conviction = Math.max(0, Math.min(1, real.conviction));
  const turbulence = Math.max(0, Math.min(1, real.turbulence));
  const collapse = Math.max(0, Math.min(1, real.collapse));
  const n = particleCount(conviction);
  const bandWidth = Math.max(1, real.cssWidth - real.bandX);
  const bandHeight = Math.max(1, real.bottom - real.top);
  const midY = (real.top + real.bottom) / 2;
  const maxFunnelRadius = bandHeight * 0.42; // metade da altura real do corredor, folga documentada pra nunca vazar dele

  const points: CyclonePoint[] = [];
  for (let i = 0; i < n; i++) {
    const seed = i * GOLDEN_ANGLE;
    // Progresso real 0..1 do lado da entrada até o lado do alvo, ciclando
    // continuamente — a partícula "renasce" na entrada assim que cruza o
    // alvo (fluxo contínuo, não uma única viagem que para).
    const speedAlongAxis = 0.00012 + conviction * 0.00028;
    let progress = (seed / (Math.PI * 2) + tMs * speedAlongAxis) % 1;
    if (progress < 0) progress += 1;
    // Colapso real (proximidade do alvo): comprime o progresso alcançável
    // rumo ao lado do alvo conforme o preço real se aproxima — nunca some,
    // só se concentra (mesma leitura de "atração" que a versão estática já
    // dava via gradiente mais vívido perto do alvo).
    const effectiveProgress = collapse >= 1 ? 1 : progress * (1 - collapse) + collapse;

    const funnelRadius = maxFunnelRadius * Math.pow(1 - effectiveProgress, FUNNEL_POWER) * (0.35 + 0.65 * conviction);
    const angle = seed + tMs * ROTATION_SPEED * (0.35 + 0.65 * conviction);
    const noise = turbulence * funnelRadius * 0.5 * Math.sin(tMs * NOISE_FREQ + seed * 7);

    const x = real.bandX + effectiveProgress * bandWidth;
    const y = midY + Math.sin(angle) * (funnelRadius + noise);
    const alpha = Math.max(0, Math.min(1, (0.25 + 0.55 * effectiveProgress) * real.fadeAlpha));
    const r = 1.1 + conviction * 1.4;

    points.push({ x, y, alpha, r });
  }

  return {
    cssWidth: real.cssWidth,
    cssHeight: real.cssHeight,
    dpr: real.dpr,
    color: real.color,
    points,
    edgeY: real.edgeY,
    bandX: real.bandX,
    fadeAlpha: real.fadeAlpha,
  };
}

// Subconjunto real de CanvasRenderingContext2D/OffscreenCanvasRenderingContext2D
// que este módulo usa — mesmo princípio de DrawableContext2D em
// orderflow-heatmap-draw.ts (compatibilidade estrutural, zero cast/duplicação).
export interface CycloneDrawableContext2D {
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  arc(x: number, y: number, r: number, startAngle: number, endAngle: number): void;
  fill(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
}

export function drawCycloneFrame(ctx: CycloneDrawableContext2D, frame: CycloneFrame): void {
  const { cssWidth, cssHeight, dpr, color, points, edgeY, bandX, fadeAlpha } = frame;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  for (const pt of points) {
    if (pt.alpha <= 0) continue;
    ctx.globalAlpha = pt.alpha;
    ctx.fillStyle = `rgb(${color})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fio de Seda: única linha de marcação real deste módulo — borda do
  // lado do alvo, 1px sólida, nunca tracejada, nunca mais grossa que 1px
  // independente de convicção/turbulência (essas já falaram pelos pontos
  // acima).
  if (edgeY !== null) {
    ctx.globalAlpha = fadeAlpha;
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${color}, 0.9)`;
    ctx.beginPath();
    ctx.moveTo(bandX, Math.round(edgeY) + 0.5);
    ctx.lineTo(cssWidth, Math.round(edgeY) + 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Protocolo real do Worker — tipos compartilhados pelos dois lados
// (plugin + worker) para o postMessage nunca dessincronizar (mesmo
// princípio de HeatmapWorkerInMessage/OutMessage).
export type CycloneWorkerInMessage =
  | { type: "init"; canvas: OffscreenCanvas }
  | { type: "resize"; pxWidth: number; pxHeight: number }
  | { type: "update"; real: CycloneRealParams | null };

export type CycloneWorkerOutMessage = { type: "ready"; ok: boolean };
