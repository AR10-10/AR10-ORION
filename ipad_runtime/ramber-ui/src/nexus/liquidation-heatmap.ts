// liquidation-heatmap.ts — OMEGA CORE V-MAX Fase 8.1 ("heatmap real de
// liquidação"). Motor puro: agrega eventos JÁ reais de liquidação forçada
// (Binance USDT-M Futures, engine-bridge.ts's startRealLiquidationFeed,
// stream `!forceOrder@arr`) em buckets por nível de preço — zero fetch,
// zero segunda fonte, zero fabricação.
//
// AUDITORIA ANTES DE CONSTRUIR (achado real, SYSTEM_HANDBOOK.md §6.38): o
// feed real já existe, mas só alimentava uma lista ("Forced
// Liquidations"), nunca um heatmap por preço. O QUE ESTE MOTOR NÃO É: um
// "mapa preditivo" de onde posições alavancadas SERIAM liquidadas (o tipo
// de heatmap que produtos como Coinglass anunciam) — isso exigiria
// distribuição real de open interest por alavancagem, dado privado que
// nenhuma exchange publica publicamente. O QUE ESTE MOTOR É: uma
// densidade REAL de liquidações que JÁ ACONTECERAM (eventos reais
// recebidos via WebSocket, nunca modelados/estimados) — honestamente
// retrospectivo, nunca preditivo. Regra de Ouro 1: zero
// Math.random()/interpolação; cada dólar somado em cada bucket veio de um
// evento real do exchange.
//
// Escopo por símbolo: startRealLiquidationFeed é exchange-wide (todos os
// símbolos, não só o ativo selecionado) — filtrar por símbolo é
// responsabilidade DESTE motor (nunca do consumidor visual), porque
// desenhar uma liquidação de outro ativo no eixo de preço do ativo atual
// seria uma escala errada, não apenas ruído.
//
// Sem seed histórico: o stream não tem REST equivalente
// (binance-liquidations-stream.js, header do arquivo) — o buffer só
// cresce com eventos reais vistos NESTA sessão. Fail-closed honesto
// quando há poucos eventos reais para o símbolo ativo: MIN_EVENTS_FOR_HEATMAP
// existe para nunca apresentar 1-2 pontos isolados como se fossem uma
// densidade real.
import type { LiquidationEvent } from "../engine-bridge";
// Diretriz Final de Lapidação Visual, Parte 4 ("peso de idade"): ageAlpha é
// agnóstico de unidade (só faz interpolação linear sobre um número real) —
// reaproveitado aqui com MINUTOS reais de idade em vez de candles (mesmo
// padrão já usado por nexus/aura-lifecycle.ts importando de chart/), nunca
// uma segunda função de decaimento.
import { ageAlpha, type DecayConfig } from "../chart/annotation-decay";

export const LIQUIDATION_HEATMAP_CONTRACT_VERSION = 1 as const;

// Documentado (mesma natureza de MIN_EVENTS_FOR_HEATMAP abaixo) — nunca uma
// medição: eventos dos primeiros 10 minutos pesam cheio; entre 10 e 60 min
// esmaecem linearmente até 10%; a partir de 1h (escala de sessão, mesmo
// horizonte já usado pela honestidade retrospectiva do módulo) pesam 0 no
// AGREGADO VISUAL — mesmo comportamento real de ageAlpha já usado por
// LiquidityZonesPlugin/StructureBreakMarkersPlugin/KillZoneBandsPlugin
// (decai até minAlpha, depois cai a 0), nunca um piso permanente. O evento
// em si nunca é apagado do FEED real (eventCount conta todos, sempre) —
// só o peso no totalNotionalUsd deste render específico chega a 0, mesma
// disciplina de "esquecida da TELA, nunca do dado real" já documentada em
// annotation-decay.ts.
export const LIQUIDATION_DECAY: DecayConfig = { fadeStartCandles: 10, expireCandles: 60, minAlpha: 0.1 };

export interface LiquidationHeatmapBucket {
  priceLow: number;
  priceHigh: number;
  // Soma real (nunca estimada) de notionalUsd dos eventos LONG_LIQUIDATED
  // / SHORT_LIQUIDATED cujo price real caiu neste bucket — ponderada por
  // idade real via LIQUIDATION_DECAY (evento recente pesa mais que um
  // antigo da mesma sessão, evento com mais de 1h pesa 0 neste agregado),
  // nunca um valor inventado: o dólar em si é sempre real, só o PESO no
  // agregado muda com o tempo.
  longNotionalUsd: number;
  shortNotionalUsd: number;
  totalNotionalUsd: number;
  // Contagem real de eventos — nunca afetada pelo peso de idade (é sobre
  // "quantos eventos reais existem aqui", uma pergunta diferente de "quanto
  // isso pesa visualmente agora").
  eventCount: number;
}

export interface LiquidationHeatmapResult {
  contractVersion: typeof LIQUIDATION_HEATMAP_CONTRACT_VERSION;
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  symbol: string | null;
  buckets: LiquidationHeatmapBucket[];
  rangeMin: number | null;
  rangeMax: number | null;
  // Maior totalNotionalUsd real entre os buckets — o consumidor visual
  // normaliza intensidade/largura de barra dividindo por este valor,
  // nunca por um teto fixo arbitrário (mesmo princípio de maxVolume em
  // VolumeProfilePlugin.tsx).
  maxBucketNotionalUsd: number | null;
  eventCount: number;
  computedAt: number;
}

// Parâmetro documentado (mesma natureza de MIN_SAMPLES_FOR_CONVICTION_TREND
// em institutional-score.ts) — nunca uma medição: com 1-2 eventos reais
// isolados, "heatmap" seria uma palavra fabricada para dois pontos soltos.
export const MIN_EVENTS_FOR_HEATMAP = 3;
// Resolução real dos buckets — parâmetro documentado (mesma natureza do
// bucketCount do Volume Profile), escolhido mais grosso que o VP de
// propósito: eventos de liquidação são reais mas ESPARSOS (não um por
// candle como volume), buckets finos demais fragmentariam eventos reais
// vizinhos em células isoladas, reduzindo compreensão em vez de aumentar.
export const DEFAULT_LIQUIDATION_BUCKET_COUNT = 16;

/** Agrega eventos reais de liquidação (JÁ recebidos pelo feed) para o
 *  símbolo ativo em buckets por preço. Pura, síncrona, O(eventos) — sem
 *  rede, sem estado, sem Worker (custo desprezível para até milhares de
 *  eventos retidos). */
export function computeLiquidationHeatmap(
  events: LiquidationEvent[],
  symbol: string | null,
  bucketCount: number = DEFAULT_LIQUIDATION_BUCKET_COUNT,
  now: number = Date.now(),
): LiquidationHeatmapResult {
  const empty = (reason: string): LiquidationHeatmapResult => ({
    contractVersion: LIQUIDATION_HEATMAP_CONTRACT_VERSION,
    status: "DADOS_INSUFICIENTES",
    reason,
    symbol,
    buckets: [],
    rangeMin: null,
    rangeMax: null,
    maxBucketNotionalUsd: null,
    eventCount: 0,
    computedAt: now,
  });

  if (!symbol) return empty("sem_ativo_selecionado");
  if (!Array.isArray(events) || events.length === 0) return empty("nenhum_evento_real_recebido_ainda_nesta_sessao");

  // Mesma convenção real já usada em todo o codebase (bybit-futures.ts,
  // binance-futures-public.js): símbolo base + "USDT", sem separador.
  const wantedSymbol = `${symbol}USDT`;
  const matching = events.filter((e) => e.symbol === wantedSymbol);
  if (matching.length < MIN_EVENTS_FOR_HEATMAP) {
    return empty("eventos_reais_insuficientes_para_este_ativo_nesta_janela");
  }

  let rangeMin = Infinity;
  let rangeMax = -Infinity;
  for (const e of matching) {
    if (e.price < rangeMin) rangeMin = e.price;
    if (e.price > rangeMax) rangeMax = e.price;
  }
  if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax) || rangeMax <= rangeMin) {
    // Todos os eventos reais no MESMO preço exato (ou preço inválido) —
    // sem faixa real para bucketizar, honesto em não inventar uma.
    return empty("faixa_de_preco_real_insuficiente_para_bucketizar");
  }

  const width = (rangeMax - rangeMin) / bucketCount;
  const buckets: LiquidationHeatmapBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    priceLow: rangeMin + i * width,
    priceHigh: rangeMin + (i + 1) * width,
    longNotionalUsd: 0,
    shortNotionalUsd: 0,
    totalNotionalUsd: 0,
    eventCount: 0,
  }));

  for (const e of matching) {
    let idx = Math.floor((e.price - rangeMin) / width);
    if (idx >= bucketCount) idx = bucketCount - 1; // topo real inclusive (mesmo evento no preço máximo exato)
    if (idx < 0) idx = 0;
    const bucket = buckets[idx];
    const ageMinutes = Math.max(0, (now - e.timestamp) / 60_000);
    const weight = ageAlpha(ageMinutes, LIQUIDATION_DECAY);
    const weightedNotional = e.notionalUsd * weight;
    if (e.side === "LONG_LIQUIDATED") bucket.longNotionalUsd += weightedNotional;
    else bucket.shortNotionalUsd += weightedNotional;
    bucket.totalNotionalUsd += weightedNotional;
    bucket.eventCount += 1;
  }

  const maxBucketNotionalUsd = buckets.reduce((max, b) => (b.totalNotionalUsd > max ? b.totalNotionalUsd : max), 0);

  return {
    contractVersion: LIQUIDATION_HEATMAP_CONTRACT_VERSION,
    status: "OK",
    reason: null,
    symbol,
    buckets,
    rangeMin,
    rangeMax,
    maxBucketNotionalUsd: maxBucketNotionalUsd > 0 ? maxBucketNotionalUsd : null,
    eventCount: matching.length,
    computedAt: now,
  };
}
