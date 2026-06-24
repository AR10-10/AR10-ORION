// replay-engine.js — Replay BTC/USDT local (dataset sintetico offline).
// SIMULACAO LOCAL: nenhuma ordem, nenhuma execucao, nenhuma conexao com
// corretora. Apenas desenha a serie e os indicadores calculados pelo WASM.

export function drawSparkline(canvas, closes, rollingSma) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const all = closes.concat(rollingSma.filter((v) => Number.isFinite(v)));
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = (hi - lo) * 0.08 || 1;
    const yMin = lo - pad;
    const yMax = hi + pad;
    const x = (i, n) => (i / (n - 1)) * (w - 8) + 4;
    const y = (v) => h - 6 - ((v - yMin) / (yMax - yMin)) * (h - 12);

    // Linha de preco (ciano estrutural)
    ctx.beginPath();
    closes.forEach((v, i) => {
        const px = x(i, closes.length);
        const py = y(v);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // SMA overlay (verde) alinhado ao final da serie
    const offset = closes.length - rollingSma.length;
    ctx.beginPath();
    let started = false;
    rollingSma.forEach((v, i) => {
        if (!Number.isFinite(v)) return;
        const px = x(i + offset, closes.length);
        const py = y(v);
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = 'rgba(0, 255, 157, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
}

export async function runReplay({ dataset, workerClient, windowSize, onLog, canvas, onMeta }) {
    const candles = dataset.candles || [];
    const closes = candles.map((c) => c.c);
    onLog?.(`Replay: ${candles.length} candles sinteticos (${dataset.symbol || 'BTCUSDT'}, ${dataset.interval || '1m'}). ${dataset.warning || ''}`, 'warn');

    const t0 = performance.now();
    const { result } = await workerClient.computeSeries(closes, windowSize);
    const elapsed = (performance.now() - t0).toFixed(1);

    drawSparkline(canvas, closes, result.rollingSma);

    onMeta?.({
        count: result.len,
        last: closes[closes.length - 1],
        sma: result.sma,
        ema: result.ema,
        stddev: result.stddev,
        zscore: result.zscoreLast,
        max: result.max,
        min: result.min,
        elapsedMs: elapsed,
        engineVersion: result.engineVersion,
    });

    onLog?.(`Replay concluido em ${elapsed}ms (worker + WASM). SMA${windowSize}=${result.sma.toFixed(2)} | EMA${windowSize}=${result.ema.toFixed(2)} | STDDEV=${result.stddev.toFixed(2)} | Z=${result.zscoreLast.toFixed(3)}`, 'ok');
    onLog?.('Nenhuma ordem foi gerada ou enviada. Simulacao local, somente leitura.', 'dim');
    return result;
}
