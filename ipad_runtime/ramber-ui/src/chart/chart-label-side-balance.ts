// chart-label-side-balance.ts — ORDEM "NÚCLEO + POSICIONAMENTO
// INTELIGENTE" §2/§3.
//
// PEDIDO LITERAL DO OPERADOR:
//   §2 "o sistema deve calcular e decidir automaticamente qual o lado mais
//       adequado para cada objeto (direita ou esquerda), colocando cada um
//       no canto que fizer mais sentido... nada sobrepor a numeração".
//   §3 "quando o preço do ativo é alto (ex: 79,405.00), a numeração da
//       escala fica grande e aperta a lateral. Por isso, avaliar se
//       compensa mover parte das etiquetas para a lateral oposta".
//
// ── AUDITORIA ANTES DE CONSTRUIR (Disciplina §1) ───────────────────────
// O LADO de cada etiqueta é 100% ESTÁTICO hoje: 15 atribuições literais
// `side: "left"` em EnhancedChart_110_Percent.tsx e nenhuma `"right"`
// explícita — todo o resto cai no default `"right"` de resolveLabelTier.
// Nada mede, nada decide: um ativo a 5 dígitos e um a 3 casas decimais
// distribuem as etiquetas exatamente igual, mesmo o primeiro tendo um
// eixo muito mais largo (resolveAxisWidthForLabels cresce até
// AXIS_WIDTH_MAX_PX = 140). É exatamente a lacuna que a §3 descreve.
//
// ── O QUE ESTE MÓDULO DECIDE, E O QUE ELE NUNCA TOCA ───────────────────
// Decide APENAS a migração direita→esquerda de etiquetas de CONTEXTO
// quando a coluna direita passa do orçamento real de largura.
//
// NUNCA migra `live` nem `critical`. Isso não é conservadorismo: é a
// leitura primária do Operador. O preço vivo e o plano ativo (EN/ST/
// TP1-3) precisam ficar colados ao eixo de preço, que é onde o olho vai
// buscar o número — mover o TP para o lado oposto da escala destruiria
// justamente a "leitura de medida correta" que a §2 exige preservar para
// o Volume Profile pelo mesmo motivo. `primary` também fica: é o lado
// acionável agora (VWAP/NL/EMA), a razão de o default ser "right".
//
// Só o mapa ESTRUTURAL (`context`) migra — e ele já é, por definição do
// próprio sistema, "o que não deve disputar atenção com o preço"
// (PriceLabelStackPlugin.tsx). Mover contexto para longe do eixo é
// coerente com a hierarquia que já existe, não uma exceção nova.
//
// Zero decisão de trading, zero direção, zero score (LEI 24): isto é
// geometria de apresentação, na mesma família de chart-plot-area.ts e
// chart-profile-lanes.ts.
import type { PriceLabelTier } from "./price-label-stack";
import { CHART_LEFT_EDGE_FRACTION } from "./chart-profile-lanes";

/** Orçamento de largura de UMA coluna de etiquetas, como fração da área
 *  desenhável. Reusa deliberadamente `CHART_LEFT_EDGE_FRACTION` (0.14) —
 *  o número que este projeto JÁ declarou como "quanto uma faixa de borda
 *  pode ocupar" para o lado esquerdo. Aplicar o mesmo teto ao lado
 *  direito é simetria de um limiar já existente, nunca um número novo
 *  inventado para esta rodada. */
export const LABEL_COLUMN_BUDGET_FRACTION = CHART_LEFT_EDGE_FRACTION;

/** Uma etiqueta candidata, já MEDIDA pelo chamador (o plugin mede com a
 *  fonte real antes de desenhar — nunca uma estimativa paralela aqui). */
export interface SideBalanceLabel {
  /** Identidade estável — usada no desempate determinístico e para o
   *  chamador saber quem migrou. */
  id: string;
  /** Largura real em px CSS, medida com a MESMA fonte do desenho. */
  widthPx: number;
  tier: PriceLabelTier;
}

export interface SideBalanceDecision {
  /** ids que devem sair da direita e desenhar à esquerda. Vazio = a
   *  distribuição de hoje já está dentro do orçamento (o caso comum). */
  migrateToLeft: string[];
  /** Largura que a coluna direita exigiria SEM migrar nada. */
  rightDemandPx: number;
  /** Orçamento real aplicado. */
  budgetPx: number;
  /** Razão legível — sempre presente, inclusive quando nada migra. */
  reason: string;
}

const NOTHING = (rightDemandPx: number, budgetPx: number, reason: string): SideBalanceDecision => ({
  migrateToLeft: [],
  rightDemandPx,
  budgetPx,
  reason,
});

/** Largura que uma coluna exige: a etiqueta MAIS LARGA manda, porque a
 *  coluna é alinhada (todas dividem a mesma borda — ver "A COLUNA DO
 *  EIXO" em PriceLabelStackPlugin.tsx). Somar larguras seria a conta
 *  errada: elas se empilham na vertical, não na horizontal. */
function columnDemandPx(labels: readonly SideBalanceLabel[]): number {
  let max = 0;
  for (const l of labels) {
    if (Number.isFinite(l.widthPx) && l.widthPx > max) max = l.widthPx;
  }
  return max;
}

/**
 * Decide, por MEDIÇÃO, quais etiquetas de contexto devem migrar da coluna
 * direita para a esquerda. Função PURA e determinística.
 *
 * @param rightLabels etiquetas que hoje desenham à direita, já medidas
 * @param leftLabels  etiquetas que hoje desenham à esquerda, já medidas
 * @param plotWidthPx largura DESENHÁVEL real (plotRight de measurePlotArea)
 */
export function resolveLabelSideBalance(
  rightLabels: readonly SideBalanceLabel[] | null | undefined,
  leftLabels: readonly SideBalanceLabel[] | null | undefined,
  plotWidthPx: number,
): SideBalanceDecision {
  const right = Array.isArray(rightLabels) ? rightLabels.filter((l) => l && Number.isFinite(l.widthPx)) : [];
  const left = Array.isArray(leftLabels) ? leftLabels.filter((l) => l && Number.isFinite(l.widthPx)) : [];

  // Fail-closed: sem largura real medida, NUNCA migra nada — o
  // comportamento de hoje (tudo estático) é o fallback seguro.
  if (!Number.isFinite(plotWidthPx) || plotWidthPx <= 0) {
    return NOTHING(0, 0, "largura de plotagem não medida — distribuição estática preservada");
  }

  const budgetPx = plotWidthPx * LABEL_COLUMN_BUDGET_FRACTION;
  const rightDemandPx = columnDemandPx(right);

  if (rightDemandPx <= budgetPx) {
    return NOTHING(rightDemandPx, budgetPx, "coluna direita dentro do orçamento — nada a migrar");
  }

  // A COLUNA É DITADA PELA MAIS LARGA (ela é alinhada — todas dividem a
  // mesma borda, ver "A COLUNA DO EIXO" em PriceLabelStackPlugin.tsx).
  // Consequência que a primeira versão deste módulo errou, e o próprio
  // teste pegou: migrar qualquer etiqueta que NÃO seja a mais larga não
  // encolhe a coluna em 1px — é movimento puro, ruído visual sem ganho.
  // Então o laço sempre ataca a MAIS LARGA, e para no primeiro obstáculo:
  // se a mais larga não pode sair, nenhuma abaixo dela ajuda.
  const migrate: string[] = [];
  const remaining = [...right];
  let leftDemandPx = columnDemandPx(left);
  let reason = "";

  for (;;) {
    if (columnDemandPx(remaining) <= budgetPx) {
      reason = `coluna direita reduzida ao orçamento — ${migrate.length} etiqueta(s) de contexto migrada(s)`;
      break;
    }
    // A mais larga que sobrou, com desempate determinístico por id.
    let widest: SideBalanceLabel | null = null;
    for (const l of remaining) {
      if (!widest || l.widthPx > widest.widthPx || (l.widthPx === widest.widthPx && l.id < widest.id)) {
        widest = l;
      }
    }
    if (!widest) break;

    // Leitura primária nunca sai de perto do eixo — e como ela é a mais
    // larga, nada abaixo dela reduziria a coluna.
    if (widest.tier !== "context") {
      reason =
        "coluna direita acima do orçamento, mas a etiqueta mais larga é leitura primária (live/critical/primary) — nunca migra";
      break;
    }

    // Teto da esquerda: ela pode crescer até o MESMO orçamento declarado,
    // ou absorver de graça qualquer etiqueta que já caiba na largura que
    // ela própria já ocupa. Nunca além disso — a esquerda não pode virar
    // o novo gargalo (trocar um problema por outro).
    const capEsquerdaPx = Math.max(leftDemandPx, budgetPx);
    if (widest.widthPx > capEsquerdaPx) {
      reason = "coluna direita acima do orçamento, mas migrar estouraria a esquerda — distribuição preservada";
      break;
    }

    remaining.splice(remaining.indexOf(widest), 1);
    migrate.push(widest.id);
    leftDemandPx = Math.max(leftDemandPx, widest.widthPx);
  }

  if (migrate.length === 0) {
    return NOTHING(rightDemandPx, budgetPx, reason || "nada migrável na coluna direita");
  }

  return {
    migrateToLeft: migrate,
    rightDemandPx,
    budgetPx,
    reason: `coluna direita exigia ${Math.round(rightDemandPx)}px contra orçamento de ${Math.round(budgetPx)}px — ${reason}`,
  };
}
