// history-capture.js — Iniciativa "histórico real + backtest honesto",
// FASE 2: paginação real de candles com proveniência, matéria-prima para
// a Fase 3 (amostra auditável sobre structural-backtest.js). Laboratório,
// zero fio com produção — mesma disciplina de structural-backtest.js (ver
// QUARANTINE.md).
//
// Por que isto nunca passa pelo Bus: o Market Data Bus (market-data-bus/
// bus.js) é cache de snapshot MAIS RECENTE por symbol:timeframe,
// compartilhado por todo o app ao vivo — escrever uma página histórica
// antiga ali corromperia esse snapshot canônico (regra do CLAUDE.md). Este
// módulo pagina o conector real diretamente, mesmo padrão já usado por
// getOlderChartCandles (engine-bridge.ts) para o scroll-back do gráfico —
// aqui o alvo é acumular uma amostra completa com proveniência auditável,
// não alimentar o canvas.
//
// Proveniência: reaproveita o MESMO Evidence Object (js/real-data/schema.js)
// que já rege todo o Real Data Layer — nenhum campo novo de "proveniência"
// é inventado aqui. fetchRealPage pede o evidence completo de
// collectBinanceFuturesKlines (mudança aditiva nesse conector:
// returnEvidence, default false preserva 100% o comportamento existente
// do scroll-back do gráfico).
//
// Limite honesto do sandbox: fetchRealPage nunca foi executado contra rede
// real nesta sessão de implementação (mesma limitação de todo o Real Data
// Layer neste ambiente — sem egress a exchanges). Provado aqui só com
// fetchPage injetado (fixture determinística); a captura real exige um
// ambiente com egress real às exchanges (produção/dispositivo do
// Operador — ver SYSTEM_HANDBOOK.md §6.7). Este módulo não tem, ainda,
// nenhum gatilho de UI — é a peça de código pronta para quando essa
// decisão de superfície (onde/como o Operador dispara a captura) for
// tomada explicitamente.

import { collectBinanceFuturesKlines } from '../../market-data-bus/binance-futures-candle-connector.js';
import { timeframeToSeconds } from '../../market-data-bus/quality-engine.js';

export const HISTORY_CAPTURE_FORMAT_VERSION = 1;

// Convenções de mesa (parâmetros declarados, nunca medições — mesmo
// espírito do piso R:R em ramber-ui/src/nexus/rr-quality.ts):
// 1000 candles por página, abaixo do limite documentado da Binance
// (1500) com folga deliberada; 50 páginas de teto de segurança
// (50 000 candles no pior caso) para que uma história maior que o
// alvo por engano nunca vire um laço sem fim contra a rede real.
export const HISTORY_CAPTURE_DEFAULT_PAGE_SIZE = 1000;
export const HISTORY_CAPTURE_DEFAULT_MAX_PAGES = 50;

export const CAPTURE_AVISO =
  'Amostra capturada via paginação direta contra o conector real; ' +
  'cobertura contígua de timestamps é verificada candle a candle, mas ' +
  'isto NÃO garante qualidade de mercado — gaps reais de exchange ' +
  '(manutenção, delisting temporário) continuam possíveis e aparecem em ' +
  '"gaps" quando existem, nunca escondidos. Este objeto é matéria-prima ' +
  'para o laboratório de backtest (Fase 3) — nunca, por si só, uma ' +
  'afirmação de desempenho ou de probabilidade futura.';

/** Página real: o MESMO conector já usado pelo scroll-back do gráfico
 *  (getOlderChartCandles → collectBinanceFuturesKlines) — nunca uma
 *  segunda implementação de fetch. returnEvidence:true pede o Evidence
 *  Object completo (proveniência) em vez de só o array de candles. */
export async function fetchRealPage({ symbol, timeframe, limit, endTime }) {
  return collectBinanceFuturesKlines({ symbol, timeframe, limit, endTime, returnEvidence: true });
}

function dedupeSortAscending(candles) {
  const byTime = new Map();
  for (const c of candles) byTime.set(c.t, c);
  return Array.from(byTime.values()).sort((a, b) => a.t - b.t);
}

/** Lacunas EXATAS — não a fração tolerante de quality-engine.js
 *  (computeConsistency existe para absorver o jitter real de UMA coleta
 *  ao vivo; um candle histórico já FECHADO tem timestamp determinístico,
 *  então qualquer desvio do passo do timeframe aqui é um gap real, não
 *  ruído de coleta). Cada gap nomeia o par de candles reais entre os
 *  quais o passo esperado não bateu — nunca uma zona cinzenta silenciosa. */
function findGaps(sortedCandles, timeframe) {
  const step = timeframeToSeconds(timeframe);
  if (step === null || sortedCandles.length < 2) return [];
  const gaps = [];
  for (let i = 1; i < sortedCandles.length; i++) {
    const delta = sortedCandles[i].t - sortedCandles[i - 1].t;
    if (delta !== step) {
      gaps.push({
        afterTime: sortedCandles[i - 1].t,
        beforeTime: sortedCandles[i].t,
        expectedStepSeconds: step,
        actualDeltaSeconds: delta,
      });
    }
  }
  return gaps;
}

/**
 * Pagina para trás a partir do candle real mais recente até acumular
 * `targetCandleCount` candles (ou esgotar a história/maxPages da
 * exchange). Fail-closed em toda falha real: para a paginação e devolve
 * o que já foi acumulado com `stopReason` honesto — nunca fabrica uma
 * página que falhou, nunca finge ter alcançado o alvo.
 * @param {{symbol:string, timeframe:string, targetCandleCount:number, pageSize?:number, maxPages?:number, fetchPage?: Function}} opts
 */
export async function captureHistoricalCandles({
  symbol,
  timeframe,
  targetCandleCount,
  pageSize = HISTORY_CAPTURE_DEFAULT_PAGE_SIZE,
  maxPages = HISTORY_CAPTURE_DEFAULT_MAX_PAGES,
  fetchPage = fetchRealPage,
}) {
  const pages = [];
  let allCandles = [];
  let endTime;
  let stopReason = 'alvo_atingido';

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
    let evidence;
    try {
      evidence = await fetchPage({ symbol, timeframe, limit: pageSize, endTime });
    } catch (err) {
      stopReason = `falha_na_pagina_${pageIndex}:${err instanceof Error ? err.message : String(err)}`;
      break;
    }
    const pageCandles = evidence && Array.isArray(evidence.candles) ? evidence.candles : [];
    if (pageCandles.length === 0) {
      stopReason = 'historia_esgotada_na_exchange';
      break;
    }
    pages.push({
      pageIndex,
      fetchedAt: evidence.fetched_at ?? null,
      rawSampleHash: evidence.raw_sample_hash ?? null,
      sourceId: evidence.source_id ?? null,
      candleCount: pageCandles.length,
    });
    allCandles = allCandles.concat(pageCandles);
    const oldest = pageCandles.reduce((min, c) => (c.t < min ? c.t : min), pageCandles[0].t);
    endTime = (oldest - 1) * 1000;

    if (allCandles.length >= targetCandleCount) {
      stopReason = 'alvo_atingido';
      break;
    }
    if (pageIndex === maxPages - 1) {
      stopReason = 'maxPages_atingido_antes_do_alvo';
    }
  }

  const sorted = dedupeSortAscending(allCandles);
  const gaps = findGaps(sorted, timeframe);
  const succeeded = stopReason === 'alvo_atingido' || stopReason === 'historia_esgotada_na_exchange';

  return {
    formatVersion: HISTORY_CAPTURE_FORMAT_VERSION,
    symbol,
    timeframe,
    capturedAt: new Date().toISOString(),
    targetCandleCount,
    candleCount: sorted.length,
    reachedTarget: sorted.length >= targetCandleCount,
    candles: sorted,
    pages,
    pageCount: pages.length,
    gaps,
    contiguous: gaps.length === 0,
    stopReason,
    succeeded,
    aviso: CAPTURE_AVISO,
  };
}
