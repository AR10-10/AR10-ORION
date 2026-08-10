// index.js — Stub de metadados do MT5 Bridge Adapter (scaffold, INERTE,
// READ_ONLY_PLACEHOLDER). SEM order_send, SEM execucao real, SEM credencial
// privada. O manifesto de seguranca do pacote
// (`pack/manifest.pack.json` > `security_posture.mt5_bridge`) declara
// "ABSENT" hoje, e este stub nao contradiz isso. Papel futuro pretendido:
// bridge de dado de mercado, mapeamento de simbolo e leitura de estado de
// posicao/conta (read-only). Qualquer execucao exigiria uma fase futura
// inteiramente separada e explicitamente aprovada — nao decorre deste
// arquivo. Nao faz fetch()/XHR, nao esta ligado a `index.html` nem a
// `js/app.js`. Ver `docs/CONNECTOR_REGISTRY_DESIGN.md` e
// `configs/connector-registry.default.json` (entrada `mt5-bridge-adapter`).

export const meta = {
    connector_id: 'mt5-bridge-adapter',
    connector_name: 'MT5 Bridge Adapter (Read-Only Placeholder)',
    connector_type: 'native_bridge_market_data',
    role: 'READ_ONLY_PLACEHOLDER',
    asset_classes_supported: ['crypto_spot', 'crypto_futures', 'equities_real', 'fx'],
    data_capabilities: ['candles', 'ticker', 'account_state_readonly', 'positions_readonly'],
    requires_api_key: false,
    supports_private_endpoints: false,
    current_status: 'FUTURE',
    read_only_supported: true,
    execution_supported: false,
    order_send_supported: false,
};

/**
 * Stub de leitura. Nao implementado: nunca abre socket/bridge real, nunca
 * envia ordem. execution_supported permanece false sem exceção.
 * @returns {{ status: 'FUTURE', connector_id: string }}
 */
export function describe() {
    return { status: meta.current_status, connector_id: meta.connector_id };
}

export default meta;
