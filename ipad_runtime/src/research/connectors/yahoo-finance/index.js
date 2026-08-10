// index.js — Stub de metadados do conector Yahoo Finance (scaffold,
// INERTE). Yahoo Finance nao publica API oficial documentada; mantido como
// PLANNED ate confirmar rota estavel. Nao faz fetch()/XHR, sem chave de
// API, nao esta ligado a `index.html` nem a `js/app.js`. Ver
// `docs/CONNECTOR_REGISTRY_DESIGN.md` e
// `configs/connector-registry.default.json` (entrada `yahoo-finance-adapter`).

export const meta = {
    connector_id: 'yahoo-finance-adapter',
    connector_name: 'Yahoo Finance Market Data Adapter',
    connector_type: 'equity_market_data',
    asset_classes_supported: ['equities_real', 'etf', 'index'],
    data_capabilities: ['equity_price', 'candles', 'trading_hours', 'corporate_actions'],
    requires_api_key: false,
    supports_private_endpoints: false,
    current_status: 'PLANNED',
    read_only_supported: true,
    execution_supported: false,
};

/**
 * Stub de leitura. Nao implementado: nunca faz chamada de rede real.
 * @returns {{ status: 'PLANNED', connector_id: string }}
 */
export function describe() {
    return { status: meta.current_status, connector_id: meta.connector_id };
}

export default meta;
