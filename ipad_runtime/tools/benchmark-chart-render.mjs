#!/usr/bin/env node
// benchmark-chart-render.mjs — bancada de desempenho do gráfico real
// (Lightweight Charts, o motor único do memo "Objetivo" — item 1: "MANTER
// Lightweight Charts... Não substituir por outra biblioteca sem prova
// objetiva de que a atual não consegue cumprir o requisito", e item 17:
// "Adicionar benchmark no iPad/Safari para: 500/1.000/5.000/10.000 candles
// e realtime ticks. Registrar: FPS, latência, memória, CPU, tempo de
// renderização.").
//
// POR QUE ESTE ARQUIVO EXISTE
// A auditoria do memo (SYSTEM_HANDBOOK.md §6.93, item 17) achou que esta
// medição não existia como suíte própria — `npm run verify` cobre
// correção (tsc/vitest/build), nunca desempenho sob carga. "Não substituir
// a lib sem prova objetiva" e "não introduzir DuckDB-WASM/WebGPU sem
// benchmark" (itens 1, 10, 12, 19) pressupõem justamente esta ferramenta:
// sem ela, qualquer decisão futura sobre performance seria opinião, não
// medição — a mesma fabricação que a Regra de Ouro 1/2 do CLAUDE.md proíbe.
//
// POR QUE UM SCRIPT E NÃO PARTE DE `npm run verify`
// Depende de `playwright` (Chromium real), que não é dependência do
// projeto (custo de instalação/rede que o portão de CI de toda rodada —
// `.github/workflows/testes.yml`, zero passo de deploy, zero segredo — não
// deveria pagar). Roda como ferramenta de bancada, sob demanda, mesmo
// espírito de `measure-reversal-lead.mjs`/`run-backtest.mjs`.
//
// USO
//   node ipad_runtime/tools/benchmark-chart-render.mjs
//   node ipad_runtime/tools/benchmark-chart-render.mjs --counts 500,2000,8000
//   node ipad_runtime/tools/benchmark-chart-render.mjs --json
//
// O QUE ELE MEDE, PASSO A PASSO
//   1. Gera candles OHLCV SINTÉTICOS determinísticos (passeio aleatório com
//      semente fixa — nunca dado de mercado real, rotulado como tal em
//      toda saída, mesma disciplina de SYNTHETIC_MARKERS em
//      run-backtest.mjs).
//   2. Sobe um servidor HTTP local só para servir o bundle standalone REAL
//      de `lightweight-charts` (node_modules/, a mesma versão 5.x que o
//      app usa) — zero mock da lib.
//   3. Para cada contagem de candles: cria um `IChartApi` REAL
//      (`createChart`+`addSeries(CandlestickSeries)`, a MESMA chamada de
//      `EnhancedChart_110_Percent.tsx`), mede o tempo até o 2º
//      `requestAnimationFrame` depois de `setData` (tempo de renderização
//      real), depois roda 1,5s de pan sintético (`scrollToPosition` em
//      seno) amostrando FPS real quadro a quadro via `requestAnimationFrame`
//      — não um número estimado.
//
// HONESTIDADE DO RESULTADO (limitações reais, nunca escondidas)
//   - Este é Chromium headless neste sandbox, NÃO Safari/iPad real. FPS,
//     memória e bateria em iPad físico exigem verificação própria do
//     Operador — este número é um piso de referência real, não a medição
//     final que o item 13 do memo (iPad-first) pede.
//   - Mede só o motor `lightweight-charts` com 1 série de candles — não os
//     ~14 plugins de overlay simultâneos que o app real desenha por cima.
//     Um benchmark "full-stack" (todas as camadas ativas) é evolução
//     futura, fora do escopo desta 1ª bancada.
//   - `performance.memory` é API não-padrão do Chromium — sem equivalente
//     medido aqui para Safari.
//   - Execução única por contagem (sem repetição estatística) — ruído de
//     máquina/CI pode mover o número de uma rodada para outra; trate como
//     ORDEM DE GRANDEZA, não como medição de laboratório controlado.
//
// READ_ONLY: zero rede além de servir o arquivo local da própria lib já
// instalada; zero escrita fora de um diretório temporário do SO.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, writeFile, rm } from "node:fs/promises";

const here = dirname(fileURLToPath(import.meta.url));
const RAMBER_UI_ROOT = resolve(here, "../ramber-ui");
const CHART_LIB_PATH = resolve(
  RAMBER_UI_ROOT,
  "node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js",
);

// Semente fixa (mulberry32, PRNG determinístico e leve — zero dependência
// nova) — mesmo candle sintético em toda execução, resultado reprodutível.
function mulberry32(seed) {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Passeio aleatório OHLCV determinístico — SINTÉTICO, nunca dado de
 *  mercado real (mesma disciplina de SYNTHETIC_MARKERS em
 *  run-backtest.mjs). Exportado para teste de execução real (lógica pura
 *  de fronteira). */
export function generateSyntheticCandles(count, seed = 42, startPrice = 60000, intervalSeconds = 60) {
  if (!Number.isFinite(count) || count <= 0) return [];
  const rand = mulberry32(seed);
  const candles = [];
  let price = startPrice;
  let time = Math.floor(Date.UTC(2026, 0, 1) / 1000) - count * intervalSeconds;
  for (let i = 0; i < count; i++) {
    const changePct = (rand() - 0.5) * 0.006; // passeio realista, +-0.3%/candle
    const open = price;
    const close = open * (1 + changePct);
    const high = Math.max(open, close) * (1 + rand() * 0.0015);
    const low = Math.min(open, close) * (1 - rand() * 0.0015);
    candles.push({ time, open: round2(open), high: round2(high), low: round2(low), close: round2(close) });
    price = close;
    time += intervalSeconds;
  }
  return candles;
}

function parseArgs(argv) {
  const out = { counts: [500, 1000, 5000, 10000], json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") {
      out.json = true;
      continue;
    }
    if (a === "--counts" && argv[i + 1]) {
      out.counts = argv[i + 1]
        .split(",")
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      i++;
    }
  }
  return out;
}

const PAGE_HTML = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#0b0f14}#chart{width:960px;height:600px}</style>
</head><body>
<div id="chart"></div>
<script src="/lightweight-charts.standalone.production.js"></script>
<script>
window.__bench = async (candles) => {
  const container = document.getElementById('chart');
  container.innerHTML = '';
  const raf = () => new Promise((resolve) => requestAnimationFrame(resolve));

  const t0 = performance.now();
  const chart = LightweightCharts.createChart(container, {
    width: 960, height: 600,
    layout: { attributionLogo: false },
  });
  const series = chart.addSeries(LightweightCharts.CandlestickSeries, {});
  series.setData(candles);
  await raf();
  await raf();
  const setDataMs = performance.now() - t0;

  const timeScale = chart.timeScale();
  const frameTimes = [];
  const stressDurationMs = 1500;
  let prev = await raf();
  const stressStart = prev;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const now = await raf();
    frameTimes.push(now - prev);
    prev = now;
    const elapsed = now - stressStart;
    const shift = Math.sin(elapsed / 120) * (candles.length * 0.02);
    timeScale.scrollToPosition(shift, false);
    if (elapsed >= stressDurationMs) break;
  }

  const heapMB = performance.memory ? performance.memory.usedJSHeapSize / (1024 * 1024) : null;
  chart.remove();

  const avgFrameMs = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const p95FrameMs = sorted[Math.floor(sorted.length * 0.95)] ?? avgFrameMs;
  return {
    setDataMs: Math.round(setDataMs),
    avgFps: Math.round(1000 / avgFrameMs),
    p95FrameMs: Math.round(p95FrameMs * 100) / 100,
    jsHeapMB: heapMB !== null ? Math.round(heapMB * 10) / 10 : null,
    frameSamples: frameTimes.length,
  };
};
window.__benchReady = true;
</script>
</body></html>`;

async function startServer(tmpDir) {
  const chartLibSrc = await readFile(CHART_LIB_PATH);
  const server = createServer((req, res) => {
    if (req.url === "/lightweight-charts.standalone.production.js") {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end(chartLibSrc);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(PAGE_HTML);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}/` };
}

async function main() {
  const { counts, json } = parseArgs(process.argv);

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error(
      "benchmark-chart-render.mjs requer o pacote `playwright` (Chromium real) — não é dependência do projeto.\n" +
        "Instale com: npm install -D playwright && npx playwright install chromium\n" +
        "(ferramenta de bancada, fora do npm run verify/CI de propósito — ver cabeçalho do arquivo).",
    );
    process.exitCode = 1;
    return;
  }

  const tmpDir = await mkdtemp(join(tmpdir(), "ar10-chart-bench-"));
  const { server, url } = await startServer(tmpDir);
  const browser = await chromium.launch({
    args: ["--enable-precise-memory-info"],
  });

  const results = [];
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(() => window.__benchReady === true);

    for (const count of counts) {
      const candles = generateSyntheticCandles(count);
      const result = await page.evaluate((c) => window.__bench(c), candles);
      results.push({ candles: count, ...result });
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await rm(tmpDir, { recursive: true, force: true });
  }

  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log("\nBancada de renderização — Lightweight Charts (Chromium headless, dado SINTÉTICO)\n");
  console.log(
    ["candles", "setData(ms)", "FPS médio", "p95 frame(ms)", "heap JS(MB)"]
      .map((h) => h.padEnd(14))
      .join(""),
  );
  for (const r of results) {
    console.log(
      [
        String(r.candles),
        String(r.setDataMs),
        String(r.avgFps),
        String(r.p95FrameMs),
        r.jsHeapMB !== null ? String(r.jsHeapMB) : "n/d",
      ]
        .map((v) => v.padEnd(14))
        .join(""),
    );
  }
  console.log(
    "\nLimitações honestas: Chromium headless neste sandbox, não Safari/iPad real; só a série de candles, sem os ~14 plugins de overlay; execução única (sem repetição estatística) — ver cabeçalho do arquivo.\n",
  );
}

main();
