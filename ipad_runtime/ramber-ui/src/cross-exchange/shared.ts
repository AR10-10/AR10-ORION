// shared.ts — tipos e lógica de comparação genéricos, compartilhados por
// qualquer conector de cross-exchange (Bybit, OKX, e futuras fontes).
// Extraído de bybit-futures.ts quando a OKX se tornou o segundo
// consumidor real da mesma comparação markPrice-vs-markPrice — Zero
// Repetição: a mesma trava de divergência e o mesmo formato de
// resultado servem qualquer fonte adicional, sem duplicar o limiar (ou
// deixá-lo divergir silenciosamente) em dois arquivos.
const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export interface PerpTicker {
  ok: boolean;
  price: number | null;
  fundingRate: number | null;
  openInterest: number | null;
}

export type CrossExchangeConsensus = "ALINHADO" | "DIVERGENTE" | "INDISPONIVEL";

export interface CrossExchangeCheck {
  ok: boolean;
  priceDeltaPct: number | null;
  consensus: CrossExchangeConsensus;
}

// Limiar de divergência: preços de derivativos entre exchanges líquidas
// tipicamente ficam dentro de poucos bps um do outro; 0.5% é uma folga
// generosa que só dispara DIVERGENTE numa discrepância real (ex.: uma das
// fontes com dado atrasado/quebrado), não ruído normal de order book.
export const DIVERGENCE_THRESHOLD_PCT = 0.5;

/** Compara o preço real da Binance Futures (App.tsx's derivatives/priceData)
 *  contra o preço real de uma fonte adicional (Bybit, OKX, ...) — função
 *  pura, testável sem rede. Nunca decide sinal/direção: é só um alerta de
 *  consistência entre fontes, puramente informativo (mesmo princípio
 *  consultivo do GMIL). */
export function compareCrossExchange(binancePrice: number | null, other: PerpTicker): CrossExchangeCheck {
  if (!isFiniteNum(binancePrice) || !other.ok || !isFiniteNum(other.price)) {
    return { ok: false, priceDeltaPct: null, consensus: "INDISPONIVEL" };
  }
  const deltaPct = (Math.abs(other.price - binancePrice) / binancePrice) * 100;
  return {
    ok: true,
    priceDeltaPct: deltaPct,
    consensus: deltaPct <= DIVERGENCE_THRESHOLD_PCT ? "ALINHADO" : "DIVERGENTE",
  };
}
