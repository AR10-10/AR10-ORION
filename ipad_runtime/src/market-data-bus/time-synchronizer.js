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

export function isStale(ageMs, maxAgeMs) {
    if (!Number.isFinite(ageMs)) return true;
    return ageMs > maxAgeMs;
}
