// normalizer.js — Normalização (Fase B / V15 Cap. 2: "Raw Connectors ->
// Normalizer"). Converte candles de QUALQUER conector para a forma
// canônica única {t,o,h,l,c,v} (t em segundos — mesma convenção já usada
// em toda a base, ver js/real-data/binance-public.js). Hoje o único
// conector real (Binance klines, via binance-candle-connector.js) já
// entrega exatamente esta forma; esta função existe para que um futuro
// segundo conector (V15 Cap. 3: MEXC/Bybit/OKX klines) nunca precise que
// analysis-frame.js, target-tracker.js ou App.tsx saibam de onde os dados
// vieram — todos consomem sempre esta mesma forma.
//
// Função pura, nunca fabrica um candle: linhas malformadas (campo
// ausente/NaN) são descartadas silenciosamente da série normalizada, nunca
// preenchidas com um valor inventado. A rejeição da série INTEIRA por
// integridade estrutural é responsabilidade de integrity-validator.js, não
// desta função.
export function normalizeCandles(rawCandles) {
    if (!Array.isArray(rawCandles)) return [];
    const out = [];
    for (const row of rawCandles) {
        if (!row || typeof row !== 'object') continue;
        const t = Number(row.t);
        const o = Number(row.o);
        const h = Number(row.h);
        const l = Number(row.l);
        const c = Number(row.c);
        const v = Number(row.v);
        if (![t, o, h, l, c, v].every(Number.isFinite)) continue;
        out.push({ t, o, h, l, c, v });
    }
    return out;
}
