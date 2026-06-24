// index.js — Stub de metadados do Native Companion (Siri / Apple
// Intelligence) Data Bridge Adapter (scaffold, INERTE, FUTURE). Cobre
// apenas a camada conceitual de PONTE DE DADO, nao a camada de voz/UI do
// Siriform Avatar (`js/siriform.js`, `js/voice.js`), que e so visual. Sem
// execucao, sem chave de API, sem credencial nativa. Relacionado a
// `docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md`. Nao faz fetch()/XHR,
// nao esta ligado a `index.html` nem a `js/app.js`. Ver
// `docs/CONNECTOR_REGISTRY_DESIGN.md` e
// `configs/connector-registry.default.json` (entrada `native-companion-adapter`).

export const meta = {
    connector_id: 'native-companion-adapter',
    connector_name: 'Native Companion (Siri / Apple Intelligence) Data Bridge Adapter',
    connector_type: 'native_os_companion_bridge',
    asset_classes_supported: ['crypto_spot', 'crypto_futures'],
    data_capabilities: ['candles', 'ticker', 'news'],
    requires_api_key: false,
    supports_private_endpoints: false,
    current_status: 'FUTURE',
    read_only_supported: true,
    execution_supported: false,
};

/**
 * Stub de leitura. Nao implementado: nunca faz chamada de rede/bridge real.
 * @returns {{ status: 'FUTURE', connector_id: string }}
 */
export function describe() {
    return { status: meta.current_status, connector_id: meta.connector_id };
}

export default meta;
