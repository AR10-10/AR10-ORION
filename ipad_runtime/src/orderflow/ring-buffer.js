// ring-buffer.js — Buffer circular zero-copy do Order Flow Engine.
// Porta fiel da Skill 9 (Zero-Copy SharedArrayBuffer & Ring Buffer) de
// golden-master.html sobre SharedArrayBuffer + Float64Array. GitHub Pages
// nao envia headers COOP/COEP por padrao, entao sem crossOriginIsolated o
// runtime cai no fallback Array (zero-copy degrada para copia) —
// comportamento esperado e fail-safe, nunca um erro.
//
// IMPORTANTE (corrige uma suposicao do golden master): head/tail vivem
// como campos de instancia JS, nao em `meta` (que so reserva o espaco e
// nunca e lido/escrito) — entao esta classe e segura apenas com produtor
// e consumidor no MESMO thread/instancia. Compartilhar `this.sab` cru com
// outra instancia em outra thread SEM coordenacao via Atomics sobre
// `meta` corromperia dados (duas threads cada uma com seu proprio
// head/tail desincronizado). Por isso o orderflow-worker.js mantem sua
// propria RingBuffer inteiramente dentro do worker (ticks chegam por
// postMessage, volume baixo o suficiente para nao precisar de SAB
// cross-thread real) em vez de compartilhar o buffer com a main thread.

import { Tick } from './value-objects.js';

const ENTRY_SIZE = 4; // timestamp, price, volume, sideFlag
const META_SIZE = 2;

export class RingBuffer {
    constructor(capacity) {
        this.capacity = capacity || 65536;
        this.useSAB = typeof SharedArrayBuffer !== 'undefined';
        if (this.useSAB) {
            const totalFloats = META_SIZE + this.capacity * ENTRY_SIZE;
            const totalBytes = totalFloats * Float64Array.BYTES_PER_ELEMENT;
            this.sab = new SharedArrayBuffer(totalBytes);
            this.meta = new Int32Array(this.sab, 0, META_SIZE);
            this.data = new Float64Array(this.sab, META_SIZE * Float64Array.BYTES_PER_ELEMENT, this.capacity * ENTRY_SIZE);
            this.head = 0;
            this.tail = 0;
        } else {
            this.fallback = [];
        }
    }

    enqueue(tick) {
        if (!this.useSAB) {
            this.fallback.push(tick);
            if (this.fallback.length > this.capacity) this.fallback.shift();
            return true;
        }
        const entry = tick.toRingEntry();
        const offset = this.head * ENTRY_SIZE;
        this.data[offset] = entry.timestamp;
        this.data[offset + 1] = entry.price;
        this.data[offset + 2] = entry.volume;
        this.data[offset + 3] = entry.sideFlag;
        this.head = (this.head + 1) % this.capacity;
        if (this.head === this.tail) this.tail = (this.tail + 1) % this.capacity;
        return true;
    }

    drain() {
        if (!this.useSAB) {
            const ticks = [...this.fallback];
            this.fallback = [];
            return ticks;
        }
        const ticks = [];
        while (this.tail !== this.head) {
            const offset = this.tail * ENTRY_SIZE;
            ticks.push(Tick.fromRingEntry(
                this.data[offset],
                this.data[offset + 1],
                this.data[offset + 2],
                this.data[offset + 3],
            ));
            this.tail = (this.tail + 1) % this.capacity;
        }
        return ticks;
    }

    count() {
        if (!this.useSAB) return this.fallback.length;
        return (this.head - this.tail + this.capacity) % this.capacity;
    }

    isEmpty() {
        return this.count() === 0;
    }
}
