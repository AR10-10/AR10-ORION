# Fusion Research Quarantine

Codinome interno: `AR10_CYBORG_FUSION_RESEARCH_QUARANTINE_V1`.

**Status desta árvore: apenas os 8 engines graduados + 1 utilitário
compartilhado abaixo são ACTIVE_READ_ONLY. Todo o restante foi excluído em
2026-06-30 (purge de código morto).**

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
    ├── supertrend-engine.js           LABORATÓRIO (isolado 2026-08-11, não graduado —
    │                                   ver secao "Laboratório de engines" abaixo)
    ├── fractal-swings.js              utilitário compartilhado (extraído 2026-07-03,
    │                                   não é um engine — ver secao "Utilitários" abaixo)
    └── hmm-regime-model.js            LABORATÓRIO (isolado 2026-08-10, não graduado —
                                        ver secao "Laboratório de engines" abaixo)
```

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
  Status: **LABORATÓRIO** — nenhum módulo de produção importa daqui.
  Graduação (import por `engine-bridge.ts`, entrada em `CHART_LAYER_IDS`,
  plugin de canvas próprio) é um passo seguinte deliberadamente separado,
  ainda não construído.

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
  Controlada" da Diretriz de Evolução Quantitativa e Aprendizado Real).
  `compareBacktestRuns(baseline, candidate)` — veredito estatístico
  (`MELHOROU`/`PIOROU`/`NEUTRO`/`DADOS_INSUFICIENTES`) sobre duas
  execuções reais de `runStructuralBacktest`, via two-proportion z-test
  agrupado (método padrão de inferência estatística, mesmo usado para
  comparar taxa de conversão A/B — não uma fórmula inventada). Amostra
  abaixo do mínimo declarado (`MIN_RESOLVED_PER_GROUP=20`, por grupo) ou
  variância pooled nula ⇒ sempre `DADOS_INSUFICIENTES`, nunca um veredito
  fabricado. Nunca aplica nada sozinho — devolve o veredito para leitura
  humana; a "APROVAÇÃO" da Fase 9 continua manual, sempre.
  Status: **LABORATÓRIO** — nenhum módulo de produção importa daqui
  (fronteira travada por teste em
  `ramber-ui/tests/compare-runs.test.ts`). Já é totalmente usável hoje
  para comparar duas execuções sobre qualquer série de candles (fixture
  OU real, quando existir) — não depende da Fase 2 do backtest para
  funcionar como mecanismo, só depende dela para que a comparação
  descreva desempenho de mercado real em vez de uma série de teste.

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
   `ipad_runtime/index.html` como diff isolado e revisável.
4. Se o módulo exigir credencial, resolver via política equivalente a
   `WindowsLocalSecretPolicy`/`TelegramAuxSecretPolicy` — nunca no frontend,
   nunca no repositório, nunca no storage do PWA.
