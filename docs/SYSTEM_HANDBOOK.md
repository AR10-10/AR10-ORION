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

- `npx tsc --noEmit` + `npx vitest run` (100+ arquivos, 1530+ testes) +
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
