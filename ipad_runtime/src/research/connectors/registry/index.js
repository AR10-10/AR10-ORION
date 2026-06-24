// index.js — Agregador central do registro de conectores (scaffold, INERTE).
// Descreve conceitualmente como os modulos individuais em
// `ipad_runtime/src/research/connectors/<nome>/index.js` seriam agregados a
// partir de `ipad_runtime/configs/connector-registry.default.json` (fonte de
// verdade dos metadados). Nao importa, nao faz fetch() do JSON e nao chama
// nenhum dos modulos de conector em runtime — nenhum destes esta ligado a
// `index.html` nem a `js/app.js`. Ver `docs/CONNECTOR_REGISTRY_DESIGN.md`.
//
// Padrao de agregacao pretendido para uma fase futura aprovada:
//   1. Carregar `configs/connector-registry.default.json` (dado estatico).
//   2. Para cada entrada `connectors[i]`, importar o modulo stub
//      correspondente em `./<connector-dir>/index.js` e validar que o
//      campo `meta.connector_id` do modulo bate com `connector_id` do JSON.
//   3. Expor um mapa somente leitura `{ [connector_id]: meta }` para o
//      futuro painel de pesquisa, sempre com `execution_supported: false`.
// Nenhum passo acima esta implementado aqui — isto e so o desenho do
// padrao, em comentario, para a fase de implementacao futura.

export const registryMeta = {
    module: 'connectors/registry',
    description: 'Agregador conceitual do registro de conectores. Scaffold, nao implementado.',
    source_of_truth: '../../../../configs/connector-registry.default.json',
    status: 'FUTURE',
    execution_supported: false,
};

export default registryMeta;
