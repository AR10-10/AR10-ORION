// terminal-field-priority.ts — Ordem 3 "TERMINAL — VISUAL + INFORMATIONAL
// INTEGRITY": qual campo do Terminal sobrevive quando o viewport encolhe.
// Puro, Laboratório de Evolução — consome `resolveDensityTier()`
// (density-tier.ts) em vez de reimplementar densidade; ainda não ligado a
// nenhum componente visível.
//
// A ordem de prioridade é literal do texto do Operador: DECISION > PRICE >
// TRADE PLAN > INVALIDATION > TARGETS > ESSENTIAL EVIDENCE > SECONDARY
// INFORMATION. O texto também lista o que NUNCA pode sumir: "ocultar Entry
// existente; ocultar Invalidation; ocultar Targets; substituir dados reais
// por placeholders; sobrepor informações; reduzir texto crítico até ficar
// ilegível" — Entry/Invalidation/Targets são partes concretas dos 3 tiers
// centrais (TRADE_PLAN/INVALIDATION/TARGETS), e DECISION/PRICE são os dois
// primeiros da própria hierarquia — protegê-los é a leitura mais direta do
// texto, nunca os 2 últimos tiers (ESSENTIAL_EVIDENCE/SECONDARY_INFORMATION)
// nomeados explicitamente como o que cede espaço primeiro ("reduzir
// elementos secundários"). Essa divisão 5-nunca-esconde / 2-compactáveis é
// MINHA leitura do texto, não um número explícito nele — registrada aqui
// para ficar auditável, nunca silenciosa.
//
// Nota de nomenclatura: "Progressive Disclosure" já é um termo real neste
// repositório (App.tsx, Workspace Manager §2 — módulos secundários ocultos
// por padrão, sob controle do OPERADOR, independente do tamanho da tela).
// O uso aqui é uma aplicação DIFERENTE do mesmo padrão de UX — disclosure
// dirigido pelo VIEWPORT, não pela escolha do Operador — nunca o mesmo
// mecanismo, para não confundir as duas leituras de "esconder por padrão".
import type { DensityTier } from "./density-tier";

export type TerminalFieldTier =
  | "DECISION"
  | "PRICE"
  | "TRADE_PLAN"
  | "INVALIDATION"
  | "TARGETS"
  | "ESSENTIAL_EVIDENCE"
  | "SECONDARY_INFORMATION";

/** Ordem de prioridade literal do texto do Operador — do mais crítico ao
 *  mais dispensável sob espaço apertado. */
export const TERMINAL_FIELD_PRIORITY: readonly TerminalFieldTier[] = [
  "DECISION",
  "PRICE",
  "TRADE_PLAN",
  "INVALIDATION",
  "TARGETS",
  "ESSENTIAL_EVIDENCE",
  "SECONDARY_INFORMATION",
];

/** As 5 tiers centrais — nunca somem, em nenhuma densidade (regra "NUNCA"
 *  do texto: Entry/Invalidation/Targets nomeados, DECISION/PRICE são os
 *  dois primeiros da hierarquia). */
const NEVER_HIDDEN_TIERS: ReadonlySet<TerminalFieldTier> = new Set([
  "DECISION",
  "PRICE",
  "TRADE_PLAN",
  "INVALIDATION",
  "TARGETS",
]);

/** Este tier fica sempre visível, mesmo em COMPACT? */
export function isTerminalFieldAlwaysVisible(tier: TerminalFieldTier): boolean {
  return NEVER_HIDDEN_TIERS.has(tier);
}

/** Quais tiers ficam visíveis nesta densidade real. Só COMPACT ativa
 *  progressive disclosure (esconde ESSENTIAL_EVIDENCE/SECONDARY_INFORMATION);
 *  STANDARD e EXPANDED mostram os 7 — "reduzir elementos secundários" é uma
 *  resposta ao espaço realmente apertado, nunca ao meio-termo. Nunca muta
 *  `TERMINAL_FIELD_PRIORITY` nem devolve os tiers fora de ordem. */
export function resolveVisibleTerminalFieldTiers(density: DensityTier): TerminalFieldTier[] {
  if (density === "COMPACT") {
    return TERMINAL_FIELD_PRIORITY.filter(isTerminalFieldAlwaysVisible);
  }
  return [...TERMINAL_FIELD_PRIORITY];
}
