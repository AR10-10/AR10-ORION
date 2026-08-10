// index.js — Stub de metadados do conector MEXC Real Stocks Route (scaffold,
// INERTE). REAL_EQUITY_ROUTE_IF_AVAILABLE, REGION_DEPENDENT: disponibilidade
// depende de regiao/conta e pode nao existir. Nao faz fetch()/XHR, sem
// chave de API armazenada aqui, nao esta ligado a `index.html`/`js/app.js`.
// Ver `docs/CONNECTOR_REGISTRY_DESIGN.md` e
// `configs/connector-registry.default.json` (entrada `mexc-realstocks-adapter`).

export const meta = {
    connector_id: 'mexc-realstocks-adapter',
    connector_name: 'MEXC Real Stocks Route (If Available) Adapter',
    connector_type: 'real_equity_route_conditional',
    asset_classes_supported: ['equities_real'],
    data_capabilities: ['equity_price', 'candles', 'ticker', 'trading_hours'],
    requires_api_key: true,
    supports_private_endpoints: false,
    current_status: 'PLANNED',
    read_only_supported: true,
    execution_supported: false,
    exposure_kind: 'REAL_EQUITY_ROUTE_IF_AVAILABLE',
    region_dependent: true,
};

/**
 * Stub de leitura. Nao implementado: nunca faz chamada de rede real.
 * @returns {{ status: 'PLANNED', connector_id: string }}
 */
export function describe() {
    return { status: meta.current_status, connector_id: meta.connector_id };
}

export default meta;
