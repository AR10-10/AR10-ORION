// chart-ultrawide-scale.ts — Ordem "AJUSTE VISUAL PARA MONITOR ULTRA LED /
// ULTRAWIDE / 4K" (Operador): fontSize/minimumWidth/rightOffset do chart
// eram fixos (11/65/8) em qualquer resolução — auditoria confirmou os 3
// valores reais hardcoded. Legíveis no iPad/desktop-padrão (o alvo
// primário real do app, Regra de Ouro 7), mas desproporcionalmente
// pequenos num 4K/UltraWide de verdade. O piso de cada faixa É o valor já
// em produção — NUNCA reduzido, mesmo nas faixas que o documento pedia
// encolher (ex.: iPad Pro 1366px cairia na faixa "<1440px" do documento,
// que pedia rightOffset:6/minimumWidth:60 — uma regressão real no
// dispositivo que é o alvo primário do app; rejeitado aqui, o piso é
// sempre o valor atual). viewportWidth é window.innerWidth: a pergunta
// real é "que CLASSE de monitor é este", não "quanto sobrou depois de
// abrir uma gaveta/drawer" (o que a largura do próprio canvas mediria).
//
// DELIBERADAMENTE FORA deste helper (2 dos pedidos do mesmo documento):
// - barSpacing: setar isso por breakpoint entraria em conflito direto com
//   computeViewportCandles (nexus/chart-viewport.ts, Ordem "FECHAMENTO DO
//   AR10 CYBORG" §5, já em produção) — aquele motor mantém
//   TARGET_PX_PER_CANDLE=7 CONSTANTE em qualquer resolução de propósito
//   (legibilidade de UMA vela não muda com o tamanho do monitor) e varia
//   é QUANTAS velas cabem. Um barSpacing forçado por breakpoint aqui ou
//   seria imediatamente sobrescrito pelo fit de faixa visível (código
//   morto) ou brigaria com ele por um frame antes do fit rodar — duplicar
//   a decisão "quanto espaço por vela" em dois lugares é exatamente a
//   classe de inconsistência que este arquivo evita em todo o resto.
// - densidade de grid: auditado contra os typings reais da lib
//   (GridOptions só expõe vertLines/horzLines.{color,style,visible} —
//   zero contagem/densidade configurável na API real). O gerador de ticks
//   nativo já produz mais linhas em telas largas por conta própria (mesmo
//   algoritmo que espaça os rótulos do eixo) — nada real para construir.
//
// Extraído de EnhancedChart_110_Percent.tsx (achado real, task #341,
// auditoria "Estratégia de Evolução Elite" 2026-08-16): PriceLabelStackPlugin
// precisava da MESMA escala (as etiquetas do eixo — S1/R1/VWAP/EMA/POC/
// VAH/VAL/IB/etc. — ficavam com fonte fixa 9-11px mesmo num monitor 4K
// onde o fontSize NATIVO do chart já crescia pra 13px, uma inconsistência
// visual real entre o tick nativo e a etiqueta do eixo desenhada por
// cima dele). Importar direto de EnhancedChart_110_Percent.tsx criaria um
// ciclo real (aquele arquivo já importa PriceLabelStackPlugin) — mesma
// razão que motivou chart-profile-lanes.ts nesta mesma sessão: função
// pura de layout compartilhada, módulo próprio, zero ciclo.
export function resolveChartUltraWideScale(viewportWidth: number): {
  fontSize: number;
  minimumWidth: number;
  rightOffset: number;
} {
  if (Number.isFinite(viewportWidth) && viewportWidth >= 2560) {
    return { fontSize: 13, minimumWidth: 75, rightOffset: 12 };
  }
  if (Number.isFinite(viewportWidth) && viewportWidth >= 1440) {
    return { fontSize: 12, minimumWidth: 65, rightOffset: 8 };
  }
  return { fontSize: 11, minimumWidth: 65, rightOffset: 8 }; // baseline real já em produção — fail-closed (largura inválida) cai aqui também
}

// ============================================================================
// ETIQUETAS DE CANVAS — o buraco real da escala, achado medindo
// ============================================================================
// Pedido do Operador: "tamanho padrão de qualquer terminal pra qualquer tela,
// qualquer monitor, iPad".
//
// ACHADO: `resolveChartUltraWideScale` acima já escalava 3 coisas (fonte do
// eixo nativo, largura mínima do eixo, offset da direita) e o
// PriceLabelStackPlugin a consome. Mas `nexus/canvas-label.ts` — a primitiva
// COMPARTILHADA que desenha etiqueta em caixa para KillZoneBands,
// LiquidationHeatmap, LiquidityZones, InstitutionalZone e MarketSessionBands —
// tinha a fonte HARDCODED em 9px, sem nenhuma ligação com esta escala.
//
// O sintoma real: num monitor >= 2560px o tick nativo do eixo cresce para 13px
// e as etiquetas do eixo acompanham, enquanto TODA etiqueta de zona/sessão
// continua em 9px — 4px de diferença entre dois textos lado a lado na mesma
// tela. No iPad o mesmo desalinhamento aparece invertido. Não era "fonte
// pequena": era DUAS decisões de tamanho para a mesma pergunta, e só uma
// respondia à tela.
//
// Correção: uma decisão só. A etiqueta de canvas passa a derivar da MESMA
// função de escala, com um degrau a menos que o eixo (a etiqueta de zona é
// contexto, não leitura principal — deve ficar legível sem competir com o
// preço, que é a hierarquia que a Parte 13 da diretiva de lapidação já
// estabeleceu).
//
// O piso é o valor que já estava em produção (9px): NUNCA reduz, em nenhuma
// faixa — mesma disciplina do helper acima, para nenhuma tela regredir.
export const CANVAS_LABEL_BASE_FONT_PX = 9;

/** Tamanho de fonte real da etiqueta de canvas para esta viewport.
 *  Um degrau abaixo do eixo de propósito (hierarquia visual: contexto nunca
 *  compete com preço). Piso 9px em qualquer tela — nunca regride. */
export function resolveCanvasLabelFontPx(viewportWidth: number): number {
  if (Number.isFinite(viewportWidth) && viewportWidth >= 2560) return 11;
  if (Number.isFinite(viewportWidth) && viewportWidth >= 1440) return 10;
  return CANVAS_LABEL_BASE_FONT_PX; // baseline + fail-closed (largura inválida)
}

/** A família tipográfica é a MESMA de todo o resto do canvas — só o corpo
 *  varia. Centralizada aqui para não existir uma segunda string de fonte
 *  solta em nenhum plugin. */
export function resolveCanvasLabelFont(viewportWidth: number): string {
  return `${resolveCanvasLabelFontPx(viewportWidth)}px -apple-system, sans-serif`;
}

// ============================================================================
// BREATHING ROOM ADAPTATIVO (Ordem A1 §19-§21, fechamento das lacunas do
// fechamento A1) — o último candle não pode ficar colado ao price axis
// quando há Trade Plan real ocupando a região direita.
// ============================================================================
//
// `rightOffset` já era adaptativo por CLASSE DE MONITOR (resolveChartUltra
// WideScale acima) — mas só por isso. Um Trade Plan real com Entry+
// Invalidation+TP1+TP2+TP3 (5 níveis, cada um com rótulo próprio perto do
// eixo) precisa de mais respiro do que um gráfico sem plano nenhum, na
// MESMA tela. Estender a função existente (não duplicá-la): a base
// continua vindo de resolveChartUltraWideScale — este bloco só soma um
// ajuste real por CARGA, nunca substitui a decisão por tela.
//
// NÃO É MARGEM FIXA: sem plano real (WAIT/SETUP_FORMING/DADOS_INSUFICIENTES
// — qualquer estado em que trade-plan.ts devolve null), o ajuste é ZERO —
// exatamente "se não houver TP/Entry/Invalidation, não reservar espaço
// desnecessário" (Ordem A1 §3). Com plano, o ajuste cresce com o número de
// níveis REAIS que o próprio motor produziu.
import type { TradePlan } from "../nexus/trade-plan";
import { MAX_TARGETS } from "../nexus/trade-plan";

/** Quantos níveis operacionais REAIS um Trade Plan pode desenhar perto do
 *  eixo: Entry (1) + Invalidation/Stop (1) + até MAX_TARGETS alvos já
 *  validados pelo motor (nunca um projetado). Teto real, não um número à
 *  parte — é literalmente o máximo que buildTradePlan() pode devolver. */
export const MAX_CRITICAL_RIGHT_LEVELS = MAX_TARGETS + 2;

/** Conta quantos níveis críticos (Entry/Invalidation/TP1-3) o plano ATUAL
 *  desenha perto do eixo. `null`/`undefined` (sem plano — WAIT, riskGated,
 *  DADOS_INSUFICIENTES, qualquer motivo real de trade-plan.ts devolver
 *  null) conta 0, nunca um valor fabricado. current price NÃO entra nesta
 *  contagem: seu rótulo já vive NO próprio eixo nativo da lib (crosshair/
 *  lastValue), nunca como uma etiqueta empilhada como Entry/Invalidation/
 *  TP — não compete pelo mesmo respiro. */
export function countCriticalRightLevels(plan: TradePlan | null | undefined): number {
  if (!plan) return 0;
  return 2 + plan.targets.length; // Entry + Invalidation, sempre presentes quando plan existe; targets.length é 1..MAX_TARGETS
}

/** 1 largura de barra por nível crítico ativo. Não existe um precedente
 *  exato pra este número no resto do arquivo (nenhum outro código deste
 *  projeto reservava respiro por CARGA antes desta rodada) — a escolha
 *  deliberada é o menor incremento inteiro possível, com teto real
 *  (MAX_CRITICAL_RIGHT_LEVELS) que mantém o crescimento total (no máximo
 *  +5 larguras de barra) na mesma ordem de grandeza do salto que
 *  resolveChartUltraWideScale já usa em produção entre suas próprias
 *  faixas de monitor (8 → 12, um delta de 4). */
export const RIGHT_OFFSET_PER_CRITICAL_LEVEL = 1;

/**
 * Respiro à direita (`timeScale.rightOffset`, em larguras de barra — a
 * MESMA unidade de resolveChartUltraWideScale, nunca pixel) já somando a
 * base por monitor com o ajuste real por carga visual do Trade Plan.
 *
 * MIN = a própria base por monitor (carga 0 — nunca abaixo do que já está
 * em produção, mesma disciplina do resto deste arquivo). MAX = base +
 * MAX_CRITICAL_RIGHT_LEVELS * RIGHT_OFFSET_PER_CRITICAL_LEVEL (protege a
 * área útil do gráfico — Ordem A1 §4, "não sacrificar área do gráfico").
 * PREFERRED = o que a carga real pedir, sempre dentro de [MIN, MAX].
 *
 * Pura e determinística: mesma viewportWidth + mesma criticalLevelCount
 * sempre devolvem o mesmo número (Ordem A1 §8).
 */
export function resolveAdaptiveRightOffset(viewportWidth: number, criticalLevelCount: number): number {
  const base = resolveChartUltraWideScale(viewportWidth).rightOffset;
  const count = Number.isFinite(criticalLevelCount) && criticalLevelCount > 0 ? Math.floor(criticalLevelCount) : 0;
  const capped = Math.min(count, MAX_CRITICAL_RIGHT_LEVELS);
  return base + capped * RIGHT_OFFSET_PER_CRITICAL_LEVEL;
}
