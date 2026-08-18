// liquidity-significance.ts — "a liquidez que amostra no gráfico, só
// realmente ela fazer diferença nas alterações... se a liquidez razoável
// pequena que não faz movimento no gráfico" (pedido direto do Operador).
//
// ═══ O QUE ESTAVA ACONTECENDO, MEDIDO ═══
//
// App.tsx desenhava FVG/Order Block/Void pela ordem de chegada
// (`.filter((z, i) => i < 3 || isRealObstacle(z))`) — os 3 mais recentes,
// mais qualquer um no caminho do Trade Plan. NENHUM filtro considerava o
// TAMANHO da própria zona. Um FVG de 3 ticks de largura (ruído de pavio)
// entrava na tela do mesmo jeito que um FVG de 2% do preço (um desequilíbrio
// real que o mercado tende a revisitar com força).
//
// É exatamente a reclamação: liquidez "pequena que não faz movimento" ganhava
// o mesmo peso visual que liquidez que realmente move o preço quando
// revisitada.
//
// ═══ A MEDIDA CERTA: TAMANHO RELATIVO AO ATR, NÃO TAMANHO ABSOLUTO ═══
//
// Um gap de 0,3% é enorme num ativo que anda 0,5% por dia e irrelevante num
// que anda 8%. A pergunta profissional não é "quantos ticks de largura" —
// é "quantas velas típicas de largura", e a "vela típica" já tem nome neste
// repositório: ATR de Wilder (14), a mesma fonte única já unificada em
// decision-distance.ts (src/market-regime/regime-engine.js::atrPercent).
//
// Zero segunda fórmula: este módulo só compara a largura real da zona contra
// o ATR% real já calculado em outro lugar.
//
// ═══ POR QUE NÃO FILTREI POOLS DE LIQUIDEZ (EQH/EQL) POR TOQUES ═══
//
// Pesquisei antes de construir (auditoria real, não suposição):
// support-resistance-engine.js já define STRONG_TOUCH_THRESHOLD = 2 para
// rotular S/R como FORTE/FRACA. E fvg-order-block-engine.js::clusterEqualLevels
// exige NO MÍNIMO 2 toques para uma zona sequer ser reconhecida como
// "Equal High/Low" — é a definição do próprio conceito, não um filtro
// adicional. Ou seja: todo pool que chega até a UI JÁ passou pelo piso de
// significância que o repositório usa em todo lugar. Um filtro extra aqui
// não removeria nada real — só duplicaria uma regra que já existe alhures.
// Achado honesto: o problema descrito pelo Operador vive nos GAPS (FVG/OB/
// Void), não nos pools, e é ali que a correção real entra.

/** Fração mínima de UM ATR que uma zona precisa ter de largura para contar
 *  como "faz diferença". Abaixo disso, é ruído de pavio — a mesma ordem de
 *  grandeza de um movimento que o próprio ATR já descreve como típico do
 *  ativo, então uma zona menor que isso desapareceria dentro do próprio
 *  ruído normal de uma vela. Heurística de mesa (mesma classe de decisão
 *  documentada de TARGET_LABEL_COMPACT_PCT em label-compaction.ts) — nunca
 *  um número mágico sem raciocínio: 12% de um ATR é abaixo de 1/8 de uma
 *  vela típica, o piso onde um profissional já descartaria a zona por
 *  microestrutura, não por tendência real. */
export const MIN_ZONE_ATR_FRACTION = 0.12;

export interface ZoneSignificance {
  status: "OK" | "DADOS_INSUFICIENTES";
  /** Largura real da zona, em unidades de ATR. `null` sem leitura real. */
  widthAtrUnits: number | null;
  /** true = a zona é grande o suficiente para "fazer diferença" real. Sem
   *  ATR real, `significant` é sempre true — fail-closed na AFIRMAÇÃO de
   *  insignificância, nunca na visibilidade: não dá para provar que uma
   *  zona é ruído sem saber o que é normal para este ativo, então na dúvida
   *  ela continua visível (Regra de Ouro 4 — nunca apagar por suposição). */
  significant: boolean;
}

const NO_ATR: ZoneSignificance = { status: "DADOS_INSUFICIENTES", widthAtrUnits: null, significant: true };

/**
 * Significância real de uma zona de preço (FVG/OB/Void), medida contra o
 * ATR real do ativo.
 *
 * Fail-closed nas duas pontas: preço/top/bottom inválidos ou ATR ausente
 * devolvem `significant: true` (nunca esconde por suposição); top < bottom
 * (zona invertida, dado corrompido) também não filtra — o defeito é de
 * dado, não de tamanho, e escondê-la esconderia o sintoma real.
 */
export function computeZoneSignificance(
  top: number | null | undefined,
  bottom: number | null | undefined,
  price: number | null | undefined,
  atrPercent: number | null | undefined,
): ZoneSignificance {
  if (!Number.isFinite(atrPercent) || (atrPercent as number) <= 0) return NO_ATR;
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || !Number.isFinite(price) || (price as number) <= 0) {
    return NO_ATR;
  }
  const width = (top as number) - (bottom as number);
  if (width <= 0) return { status: "OK", widthAtrUnits: 0, significant: true };
  const widthPct = (width / (price as number)) * 100;
  const widthAtrUnits = widthPct / (atrPercent as number);
  return { status: "OK", widthAtrUnits, significant: widthAtrUnits >= MIN_ZONE_ATR_FRACTION };
}

/** Formata a largura em ATR para o tooltip — mesma disciplina de
 *  formatAtrUnits em decision-distance.ts (piso "<0.05×" para nunca
 *  confundir "quase nada" com "zero"). */
export function formatZoneAtrWidth(widthAtrUnits: number | null | undefined): string {
  if (!Number.isFinite(widthAtrUnits)) return "—";
  const u = widthAtrUnits as number;
  if (u === 0) return "0×";
  if (u < 0.05) return "<0.05×";
  return `${u.toFixed(2)}× ATR`;
}
