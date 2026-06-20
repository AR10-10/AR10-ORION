// index.js — Stub de metadados do conector MEXC Spot Public Market Data
// (scaffold, INERTE). Nao faz fetch()/XHR, nao usa WebSocket, nao contem
// chave de API e nao esta importado por `index.html` nem por `js/app.js` —
// e apenas a descricao em codigo do que a fase futura implementaria. Ver
// `docs/CONNECTOR_REGISTRY_DESIGN.md` e
// `configs/connector-registry.default.json` (entrada `mexc-public-market-adapter`).

export const meta = {
    connector_id: 'mexc-public-market-adapter',
    connector_name: 'MEXC Spot Public Market Data Adapter',
    connector_type: 'exchange_public_market_data',
    asset_classes_supported: ['crypto_spot'],
    data_capabilities: ['candles', 'ticker', 'order_book'],
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
