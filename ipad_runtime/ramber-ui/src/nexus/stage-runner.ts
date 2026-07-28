// stage-runner.ts — OMEGA CORE V-MAX Fase 3: formaliza o pipeline linear já
// real e documentado (SYSTEM_HANDBOOK.md §2, "Pipeline canônico de decisão")
// como um contrato explícito, auditável e testado — não uma nova camada de
// cálculo, nem uma segunda implementação de nenhum motor. Read-only puro:
// traceStages() só LÊ o UnifiedGlobalSnapshot (nunca escreve, nunca chama
// nenhum motor/engine), então é um OBSERVADOR externo do que os motores
// reais já produziram — exatamente a mesma relação que o Health Monitor já
// tem com o organismo (ver nexus/organism-orchestrator.ts).
//
// "ok" em cada estágio significa "este estágio teve o insumo real e causal
// do estágio anterior para rodar honestamente" — NUNCA "o resultado deste
// estágio foi positivo/acionável". Um Trade Plan null porque o Conselho
// está NEUTRAL/ABSTAIN é uma resposta real e esperada (mesma disciplina da
// ROTA C em docs/ANALYSIS_OUTPUT_CONTRACT.md — ausência de operação é um
// resultado de primeira classe, não uma falha), por isso o estágio
// TRADE_PLAN nunca testa `tradePlan !== null`: só herda a validade causal
// do Conselho, que é quem realmente decide se há insumo real para tentar.
//
// Regra de causalidade (fail-closed, provada por teste em
// tests/stage-runner.test.ts): nenhum estágio pode reportar ok=true se um
// estágio anterior já reportou ok=false — cada `ok` downstream é construído
// como `anteriorOk && <condição própria>`, então a invariante vem da própria
// construção, não de uma checagem redundante depois.
//
// Diretriz Final de Integração Total: buildNexusDecision (decision-layer.ts)
// ganhou fatia própria no UnifiedGlobalSnapshot (EPC OMEGA FINAL, §4
// CÉREBRO — antes só existia como useMemo local em App.tsx, exatamente o
// bloqueio que este comentário documentava) — o estágio NEXUS_DECISION
// abaixo fecha esse gap honesto, não fabricado.
//
// Ainda NÃO coberto (gap honesto real, não fabricado): OperationalReadability
// (operational-readability.ts) — o último elo do pipeline §2 — continua sem
// fatia própria no UnifiedGlobalSnapshot; só fica rastreável aqui quando
// ganhar uma, nunca simulado/inferido por conveniência.
import type { UnifiedSnapshotState } from "../store/unified-snapshot-store";

export const STAGE_ORDER = ["DATA", "CORE_ENGINE", "COUNCIL", "TRADE_PLAN", "NEXUS_DECISION"] as const;
export type StageId = (typeof STAGE_ORDER)[number];

export interface StageResult {
  id: StageId;
  ok: boolean;
  reason: string;
}

export interface StageTrace {
  // Geração do organismo no momento desta leitura (mesmo seq de
  // getSnapshotForEngine()/organism-orchestrator.ts) — permite ao chamador
  // amarrar este trace a uma transição real específica, sem inventar um
  // segundo relógio/contador.
  seq: number;
  stages: StageResult[];
  // Índice do último estágio real e honesto alcançado nesta ordem causal
  // (contíguo desde o início) — -1 se nem o primeiro rodou. Nunca "quantos
  // estágios existem", só "até onde a cadeia real chegou sem quebrar".
  reachedIndex: number;
}

/**
 * Pipeline canônico real (SYSTEM_HANDBOOK.md §2), formalizado — não
 * reimplementado. Cada estágio já vive em código real, cada motor já é
 * dono exclusivo da própria fatia (Lei Permanente 4, OMEGA CORE V-MAX);
 * esta função só lê o que já está escrito na store, na ordem causal já
 * documentada, e nomeia essa ordem explicitamente.
 */
export function traceStages(snapshot: UnifiedSnapshotState, seq: number): StageTrace {
  const stages: StageResult[] = [];

  // DATA — dado real de mercado chegou para o par symbol:timeframe ativo
  // desde o último reset (troca de ativo zera price.updatedAt para null —
  // ver App.tsx, efeito de troca de ativo).
  const dataOk = snapshot.price.updatedAt !== null;
  stages.push({
    id: "DATA",
    ok: dataOk,
    reason: dataOk
      ? "preço real recebido para o símbolo/timeframe ativo"
      : "sem tick real ainda (boot ou troca de ativo recente)",
  });

  // CORE_ENGINE — o ciclo real (research-engine.js/trade-setup-matrix.js/
  // target-tracker.js via engine-bridge.ts) completou pelo menos uma vez.
  // engineStatus === 'ok' inclui WAIT honesto (direction null é uma
  // resposta real do motor, não a ausência de resposta) — só 'pending'
  // (nunca rodou) e 'error' (rodou e falhou de verdade: rede/wasm) contam
  // como não-ok, porque nenhum dos dois é insumo real utilizável adiante.
  const coreOk = dataOk && snapshot.core.engineStatus === "ok";
  stages.push({
    id: "CORE_ENGINE",
    ok: coreOk,
    reason: !dataOk
      ? "estágio anterior (DATA) sem insumo real"
      : snapshot.core.engineStatus === "ok"
        ? "ciclo real do motor completou (direção pode ser LONG/SHORT/WAIT, todas honestas)"
        : snapshot.core.engineStatus === "error"
          ? "ciclo real do motor falhou (rede/wasm) — nunca fabricar direção a partir daqui"
          : "ciclo ainda pendente (primeira leitura real em andamento)",
  });

  // COUNCIL — o Conselho rodou com insumos reais do ciclo ativo desde o
  // último reset (council começa null e só troca de referência quando o
  // motor real de fato escreve uma decisão — ver App.tsx, efeito do
  // Conselho). ABSTAIN/NEUTRAL é uma decisão real não-null; só o estado
  // "ainda não rodou" conta como não-ok aqui.
  const councilOk = coreOk && snapshot.council !== null;
  stages.push({
    id: "COUNCIL",
    ok: councilOk,
    reason: !coreOk
      ? "estágio anterior (CORE_ENGINE) sem insumo real"
      : snapshot.council !== null
        ? "conselho rodou com insumos reais do ciclo ativo (decisão pode ser ABSTAIN, honesta)"
        : "conselho ainda não rodou nesta geração (boot ou troca de ativo recente)",
  });

  // TRADE_PLAN — deliberadamente NÃO testa `tradePlan !== null`: trade-
  // plan.ts devolve null tanto quando o Conselho está sem insumo real
  // QUANTO quando o Conselho tem insumo real mas conclui NEUTRAL/ABSTAIN/
  // riskGated (nenhuma estrutura real sustenta um plano agora) — as duas
  // situações têm a MESMA representação (null) mas significados causais
  // diferentes, e só a primeira é uma falha de estágio. "ok" aqui só
  // herda a validade causal do Conselho: se o Conselho rodou de verdade,
  // o Trade Plan teve insumo real para decidir (com ou sem plano).
  const tradePlanOk = councilOk;
  stages.push({
    id: "TRADE_PLAN",
    ok: tradePlanOk,
    reason: !councilOk
      ? "estágio anterior (COUNCIL) sem insumo real"
      : "conselho real disponível para avaliar um plano (presença/ausência de plano é resposta honesta deste estágio, nunca uma falha)",
  });

  // NEXUS_DECISION — o contrato único (decision-layer.ts, "Fusão da
  // Inteligência Operacional") que funde as leituras já reais acima numa
  // resposta consolidada montou pelo menos uma vez desde o último reset
  // (mesmo padrão null-inicial de council acima — o efeito real em
  // App.tsx só escreve depois do primeiro cálculo). Como TRADE_PLAN, este
  // estágio só herda a validade causal do anterior: presença/ausência de
  // plano DENTRO do contrato já é resposta honesta do estágio anterior,
  // aqui só confirma que o contrato em si foi montado com esses insumos.
  const nexusDecisionOk = tradePlanOk && snapshot.nexusDecision !== null;
  stages.push({
    id: "NEXUS_DECISION",
    ok: nexusDecisionOk,
    reason: !tradePlanOk
      ? "estágio anterior (TRADE_PLAN) sem insumo real"
      : snapshot.nexusDecision !== null
        ? "contrato único (Nexus Decision Layer) montado com os insumos reais acima"
        : "contrato ainda não montado nesta geração (boot ou troca de ativo recente)",
  });

  let reachedIndex = -1;
  for (let i = 0; i < stages.length; i++) {
    if (!stages[i].ok) break;
    reachedIndex = i;
  }

  return { seq, stages, reachedIndex };
}
