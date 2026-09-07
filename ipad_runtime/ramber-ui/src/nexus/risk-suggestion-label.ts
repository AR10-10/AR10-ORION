// risk-suggestion-label.ts — Frente 3 §3 (auditoria de duplicidade): formata
// o selo curto "TAMANHO SUGERIDO" (Risk Engine) a partir de um RiskSuggestion
// real, já computado UMA vez (App.tsx, buildRiskSuggestion) e compartilhado
// via WidgetContext.
//
// ACHADO REAL (auditoria Council×Validação Multi-Camada×Market Intelligence,
// investigando a reclamação do Operador de "métricas repetidas"): a maioria
// da suspeita não se confirmou (painéis mostram dado real distinto), mas
// esta formatação — literalmente as mesmas 2 linhas — estava redigitada em
// MarketBiasDecisionCard e DecisionValidationWidget (App.tsx). Zero cálculo
// duplicado (riskSuggestion já era uma fonte única), mas duas cópias
// idênticas do MESMO texto formatado, que divergiriam silenciosamente se
// alguém editasse uma cópia sem lembrar da outra.
import type { RiskSuggestion } from "../engine-bridge";

/** "0% · sem sugestão" nunca é um "0%" fabricado escondendo um motivo real —
 *  o motivo (riskSuggestion.reason) sempre continua disponível a quem chama,
 *  via humanizeReasonCode(), para o tooltip. Este helper só formata o texto
 *  curto do selo, nunca decide o que fazer com o motivo. */
export function formatRiskSuggestionLabel(riskSuggestion: RiskSuggestion | null | undefined): string {
  if (riskSuggestion?.status !== "OK") return "0% · sem sugestão";
  return `${riskSuggestion.suggested_position_pct.toFixed(1)}% eq · risk ${riskSuggestion.effective_risk_pct.toFixed(2)}%`;
}
