// time-synchronizer.js — Sincronização Temporal (Fase B / V15 Cap. 2:
// "Integrity Validator -> Time Synchronizer"). Idade real de um snapshot em
// relação ao relógio local, calculada sempre a partir do timestamp real do
// último candle confirmado — nunca do horário em que o fetch terminou.
// Mesmo princípio já usado por target-tracker.js (STALE_REANALYZE, 15min) e
// por engine-bridge.ts (cache HTF, 5min): "fresco o suficiente" é sempre
// derivado de um dado real, nunca assumido.
export function computeAsOf(candles) {
    if (!Array.isArray(candles) || candles.length === 0) return null;
    const last = candles[candles.length - 1];
    return Number.isFinite(last.t) ? last.t * 1000 : null;
}

export function computeAgeMs(asOfMs, now = Date.now()) {
    if (!Number.isFinite(asOfMs)) return Infinity;
    return Math.max(0, now - asOfMs);
}

// ACHADO REAL (auditoria "zero erro", pedido do Operador): `ageMs > maxAgeMs`
// e' estritamente maior, entao `isStale(0, 0)` devolvia FALSE — ou seja,
// `maxAgeMs: 0` NAO significava "nunca sirva do cache", significava "sirva do
// cache se o snapshot tiver exatamente 0ms". Duas consequencias reais:
//
//   1. replay-engine.js:68 documenta "maxAgeMs:0 no requestSnapshot garante
//      que CADA passo [recoleta]". A garantia escrita nao existia no codigo;
//      so' funcionava por acidente, porque candles de replay sao antigos e
//      computeAgeMs mede a idade do ULTIMO CANDLE, nao do fetch.
//   2. data-quality.test.ts falhava de forma intermitente: com uma serie
//      ancorada em Date.now(), duas chamadas na MESMA milissegundo viravam
//      cache hit, o coletor nunca era chamado de novo e a disponibilidade
//      ficava 1 em vez de 0.5. Uma corrida de relogio, nunca "flake".
//
// maxAgeMs <= 0 passa a significar o que todo mundo ja assumia. Nenhum outro
// valor muda de comportamento: Infinity continua "nunca vence", e os 25s
// reais de DEFAULT_MAX_AGE_MS seguem identicos.
export function isStale(ageMs, maxAgeMs) {
    if (!Number.isFinite(ageMs)) return true;
    if (Number.isNaN(maxAgeMs)) return true; // fail-closed: limiar sem sentido nunca serve cache
    if (maxAgeMs <= 0) return true;          // "nunca sirva do cache"
    return ageMs > maxAgeMs;
}
