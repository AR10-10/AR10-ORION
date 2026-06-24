// index.js — Stub de metadados agregando as rotas de dado customizado do
// usuario (scaffold, INERTE): Google Sheets import e CSV local import. Sem
// rede no caso do CSV (input de arquivo local do navegador); Google Sheets
// le apenas uma URL publica fornecida explicitamente pelo usuario, sem
// OAuth/credencial armazenada aqui. Nao faz fetch()/XHR neste arquivo, nao
// esta ligado a `index.html` nem a `js/app.js`. Ver
// `docs/CONNECTOR_REGISTRY_DESIGN.md` e `configs/connector-registry.default.json`
// (entradas `google-sheets-import-adapter` e `custom-csv-import-route`).

export const meta = {
    google_sheets_import_adapter: {
        connector_id: 'google-sheets-import-adapter',
        connector_name: 'Google Sheets Custom Data Import Adapter',
        connector_type: 'user_provided_data_import',
        asset_classes_supported: ['custom_user_defined'],
        data_capabilities: ['candles', 'equity_price', 'economic_calendar'],
        requires_api_key: false,
        supports_private_endpoints: false,
        current_status: 'PLANNED',
        read_only_supported: true,
        execution_supported: false,
    },
    custom_csv_import_route: {
        connector_id: 'custom-csv-import-route',
        connector_name: 'Custom CSV Local Import Route',
        connector_type: 'local_file_import',
        asset_classes_supported: ['custom_user_defined', 'crypto_spot', 'crypto_futures', 'equities_real'],
        data_capabilities: ['candles', 'equity_price'],
        requires_api_key: false,
        supports_private_endpoints: false,
        current_status: 'PLANNED',
        read_only_supported: true,
        execution_supported: false,
    },
};

/**
 * Stub de leitura. Nao implementado: nunca faz chamada de rede real.
 * @returns {{ status: 'PLANNED', connector_ids: string[] }}
 */
export function describe() {
    return {
        status: 'PLANNED',
        connector_ids: Object.values(meta).map((m) => m.connector_id),
    };
}

export default meta;
