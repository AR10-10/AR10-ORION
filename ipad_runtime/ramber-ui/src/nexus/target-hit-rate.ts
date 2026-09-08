// target-hit-rate.ts — TAXA REAL DE ACERTO POR ALVO (TP1 / TP2 / TP3).
//
// Item aberto da §2 da ordem "EVOLUÇÃO COMPLETA" (§49 do mapa §39-§60).
//
// ── A PERGUNTA QUE FALTAVA ─────────────────────────────────────────────
// O Track Record já dizia quantos planos bateram alvo (`targetHits`),
// quantos foram parciais e quantos stoparam. O que ele NUNCA disse é o que
// o Operador realmente quer saber antes de dimensionar uma saída:
//
//     "dos planos que abriram, quantos chegaram no TP1? e no TP2? e no TP3?"
//
// Sem isso, um TP3 que quase nunca é alcançado tem a mesma aparência de um
// TP1 que quase sempre é — e a escada de alvos parece uniforme quando
// quase nunca é.
//
// ── O DENOMINADOR É ONDE ESTÁ A HONESTIDADE ────────────────────────────
// A conta ingênua (acertos do TP3 ÷ todos os planos) é ERRADA, e erra
// sempre para o mesmo lado: um plano que só tinha 2 alvos NUNCA poderia
// alcançar o TP3, e incluí-lo no denominador afundaria a taxa do TP3 com
// planos que jamais a ofereceram.
//
// Então o denominador de cada alvo é: planos resolvidos que REALMENTE
// TINHAM aquele alvo (`plan.targets.length > i`). É a única leitura que
// responde "quando o sistema propôs este alvo, com que frequência ele
// chegou lá?" — que é a pergunta real.
//
// ── REGRA DE OURO 2 ────────────────────────────────────────────────────
// Isto é FREQUÊNCIA OBSERVADA sobre o histórico já resolvido, com o
// tamanho da amostra sempre junto do número. NÃO é probabilidade de o
// próximo trade alcançar o alvo, e o módulo nunca a apresenta como tal —
// pelo mesmo motivo de sempre: sem validação fora-da-amostra, frequência
// passada não é previsão. Quem quiser essa afirmação usa
// walk-forward-calibration.ts, que existe justamente para isso.
//
// LEI 24: leitura de histórico. Zero direção, zero decisão.
import type { TrackedPlan } from "./signal-track-record";
// O teto de alvos NÃO se redeclara aqui: MAX_TARGETS já é a convenção
// declarada do Trade Plan ("three is the real ceiling this repo's
// structural engines can honestly support without inventing projected
// levels"). Uma constante paralela sairia de sincronia no dia em que o
// plano ganhasse um quarto alvo, e a tabela silenciosamente pararia de
// mostrá-lo.
import { MAX_TARGETS } from "./trade-plan";

export interface TargetHitRate {
  /** 1-based: 1 = TP1. */
  target: number;
  /** Planos resolvidos que REALMENTE tinham este alvo. */
  offered: number;
  /** Desses, quantos o alcançaram. */
  reached: number;
  /** reached/offered, ou null quando o alvo nunca foi oferecido —
   *  nunca 0, que se leria como "nunca chega" em vez de "nunca propôs". */
  rate: number | null;
}

export interface TargetHitRateReport {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  /** Planos resolvidos considerados (TARGET_HIT/PARTIAL_HIT/STOP_HIT). */
  resolvedPlans: number;
  rates: TargetHitRate[];
}

const VAZIO = (resolvedPlans: number, reason: string): TargetHitRateReport => ({
  status: "DADOS_INSUFICIENTES",
  reason,
  resolvedPlans,
  rates: [],
});

/**
 * Frequência real com que cada alvo foi alcançado, entre os planos que o
 * OFERECERAM. Função pura.
 *
 * @param history planos rastreados (resolvidos e não-resolvidos; os
 *   não-resolvidos são descartados aqui, mesma regra de hitRate())
 */
export function computeTargetHitRates(
  history: readonly TrackedPlan[] | null | undefined,
): TargetHitRateReport {
  const todos = Array.isArray(history) ? history : [];
  // Mesma definição de "trade real" já usada por simulateTradeCosts() e
  // hitRate(): OPEN/REPLACED nunca contam.
  const resolvidos = todos.filter(
    (p) =>
      p &&
      (p.status === "TARGET_HIT" || p.status === "PARTIAL_HIT" || p.status === "STOP_HIT") &&
      Array.isArray(p.plan?.targets) &&
      Number.isFinite(p.targetsHit),
  );

  if (resolvidos.length === 0) {
    return VAZIO(0, "Nenhum plano resolvido ainda — sem histórico para medir alcance por alvo.");
  }

  const rates: TargetHitRate[] = [];
  for (let i = 0; i < MAX_TARGETS; i++) {
    // AQUI está a honestidade: só entram no denominador os planos que
    // REALMENTE tinham este alvo. Um plano de 2 alvos jamais poderia
    // alcançar o TP3, e contá-lo afundaria a taxa com planos que nunca a
    // ofereceram.
    const oferecidos = resolvidos.filter((p) => p.plan.targets.length > i);
    // `targetsHit` conta alvos PROVADOS, então "alcançou o alvo i" (0-based)
    // é targetsHit > i.
    const alcancados = oferecidos.filter((p) => p.targetsHit > i);
    rates.push({
      target: i + 1,
      offered: oferecidos.length,
      reached: alcancados.length,
      rate: oferecidos.length > 0 ? alcancados.length / oferecidos.length : null,
    });
  }

  return { status: "OK", reason: null, resolvedPlans: resolvidos.length, rates };
}

/** Linha curta para a UI: "TP1 8/10 · TP2 3/10 · TP3 0/4". Só alvos que
 *  foram realmente oferecidos aparecem — um alvo nunca proposto não vira
 *  "0%", que se leria como fracasso em vez de ausência. */
export function describeTargetHitRates(report: TargetHitRateReport): string {
  if (report.status !== "OK") return report.reason ?? "sem histórico por alvo";
  const partes = report.rates
    .filter((r) => r.offered > 0)
    .map((r) => `TP${r.target} ${r.reached}/${r.offered}`);
  return partes.length > 0 ? partes.join(" · ") : "nenhum alvo proposto no histórico resolvido";
}
