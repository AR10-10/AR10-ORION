// derivatives-provider.ts — GMIL provedor real de categoria DERIVATIVES
// (Fase E / V15 Cap. 3 "Mercado Perpetual" + Cap. 7 "Spot × Perpetual").
// Endpoint: GET fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT —
// público, sem chave, mesmo host/família de endpoint que App.tsx já usa
// para exibir funding/OI do ativo selecionado. Uma chamada, três dados
// reais: funding rate vigente, mark price (perpétuo) e index price (cesta
// spot) — o par mark×index É o feed combinado Spot×Perpetual pedido pela
// diretriz, vindo de uma única resposta atômica (sem juntar duas fontes
// com timestamps diferentes).
//
// lean (POSICIONAMENTO, nunca recomendação): funding rate persistentemente
// positivo significa compradores alavancados pagando para manter posição
// (mercado long-crowded) → lean positivo; negativo → short-crowded → lean
// negativo. Normalização: ±0.05% por período de 8h é historicamente o
// território de extremo em BTC — mapeado linearmente e clampado:
//   lean = clamp(fundingRate / 0.0005, -1, 1)
// Isto descreve COMO o mercado de derivativos está posicionado AGORA — a
// UI rotula como posicionamento; não é leitura contrária nem sinal de
// entrada (mesma regra do fear_greed_index).
//
// Sobreposição honesta com App.tsx (fetchDerivatives): quando o ativo
// selecionado na UI é BTC, este provedor e aquele fetch consultam o mesmo
// endpoint em cadências diferentes (GMIL 120s / painel 60s) para fins
// diferentes (contexto global fixo em BTC vs. display do ativo
// selecionado). Unificar os dois num barramento de derivativos é trabalho
// futuro explícito do Market Data Bus (que hoje transporta só candles) —
// registrado no relatório da Fase E, não escondido.
import type { ProviderFetchResult } from '../types';
// Fonte ÚNICA da fórmula do basis, compartilhada com o Evidence Object por
// ativo (js/real-data/binance-futures-public.js). Mesma disciplina de
// fractal-swings.js: quem precisa do cálculo importa, nunca recopia.
import { computeBasisPct } from '../../../../js/real-data/derivatives-math.js';

export const FUNDING_EXTREME = 0.0005; // ±0.05%/8h ≈ extremo histórico BTC

/** Posicionamento de derivativos a partir do funding real. Pura, testável
 *  offline: null para entrada não-finita (nunca um lean fabricado). */
export function fundingToLean(fundingRate: number | null): number | null {
  if (fundingRate === null || !Number.isFinite(fundingRate)) return null;
  return Math.max(-1, Math.min(1, fundingRate / FUNDING_EXTREME));
}

/** Parse puro da resposta de /fapi/v1/premiumIndex. Fail-closed: qualquer
 *  campo essencial ausente/inválido derruba ok, nunca vira número chutado. */
export function parsePremiumIndex(json: any): {
  ok: boolean;
  reason?: string;
  fundingRate: number | null;
  markPrice: number | null;
  indexPrice: number | null;
  basisPct: number | null;
} {
  const fundingRaw = Number(json?.lastFundingRate);
  const markRaw = Number(json?.markPrice);
  const indexRaw = Number(json?.indexPrice);
  const fundingRate = Number.isFinite(fundingRaw) ? fundingRaw : null;
  const markPrice = Number.isFinite(markRaw) && markRaw > 0 ? markRaw : null;
  const indexPrice = Number.isFinite(indexRaw) && indexRaw > 0 ? indexRaw : null;
  // Basis = prêmio/desconto do perpétuo sobre a cesta spot, em % — o feed
  // combinado Spot×Perpetual em um número (positivo = perp acima do spot).
  // A fórmula saiu daqui para js/real-data/derivatives-math.js quando o
  // Evidence Object por ativo passou a publicar o mesmo basis: uma
  // definição, dois consumidores — nunca duas cópias que podem divergir.
  const basisPct = computeBasisPct(markPrice, indexPrice);
  if (fundingRate === null) {
    return { ok: false, reason: 'campo_lastFundingRate_ausente_ou_invalido', fundingRate, markPrice, indexPrice, basisPct };
  }
  return { ok: true, fundingRate, markPrice, indexPrice, basisPct };
}

export async function fetchDerivativesPositioning(): Promise<ProviderFetchResult> {
  const fetchedAt = Date.now();
  try {
    const res = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT');
    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}`, fetchedAt, fields: {}, lean: null };
    }
    const parsed = parsePremiumIndex(await res.json());
    return {
      ok: parsed.ok,
      reason: parsed.ok ? undefined : parsed.reason,
      fetchedAt,
      fields: {
        fundingRate: parsed.fundingRate,
        markPrice: parsed.markPrice,
        indexPrice: parsed.indexPrice,
        basisPct: parsed.basisPct,
      },
      lean: fundingToLean(parsed.fundingRate),
    };
  } catch (err: any) {
    return { ok: false, reason: `excecao: ${err?.message || err}`, fetchedAt, fields: {}, lean: null };
  }
}
