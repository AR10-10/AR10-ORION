// calibration-freshness.ts — A IDADE DA AMOSTRA QUE PRODUZ A PROBABILIDADE.
//
// ── O DEFEITO REAL, MEDIDO (caça a defeitos, ordem "EVOLUÇÃO COMPLETA") ──
// `simulateTradeCosts()` (trade-simulation.ts) LIA `tracked.resolvedAt` para
// calcular `holdingMs` e descartava o instante absoluto na mesma linha.
// Consequência: `TradeCostResult` sabia QUANTO TEMPO cada trade durou, mas
// não QUANDO ele aconteceu — e nada a jusante conseguia perguntar que idade
// tem a amostra.
//
// O que isso permitia na tela: a "Prob. Calibrada" (platt-calibration.ts)
// aparecia com a MESMA autoridade visual tendo sido treinada em 40 trades
// resolvidos há três meses, num regime de mercado completamente diferente,
// ou em 40 trades da semana passada. O Operador não tinha como distinguir.
//
// É a mesma classe de achado já corrigida em `computeLevelStrength()`
// (support-resistance-engine.js, PR #37): o dado sempre esteve lá e morria
// na fronteira.
//
// ── A REGRA, E POR QUE ELA NÃO INVENTA NENHUM NÚMERO ────────────────────
// A pergunta "quando uma calibração fica velha?" não tem resposta universal,
// e este projeto proíbe fabricar um limiar (CLAUDE.md, Regra de Ouro 2/3).
// Então a regra aqui é AUTO-REFERENTE — ela sai da própria amostra:
//
//     ESTÁ EXTRAPOLANDO quando  (agora − trade mais novo)  >  (trade mais
//     novo − trade mais antigo)
//
// Em palavras: se a sua amostra cobre 30 dias de histórico e o trade mais
// recente dela tem 60 dias, você está projetando para frente MAIS do que
// mediu para trás. Isso não precisa de constante nenhuma — é uma comparação
// entre duas medições reais da mesma amostra.
//
// Precedente de forma: `chart-integrity.ts` já decidiu que frescor se mede
// em MÚLTIPLOS de uma referência real ("o limiar precisa ser múltiplo do
// intervalo real do timeframe... nunca um número fixo em ms que só faria
// sentido para 1 prazo entre os 14 aceitos"). Aqui a referência é o próprio
// alcance da amostra, em vez do intervalo da barra — mesma disciplina.
//
// A idade também é reportada em BARRAS do timeframe selecionado, porque é
// nessa unidade que o Operador pensa: "300 barras atrás" diz mais que
// "18 dias" quando o gráfico é de 5m.
//
// LEI 24: mede a qualidade de uma leitura existente. Zero direção, zero
// decisão, e NUNCA esconde a probabilidade — só a qualifica.
import { TIMEFRAME_MS } from "./aura-lifecycle";
import type { TradeCostResult } from "./trade-simulation";

export type CalibrationFreshnessStatus =
  /** Amostra sem 2 trades resolvidos: não há alcance para comparar. */
  | "DADOS_INSUFICIENTES"
  /** A lacuna desde o último trade cabe dentro do alcance medido. */
  | "DENTRO_DO_MEDIDO"
  /** A lacuna JÁ passou do alcance medido — projeção além da evidência. */
  | "EXTRAPOLANDO";

export interface CalibrationFreshness {
  status: CalibrationFreshnessStatus;
  /** Sempre presente em DADOS_INSUFICIENTES; null nos demais. */
  reason: string | null;
  /** Trades resolvidos com instante real utilizável. */
  sampleSize: number;
  /** ms desde o trade mais RECENTE da amostra. */
  ageMs: number | null;
  /** ms entre o trade mais antigo e o mais recente — o alcance medido. */
  spanMs: number | null;
  /** `ageMs` em barras do timeframe. null sem timeframe conhecido. */
  ageBars: number | null;
  /** `spanMs` em barras do timeframe. null sem timeframe conhecido. */
  spanBars: number | null;
}

const INSUFICIENTE = (sampleSize: number, reason: string): CalibrationFreshness => ({
  status: "DADOS_INSUFICIENTES",
  reason,
  sampleSize,
  ageMs: null,
  spanMs: null,
  ageBars: null,
  spanBars: null,
});

/**
 * Mede a idade da amostra que produz a probabilidade calibrada.
 *
 * Função PURA: `now` e `timeframe` entram por parâmetro (zero `Date.now()`
 * interno — mesma disciplina de self-diagnostics.ts, "nenhum relógio além
 * de generatedAt").
 *
 * @param results  os MESMOS TradeCostResult que alimentam a calibração
 * @param now      instante de referência (epoch ms)
 * @param timeframe timeframe selecionado, para converter em barras
 */
export function measureCalibrationFreshness(
  results: readonly TradeCostResult[] | null | undefined,
  now: number,
  timeframe: string | null | undefined,
): CalibrationFreshness {
  const all = Array.isArray(results) ? results : [];
  // Só instantes reais. Registros anteriores a esta rodada não têm
  // `resolvedAt` — e ausência NUNCA vira 0 (isso dataria o trade em 1970 e
  // inflaria o alcance da amostra em 56 anos).
  const instantes = all
    .map((r) => r?.resolvedAt)
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t > 0);

  if (!Number.isFinite(now)) return INSUFICIENTE(instantes.length, "instante de referência inválido");
  if (instantes.length < 2) {
    return INSUFICIENTE(
      instantes.length,
      `Só ${instantes.length} trade(s) resolvido(s) com instante real — são necessários 2 para medir o alcance da amostra.`,
    );
  }

  const maisNovo = Math.max(...instantes);
  const maisAntigo = Math.min(...instantes);
  const spanMs = maisNovo - maisAntigo;
  // Amostra inteira no futuro em relação a `now` (relógio trocado, registro
  // corrompido): não dá para medir idade honestamente.
  const ageMs = now - maisNovo;
  if (ageMs < 0) {
    return INSUFICIENTE(instantes.length, "trade mais recente está no futuro em relação ao instante de referência");
  }
  // Todos os trades no MESMO instante: alcance zero, nada para comparar —
  // qualquer idade > 0 "excederia" um alcance de 0, o que seria um veredito
  // fabricado a partir de uma amostra degenerada.
  if (spanMs === 0) {
    return INSUFICIENTE(instantes.length, "todos os trades resolveram no mesmo instante — a amostra não tem alcance temporal");
  }

  const barMs = timeframe ? (TIMEFRAME_MS[timeframe] ?? null) : null;

  return {
    status: ageMs > spanMs ? "EXTRAPOLANDO" : "DENTRO_DO_MEDIDO",
    reason: null,
    sampleSize: instantes.length,
    ageMs,
    spanMs,
    ageBars: barMs !== null && barMs > 0 ? Math.floor(ageMs / barMs) : null,
    spanBars: barMs !== null && barMs > 0 ? Math.floor(spanMs / barMs) : null,
  };
}

/** Frase curta para a UI. Nunca inventa número: quando não há medição,
 *  devolve o motivo real. */
export function describeCalibrationFreshness(f: CalibrationFreshness): string {
  if (f.status === "DADOS_INSUFICIENTES") return f.reason ?? "sem medição de frescor";
  const idade = f.ageBars !== null ? `${f.ageBars} barras` : `${Math.round(f.ageMs! / 86_400_000)} dias`;
  const alcance = f.spanBars !== null ? `${f.spanBars} barras` : `${Math.round(f.spanMs! / 86_400_000)} dias`;
  return f.status === "EXTRAPOLANDO"
    ? `amostra parou há ${idade}, mas cobre só ${alcance} — projetando além do que foi medido`
    : `amostra parou há ${idade}, dentro do alcance medido de ${alcance}`;
}
