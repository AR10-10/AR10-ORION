// fear-greed-provider.ts — GMIL provedor real de categoria SENTIMENT.
// Alternative.me publica o Crypto Fear & Greed Index há anos como endpoint
// público, sem chave, CORS aberto — é o índice de sentimento cripto mais
// amplamente referenciado por não exigir autenticação.
//
// lean: valor 0-100 mapeado linearmente para -1..1 em torno do ponto médio
// (50). Isto descreve o SENTIMENTO ATUAL do mercado (medo=negativo,
// ganância=positivo) — não é uma leitura contrária nem um sinal de entrada;
// a UI rotula isto explicitamente como "sentimento", nunca como "sinal".
import type { ProviderFetchResult } from '../types';

export async function fetchFearGreedIndex(): Promise<ProviderFetchResult> {
  const fetchedAt = Date.now();
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}`, fetchedAt, fields: {}, lean: null };
    }
    const json = await res.json();
    const entry = Array.isArray(json?.data) ? json.data[0] : null;
    const rawValue = entry ? Number(entry.value) : NaN;
    const value = Number.isFinite(rawValue) ? rawValue : null;
    const classification = typeof entry?.value_classification === 'string' ? entry.value_classification : null;

    const lean = value === null ? null : Math.max(-1, Math.min(1, (value - 50) / 50));

    return {
      ok: value !== null,
      reason: value === null ? 'campo_value_ausente_ou_invalido' : undefined,
      fetchedAt,
      fields: { value, classification },
      lean,
    };
  } catch (err: any) {
    return { ok: false, reason: `excecao: ${err?.message || err}`, fetchedAt, fields: {}, lean: null };
  }
}
