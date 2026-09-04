# Multi-Asset Research Library — fundação de motores de pesquisa (FUTURE)

*Escopo: `ipad_runtime/src/research/engines/` (sub-produto PWA `AR10 Cyborg
2.0`). Não afeta o organismo Python `AR10 ORION` na raiz do monorepo
(`src/`, `config/`, `data/`) — são produtos não relacionados dentro do
mesmo repositório.*

> **Nota de atualização (2026-09-02, auditoria de conteúdo — pendência #8
> da PR #16).** Este documento descreve o estado de `research/engines/`
> em **2026-06-20** (mesmo commit que criou os 13 stubs abaixo,
> `528203d`). Esse estado **não existe mais** — confirmado lendo o
> diretório real e o `git log` de cada um dos 13 nomes, não supondo:
>
> - **5 dias depois** (`db85c77`, 2026-06-25, "Wire real S/R/market-
>   structure engines... ruthlessly prune Engine Room"): `market-
>   structure-engine.js` e `support-resistance-engine.js` foram
>   REESCRITOS — o nome do arquivo sobreviveu, o conteúdo não. Os dois
>   hoje são motores reais e graduados (`QUARANTINE.md`), sem nenhuma
>   relação com o stub `{ status: 'FUTURE' }` que este documento descreve
>   para eles — não confundir "2 dos 13 chegaram a ser implementados como
>   planejado aqui" com o que realmente aconteceu (substituição, não
>   preenchimento do contrato original).
> - **5 dias depois disso** (`165676a`, 2026-06-30, "chore(purge+org):
>   delete all dead stubs..."): os outros **11** arquivos desta tabela —
>   `liquidity-engine.js`, `volume-profile-engine.js`, `futures-flow-
>   engine.js`, `funding-oi-engine.js`, `volatility-regime-engine.js`,
>   `retracement-engine.js`, `trend-engine.js`, `momentum-engine.js`,
>   `risk-engine.js`, `signal-fusion-engine.js`, `scenario-builder.js` —
>   e o `index.js` agregador foram **deliberadamente apagados**, ainda
>   `FUTURE`, nunca implementados como este documento planejava. Decisão
>   real de uma sessão anterior (mensagem do commit é explícita: "delete
>   all dead stubs"), não um bug — mas este documento nunca foi
>   atualizado para refletir essa decisão, e ficou descrevendo um
>   diretório que deixou de existir há mais de 2 meses.
>
> `research/engines/` hoje tem **17 motores reais**, nenhum deles parte
> desta tabela de 13: `fractal-swings.js` (swing high/low compartilhado —
> ver `CLAUDE.md`), `market-structure-engine.js`,
> `support-resistance-engine.js`, `bos-choch-engine.js`,
> `fvg-order-block-engine.js`, `institutional-blocks.js`,
> `liquidity-void-engine.js`, `candlestick-patterns.js`,
> `lorentzian-classifier.js`, `zigzag-engine.js`, `supertrend-engine.js`,
> `pivot-points-engine.js`, `ichimoku-engine.js`,
> `delta-divergence-engine.js`, `andrews-pitchfork-engine.js`,
> `hmm-regime-model.js`, `price-clustering.js` — todos crescidos
> organicamente pelo ciclo real do Laboratório de Evolução (auditar → nomear →
> isolar em `research/engines/` com suíte de execução real → graduar via
> `engine-bridge.ts`), nunca pelo scaffold de 13 arquivos que este
> documento planejou. `QUARANTINE.md` é a fonte de verdade sobre o que
> existe agora — nunca a tabela abaixo.
>
> O que continua real e válido neste documento, preservado como registro
> histórico (nunca apagado — Regra de Ouro 4): a garantia de design
> "saída sempre descritiva, nunca prescritiva" e a fronteira
> `READ_ONLY`/`FAIL_CLOSED` — esses princípios seguem valendo para TODO
> motor real de `research/engines/` hoje, mesmo que nenhum tenha nascido
> pelo caminho de scaffold que este documento descreve.

## Propósito

Este documento descreve a **fundação arquitetural** de uma biblioteca de
motores de pesquisa de mercado multi-ativo para o runtime iPad. É trabalho
de **planejamento/scaffolding apenas** — define o formato (metadados +
função stub) que cada motor terá quando for implementado de fato, sem
implementar nenhum cálculo real ainda.

Todo motor desta biblioteca produz (ou produzirá, quando implementado)
**estatística descritiva sobre dados de mercado** — leitura de contexto,
rótulo de estado, faixa de preço observada — nunca uma ação de
negociação. Isso é uma extensão direta do mesmo princípio que já governa
o `analysis-frame-panel` do painel principal (estatística descritiva
real, "não é recomendação") e o `decision-frame-panel`, que é
`STUB CONTROLLED` por design (ver `ipad_runtime/README.md`).

## Por que isso existe agora, sem estar ligado ao app

O runtime iPad (`ipad_runtime/index.html` + `js/app.js`) já está em
produção como PWA `READ_ONLY`/`FAIL_CLOSED`. Adicionar lógica de pesquisa
de mercado diretamente nesses arquivos, incrementalmente e sem um
contrato de formato definido antes, é o tipo de mudança que tende a
quebrar o que já funciona. Esta biblioteca existe para que o formato de
cada motor (metadados, dados de entrada exigidos, status) seja acordado
**antes** de qualquer linha de cálculo real ser escrita — trabalho de
"plano apenas" (estilo Fase N do roadmap do projeto), consistente com a
regra central de nunca quebrar o PWA já publicado.

Por isso, nenhum arquivo existente foi modificado para criar esta
biblioteca: apenas arquivos novos foram adicionados em
`ipad_runtime/src/research/engines/`, fora da árvore de import de
`index.html`/`js/app.js`.

## Estado atual: nada está ligado ao app ao vivo

- Nenhum arquivo em `ipad_runtime/src/research/engines/` é importado por
  `ipad_runtime/index.html`.
- Nenhum arquivo em `ipad_runtime/src/research/engines/` é importado por
  `ipad_runtime/js/app.js` ou por qualquer outro módulo em
  `ipad_runtime/js/`.
- `ipad_runtime/src/research/engines/index.js` apenas agrega os 13
  módulos num único objeto `engines` para uso futuro — não é referenciado
  por nenhum ponto de entrada do PWA.
- Todo motor expõe uma função stub (`analyze()` ou `build()`) que retorna
  exclusivamente `{ status: 'FUTURE', engine: '<nome-do-motor>' }`. Nenhum
  motor calcula, inventa ou retorna número de preço, indicador ou sinal
  nesta entrega.
- Rodar qualquer motor desta biblioteca hoje não tem efeito observável no
  PWA — eles não são alcançáveis a partir da UI.

## Tabela dos 13 motores

| Motor (arquivo) | Conceitos financeiros usados (futuramente) | `required_data` | Status |
|---|---|---|---|
| `market-structure-engine.js` | Market Structure, Swing High/Low, Pivots, EMA | `ohlcv_series`, `timeframe` | `FUTURE` |
| `support-resistance-engine.js` | Pivots, Swing High/Low, Fibonacci retracement/extension, Volume Profile | `ohlcv_series`, `timeframe`, `volume_profile` | `FUTURE` |
| `liquidity-engine.js` | Liquidity sweep, Liquidation clusters, Swing High/Low, HVN, LVN | `ohlcv_series`, `liquidation_data`, `volume_profile` | `FUTURE` |
| `volume-profile-engine.js` | Volume Profile, HVN, LVN, VWAP | `ohlcv_series`, `volume_series`, `timeframe` | `FUTURE` |
| `futures-flow-engine.js` | CVD, OI expansion/contraction, Volume Profile | `futures_trades`, `open_interest_series`, `volume_series` | `FUTURE` |
| `funding-oi-engine.js` | Funding extremes, OI expansion/contraction | `funding_rate_series`, `open_interest_series` | `FUTURE` |
| `volatility-regime-engine.js` | ATR, Bollinger Bands, Volatility compression/expansion | `ohlcv_series`, `timeframe` | `FUTURE` |
| `retracement-engine.js` | Fibonacci retracement/extension, Swing High/Low, Market Structure | `ohlcv_series`, `timeframe` | `FUTURE` |
| `trend-engine.js` | EMA, SMA, Market Structure, Pivots | `ohlcv_series`, `timeframe` | `FUTURE` |
| `momentum-engine.js` | RSI, MACD, EMA | `ohlcv_series`, `timeframe` | `FUTURE` |
| `risk-engine.js` | ATR, Volatility compression/expansion, Liquidation clusters | `ohlcv_series`, `liquidation_data`, `timeframe` | `FUTURE` |
| `signal-fusion-engine.js` | Market Structure, EMA, RSI, MACD, ATR, Volume Profile | `engine_outputs` | `FUTURE` |
| `scenario-builder.js` | Market Structure, Swing High/Low, Fibonacci retracement/extension, Liquidity sweep, Volume Profile | `ohlcv_series`, `volume_profile`, `liquidation_data` | `FUTURE` |

Todos os 13 motores estão hoje em `status: 'FUTURE'`. Nenhum tem lógica
de cálculo real implementada — cada um exporta apenas `metadata` (com
`engine`, `description`, `concepts`, `required_data`, `status`) e uma
função stub que retorna `{ status: 'FUTURE', engine: '<nome>' }`.

## Garantia de design: saída sempre descritiva, nunca prescritiva

Nenhum motor desta biblioteca — hoje ou em qualquer implementação futura
planejada — produzirá uma ordem, um sinal de execução ou um comando de
abertura/fechamento de posição. A saída de cada motor, quando
implementado, será sempre uma leitura descritiva do estado observado nos
dados, por exemplo:

- `"tendência: alta"` (de `trend-engine.js`), não "comprar agora".
- `"zona de liquidez: $X-$Y"` (de `liquidity-engine.js`), não "enviar
  ordem de compra em $X".
- `"regime de volatilidade: compressão"` (de
  `volatility-regime-engine.js`), não "aumentar tamanho de posição".

Isso espelha a mesma fronteira que já existe no painel principal do
runtime: o `decision-frame-panel` é `STUB CONTROLLED` por design,
existindo apenas para deixar explícita a fronteira até onde o runtime
vai — sem lógica de decisão, sem sinal de ordem. Esta biblioteca de
motores de pesquisa adota a fronteira simétrica do lado da análise:
estatística e rótulo descritivo, nunca prescrição de negociação.

Consequências diretas desta garantia, válidas para qualquer
implementação futura de qualquer motor aqui listado:

- Nenhum motor terá uma função `execute()`, `placeOrder()`,
  `sendOrder()` ou equivalente.
- Nenhum motor fará chamada de rede ou usará credencial/API secret —
  estes motores consomem dados já carregados localmente (replay
  sintético, pacote local, ou dataset futuro fornecido como input), igual
  ao restante do runtime (`READ_ONLY`/`FAIL_CLOSED`, sem CDN para núcleo
  sensível, CSP restritiva — ver `ipad_runtime/README.md`).
- Nenhum número exibido por um motor será inventado: enquanto o `status`
  for `FUTURE`, a única saída possível é o placeholder
  `{ status: 'FUTURE', engine: '<nome>' }` — sem número de preço,
  indicador ou probabilidade fabricado.

## Onde isso se encaixa no roadmap mais amplo

Esta biblioteca de motores (`engines/`) é a camada de **pesquisa
descritiva**. Um documento separado, `docs/STRATEGY_PLAYBOOK.md`,
descreve como uma camada de **estratégias** consumirá as saídas
descritivas destes motores — por exemplo, combinando a leitura de
`trend-engine.js` com a de `volatility-regime-engine.js` para compor um
cenário de contexto. Mesmo nesse documento, o contrato desta biblioteca
não muda: motores em `engines/` continuam produzindo apenas descrição,
nunca execução. A camada de estratégias (e qualquer camada de
pontuação/risco associada) é responsabilidade de um trabalho separado e
não é definida aqui.

## Estrutura de arquivos desta entrega

```
ipad_runtime/src/research/engines/
├── market-structure-engine.js
├── support-resistance-engine.js
├── liquidity-engine.js
├── volume-profile-engine.js
├── futures-flow-engine.js
├── funding-oi-engine.js
├── volatility-regime-engine.js
├── retracement-engine.js
├── trend-engine.js
├── momentum-engine.js
├── risk-engine.js
├── signal-fusion-engine.js
├── scenario-builder.js
└── index.js              registro único: agrega os 13 motores acima
```

Nenhum destes arquivos é referenciado por `ipad_runtime/index.html`,
`ipad_runtime/js/app.js`, ou qualquer outro arquivo já existente no
runtime. São módulos ES simples (sem framework, sem build step), no
mesmo estilo de `ipad_runtime/js/replay-engine.js` e
`ipad_runtime/js/diagnostics.js`, prontos para serem importados quando
(e se) uma implementação real for priorizada — mas inertes até então.
