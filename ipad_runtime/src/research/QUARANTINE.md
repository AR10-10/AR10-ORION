# Fusion Research Quarantine

Codinome interno: `AR10_CYBORG_FUSION_RESEARCH_QUARANTINE_V1`.

**Status desta árvore: apenas os 5 engines graduados + 1 utilitário
compartilhado abaixo são ACTIVE_READ_ONLY. Todo o restante foi excluído em
2026-06-30 (purge de código morto).**

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
    ├── fractal-swings.js              utilitário compartilhado (extraído 2026-07-03,
    │                                   não é um engine — ver secao "Utilitários" abaixo)
    ├── zigzag-engine.js               LABORATÓRIO (isolado 2026-08-10, não graduado —
    │                                   ver secao "Laboratório de engines" abaixo)
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

- **`engines/zigzag-engine.js`** (2026-08-10, v16.0 PRO MAX §4/§6.3 — pedido
  do Operador por um "ZigZag: deviation %" no Layer Manager do gráfico).
  `computeZigZag(candles, deviationPct, depth)` — indicador ZigZag clássico
  por limiar percentual de reversão + profundidade mínima de barras entre
  pivô candidato e barra de confirmação. Pesquisa real via WebSearch
  (StockCharts ChartSchool, Corporate Finance Institute, Capital.com) antes
  de implementar, confirmando os 2 parâmetros reais do indicador nomeado
  (Disciplina de trabalho item 2 do CLAUDE.md) — **deliberadamente
  DISTINTO** de `fractal-swings.js` (K=2 candles fixos de confirmação de
  cada lado, sem noção de percentual/profundidade configurável); os dois
  algoritmos respondem perguntas diferentes e nenhum substitui o outro.
  Só pivôs CONFIRMADOS entram na saída — a perna em formação (ainda sem
  reversão de deviation% oposta) nunca aparece, mesmo sendo o valor mais
  extremo da série (fail-closed, Regra de Ouro 3: nunca mostrar um pivô
  que ainda pode mudar). Candles insuficientes ou parâmetros inválidos
  (deviationPct<=0, depth<0, não finito) ⇒ sempre `DADOS_INSUFICIENTES`;
  uma série real que nunca cruza o limiar retorna `points: []` com
  `status: 'OK'` (dado real, só sem pivô relevante — nunca confundido com
  falta de dado). Achado real do próprio processo de teste (19 testes de
  execução real em `ramber-ui/tests/zigzag-engine.test.ts`): a 1ª versão
  escrita usava um único índice (`extIdx`) compartilhado entre o
  candidato de alta e o candidato de baixa enquanto a direção ainda está
  indeterminada (`dir===0`, os 2 lados avançam na mesma iteração) —
  contaminava o gate de `depth` e o índice do pivô publicado de um lado
  com o avanço do outro. Corrigido separando em `extHighIdx`/`extLowIdx`
  antes de qualquer commit; os 5 testes que expuseram o bug (hand-traced
  contra a execução real do motor, nunca assumidos) continuam na suíte
  como regressão permanente. Zero `fetch()`, zero `WebSocket`, zero
  `Math.random`/`Date.now` — função pura de cálculo sobre a série
  recebida.
  Status: **LABORATÓRIO** — nenhum módulo de produção importa daqui
  (fronteira travada por teste em
  `ramber-ui/tests/zigzag-engine.test.ts`). Graduação (import por
  `engine-bridge.ts`, entrada em `CHART_LAYER_IDS`, plugin de canvas
  próprio) é um passo futuro deliberadamente separado desta entrega —
  ainda não decidido nem construído.

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
