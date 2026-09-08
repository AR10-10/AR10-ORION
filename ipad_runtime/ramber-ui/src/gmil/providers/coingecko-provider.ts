// coingecko-provider.ts — GMIL provedor real de categoria BLOCKCHAIN
// (contexto macro-cripto, não um segundo feed de preço BTC/USDT — isso já
// existe via Binance/MEXC). CoinGecko `/global` é público, sem chave, e
// serve CORS aberto para uso client-side (é por isso que existe: é o
// endpoint que dashboards de navegador em geral usam).
//
// Campos reais consumidos: dominância de BTC e ETH no market cap total,
// volume 24h agregado de todo o mercado cripto, e a variação percentual do
// market cap total nas últimas 24h.
//
// V11.5 Fase 4: ethDominancePct/totalVolumeUsd24h são campos que já vinham
// na MESMA resposta `/global` e eram descartados — nenhuma chamada de rede
// nova, nenhum risco novo de CORS/disponibilidade. ETH dominance ganha
// relevância real desde que o seletor de ativos passou a incluir ETH.
//
// lean: usa `market_cap_change_percentage_24h_usd` diretamente — uma
// variação de ±5% no cap global em 24h satura o lean em ±1. É uma leitura
// de amplitude do mercado cripto como um todo, não uma opinião sobre
// BTC/USDT especificamente.
import type { ProviderFetchResult } from '../types';

const CLAMP_PCT = 5;

export async function fetchCoinGeckoGlobal(): Promise<ProviderFetchResult> {
  const fetchedAt = Date.now();
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global');
    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}`, fetchedAt, fields: {}, lean: null };
    }
    const json = await res.json();
    const data = json?.data;
    const btcDominancePct =
      typeof data?.market_cap_percentage?.btc === 'number' ? data.market_cap_percentage.btc : null;
    const ethDominancePct =
      typeof data?.market_cap_percentage?.eth === 'number' ? data.market_cap_percentage.eth : null;
    const totalMarketCapUsd = typeof data?.total_market_cap?.usd === 'number' ? data.total_market_cap.usd : null;
    const totalVolumeUsd24h = typeof data?.total_volume?.usd === 'number' ? data.total_volume.usd : null;
    const changePct24h =
      typeof data?.market_cap_change_percentage_24h_usd === 'number' ? data.market_cap_change_percentage_24h_usd : null;

    const lean = changePct24h === null ? null : Math.max(-1, Math.min(1, changePct24h / CLAMP_PCT));

    return {
      ok: totalMarketCapUsd !== null,
      reason: totalMarketCapUsd === null ? 'campo_total_market_cap_ausente' : undefined,
      fetchedAt,
      fields: { btcDominancePct, ethDominancePct, totalMarketCapUsd, totalVolumeUsd24h, changePct24h },
      lean,
    };
  } catch (err: any) {
    return { ok: false, reason: `excecao: ${err?.message || err}`, fetchedAt, fields: {}, lean: null };
  }
}

// ── REFERÊNCIA DE PREÇO INDEPENDENTE DE CORRETORA ─────────────────────
// Pedido direto do Operador ("pra nós não só depender das corretoras").
//
// Revisão DECLARADA da decisão no cabeçalho deste arquivo ("não um segundo
// feed de preço BTC/USDT — isso já existe via Binance/MEXC"): aquela frase
// respondia "falta preço?". A pergunta de agora é "falta preço que NÃO
// venha de corretora?" — e as quatro fontes atuais (Binance/MEXC/Bybit/OKX)
// são todas da mesma classe. Se elas concordarem num preço errado, nenhuma
// contradiz a outra. Ver nexus/independent-reference-price.ts.
//
// `/simple/price` é o mesmo host, sem chave e com o mesmo CORS aberto que
// `/global` já usa há rodadas — zero superfície de rede nova, zero segredo.
// O preço é AGREGADO por muitas venues pela própria CoinGecko: é por isso
// que ele consegue ser uma segunda opinião, e não uma quinta corretora.
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
};

export interface ReferencePriceResult {
  ok: boolean;
  reason?: string;
  fetchedAt: number;
  /** null sempre que não houver leitura REAL — nunca um preço fabricado. */
  priceUsd: number | null;
}

/** Preço agregado real, ou null com razão. Fail-closed em toda ponta:
 *  símbolo desconhecido, HTTP ruim, campo ausente e valor não-finito são
 *  todos ausência declarada, nunca um número inventado. */
export async function fetchCoinGeckoReferencePrice(assetSymbol: string): Promise<ReferencePriceResult> {
  const fetchedAt = Date.now();
  const id = COINGECKO_IDS[String(assetSymbol || '').toUpperCase()];
  if (!id) {
    return { ok: false, reason: `ativo_sem_mapeamento_coingecko:${assetSymbol}`, fetchedAt, priceUsd: null };
  }
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}`, fetchedAt, priceUsd: null };
    }
    const json = await res.json();
    const raw = json?.[id]?.usd;
    // > 0 é parte do contrato: um 0 aqui seria uma leitura impossível de
    // preço, e tratá-lo como válido envenenaria a comparação de divergência.
    const priceUsd = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;
    return {
      ok: priceUsd !== null,
      reason: priceUsd === null ? 'campo_preco_ausente_ou_invalido' : undefined,
      fetchedAt,
      priceUsd,
    };
  } catch (err: any) {
    return { ok: false, reason: `excecao: ${err?.message || err}`, fetchedAt, priceUsd: null };
  }
}
