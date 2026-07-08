// binance-symbols.ts — Overhaul Cross-Market (Missão 2, diretriz 2) + Master
// Panel handoff ("Sources: Crypto Futures — Dynamic from Futures Market
// Data Bus"): ingestão dinâmica REAL de tickers da Binance para as abas
// CRYPTO e MEME COINS do Smart Omnibox. Futures USDT-M Perpétuo é a fonte
// PREFERIDA agora (mesma preferência de Diretriz 2 — gráfico e Risk Engine
// já usam Futures via engine-bridge.ts); Spot é o fallback automático se a
// listagem de Futures falhar, seguindo o MESMO padrão de
// requestCandleSnapshotWithFallback (engine-bridge.ts): nunca uma lista
// vazia só porque UM dos dois endpoints teve problema. Cada símbolo carrega
// `market` refletindo a fonte que respondeu de verdade — a UI (SmartOmnibox)
// nunca rotula "Perp" um símbolo que na verdade veio do fallback Spot.
//
// A lógica de extração/curadoria é PURA (testável sem rede); só as funções
// fetch* tocam a rede, e falham fail-closed (lista vazia, nunca uma lista
// velha/fabricada).
export interface BinanceUsdtSymbol {
  symbol: string; // par completo como a API devolve, ex. "BTCUSDT"
  baseAsset: string; // ex. "BTC"
  market: "perp" | "spot"; // fonte real que listou este símbolo agora
}

const EXCHANGE_INFO_URL_FUTURES = "https://fapi.binance.com/fapi/v1/exchangeInfo";
const EXCHANGE_INFO_URL_SPOT = "https://api.binance.com/api/v3/exchangeInfo";

/** Extrai só os contratos PERPÉTUOS/USDT realmente negociáveis AGORA do
 *  payload bruto de /fapi/v1/exchangeInfo. Função pura — testável sem
 *  rede. Fonte PREFERIDA do Omnibox (ver fetchBinanceUsdtSymbols). */
export function extractPerpUsdtSymbols(exchangeInfo: any): BinanceUsdtSymbol[] {
  const symbols = exchangeInfo?.symbols;
  if (!Array.isArray(symbols)) return [];
  const out: BinanceUsdtSymbol[] = [];
  for (const s of symbols) {
    if (!s || s.status !== "TRADING") continue;
    if (s.quoteAsset !== "USDT") continue;
    if (s.contractType !== "PERPETUAL") continue;
    if (typeof s.symbol !== "string" || typeof s.baseAsset !== "string") continue;
    out.push({ symbol: s.symbol, baseAsset: s.baseAsset, market: "perp" });
  }
  return out;
}

/** Extrai só os pares SPOT/USDT realmente negociáveis AGORA do payload
 *  bruto de /api/v3/exchangeInfo. Função pura — testável sem rede.
 *  Fallback automático do Omnibox quando a listagem de Futures falha. */
export function extractUsdtSymbols(exchangeInfo: any): BinanceUsdtSymbol[] {
  const symbols = exchangeInfo?.symbols;
  if (!Array.isArray(symbols)) return [];
  const out: BinanceUsdtSymbol[] = [];
  for (const s of symbols) {
    if (!s || s.status !== "TRADING") continue;
    if (s.quoteAsset !== "USDT") continue;
    if (s.isSpotTradingAllowed === false) continue;
    if (typeof s.symbol !== "string" || typeof s.baseAsset !== "string") continue;
    out.push({ symbol: s.symbol, baseAsset: s.baseAsset, market: "spot" });
  }
  return out;
}

/** Curadoria FECHADA de bases conhecidas como "meme coin" — usada só como
 *  FILTRO sobre a lista real da Binance; uma base aqui que a Binance não
 *  lista agora simplesmente não aparece em lugar nenhum (nunca se
 *  fabrica um ticker que não existe de verdade). */
export const KNOWN_MEME_BASES: ReadonlySet<string> = new Set([
  "DOGE",
  "SHIB",
  "PEPE",
  "FLOKI",
  "WIF",
  "BONK",
  "MEME",
  "BABYDOGE",
  "ORDI",
  "TRUMP",
  "NEIRO",
  "1000SATS",
]);

/** Divide a lista real em CRYPTO (default) e MEME COINS (interseção com a
 *  curadoria acima) — função pura. */
export function partitionCryptoSymbols(all: BinanceUsdtSymbol[]): {
  crypto: BinanceUsdtSymbol[];
  meme: BinanceUsdtSymbol[];
} {
  const meme: BinanceUsdtSymbol[] = [];
  const crypto: BinanceUsdtSymbol[] = [];
  for (const s of all) {
    (KNOWN_MEME_BASES.has(s.baseAsset) ? meme : crypto).push(s);
  }
  return { crypto, meme };
}

/** Busca fina de UM endpoint exchangeInfo — toda a lógica testável vive nas
 *  funções puras extract*. Fail-closed: qualquer erro de rede/parse/HTTP
 *  não-ok devolve [] (nunca uma exceção não tratada, nunca uma lista
 *  velha). */
async function fetchExchangeInfo(
  url: string,
  extract: (json: any) => BinanceUsdtSymbol[],
): Promise<BinanceUsdtSymbol[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return extract(json);
  } catch {
    return [];
  }
}

/** Busca real — Futuros USDT-M Perpétuo primeiro (preferido, mesma
 *  preferência da Diretriz 2), Spot como fallback automático se Futuros
 *  não devolver nenhum símbolo (mesmo padrão de
 *  requestCandleSnapshotWithFallback em engine-bridge.ts). Só devolve []
 *  se AMBAS as fontes falharem — o Omnibox mostra "AGUARDANDO"/erro
 *  honesto nesse caso, nunca uma lista velha ou inventada. */
export async function fetchBinanceUsdtSymbols(): Promise<BinanceUsdtSymbol[]> {
  const perp = await fetchExchangeInfo(EXCHANGE_INFO_URL_FUTURES, extractPerpUsdtSymbols);
  if (perp.length > 0) return perp;
  return fetchExchangeInfo(EXCHANGE_INFO_URL_SPOT, extractUsdtSymbols);
}
