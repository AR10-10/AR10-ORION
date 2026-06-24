# Real Data Layer — Runtime Probe V1

*Sub-produto `ipad_runtime/` (AR10 Cyborg 2.0). Documenta a missão
`AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1`: a primeira fase em
que o runtime do iPad pode, opcionalmente e por sessão, ler dado real de
mercado público — sem chave de API, sem endpoint privado, sem execução, e
sem nunca rotular um dado como validado quando não foi. Esta missão **não**
substitui nem reabre o scaffold mais amplo de
`docs/CONNECTOR_REGISTRY_DESIGN.md`/`connector-registry.default.json` (14
conectores, todos ainda `PLANNED`/`FUTURE`); ela adiciona, em paralelo, 4
conectores com código de sonda real, descritos em
`ipad_runtime/configs/real-data-sources.default.json`.*

## Princípio central

> "Nenhum conector pode começar como `ACTIVE_READ_ONLY` por suposição. Só
> pode virar `ACTIVE_READ_ONLY` se a própria sonda real passar."

Todo o desenho abaixo existe para tornar essa frase verdadeira em código,
não só em texto: cada conector reseta para `PLANNED` a cada carregamento da
página (estado em memória, nunca lido de cache/sessão anterior como
ponto de partida), e só uma chamada real (`fetch()` contra um host público
sem chave, ou leitura de um arquivo local escolhido pelo usuário) pode
promovê-lo. Falha real vira estado honesto (`BLOCKED_BY_CORS`,
`BLOCKED_BY_SCHEMA`, `BLOCKED_BY_POLICY`, `DEGRADED`,
`DADOS_INSUFICIENTES`) — nunca um erro silencioso nem um "ativo" forjado.

## Arquivos desta missão

| Camada | Arquivo |
|---|---|
| Schema / Evidence-First Data Object | `ipad_runtime/js/real-data/schema.js` |
| Sonda HTTP/CORS real | `ipad_runtime/js/real-data/probe.js` |
| Conector CoinGecko (público) | `ipad_runtime/js/real-data/coingecko-public.js` |
| Conector Binance Spot (público) | `ipad_runtime/js/real-data/binance-public.js` |
| Conector MEXC Spot (público) | `ipad_runtime/js/real-data/mexc-public.js` |
| Conector de importação local | `ipad_runtime/js/real-data/csv-json-import.js` |
| Máquina de estados / orquestrador | `ipad_runtime/js/real-data/registry.js` |
| RealAnalysisFrame | `ipad_runtime/js/real-data/analysis-frame.js` |
| Research Engine Frame (3 rotas) | `ipad_runtime/js/research/research-engine.js` |
| Memória persistente (IndexedDB) | `ipad_runtime/js/memory/persistent-state.js` |
| Evidence Ledger | `ipad_runtime/js/memory/evidence-ledger.js` |
| Session Resume | `ipad_runtime/js/memory/session-resume.js` |
| Orquestração de UI / handlers / voz | `ipad_runtime/js/app.js` |
| Espelho declarativo (documentação) | `ipad_runtime/configs/real-data-sources.default.json` |

Nenhum desses módulos importa um SDK de exchange, usa WebSocket, lê
`localStorage` para segredo, ou chama um endpoint que exija autenticação.

## Connector State Machine

Vocabulário fechado, definido em `schema.js` (`CONNECTOR_STATES`) e
reproduzido em `registry.js`:

| Estado | Significado |
|---|---|
| `PLANNED` | Estado inicial de toda sessão, antes de qualquer sonda rodar. |
| `PROBING` | Sonda real em andamento agora (fetch em voo, ou leitura do arquivo local em andamento). |
| `ACTIVE_READ_ONLY` | A sonda real passou nesta sessão — schema válido, JSON parseável, timestamp presente. Só leitura; nunca habilita execução. |
| `DEGRADED` | Conexão funcionou mas a resposta veio incompleta/parcial (ex.: faltou um campo esperado, mas não o suficiente para classificar como erro de schema). |
| `BLOCKED_BY_CORS` | O navegador rejeitou a requisição por CORS — resultado real do `fetch()`, não uma suposição. |
| `BLOCKED_BY_SCHEMA` | A resposta chegou mas não bate com o formato esperado (JSON inesperado, campos ausentes que deveriam existir). |
| `BLOCKED_BY_POLICY` | Bloqueio decidido por este runtime (ex.: exceção não tratada na sonda, ou um endpoint que exigiria comportamento proibido). |
| `DADOS_INSUFICIENTES` | Estado terminal honesto quando nenhuma fonte está disponível o suficiente para sustentar uma leitura. |

`registry.js` mantém esse estado em um `Map` **em memória** (`sessionState`),
reinicializado a cada carregamento do módulo com todo conector em
`PLANNED` e `probe_detail: { reason: 'ainda_nao_sondado_nesta_sessao' }`.
Nada aqui é lido de `localStorage`/IndexedDB como ponto de partida — a
persistência (seção "Memória persistente" abaixo) só guarda o
**último resultado conhecido para exibição histórica**, nunca um atalho
para pular a sonda.

### Conectores registrados

```
NETWORK_CONNECTORS = [coingecko-market-data-adapter, binance-spot-public-adapter, mexc-public-market-adapter]
LOCAL_CONNECTORS   = [custom-csv-import-route]
```

| `connector_id` | Transporte | Host | Exige chave | Endpoint privado |
|---|---|---|---|---|
| `coingecko-market-data-adapter` | `network_fetch` | `https://api.coingecko.com` | Não | Ausente |
| `binance-spot-public-adapter` | `network_fetch` | `https://api.binance.com` | Não | Ausente |
| `mexc-public-market-adapter` | `network_fetch` | `https://api.mexc.com` | Não | Ausente |
| `custom-csv-import-route` | `local_file_read` | nenhum (nunca usa `fetch`/`XHR`) | Não | Ausente |

A CSP de `index.html` declara `connect-src 'self' https://api.coingecko.com
https://api.binance.com https://api.mexc.com` — exatamente os 3 hosts de
rede acima, nenhum host adicional, preservando o substring literal
`connect-src 'self'` exigido pela política de segurança do projeto.

### API pública do registry

- `listConnectors()` — lista todos os conectores com seu estado atual.
- `getConnectorMeta(id)` / `getConnectorState(id)` — consulta pontual.
- `getActiveReadOnlySources()` — conectores `ACTIVE_READ_ONLY` nesta sessão.
- `probeAllNetworkSources({ symbol, timeoutMs, onTransition })` — sonda os 3
  conectores de rede em paralelo (`Promise.all`).
- `probeNetworkConnector(connectorId, opts)` — sonda um único conector de
  rede (usado por "Atualizar dados reais").
- `probeLocalImport({ file, symbol, onTransition })` — único caminho que lê
  um arquivo local; nunca é disparado por "Testar fontes reais".
- `networkConnectorIds()` — lista de ids só dos conectores de rede.

Toda sonda passa por `runProbe()`, que: marca `PROBING` via `onTransition`
antes de chamar `mod.probe()`; envolve a chamada em `try/catch` (uma
exceção não tratada na sonda vira `BLOCKED_BY_POLICY`, nunca propaga como
erro não capturado para a UI); e só então marca o estado final.

## Runtime CORS Probe (`probe.js`)

A sonda real contra cada host público é um `fetch()` de verdade, com
classificação honesta do resultado:

1. **Erro de rede/CORS** (a própria Promise do `fetch` rejeita) →
   `BLOCKED_BY_CORS`.
2. **HTTP não-2xx** → `BLOCKED_BY_POLICY` ou `DEGRADED`, dependendo do
   código.
3. **JSON não parseável** → `BLOCKED_BY_SCHEMA`.
4. **JSON parseável mas sem os campos esperados** (candles vazios, sem
   timestamp) → `BLOCKED_BY_SCHEMA` ou `DADOS_INSUFICIENTES`.
5. **Tudo presente e coerente** → `ACTIVE_READ_ONLY`, evidência real
   construída a partir da resposta.

Nota documentada no próprio `probe.js`: dependendo da rede/plataforma, o
`fetch()` do navegador pode não distinguir de forma fina a causa exata de
uma rejeição (limitação real da API `fetch`, não deste código) — quando
isso acontece, o estado classificado é o mais honesto disponível com a
informação que o navegador de fato expõe, nunca um "ACTIVE" otimista.

## Evidence-First Data Object (`schema.js`)

Schema exato de toda evidência produzida por qualquer conector:

```
{
  source_id, source_name, endpoint_kind, symbol, instrument_type, timeframe,
  timestamp, fetched_at, freshness_ms, data_quality, missing_fields,
  raw_sample_hash,
  candles, ticker, order_book, volume, funding, open_interest,
  liquidations, long_short_ratio
}
```

- Os 8 últimos campos (`EVIDENCE_DATA_FIELDS`) são os campos de **dado de
  mercado** propriamente ditos. Qualquer um ausente vira o valor sentinela
  `DADOS_INSUFICIENTES` (deveria existir, a sonda não confirmou) ou
  `NAO_APLICAVEL` (estruturalmente impossível para aquele tipo de
  instrumento — ex.: `funding` para um spot).
- `STRUCTURAL_NAO_APLICAVEL_BY_INSTRUMENT` declara, por
  `instrument_type`, quais campos são `NAO_APLICAVEL` por definição:
  - `crypto_spot` → `funding, open_interest, liquidations, long_short_ratio`.
  - `crypto_futures` → nenhum (todos os campos fazem sentido).
  - `imported_series` → `order_book, funding, open_interest, liquidations, long_short_ratio`.
- `raw_sample_hash` é um SHA-256 real (hex), calculado por
  `hashRawSample()` sobre o texto bruto da resposta — prova de
  integridade local, não um valor decorativo.
- `validateEvidenceShape()` garante que todo objeto de evidência tem todas
  as chaves obrigatórias antes de ser aceito como `ACTIVE_READ_ONLY`.
- `computeDataQuality()` deriva um rótulo agregado (`REAL_COMPLETO`,
  `REAL_PARCIAL`, etc., conforme quantos campos saíram preenchidos vs.
  `DADOS_INSUFICIENTES`/`NAO_APLICAVEL`) — nunca uma média numérica
  inventada.

Nenhum campo de preço/volume/funding/OI/liquidação é jamais preenchido com
um valor sintético ou estimado para "parecer completo" — esse é o
corolário direto de `NO_FAKE_DATA` aplicado campo a campo.

## RealAnalysisFrame (`analysis-frame.js`)

```
{
  asset, instrument_type, timeframe, source, timestamp, freshness,
  candles_count, last_price, sma, ema, stddev, zscore, volume_status,
  support, resistance, volatility_state, missing_fields, data_quality,
  read_only: true, execution: "DISABLED_BY_POLICY",
  status, status_reason, window_used, engine_version
}
```

- `buildRealAnalysisFrame({ evidence, workerClient, windowSize })` exige no
  mínimo `MIN_CANDLES_FOR_ANALYSIS = 10` candles reais; abaixo disso (ou em
  qualquer falha do cálculo), devolve `emptyFrame()` com todo campo
  numérico = `DADOS_INSUFICIENTES`, `status: "DADOS_INSUFICIENTES"` e
  `status_reason` explicando o motivo exato.
- Quando há candles suficientes, `sma`/`ema`/`stddev`/`zscore` são
  calculados pelo mesmo Web Worker + núcleo Rust/WASM já usado pelo Replay
  BTC/USDT (`workerClient.computeSeries`) — nenhum cálculo estatístico
  novo e paralelo foi escrito; o RealAnalysisFrame reusa o motor existente
  sobre candles reais, em vez de duplicar lógica.
- `support`/`resistance` são literalmente `min`/`max` das máximas/mínimas
  reais da janela usada — nunca um valor projetado.
- `volatility_state` é `BAIXA`/`MEDIA`/`ALTA`, derivado de um *ratio*
  `stddev/last_price`, ou `DADOS_INSUFICIENTES` se o cálculo não for
  finito.
- `read_only: true` e `execution: "DISABLED_BY_POLICY"` são literais fixos
  em todo frame, real ou `DADOS_INSUFICIENTES` — nenhum caminho de código
  os altera.

## Research Engine Frame — 3 rotas (`research-engine.js`)

`buildResearchEngineFrame({ frame, evidence })` sempre devolve as **três**
rotas, nunca apenas a "favorita" do momento:

| Rota | Significado |
|---|---|
| `rota_a_long` | Caso para LONG, condicionado ao viés (`trendBias`) e suporte/resistência reais. |
| `rota_b_short` | Caso para SHORT, espelhado. |
| `rota_c_wait` | WAIT/NO TRADE — **sempre uma leitura legítima**, nunca uma rota vazia/preenchimento. |

Regras vinculantes:

- `confidence` é só `LOW` / `MEDIUM` / `HIGH` — nunca uma porcentagem
  estatística (a missão proíbe explicitamente "confiança como
  probabilidade").
- Se `frame.status !== 'OK'` (ou seja, o RealAnalysisFrame está
  `DADOS_INSUFICIENTES`), as rotas LONG e SHORT voltam com todos os campos
  textuais em `DADOS_INSUFICIENTES` e `confidence: 'LOW'` — nunca inventam
  um nível de preço.
- `HIGH` em LONG/SHORT só ocorre quando o viés de tendência (SMA vs. EMA
  vs. preço) **concorda** com a direção da rota **e** o volume é real
  (não `DADOS_INSUFICIENTES`/`NAO_APLICAVEL`); caso contrário cai para
  `MEDIUM` ou `LOW`.
- `rota_c_wait` tem 3 ramos possíveis (frame insuficiente / viés neutro /
  viés direcional com ressalva de fonte única) — todos textualmente
  honestos sobre o motivo de esperar, nunca um texto genérico de
  preenchimento.
- `futures_derivatives_data` (`funding`, `open_interest`, `liquidations`,
  `long_short_ratio`) herda diretamente os valores da evidência — quando a
  fonte ativa é um conector spot (que estruturalmente não tem esses
  campos), aparecem como `NAO_APLICAVEL`, nunca como zero ou estimativa.
- `read_only: true`, `execution: "DISABLED_BY_POLICY"` — nenhuma rota
  jamais envia, abre ou simula uma ordem; isso é reforçado também em
  `limitations[]`, um array de avisos textuais sempre presente no frame.

## Siriform — explicação em PT-BR dos dados reais

`handleExplainRealData()` (`app.js`) monta a explicação via
`buildRealDataExplanation()`, cobrindo, na ordem:

1. Se a tela está mostrando memória de sessão anterior ainda não
   revalidada (`isShowingHistoricalData()`).
2. Qual fonte está `ACTIVE_READ_ONLY` agora, ou qual foi a última
   conhecida se nenhuma está ativa nesta sessão.
3. Cada conector bloqueado e o motivo real do bloqueio
   (`probe_detail.reason`), nunca um bloqueio decorativo.
4. Quais campos da evidência ativa estão ausentes
   (`DADOS_INSUFICIENTES`) na última leitura.
5. Por que o RealAnalysisFrame está em `DADOS_INSUFICIENTES`, quando for
   o caso.
6. Por que a Research Engine sempre mostra as três rotas.
7. Por que a execução real continua bloqueada
   (`DISABLED_BY_POLICY`/`READ_ONLY`/`FAIL_CLOSED`).

O texto é exibido (`#rdl-explanation-text`), logado no console de
diagnóstico, e falado via `voice.speak()` (best-effort, sem rede — ver
`ipad_runtime/js/voice.js`).

## Memória persistente / Session Resume / Evidence Ledger

Tudo em IndexedDB (via `storage.js`), nunca em RAM-only e nunca em
`localStorage`:

- **`persistent-state.js`** — `recordProbeResult()` grava, por conector,
  `{ state, last_probed_at, block_reason }` e a evidência mais recente;
  atualiza `activeSource` só quando o estado é `ACTIVE_READ_ONLY`, e o
  limpa (registrando `lastDadosInsuficientes`) quando deixa de ser.
  `recordAnalysisFrame()`/`recordResearchFrame()` guardam o último frame de
  cada tipo. `loadAll()` devolve tudo de uma vez para a reidratação.
- **`evidence-ledger.js`** — histórico de até 50 entradas
  (`{ connector_id, state, evidence, recorded_at }`), mais recente
  primeiro, exportável via botão dedicado.
- **`session-resume.js`** — `rehydrateSession()` lê o estado persistente +
  ledger e devolve `has_previous_session` (verdadeiro se existir qualquer
  rastro de sessão anterior).

### Honestidade de sessão (a regra que evita "fonte ativa fantasma")

Reidratar memória **nunca** marca um conector como `ACTIVE_READ_ONLY` só
porque ele estava assim numa sessão passada. `app.js` mantém dois
sinalizadores:

- `sessionHasRealProbe` — só vira verdadeiro depois que uma sonda real
  desta sessão (não da memória) atinge `ACTIVE_READ_ONLY`.
- `rehydratedPreviousSession` — verdadeiro se havia qualquer sessão
  anterior conhecida.

`isShowingHistoricalData()` = `rehydratedPreviousSession &&
!sessionHasRealProbe`. Enquanto isso for verdade, os cards mostram uma
nota explícita de "ainda não revalidado nesta sessão", e **Gerar
AnalysisFrame real** fica bloqueado até uma sonda real desta sessão
confirmar a fonte (não basta ter evidência antiga em memória). No
instante em que uma sonda real desta sessão confirma uma fonte, o
ponteiro de fonte reidratada (`rehydratedActiveSourceId`) é zerado — a
informação histórica deixa de ser a mais relevante.

No boot, `bootRehydrateSession()` já chama essa mesma lógica
automaticamente (mesma rotina do botão "Reidratar sessão", sem precisar
de toque manual) — o usuário vê o último estado real conhecido assim que
abre o app, sempre com o aviso de "não revalidado" até tocar em "Testar
fontes reais".

## Painel / comandos (UI + voz)

Todos os botões abaixo reusam só os módulos listados acima — nenhum chama
`order_send`/`newOrder`/`placeOrder`/`cancelOrder`, nenhum endpoint
privado:

| Botão | Handler | Comando de voz equivalente |
|---|---|---|
| Testar fontes reais | `handleTestRealSources` | "testar fontes reais" |
| Atualizar dados reais | `handleRefreshRealData` | "atualizar dados reais" |
| Importar CSV/JSON local | `handleImportRealCsv` | — (ação local, sem voz) |
| Gerar AnalysisFrame real | `handleGenerateRealAnalysis` | "gerar analysisframe real" |
| Ver fonte/evidência | `handleShowEvidence` | — |
| Ver campos ausentes | `handleShowMissingFields` | — |
| Explicar dados reais | `handleExplainRealData` | "explicar dados reais" |
| Reidratar sessão | `handleRehydrateSession` | "reidratar sessão" |
| Exportar Evidence Ledger | `handleExportEvidenceLedger` | — |

`dispatchVoiceCommand()` despacha para exatamente os mesmos handlers que
os botões — nunca uma rota de execução paralela só para voz, mesma regra
já aplicada a todos os outros comandos de voz do app
(`docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md`).

## Cache do Service Worker

`CACHE_VERSION` avançou de `cyborg-ipad-runtime-v8` para
`cyborg-ipad-runtime-v9` — os 12 módulos novos (`js/real-data/*.js`,
`js/research/research-engine.js`, `js/memory/*.js`) foram adicionados a
`PRECACHE_URLS`. O arquivo `configs/real-data-sources.default.json` **não**
foi adicionado ao precache porque, como os demais arquivos em
`configs/`, é só espelho declarativo/documentação — nenhum módulo JS faz
`fetch()` dele em runtime.

O `install` do Service Worker continua chamando `self.skipWaiting()` sem
condição (comportamento preexistente, preservado). Por isso, a detecção
de "Atualização disponível" no `app.js` não depende de `reg.waiting`
(que dificilmente seria observável com skipWaiting incondicional), e sim
do evento `controllerchange`, filtrado para só disparar quando a página já
estava sendo controlada por uma versão anterior (nunca no primeiro
install). O banner (`#sw-update-banner`) deixa "Atualizar agora" (recarrega
a página) e "Mais tarde" (só esconde o aviso, nada é forçado) — rollback
seguro preservado, nenhuma ação de cache é destrutiva ou automática sem
toque do usuário.

## Invariantes de segurança preservados

Nenhum dos itens abaixo foi tocado por esta missão — todos continuam como
antes, e o código novo foi auditado para não introduzir nenhuma exceção:

- `READ_ONLY`, `FAIL_CLOSED`, `LOCAL_FIRST`.
- `NO_REAL_TRADING_NOW`, `NO_ORDER_EXECUTION_NOW`.
- `NO_API_SECRET`, `NO_PRIVATE_KEYS`, `NO_SECRET_IN_LOCALSTORAGE`
  (nenhum módulo novo usa `localStorage`; tudo é IndexedDB/OPFS).
- `NO_FAKE_DATA` — todo campo de mercado ausente vira
  `DADOS_INSUFICIENTES`/`NAO_APLICAVEL`, nunca um valor inventado.
- `DADOS_INSUFICIENTES_WHEN_REAL_DATA_MISSING`.
- Nenhum SDK inteiro de exchange foi importado (MEXC público é
  reimplementado à mão com só os 2-3 endpoints necessários — ver
  `docs/AR10_CYBORG_2_TECH_SOURCE_LIBRARY_V1.html`, seção MEXC API SDK).
- CSP `connect-src 'self' https://api.coingecko.com https://api.binance.com
  https://api.mexc.com` — substring `connect-src 'self'` preservado.

## Ver também

- `docs/READ_ONLY_MARKET_SAFETY.md` — as 14 leis de segurança vinculantes.
- `docs/REAL_DATA_POLICY.md` — princípio dado sintético vs. dado real, atualizado por esta missão.
- `docs/CONNECTOR_REGISTRY_DESIGN.md` / `docs/DATA_SOURCE_MATRIX.md` — o roteiro mais amplo de 14 conectores (inerte, não tocado por esta missão).
- `docs/AR10_CYBORG_2_TECH_SOURCE_LIBRARY_V1.html` — avaliação de bibliotecas/SDKs candidatos, incluindo por que o SDK completo da MEXC foi rejeitado.
- `ipad_runtime/configs/real-data-sources.default.json` — espelho declarativo dos 4 conectores desta missão.
