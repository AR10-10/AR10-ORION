// generate-replay-fixture.mjs — Gerador da Fixture Versionada de Replay
// (Fase K / V15 Cap. 18 e Cap. 20). Produz a base de dados ESTÁTICA que o
// Motor de Replay injeta no ciclo de análise em CI, com isolamento offline
// total (diretriz 1 da ordem de ignição da Fase K).
//
// PROVENIÊNCIA — HONESTIDADE ANTES DE TUDO:
//   A diretriz 1 exemplificou "candles históricos reais". O sandbox de CI
//   desta base NÃO tem egress para nenhuma exchange pública (o proxy de
//   rede recusa o CONNECT com 403 — verificado contra api.binance.com em
//   2026-07-06), e baixar "dados reais" de um espelho de terceiros não
//   verificável seria lavar proveniência, não honestidade. Esta fixture é
//   portanto uma SÉRIE DETERMINÍSTICA DE ENGENHARIA: gerada por ESTE
//   script versionado, com seed fixa, bit-a-bit reproduzível (o teste de
//   proveniência regenera em memória e compara deep-equal com o JSON
//   commitado). Ela NÃO é dado de mercado e NUNCA alimenta decisão real —
//   é o estímulo controlado do laboratório de walk-forward.
//
//   DROP-IN REAL: o schema dos candles é o canônico do Market Data Bus
//   ({t,o,h,l,c,v}, t em SEGUNDOS, espaçamento exato do timeframe). No dia
//   em que o Operador gerar uma janela de candles reais (fora do sandbox),
//   basta substituir o arquivo mantendo o schema + bloco `phases` — o
//   Motor de Replay e a suíte não mudam uma linha.
//
// DESENHO DAS FASES (o arco que a diretriz 3 exige — volatilidade SOBE):
//   P1 CALMA        consolidação de baixa energia (ATR% < piso de stop)
//   P2 COMPRESSAO   amplitude decai exponencialmente => squeeze de
//                   Bollinger real (percentil de bandwidth <= 0.25)
//   P3 IMPULSO_ALTA rompimento para cima saindo do squeeze + tendência
//                   forte (ADX >= 30) com volatilidade crescendo
//   P4 EXPANSAO_VOLATIL drift zera, amplitude multiplica => ATR% cruza a
//                   fronteira em que o dimensionamento por volatilidade
//                   (Risk/ATR) passa a mandar sobre o teto de Kelly — o
//                   degrau que prova a modulação de exposição da Fase H.
//   Cada fronteira é declarada em `phases` e VALIDADA pelo Market Regime
//   Engine REAL na suíte (o desenho não é auto-proclamado: o classificador
//   de produção precisa enxergar as fases, ou o teste falha).
//
// Zero Math.random: PRNG mulberry32 com seed fixa. Zero Date.now no
// gerador (o timestamp inicial é constante) — mesmo input, mesmo byte.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const FIXTURE_VERSION = 1;
// Seed escolhida por VARREDURA determinística (base 20260706 = data da
// ignição da Fase K, incrementando) até o Market Regime Engine REAL
// validar todos os alvos de desenho de uma vez: P1 calma sem tendência
// forte, squeeze sustentado no fim da P2, BREAKOUT:ALTA na ignição da P3,
// P3 modal TENDENCIA_FORTE:ALTA, arco de ATR >= 3x e cauda da P4 com
// ATR% >= 2.0 sustentado. Trocar a seed = novo desenho = NOVA VERSÃO da
// fixture (o teste de proveniência regenera e compara byte a byte).
export const FIXTURE_SEED = 20260709;
export const FIXTURE_SYMBOL = 'REPLAY-FIXTURE'; // nunca um ticker real — não fingir mercado
export const FIXTURE_INTERVAL = '15m';
export const FIXTURE_STEP_S = 900;
export const FIXTURE_T0 = 1735689600;      // 2025-01-01T00:00:00Z, constante
export const FIXTURE_COUNT = 640;
// Escala de preço BTC-like de propósito: com round2 (2 casas), uma base de
// 100 quantizaria corpos de compressão (~3bp) no mesmo degrau do próprio
// arredondamento — pops de quantização viravam falsos rompimentos. Em
// 40000, 0.01 absoluto = 0.000025% — o arredondamento fica ordens de
// magnitude abaixo da menor amplitude desenhada.
export const BASE_PRICE = 40000.0;

// Fronteiras [start, end) por índice de candle + intenção de desenho.
export const FIXTURE_PHASES = Object.freeze([
    Object.freeze({ name: 'CALMA', start: 0, end: 180, desenho: 'consolidacao_de_baixa_energia_sem_tendencia' }),
    Object.freeze({ name: 'COMPRESSAO', start: 180, end: 320, desenho: 'amplitude_decai_exponencialmente_ate_squeeze_de_bollinger' }),
    Object.freeze({ name: 'IMPULSO_ALTA', start: 320, end: 500, desenho: 'rompimento_para_cima_e_tendencia_forte_adx_alto' }),
    Object.freeze({ name: 'EXPANSAO_VOLATIL', start: 500, end: 640, desenho: 'drift_zero_amplitude_multiplicada_atr_maximo_da_serie' }),
]);

/** PRNG determinístico (mulberry32) — o padrão desta base para qualquer
 *  aleatoriedade reproduzível; nunca Math.random. */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const round2 = (x) => Math.round(x * 100) / 100;
const round4 = (x) => Math.round(x * 10000) / 10000;

/** Parâmetros de microestrutura do candle i (amplitude do corpo, drift e
 *  fração de pavio, todos em % do preço). O arco inteiro da diretriz 3
 *  vive nesta função. */
function phaseParamsAt(i) {
    if (i < 180) {
        // P1 CALMA: ruído moderado com WOBBLE determinístico de amplitude.
        // Lição da Fase D revalidada aqui: amplitude constante gera
        // bandwidths quase idênticos e o percentile-rank vira ruído de
        // empate de float — janelas calmas classificavam COMPRESSAO. O
        // seno lento mantém a ordenação dos bandwidths bem definida.
        const amp = 0.35 * (1 + 0.15 * Math.sin((2 * Math.PI * i) / 60));
        return { ampPct: amp, driftPct: 0, wickFrac: 0.35, revert: 0.05 };
    }
    if (i < 320) {
        // P2 COMPRESSAO: amplitude decai exp. SEM piso (piso constante
        // recriaria o empate de percentil). Reversão leve à âncora LOCAL
        // (preço de entrada na fase, não a base global): sem ela, a
        // deriva acumulada do passeio aleatório afastava o close da SMA e
        // estourava as bandas microscópicas ANTES da ignição desenhada.
        const k = i - 180;
        const amp = 0.35 * Math.exp(-k / 55);
        return { ampPct: amp, driftPct: 0, wickFrac: 0.30, revert: 0.05 };
    }
    if (i < 500) {
        // P3 IMPULSO_ALTA: drift forte que decai + amplitude crescendo.
        const k = i - 320;
        const drift = k < 50 ? 0.34 : Math.max(0.10, 0.34 * Math.exp(-(k - 50) / 90));
        const amp = 0.10 + (0.55 - 0.10) * Math.min(1, k / 140);
        return { ampPct: amp, driftPct: drift, wickFrac: 0.35, revert: 0 };
    }
    // P4 EXPANSAO_VOLATIL: drift zero, amplitude sobe rápido até 2.6% —
    // rampa em 60 candles de propósito: o ATR(14) de Wilder é atrasado, e
    // a diretriz 3 exige que TODA a cauda da série sustente ATR% acima da
    // fronteira em que o dimensionamento por volatilidade assume o comando.
    const k = i - 500;
    const amp = 0.55 + (2.60 - 0.55) * Math.min(1, k / 60);
    return { ampPct: amp, driftPct: 0, wickFrac: 0.40, revert: 0 };
}

/** Gera a fixture inteira em memória — PURA e determinística (sem fs, sem
 *  relógio): mesma seed => mesmo objeto, byte a byte após JSON. A seed é
 *  parâmetro só para a varredura de desenho (tools/tests); a fixture
 *  OFICIAL usa sempre FIXTURE_SEED. */
export function generateReplayFixture(seed = FIXTURE_SEED) {
    const rng = mulberry32(seed);
    const candles = [];
    let close = BASE_PRICE;
    // Âncora da reversão: global na P1 (base), local na P2 (close de
    // entrada da fase — capturado ao cruzar a fronteira). O pull é sempre
    // limitado a 0.5×amp: reversão SUPRIME deriva acumulada, nunca domina
    // o ruído (a dominância virava micro-tendência e o ADX a detectava).
    let p2Anchor = null;
    for (let i = 0; i < FIXTURE_COUNT; i += 1) {
        const p = phaseParamsAt(i);
        const o = close;
        if (i === 180) p2Anchor = o;
        const anchor = i >= 180 && i < 320 ? p2Anchor : BASE_PRICE;
        const noise = (2 * rng() - 1) * p.ampPct;                    // corpo em %
        const pullRaw = p.revert * ((anchor - o) / anchor) * 100;    // reversão em %
        const pullCap = 0.5 * p.ampPct;
        const pull = Math.max(-pullCap, Math.min(pullCap, pullRaw));
        const movePct = noise + p.driftPct + pull;
        const cRaw = o * (1 + movePct / 100);
        const wickUpPct = rng() * p.wickFrac * p.ampPct;
        const wickDnPct = rng() * p.wickFrac * p.ampPct;
        const c = round2(cRaw);
        const h = round2(Math.max(o, c) * (1 + wickUpPct / 100));
        const l = round2(Math.min(o, c) * (1 - wickDnPct / 100));
        const v = round4(40 + 160 * rng() * rng() + (i >= 320 ? 60 * rng() : 0));
        candles.push({ t: FIXTURE_T0 + i * FIXTURE_STEP_S, o: round2(o), h, l, c, v });
        close = c;
    }
    return {
        dataset: 'replay_fixture',
        version: FIXTURE_VERSION,
        kind: 'SERIE_DETERMINISTICA_DE_ENGENHARIA',
        generator: 'ipad_runtime/tools/generate-replay-fixture.mjs',
        seed: FIXTURE_SEED,
        reproducao: 'node ipad_runtime/tools/generate-replay-fixture.mjs',
        live: false,
        exchange_connection: 'NONE',
        motivo_nao_real: 'sandbox_de_ci_sem_egress_para_exchanges_publicas_connect_403_verificado_2026-07-06; substituivel_por_candles_reais_mantendo_o_mesmo_schema_canonico_do_bus',
        warning: 'Serie deterministica de engenharia para a suite de replay/walk-forward. NAO e dado de mercado, NAO vem de exchange alguma e NUNCA deve alimentar decisao real.',
        symbol: FIXTURE_SYMBOL,
        interval: FIXTURE_INTERVAL,
        t0: FIXTURE_T0,
        step_s: FIXTURE_STEP_S,
        count: FIXTURE_COUNT,
        phases: FIXTURE_PHASES.map((p) => ({ ...p })),
        candles,
    };
}

// CLI: regenera o arquivo commitado. Roda de qualquer cwd — o destino é
// resolvido a partir da posição DESTE arquivo, não do cwd.
const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === selfPath) {
    const outPath = resolve(dirname(selfPath), '../ramber-ui/tests/fixtures/replay-fixture.v1.json');
    mkdirSync(dirname(outPath), { recursive: true });
    const fixture = generateReplayFixture();
    writeFileSync(outPath, JSON.stringify(fixture));
    console.log(`fixture v${fixture.version} escrita: ${outPath} (${fixture.count} candles, seed ${fixture.seed})`);
}
