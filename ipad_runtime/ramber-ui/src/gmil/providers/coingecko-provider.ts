// coingecko-provider.ts — GMIL provedor real de categoria BLOCKCHAIN
// (contexto macro-cripto, não um segundo feed de preço BTC/USDT — isso já
// existe via Binance/MEXC). CoinGecko `/global` é público, sem chave, e
// serve CORS aberto para uso client-side (é por isso que existe: é o
// endpoint que dashboards de navegador em geral usam).
//
// Campos reais consumidos: dominância de BTC no market cap total e a
// variação percentual do market cap total nas últimas 24h.
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
    const totalMarketCapUsd = typeof data?.total_market_cap?.usd === 'number' ? data.total_market_cap.usd : null;
    const changePct24h =
      typeof data?.market_cap_change_percentage_24h_usd === 'number' ? data.market_cap_change_percentage_24h_usd : null;

    const lean = changePct24h === null ? null : Math.max(-1, Math.min(1, changePct24h / CLAMP_PCT));

    return {
      ok: totalMarketCapUsd !== null,
      reason: totalMarketCapUsd === null ? 'campo_total_market_cap_ausente' : undefined,
      fetchedAt,
      fields: { btcDominancePct, totalMarketCapUsd, changePct24h },
      lean,
    };
  } catch (err: any) {
    return { ok: false, reason: `excecao: ${err?.message || err}`, fetchedAt, fields: {}, lean: null };
  }
}
