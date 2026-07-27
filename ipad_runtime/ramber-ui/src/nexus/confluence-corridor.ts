// confluence-corridor.ts — OMEGA CORE V-MAX Fase 5 ("Fusion / Centro
// Gravitacional") — retoma o backlog real já aprovado pelo Operador numa
// rodada anterior (Fusion §5, "Corredor de Confluência", renomeado
// honestamente de "Corredor de Probabilidade" porque este repositório não
// tem backtest real que sustente uma probabilidade calibrada — Regra de
// Ouro 2 do CLAUDE.md, não-negociável). É a mesma ideia visual do "Centro
// Gravitacional" citado na diretriz nova: tratado como 1 feature, não 2,
// para não duplicar.
//
// Formaliza o "organizador de contexto" que a Fase 5 pede: uma função pura
// que CRUZA sinais de confluência JÁ reais e já computados em outro lugar
// — zero motor novo, zero segunda matemática de consenso, zero fetch:
//   1. conviction — leitura JÁ correta do Confluence/Conviction Engine
//      (confluence-engine.ts, buildConvictionReading): o pool linear real
//      (Stone 1961/DeGroot 1974) dos 3 subsistemas independentes
//      (Ensemble/Council/Multi-Timeframe) já combinados. Lida INTEIRA,
//      nunca decomposta de novo aqui.
//   2. Obstáculos estruturais reais no caminho até o alvo ATIVO do Trade
//      Plan (obstacleCount, trade-plan.ts) — mais obstáculos, menor
//      clareza de caminho. Único componente genuinamente NOVO em relação
//      ao que o Conviction Engine já mede.
//
// CORREÇÃO REAL (achado de auditoria, completar Fase 7 — não é o foco
// direto daquela tarefa, mas CLAUDE.md exige reportar/corrigir limitação
// real encontrada mesmo fora de escopo): a v1 deste motor tinha 4
// componentes — opinionMass (council), institutionalScore, mtfAgreement,
// obstacleClearance. `institutionalScore.score` (institutional-score.ts)
// é, por construção, uma cópia reescalada (0-100) do MESMO
// `ConvictionReading.conviction` que já é ele próprio um pool de
// {ensemble, council, multiTimeframe}. Isso significa que os 2 primeiros
// componentes antigos (opinionMass e mtfAgreement) já estavam DENTRO do
// 2º (institutionalScore) — a média de 4 "componentes independentes" na
// verdade contava council e multi-timeframe 2x cada, e ensemble só 1x
// (escondido dentro de institutionalScore), enquanto obstacleClearance
// era o único componente genuinamente ortogonal. Corrigido substituindo
// os 3 componentes sobrepostos por UMA leitura só (`conviction`, lida
// inteira do Conviction Engine) — zero dupla contagem, zero segunda
// matemática de consenso, e o único componente perdido (a nuance fina do
// opinionMass bruto do Council) é honestamente menos importante que
// eliminar uma leitura estatisticamente enviesada.
//
// Display-only (LEI 24 / Lei Permanente 1): nunca gera, altera ou bloqueia
// Entry/Stop/Target/Decisão — `direction` e `activeObstacleCount` chegam
// como PARÂMETROS já decididos em outro lugar (Core Engine e Trade Plan),
// nunca recalculados aqui. `intensity` é sempre uma leitura de
// LARGURA/OPACIDADE visual (0-1), nunca rotulada como probabilidade em
// nenhum consumidor deste contrato.
export const CONFLUENCE_CORRIDOR_CONTRACT_VERSION = 2 as const;

import type { ConvictionReading } from "./confluence-engine";

export interface ConfluenceCorridorComponents {
  // ConvictionReading.convictionAdjusted (preferida, amortecida pelo
  // TrustScore real) com fallback honesto para .conviction bruto — MESMA
  // leitura, zero recálculo. null quando o Conviction Engine está
  // DADOS_INSUFICIENTES nesta janela.
  conviction: number | null;
  // 1 / (1 + obstáculos reais no caminho) — 1.0 quando o caminho está
  // livre, decrescendo (nunca zerando de vez) a cada obstáculo real
  // mapeado. Convenção documentada (mesma natureza do piso 1:2 de
  // rr-quality.ts), não uma medição. null sem alvo ativo/obstacleCount.
  obstacleClearance: number | null;
}

export interface ConfluenceCorridorReading {
  contractVersion: typeof CONFLUENCE_CORRIDOR_CONTRACT_VERSION;
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  // Média real dos componentes DISPONÍVEIS (0-1) — largura/intensidade
  // visual do corredor no canvas. null honesto quando nenhum componente
  // real está disponível ainda. NUNCA um rótulo de probabilidade — ver
  // cabeçalho deste arquivo.
  intensity: number | null;
  components: ConfluenceCorridorComponents;
  computedAt: number;
}

export interface ConfluenceCorridorInput {
  // Direção ATIVA real do Core Engine — nunca recomputada aqui, só lida.
  // Gate independente do componente `conviction`: sem direção ativa não
  // existe corredor a desenhar, mesmo que obstacleClearance esteja
  // disponível (um corredor "sem lado" seria uma leitura inventada).
  direction: "LONG" | "SHORT" | null;
  // Leitura JÁ real do Conviction Engine (confluence-engine.ts) — inteira,
  // nunca decomposta. null quando o chamador ainda não a computou nesta
  // janela (fail-closed honesto, nunca 0 fabricado).
  conviction: ConvictionReading | null;
  // obstacleCount do alvo ATIVO do Trade Plan (trade-plan.ts) — null
  // quando não há Trade Plan ativo.
  activeObstacleCount: number | null;
  now?: number;
}

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function computeConfluenceCorridor(input: ConfluenceCorridorInput): ConfluenceCorridorReading {
  const computedAt = input.now ?? Date.now();
  const empty = (reason: string): ConfluenceCorridorReading => ({
    contractVersion: CONFLUENCE_CORRIDOR_CONTRACT_VERSION,
    status: "DADOS_INSUFICIENTES",
    reason,
    intensity: null,
    components: { conviction: null, obstacleClearance: null },
    computedAt,
  });

  // Sem direção ativa (WAIT real do Core Engine): não existe corredor a
  // desenhar — nenhum dos 2 lados tem sustentação para exibir, e um
  // corredor "neutro" seria uma leitura inventada, não uma leitura real.
  if (input.direction !== "LONG" && input.direction !== "SHORT") {
    return empty("sem_direcao_ativa_do_core_engine");
  }

  const convictionValue = input.conviction?.status === "OK"
    ? (input.conviction.convictionAdjusted ?? input.conviction.conviction)
    : null;
  const conviction = fin(convictionValue) ? convictionValue : null;

  const obstacleClearance = fin(input.activeObstacleCount) ? 1 / (1 + (input.activeObstacleCount as number)) : null;

  const components: ConfluenceCorridorComponents = { conviction, obstacleClearance };
  const present = Object.values(components).filter(fin);
  if (present.length === 0) return empty("nenhum_componente_real_disponivel_ainda");

  const intensity = present.reduce((a, b) => a + b, 0) / present.length;
  return { contractVersion: CONFLUENCE_CORRIDOR_CONTRACT_VERSION, status: "OK", reason: null, intensity, components, computedAt };
}
