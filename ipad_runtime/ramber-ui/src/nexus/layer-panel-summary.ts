// layer-panel-summary.ts — o que o painel de camadas DIZ que está na tela.
//
// PEDIDO DO OPERADOR: "aqui dentro tem vários módulo, eu quero só UM modo, e
// ele é o modo inteligente... que apareça só as ferramentas necessárias
// principais pra o operador bater o olho e saber".
//
// DEFEITO REAL ENCONTRADO AO ATENDER ESSE PEDIDO — e ele é a causa de o
// painel parecer não bater com o gráfico. O painel e o CANVAS usavam
// resoluções DIFERENTES do que está visível:
//
//   painel  →  relevance.relevant       (só o gate de relevância)
//   canvas  →  autoDecision.show        (gate + TETO de competição)
//
// Em mercado ativo a maioria das camadas passa no gate de relevância, e o
// teto (AUTO_LAYER_MAX_SIMULTANEOUS + orçamento de custo visual) derruba
// quase todas. O painel listava ~20 camadas como "VISÍVEL" enquanto o
// gráfico desenhava 6. Nenhum erro, nenhum log — só o painel mentindo sobre
// a própria tela.
//
// Este módulo NÃO decide nada: ele lê a decisão JÁ resolvida (a mesma que o
// canvas recebe, publicada na store por quem a computa) e a organiza em três
// listas legíveis. Zero segunda resolução — era exatamente a existência de
// uma segunda resolução que criou o defeito.
//
// A distinção entre "cedeu espaço" e "sem leitura real" é o coração da
// honestidade aqui: uma camada suprimida pelo teto TEM leitura real agora,
// ela só perdeu a competição por espaço para camadas mais precisas. Dizer
// "oculta" para as duas coisas apaga a diferença que mais importa.

import type { AutoLayerDecision } from "./layer-relevance";

export interface LayerPanelEntry {
  id: string;
  label: string;
}

export interface LayerPanelSummary {
  /** No gráfico AGORA, decididas pela inteligência. */
  ativas: LayerPanelEntry[];
  /** Têm leitura real agora, mas cederam espaço para camadas mais precisas. */
  cederam: LayerPanelEntry[];
  /** O Operador assumiu controle manual (o teto automático não se aplica). */
  manuais: LayerPanelEntry[];
  /** Sem leitura real neste ciclo — nada a mostrar, e isso é uma resposta. */
  semLeitura: LayerPanelEntry[];
}

const VAZIO: LayerPanelSummary = { ativas: [], cederam: [], manuais: [], semLeitura: [] };

/**
 * @param modules lista canônica de camadas do painel (id + rótulo)
 * @param decision decisão JÁ resolvida do canvas (store) — `null` enquanto
 *   nenhum ciclo real rodou
 * @param autoMode true = a inteligência decide; false = override do Operador
 * @param manual visibilidade manual, só consultada onde autoMode é false
 */
export function summarizeLayerPanel(
  modules: readonly LayerPanelEntry[],
  decision: Readonly<Record<string, AutoLayerDecision>> | null,
  autoMode: Readonly<Record<string, boolean>>,
  manual: Readonly<Record<string, boolean>>,
): LayerPanelSummary {
  if (!Array.isArray(modules) || modules.length === 0) return VAZIO;

  const out: LayerPanelSummary = { ativas: [], cederam: [], manuais: [], semLeitura: [] };

  for (const m of modules) {
    // Override humano vem primeiro: uma decisão explícita do Operador nunca
    // é reclassificada por heurística nenhuma.
    if (autoMode[m.id] === false) {
      if (manual[m.id]) out.manuais.push(m);
      else out.semLeitura.push(m); // desligada à mão — não está na tela.
      continue;
    }

    const d = decision?.[m.id];
    // Fail-closed: sem decisão real ainda (primeiro ciclo, camada nova sem
    // regra), a camada NÃO é anunciada como ativa. Anunciar seria o mesmo
    // tipo de mentira que este módulo existe para corrigir.
    if (!d) {
      out.semLeitura.push(m);
      continue;
    }
    if (d.show) out.ativas.push(m);
    else if (d.suppressedByCap) out.cederam.push(m);
    else out.semLeitura.push(m);
  }

  return out;
}

/** Frase única de estado, para o Operador ler de relance sem contar chips. */
export function describeLayerPanel(s: LayerPanelSummary): string {
  const partes = [`${s.ativas.length} no gráfico`];
  if (s.manuais.length > 0) partes.push(`${s.manuais.length} fixada${s.manuais.length > 1 ? "s" : ""} por você`);
  if (s.cederam.length > 0) partes.push(`${s.cederam.length} cedeu espaço`);
  return partes.join(" · ");
}
