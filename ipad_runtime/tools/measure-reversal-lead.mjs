#!/usr/bin/env node
// measure-reversal-lead.mjs — O EXECUTOR da medição de reversão.
//
// POR QUE ESTE ARQUIVO EXISTE
// `nexus/reversal-detector.ts` construiu o instrumento que responde a pergunta
// central do Operador: "quantas barras ANTES a evidência estrutural (CHoCH/
// SuperTrend) vira, comparada com o cruzamento de médias que o Núcleo usa
// hoje?". Mas o instrumento era uma biblioteca sem nenhuma forma de ser
// executado — a MESMA "feature construída até a metade" que esta trilha de
// auditorias passou a sessão inteira consertando, agora criada por mim.
// Este script é a metade que faltava.
//
// POR QUE UM SCRIPT E NÃO UM TESTE
// A rede do ambiente de desenvolvimento remoto nega as 5 corretoras (403 no
// CONNECT do gateway), e o único candle no repositório é declaradamente
// sintético (`replay-fixture.v1.json`: `live: false`, `exchange_connection:
// NONE`). Medir ali produziria um número sobre um gerador, não sobre mercado —
// e reportá-lo como "a medição" seria exatamente a fabricação que a Regra de
// Ouro 1 proíbe. Na máquina do Operador (ver README_LOCAL.md) a rede é aberta
// e este comando produz o número REAL.
//
// USO
//   node ipad_runtime/tools/measure-reversal-lead.mjs
//   node ipad_runtime/tools/measure-reversal-lead.mjs --symbol ETHUSDT --interval 1h
//   node ipad_runtime/tools/measure-reversal-lead.mjs --limit 1500 --json
//
// O QUE ELE FAZ, PASSO A PASSO
//   1. Busca candles REAIS de Futuros (mesmo endpoint que o app usa).
//   2. Roda, barra a barra, os MESMOS motores reais do sistema:
//      - trendBias()  ← a decisão real do Núcleo (importada, nunca copiada)
//      - bos-choch-engine.js  ← CHoCH real
//      - supertrend-engine.js ← flip real
//   3. Emparelha cada virada do Núcleo com a evidência estrutural mais próxima
//      e imprime a vantagem em barras.
//
// HONESTIDADE DO RESULTADO
// A janela de pareamento é SIMÉTRICA: a vantagem pode sair NEGATIVA e o
// relatório vai dizer, com todas as letras, que a troca não vale a pena.
// Este script não tem lado.
//
// READ_ONLY: só faz GET público de candles. Nenhuma chave, nenhuma ordem.

import { trendBias } from '../js/research/research-engine.js';
import { analyze as analyzeBosChoch } from '../src/research/engines/bos-choch-engine.js';
import { computeSuperTrend } from '../src/research/engines/supertrend-engine.js';

const FUTURES_BASE = 'https://fapi.binance.com';
// Mesma janela que o Núcleo real enxerga (engine-bridge.ts: windowSize 20).
const CORE_WINDOW = 20;
// Aquecimento: barras iniciais em que os motores ainda não têm amostra
// suficiente para uma leitura honesta. Descartadas da medição de propósito.
const WARMUP_BARS = 60;

function parseArgs(argv) {
  const out = { symbol: 'BTCUSDT', interval: '15m', limit: 1000, json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') { out.json = true; continue; }
    const v = argv[i + 1];
    if (a === '--symbol' && v) { out.symbol = v.toUpperCase(); i++; }
    else if (a === '--interval' && v) { out.interval = v; i++; }
    else if (a === '--limit' && v) { out.limit = Math.min(1500, Math.max(200, Number(v) || 1000)); i++; }
  }
  return out;
}

async function fetchCandles({ symbol, interval, limit }) {
  const url = `${FUTURES_BASE}/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${encodeURIComponent(limit)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance respondeu ${res.status} — sem dado real, sem medição (fail-closed).`);
  const raw = await res.json();
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('resposta sem candles reais');
  return raw.map((k) => ({
    t: Math.floor(k[0] / 1000),
    o: Number(k[1]), h: Number(k[2]), l: Number(k[3]), c: Number(k[4]), v: Number(k[5]),
  }));
}

/** SMA/EMA reais sobre a janela do Núcleo, na MESMA forma que
 *  analysis-frame.js entrega ao trendBias. */
function frameAt(candles, i) {
  if (i < CORE_WINDOW) return null;
  const w = candles.slice(i - CORE_WINDOW + 1, i + 1);
  const closes = w.map((c) => c.c);
  const sma = closes.reduce((s, x) => s + x, 0) / closes.length;
  const k = 2 / (closes.length + 1);
  let ema = closes[0];
  for (let j = 1; j < closes.length; j++) ema = closes[j] * k + ema * (1 - k);
  return { last_price: candles[i].c, sma, ema };
}

function main() {
  const args = parseArgs(process.argv);

  fetchCandles(args).then((candles) => {
    if (candles.length < WARMUP_BARS + CORE_WINDOW + 10) {
      throw new Error(`histórico curto demais (${candles.length} candles) para uma medição honesta`);
    }

    // --- 1. A decisão REAL do Núcleo, barra a barra ---------------------
    const biasByBar = candles.map((_, i) => {
      const f = frameAt(candles, i);
      return f ? trendBias(f) : 'INDEFINIDO';
    });

    // --- 2. A evidência estrutural REAL, barra a barra ------------------
    // Cada barra é avaliada com o histórico disponível ATÉ ela — nunca com
    // candles do futuro. Sem isso a medição teria lookahead bias e o número
    // sairia bom por trapaça.
    const events = [];
    const seen = new Set();
    for (let i = WARMUP_BARS; i < candles.length; i++) {
      const hist = candles.slice(0, i + 1);

      const bc = analyzeBosChoch({ ohlcv_series: hist, timeframe: args.interval });
      if (bc && bc.status === 'OK' && bc.break && bc.break.type === 'CHOCH') {
        const key = `C:${bc.break.index}:${bc.break.direction}`;
        if (!seen.has(key)) {
          seen.add(key);
          events.push({ source: 'CHOCH', direction: bc.break.direction === 'ALTA' ? 'LONG' : 'SHORT', atIndex: bc.break.index });
        }
      }

      const st = computeSuperTrend(hist);
      if (st && st.status === 'OK' && Array.isArray(st.points)) {
        const flip = st.points.filter((p) => p.flipped).pop();
        if (flip) {
          const key = `S:${flip.index}:${flip.trend}`;
          if (!seen.has(key)) {
            seen.add(key);
            events.push({ source: 'SUPERTREND', direction: flip.trend === 'UP' ? 'LONG' : 'SHORT', atIndex: flip.index });
          }
        }
      }
    }

    // --- 3. Emparelhamento (mesma matemática do reversal-detector) -------
    const biasToDir = (b) => (b === 'ALTA' ? 'LONG' : b === 'BAIXA' ? 'SHORT' : null);
    const samples = [];
    for (let i = WARMUP_BARS + 1; i < biasByBar.length; i++) {
      const prev = biasToDir(biasByBar[i - 1]);
      const curr = biasToDir(biasByBar[i]);
      if (curr === null || curr === prev) continue;
      let best = null, bestDist = Infinity;
      for (const e of events) {
        if (e.direction !== curr) continue;
        const d = Math.abs(i - e.atIndex);
        if (d > CORE_WINDOW) continue;
        if (d < bestDist) { best = e; bestDist = d; }
      }
      if (best) samples.push({ coreIndex: i, evidenceIndex: best.atIndex, leadBars: i - best.atIndex, direction: curr, source: best.source });
    }

    const leads = samples.map((s) => s.leadBars).sort((a, b) => a - b);
    const mid = Math.floor(leads.length / 2);
    const median = leads.length === 0 ? null : (leads.length % 2 === 0 ? (leads[mid - 1] + leads[mid]) / 2 : leads[mid]);
    const earlier = samples.filter((s) => s.leadBars > 0).length;
    const later = samples.filter((s) => s.leadBars < 0).length;
    const tied = samples.filter((s) => s.leadBars === 0).length;

    const report = {
      symbol: args.symbol, interval: args.interval,
      candles: candles.length,
      periodo: { de: new Date(candles[0].t * 1000).toISOString(), ate: new Date(candles[candles.length - 1].t * 1000).toISOString() },
      viradasDoNucleo: biasByBar.slice(WARMUP_BARS).reduce((n, b, i, arr) => (i > 0 && biasToDir(b) && biasToDir(b) !== biasToDir(arr[i - 1]) ? n + 1 : n), 0),
      eventosEstruturais: events.length,
      emparelhadas: samples.length,
      medianaVantagemBarras: median,
      chegouAntes: earlier, chegouDepois: later, empate: tied,
      fonte: 'fapi.binance.com/fapi/v1/klines (REAL)',
    };

    if (args.json) { console.log(JSON.stringify(report, null, 2)); return; }

    console.log(`\n=== MEDIÇÃO DE REVERSÃO — ${report.symbol} ${report.interval} ===`);
    console.log(`Candles reais : ${report.candles}  (${report.periodo.de.slice(0, 10)} → ${report.periodo.ate.slice(0, 10)})`);
    console.log(`Viradas do Núcleo (trendBias real) : ${report.viradasDoNucleo}`);
    console.log(`Eventos estruturais (CHoCH/SuperTrend) : ${report.eventosEstruturais}`);
    console.log(`Viradas emparelhadas : ${report.emparelhadas}`);
    if (median === null) {
      console.log('\nRESULTADO: DADOS_INSUFICIENTES — nenhuma virada emparelhável nesta amostra.');
      return;
    }
    console.log(`\n  Chegou ANTES  : ${earlier}`);
    console.log(`  Empate        : ${tied}`);
    console.log(`  Chegou DEPOIS : ${later}`);
    console.log(`\n  MEDIANA DA VANTAGEM: ${median} barra(s)`);
    if (median > 0) {
      console.log(`\n  → A evidência estrutural virou ${median} barra(s) ANTES do Núcleo, na mediana.`);
      console.log(`    Em ${args.interval}, isso é ${median} × ${args.interval} de antecedência.`);
    } else if (median < 0) {
      console.log('\n  → A evidência estrutural chegou DEPOIS. A troca NÃO vale a pena nesta amostra.');
    } else {
      console.log('\n  → Empate: sem vantagem mensurável nesta amostra.');
    }
    console.log('\nEste número é uma medição desta amostra, NÃO uma probabilidade de acerto.');
    console.log('Rode em vários símbolos/timeframes antes de mudar qualquer regra.\n');
  }).catch((err) => {
    console.error(`\nFALHA (fail-closed, sem número inventado): ${err.message}`);
    console.error('Se o erro for de rede, rode na sua máquina — o ambiente remoto bloqueia as corretoras.\n');
    process.exit(1);
  });
}

main();
