// bybit-futures.ts — Master Panel handoff ("Multi-Source Market Data Fusion
// Engine"), escopo reduzido por decisão explícita do Operador: uma fonte
// adicional real ("Add 1-2 more first") para provar o padrão de cross-check
// entre exchanges, ANTES de qualquer expansão para as 9 corretoras do
// documento original. Bybit USDT-M Perpétuo (linear) é a segunda fonte real
// e independente, comparada só contra o preço da Binance Futures que
// App.tsx já busca (fetchDerivatives) — nunca substitui a Binance como
// fonte primária: essa trava (Fase G/Diretriz 2, gráfico e Risk Engine
// exclusivamente em Binance Futures) continua intocada. Puramente um
// segundo dado real, lado a lado, para o operador ver se as duas fontes
// concordam — nunca gera sinal, nunca gate o Core Engine (mesmo princípio
// consultivo do GMIL/Lorentziano).
//
// Fail-closed: qualquer falha de rede/HTTP/schema devolve ok:false honesto
// — o cross-check mostra INDISPONÍVEL, o dado da Binance continua normal
// (Bybit nunca bloqueia nem atrasa o caminho principal).
//
// Honestidade de plataforma: os nomes de campo (lastPrice/fundingRate/
// openInterest em result.list[0]) seguem a documentação pública estável da
// API v5 da Bybit; este conector NÃO foi re-verificado ao vivo nesta sessão
// de implementação (sandbox sem acesso de rede de saída — confirmado via
// CONNECT tunnel 403 para api.bybit.com, mesma limitação documentada em
// binance-futures-public.js). Se o schema real vier diferente do esperado,
// extractBybitPerpTicker devolve ok:false honesto (nunca um valor
// inventado), nunca lança exceção.
const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const BYBIT_TICKERS_URL = "https://api.bybit.com/v5/market/tickers?category=linear&symbol=";

export interface BybitPerpTicker {
  ok: boolean;
  price: number | null;
  fundingRate: number | null;
  openInterest: number | null;
}

/** Extrai os 3 campos reais do payload bruto de GET /v5/market/tickers
 *  (Bybit, category=linear). Função pura — testável sem rede. `price` vem
 *  de markPrice (não lastPrice): compara maçã com maçã contra a Binance,
 *  cujo /fapi/v1/premiumIndex também devolve markPrice — evita um
 *  "DIVERGENTE" falso que seria só ruído de last-trade entre as duas
 *  exchanges, não uma discrepância real de fonte. Preço é o único campo
 *  obrigatório para ok:true; funding/openInterest são melhor-esforço
 *  (ausentes/inválidos não derrubam o ticker inteiro). */
export function extractBybitPerpTicker(json: any): BybitPerpTicker {
  const row = json?.result?.list?.[0];
  if (!row || typeof row !== "object") return { ok: false, price: null, fundingRate: null, openInterest: null };
  const price = Number(row.markPrice);
  // ok:false é um estado tudo-ou-nada: sem preço válido não há nada para
  // comparar, então funding/openInterest também voltam null — nunca um
  // objeto parcialmente preenchido que um consumidor futuro possa ler sem
  // checar `ok` primeiro.
  if (!isFiniteNum(price)) return { ok: false, price: null, fundingRate: null, openInterest: null };
  const fundingRate = Number(row.fundingRate);
  const openInterest = Number(row.openInterest);
  return {
    ok: true,
    price,
    fundingRate: isFiniteNum(fundingRate) ? fundingRate : null,
    openInterest: isFiniteNum(openInterest) ? openInterest : null,
  };
}

/** Busca real — deliberadamente fina: toda a lógica testável vive em
 *  extractBybitPerpTicker. Fail-closed: qualquer erro de rede/HTTP/parse
 *  devolve ok:false, nunca uma exceção não tratada nem um valor inventado. */
export async function fetchBybitPerpTicker(symbol: string): Promise<BybitPerpTicker> {
  try {
    const res = await fetch(`${BYBIT_TICKERS_URL}${encodeURIComponent(symbol)}USDT`);
    if (!res.ok) return { ok: false, price: null, fundingRate: null, openInterest: null };
    const json = await res.json();
    return extractBybitPerpTicker(json);
  } catch {
    return { ok: false, price: null, fundingRate: null, openInterest: null };
  }
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
 *  contra o preço real do Bybit — função pura, testável sem rede. Nunca
 *  decide sinal/direção: é só um alerta de consistência entre fontes,
 *  puramente informativo (mesmo princípio consultivo do GMIL). */
export function compareCrossExchange(binancePrice: number | null, bybit: BybitPerpTicker): CrossExchangeCheck {
  if (!isFiniteNum(binancePrice) || !bybit.ok || !isFiniteNum(bybit.price)) {
    return { ok: false, priceDeltaPct: null, consensus: "INDISPONIVEL" };
  }
  const deltaPct = (Math.abs(bybit.price - binancePrice) / binancePrice) * 100;
  return {
    ok: true,
    priceDeltaPct: deltaPct,
    consensus: deltaPct <= DIVERGENCE_THRESHOLD_PCT ? "ALINHADO" : "DIVERGENTE",
  };
}
