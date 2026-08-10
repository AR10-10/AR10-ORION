// index.js — Stub de metadados do conector Google Finance (scaffold,
// INERTE). UNSUPPORTED_ON_IPAD: nao existe API publica estavel e
// documentada do Google Finance para integracao de terceiros, por isso nao
// e rotulado PLANNED. Nao faz fetch()/XHR, sem chave de API, nao esta
// ligado a `index.html` nem a `js/app.js`. Ver
// `docs/CONNECTOR_REGISTRY_DESIGN.md` e
// `configs/connector-registry.default.json` (entrada `google-finance-adapter`).

export const meta = {
    connector_id: 'google-finance-adapter',
    connector_name: 'Google Finance Market Data Adapter',
    connector_type: 'equity_market_data',
    asset_classes_supported: ['equities_real', 'etf', 'index'],
    data_capabilities: ['equity_price', 'trading_hours'],
    requires_api_key: false,
    supports_private_endpoints: false,
    current_status: 'UNSUPPORTED_ON_IPAD',
    read_only_supported: false,
    execution_supported: false,
};

/**
 * Stub de leitura. Nao implementado: nunca faz chamada de rede real.
 * @returns {{ status: 'UNSUPPORTED_ON_IPAD', connector_id: string }}
 */
export function describe() {
    return { status: meta.current_status, connector_id: meta.connector_id };
}

export default meta;
