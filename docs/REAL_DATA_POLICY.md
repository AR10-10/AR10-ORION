# Real Data Policy — dados sintéticos vs. dados reais no AR10 Cyborg 2.0

*Escopo: sub-produto `ipad_runtime/` (AR10 Cyborg 2.0). Fonte declarativa:
`ipad_runtime/configs/market-data-policy.json`; espelho em runtime:
`ipad_runtime/js/data-policy.js` (conteúdo idêntico). Esta política é um
corolário operacional das leis `NO_FAKE_DATA` e `READ_ONLY` consolidadas em
`docs/READ_ONLY_MARKET_SAFETY.md`.*

## Princípio

O replay BTC/USDT deste runtime é **dados sintéticos, offline**
(`SYNTHETIC_OFFLINE_SAMPLE`, gerado por `tools/generate_replay.py`,
`live: false`, `exchange_connection: "NONE"`). Ele existe **apenas como
diagnóstico técnico**: prova que o motor WASM, o Web Worker, o
armazenamento local (OPFS/IndexedDB) e o engine de replay funcionam
de ponta a ponta neste iPad.

O replay sintético **nunca** pode ser usado para:

- análise de mercado real;
- sinal de trade;
- decisão Long / Short / Wait;
- recomendação de qualquer tipo.

Tanto o card **Replay BTC/USDT** quanto o **AnalysisFrame** trazem o rótulo
verbatim na interface:

> Teste técnico offline — dados sintéticos, não usar para decisão de mercado.

## Dois modos, claramente separados

### Modo de Diagnóstico Técnico (este build)

- Dataset: `SYNTHETIC_OFFLINE_SAMPLE`.
- Uso permitido: provar WASM/worker/storage/engine.
- Uso proibido: qualquer decisão de mercado.

### Modo de Dados de Mercado Real (fase futura, somente-leitura)

Para uma análise de mercado **real** ser apresentada, são exigidos, juntos:

- uma fonte **pública / somente-leitura** real;
- `symbol` (par/ativo);
- `timeframe`;
- `timestamp`;
- `freshness` (frescor — quão recente é o dado).

Enquanto **qualquer** um desses faltar, o estado honesto exibido é
**`DADOS INSUFICIENTES`** — nunca um número inventado (isto é `NO_FAKE_DATA`
aplicado a dado de mercado).

Até a missão `AR10_CYBORG_2_SAFE_REAL_DATA_LAYER_RUNTIME_PROBE_V1`, nenhum
conector de dados ao vivo tinha código real (todas as 14 entradas de
`connector-registry.default.json` eram só `FUTURE`/scaffolding,
`enabled_now: false`) e a análise de mercado real era, por isso,
`DADOS INSUFICIENTES` por design, sem exceção possível.

A partir dessa missão, **4 conectores têm sonda real implementada**
(`ipad_runtime/js/real-data/{coingecko-public,binance-public,mexc-public,
csv-json-import}.js`, orquestrados por `registry.js` — ver
`ipad_runtime/configs/real-data-sources.default.json`, um arquivo separado
que documenta só esses 4 e nunca duplica/substitui o roteiro mais amplo de
`connector-registry.default.json`). A regra continua honesta e não muda o
princípio acima, só o resultado possível: todo conector começa `PLANNED`
em toda sessão e só passa a `ACTIVE_READ_ONLY` se a própria sonda real
(fetch de verdade ou leitura real de arquivo local) tiver sucesso naquela
sessão — nunca por suposição, cache de sessão anterior ou valor padrão.
Quando nenhuma sonda passa (rede indisponível, CORS, schema inesperado),
o painel "Real Data Layer" mostra `DADOS_INSUFICIENTES` exatamente como
antes; quando uma sonda passa, os campos que aquele conector não cobre por
natureza (ex.: funding/open interest num conector só de spot) continuam
`DADOS_INSUFICIENTES`/`NÃO_APLICÁVEL` campo a campo, nunca inventados.
Detalhe completo em
`docs/AR10_CYBORG_2_REAL_DATA_LAYER_RUNTIME_PROBE_V1.md`.

## Permitido vs. bloqueado

| Categoria | Estado |
|---|---|
| `PUBLIC_DATA_ALLOWED` | Permitido (fontes públicas/somente-leitura, quando conectadas em fase futura). |
| `READ_ONLY_CONNECTORS_ALLOWED` | Permitido — conectores apenas de leitura. |
| `PRIVATE_FINANCIAL_DATA_BLOCKED` | Bloqueado — nenhum dado financeiro privado. |
| `NO_PRIVATE_ACCOUNT_ACCESS` | Bloqueado — nenhum acesso a conta privada. |
| `NO_REAL_EXECUTION` | Bloqueado — execução é `DISABLED_BY_POLICY`. |
| `NO_SECRET_IN_LOCALSTORAGE` | Bloqueado — nenhum segredo em `localStorage` (não há uso de `localStorage` em todo o runtime). |

### Fontes públicas/somente-leitura permitidas (fase futura)

- MEXC public market data;
- MEXC futures public data;
- Binance public data;
- CoinGecko;
- CoinGlass (se disponível);
- Yahoo / Google Finance (dados de referência, se disponível);
- CSV / JSON público importado;
- metadados públicos de documentação/fonte.

Mesmo essas, quando habilitadas, só poderão **ler e descrever** — nunca
executar, nunca tocar endpoint privado, nunca usar chave de API. Qualquer
capacidade de execução exigiria uma fase inteiramente separada e
explicitamente aprovada (mesma linguagem de `mt5-bridge-adapter` em
`connector-registry.default.json`).

## Relação com os outros documentos

| Documento | Relação |
|---|---|
| `docs/READ_ONLY_MARKET_SAFETY.md` | Define `NO_FAKE_DATA` e `READ_ONLY`, das quais esta política é o corolário operacional para dado de mercado. |
| `docs/ANALYSIS_OUTPUT_CONTRACT.md` | Define a regra `DADOS INSUFICIENTES` que esta política reusa para o modo de dados reais. |
| `docs/CONNECTOR_REGISTRY_DESIGN.md` | Define o registro cujos conectores `FUTURE`/`enabled_now: false` tornam a análise real `DADOS INSUFICIENTES` hoje. |
| `docs/DATA_SOURCE_MATRIX.md` | Lista as fontes públicas/somente-leitura referenciadas aqui. |
| `docs/AR10_CYBORG_2_REAL_DATA_LAYER_RUNTIME_PROBE_V1.md` | Documenta os 4 conectores com sonda real implementada nesta missão, o Evidence-First Data Object, o RealAnalysisFrame e a Research Engine Frame que consomem este princípio. |
