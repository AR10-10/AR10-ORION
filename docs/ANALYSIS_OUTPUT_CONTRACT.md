# Analysis Output Contract — formato padrao de relatorio de analise (FUTURE)

Documento de design. Define o **template/contrato de saida** padrao para
qualquer relatorio de analise que este sistema venha a produzir no
futuro — seja narrado por uma camada Meta Llama/WebLLM (ver
`docs/META_LLAMA_WEBLLM_ROUTE.md`), seja gerado por um research engine
futuro que avalie o `docs/STRATEGY_PLAYBOOK.md` contra dados de mercado.

**Este contrato nao existe como codigo funcionando hoje.** A
implementacao real e atual deste runtime e o `AnalysisFrame` (ver
`ipad_runtime/js/replay-engine.js` e o card `analysis-frame-panel` em
`ipad_runtime/index.html`) — candles, SMA, EMA, desvio padrao e z-score,
estatistica descritiva pura. O template abaixo, com ROTA A/B/C, niveis-
chave, dados de derivativos e secao de evidencia, e roadmap declarado,
nao uma funcionalidade disponivel nesta versao. Ver a secao final deste
documento para o detalhe exato dessa fronteira.

## Regra vinculante mais importante deste documento (callout)

> **SE FALTAR DADO, A RESPOSTA E: `DADOS INSUFICIENTES`.**
>
> Nao inventar precos, niveis de liquidacao, valores de funding, open
> interest, volume ou noticias.

Esta e a regra de maior prioridade de todo este contrato — mais
importante que preencher qualquer campo do template abaixo. Em texto
verbatim do responsavel pelo produto:

> "If data is missing, return: DADOS INSUFICIENTES. Do not invent
> prices, liquidation levels, funding values, open interest, volume or
> news."

Qualquer implementacao futura deste contrato — Meta Llama/WebLLM,
research engine, ou qualquer outra camada — deve retornar
`DADOS INSUFICIENTES` no campo relevante (e, se a lacuna for grave o
suficiente, no relatorio inteiro) em vez de preencher um numero
plausivel-mas-inventado. Preencher um campo com um valor que pareca
razoavel mas nao venha de uma fonte de dados real e a falha mais grave
que este contrato existe para prevenir — pior que deixar o campo vazio
ou marcado como ausente. Isso vale para todo instrumento e toda fonte:
nao ha exceção "para dar uma resposta completa".

## O que significa ROTA A / ROTA B / ROTA C

`ROTA` aqui significa Rota/Caminho — ja usado neste repositorio em
`docs/META_LLAMA_WEBLLM_ROUTE.md` ("Rota A Long / Rota B Short / Rota C
Esperar") e em `ipad_runtime/index.html` (`decision-frame-panel`, que cita
a mesma fronteira). Este documento formaliza essas tres rotas como
contrato de saida:

- ROTA A — LONG: leitura descritiva de um cenario de alta, com seus
  proprios sub-campos (zona de entrada, invalidacao, stops, alvos).
- ROTA B — SHORT: leitura descritiva de um cenario de baixa, mesmos
  sub-campos de ROTA A, espelhados.
- ROTA C — WAIT/NO TRADE: leitura descritiva de que, no momento da
  analise, nenhum dos dois cenarios acima tem confirmacao suficiente para
  ser apresentado com responsabilidade.

As tres rotas sao sempre apresentadas em paralelo, nunca uma direcao
forcada unica. Um relatorio que segue este contrato nao "escolhe" Long
ou Short e omite o outro lado — ele descreve os tres cenarios possiveis
e deixa explicito qual(is) tem mais sustentacao no momento da leitura.
Isso e coerente com `docs/STRATEGY_PLAYBOOK.md`: cada estrategia ali
define `long_criteria` E `short_criteria` E `wait_criteria` ao mesmo
tempo, nunca so um lado.

### ROTA C nao e um afterthought — e tao legitima quanto A e B

Esta e uma decisao de design explicita, nao um detalhe secundario:
muitos mercados reais nao tem um bom trade no momento da leitura, e
um sistema honesto precisa conseguir dizer isso claramente, em vez de
forcar uma leitura A ou B so para "ter uma resposta". Por isso:

- ROTA C tem os mesmos quatro sub-campos estruturados que ROTA A/B tem
  (oito, no caso de A/B) — nao e um campo de texto livre solto no fim do
  relatorio.
- A estrategia `high-volatility-no-trade` em `docs/STRATEGY_PLAYBOOK.md`
  existe especificamente para os casos em que a resposta correta e ROTA C
  por definicao — isso e tratado como um resultado de primeira classe do
  playbook, nao como uma falha de nao encontrar um sinal.
- Nenhuma implementacao futura deste contrato deve ser avaliada como
  "melhor" por produzir menos ROTA C — uma proporcao alta de ROTA C em
  mercado lateral/ruidoso/com dados incompletos e o comportamento
  correto, nao um defeito a ser corrigido.

## Estrutura completa do template (campos verbatim)

```
ASSET, INSTRUMENT TYPE, TIMEFRAME, MARKET STATE,

ROTA A — LONG
  Entry zone
  Invalidation
  Stop logic
  Target 1
  Target 2
  Extended target
  Required confirmation
  Risk note

ROTA B — SHORT
  Entry zone
  Invalidation
  Stop logic
  Target 1
  Target 2
  Extended target
  Required confirmation
  Risk note

ROTA C — WAIT/NO TRADE
  Reason
  Trigger to re-evaluate
  Data missing
  Safer condition

KEY LEVELS
  Support
  Resistance
  Liquidity
  Retracement
  Volatility

FUTURES/DERIVATIVES DATA
  Funding
  OI
  Liquidation
  Long-Short ratio
  Basis
  Data quality

EVIDENCE
  price/futures data source
  timestamp
  data quality
  missing fields

LIMITATIONS
```

## Descricao campo a campo

### Cabecalho

| Campo | O que descreve |
|---|---|
| `ASSET` | O ativo analisado (ex.: BTC, ETH, MARA) — mesmo vocabulario de simbolo usado em `ipad_runtime/configs/asset-universe.default.json`. |
| `INSTRUMENT TYPE` | Tipo de instrumento (ex.: spot, perpetual futures, equity) — necessario porque `FUTURES/DERIVATIVES DATA` so se aplica a alguns tipos. |
| `TIMEFRAME` | O timeframe da leitura (ex.: 15m, 1h, 4h, 1d). Uma analise pode citar `multi-timeframe-confluence` (ver playbook) internamente, mas o relatorio declara qual e o timeframe primario. |
| `MARKET STATE` | Classificacao geral do estado de mercado no momento da leitura (ex.: tendencia, range, alta volatilidade) — geralmente corresponde a `market_condition` de uma ou mais estrategias do playbook. |

### ROTA A — LONG / ROTA B — SHORT

Os dois blocos tem exatamente os mesmos oito sub-campos, espelhados:

| Sub-campo | O que descreve |
|---|---|
| `Entry zone` | Faixa de preco onde o cenario (Long ou Short) faria sentido, nao um preco unico exato. |
| `Invalidation` | Condicao que torna este cenario obsoleto (ver `invalidation` de cada estrategia em `docs/STRATEGY_PLAYBOOK.md`). |
| `Stop logic` | Logica de onde um stop faria sentido descritivamente — nunca uma ordem real, nunca enviada a corretora alguma. Este runtime nao tem `order_send` em nenhum lugar (ver `ipad_runtime/README.md`). |
| `Target 1` | Primeiro alvo descritivo, tipicamente o nivel-chave mais proximo na direcao do cenario. |
| `Target 2` | Segundo alvo descritivo, geralmente o proximo nivel-chave relevante. |
| `Extended target` | Alvo estendido/especulativo, marcado como tal — explicitamente menos confiavel que Target 1/2. |
| `Required confirmation` | O que ainda precisa se confirmar para este cenario ganhar forca (frequentemente espelha `long_criteria`/`short_criteria` do playbook que ainda nao estao 100% satisfeitos). |
| `Risk note` | Observacao de risco especifica deste cenario (espelha `risk_notes` da(s) estrategia(s) do playbook usada(s)). |

### ROTA C — WAIT/NO TRADE

| Sub-campo | O que descreve |
|---|---|
| `Reason` | Por que, no momento da leitura, nem ROTA A nem ROTA B tem confirmacao suficiente (ex.: criterios mistos, volatilidade extrema, dados incompletos). |
| `Trigger to re-evaluate` | O que precisaria mudar para justificar reavaliar como ROTA A ou ROTA B (ex.: normalizacao de volatilidade, fechamento de confirmacao, dado que falta ficar disponivel). |
| `Data missing` | Lista explicita de quais dados, se estivessem disponiveis, mudariam a leitura — ou `NENHUM` se todos os dados necessarios estavam presentes e a resposta ainda assim foi WAIT por criterio de mercado. |
| `Safer condition` | Descricao do tipo de condicao de mercado que tornaria esta leitura mais segura de avaliar (ex.: "range com pelo menos dois toques validados em cada extremo"). |

### KEY LEVELS

| Sub-campo | O que descreve |
|---|---|
| `Support` | Nivel(is) de suporte relevante(s) identificado(s) na analise. |
| `Resistance` | Nivel(is) de resistencia relevante(s). |
| `Liquidity` | Zona(s) de liquidez evidente (ver `liquidity-sweep-reversal` no playbook) — onde stops tendem a se concentrar. |
| `Retracement` | Nivel(is) de retracao relevante(s) (ex.: zona de pullback esperada dentro de uma tendencia). |
| `Volatility` | Leitura de volatilidade atual vs. tipica (a mesma medida de desvio padrao/z-score que o `AnalysisFrame` real ja calcula hoje). |

### FUTURES/DERIVATIVES DATA

Aplica-se apenas quando `INSTRUMENT TYPE` for um instrumento derivativo
(ex.: perpetual futures). Para spot/equity sem mercado de derivativos
correspondente, todos os sub-campos devem ser `NAO APLICAVEL`, nunca
inventados.

| Sub-campo | O que descreve |
|---|---|
| `Funding` | Funding rate atual e contexto recente (ver `funding-extreme-contrarian` no playbook). |
| `OI` | Open interest atual e variacao recente (ver `oi-expansion-trend` no playbook). |
| `Liquidation` | Dados de liquidacao recente/concentrada, quando disponiveis. |
| `Long-Short ratio` | Proporcao de posicionamento long vs. short, quando a fonte de dados expoe esse numero. |
| `Basis` | Diferenca entre preco do derivativo e preco a vista (spot), quando aplicavel. |
| `Data quality` | Avaliacao honesta da qualidade/atualidade dos dados de derivativos usados acima neste mesmo bloco. |

### EVIDENCE

Este bloco existe para que todo relatorio seja auditavel — nenhuma
afirmacao acima deveria existir sem rastreabilidade de onde veio.

| Sub-campo | O que descreve |
|---|---|
| `price/futures data source` | De onde vieram os dados de preco e de derivativos usados na analise (nome da fonte/API, nao um numero generico "dados de mercado"). |
| `timestamp` | Quando os dados usados foram obtidos/atualizados — relatorio sem timestamp nao e auditavel. |
| `data quality` | Avaliacao geral da qualidade dos dados de todo o relatorio (nao so de derivativos — complementa `Data quality` do bloco `FUTURES/DERIVATIVES DATA`, que e especifico daquele bloco). |
| `missing fields` | Lista explicita de qualquer campo do template que nao pode ser preenchido com dado real — o ponto de aplicacao direto da regra `DADOS INSUFICIENTES`. |

### LIMITATIONS

Bloco final de honestidade — limitacoes desta leitura especifica (nao as
limitacoes gerais do sistema, que estao documentadas em
`docs/STRATEGY_PLAYBOOK.md` e em `ipad_runtime/README.md`). Exemplos do
que pertence aqui: timeframe unico sem confirmacao multi-timeframe,
fonte de dados com atraso conhecido, ausencia de dados de liquidacao
para o instrumento analisado.

## Por que nenhum destes campos pode ser inventado

Repetindo a regra do topo deste documento de forma aplicada a cada
bloco: se a fonte de dados nao tiver `Funding`, o campo `Funding` no
bloco `FUTURES/DERIVATIVES DATA` deve dizer `DADOS INSUFICIENTES`, e o
campo `missing fields` em `EVIDENCE` deve listar `funding`
explicitamente. O mesmo vale para qualquer preco, nivel de liquidacao,
valor de open interest, volume ou noticia que nao venha de uma fonte
real e atual. Um relatorio com varios campos `DADOS INSUFICIENTES` e
honesto e aceitavel; um relatorio sem nenhum campo faltando mas com
numeros inventados e uma falha grave deste contrato, mesmo que "pareca
mais completo".

## Relacao honesta com o AnalysisFrame real

| | `AnalysisFrame` (real, hoje) | Este contrato (FUTURE) |
|---|---|---|
| Onde vive | `ipad_runtime/js/replay-engine.js`, renderizado em `analysis-frame-panel` (`ipad_runtime/index.html`) | Nenhum lugar ainda — design apenas |
| Conteudo | candles, SMA, EMA, desvio padrao, z-score | ASSET/INSTRUMENT TYPE/TIMEFRAME/MARKET STATE, ROTA A/B/C, KEY LEVELS, FUTURES/DERIVATIVES DATA, EVIDENCE, LIMITATIONS |
| Quem calcula | `workers/quant-worker.js` + `wasm/cyborg_quant_core.wasm` (Rust real, ver `ipad_runtime/README.md`) | Nenhum motor implementado — roadmap para um research engine futuro avaliando `docs/STRATEGY_PLAYBOOK.md` |
| Quem narra | Nada narra hoje — os numeros aparecem crus no card | Roadmap: uma camada Meta Llama/WebLLM (ver `docs/META_LLAMA_WEBLLM_ROUTE.md`), status FUTURE, narrando o conteudo deste contrato em PT-BR |
| Garantia de seguranca | Estatistica descritiva pura, "nao e recomendacao" (texto ja presente em `index.html`) | Mesma garantia, herdada: mesmo quando implementado, este contrato produz apenas leitura/raciocinio, nunca ordem — ver `decision-frame-panel` (`STUB CONTROLLED`) como o limite que continua valendo |

Em outras palavras: o `AnalysisFrame` de hoje e um subconjunto honesto e
muito mais simples do que este contrato descreve. Quando (e se) uma
camada de narrativa (Meta Llama/WebLLM) ou um research engine for
implementado, o `AnalysisFrame` real provavelmente continua sendo uma das
fontes de `EVIDENCE` (estatistica descritiva real) usadas para popular
campos como `Volatility` em `KEY LEVELS` — mas o contrato completo
(ROTA A/B/C, niveis-chave, derivativos) nao existe em codigo nesta
versao. Nenhum texto deste documento deve ser lido como "isto ja
funciona hoje".

## Relacao com docs/STRATEGY_PLAYBOOK.md

Este contrato e o formato de saida; o playbook e a fonte dos criterios
que preenchem ROTA A/B/C. Uma implementacao futura tipicamente:

1. Avalia uma ou mais estrategias do playbook contra o estado atual do
   mercado.
2. Usa `long_criteria`/`short_criteria`/`wait_criteria` de cada estrategia
   aplicavel para decidir o que entra em ROTA A, ROTA B e ROTA C.
3. Usa a tag heuristica LOW/MEDIUM/HIGH de `confidence_inputs` do
   playbook como insumo qualitativo para `Required confirmation`/`Risk
   note` — nunca como um numero de probabilidade citado neste contrato.
4. Preenche `KEY LEVELS` e `FUTURES/DERIVATIVES DATA` com os mesmos tipos
   de dado que `required_data` de cada estrategia do playbook exige.

Nenhum numero de confianca estatistica (ex.: "73% de probabilidade")
pertence a este contrato, pela mesma regra vinculante documentada em
`docs/STRATEGY_PLAYBOOK.md`: confianca e heuristica, nunca probabilidade
estatistica, na ausencia de um backtest validado — que nao existe neste
repositorio.
