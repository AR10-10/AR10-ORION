// operation-assistant.ts — Diretriz V-MAX (item 6, "Assistente
// Operacional") + Diretriz Camada de Decisão Profissional (item 3):
// frases CURTAS e objetivas para o Operador, sempre derivadas de leitura
// real já computada pelos motores — "nunca gerar recomendações sem
// justificativa estatística" (texto da própria diretriz): cada mensagem
// carrega `basis`, a origem real verificável.
//
// LEI 24 (inviolável): este assistente NUNCA é um segundo emissor de
// decisão. Cada frase é uma TRADUÇÃO determinística de leituras que já
// existem: "Compra favorecida" só existe quando o Core Engine JÁ emitiu
// LONG e a confluência real confirma; "Aguarde confirmação" só espelha o
// WAIT que o Core Engine JÁ emitiu; "Risco elevado" só espelha o gate
// fail-closed que o RiskAgent JÁ travou. Zero opinião própria.
//
// HONESTIDADE (Regra de Ouro 2, desvio deliberado e documentado do texto
// da diretriz): os exemplos da diretriz incluem "Alta probabilidade" /
// "Baixa probabilidade" — este repositório não tem backtest real que
// sustente uma probabilidade calibrada, então as frases entregues são
// "Alta confluência" / "Baixa confluência" (o número real que existe),
// mesma resolução honesta já aplicada ao "Probability Engine" (Phase Ω
// Priority 2) e registrada em CLAUDE.md.
//
// "Nunca utilizar textos longos": teto real de 3 mensagens por leitura,
// cada uma com poucas palavras — a priorização abaixo decide o que entra
// quando há mais de 3 verdades simultâneas para contar.
import type { CouncilDecision, CouncilStance } from "./council";
import type { ConvictionReading } from "./confluence-engine";
import type { InstitutionalScoreReading } from "./institutional-score";

export type AssistantTone = "POSITIVE" | "CAUTION" | "RISK" | "NEUTRAL";

export interface AssistantMessage {
  text: string; // frase curta real, PT-BR
  tone: AssistantTone;
  basis: string; // origem real verificável — nunca uma frase sem justificativa
}

export const ASSISTANT_MAX_MESSAGES = 3;

// Banda de "baixa confluência" — parâmetro documentado (não medição):
// abaixo de 40/100 a massa de opinião alinhada é minoritária de verdade.
export const LOW_CONFLUENCE_SCORE = 40;

export interface OperationAssistantInput {
  engineStatus: "pending" | "ok" | "error";
  coreDirection: "LONG" | "SHORT" | "WAIT" | null;
  structureLabel: string | null; // rótulo real do motor (ALTA/BAIXA/LATERAL)
  conviction: ConvictionReading | null;
  scoreReading: InstitutionalScoreReading | null;
  council: CouncilDecision | null;
  inEntryZone: boolean;
}

/** Postura real de um agente específico do Conselho (voto já computado —
 *  nunca recalculado aqui). null quando o agente absteve/não há conselho. */
function agentStance(council: CouncilDecision | null, agent: "LIQUIDITY" | "ORDERFLOW"): CouncilStance | null {
  const vote = council?.votes.find((v) => v.agent === agent);
  if (!vote || vote.stance === "ABSTAIN") return null;
  return vote.stance;
}

export function buildAssistantMessages(input: OperationAssistantInput): AssistantMessage[] {
  // Saúde primeiro: sem motor real, nenhuma outra frase é honesta.
  if (input.engineStatus === "pending") {
    return [{ text: "Aguardando dados reais", tone: "NEUTRAL", basis: "engineStatus=pending (primeiro ciclo real ainda não concluiu)" }];
  }
  if (input.engineStatus === "error") {
    return [{ text: "Motor em falha", tone: "RISK", basis: "engineStatus=error (último ciclo real falhou)" }];
  }

  const out: AssistantMessage[] = [];
  const direction = input.coreDirection === "LONG" || input.coreDirection === "SHORT" ? input.coreDirection : null;
  const verdict = input.conviction?.status === "OK" ? input.conviction.verdict : null;

  // 1. Risco travado (RiskAgent, fail-closed) — a verdade mais urgente.
  if (input.council?.riskGated) {
    out.push({ text: "Risco elevado", tone: "RISK", basis: "RiskAgent absteve — conselho travado (dados degradados/offline)" });
  }

  // 2. A leitura direcional — sempre espelho do Core Engine, nunca opinião própria.
  if (direction === null) {
    if (input.structureLabel === "LATERAL") {
      out.push({ text: "Mercado lateral", tone: "NEUTRAL", basis: "estrutura real LATERAL (market-structure-engine) + Core Engine em WAIT" });
    } else {
      out.push({ text: "Aguarde confirmação", tone: "NEUTRAL", basis: "Core Engine em WAIT — sem direção real confirmada" });
    }
  } else {
    const isLong = direction === "LONG";
    if (verdict === "CONFIRMS") {
      out.push({ text: isLong ? "Compra favorecida" : "Venda favorecida", tone: "POSITIVE", basis: `Core Engine ${direction} + confluência real CONFIRMS (${input.conviction!.agreeingCount}/${input.conviction!.totalReadable} subsistemas)` });
    } else if (verdict === "CONTRADICTS") {
      out.push({ text: isLong ? "Compra perde força" : "Venda perde força", tone: "CAUTION", basis: `Core Engine ${direction}, mas confluência real CONTRADICTS` });
    } else if (verdict === "MIXED") {
      out.push({ text: "Confluência dividida", tone: "CAUTION", basis: `Core Engine ${direction}, subsistemas divididos (MIXED)` });
    } else {
      out.push({ text: isLong ? "Compra sinalizada" : "Venda sinalizada", tone: "NEUTRAL", basis: `Core Engine ${direction} — confluência real ainda indisponível nesta janela` });
    }
  }

  // 3. Score real (confluência 0-100, nunca probabilidade — ver cabeçalho).
  const score = input.scoreReading?.status === "OK" ? input.scoreReading.score : null;
  if (score !== null && input.scoreReading!.opportunity) {
    out.push({ text: "Alta confluência", tone: "POSITIVE", basis: `Score real ${score}/100 ≥ nível mínimo (massa de opinião, nunca probabilidade)` });
  } else if (score !== null && score < LOW_CONFLUENCE_SCORE) {
    out.push({ text: "Baixa confluência", tone: "CAUTION", basis: `Score real ${score}/100 < ${LOW_CONFLUENCE_SCORE} (massa de opinião, nunca probabilidade)` });
  }

  // 4. Liquidez real (voto já computado do LiquidityAgent — LONG = mais
  // pools intactos ACIMA do preço, leitura clássica de draw on liquidity).
  const liquidity = agentStance(input.council ?? null, "LIQUIDITY");
  if (liquidity === "LONG") {
    out.push({ text: "Liquidez acima", tone: "NEUTRAL", basis: "LiquidityAgent: mais EQH intactos acima do preço real" });
  } else if (liquidity === "SHORT") {
    out.push({ text: "Liquidez abaixo", tone: "NEUTRAL", basis: "LiquidityAgent: mais EQL intactos abaixo do preço real" });
  }

  // 5. Fluxo real (voto já computado do OrderflowAgent sobre o CVD real).
  const flow = agentStance(input.council ?? null, "ORDERFLOW");
  if (flow === "LONG") {
    out.push({ text: "Fluxo comprador", tone: "NEUTRAL", basis: "OrderflowAgent: CVD real positivo (MEXC Spot)" });
  } else if (flow === "SHORT") {
    out.push({ text: "Fluxo vendedor", tone: "NEUTRAL", basis: "OrderflowAgent: CVD real negativo (MEXC Spot)" });
  }

  // 6. Zona de entrada real do plano ativo (mesmo boolean com histerese
  // já usado pela voz — nunca um segundo cálculo).
  if (input.inEntryZone) {
    out.push({ text: "Preço na zona de entrada", tone: "POSITIVE", basis: "preço real dentro da entry zone do Trade Plan ativo (com histerese)" });
  }

  return out.slice(0, ASSISTANT_MAX_MESSAGES);
}
