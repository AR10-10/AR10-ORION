// index.js — Stub de metadados do conector CoinGecko Market Data (scaffold,
// INERTE). Nao faz fetch()/XHR, sem chave de API, nao esta ligado a
// `index.html` nem a `js/app.js`. Ver `docs/CONNECTOR_REGISTRY_DESIGN.md` e
// `configs/connector-registry.default.json` (entrada `coingecko-market-data-adapter`).

export const meta = {
    connector_id: 'coingecko-market-data-adapter',
    connector_name: 'CoinGecko Market Data Adapter',
    connector_type: 'aggregator_market_data',
    asset_classes_supported: ['crypto_spot'],
    data_capabilities: ['market_cap', 'ticker', 'candles'],
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
