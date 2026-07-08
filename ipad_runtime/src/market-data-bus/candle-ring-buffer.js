// candle-ring-buffer.js — buffer zero-copy do snapshot de candles do Market
// Data Bus (Fase B / V15 Cap. 16.1 "Zero-Copy Architecture"). Segue o MESMO
// padrão de src/orderflow/ring-buffer.js (SharedArrayBuffer + Float64Array,
// fallback automático para TypedArray comum quando crossOriginIsolated não
// está disponível — GitHub Pages não envia COOP/COEP por padrão) — mas é um
// arquivo NOVO e independente, não uma edição daquele: src/orderflow/ fica
// intocado por instrução permanente desta sessão.
//
// Diferença de forma proposital: ticks do Order Flow chegam um de cada vez
// (stream real, por isso ring-buffer.js usa enqueue()/drain() com
// head/tail). Candles reais chegam como uma JANELA COMPLETA a cada sonda
// REST (ver js/real-data/binance-public.js) — nunca um delta. Por isso este
// buffer expõe setAll()/toArray() (sobrescrita da janela inteira) em vez de
// fingir um ponteiro de stream que este dado não tem.
const FIELDS = 6; // t, o, h, l, c, v

export class CandleRingBuffer {
    constructor(capacity = 200) {
        this.capacity = capacity;
        this.length = 0;
        this.useSAB = typeof SharedArrayBuffer !== 'undefined';
        if (this.useSAB) {
            this.sab = new SharedArrayBuffer(capacity * FIELDS * Float64Array.BYTES_PER_ELEMENT);
            this.data = new Float64Array(this.sab);
        } else {
            this.data = new Float64Array(capacity * FIELDS);
        }
    }

    /** Sobrescreve o buffer inteiro com a janela real mais recente (mais
     *  antigo primeiro, mesma ordem que os conectores já entregam). Trunca
     *  para os últimos `capacity` candles se a janela recebida for maior —
     *  nunca redimensiona o buffer em tempo de execução (RAM previsível,
     *  requisito explícito do iPad). */
    setAll(candles) {
        const n = Math.min(candles.length, this.capacity);
        const start = candles.length - n;
        for (let i = 0; i < n; i++) {
            const c = candles[start + i];
            const offset = i * FIELDS;
            this.data[offset] = c.t;
            this.data[offset + 1] = c.o;
            this.data[offset + 2] = c.h;
            this.data[offset + 3] = c.l;
            this.data[offset + 4] = c.c;
            this.data[offset + 5] = c.v;
        }
        this.length = n;
    }

    /** Materializa a janela atual de volta em objetos {t,o,h,l,c,v} — só
     *  aloca no momento em que algo realmente precisa ler os candles como
     *  objetos (analysis-frame.js, gráfico); o buffer em si nunca guarda
     *  200 objetos JS, só floats contíguos. */
    toArray() {
        const out = new Array(this.length);
        for (let i = 0; i < this.length; i++) {
            const offset = i * FIELDS;
            out[i] = {
                t: this.data[offset],
                o: this.data[offset + 1],
                h: this.data[offset + 2],
                l: this.data[offset + 3],
                c: this.data[offset + 4],
                v: this.data[offset + 5],
            };
        }
        return out;
    }
}
