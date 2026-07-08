// trending-provider.ts — GMIL provedor real de categoria ATTENTION (V11.5
// Fase 4). Mesmo domínio já integrado por coingecko-provider.ts
// (api.coingecko.com), então herda a mesma CORS/disponibilidade já em uso —
// mas é um endpoint DIFERENTE (`/search/trending`), sem relação com o
// market cap global: lista as moedas mais buscadas no CoinGecko nas
// últimas 24h, um proxy real de atenção de mercado.
//
// lean: propositalmente `null`, sempre. "O que está sendo mais buscado"
// não tem direção (alta/baixa) inerente — forçar um lean aqui seria
// inventar um valor que a fonte não contém, o que o projeto proíbe (ver
// types.ts). Este provedor nunca participa do GLOBAL_CONSENSUS_SCORE por
// isso; ele só existe para exibir contexto real (top símbolos em alta de
// busca), não para mover o índice.
import type { ProviderFetchResult } from '../types';

const TOP_N = 3;

export async function fetchTrendingCoins(): Promise<ProviderFetchResult> {
  const fetchedAt = Date.now();
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/search/trending');
    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}`, fetchedAt, fields: {}, lean: null };
    }
    const json = await res.json();
    const coins = Array.isArray(json?.coins) ? json.coins : [];
    const symbols = coins
      .slice(0, TOP_N)
      .map((c: any) => (typeof c?.item?.symbol === 'string' ? c.item.symbol.toUpperCase() : null))
      .filter((s: string | null): s is string => s !== null);

    return {
      ok: symbols.length > 0,
      reason: symbols.length === 0 ? 'campo_coins_ausente_ou_vazio' : undefined,
      fetchedAt,
      fields: { topSymbols: symbols.join(', ') || null, count: symbols.length },
      lean: null,
    };
  } catch (err: any) {
    return { ok: false, reason: `excecao: ${err?.message || err}`, fetchedAt, fields: {}, lean: null };
  }
}
