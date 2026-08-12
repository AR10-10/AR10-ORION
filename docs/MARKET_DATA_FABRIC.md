# Market Data Fabric — Fase 1 (Instrument Registry + 1ª fonte TradFi real)

Relato honesto da execução da **Ordem Única — Expansão do Market Data
Fabric / CME + Futuros + Ativos Globais + Dados Reais**. A Ordem pedia
expansão do universo analisável para além de cripto (futuros de índice
americano, metais, energia, rates, FX — CME como fonte de referência
prioritária), com uma regra absoluta: **nunca inventar dado**, e uma
instrução final explícita: **"não parar no planejamento — executar até o
ponto máximo realmente possível no ambiente atual e reportar apenas os
bloqueios que forem genuínos."** Este documento é esse relato.

## O que já existia (auditado antes de construir)

Antes de escrever qualquer código novo, esta fase auditou a
infraestrutura real já presente no repositório — nenhuma peça abaixo foi
duplicada:

- **`ipad_runtime/src/market-data-bus/`** — o Market Data Bus real
  (`bus.js`), já agnóstico de fonte por design (`requestSnapshot({...,
  collect})`, `collect` sempre injetado pelo chamador). Pipeline
  Coleta→Normalização→Validação→Sincronização→Distribuição, fail-closed
  (cai no último snapshot bom, nunca fabrica).
- **`ipad_runtime/js/real-data/schema.js`** — o contrato de Evidence
  Object (`DADOS_INSUFICIENTES`/`NAO_APLICAVEL`, `CONNECTOR_STATES`,
  `STRUCTURAL_NAO_APLICAVEL_BY_INSTRUMENT`) que já rege todo conector real
  do Real Data Layer.
- **`ipad_runtime/ramber-ui/src/market-data-adapter.ts`** — a camada de
  abstração de provider (ADITIVO V-MAX Etapa 1), já desenhada para
  crescer: `MarketDataProviderId` era uma união fechada `'BINANCE' |
  'MEXC'` com o próprio header dizendo "arquitetura preparada para
  Bybit/OKX/Hyperliquid futuros".
- **`ipad_runtime/ramber-ui/src/omnibox/tradfi-assets.ts` +
  `TradFiEmptyState.tsx`** — uma taxonomia TradFi de 17 ativos
  (índices/big techs/commodities/forex) e o modo `marketMode==='TRADFI'`
  em `App.tsx`, **honestamente hardcoded desde o Overhaul Cross-Market**:
  nenhum fetch real, `TradFiEmptyState` em todo painel específico de
  ativo. Achado real desta auditoria: este é exatamente o seletor que a
  Ordem §15 pedia ("ATIVO→CLASSE... sem saber o símbolo técnico") — já
  existia como casca de UI, sem dado real atrás.
- **`docs/CONNECTOR_REGISTRY_DESIGN.md` + `configs/connector-registry.default.json`**
  — já continha uma entrada `yahoo-finance-adapter` (`current_status:
  PLANNED`) com um `future_notes` prevendo quase literalmente a decisão
  tomada nesta fase (endpoint não-oficial, mantido `PLANNED` até rota
  auditável ser confirmada na implementação). Ver atualização real feita
  nesse mesmo arquivo, seção "O que foi construído" abaixo.
- **`docs/FUTURE_READY_ASSET_CLASS_REGISTRY.md`** — documento `PLAN_ONLY`
  cobrindo uma taxonomia mais ampla de classes de ativo (`COMMODITY`,
  `FOREX`, `INDEX`, `SYNTHETIC_STOCK_FUTURES` vs. `REAL_STOCKS`, etc.).
  Vocabulário de camada diferente do usado aqui (aquele é para um futuro
  registro de portfólio; este documento é sobre a Evidence Object do Real
  Data Layer) — não conflitam, mas um leitor do repositório deveria
  conhecer os dois.

## Pesquisa real (WebSearch, não suposição)

### CME — modelo de licenciamento real

O feed oficial de dado de mercado da CME (REST/streaming) exige um
distribuidor licenciado (300+ vendors licenciados, ex. Databento) ou um
CME Information License Agreement direto — não é self-serve nem gratuito.
O site público da CME (cotação atrasada) é explicitamente **não** a API
oficial. Em janeiro de 2026 a CME encerrou as licenças gratuitas de
EOD/settlement, movendo-as também para trás de licença paga — um
fechamento real e recente, confirmado via WebSearch nesta sessão.
**Conclusão honesta:** não existe caminho gratuito/self-serve para o feed
real da CME nesta fase. Isso é um bloqueio genuíno, não uma escolha de
engenharia.

### Alternativa gratuita adotada — Yahoo Finance chart API

Dado o bloqueio acima e a regra de custo mínimo da Ordem (§13: fontes
públicas gratuitas antes de qualquer serviço pago), a fonte escolhida foi
o endpoint de gráfico da Yahoo Finance (`query1.finance.yahoo.com/v8/
finance/chart/{symbol}`), convenção de símbolo contínuo `XX=F` (`ES=F`,
`GC=F`, `CL=F`, ...). **Não é uma API oficialmente documentada pela
Yahoo** — é uma convenção pública, não-oficial, estável há mais de uma
década, confirmada nesta sessão via WebSearch (inclusive aparecendo
literalmente em título de página real da Yahoo Finance retornado pela
busca: "10-Year T-Note Futures,Sep-2026 (ZN=F)"). Documentada como tal em
todo comentário de código relevante — nunca apresentada como o feed
oficial da CME. Alternativas avaliadas e descartadas por documentação
insuficiente/inconsistente para verificação nesta sessão: Alpha Vantage
(25 req/dia, cobertura de futuros limitada), Finnhub (futuros
provavelmente gated), Twelve Data (convenção de símbolo de futuros
inconsistente nos exemplos públicos encontrados).

### Reference Data da CME (fatos públicos estáveis, distintos do feed ao vivo)

Tick size/tick value/tamanho de contrato de cada instrumento do
Instrument Registry (`ipad_runtime/src/market-data-bus/
instrument-registry.js`) foram confirmados individualmente via WebSearch
nesta sessão (CME Group + fontes de referência de corretoras/dados de
mercado) — **nunca escritos de memória sem checagem** (Regra de Ouro 1).
Isso pegou e corrigiu 2 erros reais de memória antes de virarem código:
tick value do Ether futures da CME é $12,50 (não $25 como lembrado
inicialmente) e o multiplicador do 3-Month SOFR é $2.500/ponto de índice
IMM com tick de dois níveis (não um único número "$1.000.000" como
assumido inicialmente) — a especificação real de tick do SOFR varia por
vencimento e está documentada como tal (nunca simplificada para um número
falso-único).

### MT5 — por que a ponte não pode ser um `fetch()` de navegador (Ordem Mestra §4)

`connector-registry.default.json` já tinha `mt5-bridge-adapter` como
`READ_ONLY_PLACEHOLDER`/`current_status: FUTURE`, com
`security_posture.mt5_bridge: ABSENT` no manifesto de segurança do
pacote — mas sem o "porquê" técnico documentado. WebSearch nesta sessão
confirmou a causa real, não suposta:

- **A MetaQuotes (fabricante do MT5) não publica uma API REST/WebSocket
  pública, gratuita e alcançável por `fetch()`/`WebSocket` de navegador
  para dado de mercado ou conta.** O único caminho oficial é o pacote
  Python `MetaTrader5` (`pypi.org/project/MetaTrader5`), e a própria
  documentação oficial (`mql5.com/en/docs/python_metatrader5`) é
  explícita: o pacote fala com o terminal via IPC **local** — "the two
  must coexist on the same machine" — não é um protocolo de rede, é
  comunicação entre processos na mesma máquina. Não existe uma URL
  `https://` que este navegador pudesse chamar mesmo com CORS/CSP
  perfeitos, porque não há servidor do outro lado — o terminal MT5 do
  Operador precisaria estar rodando localmente, e este app é uma PWA
  estática (GitHub Pages) sem processo companheiro nenhum.
- **O que existe de alcançável por `fetch()`/WebSocket são pontes
  comerciais de terceiros** (ex.: MetaApi, api2trade, MT5BridgeAPI,
  MTsocketAPI — todas confirmadas via WebSearch nesta sessão). Elas
  funcionam hospedando ELAS PRÓPRIAS uma instância do terminal (ou um
  serviço equivalente) na nuvem delas, e exigem que o Operador entregue
  as credenciais reais da conta da corretora (login + senha, no mínimo
  uma "senha de investidor" somente-leitura quando a corretora suporta)
  para essa empresa terceira — nunca para a corretora original. Isso é
  exatamente a superfície de exposição de credencial que este projeto
  recusa por design permanente (ver `../ipad_runtime/ramber-ui/src/gmil/
  README.md`, seção "Explicitamente recusado": HMAC/assinatura local
  "criaria o caminho técnico para credenciais/execução real — o que este
  projeto proíbe permanentemente"). Uma ponte MT5 comercial de terceiros
  é a mesma classe de risco, só com uma empresa a mais no meio.
- **A alternativa "menos ruim" — um bridge local rodando na própria
  máquina do Operador (script MQL5 dentro do terminal + processo local
  expondo `http://localhost:PORTA`) — ainda exigiria software rodando
  FORA do navegador**, que o Operador teria que instalar e manter
  separadamente (quebra a premissa "100% estático, zero backend, zero
  processo companheiro" deste projeto), e mesmo assim significa
  credencial (ainda que só a senha de investidor) sendo digitada em algum
  lugar fora da corretora oficial. É por isso que
  `connector-registry.default.json` já registra corretamente: "ANY
  execution capability would require an entirely separate,
  explicitly-approved future phase" — e o mesmo vale para leitura,
  não só execução, dado que toda rota real passa por credencial em
  trânsito.
- **Conclusão honesta:** MT5 continua `FUTURE`/`enabled_now: false` não
  por falta de tempo de implementação, mas porque toda rota tecnicamente
  real hoje (Python local, ponte comercial de terceiros, bridge
  self-hosted) exige ou (a) um processo fora do navegador que este
  projeto não tem, ou (b) entregar uma credencial real de corretora a
  alguém — as duas coisas que as restrições permanentes deste repositório
  proíbem. Isto não é uma limitação de sandbox desta sessão (diferente do
  bloqueio de rede da Fase 1) — é uma limitação estrutural de qualquer
  navegador, em qualquer dispositivo, mesmo com rede 100% liberada.

## Bloqueio de rede desta sessão de implementação (confirmado, não suposto)

`curl` direto contra `cmegroup.com`, `fapi.binance.com`,
`query1.finance.yahoo.com`, `api.stlouisfed.org` e `stooq.com` retornou
`000` (falha de conexão) para todos os 5 hosts. Em vez de assumir
instabilidade local, isso foi verificado contra o diagnóstico oficial do
ambiente (`$HTTPS_PROXY/__agentproxy/status`), que confirmou
`"kind":"connect_rejected","detail":"gateway answered 403 to CONNECT
(policy denial or upstream failure)"` para todos os 5 — um bloqueio de
política de rede explícito e autoritativo desta sessão de implementação
(`/root/.ccr/README.md`: "Do not retry or route around it — report the
blocked host"), consistente com o mesmo bloqueio já documentado em
`history-capture.js` em fases anteriores deste projeto. **Nenhum
conector novo desta fase foi executado contra a rede real nesta sessão.**
Por isso todo código novo foi verificado por outro caminho real e válido:
execução real de funções puras com fixtures numericamente
pré-validadas, e testes que mockam exclusivamente a fronteira de rede
(`fetch()`) com respostas no formato real e documentado da fonte — nunca
mockando a lógica de parsing/validação/state-machine em si, que roda de
verdade em todo teste. Verificação **ao vivo** (contra a rede real) fica
para um ambiente com saída liberada (dispositivo real do Operador).

### Correção honesta (Ordem Mestra, auditoria pós-Fase-1)

O relatório original da Fase 1 descreveu o bloqueio de verificação ao vivo
só como "política de rede deste sandbox" — subestimando um risco real e
mais sério. `ipad_runtime/ramber-ui/src/gmil/README.md` (módulo GMIL,
sessão anterior) já tinha pesquisado exatamente este mesmo host antes de
esta Ordem existir e concluído: *"Yahoo Finance (Macro Market) — os
endpoints não-oficiais mais usados bloqueiam CORS para `fetch()` de
origem arbitrária; exigiria um proxy de backend que este projeto (100%
estático, GitHub Pages) não tem."* WebSearch nesta sessão confirmou de
forma independente, com múltiplas fontes corroborando um problema descrito
como antigo e conhecido: `query1`/`query2.finance.yahoo.com` não enviam o
cabeçalho `Access-Control-Allow-Origin`. Ou seja, além do bloqueio de rede
deste sandbox de implementação, existe um **segundo bloqueio estrutural,
distinto e mais provável de persistir**: o próprio servidor da Yahoo
tipicamente rejeita `fetch()` direto de um navegador em outra origem —
isso afetaria qualquer usuário real rodando este PWA estático, não só
esta sessão. Nenhuma mudança de código foi necessária: a arquitetura
Evidence-First já cobre esse cenário exatamente como desenhada —
`probeJsonEndpoint` classifica isso honestamente como `BLOCKED_BY_CORS`
(nunca finge sucesso, nunca fabrica candle) — mas a documentação precisava
desta correção. `current_status` do `yahoo-finance-adapter` continua
`PLANNED` por esse motivo reforçado (não só rebaixado por precaução).

## O que foi construído (Fase 1)

1. **`ipad_runtime/js/real-data/schema.js`** (extensão aditiva) —
   `DATA_FRESHNESS` (`REAL_TIME`/`DELAYED`/`END_OF_DAY`/`HISTORICAL`),
   `READ_STATUS`/`FONTE_INDISPONIVEL`/`CONFLITO_DE_FONTES`, entrada
   `tradfi_futures` em `STRUCTURAL_NAO_APLICAVEL_BY_INSTRUMENT`
   (funding/liquidations/long_short_ratio = mecânica de perpétuo cripto,
   estruturalmente impossível num futuro datado da CME;
   open_interest/order_book permanecem `DADOS_INSUFICIENTES`, nunca
   `NAO_APLICAVEL` — são conceitos reais para um futuro CME, só não
   buscados por este conector ainda), e `detectSourceConflict(readings,
   tolerancePct)` (Ordem §7 — nunca escolher um valor silenciosamente
   quando fontes divergem).
2. **`ipad_runtime/src/market-data-bus/instrument-registry.js`** (novo,
   puro, zero rede) — catálogo real de 23 instrumentos futuros CME
   (19 Priority A/CORE do Ordem §5: índices ES/MES/NQ/MNQ/YM/MYM/RTY/M2K,
   metais GC/SI/HG, energia CL/NG, rates ZN/ZB/SR3, FX 6E/6J/6B; +
   BTC/MBT/ETH/MET — futuros datados da CME, registrados por completude
   mas fora do tier A de propósito, distintos do perpétuo Binance que já
   é o núcleo cripto do sistema). Funções de consulta puras
   (`findByInstrumentId`, `findByContractCode`,
   `findByContinuousSymbolHint`, `buildCascadingSelectorTree`) e a ponte
   `findByLegacyTradFiAssetSymbol` que liga o catálogo `tradfi-assets.ts`
   pré-existente a 9 dos 17 ativos legados (SPX/NDX/US30/RUT/XAUUSD/
   XAGUSD/USOIL/EURUSD/GBPUSD) sem duplicar aquele seletor.
3. **`ipad_runtime/js/real-data/tradfi-delayed-yahoo.js`** (novo) — sonda
   real (mesmo padrão de `binance-futures-public.js`: `probeJsonEndpoint`
   real, nunca reimplementado), parser defensivo (schema inesperado falha
   `BLOCKED_BY_SCHEMA`, nunca finge sucesso), `DATA_FRESHNESS.DELAYED`
   sempre. **Bug real pego pelos próprios testes desta fase antes de
   qualquer graduação:** `Number(null) === 0` em JavaScript — a forma
   columnar da Yahoo usa `null` (não `undefined`) para marcar sessão
   fechada; sem a guarda `toFiniteOrNull`, esse buraco real vinha
   convertido em candle "válido" com preço/volume zero. Corrigido antes
   de qualquer commit.
4. **`ipad_runtime/src/market-data-bus/tradfi-delayed-connector.js`**
   (novo) — mesmo contrato externo exato de
   `collectBinanceFuturesKlines`/`collectMexcFuturesKlines`
   (`collectTradfiDelayedKlines({symbol, timeframe, limit, endTime?,
   returnEvidence?}) -> Promise<candle[]>`), resolvendo `symbol` via o
   Instrument Registry (instrument_id ou contract_code) — nunca monta um
   símbolo Yahoo à mão.
5. **`market-data-adapter.ts`**: novo provider `TRADFI_DELAYED` (3º da
   união, exatamente a extensão que o header do arquivo já previa) —
   `DEFAULT_MARKET_DATA_PROVIDER` continua `BINANCE`, zero mudança de
   comportamento para qualquer consumidor cripto existente.
6. **`engine-bridge.ts`**: `getTradFiChartCandles(instrumentId, limit,
   timeframe)`, mesma forma/contrato de `getChartCandles` — chama o Bus
   direto com o provider `TRADFI_DELAYED` (instrument_id já é chave de
   cache inerentemente única, nenhum sufixo `-PERP`/`-MEXC` necessário).
7. **`App.tsx` + `TradFiRealChart.tsx`** (novo componente) — o gráfico
   principal do modo `TRADFI` agora mostra candle real (delayed) quando
   `findByLegacyTradFiAssetSymbol` resolve um instrumento; senão continua
   honesto em `TradFiEmptyState`. **Deliberadamente minimalista**: só
   candlestick + badge "DELAYED · Yahoo Finance (não-oficial)", zero
   overlay do Institutional Chart Engine, **zero import de
   nexus-core/Council/decision-layer** — LEI 24 permanece intacta por
   construção (Core Engine continua o único emissor real de
   LONG/SHORT/WAIT, e apenas para o par cripto selecionado). Todo o resto
   do modo TRADFI (order book/flow/heatmap/Siriform/Council/Regime)
   permanece em `TradFiEmptyState`: são estruturalmente `NAO_APLICAVEL`
   (mecânica de perpétuo) ou fora do escopo desta fase.
8. **`configs/connector-registry.default.json` +
   `docs/DATA_SOURCE_MATRIX.md`** — entrada `yahoo-finance-adapter`
   atualizada honestamente: novo asset class `tradfi_regulated_futures`
   (distinto de `stock_futures_synthetic`), `future_notes` relatando a
   implementação real desta fase, `current_status` **mantido
   `PLANNED`** de propósito (nunca promovido a `ACTIVE_READ_ONLY` sem uma
   sonda real passar contra a rede de verdade).

## Testes (execução real, não simulação)

47 testes novos, todos passando, cobrindo: `schema-tradfi.test.ts` (11),
`instrument-registry.test.ts` (18), `tradfi-delayed-yahoo.test.ts` (12,
incluindo o bug real do `Number(null)` acima), `tradfi-delayed-
connector.test.ts` (8), `market-data-adapter.test.ts` (+3 sobre o
provider novo), `engine-bridge-tradfi.test.ts` (4),
`tradfi-real-chart-wiring.test.ts` (8), mais os ajustes de contagem em
`diretriz3-fixes.test.ts` (3 call sites diretos ao Bus, documentado por
quê). Suíte completa: **155 arquivos, 2552 testes, 100% verde.**
`tsc --noEmit` limpo. `npm run build` ok.

## Critério de conclusão da Ordem (§20) — status honesto

| Critério | Status |
|---|---|
| CME integrada OU bloqueio documentado | **Bloqueio documentado** (licenciamento pago, sem self-serve) |
| Instrumentos core descobertos | ✅ 19 Priority A no Instrument Registry |
| Catálogo normalizado | ✅ `InstrumentDefinition` único, funções de consulta puras |
| Contratos identificados | ✅ contract_code/continuous_symbol_hint/tick real por instrumento |
| Fontes com timestamp | ✅ Evidence Object (`fetched_at`/`timestamp`/`freshness_ms`) |
| REAL_TIME/DELAYED/HISTORICAL explícito | ✅ `DATA_FRESHNESS`, sempre `DELAYED` nesta fonte |
| Dado real chega ao Market Data Fabric | ✅ código real, **não verificado ao vivo** (bloqueio de rede da sessão) |
| Motores conseguem consumir o dado | ⚠️ Parcial de propósito — ver "Deliberadamente fora do escopo" abaixo |
| Ativo aparece no seletor | ✅ 9 dos 17 ativos legados (`marketMode==='TRADFI'`) |
| Gráfico mostra dado real | ✅ `TradFiRealChart`, candle real quando resolvido |
| Análise usa o mesmo snapshot temporal | N/A nesta fase — TradFi não passa pelo Core Engine (ver LEI 24 abaixo) |
| Nada inventado | ✅ fail-closed em toda a cadeia, bug do `Number(null)` pego e corrigido antes de qualquer commit |
| MT5/TradingView sem caminho paralelo inconsistente | ✅ nenhum dos dois tocado nesta fase |
| Fail-closed intacto | ✅ |
| Testes/build verdes | ✅ |

## Fase 2 — 5 ações NASDAQ reais (pedido direto do Operador)

Pedido explícito do Operador: expandir a cobertura americana além dos
índices/commodities/FX já reais da Fase 1 para incluir ações individuais
(Tesla, Nvidia, Apple, Microsoft, Meta — os 5 "Big Techs" que já existiam
como navegação pura em `tradfi-assets.ts` desde o Overhaul Cross-Market,
sem dado real atrás). Confirmado com o Operador via `AskUserQuestion`
antes de construir: manter só o que já existia (índices/commodities/FX)
vs. também conectar as 5 ações — o Operador escolheu expandir.

**Auditado antes de codar**: `instrument-registry.js` é tipado e
documentado especificamente para futuros CME (`InstrumentDefinition` com
`designated_contract_market` = bolsa do CME Group, `tick_value_usd` =
multiplicador de contrato). Uma ação individual não é um futuro CME —
forçá-la no mesmo `instrument_type` (`tradfi_futures`) seria dado
estruturalmente errado (uma ação não tem contrato/vencimento/
multiplicador). Decisão: **mesmo array, `instrument_type` novo e honesto**
(`tradfi_equity`) — evita tanto forçar semântica errada quanto criar uma
segunda estrutura de arquivo paralela só para 5 linhas.

**Solução aplicada**: 5 novas entradas em `INSTRUMENT_REGISTRY`
(`NASDAQ_AAPL`/`NASDAQ_MSFT`/`NASDAQ_NVDA`/`NASDAQ_META`/`NASDAQ_TSLA`),
`asset_class: EQUITY` (nova), `exchange`/`designated_contract_market:
'NASDAQ'` (bolsa real de listagem, não um membro do CME Group — os dois
campos reaproveitados honestamente para significar "onde o instrumento
troca de mão"), `contract_code`/`continuous_symbol_hint` = o ticker puro
(convenção real da Yahoo para ações, sem sufixo `=F`), `tick_size`/
`tick_value_usd` = 0.01 (Reg NMS Rule 612 — incremento mínimo real de
cotação para ações ≥US$1, não um número inventado). `findByLegacy
TradFiAssetSymbol`/`tradfi-delayed-connector.js` são genéricos o
suficiente para resolver as 5 novas entradas **sem nenhuma mudança de
código** — só a extensão do catálogo. `schema.js` ganhou uma entrada
`tradfi_equity` em `STRUCTURAL_NAO_APLICAVEL_BY_INSTRUMENT`: mesma
mecânica de `tradfi_futures` (funding/liquidations/long_short_ratio
sempre `NAO_APLICAVEL`) **mais `open_interest`**, que aqui também é
`NAO_APLICAVEL` (diferente de `tradfi_futures`) — open interest é
conceito de derivativo (contratos de futuro/opção em aberto); uma ação à
vista não tem esse número (o mais próximo seria o open interest das
OPÇÕES daquela ação, um instrumento diferente, fora deste catálogo).

**AVISO REAL, não descoberto nesta fase mas reforçado por ela**: as 5
ações novas herdam o MESMO bloqueio estrutural de CORS já documentado
acima para os 9 futuros CME (`query1/query2.finance.yahoo.com` não envia
`Access-Control-Allow-Origin` para `fetch()` de origem arbitrária) —
"cadastrado no registry" não é o mesmo que "confirmado funcionando ao
vivo". Nenhum dos 14 instrumentos deste conector (9 futuros + 5 ações) foi
verificado contra a rede real nesta sessão nem em nenhuma anterior — o
mesmo bloqueio de rede do sandbox de implementação se aplica.

**Testes**: `instrument-registry.test.ts` ganhou um bloco dedicado (tick_
size/tick_value real, `contract_code`===`continuous_symbol_hint`===ticker
puro sem `=F`, exchange NASDAQ, Priority A, `listByAssetClass(EQUITY)`
exato) + o teste pré-existente de `findByLegacyTradFiAssetSymbol` migrou
TSLA/NVDA/AAPL/MSFT/META de "unmapped" pra "mapped" (contagem de pares
reais 9→14). `schema-tradfi.test.ts` ganhou o bloco espelho de
`tradfi_equity` (incluindo o `open_interest` NAO_APLICAVEL, único ponto
onde diverge de `tradfi_futures`). `tradfi-assets.ts`/`App.tsx`/
`docs/DATA_SOURCE_MATRIX.md` tiveram comentários "9 dos 17"/"nenhuma API
ligada" corrigidos para o estado real (14 dos 17) — achado real desta
auditoria: esses comentários já estavam parcialmente desatualizados desde
a própria Fase 1, não só por esta expansão.

## Deliberadamente fora do escopo desta fase (honesto, não esquecido)

- **CME direto**: bloqueado por licenciamento pago — sem caminho gratuito
  conhecido. Reavaliação só faz sentido se o Operador aprovar custo real
  de um distribuidor licenciado.
- **Verificação ao vivo**: nenhum conector novo desta fase rodou contra a
  rede real nesta sessão (bloqueio de política do sandbox). Precisa de um
  ambiente com saída de rede liberada.
- **Core Engine/análise sobre dado TradFi**: intencionalmente NÃO ligado.
  A Ordem pediu para o Operador **ver** dado real (§16); rodar o mesmo
  Core Engine/Council que hoje só analisa o par cripto perpétuo sobre um
  futuro CME datado seria uma mudança de escopo maior (mecânica de
  expiração/rollover, ausência de funding, ausência de liquidations) que
  o Operador não pediu explicitamente — LEI 24 preservada por
  simplesmente nunca conectar o novo dado a essa maquinaria.
- **3 dos 17 ativos legados sem mapeamento** (atualizado pela Fase 2
  acima — os 5 de ações TSLA/NVDA/AAPL/MSFT/META já mapeiam para um
  instrumento real agora): GER40 — Eurex, não CME; UKOIL/Brent — ICE, não
  CME; USDJPY — convenção de cotação do futuro 6J é o inverso do par
  spot, mapear sem inverter mostraria um preço logicamente errado.
  Documentado campo a campo em `instrument-registry.js`.
- **SOFR (SR3), CME_BTC/MBT/ETH/MET**: sem `continuous_symbol_hint` — a
  convenção Yahoo usada pelo conector não cobre esses símbolos. Ficam no
  catálogo (Priority A o SR3, B/C os cripto-CME) mas sem dado ao vivo
  possível nesta fase.
- **Rollover/contrato contínuo automatizado, painel de conflito entre 2
  fontes AO VIVO simultâneas**: nenhum dos dois tem uma segunda fonte
  real nesta fase para exercitar — `detectSourceConflict` existe e está
  testado, mas com uma única fonte real (Yahoo delayed) não há ainda um
  par de leituras vivas para comparar.
- **MT5**: não é "falta de uma segunda fonte para testar" — é um
  bloqueio estrutural real, pesquisado e documentado na seção "MT5 — por
  que a ponte não pode ser um `fetch()` de navegador (Ordem Mestra §4)"
  acima. Continua `FUTURE` por design, não por prioridade.
