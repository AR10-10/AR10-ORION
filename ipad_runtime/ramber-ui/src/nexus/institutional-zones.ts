// institutional-zones.ts — DIRETIVA FINAL DE LAPIDAÇÃO DO GRÁFICO §4
// ("Consolidação de zonas"): "Sempre que múltiplos módulos apontarem
// praticamente a mesma região (EMA, VWAP, FVG, Order Block, Liquidity
// etc.), o gráfico deverá representar essa confluência como uma única
// Zona Institucional, reduzindo sobreposição."
//
// AUDITORIA ANTES DE CONSTRUIR (CLAUDE.md, Disciplina de trabalho item 1):
// este repositório já tem TRÊS motores de "confluência" reais —
// confluence-engine.ts (concordância DIRECIONAL entre Ensemble/Council/
// Multi-Timeframe), confluence-corridor.ts (intensidade visual do mesmo
// pool) e layer-relevance.ts (mostrar/esconder camada inteira). Nenhum
// dos três agrupa por PROXIMIDADE DE PREÇO entre ferramentas
// estruturalmente independentes (EMA achar 65000 e um FVG cobrir
// 64950-65050 é um fato geométrico, não uma opinião de subsistema) — esta
// é uma lacuna real, não uma duplicação. Reaproveita o MESMO padrão de
// clustering por âncora fixa já usado em clusterEqualLevels
// (fvg-order-block-engine.js) e clusterSweptPrices (trap-detection.ts):
// a âncora de um grupo é o PRIMEIRO membro (nunca uma média móvel), então
// um membro no limite do grupo nunca "arrasta" o grupo inteiro para longe
// do preço real que originou o agrupamento.
//
// HONESTIDADE (Regra de Ouro 2): uma Zona Institucional é um fato
// geométrico real — N ferramentas independentes calculam um preço dentro
// da mesma faixa estreita AGORA — nunca uma probabilidade de o preço
// reagir ali. `distinctSourceCount` é a única métrica de "força", e é uma
// contagem, não uma confiança calibrada.
//
// LEI 24: display-only puro. Nunca lê nem altera engine.direction/Trade
// Plan — os inputs abaixo são leituras JÁ REAIS de outros motores já
// graduados (nexus/ema.ts, nexus/vwap.ts, fvg-order-block-engine.js,
// engine-bridge.ts), este módulo só agrupa por proximidade geométrica.
//
// Fail-closed: cada fonte ausente/não-finita é omitida silenciosamente
// (nunca um membro fabricado); com menos de MIN_DISTINCT_SOURCES_FOR_ZONE
// ferramentas DISTINTAS concordando, não existe zona real a reportar —
// duas Order Blocks vizinhas nunca viram uma "Zona Institucional" sozinhas
// (seriam só... duas Order Blocks vizinhas, a mesma ferramenta duas
// vezes, não uma confluência cruzada real).
export const INSTITUTIONAL_ZONE_CONTRACT_VERSION = 1 as const;

export type InstitutionalZoneSourceKind =
  | "EMA"
  | "VWAP"
  | "NEXUS_LINE"
  | "FAIR_VALUE_GAP"
  | "ORDER_BLOCK"
  | "LIQUIDITY_EQH"
  | "LIQUIDITY_EQL"
  | "SUPPORT_RESISTANCE";

export interface InstitutionalZoneMember {
  sourceKind: InstitutionalZoneSourceKind;
  label: string; // ex.: "EMA21", "VWAP", "FVG Alta", "OB Baixa", "EQH"
  price: number; // ponto real usado no clustering (linha: valor; zona: ponto médio real de top/bottom)
  top: number; // limite superior real (== price para membros pontuais: EMA/VWAP/NL/EQH/EQL)
  bottom: number; // limite inferior real
}

export interface InstitutionalZone {
  top: number;
  bottom: number;
  centerPrice: number; // média real dos preços representativos do grupo
  members: InstitutionalZoneMember[];
  distinctSourceCount: number; // quantas FERRAMENTAS diferentes (não instâncias) concordam aqui
}

export interface InstitutionalZoneInput {
  ema: { period: number; value: number } | null;
  vwap: number | null;
  nexusLine: number | null;
  // Formas mínimas reais já usadas pelo gráfico (EnhancedChartZone/
  // EnhancedChartLiquidity, EnhancedChart_110_Percent.tsx) — quem chama já
  // filtra mitigated/swept antes (mesmo padrão de App.tsx:6832-6834), este
  // motor não reimplementa esse filtro.
  fairValueGaps: { type: "BULLISH" | "BEARISH"; top: number; bottom: number }[];
  orderBlocks: { type: "BULLISH" | "BEARISH"; top: number; bottom: number }[];
  liquidityZones: { type: "EQUAL_HIGH" | "EQUAL_LOW"; price: number }[];
  // Diretriz Consolidação/Auditoria/Evolução §6 (achado real da auditoria de
  // unificação: support-resistance-engine.js já graduado e já importado em
  // engine-bridge.ts, mas nunca alimentava este consolidador — lacuna de
  // fiação, não de matemática nova). Mesmo S1/R1 já usados pelas price
  // lines nativas do gráfico (EnhancedChart_110_Percent.tsx:303-304),
  // passados direto como prop — zero segundo cálculo.
  support: number | null;
  resistance: number | null;
  proximityPct?: number;
}

// Mesma convenção documentada (não medição — este repositório não tem
// backtest para calibrar "mesma região ideal") de VOLUME_PROFILE_
// PROXIMITY_PCT em layer-relevance.ts — ordem de grandeza igual porque o
// problema é o mesmo tipo de pergunta ("preço real X está perto o
// bastante de Y para contar como a mesma referência?").
export const INSTITUTIONAL_ZONE_PROXIMITY_PCT = 0.35;
// Confluência real exige >=2 FERRAMENTAS independentes — nunca uma zona
// "institucional" formada por uma ferramenta só.
export const MIN_DISTINCT_SOURCES_FOR_ZONE = 2;
// Teto real de zonas retornadas (mesma natureza de MAX_KEY_LEVELS_SHOWN
// em market-session.ts) — as mais fortes (mais ferramentas concordando)
// sempre vencem o corte, nunca uma ordem arbitrária.
export const MAX_INSTITUTIONAL_ZONES = 5;

function fin(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Motor puro: níveis JÁ reais de até 8 ferramentas independentes ->
 *  Zonas Institucionais reais por proximidade de preço. Determinístico,
 *  nunca lança, nunca depende de estado global. */
export function computeInstitutionalZones(input: InstitutionalZoneInput): InstitutionalZone[] {
  const proximityPct = input.proximityPct ?? INSTITUTIONAL_ZONE_PROXIMITY_PCT;
  const members: InstitutionalZoneMember[] = [];

  if (input.ema && fin(input.ema.value) && Number.isFinite(input.ema.period) && input.ema.period > 0) {
    members.push({ sourceKind: "EMA", label: `EMA${input.ema.period}`, price: input.ema.value, top: input.ema.value, bottom: input.ema.value });
  }
  if (fin(input.vwap)) {
    members.push({ sourceKind: "VWAP", label: "VWAP", price: input.vwap, top: input.vwap, bottom: input.vwap });
  }
  if (fin(input.nexusLine)) {
    members.push({ sourceKind: "NEXUS_LINE", label: "Nexus Line", price: input.nexusLine, top: input.nexusLine, bottom: input.nexusLine });
  }
  if (fin(input.support)) {
    members.push({ sourceKind: "SUPPORT_RESISTANCE", label: "S1", price: input.support, top: input.support, bottom: input.support });
  }
  if (fin(input.resistance)) {
    members.push({ sourceKind: "SUPPORT_RESISTANCE", label: "R1", price: input.resistance, top: input.resistance, bottom: input.resistance });
  }
  for (const z of input.fairValueGaps ?? []) {
    if (!fin(z.top) || !fin(z.bottom)) continue;
    const top = Math.max(z.top, z.bottom);
    const bottom = Math.min(z.top, z.bottom);
    members.push({ sourceKind: "FAIR_VALUE_GAP", label: `FVG ${z.type === "BULLISH" ? "Alta" : "Baixa"}`, price: (top + bottom) / 2, top, bottom });
  }
  for (const z of input.orderBlocks ?? []) {
    if (!fin(z.top) || !fin(z.bottom)) continue;
    const top = Math.max(z.top, z.bottom);
    const bottom = Math.min(z.top, z.bottom);
    members.push({ sourceKind: "ORDER_BLOCK", label: `OB ${z.type === "BULLISH" ? "Alta" : "Baixa"}`, price: (top + bottom) / 2, top, bottom });
  }
  for (const z of input.liquidityZones ?? []) {
    if (!fin(z.price)) continue;
    members.push({
      sourceKind: z.type === "EQUAL_HIGH" ? "LIQUIDITY_EQH" : "LIQUIDITY_EQL",
      label: z.type === "EQUAL_HIGH" ? "EQH" : "EQL",
      price: z.price,
      top: z.price,
      bottom: z.price,
    });
  }

  if (members.length < MIN_DISTINCT_SOURCES_FOR_ZONE) return [];

  // Clustering por âncora fixa (mesmo padrão de clusterSweptPrices/
  // clusterEqualLevels): ordena por preço real, agrupa consecutivos
  // dentro de proximityPct do PRIMEIRO membro do grupo em crescimento —
  // nunca uma média móvel, então um membro no limite nunca arrasta a
  // âncora para longe do preço que originou o grupo.
  const sorted = [...members].sort((a, b) => a.price - b.price);
  const groups: InstitutionalZoneMember[][] = [];
  let current: InstitutionalZoneMember[] = [];
  const flush = () => {
    if (current.length > 0) groups.push(current);
  };
  for (const m of sorted) {
    if (current.length === 0) {
      current = [m];
      continue;
    }
    const anchor = current[0].price;
    const closeEnough = anchor !== 0 && (Math.abs(m.price - anchor) * 100) / anchor <= proximityPct;
    if (closeEnough) {
      current.push(m);
    } else {
      flush();
      current = [m];
    }
  }
  flush();

  const zones: InstitutionalZone[] = [];
  for (const group of groups) {
    const distinctSourceCount = new Set(group.map((m) => m.sourceKind)).size;
    // Confluência real exige ferramentas DISTINTAS concordando — duas
    // instâncias da MESMA ferramenta (ex.: 2 Order Blocks vizinhos) nunca
    // formam uma Zona Institucional sozinhas.
    if (distinctSourceCount < MIN_DISTINCT_SOURCES_FOR_ZONE) continue;
    zones.push({
      top: Math.max(...group.map((m) => m.top)),
      bottom: Math.min(...group.map((m) => m.bottom)),
      centerPrice: group.reduce((sum, m) => sum + m.price, 0) / group.length,
      members: group,
      distinctSourceCount,
    });
  }

  return zones.sort((a, b) => b.distinctSourceCount - a.distinctSourceCount).slice(0, MAX_INSTITUTIONAL_ZONES);
}
