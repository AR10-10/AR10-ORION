// regime-secondary.ts — REGIME SECUNDÁRIO, MARGEM E TRANSIÇÃO (Phase C).
//
// ── O ACHADO ───────────────────────────────────────────────────────────
// `classifyMarketRegime` (market-regime/regime-engine.js) é uma cascata
// if/else **winner-take-all**: testa BREAKOUT, depois TENDENCIA_FORTE,
// depois COMPRESSAO, depois TENDENCIA_MODERADA, e devolve o PRIMEIRO que
// casar. Consequência real: quando ADX >= 30 **e** a banda está comprimida
// ao mesmo tempo, o motor reporta TENDENCIA_FORTE e a COMPRESSAO é
// descartada em silêncio — mesmo sendo igualmente verdadeira.
//
// E a evidência para reconstruir tudo isso **já vem de graça**: o próprio
// retorno carrega `adx`, `bandwidth_percentile`, `prev_bandwidth_percentile`
// e `close_position`. Mesma família dos achados anteriores (resolvedAt,
// contextAtOpen.score, absorptionState): o dado existe e morre na fronteira
// — aqui, na cascata que colapsa evidência rica num rótulo só.
//
// Fecha 3 dos 4 itens do §18 da MASTER ORDER: SECONDARY_REGIME,
// REGIME_CONFIDENCE e REGIME_TRANSITION (PRIMARY_REGIME já existia).
//
// ── ZERO LIMIAR NOVO ───────────────────────────────────────────────────
// ADX_STRONG (30), ADX_MODERATE (20) e SQUEEZE_PERCENTILE (0.25) são
// IMPORTADOS do motor que os declara. Redeclarar aqui criaria duas verdades
// que sairiam de sincronia no dia em que uma fosse ajustada, e a leitura
// secundária passaria a discordar do regime primário sem ninguém notar.
//
// ── "MARGEM", NUNCA "PROBABILIDADE" (Regra de Ouro 2) ──────────────────
// O §18 pede REGIME_CONFIDENCE. O que é honestamente calculável aqui é a
// MARGEM RELATIVA da métrica que decidiu, em relação ao próprio limiar que
// a decidiu: ADX 40 com piso 30 => (40-30)/30 = +0.33. Isso responde "por
// quanto ele ganhou?", que é a pergunta real — um ADX de 30.1 e um de 45
// produzem o MESMO rótulo, e a margem é o que os separa.
//
// Deliberadamente NÃO se chama `confidence` nem vira porcentagem: não é
// probabilidade de o regime estar certo, e nomear assim convidaria
// exatamente a leitura que a Regra de Ouro 2 proíbe.
//
// LEI 24: `primary` é passthrough LITERAL do motor — este módulo nunca o
// altera, nunca emite direção e nunca é lido por decisão nenhuma.
import {
  ADX_STRONG,
  ADX_MODERATE,
  SQUEEZE_PERCENTILE,
  // regime-engine.js é JS puro; o projeto resolve com allowJs, então o
  // import é direto — mesma fronteira que engine-bridge.ts já atravessa.
} from "../../../src/market-regime/regime-engine.js";

export interface RegimeEvidence {
  adx?: number | null;
  bandwidth_percentile?: number | null;
  prev_bandwidth_percentile?: number | null;
  close_position?: string | null;
}

export type RegimeTransition =
  | "COMPRIMINDO"
  | "EXPANDINDO"
  | "ESTAVEL"
  | "DESCONHECIDA";

export interface RegimeSecondaryReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  /** Passthrough LITERAL do motor. Nunca recalculado, nunca substituído. */
  primary: string | null;
  /** Regimes cuja condição também é verdadeira agora e que a cascata
   *  descartou. Vazio quando o primário é o único que casa. */
  secondary: string[];
  /** Margem relativa da métrica decisora ao próprio limiar. Positiva =
   *  ganhou com folga; perto de 0 = decidiu no fio. null quando o regime
   *  primário não é decidido por um limiar numérico. NUNCA é probabilidade. */
  marginToThreshold: number | null;
  /** Direção real da largura de banda entre a leitura anterior e a atual. */
  transition: RegimeTransition;
}

const INSUFICIENTE = (reason: string): RegimeSecondaryReading => ({
  status: "DADOS_INSUFICIENTES",
  reason,
  primary: null,
  secondary: [],
  marginToThreshold: null,
  transition: "DESCONHECIDA",
});

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Reconstrói o que a cascata descartou, a partir da evidência que o próprio
 * motor já devolve. Função pura.
 */
export function readRegimeSecondary(
  primary: string | null | undefined,
  evidence: RegimeEvidence | null | undefined,
): RegimeSecondaryReading {
  if (typeof primary !== "string" || primary.length === 0 || primary === "DADOS_INSUFICIENTES") {
    return INSUFICIENTE("Regime primário ausente ou insuficiente — nada a complementar.");
  }
  if (!evidence) {
    return INSUFICIENTE("Motor não devolveu evidência nesta leitura.");
  }

  const adx = num(evidence.adx) ? evidence.adx : null;
  const bw = num(evidence.bandwidth_percentile) ? evidence.bandwidth_percentile : null;
  const prevBw = num(evidence.prev_bandwidth_percentile) ? evidence.prev_bandwidth_percentile : null;

  // ── SECUNDÁRIOS: outras condições da cascata que TAMBÉM são verdadeiras.
  const secondary: string[] = [];
  const comprimido = bw !== null && bw <= SQUEEZE_PERCENTILE;
  const tendenciaForte = adx !== null && adx >= ADX_STRONG;
  const tendenciaModerada = adx !== null && adx >= ADX_MODERATE && adx < ADX_STRONG;

  if (comprimido && primary !== "COMPRESSAO") secondary.push("COMPRESSAO");
  if (tendenciaForte && primary !== "TENDENCIA_FORTE") secondary.push("TENDENCIA_FORTE");
  if (tendenciaModerada && primary !== "TENDENCIA_MODERADA") secondary.push("TENDENCIA_MODERADA");

  // ── MARGEM: distância relativa ao limiar que decidiu ESTE primário.
  // Só existe quando o primário é decidido por um limiar numérico — para
  // BREAKOUT (decidido por posição de fechamento, não por número) e
  // CONSOLIDACAO (o "nenhum dos outros", sem limiar próprio) devolve null
  // em vez de inventar uma régua.
  let marginToThreshold: number | null = null;
  if (primary === "TENDENCIA_FORTE" && adx !== null) {
    marginToThreshold = (adx - ADX_STRONG) / ADX_STRONG;
  } else if (primary === "TENDENCIA_MODERADA" && adx !== null) {
    marginToThreshold = (adx - ADX_MODERATE) / ADX_MODERATE;
  } else if (primary === "COMPRESSAO" && bw !== null && SQUEEZE_PERCENTILE > 0) {
    // Comprimido é "ficar ABAIXO do piso": quanto mais abaixo, maior a folga.
    marginToThreshold = (SQUEEZE_PERCENTILE - bw) / SQUEEZE_PERCENTILE;
  }

  // ── TRANSIÇÃO: a leitura anterior da largura de banda já vem no
  // evidence. Sem ela (primeiro ciclo) é DESCONHECIDA, nunca "ESTAVEL"
  // fabricado — ausência de histórico não é estabilidade observada.
  let transition: RegimeTransition = "DESCONHECIDA";
  if (bw !== null && prevBw !== null) {
    if (bw < prevBw) transition = "COMPRIMINDO";
    else if (bw > prevBw) transition = "EXPANDINDO";
    else transition = "ESTAVEL";
  }

  return { status: "OK", reason: null, primary, secondary, marginToThreshold, transition };
}

const TRANSITION_LABEL: Record<RegimeTransition, string> = {
  COMPRIMINDO: "comprimindo",
  EXPANDINDO: "expandindo",
  ESTAVEL: "estável",
  DESCONHECIDA: "sem histórico",
};

/** Linha curta para a UI. Só monta o que existe de verdade. */
export function describeRegimeSecondary(r: RegimeSecondaryReading): string {
  if (r.status !== "OK") return r.reason ?? "sem leitura secundária";
  const partes: string[] = [];
  if (r.secondary.length > 0) partes.push(`também ${r.secondary.join(" + ")}`);
  if (r.marginToThreshold !== null) {
    const sinal = r.marginToThreshold >= 0 ? "+" : "";
    partes.push(`margem ${sinal}${(r.marginToThreshold * 100).toFixed(0)}% do limiar`);
  }
  partes.push(TRANSITION_LABEL[r.transition]);
  return partes.join(" · ");
}
