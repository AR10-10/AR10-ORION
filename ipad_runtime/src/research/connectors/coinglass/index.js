// index.js — Stub de metadados do conector Coinglass Derivatives Data
// (scaffold, INERTE). REQUIRES_API_KEY: a API do Coinglass tipicamente
// exige chave mesmo para uso basico; este registro nao armazena nem assume
// nenhuma chave. Nao faz fetch()/XHR, nao esta ligado a `index.html` nem a
// `js/app.js`. Ver `docs/CONNECTOR_REGISTRY_DESIGN.md` e
// `configs/connector-registry.default.json` (entrada `coinglass-derivatives-data-adapter`).

export const meta = {
    connector_id: 'coinglass-derivatives-data-adapter',
    connector_name: 'Coinglass Derivatives Data Adapter',
    connector_type: 'aggregator_derivatives_data',
    asset_classes_supported: ['crypto_futures'],
    data_capabilities: ['funding', 'open_interest', 'liquidations', 'long_short_ratio', 'volume_delta'],
    requires_api_key: true,
    supports_private_endpoints: false,
    current_status: 'REQUIRES_API_KEY',
    read_only_supported: true,
    execution_supported: false,
};

/**
 * Stub de leitura. Nao implementado: nunca faz chamada de rede real.
 * @returns {{ status: 'REQUIRES_API_KEY', connector_id: string }}
 */
export function describe() {
    return { status: meta.current_status, connector_id: meta.connector_id };
}

export default meta;
