// binance-symbols.ts — Overhaul Cross-Market (Missão 2, diretriz 2):
// ingestão dinâmica REAL de tickers da Binance para as abas CRYPTO e MEME
// COINS do Smart Omnibox. Só pares spot/USDT com status TRADING agora —
// nunca um ticker inventado ou histórico morto. A lógica de extração/
// curadoria é PURA (testável sem rede); só fetchBinanceUsdtSymbols toca a
// rede, e falha fail-closed (lista vazia, nunca uma lista velha/fabricada).
export interface BinanceUsdtSymbol {
  symbol: string; // par completo como a API devolve, ex. "BTCUSDT"
  baseAsset: string; // ex. "BTC"
}

const EXCHANGE_INFO_URL = "https://api.binance.com/api/v3/exchangeInfo";

/** Extrai só os pares SPOT/USDT realmente negociáveis AGORA do payload
 *  bruto de /api/v3/exchangeInfo. Função pura — testável sem rede. */
export function extractUsdtSymbols(exchangeInfo: any): BinanceUsdtSymbol[] {
  const symbols = exchangeInfo?.symbols;
  if (!Array.isArray(symbols)) return [];
  const out: BinanceUsdtSymbol[] = [];
  for (const s of symbols) {
    if (!s || s.status !== "TRADING") continue;
    if (s.quoteAsset !== "USDT") continue;
    if (s.isSpotTradingAllowed === false) continue;
    if (typeof s.symbol !== "string" || typeof s.baseAsset !== "string") continue;
    out.push({ symbol: s.symbol, baseAsset: s.baseAsset });
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

/** Busca real — deliberadamente fina: toda a lógica testável vive nas
 *  funções puras acima. Fail-closed: qualquer erro de rede/parse devolve
 *  [] (o Omnibox mostra "AGUARDANDO"/erro honesto, nunca uma lista velha
 *  ou inventada). */
export async function fetchBinanceUsdtSymbols(): Promise<BinanceUsdtSymbol[]> {
  try {
    const res = await fetch(EXCHANGE_INFO_URL);
    if (!res.ok) return [];
    const json = await res.json();
    return extractUsdtSymbols(json);
  } catch {
    return [];
  }
}
