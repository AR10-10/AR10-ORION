// mexc-symbols.ts — ADITIVO V-MAX Etapa 9 (Radar Global/OIH: "monitorar
// continuamente todos os ativos públicos da MEXC", dependente da Etapa 1
// Market Data Adapter já concluída). Irmão direto de binance-symbols.ts —
// mesma disciplina: extração PURA e testável sem rede; só fetchMexc*
// toca a rede, fail-closed ([] honesto, nunca uma lista velha/fabricada).
//
// Endpoint real: GET https://api.mexc.com/api/v1/contract/detail (público,
// sem chave — mesmo host já vetted por cross-exchange/mexc-futures.ts
// nesta mesma sessão). Resposta { success, code, data: [...] } — `data` é
// um ARRAY de contratos (diferente do objeto-de-arrays-paralelos dos
// klines, ver mexc-futures-public.js), cada um com symbol ("BTC_USDT"),
// baseCoin, quoteCoin, settleCoin, apiAllowed, isHidden (corroborado por
// múltiplas fontes secundárias — mesma ressalva de honestidade de
// mexc-futures-public.js: doc oficial bloqueada nesta sessão, HTTP 403).
//
// Honestidade sobre o filtro de "ativo agora": ao contrário da Binance
// (campo `status === "TRADING"` bem documentado e já usado em
// binance-symbols.ts), não há confirmação de mesma confiança para um
// campo de estado equivalente da MEXC — em vez de adivinhar um valor de
// enum não confirmado (arriscando um fail-closed silencioso que exclui
// tudo por engano), o filtro usa só os 2 campos reais que TÊM
// corroboração razoável (`isHidden`/`apiAllowed`), documentado aqui como
// limitação honesta, não uma garantia equivalente à da Binance.
export interface MexcUsdtSymbol {
  symbol: string; // par completo como a API devolve, ex. "BTC_USDT"
  baseAsset: string;
}

const CONTRACT_DETAIL_URL = "https://api.mexc.com/api/v1/contract/detail";

/** Extrai os contratos USDT-M perpétuos reais e negociáveis do payload
 *  bruto de /api/v1/contract/detail. Função pura — testável sem rede. */
export function extractMexcUsdtSymbols(json: any): MexcUsdtSymbol[] {
  if (!json || json.success !== true) return [];
  const rows = json.data;
  if (!Array.isArray(rows)) return [];
  const out: MexcUsdtSymbol[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    if (typeof row.symbol !== "string" || typeof row.baseCoin !== "string") continue;
    if ((row.settleCoin ?? row.quoteCoin) !== "USDT") continue;
    if (row.isHidden === true) continue;
    if (row.apiAllowed === false) continue;
    out.push({ symbol: row.symbol, baseAsset: row.baseCoin });
  }
  return out;
}

/** Busca real — toda a lógica testável vive em extractMexcUsdtSymbols.
 *  Fail-closed: qualquer erro de rede/HTTP/parse devolve [] (nunca uma
 *  exceção não tratada, nunca uma lista velha). */
export async function fetchMexcUsdtSymbols(): Promise<MexcUsdtSymbol[]> {
  try {
    const res = await fetch(CONTRACT_DETAIL_URL);
    if (!res.ok) return [];
    const json = await res.json();
    return extractMexcUsdtSymbols(json);
  } catch {
    return [];
  }
}
