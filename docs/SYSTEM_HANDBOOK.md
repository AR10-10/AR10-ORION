# SYSTEM_HANDBOOK — AR10 CYBORG

Documento central de organização do sistema, escrito sob ordem explícita
do Operador ("executa todas as etapas pendentes e organiza tudo").
Registra o estado REAL atual: o pipeline canônico de decisão, onde cada
peça vive, como se verifica, e — a parte mais importante — o destino
honesto de cada pendência histórica (fechada, coberta, ou adiada de
propósito com a razão registrada). As regras permanentes vivem em
`CLAUDE.md` (raiz) e não são repetidas aqui; este documento é o mapa,
não a lei.

Data de referência: 2026-07-19 · Branch: `claude/eloquent-cannon-qyt86y` · PR #13.

---

## 1. O que o sistema é (em uma frase)

Plataforma de inteligência de mercado **somente leitura** (READ_ONLY /
FAIL_CLOSED, zero execução, zero credencial) para USDT-M Futures —
Binance primária, MEXC/Bybit/OKX cross-check — que transforma dados
reais em UMA leitura operacional canônica por ativo/timeframe:
`BIAS → SETUP → ENTRY → OPERATION → TRADE PLAN → LEITURA`.

## 2. Pipeline canônico de decisão

```
DADOS REAIS (WS/REST públicos)
  ↓ market-data-bus (fonte canônica única por symbol:timeframe)
SNAPSHOT GLOBAL UNIFICADO (Zustand+Immer, 5 domínios)
  ↓ engines puros (research/engines + nexus/*)
CORE ENGINE — único emissor de LONG/SHORT/WAIT (LEI 24)
  ↓ Conselho/Confluence/Heat/Score/MTF (contexto, nunca decisão)
TRADE PLAN (trade-plan.ts — estrutura real: entrada/stop/alvos/R:R/obstacleCount)
  ↓ buildNexusDecision (decision-layer.ts — contrato único, v4)
OPERATIONAL READABILITY (operational-readability.ts — contrato v7)
  ↓
HEADER (badge herói) + CHART + GAVETAS + ABA ANALYSIS + TOOLTIP
```

Regra estrutural provada por teste: nenhum consumidor visual recalcula
direção/entrada/stop/alvo — todos leem o mesmo `NexusDecision`.

### 2.1 Os quatro eixos (contrato estável)

| Eixo | Pergunta | Valores | Onde deriva |
|---|---|---|---|
| DIREÇÃO (BIAS) | Para que lado o contexto inclina? | `LONG_BIAS · SHORT_BIAS · NEUTRAL_BIAS · CONFLICTED_BIAS · INSUFFICIENT_DATA` | `deriveBiasLabel()` |
| ESTRUTURA (SETUP) | Existe estrutura real? (nunca timing) | `LONG_SETUP · SHORT_SETUP · WAITING_FOR_CONFIRMATION · INVALIDATED · NO_VALID_SETUP` (+`WAITING_FOR_RETEST` no tipo, hoje não-alcançável — ver §6.5) | `deriveSetupState()` |
| TIMING (ENTRY) | O timing autoriza AGORA? | `ENTRY_CONFIRMED · WAITING_FOR_RETEST · WAITING_FOR_CONFIRMATION · ENTRY_INVALIDATED · NO_ENTRY` | `deriveEntryState()` |
| RISCO | O risco do plano/premissa é qualificável? | `ACEITÁVEL · ELEVADO · INVÁLIDO` (ou omitido — sem plano/sinal real, nunca fabricado); cada estado nomeia a fonte (Heat EXTREMO, R:R vs piso, DIRECTION_CONFLICT, RISK_GATED) | `deriveRiskState()` |
| CONFLUÊNCIA | Os eixos apontam juntos? | `ALINHADA · MISTA · CONFLITANTE · INSUFICIENTE` — consequência dos próprios eixos, nunca um super-score | `deriveConfluenceState()` |
| DECISÃO (Leitura) | Síntese de bate-olho | `LONG/SHORT — PLANO ATIVO · AGUARDAR LONG/SHORT · OBSERVAR · SEM OPERAÇÃO` | `deriveOutcomeLabel()` |

Contratos: `NexusDecision` v3 (carrega `heatTier` como passthrough) ·
Readability v7 (linhas na ordem exata do modelo — DIREÇÃO, ESTRUTURA,
TIMING, RISCO, CONFLUÊNCIA, DECISÃO). Superfícies: tooltip do badge
(desktop/mouse) + painel "Síntese Operacional" na aba ANALYSIS (visível
em toque no iPad).

A direção exibida em QUALQUER lugar da tela (badge herói,
MarketBiasDecisionCard, MarketDirectionWidget, AssistantOrb expandido)
carrega o qualificador visível (`PLANO ATIVO / AGUARDANDO ENTRADA / SEM
ESTRUTURA`) — mesma tabela `OUTCOME_QUALIFIER`, nunca uma segunda lógica.

## 3. Onde cada peça vive

- `ipad_runtime/src/research/engines/` — 5 motores graduados + 1
  utilitário (`fractal-swings.js`, detecção de swing COMPARTILHADA).
  Lista e regra de graduação: `ipad_runtime/src/research/QUARANTINE.md`.
- `ipad_runtime/ramber-ui/src/nexus/` — ~40 módulos puros (decision-layer,
  operational-readability, trade-plan, eta-engine, vwap, harmonic-patterns,
  trend-channel-engine, rr-quality, premium-discount, heat-score, council,
  confluence-engine, scenario-engine, multi-timeframe-engine, …).
- `ipad_runtime/ramber-ui/src/chart/` — EnhancedChart (lightweight-charts,
  atribuição relocada ao rodapé conforme licença Apache-2.0) + 8 camadas
  togglable no painel "Camadas do Gráfico": FVG/OB · BOS/CHOCH · Liquidity
  Heatmap · Volume Profile · Trade Plan Zone · Neural Market Aura · EMA ·
  Trend Channel. Harmônicos (figura XABCD completa + PRZ/EPA), Fibonacci,
  Premium/Discount, Cenários e S/R são price-lines/séries sempre-ativas
  fail-closed. Tudo fio de seda (1px sólida).
- `ipad_runtime/ramber-ui/src/store/unified-snapshot-store.ts` — snapshot
  único; todo campo em 4 lugares (state/actions/defaults/seletor).
- `ipad_runtime/ramber-ui/src/engine-bridge.ts` — ponte única motores→UI.

## 4. Parâmetros declarados (números de convenção, nunca medições)

| Parâmetro | Valor | Onde | Natureza |
|---|---|---|---|
| Piso de qualidade R:R | 1:2 | `nexus/rr-quality.ts` | Convenção de mesa; anota `(abaixo do piso 1:2)` nos lugares que já mostram R:R. Display-only — nunca esconde/bloqueia um plano (LEI 24). Ajustável pelo Operador no módulo. |
| Compactação de rótulos TP | 0.35% | `chart/label-compaction.ts` | Distância mínima entre níveis antes de compactar rótulos; preço nunca desloca. |
| Janela do Trend Channel | 50 candles | `nexus/trend-channel-engine.ts` | Mesma ordem de grandeza do EMA50; bandas ±2σ (cobertura amostral, nunca probabilidade). |
| Janela ENCERRADO | 5 min | `nexus/decision-layer.ts` | Pós-operação recente. |
| Decaimento de zonas | 30→100 candles | `chart/annotation-decay.ts` | Zonas velhas esmaecem até 15% e saem da TELA (nunca do dado). |
| Página de captura de histórico | 1000 candles | `research/backtest/history-capture.js` | Abaixo do limite documentado da Binance (1500), folga deliberada. Laboratório (fase 2 do backtest honesto, §6.7) — não é caminho de produção. |
| Teto de páginas de captura | 50 páginas | `research/backtest/history-capture.js` | Segurança contra laço sem fim (50 000 candles no pior caso); nunca atingido em captura normal. |

## 5. Como se verifica (infraestrutura real)

- `npx tsc --noEmit` + `npx vitest run` (101 arquivos, 1576 testes) +
  `npm run build`.
- `scripts/audit-header-maxcontent.mjs` — auditoria responsiva em 11
  viewports (iPad Mini→ultrawide 34", incluindo a classe ~1000px lógicos
  de MacBook em Retina 2x) com CONTEÚDO MÁXIMO injetado no header E na
  gaveta Market Intelligence (nunca só estado vazio).
- Replay sem look-ahead: `tests/replay-walk-forward.test.ts` (521 janelas,
  snapshot congelado) sobre fixture versionada por seed
  (`tests/replay-fixture.test.ts` — proveniência bit-a-bit).
- Convenção mista deliberada de teste: matemática de fronteira = execução
  real; fiação entre módulos = padrão de fonte (ver `CLAUDE.md`).
- Limite conhecido do sandbox de CI: sem egress para exchanges — cenários
  LONG/SHORT ao vivo são provados por execução real de testes, nunca
  observados com feed real dentro do sandbox.

## 6. Registro de pendências — o destino honesto de cada uma

### 6.1 Fechadas por código (nesta trilha, PR #13)
- BIAS/SETUP/ENTRY/OPERATION como eixos separados + guarda
  `DIRECTION_CONFLICT` + reset por ativo/timeframe + filtro de TP com
  R:R inválido.
- Qualificador BIAS≠ENTRY visível nos 4 pontos de direção da tela.
- Figura XABCD/Wolfe completa no gráfico (antes só a linha do ponto D).
- Trend Channel (Linear Regression Channel real, 8ª camada).
- Logo de terceiro removido do canvas, atribuição relocada ao rodapé
  (obrigação de licença preservada).
- Piso R:R 1:2 como parâmetro declarado (este documento, §4).
- Auditoria visual com conteúdo real na gaveta Market Intelligence.
- Gap de teste: resets de L2/orderflow/score escopados ao efeito real de
  troca de ativo.
- **Bug real de sincronização (Diretriz de Evolução Geral do Organismo,
  auditoria de sincronização entre widgets)**: `fetchSymbolData`/
  `fetchDerivatives` (`App.tsx`) não verificavam se o Operador já tinha
  trocado de ativo enquanto um fetch estava em voo — uma resposta tardia
  do ativo ANTERIOR podia ser mesclada no `chartData` do ativo NOVO, já
  resetado, rotulada sob o título errado. Corrigido com o MESMO padrão
  `cancelled`/`isStale` já usado pelos efeitos irmãos (`runCycle`, o
  efeito de troca de timeframe) — checagem antes de cada `setState`
  subsequente a um `await`, nos dois pontos de chamada (retry de boot e
  o `setInterval` de refresh). Aditivo puro, zero mudança de
  comportamento no caminho não-stale.
- **MFE/MAE estratificado no laboratório de backtest** (§5 da mesma
  diretriz): `structural-backtest.js` ganhou Maximum Favorable/Adverse
  Excursion por trial (R-múltiplo, método padrão de backtest) e médias
  agregadas totais + por direção. Zero matemática de mercado nova —
  método de medição padrão, mesma disciplina de honestidade do resto do
  laboratório.
- **2 bugs reais de staleness de overlay ao trocar TIMEFRAME** (Diretriz
  de Evolução Autônoma Integral, auditoria dedicada — troca de ATIVO já
  era imune por desmontar o gráfico inteiro quando `chartData` vira
  `[]`; troca de TIMEFRAME não desmonta nada): (1) as price lines S1/R1
  vêm de `engine.support/resistance`, derivadas de `realCycle` —
  resetado só na troca de ativo, nunca na de timeframe; como o ciclo de
  análise é assíncrono, um nível estrutural do timeframe ANTERIOR ficava
  rotulado como válido no novo até o ciclo novo resolver (diferente da
  decisão P1, que deliberadamente mantém `chartData` visível por ser o
  MESMO regime, só levemente atrasado — aqui o dado é de OUTRO regime,
  então limpar é o fail-closed correto). (2) O throttle de 5s do
  `VolumeProfilePlugin` só zerava na troca de ativo — trocar de
  timeframe dentro da janela mantinha o histograma/POC do timeframe
  anterior desenhado sobre os candles novos por até 5s. Ambos corrigidos
  no mesmo efeito `[chartTimeframe]` que já existia (nenhum efeito novo).
- **Modo Operacional / Modo Auditoria** (Diretriz de Evolução Autônoma
  Integral §11, achado real: só existia toggle individual por camada,
  nenhum atalho para as 2 leituras reais que o Operador alterna). 2
  botões no painel Camadas do Gráfico aplicam presets sobre o MESMO
  estado do toggle individual (nunca uma segunda fonte de visibilidade):
  Operacional = as 3 camadas que desenham o plano/direção de relance
  (`trade_plan_zone`/`neural_market_aura`/`ema`, prioridades visuais 1-6
  da diretriz); Auditoria = todas as 8 (o `DEFAULT_CHART_LAYER_VISIBILITY`
  de sempre). Puramente aditivo — nenhuma camada removida, cálculo de
  todas continua ativo, toggle individual continua funcionando.
- **`obstacleCount` por alvo** (Diretriz de Evolução Integral, §5/§6,
  pedidos duas vezes: "até onde existe espaço real para o preço se mover
  antes de encontrar uma barreira relevante?"). Achado real de auditoria:
  `trade-plan.ts` já recebia `inputs.zones` (Order Blocks/FVGs) mas só os
  usava para selecionar a ENTRADA — nunca cruzados contra os ALVOS (que
  vêm só de `inputs.levels`). `countObstacleZones` conta zonas estruturais
  reais entre a entrada e cada alvo (a própria zona de entrada nunca
  conta); passthrough literal até `decision-layer.ts` (v4) e
  `operational-readability.ts`/painel ANALYSIS (`obstacleSuffix`, mesma
  função reusada nos dois lugares — nunca uma segunda frase). Puramente
  aditivo: nunca muda preço/R:R/ordem dos alvos, só anota — mesma
  disciplina do sufixo de piso R:R. `undefined` honesto (nunca 0
  fabricado) em planos de contrato anterior.
- **Recusado/avaliado (mesma diretriz §5, "entrada atrasada")**: a
  diretriz também pede identificar "se a entrada está atrasada, se o
  preço já percorreu grande parte do movimento". Avaliado e NÃO
  integrado — definir "atrasado" exigiria uma magnitude de movimento
  esperado como referência, e a única forma honesta de estimar isso
  seria uma probabilidade/projeção que a Regra de Ouro 2 já proíbe
  fabricar sem backtest real. Sem uma referência não-arbitrária, "% do
  movimento já percorrido" seria só um limiar inventado disfarçado de
  medição — mesma categoria recusada do §13 (Alvo Máximo Estatístico).

### 6.2 Fechadas como JÁ COBERTAS (auditadas, nada a construir)
- **Inventário matemático da Diretriz de Evolução Autônoma Integral §6**:
  todos os itens nomeados já são reais e conectados — RSI de Wilder e
  ATR% (`lorentzian-classifier.js`, feature real do k-NN), EMA 9/21/50/200
  (`nexus/ema.ts`, overlay selecionável), CVD (`orderflow-history.ts` e
  consumidores), e os 6 harmônicos de razão clássicos + AB=CD + Wolfe
  (`harmonic-patterns.ts`: Gartley/Bat/Butterfly/Crab/Cypher/**Shark**,
  incluindo Shark — Carney 2011 — que uma primeira varredura textual
  quase classificou como ausente por diferença de maiúsculas/minúsculas
  na busca, corrigido antes de virar um falso gap no registro). Trade
  Plan: TP1/2/3 já são garantidamente não-sobrepostos e ordenados por
  construção (`trade-plan.ts` — dedup por preço exato + sort por
  distância + filtro de recompensa<=0 ANTES do teto de alvos, nunca
  depois). Síntese operacional explicável (BIAS/Setup/Entry/Risco/
  Confluência/Leitura/Motivo, o exemplo exato citado pela diretriz) já é
  `buildOperationalSummary` (`operational-readability.ts`). Nenhuma
  destas ferramentas precisou ser adicionada — só confirmadas.
- **Contexto HTF vs timing atual**: o cruzamento já existe em DOIS
  lugares reais — o membro `Conviction·MULTI_TIMEFRAME` alimenta
  Favoráveis/Contrários do contrato (ex.: "3/9 prazos concordam") e a
  Matriz Multi-Timeframe exibe a estrutura por prazo. Uma terceira
  apresentação seria a "complexidade externa" que a Diretriz de Evolução
  Profissional veta.
- **"Migração dos demais consumidores à Readability Layer"**: a parte
  com significado real (linguagem única de direção) está completa; os
  widgets numéricos leem os MESMOS campos do `NexusDecision`/plano por
  necessidade de estrutura (número+cor), não por divergência. Forçá-los a
  consumir strings prontas perderia estrutura sem ganho ao Operador.

### 6.3 Recusas permanentes (nunca "pendências")
- Execução real de ordens / chaves de API — recusa permanente
  (`CLAUDE.md`, restrição inegociável).
- **§13 "Alvo Máximo Estatístico"** — exigiria probabilidade calibrada
  sem backtest real neste repositório (Regra de Ouro 2). O gate começou a
  ser destravado: a **fase 1 da infraestrutura de backtest existe**
  (`src/research/backtest/structural-backtest.js`, laboratório — ver
  §6.7); a recusa só cai por completo quando a fase 2 (histórico REAL
  armazenado com proveniência) existir e produzir amostra auditável.

### 6.4 Adiamentos deliberados (decisão registrada, não esquecimento)
Cada um destes é da classe que `CLAUDE.md` (Regra de Ouro 6) exige tratar
como iniciativa própria isolada — nunca um item embutido numa faxina:
- **Cutover CrossExchangeService** (serviço pronto; troca da pipeline de
  dados ao vivo). Gatilho para reabrir: evidência real de problema na
  pipeline atual, ou pedido explícito do Operador.
- **k-NN/regime para Worker** (main thread sagrada — mover cálculo pesado
  exige medição própria de FPS antes/depois).
- **Migração WidgetContext → seletores atômicos Zustand** (refatoração
  ampla sem evidência de necessidade hoje; os pontos quentes já usam
  seletores atômicos).

### 6.5 Limitações honestas de dado (documentadas no código)
- `SETUP: WAITING_FOR_RETEST` e um 3º sinal de timing
  (`LONG_SETUP + WAITING_FOR_CONFIRMATION` simultâneos, exemplo recorrente
  das diretrizes): os dados reais atuais só sustentam UM sinal de timing
  quando um plano já existe (preço na zona ou não). Distinguir "reteste"
  de "confirmação" nesse estado exigiria inventar limiar de quórum do
  Conselho — mesma categoria de número que o piso R:R, mas SEM convenção
  de indústria para ancorar. Fica como está até existir fonte real.

### 6.6 Tarefas históricas superadas
As tarefas de documentação da era pré-`ramber-ui` (handbook antigo,
arquivamento de handoffs HTML, poda de docs do PR #6 — já mergeado)
são SUPERADAS por este documento: escrever aquele conteúdo hoje
descreveria um sistema que não existe mais. Os `docs/` históricos
permanecem como registro (Regra de Ouro 4 — nunca apagar sem ordem).

### 6.7 Iniciativa em andamento: histórico real + backtest honesto
Nomeada na conclusão da Diretriz de Evolução de Produto como a única
evolução comprovadamente mais importante; autorizada pelo Operador.
- **Fase 1 — FEITA** (2026-07-20): núcleo puro do laboratório
  (`src/research/backtest/structural-backtest.js`) — walk-forward via
  Motor de Replay real + engines graduados candle-only; desfechos
  first-touch com empate conservador (nunca vira acerto); no máximo 1
  trial aberto por direção (dedup de amostra); zero-lookahead e simetria
  LONG/SHORT provados por execução real (11 testes). Aviso de honestidade
  gravado no contrato. Nenhum fio com o caminho ao vivo (LEI 24,
  fronteira travada por teste).
- **Fase 2 — CÓDIGO PRONTO, CAPTURA REAL AINDA PENDENTE** (2026-07-20):
  `src/research/backtest/history-capture.js` pagina candles reais para
  trás pelo MESMO conector direto já usado pelo scroll-back do gráfico
  (`collectBinanceFuturesKlines` — mudança aditiva: `returnEvidence`
  opcional, default preserva 100% o comportamento existente; nunca pelo
  Bus, regra do `CLAUDE.md`), acumulando proveniência real por página (o
  MESMO Evidence Object de `js/real-data/schema.js` — nenhum campo novo
  inventado), com dedup, detecção EXATA de gaps e fail-closed que nunca
  descarta captura parcial boa. 18 testes de execução real, incluindo
  fronteira LEI 24 (`ramber-ui/tests/history-capture.test.ts`). Duas
  coisas continuam honestamente pendentes, sem as quais a fase 2 não
  "aconteceu" de fato:
  1. **Decisão de superfície**: onde/como o Operador dispara a captura
     real (botão em painel existente, outro caminho) — deliberadamente
     não decidida nesta entrega para não misturar decisão de produto com
     a matemática de paginação (mesma disciplina da Regra de Ouro 6:
     iniciativa própria isolada).
  2. **A captura em si**: exige ambiente com egress real às exchanges
     (produção/dispositivo do Operador; o sandbox de CI não tem). Sem
     ela, nenhum histórico real existe ainda — só a ferramenta para
     produzi-lo.
- **Fase 3 — DEPOIS**: rodar o laboratório (`structural-backtest.js`)
  sobre a amostra real capturada pela fase 2 e reportar contagens
  auditáveis (só então §6.3/§13 reabre de fato).

### 6.8 Auditoria de memória e aprendizado adaptativo (Diretriz de
Evolução Geral do Organismo, 2026-07-20) — mapa real + próxima
iniciativa proposta, ainda NÃO construída

Auditoria de código real (não suposição) contra os 6 tipos de memória
que a diretriz nomeou:

| Tipo de memória | Estado real | Onde |
|---|---|---|
| Sessão | EXISTE E FUNCIONA | `nexus/persistence.ts` (IndexedDB, candles + resumo do snapshot) |
| Decisões | EXISTE, PARCIAL → resolvido em parte no mesmo dia (ver §6.9) | `signal-track-record.ts` (`TrackedPlan`, histórico com teto de 100, persistido) — era uma fatia GLOBAL única; agora arquivada/restaurada por `symbol:timeframe` dentro da sessão (§6.9). Persistência do arquivo INTEIRO através de reload continua pendente. |
| Resultados | EXISTE E FUNCIONA | `trackPriceTick` resolve `TARGET_HIT`/`PARTIAL_HIT`/`STOP_HIT`/`REPLACED` reais; `hitRate()` acumulado — mas só EXIBIDO (painel Track Record), nunca consumido por nenhum cálculo de confiança/score |
| Padrões | NÃO EXISTE | Nenhum arquivo acumula estatística padrão→desfecho entre sessões |
| Regimes | EXISTE, PARCIAL | `RegimeHistory` (`market-regime/regime-history.js`) roda em produção a cada ciclo real, mas só em memória (nunca persiste) e só alimenta um rótulo "regime há N min" — nunca um cálculo de confiança |
| Erros | NÃO EXISTE | Nenhum log de sinal falho/gate rejeitado |

**Aprendizado adaptativo: não implementado hoje, em lugar nenhum.**
Toda superfície de score/peso real auditada (`ensemble-engine.js`,
`weight-matrix.js`, `regime-engine.js`, `lorentzian-classifier.js`)
calcula só a partir do snapshot ATUAL — nenhuma delas lê um resultado
passado real. O próprio código já nomeia esta lacuna como trabalho
futuro deliberado, não descoberto agora: `weight-matrix.js` (a tabela
estática regime→peso que alimenta `ensemble-engine.js`) documenta no
próprio cabeçalho "quando o autoaprendizado estatístico da V15 existir,
ele recalibra ESTA tabela".

**Proposta concreta para a próxima iniciativa** (não construída nesta
trilha — Regra de Ouro 6, própria iniciativa isolada, dado que toca
`weight-matrix.js`/`ensemble-engine.js`, código de produção ao vivo do
Council/GMIL, não um laboratório):
- Fonte real já pronta: `hitRate()`/`trackRecord` (memória de
  Resultados acima) já acumula acerto real, só nunca foi lido por nada
  além do painel.
- Mecanismo: recalibrar `weight-matrix.js` a partir de `hitRate()` real,
  nunca substituí-la — ajuste GRADUAL (ex.: multiplicador limitado por
  faixa, nunca um peso arbitrário), MEDIDO (cada ajuste seu próprio
  commit/teste), AUDITÁVEL (a tabela final continua legível, a origem
  do número continua rastreável ao dado real), REVERSÍVEL (parâmetro
  declarado, ajustável/desligável pelo Operador) — exatamente a
  disciplina do §7/§12 da diretriz, nunca um super-score que esconda a
  origem.
- **Pré-requisito — FEITO no mesmo dia, ver §6.9**: escopar
  `TrackedPlan`/`hitRate()` por `symbol:timeframe` em vez de uma fatia
  GLOBAL. O recalibre de `weight-matrix.js` em si continua NÃO
  construído — este item cobria só o pré-requisito.

**Confirmado sem gap real** (mesma auditoria, não precisa de nova
iniciativa): performance/main thread. Os 4 Workers reais (orderflow
heatmap, conviction cyclone, LLM, quant WASM) estão genuinely wired,
WASM cobre Volume Profile/TrustScore como o `CLAUDE.md` documenta, todos
os engines em `research/engines/` operam sobre a janela de candles em
memória (não a história inteira) com custo O(N) ou O(N·k) limitado, o
ciclo do Core Engine só recomputa quando ativo/timeframe/boot realmente
mudam (nunca por re-render não relacionado), e os 6 plugins de overlay
do canvas seguem o padrão dirty-flag+rAF. Nenhuma ação necessária.

### 6.9 Pré-requisito entregue: Track Record real por symbol:timeframe
(mesma diretriz, mesmo dia — resposta ao pedido "evoluir a memória")

**Achado real, mais preciso que o §6.8 original**: não era só "uma fatia
GLOBAL que mistura símbolos" — dois efeitos distintos em `App.tsx`
(`[selectedAsset]` e `[chartTimeframe]`, cada um por um motivo real
documentado no próprio código) chamavam `resetTrackRecord()`, um reset
CEGO que zerava `history`/`targetHits`/`partialHits`/`stopHits`/
`replaced` por inteiro. Na prática: trocar de ativo e voltar (ou só
trocar de timeframe e voltar) apagava o desempenho real já medido
daquela combinação — perda de memória, não só risco de mistura.

**Solução aplicada**: `resetTrackRecord` removido; substituído por
`archiveTrackRecord(key)` — arquiva o agregado atual sob
`symbol:timeframe` (mesma convenção de `candleKey` em
`persistence.ts`, reusada, nunca uma segunda função de chave), fechando
antes um plano ainda ABERTO como `REPLACED` (reusa
`trackPlanTransition(state, null, now)`, a mesma lógica honesta já
usada por toda troca de plano — nunca resolve em ausência, nunca uma
segunda lógica de fechamento). Um efeito PRÓPRIO e dedicado em
`App.tsx`, com `[selectedAsset, chartTimeframe]` como dependência única,
restaura o arquivo real ao entrar numa combinação e arquiva ao sair
(cleanup) — nunca mais um reset cego. O plano ATIVO (rastreamento ao
vivo do que está na tela agora) continua começando do zero em toda
troca, por design — só o AGREGADO histórico (o que realmente importa
para medir desempenho real) sobrevive.

**Escopo desta entrega, deliberadamente limitado**: só a memória DENTRO
da sessão (troca de aba/timeframe). O arquivo inteiro (`Record<string,
TrackRecordState>`) ainda não é persistido em IndexedDB através de um
reload/fechar-o-app — hoje só a combinação ATIVA no momento é salva
(mesmo `saveTrackRecord`/`loadTrackRecord` de sempre, comportamento
inalterado). Persistir o arquivo completo é uma extensão mecânica óbvia
do mesmo padrão já usado para `candles` em `persistence.ts` (nova store
IndexedDB, chave `symbol:timeframe` idêntica) — não uma decisão de
arquitetura nova, só não estava no escopo desta rodada.

Verificação: 4 testes novos de execução real contra a store Zustand de
verdade (`tests/unified-snapshot-store.test.ts`) provam o round-trip
completo (arquivar → trocar para vazio → restaurar → o desempenho real
volta), o fechamento honesto de um plano aberto como `REPLACED`, e a
não-contaminação entre duas chaves distintas — usando `buildTradePlan`
real, nunca um objeto de decisão fabricado à mão.

### 6.10 Diretriz de Evolução Quantitativa e Aprendizado Real — auditoria
da cadeia completa (Fase 1, feita ANTES de qualquer código, como a
diretriz exige) + o que foi honestamente possível evoluir

A diretriz pediu para provar, elo a elo, a cadeia `DADO REAL →
PROVENIÊNCIA → CAPTURA → REPLAY → CONTEXTO → DECISÃO → RESULTADO →
MEMÓRIA → MÉTRICA`, declarando `DADOS_INSUFICIENTES` em qualquer elo não
verificável — nunca assumir que uma métrica é real só porque o código
existe. Auditoria real (código lido, não suposição):

| Elo | Veredito | Evidência real |
|---|---|---|
| DADO REAL | Real, mas nunca buscado nesta sessão | Binance Futures público, sem chave (`js/real-data/binance-futures-public.js`) — a fonte é real e testável, mas o sandbox de CI não tem egress a exchange nenhuma. |
| PROVENIÊNCIA | Real e testada | Evidence Object (`js/real-data/schema.js`) — `fetched_at`/`raw_sample_hash`/`source_id` — o MESMO contrato usado por todo o Real Data Layer, reaproveitado por `history-capture.js`, nunca um campo novo inventado. |
| **CAPTURA** | **QUEBRA AQUI** | `history-capture.js` (Fase 2 do backtest, §6.7) pagina e persiste corretamente — PROVADO só com `fetchPage` injetado (fixture). A captura real EM SI nunca rodou: zero dataset histórico real existe neste repositório, em lugar nenhum, hoje. |
| REPLAY | Real e provado | Walk-forward real (`src/replay/`), zero-lookahead provado por teste (mutar candles futuros nunca muda decisões passadas) — mas só exercido sobre séries FIXTURE (a única coisa que existe), nunca sobre histórico real (porque não existe). |
| CONTEXTO | Real, mas deliberadamente estreito | `structural-backtest.js` usa só `market-structure-engine` + `support-resistance-engine` (candle-only) — nunca teve acesso a Conselho/GMIL/L2/fluxo, que só existem ao vivo. Isto é um limite ESTRUTURAL do laboratório, não um bug: documentado no próprio aviso do contrato desde a Fase 1. |
| DECISÃO | Real, mas é a regra do LABORATÓRIO, não o `NexusDecision` ao vivo | A "regra de medição" de `structural-backtest.js` é deliberadamente mais simples que o pipeline BIAS/SETUP/ENTRY/RISCO/CONFLUÊNCIA real — nunca um segundo motor (LEI 24), nunca finge ser o mesmo contrato. |
| RESULTADO | Real e provado (matemática correta) | Target/stop/empate/não-resolvido + MFE/MAE + (nesta rodada) alvo máximo estrutural — tudo provado por teste sobre fixture. A matemática está certa; só nunca correu sobre dado real. |
| MEMÓRIA | Dois sistemas REAIS, mas DESCONECTADOS entre si | Track Record (§6.9, vivo, agora por symbol:timeframe) é memória do pipeline AO VIVO. O laboratório de backtest não tem memória própria — cada `runStructuralBacktest` é stateless, não alimenta nem é alimentado pelo Track Record. Nenhum dos dois é falso; eles simplesmente nunca foram unificados (nem precisam ser, para os propósitos de cada um). |
| MÉTRICA | Aritmética real, mas **nunca sobre amostra real** | `taxaAlvoAmostra`/`avgMfeR`/`avgMaeR`/`farTargetHitRate` são somas/frações verificáveis — mas todo número que este laboratório já produziu, na história inteira deste repositório, foi sobre séries FIXTURE (versionadas, nunca apresentadas como mercado real). Nenhuma métrica de mercado real jamais foi calculada aqui. |

**Separabilidade** (pedida explicitamente pela diretriz): por **ativo** e
**timeframe** — real, já no `provenance` de `structural-backtest.js`. Por
**direção** (LONG/SHORT) — real, `porDirecao`. Por **exchange/contrato**
— só IMPLÍCITO (`source_id` da Binance Futures, nunca um campo explícito
separado — hoje é a única fonte, então não importa na prática, mas se um
dia MEXC/Bybit/OKX entrarem como histórico próprio, precisaria virar
campo explícito). Por **sessão** e **regime** — NÃO capturado hoje (nem
`history-capture.js` nem `structural-backtest.js` tagueiam trials com
sessão de mercado ou regime de volatilidade). Por **versão do motor** —
NÃO capturado (nenhum trial grava qual versão de `market-structure-engine`/
`support-resistance-engine` o produziu).

**Veredito honesto sobre as Fases 2-5 da diretriz** (que pedem MEDIR
qualidade real de decisões, eixos, pesos e regimes com evidência
histórica): **DADOS_INSUFICIENTES**, declarado exatamente como a própria
diretriz instrui — a cadeia quebra em CAPTURA (nenhum histórico real
existe), então nenhuma conclusão real pode nascer de Fases 2-5 hoje. Isto
NÃO é novidade desta auditoria — é a MESMA limitação documentada desde
§6.7 (Fase 2 do backtest) e reafirmada em §6.8 (pré-requisito da
recalibração de pesos). A Fase 4 especificamente pergunta "o peso atual
tem evidência histórica real?" — a resposta, para TODO peso do sistema
hoje (`weight-matrix.js` e todo o resto), é **PESO DECLARADO, SEM
VALIDAR COMO PROBABILIDADE** — exatamente a categoria que a própria
diretriz nomeia como aceitável até existir evidência.

**O que foi honestamente possível evoluir sem violar isso** (ferramentas
do laboratório, prontas para quando a captura real acontecer — nunca
uma medição fabricada sobre dado que não existe):
- **Alvo máximo estrutural** (`farTarget`/`farTargetHit` em
  `structural-backtest.js`, Fase 2 da diretriz, "TP1/TP2/TP3/alvo máximo
  estrutural") — reaproveita `resistance_2`/`support_2`, dado que
  `support-resistance-engine.js` já calculava mas o laboratório nunca
  lia. Medição PARALELA, nunca reabre nem muda o desfecho primário do
  trial.
- **`compare-runs.js`** (Fase 9, "Autoevolução Controlada") — o
  mecanismo de COMPARAÇÃO explícito que a diretriz pede
  (`MELHOROU`/`PIOROU`/`NEUTRO`/`DADOS_INSUFICIENTES` via
  two-proportion z-test agrupado, método estatístico padrão). Já
  totalmente funcional HOJE sobre qualquer par de execuções (fixture ou
  real) — não precisa esperar a captura real para EXISTIR como
  ferramenta, só precisa dela para que o resultado descreva mercado real
  em vez de uma série de teste. Amostra abaixo do mínimo declarado
  (`MIN_RESOLVED_PER_GROUP=20` por grupo) ou variância nula ⇒ sempre
  `DADOS_INSUFICIENTES`, nunca um veredito fabricado.

**O que continua deliberadamente NÃO construído** (Fase 6 da diretriz,
"Memória de Aprendizado" — events/contexto/resultado/aprendizado,
versionada, histórico original imutável): avaliado e adiado nesta
rodada. Construir esse schema AGORA, vazio e sem nenhum aprendizado real
para popular (já que a captura nunca aconteceu), correria o risco de
parecer uma funcionalidade pronta quando na verdade não há nada real
para ela guardar ainda — melhor esperar a Fase 2 real (captura) para
desenhar essa memória sabendo exatamente a forma do dado que vai
alimentá-la, em vez de adivinhar o schema agora e ter que migrar depois.

---

### 6.11 Diretriz Restauração/Inteligência Visual — auditoria de
regressão do gráfico (suspeita concreta do Operador) + reabilitação
profissional (nunca reversão)

A diretriz partiu de uma suspeita concreta do Operador: um elemento que
"lembrava um T ou símbolo matemático", junto com outras marcações
estruturais/de projeção, teria desaparecido do gráfico. A regra pedida:
auditar antes de assumir qualquer coisa (nem que sumiu por engano, nem
que a remoção foi sempre correta), classificar cada elemento
(CALCULADO E VISÍVEL / OCULTO / SUPRIMIDO POR VALIDADE / DESCONECTADO /
REMOVIDO / SUBSTITUÍDO / DADOS_INSUFICIENTES) e só então decidir.

**Auditoria (dois agentes de exploração em paralelo — inventário do
código atual + mineração real de `git log --full-history`)**:

- **O elemento "T"/símbolo matemático identificado com evidência real**:
  rótulos de eixo **"TREND"**, **"TREND +2σ"**, **"TREND -2σ"** (Trend
  Channel/Linear Regression Channel, `nexus/trend-channel-engine.ts`) —
  adicionados no commit `887a93e` (2026-07-19) e removidos no commit
  `8fc1879` (2026-07-20, **mesmo dia**, nesta mesma sessão) por poluírem
  o eixo de preço já disputado por R1/NL/EMA/VWAP — a própria remoção
  foi motivada por uma captura de tela real enviada pelo Operador
  (ver §9 "Achados da captura real"). Classificação honesta: **CALCULADO
  E OCULTO POR DECISÃO EXPLÍCITA VÁLIDA** — as 3 linhas do canal (a
  geometria/cor slate) continuaram desenhadas o tempo todo; só o texto
  identificador sumiu. A remoção em si foi correta (o eixo estava real e
  visivelmente poluído); o que faltava, pela própria regra desta
  diretriz ("se a informação antiga era útil, reabilitar de forma mais
  profissional"), era encontrar OUTRO destino visual para essa
  identidade — não reverter a correção.
- **Todo o resto do checklist da diretriz** (S/R, Order Blocks, FVGs,
  zonas de liquidez, alvos/stop/entrada, Nexus Line, VWAP, Volume
  Profile, CVD, fractais, harmônicos XABCD, Fibonacci, Scenario Path
  A/B): **CALCULADO E VISÍVEL** — nenhum plugin de `chart/` ficou órfão
  (os 6 plugins de canvas + EMA/Trend Channel nativos estão todos
  montados); nenhum engine graduado (`QUARANTINE.md`) ficou sem
  consumidor real de UI. Nenhuma segunda remoção real foi encontrada além
  do caso do Trend Channel — confirmado por mineração completa do
  histórico (arquivos deletados em `chart/`/`nexus/`: zero, em toda a
  história do repositório; a reescrita SVG→lightweight-charts de
  2026-07-10 não perdeu nada porque nenhum desses indicadores existia
  ainda naquele SVG antigo).
- **Simetria LONG/SHORT** (`operational-readability.ts`): já 100% real e
  simétrica — `SHORT_BIAS`/`SHORT_SETUP`/`WAITING_FOR_RETEST`/
  `WAITING_FOR_CONFIRMATION`/`ENTRY_CONFIRMED` existem, com a mesma
  grafia pedida pela diretriz, derivados por geometria pura (nunca
  favorecendo um lado). Nada a construir aqui — já cobria o pedido.

**O que foi reabilitado/evoluído nesta rodada** (aditivo, matemática
existente intacta):

1. **Legenda do Trend Channel restaurada SEM voltar ao eixo poluído**
   (`EnhancedChart_110_Percent.tsx`): um `<div>` HTML solto no canto
   superior esquerdo — nunca o `title` de série/price-line que causou a
   poluição original (mesmo elemento nativo da lib, mesma causa) —
   mostrando `TREND · OLS {janela real} · ±{multiplicador real}σ
   · {direção real}` (ASCENDING/DESCENDING/FLAT). Só aparece com leitura
   real (`computeTrendChannel` não-nula) E a camada `trend_channel`
   visível — fail-closed, nunca um valor inventado. `pointer-events-none`:
   nunca captura um gesto de pan/zoom.
2. **Obstáculos estruturais destacados no próprio gráfico**
   (`trade-plan.ts`, `LiquidityZonesPlugin.tsx`, `App.tsx`) — achado
   real de auditoria: `targets[i].obstacleCount` (Omega Core rodada 2,
   §6.1) já contava as zonas reais no caminho entrada→alvo, mas o
   gráfico nunca sabia QUAIS zonas eram essas para destacá-las. Extraída
   a contagem para `obstacleZonesInPath` (exportada, reaproveitada pela
   própria contagem — zero cálculo duplicado); `App.tsx` cruza os
   MESMOS `tradePlanStructureZones` que já alimentam a store contra
   TODOS os alvos do plano ativo. O plugin colore a borda dessas zonas
   com o MESMO tom (só mais opaco) e adiciona "⚠" ao rótulo — nunca uma
   cor nova, nunca tira a identidade BULLISH/BEARISH já pedida
   explicitamente pelo Operador em uma rodada anterior. Sem plano ativo,
   zero mudança visual (fail-closed).
3. **Projeção do Motor de Cenários agora visualmente distinta de
   estrutura confirmada** (`EnhancedChart_110_Percent.tsx`) — a Fase 3
   da diretriz pede explicitamente "a projeção deve ser visualmente
   diferente daquilo que já foi confirmado". A correção inicial (prefixo
   textual "PROJEÇÃO" no `title`) foi **verificada com um harness
   Playwright isolado real** (candles sintéticos, nunca no fluxo de
   mercado real — descartado antes do commit) e provou-se **inerte**: a
   lib nunca mostra o `title` de uma price line com `axisLabelVisible:
   false` sem uma UI de hover/legenda que este gráfico não tem — a cor
   era o ÚNICO sinal que o operador realmente vê, e Scenario usava a
   MESMA cor verde/vermelho de um nível LONG/SHORT já confirmado,
   tornando a projeção indistinguível de fato a olho nu. Corrigido com
   uma cor lavanda dedicada (nunca compartilhada com nenhum outro
   overlay), mantendo Regra de Ouro 5 (fio de seda, 1px sólida — nunca
   tracejada) intacta; direção continua legível pela posição real
   (acima/abaixo do preço), mesma leitura que Fibonacci/S1/R1 já pedem.

**Verificação visual real** (não só teste de padrão de código): harness
Playwright isolado com candles/zonas/plano/cenário sintéticos, screenshot
antes/depois de cada mudança, confirmando visualmente as 3 evoluções
acima (legenda legível sem sobrepor nada, borda de obstáculo claramente
mais vívida que uma zona normal, linha de projeção claramente lavanda
vs. as linhas verdes/vermelhas reais) — harness e scripts descartados
antes do commit, nenhum arquivo temporário entrou no repositório.

**Achados honestos que ficam para uma rodada dedicada** (documentados,
não esquecidos — nenhum é o "T" que motivou a diretriz, mas surgiram na
mesma auditoria):
- 9 elementos nativos do gráfico (VWAP, Nexus Line, CVD, Fibonacci,
  Scenario A/B, Premium/Discount, harmônico XABCD, S1/R1, liquidez
  EQH/EQL) não têm toggle individual no painel Camadas do Gráfico — só
  os 8 `CHART_LAYER_IDS` têm. Nunca ficam ocultos por engano (sempre
  visíveis com dado real), mas o Operador não pode escondê-los
  individualmente hoje.
- O `TypedEventBus` do Nexus Core (`organism-orchestrator.ts`) emite 12
  tipos de evento (`UI.SYMBOL_CHANGED`, `BRAIN.SCENARIO.UPDATED`, etc.)
  + `HEALTH.CHANGED` — nenhum tem assinante em lugar nenhum do código; a
  UI real lê a store direto via os hooks atômicos. Infraestrutura
  paralela que não quebra nada hoje, mas publica no vazio.
- `unmitigatedFvgs`/`unmitigatedBlocks` (o que o gráfico DESENHA) usam
  `.slice(0, 3)`; `tradePlanStructureZones` (o que `obstacleCount`
  CONTA) não tem esse teto — um plano pode honestamente reportar um
  obstáculo que não está entre as 3 zonas desenhadas daquele tipo
  (destaque silenciosamente não aparece nesse caso raro, nunca um erro,
  mas vale reconciliar os dois limites numa rodada dedicada).
- Só o harmônico de melhor `fitScore` é desenhado; os demais candidatos
  calculados por `detectHarmonicPatterns` ficam na store sem consumidor
  visual — escolha deliberada de rodadas anteriores (evitar poluição),
  não revisada nesta auditoria.

**Verificação**: `tsc --noEmit` limpo; `vitest run` 101 arquivos/1564
testes; `npm run build` ok (hash de bundle mudou — esperado, primeira
rodada desde #12 a tocar código de produção real do gráfico, não só
laboratório); grep mecânico confirma as 3 evoluções presentes no bundle
de produção; harness Playwright isolado confirma visualmente, descartado
antes do commit.

---

### 6.12 Diretriz Suprema de Evolução Integrativa — auditoria total
(Fase 1-2) + evolução escopada (Fase 3-5) + relatório honesto (Fase 8)

Diretriz de 17 seções cobrindo o ecossistema inteiro (dados→snapshot→
memória→indicadores→estrutura→confluência→BIAS→SETUP→ENTRY→risco→
cenários→trade plan→projeção→readability→gráfico→track record→
aprendizado→recalibração), com ordem explícita de execução (Auditar →
Mapear → Reabilitar → Evoluir → Adicionar → Integrar → Validar →
Reportar). Dois agentes de auditoria em paralelo responderam perguntas
factuais específicas antes de qualquer código — resultado abaixo,
seguindo a mesma estrutura de relatório que a diretriz pede.

**O QUE JÁ EXISTIA (confirmado, nada a construir)**:
- Camada "OPERATION" (§3 da diretriz): `NexusOperationalState` já existe
  em `decision-layer.ts` — `OBSERVANDO`/`PREPARANDO`/`CONFIRMANDO`/
  `EXECUTAVEL`/`GERENCIANDO`/`ENCERRADO`, já em produção (subtítulo do
  badge de header). Nomes literais diferem um pouco dos exemplos da
  diretriz (`PREPARANDO` vs `PREPARANDO_ENTRADA`), mas os 6 conceitos
  batem 1:1. `NexusRiskState`/`NexusConfluenceState`
  (`operational-readability.ts`) também já existem — respondem "qual é o
  risco?"/"qual é a confluência?" (item 16 da diretriz) sem nada novo.
- Simetria LONG/SHORT em BIAS/SETUP/ENTRY: já auditada e confirmada real
  em §6.11.
- Liquidações "exchange-wide": auditado como suspeita de staleness, mas
  o próprio label ("Forced Liquidations · Binance Futures... Exchange-
  wide, not BTC-only") já se declara honestamente como feed de mercado
  inteiro — não é um bug, é o desenho original.

**O QUE ESTAVA OCULTO (achado real, corrigido nesta rodada)**:
- Funding rate, Open Interest e os dois cross-exchange checks (Binance×
  Bybit, Binance×OKX) NÃO eram resetados ao trocar de ativo — mostravam
  o valor do ativo ANTERIOR por até 8s reais (pior caso do retry de
  `fetchDerivatives`) enquanto preço/candles/order book já mostravam o
  novo. `App.tsx`, efeito `[selectedAsset]`.

**O QUE FOI REABILITADO**: nada nesta rodada específica — a Fase 1
(auditoria) já tinha reabilitado o Trend Channel/obstáculos/projeção em
§6.11; esta rodada não achou nenhuma segunda regressão real além da já
corrigida.

**O QUE FOI EVOLUÍDO**:
1. **Staleness de funding/OI/cross-exchange** corrigida — mesmos valores
   iniciais dos `useState`, nunca um sentinel novo inventado (o mesmo
   "carregando" honesto que o primeiro boot já usa).
2. **Motor de Cenários v2 — "Future Path Map" (§5/§6 da diretriz)**:
   achado real de auditoria — `scenario-engine.ts` só tinha UM alvo por
   caminho (Path A/B), sem ladder (TP1/TP2/TP3) e sem invalidação
   explícita; busca completa no repositório (código, testes, docs,
   QUARANTINE.md) confirmou zero implementação parcial em qualquer outro
   lugar. Evoluído para até `MAX_SCENARIO_TARGETS=3` níveis reais por
   caminho (mesma convenção de `MAX_TARGETS` em `trade-plan.ts`) mais
   `invalidation`. A invalidação é **matematicamente sempre igual ao
   alvo mais próximo do caminho OPOSTO** (zero cálculo novo: o próximo
   nível real abaixo, que já é o alvo do Path SHORT, é a mesma leitura
   estrutural de "onde a tese do Path LONG perde a estrutura que a
   sustentava") — por isso o gráfico deliberadamente NÃO desenha uma
   price line própria para invalidação: seria uma segunda linha no MESMO
   preço já real na tela, a "linha fantasma" redundante que a diretriz
   proíbe (item 7/15). A informação continua real e auditável (contrato
   + `formatScenarioPathLabel`, "· inv NNNN" nos painéis de texto).
   `SCENARIO_CONTRACT_VERSION` 1→2. Alvos extras desenham mais apagados
   por rank (`TARGET_ALPHA_FALLOFF = [1, 0.65, 0.4]`) — nunca todos com o
   mesmo peso visual. Achado colateral: `App.tsx` tinha a MESMA lógica de
   formatação de texto duplicada em 2 pontos (painel "Scenario Paths" e
   `CouncilWidget`) — unificada em `formatScenarioPathLabel`, exportada
   do próprio motor.

**O QUE FOI ADICIONADO**:
- **"Modo Inteligência"** (§8 da diretriz): 3º preset do painel Camadas
  do Gráfico — achado real de auditoria: só existiam 2 (Operacional/
  Auditoria). Definido como o COMPLEMENTO do Operacional: todas as
  camadas de leitura estrutural/contexto (FVG/OB, BOS/CHOCH, heatmap de
  liquidez, volume profile, EMA, trend channel) SEM as duas que só fazem
  sentido com um plano ATIVO (trade_plan_zone/neural_market_aura) — mesmo
  mecanismo aditivo, nenhum cálculo novo, nenhuma camada nova.

**O QUE FOI RECUSADO e POR QUÊ**:
- **"Evolution Engine" formal e persistido** (§13 da diretriz —
  observar→identificar→medir→detectar→propor→testar→validar→promover com
  rollback): auditoria confirma que só existe `compare-runs.js`
  (comparação pura, sem persistência) e `src/replay/` (walk-forward,
  explicitamente sem estado persistido) — nenhum ledger versionado em
  lugar nenhum do repositório. Já avaliado e deliberadamente adiado em
  §6.10 (Fase 6 da diretriz anterior); reafirmado aqui pela mesma razão:
  desenhar um ledger vazio antes de a Fase 2 real (captura de histórico)
  existir arrisca migrar depois. Recusa mantida, não uma nova.
- **Recalibração de memória/aprendizado por regime/setup** (§9/§10 da
  diretriz — "o sistema deve aprender quais combinações funcionam
  melhor"): continua `DADOS_INSUFICIENTES` pela mesma razão já
  documentada em §6.10 — a cadeia quebra em CAPTURA, nenhum histórico
  real existe para aprender nada com evidência auditável. A própria
  diretriz pede isso ("só mostrar taxa de acerto quando houver amostra
  real auditável suficiente") — a recusa é literalmente seguir a regra
  que ela mesma escreveu.
- **Pesquisa externa profunda (§12)**: nenhuma técnica nomeada específica
  foi identificada como faltante durante esta auditoria que justificasse
  pesquisa externa dedicada — a diretriz também não pede pesquisa cega,
  só quando "houver ambiente de pesquisa autorizado" para uma lacuna
  concreta já identificada.
- **9 elementos do gráfico sem toggle individual** e o teto `.slice(0,3)`
  do desenho vs. contagem sem teto do `obstacleCount`: já documentados em
  §6.11 como pendências honestas para rodada dedicada — não revisados de
  novo aqui (auditados uma vez, não precisam de segunda auditoria sem
  novo dado).

**TESTES**: 32 novos/atualizados (staleness: 3 fixture; Scenario Engine
v2: 15 execução real, reescrito por completo para o novo contrato +
`formatScenarioPathLabel`; chart wiring: ladder/invalidation/preset,
source-pattern). Todos os consumidores de `ScenarioProjection` migrados
— `tsc --noEmit` limpo confirma que nenhum acesso a `.target` (removido)
sobrou em lugar nenhum do código (a mudança de tipo teria quebrado a
build se algum consumidor tivesse escapado da migração).

**BUILD**: `npm run build` ok, hash de bundle mudou (esperado — produção
real tocada de novo). Grep mecânico confirma `TARGET_ALPHA_FALLOFF`/
"Modo Inteligência"/`CHART_LAYERS_INTELLIGENCE_PRESET`/
`formatScenarioPathLabel` presentes no bundle de produção.

**PERFORMANCE**: nenhuma mudança de complexidade — o Motor de Cenários
já iterava os níveis reais para achar o mais próximo (`O(n log n)` do
sort); agora fatia até 3 do mesmo array já ordenado (`O(1)` adicional).
Zero novo timer/polling/loop.

**LIMITAÇÕES REAIS**: a Fase 2 real do backtest (captura de histórico)
continua não executada neste sandbox (zero egress de rede a exchange) —
todo aprendizado/recalibração real permanece `DADOS_INSUFICIENTES` até
isso mudar, independente de quantas rodadas de evolução visual/estrutural
aconteçam em cima do que já existe.

**PRÓXIMO PASSO**: decisão do Operador sobre superfície de UI + execução
real da captura (mesmo próximo passo de §6.10/§6.11 — continua sendo o
único bloqueio real para todo o eixo de aprendizado da diretriz).

**Verificação**: `tsc --noEmit` limpo; `vitest run` 101 arquivos/1576
testes; `npm run build` ok (hash de bundle mudou); grep mecânico confirma
as evoluções desta rodada no bundle; harness Playwright isolado confirma
visualmente o ladder de cenários (3 linhas, opacidade decrescente por
rank), descartado antes do commit.

---

## 7. Conciliação matemática — papel explícito de cada fonte (A-E)

Nenhum indicador existe "porque existe" (Evolução Integrativa §5). Papel
de cada fonte real no pipeline:

| Papel | Fontes reais |
|---|---|
| A. DIREÇÃO | Core Engine (único emissor LONG/SHORT/WAIT) · EMA (ema.ts) · estado VWAP · estado Nexus Line · Matriz Multi-Timeframe · Lorentzian k-NN · tendência do Score (Conviction) · Trend Channel (inclinação) |
| B. ESTRUTURA | fractal-swings (detecção única compartilhada) · S/R com força · HH/HL/LH/LL (market-structure) · FVG/OB (SMC) · BOS/CHOCH · harmônicos XABCD/Wolfe (PRZ/EPA) · Premium/Discount · Volume Profile (POC/HVN) · Fibonacci Confluence |
| C. TIMING | inEntryZone (histerese real) · operationalState · eixo ENTRY · rompimentos BOS/CHOCH · tendência de order flow (momentum) |
| D. RISCO | stop real do plano · R:R vs piso declarado 1:2 · Heat Score (tier) · gates DIRECTION_CONFLICT/RISK_GATED · Risk Engine (sizing sugerido, fail-closed) · invalidação/track record |
| E. CONTEXTO | funding · open interest · liquidações · cross-exchange Δ (Bybit/OKX) · GMIL (consenso global) · sessão de mercado · CVD/order flow · votos do Conselho |

Redundância deliberada e documentada: VWAP e Nexus Line medem equilíbrio
por métodos distintos (preço médio ponderado vs equilíbrio estrutural) —
convergência entre eles é informação real, não dupla contagem.

## 8. Fontes externas — avaliação pelos 9 critérios (§7 da Evolução Integrativa)

Critérios: confiabilidade · latência · custo · histórico · replay ·
qualidade · risco de duplicação · READ_ONLY · FAIL_CLOSED.

| Fonte | Estado | Avaliação resumida |
|---|---|---|
| Funding / Open Interest / Liquidações | **JÁ INTEGRADAS** | Binance Futures público; freshness verificável; fail-closed em toda parte. |
| Cross-Exchange (Bybit/OKX Δ) | **JÁ INTEGRADA** (cross-check advisory) | Cutover do serviço dedicado permanece adiado (§6.4). |
| Notícias cripto/macro · Sentimento | Avaliadas, NÃO integradas | Fontes gratuitas: confiabilidade/qualidade baixas e sem replay honesto (sem histórico armazenável determinístico); pagas: custo sem ganho demonstrado. Falham nos critérios 1, 5 e 6. |
| On-chain · Dominância · Stablecoins · Correlação | Avaliadas, NÃO integradas | Compatíveis com READ_ONLY, mas sem caminho de replay/walk-forward no repositório hoje (critério 5) e com risco real de duplicação com o contexto já coberto por GMIL (critério 7). |
| Calendário econômico | Avaliada, NÃO integrada | Dado de baixa frequência; valor real só com curadoria — reavaliar se o Operador pedir contexto macro explícito. |
| Fluxo institucional dedicado | Avaliada, NÃO integrada | Fontes confiáveis são pagas/licenciadas; proxies gratuitos falham no critério 1. |

Regra aplicada (§7): mais dados somente se produzirem melhor contexto —
nenhuma integração nova nesta fase.

---

*Manutenção: atualizar as seções 2-4 e 7-8 quando a arquitetura mudar
(mesma disciplina da seção Arquitetura do `CLAUDE.md`); a seção 6 só
cresce — uma pendência nova entra com destino declarado, nunca fica vaga.*
