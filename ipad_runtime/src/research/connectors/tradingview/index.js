// index.js — Stub de metadados da rota TradingView-Compatible Chart Data
// (scaffold, INERTE). FUTURE: depende de decisao de biblioteca de grafico
// e licenciamento ainda nao confirmados, nao e acordo/integracao real com a
// TradingView. Nao faz fetch()/XHR, sem chave de API, nao esta ligado a
// `index.html` nem a `js/app.js`. Ver `docs/CONNECTOR_REGISTRY_DESIGN.md` e
// `configs/connector-registry.default.json` (entrada `tradingview-compatible-route`).

export const meta = {
    connector_id: 'tradingview-compatible-route',
    connector_name: 'TradingView-Compatible Chart Data Route',
    connector_type: 'charting_compatibility_route',
    asset_classes_supported: ['crypto_spot', 'crypto_futures', 'equities_real'],
    data_capabilities: ['candles', 'ticker'],
    requires_api_key: false,
    supports_private_endpoints: false,
    current_status: 'FUTURE',
    read_only_supported: true,
    execution_supported: false,
};

/**
 * Stub de leitura. Nao implementado: nunca faz chamada de rede real.
 * @returns {{ status: 'FUTURE', connector_id: string }}
 */
export function describe() {
    return { status: meta.current_status, connector_id: meta.connector_id };
}

export default meta;
