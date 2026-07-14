// mexc-spot.ts — MEXC Spot público (sem chave) como fonte real de
// cross-check de preço + profundidade L2 (Ordem "Multi-Source Data
// Ingestion Layer": MEXC é fonte PRIORITÁRIA do Operador). Antes desta
// sessão, MEXC só alimentava o poller de trades/order-flow legado
// (js/real-data/mexc-trades-stream.js) — este módulo dá à MEXC o mesmo
// status de 1ª classe que Bybit/OKX já têm (mesmo padrão real de
// bybit-futures.ts/okx-futures.ts), e adiciona profundidade L2 real, que
// nem Bybit nem OKX têm hoje neste código.
//
// Escopo honesto — MEXC SPOT, não Futures: endpoints públicos reais
//   GET /api/v3/ticker/price?symbol=BTCUSDT  → { symbol, price }
//   GET /api/v3/depth?symbol=BTCUSDT&limit=20 → { bids, asks, ... }
// mesma base (api.mexc.com) já usada pelo conector de trades existente.
// Comparado contra o markPrice de Futures da Binance, um instrumento
// SPOT carrega uma base real (prêmio/desconto de perpétuo) que NÃO é
// erro de dado — é mercado. Por isso este módulo participa do cross-check
// visual (mesmo `compareCrossExchange` de shared.ts, mesmo vocabulário
// ALINHADO/DIVERGENTE/INDISPONÍVEL), mas deliberadamente NÃO alimenta as
// `divergences` do TrustScoreEngine nesta primeira integração — misturar
// spot-vs-perp num metro hoje perp-vs-perp inflaria "divergência" com
// ruído de base real, não com falta de confiança na fonte. Decisão
// registrada, não esquecimento (mesmo espírito da Fase 0.6).
//
// Fail-closed: qualquer falha de rede/HTTP/schema devolve ok:false/vazio
// honesto — nunca bloqueia nem atrasa o caminho principal (Binance).
//
// Honestidade de plataforma: os campos abaixo seguem a documentação
// pública estável da API v3 Spot da MEXC; NÃO foram re-verificados ao
// vivo nesta sessão (sandbox de execução sem saída de rede para
// exchanges — mesma limitação já documentada em
// mexc-trades-stream.js/bybit-futures.ts/okx-futures.ts). Schema real
// divergente falha fechado via as funções de validação abaixo, nunca um
// preço ou nível inventado.
import { type PerpTicker, compareCrossExchange, type CrossExchangeCheck, DIVERGENCE_THRESHOLD_PCT } from "./shared";

const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const MEXC_SPOT_BASE = "https://api.mexc.com/api/v3";

export type MexcPerpTicker = PerpTicker;

/** Extrai o preço real de /api/v3/ticker/price. Função pura, testável sem
 *  rede. MEXC Spot não tem funding/openInterest (não é derivativo) —
 *  ambos ficam honestamente null, nunca inventados a partir de outra
 *  fonte. */
export function extractMexcPerpTicker(json: any): MexcPerpTicker {
  const price = Number(json?.price);
  if (!isFiniteNum(price)) return { ok: false, price: null, fundingRate: null, openInterest: null };
  return { ok: true, price, fundingRate: null, openInterest: null };
}

/** Busca real — deliberadamente fina: toda a lógica testável vive em
 *  extractMexcPerpTicker. Fail-closed: erro de rede/HTTP/parse devolve
 *  ok:false, nunca lança. */
export async function fetchMexcPerpTicker(symbol: string): Promise<MexcPerpTicker> {
  try {
    const res = await fetch(`${MEXC_SPOT_BASE}/ticker/price?symbol=${encodeURIComponent(symbol)}USDT`);
    if (!res.ok) return { ok: false, price: null, fundingRate: null, openInterest: null };
    const json = await res.json();
    return extractMexcPerpTicker(json);
  } catch {
    return { ok: false, price: null, fundingRate: null, openInterest: null };
  }
}

export interface MexcDepthLevel {
  price: number;
  size: number;
}

export interface MexcDepthSnapshot {
  ok: boolean;
  bids: MexcDepthLevel[];
  asks: MexcDepthLevel[];
}

/** Valida a forma real de /api/v3/depth — bids/asks como arrays reais.
 *  Função pura. */
export function validateMexcDepthShape(json: unknown): boolean {
  const j = json as any;
  return !!j && Array.isArray(j.bids) && Array.isArray(j.asks);
}

/** Mapeia o payload cru de /api/v3/depth para níveis reais — mesmo
 *  contrato de nível (price/size) usado no resto do sistema (L2Level).
 *  asks invertidos para ordem decrescente, mesma convenção já usada em
 *  cross-exchange-service.ts's handleDepth (nunca uma segunda convenção).
 *  Função pura, fail-closed por nível: linha malformada é descartada, não
 *  derruba o snapshot inteiro. */
export function mexcDepthToSnapshot(json: unknown): MexcDepthSnapshot {
  if (!validateMexcDepthShape(json)) return { ok: false, bids: [], asks: [] };
  const j = json as any;
  const toLevels = (rows: unknown[]): MexcDepthLevel[] =>
    rows
      .filter((r): r is unknown[] => Array.isArray(r) && r.length >= 2)
      .map((r) => ({ price: Number(r[0]), size: Number(r[1]) }))
      .filter((l) => isFiniteNum(l.price) && isFiniteNum(l.size));
  return { ok: true, bids: toLevels(j.bids).slice(0, 8), asks: toLevels(j.asks).slice(0, 8).reverse() };
}

/** Busca real de profundidade MEXC Spot — fail-closed: qualquer erro
 *  devolve ok:false honesto, nunca lança nem inventa um nível. */
export async function fetchMexcDepth(symbol: string, limit = 20): Promise<MexcDepthSnapshot> {
  try {
    const res = await fetch(`${MEXC_SPOT_BASE}/depth?symbol=${encodeURIComponent(symbol)}USDT&limit=${limit}`);
    if (!res.ok) return { ok: false, bids: [], asks: [] };
    const json = await res.json();
    return mexcDepthToSnapshot(json);
  } catch {
    return { ok: false, bids: [], asks: [] };
  }
}

export { compareCrossExchange, DIVERGENCE_THRESHOLD_PCT, type CrossExchangeCheck };
