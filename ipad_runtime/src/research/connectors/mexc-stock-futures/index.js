// index.js — Stub de metadados do conector MEXC Stock Futures (scaffold,
// INERTE). SYNTHETIC_DERIVATIVE_EXPOSURE: instrumento derivativo sintetico
// referenciado a uma acao, NAO propriedade real de equity. Nao faz
// fetch()/XHR, sem chave de API, nao esta ligado a `index.html`/`js/app.js`.
// Ver `docs/CONNECTOR_REGISTRY_DESIGN.md` e
// `configs/connector-registry.default.json` (entrada `mexc-stock-futures-adapter`).

export const meta = {
    connector_id: 'mexc-stock-futures-adapter',
    connector_name: 'MEXC Stock Futures (Synthetic Derivative Exposure) Adapter',
    connector_type: 'synthetic_derivative_market_data',
    asset_classes_supported: ['stock_futures_synthetic'],
    data_capabilities: ['stock_futures_price', 'candles', 'ticker'],
    requires_api_key: false,
    supports_private_endpoints: false,
    current_status: 'PLANNED',
    read_only_supported: true,
    execution_supported: false,
    exposure_kind: 'SYNTHETIC_DERIVATIVE_EXPOSURE',
};

/**
 * Stub de leitura. Nao implementado: nunca faz chamada de rede real.
 * @returns {{ status: 'PLANNED', connector_id: string }}
 */
export function describe() {
    return { status: meta.current_status, connector_id: meta.connector_id };
}

export default meta;
