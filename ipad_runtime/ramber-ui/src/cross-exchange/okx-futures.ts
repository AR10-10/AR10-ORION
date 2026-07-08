// okx-futures.ts — terceira fonte real de preço no Master Panel handoff
// ("Multi-Source Market Data Fusion Engine"), por pedido explícito do
// Operador: "puxa dados públicos de qualquer outra corretora... pra gente
// analisar também o mercado". OKX Perpétuo USDT-margined (SWAP) é a
// segunda fonte de cross-check independente (depois da Bybit), comparada
// só contra o markPrice que a Binance já devolve em fetchDerivatives —
// nunca substitui a Binance como fonte primária (trava da Fase G/Diretriz
// 2 continua intocada) e nunca gera sinal (mesmo princípio consultivo do
// GMIL/Bybit).
//
// Fail-closed: qualquer falha de rede/HTTP/schema devolve ok:false honesto
// — o cross-check mostra INDISPONÍVEL, os dados da Binance e da Bybit
// continuam normais (OKX nunca bloqueia nem atrasa o caminho principal
// nem o cross-check da Bybit — os dois são buscados em paralelo).
//
// Honestidade de plataforma: usa o endpoint público mark-price da API v5
// da OKX (GET /api/v5/public/mark-price?instType=SWAP), que devolve
// markPx — o mesmo TIPO de preço (mark, não last) que a Bybit usa aqui,
// para comparar maçã com maçã com o markPrice da Binance. Este conector
// NÃO foi verificado ao vivo nesta sessão de implementação (sandbox sem
// acesso de rede de saída — mesma limitação 403 já documentada para
// Binance/Bybit/MEXC). Uma pesquisa dedicada não encontrou nenhuma
// confirmação definitiva (nem positiva nem negativa) de suporte a CORS
// da OKX a partir de um navegador — só um sinal indireto fraco (uso
// relatado em outro widget client-side sem backend). Se o CORS falhar em
// produção, extractOkxPerpTicker/fetchOkxPerpTicker devolvem ok:false
// honesto pelo mesmo caminho fail-closed de qualquer outra falha de rede
// — nunca uma exceção não tratada nem um valor inventado.
//
// fundingRate/openInterest ficam sempre null de propósito: nenhum
// consumidor hoje lê esses dois campos (nem os da própria Bybit, que já
// os busca e também não são exibidos em lugar nenhum) — não faz sentido
// chamar os endpoints extras da OKX (funding-rate, open-interest) só para
// preencher um campo que nada exibe.
import { type PerpTicker } from "./shared";

const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const OKX_MARK_PRICE_URL = "https://www.okx.com/api/v5/public/mark-price?instType=SWAP&instId=";

export type OkxPerpTicker = PerpTicker;

/** Extrai markPx do payload bruto de GET /api/v5/public/mark-price (OKX
 *  v5, instType=SWAP). Função pura — testável sem rede. */
export function extractOkxPerpTicker(json: any): OkxPerpTicker {
  const row = json?.data?.[0];
  if (!row || typeof row !== "object") return { ok: false, price: null, fundingRate: null, openInterest: null };
  const price = Number(row.markPx);
  if (!isFiniteNum(price)) return { ok: false, price: null, fundingRate: null, openInterest: null };
  return { ok: true, price, fundingRate: null, openInterest: null };
}

/** Busca real — deliberadamente fina, mesmo padrão de fetchBybitPerpTicker:
 *  toda a lógica testável vive em extractOkxPerpTicker. Fail-closed:
 *  qualquer erro de rede/HTTP/parse devolve ok:false, nunca uma exceção
 *  não tratada nem um valor inventado. */
export async function fetchOkxPerpTicker(symbol: string): Promise<OkxPerpTicker> {
  try {
    const res = await fetch(`${OKX_MARK_PRICE_URL}${encodeURIComponent(symbol)}-USDT-SWAP`);
    if (!res.ok) return { ok: false, price: null, fundingRate: null, openInterest: null };
    const json = await res.json();
    return extractOkxPerpTicker(json);
  } catch {
    return { ok: false, price: null, fundingRate: null, openInterest: null };
  }
}
