// premium-discount.ts — Refinamento Final §7 (Premium / Equilibrium /
// Discount zones).
//
// Conceito real (ICT/Smart Money): o "dealing range" atual é o intervalo
// entre o último swing high confirmado e o último swing low confirmado;
// acima do ponto médio (equilibrium, o retracement de 50%) o preço está
// "caro" (Premium — zona de interesse de venda institucional), abaixo está
// "barato" (Discount — zona de interesse de compra). Comprar em Discount /
// vender em Premium é o uso clássico; aqui é CONTEXTO display-only
// integrado ao Trade Plan (LEI 24: nunca gera segunda decisão, nunca
// bloqueia o Core Engine).
//
// Honestidade:
//   - Swings vêm do MESMO findSwings compartilhado (fractal-swings.js) que
//     os motores graduados usam — nunca uma segunda detecção de swing
//     (regra permanente do CLAUDE.md).
//   - Fail-closed: sem dois swings confirmados opostos e finitos (ou range
//     degenerado high<=low), devolve null — nunca um range fabricado.
//   - pricePositionPct é o valor CRU (pode ser <0 ou >100 quando o preço
//     rompeu o range) — clamp esconderia um rompimento real.
//   - Banda de equilíbrio: ±equilibriumBandPct pontos percentuais ao redor
//     de 50% (padrão 5 ⇒ 45–55% = EQUILIBRIUM) — parâmetro documentado,
//     não um número mágico enterrado.
//   - Pura: mesmos candles + preço ⇒ mesma leitura; zero rede/estado.
import { findSwings, FRACTAL_K } from "../../../src/research/engines/fractal-swings.js";

export const PREMIUM_DISCOUNT_CONTRACT_VERSION = 1 as const;

export type PremiumDiscountZone = "PREMIUM" | "EQUILIBRIUM" | "DISCOUNT";

export interface PremiumDiscountReading {
  contractVersion: typeof PREMIUM_DISCOUNT_CONTRACT_VERSION;
  rangeHigh: { price: number; index: number };
  rangeLow: { price: number; index: number };
  equilibrium: number;
  zone: PremiumDiscountZone;
  // 0 = exatamente no range low, 100 = exatamente no range high; cru,
  // deliberadamente sem clamp (ver cabeçalho).
  pricePositionPct: number;
  basis: "LAST_CONFIRMED_FRACTAL_SWINGS";
  computedAt: number;
}

export interface PremiumDiscountInputs {
  candles: Array<{ high?: number; low?: number; h?: number; l?: number }>;
  price: number | null;
  equilibriumBandPct?: number;
}

export function computePremiumDiscount(
  { candles, price, equilibriumBandPct = 5 }: PremiumDiscountInputs,
  computedAt: number = Date.now(),
): PremiumDiscountReading | null {
  if (!Array.isArray(candles) || candles.length < FRACTAL_K * 2 + 1) return null;
  if (typeof price !== "number" || !Number.isFinite(price)) return null;

  const highs = findSwings(candles, FRACTAL_K, true);
  const lows = findSwings(candles, FRACTAL_K, false);
  if (highs.length === 0 || lows.length === 0) return null;

  // Dealing range atual = último swing confirmado de cada lado.
  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];
  if (!Number.isFinite(lastHigh.price) || !Number.isFinite(lastLow.price)) return null;
  if (lastHigh.price <= lastLow.price) return null; // range degenerado/invertido => sem leitura honesta

  const span = lastHigh.price - lastLow.price;
  // Multiplica ANTES de dividir: ((p−low)/span)*100 acumula erro binário
  // ((1055−1000)/100)*100 = 55.000000000000014, o que empurrava um preço
  // EXATAMENTE na borda da banda para PREMIUM — bug real pego pelo teste
  // de borda. (p−low)*100/span devolve 55 exato para operandos exatos.
  const pct = ((price - lastLow.price) * 100) / span;
  const band = Math.max(0, equilibriumBandPct);
  const zone: PremiumDiscountZone = pct > 50 + band ? "PREMIUM" : pct < 50 - band ? "DISCOUNT" : "EQUILIBRIUM";

  return {
    contractVersion: PREMIUM_DISCOUNT_CONTRACT_VERSION,
    rangeHigh: { price: lastHigh.price, index: lastHigh.index },
    rangeLow: { price: lastLow.price, index: lastLow.index },
    equilibrium: lastLow.price + span / 2,
    zone,
    pricePositionPct: pct,
    basis: "LAST_CONFIRMED_FRACTAL_SWINGS",
    computedAt,
  };
}
