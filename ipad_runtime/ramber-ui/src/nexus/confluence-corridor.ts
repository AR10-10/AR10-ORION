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
//   1. council.opinionMass — massa real do pool linear (Stone 1961/DeGroot
//      1974), do lado que coincide com a direção ATIVA do Core Engine.
//   2. institutionalScore.score — confluência real 0-100 (institutional-
//      score.ts), normalizada para 0-1.
//   3. Concordância real da Matriz Multi-Timeframe — proporção dos prazos
//      com confidenceStance real que concordam com a direção ativa.
//   4. Obstáculos estruturais reais no caminho até o alvo ATIVO do Trade
//      Plan (obstacleCount, trade-plan.ts) — mais obstáculos, menor
//      clareza de caminho.
//
// Display-only (LEI 24 / Lei Permanente 1): nunca gera, altera ou bloqueia
// Entry/Stop/Target/Decisão — `direction` e `activeObstacleCount` chegam
// como PARÂMETROS já decididos em outro lugar (Core Engine e Trade Plan),
// nunca recalculados aqui. `intensity` é sempre uma leitura de
// LARGURA/OPACIDADE visual (0-1), nunca rotulada como probabilidade em
// nenhum consumidor deste contrato.
export const CONFLUENCE_CORRIDOR_CONTRACT_VERSION = 1 as const;

export interface ConfluenceCorridorComponents {
  // Massa real do pool do Conselho do lado da direção ativa (0-1) — null
  // enquanto o Conselho não tem opinionMass real (ABSTAIN/riskGated).
  opinionMass: number | null;
  // institutionalScore.score / 100 (0-1) — null quando o Score Geral está
  // DADOS_INSUFICIENTES ou o Core Engine está em WAIT (nada a pontuar).
  institutionalScore: number | null;
  // Proporção real de prazos da Matriz Multi-Timeframe cujo
  // confidenceStance concorda com a direção ativa (0-1) — null enquanto
  // nenhum prazo tem leitura real.
  mtfAgreement: number | null;
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
  direction: "LONG" | "SHORT" | null;
  opinionMass: { long: number; short: number; neutral: number } | null;
  institutionalScore: number | null;
  // Mapa de prazo → leitura real da Matriz Multi-Timeframe (só o campo
  // que este motor de fato usa, para não acoplar ao tipo inteiro
  // MultiTimeframeMatrix e não criar uma dependência de import
  // desnecessária — mesmo espírito de council.ts's tipos de entrada
  // mínimos/estruturais).
  multiTimeframe: Record<string, { confidenceStance: "LONG" | "SHORT" | "NEUTRAL" | null } | undefined> | null;
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
    components: { opinionMass: null, institutionalScore: null, mtfAgreement: null, obstacleClearance: null },
    computedAt,
  });

  // Sem direção ativa (WAIT real do Core Engine): não existe corredor a
  // desenhar — nenhum dos 2 lados tem sustentação para exibir, e um
  // corredor "neutro" seria uma leitura inventada, não uma leitura real.
  if (input.direction !== "LONG" && input.direction !== "SHORT") {
    return empty("sem_direcao_ativa_do_core_engine");
  }

  const opinionMass = input.opinionMass
    ? (input.direction === "LONG" ? input.opinionMass.long : input.opinionMass.short)
    : null;

  const institutionalScore = fin(input.institutionalScore) ? (input.institutionalScore as number) / 100 : null;

  let mtfAgreement: number | null = null;
  if (input.multiTimeframe) {
    const readings = Object.values(input.multiTimeframe).filter(
      (c): c is { confidenceStance: "LONG" | "SHORT" | "NEUTRAL" | null } => !!c && c.confidenceStance !== null,
    );
    if (readings.length > 0) {
      const agreeing = readings.filter((c) => c.confidenceStance === input.direction).length;
      mtfAgreement = agreeing / readings.length;
    }
  }

  const obstacleClearance = fin(input.activeObstacleCount) ? 1 / (1 + (input.activeObstacleCount as number)) : null;

  const components: ConfluenceCorridorComponents = { opinionMass, institutionalScore, mtfAgreement, obstacleClearance };
  const present = Object.values(components).filter(fin);
  if (present.length === 0) return empty("nenhum_componente_real_disponivel_ainda");

  const intensity = present.reduce((a, b) => a + b, 0) / present.length;
  return { contractVersion: CONFLUENCE_CORRIDOR_CONTRACT_VERSION, status: "OK", reason: null, intensity, components, computedAt };
}
