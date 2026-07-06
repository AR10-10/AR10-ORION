// quality-monitor.js — Data Quality Layer, estado por fonte (Fase C / V15
// Cap. 4). Guarda a janela deslizante de tentativas reais de coleta por
// chave de stream (symbol:timeframe — hoje 1:1 com o único conector de
// candles; quando um segundo conector existir, a chave evolui para
// connectorId|symbol:timeframe e este arquivo é o ÚNICO que muda).
//
// Monitoramento contínuo sem timer próprio, de propósito: cada tentativa
// real do Bus (sucesso OU falha) é registrada no instante em que acontece
// via recordSuccess/recordFailure — um setInterval separado aqui só
// inventaria medições sem evento real por trás e gastaria bateria do iPad
// à toa. A cadência de medição É a cadência real de uso do Bus (~30s por
// chave quente), que é exatamente o que interessa medir.
//
// Toda matemática vive em quality-engine.js (puro, testável offline);
// este arquivo só acumula medições e delega.
import { composeQualityReport, computeConsistency, QUALITY_WINDOW, EMA_ALPHA } from './quality-engine.js';

export class QualityMonitor {
    constructor() {
        this._byKey = new Map();
    }

    _stateFor(key) {
        let state = this._byKey.get(key);
        if (!state) {
            state = { attempts: [], emaLatencyMs: null, lastConsistency: null };
            this._byKey.set(key, state);
        }
        return state;
    }

    _pushAttempt(state, attempt) {
        state.attempts.push(attempt);
        if (state.attempts.length > QUALITY_WINDOW) state.attempts.shift();
    }

    /** Uma coleta real que entregou série validada. A consistência é
     *  recomputada sobre a série INTEIRA que a fonte entregou (antes do
     *  truncamento do ring buffer) — lacuna no meio da janela conta. */
    recordSuccess(key, latencyMs, candles, timeframe) {
        const state = this._stateFor(key);
        this._pushAttempt(state, { ok: true, latencyMs });
        state.emaLatencyMs = state.emaLatencyMs === null
            ? latencyMs
            : EMA_ALPHA * latencyMs + (1 - EMA_ALPHA) * state.emaLatencyMs;
        state.lastConsistency = computeConsistency(candles, timeframe);
    }

    /** Uma coleta real que falhou (exceção de rede OU série corrompida
     *  rejeitada pelo integrity-validator — para a qualidade da fonte as
     *  duas coisas são a mesma falha: pediu-se dado real e não veio dado
     *  utilizável). A latência da falha não entra na EMA (um fail rápido
     *  de CORS não diz nada sobre a velocidade da fonte); a punição vem
     *  por disponibilidade. */
    recordFailure(key) {
        const state = this._stateFor(key);
        this._pushAttempt(state, { ok: false, latencyMs: null });
    }

    /** Relatório imutável atual da fonte. Chave nunca vista => relatório
     *  DADOS_INSUFICIENTES honesto (score/weight null), nunca um default
     *  otimista. */
    reportFor(key) {
        const state = this._byKey.get(key);
        if (!state) return composeQualityReport({ emaLatencyMs: null, attempts: [], consistency: null });
        return composeQualityReport({
            emaLatencyMs: state.emaLatencyMs,
            attempts: state.attempts,
            consistency: state.lastConsistency,
        });
    }
}
