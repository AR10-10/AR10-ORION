# Fusion Research Quarantine

Codinome interno: `AR10_CYBORG_FUSION_RESEARCH_QUARANTINE_V1`.

**Status desta árvore: 14 engines graduados + 2 utilitários compartilhados
abaixo são ACTIVE_READ_ONLY. Todo o restante foi excluído em 2026-06-30
(purge de código morto).**

**Atualização (graduação de `andrews-pitchfork-engine.js`, 2026-09-01): 14º
engine — a última ferramenta de gráfico com nome próprio ausente que não
estava bloqueada por dado nem por decisão. Contagem conferida contra a árvore
no mesmo commit, como sempre.**

**Atualização (graduação de `delta-divergence-engine.js`, 2026-09-01): 13º
engine. Não é uma descoberta nova — é a decisão em aberto que a própria
revisão de 2026-08-31 registrou na seção dele ("o bloqueio não existe mais...
fica registrado como decisão em aberto do Operador, não como bloqueio
técnico"). O Operador pediu evolução em carta branca; esta é a decisão.**

**Atualização (graduação de `ichimoku-engine.js`, 2026-09-01, mesma auditoria
do ecossistema de indicadores): 12º engine — a segunda e última ferramenta
clássica realmente ausente do ecossistema, ver a seção própria abaixo. A
contagem desta linha foi conferida contra a árvore NO MESMO commit; é
literalmente o gap que as 5 correções abaixo registram como recorrente, e a
única forma de não empilhar um 6º caso é conferir toda vez.**

**Atualização (graduação de `pivot-points-engine.js`, 2026-09-01, auditoria
do ecossistema de indicadores pedida diretamente pelo Operador): 11º
engine. Achado ao editar este resumo — ele já dizia "8 engines" desde
2026-08-18, mas a árvore abaixo já listava 10 ACTIVE_READ_ONLY (mais
`institutional-blocks.js` e `supertrend-engine.js`, graduados 2026-08-23,
sem esta linha ser atualizada) e 2 utilitários (`price-clustering.js`
somado desde 2026-08-24). Mesmo gap de documentação recorrente que as
correções abaixo já descrevem — corrigido no mesmo commit da nova
graduação, para não empilhar um 10º caso.**

**Atualização (graduação de `candlestick-patterns.js`, 2026-08-18):
8º engine. Contagem conferida contra a tabela abaixo NO MESMO commit —
justamente o gap de documentação que as duas correções seguintes
registram como recorrente.**

**Correção (achado de auditoria durante a graduação do ZigZag, Entrega 47,
2026-08-10): este resumo dizia "5 engines" desde a correção de 2026-07-27
abaixo, mas `liquidity-void-engine.js` graduou em 2026-08-04 (6º engine)
sem essa contagem ser atualizada — mesmo gap de documentação já descrito
na correção anterior, não um problema de código. `zigzag-engine.js`
graduado nesta entrega é o 7º.**

**Correção (EPC OMEGA FINAL, Etapa 1, 2026-07-27): este resumo dizia "4
engines" desde antes de `bos-choch-engine.js` graduar (2026-07-12) e nunca
foi atualizado — gap de documentação puro, a tabela abaixo sempre esteve
correta com 5 entradas ACTIVE_READ_ONLY.**

**Correção (Auditoria Mestra 360°, secao 4 / remediação item 2, 2026-07-03):
`fvg-order-block-engine.js` e `lorentzian-classifier.js` já estavam
graduados e importados por `ramber-ui/src/engine-bridge.ts` desde
2026-07-01 (`metadata.status: 'ACTIVE_READ_ONLY'` em ambos), mas nunca
haviam sido acrescentados a este documento — este é um puro gap de
documentação, não um problema de código: nenhum dos dois faz `fetch()`
novo, usa credencial ou chama `order_send`.**

## Estado atual do diretório

```
src/research/
├── QUARANTINE.md                   ← este arquivo
└── engines/
    ├── support-resistance-engine.js   ACTIVE_READ_ONLY (graduado 2026-06-25)
    ├── market-structure-engine.js     ACTIVE_READ_ONLY (graduado 2026-06-25)
    ├── fvg-order-block-engine.js      ACTIVE_READ_ONLY (graduado 2026-07-01)
    ├── lorentzian-classifier.js       ACTIVE_READ_ONLY (graduado 2026-07-01)
    ├── bos-choch-engine.js            ACTIVE_READ_ONLY (graduado 2026-07-12)
    ├── liquidity-void-engine.js       ACTIVE_READ_ONLY (graduado 2026-08-04)
    ├── zigzag-engine.js               ACTIVE_READ_ONLY (graduado 2026-08-10)
    ├── candlestick-patterns.js        ACTIVE_READ_ONLY (graduado 2026-08-18)
    ├── institutional-blocks.js        ACTIVE_READ_ONLY (graduado 2026-08-23 —
    │                                   ver secao própria abaixo)
    ├── supertrend-engine.js           ACTIVE_READ_ONLY (graduado 2026-08-23 —
    │                                   ver secao própria abaixo)
    ├── pivot-points-engine.js         ACTIVE_READ_ONLY (graduado 2026-09-01 —
    │                                   ver secao própria abaixo)
    ├── ichimoku-engine.js             ACTIVE_READ_ONLY (graduado 2026-09-01 —
    │                                   ver secao própria abaixo)
    ├── delta-divergence-engine.js     ACTIVE_READ_ONLY (graduado 2026-09-01 —
    │                                   ver secao própria abaixo)
    ├── fractal-swings.js              utilitário compartilhado (extraído 2026-07-03,
    │                                   não é um engine — ver secao "Utilitários" abaixo)
    ├── price-clustering.js            utilitário compartilhado (extraído 2026-08-24,
    │                                   não é um engine — mesmo papel de
    │                                   fractal-swings.js: o agrupamento por âncora
    │                                   fixa estava escrito 3 vezes)
    ├── andrews-pitchfork-engine.js    ACTIVE_READ_ONLY (graduado 2026-09-01 —
    │                                   ver secao própria abaixo)
    └── hmm-regime-model.js            LABORATÓRIO (isolado 2026-08-10, não graduado —
                                        ver secao "Laboratório de engines" abaixo)
```

> **Esta árvore é gerada da realidade, não de memória.** Ela ficou errada uma
> vez e vale registrar como, porque é o modo de errar mais fácil deste
> arquivo: dizia `supertrend-engine.js LABORATÓRIO (não graduado)` enquanto a
> seção própria dele, no mesmo arquivo, dizia `GRADUADO (2026-08-23)` — e o
> `engine-bridge.ts` já o importava, com camada própria no gráfico. Listava 11
> motores quando existiam 14. Quem lesse só o resumo concluiria que o
> SuperTrend não estava ligado.
>
> Conferência de 10 segundos, quando mexer em `engines/`:
> `ls engines/*.js` tem de bater com esta lista, e cada `GRADUADO` daqui tem
> de ter um `import` real em `ramber-ui/src/engine-bridge.ts`.

**Removidos em 2026-06-30 (purge):**
- `connectors/` — diretório inteiro (13 stubs binance, coingecko, coinglass, custom,
  google-finance, mexc, mexc-realstocks, mexc-stock-futures, mt5, native-companion,
  registry, tradingview, yahoo-finance). Nenhum tinha import real; todos declaravam
  `current_status: 'FUTURE'` e nunca foram importados por `js/**`.
- `engines/momentum-engine.js`, `volatility-regime-engine.js`, `funding-oi-engine.js`,
  `futures-flow-engine.js`, `liquidity-engine.js`, `retracement-engine.js`,
  `trend-engine.js`, `risk-engine.js`, `volume-profile-engine.js`,
  `scenario-builder.js`, `signal-fusion-engine.js`, `index.js` — 12 stubs inativos,
  todos `status: 'FUTURE'`, zero import real.

## Engines graduados (ACTIVE_READ_ONLY)

- **`engines/support-resistance-engine.js`** — pivots/swing high-low (método fractal)
  + extensão de Fibonacci sobre candles reais de `js/real-data/mexc-public.js`.
  Importado por `js/real-data/analysis-frame.js`. Zero `fetch()` novo, zero
  credencial, zero `order_send`. (V11.5 Fase 6, 2026-07-03) Cada nível também
  ganha uma classificação FORTE/FRACA por confluência real de swings
  (`resistance_1_strength`/`resistance_2_strength`/`support_1_strength`/
  `support_2_strength`) — contagem determinística, nunca uma probabilidade
  estatística (sem backtest neste repositório para sustentar isso). O
  Risk:Reward real (`risk_reward_ratio`, razão de distâncias já reais) foi
  adicionado em `js/research/target-tracker.js`, não aqui.
- **`engines/market-structure-engine.js`** — detecção de HH/HL/LH/LL (swing structure)
  sobre os mesmos candles reais. Importado por `js/real-data/analysis-frame.js`.
  Zero `fetch()` novo, zero credencial, zero `order_send`.

Ambos adicionados a `PRECACHE_URLS` em `service-worker.js` na graduação (v-25 →
v-26, 2026-06-25). Ambos são funções puras de cálculo, sem estado global, sem
import reverso de volta para `js/**`.

- **`engines/fvg-order-block-engine.js`** (graduado 2026-07-01) — Fair Value
  Gaps, Order Blocks e zonas de liquidez (Equal Highs/Equal Lows) — Smart
  Money Concepts — detectados por padrão geométrico determinístico sobre os
  mesmos candles reais do gráfico. Importado por
  `ramber-ui/src/engine-bridge.ts`. Zero `fetch()` novo, zero credencial,
  zero `order_send`. Sem candles suficientes, retorna `DADOS_INSUFICIENTES`
  — nunca inventa uma zona.
- **`engines/lorentzian-classifier.js`** (graduado 2026-07-01) — classificador
  k-NN Lorentziano, um sinal de confluência INDEPENDENTE do Core Engine
  (nunca gate/sobrescreve o LONG/SHORT/WAIT primário). Importado por
  `ramber-ui/src/engine-bridge.ts`. Reporta sempre `sampleSize` junto da
  classificação — amostra pequena nunca vira confiança inflada.
- **`engines/bos-choch-engine.js`** (graduado 2026-07-12, Ordem "Ciborgue
  Vivo") — Break of Structure / Change of Character: reaproveita
  `fractal-swings.js` e o `structure_label` de `market-structure-engine.js`
  (zero segunda detecção de swing/estrutura), só adiciona a varredura real
  de rompimento por fechamento além do último swing confirmado. Importado
  por `ramber-ui/src/engine-bridge.ts`. Display only (LEI 24) — alimenta
  anotações temporárias no gráfico e o alerta de estrutura, nunca uma
  segunda decisão de trading. Zero `fetch()` novo, zero credencial, zero
  `order_send`.
- **`engines/liquidity-void-engine.js`** (graduado 2026-08-04, pedido do
  Operador "ver o que está faltando... pra ele chegar na perfeição" —
  pesquisa real via WebSearch confirmou que Liquidity Void é um conceito
  SMC/ICT real e DISTINTO de Fair Value Gap: um deslocamento de MÚLTIPLOS
  candles com participação de volume anormalmente baixa para o alcance
  percorrido, não uma reimplementação de FVG sob outro nome) — detecta
  zonas reais via Volume Efficiency Ratio = (volume/avgVolume) /
  (range/ATR), mesma fórmula real usada por indicadores de mercado
  publicados (não uma variante inventada). Reaproveita `computeAtrPercent`
  de `lorentzian-classifier.js` (zero segunda curva de ATR) e o volume
  real já carregado por candle (`ChartCandle.volume`, Market Data Bus).
  Importado por `ramber-ui/src/engine-bridge.ts`. Display only (LEI 24) —
  camada de confluência/contexto no gráfico, nunca uma segunda decisão de
  trading. Sem candles suficientes (aquecimento do ATR) ou sem volume real
  na janela avaliada, retorna lista vazia/`DADOS_INSUFICIENTES` — nunca
  aproxima volume a partir de outro dado. Zero `fetch()` novo, zero
  credencial, zero `order_send`.
- **`engines/zigzag-engine.js`** (graduado 2026-08-10, Entrega 47 — pedido
  direto do Operador para "habilitar tudo que tem de habilitar no sistema
  ... coisas que esteja no teste novos laboratório") —
  `computeZigZag(candles, deviationPct, depth)`, indicador ZigZag clássico
  por limiar percentual de reversão + profundidade mínima de barras entre
  pivô candidato e barra de confirmação (2 parâmetros reais do indicador
  nomeado, confirmados via pesquisa real — StockCharts ChartSchool,
  Corporate Finance Institute, Capital.com — antes de implementar,
  Disciplina de trabalho item 2 do CLAUDE.md). Deliberadamente DISTINTO de
  `fractal-swings.js` (K=2 candles fixos de confirmação, sem percentual/
  profundidade configurável) — os dois respondem perguntas diferentes.
  Só pivôs CONFIRMADOS entram na saída — a perna em formação nunca aparece
  (fail-closed, Regra de Ouro 3). Achado real do próprio processo de teste
  original (19 testes de execução real em
  `ramber-ui/tests/zigzag-engine.test.ts`): a 1ª versão escrita
  compartilhava um único índice entre o candidato de alta e o de baixa
  enquanto a direção ainda estava indeterminada, contaminando o gate de
  `depth` — corrigido separando `extHighIdx`/`extLowIdx` antes de qualquer
  commit; os 5 testes que expuseram o bug continuam na suíte como
  regressão permanente. Importado por `ramber-ui/src/engine-bridge.ts`
  (wrapper `computeZigZag`) e ligado ao gráfico real via
  `CHART_LAYER_IDS`/`ZigZagPlugin.tsx` (linha poligonal 1px conectando os
  pivôs, cor azul-neutro de estrutura) e `nexus/layer-relevance.ts`
  (`hasZigZagPivots`, >=2 pivôs reais). Display only (LEI 24) — estrutura/
  contexto no gráfico, nunca uma segunda decisão de trading. Zero
  `fetch()`, zero `WebSocket`, zero `Math.random`/`Date.now`.

- **`engines/candlestick-patterns.js`** (graduado 2026-08-18, pedido direto
  do Operador: "no gráfico tem que refletir os padrão das vela também —
  quando dá tipo tantas velas fazem um padrão, ele tem de analisar tudo
  isso aí... existe um tal de padrão de vela que muda o sentido do mercado,
  não sei como se fala isso, mas o sistema tem que ser inteligente pra
  saber isso").
  **Auditoria antes de construir (CLAUDE.md item 1):** `grep -rlin
  "engolf|marubozu|doji|hammer|harami|shooting.star|inside.bar"` em `src/`,
  `ramber-ui/src/` e `js/` não retornou NADA — gap genuíno. O sistema lia
  ESTRUTURA (swings, HH/HL, BOS/CHOCH), ZONAS (FVG/OB/void), REGIME
  (ADX/ATR) e FLUXO (CVD/absorção), mas nunca a FORMA DA VELA em si.
  Motores vizinhos conferidos e deliberadamente NÃO reaproveitados:
  `bos-choch-engine.js` mede rompimento de NÍVEL, `zigzag-engine.js` mede
  PERNAS de preço — nenhum olha a relação corpo/sombra dentro de uma vela.
  **Pesquisa real das definições (CLAUDE.md item 2):** confirmadas via
  WebSearch ANTES de escrever código (Nison como referência clássica;
  conferidas contra ProRealTime, Babypips, Zerodha Varsity, StockCharts).
  Achados que mudaram o código: (a) ENGOLFO é regra de CORPO, nunca de
  pavio; (b) DOJI = corpo <= 10% do range; (c) PIERCING/DARK CLOUD exigem
  penetração ALÉM de 50% do corpo anterior; (d) MARTELO = sombra inferior
  >= 2x o corpo com sombra superior curta.
  **O achado que definiu o desenho do motor:** Martelo e ENFORCADO (hanging
  man) são a MESMA forma geométrica — o que os separa é a TENDÊNCIA
  ANTERIOR. Idem estrela cadente vs martelo invertido. Um detector que
  olhasse só a forma emitiria o lado EXATAMENTE INVERTIDO em metade dos
  casos (a mesma classe de defeito que `direction-semantics.ts` existe para
  impedir). Por isso todo padrão de REVERSÃO exige contexto real de
  tendência, vindo de `market-structure-engine.js` já graduado — zero
  segunda leitura de tendência, mesmo precedente exato que
  `bos-choch-engine.js` usa para separar BOS de CHOCH. Sem estrutura
  confirmada, nenhuma reversão é emitida (padrões de continuação/indecisão
  continuam, porque não dependem de tendência anterior).
  **Zero segunda matemática:** reusa `computeAtrPercent` (Wilder,
  `lorentzian-classifier.js`) para medir "corpo grande" em unidades de ATR
  — 200 dólares é enorme num ativo calmo e ruído num agitado.
  **Regra de Ouro 2:** NUNCA reporta probabilidade de acerto. A literatura
  publica taxas (~60-65% para alguns padrões), mas medidas em outros
  mercados/períodos/regras de saída — copiá-las para cá seria inventar uma
  calibração que este repositório não tem. Reporta `bodyAtr` (medição) e
  `confirmed` (a vela seguinte fechou a favor, sim/não/ainda-não).
  **Achado do próprio processo de teste (mesma classe do bug do ZigZag e do
  SuperTrend):** teste de mutação deliberado revelou que a 1ª versão do
  caso "não engolfa quando só o pavio cobre" passava PELO MOTIVO ERRADO —
  era recusada pelo guard de tamanho de corpo, não pela regra corpo-vs-
  pavio; trocar o motor para medir high/low mantinha os 34 testes verdes.
  Fixture endurecida e re-verificada por mutação. Duas fixtures de
  tendência anteriores também eram degeneradas (série monotônica = zero
  swings; senoide amostrada em inteiros = empates exatos de máxima, que a
  regra estrita de `fractal-swings.js` recusa) — só pivôs explícitos com
  pico/vale cravado geram a estrutura real. As 3 mutações-chave hoje são
  pegas: inversão martelo/enforcado (2 testes), engolfo por pavio (1) e
  remoção do gate de tendência (3).
  34 testes de execução real em
  `ramber-ui/tests/candlestick-patterns.test.ts`.
  Importado por `ramber-ui/src/engine-bridge.ts` (wrapper
  `computeCandlePatterns`) e consumido pelo Publication Studio (chip do
  padrão real nas 4 peças publicáveis). Display only (LEI 24) —
  confluência/contexto, nunca uma segunda decisão de trading. Zero
  `fetch()`, zero `WebSocket`, zero `Math.random`/`Date.now`.

Nota sobre `PRECACHE_URLS`: em 2026-07-03 (Auditoria Mestra 360°, secao 2) o
`service-worker.js` atual foi confirmado como um shim de autodestruição (zero
`PRECACHE_URLS`, `activate` limpa todos os caches e força
`unregister()`) — a app React de produção não depende de cache-first
precache algum hoje. A regra de quarentena abaixo permanece escrita para
`js/**` (a árvore vanilla, que ainda usa esse mecanismo); os dois engines
acima foram importados por `ramber-ui/src/engine-bridge.ts` (TypeScript/React),
não por `js/**`, e por isso não se aplicam ao passo 2 da regra abaixo.

## Utilitários compartilhados (não são engines, não têm `metadata.status`)

- **`engines/fractal-swings.js`** (extraído 2026-07-03, remediação item 5 da
  Auditoria Mestra 360°) — `FRACTAL_K`/`findSwings()`, o algoritmo de detecção
  de swing high/low por confirmação fractal (K=2 candles de cada lado) que
  antes estava triplicado, quase idêntico, em `support-resistance-engine.js`,
  `market-structure-engine.js` e `fvg-order-block-engine.js` — cada um com sua
  própria constante `FRACTAL_K` redeclarada. Sem lógica própria de sinal, só a
  primitiva geométrica compartilhada; os três engines acima o importam.

## Laboratório de engines (isolado, não graduado)

> **Achado auditando esta seção ("vê o que tá faltando", 2026-09-02): o
> bullet abaixo continuava aqui com `Status: LABORATÓRIO`, mas
> `supertrend-engine.js` GRADUOU em 2026-08-23 — tem seção própria `##
> supertrend-engine.js — GRADUADO` mais abaixo, e `engine-bridge.ts` já o
> importa de verdade. Mesma classe "declaração ≠ realidade" que a nota de
> 10 segundos no topo deste arquivo já corrigiu para a árvore de diretório
> — só que aquela correção nunca foi reconferida contra esta seção
> separada. Conteúdo abaixo preservado tal qual (Regra de Ouro 4 — nunca
> apagar): é o registro real da pesquisa/auditoria/mutação do isolamento
> original; só o rótulo de status ao final estava desatualizado —
> corrigido lá.**

- **`engines/supertrend-engine.js`** (2026-08-11, pedido do Operador
  "adicione todos os requisitos que foi pesquisado ... evoluir o
  ecossistema"). `computeSuperTrend(candles, period, multiplier)` —
  SuperTrend (Olivier Seban): banda ATR travada em catraca que trilha o
  preço como stop dinâmico e inverte por fechamento real além da banda
  oposta.
  **Auditoria antes de construir (CLAUDE.md item 1):** `grep -ri
  "supertrend"` em `src/` e `ramber-ui/src/` não retornou NADA — gap
  genuíno. Distinto de vários outros itens do MESMO documento de pesquisa
  que já existiam há entregas e foram rejeitados como "gap" nesta
  auditoria: CVD/Cumulative Delta (`nexus/market-analysis.ts`,
  `nexus/council.ts`), Absorption (`src/orderflow/signal-engine.js`),
  walk-forward (laboratório de backtest estrutural), Volume Profile/TPO
  (Entrega 41), Order Book L2 (Entrega 40), Liquidity Sweep
  (`trap-detection.ts`), Multi-Timeframe (`buildMultiTimeframeContext`),
  Footprint e VWAP ±σ. Motores vizinhos conferidos e deliberadamente NÃO
  reaproveitados como substitutos: `regime-engine.js` classifica REGIME
  (ADX/DI + largura de banda) e `trend-channel-engine.ts` ajusta um canal
  de REGRESSÃO (OLS ±σ) — nenhum dos dois produz um stop que trilha e
  trava, que é o que o SuperTrend é.
  **Pesquisa real da fórmula (CLAUDE.md item 2):** confirmada via
  WebSearch antes de escrever código (TradingView "Supertrend" support
  doc, LiteFinance, Strike.money, CrossTrade). O documento de pesquisa
  que motivou o motor trazia a fórmula **incompleta** — só as bandas
  básicas, sem a regra de travamento. Sem a catraca isso não é
  SuperTrend: seria um par de bandas tipo Keltner que oscila junto com o
  preço e inverte a cada respiro. A regra real ("the upper band only
  moves down or stays flat when price is above it, and the lower band
  only moves up or stays flat when price is below it") é o que
  transforma a banda num trailing stop. Flip só por FECHAMENTO além da
  banda oposta — nunca por pavio (que geraria flip fantasma em cada
  sweep de liquidez, evento que `trap-detection.ts` já trata à parte).
  **Zero segunda matemática (Regra de Ouro 4):** reusa `computeAtrPercent`
  (ATR de Wilder, `lorentzian-classifier.js`) e converte de volta a
  unidade de preço por `atr = (atrPct/100) * close` — recuperação exata,
  nunca uma segunda suavização de Wilder em paralelo; travado por teste.
  **Achado real do próprio processo de teste** (mesma classe do bug que o
  ZigZag revelou na Entrega 35): a 1ª versão dos 2 testes de catraca
  usava séries de passo constante e passava IGUAL com a catraca REMOVIDA
  do motor — porque numa subida suave a banda básica já sobe sozinha, e
  monotonicidade não distingue "travado" de "não travado". Descoberto por
  teste de mutação deliberado (remover a catraca e conferir se a suíte
  acusa). Fixtures redesenhadas com expansão de volatilidade — o momento
  em que a banda básica RECUARIA — e re-verificadas por mutação: agora a
  remoção da catraca derruba 3 testes em vez de 1. Os testes de mutação
  não ficam no repositório (são um procedimento, não um caso), mas as
  fixtures endurecidas sim.
  18 testes de execução real em `ramber-ui/tests/supertrend-engine.test.ts`.
  Zero `fetch()`, zero `WebSocket`, zero `Math.random`/`Date.now`.
  Status no momento deste registro (2026-08-11): **LABORATÓRIO**. Graduou
  em **2026-08-23** — import real por `engine-bridge.ts`, camada própria
  em `CHART_LAYER_IDS`, plugin de canvas (duas `LineSeries` nativas) — ver
  `## supertrend-engine.js — GRADUADO` mais abaixo para o registro
  completo da graduação, incluindo por que camada própria (não
  reaproveitamento) e a decisão de relevância por existência.

- **`engines/hmm-regime-model.js`** (2026-08-10, "Entrega 43" — evento de
  segurança tratado antes de construir: documento externo endereçando
  "Agente 4" novamente, desta vez acompanhado de um ZIP com código pronto
  para um `src/regime/` + `src/components/` + `src/hooks/` inteiros —
  estrutura de pastas que não existe neste projeto. Autoria confirmada
  pelo Operador via `AskUserQuestion`, mas a direção técnica escolhida foi
  "estender o regime-engine.js real, nunca duplicar": o
  `RegimeDetector`/`ATRADXClassifier`/`RegimeCache`/`RegimeBadge` do ZIP
  foram REJEITADOS, não só adiados — duplicavam `market-regime/
  regime-engine.js` já graduado, o `ATRADXClassifier.calculateADX()`
  tinha um bug real e confessado no próprio comentário (devolvia DX puro
  sem suavização de Wilder e chamava isso de "ADX"), e `RegimeBadge` era
  redundante com `ContextReadStrip` — já mostra "Regime: {label}
  {direção}" sempre visível na Linha 2 do header). Hidden Markov Model de
  3 estados (Rabiner 1989, "A Tutorial on Hidden Markov Models") —
  `forwardScaled`/`backwardScaled`/`baumWelch`/`viterbi` — sobre features
  extraídas por `extractFeatureSeries()`, que reusa `computeAdx`
  (`regime-engine.js`) e `computeAtrPercent` (`lorentzian-classifier.js`,
  já graduado) — zero segunda curva de ADX/ATR. `labelHmmStates()` rotula
  os estados anônimos descobertos pelo treino não-supervisionado por
  CONCORDÂNCIA empírica real com `classifyMarketRegime()` na mesma janela
  (nunca assume que "estado 0 é trending" a priori).
  Achado real do próprio processo (comparação com o `HMMAlgorithms.ts` do
  ZIP rejeitado antes de escrever este arquivo, mesma disciplina de
  "nunca copiar sem verificar"): o forward/backward do ZIP não é
  escalonado — para sequências de centenas de observações (o próprio
  documento pedia treino sobre até ~90 dias de candles) os valores de
  alpha somem para 0 por underflow de ponto flutuante bem antes disso, e
  o Baum-Welch resultante reportaria "convergência" falsa (log-likelihood
  grudado numa constante) sem aprender nada — nunca testado no checklist
  original (só sequências curtas). Corrigido aqui com o escalonamento
  padrão de Rabiner (§V-A: c_t = 1/Σα_t(i), log-likelihood = −Σlog(c_t)) —
  técnica clássica, não uma variante inventada; Viterbi já roda em
  espaço-log (essa parte do ZIP estava correta). 24 testes de execução
  real (`ramber-ui/tests/hmm-regime-model.test.ts`), incluindo forward e
  Viterbi hand-derivados à mão (2 estados/2 símbolos, conferidos antes de
  rodar) e uma regressão dedicada de 500 observações provando que o
  escalonamento evita o underflow real encontrado no ZIP.
  Deliberadamente NÃO construído: pipeline de treino em Web Worker,
  persistência IndexedDB, retreino semanal automático (exigiria dado real
  de mercado que este sandbox nunca teve — zero egress Binance em toda a
  sessão, mesma limitação documentada para `HistoricalSignalCollector` na
  Entrega 42); `RegimeBadge` (rejeitado, não adiado); integração com o
  Profitability Engine (expectancy filtrada por regime — ideia real e
  válida para o futuro, depende de ter tanto um HMM treinado quanto
  trades suficientes rotulados por regime, nenhum dos dois existe ainda).
  Status: **LABORATÓRIO** — nenhum módulo de produção importa daqui
  (fronteira travada por teste em
  `ramber-ui/tests/hmm-regime-model.test.ts`). Treino/inferência ao vivo,
  UI e integração com o Core Engine/ProfitabilityEngine são passos
  futuros deliberadamente separados desta entrega.

## Laboratório de backtest (nunca caminho de produção)

- **`backtest/structural-backtest.js`** (2026-07-20, fase 1 da iniciativa
  "histórico real + backtest honesto" — a única evolução nomeada como mais
  importante na conclusão da Diretriz de Evolução de Produto, autorizada
  pelo Operador). Medidor de desfechos estruturais em walk-forward: reusa o
  Motor de Replay REAL (`src/replay/`) e os engines graduados candle-only
  (`market-structure-engine` + `support-resistance-engine`) — zero
  matemática de mercado nova; a regra estrutural é de MEDIÇÃO do
  laboratório, documentada no cabeçalho. Saída = CONTAGEM de eventos da
  amostra com aviso de honestidade gravado no contrato ("NUNCA
  probabilidade futura, NUNCA o desempenho do sistema completo ao vivo").
  Status: **LABORATÓRIO** — nenhum módulo de produção importa daqui
  (fronteira travada por teste em
  `ramber-ui/tests/structural-backtest.test.ts`); só se aplica a regra de
  quarentena abaixo se um dia for graduado, o que exigirá antes a fase 2
  (captura/armazenamento de histórico REAL — sem ela, qualquer número
  daqui descreve apenas a série fornecida).
  **Atualização (Diretriz de Evolução Geral do Organismo, mesmo dia):**
  cada trial ganhou MFE/MAE (Maximum Favorable/Adverse Excursion, método
  padrão de backtest — não uma métrica proprietária), medido candle a
  candle durante toda a vida do trial e expresso em R-múltiplo
  (excursão ÷ risco do próprio trial); o agregado ganhou `avgMfeR`/
  `avgMaeR` totais e por direção. Zero mudança na regra estrutural de
  medição em si.
  **Atualização (Diretriz de Evolução Quantitativa e Aprendizado Real §2,
  "alvo máximo estrutural"):** cada trial ganhou `farTarget` — a 2ª linha
  real de S/R do mesmo `support-resistance-engine.js` (`resistance_2`/
  `support_2`, dado já calculado por esse engine mas nunca lido aqui
  antes), só quando genuinamente mais distante que o alvo primário
  (fail-closed: null quando a janela não tem 2 swings reais distintos).
  `farTargetHit`/`farTargetBarsToHit` são uma medição PARALELA e
  independente da resolução TARGET/STOP do trial — nunca reabre, nunca
  estende, nunca muda `outcome`/`barsToResolve`. Agregado ganhou
  `farTargetEligible`/`farTargetHitRate`. Zero engine nova.

- **`backtest/history-capture.js`** (2026-07-20, fase 2 da mesma
  iniciativa). Pagina candles reais para trás a partir do conector direto
  já usado pelo scroll-back do gráfico (`collectBinanceFuturesKlines`,
  `src/market-data-bus/binance-futures-candle-connector.js` — mudança
  aditiva nesse arquivo: `returnEvidence` opcional, default `false`
  preserva 100% o comportamento existente do scroll-back), acumulando
  candles + proveniência real por página (reusa o MESMO Evidence Object
  de `js/real-data/schema.js` — `fetched_at`/`raw_sample_hash`/
  `source_id` — nenhum campo novo de proveniência foi inventado). Dedup
  por tempo, detecção EXATA de gaps (via `timeframeToSeconds` de
  `quality-engine.js`, reaproveitado — não uma segunda matemática de
  passo de timeframe), fail-closed em toda falha real (para a paginação
  sem descartar o que já foi capturado com sucesso, nunca finge alcançar
  o alvo), teto de segurança `maxPages` contra laço sem fim. Provado só
  com `fetchPage` injetado (fixture determinística) e, para
  `fetchRealPage`, mock na MESMA fronteira de rede que o resto do Real
  Data Layer já usa (`js/real-data/binance-futures-public.js`) — nunca
  executado contra rede real nesta sessão de implementação (sandbox sem
  egress a exchanges).
  Status: **LABORATÓRIO, sem gatilho de UI ainda** — nenhum módulo de
  produção importa daqui (fronteira travada por teste em
  `ramber-ui/tests/history-capture.test.ts`). O código de paginação está
  pronto e testado, mas duas coisas continuam pendentes antes da fase 2
  "acontecer" de fato: (1) decidir ONDE/COMO o Operador dispara a
  captura real (botão em algum painel existente, ou outro caminho —
  decisão de superfície de produto, deliberadamente não tomada nesta
  entrega para não misturar com a matemática de paginação) e (2) rodar a
  captura de verdade num ambiente com egress real às exchanges
  (produção/dispositivo do Operador — o sandbox de CI não tem). Ver
  `SYSTEM_HANDBOOK.md` §6.7.

- **`backtest/compare-runs.js`** (2026-07-20, Fase 9 "Autoevolução
  Controlada" da Diretriz de Evolução Quantitativa e Aprendizado Real;
  **GRADUADO em 2026-09-04**, ver "GRADUAÇÃO — comparação de backtests
  dentro do app" mais abaixo para o registro completo).
  `compareBacktestRuns(baseline, candidate)` — veredito estatístico
  (`MELHOROU`/`PIOROU`/`NEUTRO`/`DADOS_INSUFICIENTES`) sobre duas
  execuções reais de `runStructuralBacktest`, via two-proportion z-test
  agrupado (método padrão de inferência estatística, mesmo usado para
  comparar taxa de conversão A/B — não uma fórmula inventada). Amostra
  abaixo do mínimo declarado (`MIN_RESOLVED_PER_GROUP=20`, por grupo) ou
  variância pooled nula ⇒ sempre `DADOS_INSUFICIENTES`, nunca um veredito
  fabricado. Nunca aplica nada sozinho — devolve o veredito para leitura
  humana; a "APROVAÇÃO" da Fase 9 continua manual, sempre.

- `ramber-ui/src/nexus/reversal-detector.ts` — **Detector de Reversão**
  (`computeReversalReading`) + **instrumento de medição**
  (`measureReversalLead`). Nasceu do achado central do
  `docs/MAPA_ECOSSISTEMA_2026-08-17.md`: a decisão INTEIRA do Núcleo é
  `trendBias()` (preço vs SMA, EMA vs SMA) — um cruzamento de médias, o
  detector de reversão mais lento que existe — enquanto o CHoCH, que é a
  definição literal de reversão estrutural e dispara antes, já está
  construído e desenhado na tela sem poder influenciar nada.
  Lê a evidência REAL já calculada (`bos-choch-engine.js`,
  `supertrend-engine.js`) e responde duas coisas: "virou?" e, sobretudo,
  "quantas barras ANTES do Núcleo?".
  Distinção crítica travada por teste: **BOS não é reversão** (é
  continuação); só CHOCH conta — tratar BOS como reversão daria o sinal
  exatamente invertido no momento de tendência mais forte.
  Anti-viés travado por teste: a janela de pareamento é SIMÉTRICA, então
  `leadBars` pode ser negativo e a mediana pode honestamente dizer "a troca
  não vale a pena". A primeira versão só aceitava evidência anterior à
  virada, o que tornava o resultado favorável POR CONSTRUÇÃO.
  Regra de Ouro 2: `strength` é massa de evidência concordante, NUNCA
  probabilidade de acerto.
  `trendBias` foi EXPORTADO de `js/research/research-engine.js` (mudança
  puramente aditiva) para ser medido em vez de reimplementado — uma segunda
  cópia da decisão seria uma segunda decisão paralela.
  Status: **GRADUADO COMO AVISO** (ordem do Operador: "não deixa nada no
  laboratório, ativa tudo"). Consumido por `App.tsx` no card
  "REVERSÃO ESTRUTURAL · AVISO" do widget Validação Multi-Camada.
  Graduado como AVISO e não como decisão por um motivo honesto: o Operador
  autorizou ativar "o que estiver acima de 70/90%", e para este detector esse
  número NÃO EXISTE — a rede do ambiente bloqueia as corretoras e
  `tools/measure-reversal-lead.mjs` nunca rodou sobre mercado real. Ativar
  como decisão alegando um percentual seria inventá-lo. Como AVISO ele não
  precisa de percentual nenhum, porque não muda nada.
  **LEI 24 INTACTA e travada por teste**: `engine-bridge.ts` e
  `research-engine.js` continuam sem importar este módulo (o teste procura
  IMPORT real, não a string em comentário — distinção que ele mesmo pegou);
  `engine.direction` é só LIDO para relatar contradição, nunca escrito.

## Regra de quarentena daqui para frente

Nenhum arquivo de `src/research/**` pode ser importado por `js/**` sem,
no mesmo commit:

1. Implementar lógica real (não só trocar o status com stub por baixo) e atualizar
   `current_status` de `'FUTURE'`/`'PLANNED'` para um valor real.
2. Adicionar o(s) arquivo(s) a `PRECACHE_URLS` em `ipad_runtime/service-worker.js` —
   import novo sem precache quebra a 1ª navegação offline.
3. Se o módulo exigir rede real, adicionar o domínio à CSP `connect-src` de
   `ipad_runtime/ramber-ui/index.html` (a CSP real e versionada) como diff
   isolado e revisável — nunca em `ipad_runtime/index.html`, que é saída de
   build gerada pelo deploy e não existe no repositório.
4. Se o módulo exigir credencial, resolver via política equivalente a
   `WindowsLocalSecretPolicy`/`TelegramAuxSecretPolicy` — nunca no frontend,
   nunca no repositório, nunca no storage do PWA.

## `fvg-order-block-engine.js` — campos aditivos de toque (2026-08-23)

Motor já graduado há muitas rodadas; esta entrada registra uma **extensão
aditiva**, não uma graduação nova.

`clusterEqualLevels()` passou a exportar `firstIndex` e `touchIndices` junto
de `touches`/`index` nas zonas de liquidez (EQH/EQL). Nada foi calculado a
mais: o cluster sempre teve os swings reais em mãos — só o último índice
saía dele. Sem o primeiro índice não existe "trecho", e a camada visual só
podia desenhar uma linha de largura total (defeito relatado pelo Operador).

Suíte de execução real: `ramber-ui/tests/liquidity-pool-touches.test.ts`
(9 casos — índices reais, ordenação, coerência entre `touches` e
`touchIndices`, e o que já funcionava — `price`/`swept`/mínimo de 2 toques —
provado idêntico).

## `institutional-blocks.js` — GRADUADO (2026-08-23)

Breaker Blocks e Mitigation Blocks: Order Blocks que **falharam** (preço
fechou através deles), classificados pelo único critério que a pesquisa
confirmou distingui-los — houve varredura de liquidez **antes** da falha
(BREAKER, a polaridade **inverte**) ou não houve (MITIGATION, a polaridade
se **mantém**).

**Por que só agora.** O motor e sua suíte de execução real
(`ramber-ui/tests/institutional-blocks.test.ts`, 24 casos) existiam desde a
entrega anterior, e `grep` confirmava **zero importadores**. Um motor
correto que ninguém consome não é inteligência entregue — é código morto
com testes verdes. Fica registrado como o padrão de falha a evitar, não
como um detalhe de cronograma.

**Zero matemática nova.** Order Blocks vêm de `fvg-order-block-engine.js`,
swings de `fractal-swings.js`. Este motor apenas classifica o que já é
detectado.

**Causalidade real.** A referência de liquidez é o último swing fractal
**já confirmado** no momento do Order Block (`index + FRACTAL_K <= obIndex`)
— nunca um swing que só se tornaria visível no futuro. Sem isso o motor
"acertaria" no backtest usando informação que não existia.

**Ligação real (a regra de graduação):**
- `ramber-ui/src/engine-bridge.ts` — `computeInstitutionalBlocks()`, wrapper
  fino sobre o motor, fail-closed para `[]`.
- `ramber-ui/src/App.tsx` — memo sobre o MESMO `chartData` do gráfico
  (o `index` de cada bloco só faz sentido alinhado ao array desenhado).
- `ramber-ui/src/chart/LiquidityZonesPlugin.tsx` — dois kinds novos
  (`BREAKER`/`MITIGATION`) no canvas que FVG/OB/VOID já usam: zero canvas
  novo, zero loop de rAF novo, mesma fusão/decaimento/ênfase de obstáculo.

**LEI 24 — display only.** Contexto exibido ao Operador. Nunca emite uma
segunda decisão de trading, nunca bloqueia ou altera a decisão do Núcleo.

**Recortes declarados antes do canvas** (mesma disciplina dos Liquidity
Voids, "só as marca certeira"): apenas blocos ainda **não retestados**, e
teto de 3 por tipo — com a mesma escapatória de sempre, um bloco que é
obstáculo real no caminho entrada→alvo do plano ATIVO nunca é cortado pelo
teto. O dado completo continua no motor; isto decide só o que o canvas
pinta.

**Pendências honestas:**
- Ainda **fora** da competição cruzada de orçamento visual
  (`nexus/visual-budget.ts`), pelo mesmo motivo escopado dos Liquidity
  Voids — cai no fallback fail-closed de `ageAlpha` isolado.
- Ainda **sem** o filtro de significância por ATR
  (`nexus/liquidity-significance.ts`) que FVG/OB já usam: o teto de 3
  escolhe por ordem de chegada, não por tamanho relativo da zona.
- Sem entrada própria no gerenciador de camadas: acompanha
  `liquidity_zones`, mesma decisão já tomada para Liquidity Void (evitar
  mais um interruptor para o Operador).

**Suítes:** `institutional-blocks.test.ts` (24, execução real da
matemática) + `institutional-blocks-graduation.test.ts` (14, fiação ponta a
ponta e LEI 24).

## `supertrend-engine.js` — GRADUADO (2026-08-23)

SuperTrend (Olivier Seban): um **trailing stop** que trilha o preço e trava.
A banda de cima só desce ou fica parada enquanto o preço está acima dela; a
de baixo só sobe ou fica parada enquanto o preço está abaixo. É essa
catraca — não as bandas — que separa o SuperTrend real de um par tipo
Keltner que inverte a cada respiro do mercado. O flip só acontece por
**fechamento** além da banda final oposta, nunca por pavio.

**Por que só agora.** Segundo motor desta rodada com suíte de execução real
(18 casos) e **zero importadores**, mesmo padrão de falha registrado acima
para `institutional-blocks.js`.

**Por que camada própria e não reaproveitamento.** `regime-engine.js`
classifica REGIME (ADX/DI + largura de banda); `trend-channel-engine.ts`
ajusta um canal de REGRESSÃO (OLS ±σ). Nenhum dos dois produz um stop que
segue o preço e não volta atrás — o conceito não existia no ecossistema.

**Zero segunda matemática.** O ATR de Wilder vem de
`lorentzian-classifier.js` (`computeAtrPercent`), reusado tal qual.

**Ligação real (a regra de graduação):**
- `ramber-ui/src/engine-bridge.ts` — `computeSuperTrend()`, wrapper fino,
  fail-closed para `[]` enquanto o aquecimento de Wilder não fecha.
- `ramber-ui/src/chart/EnhancedChart_110_Percent.tsx` — **duas** LineSeries
  nativas (a lightweight-charts não colore segmentos distintos de uma mesma
  série): uma desenha os trechos de alta, a outra os de baixa, cada uma com
  *whitespace* onde a outra manda. Sem esses buracos a lib interpolaria uma
  reta ligando os trechos e desenharia um stop que nunca existiu. O candle
  do **flip** entra nas duas de propósito — sem ele haveria um vão de 1
  candle exatamente no instante que mais importa ler.
- `chart-layer-depth.ts` / `nexus/layer-relevance.ts` / painel de camadas —
  camada real, controlável e competindo no orçamento visual como qualquer
  outra.

**Decisão de relevância que é fácil de errar:** a régua é EXISTÊNCIA real,
nunca proximidade ao preço. Um trailing stop é justamente mais informativo
quando está **longe** do preço (mostra quanta folga a tendência ainda tem);
aplicar a régua de proximidade esconderia a camada exatamente quando ela
mais diz alguma coisa.

**LEI 24 — display only.** Mesmo papel de VWAP/EMA/Trend Channel: contexto
desenhado ao Operador. Nunca uma segunda decisão de LONG/SHORT, nunca um
filtro sobre a decisão do Núcleo.

**Suítes:** `supertrend.test.ts` (18, execução real da matemática, incluindo
a catraca) + `supertrend-graduation.test.ts` (18, fiação ponta a ponta,
fail-closed por execução real e LEI 24).

## `pivot-points-engine.js` — GRADUADO (2026-09-01)

Pivot Points clássicos (Floor Trader): PP/R1-3/S1-3 a partir do candle
DIÁRIO anterior FECHADO, fórmula padrão pesquisada (PP=(H+L+C)/3, R1=2PP-L,
S1=2PP-H, R2=PP+(H-L), S2=PP-(H-L), R3=H+2(PP-L), S3=L-2(H-PP)).

**Por que agora.** Auditoria do ecossistema de indicadores pedida
diretamente pelo Operador ("qual ferramenta que está faltando"). Do
conjunto de 7 ferramentas clássicas ausentes confirmadas por grep real
(CCI, Stochastic, Williams %R, MFI, Ichimoku, Pivot Points, Keltner),
Pivot Points foi o único gap não-redundante para um terminal de futuros
intradiário — os outros 4 osciladores substituíveis por RSI de Wilder +
CVD/Delta/Volume Profile já reais, Keltner redundante com Bollinger
Bandwidth + SuperTrend já existentes, Ichimoku (5 linhas + nuvem com
projeção pra frente/trás) grande demais pra entrar de carona nesta rodada.

**Fonte de dado — a parte que exigiu mais cuidado.** O motor puro nunca
decide "qual candle é ontem": recebe candles diários já resolvidos e usa
sempre o ÚLTIMO do array. Quem resolve isso é `getPivotPoints()`
(engine-bridge.ts), que filtra por TEMPO real (`candle.t + 24h <= agora`)
para achar o último dia genuinamente fechado — nunca por posição no array,
porque não há garantia contratual de que a API inclua ou não o dia ainda
em formação como último elemento. Mesmo padrão não-bloqueante de
`getHtfMarketStructure` (cache + refresh em segundo plano, nunca trava o
ciclo principal por um dado contextual que só muda 1x por dia real).

**Zero segunda matemática.** Nenhuma outra parte do repositório calculava
Pivot Points (`grep -ri "pivot point"` confirmou zero ocorrência antes
deste motor).

**Ligação real (a regra de graduação):**
- `ramber-ui/src/engine-bridge.ts` — `getPivotPoints(symbol)`, cache
  não-bloqueante + `computePivotPoints()` (motor puro) por trás.
- `ramber-ui/src/chart/EnhancedChart_110_Percent.tsx` — até 7
  `createPriceLine` reais (mesma técnica de S1/R1), família de cor
  "attention" (canvas-palette.ts) — mesma cor de S1/R1 por serem a MESMA
  categoria conceitual (nível de suporte/resistência a observar), títulos
  prefixados "PVT " para não colidir visualmente com o S1/R1 de swing.
- `nexus/layer-relevance.ts` — existência real (`hasPivotPoints`), custo
  visual CONTADO (7, não estimado) e rank deliberadamente baixo em
  `AUTO_LAYER_PRECISION_ORDER` (custo alto não pode dominar o teto de 12
  sempre que relevante).
- painel "Camadas do Gráfico" (App.tsx) — toggle próprio, `pivot_points`
  nas 4 listas (CHART_LAYER_IDS/painel/RELEVANCE_LAYER_IDS/
  LAYER_VISUAL_COST) no mesmo commit.

---

## `ichimoku-engine.js` — GRADUADO (2026-09-01)

Ichimoku Kinko Hyo (Goichi Hosoda) completo: Tenkan-sen (9), Kijun-sen (26),
Senkou Span A/B (26/52), Chikou Span (26) e a nuvem Kumo.

**Por que agora.** Era a segunda metade do gap real da auditoria do
ecossistema de indicadores (ver a seção do `pivot-points-engine.js` acima):
dos 7 clássicos ausentes, só Pivot Points e Ichimoku sobreviveram ao juízo de
redundância, e o Ichimoku ficou de fora daquela rodada por tamanho, não por
mérito. Esta rodada fecha o gap.

**O erro de implementação que este motor NÃO comete.** As 4 linhas do
Ichimoku são o **ponto médio dos extremos** do período — `(máxima_do_período +
mínima_do_período) / 2` — e **não** uma média móvel de fechamentos. É o erro
mais comum em implementações caseiras, e ele não aparece como bug: produz uma
curva plausível, só que de outro indicador. O teste
`ichimoku-engine.test.ts` separa os dois casos sem ambiguidade com um fixture
assimétrico (`high` crescente, `low`/`close` fixos em 50): a implementação
errada devolveria 50, a correta devolve 79,5.

**O deslocamento é contrato, não pós-processamento.** As séries voltam **já
posicionadas no índice em que se desenham**: `senkouA[i]` é o valor calculado
em `i-26`; `chikou[i]` é o fechamento de `i+26`. A projeção que passa do fim
da série vive em `futureSenkouA`/`futureSenkouB` (26 pontos), arrays
separados — nenhum candle é inventado para pendurá-la. Antes do índice 77
(52 de aquecimento + 26 de deslocamento) as séries trazem NaN honesto, nunca
um valor extrapolado para preencher o começo do gráfico.

**Zero segunda matemática.** `grep -ri "ichimoku\|tenkan\|kijun\|senkou\|kumo"`
confirmou zero ocorrência no repositório antes deste motor.

**Ligação real (a regra de graduação):**
- `ramber-ui/src/engine-bridge.ts` — `computeIchimoku()` e
  `computeIchimokuCloudReading()`, wrappers finos sobre o motor puro.
- `ramber-ui/src/chart/IchimokuPlugin.tsx` — canvas próprio no padrão dos
  demais overlays. **Técnica nova neste repositório:**
  `timeScale().logicalToCoordinate()` para desenhar as 26 barras de nuvem
  ALÉM do último candle. O precedente até aqui (ápice do Triângulo, EPA da
  Wolfe) resolvia o futuro mostrando preço + ETA em texto, por não ter candle
  onde pendurar o ponto; aqui isso não serviria — um Ichimoku sem nuvem
  projetada é outro indicador.
- Cor: família `measurement` inteira (canvas-palette.ts), **deliberadamente
  não** o par verde/vermelho. Nesta paleta esse par significa LONG/SHORT, e
  pintar a nuvem com ele faria leitura de contexto parecer sinal de entrada
  (LEI 24). A torção da nuvem continua sendo fato real, reportada por
  `ichimokuCloudPosition()` como leitura — nunca codificada numa cor que se
  leria errado.
- `chart-layer-depth.ts` — nível `"zone"`, não `"line"`: a nuvem é
  preenchimento amplo e cobriria EMA/VWAP/Fibonacci se subisse ao nível das
  linhas de 1px.
- painel "Camadas do Gráfico" (App.tsx) — toggle próprio, `ichimoku` nas 5
  listas (CHART_LAYER_IDS + defaults / painel / RELEVANCE_LAYER_IDS + regra +
  LAYER_VISUAL_COST / AUTO_LAYER_PRECISION_ORDER / LAYER_TIER) no mesmo
  commit.

**O que este motor NÃO faz.** Não emite direção. Cruzamento Tenkan×Kijun e
preço×nuvem são leitura do Operador — LEI 24: o único emissor de
LONG/SHORT/WAIT continua sendo o Core Engine. Os períodos são os clássicos
9/26/52/26 de Hosoda; as variantes de cripto 24h (10/30/60, 20/60/120) não
estão implementadas porque são escolhas diferentes, não "a mesma conta
ajustada".

**Limitação declarada.** Só a variante CLÁSSICA (pesos iguais H+L+C).
Woodie/Camarilla/Fibonacci Pivots usam fórmulas REAIS diferentes — não
estão implementadas, e a metadata do motor diz isso explicitamente.

**LEI 24 — display only.** Mesmo papel de S1/R1/VWAP/EMA: nível de
referência exibido ao Operador. Nunca uma segunda decisão de LONG/SHORT.

**Suítes:** `pivot-points-engine.test.ts` (10, execução real da fórmula +
fail-closed) + `pivot-points-fetch.test.ts` (6, fronteira de rede real
mockada, filtro por tempo do dia fechado).

## `andrews-pitchfork-engine.js` — GRADUADO (2026-09-01, isolado no mesmo dia)

Andrews Pitchfork / Median Line Analysis (Alan H. Andrews): três pivôs
alternados reais → linha mediana + duas paralelas.

**Por que existe.** Auditoria do ecossistema de indicadores. Depois de Pivot
Points e Ichimoku entrarem, o Pitchfork ficou como o **único** desenho de
gráfico com nome próprio ainda ausente que não estava bloqueado por
disponibilidade de dado (como o Footprint) nem por decisão pendente do
Operador. `grep -ri "pitchfork|andrews|median line"` no repositório inteiro
voltou **zero** ocorrência antes deste motor.

**Definição pesquisada, não inventada** (fontes independentes antes de
escrever código: StockCharts ChartSchool, Optuma "Median Line Analysis",
GoCharting, Coghlan Capital). Três pivôs alternados — `low-high-low` (garfo
ascendente) ou `high-low-high` (descendente). A **Median Line** parte de P0 e
passa pelo **ponto médio de P1-P2**; as paralelas passam por P1 e por P2.

**A INCLINAÇÃO É EM ÍNDICE DE BARRA, NÃO EM TEMPO DE RELÓGIO** — decisão
real, não detalhe. O eixo x da lightweight-charts espaça BARRAS
uniformemente, ignorando fim de semana e buraco de dado. Uma inclinação em
milissegundos produziria um garfo que ENTORTA em cada vão: as três linhas
deixariam de ser paralelas na tela, que é a única coisa que o Pitchfork
promete.

**O que este motor SE RECUSA a fazer.** A literatura repete uma afirmação
atribuída ao próprio Andrews: *"o preço retorna à mediana em cerca de 80% das
vezes"*. Esse número não aparece em lugar nenhum do motor — nem constante,
nem campo de saída, nem texto de leitura. Regra de Ouro 2: sem backtest real
neste repositório, repetir um número de terceiro como se fosse medição
própria é exatamente a fabricação que a regra proíbe. As `limitations` da
metadata **citam** os 80% de propósito, para declarar a recusa — e um teste
trava a ausência do número na LEITURA COMPUTADA, que é o que chegaria à tela.

**Zero matemática nova de swing:** os pivôs vêm de `fractal-swings.js`, o
mesmo K=2 compartilhado. A alternância (dois pivôs do mesmo tipo em sequência
→ fica o mais extremo) é a única regra própria, e está testada nos dois
sentidos.

**GRADUADO na rodada seguinte**, depois das 21 suítes provarem o
comportamento — a ordem do Laboratório foi respeitada (isolado e provado
primeiro, ligado depois), não encurtada porque o motor ficou pronto rápido.

**Ligação real (a regra de graduação):**
- `ramber-ui/src/engine-bridge.ts` — `computeAndrewsPitchfork()`, wrapper fino.
- `ramber-ui/src/chart/AndrewsPitchforkPlugin.tsx` — canvas próprio no padrão
  dos demais overlays. Projeta **60 barras além do último candle** (a razão de
  existir do garfo: as três retas são infinitas e o que interessa é onde elas
  estarão), pela mesma técnica `timeScale().logicalToCoordinate()` que o
  IchimokuPlugin introduziu. As retas param em `plotRight`
  (chart-plot-area.ts) — nunca correm por baixo dos números do eixo.
- Os 3 pivôs são desenhados como pontos: sem eles a construção é uma
  afirmação sem endereço, e o Operador não consegue conferir de onde saiu a
  inclinação.
- Cor: família `measurement`, a mesma de Fibonacci/VWAP/ZigZag/Ichimoku —
  medição sem viés direcional. Deliberadamente **não** o par verde/vermelho,
  que nesta paleta significa LONG/SHORT (LEI 24).
- `chart-layer-depth.ts` — nível `"line"` (são 3 retas de 1px), e entrou
  também em `CHART_LINE_ONLY_LAYER_IDS`: o predicado da regra 4 passa a
  cobri-lo, então ele nunca poderá ser declarado num nível que pinta área.
- painel "Camadas do Gráfico" (App.tsx) — toggle próprio, `andrews_pitchfork`
  nas 5 listas no mesmo commit.

**Achado da própria suíte, antes de qualquer integração:** `analyze(null)`
estourava num TypeError. O default `input = {}` cobre `undefined`, não
`null`. Um motor que explode não é fail-closed, é só quebrado — corrigido com
guarda explícita. É o argumento do Laboratório em uma linha: o defeito
apareceu no banco de testes, não no gráfico do Operador.

**Suíte:** `ramber-ui/tests/andrews-pitchfork-engine.test.ts` (21, execução
real). O teste central usa um fixture onde as três leituras plausíveis
divergem — mediana correta (slope 25/15), "reta P0→P1" (slope 4) e "reta
P0→P2" (slope 0,5) — para que a implementação errada não passe por parecer
plausível.

**Correção registrada de um erro meu no fixture:** a primeira versão do
construtor de série usava banda plana fixa (99..101), então um "fundo"
plantado em 100 ficava ACIMA do piso e não virava swing low. `analyze`
devolvia `DADOS_INSUFICIENTES` corretamente enquanto o teste acusava o motor.
A banda passou a ser DERIVADA dos pivôs pedidos.

---

## `delta-divergence-engine.js` — GRADUADO (2026-09-01, criado 2026-08-24)

Divergência entre **preço e CVD** (Cumulative Volume Delta): preço faz topo
mais alto enquanto o CVD faz topo mais baixo (exaustão compradora), ou o
espelho no fundo (exaustão vendedora).

**Por que existe.** Comparação real com plataformas concorrentes pedida
pelo Operador. `grep -ri "divergen"` no repositório inteiro só encontrava
divergência **entre corretoras** (trust score, cross-exchange). Divergência
de DELTA não existia — e é o item que todas as plataformas de order flow
consultadas destacam (Sierra Chart nomeia "Delta Divergence"
explicitamente; ATAS, Tape Delta, GoCharting e Bookmap trazem o mesmo).

**Definição pesquisada, não inventada** (WebSearch, múltiplas fontes
independentes, antes de escrever código). As fontes também separam
**exaustão** (ausência de pressão) de **absorção** (pressão batendo numa
parede) — este motor calcula só a primeira; absorção já vive em
`src/orderflow/signal-engine.js`.

**LEI 24, e aqui a pesquisa e a lei do projeto dizem a mesma coisa:** as
fontes afirmam que a divergência "marca um LOCAL de possível exaustão, não
um GATILHO — espere o preço confirmar". É literalmente a definição de
camada de confluência display-only.

**Zero matemática nova.** Swings vêm de `fractal-swings.js`; o CVD vem da
série real já retida pelo poller. O motor não coleta, não estima e não
interpola nada.

### GRADUADO 2026-09-01 — a decisão em aberto foi tomada

**Ligação real (a regra de graduação):**
- `ramber-ui/src/engine-bridge.ts` — `computeDeltaDivergence(candles, cvdSamples)`,
  wrapper fino sobre `analyze()`.
- `ramber-ui/src/chart/DeltaDivergencePlugin.tsx` — overlay no padrão provado.
  Lê a série de CVD **direto da store** (`useOrderflowHistory()`), como o
  `OrderFlowHeatmapPlugin` já faz: o ring cresce a cada 4 s, e passá-lo por
  prop re-renderizaria `EnhancedChart_110_Percent` inteiro a cada ciclo do
  poller só para alimentar um overlay (Regra de Ouro 6/7).
- Cor: o par `bullish`/`bearish`, seguindo o precedente real do
  `StructureBreakMarkersPlugin` (BOS/CHOCH) — mesma categoria, um EVENTO
  pontual com direção intrínseca. É o oposto da decisão tomada para o
  Ichimoku no mesmo dia, e a diferença é a categoria e não capricho: a nuvem
  é um CAMPO contínuo que ficaria permanentemente aceso e leria como sinal
  parado; uma divergência é uma marca pontual. LEI 24 intacta nos dois.
- `chart-layer-depth.ts` — nível `"event"`, com BOS/CHOCH e sweep.
- `nexus/layer-relevance.ts` — **a única camada cuja relevância é a LEITURA,
  não a existência do motor.** Uma divergência é rara por definição e o
  overlay desenha NADA quando não há uma; marcar relevante só porque o CVD
  cobre velas suficientes gastaria vaga do teto de 6 numa camada em branco.
  Quando há leitura, emite `highlight` — e está cadastrada explicitamente em
  `AUTO_LAYER_PRECISION_ORDER` em vez de confiar no "entra por último", que
  a medição do caso `candle_patterns` provou ser "nunca" na prática.
- O motivo quando não há leitura carrega o número real de velas cobertas
  ("cobre 4 velas, o mínimo é 12"), nunca um "sem dado" que não ensina nada.
- `metadata.status` do motor: `LABORATORIO` → `ACTIVE_READ_ONLY`, no mesmo
  commit — as três fontes (árvore, seção, metadata) mexidas juntas, que é
  exatamente o que `quarantine-registry.test.ts` existe para exigir.

### O histórico do bloqueio (preservado — a razão original CAIU em 2026-08-31)

> **O bloqueio descrito abaixo não existe mais, e o texto ficou desatualizado
> por uma semana.** `ORDERFLOW_HISTORY_CAPACITY` foi de **120 para 900** em
> 2026-08-24 (commit "retencao de fluxo 8min -> 1h"), depois que a medição
> mostrou que o custo por push é irrelevante (~0,0085 ms a cada 4 s). A
> retenção real hoje cobre **~1 hora**, ou seja **4 velas inteiras em 15m** —
> não "menos de uma vela".
>
> O que sobra é uma **decisão**, não um impedimento: graduar este motor é
> ligar um `import` no `engine-bridge.ts` e uma camada nova no gráfico, com
> as 26 suítes de execução real que ele já tem. Fica registrado como decisão
> em aberto do Operador, não como bloqueio técnico — a diferença importa,
> porque "bloqueado" faz a próxima sessão nem olhar.

O texto original, preservado porque explica o critério (a régua é cobertura
real de dado, nunca vontade de ligar a camada):

O CVD retido cobria **~8 minutos reais**
(`ORDERFLOW_HISTORY_CAPACITY = 120` a ~4s/ciclo). Num gráfico de 15m isso era
**menos de uma vela**. O motor devolve `DADOS_INSUFICIENTES` — com o número
real de velas cobertas, para a UI poder dizer ao Operador exatamente o que
falta — em vez de extrapolar CVD.

A mesma causa raiz já está documentada em `nexus/multi-timeframe-engine.ts`
("não existe dado real retido para calcular Order Flow honesto em
1H/4H/1D"). **É uma limitação só, não duas.**

**O que destravaria:** aumentar a retenção. Mas `pushOrderflowHistory` faz
`[...ring, entry]` — cópia do array **inteiro a cada ciclo de 4s**. Subir a
capacidade de 120 para ~1800 (2h) multiplicaria por 15 o custo desse copy,
a cada 4 segundos, no main thread — contra a Regra de Ouro 6/7. A evolução
honesta é trocar o ring por uma estrutura de custo O(1) por push ANTES de
subir a capacidade. Registrado como o próximo passo real, **não feito às
pressas junto**.

**Suíte:** `ramber-ui/tests/delta-divergence-engine.test.ts` (26, execução
real — as duas direções da definição, "preço e CVD juntos NÃO é
divergência", mapeamento CVD→vela, sufixo contíguo nunca costurado por cima
de um buraco, fail-closed em todas as formas, índices devolvidos na série
ORIGINAL, e LEI 24/Regra de Ouro 2).

**Achado registrado (teste de mutação):** a primeira versão tinha um filtro
de causalidade próprio (`s.index + FRACTAL_K <= ultimo`) que **não filtrava
nada** — `findSwings` já varre só `k <= i < length - k`. Um guard que não
guarda é pior que nenhum. Removido, e a garantia real passou a ser travada
por teste em cima de `findSwings`, onde ela de fato vive.

## GRADUAÇÃO — backtest estrutural para dentro do app (superfície de UI)

**Autorização:** pedido explícito do Operador, registrado via `AskUserQuestion`
("constrói o botão de backtest dentro do app, para a taxa de acerto rodar no
próprio iPad"). O cabeçalho de `history-capture.js` já previa exatamente esta
decisão: *"este módulo não tem, ainda, nenhum gatilho de UI — é a peça de
código pronta para quando essa decisão de superfície for tomada
explicitamente"*.

**O que graduou:** `structural-backtest.js` (walk-forward zero-lookahead) e
`history-capture.js` (paginação real com proveniência) passam a ter UM
consumidor de produção.

**Consumidor único autorizado:** `ramber-ui/src/workers/backtest-worker.ts`.
Nenhum outro módulo pode importar do laboratório — e isso não é convenção, é
teste: `structural-backtest.test.ts` e `history-capture.test.ts` varrem
`ramber-ui/src` e `ipad_runtime/src` inteiros e falham se qualquer arquivo
além do worker importar de lá. A guarda ficou MAIS específica do que era
(antes dizia "ninguém", agora nomeia o autorizado e proíbe o resto);
verificado por mutação: importar em `App.tsx` derruba a suíte.

**Por que Worker (Regra de Ouro 6):** o walk-forward roda um frame de replay
por candle e executa dois motores graduados por frame. Com milhares de
candles são segundos de CPU — no main thread o gráfico congelaria e os 60 FPS
do iPad iriam junto. Sem Worker disponível NÃO há fallback: o hook falha
com `worker_indisponivel`, porque é melhor não medir do que travar o terminal.

**LEI 24 preservada:** display-only. Nada realimenta decisão; travado por
teste que varre o corpo do `BacktestPanel` procurando qualquer escrita em
estado de decisão.

**Regra de Ouro 2 preservada:** `taxaAlvoAmostra` é a fração real da amostra
resolvida que tocou o alvo antes do stop — aritmética sobre eventos passados,
nunca probabilidade do próximo trade. O aviso que diz isso é obrigatório e
fica sempre visível na tela, nunca só no tooltip.

**Fail-closed em três pontos:** pedido inválido recusado antes de gastar rede;
captura vazia ou curta demais nunca vira backtest (preservando o `stopReason`
real, que é a causa que o Operador pode agir); e `null` jamais é formatado
como `0%` — vira travessão, porque ausência de medida não é medida zero.

**Piso de amostra reaproveitado, não inventado:** `BACKTEST_MIN_RESOLVED_FOR_RATE
= 30` é o MESMO piso que `nexus/expectancy.ts` já usa para o Track Record
real (`MIN_TRADES_FOR_VALID_EXPECTANCY`), e há teste comparando os dois.
Abaixo dele o número real continua visível, com a ressalva junto — esconder
seria tão desonesto quanto apresentar como sólido.

## GRADUAÇÃO — comparação de backtests dentro do app (compare-runs.js, 2026-09-04)

**Por que agora.** Pedido do Operador ("organiza tudo que tem no
laboratório e deixa rodando"). Auditoria de `src/research/**` encontrou
14 engines já graduados, `hmm-regime-model.js` isolado por razão
estrutural real (retreino exige dado de mercado que este sandbox nunca
tem — nenhuma mudança forçada aqui, ver seção própria acima), e
`compare-runs.js` como o único módulo do Laboratório de backtest com
suíte completa (10 testes) e **zero consumidor de produção** — mesmo
padrão de falha já registrado nesta trilha para `institutional-blocks.js`/
`supertrend-engine.js`: um motor correto que ninguém consome não é
inteligência entregue.

**Zero matemática nova.** `compareBacktestRuns` já existia intocado — a
graduação é só o fio até a UI, exatamente como `structural-backtest.js`/
`history-capture.js` graduaram via `backtest-worker.ts` numa rodada
anterior.

**Por que App.tsx e não um Worker novo.** `structural-backtest.js` roda
walk-forward sobre milhares de candles (segundos de CPU, por isso o
Worker). `compareBacktestRuns` é um z-test síncrono sobre dois objetos
JÁ medidos — trabalho de microssegundos. Criar um Worker só para isso
seria complexidade sem motivo (Regra de Ouro 6 protege o main thread de
trabalho PESADO, não proíbe aritmética trivial nele).

**Ligação real (a regra de graduação):**
- `ramber-ui/src/nexus/backtest-presentation.ts` — `descreverVeredito()`,
  nova função pura: rotula os 4 vereditos reais sem fazer "MELHOROU"
  soar como aprovação automática (a Fase 9 exige aprovação humana mesmo
  assim — `COMPARE_RUNS_AVISO` sempre visível, nunca só no tooltip).
- `ramber-ui/src/App.tsx` (`BacktestPanel`) — único consumidor
  autorizado. Um botão "Salvar como baseline" tira uma FOTOGRAFIA local
  (`useState`, nunca persistida) do resultado já resolvido; rodar outra
  medição vira a "corrida atual"; `compareBacktestRuns(baseline, r)` só
  roda quando as duas têm `status === "OK"` — nunca reimplementa as
  guardas do motor (amostra insuficiente, variância nula continuam
  decisão exclusiva de `compare-runs.js`).
- `ramber-ui/tests/compare-runs.test.ts` — a fronteira "ninguém importa"
  virou "só `src/App.tsx` importa", mesma disciplina real de
  `structural-backtest.test.ts`: mais específica, nunca afrouxada.

**LEI 24 — display only, travado por teste.** Mesmo bloco de
`BacktestPanel` já testado (`backtest-in-app.test.ts`, "o backtest não
decide e não trava a tela") cobre o código novo automaticamente — nenhum
`setDirection`/`engine.direction`/`setChartLayerVisibility` na função
inteira. A comparação nunca aplica nada sozinha: é leitura para o
Operador decidir, exatamente como o próprio módulo já declarava antes de
ter consumidor nenhum.

**O que esta graduação NÃO faz.** Não persiste a baseline entre sessões
(recarregar a página perde a fotografia — decisão deliberada, comparar é
um ato pontual, não um estado do app). Não roda os dois backtests em
paralelo nem agenda nada — o Operador mede, salva, mede de novo, compara,
na ordem que quiser. Não resolve a Fase 2 real do backtest (histórico
capturado de verdade, não só a série do gráfico já em memória) — isso
seguiria pendente mesmo sem esta graduação.

**Suíte:** `compare-runs.test.ts` (10, execução real do z-test + a
fronteira agora nomeada) + 6 testes novos em `backtest-in-app.test.ts`
(`descreverVeredito`, fiação real de `BacktestPanel`, baseline como
estado local não-persistido, aviso obrigatório renderizado, comparação
gated pelos dois status OK, execução real ponta a ponta).
