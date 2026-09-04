// signal-engine.js — Motor de sinais de order flow (OFI, Absorption,
// Exhaustion). Porta da Skill 4 (Use Cases Event-Driven) de
// golden-master.html, com uma diferenca deliberada: o estado do engine
// nao e mais um singleton de modulo, e sim criado por createEngineState()
// e passado explicitamente para processSignals(). Isso elimina estado
// global escondido (alinhado ao padrao "pura funcao de calculo: zero
// fetch, zero rede, zero estado global" dos demais engines em
// src/research/engines/) e permite varias instancias/testes isolados sem
// reset manual. A matematica e identica byte-a-byte ao golden master.
//
// Pura funcao de calculo sobre ticks publicos (preco/volume/lado) — nunca
// network, nunca ordem, nunca decisao de compra/venda.
//
// Honestidade de nomenclatura (Ordem EPC-05, "pesquisar a matematica" —
// pesquisa real confirmada antes de documentar): o "OFI" deste motor NAO
// e' o Order-Flow Imbalance formal de Cont/Kukanov/Stoikov ("The Price
// Impact of Order Book Events", 2014/2010) — aquele e' definido sobre
// EVENTOS DO LIVRO DE OFERTAS (mudancas no tamanho da fila no melhor
// bid/ask), nao sobre trades executados. O que este motor calcula e' um
// desequilibrio real de VOLUME AGRESSOR (compra vs. venda) numa janela de
// ticks de trade — uma metrica real e amplamente usada em terminais de
// order flow (Bookmap/ATAS/Sierra Chart chamam variantes disso de "Delta"/
// "Trade Imbalance"), mas estruturalmente diferente do OFI academico.
// Este projeto nao tem (e nao pode fabricar, Regra de Ouro 1) uma fonte
// real de L2/livro de ofertas — so o poller publico de trades da MEXC
// (mexc-trades-stream.js) — entao o OFI academico e' honestamente
// impossivel de calcular aqui, nao uma omissao por preguica.

import { Side, SignalType, Signal } from './value-objects.js';

export const metadata = {
    engine: 'signal-engine',
    description: 'Sinais de microestrutura (desequilibrio de volume agressor tipo "OFI", Absorption, Exhaustion) sobre uma janela de ticks publicos de trades.',
    concepts: ['Trade-based Order Flow Imbalance (nao o OFI de livro de ofertas de Cont/Kukanov/Stoikov)', 'Volume Absorption', 'Delta Exhaustion (z-score + reversao de preco)'],
    required_data: ['trade_ticks (price, volume, side, timestamp)'],
    status: 'ACTIVE_READ_ONLY',
    limitations: [
        'Roda inteiramente sobre os ticks recebidos nesta sessao (REPLAY sintetico ou stream publico real) — nunca extrapola tick que nao foi observado.',
        'Exhaustion exige amostra >= deltaLookback antes de poder emitir qualquer sinal; abaixo disso e silencio, nunca um falso sinal.',
        '"OFI" aqui e desequilibrio de volume agressor sobre trades (ver nota de nomenclatura acima) — nao o OFI formal de livro de ofertas, que exigiria dado L2 que este projeto nao tem.',
    ],
};

export const defaultSettings = Object.freeze({
    ofi: Object.freeze({
        windowSize: 400,
        imbalanceThreshold: 0.6,
        minVolume: 100,
        cooldownMs: 500,
    }),
    absorption: Object.freeze({
        absorptionThreshold: 0.7,
        timeWindowMs: 5000,
        minAbsorptionVolume: 500,
    }),
    exhaustion: Object.freeze({
        deltaLookback: 500,
        exhaustionThreshold: 3.0,
        // Achado real de auditoria (Ordem EPC-05): comparado direto contra
        // um retorno fracionario bruto de preco nos ultimos 10 ticks, 0.2
        // exige um movimento de PRECO de 20% dentro de so' 10 trades para
        // confirmar reversao — uma barra alta para o cadenciamento real de
        // tick da MEXC (poller publico, nao um stream denso). Nao ha dado
        // real de estatistica de tick nesta base para julgar se 0.2 esta
        // calibrado ou foi herdado sem ajuste do replay sintetico de
        // golden-master.html; mudar o numero sem essa evidencia seria
        // "tentativa e erro" (a propria Ordem EPC-05 proibe). Registrado
        // honestamente, nao alterado — ver signal-engine.test.ts.
        reversalConfirmation: 0.2,
        minDeltaVolume: 1000,
    }),
});

export function createEngineState() {
    return {
        ofi: { buyVol: 0, sellVol: 0, count: 0, lastSig: 0 },
        absorption: { buyVol: 0, sellVol: 0, priceStart: 0, startTime: 0, active: false },
        exhaustion: { deltaHist: [], priceHist: [], currentDelta: 0 },
        // CVD — Cumulative Volume Delta: soma corrida de +volume (compra) /
        // -volume (venda) desde a criacao deste engine state, nunca
        // resetada (diferente do delta rolante de exhaustion, que zera a
        // cada sinal). E' o mesmo acumulador cru que qualquer CVD real usa;
        // como este processo so ve os ticks desde que o app abriu, o valor
        // e' honestamente "CVD da sessao", nao "CVD 24h" — nao ha historico
        // de ticks anterior a sessao atual para fingir o contrario.
        cvd: { value: 0 },
    };
}

function mean(arr) {
    if (arr.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i];
    return sum / arr.length;
}

function stdDev(arr, avg) {
    if (arr.length < 2) return 0;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += Math.pow(arr[i] - avg, 2);
    return Math.sqrt(sum / (arr.length - 1));
}

/**
 * Forma estrutural real de `defaultSettings` (tipada explicitamente —
 * achado real da Ordem EPC-05: sem esta anotação, TS infere os literais
 * exatos de `defaultSettings`, ex. `windowSize: 400` em vez de `number`,
 * porque `settings = defaultSettings` é o único sinal de tipo que o
 * parâmetro tinha. Isso nunca incomodou nenhum consumidor até agora
 * porque nenhum atravessava a fronteira JS→TS tipada — o primeiro foi
 * `signal-engine.test.ts` desta própria Ordem, testando `settings`
 * customizados/menores para não precisar de 500 ticks reais por caso).
 * Puramente uma anotação JSDoc: zero mudança de comportamento em tempo
 * de execução.
 * @typedef {Object} SignalEngineSettings
 * @property {{windowSize: number, imbalanceThreshold: number, minVolume: number, cooldownMs: number}} ofi
 * @property {{absorptionThreshold: number, timeWindowMs: number, minAbsorptionVolume: number}} absorption
 * @property {{deltaLookback: number, exhaustionThreshold: number, reversalConfirmation: number, minDeltaVolume: number}} exhaustion
 */

/** Processa um lote de Tick (ordem cronologica) e devolve os Signal
 *  emitidos. `state` e mutado incrementalmente (e o acumulador entre
 *  lotes); `settings` e opcional e cai em defaultSettings congelado.
 *  @param {InstanceType<typeof import('./value-objects.js').Tick>[]} ticks
 *  @param {ReturnType<typeof createEngineState>} state
 *  @param {SignalEngineSettings} [settings]
 */
export function processSignals(ticks, state, settings = defaultSettings) {
    const signals = [];
    const now = Date.now();

    for (let ti = 0; ti < ticks.length; ti++) {
        const tick = ticks[ti];

        // CVD — atualizado uma vez por tick, nunca resetado.
        state.cvd.value += tick.side === Side.BUY ? tick.volume : -tick.volume;

        // OFI — Order Flow Imbalance sobre janela de N ticks.
        const ofi = state.ofi;
        tick.side === Side.BUY ? (ofi.buyVol += tick.volume) : (ofi.sellVol += tick.volume);
        ofi.count++;
        if (ofi.count >= settings.ofi.windowSize) {
            const tot = ofi.buyVol + ofi.sellVol;
            const imb = tot > 0 ? (ofi.buyVol - ofi.sellVol) / tot : 0;
            if (Math.abs(imb) > settings.ofi.imbalanceThreshold && tot >= settings.ofi.minVolume && now - ofi.lastSig > settings.ofi.cooldownMs) {
                signals.push(new Signal({
                    type: SignalType.OFI,
                    confidence: Math.abs(imb),
                    price: tick.price,
                    timestamp: now,
                    metadata: { imbalance: imb, buyVol: ofi.buyVol, sellVol: ofi.sellVol },
                }));
                ofi.lastSig = now;
            }
            ofi.buyVol = 0;
            ofi.sellVol = 0;
            ofi.count = 0;
        }

        // ABSORPTION — volume alto sem deslocamento de preco numa janela de tempo.
        const abs = state.absorption;
        tick.side === Side.BUY ? (abs.buyVol += tick.volume) : (abs.sellVol += tick.volume);
        if (!abs.active) {
            abs.active = true;
            abs.priceStart = tick.price;
            abs.startTime = now;
            abs.buyVol = 0;
            abs.sellVol = 0;
        }
        const elapsed = now - abs.startTime;
        if (elapsed >= settings.absorption.timeWindowMs) {
            const tv = abs.buyVol + abs.sellVol;
            const pc = Math.abs(tick.price - abs.priceStart) / abs.priceStart;
            if (tv >= settings.absorption.minAbsorptionVolume && pc < 0.001) {
                const ratio = tv / (pc + 0.0001);
                if (ratio > settings.absorption.absorptionThreshold * 1000) {
                    signals.push(new Signal({
                        type: SignalType.ABSORPTION,
                        confidence: Math.min(ratio / 1000, 1.0),
                        price: tick.price,
                        timestamp: now,
                        metadata: { totalVolume: tv, priceChange: pc, buyVol: abs.buyVol, sellVol: abs.sellVol },
                    }));
                }
            }
            abs.active = false;
            abs.buyVol = 0;
            abs.sellVol = 0;
        }

        // EXHAUSTION — delta acumulado em z-score extremo + reversao de preco confirmada.
        const exh = state.exhaustion;
        const td = tick.side === Side.BUY ? tick.volume : -tick.volume;
        exh.currentDelta += td;
        exh.deltaHist.push(exh.currentDelta);
        exh.priceHist.push(tick.price);
        const lb = settings.exhaustion.deltaLookback;
        if (exh.deltaHist.length > lb) {
            exh.deltaHist.shift();
            exh.priceHist.shift();
        }
        if (exh.deltaHist.length >= lb) {
            const dm = mean(exh.deltaHist);
            const ds = stdDev(exh.deltaHist, dm);
            const zs = ds > 0 ? (exh.currentDelta - dm) / ds : 0;
            if (Math.abs(zs) > settings.exhaustion.exhaustionThreshold && Math.abs(exh.currentDelta) > settings.exhaustion.minDeltaVolume) {
                const rp = exh.priceHist.slice(-10);
                const pc2 = (rp[rp.length - 1] - rp[0]) / rp[0];
                const isRev = (zs > 0 && pc2 < -settings.exhaustion.reversalConfirmation) || (zs < 0 && pc2 > settings.exhaustion.reversalConfirmation);
                if (isRev) {
                    signals.push(new Signal({
                        type: SignalType.EXHAUSTION,
                        confidence: Math.min(Math.abs(zs) / (settings.exhaustion.exhaustionThreshold * 2), 1.0),
                        price: tick.price,
                        timestamp: now,
                        metadata: { delta: exh.currentDelta, zScore: zs, priceChange: pc2, direction: zs > 0 ? 'BUY_EXHAUSTED' : 'SELL_EXHAUSTED' },
                    }));
                    exh.currentDelta = 0;
                    exh.deltaHist = [];
                }
            }
        }
    }

    return signals;
}
