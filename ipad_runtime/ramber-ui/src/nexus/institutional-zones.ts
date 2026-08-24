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
  | "SUPPORT_RESISTANCE"
  // EPC OMEGA FINAL Parte 2 §7 (Confluência Visual): 3 fontes que a
  // diretiva nomeia explicitamente e ainda não alimentavam este
  // consolidador (achado real de auditoria — ver
  // docs/RELATORIO_EPC_OMEGA_FINAL.md) — fecham os pares Volume
  // Profile+S/R, Session Key Level+Liquidez e FVG+Sweep.
  | "VOLUME_PROFILE_POC"
  | "SESSION_KEY_LEVEL"
  | "LIQUIDITY_SWEEP"
  // Graduações desta rodada (supertrend-engine.js e institutional-blocks.js):
  // chegavam ao gráfico mas não alimentavam este consolidador — mesma classe
  // de lacuna de fiação já corrigida antes para S1/R1. Ver o comentário em
  // superTrendLine/institutionalBlocks no input.
  | "SUPERTREND"
  | "BREAKER_BLOCK"
  | "MITIGATION_BLOCK"
  // Evolução Total (fix documentado na Ordem Nº 03 §3, executado sob
  // "não deixa nada pendente"): os 2 swings fractais mais recentes do
  // market-structure-engine.js — a 11ª fonte real, a única que a
  // auditoria da Ordem Nº 03 apontou como ausente deste consolidador.
  // Nuance honesta (documentada no próprio §3 na época): swings recentes
  // e Support/Resistance (nível mais TOCADO) vêm do MESMO
  // fractal-swings.js por baixo e podem coincidir com frequência — são
  // perguntas diferentes sobre os mesmos fractais ("o pivô mais novo"
  // vs "o nível mais revisitado"), então a confluência marginal é real
  // porém menor do que "mais uma fonte" sugere à primeira vista.
  | "MARKET_STRUCTURE_SWING";

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
  // EPC OMEGA FINAL Parte 2 §7: POC real do perfil Fixed Range (mesmo
  // campo que VolumeProfilePlugin já desenha, zero segundo cálculo —
  // Session Profile fica de fora, mesma razão documentada no plugin: os
  // dois juntos duplicariam barras na mesma faixa).
  volumeProfilePoc: number | null;
  // Só a sessão mais recente (generationsBack=0 em sessionGenerationWeight/
  // MarketSessionBandsPlugin) — sessões mais antigas já esmaecem no
  // próprio SessionKeyLevelsPlugin; puxar todo o histórico de novo aqui
  // faria confluência com nível já visualmente quase apagado.
  sessionKeyLevel: { high: number; low: number } | null;
  // Clusters já reais e já filtrados por decaimento (SWEEP_DECAY,
  // EnhancedChart_110_Percent.tsx) — este motor não reimplementa a curva
  // de idade, só recebe o que já sobreviveu ao filtro do chamador.
  liquiditySweeps: { price: number }[];
  // Evolução Total: swing high/low fractais mais recentes (analysis-
  // frame.js → engine-bridge.ts lastSwingHigh/lastSwingLow) — membros
  // pontuais, mesmo padrão de ema/vwap/nexusLine. null = ciclo ainda sem
  // estrutura real (fail-closed, membro simplesmente omitido).
  lastSwingHigh: number | null;
  lastSwingLow: number | null;
  // ACHADO DE AUDITORIA (pedido do Operador: "ver o que que tá faltando pra
  // adicionar"): as duas camadas graduadas nesta rodada — SuperTrend e
  // Breaker/Mitigation Block — chegavam ao gráfico mas NÃO entravam nesta
  // consolidação. Mesma classe de lacuna de fiação já corrigida antes para
  // S1/R1 (§6 acima): o dado real existia, o consolidador não o via.
  //
  // O efeito prático de faltar aqui é o contrário do que o Operador quer:
  // um SuperTrend parado exatamente sobre VWAP+OB é uma ferramenta
  // independente A MAIS concordando naquele preço, e a contagem de fontes
  // ("4F") saía menor do que a realidade. Consolidar também REDUZ desenho
  // repetido — é o mecanismo que existe justamente para isso.
  //
  // Ambos opcionais/fail-closed: ausentes => resultado idêntico ao de antes
  // desta rodada.
  superTrendLine?: number | null;
  /** Blocos já filtrados pelo chamador (não retestados) — este motor nunca
   *  reimplementa o filtro, só recebe o que sobreviveu a ele. */
  institutionalBlocks?: { kind: "BREAKER" | "MITIGATION"; top: number; bottom: number }[];
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
  if (fin(input.volumeProfilePoc)) {
    members.push({ sourceKind: "VOLUME_PROFILE_POC", label: "POC", price: input.volumeProfilePoc, top: input.volumeProfilePoc, bottom: input.volumeProfilePoc });
  }
  if (input.sessionKeyLevel) {
    if (fin(input.sessionKeyLevel.high)) {
      members.push({ sourceKind: "SESSION_KEY_LEVEL", label: "Sessão Alta", price: input.sessionKeyLevel.high, top: input.sessionKeyLevel.high, bottom: input.sessionKeyLevel.high });
    }
    if (fin(input.sessionKeyLevel.low)) {
      members.push({ sourceKind: "SESSION_KEY_LEVEL", label: "Sessão Baixa", price: input.sessionKeyLevel.low, top: input.sessionKeyLevel.low, bottom: input.sessionKeyLevel.low });
    }
  }
  for (const s of input.liquiditySweeps ?? []) {
    if (!fin(s.price)) continue;
    members.push({ sourceKind: "LIQUIDITY_SWEEP", label: "Sweep", price: s.price, top: s.price, bottom: s.price });
  }
  if (fin(input.lastSwingHigh)) {
    members.push({ sourceKind: "MARKET_STRUCTURE_SWING", label: "Swing H", price: input.lastSwingHigh, top: input.lastSwingHigh, bottom: input.lastSwingHigh });
  }
  if (fin(input.lastSwingLow)) {
    members.push({ sourceKind: "MARKET_STRUCTURE_SWING", label: "Swing L", price: input.lastSwingLow, top: input.lastSwingLow, bottom: input.lastSwingLow });
  }
  // SuperTrend: membro PONTUAL (o stop que trilha é um preço único),
  // mesmo padrão de EMA/VWAP/Nexus Line.
  if (fin(input.superTrendLine)) {
    members.push({ sourceKind: "SUPERTREND", label: "SuperTrend", price: input.superTrendLine, top: input.superTrendLine, bottom: input.superTrendLine });
  }
  // Breaker / Mitigation: membros de FAIXA (top/bottom reais), mesmo padrão
  // de FVG/Order Block. Os dois tipos entram como sourceKinds DISTINTOS de
  // propósito — são fenômenos estruturais diferentes (um varreu liquidez
  // antes de falhar, o outro não), e fundi-los num só apagaria informação
  // real e inflaria a contagem de fontes com uma concordância que não
  // existe (Regra de Ouro 4).
  for (const b of input.institutionalBlocks ?? []) {
    if (!fin(b.top) || !fin(b.bottom)) continue;
    members.push({
      sourceKind: b.kind === "BREAKER" ? "BREAKER_BLOCK" : "MITIGATION_BLOCK",
      label: b.kind === "BREAKER" ? "Breaker" : "Mitigation",
      price: (b.top + b.bottom) / 2,
      top: b.top,
      bottom: b.bottom,
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
