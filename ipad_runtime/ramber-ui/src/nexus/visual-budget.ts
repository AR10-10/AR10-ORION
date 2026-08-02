// visual-budget.ts — Diretriz Nº 02 ("Camada de Inteligência Visual"),
// seção "BUDGET VISUAL": motor puro e isolado (Laboratório de Evolução —
// nasce sem nenhuma ligação com App.tsx/o gráfico até a suíte de testes
// provar o comportamento; graduação real fica para uma rodada própria,
// ver docs/RELATORIO_DIRETRIZ_02_INTELIGENCIA_VISUAL.md).
//
// O QUE ESTE MOTOR É: a formalização real da regra que a diretiva pede —
// "quando existir excesso de informação, o próprio sistema deverá
// esconder automaticamente os elementos menos importantes" — usando a
// prioridade de 7 níveis que a própria diretiva declara (Trade Plan >
// Zona Institucional > Alvos > Invalidação > Radar > Liquidez Principal >
// Estrutura).
//
// O QUE ESTE MOTOR NUNCA É (Regra de Ouro 4 — "nunca apagar dado real ou
// funcionalidade"): um mecanismo de ESCONDER de verdade. "Esconder" na
// diretiva é reinterpretado honestamente aqui como REDUZIR ÊNFASE — todo
// objeto sempre recebe um peso visual real >= VISUAL_BUDGET_FLOOR_WEIGHT,
// nunca zero. Isto é aditivo sobre o que já existe: layer-relevance.ts já
// decide relevant (mostra/não mostra) e emphasis (normal/highlight) por
// camada, cada uma isoladamente; este motor é a camada SEGUINTE —
// resolve competição CRUZADA entre objetos já relevantes, quando muitos
// competem por destaque ao mesmo tempo.
//
// Entrada = só pesos JÁ REAIS que o chamador já computou em outro lugar
// (ex.: confluenceWeight de InstitutionalZonePlugin.tsx, distinctSourceCount
// de institutional-zones.ts, ou 1.0 para objetos binários como Trade Plan
// ativo) — este módulo nunca fabrica peso novo, só resolve a COMPETIÇÃO
// entre pesos que já existem, pela prioridade declarada.

// Prioridade real declarada pela própria diretiva (§"BUDGET VISUAL") —
// convenção documentada, não medição (mesma natureza do piso R:R 1:2 já
// documentado em rr-quality.ts, ou dos limiares de proximidade em
// layer-relevance.ts). Índice 0 = maior prioridade real.
export const VISUAL_BUDGET_PRIORITY_ORDER = [
  "TRADE_PLAN",
  "INSTITUTIONAL_ZONE",
  "TARGET",
  "INVALIDATION",
  "RADAR",
  "MAIN_LIQUIDITY",
  "STRUCTURE",
] as const;
export type VisualBudgetCategory = (typeof VISUAL_BUDGET_PRIORITY_ORDER)[number];

const CATEGORY_RANK: Record<VisualBudgetCategory, number> = VISUAL_BUDGET_PRIORITY_ORDER.reduce(
  (acc, id, i) => ({ ...acc, [id]: i }),
  {} as Record<VisualBudgetCategory, number>,
);

export interface VisualBudgetCandidate {
  // Identidade real do objeto candidato (ex.: layer id do gráfico, id de
  // uma price line, id de um candidato do Radar) — só passthrough, nunca
  // interpretado por este módulo.
  id: string;
  category: VisualBudgetCategory;
  // Peso real já existente ANTES de qualquer competição (0..1) — ex.:
  // confluenceWeight(distinctSourceCount) de uma Zona Institucional, ou
  // 1 para um objeto binário (Trade Plan ativo/inativo). Nunca fabricado
  // aqui.
  baseWeight: number;
}

export interface VisualBudgetResult {
  id: string;
  category: VisualBudgetCategory;
  // Peso visual final real (0..1) — o mesmo baseWeight quando o objeto
  // cabe no orçamento; reduzido (nunca abaixo do piso) quando a
  // competição real por destaque excede o orçamento declarado.
  visualWeight: number;
  // true só quando este objeto especificamente perdeu ênfase por
  // competição real — nunca um sinal de "está escondido" (Regra de Ouro
  // 4: continua real e visível, só com menos peso visual).
  reduced: boolean;
}

// Piso real: nenhum objeto cai abaixo disto por competição — sempre
// visível, honestamente menos enfatizado (nunca removido). Convenção
// declarada (mesmo espírito de HARMONIC_MIN_RELEVANT_FIT em
// layer-relevance.ts), não uma medição.
export const VISUAL_BUDGET_FLOOR_WEIGHT = 0.35;

// "Orçamento" real: soma de baseWeight que cabe em destaque PLENO antes
// da competição começar a reduzir peso de itens de prioridade mais baixa.
// Convenção declarada (7 categorias reais, ~1 objeto pleno por categoria
// mais alguma folga) — não uma medição, documentado como tal (mesma
// disciplina de todo limiar deste módulo).
export const DEFAULT_VISUAL_BUDGET = 4;

/** Motor puro: candidatos reais (já com peso real) -> peso visual final
 *  real, resolvendo competição por prioridade declarada. Determinístico,
 *  nunca lança, nunca depende de estado global. Ordem de entrada
 *  irrelevante para o resultado (a função ordena internamente por
 *  categoria real, depois por baseWeight real desc). */
export function resolveVisualBudget(
  candidates: readonly VisualBudgetCandidate[],
  budget: number = DEFAULT_VISUAL_BUDGET,
): VisualBudgetResult[] {
  const byPriority = [...candidates].sort((a, b) => {
    const rankDiff = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
    if (rankDiff !== 0) return rankDiff;
    return b.baseWeight - a.baseWeight; // dentro da mesma categoria: peso real maior primeiro
  });

  const results: VisualBudgetResult[] = [];
  let spent = 0;
  for (const c of byPriority) {
    const clampedBase = Math.max(0, Math.min(1, c.baseWeight));
    const remaining = budget - spent;
    if (remaining >= clampedBase) {
      // Cabe inteiro no orçamento real restante — peso pleno, zero redução.
      results.push({ id: c.id, category: c.category, visualWeight: clampedBase, reduced: false });
      spent += clampedBase;
    } else {
      // Orçamento real já consumido por objetos de prioridade mais alta
      // (ou desta mesma categoria com peso maior) — reduz, nunca abaixo
      // do piso honesto, nunca aumenta o peso original.
      const reducedWeight = Math.max(VISUAL_BUDGET_FLOOR_WEIGHT, Math.min(clampedBase, Math.max(0, remaining)));
      results.push({ id: c.id, category: c.category, visualWeight: reducedWeight, reduced: reducedWeight < clampedBase });
      // spent não avança além do orçamento real — o resto da fila
      // compete pelo mesmo remanescente (ou pelo piso, quando remaining <= 0).
    }
  }
  return results;
}
