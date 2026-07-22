// mexc-futures.ts — EPC FINAL §27 ("MEXC como fonte pública... suporte
// completo"), respondida pelo Operador (AskUserQuestion): MEXC continua
// SECUNDÁRIA/cross-check — a Binance segue a única fonte real do ciclo de
// decisão do Core Engine (trava documentada em CLAUDE.md/Fase G/Diretriz
// 2, intacta) — mas ganha Futures completo (antes só Spot, via
// mexc-spot.ts). Mesmo padrão real de bybit-futures.ts/okx-futures.ts:
// 4ª fonte de cross-check independente, comparada só contra o markPrice
// que a Binance já devolve (fetchDerivatives) — nunca gera sinal, nunca
// gate o Core Engine (mesmo princípio consultivo do GMIL/Bybit/OKX).
//
// Fail-closed: qualquer falha de rede/HTTP/schema devolve ok:false
// honesto — o cross-check mostra INDISPONÍVEL, os dados da Binance/Bybit/
// OKX continuam normais (MEXC nunca bloqueia nem atrasa o caminho
// principal nem os outros cross-checks — todos buscados em paralelo).
//
// Endpoint real: GET /api/v1/contract/funding_rate/{symbol} (API pública
// MEXC Contract v1, símbolo formato BTC_USDT — convenção real de
// derivativos MEXC, diferente do BTCUSDT do Spot). Escolhido em vez de
// /api/v1/contract/ticker (que também existe e tem lastPrice+holdVol)
// porque fairPrice é o preço MARK — o mesmo TIPO de preço que
// Bybit/OKX/Binance já comparam entre si aqui (maçã com maçã, evita um
// DIVERGENTE falso por ruído de last-trade). holdVol (open interest) fica
// de propósito fora desta 1ª integração: exigiria uma 2ª chamada de rede
// só pra preencher um campo que hoje nenhum consumidor exibe — mesmo
// raciocínio já documentado em okx-futures.ts para fundingRate/
// openInterest de OKX. fundingRate É mantido (vem de graça na mesma
// chamada, zero custo extra).
//
// Honestidade de plataforma: os nomes de campo (data.fairPrice/
// data.fundingRate) seguem o exemplo real de resposta documentado
// publicamente pela MEXC (api-docs/futures/market-endpoints/get-funding-
// rate) — este conector NÃO foi verificado ao vivo nesta sessão (sandbox
// sem saída de rede para exchanges — mesma limitação já documentada em
// mexc-spot.ts/mexc-trades-stream.js/bybit-futures.ts/okx-futures.ts). Se
// o schema real vier diferente do esperado, extractMexcFuturesPerpTicker
// devolve ok:false honesto (nunca um valor inventado), nunca lança.
import { type PerpTicker, compareCrossExchange, type CrossExchangeCheck, DIVERGENCE_THRESHOLD_PCT } from "./shared";

const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const MEXC_FUNDING_RATE_URL = "https://api.mexc.com/api/v1/contract/funding_rate/";

export type MexcFuturesPerpTicker = PerpTicker;

/** Extrai fairPrice (mark price real) + fundingRate do payload bruto de
 *  GET /api/v1/contract/funding_rate/{symbol}. Função pura — testável sem
 *  rede. openInterest fica sempre null nesta integração (ver header). */
export function extractMexcFuturesPerpTicker(json: any): MexcFuturesPerpTicker {
  const row = json?.data;
  if (!row || typeof row !== "object") return { ok: false, price: null, fundingRate: null, openInterest: null };
  const price = Number(row.fairPrice);
  if (!isFiniteNum(price)) return { ok: false, price: null, fundingRate: null, openInterest: null };
  const fundingRate = Number(row.fundingRate);
  return {
    ok: true,
    price,
    fundingRate: isFiniteNum(fundingRate) ? fundingRate : null,
    openInterest: null,
  };
}

/** Símbolo MEXC Futures real: formato BTC_USDT (underscore), diferente do
 *  BTCUSDT do Spot (mexc-spot.ts) — convenção documentada da API Contract
 *  v1, nunca inferida. */
function toMexcFuturesSymbol(symbol: string): string {
  return `${symbol}_USDT`;
}

/** Busca real — deliberadamente fina: toda a lógica testável vive em
 *  extractMexcFuturesPerpTicker. Fail-closed: qualquer erro de rede/HTTP/
 *  parse devolve ok:false, nunca uma exceção não tratada nem um valor
 *  inventado. */
export async function fetchMexcFuturesPerpTicker(symbol: string): Promise<MexcFuturesPerpTicker> {
  try {
    const res = await fetch(`${MEXC_FUNDING_RATE_URL}${encodeURIComponent(toMexcFuturesSymbol(symbol))}`);
    if (!res.ok) return { ok: false, price: null, fundingRate: null, openInterest: null };
    const json = await res.json();
    return extractMexcFuturesPerpTicker(json);
  } catch {
    return { ok: false, price: null, fundingRate: null, openInterest: null };
  }
}

export { compareCrossExchange, DIVERGENCE_THRESHOLD_PCT, type CrossExchangeCheck };
