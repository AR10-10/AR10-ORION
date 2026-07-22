# SYSTEM_HANDBOOK — AR10 CYBORG

Documento central de organização do sistema, escrito sob ordem explícita
do Operador ("executa todas as etapas pendentes e organiza tudo").
Registra o estado REAL atual: o pipeline canônico de decisão, onde cada
peça vive, como se verifica, e — a parte mais importante — o destino
honesto de cada pendência histórica (fechada, coberta, ou adiada de
propósito com a razão registrada). As regras permanentes vivem em
`CLAUDE.md` (raiz) e não são repetidas aqui; este documento é o mapa,
não a lei.

Data de referência: 2026-07-21 · Branch: `claude/eloquent-cannon-qyt86y` · PR #13.

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
| Histerese do stance do Council (ENTER) | 0.12 | `nexus/council.ts` | Margem mínima do pool (Stone/DeGroot) pra reivindicar um lado NUNCA ocupado. EPC §5/§6 — corrige o flicker LONG↔NEUTRAL a cada tick de preço. |
| Histerese do stance do Council (EXIT) | 0.04 | `nexus/council.ts` | Margem mínima pra MANTER um lado JÁ ocupado; abaixo disso solta pra NEUTRAL. Nunca herda entre lados opostos. |

## 5. Como se verifica (infraestrutura real)

- `npx tsc --noEmit` + `npx vitest run` (105 arquivos, 1765 testes) +
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

### 6.13 Colisão de rótulos no eixo de preço — achado real de captura de
tela do Operador (BTC/USDT 1H perto de R1) + PriceLabelStackPlugin

O Operador enviou uma captura de tela real do terminal ao vivo (BTC/USDT
1H, preço formando perto de R1) pedindo para "organizar tudo" e garantir
que "nenhum objeto fique em cima do outro" — cada rótulo "exato no lugar
preciso", "bem elite". A imagem mostrava R1/VWAP/NL/último preço
literalmente empilhados/ilegíveis no canto superior direito do eixo de
preço.

**Causa raiz real**: os rótulos de S1/R1/VWAP/NL/EMA/último preço eram
"last value label"/"axis label" NATIVOS da lightweight-charts — cada
série/price line desenha o próprio rótulo de forma totalmente
independente, sem NENHUMA consciência da posição das outras. Quando os
valores reais ficam próximos (o caso normal sempre que o preço se
aproxima de um nível estrutural relevante — exatamente quando o operador
mais precisa ler os dois com clareza), os rótulos colidem. Confirmado por
leitura da documentação da lib e observação real via harness Playwright:
não existe nenhum mecanismo nativo de anti-colisão para isso.

**Solução aplicada** (aditivo — nenhum preço/linha muda, só o dono do
rótulo de eixo):
1. **`price-label-stack.ts`** (função pura, testada por execução real):
   `resolveLabelStackPositions` recebe as posições Y NATURAIS (já
   convertidas de preço→pixel pela própria lib) de todos os rótulos,
   agrupa as que colidem (mais perto que um gap mínimo declarado) e
   redistribui cada grupo CENTRADO na média das posições naturais do
   grupo — nunca desloca uma entrada que não colide, nunca desloca mais
   que o necessário, e uma segunda passada de segurança garante a
   invariante absoluta ("nenhum par fica a menos do gap mínimo") mesmo
   no caso raro de dois grupos vizinhos colidirem depois de centralizados.
2. **`PriceLabelStackPlugin.tsx`** (overlay de canvas, mesma arquitetura
   de todo o resto do gráfico — canvas próprio, dirty-flag+rAF,
   ResizeObserver): desenha os rótulos resolvidos como caixas coloridas
   (MESMA cor real já usada por cada linha/série — nunca uma cor nova) +
   um CONECTOR fino (Fio de Seda: 1px sólido, nunca tracejado) de volta
   ao preço real sempre que o rótulo precisou deslocar — a informação
   nunca desaparece, só reorganiza.
3. Os "last value label"/"axis label" nativos de S1/R1/VWAP/NL/EMA/
   candle são desligados (`lastValueVisible`/`axisLabelVisible: false`)
   — as LINHAS/séries continuam exatamente as mesmas, só o rótulo de
   eixo muda de dono. Trade Plan (ENTRY/STOP/TARGET) foi deliberadamente
   **não tocado** — já tem seu próprio mecanismo de compactação
   (`label-compaction.ts`, baseado em formato de texto, não posição) e
   não aparecia na captura de tela real (nenhum plano ativo no momento).

**Achado real durante a verificação visual** (harness Playwright isolado,
não um passo pulado): a primeira versão usava o mesmo valor para a
altura da caixa E o gap mínimo do resolvedor — matematicamente correto
(zero sobreposição), mas duas etiquetas colidindo ficavam exatamente
ENCOSTADAS (gap zero), o que lia como "uma coisa só" visualmente mesmo
sem sobreposição real de pixels. Corrigido com um gap mínimo maior que a
altura da caixa (`MIN_GAP_PX = LABEL_HEIGHT_PX + 4`) — uma fresta real e
visível, não só uma garantia matemática. Um segundo achado real: as
cores reaproveitadas das linhas são translúcidas de propósito (para as
LINHAS do gráfico) — usadas direto como fundo de uma CAIXA de rótulo,
deixavam o tick do eixo nativo (ex.: "64800.00") sangrar através. Corrigi
forçando o fundo da caixa a 100% opaco (`opaque()`, descarta só o canal
alfa, nunca decide uma cor nova) — o conector fino continua com a
opacidade real da linha, que faz sentido para uma linha auxiliar fina,
nunca para o texto principal do rótulo.

**Verificação**: 10 testes de execução real do resolvedor (incluindo o
formato exato do cluster da captura de tela: 4 níveis próximos + 1 nível
bem distante que nunca deveria deslocar) + 28 testes de padrão de código
da fiação do plugin/composer. Ground-truth via `console.log` temporário
no draw loop (removido antes do commit) confirmou os limites exatos de
cada caixa resolvida no cenário real de teste — nenhum par a menos de
`MIN_GAP_PX` um do outro, prova empírica além da prova matemática.
`tsc --noEmit` limpo · **103 arquivos/1614 testes** · `npm run build` ok
(hash de bundle mudou) · grep por string literal (`#050810`, cor de
texto exclusiva deste plugin) confirma presença no bundle de produção
(grep por nome de identificador não serve — minificação renomeia).

---

### 6.14 Diretriz de Refinamento Visual — cabeçalho, Trend Channel na
lateral do eixo, e dois achados reais de captura de tela (z-index nativo
da lib + title nativo poluindo VWAP/NL/EMA)

Diretriz do Operador em duas partes: (A) auditar o cabeçalho superior
("muito carregado", "elementos competindo pelo mesmo espaço") e corrigir
via layout/responsividade — nunca removendo informação; (B) tirar a
legenda do Trend Channel do canto superior esquerdo do gráfico (onde a
correção anterior, §6.11/6.13, a tinha deixado como um `<div>` solto) e
integrá-la à mesma linguagem visual do eixo de preço (R1/NL/VWAP/EMA/S1),
com posicionamento anti-colisão real — a diretriz descreve, quase
literal, o próprio `PriceLabelStackPlugin` do §6.13.

**Parte A — cabeçalho: auditoria primeiro, "não fazer faxina cega"**
(exigência explícita da própria diretriz). `scripts/audit-header-
maxcontent.mjs` (11 viewports, conteúdo de pior caso real: preço longo,
badge "LONG", subtítulo "DADOS_INSUFICIENTES · AGUARDANDO ENTRADA",
"ELEVADO — Heat EXTREMO · R:R do TP1 abaixo do piso 1:2" no painel de
risco, etc.) rodou **CLEAN nos 11 viewports** antes de qualquer mudança —
confirmado de novo, ao final, contra o build já com as mudanças da Parte
B (também CLEAN). Leitura direta de `TopBar` (App.tsx) confirma que o
cabeçalho já usa `min-w-0`, `shrink-0`, `gap` responsivo e `px` por
breakpoint — as técnicas que a diretriz pede. Conclusão honesta: sob
teste real de pior caso já existente e rigoroso, o cabeçalho não tem os
defeitos descritos — nenhuma reescrita foi forçada só para "fazer algo".
Isto não fecha o assunto de forma permanente (nenhuma entrega é a versão
final) — é a leitura honesta de HOJE, com a auditoria automatizada
disponível para qualquer sessão futura reconfirmar.

**Parte B — Trend Channel na lateral**: `trendChannelInfo` ganhou
`midPrice` (a ponta real da linha mid, já computada, zero cálculo novo).
O `<div className="absolute left-2 top-2 ...">` foi removido por inteiro;
em seu lugar, `priceAxisLabels` (mesmo array que já alimenta S1/R1/VWAP/
NL/EMA/último preço) ganhou uma entrada condicional (`visibility.
trend_channel && trendChannelInfo`) com o texto real (`TREND · OLS
{windowSize} · ±{multiplicador}σ · {direção} {midPrice}`) e a MESMA cor
real já usada pela linha mid do canal. Reuso total do sistema do
§6.13 — zero segunda implementação de anti-colisão.

**Achado real #1 (harness Playwright, síntese de candles pós-fix)**: com
o Trend Channel reintegrado, um cluster denso de 7 rótulos (TREND/R1/
preço/VWAP/S1/NL/EMA) expôs um bug de CSS que o §6.13 não tinha pego —
`PriceLabelStackPlugin` estava em `z-index:auto`; a lightweight-charts
desenha seus PRÓPRIOS canvases internos (painel + gutter do eixo) com
`z-index:1`/`z-index:2` explícitos. Por regra do CSS, z-index positivo
SEMPRE pinta por cima de z-index:auto — **não importa a ordem no DOM**.
Resultado real observado: o tick nativo do eixo (ex.: "64800.00",
desenhado pela lib em intervalos redondos, independente de qualquer
série) vazava por cima da caixa opaca de um rótulo nosso sempre que os
dois caíam perto (ex.: R1 real ≈64807 vs. tick nativo 64800.00). Corrigido
com `zIndex: 5` explícito no `<canvas>` do plugin (folga sobre o maior
valor observado da lib, 2). O teste de wiring que já existia (`price-
label-stack-plugin.test.ts`, "é o ÚLTIMO elemento do array de overlays")
só provava ordem de DOM — condição NECESSÁRIA mas, como este achado
provou, NUNCA suficiente sozinha; ganhou um teste irmão que verifica o
z-index explícito.

**Achado real #2 (mesmo harness, zoom no cluster)**: mesmo depois do fix
de z-index, um crop de alta resolução mostrou "EMA 21" fantasma
sobrepondo a caixa de S1. Ground-truth via `console.log` temporário no
draw loop (removido antes do commit, mesma disciplina do §6.13) provou
que os 7 rótulos RESOLVIDOS estavam perfeitamente espaçados (20px exatos
entre todos, `MIN_GAP_PX`) — o "EMA 21" fantasma não vinha do nosso
overlay. Causa raiz: `vwapSeriesRef`/`nexusLineSeriesRef`/`emaSeriesRef`
tinham `title` NÃO-vazio (`"VWAP"`, `"NL •"`, `"EMA"` na criação,
reescrito para `` `VWAP ${glifo}` ``/`` `NL ${glifo}` ``/`` `EMA
${período}` `` a cada mudança de estado/período) — o MESMO achado que já
tinha motivado `title:""` nas 3 séries do Trend Channel no §6.11 (a lib
desenha `title` no eixo mesmo com `lastValueVisible:false`), só que nunca
generalizado para VWAP/NL/EMA na época. O título nativo renderiza na
posição NATURAL da série (sem nenhuma consciência da cascata anti-
colisão) — por isso "flutuava" livre e colidia com qualquer rótulo
resolvido que passasse perto. Corrigido: `title:""` fixo na criação das 3
séries; os 3 efeitos de estado/período (`applyOptions`) pararam de
reescrever `title` — só `color`/dado real muda agora. A identidade
completa (glifo, período, valor) já chegava ao Operador inteira via
`priceAxisLabels`; o título nativo era 100% redundante, nunca a única
fonte.

**Verificação**: `tsc --noEmit` limpo · `npx vitest run` **103
arquivos/1621 testes** (+7 sobre o §6.13: describe reescrito do Trend
Channel na lateral, 2 testes novos de title:"" em VWAP/NL/EMA, 1 teste
novo de z-index explícito) · `npm run build` ok · `audit-header-
maxcontent.mjs` CLEAN nos 11 viewports (antes E depois das mudanças da
Parte B) · harness Playwright isolado (candles sintéticos, nunca no
caminho ao vivo) com `support`/`resistance` propositalmente próximos do
preço real — o mesmo pior caso "vários níveis reais disputando a mesma
faixa vertical" da captura original do Operador (§6.13) — confirmando
visualmente as 7 etiquetas (TREND/R1/preço/VWAP/S1/NL/EMA) legíveis, sem
sobreposição, sem texto fantasma, sem vazamento do eixo nativo, canto
superior esquerdo do gráfico vazio (legenda antiga removida por completo).

---

### 6.15 Rótulo de último preço desatualizado — achado real de captura de
tela do Operador (app ao vivo, header 65,468.00 × eixo 65439.20)

O Operador enviou uma captura de tela real do terminal RODANDO (não um
harness) pedindo auditoria de precisão dos desenhos/cálculos matemáticos
— "a gente sabia a posição dos alvos", "liberdade total pra ajustar...
sem nenhuma falha". A imagem mostrava dois números diferentes
reivindicando "o preço atual" ao mesmo tempo: a barra superior (WS ao
vivo) em `65,468.00`, o rótulo de eixo (§6.13/6.14, sem prefixo) em
`65439.20` — uma diferença real de ~$29 (~0.04%).

**Causa raiz real** (confirmada por leitura de código, não suposição):
`priceAxisLabels` (o rótulo de último preço, sem prefixo) lê
`data[último].close` — o array React de candles. `live-candle-sync.ts`
(`patchLastCandleWithLiveTick`) funde o tick real do WebSocket na vela em
formação, mas **deliberadamente só via `series.update()`** (API nativa da
lightweight-charts para a vela RENDERIZADA) — o próprio arquivo documenta
por quê: "SMC/Fibonacci/Volume Profile são derivações estruturais que não
precisam (nem devem) recomputar a cada tick de preço". Ou seja: a vela
DESENHADA no gráfico já seguia o preço ao vivo; o array `data` (e
qualquer leitura direta dele) ficava até ~30s atrás (o intervalo real do
poll REST, `setInterval(fetchSymbolData, 30000)`). O rótulo de último
preço, construído lendo `data` diretamente, herdou essa mesma defasagem
— uma regressão real introduzida quando o rótulo nativo da lib (que lia
o estado INTERNO da série, sempre live) foi substituído pelo overlay
customizado no §6.13.

**Solução aplicada**: `EnhancedChart_110_Percent` já recebe `livePrice`
como prop (a MESMA fonte `usePriceSnapshot()` que alimenta a barra
superior E o patch da vela). O rótulo de último preço passou a preferir
`livePrice` quando é um número finito, com fallback pro `close` da vela
só quando ainda não existe nenhum tick real (fail-closed, carregamento
inicial) — zero fonte de dado nova, só reconciliar duas leituras que já
existiam e deveriam sempre ter sido a mesma. A cor up/down (verde/
vermelho) passou a comparar esse mesmo valor contra `lastCandle.open`,
por consistência. `livePrice` entrou na dependency array do `useMemo` —
sem isso o rótulo continuaria congelado apesar de ler a variável certa.

**Por que isto não regride a Regra de Ouro 6 (Main Thread sagrada)**:
`priceAxisLabels` é um array de ~7 objetos — recomputá-lo a cada tick
(~335ms, ver `LIVE 335ms` na captura) é ínfimo comparado à recomputação
de VWAP/EMA/SMC que o isolamento do `live-candle-sync.ts` evita de
propósito. `PriceLabelStackPlugin` já throttla o redesenho real via
dirty-flag + `requestAnimationFrame` (§6.13) — o array pode mudar de
referência a cada tick sem gerar mais de um repaint por frame.

**Auditoria do resto da captura** (mesma disciplina "reportar toda
limitação encontrada, mesmo fora do pedido direto"): a ausência de linhas
de ENTRY/STOP/TARGET ou projeção de cenário no gráfico da captura **não é
um bug** — a própria captura mostra "TRADE PLAN — Núcleo LONG, Conselho
neutro"; `buildTradePlan`/`buildScenarioProjection` (App.tsx) usam
`councilFromSnapshot?.stance`, e com o Conselho neutro nenhum dos dois
produz uma estrutura real para desenhar — fail-closed correto, não uma
lacuna visual. As linhas diagonais do Trend Channel e o cluster TREND/R1/
VWAP/S1/NL/EMA na captura foram lidas visualmente como consistentes com
os fixes do §6.14 (nenhuma sobreposição/vazamento óbvio na captura), mas
sem certeza de que a captura já refletia aquele build no momento exato do
envio — o `audit-header-maxcontent.mjs`/harness Playwright deste commit
são a prova real independente disso, não a leitura da captura em si.

**Verificação**: `tsc --noEmit` limpo · `npx vitest run` **103
arquivos/1623 testes** (+2 sobre o §6.14: 1 teste do fix de
`livePrice`/fallback, 1 teste da dependency array) · `npm run build` ok ·
harness Playwright dedicado — última vela sintética com `close` "velho"
(65439.20) + `livePrice` diferente (65468.00, valor real da captura) —
confirma visualmente que o rótulo do eixo passa a mostrar `65468.00`,
nunca mais o valor congelado · `audit-header-maxcontent.mjs` CLEAN nos 11
viewports no build final.

---

### 6.16 Pendências de backlog executadas: 7 toggles novos + reconciliação
de obstáculo, mais dois achados reais (title "XABCD" e etiquetas VWAP/NL/
EMA presas) encontrados durante a verificação

Pedido do Operador: "executa todas as pendências que tiver pra trás" — as
5 pendências honestas do backlog (PR #13). Duas delas seguem bloqueadas
em decisão do Operador (Fase 2 do backtest/superfície de captura;
recalibração de `weight-matrix.js`; ledger versionado aguardando formato
real do dado) — não executáveis sem essa decisão, continuam listadas.
Duas eram acionáveis sem nenhuma decisão pendente:

**Toggles individuais (VWAP/Nexus Line/CVD/Fibonacci/Premium-Discount/
harmônico/EQH-EQL)**: auditoria confirmou que nenhum dos 7 tinha QUALQUER
controle de visibilidade (grep: zero `applyOptions({ visible` para
qualquer um deles). `CHART_LAYER_IDS`/`DEFAULT_CHART_LAYER_VISIBILITY`
crescem de 8 para 15; cada camada ganha o gate real no efeito que já
desenha (VWAP/NL/CVD: `applyOptions({visible})` na série nativa, mesmo
padrão de EMA/Trend Channel; Fibonacci/Premium-Discount/Harmônico/EQH-
EQL: early-return antes de desenhar qualquer price line, mesmo fail-
closed de "sem dado real, zero linhas" já usado nesses efeitos). Painel
(`CHART_LAYER_PANEL_MODULES`) e Modo Inteligência
(`CHART_LAYERS_INTELLIGENCE_PRESET`) ganham as 7 entradas — todas leitura
de mercado/estrutura, nenhuma específica do plano ativo, mesma lógica já
documentada para as 6 camadas anteriores do preset; Modo Operacional
deliberadamente NÃO ganha nenhuma (fica enxuto de propósito, como já era).

**Achado real #1 (harness Playwright, comparação de 2 instâncias lado a
lado — mesmos dados, só `layerVisibility` diferente)**: a polilinha
harmônica (XABCD/Wolfe) tinha `title: "XABCD"` — MESMA classe de bug do
Trend Channel/VWAP/NL/EMA (§6.14/6.15): a lib desenha `title` no eixo
mesmo com `lastValueVisible:false`. O comentário original já argumentava
que o rótulo seria redundante com o title da PRZ — `title:""` corrige
sem perder nenhuma informação real.

**Achado real #2 (mesmo harness, achado só depois de comparar as DUAS
instâncias — uma só screenshot não teria pego)**: esconder VWAP/Nexus
Line/EMA no painel escondia a SÉRIE (linha do gráfico) via
`applyOptions({visible:false})`, mas a ETIQUETA do eixo
(`priceAxisLabels`/`PriceLabelStackPlugin`) nunca checava o mesmo
`visibility` — a caixa "VWAP • 63951.81"/"NL • .../"EMA 21 ..." continuava
aparecendo como se a camada estivesse ligada. Ground-truth via
`console.log` temporário (removido antes do commit) confirmou que os 4
efeitos de price-line (EQH/EQL/Fibonacci/Premium-Discount/Harmônico)
respeitavam `visibility` corretamente desde o início (early-return real,
zero linha desenhada) — o gap era específico das 3 entradas de
`priceAxisLabels` que também tinham um toggle dedicado (VWAP/NL/EMA).
Corrigido: as 3 entradas agora checam `visibility.vwap`/
`visibility.nexus_line`/`visibility.ema` antes de empurrar a etiqueta —
mesma condição que já escondia a série.

**Reconciliação de obstacleCount (achado real do próprio backlog,
confirmado por auditoria de código)**: `unmitigatedFvgs`/
`unmitigatedBlocks` (App.tsx, alimentam o desenho de zonas FVG/OB no
gráfico) cortavam em `.slice(0,3)` por decluttering visual — mas
`chartObstacleZones` (mesmo arquivo, alimenta `obstacleCount` no texto do
alvo E o destaque `⚠` do `LiquidityZonesPlugin`) usa o conjunto COMPLETO,
sem teto algum. Resultado real possível: um obstáculo genuíno do plano
ativo citado no texto ("TP2 · obstáculo x2") sem NUNCA aparecer
desenhado/destacado no gráfico, porque caiu fora dos 3 mais recentes — a
informação existia, mas ficava invisível pro Operador conferir onde ela
está. Corrigido: `unmitigatedFvgs`/`unmitigatedBlocks` agora incluem os 3
mais recentes MAIS qualquer zona que seja um obstáculo real do plano
ativo (união via `isRealObstacle`, casado por low/high real — mesma
identidade que `LiquidityZonesPlugin` já usa internamente). Sem plano
ativo, `chartObstacleZones` já é `[]` (fail-closed existente) — a união é
um no-op, comportamento idêntico ao `.slice(0,3)` de sempre.

**Pendência honesta identificada, NÃO executada nesta rodada** (pedido do
Operador incluía "bateu o olho a gente sabe se a entrada é longa ou
saída" — clareza de leitura imediata de ENTRY/STOP/TARGET): auditoria de
`label-compaction.ts` confirmou que `shouldCompactLabels` só decide o
FORMATO do texto (compacto vs. completo) — nunca reposiciona nada
verticalmente. As linhas de Trade Plan (ENTRY/STOP/TARGET) continuam
`axisLabelVisible:true`, o sistema NATIVO da lib, nunca migradas para
`PriceLabelStackPlugin` (decisão deliberada do §6.13: "fora do escopo
real da captura de tela" daquele momento, que não mostrava um plano
ativo). Isso significa que ENTRY/STOP/TARGET1-3 (até 5 níveis) ainda
podem colidir visualmente entre si quando ficam numericamente próximos —
exatamente a classe de bug que motivou o `PriceLabelStackPlugin` em
primeiro lugar, só que nunca fechada para esta camada. Não corrigida
agora porque é uma migração real e mais arriscada que as duas de cima
(Trade Plan muda de cor/título a cada tick via `targetsHit`/ratchet de
stop/break-even — precisa de sua própria verificação isolada e cuidadosa,
não uma mudança apressada junto de outras 4 correções no mesmo commit).
Registrado aqui como o próximo passo honesto mais concreto.

**Verificação**: `tsc --noEmit` limpo · `npx vitest run` **103
arquivos/1639 testes** (era 1623; +16: 9 de wiring dos 7 toggles + 2 de
reconciliação de obstáculo + 2 do fix de title "XABCD" + 3 do fix de
etiquetas VWAP/NL/EMA presas) · `npm run build` ok · grep por string
literal confirma `"PREMIUM / DISCOUNT"`/`"EQH / EQL"`/`"NEXUS LINE"`/
`"HARMÔNICOS"` no bundle de produção · `audit-header-maxcontent.mjs`
CLEAN nos 11 viewports no build final · harness Playwright com 2
instâncias do gráfico lado a lado (mesmos dados reais, só
`layerVisibility` diferente) confirma visualmente os 7 toggles
funcionando ponta a ponta — série E etiqueta desaparecem juntas.

---

### 6.17 Rótulos do Trade Plan (ENTRY/STOP/TARGET) migrados para o sistema
anti-colisão — o ÚLTIMO grupo que ainda podia sobrepor a visão

Pedido do Operador: "bater o olho a gente sabe se a entrada é longa ou
saída... nada fica cobrindo e atrapalhando a visão". Esta era a pendência
honesta EXPLICITAMENTE registrada no §6.16 como não-executada naquela
rodada (por ser mais arriscada). Executada agora, isolada e com
verificação própria.

**O que era**: ENTRY/STOP/TARGET1-3 (até 6 linhas: entrada high/low +
stop + 3 alvos) eram os ÚNICOS rótulos ainda no eixo NATIVO da
lightweight-charts (`axisLabelVisible:true`) — sem NENHUMA consciência da
posição dos rótulos de S1/R1/VWAP/NL/EMA/último preço/Trend Channel (que
já viviam no `PriceLabelStackPlugin` desde §6.13). Quando um plano ativo
tinha níveis perto de S1/R1/VWAP (o caso NORMAL de um setup real perto de
estrutura — exatamente quando o Operador mais precisa ler tudo limpo), os
rótulos nativos do plano sobrepunham os do overlay. Mesma classe de bug
que motivou o `PriceLabelStackPlugin`, nunca fechada para esta camada.

**Solução aplicada** (mesmo padrão de S1/R1 do §6.13): a LINHA horizontal
continua desenhada (`createPriceLine`, agora `axisLabelVisible:false` +
`title:""`); o RÓTULO migra para `priceAxisLabels` — o MESMO array/sistema
de cascata anti-colisão dos demais níveis. Divisão de responsabilidade:
- O **efeito de mutação** (`[tradePlan, livePrice, targetsHit]`) cuida SÓ
  da LINHA: o stop RATCHEA de posição (break-even → trailing) via
  `effectiveStopForTargetsHit` e brilha quando o preço vivo rompe; cada
  alvo brilha quando ATINGIDO (`targetsHit` autoritativo). Nunca mais
  escreve `title`. `decision` saiu das suas deps (só o rótulo, no useMemo,
  usa a ETA fundida).
- O **useMemo `priceAxisLabels`** compõe o RÓTULO (texto + cor + preço) das
  MESMAS funções puras (`effectiveStopForTargetsHit`,
  `shouldCompactLabels`, `formatEtaRange`) e MESMOS inputs reais que o
  efeito da linha — então linha e rótulo NUNCA divergem. Ganhou
  `tradePlan`/`targetsHit`/`decision` nas deps.

Estado vivo IDÊNTICO ao que a lib desenhava: `ENTRY LONG/SHORT · basis`
(âmbar), `STOP · BREAK-EVEN/TRILHADO · BREACHED` (vermelho, no preço
EFETIVO do ratchet), `TARGET n · basis · R:R · distância% · ETA · REACHED`
(verde, com compactação de largura quando os níveis apertam). A leitura
"bater o olho" fica na COR da caixa: âmbar=entrada, vermelho=stop,
verde=alvo — e `ENTRY LONG`/`ENTRY SHORT` explícito no texto. Fail-closed:
sem plano, zero rótulos; cada push guardado por `Number.isFinite` do preço
real.

**Verificação**: `tsc --noEmit` limpo · `npx vitest run` **103
arquivos/1643 testes** (4 testes de estrutura antiga reescritos para a
nova realidade — assinatura de `mk` sem `title`, `axisLabelVisible:false`,
deps do efeito/useMemo; + 4 testes novos travando os invariantes da
migração) · `npm run build` ok · grep por string literal confirma
`"ENTRY ZONE LOW"`/`"BREAK-EVEN (real)"` no bundle · `audit-header-
maxcontent.mjs` CLEAN nos 11 viewports · **harness Playwright dedicado**:
plano LONG ativo com ENTRY/STOP/TARGET1-3 propositalmente perto de
S1/R1/VWAP/EMA + `targetsHit=1` (o pior caso da migração) — 13 rótulos
simultâneos no eixo, TODOS legíveis, ZERO sobreposição, `TARGET 1 ·
REACHED`/`STOP · BREAK-EVEN`/`ENTRY LONG` corretos, cores distinguindo
entrada/stop/alvo à primeira vista.

**Auditoria "faltando tecnologia/biblioteca/ferramenta?" (pedido do
Operador, resposta honesta)**: levantamento real do arsenal de análise já
ligado — market structure (BOS/CHOCH, S/R, FVG/Order Blocks, fractal
swings, `lorentzian-classifier` k-NN graduado 2026-07-01), confluência
(Council/linear opinion pool, Consensus Radar, Confluence Engine),
multi-timeframe, Trade Plan/Decision Layer/Scenario Engine v2/ETA
Engine/RR Quality, VWAP/EMA/Nexus Line/Volume Profile (WASM)/Fibonacci/
harmônicos XABCD+Wolfe/Premium-Discount/Trend Channel OLS, Institutional
Score (GMIL)/Heat Score/Trap Detection, Track Record/Affective Memory/
Self-Diagnostics, cross-exchange (Binance/MEXC/Bybit/OKX)/L2 history/
orderflow heatmap+CVD. Conclusão honesta: o conjunto de análise já é o de
um terminal profissional de elite — não há uma lacuna de "biblioteca/
tecnologia faltando" que justifique construir um motor novo especulativo
(fazê-lo violaria a disciplina de auditar-antes-de-construir e a Regra de
Ouro 1). Os próximos passos REAIS continuam sendo os já listados (Fase 2
do backtest / recalibração de `weight-matrix.js` / ledger versionado),
todos bloqueados em decisão do Operador, não em falta de ferramenta.

**Sobre "põe pra fazer tudo automático" (resposta honesta)**: a cadeia de
análise JÁ é 100% reativa/automática — a arquitetura store-mediated
(Zustand) recomputa SMC/VWAP/Fibonacci/Scenario/Trade Plan/Council/etc
automaticamente a cada dado real que chega, e o Core Engine emite
LONG/SHORT/WAIT sozinho, sem nenhum clique manual. As DUAS coisas que
permanentemente NÃO podem virar automáticas são, por design não-negociável
(CLAUDE.md): (1) execução de ordens — READ_ONLY/FAIL_CLOSED para sempre; e
(2) um laço de pesquisa perpétuo em segundo plano — não existe
infraestrutura para uma sessão rodar sem ser invocada. "Automático" aqui
já é verdade para tudo que é honesto ser automático.

---

### 6.18 Auditoria + pesquisa do ecossistema visual + direção nas zonas
FVG/OB (pergunta concreta do Operador)

Pedido do Operador: revisão do ecossistema visual inteiro + pesquisa do
que terminais profissionais têm que falta, com julgamento honesto ("ou
ferramenta demais"), mais uma pergunta concreta ("aquela zona vermelha
tipo liquidez, era pra cima ou pra baixo? Está aparecendo?").

**Fix concreto aplicado**: o rótulo das zonas FVG/Order Block dizia só
`"FVG"`/`"OB"` — a direção (alta/baixa) vinha SÓ da cor (verde=demanda,
vermelho=oferta), exigindo o Operador já saber a convenção. Exatamente a
confusão relatada. Corrigido em `LiquidityZonesPlugin.tsx`: o rótulo
carrega o glifo de direção real do motor SMC — `FVG ↑`/`OB ↑` (bullish,
demanda) e `FVG ↓`/`OB ↓` (bearish, oferta), mesmo vocabulário ↑/↓ de
VWAP/Nexus Line; a marca `⚠` de obstáculo continua acompanhando. Zero
cálculo novo (`z.type` já é a direção real do motor). Verificado com
harness Playwright: a zona vermelha lê `OB ↓`/`FVG ↓` sem ambiguidade.

**Pesquisa/revisão (entregável principal)**: documento honesto em
`docs/AUDITORIA_ECOSSISTEMA_VISUAL.md` — inventário completo das 22
camadas visuais reais, comparação com terminais profissionais (ATAS/
Bookmap/GetChart/LuxAlgo, pesquisa real com fontes), e lista priorizada
com veredito. Conclusão honesta: no núcleo order flow + SMC o AR10 já
está em nível profissional; lacunas reais pontuais, cada uma com custo e
bloqueio honesto:
- **Recomendado primeiro** (baixo custo, alto valor, zero dado novo):
  bandas da VWAP (±σ) — a VWAP já é computada, as bandas são o mesmo
  cálculo + desvio real.
- **Em seguida** (dado já coletado): desenhar OI/Funding como sub-série.
- **Vale, decisão do Operador** (motor novo): footprint/cluster
  (bid×ask por vela — auditar granularidade do `orderflow-history`
  antes), padrões geométricos triângulo/cunha/bandeira (o Operador pediu
  "triângulo").
- **Bloqueado em fonte de dado nova**: liquidation heatmap (precisa feed
  de liquidação — não é falta de código).
- **NÃO recomendo (ferramenta demais)**: osciladores clássicos
  desenhados (MACD/Ichimoku/Bollinger/RSI em série) — RSI/ADX/ATR já
  alimentam o Council, desenhar a "sopa" contradiz a tese "o Core Engine
  decide"; e ferramentas de desenho MANUAL — mudaria a categoria do
  produto (auto-análise → editor tipo TradingView).

Nada dos itens 4.x foi construído (todos motores novos ou dependem de
fonte nova) — ficam para o Operador decidir, com o relatório servindo de
base honesta. Verificação: `tsc --noEmit` limpo · **103 arquivos/1644
testes** (+1 do glifo de direção; +1 teste de wiring reescrito) · `npm
run build` ok.

---

### 6.19 EPC §5/§6 (prioridade máxima): "Trade Plan frequentemente não
aparece" — causa raiz real, histerese no Council, motivo honesto agora
também no canvas

Pedido do Operador (EPC — Evolução Suprema do Ecossistema Visual,
Matemático e Persistência Operacional), §5 marcado prioridade máxima:
"o gráfico frequentemente deixa de mostrar ENTRY/STOP/TARGET mesmo
quando deveria existir uma leitura operacional disponível" — exige
auditar o ciclo completo Core Engine→Council→Risk Gate→Trade
Plan→Store→Canvas e responder objetivamente se o plano é criado/
descartado/escondido/substituído, se há perda de persistência ou
sincronização incorreta, e garantir "persistência obrigatória": nunca
esconder silenciosamente, sempre informar o motivo real quando não há
operação ativa.

**Causa raiz real, confirmada por leitura direta do código (não
especulação)**: `council.ts`'s `aggregateCouncil`/`buildCouncilDecision`
era uma função pura sem estado; `ensemble-engine.js`'s
`buildEnsembleConsensus` deriva `direcao` por argmax puro (`pooled.alta
> pooled.baixa && pooled.alta > pooled.neutro`), sem faixa neutra; o
efeito em App.tsx que recomputa o Council roda a CADA tick de preço via
WebSocket (`priceData` nas deps). Combinado: perto de qualquer fronteira
de decisão, o stance do Council podia alternar LONG↔NEUTRAL a cada
~300ms, destruindo e recriando o Trade Plan repetidamente — exatamente o
sintoma relatado.

Resposta objetiva às perguntas do §5: **criado?** sim, quando há
confluência real. **Descartado?** sim, repetidamente, por ruído de
tick — não por mudança real de mercado. **Substituído?** sim, um objeto
novo a cada oscilação. **Perda de persistência?** sim — zero mecanismo
de continuidade existia antes desta correção. **Sincronização
incorreta?** em certo sentido sim: o Core Engine podia ficar estável
(LEI 24, seu próprio ciclo) enquanto o Council piscava, e o Trade Plan
segue o Council, nunca o Núcleo diretamente — divergência real e
honesta (território de LEI 24), nunca "corrigida" trocando qual sinal
trava o plano.

**Correção aplicada — histerese de dois patamares** (reaproveita o
padrão já usado por `vwap-state.ts`'s `directionalStateWithHysteresis`):
`council.ts` ganhou `councilStanceWithHysteresis(prevStance, direcao,
pooled)` com `COUNCIL_STANCE_ENTER_MARGIN = 0.12` (margem maior, exigida
pra reivindicar um lado nunca ocupado) e `COUNCIL_STANCE_EXIT_MARGIN =
0.04` (margem menor, suficiente pra MANTER um lado já ocupado) —
parâmetros de convenção, mesma categoria da tabela em §4. Nunca herda
entre lados opostos, nunca gruda em NEUTRO por argmax genuíno. Aplicada
SÓ na camada de derivação do stance do Council (`aggregateCouncil`/
`buildCouncilDecision`, agora aceitando `prevStance` como 3º parâmetro,
default `"NEUTRAL"`) — deliberadamente SEM tocar `ensemble-engine.js`
(linear opinion pool de Stone 1961/DeGroot 1974), primitiva
compartilhada por mais dois consumidores (`confluence-engine.ts`,
`multi-timeframe-engine.ts`) com necessidades de estabilidade
potencialmente diferentes; mudar ali afetaria os três de forma
imprevisível, contra a disciplina de nunca uma mudança apressada junto
de outras coisas. App.tsx lê `prevStance` da própria store
(`useUnifiedSnapshotStore.getState().council?.stance`) antes de escrever
a nova decisão — síncrono, sempre fresco (Zustand `getState()`, sem o
truque de updater funcional do React state).

**Persistência obrigatória (§5) — nunca mais um silêncio indistinguível
de bug**: a lógica de motivo honesto (já existente numa sessão anterior
só pra barra de comando) foi extraída para uma função pura module-scope,
`tradePlanAbsenceReason(council, coreDir)`, com as 4 causas reais e
mutuamente exclusivas (aguardando Conselho / Conselho travado por risco
/ Conselho neutro-ou-sem-quórum — com a divergência Núcleo-vs-Conselho
explícita quando existe / Conselho direcional mas sem estrutura real
mapeável). Reaproveitada (Regra de Ouro 4 — nunca duplicar, sempre
realocar) em DOIS lugares agora: a barra de comando (já existia) e um
overlay novo no canto superior esquerdo do PRÓPRIO CANVAS
(`"SEM TRADE PLAN · {motivo}"`, `EnhancedChart_110_Percent.tsx`, mesma
posição que o Trend Channel vagou ao migrar pro eixo na Diretriz de
Refinamento Visual §5) — o Operador agora vê o motivo real sem precisar
olhar a barra de comando, direto onde ele já está olhando.

**Verificação real**:
- `tsc --noEmit` limpo.
- **103 arquivos / 1656 testes** (100% passando) — 45 testes em
  `nexus-council.test.ts` cobrem a histerese com execução real,
  incluindo uma "prova viva do sintoma": reproduz o flicker ORIGINAL
  quando `prevStance` não é encadeado entre chamadas, e contrasta com o
  comportamento CORRIGIDO quando é.
- `npm run build` ok.
- `audit-header-maxcontent.mjs` — 11 viewports, CLEAN.
- Verificação Playwright ao vivo confirmou a barra de comando exibindo o
  motivo REAL (`"Trade Plan: Conselho travado (risco)"`, mesma função
  nova). O overlay no CANVAS não pôde ser capturado ao vivo NESTE
  sandbox especificamente: `EnhancedChart_110_Percent` só monta quando
  `chartData.length > 0` (App.tsx:6089, fail-closed por design — nunca
  um gráfico fabricado sem candle real), e este ambiente não tem rede de
  saída para a Binance (proxy retorna 403, confirmado via `curl`) — a
  MESMA causa do estado "AWAITING CANDLES…" já visível na tela, não uma
  falha da feature nova. Evidência restante, honesta e suficiente: os
  testes de padrão de código confirmam byte-a-byte que `ChartWidget`
  computa `chartTradePlanAbsenceReason` com a MESMA função já provada ao
  vivo na barra, e a passa como prop pro canvas — zero segunda
  implementação, zero lugar pra divergir.

**Pendência honesta (nunca fingir completude)**: a verificação visual do
overlay dentro do CANVAS em si só é possível numa sessão com rede real
(Binance) ou, futuramente, um modo Replay real alimentado por histórico
real capturado com proveniência (mesmo padrão de `docs/` já usado no
backtest). Achado incidental desta auditoria, registrado mesmo sem ter
sido o foco: "Replay" hoje existe só como palavra num comentário
(`App.tsx:2221`, cogitando uma "camada futura"), nunca como feature
real — candidato honesto para o EPC §1/§3 (inventário do que existe vs.
o que é só menção).

---

### 6.20 EPC §5/§6 (continuação — relato direto do Operador): ENTRY/
STOP/TARGET faltando no canvas — o Core Engine já tinha os próprios
níveis reais, nunca desenhados

Depois da correção §6.19, o Operador relatou de novo (em linguagem
direta): "falta aparecer... entrada e os alvo, alvo dois, alvo três...
tudo no gráfico... profissional". Auditoria objetiva do caminho de
desenho (não só da causa da instabilidade, desta vez do que realmente
fica desenhado quando não há Trade Plan do Conselho).

**Achado real, por leitura direta do código**: o canvas só desenha
ENTRY/STOP/TARGET a partir do `TradePlan` do CONSELHO
(`trade-plan.ts`/`buildTradePlan` — 4 portões honestos em cascata:
stance direcional, entrada real, invalidação real, alvo real). Mas o
**Core Engine** (LEI 24, único emissor real de LONG/SHORT/WAIT) **já
computa seu PRÓPRIO stop/target1/target2/R:R** a cada ciclo real —
`target-tracker.js` (`rota_a_long`/`rota_b_short`), alimentado por
`support_1`/`support_2`/`resistance_1`/`resistance_2` do
`support-resistance-engine.js` (motor graduado, já rodando: 2 níveis por
lado + força FORTE/FRACA por confluência real de swings). O nível 1
(`support`/`resistance`) já chegava ao canvas como as linhas S1/R1
sempre-visíveis — mas SEM direção, SEM ligação com o sinal do Núcleo:
apenas dois níveis estruturais neutros, iguais estejam o Núcleo em LONG,
SHORT ou WAIT. O nível 2 (`support_2`/`resistance_2`) e a leitura como
STOP/TARGET1/TARGET2 de um sinal real (`engine.target1`/`engine.target2`/
`engine.stop`/`engine.riskRewardRatio`, `engine-bridge.ts`) já
alimentavam os painéis ANALYSIS/RISK havia sessões — mas nunca chegavam
ao CANVAS como tal. Resultado: sempre que o Núcleo tinha LONG/SHORT mas
o Conselho (mais conservador) ainda não confirmava com estrutura
própria, o gráfico não mostrava NENHUMA leitura de ENTRY/STOP/TARGET
ligada a um sinal — só as duas linhas neutras de S1/R1 — mesmo com uma
leitura operacional real disponível. O cerne exato do relato do
Operador.

**Correção aplicada (aditiva, Regra de Ouro 4 — zero motor novo, zero
segunda fonte)**: `App.tsx` (`ChartWidget`) ganhou `engineFallbackLevels`
— só existe quando (1) o Trade Plan do Conselho está ausente E (2) o
Núcleo já tem direção real E (3) `stop`/`target1` são números finitos.
Nunca sobrepõe/substitui o Trade Plan do Conselho (LEI 24 intacta: o
Núcleo continua só o Núcleo, isto não é uma 2ª "trade plan" oficial).
`EnhancedChart_110_Percent.tsx` desenha STOP/TARGET1/TARGET2 (refs
próprias, nunca reaproveita as do Trade Plan do Conselho) com o MESMO
Fio de Seda (`lineWidth:1`, `LineStyle.Solid`) em alpha mais apagado
(0.5/0.5/0.35) — sinaliza "fonte diferente, mais provisória" sem violar
a Regra de Ouro 5 (zero linha tracejada). Rótulos entram no MESMO
sistema anti-colisão (`priceAxisLabels`) com sufixo `"(Núcleo)"`
explícito — nunca confundível com o Trade Plan do Conselho — incluindo a
força FORTE/FRACA real de cada nível.

**ENTRY fica de fora, de propósito**: o "entry" do Núcleo
(`tracker.current_price`) é literalmente o preço vivo corrente — já
desenhado nativamente pelo eixo (`lastValueVisible`). Uma 2ª linha ali
seria redundante, não informação nova (contra "nada cobrindo a visão",
achado de sessão anterior).

**Coerência do overlay de texto**: com `engineFallbackLevels` presente,
"SEM TRADE PLAN" sozinho no canto ficaria auto-contraditório (há linhas
reais na tela). O texto agora distingue os dois casos: `"SEM PLANO DO
CONSELHO · {motivo} · linhas abaixo são do Núcleo"` quando o fallback
está ativo, `"SEM TRADE PLAN · {motivo}"` inalterado quando não há
absolutamente nada desenhado.

**Verificação real**: `tsc --noEmit` limpo · **103 arquivos / 1666
testes** (100%, +10 desde §6.19: 9 testes de fiação real App.tsx↔canvas
+ 1 do texto condicional do overlay) · `npm run build` ok · grep do
bundle de produção confirma `"STOP (Núcleo)"`/`"TARGET 1 (Núcleo)"`/
`"TARGET 2 (Núcleo)"`/`"SEM PLANO DO CONSELHO"` realmente compilados
(nunca eliminados por dead-code) · `audit-header-maxcontent.mjs` 11
viewports CLEAN. Mesma limitação honesta de sandbox do §6.19: sem rede
de saída para a Binance, o canvas não monta neste ambiente
(`chartData.length > 0` é pré-requisito), então a captura visual ao vivo
das novas linhas/rótulos continua pendente de uma sessão com rede real.

---

### 6.21 Captura de tela real do Operador (primeira desta trilha):
confirma §6.19/§6.20 ao vivo + achado novo — "CHOC" cortado pela caixa
"EMA 21"

O Operador enviou a primeira captura de tela REAL desta trilha (BTC/USDT
1H, ao vivo). Auditoria direta da imagem, não especulação:

**Confirmado funcionando**: a barra de comando mostra `"TRADE PLAN:
Núcleo LONG, Conselho neutro"` — exatamente o texto real de
`tradePlanAbsenceReason` (§6.19). O overlay no canto do canvas mostra
`"SEM TRADE PLAN · Núcleo LONG, Conselho neutro"` — o formato ANTIGO
(pré-§6.20; o formato novo seria `"SEM PLANO DO CONSELHO · ... ·
linhas abaixo são do Núcleo"` quando `engineFallbackLevels` existe).
Isso é evidência real de que o ambiente que gerou a captura ainda não
tinha o commit da §6.20 — nunca uma prova de bug na correção em si.
Auditado matematicamente: `engine.direction`/`entry`/`target1`/
`target2`/`stop` (App.tsx, linhas ~1386-1395) vêm todos do MESMO gate
`cycleOk && realCycle?.signal` — se o badge mostra `direction === "LONG"`
(como na captura), `target1`/`target2`/`stop` deveriam estar populados
também, então o fallback do Núcleo (§6.20) tem tudo para aparecer numa
vez que o ambiente rode o commit mais recente.

**Achado novo, real, direto da imagem**: o rótulo `"CHOC"` (BOS/CHOCH,
`StructureBreakMarkersPlugin`) aparece parcialmente coberto pela caixa
opaca de `"EMA 21"` — uma colisão real que o sistema anti-colisão
(`priceAxisLabels`/`PriceLabelStackPlugin`) NUNCA resolvia, porque o
texto BOS/CHOCH era desenhado num canvas PRÓPRIO (`ctx.fillText`), sem
nenhuma consciência da posição dos outros rótulos do eixo — a mesma
categoria de bug já corrigida para Trend Channel/Trade Plan em sessões
anteriores, agora encontrada numa 4ª camada.

**Correção aplicada (aditiva, Regra de Ouro 4)**: o TEXTO
(`"BOS"`/`"CHOCH"`) migrou para `priceAxisLabels`, reaproveitando o MESMO
`brk.level`/`brk.type`/`brk.direction` e o MESMO `ageAlpha(age,
BREAK_DECAY)` (`BREAK_DECAY` agora exportado de
`StructureBreakMarkersPlugin.tsx`) — zero segunda curva de decaimento. A
LINHA horizontal de rompimento continua exatamente igual, no canvas
próprio (`StructureBreakMarkersPlugin`, intocado nessa parte). Como
BOS/CHOCH é a PRIMEIRA etiqueta deste sistema que precisa esmaecer com o
tempo (todas as outras — S1/R1/VWAP/NL/EMA/TREND/ENTRY/STOP/TARGET — são
sempre opacas), `PriceAxisLabel` ganhou `alpha?: number` opcional
(default 1 — zero mudança de comportamento para todo rótulo existente);
`PriceLabelStackPlugin` aplica `ctx.globalAlpha = entry.alpha ?? 1` à
caixa+texto e `0.5 * labelAlpha` ao conector, sempre restaurado a 1 no
fim de cada entrada.

**Verificação real**: `tsc --noEmit` limpo · **103 arquivos / 1674
testes** (100%, +8: 5 de fiação real do rótulo BOS/CHOCH em
`priceAxisLabels` + 3 do suporte a `alpha` em `PriceLabelStackPlugin`) ·
`npm run build` ok · grep do bundle de produção: `"fillText(brk.type"`
(padrão antigo) zero ocorrências — confirma a remoção real, não só no
código-fonte; `"fadeStartCandles"` (a config `BREAK_DECAY`) presente uma
única vez — zero segunda cópia · `audit-header-maxcontent.mjs` 11
viewports CLEAN. Mesma limitação de sandbox das entregas §6.19/§6.20: a
verificação visual final do "CHOC" já não colidindo com "EMA 21" precisa
de uma sessão com rede real para a Binance.

**Pendência honesta**: a frase do Operador "a seta ali dos alvos" não
ficou clara o suficiente para agir com segurança (possível pedido de
glifo direcional ↑/↓ nos rótulos TARGET, no mesmo padrão já usado em
VWAP/NL/FVG/OB — mas tocar o texto do Trade Plan do Conselho arriscaria
quebrar várias asserções exatas já testadas sem confirmação do pedido
real). Registrado para confirmação direta com o Operador antes de
qualquer mudança nesse ponto específico.

---

### 6.22 Bug real encontrado (não atraso de deploy): fallback do Núcleo
(§6.20) nunca podia aparecer — nome de campo errado, mesmo em qualquer
ativo/timeframe

O Operador insistiu, depois da §6.21, que TARGET 1/2 continuavam sem
aparecer "mesmo que eu coloco em qualquer tempo gráfico" — sinal de que
NÃO era só atraso de deploy (hipótese levantada em §6.21). Auditoria
direta do código confirmou: era um bug real, determinístico, presente
desde o commit da §6.20.

**Causa raiz**: o objeto `engine` (App.tsx, `useMemo` ~linha 1367) expõe
o alvo 1 bruto sob o campo `target` — a variável local `target` (não
`target1`) é o nome que sobrevive no `return {...}` (linha ~1505); só o
METADADO de força manteve o sufixo `1` (`target1Strength`, campo
realmente chamado assim). O código do fallback do Núcleo
(`engineFallbackLevels`, App.tsx ~linha 5994) lia `engine?.target1` —
campo que nunca existiu nesse objeto, sempre `undefined`. O gate
fail-closed (`if (typeof target1 !== "number" ...) return null;`) fazia
exatamente o que deveria fazer com um valor `undefined` — retornar
`null`, honesto — mas o MOTIVO real não era "sem dado real disponível",
era "nome de campo errado", disfarçado de "dado insuficiente" porque o
sintoma externo (nada aparece) é idêntico nos dois casos. `tsc --noEmit`
nunca acusou o erro porque `WidgetContext = createContext<any>(null)`
(App.tsx:254) — todo consumidor de `useContext(WidgetContext)` recebe um
valor `any`, então `engine?.target1` numa propriedade inexistente nunca
vira erro de tipo. Achado incidental registrado para o EPC §1/§3: esta é
uma lacuna estrutural de tipagem real (afeta potencialmente qualquer
outro campo de `engine`/`cvd`/etc lido via este Context), não corrigida
agora — tipar `WidgetContext` de verdade é um refactor maior, mais
arriscado, fora do escopo de uma correção pontual.

**Correção aplicada**: `engine?.target1` → `engine?.target` (2 pontos:
a leitura em si e a dependência do `useMemo`). Também corrigido: o
comentário do teste original, que descrevia o campo errado como se fosse
o real, e a PRÓPRIA suíte de testes — a primeira versão do teste de
Task #28 travava `engine?.target1` (o bug) como padrão esperado, porque
era um teste de PADRÃO DE FONTE que replicava a implementação em vez de
verificar o contrato real. Adicionado agora também um teste de EXECUÇÃO
REAL (reproduz o shape verdadeiro do objeto `engine` e prova, pela
matemática, que o nome de campo errado sempre retorna `null`) — a
categoria de teste que a convenção deste projeto (`CLAUDE.md`) já
recomendava para este tipo de bug ("a matemática está sutilmente
errada") e que a primeira versão não usou.

**Matemática alterada**: nenhuma — mesmo `target-tracker.js`, mesmo
`support-resistance-engine.js`, mesmo dado real; só a REFERÊNCIA ao
campo certo dentro do objeto que já existia.

**Impacto esperado**: STOP/TARGET 1/TARGET 2 "(Núcleo)" agora aparecem
de verdade no canvas sempre que o Núcleo tem direção real e o Trade Plan
do Conselho está ausente — em qualquer ativo/timeframe, exatamente o que
o Operador pediu, sem depender de nenhum redeploy adicional além deste
commit.

**Verificação real**: `tsc --noEmit` limpo · **103 arquivos / 1675
testes** (100%, +1: execução real nova) · `npm run build` ok ·
`audit-header-maxcontent.mjs` 11 viewports CLEAN. Mesma limitação de
sandbox das entregas anteriores: confirmação visual ao vivo depende da
próxima captura de tela do Operador (sem rede real para Binance aqui).

**Zona de liquidez** (segunda parte do mesmo pedido): `liquidity_zones`
(FVG/Order Blocks) e `equal_highs_lows` (EQH/EQL, liquidez de repouso)
já estão `true` por padrão em `DEFAULT_CHART_LAYER_VISIBILITY`
(`EnhancedChart_110_Percent.tsx`) — nenhum bug de visibilidade
encontrado no código. Zonas/pools são inerentemente esparsos (só existem
onde a estrutura real do preço os cria); a ausência na captura de tela
anterior pode ser honestamente "nada para mostrar naquele instante", não
um bug — sem uma nova captura mostrando o mesmo instante sem nenhuma
zona onde uma deveria existir, não há evidência de código pra investigar
mais fundo aqui.

---

### 6.23 Auditoria de sincronização (pedido do Operador: "sincronizado
perfeitamente") — varredura campo-a-campo além do bug já corrigido

Depois do bug real do §6.22 (`engine?.target1`), o Operador pediu pra
aumentar a inteligência/precisão de todo o sistema visual de LONG/SHORT/
entrada/saída, com ênfase em ficar "sincronizado perfeitamente". Como o
bug anterior só existiu porque `WidgetContext = createContext<any>(null)`
(App.tsx:254) deixa QUALQUER nome de campo errado invisível pro `tsc`,
a auditoria certa não é ler só `engine` de novo — é conferir campo-a-
campo cada objeto real exposto por esse Context contra a fonte que o
constrói, procurando a MESMA classe de bug. Sem mudança de código nesta
rodada — só verificação.

Auditados (todo uso de `objeto?.campo`/`objeto.campo` em App.tsx
comparado 1:1 contra o `return {...}` real da fonte):
- **`engine`**: o bug do §6.22, já corrigido — nenhum outro campo errado
  nos ~35 campos reais do `useMemo` (App.tsx ~linha 1367).
- **`realCycle`**: limpo — todo uso (`target1`/`target2`/`stop`/
  `support`/`resistance`/`riskRewardRatio`/etc) confere exatamente com o
  `return { ok: true, ... }` de `runRealCycle()` (`engine-bridge.ts`
  ~linha 473). Notável: `realCycle` usa `target1` (não `target`) — é o
  `engine` (App.tsx) que RENOMEIA pra `target` ao processar; ler os dois
  objetos como se fossem intercambiáveis é exatamente o erro do §6.22.
- **`bosChoch`**: limpo — superfície pequena, só `.break` usado.
- **`nexusDecision`**: limpo — `.operation` confere com
  `NexusDecision.operation` (`decision-layer.ts`). `.plan` (que teria
  ENTRY/STOP/TARGETS + ETA) é 100% dependente de `trackedPlan =
  useTradePlanSnapshot()` — o MESMO Trade Plan do Conselho, nunca uma
  3ª fonte independente. A enriquecimento de ETA no rótulo TARGET do
  canvas (`decision?.plan?.targets[i]`, `EnhancedChart_110_Percent.tsx`
  ~linha 1588) por isso só se aplica ao plano do Conselho — ausência de
  ETA no fallback do Núcleo é honesta (não existe cálculo de ETA
  independente pro Núcleo), não um bug.
- **`vwapCtx`**: limpo — os 5 campos usados (`state`/`vwap`/
  `distanceAbs`/`distancePct`/`side`) conferem exatamente com
  `vwap-state.ts`.

**Conclusão honesta**: o bug do §6.22 era real e isolado — a varredura
dos outros objetos mais diretamente ligados a LONG/SHORT/entrada/saída
não encontrou nenhum outro. **Pendência real**: os ~60 campos restantes
do `WidgetContext` (65 chaves no total; ver `contextValue`, App.tsx
~linha 2616) continuam sem essa auditoria campo-a-campo — e a lacuna
estrutural de fundo (`WidgetContext` tipado `any`) continua existindo,
então esta classe de bug pode reaparecer em qualquer objeto novo
adicionado ao Context sem ninguém notar via `tsc`. Registrado para o
EPC §1/§3 (Task #26): tipar `WidgetContext` de verdade — um refactor
maior e mais arriscado, fora do escopo de uma auditoria pontual — é a
correção estrutural que fecharia esta classe inteira de bug de vez.

---

### 6.24 Achado real do Operador ("tá ficando só numa lateral direita"):
rótulos do eixo divididos entre os dois lados — pesquisa real confirma
prática profissional

O Operador notou, olhando o gráfico ao vivo, que TODOS os rótulos do
sistema anti-colisão (S1/R1/VWAP/NL/EMA/TREND/ENTRY/STOP/TARGET/CHOC)
empilhavam só no lado direito — em pior caso, até 12 caixas competindo
por uma única coluna vertical — e perguntou qual seria a forma "mais
inteligente"/"mais profissional" de organizar.

**Pesquisa real antes de implementar** (CLAUDE.md, "pesquise de verdade
quando a tarefa toca... um método com nome próprio" — aqui, uma
convenção real de charting profissional): confirmado que Lightweight
Charts (a lib deste gráfico) documenta suporte nativo a múltiplas price
scales, e TradingView Supercharts permite até 8 escalas simultâneas —
dividir rótulos entre os dois lados do eixo é prática profissional real
documentada, não um desenho inventado para agradar o pedido.

**Critério de divisão** (pensado como um trader pensaria, não arbitrário):
- **Lado DIREITO** (onde o olho já rastreia o preço ao vivo) = "o que eu
  ajo AGORA": VWAP/Nexus Line/EMA (referências dinâmicas, recalculadas a
  cada candle) + ENTRY/STOP/TARGET (o plano ativo — Conselho ou
  fallback do Núcleo, nunca os dois ao mesmo tempo) + último preço
  (nativo, fora deste sistema).
- **Lado ESQUERDO** = "o mapa estrutural": S1/R1 (limites da faixa
  atual, mudam devagar), Trend Channel (contexto de tendência) e
  BOS/CHOCH (evento HISTÓRICO, já esmaecendo com a idade — o menos
  urgente de todos, candidato ideal pro lado secundário).

Resultado real: o lado direito cai de até 12 caixas possíveis para até
8 — redução real de densidade, não só reorganização estética.

**Implementação** (aditiva, Regra de Ouro 4 — zero duplicação): `PriceAxisLabel`
ganhou `side?: "left" | "right"` opcional (default `"right"` — zero
mudança de comportamento pra todo rótulo que não declara o campo).
`PriceLabelStackPlugin` resolve cada lado de forma TOTALMENTE
independente — `resolveLabelStackPositions` (mesma função pura de
sempre, zero segunda heurística) roda uma vez por lado, então um rótulo
da esquerda NUNCA desloca um da direita e vice-versa. Geometria
espelhada: a caixa ancora em `LEFT_MARGIN_PX` (esquerda) ou
`cssWidth - RIGHT_MARGIN_PX - boxWidth` (direita) — mesma margem mínima
nos dois lados (`LEFT_MARGIN_PX === RIGHT_MARGIN_PX === 2`); o conector
fino (Fio de Seda) espelha a direção — sempre entre a caixa e o centro
do gráfico, nunca cortando pra fora da tela.

**Tradeoff conhecido, honesto**: diferente do lado direito (que tem
`rightOffset: 8` reservando espaço vazio real após a última vela), o
lado esquerdo não tem um respiro equivalente — em zoom baixo ou ao
rolar até o início do histórico carregado, as caixas do lado esquerdo
PODEM sobrepor candles reais. Mesmo tradeoff já aceito no lado direito
hoje (candles recentes também podem ficar atrás de caixas em zoom
baixo) — não um problema novo, e terminais profissionais (TradingView
incluso) aceitam a mesma sobreposição ocasional em vez de reservar
espaço permanentemente vazio.

**Verificação real**: `tsc --noEmit` limpo · **103 arquivos / 1684
testes** (100%, +9: 6 sobre a independência real de resolução por lado
— incluindo execução real provando que dois rótulos no MESMO Y mas em
lados diferentes nunca colidem, contrastada com o mesmo cenário no MESMO
lado colidindo de verdade — + 3 sobre o critério real de categorização
em `EnhancedChart_110_Percent.tsx`) · `npm run build` ok ·
`audit-header-maxcontent.mjs` 11 viewports CLEAN. Mesma limitação de
sandbox das entregas §6.19-6.22: confirmação visual ao vivo do
resultado (lado esquerdo realmente aliviando o direito, sem cobrir
candles de forma inaceitável) depende da próxima captura de tela do
Operador — sem rede real para Binance neste ambiente.

---

### 6.25 Segunda captura real do Operador: confirma §6.20/§6.22/§6.24 ao
vivo (fallback do Núcleo + divisão de lados funcionando) + rótulos
compactados ("nome Grandão, um monte de letra")

O Operador enviou uma segunda captura de tela real (BTC/USDT 1H, ao
vivo, `13:23`) — a primeira confirmação visual completa desta trilha.

**Confirmado funcionando ao vivo**: o overlay do canto mostra o formato
NOVO (`"SEM PLANO DO CONSELHO · Núcleo LONG, Conselho neutro · linhas
abaixo são do Núcleo"`, §6.20) — o ambiente já roda o commit mais
recente. STOP/TARGET1/TARGET2 do Núcleo aparecem de verdade no canvas
(§6.22 corrigiu o bug real que impedia isso). A divisão de lados
(§6.24) também: TREND/R1/S1 à esquerda, VWAP/EMA/NL/TARGET1-2/STOP/
preço à direita — exatamente o critério real projetado.

**Achado novo, direto da imagem**: o rótulo `"TARGET 1 (Núcleo) · FRACA
· 1:0.28 · REACHED"` (4 segmentos concatenados) destoava visivelmente
dos vizinhos compactos (`"NL ↑ 65811.69"`, `"EMA 21 66009.14"`) — a
caixa mais larga de toda a tela. Mesmo problema no `"TREND · OLS 50 ·
±2σ · ASCENDING 66352.66"` (5 segmentos).

**Correção aplicada** (aditiva, zero informação real perdida):
1. `"(Núcleo)"` removido do texto de CADA rótulo individual (STOP/
   TARGET1/TARGET2) — era redundante: o overlay do canto já diz "linhas
   abaixo são do Núcleo" uma única vez, persistente enquanto o fallback
   está ativo. A distinção real continua existindo por COR (0.5/0.35 de
   opacidade — sempre mais apagada que o Trade Plan do Conselho, 0.75).
2. `strengthSuffix` (FORTE/FRACA) alinhado ao estilo tight de
   `levelTitle()` (já usado por S1/R1) — espaço, nunca `"·"`, mesmo
   padrão de rótulo em todo o eixo agora.
3. `TREND_DIRECTION_GLYPH` novo (`ASCENDING→↑`, `DESCENDING→↓`,
   `FLAT→→`) — mesmo princípio de `LINE_STATE_GLYPH` (VWAP/NL), tipo
   próprio (`TrendChannelDirection` tem valores diferentes). A palavra
   `"ASCENDING"` (9 letras) vira 1 glifo. **`"OLS 50 · ±2σ"` NÃO foi
   removido** — confirmado por grep que é a ÚNICA leitura visível dessa
   informação em todo o app; apagar seria violar a Regra de Ouro 4
   ("nunca apagar dado real"), não simplificar.

**Pendência honesta registrada, não corrigida agora**: o Trade Plan do
CONSELHO já tem um sistema de compactação real (`shouldCompactLabels`/
`TARGET_LABEL_COMPACT_PCT`, `label-compaction.ts`) que droppa basis/R:R
quando níveis ficam próximos — o fallback do Núcleo nunca ganhou o
mesmo tratamento (`engineFallbackLevels` não participa dessa checagem
de proximidade). Não corrigido nesta rodada porque os níveis na captura
real não estavam próximos o suficiente para o cenário se manifestar
(não era a causa do problema relatado) — fica registrado como
inconsistência real entre os dois caminhos, candidato honesto pra
próxima rodada.

**Verificação real**: `tsc --noEmit` limpo · **103 arquivos / 1686
testes** (100%, +2: `TREND_DIRECTION_GLYPH` declarado + `strengthSuffix`
no novo formato) · `npm run build` ok · grep do bundle de produção
confirma `"(Núcleo)"` com ZERO ocorrências (remoção real, não só no
código-fonte) e `"STOP · BREACHED"` (formato novo) presente ·
`audit-header-maxcontent.mjs` 11 viewports CLEAN.

---

### 6.26 EPC re-emitido (checagem integral + "Identificação dos Objetos"
§4): auditoria completa de todos os rótulos do gráfico + último verboso
compactado (harmônico/Wolfe)

O Operador re-emitiu a diretriz EPC completa (idêntica, 3x) pedindo uma
CHECAGEM de que todas as ordens foram executadas e o sistema esteja
"100% sem nenhuma falha". A resposta honesta: a grande maioria do EPC já
foi entregue ao longo desta trilha (§6.19-6.25 + as duas auditorias em
`AUDITORIA_ECOSSISTEMA_VISUAL.md` §7/§8). O único item concreto do §4
("Identificação dos Objetos — usar apenas as iniciais... menor
poluição") ainda não 100% varrido era o conjunto de rótulos DESENHADOS
no gráfico — auditados agora um a um por leitura direta do código:

| Objeto | Rótulo real hoje | EPC §4? |
|---|---|---|
| OB / FVG | `OB ↑`/`OB ↓`/`FVG ↑`/`FVG ↓` (+`⚠` obstáculo) | ✅ já compacto |
| BOS / CHOCH | `BOS`/`CHOCH` (glifo de cor por direção) | ✅ já compacto |
| EQH / EQL | `EQH x2`/`EQL x3` | ✅ já compacto |
| VWAP / NL / EMA | `VWAP ↑ …`/`NL ↑ …`/`EMA 21 …` | ✅ já compacto |
| S1 / R1 | `S1 FORTE 4x/45x …`/`R1 …` | ✅ sigla + força real |
| TREND | `TREND · OLS 50 · ±2σ · ↑ …` | ✅ (§6.24, glifo) |
| STOP/TARGET (Núcleo) | `STOP`/`TARGET 1 …` | ✅ (§6.25, sem "(Núcleo)") |
| FIB | `FIB 61.8% ×2` | ✅ já compacto |
| VP (Volume Profile) | linha POC, sem texto | ✅ sem poluição |
| CVD | série na banda inferior, sem texto | ✅ sem poluição |
| PROJEÇÃO | `title` nativo, `axisLabelVisible:false` | ✅ tooltip, não polui |
| **Harmônico (PRZ)** | `GARTLEY BULLISH · PRZ · fit 87% (aderência, nunca probabilidade)` | ❌ **verboso — ÚNICO fora do padrão** |
| **Wolfe (EPA)** | `WOLFE · EPA (linha 1→4 real) · ETA … (ápice da cunha)` | ❌ **verboso** |

**Correção aplicada** (o último rótulo verboso do gráfico):
- PRZ: `${pattern} ↑/↓ PRZ ${fit}%` — direção BULLISH/BEARISH vira glifo
  ↑/↓ (mesmo vocabulário de FVG/OB/VWAP), palavra "fit" dropada (o % logo
  após PRZ é inequívoco), e o disclaimer `"(aderência, nunca
  probabilidade)"` sai do rótulo flutuante — confirmado por leitura de
  código que ele já vive ÍNTEGRO no título do painel Harmonic Patterns
  (`"ratio fit, never probability"`, App.tsx) — mesma disciplina de
  zero-repetição do `"(Núcleo)"` (§6.25).
- Wolfe EPA: `WOLFE EPA · ETA {dur}` — `EPA` já é a sigla profissional
  (Estimated Price at Apex); `"(linha 1→4 real)"`/`"(ápice da cunha)"`
  eram descrições, não dado — o significado segue em
  `harmonic-patterns.ts` e no comentário do código.

Regra de Ouro 4 respeitada: zero informação real perdida — só siglas no
lugar de frases, e o disclaimer de honestidade preservado onde ele
importa (o painel), nunca removido do sistema.

**Checagem das demais seções do EPC** (respondida honestamente ao
Operador, sem código novo por já estarem cobertas): §1 auditoria integral
(`AUDITORIA_ECOSSISTEMA_VISUAL.md` §7 — 42/43 módulos conectados); §2
pesquisa técnica (idem §8 — Sierra/Exocharts/IA); §3 evolução matemática
(checklist das 8 categorias, nenhuma ausente); §5 Trade Plan permanente
(§6.19-6.22, fallback do Núcleo + motivo honesto sempre visível); §6
inteligência visual (todos os objetos do núcleo têm rótulo real); §7
projeções (Scenario Engine Path A/B, já real); §8 responsividade (11
viewports CLEAN, iPad Mini incluído). Pendências reais continuam as já
registradas (bandas VWAP, OI/Funding, footprint, ChartDOM, Fase 2 do
backtest, tipagem do WidgetContext, compactação por proximidade do
fallback do Núcleo) — todas bloqueadas em decisão do Operador ou
refactor maior, nunca em "matemática/inteligência faltando escondida".

**Verificação real**: `tsc --noEmit` limpo · **103 arquivos / 1686
testes** (100%, 3 testes de string do rótulo harmônico atualizados para
o formato compacto) · `npm run build` ok · grep do bundle confirma
`"aderência, nunca probabilidade"` com ZERO ocorrências (remoção real) ·
`audit-header-maxcontent.mjs` 11 viewports CLEAN (iPad Mini portrait +
landscape inclusos, EPC §8).

---

### 6.27 EPC §5 ("obstáculos estruturais... em qualquer ativo e qualquer
timeframe"): fallback do Núcleo agora também destaca obstáculos — o caso
MAIS comum, antes sem essa ênfase

Com o EPC re-emitido mais uma vez, a auditoria voltou ao §5 (Trade Plan
permanente) com um olhar mais fino sobre o FALLBACK do Núcleo — que é o
caso mais COMUM na tela (o Trade Plan do Conselho é mais conservador/raro:
4 portões honestos em cascata). Achado real: o §5 lista "obstáculos
estruturais" entre o que deve sempre aparecer, e o Trade Plan do Conselho
já tinha isso (`chartObstacleZones` → ênfase de borda ⚠ no
`LiquidityZonesPlugin`), mas o fallback do Núcleo NÃO — `chartObstacleZones`
retornava `[]` sempre que não havia plano do Conselho, mesmo com o Núcleo
mostrando STOP/TARGET. O Operador via as linhas do Núcleo mas nunca a
ênfase de obstáculo no caminho até elas.

**Correção aplicada** (aditiva, zero matemática nova — Regra de Ouro 4):
- `engineFallbackLevels` ganhou o campo `entry` (o preço atual real do
  Núcleo, `engine.entry` = `tracker.current_price` — o mesmo ponto de
  referência de caminho).
- `chartObstacleZones` foi estendido: extraída uma função `collect`
  (entrada, alvos, direção) que chama a MESMA `obstacleZonesInPath`
  (`trade-plan.ts`) — uma única definição de "zona estrutural no caminho
  entrada→alvo", nunca um segundo cálculo. Alimentada pelo plano do
  Conselho quando existe, OU pelo fallback do Núcleo (entrada = preço
  atual como zona de largura zero, alvos = target1/target2 reais) quando
  é o caso. Fail-closed inalterado: `[]` sem zonas estruturais reais.

Resultado: a mesma ênfase visual de obstáculo (⚠, borda destacada da
zona real) que o plano do Conselho já tinha agora funciona também no
fallback do Núcleo — fechando o gap do §5 exatamente no caso que o
Operador mais vê. Nenhuma zona nova é desenhada: só a borda de zonas
FVG/OB que o `LiquidityZonesPlugin` JÁ desenha ganha ênfase quando está
no caminho de um alvo real.

**Verificação real**: `tsc --noEmit` limpo · **103 arquivos / 1687
testes** (100%, +1: execução real nova provando que a geometria de
`obstacleZonesInPath` conta o obstáculo do caminho do Núcleo — LONG e
SHORT — exatamente como faria para o Conselho; 3 testes de fiação
atualizados para o novo `collect`) · `npm run build` ok ·
`audit-header-maxcontent.mjs` 11 viewports CLEAN. Limitação de sandbox
das entregas anteriores: confirmação visual ao vivo (a borda ⚠ sobre a
zona no caminho do Núcleo) depende de uma sessão com rede real —
indisponível aqui.

**Pendência honesta que permanece**: a CONTAGEM numérica de obstáculos
(`obstacleCount` no rótulo/painel) continua só no plano do Conselho; o
fallback do Núcleo ganhou a ênfase VISUAL da zona mas não um número
`⚠ N` próprio no rótulo — próximo passo natural se o Operador quiser a
contagem explícita também no fallback. **(Resolvido em §6.28.)**

---

### 6.28 EPC MODO ELITE §4: contagem numérica `⚠ N` de obstáculos no
rótulo do fallback do Núcleo — fecha a pendência do §6.27

O EPC re-emitido (MODO ELITE) lista explicitamente "Obstáculos
estruturais" entre o que o Trade Plan permanente sempre deve mostrar
(§4). O §6.27 fechou a ênfase VISUAL da zona (borda ⚠) para o fallback
do Núcleo mas deixou registrada a pendência: a CONTAGEM numérica por
alvo continuava só no plano do Conselho. Chave da decisão de design:
o Conselho tem um painel próprio (ANALYSIS/ModulePanel) onde a contagem
`obstacleCount` vive — por isso o rótulo do gráfico do Conselho NÃO
mostra `⚠ N` (evita duplicar). O Núcleo NÃO tem painel próprio — o
rótulo do gráfico é o ÚNICO lugar onde essa contagem chega ao Operador.
Então adicionar `⚠ N` ao rótulo do Núcleo não é inconsistência, é o
oposto: dá ao Núcleo o mesmo acesso à informação que o Conselho já
tinha, no único canal disponível.

**Correção aplicada** (aditiva, zero matemática nova — Regra de Ouro 4):
- `engineFallbackLevels` (App.tsx) ganhou `target1ObstacleCount`/
  `target2ObstacleCount`, computados por `obstacleCountTo(price)` — um
  wrapper fino sobre a MESMA `obstacleZonesInPath(...).length`
  (`trade-plan.ts`) que o Conselho e o `chartObstacleZones` já usam.
  `tradePlanStructureZones` entrou nas deps do `useMemo`.
- `EnhancedChart_110_Percent.tsx`: prop `engineFallbackLevels` ganhou os
  dois campos opcionais; o rótulo de cada alvo do Núcleo agora anexa
  `obstacleSuffix(n)` = `" ⚠ N"` só quando `N > 0` (caminho livre não
  polui), mesmo glifo ⚠ da zona destacada — leitura instantânea (EPC §6)
  de "há N obstáculos estruturais entre o preço atual e este alvo".

Resultado: os 3 pontos de obstáculo agora sincronizados no fallback do
Núcleo — a borda ⚠ da zona (§6.27), o número `⚠ N` no rótulo do alvo
(esta entrega), ambos da MESMA `obstacleZonesInPath` real. "Se o núcleo
calcula, o operador enxerga" (Regra Suprema do EPC MODO ELITE) — a
contagem, que o Target Tracker do Núcleo permite derivar, deixou de
ficar escondida.

**Verificação real**: `tsc --noEmit` limpo · **103 arquivos / 1688
testes** (100%, +1: fiação do `⚠ N` no rótulo + tipos da prop) · `npm
run build` ok · grep do bundle de produção confirma `obstacleSuffix`/
`" ⚠ ${n}"` realmente compilados · `audit-header-maxcontent.mjs` 11
viewports CLEAN (iPad Mini incluído). Confirmação visual ao vivo do
`⚠ N` sobre o alvo do Núcleo depende de sessão com rede real (sandbox
sem egress).

---

### 6.29 EPC MODO ELITE ABSOLUTO §10 (Recuperação de Recursos):
inteligência real ESCONDIDA restaurada — `engine.condition` (a
confirmação que o Core Engine exige) nunca era exibida a ninguém

O EPC re-emitido (MODO ELITE ABSOLUTO) trouxe uma ênfase nova e concreta:
§10 "Recuperação de Recursos" — verificar se alguma inteligência se
perdeu ou ficou escondida durante as evoluções, e restaurá-la na forma
mais evoluída. A auditoria certa para isso: cruzar campo-a-campo o que o
núcleo CALCULA (`realCycle`/`engine`) contra o que realmente chega à
tela, procurando um valor real computado mas sem NENHUM consumidor.

**Achado real (inteligência escondida, não especulação)**: `realCycle.condition`
— computado e exposto pelo `engine-bridge.ts` (`condition: typeof
matrix.condition === 'string' ? matrix.condition : null`, linha ~489)
desde sempre — NUNCA era lido por nenhum consumidor (grep confirmou: zero
usos fora da própria definição). O que esse campo É (rastreado até
`trade-setup-matrix.js` → `research-engine.js`): a **confirmação REAL que
o Core Engine exige** antes do setup valer — `required_confirmation` para
LONG/SHORT (ex.: confirmação por volume real), ou `trigger_to_reevaluate`
para WAIT (ex.: "Nova leitura após rompimento claro de suporte ou
resistência reais"). É exatamente o tipo de inteligência que o §7 (Setup/
Contexto), o §11 ("cada cálculo deve possuir representação visual") e a
Regra Final ("se existe inteligência dentro do núcleo, ela deve aparecer")
pedem — e estava invisível.

**Restauração aplicada** (na forma mais evoluída, §10 — passthrough puro,
zero matemática nova):
- `engine.condition` (App.tsx) — passthrough do `realCycle.condition`,
  mesmo padrão de `rationale`/`marketStructure`/todos os outros campos.
- Nova linha na **Síntese Operacional** (aba ANALYSIS): "Confirmação
  exigida (Núcleo)" logo após "Decisão" — só quando há string real
  (fail-closed: `DADOS_INSUFICIENTES`/null/vazio some). A Síntese já era
  o painel dos 6 eixos auditáveis do NexusDecision; a confirmação exigida
  é o 7º dado real, do mesmo núcleo, no mesmo lugar.

**Auditoria §10 mais ampla (registrada honestamente)**: os demais campos
do núcleo mais relevantes foram verificados e TÊM representação —
`forecast` (widget de horizontes), `lorentzian` (confluência),
`moveToTargetPct` (3728), `timeframeConfluence`/`htfMarketStructureLabel`
(widget Multi-Timeframe), `volatilityPct`/`marketRegime` (Market Regime),
`rationale` (voiceSnapshot). `condition` era o único genuinamente órfão.
Nenhuma FUNCIONALIDADE removida em evolução anterior foi encontrada (as
migrações desta trilha — rótulos nativos → priceAxisLabels, BOS/CHOCH →
eixo, compactações — todas preservaram o dado, nunca o descartaram; §6.19-
6.28 documentam cada uma).

**Verificação real**: `tsc --noEmit` limpo · **103 arquivos / 1690
testes** (100%, +2: fiação do passthrough + exibição na Síntese, e a
prova de que o engine-bridge já computava o campo) · `npm run build` ok ·
grep do bundle confirma `"Confirmação exigida"` compilado · `audit-header-
maxcontent.mjs` 11 viewports CLEAN. Confirmação visual ao vivo (a linha na
aba ANALYSIS com uma leitura real) depende de sessão com rede real.

---

### 6.30 EPC MODO ELITE (Recuperação de Inteligência Oculta, rodada 2):
`council.opinionMass` — a distribuição real do pool, mostrada só como
escalar derivado até agora

Segunda passada da auditoria §10/§2 (localizar inteligência calculada que
não chega ao Operador). Depois do `condition` (§6.29), a varredura
campo-a-campo do `CouncilDecision` achou `opinionMass` — a DISTRIBUIÇÃO
real do pool linear (Stone 1961/DeGroot 1974): massa de opinião do comitê
em long/short/neutral. Ela já PARTICIPA da decisão (o `scenario-engine.ts`
a lê para pesar os caminhos Path A/B, linha ~87), mas nunca era mostrada
como número ao Operador. O painel Council exibia `agreement` — que é só o
ESCALAR de coesão derivado dela (0=dividido, 1=unânime); `agreement` é uma
projeção com perda (não dá pra recuperar a distribuição a partir dele),
então mostrar `opinionMass` NÃO é duplicação (§2): adiciona a FORMA real
da divisão — onde o não-consenso senta (ex.: o resto está em short com
convicção, ou espalhado em neutral?).

**Recuperação aplicada** (§2 — nunca duplicar, nunca recalcular; forma
mais profissional): nova linha "Opinion Mass (L/S/N)" no painel
Multi-Agent Council (aba ANALYSIS), logo após Agreement — formato
compacto `L 72 · S 15 · N 13` (percentuais reais do pool). Honestidade de
sempre preservada (o painel Scenario Paths já carrega o rótulo "council
opinion mass, never market probability"; o valor é massa de opinião real,
nunca probabilidade de mercado). Fail-closed: Conselho abstido
(`opinionMass` null) → `MODULE_EMPTY` ("AWAITING REAL DATA").

**Auditoria §2 mais ampla desta rodada (registrada honestamente)**: os
demais campos ricos do núcleo foram verificados e TÊM representação —
`lorentzian` (classificação+confiança+n= no widget), `dataQuality`
(indicador de qualidade), votos individuais do Conselho (CouncilWidget),
`agreement`/`quorum` (painel), `htfUpdatedAt` (idade do cache HTF),
`forecast` multi-horizonte (classificação+confidence+sampleSize por
chip). `opinionMass` era o último campo substancial genuinamente não
exibido. **Conclusão honesta**: o poço de "inteligência de alto valor
genuinamente escondida" está essencialmente esgotado após `condition`
(§6.29) e `opinionMass` (esta) — as próximas evoluções reais de valor
(ChartDOM, bandas VWAP, footprint) são CONSTRUÇÕES novas que dependem de
decisão de produto do Operador, não campos órfãos a recuperar.

**Verificação real**: `tsc --noEmit` limpo · **103 arquivos / 1691
testes** (100%, +1: fiação da linha Opinion Mass, fail-closed) · `npm run
build` ok · `audit-header-maxcontent.mjs` 11 viewports CLEAN.

---

### 6.31 ORDEM DE AUDITORIA FINAL — Certificação de Qualidade Operacional:
duplicação real VOLATILIDADE/ATR% encontrada e eliminada

Auditoria completa nas 7 seções pedidas pelo Operador (Certificação/Trade
Plan/Auditoria de Dados/Auditoria Matemática/Auditoria Visual/Demanda e
Oferta/Relatório Final) — relatório completo em
`docs/RELATORIO_AUDITORIA_FINAL.md`. Achado real (§3/§4): a row
"VOLATILIDADE" do painel Market Regime recomputava seu próprio proxy
(média ingênua de `(high-low)/close`, sem gaps) na mesma hora em que
`regime-engine.js` já calcula o ATR% real (true range com gaps, Wilder) e
repassa via `engine.marketRegime.atrPercent` — o mesmo campo que
`eta-engine.ts`, `aura-lifecycle.ts` e o tooltip do Multi-Timeframe Matrix
já usavam. Corrigido: `engine.volatilityPct` removido por inteiro, a row
(renomeada "VOLATILIDADE (ATR%)") e o checklist de fontes agora leem a
única fonte real.

**Validado, sem lacuna nova**: Break Even/Trailing Stop confirmado
Council-only por arquitetura real (Track Record precisa de identidade de
plano estável — só o Conselho tem quórum para isso honestamente),
documentado como limitação de design, não bug. Demanda/Oferta↔Trade Plan
confirmada sincronizada (garantia `isRealObstacle` de rodada anterior
segue correta). RSI/ADX confirmados single-source (achado inicial
impreciso sobre "duas implementações de RSI" corrigido antes de publicar
— `computeRSI` é uma função só, em `lorentzian-classifier.js`, reusada
por `App.tsx` e `multi-timeframe-engine.ts`). Memória/persistência: 4
mecanismos, zero sobreposição.

**Verificação real**: `tsc --noEmit` limpo · **103 arquivos / 1694
testes** (100%, +3: fonte real VOLATILIDADE/ATR%) · `npm run build` ok
(10.88s, 1821 módulos) · `audit-header-maxcontent.mjs` 11 viewports CLEAN.
Commit `864f65f`.

---

### 6.32 NÚCLEO GRAVITACIONAL AUTÔNOMO (AUTO FUSION ENGINE) — Fase 1:
Relevance Engine + visibilidade automática por camada

Diretiva do Operador pedindo um "organismo inteligente" onde nenhuma
camada precisa de ativação manual — Fusion Engine, Centro Gravitacional,
Corredor de Probabilidade, Projeção Automática. Antes de escrever
qualquer código, duas perguntas de escopo genuinamente do Operador
(`AskUserQuestion`, porque a leitura literal da diretiva colidia com duas
regras não-negociáveis do próprio CLAUDE.md): (1) o Fusion Engine pode
gerar/alterar Entry/Stop/Target/Risco por conta própria, ou fica só
apresentação sobre os MESMOS números do Conselho/Núcleo? — resposta:
**display-only, LEI 24 intacta**. (2) os 15 toggles manuais somem, ou
continuam como override? — resposta: **continuam como override,
comportamento padrão novo é automático por trás deles**.

**Fase 1 entregue** (as outras seções da diretiva — Corredor de
Confluência/Centro Gravitacional visual, síntese unificada — ficam para
uma próxima rodada, propostas mas não construídas ainda, mesma disciplina
de "documentar honestamente o que falta"):

- **`nexus/layer-relevance.ts`** (motor puro, graduado com suíte própria
  antes de qualquer ligação — Laboratório de Evolução): `computeLayerRelevance`
  decide, para cada uma das 15 camadas reais do gráfico, SIM/NÃO de
  exibição a partir de sinais JÁ REAIS já computados em outros lugares do
  app — obstáculo real no caminho do Trade Plan (`chartObstacleZones`),
  decaimento de idade de BOS/CHOCH (o MESMO `ageAlpha`/`BREAK_DECAY` que
  `StructureBreakMarkersPlugin` já usa), proximidade a POC/HVN, fitScore
  de harmônico, estado direcional de VWAP/Nexus Line, zona Premium/
  Discount, tendência real do fluxo. Zero número fabricado — cada regra é
  um SIM/NÃO sobre um cálculo que já existia. `trade_plan_zone`/
  `neural_market_aura` ficam fora do gate (seguem seu próprio ciclo de
  vida real, nunca fazem sentido como "camada opcional"). 37 testes de
  execução real (`layer-relevance.test.ts`) — inclusive uma varredura que
  confirma nenhum motivo textual usa a palavra "probabilidade" (Regra de
  Ouro 2).
- **Modelo de visibilidade paralelo** (`chartLayerAutoMode`, mesma forma
  de `ChartLayerVisibility` — zero migração do boolean manual que já
  existia): `true` = automático (Relevance Engine decide), `false` =
  override manual. Clicar no toggle individual (que sempre existiu)
  agora TAMBÉM sai do automático — um ato explícito assume controle,
  exatamente como o Operador pediu. Os 3 presets manuais
  (Operacional/Auditoria/Inteligência) também saem do automático ao
  aplicar (curadoria deliberada); um 4º preset, "Automático", devolve as
  15 camadas ao comportamento novo de uma vez. Persistência aditiva
  (campo novo em `RestoredSession`, sessão antiga sem a chave cai no
  default automático — zero versão nova da chave, `chartLayers` mantém a
  MESMA forma/significado de sempre).
- **Store**: `layerRelevance` — novo slice §3 MOTORES QUANT (mesmo padrão
  de 5 lugares de `harmonicPatterns`), computado uma vez em `ChartWidget`
  e lido por 2 consumidores reais (o canvas via `effectiveChartLayerVisibility`
  e o painel de camadas via `useLayerRelevanceSnapshot()`), nunca
  recomputado duas vezes.
- **Painel**: cada camada mostra um badge real "auto" com o motivo
  (tooltip, nunca um sumiço silencioso) quando em modo automático, e um
  botão real de reset (`⟲ auto`) quando manual.
- **`trendChannelBandwidthPct`**: `computeTrendChannel` (motor puro já
  usado por `EnhancedChart_110_Percent.tsx` para desenhar o canal)
  chamado uma 2ª vez em `ChartWidget` — mesma função determinística sobre
  os mesmos candles reais, nunca pode divergir, só não havia como
  reaproveitar o `useState` interno do componente do canvas sem um
  refactor maior fora de escopo desta rodada.

**Verificação real**: `tsc --noEmit` limpo · **105 arquivos / 1748
testes** (100%, +54: 37 execução real do motor puro + 17 fiação da
integração) · `npm run build` ok (9.75s, 1822 módulos) ·
`audit-header-maxcontent.mjs` 11 viewports CLEAN.

**Honestamente pendente desta diretiva** (próxima rodada, não construído
sem confirmar escopo primeiro): Corredor de Confluência (renomeado de
"Corredor de Probabilidade" — Regra de Ouro 2 proíbe rotular como
probabilidade calibrada; será visualizado como largura/intensidade de
confluência real: opinionMass do Conselho + institutionalScore + MTF
agreement + contagem de obstáculos, nunca uma nova fonte de decisão);
síntese unificada do "Centro Gravitacional" (mesma ideia visual do
Corredor, tratada como 1 feature só — não duas — para não duplicar);
Projeção Automática (§4 da diretiva) já está, na prática, coberta desde
rodadas anteriores (Entry/Stop/Target1-3/BE/Trailing do Conselho e
Entry/Stop/Target1-2 do fallback do Núcleo já desenham automaticamente
sem o Operador habilitar nada — `trade_plan_zone` é isento do gate
exatamente por isso).

---

### 6.33 EPC FINAL — Consolidação Final: nomenclatura curta nos objetos do
canvas (EN/ST/TP1-3), destaque real na relevância automática, auditoria
honesta do critério de conclusão §14

Terceira rodada da mesma diretiva (Núcleo Gravitacional/Fusion Engine),
agora com um checklist explícito de conclusão (§14). Nenhuma pergunta
nova de escopo foi necessária — as duas decisões da rodada anterior
(§6.32: Fusion Engine display-only, toggles como override) continuam
válidas e cobrem as seções desta versão também.

**§8 "Objetos Inteligentes" (nomenclatura curta EN/ST/TP1/TP2/TP3)**:
achado real — os rótulos do CANVAS (Trade Plan do Conselho e fallback do
Núcleo, `priceAxisLabels` em `EnhancedChart_110_Percent.tsx`) usavam
"ENTRY LONG/SHORT"/"STOP"/"TARGET N" por extenso, não a forma curta agora
pedida explicitamente. Corrigido: `EN`/`ST`/`TP{n}` (sempre numerado,
mesmo com 1 alvo só). **Decisão deliberada de NÃO tocar**: a barra de
comando (`BarField` "Entry Zone"/"Stop"/"Target", `App.tsx`) já passou
por um "Redesenho radical" pedido explicitamente pelo Operador em rodada
anterior, trocando "E/S/T" cramped por rótulos legíveis — reverter isso
sem um pedido novo desfaria uma decisão real já tomada. A distinção
(canvas = curto; barra de comando = legível) é intencional, não uma
aplicação parcial.

**§3/§12 ("quando reduzir opacidade"/"quando destacar")**: extensão do
Relevance Engine (`layer-relevance.ts`) — `LayerRelevanceResult` ganha um
3º campo, `emphasis: "normal" | "highlight"`, mas SÓ nas 5 camadas que já
carregam um número contínuo real no input (nunca um sinal novo):
`liquidity_zones` (>= 2 obstáculos reais no caminho vs. 1),
`structure_breaks` (alpha de decaimento ainda alto vs. já esmaecendo),
`trend_channel` (banda muito mais estreita que o limiar de relevância),
`harmonics` (fitScore real bem acima do limiar). As outras 10 camadas
(sinal booleano puro — hasOrderBook, orderflowTrendActive, etc.) ficam
sempre "normal" quando relevantes — honesto por não ter gradiente real
pra medir, nunca um destaque fabricado. Aplicado ao badge "auto" do
painel de camadas (mostra "auto · destaque" só quando `emphasis ===
"highlight"`). **Honestamente NÃO aplicado ainda** à renderização real do
canvas (opacidade/cor dos ~8 plugins de overlay) — cada plugin tem seu
próprio laço de desenho com valores `rgba()` hardcoded; alterar 8
arquivos de renderização sem poder verificar visualmente ao vivo neste
sandbox (sem rede real) seria um risco real de regressão não detectável
aqui. Proposto como próxima iniciativa isolada, não construído às pressas
junto de outra coisa.

**§14 (Critério de Conclusão) — auditoria honesta, item a item**:

| Critério | Status | Evidência |
|---|---|---|
| Nenhuma camada exige ativação manual | ✅ | Fase 1 (§6.32): 15 camadas do canvas, todas em modo automático por padrão |
| Nenhuma informação duplicada | ✅ | ORDEM (§6.31): 1 redundância real encontrada e eliminada (VOLATILIDADE/ATR%); resto confirmado single-source |
| Nenhum objeto sobrepõe outro | ✅ (estrutural) / ⚠️ (canvas ao vivo) | `PriceLabelStackPlugin` resolve todos os rótulos do eixo por 1 sistema único; `audit-header-maxcontent.mjs` 11 viewports CLEAN; verificação do CANVAS ao vivo depende de rede real, indisponível neste sandbox — mitigado por capturas de tela reais de rodadas anteriores |
| Trade Plan sincronizado | ✅ | `tradePlanAbsenceReason` + `obstacleZonesInPath` como fontes únicas, Conselho e Núcleo cobertos (§6.19-§6.22) |
| Todos os motores ativos | ✅ | Nenhum motor de cálculo jamais foi gateado por ativação manual — só a EXIBIÇÃO tinha toggle; auditoria §7.2/§7.3 (`AUDITORIA_ECOSSISTEMA_VISUAL.md`) já confirmou as 8 dimensões do EPC §3 cobertas |
| Interface auto-organizada | ⚠️ parcial | Show/hide automático: ✅ (Fase 1). Reorganização de layout por relevância: ❌ não construído — os widgets de painel têm posição fixa por design (V16 Institutional Command Center), reorganizar dinamicamente seria uma mudança arquitetural maior, não decidida ainda |
| Visualização totalmente automática | ⚠️ parcial | Mesma ressalva acima — camadas do canvas sim, mas o Centro Gravitacional/Corredor de Confluência (síntese visual unificada, §6/§9) ainda não foi construído |
| Pronto pra operar imediatamente após abrir | ✅ | Sempre foi verdade — nenhum onboarding/ativação jamais foi exigido; confirmado nesta auditoria, não uma mudança nova |

**Verificação real**: `tsc --noEmit` limpo · **105 arquivos / 1755
testes** (100%, +7 desde §6.32: emphasis real + badge de destaque) ·
`npm run build` ok · `audit-header-maxcontent.mjs` 11 viewports CLEAN.

---

### 6.34 EPC FINAL — Aditivo de Automação Total (§21-28): MEXC Futures real
como 4ª fonte de cross-check, achado real do Smart Omnibox, ZigZag
honestamente não-encontrado

Quarta rodada da mesma diretiva (§21-28, "nenhuma inteligência será
perdida... todo o ecossistema permanece vivo, sincronizado, automático").
Uma pergunta de escopo genuinamente nova (§27, MEXC): resolvida pelo
Operador (`AskUserQuestion`) — **MEXC continua secundária/cross-check**
(nunca substitui a Binance como fonte primária do ciclo do Core Engine,
LEI 24/CLAUDE.md intactos), ganhando Futures completo; **lista de ativos
expandida de forma curada**, não descoberta automática de centenas de
pares (isso fica para uma rodada futura, com redesenho do seletor).

**§21/§24/§26 — confirmados por evidência, sem trabalho novo**: nenhum
motor jamais foi gateado por ativação manual; `engine` e toda leitura
computada são `useMemo`s dependentes de dado ao vivo (recomputam a cada
candle/tick por construção); o único código asset-específico encontrado
(₿ para BTC) é puramente cosmético e degrada bem para qualquer símbolo.

**§22 — gap já conhecido, reconfirmado**: todas as ferramentas listadas
são reais e ativas, exceto Centro Gravitacional/Corredor de Confluência
(ainda não construídos — não há nada "para manter habilitado").

**§25 (ZigZag) — achado real, não uma recuperação**: auditoria completa
(`golden-master.html` + busca full-text por "zigzag") não encontrou
nenhuma evidência de um sistema de linhas estruturais coloridas (azul/
cinza/roxa) que tenha existido e sido removido/ocultado. `golden-master.html`
é um protótipo mais antigo e completamente diferente (footprint chart,
visualização de partículas) — seu roxo/ciano/laranja são cores de tema de
UI, não linhas de análise. Os elementos estruturais REAIS (Trend Channel,
BOS/CHOCH, S1/R1) permanecem ativos desde sempre nesta sessão. Achado
paralelo: `fractal-swings.js` já computa swing highs/lows reais
(compartilhado por vários motores), mas nada desenha uma linha zigzag
conectando-os no canvas hoje — feature nova genuína, barata (o dado já
existe), proposta e não construída sem pedido explícito.

**§27 (MEXC) — entregue**:
- `cross-exchange/mexc-futures.ts` (novo): 4ª fonte real de cross-check,
  mesmo padrão de `bybit-futures.ts`/`okx-futures.ts`. Endpoint real
  `GET /api/v1/contract/funding_rate/{symbol}` (API pública MEXC Contract
  v1, símbolo formato `BTC_USDT`, pesquisado e confirmado contra a
  documentação pública real da MEXC antes de implementar — nunca
  inventado). `fairPrice` (mark price real) comparado apples-to-apples
  com o markPrice da Binance/Bybit/OKX (mesma disciplina já estabelecida
  — evita um DIVERGENTE falso por ruído de last-trade); `fundingRate`
  vem de graça na mesma chamada; `openInterest` fica null de propósito
  (exigiria uma 2ª chamada de rede só pra um campo que nenhum consumidor
  exibe hoje — mesmo raciocínio já documentado para a OKX). Ligado ao
  mesmo `Promise.all` de Bybit/OKX, mesma linha de UI "Cross-Exchange
  Consensus", mesmo `setConnectionState`/contribuição ao TrustScore.
  Schema não verificado ao vivo (sandbox sem rede de saída — mesma
  limitação já documentada nos outros 3 conectores).
- **Achado real relevante durante a auditoria**: `ASSETS` (a lista de 5
  botões-atalho) NUNCA foi o universo de escolha do app — o Smart Omnibox
  já busca ao vivo qualquer par USDT real da Binance
  (`fetchBinanceUsdtSymbols`, `omnibox/binance-symbols.ts`), então
  "Compatibilidade Universal" (§26) e boa parte de "detectar novos ativos
  automaticamente" (§27) já existiam antes desta rodada. O que mudou:
  `ASSETS` expandido de 5 para 12 (DOGE/ADA/AVAX/LINK/DOT/TON/TRX
  adicionados) — pares reais, líquidos, listados tanto na Binance Futures
  quanto na MEXC Futures — só os atalhos de 1 toque, não uma mudança
  arquitetural. Verificado ao vivo (build + preview real) que a fileira
  de 12 botões não quebra layout em nenhum dos 11 viewports, incluindo os
  que ativam o breakpoint `lg:` (iPad Pro landscape, MacBook meia-tela).

**Verificação real**: `tsc --noEmit` limpo · **105 arquivos / 1765
testes** (100%, +10: 16 execução real do conector MEXC Futures - 6
reaproveitadas do padrão existente + fiação de reset por troca de ativo
ajustada) · `npm run build` ok (9.08s, 1823 módulos) ·
`audit-header-maxcontent.mjs` 11 viewports CLEAN.

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
