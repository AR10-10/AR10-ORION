// orderflow-engine-ui.js — Orquestra o Order Flow Engine (Skills 1, 2, 4,
// 8, 9 do golden master) nesta tela: inicializa o worker dedicado + o
// BioReactorRenderer, alimenta o worker com ticks sinteticos derivados do
// dataset de replay (ver src/orderflow/candle-tick-synthesizer.js —
// HONESTIDADE: nao e fita de negociacao real, sempre DataState.REPLAY) OU
// com trades reais ao vivo da MEXC (ver js/real-data/mexc-trades-stream.js,
// task #37 — DataState.LIVE) e mantem o canvas animado via
// requestAnimationFrame. app.js chama estas funcoes a partir do boot() e
// dos handlers dos botoes "Rodar Order Flow Replay" / "Iniciar MEXC Live".
// Estado de modulo: o handle do loop de animacao, o ultimo zScore
// observado e o poller live (no maximo 1 de cada ativo por sessao nesta
// tela) — replay e live nunca ingerem no mesmo ring buffer ao mesmo tempo,
// ver isLiveFeedRunning()/stopLiveOrderflowFeed() abaixo.

import { OrderflowWorkerClient } from './orderflow-client.js';
import { synthesizeTicksFromCandles } from '../src/orderflow/candle-tick-synthesizer.js';
import { BioReactorRenderer } from '../src/orderflow/bio-reactor-render.js';
import { createLivePoller } from './real-data/mexc-trades-stream.js';
import { CONNECTOR_STATES } from './real-data/schema.js';

let rafHandle = null;
let latestZScore = 0;
let livePoller = null;

/** client.selfTest() roda ticks sinteticos desenhados de proposito para
 *  cruzar cada limiar (OFI/Exhaustion/RingBuffer) — e' a prova
 *  deterministica de que o motor funciona, independente de quantos sinais
 *  organicos um replay real-mas-derivado-de-candle produzir (ver
 *  candle-tick-synthesizer.js: 0 sinais organicos e' um resultado honesto
 *  esperado nesse caso, nao uma falha de wiring). */
export async function initOrderflowEngine({ workerUrl, canvas }) {
    const client = new OrderflowWorkerClient(workerUrl);
    await client.ping();
    const initInfo = await client.init(65536);
    const selfTest = await client.selfTest();
    const renderer = new BioReactorRenderer(canvas);
    const backend = await renderer.init();
    startBioReactorLoop(renderer);
    return { client, renderer, backend, useSAB: initInfo.useSAB, selfTest };
}

export function startBioReactorLoop(renderer) {
    stopBioReactorLoop();
    const frame = (ts) => {
        renderer.render(ts, latestZScore);
        rafHandle = requestAnimationFrame(frame);
    };
    rafHandle = requestAnimationFrame(frame);
}

export function stopBioReactorLoop() {
    if (rafHandle !== null) cancelAnimationFrame(rafHandle);
    rafHandle = null;
}

function nextStressZScore(signals) {
    const exh = signals.find((s) => s.type === 'EXHAUSTION');
    if (exh) return Math.abs(exh.metadata.zScore);
    const ofi = signals.find((s) => s.type === 'OFI');
    if (ofi) return Math.abs(ofi.metadata.imbalance) * 4;
    return latestZScore;
}

/** Sintetiza ticks do dataset de replay e envia ao worker em uma unica
 *  chamada (o dataset cabe folgado na capacidade default do RingBuffer).
 *  Atualiza o zScore que dirige o glow de estresse do bio-reactor. Recusa
 *  rodar enquanto o feed live MEXC esta ativo — os dois nunca ingerem no
 *  mesmo ring buffer ao mesmo tempo (ver startLiveOrderflowFeed). */
export async function runReplayThroughOrderflow({ client, dataset, ticksPerCandle = 12 }) {
    if (isLiveFeedRunning()) {
        throw new Error('feed_live_mexc_ativo_pare_antes_de_rodar_replay_sintetico');
    }
    const ticks = synthesizeTicksFromCandles(dataset.candles || [], { ticksPerCandle });
    const payload = ticks.map((t) => ({ timestamp: t.timestamp, price: t.price, volume: t.volume, side: t.side, exchange: t.exchange }));
    const result = await client.ingestTicks(payload);
    latestZScore = nextStressZScore(result.signals);
    return { ticksProcessed: ticks.length, ingested: result.ingested, signals: result.signals };
}

export function isLiveFeedRunning() {
    return !!livePoller && livePoller.isRunning();
}

/** 1 ciclo de ingestao real (chamado pelo poller a cada intervalo, ver
 *  mexc-trades-stream.js:createLivePoller). Ciclo sem trade novo ou com a
 *  sonda fora de ACTIVE_READ_ONLY nunca chama o worker — silencio real e
 *  reportado como tal ao chamador (onUpdate), nunca como ingestao
 *  fantasma, para a UI nunca exibir um badge "LIVE" congelado depois que
 *  a rede cair. */
async function ingestLiveCycle(client, { state, ticks, probe_detail }, onUpdate) {
    if (state !== CONNECTOR_STATES.ACTIVE_READ_ONLY || ticks.length === 0) {
        onUpdate?.({ state, newTicks: 0, ingested: 0, signals: [], probeDetail: probe_detail });
        return;
    }
    const payload = ticks.map((t) => ({ timestamp: t.timestamp, price: t.price, volume: t.volume, side: t.side, exchange: t.exchange }));
    const result = await client.ingestTicks(payload);
    latestZScore = nextStressZScore(result.signals);
    onUpdate?.({ state, newTicks: ticks.length, ingested: result.ingested, signals: result.signals, probeDetail: probe_detail });
}

/** Inicia o feed real de trades MEXC (task #37, Tick.exchange =
 *  MEXC_SPOT_LIVE) — mutuamente exclusivo com o replay sintetico enquanto
 *  ativo (ver runReplayThroughOrderflow). onUpdate(payload) e chamado a
 *  cada ciclo de polling (~intervalMs), mesmo sem trade novo ou com falha
 *  de rede, para a UI sempre refletir o estado real desta sessao. No-op
 *  se um feed live ja esta rodando (1 poller ativo por vez). */
export function startLiveOrderflowFeed({ client, symbol = 'BTC', intervalMs = 4000, onUpdate }) {
    if (isLiveFeedRunning()) return;
    livePoller = createLivePoller({
        symbol,
        intervalMs,
        onResult: (cycleResult) => { ingestLiveCycle(client, cycleResult, onUpdate); },
    });
    livePoller.start();
}

export function stopLiveOrderflowFeed() {
    if (livePoller) livePoller.stop();
    livePoller = null;
}
