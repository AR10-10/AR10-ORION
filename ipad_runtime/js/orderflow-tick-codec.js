// orderflow-tick-codec.js — Zero-Copy expandido (Fase I / V15 Cap. 16.1,
// diretriz 3). Antes desta fase, cada ciclo de polling (~4s) atravessava a
// fronteira main-thread -> orderflow-worker como um ARRAY DE OBJETOS Tick
// (ate 500 por lote): o structured clone copiava campo a campo e deixava
// 500 objetos + 1 array para o GC do Safari recolher — um evento de GC
// PREVISIVEL a cada poll, exatamente o que a diretriz manda eliminar.
//
// Agora o lote viaja como UM Float64Array (4 floats por tick — mesmo
// layout t/price/volume/sideFlag do ring-buffer, mesma convencao
// sideFlag=+1 BUY / -1 SELL de Tick.toRingEntry em value-objects.js) com o
// ArrayBuffer na LISTA DE TRANSFERENCIA do postMessage: transferir move a
// propriedade do buffer entre threads sem copiar byte nenhum, e a main
// thread fica com zero lixo para recolher (o buffer deixa de existir do
// lado dela). Os objetos Tick sao materializados DENTRO do worker
// (unpackTicks), fora da thread de UI — mesmo racional do Actor Model que
// este worker ja usa.
//
// src/orderflow/ permanece INTOCADO (restricao permanente da sessao):
// este codec e um modulo novo em js/, que apenas IMPORTA os value objects
// reais — os ticks que saem de unpackTicks sao instancias Tick identicas
// as de antes, entao RingBuffer/signal-engine nao percebem diferenca.
import { Tick, Side } from '../src/orderflow/value-objects.js';

export const TICK_FIELDS = 4; // t, price, volume, sideFlag

/** Lote de ticks -> Float64Array plano (4 floats/tick). Funcao pura. */
export function packTicks(ticks) {
    const list = Array.isArray(ticks) ? ticks : [];
    const packed = new Float64Array(list.length * TICK_FIELDS);
    for (let i = 0; i < list.length; i++) {
        const t = list[i];
        const offset = i * TICK_FIELDS;
        packed[offset] = t.timestamp;
        packed[offset + 1] = t.price;
        packed[offset + 2] = t.volume;
        packed[offset + 3] = t.side === Side.SELL ? -1 : 1;
    }
    return packed;
}

/** Float64Array plano -> Tick[] reais (mesma classe congelada de
 *  value-objects.js). Funcao pura; ignora um resto de floats que nao
 *  complete um tick (defensivo, nunca inventa um tick parcial). */
export function unpackTicks(packed, exchange = 'MEXC_SPOT_LIVE') {
    if (!packed || typeof packed.length !== 'number') return [];
    const count = Math.floor(packed.length / TICK_FIELDS);
    const out = new Array(count);
    for (let i = 0; i < count; i++) {
        const offset = i * TICK_FIELDS;
        out[i] = new Tick({
            timestamp: packed[offset],
            price: packed[offset + 1],
            volume: packed[offset + 2],
            side: packed[offset + 3] < 0 ? Side.SELL : Side.BUY,
            exchange,
        });
    }
    return out;
}
