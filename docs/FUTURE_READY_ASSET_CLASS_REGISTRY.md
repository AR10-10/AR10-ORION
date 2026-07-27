# Future-Ready Asset Class Registry — desenho do registro de classes de ativos

Documento de **plano/desenho** (`PLAN_ONLY`) para o AR10 Cyborg 2.0
(`ipad_runtime/`). Cobre a forma proposta de um registro de classes de
ativos capaz de descrever cripto, equities, futuros sintéticos, ETFs,
commodities, forex, índices e ações de mineração — sem ambiguidade entre
categorias parecidas mas tecnicamente distintas.

**Atualização honesta (OMEGA CORE V-MAX, completar Fase 7 — Radar/OIH):**
a lista de símbolos CRYPTO de `asset-universe.default.json` **agora É
lida de verdade**, mas só pelo runtime novo em `ipad_runtime/ramber-ui/`
(`src/nexus/radar-universe.ts` → `App.tsx`, universo do scanner de fundo
do Radar/OIH) — nunca pelo PWA legado descrito no parágrafo abaixo
(`index.html`/`js/app.js`/`service-worker.js` continuam sem nenhuma
referência a este arquivo, isso não mudou). O restante deste documento
— taxonomia de `instrument_type`, ranking dinâmico, expansão de
metadados por instrumento — continua 100% `PLAN_ONLY`, nada disso foi
implementado; só a extração/filtro/dedupe da LISTA de símbolos dos 3
grupos CRYPTO graduou para código real. Ver `SYSTEM_HANDBOOK.md` §6.39
para o relato completo.

**Nada mais neste documento está ligado ao PWA legado em produção
hoje.** Não existe nenhuma chamada em `index.html`, `js/app.js`,
`service-worker.js` ou qualquer outro arquivo desse runtime legado que
leia o arquivo de configuração referenciado abaixo. Fora a única exceção
real declarada acima, isto continua um fundamento (*foundation*) para
trabalho futuro, documentado agora para que a próxima etapa de
implementação tenha uma forma de dados já pensada — exatamente o mesmo
espírito de `pack/manifest.models.json` (`status: FUTURE`, roadmap
honesto, zero capacidade falsa).

## Arquivo de configuração associado

```
ipad_runtime/configs/asset-universe.default.json
ipad_runtime/configs/asset-universe.schema.json
```

O primeiro arquivo contém **listas seed/referência** (não exaustivas, não
permanentes) para quatro grupos de partida — `crypto_top_liquidity`,
`crypto_additional`, `pow_mining_crypto`, `mining_ai_hpc_equities`. O
segundo é a documentação de forma (schema) desses dados, mantida simples
de propósito, sem motor de validação acoplado — este continua sem
nenhum consumidor de runtime (`"wired_into_live_app": false` real e
atual no próprio `asset-universe.schema.json`). O arquivo de dados já não
está mais 100% inerte: os 3 grupos CRYPTO agora têm um consumidor real
(`ipad_runtime/ramber-ui/src/nexus/radar-universe.ts`), então seu próprio
`"wired_into_live_app"` virou `true` — só o grupo `mining_ai_hpc_equities`
(EQUITY) permanece tão não-lido quanto antes.

### Por que listas seed e não um "universo fixo"

As quatro listas seed existem para dar um ponto de partida legível a um
humano revisando o repositório, não para travar o universo de ativos do
produto. O campo `ranking_criteria_supported` no JSON declara os
critérios que o desenho já está preparado para suportar quando o ranking
dinâmico for implementado:

```
market_cap · volume · liquidity · open_interest · funding_rate ·
volatility · watchlist · user_defined_list
```

Hoje `ranking_criteria_active` está vazio — nenhum desses critérios está
calculando ranking de verdade. Quando essa camada existir, o `note` de
cada grupo já deixa explícito que a lista impressa no JSON é apenas o
ponto de partida, sujeita a reordenação ou substituição dinâmica.

## Tipos de instrumento (`instrument_type`)

Lista proposta para o campo `instrument_type` de um instrumento
individual no registro futuro. Cada tipo é uma categoria técnica
distinta — o objetivo desta tabela é impedir que duas categorias
parecidas sejam confundidas na hora de implementar.

| `instrument_type` | Definição breve |
|---|---|
| `CRYPTO_SPOT` | Criptoativo negociado à vista (spot), sem alavancagem nem data de vencimento. |
| `CRYPTO_PERP` | Contrato perpétuo de criptoativo (perpetual swap) — alavancado, com funding rate periódico, sem data de vencimento. |
| `CRYPTO_FUTURES` | Contrato futuro de criptoativo com data de vencimento definida (diferente de perpétuo). |
| `SYNTHETIC_STOCK_FUTURES` | Futuro sintético referenciado ao preço de uma ação, oferecido por uma exchange de derivativos/cripto — replica exposição de preço, **não é a ação real** nem confere direitos de acionista. |
| `REAL_STOCKS` | Ação real, roteada por uma corretora (broker) regulada, com liquidação e custódia tradicionais — o oposto do sintético acima. |
| `EQUITY` | Categoria genérica de renda variável (ação) quando o instrumento ainda não foi classificado entre `REAL_STOCKS` e `SYNTHETIC_STOCK_FUTURES`. |
| `ETF` | Fundo negociado em bolsa (Exchange-Traded Fund), cesta de ativos sob um único ticker. |
| `COMMODITY` | Mercadoria (ex.: ouro, petróleo) negociada via contrato ou instrumento referenciado. |
| `FOREX` | Par de moedas (mercado de câmbio). |
| `INDEX` | Índice de mercado (ex.: um benchmark agregando várias ações ou ativos). |
| `MINING_EQUITY` | Ação real de uma empresa de mineração de criptoativos e/ou infraestrutura de IA/HPC — é `EQUITY`/`REAL_STOCKS` de uma empresa, não um criptoativo. |
| `CUSTOM` | Categoria de escape para um instrumento que não se encaixa nos tipos acima, sempre com `risk_notes` explicando o motivo. |

## Metadados por instrumento

Campos propostos para descrever cada instrumento individual no registro
futuro (além dos campos mínimos já presentes em
`asset-universe.default.json`: `symbol`, `group`, `asset_class`,
`status`):

| Campo | Definição breve |
|---|---|
| `symbol` | Ticker/código do ativo (ex.: `BTC`, `MARA`). |
| `display_name` | Nome legível para exibição em UI (ex.: "Bitcoin", "MARA Holdings"). |
| `exchange` | Exchange/bolsa onde o instrumento é referenciado ou negociado. |
| `market_type` | Tipo de mercado (ex.: `SPOT`, `PERP`, `FUTURES`, `CASH_EQUITY`). |
| `asset_class` | Classe de ativo de alto nível (`CRYPTO`, `EQUITY`, e demais conforme o registro crescer). |
| `quote_currency` | Moeda de cotação (ex.: `USDT`, `USD`). |
| `base_currency` | Moeda/ativo-base do par (ex.: `BTC` em `BTC/USDT`). |
| `contract_type` | Tipo de contrato quando aplicável (ex.: `PERPETUAL`, `QUARTERLY`, `NONE` para spot/ação real). |
| `is_synthetic` | Booleano — `true` somente para instrumentos sintéticos (ex.: `SYNTHETIC_STOCK_FUTURES`). |
| `is_real_equity` | Booleano — `true` somente para ação real roteada por corretora (`REAL_STOCKS`). |
| `is_perpetual` | Booleano — `true` somente para contratos perpétuos (`CRYPTO_PERP`). |
| `is_spot` | Booleano — `true` somente para negociação à vista (`CRYPTO_SPOT`). |
| `region` | Região/jurisdição de referência do instrumento ou da bolsa listadora. |
| `trading_hours` | Janela de negociação (ex.: `24/7` para cripto, horário de pregão para equities). |
| `data_source_priority` | Ordem de preferência de fontes de dados para este instrumento, quando houver mais de uma fonte candidata. |
| `risk_notes` | Observações de risco específicas do instrumento (liquidez baixa, alavancagem implícita, sintético vs. real, etc.). |
| `current_status` | Status honesto do registro deste instrumento (ex.: `ACTIVE_REFERENCE`, `FUTURE`, `DEPRECATED`) — nunca `LIVE` enquanto não houver código consumidor real. |

Nenhum desses campos existe ainda em `asset-universe.default.json` — a
versão atual do JSON usa apenas o subconjunto mínimo (`symbol`, `group`,
`asset_class`, `status`) mais o agrupamento por `groups`. Esta tabela é o
desenho do que o registro suportaria quando expandido.

## Distinções (cláusula vinculante, citação literal)

Estas quatro frases são uma exigência explícita de design e devem ser
preservadas literalmente em qualquer implementação futura deste
registro, sem reinterpretação:

> Synthetic stock futures are not real shares. RealStocks/broker-routed
> equities are not crypto perps. Crypto perps are not spot assets.
> Mining equities are not mining coins.

Em português, para reforço (mesmo conteúdo, não uma segunda regra):

- **Futuros sintéticos de ações não são ações reais.** `SYNTHETIC_STOCK_FUTURES` replica exposição de preço via derivativo de uma exchange cripto/derivativos — não confere custódia, dividendo ou direito de acionista.
- **Ações reais roteadas por corretora não são perpétuos de cripto.** `REAL_STOCKS` é liquidação/custódia tradicional via broker regulado — não tem funding rate, não tem mecanismo de perpétuo.
- **Perpétuos de cripto não são ativos spot.** `CRYPTO_PERP` é alavancado e com funding periódico — `CRYPTO_SPOT` é posse direta do ativo sem alavancagem nem funding.
- **Ações de mineração não são moedas mineradas.** `MINING_EQUITY` (ex.: `MARA`, `RIOT`) é participação acionária numa empresa — `pow_mining_crypto` (ex.: `BTC`, `LTC`, `KAS`) é o criptoativo que essa empresa minera. Os dois grupos em `asset-universe.default.json` (`mining_ai_hpc_equities` e `pow_mining_crypto`) existem separados exatamente para impedir essa confusão.

## Por que isso é plano/desenho e não implementação (honestidade de engenharia)

1. **`asset-universe.schema.json` continua sem nenhum código lendo-o** —
   documentação de forma pura, sem `import`/`fetch` apontando para ele em
   lugar nenhum. `asset-universe.default.json` deixou de ser inerte: os
   3 grupos CRYPTO têm um leitor real hoje
   (`ipad_runtime/ramber-ui/src/nexus/radar-universe.ts`,
   `extractRadarUniverseSymbols`) — só a LISTA de símbolos, nunca o
   restante do desenho deste documento (taxonomia `instrument_type`,
   ranking dinâmico, metadados por instrumento continuam 100%
   `PLAN_ONLY`, não implementados).
2. **Ranking dinâmico é `FUTURE`.** Os critérios em
   `ranking_criteria_supported` (market cap, volume, liquidez, OI,
   funding, volatilidade, watchlist, lista do usuário) são suportados
   *pelo desenho do schema*, não calculados por nenhum motor hoje.
3. **As listas seed não são exaustivas nem permanentes.** Documentado
   verbatim no campo `note` de cada grupo do JSON — qualquer ativo
   adicional, remoção ou reordenação é esperada conforme o produto
   evolui.
4. **Zero superfície de execução.** Este registro é metadado descritivo
   (símbolo, classe, exchange, status) — nenhum campo proposto aqui
   carrega ordem, sinal de execução, chave de API ou conexão com
   corretora/exchange privada. Seguindo a mesma postura de segurança já
   declarada em `pack/manifest.pack.json` (`execution: DISABLED`,
   `order_send: ABSENT`, `mode: READ_ONLY`, `fail_closed: true`).

## Próximos passos quando este desenho for implementado (não compromisso de prazo)

1. ~~Um módulo `js/asset-universe.js` (ou equivalente) que carregue
   `configs/asset-universe.default.json` em modo leitura, sem rede
   externa~~ — **parcialmente feito, por um caminho diferente do
   previsto aqui**: o leitor real que existe hoje é
   `ipad_runtime/ramber-ui/src/nexus/radar-universe.ts` (runtime
   React/TS do Radar/OIH), não um `js/asset-universe.js` no PWA legado
   (esse continua não existindo). Mesma filosofia local-first (import
   estático, zero rede) — só o runtime consumidor mudou.
2. ~~Atualizar `wired_into_live_app` para `true` no JSON somente quando
   esse módulo existir de fato~~ — **feito** para o arquivo de dados
   (`asset-universe.default.json`), no mesmo commit que ligou o leitor
   real acima (nunca antes, mesma disciplina). `asset-universe.schema.json`
   continua `false` — nenhum motor de validação foi acoplado.
3. Implementar o ranking dinâmico real para os critérios em
   `ranking_criteria_supported`, populando `ranking_criteria_active`
   conforme cada critério for ligado — **ainda não feito**: o Radar/OIH
   ordena candidatos pelo `qualityIndex` do Corredor de Confluência
   (Fase 5), nunca por um dos critérios desta lista (market cap/volume/
   liquidez/OI/funding/volatilidade/watchlist/lista do usuário).
4. Expandir os metadados por instrumento (tabela acima) somente quando
   houver uma fonte de dados real para cada campo — nunca preencher com
   valor decorativo. **Ainda não feito.**

## O que este registro nunca vai fazer, nem no futuro

Executar ordem de compra ou venda, abrir ou fechar posição, usar API
secret ou qualquer chave privada, operar conta real, conectar a um
broker ou exchange via endpoint privado, ou contornar
READ_ONLY/FAIL_CLOSED sob qualquer forma. Esta é a mesma política de
segurança já aplicada em todo o `ipad_runtime/` — um registro de
metadados de ativos não é, e não pode se tornar, uma rota de execução.
