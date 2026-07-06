// replay-engine.js — Motor de Replay Isolado (Fase K / V15 Cap. 18 e
// Cap. 20). Injeta sequencialmente os candles de uma fixture versionada no
// ciclo de análise, imitando o Market Data Bus — na verdade, USANDO o
// Market Data Bus real (diretriz 2 da ordem de ignição): a coleta da
// fixture entra pelo MESMO contrato `collect` injetável que o conector
// Binance usa em produção, e cada passo atravessa o MESMO pipeline
// (Normalização → Validação → Sincronização → Qualidade → Distribuição).
// Nada aqui é uma imitação paralela do Bus — é o Bus de verdade com outra
// fonte plugada, que é exatamente o que o desenho da Fase B prometeu.
//
// CADEIA POR PASSO (espelho 1:1 da fiação de produção em App.tsx /
// engine-bridge.ts — mesma ordem, mesmos campos, mesmos fallbacks null):
//   1. Bus.requestSnapshot(collect da fixture)  → snapshot + qualidade real
//   2. classifyMarketRegime(candles do snapshot) → regime + ATR% + evidência
//   3. RegimeHistory.record(..., at = asOf)      → transições determinísticas
//   4. buildEnsembleConsensus(membros, regime, peso de qualidade do Bus)
//   5. buildRiskSuggestion(plano + ATR% do regime + direção/força do comitê)
//
// ESTÍMULO INJETADO, NUNCA FABRICADO: o motor NÃO inventa opiniões de
// comitê nem rotas de trade — memberFactory e riskPlanFactory são
// parâmetros do chamador (o teste), pelo mesmo princípio do `collect`
// injetável do Bus. Sem estímulo => a cadeia continua e responde
// fail-closed de ponta a ponta (comitê DADOS_INSUFICIENTES, sugestão 0%).
// Os módulos de produção NUNCA importam deste domínio (teste de fronteira
// trava isso) — replay é laboratório, não caminho de produção.
//
// READ_ONLY / FAIL_CLOSED: nenhuma rede, nenhum relógio no caminho dos
// dados (timestamps vêm da própria fixture), nenhuma ordem, nenhum estado
// persistido. Toda saída é congelada.
import { MarketDataBus } from '../market-data-bus/index.js';
import { classifyMarketRegime, RegimeHistory, MIN_CANDLES_FOR_REGIME } from '../market-regime/index.js';
import { buildEnsembleConsensus } from '../consensus/index.js';
import { buildRiskSuggestion } from '../risk/index.js';

export const REPLAY_DEFAULT_WINDOW = 120;

/** Sessão de replay: um cursor de walk-forward sobre a série da fixture,
 *  servido ao Bus REAL por um collect fixture-backed.
 *  @param {{candles: Array, symbol?: string, timeframe?: string,
 *    windowSize?: number, bus?: object|null}} opts */
export function createReplaySession({
    candles,
    symbol = 'REPLAY-FIXTURE',
    timeframe = '15m',
    windowSize = REPLAY_DEFAULT_WINDOW,
    bus = null,
} = {}) {
    if (!Array.isArray(candles) || candles.length === 0) {
        throw new Error('replay_sem_candles_de_fixture');
    }
    if (!Number.isFinite(windowSize) || windowSize < MIN_CANDLES_FOR_REGIME) {
        throw new Error(`replay_window_minima_${MIN_CANDLES_FOR_REGIME}`);
    }
    if (windowSize > candles.length) {
        throw new Error('replay_window_maior_que_a_fixture');
    }

    const realBus = bus ?? new MarketDataBus();
    const history = new RegimeHistory();
    const key = `${symbol}:${timeframe}`;
    const stats = { collects: 0 };
    let cursor = windowSize; // primeira janela completa: candles [0, windowSize)

    // O contrato de coleta de produção (binance-candle-connector) recebido
    // pelo Bus: ({symbol,timeframe,limit}) => Promise<candles crus>. Aqui a
    // "rede" é a fatia da fixture até o cursor — a injeção sequencial da
    // diretriz 2. maxAgeMs:0 no requestSnapshot garante que CADA passo
    // recoleta (nunca um passo lê a janela do passo anterior por engano).
    async function collect({ limit }) {
        stats.collects += 1;
        return candles.slice(Math.max(0, cursor - limit), cursor);
    }

    async function step({ memberFactory = null, riskPlanFactory = null } = {}) {
        if (cursor > candles.length) return null; // fixture esgotada

        const snapshot = await realBus.requestSnapshot({
            symbol,
            timeframe,
            limit: windowSize,
            collect,
            maxAgeMs: 0,
            capacity: windowSize,
        });
        const quality = snapshot.quality ?? realBus.getQualityReport(symbol, timeframe);

        const regime = classifyMarketRegime({ ohlcv_series: snapshot.candles, timeframe });
        const last = snapshot.candles[snapshot.candles.length - 1] ?? null;
        const close = last ? last.c : null;
        // `at` vem do DADO (asOf = t do último candle, em ms), nunca do
        // relógio — o histórico de transições do replay é determinístico.
        const recorded = history.record(key, regime.regime, regime.direction, close, snapshot.asOf ?? 0);

        const ctx = Object.freeze({ index: cursor, snapshot, regime, quality, close });

        const members = memberFactory ? memberFactory(ctx) : [];
        const ensemble = buildEnsembleConsensus({
            members: Array.isArray(members) ? members : [],
            regime: regime.regime ?? null,
            dataQualityWeight: quality?.weight ?? null,
        });

        const plan = riskPlanFactory ? riskPlanFactory(ctx) : null;
        const risk = buildRiskSuggestion({
            signal: plan?.signal ?? null,
            entry: plan?.entry ?? null,
            stop: plan?.stop ?? null,
            atrPercent: regime.evidence?.atr_percent ?? null,
            riskRewardRatio: plan?.riskRewardRatio ?? null,
            ensembleDirection: ensemble?.status === 'OK' ? ensemble.direcao : null,
            ensembleForca: ensemble?.status === 'OK' ? ensemble.forca : null,
            ...(Number.isFinite(plan?.riskPerTradePct) ? { riskPerTradePct: plan.riskPerTradePct } : {}),
        });

        const frame = Object.freeze({
            index: cursor,
            t: last ? last.t : null,
            close,
            snapshot,
            quality,
            regime,
            regime_changed: recorded.changed,
            regime_started_at: recorded.startedAt,
            ensemble,
            risk,
            read_only: true,
        });
        cursor += 1;
        return frame;
    }

    return Object.freeze({
        step,
        stats,
        get cursor() { return cursor; },
        get done() { return cursor > candles.length; },
        transitions: () => history.historyFor(key),
        bus: realBus,
        symbol,
        timeframe,
        windowSize,
    });
}

/** Walk-forward completo: avança a sessão candle a candle até esgotar a
 *  fixture (ou maxSteps) e devolve a linha do tempo inteira + transições
 *  de regime registradas. É a suíte de integração da diretriz 3 em forma
 *  de função: quem chama afirma sobre `frames` a reação sistémica.
 *  @param {{candles: Array, symbol?: string, timeframe?: string,
 *    windowSize?: number, bus?: object|null,
 *    memberFactory?: ((ctx: object) => Array)|null,
 *    riskPlanFactory?: ((ctx: object) => object)|null,
 *    maxSteps?: number}} opts */
export async function runWalkForward({
    candles,
    symbol,
    timeframe,
    windowSize,
    bus,
    memberFactory = null,
    riskPlanFactory = null,
    maxSteps = Infinity,
} = {}) {
    const session = createReplaySession({ candles, symbol, timeframe, windowSize, bus });
    const frames = [];
    while (!session.done && frames.length < maxSteps) {
        const frame = await session.step({ memberFactory, riskPlanFactory });
        if (!frame) break;
        frames.push(frame);
    }
    return Object.freeze({
        frames: Object.freeze(frames),
        transitions: Object.freeze(session.transitions()),
        collects: session.stats.collects,
        symbol: session.symbol,
        timeframe: session.timeframe,
        windowSize: session.windowSize,
        read_only: true,
    });
}
