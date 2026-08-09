// defillama-provider.ts — GMIL provedor real de categoria ONCHAIN (Ordem
// Mestra §7 "On-Chain e DeFi"). Endpoint: GET api.llama.fi/v2/historicalChainTvl
// — público, sem chave, série histórica real de TVL agregado (soma de
// todas as chains rastreadas pela DefiLlama). Preenche o gancho honesto
// que já existia em types.ts (categoria ONCHAIN definida desde a Fase E,
// sempre null "toda fonte prescrita exige chave de API" — ver README.md).
//
// Nota honesta de escopo: a definição original de ONCHAIN em types.ts é
// "fluxos institucionais on-chain (Whale Alert, reservas, grandes
// movimentações)" — rastreamento de carteira/whale individual, que
// nenhuma fonte keyless expõe (mesma conclusão do README). TVL agregado
// não é a mesma coisa que uma transferência de whale específica, mas É um
// proxy real e honesto de fluxo de capital on-chain em agregado: TVL
// subindo = capital líquido entrando em contratos DeFi; TVL caindo =
// capital saindo. Mais amplo (todas as chains, não um ativo específico) —
// mesma natureza "contexto global" que coingecko_global/fear_greed_index/
// trending_coins já têm nesta camada, nunca um sinal por-ativo.
//
// CORS: não verificado ao vivo nesta sessão (mesmo bloqueio de rede do
// sandbox documentado em docs/MARKET_DATA_FABRIC.md). Diferente do caso
// Yahoo Finance (confirmado via WebSearch como CORS-bloqueado): não foi
// encontrada nenhuma fonte confirmando ou negando CORS aberto para
// api.llama.fi especificamente. A confiança de que funcione é MODERADA
// (uso amplo e conhecido por dashboards DeFi client-side na comunidade),
// não uma certeza verificada — declarado honestamente aqui em vez de
// apresentado como confirmado. probeJsonEndpoint/fetch() classificam
// BLOCKED_BY_CORS exatamente como qualquer outro conector se a suposição
// estiver errada — fail-closed por construção, não por sorte.
import type { ProviderFetchResult } from '../types';

// Variação de TVL agregado de ±5% em 7 dias já é um movimento forte fora
// de eventos pontuais (depeg/exploit) — mesma disciplina de clamp linear
// que FUNDING_EXTREME já usa em derivatives-provider.ts.
export const TVL_CHANGE_EXTREME = 0.05;
export const LOOKBACK_SECONDS = 7 * 86400;

/** Lean real a partir da variação percentual de TVL — positivo (rising) =
 *  capital entrando = lean bullish; negativo = capital saindo = lean
 *  bearish. Pura, testável offline: null para entrada não-finita ou base
 *  inválida (nunca um lean fabricado). */
export function tvlChangeToLean(currentTvl: number | null, pastTvl: number | null): number | null {
  if (
    currentTvl === null || pastTvl === null ||
    !Number.isFinite(currentTvl) || !Number.isFinite(pastTvl) || pastTvl <= 0
  ) {
    return null;
  }
  const pctChange = (currentTvl - pastTvl) / pastTvl;
  return Math.max(-1, Math.min(1, pctChange / TVL_CHANGE_EXTREME));
}

/** Parse puro de /v2/historicalChainTvl: array real de {date (unix
 *  segundos), tvl}. Fail-closed: schema inesperado nunca vira número
 *  chutado. Nunca interpola — o ponto "7 dias atrás" é o REAL mais
 *  próximo da data alvo na série, não um valor calculado entre dois
 *  pontos. */
export function parseHistoricalChainTvl(json: any): {
  ok: boolean;
  reason?: string;
  currentTvl: number | null;
  pastTvl: number | null;
  currentDate: number | null;
} {
  if (!Array.isArray(json) || json.length === 0) {
    return { ok: false, reason: 'resposta_nao_e_array_ou_vazia', currentTvl: null, pastTvl: null, currentDate: null };
  }
  const points = json
    .map((p: any) => ({ date: Number(p?.date), tvl: Number(p?.tvl) }))
    .filter((p: { date: number; tvl: number }) => Number.isFinite(p.date) && Number.isFinite(p.tvl) && p.tvl >= 0);
  if (points.length < 2) {
    return { ok: false, reason: 'pontos_reais_insuficientes_apos_filtragem', currentTvl: null, pastTvl: null, currentDate: null };
  }
  points.sort((a: { date: number }, b: { date: number }) => a.date - b.date);
  const last = points[points.length - 1];
  const targetDate = last.date - LOOKBACK_SECONDS;
  let closest = points[0];
  let closestDiff = Math.abs(points[0].date - targetDate);
  for (const p of points) {
    const diff = Math.abs(p.date - targetDate);
    if (diff < closestDiff) {
      closest = p;
      closestDiff = diff;
    }
  }
  return { ok: true, currentTvl: last.tvl, pastTvl: closest.tvl, currentDate: last.date };
}

export async function fetchOnchainTvlFlow(): Promise<ProviderFetchResult> {
  const fetchedAt = Date.now();
  try {
    const res = await fetch('https://api.llama.fi/v2/historicalChainTvl');
    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}`, fetchedAt, fields: {}, lean: null };
    }
    const parsed = parseHistoricalChainTvl(await res.json());
    if (!parsed.ok) {
      return { ok: false, reason: parsed.reason, fetchedAt, fields: {}, lean: null };
    }
    const tvlChangePct7d = parsed.pastTvl && parsed.pastTvl > 0 && parsed.currentTvl !== null
      ? ((parsed.currentTvl - parsed.pastTvl) / parsed.pastTvl) * 100
      : null;
    return {
      ok: true,
      fetchedAt,
      fields: {
        currentTvlUsd: parsed.currentTvl,
        tvl7dAgoUsd: parsed.pastTvl,
        tvlChangePct7d,
      },
      lean: tvlChangeToLean(parsed.currentTvl, parsed.pastTvl),
    };
  } catch (err: any) {
    return { ok: false, reason: `excecao: ${err?.message || err}`, fetchedAt, fields: {}, lean: null };
  }
}
