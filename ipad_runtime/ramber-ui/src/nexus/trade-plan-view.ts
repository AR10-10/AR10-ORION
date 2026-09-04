// trade-plan-view.ts — ORDEM 2 (FUTURE MAP/TRADE PLAN/REVERSAL ENGINE) §4
// ("Trade Plan"): uma representação operacional única — DIRECTION/ENTRY/
// INVALIDATION/TARGET 1-3/REVERSAL ZONES/CONFIDENCE STATE/SCENARIO/STATUS —
// que o Operador consegue ler em segundos.
//
// ZERO MOTOR NOVO (Ordem 2 §2: "NÃO criar novos motores duplicados. Reutilizar
// os componentes existentes"). Este módulo é PURAMENTE UM COMPOSITOR: lê as
// saídas JÁ REAIS de 5 sistemas independentes já existentes e testados —
//   - trade-plan.ts        (DIRECTION/ENTRY/INVALIDATION/TARGETS/R:R reais)
//   - signal-track-record.ts (STATUS de ciclo de vida do plano já aberto)
//   - operational-readability.ts (SETUP/ENTRY antes de existir um plano)
//   - scenario-engine.ts   (BASE/ALTERNATIVE — pathA/pathB já com invalidation)
//   - reversal-detector.ts (leitura de reversão CONFIRMADA — CHoCH/SuperTrend)
//   - institutional-score.ts (CONFIDENCE STATE qualitativo, nunca % fabricado)
// — e as organiza na forma única que a Ordem pede. Nenhum campo aqui é
// calculado: cada um é ou um passthrough real, ou um mapeamento honesto de
// enum já existente para o vocabulário desta view.
//
// MAPEAMENTO HONESTO CONTRA A ORDEM 2, REGISTRADO AQUI (não escondido):
//   §3/§8 Trade Semantics (NOT_DEFINED/MARKET/LIMIT/TRIGGER): já existe —
//     `deriveEntryState()` (operational-readability.ts) já responde "existe
//     confirmação de timing AGORA?" a partir de EXATAMENTE a mesma pergunta
//     (preço dentro da zona de entrada real ou não). ENTRY_CONFIRMED ≈
//     MARKET, WAITING_FOR_RETEST ≈ LIMIT, NO_ENTRY/ENTRY_INVALIDATED ≈
//     NOT_DEFINED. Construir um SEGUNDO classificador com vocabulário MARKET/
//     LIMIT/TRIGGER duplicaria essa mesma pergunta sob nomes diferentes —
//     exatamente o que a própria Ordem 2 §2 proíbe. TRIGGER não tem análogo
//     real: trade-plan.ts só constrói entradas do lado de PULLBACK
//     (estrutura de suporte para LONG/resistência para SHORT), nunca do lado
//     de rompimento — não fabricado aqui.
//   §6 Reversal Engine (REACTION ZONE/REVERSAL WATCH/CONFIRMED REVERSAL):
//     só o tier CONFIRMED existe hoje (reversal-detector.ts, CHoCH real ou
//     flip real do SuperTrend). `reversal` abaixo é um PASSTHROUGH real dessa
//     leitura — nunca reinterpretado como um tier mais fraco. REACTION ZONE/
//     REVERSAL WATCH exigiriam lógica de proximidade nova (que nível? que
//     limiar?) — gap real, não construído aqui para não fabricar um piso sem
//     justificativa (Regra de Ouro 2).
//   §7 Liquidity Map (ranking BUY-SIDE/SELL-SIDE, EQH/EQL, stop clusters):
//     `selectSharedZoneHighlights()` (liquidity-significance.ts) já ranqueia
//     zonas por significância real, mas para Order Blocks/FVG — não
//     especificamente EQH/EQL/liquidity pools. Gap real, não fechado aqui.
//   §13/§14 Five Pillars / Evidence Graph: nomes formais ainda não existem
//     no código (ver SYSTEM_HANDBOOK.md §6.93/§6.94) — fora do escopo desta
//     view, que só compõe Trade Plan.
import type { TradePlan, TradePlanLevel, TradePlanZone } from "./trade-plan";
import type { TrackedPlanStatus } from "./signal-track-record";
import type { NexusEntryState, NexusSetupState } from "./operational-readability";
import type { ScenarioProjection, ScenarioPath } from "./scenario-engine";
import type { ReversalReading } from "./reversal-detector";
import { institutionalConfidenceZone, type InstitutionalConfidenceTier } from "./institutional-score";

export const TRADE_PLAN_VIEW_CONTRACT_VERSION = 1 as const;

// Ordem 2 §23 ("Estados Operacionais") — mapeamento honesto para o
// vocabulário JÁ REAL de duas fases distintas: signal-track-record.ts
// (TrackedPlanStatus, plano JÁ aberto) e operational-readability.ts
// (NexusSetupState/NexusEntryState, ANTES de existir um plano). EXPIRED não
// existe em nenhum dos dois sistemas reais — nunca fabricado aqui.
export type TradePlanViewStatus =
  | "WAIT"
  | "SETUP_FORMING"
  | "ACTIVE"
  | "TARGET_REACHED"
  | "INVALIDATED"
  | "DATA_INSUFFICIENT";

// Ordem 2 §11 ("Cenários") — BASE/ALTERNATIVE, cada um com seus alvos reais
// + a invalidação real do MESMO lado (scenario-engine.ts já carrega
// `invalidation` dentro de cada ScenarioPath, nunca um 3º objeto separado).
export interface TradePlanViewScenarioPath {
  direction: "LONG" | "SHORT";
  targets: { price: number; basis: string }[];
  invalidation: { price: number; basis: string } | null;
  // Massa de opinião real do Conselho nesta direção (0..1) — NUNCA
  // probabilidade (mesmo contrato de scenario-engine.ts).
  opinionWeight: number | null;
}

export interface TradePlanViewScenario {
  base: TradePlanViewScenarioPath;
  alternative: TradePlanViewScenarioPath;
}

export interface TradePlanView {
  contractVersion: typeof TRADE_PLAN_VIEW_CONTRACT_VERSION;
  direction: "LONG" | "SHORT" | null;
  status: TradePlanViewStatus;
  entry: TradePlanZone | null;
  invalidation: TradePlanLevel | null;
  targets: TradePlanLevel[];
  riskRewardRatios: (number | null)[];
  // Ordem 2 §12: qualitativo real, nunca uma % inventada.
  // "DADOS_INSUFICIENTES" (não `null`) quando o score real está ausente —
  // mesmo vocabulário fail-closed do resto do repositório.
  confidenceState: InstitutionalConfidenceTier | "DADOS_INSUFICIENTES";
  // Passthrough real e integral de reversal-detector.ts — nunca
  // reinterpretado. `null` quando nenhuma leitura foi fornecida (fail-open:
  // ausência de leitura não é "sem reversão", é "não avaliado").
  reversal: ReversalReading | null;
  scenario: TradePlanViewScenario | null;
}

function fin(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function toScenarioPathView(path: ScenarioPath): TradePlanViewScenarioPath {
  return {
    direction: path.direction,
    targets: path.targets.map((t) => ({ price: t.price, basis: t.sourceKind })),
    invalidation: path.invalidation ? { price: path.invalidation.price, basis: path.invalidation.sourceKind } : null,
    opinionWeight: path.opinionWeight,
  };
}

// Ordem 2 §23: resolve o STATUS único a partir de qual dos dois sistemas
// reais tem uma leitura agora — nunca as duas ao mesmo tempo (um plano
// rastreado sempre implica um plano real existente).
function resolveStatus(
  plan: TradePlan | null,
  trackedStatus: TrackedPlanStatus | null,
  setupState: NexusSetupState | null,
  entryState: NexusEntryState | null,
): TradePlanViewStatus {
  if (trackedStatus === "OPEN") return "ACTIVE";
  if (trackedStatus === "TARGET_HIT" || trackedStatus === "PARTIAL_HIT") return "TARGET_REACHED";
  if (trackedStatus === "STOP_HIT" || trackedStatus === "REPLACED") return "INVALIDATED";
  // Plano real existe mas ainda não foi rastreado (1º ciclo antes do
  // próximo tick de signal-track-record.ts) — mesmo real de ACTIVE.
  if (plan) return "ACTIVE";
  if (entryState === "ENTRY_INVALIDATED" || setupState === "INVALIDATED") return "INVALIDATED";
  if (setupState === "NO_VALID_SETUP" || setupState === null) return "WAIT";
  return "SETUP_FORMING"; // WAITING_FOR_CONFIRMATION / WAITING_FOR_RETEST / LONG_SETUP-SHORT_SETUP sem timing ainda
}

/**
 * Compositor puro: zero I/O, zero cálculo novo, zero fabricação. Mesma
 * entrada, mesma saída. Cada campo de `TradePlanView` é um passthrough real
 * ou um mapeamento de enum já existente — nunca um valor inventado.
 */
export function composeTradePlanView(input: {
  plan: TradePlan | null;
  trackedStatus: TrackedPlanStatus | null;
  setupState: NexusSetupState | null;
  entryState: NexusEntryState | null;
  scenario: ScenarioProjection | null;
  reversal: ReversalReading | null;
  // Score institucional real (0-100) — frozen-at-open quando há plano
  // rastreado (mesma disciplina de contextAtOpen.score, §15/§16 desta
  // sessão), ao vivo quando não há plano ainda. Decisão de QUAL score usar
  // é do chamador — este compositor só formata o que recebe.
  confidenceScore: number | null;
}): TradePlanView {
  const { plan, trackedStatus, setupState, entryState, scenario, reversal, confidenceScore } = input;

  const status = resolveStatus(plan, trackedStatus, setupState, entryState);
  const confidenceZone = fin(confidenceScore) ? institutionalConfidenceZone(confidenceScore) : null;

  let scenarioView: TradePlanViewScenario | null = null;
  if (scenario) {
    // "base" = o lado que bate com a DIREÇÃO do plano real quando existe
    // plano; sem plano (WAIT), pathA já é a convenção real de scenario-
    // engine.ts (postura do conselho, ou LONG por convenção quando
    // NEUTRAL/ABSTAIN — nunca um viés novo, mesmo default já documentado
    // lá). "alternative" é sempre o caminho oposto ao "base".
    const baseIsA = !plan || scenario.pathA.direction === plan.direction;
    scenarioView = {
      base: toScenarioPathView(baseIsA ? scenario.pathA : scenario.pathB),
      alternative: toScenarioPathView(baseIsA ? scenario.pathB : scenario.pathA),
    };
  }

  return {
    contractVersion: TRADE_PLAN_VIEW_CONTRACT_VERSION,
    direction: plan?.direction ?? null,
    status,
    entry: plan?.entry ?? null,
    invalidation: plan?.stop ?? null,
    targets: plan?.targets ?? [],
    riskRewardRatios: plan?.riskRewardRatios ?? [],
    confidenceState: confidenceZone?.tier ?? "DADOS_INSUFICIENTES",
    reversal: reversal ?? null,
    scenario: scenarioView,
  };
}
