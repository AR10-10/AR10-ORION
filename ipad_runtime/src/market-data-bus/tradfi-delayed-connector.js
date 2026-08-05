// tradfi-delayed-connector.js — Conector real de candles TradFi/futuros
// CME para o Market Data Bus (Ordem Market Data Fabric, Fase 1 — "1 fonte
// TradFi real"). Irmão de binance-futures-candle-connector.js/mexc-
// futures-candle-connector.js: MESMO contrato externo exato
// (`collectXxxKlines({symbol, timeframe, limit, endTime?, returnEvidence?})
// -> Promise<{t,o,h,l,c,v}[]>`, lança em falha) — o Bus continua
// inteiramente agnóstico de fonte, só recebe outro `collect` injetado.
//
// `symbol` aqui é o instrument_id do catálogo real (ex. 'CME_ES') ou, por
// conveniência, o contract_code puro (ex. 'ES') — resolvido via
// instrument-registry.js, nunca um símbolo Yahoo montado à mão neste
// arquivo (essa tradução mora inteiramente em tradfi-delayed-yahoo.js/
// instrument-registry.js). Instrumentos sem continuous_symbol_hint
// cadastrado (ex. CME_BTC, CME_SR3 — ver notes de cada entrada no
// registry) falham fechado aqui, nunca tentam adivinhar um símbolo.
import { probe as probeTradfiDelayed } from '../../js/real-data/tradfi-delayed-yahoo.js';
import { CONNECTOR_STATES } from '../../js/real-data/schema.js';
import { findByInstrumentId, findByContractCode } from './instrument-registry.js';

function resolveInstrument(symbol) {
    return findByInstrumentId(symbol) || findByContractCode(symbol) || null;
}

/** @param {{symbol: string, timeframe: string, limit: number, endTime?: number, returnEvidence?: boolean}} opts
 *  endTime: epoch ms, mesma semântica dos conectores irmãos (paginação
 *  histórica — nunca usado pelo Bus em si, só por um chamador direto de
 *  histórico antigo, ver header de binance-futures-candle-connector.js).
 *  @returns {Promise<Array<{t:number,o:number,h:number,l:number,c:number,v:number}>> | Promise<object>} */
export async function collectTradfiDelayedKlines({ symbol, timeframe, limit, endTime, returnEvidence = false }) {
    const instrument = resolveInstrument(symbol);
    if (!instrument) {
        throw new Error(`conector_tradfi_delayed_instrumento_desconhecido:${symbol}`);
    }
    if (!instrument.continuous_symbol_hint) {
        throw new Error(`conector_tradfi_delayed_sem_simbolo_continuo_cadastrado:${instrument.instrument_id}`);
    }
    const result = await probeTradfiDelayed({
        yahooSymbol: instrument.continuous_symbol_hint,
        symbolLabel: instrument.instrument_id,
        timeframe,
        limit,
        endTimeMs: endTime,
    });
    if (result.state !== CONNECTOR_STATES.ACTIVE_READ_ONLY) {
        throw new Error(`conector_tradfi_delayed_estado:${result.state}:${result.reason || 'sem_motivo'}`);
    }
    return returnEvidence ? result.evidence : result.evidence.candles;
}
