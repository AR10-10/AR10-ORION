// data-policy.js — política de dados de mercado (runtime).
// Espelha configs/market-data-policy.json (fonte declarativa). Mantidos
// idênticos em conteúdo — este módulo é a versão carregada em runtime para
// alimentar o painel "Política de Dados de Mercado".
//
// Princípio central (NO_FAKE_DATA): o replay sintético/offline existe SÓ como
// diagnóstico técnico (prova WASM + worker + storage + engine). Ele NUNCA é
// uma análise de mercado real, sinal de trade, decisão Long/Short/Wait ou
// recomendação. Para análise real é exigida uma fonte pública/somente-leitura
// com símbolo, timeframe, timestamp e frescor — enquanto não houver, o estado
// honesto é DADOS INSUFICIENTES.

export const MARKET_DATA_POLICY = {
    policy_id: 'AR10_REAL_DATA_POLICY_V1',
    diagnostic_mode: {
        id: 'TECHNICAL_DIAGNOSTIC',
        dataset_kind: 'SYNTHETIC_OFFLINE_SAMPLE',
        proves: ['WASM', 'WEB_WORKER', 'STORAGE', 'REPLAY_ENGINE'],
        usable_for_market_decision: false,
        label: 'Teste técnico offline — dados sintéticos, não usar para decisão de mercado.',
    },
    real_market_mode: {
        requires: ['public_readonly_source', 'symbol', 'timeframe', 'timestamp', 'freshness'],
        status_when_unavailable: 'DADOS INSUFICIENTES',
    },
    public_data_allowed: true,
    read_only_connectors_allowed: true,
    allowed_sources: [
        'MEXC public market data',
        'MEXC futures public data',
        'Binance public data',
        'CoinGecko',
        'CoinGlass (se disponível)',
        'Yahoo/Google Finance (dados de referência, se disponível)',
        'CSV/JSON público importado',
        'metadados públicos de documentação/fonte',
    ],
    blocked: [
        'PRIVATE_FINANCIAL_DATA_BLOCKED',
        'NO_PRIVATE_ACCOUNT_ACCESS',
        'NO_REAL_EXECUTION',
        'NO_SECRET_IN_LOCALSTORAGE',
    ],
    execution: 'DISABLED_BY_POLICY',
};

/** Estado honesto da análise de mercado REAL nesta sessão.
 *  `activeSources` deve vir de realDataRegistry.getActiveReadOnlySources() —
 *  nunca assumido. Enquanto nenhuma sonda real desta sessão tiver chegado a
 *  ACTIVE_READ_ONLY, a resposta verdadeira é DADOS INSUFICIENTES — nunca um
 *  número inventado. A partir da mission SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1
 *  isso pode deixar de ser sempre verdade (4 conectores têm sonda real), então
 *  este estado é sempre recalculado a partir do registry, nunca hardcoded. */
export function realMarketAnalysisStatus(activeSources = []) {
    if (activeSources.length > 0) {
        const names = activeSources.map((s) => s.connector_name || s.connector_id).join(', ');
        return {
            available: true,
            status: 'DISPONÍVEL NESTA SESSÃO',
            reason: `Fonte(s) pública(s)/somente-leitura validada(s) por sonda real nesta sessão: ${names}.`,
        };
    }
    return {
        available: false,
        status: 'DADOS INSUFICIENTES',
        reason: 'Nenhuma fonte pública/somente-leitura validada por sonda real nesta sessão ainda — toque em "Testar fontes reais".',
    };
}
