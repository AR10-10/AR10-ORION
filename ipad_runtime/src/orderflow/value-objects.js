// value-objects.js — Tick/Signal/enums imutaveis do Order Flow Engine.
// Porta fiel da Skill 2 (Value Objects Imutaveis) de golden-master.html:
// todo campo e congelado na construcao (Object.freeze), entao um Signal
// emitido pelo engine nunca pode ser adulterado entre o worker e a UI.

export const Side = Object.freeze({ BUY: 'BUY', SELL: 'SELL' });

export const SignalType = Object.freeze({
    OFI: 'OFI',
    ABSORPTION: 'ABSORPTION',
    EXHAUSTION: 'EXHAUSTION',
});

export const DataState = Object.freeze({
    LIVE: 'LIVE',
    SNAPSHOT: 'SNAPSHOT',
    REPLAY: 'REPLAY',
    STALE: 'STALE',
    INSUFFICIENT: 'INSUFFICIENT',
    STANDBY: 'STANDBY',
});

export class Tick {
    constructor({ timestamp, price, volume, side, exchange = 'MEXC' }) {
        this.timestamp = timestamp;
        this.price = price;
        this.volume = volume;
        this.side = side;
        this.exchange = exchange;
        Object.freeze(this);
    }

    toRingEntry() {
        return {
            timestamp: this.timestamp,
            price: this.price,
            volume: this.volume,
            sideFlag: this.side === Side.BUY ? 1.0 : -1.0,
        };
    }

    static fromRingEntry(t, p, v, s) {
        return new Tick({
            timestamp: t,
            price: p,
            volume: v,
            side: s > 0 ? Side.BUY : Side.SELL,
        });
    }
}

/**
 * Forma real (não exaustiva — cada motor só preenche os campos que
 * realmente calcula) dos metadados que signal-engine.js anexa a cada
 * Signal. Anotação JSDoc pura (Ordem EPC-05): zero mudança de
 * comportamento, só torna `signal.metadata.imbalance` etc. tipado para
 * quem consome este arquivo de um `.ts` (signal-engine.test.ts).
 * @typedef {Object} SignalMetadata
 * @property {number} [imbalance]
 * @property {number} [buyVol]
 * @property {number} [sellVol]
 * @property {number} [totalVolume]
 * @property {number} [priceChange]
 * @property {number} [delta]
 * @property {number} [zScore]
 * @property {'BUY_EXHAUSTED'|'SELL_EXHAUSTED'} [direction]
 */

export class Signal {
    /** @param {{type: string, confidence: number, price: number, timestamp: number, metadata?: SignalMetadata}} opts */
    constructor({ type, confidence, price, timestamp, metadata = {} }) {
        this.type = type;
        this.confidence = confidence;
        this.price = price;
        this.timestamp = timestamp;
        this.metadata = metadata;
        Object.freeze(this);
    }
}
