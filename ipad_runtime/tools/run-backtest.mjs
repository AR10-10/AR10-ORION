#!/usr/bin/env node
// run-backtest.mjs — EXECUTOR da Fase A (backtest honesto sobre histórico
// real). É o passo que faltava: `structural-backtest.js` (walk-forward
// zero-lookahead) e `history-capture.js` (paginação real com proveniência)
// já existiam e estavam testados, mas nada os punha para rodar juntos.
//
// POR QUE ESTE ARQUIVO EXISTE E POR QUE ELE RECUSA MAIS DO QUE ACEITA:
// a auditoria desta trilha registrou que nenhum motor deste repositório
// jamais foi medido contra resultado real de mercado, e que o único
// arquivo de dados presente (`data/btcusdt_replay.json`) declara-se
// `kind: SYNTHETIC_OFFLINE_SAMPLE`. Rodar o backtest sobre ele produziria
// um número — e um número fabricado é pior do que nenhum número, porque
// vira argumento de venda. Este executor torna esse erro IMPOSSÍVEL:
// a trava de proveniência abaixo é a razão de ele existir, não um extra.
//
// AMBIENTE: o sandbox de desenvolvimento deste projeto não tem egress para
// exchange (verificado: HTTP 000 em api.binance.com, fapi.binance.com e
// api.bybit.com). Rode isto de uma máquina com rede — é um comando só.
//
//   node ipad_runtime/tools/run-backtest.mjs --symbol BTCUSDT --timeframe 15m --candles 5000
//   node ipad_runtime/tools/run-backtest.mjs --from-file caminho/da/captura.json
//
// READ_ONLY: só lê klines públicas. Nenhuma chave, nenhuma ordem, nunca.

import { writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { captureHistoricalCandles } from '../src/research/backtest/history-capture.js';
import { runStructuralBacktest } from '../src/research/backtest/structural-backtest.js';

/** Marcadores que denunciam uma amostra que NÃO veio de exchange real.
 *  Qualquer um deles aborta a execução — nunca "avisa e segue". */
const SYNTHETIC_MARKERS = ['SYNTHETIC', 'MOCK', 'FAKE', 'SAMPLE', 'GENERATED', 'DEMO'];

function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith('--')) continue;
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) out[key] = true;
        else { out[key] = next; i++; }
    }
    return out;
}

function die(reason, detail) {
    console.error(`\n  BACKTEST ABORTADO — ${reason}`);
    if (detail) console.error(`  ${detail}`);
    console.error('');
    process.exit(1);
}

/**
 * A trava. Um payload só passa se declarar proveniência real e não exibir
 * nenhum marcador de dado fabricado. Exportada para ser testável — a trava
 * é a parte deste arquivo que mais precisa de teste.
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function assertRealProvenance(payload) {
    if (!payload || typeof payload !== 'object') {
        return { ok: false, reason: 'payload_ausente_ou_invalido' };
    }
    // Declaração explícita de dado sintético (o caso do btcusdt_replay.json).
    const declaredKind = String(payload.kind ?? '').toUpperCase();
    for (const marker of SYNTHETIC_MARKERS) {
        if (declaredKind.includes(marker)) {
            return { ok: false, reason: `kind_declarado_como_sintetico:${payload.kind}` };
        }
    }
    if (payload.live === false || payload.exchange_connection === 'NONE') {
        return { ok: false, reason: 'payload_declara_ausencia_de_conexao_real_com_exchange' };
    }
    // Proveniência positiva: uma captura real traz páginas com hash de
    // amostra e id de fonte. Sem isso não há como auditar o número depois.
    const pages = Array.isArray(payload.pages) ? payload.pages : [];
    if (pages.length === 0) {
        return { ok: false, reason: 'sem_paginas_de_proveniencia' };
    }
    const semFonte = pages.filter((p) => !p.sourceId);
    if (semFonte.length > 0) {
        return { ok: false, reason: `paginas_sem_source_id:${semFonte.length}` };
    }
    if (!Array.isArray(payload.candles) || payload.candles.length === 0) {
        return { ok: false, reason: 'sem_candles' };
    }
    return { ok: true };
}

function fmtPct(v) {
    return v === null || v === undefined ? 'DADOS_INSUFICIENTES' : `${(v * 100).toFixed(2)}%`;
}
function fmtNum(v) {
    return v === null || v === undefined ? 'DADOS_INSUFICIENTES' : Number(v).toFixed(3);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const symbol = String(args.symbol ?? 'BTCUSDT');
    const timeframe = String(args.timeframe ?? '15m');
    const target = Number(args.candles ?? 5000);
    const horizonBars = args.horizon ? Number(args.horizon) : undefined;
    const windowSize = args.window ? Number(args.window) : undefined;

    let capture;
    if (args['from-file']) {
        const path = String(args['from-file']);
        console.log(`\n  Lendo captura de ${path}`);
        try {
            capture = JSON.parse(readFileSync(path, 'utf-8'));
        } catch (err) {
            die('não consegui ler o arquivo', String(err));
        }
    } else {
        console.log(`\n  Capturando histórico REAL — ${symbol} ${timeframe}, alvo ${target} candles`);
        console.log('  (READ_ONLY: só klines públicas, sem chave, sem ordem)');
        capture = await captureHistoricalCandles({ symbol, timeframe, targetCandleCount: target });
        if (!capture.succeeded) {
            die('a captura não completou', `stopReason: ${capture.stopReason}`);
        }
    }

    // ── A TRAVA ───────────────────────────────────────────────────────────
    const provenance = assertRealProvenance(capture);
    if (!provenance.ok) {
        die(
            'proveniência não confere — recuso rodar sobre dado que não é de exchange real',
            `motivo: ${provenance.reason}\n  Um número saído de dado fabricado vira argumento de venda. Não vai sair daqui.`,
        );
    }

    console.log(`  Captura OK — ${capture.candleCount} candles, ${capture.pageCount} páginas, contíguo: ${capture.contiguous ? 'sim' : `NÃO (${capture.gaps.length} lacunas)`}`);
    if (!capture.contiguous) {
        console.log('  AVISO: a série tem lacunas reais. Elas entram no resultado como estão — nunca preenchidas.');
    }

    console.log('\n  Rodando walk-forward zero-lookahead...');
    const result = await runStructuralBacktest({
        candles: capture.candles,
        symbol,
        timeframe,
        ...(horizonBars ? { horizonBars } : {}),
        ...(windowSize ? { windowSize } : {}),
    });

    if (result.status !== 'OK') {
        die('o backtest devolveu DADOS_INSUFICIENTES', `motivo: ${result.reason}`);
    }

    const a = result.aggregate;
    console.log('\n  ─────────────── RESULTADO REAL ───────────────');
    console.log(`  amostra (trials)      ${a.samples}`);
    console.log(`  resolvidos            ${a.resolved}`);
    console.log(`  alvo primeiro         ${a.targetHits}`);
    console.log(`  stop primeiro         ${a.stopHits}`);
    console.log(`  não resolvidos        ${a.unresolved}`);
    console.log(`  taxa de alvo          ${fmtPct(a.taxaAlvoAmostra)}`);
    console.log(`  MFE médio (R)         ${fmtNum(a.mfeRMedio ?? a.mfeMedioR)}`);
    console.log(`  MAE médio (R)         ${fmtNum(a.maeRMedio ?? a.maeMedioR)}`);
    console.log('  ──────────────────────────────────────────────');
    console.log(`\n  ${result.aviso}`);

    const outPath = String(args.out ?? `backtest-${symbol}-${timeframe}-${Date.now()}.json`);
    writeFileSync(outPath, JSON.stringify({ capture: { ...capture, candles: undefined }, result }, null, 2));
    console.log(`\n  Resultado completo (com proveniência página a página) em ${outPath}\n`);
}

// Só executa quando chamado direto — importável em teste sem rodar nada.
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((err) => die('exceção não tratada', String(err?.stack ?? err)));
}
