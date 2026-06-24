// index.js — Stub de metadados do conector Binance Futures Public Market
// Data (scaffold, INERTE). Nao faz fetch()/XHR, nao usa WebSocket, sem
// chave de API, nao esta ligado a `index.html` nem a `js/app.js`. Ver
// `docs/CONNECTOR_REGISTRY_DESIGN.md` e
// `configs/connector-registry.default.json` (entrada `binance-futures-public-adapter`).

export const meta = {
    connector_id: 'binance-futures-public-adapter',
    connector_name: 'Binance Futures Public Market Data Adapter',
    connector_type: 'exchange_public_market_data',
    asset_classes_supported: ['crypto_futures'],
    data_capabilities: ['candles', 'ticker', 'order_book', 'funding', 'open_interest', 'liquidations', 'long_short_ratio', 'volume_delta'],
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
