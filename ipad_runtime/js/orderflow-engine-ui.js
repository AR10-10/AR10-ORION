// orderflow-engine-ui.js — Orquestra o Order Flow Engine (Skills 1, 2, 4,
// 8, 9 do golden master) nesta tela: inicializa o worker dedicado + o
// BioReactorRenderer, alimenta o worker com ticks sinteticos derivados do
// dataset de replay (ver src/orderflow/candle-tick-synthesizer.js —
// HONESTIDADE: nao e fita de negociacao real, sempre DataState.REPLAY) e
// mantem o canvas animado via requestAnimationFrame. app.js chama estas
// funcoes a partir do boot() e do handler do botao "Rodar Order Flow
// Replay"; o unico estado de modulo aqui e o handle do loop de animacao e
// o ultimo zScore observado, necessarios porque so' existe 1 canvas/rAF
// ativo por sessao nesta tela.

import { OrderflowWorkerClient } from './orderflow-client.js';
import { synthesizeTicksFromCandles } from '../src/orderflow/candle-tick-synthesizer.js';
import { BioReactorRenderer } from '../src/orderflow/bio-reactor-render.js';

let rafHandle = null;
let latestZScore = 0;

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
 *  Atualiza o zScore que dirige o glow de estresse do bio-reactor. */
export async function runReplayThroughOrderflow({ client, dataset, ticksPerCandle = 12 }) {
    const ticks = synthesizeTicksFromCandles(dataset.candles || [], { ticksPerCandle });
    const payload = ticks.map((t) => ({ timestamp: t.timestamp, price: t.price, volume: t.volume, side: t.side, exchange: t.exchange }));
    const result = await client.ingestTicks(payload);
    latestZScore = nextStressZScore(result.signals);
    return { ticksProcessed: ticks.length, ingested: result.ingested, signals: result.signals };
}
