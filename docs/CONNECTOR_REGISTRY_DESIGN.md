# Registro de Conectores de Dados (Connector Registry) — Desenho V1

*Sub-produto `ipad_runtime/` (AR10 Cyborg 2.0). Este documento descreve um
**scaffold de arquitetura**: arquivos de configuração e módulos JavaScript
inertes, ainda não ligados a `index.html` nem a `js/app.js`. Nenhuma rede,
nenhuma chave de API e nenhuma execução existem nesta fase — ver
"Invariante de execução" abaixo.*

## Por que este documento existe

O AR10 Cyborg 2.0 hoje só consome um dataset sintético offline
(`data/btcusdt_replay.json`, gerado por `tools/generate_replay.py`) para o
Replay BTC/USDT. Para que uma fase futura aprovada possa trazer dado público
real (preço, candle, funding, open interest etc.) sem reabrir a discussão de
segurança a cada novo provedor, esta entrega define **antecipadamente**:

1. Um contrato de schema único que qualquer conector — presente ou futuro —
   precisa respeitar (`configs/connector-registry.default.json`).
2. Um vocabulário fechado de capacidades de dado e de status, para que
   "o que o conector faz" e "o quão pronto ele está" sejam sempre
   declarados da mesma forma, nunca em prosa livre.
3. Um layout de pastas para os módulos de conector
   (`src/research/connectors/<nome>/index.js`), hoje só com stubs de
   metadado, sem nenhuma chamada de rede.

Isso é desenho de arquitetura, não implementação: nenhum destes arquivos
chama uma exchange, uma API de mercado ou qualquer outro serviço externo.

## Arquivo fonte de verdade

`ipad_runtime/configs/connector-registry.default.json`

Esse JSON é a fonte de verdade dos metadados de cada conector. Os módulos
JS em `src/research/connectors/` são descrições estáticas (stubs) que
**espelham** uma entrada do JSON cada — eles não leem o arquivo em runtime
nesta fase (ver "Layout de pastas" abaixo para o porquê).

Campos de topo do arquivo:

| Campo | Tipo | Descrição |
|---|---|---|
| `schema_version` | inteiro | Versão do schema deste registro. |
| `registry_id` | string | Identificador do registro (`AR10_CYBORG_CONNECTOR_REGISTRY_DEFAULT_V1`). |
| `format_note` | string | Nota explicando que o arquivo é inerte, sem rede, sem segredo. |
| `target_runtime` | string | Runtime alvo (`SAFARI_IPAD`), mesma convenção de `pack/manifest.pack.json`. |
| `policy` | string | Texto fixo da política de execução (ver "Invariante de execução"). |
| `global_invariants` | objeto | Flags globais (`execution_supported_must_always_be_false`, `no_order_send`, `fail_closed`, `mode: READ_ONLY` etc.). |
| `connectors` | array | Lista de entradas de conector — o contrato principal, detalhado abaixo. |

## Contrato de cada entrada de conector

Cada objeto em `connectors[]` precisa ter todos os campos abaixo:

| Campo | Tipo | Descrição |
|---|---|---|
| `connector_id` | string (kebab-case, único) | Identificador estável do conector, ex.: `mexc-public-market-adapter`. Usado para casar a entrada do JSON com o módulo JS correspondente. |
| `connector_name` | string | Nome legível por humano. |
| `connector_type` | string | Categoria livre de classificação interna (ex.: `exchange_public_market_data`, `aggregator_market_data`, `local_file_import`, `native_bridge_market_data`). |
| `asset_classes_supported` | array de string | Classes de ativo cobertas (ex.: `crypto_spot`, `crypto_futures`, `equities_real`, `stock_futures_synthetic`, `fx`, `custom_user_defined`). |
| `data_capabilities` | array de string, do vocabulário fechado | Ver "Vocabulário de `data_capabilities`" abaixo. |
| `requires_api_key` | booleano | Se o conector, quando implementado, exigiria que o próprio usuário forneça uma chave de API (o registro nunca armazena uma chave). |
| `supports_private_endpoints` | booleano | Se o conector tocaria em endpoint privado/autenticado de alguma plataforma. Hoje **sempre `false`** em todas as 14 entradas — nenhum conector desta fase usa endpoint privado. |
| `current_status` | string, do vocabulário fechado | Ver "Vocabulário de status" abaixo. |
| `risk_level` | string (`LOW`/`MEDIUM`/`HIGH`) | Classificação de risco qualitativa, usada só para priorização/triagem interna, não é um campo de enforcement técnico. |
| `read_only_supported` | booleano | Se a capacidade de leitura é (ou seria) suportada. |
| `execution_supported` | booleano, **sempre `false`** | Ver "Invariante de execução" — campo de maior importância deste contrato. |
| `enabled_now` | booleano | Se o conector está ativo nesta entrega. Hoje **`false` em todas as 14 entradas** — nada está ligado ao app ao vivo. |
| `future_notes` | string (PT-BR) | Justificativa honesta do status atual, limitações reais da plataforma de origem, e o que precisaria acontecer para o status avançar. |

Campos opcionais usados quando fazem sentido para um conector específico:

- `role` — usado por `mt5-bridge-adapter` com o valor `"READ_ONLY_PLACEHOLDER"`, para deixar textualmente explícito que aquela entrada é um placeholder de papel futuro, não uma ponte funcional.
- `exposure_kind` — usado por `mexc-stock-futures-adapter` (`SYNTHETIC_DERIVATIVE_EXPOSURE`) e `mexc-realstocks-adapter` (`REAL_EQUITY_ROUTE_IF_AVAILABLE`), para não confundir derivativo sintético com propriedade real de ação.
- `region_dependent` — usado por `mexc-realstocks-adapter` (`true`), porque a oferta de ações reais depende de região/conta e pode não existir para todos os usuários.

## Vocabulário de `data_capabilities`

Vocabulário fechado — qualquer entrada só pode usar valores desta lista:

```
candles, ticker, order_book, funding, open_interest, liquidations,
long_short_ratio, volume_delta, market_cap, equity_price,
stock_futures_price, trading_hours, corporate_actions, news,
economic_calendar, account_state_readonly, positions_readonly, execution
```

Observação importante: `execution` existe no vocabulário **como rótulo de
capacidade de dado que poderia em tese ser referenciado**, mas nenhuma
entrada do registro atual o utiliza, e o campo `execution_supported`
continua a única fonte de verdade sobre execução — incluir `execution` em
`data_capabilities` de uma entrada não ativaria execução nenhuma, porque
`execution_supported` permanece `false` independentemente do conteúdo deste
array (ver "Invariante de execução").

## Vocabulário de `current_status`

Vocabulário fechado de status — qualquer entrada só pode usar um destes
valores:

| Status | Significado |
|---|---|
| `ACTIVE_READ_ONLY` | Em produção, funcionando, somente leitura. Nenhuma entrada do registro padrão está neste status hoje. |
| `PLANNED` | Roteiro declarado, viável tecnicamente, ainda não implementado nesta fase. |
| `FUTURE` | Roteiro mais distante/condicional — depende de decisão de produto, biblioteca, parceria ou de uma fase de segurança própria ainda não aberta. |
| `DISABLED_BY_POLICY` | Tecnicamente possível, mas bloqueado por decisão de política de segurança (reservado para qualquer capacidade de execução — ver política global abaixo). |
| `REQUIRES_ADMIN` | Exigiria papel administrativo/operacional para habilitar (não usado no registro padrão atual). |
| `REQUIRES_API_KEY` | Exigiria que o usuário forneça e gerencie sua própria chave de API antes de qualquer leitura básica funcionar (ex.: `coinglass-derivatives-data-adapter`). |
| `REQUIRES_NATIVE_BRIDGE` | Exigiria uma ponte nativa iOS/iPadOS fora do sandbox do Safari (reservado; não usado ainda no registro padrão). |
| `UNSUPPORTED_ON_IPAD` | Honestamente sem rota viável conhecida hoje — usado quando a plataforma de origem não oferece API pública estável (ex.: `google-finance-adapter`), em vez de prometer um `PLANNED` que não se sustenta. |
| `REGION_DEPENDENT` | Reservado para quando a disponibilidade depender só de região/jurisdição; no registro atual essa condição é expressa via `region_dependent: true` dentro de uma entrada `PLANNED` (`mexc-realstocks-adapter`), não como valor de `current_status`. |

A escolha de status segue a mesma honestidade já praticada em
`pack/manifest.models.json` para os motores de IA (WebLLM/Transformers.js/
ONNX): nunca rotular algo como mais pronto do que está, e usar
`UNSUPPORTED_ON_IPAD` em vez de `PLANNED` quando a plataforma de origem
simplesmente não oferece uma rota estável conhecida — esse é o caso do
Google Finance, que não publica API pública documentada (o widget de
página e a função `GOOGLEFINANCE` do Sheets não contam como API de
propósito geral).

## Invariante de execução (regra mais importante deste documento)

Todo `execution_supported` em toda entrada de `connectors[]` é **sempre
`false`, sem exceção**. Isso não é um padrão que cada conector escolhe — é
um invariante de todo o registro, declarado três vezes de forma redundante:

1. No campo `policy` de topo do JSON:

   > "Execution must remain: DISABLED_BY_POLICY for all connectors, with no
   > exception, in this and all future phases unless an entirely separate
   > explicitly-approved phase changes this."

2. No campo `global_invariants.execution_supported_must_always_be_false: true`.

3. Em cada uma das 14 entradas individuais de `connectors[]`, campo
   `execution_supported: false`.

O caso mais sensível é `mt5-bridge-adapter`: seu `current_status` é
`FUTURE` e seu campo `role` é `"READ_ONLY_PLACEHOLDER"`, mas mesmo essa
entrada — a única com `risk_level: "HIGH"` — tem `execution_supported:
false` e `order_send_supported: false` no módulo correspondente
(`src/research/connectors/mt5/index.js`), com a nota explícita de que
**qualquer** capacidade de execução exigiria uma fase inteiramente separada
e explicitamente aprovada, com sua própria revisão de segurança — nunca
decorrência automática deste registro. Isso está alinhado com
`pack/manifest.pack.json > security_posture.mt5_bridge: "ABSENT"`: este
registro não contradiz o manifesto de segurança do pacote, apenas descreve
um papel de leitura futuro condicional.

Isso significa, em termos práticos: mesmo se uma fase futura promover um
conector de `PLANNED` para `ACTIVE_READ_ONLY`, o campo `execution_supported`
daquele conector continua `false` — promover o status de leitura nunca
implica destravar execução. Uma mudança em `execution_supported` exigiria,
por definição deste invariante, uma fase de segurança própria, separada e
explicitamente aprovada — nunca uma consequência colateral de avançar o
roteiro de dados.

## Layout de pastas dos módulos JS

```
ipad_runtime/src/research/connectors/
├── registry/index.js              agregador conceitual (ver abaixo)
├── mexc/index.js                  mexc-public-market-adapter
├── mexc-stock-futures/index.js    mexc-stock-futures-adapter
├── mexc-realstocks/index.js       mexc-realstocks-adapter
├── binance/index.js               binance-futures-public-adapter
├── coingecko/index.js             coingecko-market-data-adapter
├── coinglass/index.js             coinglass-derivatives-data-adapter
├── yahoo-finance/index.js         yahoo-finance-adapter
├── google-finance/index.js        google-finance-adapter
├── tradingview/index.js           tradingview-compatible-route
├── mt5/index.js                   mt5-bridge-adapter
├── native-companion/index.js      native-companion-adapter
└── custom/index.js                google-sheets-import-adapter + custom-csv-import-route
```

Note que `mexc-futures-public-adapter` (dados públicos de futuros da MEXC:
funding/OI/order book) existe como entrada no JSON, mas **não tem** uma
pasta de módulo JS própria nesta V1 do scaffold — o conjunto de pastas
acima é exatamente o solicitado para esta fase de scaffolding. Uma fase de
implementação futura adicionaria o módulo correspondente em
`src/research/connectors/mexc/` (reaproveitando a mesma pasta do adapter
spot, já que ambos são MEXC) ou em uma pasta nova, conforme a decisão de
arquitetura daquele momento.

Cada `index.js` é um stub de metadado puro: exporta `export const meta = {
...}` (ou um mapa de metadados, no caso de `custom/index.js`, que agrega
dois conectores) espelhando a entrada correspondente do JSON, mais uma
função `describe()` que apenas devolve `{ status, connector_id }` — nenhum
dos arquivos contém `fetch()`, `XMLHttpRequest`, `WebSocket`, chave de API
ou qualquer chamada de rede. Cada arquivo abre com um comentário deixando
explícito que é scaffold inerte, não ligado a `index.html` nem a
`js/app.js`.

### Padrão de agregação pretendido (`registry/index.js`)

`src/research/connectors/registry/index.js` não importa os outros módulos
nem lê o JSON em runtime nesta fase — ele só documenta, em comentário, o
padrão de agregação que uma fase de implementação futura seguiria:

1. Carregar `configs/connector-registry.default.json` (dado estático).
2. Para cada entrada `connectors[i]`, importar o módulo stub correspondente
   em `./<pasta-do-conector>/index.js` e validar que `meta.connector_id`
   do módulo bate com `connector_id` do JSON.
3. Expor um mapa somente leitura `{ [connector_id]: meta }` para o futuro
   painel de pesquisa, sempre com `execution_supported: false`.

Esse adiamento deliberado (descrever o padrão em vez de implementá-lo) é a
mesma lógica de `src/research/engines/index.js`, que hoje agrega os motores
de análise descritiva (`risk-engine.js`, `trend-engine.js` etc.) também sem
estar ligado ao runtime ao vivo.

## Relação com a postura de segurança existente

Este registro não introduz nenhuma nova superfície de risco em relação ao
que já está declarado em `pack/manifest.pack.json > security_posture`:

```json
{
  "execution": "DISABLED",
  "order_send": "ABSENT",
  "api_secret": "ABSENT",
  "mexc_private_endpoint": "ABSENT",
  "mt5_bridge": "ABSENT",
  "live_trading": "DISABLED",
  "mode": "READ_ONLY",
  "fail_closed": true
}
```

`connector-registry.default.json` é consistente com essa postura porque:
nenhuma entrada tem `supports_private_endpoints: true`; a entrada MT5
(`mt5-bridge-adapter`) é um placeholder `FUTURE`/`READ_ONLY_PLACEHOLDER`
sem `order_send`; nenhuma entrada tem `execution_supported: true`; e os
módulos JS correspondentes não fazem nenhuma chamada de rede — apenas
descrevem metadado.

## Ver também

- `ipad_runtime/configs/connector-registry.default.json` — fonte de verdade dos metadados.
- `ipad_runtime/src/research/connectors/` — stubs de módulo por conector.
- `docs/DATA_SOURCE_MATRIX.md` — matriz cruzando cada conector com suas capacidades de dado e classes de ativo.
- `ipad_runtime/pack/manifest.pack.json` — postura de segurança do pacote local (`security_posture`).
- `ipad_runtime/pack/manifest.models.json` — mesmo padrão de honestidade de status (`FUTURE` em vez de "fake installed"), aplicado aos motores de IA.
- `ipad_runtime/src/research/engines/index.js` — mesmo padrão de agregador conceitual não ligado ao runtime ao vivo, aplicado aos motores de análise descritiva.
