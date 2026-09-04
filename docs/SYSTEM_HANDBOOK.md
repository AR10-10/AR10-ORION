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
`docs/historico/AUDITORIA_ECOSSISTEMA_VISUAL.md` — inventário completo das 22
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
`docs/historico/RELATORIO_AUDITORIA_FINAL.md`. Achado real (§3/§4): a row
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

### 6.35 EPC FINAL — Aditivo de Universalização e Consolidação (§29-44):
indicador institucional do cabeçalho corrigido, genericidade confirmada
por evidência, esclarecimentos honestos sobre escopo já combinado

Quinta rodada da mesma diretiva (§29-44). A maior parte reafirma seções
já auditadas/respondidas em rodadas anteriores (§21-28, EPC FINAL §1-14,
Núcleo Gravitacional Fase 1) — reconfirmadas aqui por evidência real, sem
repetir trabalho já feito. Duas seções trouxeram trabalho novo real
(§35) ou mereceram um esclarecimento explícito que não existia ainda
(§31); as demais foram checadas e, quando já cobertas, apontadas para
onde a evidência já vive.

**§35 (Indicador Institucional do Cabeçalho) — corrigido**: achado real
— o indicador de "Score Geral" no header (`App.tsx`) mostrava a palavra
"Score" (nunca deveria) e o rótulo do tier (Muito Forte/Forte/Moderada/
Fraca/Inválida) como uma linha sempre visível separada, em vez de só
cor+percentual juntos como a diretiva pede (`🟢 92%`). Corrigido: emoji
real da zona (`confidenceZone.emoji`, já existia) agora entra junto do
número (nunca só a bolinha sozinha), o número ganhou o sufixo `%`
(mesmo valor real 0-100, só formatado como percentual — não é uma nova
medição), a palavra "Score" foi removida. O rótulo do tier não foi
apagado (Regra de Ouro 4) — só realocado para o tooltip, que já carregava
"Zona: ${confidenceZone.label}" desde a Diretriz Complementar §16.
Confirmado por grep, antes de tocar no código, que este é o ÚNICO ponto
de renderização visual deste score em todo o app — Single Source of
Truth já era real (institutional-score.ts), só precisou da correção de
apresentação. Fusion Engine/Centro Gravitacional (citados na diretiva
como fontes que deveriam compartilhar essa mesma matemática) ainda não
existem — não há como compartilhar fonte com algo que não foi construído
ainda; quando existirem, precisam ser display-only sobre os MESMOS
números (mesma disciplina já estabelecida na Fase 1 do Núcleo
Gravitacional), nunca uma segunda fórmula de confluência.

**§29/§30/§40 (Universalização dos Motores) — confirmado por evidência
real, não suposição**: varredura por padrão em `nexus/`, `research/
engines/`, `market-regime/` e `consensus/` — zero comparação de símbolo
de ativo hardcoded (`symbol === "BTC"` ou similar) e zero comparação de
timeframe hardcoded (`timeframe === "15m"` ou similar) fora de valores
DEFAULT de parâmetro nunca realmente usados (confirmado que os 2 call
sites reais de `getChartCandles` sempre passam `selectedAsset`/
`chartTimeframe` explícitos — o default `symbol = 'BTC'` existe só como
fallback seguro de teste/invocação direta, nunca um caminho ao vivo).

**§31 (Universalização da IA) — esclarecimento honesto**: a leitura
literal ("a IA adapta automaticamente os parâmetros mais adequados para
o comportamento de cada ativo... sem calibração manual") pediria
calibração REAL por ativo (ex.: limiares de RSI/harmônico/proximidade
diferentes para BTC vs. um altcoin de baixa liquidez) — isso não existe
e não deveria ser fabricado: este repositório não tem infraestrutura de
backtest que sustente honestamente "estes são os parâmetros ótimos para
este ativo específico" (mesma razão pela qual os limiares declarados em
`layer-relevance.ts`/`rr-quality.ts`/etc são convenção documentada, nunca
medição). A adaptação REAL que já existe: as FÓRMULAS/limiares são
universais, mas o RESULTADO se adapta automaticamente porque cada cálculo
roda sobre os dados AO VIVO e reais daquele ativo específico (ATR% de um
altcoin volátil sai naturalmente maior que o do BTC, por exemplo, sem
nenhuma configuração por ativo) — adaptação via dado real, nunca via
calibração fabricada.

**§36 (Consolidação Final) — sem duplicação nova encontrada**: as 2
adições desta trilha desde a última auditoria de duplicação (ORDEM,
§6.31) — `layer-relevance.ts` e `mexc-futures.ts` — foram desenhadas
desde o início para reusar fonte única (ver seus próprios cabeçalhos:
zero segunda curva de decaimento, zero segunda fórmula de comparação
markPrice). Nenhuma duplicação nova identificada.

**§37 — confirmado alinhado**: "a IA poderá apenas controlar: destaque;
intensidade; transparência; prioridade visual. Nunca desligar o cálculo"
é exatamente o que a Fase 1 do Núcleo Gravitacional já implementa
(`layer-relevance.ts`: motor sempre calcula, só decide exibição/ênfase).

**§41 (Integração Completa da MEXC) — escopo já combinado, não mudou**:
esta seção repete o pedido de "sincronização automática do catálogo
público" já respondido pelo Operador na rodada anterior (curadoria
primeiro, não descoberta automática completa). Sem uma nova resposta
explícita mudando essa decisão, o escopo continua o combinado — não
reinterpretado silenciosamente para "agora sim, descoberta completa" só
porque a diretiva repetiu o pedido.

**§38/§42 (reorganização/reposicionamento automático) — honestamente
ainda não construído**: mesma pendência já registrada nas 2 rodadas
anteriores (Fase 1 cobre mostrar/ocultar/destacar; mover/reorganizar
elementos dinamicamente no layout é um escopo maior, ainda não
começado).

**Verificação real**: `tsc --noEmit` limpo · **105 arquivos / 1765
testes** (100%, 2 arquivos de fiação do header ajustados para a nova
estrutura — mesmo total de testes, sem teste novo necessário: a correção
foi de apresentação, não de matemática nova) · `npm run build` ok (8.92s,
1823 módulos) · `audit-header-maxcontent.mjs` 11 viewports CLEAN
(verificado ao vivo via build+preview, não só tsc).

### 6.36 OMEGA CORE V-MAX — FASE 0 (congelar a lei) + FASE 1 (matar a
segunda verdade): auditoria de fronteiras + migração real de smc/cvd/
orderflowSignals para a store

Primeira leva de fases de uma diretiva nova, mais estruturada que as
anteriores (Prioridade MÁXIMA, execução em fases, ordem obrigatória —
"não pular"). FASE 0 é auditoria pura (sem código); FASE 1.1 é a única
com trabalho de código real nesta rodada; FASE 1.2/1.3 são auditorias que
confirmaram invariantes já corretos, sem alteração necessária.

**FASE 0 — "Fase 0 aceita: leis congeladas".** Três auditorias exigidas,
todas limpas, com evidência (não suposição):

1. **Emissão de LONG/SHORT/WAIT fora do Core Engine**: zero encontrada.
   Achado central: `tests/core-engine-boundary.test.ts` (Fase G/V15,
   já existente) já tranca isto em CI — `engine-bridge.ts` nunca importa
   `gmil/`/`consensus/`, `CoreSignal` é um tipo fechado
   (`'LONG'|'SHORT'|'WAIT'`), os módulos puros do núcleo nunca importam
   consultivo/`.tsx`, e o Ensemble depende só de `market-regime/`. Camada
   por camada: GMIL (`gmil/types.ts`) não tem campo `direction`/`decision`
   nenhum — só tipos de provider/fetch; a Matriz Multi-Timeframe usa
   vocabulário `'ALTA'|'BAIXA'` (não `LONG/SHORT`) alimentando um pool de
   opinião linear, nunca uma decisão; o Motor de Cenários sempre computa
   AMBOS os paths (LONG e SHORT, nunca só um) como projeção de alvos —
   mesmo espírito ROTA A/B/C do `ANALYSIS_OUTPUT_CONTRACT.md`; o
   Confluence Engine só COMPARA 3 subsistemas contra a direção ativa do
   Core, nunca emite a própria. Ponto investigado a fundo (o mais
   plausível de violar a LEI 24): o painel de Trade Plan prioriza o plano
   estrutural do CONSELHO sobre o fallback simples do NÚCLEO quando os
   dois existem — mas o badge de decisão principal
   (`CoreSignalBadge`) lê exclusivamente `engine?.direction`, sempre; os
   dois planos são mutuamente exclusivos por construção
   (`engineFallbackLevels` já vem `null` quando o plano do Conselho
   existe) e uma divergência real Conselho×Núcleo é SURFACADA
   honestamente (comentário "as duas leituras podem divergir de forma
   real e honesta"), nunca escondida nem resolvida por sobrescrita
   silenciosa — achado de uma auditoria anterior desta mesma trilha
   (tarefas EPC §5/§6), não uma violação nova.
2. **`order_send`/segredo/live trading**: zero encontrado em código real.
   Toda ocorrência do grep é config/schema declarando ausência
   (`"order_send": "ABSENT"`, `no_order_send: true`) ou `QUARANTINE.md`/
   teste afirmando a mesma regra em texto.
3. **Isolamento do laboratório de backtest**: confirmado. Só arquivos de
   teste (`*.test.ts`) importam de `src/research/backtest/*`; os 3
   módulos do laboratório importam apenas conectores reais e os MESMOS
   engines de produção (reuso, nunca 2ª matemática) — nunca o inverso.
4. Nenhuma feature das fases proibidas (Radar/OIH/heatmap/ferramentas
   elite) foi iniciada nesta trilha. Evidência executável: 65/65 testes
   passando nas 5 suítes mais diretamente relevantes antes de prosseguir.

**FASE 1.1 — migração real**: `docs/ORGANISM_DATA_FLOW.md` já documentava
(seção "Insumos pré-store") que `smcZones` (FVG/OB/EQH-EQL,
`engine-bridge.ts`'s `computeSmcZones`) e `cvd`/`orderflowSignals`
(Order Flow real via MEXC, `src/orderflow/signal-engine.js`) eram dado
real já computado em `App.tsx` sem fatia própria na store — com a receita
de migração já escrita. Fechado:

- `engine-bridge.ts`: nomeado o retorno anônimo de `computeSmcZones` como
  `SmcZonesSnapshot` (aditivo — mesmo objeto literal, só ganhou nome).
- `unified-snapshot-store.ts` (§3 MOTORES QUANT): 3 fatias novas — `smc`,
  `cvd`, `orderflowSignals` — com action/default/seletor cada
  (`setSmc`/`setCvd`/`setOrderflowSignals`,
  `useSmcSnapshot`/`useCvdSnapshot`/`useOrderflowSignalsSnapshot`), mesmo
  padrão de `volumeProfile`/`fibonacciConfluence` (as únicas 2 fatias §3
  com os 5 passos da receita JÁ completos — achado da auditoria:
  `harmonicPatterns`/`layerRelevance`/`premiumDiscount` pararam nos passos
  1-3, nunca ganharam caso no orquestrador nem entraram nos RESETs de
  teste; gap pré-existente, não desta migração, registrado aqui por
  transparência em vez de silenciado).
- `organism-orchestrator.ts` + `event-bus.ts`: 3 casos novos de diff
  (`QUANT.SMC.UPDATED`/`QUANT.CVD.UPDATED`/`QUANT.ORDERFLOW_SIGNALS.UPDATED`),
  mesmo padrão referência-a-referência dos casos QUANT.* existentes.
- `App.tsx`: `smcZones`/`orderflowSignals` espelhados via `useEffect`
  próprio (reage à MESMA variável já computada, nunca recomputa);
  `cvd` espelhado diretamente no callback real `onCvd` do MEXC feed (mais
  preciso que um `useEffect`, zero atraso de um ciclo de render). Reset:
  `smc`/`orderflowSignals` zeram sozinhos porque os efeitos de espelho
  reagem ao valor local, que já zera na troca de ativo; `cvd` ganhou um
  reset explícito para `null` (não o `0` cosmético do `useState` local —
  achado da investigação: a soma corrida real no worker de order flow
  NUNCA é reiniciada de fato por troca de ativo, `0` local é só exibição;
  `null` é o "ainda sem leitura real" honesto para o gateway novo).
- **Decisão de escopo, deliberada e documentada**: consumidores existentes
  (Conselho, Cenário, Trade Plan, Detecção de Armadilhas, ChartWidget,
  NeuralCoreWidget, StructureLevelsStrip, OrderFlowWidget,
  MarketRegimeWidget — todos via `WidgetContext`) **não** foram migrados
  para ler da store nesta rodada. Isto não é preguiça: o próprio cabeçalho
  do arquivo da store já declara a política ("Consumidores antigos
  continuam via WidgetContext sem migração forçada") — trocar ~10 pontos
  de consumo no arquivo mais sensível do app, todos cobertos por testes de
  fiação que travam a string literal exata da leitura via Context, é um
  refactor maior e de risco real, não uma auditoria+fechamento de gap. A
  fatia nova na store é o gateway REAL e completo para
  `getSnapshotForEngine()`/futuros assinantes do bus — não existe mais
  "segunda verdade" (o cálculo continua único), só uma segunda ROTA DE
  LEITURA ainda não adotada por quem já funciona. Migrar consumidor a
  consumidor é trabalho futuro honesto, não fingido como feito aqui.
- Testes: `nexus-organism-orchestrator.test.ts` ganhou 4 testes reais (3
  de write→evento com motor/fixture real, 1 de fiação de código-fonte);
  os RESETs de `unified-snapshot-store.test.ts`/`nexus-health-monitor.test.ts`
  ganharam as 3 fatias novas (fechando o passo 5 da receita para elas
  especificamente — os outros gaps pré-existentes citados acima
  continuam em aberto, fora do escopo desta migração).

**FASE 1.2 — rotas paralelas**: auditado `engine-bridge.ts` +
`js/research/*`. `runRealAnalysisCycle()` é o único chamador real de
`buildResearchEngineFrame`/`buildTradeSetupMatrix`/`buildTargetTracker`
(grep confirma: só `engine-bridge.ts` e os próprios arquivos de teste).
`research-engine.js` sempre computa as 3 rotas (LONG/SHORT/WAIT) em
paralelo; `trade-setup-matrix.js` é presentation-only sobre rotas já
calculadas ("nunca uma heurística nova/paralela de decisão", texto
literal do próprio cabeçalho); `target-tracker.js` nunca recalcula
alvo/S/R a partir do preço vivo, só compara. Direção/entrada/stop/
alvo/R:R existem em exatamente um lugar. Zero violação, zero mudança de
código necessária.

**FASE 1.3 — swings unificados**: `support-resistance-engine.js`,
`market-structure-engine.js`, `fvg-order-block-engine.js` e
`bos-choch-engine.js` importam exclusivamente `FRACTAL_K`/`findSwings` de
`fractal-swings.js` — zero constante `FRACTAL_K` local redeclarada, zero
algoritmo de swing duplicado. Esta consolidação já tinha acontecido numa
remediação anterior (Auditoria Mestra 360°, documentada no próprio
cabeçalho de `fractal-swings.js`); esta fase reconfirmou que não houve
regressão. Zero violação, zero mudança de código necessária.

**FASE 2 (Skills Limpas) — reafirmação de política, sem ação nesta
rodada**: nenhuma skill/motor novo foi promovido nesta trilha (a migração
da FASE 1.1 usa engines já graduados — `fvg-order-block-engine.js`, order
flow real — nunca introduz um novo). A regra de quarentena de
`QUARANTINE.md` e a regra "anti-teatro" (nunca inventar nome de
ferramenta sem implementação real por trás) continuam vigentes e
inalteradas para a próxima vez que uma skill nova for de fato proposta.

**FASE 3 (Stage Runner) — ainda não recebida**: a mensagem do Operador
cortou exatamente no início desta fase ("Objetivo: pipeline linear
auditável... Formalizar/implementar em `ramber-ui/src/nexus/`:") sem
conteúdo. Não foi fabricado/suposto — aguardando o reenvio do restante
antes de prosseguir, mesma disciplina já usada quando isto aconteceu com
a primeira metade deste mesmo prompt mestre.

**Verificação real**: `tsc --noEmit` limpo · **106 arquivos / 1774
testes** (100%, +4 testes novos reais para as 3 fatias novas + 1 ajuste
de janela de offset em teste de padrão de código-fonte já existente,
stale após a inserção do reset de `cvd`) · `npm run build` ok (15.44s,
1823 módulos) · `audit-header-maxcontent.mjs` 11 viewports CLEAN
(verificado ao vivo via build+preview).

### 6.37 OMEGA CORE V-MAX — FASE 3 (Stage Runner) + FASE 4 (auditoria
"Bate-Olho") + FASE 5 (Corredor de Confluência) + FASE 6 (universalização):
continuação imediata da mesma diretiva (§6.36)

**FASE 3 — Stage Runner formalizado**: a diretiva pediu para "formalizar"
um "pipeline linear auditável" em `nexus/`, mas cortou antes de nomear os
estágios — em vez de inventar uma estrutura nova, `docs/SYSTEM_HANDBOOK.md`
§2 ("Pipeline canônico de decisão") já desenha exatamente esse pipeline
(`DADOS REAIS → SNAPSHOT → CORE ENGINE → TRADE PLAN → buildNexusDecision →
OPERATIONAL READABILITY`) — usado como base real, não fabricada. Criado
`nexus/stage-runner.ts`: `traceStages(snapshot, seq)`, função pura
read-only (zero import de motor/engine — só o TIPO do snapshot) que
reporta 4 estágios inspecionáveis pela store hoje (`DATA → CORE_ENGINE →
COUNCIL → TRADE_PLAN`, cada um com `{ok, reason}`). "ok" significa "teve
insumo causal real do estágio anterior" — NUNCA "produziu um resultado
positivo": um Trade Plan `null` porque o Conselho está NEUTRAL/ABSTAIN é
uma resposta honesta esperada (ROTA C), nunca reportada como estágio
quebrado. Invariante causal (nenhum estágio ok=true depois de um
ok=false) provada por construção (`ok` downstream sempre `anteriorOk &&
condiçãoPrópria`) e testada adversarialmente em
`tests/stage-runner.test.ts` (11 testes). **Gap honesto registrado**: os
últimos 2 elos do pipeline §2 (`buildNexusDecision`/`OperationalReadability`)
ainda não têm fatia própria na store (mesmo padrão "insumo pré-store" que
smcZones tinha antes da Fase 1.1) — não rastreáveis pelo Stage Runner
ainda, documentado no próprio cabeçalho do módulo, não fabricado.

**FASE 4 — auditoria "Bate-Olho"**: delegada a uma exploração dedicada
antes de qualquer edição. Resultado, item a item: **§4.1** (6 eixos
canônicos DIREÇÃO→ESTRUTURA→TIMING→RISCO→CONFLUÊNCIA→DECISÃO) já real e
idêntico ao documentado, zero drift. **§4.3** (Score do header) já no
formato `🟢94%` sem a palavra "Score" (confirma §35 de rodada anterior,
sem regressão). **§4.5** (Relevance Engine) confirmado com evidência de
teste real: ligado por padrão nos 15 layers, nunca importado por
`trade-plan.ts`, override manual intacto. **§4.2/§4.4 — 2 achados reais,
corrigidos**: (1) `OB↑/OB↓/FVG↑/FVG↓` (LiquidityZonesPlugin.tsx) tinham um
espaço antes do glifo ("OB ↑") — removido, forma exata agora; (2) o Trade
Plan REAL do Conselho (EnhancedChart_110_Percent.tsx) nunca mostrava a
contagem de obstáculos no rótulo do alvo — só o fallback do Núcleo tinha
essa contagem (`obstacleSuffix`, duplicado ali dentro). Hoisted para o
escopo externo da função (mesma função, zero duplicação agora) e aplicado
também ao Trade Plan real. **§4.4 — decisão deliberada de NÃO forçar**:
`HARM`/`VP`/`CVD`/`OI`/`FD` continuam fora do canvas na forma literal de
5 letras pedida. Colapsar o harmônico para "HARM" perderia a informação
que mais importa (QUAL padrão — Gartley/Bat/Butterfly/Crab/Wolfe — não
"que existe um harmônico"), uma regressão de clareza, não uma compactação
— contradiria o próprio objetivo "bater o olho em <2s" da Fase 4. VP/CVD
já se comunicam visualmente (barras/posição de linha) sem precisar de
texto; OI/FD (funding/open interest) não são hoje conceitos de CANVAS —
são números de sessão em widgets dedicados, não algo com posição de
preço própria no eixo. Forçar os 5 no canvas seria adicionar escopo novo
(um visual que não existe), não compactar um rótulo existente — fora do
que a Fase 4 realmente pede.

**FASE 5 — Corredor de Confluência (retomando a task pendente já aprovada
pelo Operador numa rodada anterior, "Fusion §5")**: criado
`nexus/confluence-corridor.ts` — `computeConfluenceCorridor()`, função
pura que cruza 4 sinais JÁ reais (opinionMass do Conselho do lado ativo,
institutionalScore normalizado, concordância real da Matriz
Multi-Timeframe, `1/(1+obstáculos)` do alvo mais próximo do Trade Plan) em
uma única leitura `intensity` (0-1) — display-only (LEI 24: `direction`/
`activeObstacleCount` chegam como parâmetros já decididos, nunca
recalculados aqui) e nunca rotulada como probabilidade (Regra de Ouro 2 —
suíte dedicada `tests/confluence-corridor.test.ts`, 12 testes, prova isso
inclusive verificando que o tipo de saída não tem nenhum campo
`probability`/`chance`/`odds`). Fatia nova `confluenceCorridor` na store
(§3 MOTORES QUANT), evento `QUANT.CONFLUENCE_CORRIDOR.UPDATED`, espelhado
em `App.tsx` a partir de valores já computados (`engine?.direction`,
`councilFromSnapshot`, `institutionalScore`, `multiTimeframeForConviction`,
`trackedPlan` — todos já existiam, zero segunda leitura). **Achado real
durante a implementação**: a primeira tentativa colocou o cálculo dentro
de `ChartWidget()` (perto de `layerRelevance`), mas `institutionalScore`/
`councilFromSnapshot`/`multiTimeframeForConviction` só existem no escopo
de `App()` — um componente React diferente, não visível de dentro de
`ChartWidget` (erro real de `tsc`, corrigido movendo o cálculo para
`App()`, reaproveitando `trackedPlan` — o mesmo `useTradePlanSnapshot()`
que `chartTradePlan` em `ChartWidget` já chamava, zero segunda leitura da
store). **Escopo deliberadamente NÃO incluído nesta rodada**: o visual no
canvas (a largura/opacidade real do corredor desenhada sobre o gráfico) —
a fatia fica pronta, real, testada e disponível via
`getSnapshotForEngine()`/seletor para quando esse consumidor visual for
construído, sem precisar recomputar nada; construir E verificar
visualmente (Playwright ao vivo, conforme a disciplina deste repositório
para mudanças de UI) na mesma tacada que 3 outras fases desta diretiva
arriscaria uma entrega apressada de uma peça visual nova.

**FASE 6 — universalização + troca de contexto**: reconfirmado sem
código novo necessário. `§29/30/40` (genericidade) já auditado na rodada
anterior, sem regressão desde então. Reset de contexto: o efeito de troca
de TIMEFRAME (App.tsx, dep `[chartTimeframe]`) já zera explicitamente
`realCycle`/`engineStatus`/`volumeProfile`/`institutionalScoreHistory` —
achados de uma auditoria de staleness anterior (S1/R1 e o histograma do
Volume Profile ficavam presos ao timeframe antigo por até 5s). `smcZones`
(e demais overlays derivados de `chartData`) nunca sofrem esse problema
por construção: computados da MESMA variável `chartData` que os candles
do próprio gráfico usam — nunca podem mostrar geometria de um regime
diferente do que já está na tela, ao contrário de `realCycle` (fonte
assíncrona independente, por isso precisou do reset explícito). `cvd`/
`orderflowSignals` corretamente NÃO resetam na troca de timeframe (order
flow é escopado ao ATIVO, não ao timeframe — mesmo princípio que já valia
antes da Fase 1.1, preservado). IA/voz (`llm-bridge.ts`/`voice-intents.ts`)
confirmadas sem nenhum caminho de emissão de direção — só leitura/
narração do `engine.direction` real.

**Verificação real**: `tsc --noEmit` limpo (inclui a correção do erro
real de escopo App()/ChartWidget acima) · **108 arquivos / 1799 testes**
(100%: +11 `stage-runner.test.ts`, +12 `confluence-corridor.test.ts`, +5
novos em `nexus-organism-orchestrator.test.ts` — 4 da Fase 1.1/5 mais 1 de
fiação do Corredor —, +1 ajuste de reason em teste próprio corrigido por
falso-positivo — a palavra "falha" aparecia tanto no motivo de bloqueio
quanto na prosa honesta do caso de sucesso, mesma classe de erro já
resolvida antes nesta trilha para "ASSETS.map" —, 5 ajustes de testes
existentes stale após os 2 achados reais da Fase 4, e 2 janelas de
offset recalculadas via medição exata, nunca chute) · `npm run build` ok
(12.36s, 1824 módulos) · `audit-header-maxcontent.mjs` 11 viewports
CLEAN (verificado ao vivo via build+preview real).

**Pendente, honestamente**: visual do Corredor de Confluência no canvas
(Fase 5, ver acima). Migração de consumidores existentes para os
seletores da store (Fase 1.1, já registrada em §6.36). FASE 7 (Radar/OIH)
da mesma diretiva ainda não recebida do Operador — a mensagem cortou
exatamente no início desta fase ("Painel no header (substitui botão
pulsante)\nExemplo:" sem conteúdo); aguardando reenvio em vez de fabricar
o painel/exemplo/critérios de filtro.

### 6.38 OMEGA CORE V-MAX — FASE 7 (Radar/OIH v1) + FASE 8/9 (auditoria) —
fechamento da diretiva completa (Fase 0→9) e relatório final por
"Entregáveis de cada ciclo/PR"

Conclusão do restante da diretiva, recebido em duas mensagens (o fim de
Fase 7 + Fase 8/9/regras globais/critérios finais).

**Achado real antes de escrever qualquer código (grep em todo o
repositório)**: nenhum "Radar Global", "Operation Intelligence Hub" ou
"botão pulsante" existe hoje neste código — a única correspondência é
`consensus-radar.ts`, um motor DIFERENTE (reempacotamento de 6
magnitudes já votadas, não um varredor multi-ativo). `computeDrawdownPct`
(pendência citada pela diretiva) também não existe em nenhum arquivo
deste repositório, que não tem nenhuma feature de paper-trading.
Confirmado com o Operador via `AskUserQuestion` antes de prosseguir (3
perguntas, as 3 com a opção recomendada escolhida):

1. **Universo de ativos do Radar v1**: a lista curada já real de
   `configs/asset-universe.default.json` — não descoberta ao vivo de
   "todos os pares da MEXC" (infraestrutura nova, não pesquisada).
2. **`computeDrawdownPct`**: confirmado que pertence a outro projeto do
   Operador, não a este repositório — não fabricado aqui.
3. **Escopo desta rodada**: v1 real e testado do NÚCLEO de qualificação/
   ranking; a infraestrutura de varredura em segundo plano (Workers/
   fila/cache/painel no header) fica para uma rodada própria — mesma
   disciplina da Regra de Ouro 6 (mover trabalho pesado/novo pra Worker
   exige iniciativa isolada, nunca uma mudança apressada).

**FASE 7 entregue**: `nexus/radar-qualification.ts` —
`qualifyRadarCandidate()` avalia UM candidato contra o filtro mínimo da
diretiva (direção ativa real, estrutura ALTA/BAIXA confirmada — LATERAL
reprova —, Trade Plan real não-null, `riskGated` real do Conselho —
reusado, nunca um gate novo inventado —, Corredor de Confluência real
≥ 0.6, mesmo piso de "oportunidade" já convencionado em
`institutional-score.ts`). `qualityIndex` é literalmente a MESMA
`intensity` do Corredor de Confluência (Fase 5) — zero segunda fórmula
de consenso, satisfaz "sem heurística sem base matemática já presente"
por construção. `rankRadarCandidates()` filtra e ordena só quem
qualifica — nunca inventa posição para quem não qualifica.
Deliberadamente NÃO construído nesta rodada (aguardando rodada própria,
por decisão do Operador): Workers/fila/cache/scan incremental, painel no
header, clique→abrir ativo/timeframe/centralizar gráfico.

**FASE 8 — auditoria (sem heatmap/ferramentas elite novos nesta
rodada)**: consolidação (FVG/OB/BOS/CHOCH/VP/EMA/VWAP) já real, sem novo
achado além dos 2 já corrigidos na Fase 4. Heatmap de liquidação: feed
real já existe (`startRealLiquidationFeed`, Binance Futures público) mas
só alimenta uma lista/painel ("Forced Liquidations"), nunca um heatmap
de intensidade por nível de preço no canvas — gap real, não construído
ainda (Prioridade 2 da própria Fase 8, depois da consolidação). "Ferramentas
elite" — auditoria por item, evidência real, não suposição:

| Item da diretiva | Estado real |
|---|---|
| Harmônicos clássicos (Gartley/Bat/Butterfly/Crab/Shark/Cypher) | **JÁ EXISTE** — os 6 confirmados em `nexus/harmonic-patterns.ts` |
| Wolfe Waves | **JÁ EXISTE** — mesma varredura de pivôs, `detectWolfeInPivots` |
| Auto Fibonacci | **JÁ EXISTE** sob outro nome — `fibonacci-confluence.ts` já deriva a retração automaticamente do último swing real confirmado, zero desenho manual |
| Dynamic trend projection | **Substancialmente já coberto** — `trend-channel-engine.ts` (canal OLS real, direção ASCENDING/DESCENDING/FLAT, bandas ±2σ) |
| Liquidity sweep / projection | **Parcialmente já coberto** — `LiquidityZonesPlugin`/`trap-detection.ts` já detectam sweep real de EQH/EQL; a parte de "projection" (previsão) não existe |
| Institutional volume zones | **Parcialmente já coberto** — Volume Profile (POC/HVN/LVN) + bolhas de trade grande no Order Flow Heatmap já existem; um conceito distinto e novo não foi construído |
| Pitchfork (Andrews) | **Genuinamente ausente** — zero ocorrência no repositório |
| Elliott simplificado | **Genuinamente ausente** — zero ocorrência no repositório |

Só 2 de 8 itens são lacuna real e nova (Pitchfork, Elliott) — ambos
exigem pesquisa real da metodologia (mediana de Andrews; regras de
contagem de onda) antes de qualquer implementação, por disciplina de
"pesquise de verdade" do `CLAUDE.md` — não construídos nesta rodada,
flagados como backlog real para uma rodada com essa pesquisa dedicada,
nunca fabricados sem base.

**FASE 9 — auditoria de performance**: as 3 adições novas desta rodada
completa (`stage-runner.ts`, `confluence-corridor.ts`,
`radar-qualification.ts`) são funções puras O(1)/O(n pequeno) —
comparações e um `.filter`/`.sort` sobre no máximo ~9 prazos ou 3 alvos,
zero risco real de Main Thread. Confirmado por revisão de código (zero
`fetch`, zero motor pesado, zero laço sem teto) — este ambiente não tem
instrumentação real de FPS/dispositivo físico para medir jank ao vivo
(mesma limitação já documentada do sandbox de CI sem egress a
exchanges); a confirmação aqui é por leitura de código + suíte/build
verdes, nunca uma medição de FPS que não foi de fato feita.

### 6.39 OMEGA CORE V-MAX — Completar FASE 7: scanner real de fundo +
painel "OPORTUNIDADES" no header + clique→abrir ativo

Continuação explícita do Operador ("ESTADO ACEITO": Fase 7 "Parcial —
ranking puro feito; faltam UI + clique + scan", "FAZER PRIMEIRO" antes de
qualquer outra pendência do backlog). Fecha os 3 itens que §6.38 havia
deliberadamente deixado de fora.

**Universo real ligado (achado honesto sobre o próprio dado de
configuração)**: `configs/asset-universe.default.json` se autodescrevia
como `"wired_into_live_app": false` / `"status":
"FUTURE_READY_REFERENCE_ONLY"` / nota afirmando que "nenhum código do PWA
lê ou ordena este arquivo hoje" — verdadeiro até este commit. Ligar o
scanner a ele torna essa autodescrição falsa a partir de agora, então os
3 campos foram corrigidos no MESMO commit (`status`:
`LIVE_RADAR_SCAN_UNIVERSE_CRYPTO_GROUPS_ONLY`, `wired_into_live_app:
true`, nota reescrita) — nunca deixado como uma mentira arquivada.
Precisão importante: só os 3 grupos CRYPTO (`crypto_top_liquidity`,
`crypto_additional`, `pow_mining_crypto`) são lidos de fato
(`radar-universe.ts` já filtrava por `asset_class === "CRYPTO"`); o grupo
EQUITY (`mining_ai_hpc_equities`) continua tão inerte quanto sempre foi.

**Scanner real (`engine-bridge.ts`, `scanRadarCandidate(symbol,
timeframe)`)**: busca candles reais (`requestFuturesCandleSnapshot`),
roda `analyzeMarketStructure`/`analyzeSupportResistance`/
`classifyMarketRegime` (motores puros já existentes, zero motor novo),
deriva `direction` do regime real, monta um `TradePlan` real só com
níveis de S/R (sem FVG/OB — buscá-los custaria uma chamada extra por
candidato, não vale para varredura de fundo) com `riskGated: false`
sempre — **honestamente**, porque nenhum Conselho roda para candidatos de
fundo (rodar Conselho completo em ~34 ativos exigiria orderflow ao vivo
de todos simultaneamente, mudança arquitetural maior que "completar o
Radar", fora de escopo aqui). A confluência usa
`computeConfluenceCorridor()` inalterado (Fase 5, zero segunda fórmula),
alimentado só com uma concordância real de regime entre 3 prazos de
referência (`15m/1h/4h`) — uma "confluência-leve", mais fraca que a
leitura de 4 componentes do ativo ao vivo, nunca fabricada como
equivalente. `RadarCandidateScanResult` tem o mesmo formato exato de
`RadarCandidateInput` (`radar-qualification.ts`) — zero mapeamento entre
os dois.

**Orquestração do lote (`App.tsx`)**: `useEffect` próprio, cadência de
5min (mais lenta que o ciclo do ativo — 30s — e o multi-timeframe — 60s:
o Radar é descoberta de contexto, nunca o caminho crítico, LEI 24). Lotes
de 3 candidatos + 2s de respiro entre lotes — o Market Data Bus dedupa
por chave `symbol:timeframe` mas não tem throttle entre chaves
diferentes, então o scanner precisa do próprio limite de concorrência
para não competir por rede com o ciclo do ativo selecionado. Depende de
`chartTimeframe` (não uma ref): trocar o prazo do gráfico cancela
qualquer lote em voo e recomeça no prazo novo — mesma disciplina
fail-closed da Fase 6 (zero staleness na troca de contexto). Exclui
sempre `selectedAsset`: ele já tem Conselho/Trade Plan completo rodando
à parte, escaneá-lo de novo produziria uma segunda leitura mais fraca do
MESMO ativo. Resultado ranqueado substitui a fatia `radarCandidates`
inteira por ciclo (§4 CÉREBRO, `setRadarCandidates`/
`useRadarCandidatesSnapshot`), publicado como `BRAIN.RADAR_CANDIDATES.UPDATED`
pelo orquestrador (mesmo padrão referência-a-referência dos demais
eventos).

**Painel "OPORTUNIDADES" (não "Radar")**: mesmo padrão de
`ChartLayersPanel` (overlay fixed/centered, mesmo shell
cyber-panel/cyber-header), terceiro entry point no rodapé da SideBar
(ícone `Radar` do lucide-react, contagem real dos candidatos qualificados
— nunca um badge decorativo/pulsante, "substitui o botão pulsante" da
diretiva com um número honesto). Título visível deliberadamente NÃO
"Radar": o cockpit já tem um widget real chamado "RADAR DE CONSENSO"
(`CouncilWidget`, motor `consensus-radar.ts`) e uma aba "SCANNER"
(`ScannerWidget`, heurística de %-change de 24h, `scannerData`) — nenhum
dos dois é este módulo; um terceiro rótulo com a mesma palavra
confundiria qual painel o Operador está abrindo. Lista só os candidatos
JÁ qualificados/ranqueados (a fatia da store já vem filtrada por
`rankRadarCandidates`) — o componente só lê e exibe, nunca recalcula
(LEI 24). Cada linha mostra símbolo/prazo/direção (verde `#00ffaa`
LONG, vermelho `#ff0055` SHORT — mesma paleta já usada nos botões de ação
do Trade Plan) + intensidade do Corredor de Confluência como percentual
(nunca rotulada "probabilidade"/"chance", Regra de Ouro 2) + R:R real do
plano. Empty-state honesto quando não há candidatos (nunca um placeholder
fabricado).

**Clique→abrir ativo**: reusa literalmente o mesmo mecanismo do
`SmartOmnibox` (`setMarketMode("CRYPTO")` →
`setSelectedTradFiAsset(null)` → `setSelectedAsset(symbol)`) — trocar
`selectedAsset` sozinho já dispara os efeitos de boot/fetch de candles
existentes, nenhum "centralizar gráfico" precisou de código novo.
"Timeframe recomendado" — esse conceito não existe em nenhum motor real
do organismo hoje; a diretiva já previa esse caso ("senão timeframe
atual") — o timeframe atual é honestamente o MESMO prazo em que o
candidato foi avaliado (o efeito de scan usa `chartTimeframe`), então
nunca há descompasso entre o que foi avaliado e o que o gráfico mostra a
seguir.

**Achado real durante a auditoria de call sites (não um bug)**: o teste
de contagem de `diretriz3-fixes.test.ts` esperava exatamente 4 chamadas
reais a `requestFuturesCandleSnapshot` em `engine-bridge.ts`;
`scanRadarCandidate` somou mais 2 (o candidato em si + o laço de 3 prazos
de referência) — mesmo helper, mesma disciplina de futuros-only, nenhuma
perna de spot nova. Teste atualizado para 6, nunca contornado.

**Verificação real executada**: `tsc --noEmit` limpo · **110 arquivos /
1818 testes** (100%) · `npm run build` ok · `audit-header-maxcontent.mjs`
11 viewports CLEAN via build+preview real · verificação Playwright ao
vivo do painel novo (botão encontrado na SideBar, abre com título
"OPORTUNIDADES", empty-state honesto — este sandbox não tem egress real
à Binance, `net::ERR_TUNNEL_CONNECTION_FAILED` em toda chamada, então
nenhum candidato real qualifica aqui, comportamento fail-closed correto
— fecha ao clicar no X, screenshot capturado). **Limitação honesta**: a
linha de candidato QUALIFICADO (com dados reais) não pôde ser vista ao
vivo neste ambiente sem egress real; a lógica está coberta por
`radar-qualification.test.ts`/`radar-universe.test.ts`/
`confluence-corridor.test.ts` (31 testes reais somados), e o layout da
linha reusa classes Tailwind já visualmente verificadas em outros lugares
do mesmo painel (nunca um padrão visual novo e não testado).

**Backlog que continua real e flagado (não resolvido nesta rodada)**:
visual do Corredor de Confluência no próprio canvas (Fase 5); a
sobreposição parcial entre `confluence-corridor.ts` (Fase 5) e o
`ConvictionReading` de `confluence-engine.ts` já existente (achado de
rodada anterior, ainda não simplificado); migração de consumidores
WidgetContext→store (§6.36); heatmap de liquidação no canvas + Pitchfork
+ Elliott simplificado (Fase 8, §6.38).

### 6.40 OMEGA CORE V-MAX — Fase 5, fechamento real: corrigir a
sobreposição flagada em §6.39 + ligar o Corredor de Confluência ao canvas

Retoma a pendência #49 ("Corredor de Confluência: visual no canvas") e o
achado de §6.39 ("sobreposição parcial... ainda não simplificado") na
mesma rodada — os dois eram, na prática, o mesmo trabalho: a sobreposição
precisava ser corrigida ANTES de dar mais peso visual a um número que já
sabia estar enviesado.

**Achado real (mais grave do que §6.39 havia caracterizado)**: não era
uma sobreposição "parcial". `institutionalScore.score`
(`institutional-score.ts`) é, por construção,
`round(100 * (ConvictionReading.convictionAdjusted ?? conviction))` — uma
cópia reescalada 1:1 da MESMA leitura que `confluence-corridor.ts` v1
também lia via `opinionMass` (bruto, componente do Council) e
`multiTimeframe` (bruto, também já dentro do pool de conviction). Dos 4
"componentes independentes" da v1, 3 mediam fatias do MESMO sinal —
council e multi-timeframe contavam 2x cada (uma vez brutos, uma vez
dentro de institutionalScore), ensemble só contava 1x (escondido dentro
de institutionalScore), e só `obstacleClearance` era genuinamente
ortogonal. A média resultante super-representava concordância de
Council/Multi-Timeframe e sub-representava Ensemble — um viés estatístico
real, não cosmético.

**Correção (contrato v1 → v2, `CONFLUENCE_CORRIDOR_CONTRACT_VERSION`)**:
`ConfluenceCorridorInput`/`ConfluenceCorridorComponents` reduzidos de 4
campos para 2 — `conviction` (a `ConvictionReading` inteira, lida do
Confluence/Conviction Engine já correto, nunca decomposta de novo) +
`obstacleClearance` (inalterado, único componente genuinamente novo).
Zero segunda matemática de consenso, zero dupla contagem. Efeito em
cascata, todos corrigidos no mesmo commit:
- `confluence-engine.ts`: `readMultiTimeframeMember`/`buildConvictionReading`
  passam a aceitar um tipo estrutural mínimo
  (`MultiTimeframeAgreementEntry: {status, confidenceStance}`) em vez do
  `MultiTimeframeMatrix` inteiro — mesmo princípio de acoplamento mínimo
  que `confluence-corridor.ts` já seguia, agora consistente nos dois
  arquivos. Isto libera o scanner do Radar (Fase 7) de fabricar um
  `TimeframeContext` completo (11 campos, a maioria fake) só para
  satisfazer um tipo.
- `engine-bridge.ts` (`scanRadarCandidate`): em vez de alimentar
  `confluence-corridor` com 3 sinais brutos, monta sua própria
  `ConvictionReading` "leve" chamando o MESMO `buildConvictionReading`
  real (ensemble/council `null` honestos — nenhum dos dois roda em
  segundo plano — só o membro Multi-Timeframe é legível) — zero segunda
  fórmula de pool, mesma disciplina fail-closed de sempre.
- `App.tsx`: o `useMemo` de `confluenceCorridor` passa a consumir
  `convictionReading` (já computado, já real) diretamente, em vez de
  redecompor 3 sinais que já estavam dentro dele.

**Visual no canvas (a entrega real desta pendência)**: auditoria antes de
construir (CLAUDE.md item 1) encontrou que um "corredor de confluência"
no canvas **já existe** — `NeuralMarketAuraPlugin.tsx`, cuja largura de
banda (`corridorWidthFactor`) já é descrita no próprio cabeçalho do
arquivo como "a MASSA DE CONVICÇÃO real (Confluence Engine, 0..1)", lida
de `ConvictionReading.conviction` sozinha. Criar um SEGUNDO objeto visual
"corredor" no mesmo gráfico teria violado FASE 4 (consolidação visual:
"um objeto gráfico por evento real") e o teste de evolução visual do
Ω-INFINITY ("aumentar compreensão real, nunca só efeito estético") — dois
corredores parecidos, um conviction-only e um conviction+obstáculo,
teriam confundido mais do que esclarecido. Em vez disso: `ChartWidget`
(App.tsx) passou a ler `confluenceCorridor` (seletor direto da store,
`useConfluenceCorridorSnapshot`) em vez de recomputar `conviction` a
partir de `convictionReading` — a largura do corredor da Aura agora
reflete a MESMA leitura v2 (conviction + obstáculos estruturais reais no
caminho), então um plano com forte concordância entre subsistemas mas
caminho obstruído mostra um corredor mais largo/difuso do que antes,
informação real que a versão anterior descartava.

**Testes**: `confluence-corridor.test.ts` reescrito para o contrato v2
(11 testes, incluindo um teste de não-regressão que trava as chaves
exatas de `components` e barra a reintrodução dos 3 campos sobrepostos);
3 testes de fiação desatualizados corrigidos (`nexus-organism-orchestrator.
test.ts`, `neural-market-aura-wiring.test.ts`, mais 2 asserções de
destructure em `ciborgue-vivo-wiring.test.ts`/`trade-plan-zone-plugin.
test.ts` que citavam `convictionReading` no local exato que saiu do
destructure de `ChartWidget`).

**Verificação real**: `tsc --noEmit` limpo · **110 arquivos / 1817
testes** (100%) · `npm run build` ok · verificação Playwright ao vivo
(boot limpo, screenshot capturado, zero erro de console novo além do
ruído de rede já conhecido deste sandbox sem egress real). Uma Aura
POPULADA (Trade Plan real ativo) não pôde ser vista ao vivo neste
ambiente pela mesma razão já documentada em §6.39 (sem egress real a
Binance) — a lógica nova está coberta pela suíte, e o consumidor
(`NeuralMarketAuraPlugin.tsx`) é código já visualmente verificado em
sessões anteriores, só a FONTE do dado mudou.

**Backlog que continua real (não desta rodada)**: migração de
consumidores WidgetContext→store (§6.36); heatmap de liquidação no
canvas + Pitchfork + Elliott simplificado (Fase 8, §6.38).

### 6.41 OMEGA CORE V-MAX — Fase 8.1: heatmap real de liquidação no canvas

Retoma a pendência flagada em §6.38/§6.40 ("Heatmap de liquidação: feed
real já existe... nunca um heatmap de intensidade por nível de preço no
canvas").

**Honestidade retrospectiva (achado antes de construir)**: o feed real
(`startRealLiquidationFeed`, stream `!forceOrder@arr` da Binance) só tem
eventos DISCRETOS de liquidações que JÁ aconteceram — sem REST
equivalente, sem seed histórico. Isto **não é** o tipo de "heatmap de
liquidação preditivo" que produtos como Coinglass anunciam (mapa de onde
posições alavancadas SERIAM liquidadas) — esse tipo exige distribuição
real de open interest por alavancagem, dado privado que nenhuma exchange
publica. O que foi construído é honestamente retrospectivo: densidade
real de liquidações já executadas nesta sessão, nunca uma previsão.
Documentado explicitamente no cabeçalho de `nexus/liquidation-heatmap.ts`
e do plugin, para nenhum futuro leitor confundir os dois.

**Entregue**:
- `nexus/liquidation-heatmap.ts` (+ 15 testes) — `computeLiquidationHeatmap`
  filtra o feed exchange-wide para o símbolo ativo (`${symbol}USDT`,
  mesma convenção real de `bybit-futures.ts`/`binance-futures-public.js`),
  bucketiza por preço (16 buckets, parâmetro documentado — mais grosso
  que o Volume Profile de propósito, já que liquidações são reais mas
  esparsas), soma `notionalUsd` real por lado (LONG/SHORT). Fail-closed
  com `MIN_EVENTS_FOR_HEATMAP=3` — nunca chama 1-2 pontos isolados de
  "heatmap".
- `chart/LiquidationHeatmapPlugin.tsx` — mesma arquitetura já provada
  (canvas próprio, dirty-flag+rAF, `series.priceToCoordinate` real, fio
  de seda). Barras à ESQUERDA (Volume Profile já ancora à direita) — de
  propósito, para os dois heatmaps por preço nunca se sobreporem
  visualmente (FASE 4, "um objeto gráfico por evento real). Cada barra é
  2 segmentos empilhados (LONG verde + SHORT vermelho, mesma paleta de
  sempre) — magnitude real E composição real no mesmo traço.
- 16ª camada do painel "Camadas do Gráfico" — rótulo deliberado
  "LIQUIDAÇÕES FORÇADAS" (reaproveita o termo já usado no painel de lista
  real "Forced Liquidations"), nunca "LIQUIDATION HEATMAP" — colidiria
  com "LIQUIDITY HEATMAP" (`order_flow_heatmap`, já existente, 2 linhas
  acima no mesmo painel) e confundiria qual camada o Operador liga/
  desliga. Entra no preset "Modo Inteligência" (leitura de mercado/
  estrutura, nunca específica do plano ativo), nunca no "Modo
  Operacional" (deliberadamente enxuto).
- Retenção do feed subiu de 30 para 500 eventos (exchange-wide) — 30
  eventos de TODOS os símbolos raramente sobravam o suficiente para UM
  símbolo específico após o filtro; sem seed histórico, reter mais é a
  única forma real de dar densidade ao heatmap sem fabricar nada. A lista
  "Forced Liquidations" continua mostrando só os 8 mais recentes,
  comportamento inalterado.

**Bug real encontrado e corrigido no mesmo commit (achado pela própria
disciplina de verificação Playwright, não pela suíte)**: `tsc`/`vitest`/
`build` ficaram limpos, mas o app quebrava ao vivo —
`effectiveChartLayerVisibility` (App.tsx) fazia
`layerRelevance[id].relevant` sem guarda; `computeLayerRelevance`
(layer-relevance.ts) só cobre as 15 camadas com regra própria, então
`liquidation_heatmap` (nova, em modo automático por padrão) vinha
`undefined` e quebrava o render inteiro (`Cannot read properties of
undefined`). Corrigido com o MESMO fallback que `ChartLayersPanel` já
usava (`relevance?.relevant ?? true`) — uma camada nova sem regra própria
de relevância fica visível por padrão em modo automático, nunca derruba
o app. `layer-relevance.test.ts` foi atualizado para registrar
`liquidation_heatmap` como gap CONHECIDO (não coberto pelo Relevance
Engine ainda — cobri-lo exigiria passar o `LiquidationHeatmapResult`
inteiro para dentro de `LayerRelevanceInput`, escopo maior que "adicionar
a camada"), e um teste de regressão novo trava o fallback
`?.relevant ?? true` na própria fonte para este bug nunca voltar
silenciosamente.

**Testes**: `tsc --noEmit` limpo · **111 arquivos / 1834 testes** (100%)
· `npm run build` ok · `audit-header-maxcontent.mjs` 11 viewports CLEAN
(rodado DEPOIS da correção do crash — a primeira tentativa, antes da
correção, travou em timeout esperando o gráfico renderizar, exatamente o
sintoma do bug acima) · verificação Playwright ao vivo (boot limpo,
painel "Camadas do Gráfico" mostrando "LIQUIDAÇÕES FORÇADAS" distinto de
"LIQUIDITY HEATMAP", screenshot capturado).

**Backlog que continua real**: uma barra POPULADA do heatmap (com
eventos reais do símbolo ativo) não pôde ser vista ao vivo neste
ambiente sem egress real a Binance — lógica coberta por 15 testes reais;
Pitchfork e Elliott simplificado (Fase 8, ainda precisam de pesquisa real
de metodologia); migração de consumidores WidgetContext→store (§6.36).

### 6.42 EPC OMEGA FINAL — Etapa 1 (auditoria completa de ~20
subsistemas) + Etapa 10 fatia 1 (Liquidity Sweep + Institutional Session
Engine no canvas)

Nova diretiva do Operador (Agente 4/Chief Software Engineer, Prioridade
MÁXIMA, escopo `ipad_runtime/` exclusivo, 22 etapas), começando por sua
própria Etapa 1: "auditar integralmente... classificar cada módulo
IMPLEMENTADO/PARCIAL/AUSENTE... implementar imediatamente tudo que
estiver parcial ou ausente". Dado o tamanho real do que as 22 etapas
pedem (múltiplas features institucionais novas — Footprint, Pitchfork,
Elliott, scanner contínuo de universo inteiro, Chart Integrity Engine com
bloqueio de renderização, dashboard de Organism Health ao vivo — cada uma
razoavelmente uma entrega própria), esta entrada cobre só a Etapa 1
completa mais a primeira fatia real da Etapa 10, seguindo a mesma
disciplina de rodadas escopadas e verificadas já usada em toda a trilha
OMEGA CORE V-MAX (§6.36-§6.41) em vez de uma tentativa atômica de tudo de
uma vez.

**Tabela de auditoria real (Etapa 1)** — evidência própria + 3 agentes
Explore paralelos, read-only:

| Subsistema | Classificação | Evidência |
|---|---|---|
| UnifiedGlobalSnapshot | IMPLEMENTADO | `store/unified-snapshot-store.ts`, Zustand+Immer, 5 domínios |
| Stage Runner | PARCIAL | `nexus/stage-runner.ts` é traçador read-only real (`DATA→CORE_ENGINE→COUNCIL→TRADE_PLAN`), nunca bloqueia, zero wiring em App.tsx/UI — chamado só pelo próprio teste |
| Fusion Engine (Corredor de Confluência) | IMPLEMENTADO | contrato v2 corrigido em §6.40 |
| Core Engine | IMPLEMENTADO | único emissor LONG/SHORT/WAIT, LEI 24 |
| Trade Plan | IMPLEMENTADO | campos ETA/Obstáculos/Conviction vivem em módulos próprios de dono único (`eta-engine.ts`, `TradePlanLevel.obstacleCount`, `institutional-score.ts`) — BE/Trailing já resolvido Council-only em §6 anterior (ORDEM §2) |
| Relevance Engine | IMPLEMENTADO | `nexus/layer-relevance.ts` |
| Organism Orchestrator | IMPLEMENTADO | `nexus/organism-orchestrator.ts` |
| Event Bus | IMPLEMENTADO | `nexus/event-bus.ts` + `gmil/event-bus.ts` (domínios separados de propósito) |
| Engine Bridge | IMPLEMENTADO | `engine-bridge.ts` |
| Conselho | IMPLEMENTADO | 7 agentes reais, linear opinion pool Stone/DeGroot via `src/consensus`; limitação real documentada: OrderflowAgent usa CVD spot MEXC vs resto do Conselho em perp Binance |
| GMIL | PARCIAL | 4/6 categorias com provider real (ONCHAIN/MACRO permanentemente `null` — exigiriam chave de API, proibida) |
| Skills/QUARANTINE | IMPLEMENTADO | 5 engines graduados confirmados contra o filesystem real (doc corrigido nesta entrada, ver abaixo) |
| Voice | IMPLEMENTADO | TTS/STT reais do browser, push-to-talk, `computeAlerts` só reage a transição real de estado |
| Radar/OIH | PARCIAL | v1 real (§6.38/§6.39), universo hoje é a lista curada `asset-universe.default.json` (~30 símbolos Binance), não "todos os ativos públicos" |
| Heatmap | IMPLEMENTADO | 2 reais (order flow + liquidação, §6.41) |
| Chart (camadas) | IMPLEMENTADO (núcleo) | 18 camadas após esta entrada — ver checklist Etapa 8 abaixo |
| HUD | IMPLEMENTADO | padrão widget, não um módulo único nomeado |
| Smart Labels (Etapa 13) | IMPLEMENTADO | `chart/label-compaction.ts` |
| Adaptive Zoom (Etapa 14) | AUSENTE | zero sistema deliberado — só o subproduto geométrico passivo de `priceToCoordinate` |
| Market Regime Detector (Etapa 15) | PARCIAL | motor real (Wilder ADX/DI + Bollinger, `market-regime/regime-engine.js`), mas nunca alimenta `layer-relevance.ts` |
| Data Quality Monitor (Etapa 16) | PARCIAL | fragmentado — 3 motores de qualidade independentes (Market Data Bus, GMIL, `data-sufficiency.js`), sem vocabulário/limiar único |
| Chart Integrity Engine (Etapa 17) | AUSENTE | nada bloqueia render em desync Snapshot→TradePlan→HUD→Chart→Voice |
| Auto Layout (Etapa 18) | PARCIAL | `audit-header-maxcontent.mjs` real (11 viewports) cobre só TopBar + 1 painel, não a área do gráfico/grid completo |
| Organism Health (Etapa 19) | PARCIAL | `self-diagnostics.ts` é sob-demanda (clique), não contínuo; `organism-orchestrator.ts`/`useHealthSnapshot()` já é contínuo em paralelo |

**Checklist Etapa 8 (camadas do gráfico)** — dos itens exaustivos pedidos:
Order Blocks/FVG/BOS/CHOCH/EMA/VWAP/Trend Channel/Liquidity Zones/Supply-
Demand/Heatmap/Volume Profile/POC/HVN/LVN/CVD/Centro Gravitacional/
Corredor de Confluência/Harmônicos/Fibonacci/Linhas estruturais —
IMPLEMENTADOS. Forecast — PARCIAL (existe em `realCycle.forecast`, só em
lista de texto no HUD, nunca no canvas). OI/Funding — AUSENTES como
camada do gráfico (dado real existe via GMIL/cross-exchange, nunca
desenhado no canvas). ZigZag — PARCIAL (helper interno em
`fractal-swings.js`, nunca um overlay próprio). Pitchfork/Andrews
Pitchfork/Elliott/Triângulos — AUSENTES (zero ocorrência no código-fonte).
Wolfe Waves — IMPLEMENTADO (`harmonic-patterns.ts` + linha EPA no
canvas). Dynamic Trend Projection — projeção para o futuro é uma recusa
DELIBERADA e documentada (`trend-channel-engine.ts`: extrapolação OLS
chamada estatisticamente não-confiável), não uma lacuna esquecida.
Institutional Volume Zones — sem conceito distinto do Volume Profile já
real.

**Checklist Etapa 10 (novas camadas institucionais)**: Liquidity Sweep —
PARCIAL antes desta entrada (detecção real em `trap-detection.ts`, zero
marca no canvas — ver entrega abaixo). Institutional Session Engine —
PARCIAL antes desta entrada (`market-session.ts` real, só texto no
header — ver entrega abaixo). Liquidity Voids — AUSENTE (LVN existente é
percentil dentro do histograma negociado, não um vazio de preço real).
Volume Clusters — AUSENTE como conceito distinto (duplicaria Volume
Profile). Cross Timeframe Liquidity — AUSENTE, exclusão DELIBERADA
documentada em `multi-timeframe-engine.ts`. Footprint — AUSENTE (zero
ocorrência).

**Discrepância real encontrada, sinalizada honestamente (Disciplina de
trabalho CLAUDE.md item 1)**: a Etapa 11 pede radar sobre "todos os
ativos públicos da MEXC", mas todo o pipeline real de candle/estrutura
deste app roda sobre Binance Futures (fonte primária declarada no próprio
CLAUDE.md; `scanRadarCandidate` usa exclusivamente
`requestFuturesCandleSnapshot`, uma função só-Binance). Existe hoje
`omnibox/binance-symbols.ts` — fetch real, testado, já em produção
(SmartOmnibox) do universo INTEIRO de perpétuos USDT-M da Binance — uma
base direta para expandir o universo do Radar além dos ~30 símbolos
curados. Um scan literal MEXC-wide exigiria construir do zero um
pipeline paralelo de descoberta de símbolos + candles MEXC, nunca
auditado neste repositório. Etapa 11 fica deliberadamente FORA desta
entrada — decisão de escopo real demais para decidir sem confirmar com o
Operador qual das duas leituras é a pretendida.

**Correção de documentação (achado da própria auditoria)**:
`src/research/QUARANTINE.md` dizia "apenas os 4 engines graduados" desde
antes de `bos-choch-engine.js` graduar (2026-07-12) — a tabela real
sempre teve 5. Resumo corrigido nesta entrada.

**Entregue (Etapa 10, fatia 1)**:
- `nexus/trap-detection.ts` → contrato v2: `TrapSignal.sweptPrices:
  number[]` expõe o preço real já em escopo dentro de
  `detectInstitutionalTraps` (zero recálculo, zero parsing das strings de
  `evidence`) para STOP_HUNT_TOPO/FUNDO; `[]` honesto em
  ABSORCAO_ANOMALA (sem preço-âncora único real).
- `chart/EnhancedChart_110_Percent.tsx` → nova price line âmbar
  (`rgba(255, 191, 0, 0.85)`, cor nunca usada por EQH/EQL roxo nem OB/FVG
  verde/vermelho) no preço real de cada sweep — a zona EQH/EQL varrida
  hoje simplesmente some da tela (filtro `!swept`) sem deixar rastro do
  momento do sweep; agora deixa.
- `nexus/market-session.ts` → `computeSessionBoundaries(candles)`, função
  pura nova: varre a série real e devolve só pontos de TRANSIÇÃO (nunca
  uma sessão por candle). Propriedade emergente honesta (não um caso
  especial escrito à mão): candles diários+ (open sempre 00:00 UTC na
  Binance) caem sempre na mesma janela candle a candle, então a função
  devolve `[]` sem precisar de limiar de timeframe hardcoded.
- `chart/MarketSessionBandsPlugin.tsx` (novo) — mesma arquitetura de
  overlay já provada 2x (canvas próprio, dirty-flag+rAF, fio de seda):
  linha vertical 1px discreta em cada transição real + rótulo compacto
  (texto pula, nunca a linha, quando dois rótulos ficam a menos de 56px).
- 17ª/18ª camadas do painel "Camadas do Gráfico": "LIQUIDITY SWEEP" e
  "SESSÕES (ÁSIA/LONDRES/NY)" — entram no preset "Modo Inteligência"
  (leitura de mercado/estrutura, mesma lógica das camadas anteriores),
  registradas em `KNOWN_UNCOVERED_LAYERS` (`layer-relevance.test.ts`) —
  mesmo gap honesto documentado que `liquidation_heatmap` já tinha
  (§6.41): visíveis por padrão em modo automático via fallback
  `?.relevant ?? true`, cobertura própria do Relevance Engine fica para
  uma rodada dedicada.

**Testes**: `tsc --noEmit` limpo · **111 arquivos / 1845 testes** (100%,
+11 novos: 4 para `sweptPrices`, 7 para `computeSessionBoundaries`) ·
`npm run build` ok · verificação Playwright ao vivo (boot limpo, painel
"Camadas do Gráfico" mostrando as 2 camadas novas + as 16 anteriores sem
regressão, toggle clicado sem crash, zero erro de console fora do ruído
de rede conhecido do sandbox).

**Backlog honesto desta entrada**: Etapas 2-9, 11-21 completas (a auditoria
acima é a Etapa 1; Etapa 10 tem só a fatia 1 de 6 conceitos, as outras 4
seguem AUSENTES); barra populada de sweep/sessão não pôde ser vista ao
vivo com dado real neste sandbox sem egress a Binance (mesma limitação
conhecida de toda a trilha, lógica coberta por 11 testes reais);
discrepância MEXC/Binance da Etapa 11 aguardando decisão do Operador;
cobertura do Relevance Engine para as 3 camadas sem regra própria
(`liquidation_heatmap`/`liquidity_sweep`/`market_sessions`) continua uma
rodada própria futura.

### 6.43 ADITIVO DE EXECUÇÃO (pós PR #14) — Etapa 1: Market Data Adapter
(BinanceProvider + MEXCProvider)

Resposta direta à discrepância MEXC×Binance sinalizada em §6.42: o
Operador respondeu com um aditivo de 15 etapas cuja Etapa 1
("PRIORIDADE ABSOLUTA") resolve a ambiguidade explicitamente — "Não
substituir Binance por MEXC. Não criar um pipeline paralelo para MEXC.
Criar uma camada única de abstração", arquitetura `Radar → Market Data
Adapter → Provider Ativo → UnifiedGlobalSnapshot → Fusion Engine → Core
Engine`, preparada para Bybit/OKX/Hyperliquid futuros. Etapa 9 do mesmo
aditivo (Radar MEXC-wide) depende explicitamente desta Etapa 1 estar
pronta primeiro — por isso esta é a fatia escolhida para a rodada
atual, mesma disciplina "auditar antes de construir" de sempre.

**Achado real da auditoria (antes de construir)**: o Market Data Bus
(`market-data-bus/bus.js`) já era agnóstico de exchange desde a Fase B —
`requestSnapshot({..., collect})` sempre recebeu `collect` como função
INJETADA pelo chamador, nunca hardcoded dentro do Bus. O que faltava não
era o Bus, era (1) um segundo `collect` real para MEXC — só existia o de
Binance — e (2) um lugar ÚNICO que resolvesse "qual `collect` uso",
hoje espalhado como import direto de `collectBinanceFuturesKlines` em
cada call site real (2 em `engine-bridge.ts`:
`requestFuturesCandleSnapshot`, o ciclo real do Core Engine/gráfico; e
`getOlderChartCandles`, a paginação histórica que bypassa o Bus por
design). Construir o Adapter sem essa auditoria teria arriscado duplicar
o Bus inteiro — exatamente o "segundo pipeline" que a própria diretiva
proíbe.

**Pesquisa real antes de implementar (CLAUDE.md item 2)**: a
documentação oficial da API MEXC Contract (`mexcdevelop.github.io/
apidocs/contract_v1_en`, `www.mexc.com/api-docs/futures/market-
endpoints`) bloqueou fetch direto nesta sessão (HTTP 403 nas duas).
Endpoint/schema foram corroborados por múltiplas fontes secundárias
independentes (a collection Postman oficial `mexcdevelop/mexc-api-
postman`, buscas cruzadas) — achado real e documentado no cabeçalho do
conector: a resposta MEXC é um **objeto de arrays paralelos**
(`{success, code, data: {time[], open[], high[], low[], close[],
vol[]}}`), nunca array-de-arrays como a Binance; `data.time` vem em
**segundos** enquanto o parâmetro de query `end` é em **milissegundos**
— assimetria real da API, não um erro deste conector. Nunca verificado
ao vivo neste sandbox (zero egress a exchanges) — mesma ressalva já
documentada por `binance-futures-public.js` para si mesmo: se o schema
real vier diferente, os validadores falham visivelmente
(`BLOCKED_BY_SCHEMA`), nunca silenciosamente errado.

**Entregue**:
- `js/real-data/mexc-futures-public.js` (novo) — sonda real MEXC
  Contract, candles-only (funding/mark price da MEXC já tinham sonda
  própria e independente em `cross-exchange/mexc-futures.ts`, cross-
  check consultivo — zero duplicação aqui). Mapa real de timeframe→enum
  MEXC (`Min15`/`Hour4`/...); timeframe sem mapeamento falha fechado
  (`BLOCKED_BY_SCHEMA`) em vez de adivinhar um enum inexistente.
- `market-data-bus/mexc-futures-candle-connector.js` (novo) — irmão
  direto de `binance-futures-candle-connector.js`, mesmo contrato de
  `collect()`; aceita e remove tanto o sufixo `-PERP` (herdado da
  convenção Binance) quanto `-MEXC` (novo) do parâmetro de símbolo antes
  de chamar a API real — nunca deixa um sufixo de cache-key vazar para
  fora, mesma disciplina que corrigiu o bug real documentado em
  `binance-futures-candle-connector.js`.
- `market-data-adapter.ts` (novo, `ramber-ui/src/`) — `MarketDataAdapter`
  real: `getMarketDataProvider(id?)` resolve `BinanceProvider`/
  `MEXCProvider`, default `BINANCE` explícito. Provider é PARÂMETRO por
  chamada, nunca um toggle global mutável — o risco que este projeto
  mais evita é o ciclo de decisão real trocar de fonte silenciosamente.
- `engine-bridge.ts` — os 2 call sites reais (`requestFuturesCandleSnapshot`,
  `getOlderChartCandles`) agora resolvem via
  `getMarketDataProvider('BINANCE').collect` em vez de importar
  `collectBinanceFuturesKlines` diretamente — mesmo dado real, zero
  mudança de comportamento (refatoração pura de indireção, confirmada
  por Playwright ao vivo pós-mudança). `history-capture.js`
  (laboratório quarantined, `returnEvidence:true`) mantém seu import
  direto — consumidor genuinamente diferente, fora do escopo do Adapter.

**Nota de arquitetura para a Etapa 9 (Radar MEXC-wide, ainda não
construída)**: a chave de cache do Bus é `${symbol}:${timeframe}`, sem
conhecimento de provider — dois providers pedindo o mesmo par
colidiriam na mesma entrada e poderiam misturar candles de duas
exchanges sob uma única chave. Documentado no próprio
`market-data-adapter.ts`: um futuro caller MEXC deve usar um sufixo de
cache-key PRÓPRIO (`-MEXC`, já suportado pelo conector) para nunca
colidir com a entrada Binance do mesmo ativo.

**Testes**: `tsc --noEmit` limpo · **114 arquivos / 1868 testes** (100%,
+23 novos: 9 para o schema real MEXC, 7 para o conector MEXC, 7 para o
Adapter) · `npm run build` ok · verificação Playwright ao vivo pós-
refatoração (boot limpo, painéis "Camadas do Gráfico"/"OPORTUNIDADES"
abrindo/fechando, troca de aba, zero erro de console fora do ruído de
rede conhecido do sandbox) — a mais importante desta entrada, já que o
refactor toca os 2 call sites reais do ciclo crítico do gráfico/Core
Engine.

**Backlog honesto**: Etapas 2-15 do aditivo completas (Chart Integrity
Engine, Adaptive Zoom, Liquidity Voids, Volume Clusters, Cross
Timeframe Liquidity, Footprint condicional, Pitchfork/Elliott/
Triângulos/Projeções Dinâmicas, Radar MEXC-wide via este Adapter, Data
Quality Monitor unificado, Market Regime→Relevance Engine, Organism
Health, Auto Layout, confirmação de responsabilidade do Relevance
Engine, auditoria final); MEXCProvider construído mas ainda não
CONSUMIDO por nenhum caller real (o Radar continua no universo curado
Binance de sempre — ligá-lo à Etapa 9 é a próxima fatia natural);
MEXCProvider não pôde ser exercitado contra a API real neste sandbox
(zero egress) — lógica coberta por 16 testes reais com fetch mockado,
igual à disciplina já usada para o conector Binance.

### 6.44 MASTER EXECUTION DIRECTIVE (MED) — reconciliação + ADITIVO V-MAX
Etapa 9 (infraestrutura): MEXC symbol-universe + Radar provider-aware

O Operador enviou um novo documento mestre ("MED") de escopo muito
amplo, sobrepondo fortemente a EPC OMEGA FINAL (§6.42) e o ADITIVO
V-MAX (§6.43) já em andamento — organismo único, Snapshot único, Fusion
Engine nunca decide, Core Engine único emissor, ferramentas gráficas/
institucionais, Radar Global, universalização, performance, testes,
documentação. Inclui uma "Carta Branca Controlada" explícita: liberdade
para escolher arquitetura superior à literal, desde que LEI 24/
READ_ONLY/FAIL_CLOSED/Organismo Único/Snapshot/Core Engine/zero
regressões permaneçam intactos.

**Decisão de execução**: em vez de abrir um 3º checklist paralelo ao
já tracked (EPC OMEGA FINAL Etapas 2-21, ADITIVO V-MAX Etapas 2-15), o
MED foi RECONCILIADO com o backlog existente — é a mesma direção geral
reafirmada num nível mais alto, não uma lista de tarefas atômicas
distinta. Usando a própria "Carta Branca" do documento: uma auditoria
LEVE (não uma repetição da auditoria completa de §6.42, feita há 2
rodadas nesta mesma sessão) confirmou 2 achados honestos que a redação
do MED presumia diferente:

- **Harmônicos (Gartley/Bat/Butterfly/Crab/Shark/Cypher)**: já 100%
  implementados — `nexus/harmonic-patterns.ts`'s `HarmonicPatternName`
  cobre os 6 nomeados pelo MED mais ABCD e Wolfe. O MED pedia
  "adicionar quando matematicamente compatíveis"; já estavam.
- **Auto Fibonacci**: já existe — `nexus/fibonacci-confluence.ts`
  (Matriz de Confluência, auto-detectada sobre swings reais, não
  desenho manual).

Genuinamente ausentes (confirmado, não presumido): Kill Zones, SMT
Divergence (o próprio MED já qualifica "quando suportado" — SMT
tipicamente exige correlação entre ativos, que este app não computa
hoje), Andrews Pitchfork, Market Structure Projection, Institutional
Volume Zones como conceito distinto do Volume Profile.

**Achado próprio corrigido no mesmo commit**: `mexc-futures-public.js`
(§6.43) usava o host `contract.mexc.com` para klines, baseado em fontes
secundárias — mas `cross-exchange/mexc-futures.ts` (já real, já em
produção, pesquisado numa rodada ANTERIOR desta mesma sessão) usa
`api.mexc.com` para o MESMO family de endpoint `/api/v1/contract/*`.
Padronizado em `api.mexc.com` — o host com maior confiança real
disponível neste repositório; `contract.mexc.com` nas buscas
provavelmente refletia o domínio do SITE, não da API.

**Entregue — infraestrutura para ADITIVO V-MAX Etapa 9 (Radar Global/
OIH sobre MEXC)**:
- `omnibox/mexc-symbols.ts` (novo) — irmão direto de
  `binance-symbols.ts`: `fetchMexcUsdtSymbols()` real via
  `GET /api/v1/contract/detail` (público), extração pura testável sem
  rede. Honestidade documentada: ao contrário do filtro
  `status === "TRADING"` da Binance (bem confirmado), a MEXC não tem um
  campo de estado equivalente com a mesma confiança de pesquisa —
  filtro usa só os 2 campos reais corroborados (`isHidden`/
  `apiAllowed`), nunca um valor de enum adivinhado.
- `engine-bridge.ts` — `scanRadarCandidate` ganhou 3º parâmetro
  `provider: MarketDataProviderId = 'BINANCE'` (default preserva 100%
  o comportamento de sempre). Novo helper interno
  `requestRadarCandleSnapshot` (irmão PROVIDER-AWARE de
  `requestFuturesCandleSnapshot`, que permanece intocada e 100%
  Binance) resolve o sufixo de cache-key por provider (`-PERP` Binance,
  `-MEXC` MEXC) — nunca deixa dois providers colidirem na mesma entrada
  do Bus. `RadarCandidateScanResult` ganhou o campo `provider` —
  honestidade de proveniência (um candidato MEXC e um Binance do mesmo
  ticker são leituras de fontes genuinamente diferentes).

**Deliberadamente NÃO feito nesta entrada**: wiring do loop de scan em
App.tsx para varrer o universo MEXC inteiro continuamente. Mesmo
precedente já aprovado pelo Operador na construção original do Radar
(FASE 7 v1, `AskUserQuestion`): "varredura em segundo plano (Workers/
fila/cache/painel no header) fica para rodada própria" — a MEXC pode
ter centenas de símbolos, e decidir cadência/fila/throttle de rede sem
isso virar um problema de performance é uma decisão arquitetural que
merece sua própria rodada cuidadosa, não um anexo apressado a este
commit (mesmo princípio da Regra de Ouro 6 aplicado aqui).

**Testes**: `tsc --noEmit` limpo · **115 arquivos / 1882 testes**
(100%, +14 novos: 11 para `mexc-symbols.ts`, 3 para
`requestRadarCandleSnapshot`/contagem de call sites) · `npm run build`
ok · verificação Playwright ao vivo (boot, painéis, zero regressão).

**Backlog honesto**: o wiring real do scan MEXC-wide (a próxima fatia
natural — universo real via `fetchMexcUsdtSymbols` + chamadas
`scanRadarCandidate(symbol, tf, 'MEXC')` + exibição do provider no
painel "OPORTUNIDADES") continua pendente, junto de todas as demais
Etapas do ADITIVO V-MAX (2-8, 10-15) e da EPC OMEGA FINAL (2-9, 11-21).
Kill Zones/SMT Divergence/Andrews Pitchfork/Market Structure Projection
somam-se à lista já real de AUSENTES (Liquidity Voids, Volume Clusters,
Cross Timeframe Liquidity, Footprint, Chart Integrity Engine, Adaptive
Zoom).

### 6.45 ADITIVO EPC FINAL V-MAX — Radar Global concluído: scan MEXC
real ligado no painel "OPORTUNIDADES"

Terceira diretiva ampla do Operador na mesma trilha (após EPC OMEGA
FINAL §6.42 e a MED §6.44), reafirmando "Radar Global: concluir
completamente" e confirmando — quase literalmente — a arquitetura
Provider-layer já construída em §6.43/§6.44 (seção MEXC×Binance do
documento: "Market Provider → Binance ou MEXC → Unified Snapshot →
Fusion → Core... nunca duplicar o restante da arquitetura"). Toda a
infraestrutura (MEXCProvider, `mexc-symbols.ts`, `scanRadarCandidate`
provider-aware) já existia de §6.43/§6.44 — esta entrada é o wiring
real que faltava.

**Decisão de execução**: dado que esta 3ª diretiva pede explicitamente
para concluir o que já estava identificado como "próxima fatia natural"
na entrada anterior, e reforça a MESMA arquitetura já escolhida, a
execução seguiu direto para o wiring — sem reabrir a auditoria (feita 3
rodadas atrás e ainda válida).

**Decisão de performance (própria, dentro da Carta Branca)**: a MEXC
pode ter centenas de contratos USDT-M, muito além dos ~30 do universo
curado Binance. Escanear TODOS a cada ciclo de 5min (mesmo lote de 3/
2s já real) estouraria a janela do próprio timer que dispara o ciclo
seguinte. Em vez de um scan "tudo de uma vez" ou um segundo timer
concorrente (que violaria a instrução explícita "nunca duplicar o
restante da arquitetura"), o MESMO efeito/timer/lote já existente ganhou
uma segunda perna: pagina o universo MEXC em janelas de
`RADAR_MEXC_PAGE_SIZE=30` símbolos por ciclo, cursor round-robin
(`radarMexcCursorRef`) avançando e recomeçando ao fim da lista — o
universo inteiro é coberto ao longo de várias passagens (dezenas de
minutos, não segundos), sem nunca inflar a duração de um único ciclo
nem duplicar o mecanismo de scan.

**Entregue**:
- `App.tsx` — novo efeito (mount-once) busca `fetchMexcUsdtSymbols()`
  uma vez, guarda em ref (não state — nenhum componente precisa
  re-renderizar quando a lista chega). O efeito de scan já existente
  ganhou a 2ª perna descrita acima: depois do lote Binance de sempre,
  pagina o universo MEXC com `scanRadarCandidate(symbol, timeframe,
  'MEXC')`, mesclando os resultados no MESMO `qualified[]` antes de
  `setRadarCandidates` — um único `setRadarCandidates` por ciclo, nunca
  duas escritas.
- `nexus/radar-qualification.ts` — `RadarCandidateInput`/
  `RadarQualificationResult` ganharam o campo `provider`
  (passthrough puro, nunca um critério de qualificação — testado
  explicitamente: mesmo candidato, mesmo resultado, independente da
  exchange).
- Painel "OPORTUNIDADES" (`RadarPanel`) — texto atualizado ("Binance +
  MEXC"), `key` do card agora inclui `provider` (sem isso, um candidato
  BTC via MEXC e um BTC via Binance no mesmo timeframe colidiriam na
  mesma chave React), e cada card mostra a exchange real ao lado do
  timeframe — um candidato MEXC e um Binance do mesmo ticker são
  leituras genuinamente independentes, nunca deduplicadas (mesmo
  princípio já usado pelos cross-checks Bybit/OKX/MEXC existentes).

**Testes**: `tsc --noEmit` limpo · **115 arquivos / 1885 testes**
(100%, +3 novos: passthrough de `provider` em
`radar-qualification.test.ts`) · `npm run build` ok · verificação
Playwright ao vivo (boot limpo, painel "OPORTUNIDADES" mostrando o
texto atualizado, estado vazio honesto — sandbox sem egress real —,
fechamento correto, zero erro de console fora do ruído de rede
conhecido).

**Backlog honesto**: Kill Zones, SMT Divergence, Andrews Pitchfork,
Market Structure Projection, Liquidity Voids, Volume Clusters,
Footprint, Dynamic Institutional Zones (lista priorizada pela própria
diretiva, ainda toda pendente); demais Etapas do ADITIVO V-MAX (2-8,
10-15) e da EPC OMEGA FINAL (2-9, 11-21); cobertura do Relevance Engine
para as camadas sem regra própria; migração de consumidores
WidgetContext→store. Uma página REAL de candidatos MEXC (com dado
populado) não pôde ser vista ao vivo neste sandbox (zero egress) —
lógica coberta por testes reais, mesma limitação de sempre.

### 6.46 ORDEM DIRETA DE EVOLUÇÃO CONTÍNUA — Modo Arquiteto-Chefe: 1º
ciclo (CI + auditoria de performance)

Quarta diretiva ampla do Operador, com uma mudança real de enquadramento:
em vez de pedir um checklist novo, pede para a sessão atuar
continuamente como "Arquiteto-Chefe" — auditar e evoluir sem esperar um
próximo prompt item-a-item, priorizando consistência/simplicidade sobre
quantidade de funcionalidade. Este é o 1º ciclo sob esse modo.

**CI (fechamento do ciclo anterior)**: o job `deploy` falhou em
`tests/data-quality.test.ts` (métrica de disponibilidade da fonte,
`0.5` esperado vs `1` recebido). Investigação real: nem o teste nem
`quality-engine.js`/`quality-monitor.js`/`bus.js` foram tocados em
nenhum commit desta sessão (confirmado via `git log`); a matemática de
`scoreAvailability` é puramente síncrona sobre um array em memória, sem
relógio/timer — determinística por construção para o cenário do teste
(2 chamadas sequenciais `await`adas). 8 execuções locais repetidas
passaram limpo, mesmo resultado de toda verificação anterior desta
sessão. Diagnóstico: falha transitória do runner de CI, não uma
regressão real. Re-run disparado via `rerun_failed_jobs` — voltou
`conclusion: success`, confirmando o diagnóstico.

**Auditoria de performance (achado real, verificado, sem regressão)**:
todo build desta sessão mostrava `llm-worker-*.js` (~6MB) e
`llm-bridge-*.js` (~5.9MB) — muito maiores que o bundle principal
(~845KB) — nunca investigado até agora. Verificação real (não só
leitura de comentário): `dist/index.html` do build mais recente tem
exatamente 1 `<script>`, referenciando só o bundle principal — os 2
chunks LLM não aparecem no boot. Causa raiz confirmada no código-fonte:
`llm-bridge.ts` (que importa `@mlc-ai/web-llm`, o runtime WebGPU do
Núcleo Neural opt-in) só entra em `App.tsx` via `import type` (custo
zero) e `await import(...)` dentro do handler de ativação do widget —
nunca um import estático de valor. **Conclusão: não é um gargalo, é
uma arquitetura de code-splitting já correta** (mesma garantia que
`production-seal.test.ts` já travava do lado do service worker —
precache exclui os chunks LLM; faltava travar do lado do boot em si).

**Entregue**: `tests/production-seal.test.ts` ganhou 3 testes novos que
travam essa garantia na fonte — nenhum import estático de valor de
`llm-bridge` em `App.tsx`, a ativação real passa por `import()`
dinâmico (≥2 call sites), e o `dist/index.html` real (quando existe no
ambiente de teste) tem exatamente 1 `<script>` sem menção a `llm-`.
Protege contra uma regressão futura real: alguém adicionar um import
estático por engano colaria ~12MB no boot de todo visitante sem o
Operador ter pedido o Núcleo Neural.

**Testes**: `tsc --noEmit` limpo · **115 arquivos / 1888 testes**
(100%, +3 novos) · suíte completa re-executada (nenhum arquivo de
produção tocado nesta entrada, só o teste novo).

**Backlog honesto (mesmo desta entrada — nenhuma implementação nova de
feature, por design deste ciclo)**: Data Quality Monitor unificado
(ADITIVO V-MAX Etapa 10) segue sendo o candidato mais concreto de
"eliminar redundância real" já documentado (3 motores de qualidade
independentes — Market Data Bus, GMIL, `data-sufficiency.js`) — não
executado nesta entrada por ser uma mudança que toca 3 sistemas com
domínios genuinamente distintos; avaliado e deliberadamente adiado para
uma rodada própria e cuidadosa, mesmo padrão já usado para toda
mudança de escopo grande nesta sessão (Regra de Ouro 6). Migração
WidgetContext→store, Ferramentas Institucionais (Kill Zones/SMT
Divergence/Andrews Pitchfork/etc.) e as demais Etapas do ADITIVO V-MAX/
EPC OMEGA FINAL continuam pendentes.

### 6.47 Modo Arquiteto-Chefe: 2º ciclo — Data Quality Monitor unificado
(ADITIVO V-MAX Etapa 10)

Confirmação breve do Operador ("Agora você faz a evolução que tem que
fazer, né?") para prosseguir com o alvo já mapeado no fechamento de
§6.46. Executado exatamente como escopado ali: uma camada de LEITURA
sobre os 3 motores de qualidade reais, nunca uma fusão da matemática
deles (Regra de Ouro 4).

**Problema identificado**: 3 motores de qualidade independentes
(Market Data Bus `quality-engine.js`, GMIL `quality-engine.ts`,
`data-sufficiency.js`) cada um com seu próprio vocabulário/escala —
zero forma comum de o Operador ler "está tudo bem?" num único relance.
Auditoria dos 3 pontos de consumo achou 2 lacunas REAIS adicionais,
nenhuma delas o foco original do pedido: (1) `research.data_sufficiency`
— um score 0-100 real de cobertura de campos, computado em TODO ciclo
por `buildResearchEngineFrame` — nunca saía de `engine-bridge.ts`; era
usado só internamente para rebaixar `confidence` e depois descartado.
(2) GMIL já computa um `weight` 0-1 real por provedor
(`ProviderRuntimeSnapshot.weight`, mesmo `computeQuality` que o
consensus-engine usa), mas nenhum consumidor sintetizava isso numa
leitura única de saúde do GMIL. (3) Bug real em `self-diagnostics.ts`:
`dataQualityClassification === 'DADOS_INSUFICIENTES'` (uma string real
que `classifyScore()` do Bus pode emitir) caía no ramo `quality ? OK :
...` — o relatório de autodiagnóstico reportava "tudo OK" para uma
fonte sem dado real, o oposto do que a Ordem "Ciborgue Vivo" §3 pede.

**Análise realizada**: os 3 motores medem coisas genuinamente
diferentes (stream de candles vs contexto global vs cobertura de
campos da Evidence) e já são deliberadamente separados (ver o próprio
header de `quality-engine.js`: "NÃO substitui nem toca o do GMIL:
domínios distintos") — fundir a matemática violaria Regra de Ouro 4 e
destruiria informação real (ex.: a classificação do Bus considera
streak de falhas consecutivas, não só o score composto). A solução
honesta é uma camada de vocabulário por cima, não uma 4ª fonte de
verdade: os limiares normalizados (0.6/0.25) foram escolhidos para
espelhar EXATAMENTE o corte que `classifyScore()` do Bus já usa
(`QUARANTINE_THRESHOLD = 0.25`), então a compressão para 4 estados
nunca diverge do que o Bus já decidiu — provado por um teste real que
varre um `classifyScore` do Bus e cruza contra `classifyWeight` para a
mesma amostra de scores.

**Solução aplicada**:
- `nexus/data-quality-vocabulary.ts` (módulo folha, zero imports):
  `DataQualityLabel = 'OK' | 'WARNING' | 'FAIL' | 'DADOS_INSUFICIENTES'`
  + `classifyBusQuality(classification)`, `classifyWeight(weight 0-1)`,
  `classifySufficiencyScore(score, maxScore=100)` + `DATA_QUALITY_COLOR`
  (mesma paleta que `TelemetryHealthWidget` já usava ad-hoc).
- `engine-bridge.ts`: `RealCycleResult.dataSufficiency` — passthrough
  verbatim de `research.data_sufficiency` (shape snake_case preservado,
  nada reconstruído).
- `App.tsx` (`TelemetryHealthWidget`, painel SYSTEM HEALTH): passou a
  ler `gmilProviders` do MESMO `WidgetContext` (zero 2ª assinatura de
  `useGmilSnapshot`, mesma disciplina já documentada no comentário
  original do hook); 2 linhas novas — "SUFICIÊNCIA DE DADOS"
  (`score/max_score` real) e "QUALIDADE GMIL (CONTEXTO)" (média real de
  `weight` sobre provedores que já tentaram ≥1 fetch — `lastReading !=
  null`; provedor nunca-rodado não conta como "ruim", só como "ainda
  não medido"); a linha "QUALIDADE DA FONTE (BUS)" existente trocou seu
  ternary ad-hoc pelo classificador/paleta compartilhados (mesmo texto,
  mesmas cores — zero regressão visual).
- `self-diagnostics.ts`: o achado (2) acima corrigido reusando
  `classifyBusQuality` em vez de reimplementar o corte
  QUARENTENA/DEGRADADA — a lacuna do `DADOS_INSUFICIENTES` fecha por
  construção (não existe mais um 4º caso não-tratado).

**Impacto esperado**: Operador ganha 2 sinais reais que já existiam
"escondidos" (suficiência de dados por trás de `confidence`, saúde
agregada do GMIL) sem nenhum cálculo novo; qualquer alerta de qualidade
futuro (Bus/GMIL/Suficiência/o que vier depois) usa o MESMO vocabulário
e a MESMA paleta por construção, em vez de cada consumidor inventar sua
própria leitura ad-hoc (exatamente a "consistência matemática" e
"integridade arquitetural" que a Ordem Direta prioriza acima de feature
nova).

**Impacto observado (verificação real ao vivo, Playwright)**: painel
SYSTEM HEALTH aberto (gaveta "Core Intelligence") — as 3 linhas
renderizam; "SUFICIÊNCIA DE DADOS" mostra `AWAITING` honesto (a mesma
constante `AWAIT` que toda outra linha do painel já usa; nenhum ciclo
real completo neste sandbox sem egress de rede), e "QUALIDADE
GMIL (CONTEXTO)" mostra um valor REAL computado ao vivo (`55% · 4/4
fontes`, evoluindo de `47% · 3/4` para `55% · 4/4` conforme mais
provedores tentaram) — a agregação funciona ponta a ponta mesmo neste
ambiente restrito, porque o circuito/peso de cada provedor GMIL não
depende de uma resposta de rede bem-sucedida para produzir um número
honesto. Zero erro novo de console (só o ruído já documentado:
`ERR_TUNNEL_CONNECTION_FAILED`, WS para `fstream.binance.com`,
`pageerror: Event`).

**Riscos conhecidos**: os limiares 0.6/0.25 são compartilhados entre 3
domínios com escalas nativas diferentes — se um domínio futuro tiver
uma distribuição de score muito diferente das outras (ex.: quase nunca
passa de 0.5), o rótulo unificado pode ficar sistematicamente pessimista
para esse domínio especificamente; nenhuma evidência disso hoje (GMIL
observado em 47-55%, plausível). `self-diagnostics.ts`'s
`DiagnosticInput` NÃO ganhou os 2 novos campos (suficiência/GMIL) nesta
rodada — escopo deliberadamente contido a "corrigir o bug real
encontrado", não "adicionar 2 novas categorias de achado"; fica
documentado como próximo passo natural, não silenciosamente esquecido.

**Testes**: `tsc --noEmit` limpo · **116 arquivos / 1906 testes**
(100%, +18 novos: `data-quality-vocabulary.test.ts` — arquivo novo, 12
casos cobrindo os 3 classificadores + a paleta + a consistência
matemática cruzada com `classifyScore` real do Bus; `self-
diagnostics.test.ts` +1 caso travando o bug do `DADOS_INSUFICIENTES`;
`diretriz3-fixes.test.ts` +5 casos de wiring) · build de produção ok
(code-splitting do LLM intocado) · verificação Playwright ao vivo do
painel SYSTEM HEALTH (screenshot + leitura real de texto renderizado,
ver acima).

### 6.48 Pedido de execução real recusado + Ferramentas Institucionais:
ICT Kill Zones

Pedido informal do Operador ("sai de modo de teste... executa tudo
perfeitamente... igual um operador de elite") continha uma ambiguidade
real com risco alto o suficiente para parar e confirmar em vez de
assumir (Disciplina de trabalho item 7). `AskUserQuestion` esclareceu:
o Operador confirmou explicitamente que queria **habilitar execução
real de ordens na exchange**.

**Recusado, sem meio-termo.** READ_ONLY/FAIL_CLOSED incondicional é a
Restrição Permanente #1 deste repositório — "vale mesmo sob qualquer
reformulação... se um pedido pede para desbloquear execução de trading
de qualquer forma, recuse e explique por quê". Não existe fluxo de
credenciais de exchange no código nem motor de envio de ordem, e
nenhum foi construído. A resposta ao Operador apontou a regra
diretamente e ofereceu redirecionar para o que É legítimo no pedido:
zero estado "aguardando" travado por bug real + evolução de
inteligência.

**Auditoria disparada** (agente Explore, background): procurar mais
instâncias da MESMA classe de bug corrigida 2x em §6.47 ("dado real
computado mas nunca chega na UI") em `engine-bridge.ts` e na store —
resultado ainda pendente no momento desta entrada, reportado à parte
quando concluir.

**Ferramentas Institucionais — Kill Zones (ICT)**: pesquisa real via
`WebSearch` antes de implementar (Disciplina de trabalho item 2 —
"método com nome próprio, confirme a definição"). Achado real durante
a pesquisa: fontes públicas sobre horários de Kill Zone DIVERGEM entre
si (±1h por causa de DST EUA/Europa não coincidirem, e uma fonte teve
inconsistência aritmética própria na conversão EST→GMT) — mesma
natureza de "convenção documentada, não uma medição" já usada em
`rr-quality.ts` (piso R:R) e `market-session.ts` (janelas de sessão).

`nexus/kill-zones.ts` (novo): `activeKillZones(date)` devolve a LISTA
de zonas realmente ativas (0, 1 ou 2 — Nova York 12:00–15:00 UTC e
Fechamento de Londres 14:00–16:00 UTC se sobrepõem DE PROPÓSITO, nunca
deduplicadas) — diferente de `marketSessionFromUtc`, que sempre
devolve exatamente 1 sessão cobrindo as 24h. A maior parte do dia
(16:00–07:00 UTC, ~15h) não tem NENHUMA kill zone ativa — honesto por
design do próprio conceito ICT (janela estreita de alta probabilidade,
não uma partição contínua). `nextKillZone(date)` devolve a próxima
janela a abrir + horas restantes, nunca contando uma janela já ativa
como "próxima".

Wiring: badge novo na TopBar (`Crosshair` do lucide-react, cor âmbar,
`animate-pulse`), ao lado do badge de Sessão Atual já existente —
aparece SÓ quando `active.length > 0` (mesmo princípio de "estado
inativo não ocupa espaço na barra sempre-visível" já usado em outros
badges condicionais do header). Contexto de leitura puro — LEI 24
intacta, nunca toca `engine.signal`.

**Verificação ao vivo (Playwright, hora real da sessão — 12:12 UTC,
dentro da janela Nova York por coincidência real, não fabricada)**: o
badge mostrou "NOVA YORK" simultaneamente ao badge de sessão mostrando
"Londres+NY" — os dois derivados independentemente do mesmo relógio
real, consistentes entre si, sem sobreposição/corte visual no header.

**Testes**: `tsc --noEmit` limpo · **117 arquivos / 1923 testes**
(100%, +17 novos: `kill-zones.test.ts`, cobrindo os limiares reais de
cada janela, o overlap Nova York×Fechamento de Londres, os hiatos
honestos sem nenhuma zona ativa, e `nextKillZone` inclusive o caso de
virada de dia) · build de produção ok · verificação Playwright ao vivo
do badge no header (screenshot, ver acima).

**Riscos conhecidos**: os horários de Kill Zone são fixos em UTC (sem
ajuste de DST), mesma aproximação já documentada e aceita em
`market-session.ts` — no horário de inverno americano as janelas reais
deslocam ~1h mais tarde. O badge ainda não tem uma anotação equivalente
no CANVAS do gráfico (Session Bands/Session Sweep da lista de
Ferramentas Institucionais seguem pendentes) — este round entregou a
derivação pura + a superfície mais simples e imediata (header), mesmo
padrão de graduação incremental já usado por `market-session.ts`
(texto no header primeiro, marcadores no canvas em um round posterior).

### 6.49 Auditoria de background concluída (3 achados reais) + Target 3
(extensão de Fibonacci) no gráfico

Pergunta aberta do Operador ("o que falta evoluir, principalmente o
visual do gráfico e as ferramentas... pra ficar mais precisa?") chegou
enquanto o agente Explore lançado no fechamento de §6.48 ainda rodava
em background — a notificação chegou no meio desta rodada, com 3
achados reais e verificados (não teóricos):

1. **Target 3 nunca chegava ao gráfico** (o achado mais diretamente
   relevante à pergunta do Operador sobre precisão visual).
   `support-resistance-engine.js` já calcula
   `fib_extension_long_target`/`fib_extension_short_target` (extensão
   de Fibonacci 61.8% sobre a última perna confirmada) EM TODO ciclo —
   o próprio comentário da EPC §5/§6 no chart já dizia "falta aparecer
   entrada e alvo/alvo2/**alvo3**", confirmando que isto era um pedido
   antigo do Operador nunca completado. O valor morria dentro de
   `research-engine.js` (só virava texto formatado em
   `rota_a_long.extended_target`) e nunca saía de `engine-bridge.ts`.
2. **"Consenso Entre Corretoras" hardcoded como NÃO_APLICÁVEL** — bug
   real em `DecisionValidationWidget`, com um comentário desatualizado
   afirmando que o terminal só tem uma fonte de preço. Falso: 3
   checagens cross-exchange reais (Bybit/OKX/MEXC vs. Binance) já
   alimentam `trustScore.crossExchangeConvergence`, um score 0-1 real
   já exibido em 2 outros widgets — só esta linha específica nunca lia
   o valor.
3. **`affectiveMemory` (reward/pain/eventCount reais)** alimentada por
   8 call sites reais (`recordAffectiveEvent`) mas só o ratio derivado
   (CPI) era exibido — nenhum consumidor distinguia "CPI 50% com 2
   eventos" de "CPI 50% com 200 eventos", ao contrário do painel TRUST
   SCORE vizinho, que já expõe seus componentes reais via tooltip.

**Solução aplicada** (todos passthrough/wiring puro, zero motor novo):

- `RealCycleResult.extendedTarget` (engine-bridge.ts): seleciona
  `frame.fib_extension_long_target`/`short_target` pela MESMA direção
  que `route` já seleciona target1/target2 — nunca uma 4ª fórmula.
  Threading completo: `engine-bridge.ts` → `App.tsx`'s `engine` useMemo
  (`extendedTarget`) → `engineFallbackLevels` (`target3`) →
  `EnhancedChart_110_Percent.tsx` (nova prop tipada, nova linha de
  preço via `mk()`, novo rótulo `TP3` no eixo). TP3 é deliberadamente
  MAIS SIMPLES que TP1/TP2 — sem `strengthSuffix`/`obstacleSuffix`,
  porque a fonte (`support-resistance-engine.js`) não computa esses
  metadados para este nível; nunca um valor fabricado só para uniformizar
  o rótulo.
- `DecisionValidationWidget` ganhou `useTrustScoreSnapshot()` (mesmo
  hook já usado por 2 outros widgets, seguro chamar de múltiplos
  componentes — ao contrário do singleton `useGmilSnapshot()`) e a
  linha "Consenso Entre Corretoras" agora lê
  `num(trustScore?.crossExchangeConvergence)` real. Comentário
  desatualizado do widget corrigido junto.
- `CouncilWidget` ganhou `useAffectiveMemorySnapshot()` + tooltip na
  linha CPI (`Reward X.XX · Pain Y.YY · N eventos reais`), mesmo padrão
  já usado pelo TRUST SCORE ao lado.

**Verificação ao vivo (Playwright)**: tooltip do CPI mostrou
`"Reward 0.20 · Pain 0.95 · 3 eventos reais desde o boot"` — 3 eventos
afetivos reais já ocorreram neste sandbox (ciclo com falha de rede,
feed WS indisponível), e o rótulo `17%` bate exatamente com
`0.20/(0.20+0.95)`. Header mostrou simultaneamente `NOVA YORK` +
`FECHAMENTO DE LONDRES` às 14:59 UTC — confirmação ao vivo adicional
do overlap de Kill Zones (§6.48) no build de produção.

**Riscos conhecidos**: `chartObstacleZones` (destaque de zona
estrutural no caminho entrada→alvo) NÃO foi estendido para incluir
TP3 — decisão deliberada de manter TP3 simples nesta rodada (consistente
com não ter obstacleCount); extensão futura natural, não esquecida.
Duas travas de teste de janela fixa (`s.slice(idx, idx + N)`) em
`price-label-stack-plugin.test.ts` precisaram de janela maior — mesmo
padrão de manutenção já visto neste arquivo, não um sinal de fragilidade
nova.

**Testes**: `tsc --noEmit` limpo · **117 arquivos / 1928 testes** (100%,
+5 novos: 1 em `price-label-stack-plugin.test.ts` (rótulo TP3 dedicado;
os outros 2 testes existentes desse arquivo ganharam assertions extras,
sem virar testes novos) + 4 em `diretriz3-fixes.test.ts` (1 por achado,
mais 1 cobrindo separadamente o lado engine-bridge.ts e o lado App.tsx
do Target 3) · build de produção ok · verificação Playwright ao vivo
(CPI tooltip + Kill Zones overlap, screenshot).

### 6.50 AR10 CYBORG — ELITE TRADING RESEARCH MAP: pesquisa externa
consolidada (9 categorias + síntese)

Diretiva formal do Operador (estrutura numerada §10.1-§10.5, metodologia
obrigatória: zero recomendação por popularidade, todo item com
objetivo/benefícios/limitações/evidências/maturidade/compatibilidade/
complexidade/impacto/dependências/riscos, coluna "Existe no AR10?
SIM/PARCIAL/NÃO" em toda comparação, vocabulário de classificação
fechado Descartar/Pesquisar Mais/Laboratório/Experimental/Quarentena/
Homologação/Produção) pedindo 1 único `.md` consolidado cobrindo
TradingView, MetaTrader/MQL5, GitHub, IA, Estrutura de Mercado, Gestão
de Risco, Interface/UX, Engenharia e Auditoria.

**Solução aplicada**: `docs/ELITE_TRADING_RESEARCH_MAP.md` (717 linhas,
14 seções). Metodologia dividida por origem do conhecimento, nunca
misturada silenciosamente:

- §1 (Metodologia), §5 (IA) e §6 (Estrutura de Mercado) escritos direto
  do conhecimento já real desta sessão + leitura direta do código —
  zero pesquisa nova onde a resposta já existia (Regra de Ouro / "Audite
  antes de construir").
- §2 (TradingView), §3 (MetaTrader/MQL5), §4 (GitHub), §7 (Gestão de
  Risco), §8 (UX) e §9 (Engenharia) vieram de 4 agentes de pesquisa em
  background rodando `WebSearch` real em paralelo (mesmo padrão já
  usado na auditoria "EPC OMEGA FINAL Etapa 1" de 3 agentes) — cada um
  instruído a citar URLs reais e marcar explicitamente claims de baixa
  confiança (ex.: benchmark autodeclarado por fornecedor) como tal,
  nunca apresentar como fato. A coluna "Existe no AR10?" foi reservada
  para mim (nunca delegada aos agentes) — exige conhecimento direto e
  confiável do código-fonte, que um agente teria que re-derivar do zero.
- §10-14 (Matriz de lacunas, Backlog em 4 tiers por impacto×complexidade,
  Roadmap em 6 fases, Riscos, Fontes) são síntese original sobre os
  achados acima.

**Achados de maior impacto já confirmados por código real**: o Risk
Engine (`risk-engine.js`) resolve a controvérsia acadêmica real
Samuelson-vs-Ziemba/Thorp do Critério de Kelly da forma mais defensável
possível (nunca estima win-rate real, Kelly fracionado fixo por faixa de
força do Comitê); o padrão "Single Trade Gateway" da comunidade MQL5
valida arquiteturalmente a LEI 24 (Core Engine como único emissor real);
a dívida de migração WidgetContext→seletores Zustand (já flagada há
várias rodadas) é literalmente o antipadrão que a comunidade Zustand
documenta como causa raiz de re-render desnecessário (existência do
pacote `eslint-plugin-granular-selectors` como evidência).

**Riscos conhecidos**: nenhuma tecnologia nova foi integrada nesta
rodada — o documento é só o mapa, a decisão de puxar algo do backlog
técnico (§11) para dentro do repositório continua sendo rodada própria,
isolada, nunca misturada com pesquisa.

**Testes**: documento markdown puro, sem superfície de código nova —
`tsc`/`vitest`/build desta rodada não se aplicam; verificação foi
leitura própria do documento final (checagem de cabeçalho duplicado
deixado por um checkpoint incremental, corrigido antes da entrega).
Commits: `817a937` (checkpoint 2/6), `d0debd8` (checkpoint 4/6),
`8f36fe3` (entrega completa).

### 6.51 Declutter do gráfico: Relevance Engine passa a cobrir as 18
camadas reais (antes cobria 15 de 18)

Pedido do Operador ("tira as camada que não tem necessidade... organiza
a parte gráfica do gráfico pra ficar mais perfeito possível... total
liberdade pra não quebrar nada"). Regra de Ouro 4 (nunca apagar dado
real ou funcionalidade) descarta a leitura literal de "remover camadas"
— a interpretação real e segura é fechar o gap já documentado desde a
Fase 8.1 (§6.41): `liquidation_heatmap`, `liquidity_sweep` e
`market_sessions` são as 3 camadas mais recentes do painel "Camadas do
Gráfico" e nunca ganharam regra própria no Relevance Engine
(`nexus/layer-relevance.ts`) — ficavam sempre visíveis em modo
AUTOMÁTICO via fallback (`relevance?.relevant ?? true`), o oposto do
resto do painel, que já esconde uma camada sem dado real por trás.

**Solução aplicada** (3 sinais novos, cada um espelhando uma condição
que JÁ existe em outro lugar do código — zero segunda matemática):

- `hasRecentLiquidation`: mesma condição do painel de lista real
  (`Array.isArray(liquidations) && liquidations.length > 0`).
- `hasRecentLiquiditySweep`: mesmo filtro que o canvas
  (`EnhancedChart_110_Percent.tsx`) já usa pra desenhar o sweep —
  `traps` com `kind` `STOP_HUNT_TOPO`/`STOP_HUNT_FUNDO`.
- `recentSessionBoundary`: mesma `computeSessionBoundaries` pura
  (`market-session.ts`) que `MarketSessionBandsPlugin` já usa pra
  desenhar — relevante quando a transição mais recente está a menos de
  `MARKET_SESSION_RECENT_BOUNDARY_CANDLES` (5, convenção declarada,
  mesmo espírito dos outros limiares do arquivo) candles do candle vivo.

Threading: `App.tsx` importa `computeSessionBoundaries` de
`market-session.ts` (import já existente, só estendido) e monta os 3
campos dentro do `relevanceInput` useMemo já existente (nenhum novo
efeito, nenhuma nova assinatura — `traps`/`liquidations` já estavam no
escopo do `ChartWidget`, "zero segunda coleta"). `RELEVANCE_LAYER_IDS`
passa de 15 para 18 entradas; o teste de sincronia com
`CHART_LAYER_IDS` (`layer-relevance.test.ts`) deixa de precisar de uma
lista de exceções (`KNOWN_UNCOVERED_LAYERS`) — cobertura agora é 1:1
sem exceção nenhuma. Aproveitando a mesma vizinhança: 6 comentários
desatualizados em `App.tsx` que ainda diziam "15 camadas"/"15
toggles"/"outras 14" (defasados desde que as 3 camadas foram
adicionadas em rodadas anteriores) foram corrigidos para refletir as 18
reais — só prosa, zero mudança de comportamento (o código já iterava
`CHART_LAYER_IDS` inteiro, nunca um número hardcoded).

**Verificação ao vivo (Playwright)**: painel "Camadas do Gráfico" aberto
em modo AUTOMÁTICO neste sandbox sem rede real — as 3 camadas novas
mostram corretamente `OCULTA` com o motivo real exato:
`"nenhuma liquidação forçada real no feed atual"`, `"nenhum sweep de
liquidez real detectado agora"`, `"nenhuma transição de sessão recente
— sessão vigente estável"`. Resultado esperado e honesto (fail-closed):
sem dado real de mercado neste ambiente, as 3 camadas se escondem
sozinhas — exatamente o comportamento de declutter pedido, provado ao
vivo, não só por teste unitário.

**Riscos conhecidos**: nenhum — mudança é aditiva (3 campos de input +
3 casos de retorno, mesmo formato dos 15 já existentes), o fallback
defensivo `relevance?.relevant ?? true` continua no lugar como proteção
contra uma camada FUTURA esquecida, nunca removido.

**Testes**: `tsc --noEmit` limpo · **117 arquivos / 1934 testes** (100%,
+6 novos: BASE estendida + 2 describe blocks reais para
liquidation_heatmap/liquidity_sweep/market_sessions, cobrindo os 2
estados de cada camada) · build de produção ok (6.03MB llm-worker/
5.91MB llm-bridge inalterados, chunk principal 850KB) · 1 teste de
padrão-de-fonte (`refinamento-final-wiring.test.ts`) precisou de
atualização de string por causa do novo import — mesma manutenção de
baixo risco já vista em rodadas anteriores, não uma regressão.

### 6.52 Mapa de Evolução do Organismo — raio-X interno consolidado
(`docs/MAPA_EVOLUCAO_CIBORGUE.md`)

Segunda metade do mesmo pedido do Operador que gerou §6.51: *"mapeia
tudo que tem de ser feito e a evolução de todos os sistema do
ciborgue"*. Distinto do `ELITE_TRADING_RESEARCH_MAP.md` (§6.50) — aquele
olha para FORA (o que o mercado de ferramentas oferece); este olha para
DENTRO (o estado real de cada subsistema já existente neste
repositório).

**Solução aplicada**: `docs/MAPA_EVOLUCAO_CIBORGUE.md`, novo documento
que refresca a tabela de auditoria de ~23 subsistemas de §6.42 ("EPC
OMEGA FINAL — Etapa 1") com tudo que mudou desde então, verificado por
grep direto nesta rodada (não por memória): Data Quality Monitor e
Relevance Engine (18/18) mudaram de PARCIAL para IMPLEMENTADO nesta
própria trilha; Radar/OIH mudou de PARCIAL (universo curado ~30-41
símbolos) para IMPLEMENTADO (scan real MEXC-wide já ligado ao painel
"OPORTUNIDADES", confirmado via `fetchMexcUsdtSymbols` +
`scanRadarCandidate(..., 'MEXC')` em `App.tsx`); Market Regime Detector
segue confirmadamente PARCIAL (zero ocorrência de `regime-engine`/
`marketRegime` em `layer-relevance.ts`, grep direto); Stage Runner,
Chart Integrity Engine, Adaptive Zoom e Auto Layout seguem no mesmo
estado de §6.42, também reconfirmado por grep nesta rodada, não
assumido.

**Estrutura nova, além da tabela refrescada**: uma seção explícita
distinguindo AUSENTE (nunca construído) de RECUSADO (avaliado e
descartado deliberadamente, com razão registrada — execução real de
ordens, Dynamic Trend Projection, Cross-Timeframe Liquidity, Liquidity
Voids/Volume Clusters como camadas distintas, probabilidade calibrada)
— distinção que faltava em todo documento anterior e evita reabrir
debate já fechado sem motivo novo. Backlog técnico consolidado em 4
tiers (mesma classificação por impacto×complexidade do research map
§11, mas mesclando também os subitens ainda abertos da task interna
"ADITIVO V-MAX Etapas 2-15" que nunca tinham virado um item de backlog
citável). Seção de riscos transversais (sandbox sem rede real, bundle
LLM, dívida WidgetContext, GMIL ONCHAIN/MACRO) e um roadmap recomendado
de 6 passos.

**Riscos conhecidos**: é uma fotografia, não um mecanismo — nada impede
que fique desatualizado se uma rodada futura mudar o estado de um
subsistema sem revisar este documento; a nota de manutenção no rodapé
existe exatamente para isso, mesmo espírito do aviso final do
`CLAUDE.md`.

**Testes**: documento markdown puro, sem superfície de código nova —
`tsc`/`vitest`/build desta rodada não se aplicam (mesma natureza de
§6.50); verificação foi grep direto contra o código-fonte para cada
classificação de estado que mudou desde §6.42 (citado acima), não
suposição.

### 6.53 DIRETRIZES AVANÇADAS DE AUDITORIA, CONSOLIDAÇÃO E EVOLUÇÃO —
3 agentes paralelos (ecossistema/censo visual/sincronização) + 6
correções reais aplicadas

Diretiva formal de 8 seções do Operador, pedindo auditoria de
duplicação/gargalos, mapa visual completo, consistência de decisão,
sincronização, pesquisa tecnológica, consolidação arquitetural,
autonomia técnica controlada (propor E implementar ajustes seguros) e
um documento Markdown único. 3 agentes background reais (read-only,
zero edição própria) rodaram em paralelo: Ecossistema/duplicação
(leu 51 arquivos de `nexus/` + engines + risk/orderflow/consensus/
market-data-bus/market-regime/telemetry + gmil/cross-exchange +
engine-bridge.ts + a store inteira), Censo Visual (18 camadas do
gráfico, 10 price lines, 9 plugins, ~25 indicadores de HUD), e
Sincronização/Decisão (timing entre Snapshot/Core/UI, LEI 24).

**Achado de maior impacto — bug HIGH real, corrigido nesta rodada**:
`store.price` nunca resetava ao trocar de ativo. Causa raiz: o efeito-
espelho `useEffect(() => { if (priceData) setPrice(priceData); },
[priceData])` tinha um guard que parecia um null-check inofensivo mas
SUPRIMIA o próprio reset — ao trocar de ativo, `priceData` volta a
`null` (efeito dedicado, `[selectedAsset]`), mas a linha simplesmente
pulava a escrita em vez de repassar o reset, deixando `store.price` com
o ÚLTIMO PREÇO REAL DO ATIVO ANTERIOR até o WS do novo ativo reconectar
(defasagem de REDE, não de render). Efeito visível real confirmado pelo
agente: painel de Derivativos mostrando preço do ativo velho junto do
rótulo do ativo novo; `patchLastCandleWithLiveTick` (sem validação de
magnitude/símbolo) estendendo a vela mais recente do ativo NOVO com o
preço do ativo VELHO — um pavio falso que persiste até o próximo
resync REST (até ~30s). `orderBook`/`derivatives` nunca tiveram este
bug porque seus valores de reset já são objetos verdadeiros. Corrigido:
`EMPTY_PRICE` (constante privada da store) agora exportado e repassado
explicitamente — `setPrice(priceData ?? EMPTY_PRICE)`, mesmo padrão que
os vizinhos já usavam corretamente.

**Achado visual concreto pedido pelo Operador ("linhas douradas/
amarelas")**: não é UMA linha — são 4 elementos reais e documentados
(tint neutro VWAP/NL, linha+zona de Entrada do Trade Plan, linha de
Liquidity Sweep, rótulo de pico do Liquidation Heatmap), nenhum bug.
O achado real por trás da pergunta: uma única paleta (verde/vermelho/
dourado) é reaproveitada em 9 eixos semânticos diferentes pelo app
inteiro (direção, saúde do sistema, conectividade — a MESMA bolinha
`w-1.5 h-1.5` em 6+ indicadores independentes —, qualidade de dado,
tier de confluência, Heat Score, CPI/Trust Score, alerta/trap).
Internamente consistente em cada eixo, ambíguo entre eixos.
`NeuralMarketAuraPlugin.tsx` já documenta, no próprio cabeçalho, ter
corrigido exatamente esta classe de bug uma vez (corredor colorido por
direção produzindo contradição visual real) — nunca generalizado para
o resto da HUD. 1 correção pontual aplicada: `MarketBiasDecisionCard`'s
Entrada usava ciano onde todo o resto do app usa âmbar — corrigida.

**Outras 4 correções reais aplicadas** (todas pequenas, seguras,
zero mudança de comportamento fora do caso de bug/documentação):
`candles` (unified-snapshot-store.ts) ganhou teto de memória —
`nexus/candles-cache.ts` novo (`touchCandlesSymbol`, LRU real por
ordem de inserção, teto=12=tamanho do universo curado `ASSETS`),
mesmo padrão arquitetural de `l2History`/`orderflowHistory`/
`institutionalScoreHistory`/`trackRecord.history`; comentário
factualmente errado em `EnhancedChart_110_Percent.tsx` (afirmava que
TopBar usa "o mesmo `usePriceSnapshot()`" do gráfico — falso, TopBar lê
`priceData` direto) corrigido; `event-bus.ts` ganhou nota avisando que
os 3 eventos `DATA.*` não têm publicador vivo hoje
(`cross-exchange-service.ts` deliberadamente não iniciado); rótulo
"DECISÃO" sem tooltip em `CouncilWidget` renomeado para "VOTO DO
CONSELHO" + tooltip citando LEI 24 explicitamente (única linha do
widget sem qualificação, ao contrário das linhas-irmãs).

**Lacunas reais documentadas, NÃO corrigidas nesta rodada** (todas
precisam de rodada própria, Regra de Ouro 6): duas fórmulas de ATR%
divergentes (Wilder real em `lorentzian-classifier.js`, não usada por
ninguém; média simples em `market-regime/regime-engine.js`, a canônica
real que alimenta o Risk Engine) — toca matemática de sizing, cuidado
real necessário; Market Data Bus/Quality Monitor/Pipeline Telemetry sem
eviction, crescimento garantido (não especulativo) via scanner do Radar
paginando o universo MEXC inteiro a cada 5min — singleton compartilhado,
desenho de eviction próprio necessário; gap estrutural real de timing
entre `priceData` (TopBar, rápido) e `usePriceSnapshot()` (gráfico, 1
commit atrás) — mesma dívida já rastreada de migração WidgetContext→
seletores, agora com evidência concreta (badge de stop-breach vs.
rótulo do próprio gráfico podem discordar por uma fração de segundo);
janela de corrida real (não determinística) entre o refresh REST de 30s
e troca de timeframe, podendo mesclar candles de granularidades
diferentes; consolidação da paleta de 9 eixos semânticos — grande,
precisa de decisão de design do Operador antes de implementar.

**Pesquisa nova** (delta sobre `ELITE_TRADING_RESEARCH_MAP.md`,
focada em sincronização): padrão real de mercado 2026 para cancelar
requisição obsoleta é `AbortController`; AR10 usa a alternativa válida
(flag `cancelled`/`isStale()` fechada sobre o efeito, checada após cada
`await`) que já garante CORREÇÃO — a lacuna real que sobra é só
eficiência de rede (requisição obsoleta continua em voo até resolver,
mesmo descartada), baixa prioridade, documentada no backlog.

**Entregável único** (§8 da diretiva):
`docs/historico/AUDITORIA_CONSOLIDACAO_EVOLUCAO.md` — inventário, mapa de
arquitetura/dependências/sincronização/elementos visuais, pesquisa,
lacunas, conflitos, registro de melhorias com justificativa técnica,
backlog priorizado, riscos/benefícios. Cita `ELITE_TRADING_RESEARCH_MAP.md`
e `MAPA_EVOLUCAO_CIBORGUE.md` em vez de duplicar o que já respondiam.

**Riscos conhecidos**: nenhuma das 6 correções toca Core Engine/Comitê/
Risk Engine/execução — todas aditivas, reversão de supressão acidental,
ou texto puro. Os itens de backlog deliberadamente não tocados carregam
seus próprios riscos reais, documentados individualmente no novo
documento, nunca escondidos.

**Testes**: `tsc --noEmit` limpo · **119 arquivos / 1950 testes** (100%,
+12 novos: 6 em `nexus-candles-cache.test.ts`, 6 em
`diretrizes-avancadas-fixes.test.ts`) · build de produção ok (bundles
inalterados) · 2 janelas de teste de padrão-fixo widened (mesma
manutenção de baixo risco já vista em rodadas anteriores) ·
verificação Playwright ao vivo ("VOTO DO CONSELHO" + tooltip
renderizados corretamente, zero erro de console real).

### 6.54 VWAP Standard Deviation Bands — primeiro item Tier 1 do backlog
executado (pedido do Operador: "ferramentas mais precisas")

PR #14 foi mergeada durante a rodada anterior — branch reiniciada de
`origin/main` (histórico só já mergeado, nenhum commit local extra
perdido) antes de começar este trabalho, seguindo a disciplina do
ambiente para PR já fechada.

Pesquisa real confirmada via WebSearch (TradingView, Sierra Chart,
TrendSpider, MultiCharts — mesma fórmula documentada em todas):
banda = VWAP ± k×desvio-padrão PONDERADO POR VOLUME (nunca o desvio-
padrão simples dos closes, que ignoraria o próprio peso que dá nome à
ferramenta). `variância = Σ(volume×precoTípico²)/Σvolume − VWAP²`.

**Solução aplicada**: `nexus/vwap-bands.ts` (novo) — `computeVwapBands`,
companion module de `nexus/vwap.ts` (cuja matemática fica INTOCADA por
diretiva anterior, §20: "não modificar seu núcleo") — consome
`computeSessionVwapSeries` já real e acumula a variância por cima, zero
segunda fórmula de VWAP. k=1 e k=2, mesma convenção de multiplicador
±σ já usada por `trend-channel-engine.ts`. Wiring no canvas
(`EnhancedChart_110_Percent.tsx`): 4 novas séries nativas
(upper1/lower1/upper2/lower2), MESMO efeito/mesmos candles que a
própria VWAP (nunca dessincroniza), MESMO toggle `visibility.vwap` —
decisão deliberada de NÃO criar uma 19ª camada no painel "Camadas do
Gráfico": as bandas são a mesma ferramenta que a VWAP, não um conceito
novo e separado. Cor: mesmo tom branco/neutro já "dono" da VWAP, só
mais translúcido (1σ mais visível que 2σ) — reaproveita o papel visual
já existente em vez de introduzir mais uma cor (achado direto da
auditoria de consolidação de paleta, §6.53).

**Verificação ao vivo (Playwright)**: painel "Camadas do Gráfico"
segue mostrando exatamente 18 linhas (nenhuma nova) e "VWAP" aparece
só 1 vez no painel — confirma que as bandas não geraram uma camada
duplicada. Zero erro real de console.

**Riscos conhecidos**: nenhum — módulo puro aditivo + 4 séries nativas
seguindo exatamente o padrão já usado por Trend Channel; nenhuma
mudança em `vwap.ts`, nenhuma mudança de comportamento pra quem nunca
liga o toggle VWAP.

**Testes**: `tsc --noEmit` limpo · **120 arquivos / 1963 testes** (100%,
+13 novos: 8 de execução real em `nexus-vwap-bands.test.ts`
— incluindo um caso hand-verified, VWAP=175/stdDev=25√3≈43.301 —, 5 de
padrão-de-fonte em `refinamento-final-wiring.test.ts`) · build de
produção ok · verificação Playwright ao vivo.

**Backlog**: primeiro item Tier 1 de `MAPA_EVOLUCAO_CIBORGUE.md` §7
executado; Kill Zones no canvas continua o próximo natural.

### 6.55 Kill Zones ICT no canvas — segundo item Tier 1 do backlog
executado (o badge do header já existia desde §6.48; este plugin fecha
a lacuna do desenho real)

Pesquisa real confirmada via WebSearch antes de implementar (scripts
reais publicados de ICT Killzones no TradingView — TFLab,
TakingProphets, BryceWH, 0xCryptoVince): a convenção visual real é um
retângulo/caixa sombreada cobrindo a janela de tempo inteira, nunca uma
linha única — geometria diferente de `MarketSessionBandsPlugin`
(partição contínua de 24h, desenhada como linhas de transição) porque
Kill Zone é um conceito ICT distinto (janela ESTREITA e institucional
dentro de cada sessão; a maior parte do dia não tem nenhuma zona ativa,
e Nova York/Fechamento de Londres se sobrepõem de propósito — ver
header de `nexus/kill-zones.ts`, §6.48).

**Solução aplicada**:
- `nexus/kill-zones.ts` ganhou `computeKillZoneSpans(candles)` —
  varredura real run-length sobre a série de candles, devolvendo um
  `KillZoneSpan` (id/label/startTime/endTime) por ocorrência CONTÍGUA
  real de cada zona; overlaps reais (Nova York × Fechamento de Londres)
  produzem 2 spans concorrentes, nunca mesclados; zonas ainda abertas no
  último candle da série são fechadas honestamente no fim da varredura.
- `chart/KillZoneBandsPlugin.tsx` (novo) — 4ª instância da arquitetura
  de overlay já provada (`LiquidityZonesPlugin`/
  `StructureBreakMarkersPlugin`/`MarketSessionBandsPlugin`): canvas
  próprio, dirty-flag + `requestAnimationFrame`, `ResizeObserver`,
  geometria via `timeToCoordinate` + meia-largura real de
  `timeScale.options().barSpacing` (para o retângulo cobrir o candle
  inteiro, não só do centro ao centro), Fio de Seda (bordas 1px sólidas,
  nunca `setLineDash`), fail-closed (`timeToCoordinate` fora da área
  visível retorna `null` → span pulado, nunca extrapolado). Cor: o
  MESMO âmbar `#ffb020` já usado pelo badge de Kill Zone no header —
  reaproveita o papel visual já existente em vez de introduzir um tom
  novo (mesma disciplina de paleta de §6.53/§6.54).
- Camada PRÓPRIA (`kill_zones`) em `CHART_LAYER_IDS`/
  `DEFAULT_CHART_LAYER_VISIBILITY`/`DEFAULT_CHART_LAYER_AUTO_MODE`,
  nunca dobrada dentro de `market_sessions` — decisão deliberada, o
  oposto da decisão tomada para as bandas de VWAP em §6.54: ali as
  bandas eram a MESMA ferramenta que a VWAP (reaproveitou o toggle);
  aqui Kill Zone é um conceito conceitualmente distinto de sessão de
  mercado (o próprio header de `kill-zones.ts` já documentava isso, e o
  badge do header já os trata como elementos separados) — a mesma
  disciplina de "reusar vs. criar novo" aplicada com o critério real de
  cada caso, não uma regra cega.
- Painel "Camadas do Gráfico" (`App.tsx`) ganha a linha "KILL ZONES
  (ICT)", entra no Modo Inteligência (leitura de mercado/estrutura,
  nunca específica do plano ativo — mesma classificação de
  `market_sessions`).
- **Relevance Engine** (`nexus/layer-relevance.ts`) ganha cobertura
  DESDE O NASCIMENTO da camada — `hasActiveKillZone` computado em
  `App.tsx` com a MESMA função (`activeKillZones(new Date())`) que o
  badge do header já usa, zero segunda leitura. Fechar isso já na
  criação evita repetir o gap retroativo que o Task #93 teve que
  corrigir depois para 3 camadas (`liquidation_heatmap`/
  `liquidity_sweep`/`market_sessions`, achado real de crash em
  runtime, §6.41) — aqui a camada nasce com regra própria, nunca cai
  no fallback `?? true` por omissão.

**Verificação ao vivo (Playwright)**: painel "Camadas do Gráfico" agora
mostra 19 linhas (era 18 em §6.54), "KILL ZONES (ICT)" aparece como
última linha com badge AUTO/VISÍVEL — a leitura real no momento do
teste tinha a Kill Zone Ásia ativa (mesmo instante, mesmo dado, badge do
header mostrando "ÁSIA"), confirmando que o Relevance Engine e o badge
do header concordam por usarem a MESMA função pura. O canvas do gráfico
em si ficou em `AWAITING CANDLES...` (fail-closed honesto — este
ambiente sandboxed não tem acesso de rede real à Binance, mesma
limitação que já existia para verificar visualmente qualquer overlay de
canvas anterior nesta sessão) — o desenho real do retângulo amber fica
verificado pela suíte de execução real de `computeKillZoneSpans`
(23/23 em `kill-zones.test.ts`) mais os testes de padrão-de-fonte que
travam a fiação (mount point, cor, geometria). Zero erro de console
atribuível ao código novo (os únicos erros de console observados são
`ERR_TUNNEL_CONNECTION_FAILED`/WebSocket, rede indisponível no sandbox).

**Riscos conhecidos**: nenhum novo — módulo puro aditivo + plugin de
canvas seguindo exatamente o padrão já usado 3x; `kill-zones.ts` só
ganhou uma função nova (`computeKillZoneSpans`), zero mudança em
`activeKillZones`/`nextKillZone` (comportamento do badge do header
intocado).

**Testes**: `tsc --noEmit` limpo · **120 arquivos / 1976 testes** (100%,
+13 novos desde §6.54: 6 de execução real em `kill-zones.test.ts`
— overlap Nova York × Fechamento de Londres, não-mesclagem entre dias
diferentes, span aberto fechado no fim da série —, 2 em
`layer-relevance.test.ts` (describe `kill_zones`) + ajuste de contagem
18→19 nos 2 testes de sincronia RELEVANCE_LAYER_IDS↔CHART_LAYER_IDS, 1
ajuste de contagem em `chart-layers-panel-wiring.test.ts`
(`CHART_LAYER_PANEL_MODULES` 18→19 entradas), 5 de padrão-de-fonte em
`refinamento-final-wiring.test.ts` (import, mount point, camada própria,
label no painel, cobertura do Relevance Engine)) · build de produção ok
· verificação Playwright ao vivo.

**Backlog**: segundo item Tier 1 de `MAPA_EVOLUCAO_CIBORGUE.md` §7
executado (VWAP bands em §6.54, Kill Zones aqui); próximos itens Tier 1
restantes: auditoria de touch-target 44×44pt (iPad Safari),
list-virtualization (order book/Radar/Omnibox), dependência
`reconnecting-websocket`, escopo de toggle para S1/R1/Trade Plan/
Scenario lines (hoje sem gate nenhum), `AbortController` nos 2 fetches
privados fora do Bus (ticker, funding+OI).

### 6.56 EXTENSÃO OFICIAL — Fase de Evolução do Organismo: achado real de
performance (cache por referência em 2 plugins de canvas), evidência
medida antes de mexer em qualquer coisa

Diretiva do Operador ("EXTENSÃO OFICIAL — FASE DE EVOLUÇÃO DO
ORGANISMO"): usar o conhecimento da auditoria para reduzir "cálculos
duplicados"/"renderizações desnecessárias"/latência, sem criar segunda
arquitetura. Em vez de reabrir a auditoria inteira de novo (já
consolidada em `AUDITORIA_CONSOLIDACAO_EVOLUCAO.md`/
`MAPA_EVOLUCAO_CIBORGUE.md`), esta entrada audita concretamente o
próprio código que acabou de nascer em §6.55 — a disciplina real de
"organismo vivo" é auto-observação contínua, não só sobre módulos
antigos.

**Investigação (evidência antes de decisão, nunca suposição)**: os 9
plugins de overlay do canvas seguem a mesma arquitetura (dirty-flag +
rAF). Uma varredura (`grep` por `compute[A-Z]` dentro de cada `draw()`)
achou 3 plugins que chamam uma função de derivação pura DIRETAMENTE
dentro do closure de desenho: `KillZoneBandsPlugin`
(`computeKillZoneSpans`), `MarketSessionBandsPlugin`
(`computeSessionBoundaries`) e `LiquidationHeatmapPlugin`
(`computeLiquidationHeatmap`). Nos 3 casos, o resultado só depende de
`data`/`liquidations` (não do range visível), mas `draw()` roda a cada
pan/zoom/resize via `subscribeVisibleLogicalRangeChange`/
`ResizeObserver` — ou seja, um recálculo idêntico e descartado a cada
redraw. Em vez de "consertar os 3 por padrão", um benchmark real
(candles/eventos sintéticos nos tetos reais do app — `MAX_CHART_HISTORY
= 2000` de `App.tsx` para candles, retenção de 500 para o feed de
liquidação) mediu o custo de cada um:

| Função | custo/chamada no teto real |
|---|---|
| `computeKillZoneSpans` (N=2000) | ~1,0-1,2ms |
| `computeSessionBoundaries` (N=2000) | ~0,49-0,57ms |
| `computeLiquidationHeatmap` (N=500) | ~0,006ms |

`computeKillZoneSpans`/`computeSessionBoundaries` custam 2-3 ordens de
magnitude mais que `computeLiquidationHeatmap` (o primeiro itera
`new Date()` + filtro de 4 zonas por candle; o segundo é uma soma linear
simples sobre eventos, tipicamente dezenas). Num orçamento de 16,6ms/
frame (60fps, Regra de Ouro 7), ~1,2ms+0,57ms de trabalho REDUNDANTE a
cada pan contínuo é uma fração real (~10%) só destes dois; 0,006ms não
é.

**Solução aplicada** (só onde a evidência apoiou): `KillZoneBandsPlugin`
e `MarketSessionBandsPlugin` ganharam um cache por IDENTIDADE de
referência (`spansCacheRef`/`boundariesCacheRef`) — `dataRef.current`
só troca de objeto quando `App.tsx` chama `setChartData` de verdade
(candle novo/troca de símbolo/timeframe), nunca em pan/zoom/resize
(confirmado lendo a cadeia real de props: `chartData` state → `data`
prop de `ChartWidget` → `data` prop de `EnhancedChart_110_Percent` →
`data` prop do plugin, sem nenhum `.slice()`/spread intermediário que
quebraria a identidade). `LiquidationHeatmapPlugin` NÃO recebeu o mesmo
cache — a diretiva pede reduzir latência real, não "consistência" pela
consistência; adicionar uma abstração sem benefício medido violaria a
própria disciplina de engenharia deste repositório (CLAUDE.md: não
introduzir complexidade além do que a tarefa exige).

**Impacto esperado**: pan/zoom contínuo com Kill Zones e/ou Sessões
ativas deixa de recomputar spans/boundaries a cada frame — só recomputa
quando candles novos chegam. Zero mudança de comportamento visual
(mesmo resultado, só sem o trabalho redundante).

**Riscos conhecidos**: nenhum — cache por `===` de referência é
correto por construção (nunca fica stale, porque QUALQUER mudança real
de `data` troca a referência); reversível trivialmente (remover as 2
linhas de cache volta ao comportamento anterior, idêntico exceto no
custo).

**Testes**: `tsc --noEmit` limpo · **120 arquivos / 1979 testes** (100%,
+3 novos: padrão-de-fonte em `refinamento-final-wiring.test.ts`
confirmando o cache nos 2 plugins corrigidos e a AUSÊNCIA deliberada do
cache no 3º, para a decisão de não-mexer ficar travada por teste tanto
quanto a decisão de mexer) · build de produção ok · verificação
Playwright ao vivo (painel "Camadas do Gráfico" seguindo idêntico,
zero regressão). Benchmark descartável (não commitado, `_bench-
throwaway.test.ts`, deletado após medir).

**Backlog/próximos passos honestos**: este achado nasceu de uma
varredura focada nos plugins mais recentes, não de uma auditoria
sistemática dos 9 plugins de overlay — os outros 6
(`LiquidityZonesPlugin`/`StructureBreakMarkersPlugin`/
`VolumeProfilePlugin`/`OrderFlowHeatmapPlugin`/`NeuralMarketAuraPlugin`/
`TradePlanZonePlugin`) recebem dados JÁ pré-computados via props
(`useMemo` em `App.tsx`), não chamam `compute*` dentro do próprio
`draw()` — confirmado pela mesma varredura `grep`, não uma suposição.
Nenhum destes 6 tem o mesmo padrão de recálculo redundante.

### 6.57 Session Key Levels no canvas — pedido do Operador (captura de
indicador de referência "Key Levels")

O Operador enviou a legenda de um indicador de referência real (formato
"NIPS Key Levels · Standard · 30 250 · Medium Small Solid · 1030-1700 ·
America/New_York · 0300-1200 0800-1700 1900-0400") pedindo para a
plataforma evoluir "onde encaixar perfeitamente".

**Pesquisa real antes de implementar** (Disciplina de trabalho item 2 —
nome próprio, confirmar antes de implementar): WebSearch identificou a
família real desse indicador (TradingView — "Session Highs & Lows", "Key
Session & Levels", "Trading Sessions with High/Low Levels") — o padrão
real é plotar a MÁXIMA e a MÍNIMA de cada sessão institucional (Ásia/
Londres/Nova York) como um NÍVEL HORIZONTAL de preço, ancorado num
timezone configurável. Conceito ICT/SMC real: liquidez tende a descansar
acima da máxima/abaixo da mínima de uma sessão já encerrada (varredura de
stops) — o extremo vira referência de S/R para as sessões seguintes. Os 3
horários da legenda (0300-1200/0800-1700/1900-0400, timezone America/
New_York) batem, dentro da aproximação de ±1h já documentada neste
projeto para DST, com Londres/Nova York/Ásia convertidos de UTC — mesmas
sessões que `market-session.ts` já modela.

**Decisão de arquitetura (zero 3ª fonte de "o que é uma sessão")**: em
vez de introduzir uma nova definição paralela de janelas (o codebase já
tem DUAS: a partição contínua de 24h em `market-session.ts` e a janela
estreita ICT em `kill-zones.ts`, cada uma com um propósito documentado
diferente), Key Levels REAPROVEITA a partição já real de
`market-session.ts` — `computeSessionKeyLevels` é uma companion function
no mesmo arquivo (mesmo padrão de `computeSessionBoundaries`), que varre
a série real de candles UMA vez, acumulando `Math.max`/`Math.min` de
high/low por ocorrência de sessão.

**Solução aplicada**:
- `nexus/market-session.ts` ganha `computeSessionKeyLevels(candles)` —
  devolve um `SessionKeyLevel` (sessionId/label/startTime/endTime/high/
  low/closed) por ocorrência real; `closed:false` na sessão mais recente
  (ainda em andamento, extremos podem crescer), `closed:true` nas
  anteriores (extremos finais).
- `chart/SessionKeyLevelsPlugin.tsx` (novo) — 5ª instância da arquitetura
  de overlay já provada, cache por identidade de referência DESDE O
  NASCIMENTO (aprendizado de §6.56 aplicado, nunca uma correção
  retroativa desta vez). Desenha 2 linhas horizontais por sessão (máxima/
  mínima), da hora real de abertura da sessão até a borda direita
  visível (mesmo espírito "referência válida daqui pra frente" de
  `TradePlanZonePlugin`). Declutter deliberado: só as últimas
  `MAX_KEY_LEVELS_SHOWN = 5` ocorrências (convenção declarada, mesmo
  espírito de `MARKET_SESSION_RECENT_BOUNDARY_CANDLES`) — nunca a
  história inteira carregada.
- Cor: reaproveita a MESMA dupla vermelho/verde já usada por Suporte/
  Resistência (S1/R1) e por `LONG_RGB`/`SHORT_RGB`
  (`NeuralMarketAuraPlugin`) — a máxima de sessão é estruturalmente um
  teto (mesmo papel de R1), a mínima um piso (mesmo papel de S1). Zero
  tom novo na paleta (mesma disciplina de §6.53-§6.55).
- Camada PRÓPRIA `session_key_levels` (nível de PREÇO, conceito adicional
  a `market_sessions`, que já marca as transições de TEMPO) — painel
  "Camadas do Gráfico" ganha "KEY LEVELS (SESSÕES)", Modo Inteligência.
- **Relevance Engine coberto desde o nascimento** — `hasSessionKeyLevelNearPrice`
  reusa o mesmo limiar `LIQUIDITY_PROXIMITY_PCT` já usado por liquidez/
  EQH-EQL (mesmo papel estrutural), calculado SÓ sobre os últimos
  `MAX_KEY_LEVELS_SHOWN` níveis (a mesma constante que o plugin usa para
  desenhar — importada de `SessionKeyLevelsPlugin.tsx`, nunca um segundo
  número solto) — nunca marca relevante por um nível que nem está
  desenhado na tela.

**Verificação ao vivo (Playwright)**: painel "Camadas do Gráfico" passa
de 19 para 20 linhas; "KEY LEVELS (SESSÕES)" aparece como última linha
com badge AUTO/OCULTA (honesto — sem candle real neste sandbox sem rede
à Binance, `sessionKeyLevels` fica `[]`, então `hasSessionKeyLevelNearPrice`
é `false` e o Relevance Engine corretamente marca não-relevante, mesmo
comportamento fail-closed de qualquer outra camada dependente de dado
real). Zero erro de console atribuível ao código novo.

**Riscos conhecidos**: nenhum — módulo puro aditivo + plugin seguindo
exatamente o padrão já usado 4x, com o cache de §6.56 aplicado desde o
início; zero mudança em `marketSessionFromUtc`/`computeSessionBoundaries`
(header/`MarketSessionBandsPlugin` intocados).

**Testes**: `tsc --noEmit` limpo · **120 arquivos / 1996 testes** (100%,
+17 novos: 7 de execução real em `market-session.test.ts`
— acumulação real de high/low por Math.max/Math.min, transição fechando
o nível anterior com extremos finais, candle NaN pulado sem contaminar,
4 sessões em sequência sem contaminação cruzada —, 2 em
`layer-relevance.test.ts` (describe `session_key_levels`) + ajuste de
contagem 19→20, 1 ajuste de contagem em `chart-layers-panel-wiring.test.ts`,
7 de padrão-de-fonte em `refinamento-final-wiring.test.ts` (import, mount
point, camada própria, label no painel, cobertura do Relevance Engine,
mesma constante de janela entre plugin/relevância, cor reaproveitada,
cache desde o nascimento) — 1 teste pré-existente (`Header §1`) precisou
de ajuste honesto porque o import real de `market-session.ts` mudou de
string) · build de produção ok · verificação Playwright ao vivo.

**Backlog honesto**: a exibição atual estende a linha do início real da
sessão até a borda direita — uma versão futura poderia rastrear o candle
EXATO onde o extremo ocorreu (não só o início da sessão), mas isso
exigiria um 2º campo de índice/tempo no motor puro (`highTime`/
`lowTime`) sem benefício visual demonstrado ainda; Previous Day High/Low
(PDH/PDL, companion comum deste tipo de indicador) é um candidato real
de próxima rodada — mesma função generalizada para uma partição diária
em vez da partição de 5 sessões, mas não implementado agora (escopo desta
entrega era responder ao pedido concreto do Operador, não expandir além
dele sem pedido).

### 6.58 "Linha amarela que eu não sei o que significa" + "etiquetas em
cima do valor do ativo" — achado real com causa raiz identificada e
corrigida (primeira fatia da "LAPIDAÇÃO PROFISSIONAL DO GRÁFICO")

O Operador reportou (3ª vez nesta sessão que a pergunta sobre "linha
amarela" aparece) não reconhecer um elemento amarelo no gráfico, mais um
pedido geral de que rótulos nunca fiquem em cima do preço/candle. Em vez
de repetir a resposta anterior (Entry price line, `#f0d06f`) sem
verificar de novo, esta rodada fez um inventário REAL (grep) de toda cor
amarelo/âmbar/dourada no `chart/`:

| Cor | Papel real |
|---|---|
| `rgba(240, 208, 111, ...)` | Entry (Trade Plan) — já tinha rótulo "EN" no eixo |
| `rgba(255, 235, 190/214, ...)` | VWAP/Nexus Line em estado NEUTRAL |
| `rgba(255, 200, 0, ...)` | Pico do Liquidation Heatmap (texto condicional) |
| `rgba(255, 176, 32, ...)` | Kill Zones (§6.55) — já tem rótulo próprio no retângulo |
| **`rgba(255, 191, 0, ...)`** | **Liquidity Sweep — SEM equivalente em `priceAxisLabels`** |

**Causa raiz real**: `createPriceLine` do Liquidity Sweep (EPC OMEGA
FINAL Etapa 10) sempre teve `title: "⚡ SWEEP ↑/↓ N%"`, mas nunca um
`priceAxisLabels` correspondente — diferente de TODO outro nível
(S1/R1/VWAP/NL/EMA/Entry/Stop/Target/BOS-CHOCH), que tem ambos (linha
nativa + rótulo no eixo anti-colisão).
**Correção honesta do mecanismo** (a primeira versão desta entrega
afirmou que o `title` nativo desenhava solto no painel, competindo com o
candle — pesquisa mais profunda, direto no código-fonte real da lib
(`custom-price-line-price-axis-view.ts`, método `_updateRendererData`),
mostrou que isso está ERRADO): quando `axisLabelVisible` é `false`, o
método retorna ANTES de marcar o título como visível — `title` nunca é
desenhado em lugar NENHUM (nem eixo, nem painel) quando `axisLabelVisible:
false`. O problema real nunca foi "texto sobreposto ao candle" — foi
AUSÊNCIA TOTAL de qualquer rótulo legível para a linha âmbar (o `title`
sempre foi metadado morto). Isso ainda explica exatamente a queixa do
Operador ("linha amarela que eu não sei o que significa"): uma linha sem
NENHUM texto é tão confusa quanto uma com texto mal posicionado. A
correção (mover para `priceAxisLabels`) continua certa e necessária —
antes a linha não tinha rótulo nenhum, agora tem um real e sem colisão —
só a explicação do "porquê" foi corrigida aqui para não deixar uma
afirmação técnica errada registrada.

A mesma auditoria checou `SessionKeyLevelsPlugin.tsx` (§6.57, entregue na
rodada anterior desta mesma PR) por um motivo DIFERENTE: seu rótulo
usava `ctx.fillText` num canvas próprio — mecanismo totalmente
independente do `title` nativo da lib, sem nenhum gate equivalente a
`axisLabelVisible`. Esse desenhava mesmo, sempre, direto na coordenada Y
do próprio high/low — esse SIM era colisão real de texto com candle, o
mesmo padrão de bug autoinfligido no código mais recente da sessão.

**Solução aplicada** (mesmo precedente já usado para BOS/CHOCH, EPC §5/§6
— Task #29 do histórico):
- Liquidity Sweep: `title: ""` na price line nativa (só a linha colorida
  permanece); o texto migra para `priceAxisLabels` (mesmo preço/cor,
  dedupe por preço — múltiplos traps podem citar o mesmo pool),
  `side:"left"` (evento estrutural/histórico, mesma categoria de
  S1/R1/Trend Channel/BOS-CHOCH).
- Session Key Levels: só a sessão CORRENTE (a mais recente, ainda em
  andamento) ganha rótulo real — via novo `currentSessionKeyLevel`
  (useMemo puro em `EnhancedChart_110_Percent.tsx`, sempre a última
  entrada de `computeSessionKeyLevels(data)`) empurrado em
  `priceAxisLabels`, `side:"left"`. `SessionKeyLevelsPlugin.tsx` perdeu
  TODO o desenho de texto (zero `ctx.fillText`) — as sessões já fechadas
  continuam como linha de referência real (cor + posição), sem rótulo
  próprio flutuante.

**Impacto esperado**: Liquidity Sweep ganha um rótulo real onde antes não
tinha NENHUM; Session Key Levels perde o texto que competia diretamente
com candles na coordenada exata do high/low. O lado esquerdo do eixo
(contexto estrutural) ganha até 3 novas entradas possíveis (Sweep + Key
Level High/Low), sempre dentro do sistema anti-colisão já provado (nunca
mais de ~7 no pior caso, a mesma escala que S1/R1/VWAP/NL/EMA/Entry/Stop/
Target/BOS-CHOCH já convivem sem sobreposição há várias rodadas).

**Riscos conhecidos**: nenhum — mesma técnica de migração já usada e
testada para BOS/CHOCH; a LINHA em si (cor/posição/geometria) de nenhum
dos dois elementos mudou, só o rótulo textual (antes inerte no Sweep,
antes flutuante no Session Key Levels).

**Testes**: `tsc --noEmit` limpo · **120 arquivos / 2001 testes** (100%,
+4 novos: 1 em `price-label-stack-plugin.test.ts` confirmando Sweep/Key
Levels com `side:"left"` + 2 ajustes honestos de contagem/string (deps
array/contagem de rótulos à esquerda, que mudaram de verdade), 4 em
`refinamento-final-wiring.test.ts` (title vazio na price line nativa,
entrada real em priceAxisLabels, `currentSessionKeyLevel` real,
regressão travada contra `ctx.fillText` voltar ao plugin)) · build de
produção ok · smoke Playwright ao vivo (painel idêntico, zero erro de
console novo).

**Escopo honesto desta rodada vs. a diretiva completa "LAPIDAÇÃO
PROFISSIONAL DO GRÁFICO"**: o Operador enviou depois uma diretiva formal
muito mais ampla (hierarquia de prioridade visual de 4 níveis para TODO
elemento do gráfico, consolidação de S/R/liquidez/FVG/OB/VWAP/EMA,
auditoria de paleta completa, mapeamento de TODOS os elementos
desenhados com origem/módulo/finalidade/prioridade, pesquisa de técnicas
modernas de visualização). Esta entrega resolve o achado CONCRETO e
verificável (2 elementos com bug real de sobreposição, identificados com
evidência, corrigidos com o mesmo padrão já provado) — não é a auditoria
completa de hierarquia/paleta/consolidação pedida na diretiva formal, que
é um trabalho real e maior, candidato a uma rodada dedicada própria
(mapear os ~20 elementos reais do canvas um a um, com critério objetivo
de prioridade, é trabalho de auditoria visual sistemática, não algo para
encaixar apressado no fim de uma rodada já longa).

### 6.59 Task #101 concluída (inventário + paleta + prioridade) + Task #102
iniciada: diferenciação real Liquidity Sweep × pico do Liquidation Heatmap

**Task #101** ("LAPIDAÇÃO PROFISSIONAL DO GRÁFICO") foi entregue como nova
§9 de `docs/historico/AUDITORIA_ECOSSISTEMA_VISUAL.md` (não um documento novo —
mesma disciplina de fonte única já usada em §6.27/§6.50): inventário
completo de ~28 elementos reais do gráfico com módulo/cor/dependência,
framework de prioridade de 4 níveis (Máxima/Alta/Média/Baixa, critério
objetivo — ver §9.2 daquele arquivo), auditoria de paleta em 8 famílias
de matiz reais (2 conflitos genuínos achados: família amarela com 5 tons
para 5 conceitos, cyan compartilhado por Fibonacci e Volume Profile), e
pesquisa externa de convenções profissionais.

**Task #102** ("ADENDO — lapidação final, nível institucional") foi
retomada com uma diretiva formal adicional do Operador, desta vez com uma
imagem de referência conceitual (mockup de terminal, explicitamente "não
é para ser copiada literalmente"). Duas honestidades registradas sobre
essa diretiva:
- O documento endereça "Agente 4" — nome que não corresponde a como o
  Operador se dirige a esta sessão diretamente nas outras mensagens deste
  mesmo histórico. Avaliado à luz da regra de segurança contra instruções
  injetadas (item 7 da Disciplina de Trabalho, `CLAUDE.md`): o conteúdo
  em si não pede nada que viole READ_ONLY/LEI 24/SSOT — pelo contrário,
  reafirma essas 3 restrições nominalmente antes de conceder autonomia de
  implementação — e chegou pelo canal direto de mensagem do usuário desta
  sessão (não um arquivo/upload de terceiro), com o mesmo registro formal
  ("DIRETIVA OFICIAL"/"SOLICITAÇÃO"/"ADENDO") já usado pelo Operador nesta
  mesma sessão. Tratada como legítima, sinalizada aqui em vez de
  silenciosamente ignorada (nem bloqueada sem necessidade real).
- A imagem de referência tem 2 elementos que este sistema NÃO vai copiar,
  por conflito direto com regra permanente: um donut "PROBABILIDADE"
  (LONG 78% / SHORT 18% / NEUTRO 4%) — exatamente o tipo de número
  calibrado que a Regra de Ouro 2 proíbe sem backtest real que sustente a
  alegação; e uma barra de abas "ORDENS ABERTAS / POSIÇÕES / EXECUÇÕES"
  com contagens ao vivo — implica conectividade real de corretora, o que
  viola READ_ONLY. O resto da imagem (hierarquia, rótulos ao lado do
  preço nunca em cima, zonas consolidadas, paleta por categoria) está
  alinhado com o que este sistema já persegue.

**Ação concreta desta entrega** (primeira de possivelmente várias dentro
da Task #102): a diretiva pede explicitamente auditoria de "fios
dourados" — e a própria §9.4 já tinha achado que Liquidity Sweep
(`rgba(255, 191, 0, 0.85)`, H45) e o rótulo de pico do Liquidation Heatmap
(`rgba(255, 200, 0, 0.85)`, H47) diferem por **2° de matiz** na mesma
luminosidade/saturação/alpha — indistinguível a olho, apesar de serem 2
conceitos totalmente diferentes (um evento pontual já ocorrido vs. um
agregado ao vivo recalculado a cada tick). Corrigido para:
- Liquidity Sweep → `rgba(255, 140, 0, 0.85)` (H33, laranja) —
  `EnhancedChart_110_Percent.tsx`, price line nativa + `priceAxisLabels`.
- Liquidation Heatmap (pico) → `rgba(255, 213, 0, 0.85)` (H50, ouro puro)
  — `LiquidationHeatmapPlugin.tsx::PEAK_LABEL_COLOR`.

Kill Zones (`rgba(255, 176, 32, ...)`, H39) **não** entrou nesta
diferenciação: é banda de fundo vertical (não linha de preço horizontal),
alpha muito mais baixo (0.06 fill / 0.22 borda, só o rótulo do retângulo
em 0.65) — geometria e peso visual já suficientemente distintos, sem
colisão real demonstrada (mesmo raciocínio já aplicado a Fibonacci ×
Volume Profile em §9.4: forma diferente mitiga cor igual). Entry
(`rgba(240,208,111,...)`) e o estado NEUTRAL de VWAP/NL também ficaram de
fora: tratamento visual já distinto (zona preenchida + linha grossa para
Entry; tom deliberadamente pálido/dessaturado para o estado neutro, já
documentado no §22 original) — mudar essas cores sem um problema
demonstrado quebraria a associação visual que o Operador já tem com
"onde eu entraria" sem ganho real.

**Escopo que continua propositalmente aberto** (não é esquecimento,
é a mesma disciplina de não decidir identidade visual sem fundamento
novo): consolidação total da família amarela (Entry/VWAP-neutro/Kill
Zones ainda não tocados) e cor própria para Volume Profile (ainda cyan,
igual a Fibonacci) — ambos registrados em `MAPA_EVOLUCAO_CIBORGUE.md` §7
item 19, seguem como Tier 3, candidatos a uma rodada futura da Task #102
se o Operador confirmar que o achado de 2° de matiz acima foi na direção
certa.

**Confirmação "SINCRONIZAÇÃO TOTAL"** (seção explícita da diretiva —
"nunca permitir LONG em um lugar e SHORT em outro"): grep dirigido às 4
camadas de canvas mais recentes (VWAP Bands, Kill Zones, Session Key
Levels, Market Sessions — `chart/*Plugin.tsx`) e seus motores puros
correspondentes (`nexus/vwap-bands.ts`, `nexus/kill-zones.ts`,
`nexus/market-session.ts`) por qualquer literal `"LONG"`/`"SHORT"`/
`"WAIT"` ou atribuição a `engine.direction`/`coreDecision`: zero
ocorrência em qualquer um dos 6 arquivos. Confirma estruturalmente (não
só por convenção documentada) que nenhuma dessas 4 camadas TEM COMO
emitir ou influenciar uma decisão — elas nunca constroem esse conceito,
só geometria/preço. Não substitui os audits completos de pipeline já
feitos (Tasks #25/#31/#44, `RELATORIO_AUDITORIA_FINAL.md`) — é uma
confirmação focada nas 4 adições mais novas desde aquele último audit
completo, que ainda não tinham sido varridas por essa lente específica.

**Testes**: `tsc --noEmit` limpo · suíte completa `vitest` passando
(2 strings pinadas corrigidas em `refinamento-final-wiring.test.ts` +
3 testes novos travando as 2 cores novas e confirmando Kill Zones
intocado) · build de produção ok.

### 6.60 ADENDO "Refinamento das Sessões e Limpeza Visual": Market Sessions
troca N linhas de altura total por 1 faixa fina por segmento

Complemento formal à diretiva institucional de §6.59 (mesmo endereçamento
"Agente 4", mesma imagem de referência, mesma avaliação de legitimidade —
ver nota honesta em §6.59, vale integralmente aqui também): auditoria
específica da camada Market Sessions, apontada como fonte real de
poluição visual ("linhas verticais repetidas... competindo com o preço").

**Causa raiz confirmada no código-fonte real** (não suposição):
`MarketSessionBandsPlugin.tsx` desenhava uma linha 1px de ALTURA TOTAL
(topo a base do painel) para CADA transição de sessão retornada por
`computeSessionBoundaries` — e sessões trocam ~5x/dia (Ásia/Londres/
Londres+NY/Nova York/Pacífico, `nexus/market-session.ts`). Sem nenhum
limiar de decluttering (diferente de Session Key Levels, que já tinha
`MAX_KEY_LEVELS_SHOWN`), qualquer janela de alguns dias em timeframe
baixo empilhava dezenas de linhas quase idênticas cruzando toda a área
de candle. Confirmado também que o gate de relevância (`layer-
relevance.ts::market_sessions`) só controla se a camada INTEIRA
aparece (auto/forced_on/forced_off) — uma vez visível, desenhava TODAS
as transições sem filtro interno, nunca só a mais recente.

**Solução aplicada**: reescrita completa do plugin.
- Geometria: de "1 linha vertical de altura total por transição" para
  "1 faixa fina (`STRIP_HEIGHT_PX = 4`) rente à borda inferior do
  painel, por SEGMENTO de sessão" — zero pixel cruzando a área de
  candle. Mesma ideia da sugestão nº1 da própria diretiva ("faixas
  discretas no topo/eixo do tempo").
- Dado: migrado de `computeSessionBoundaries` (pontos de transição) para
  `computeSessionKeyLevels` (segmentos reais com startTime/endTime/
  closed — já real, já testada, já consumida por `SessionKeyLevelsPlugin`
  e `currentSessionKeyLevel`) — zero 3ª função de derivação de sessão.
  `computeSessionBoundaries` continua viva (App.tsx ainda a usa para o
  sinal `recentSessionBoundary` da Relevance Engine — consumidor e
  propósito diferentes).
- Ênfase: só a sessão CORRENTE (closed:false) tem alpha alto (0.50) e
  ganha rótulo de texto; sessões fechadas ficam com alpha baixo (0.22),
  sem texto próprio — mesma disciplina já provada 2x nesta sessão
  (Session Key Levels open/closed, BOS/CHOCH ageAlpha), aplicada pela
  primeira vez a Market Sessions.
- Por que faixa FINA (nunca altura total como Kill Zones): sessão é uma
  PARTIÇÃO CONTÍNUA — 100% do tempo pertence a alguma sessão, nunca
  lacuna — enquanto Kill Zone é OCASIONAL (só algumas horas/dia). Uma
  faixa sempre-presente em altura total tingiria o painel inteiro o
  tempo todo — a mesma classe de poluição sendo corrigida, só trocando
  "muitas linhas" por "um bloco permanente". Geometrias opostas para
  papéis opostos, documentado no header do arquivo pra próxima sessão
  não reverter por engano.

**Impacto esperado**: zero linha vertical cruzando a área de candle;
contexto de sessão preservado por completo (toda sessão real ainda
aparece, agora como faixa) — Regra de Ouro 4, realoca nunca apaga;
apenas 1 rótulo de texto no total (a sessão corrente) em vez de um por
transição visível.

**Riscos conhecidos**: nenhuma mudança de dado/cálculo, só geometria de
desenho — `computeSessionKeyLevels` já era usada em produção por
`SessionKeyLevelsPlugin`.

**Verificação real**: `tsc --noEmit` limpo · **120 arquivos / 2009
testes** (100%, +5 novos travando a nova geometria — zero linha de
altura total, uso real de `computeSessionKeyLevels`, faixa fina rente à
base, ênfase open/closed, wiring inalterado no call site) · build de
produção ok · smoke Playwright real: app carrega, painel "Camadas do
Gráfico" abre, zero erro JS novo introduzido pela mudança — confirmado
por comparação direta contra o baseline pré-mudança (mesmo script
Playwright rodado nos dois: o único erro de console (`pageerror:
Event`) aparece IDENTICAMENTE em ambos, é o WebSocket bloqueado do
proxy deste sandbox (`wss://fstream.binance.com`, mesma limitação já
documentada §6.55/§6.57/§9.1), não algo introduzido aqui. Não foi
possível verificar visualmente a geometria da faixa com candles reais
(mesma limitação honesta de sempre — zero rede real à Binance neste
ambiente).

### 6.61 "DIRETIVA FINAL — LAPIDAÇÃO INSTITUCIONAL" (autonomia explícita
do Operador): POC do Volume Profile + agrupamento real de Sweeps

Duas diretivas formais adicionais chegaram nesta rodada, ambas com
"Autorização: Aprovada"/"Operador" explícitos e SEM o endereçamento
"Agente 4" das anteriores (§6.59) — tratadas como continuidade direta,
sem ressalva nova. Ambas concedem autonomia técnica ampla, condicionada
a preservar LEI 24/READ_ONLY/SSOT/arquitetura — nenhuma pediu nada que
violasse essas 4 restrições.

**Auditorias de confirmação (sem achado novo, registradas por
completude)**:
- **Loop de animação no main thread**: grep dirigido a `requestAnimationFrame`
  nos 13 plugins de canvas — todos usam o mesmo padrão dirty-flag (1
  `requestAnimationFrame` por arquivo, sempre dentro de `markDirty()`,
  nunca auto-reagendado incondicionalmente). `NeuralMarketAuraPlugin.tsx`
  confirmado como o único caso real de animação contínua, e ela já vive
  isolada em `conviction-cyclone-worker.ts` via `OffscreenCanvas`
  (Regra de Ouro 6 intacta) — main thread só despacha `postMessage`
  quando dirty, nunca anima ele mesmo.
- **"Fios de liquidez"**: `LiquidityZonesPlugin.tsx` (FVG/Order Blocks)
  já é área preenchida + borda 1px (Fio de Seda) desde V-MAX Fase 0.7 —
  não são "fios" soltos, já é zona consolidada. Nenhuma ação necessária.

**Achado real 1 — POC do Volume Profile compartilhava o cyan exato de
Fibonacci na MESMA forma (linha)**: reexame da família cyan (§9.4) com o
mesmo rigor já aplicado a Sweep×Liquidation-peak (§6.59) — a colisão
real nunca foi "barras vs. Fibonacci" (mitigado por forma, já
documentado), era o POC (a única LINHA real do Volume Profile,
`POC_LINE`) usando o MESMO `rgba(0,240,255,...)` que as price lines de
Fibonacci. Pesquisa real (WebSearch, presets documentados de Volume
Profile no TradingView) confirmou 2 precedentes: "Black Ice" (perfil
inteiro monocromático cyan — valida manter as barras como estão) e
"Aurora Glass"/"Obsidian Precision" (POC com acento PRÓPRIO sobre um
perfil de cor única — valida diferenciar só o POC). Corrigido:
`POC_LINE` → `rgba(236, 81, 205, 0.75)` magenta H312, escolhido por
cair no único corredor de matiz real aberto entre a família roxa
(Harmônicos/EQH-EQL, H278) e o vermelho SHORT (H340) — a ~30° de ambos,
sem colidir com nenhuma família já existente. Barras (HVN/LVN/normal)
continuam cyan, intocadas.

**Achado real 2 — Sweeps podem legitimamente aparecer em cluster,
confirmado no motor real (não especulativo)**: a diretiva pediu
"agrupar automaticamente eventos repetidos próximos (ex.: 8 SWEEPs
consecutivos → SWEEP ZONE)". Antes de implementar, auditei
`trap-detection.ts`/`fvg-order-block-engine.js::clusterEqualLevels` pra
confirmar se isso é um cenário real: `clusterEqualLevels` já consolida
swings BRUTOS numa zona EQH/EQL por ancoragem fixa (>=2 toques reais),
mas zonas DISTINTAS (ex. 2 clusters de EQH a alguns pontos de distância,
cada um já >=2 toques) continuam entradas SEPARADAS em `liquidityZones`
— se ambas forem varridas na mesma janela, `TrapSignal.sweptPrices`
carrega os 2 preços próximos, e cada um virava um rótulo próprio no
canvas. Confirmado: estruturalmente real, não hipotético (embora "8" do
exemplo do Operador seja provavelmente ilustrativo/exagerado, não uma
contagem observada).

**Solução aplicada**: nova função pura `clusterSweptPrices` em
`trap-detection.ts` (companion function, mesmo arquivo que já define
`TrapSignal`/`sweptPrices` — dono real do dado) — mesmo idioma de
clusterização por ÂNCORA FIXA (nunca média rodante) de
`clusterEqualLevels`, reimplementado localmente porque ramber-ui e o
engine `.js` legado vivem em pacotes/runtimes diferentes (nunca um
import cross-package). Usa o mesmo limiar já real desta família de dado
(`LIQUIDITY_PROXIMITY_PCT`, `layer-relevance.ts` — já usado por
`unsweptLiquidityNearPrice`/`hasSessionKeyLevelNearPrice`), zero limiar
novo inventado. `EnhancedChart_110_Percent.tsx::priceAxisLabels` agora
chama `clusterSweptPrices` por trap (TOPO/FUNDO separados, já que são
direções semanticamente diferentes) — 1 preço isolado mantém `⚡ SWEEP
↑/↓ N%`; 2+ preços próximos viram `⚡ SWEEP ZONE ↑/↓ (Nx) N%`, ancorado no
preço médio do cluster.

**Impacto esperado**: quando múltiplas zonas de liquidez próximas forem
varridas na mesma janela, o Operador vê 1 rótulo consolidado com
contagem real em vez de N rótulos quase sobrepostos — mesmo espírito de
"menos linhas, mais contexto" da diretiva, aplicado com evidência do
motor real, não por suposição.

**Riscos conhecidos**: nenhum — `detectInstitutionalTraps` (a função que
POPULA `sweptPrices`) está intocada; a clusterização é 100% no lado do
CANVAS (leitura/agrupamento de exibição), zero mudança na detecção real
do evento.

**Testes**: `tsc --noEmit` limpo · **120 arquivos / 2018 testes** (100%,
+9 novos: 8 de execução real hand-verified em `nexus-trap-detection.test.ts`
para `clusterSweptPrices` — incluindo um caso de âncora fixa vs. média
rodante deliberadamente adversarial — +1 travando o novo `POC_LINE` em
`volume-profile-plugin.test.ts`; mais ajustes honestos de pinned-string
em `refinamento-final-wiring.test.ts`/`price-label-stack-plugin.test.ts`
que mudaram de verdade com o refactor, sem contagem líquida nova) ·
build de produção ok · smoke
Playwright real: app carrega, `AWAITING CANDLES…` honesto (zero dado
real neste sandbox, mesma limitação de sempre), footer mostra `FAIL-
CLOSED · SEM ORDENS · SEM CHAVES` — zero erro JS novo (único erro de
console é o WebSocket bloqueado do proxy, já confirmado pré-existente
em §6.60).

### 6.62 Market Sessions, redesenho #2: "chegar mais próximo" de uma
imagem de referência — topo do painel, todas as sessões rotuladas

Pedido explícito do Operador, direto ("Preciso que o modelo chegue mais
próximo possível dessa [imagem] que eu te mandei... e fica melhor ainda
que ela") após uma pergunta de esclarecimento minha (via `AskUserQuestion`
— a nova imagem de referência mostrava a faixa de sessões bem mais
proeminente que o §6.60 acabou de entregar; o Operador respondeu "sem
preferência", então a decisão de design real ficou por minha conta,
documentada aqui).

**Mudança real**: `MarketSessionBandsPlugin.tsx` migra pela 2ª vez nesta
sessão.
- Posição: da base (§6.60) pro **topo** do painel (y=0) — mesmo espírito
  da referência. Risco de colisão com candle avaliado ANTES de mover
  (não suposição): a escala de preço principal usa a margem PADRÃO real
  da lib lightweight-charts (`scaleMargins: { top: 0.2, bottom: 0.1 }`,
  confirmado direto em
  `node_modules/lightweight-charts/dist/typings.d.ts`) — 20% de respiro
  já reservado acima do maior preço visível, folga real suficiente pra
  uma faixa de 24px sem precisar tocar no `scaleMargins` do painel
  principal (mudança maior/mais arriscada, não necessária aqui).
- Rótulo: TODA sessão visível ganha nome + janela UTC real (via
  `marketSessionFromUtc`, mesmo dado do header — zero segunda fonte),
  não só a corrente (era o comportamento do §6.60) — mas só desenha
  texto se a largura real do segmento comportar
  (`MIN_LABEL_WIDTH_PX`/`MIN_SUBLABEL_WIDTH_PX`), nunca espremido
  ilegível.
- Cor: decisão CONSCIENTE de não copiar a paleta multicolorida da
  referência (uma cor por sessão) — a auditoria de paleta desta mesma
  sessão (`AUDITORIA_ECOSSISTEMA_VISUAL.md` §9.4/§9.6) já documentou
  Market Sessions como Prioridade Baixa por design (pano de fundo, nunca
  deveria competir por atenção) e que introduzir família de cor nova
  por sessão contradiria o próprio achado ("evitar cor demais"). O
  efeito de "uma sessão se destaca" da referência é alcançado por
  INTENSIDADE (a corrente com alpha bem mais alto: 0.42 vs. 0.16 das
  fechadas), não por matiz novo — mesmo tom slate-gray de sempre.
- Divisor 1px sólido real entre segmentos (Fio de Seda, Regra de Ouro 5)
  — só a borda esquerda de cada um (partição contígua, a direita de um
  já é a esquerda do próximo).
- `tradePlanAbsenceReason` (overlay de texto condicional do canto)
  desce de `top-2` pra `top-7` — abre espaço real pra faixa nova de
  24px, nunca 2 textos reais sobrepostos.

**2 elementos da imagem de referência que continuam fora, pela mesma
razão já registrada em §6.59** (não repetidos aqui em detalhe): o donut
"PROBABILIDADE" calibrado e as abas de ORDENS/POSIÇÕES/EXECUÇÕES ao
vivo — nenhum dos dois apareceu nesta imagem específica, mas a regra
permanece se aparecerem numa próxima.

**Testes**: `tsc --noEmit` limpo · **120 arquivos / 2021 testes** (100%,
+3 novos: janela UTC real via `marketSessionFromUtc` não fabricada,
divisor 1px sem `setLineDash`, `tradePlanAbsenceReason` na posição nova
— mais os pinned-strings do §6.60 reescritos pra refletir a 2ª migração,
não uma contagem líquida nova de achados) · build de produção ok · smoke
Playwright real: app carrega, painel "Camadas do Gráfico" idêntico, zero
erro JS novo (mesmo único erro pré-existente do WebSocket bloqueado).
Geometria da faixa em si não verificável visualmente neste sandbox
(zero rede real à Binance, mesma limitação de sempre).

### 6.63 BUG CRÍTICO confirmado por captura de tela real: Sweep/Kill Zones
acumulavam sem decaimento por idade — causa raiz + correção + auditoria
completa das demais camadas

O Operador enviou uma captura de tela REAL do app rodando (ZECUSDT 1H) —
não uma referência conceitual como as anteriores. A imagem mostra ~20
rótulos "⚡ SWEEP"/"⚡ SWEEP ZONE" empilhados cobrindo TODO o lado esquerdo
do gráfico, além de múltiplas listras verticais âmbar finas atravessando
toda a largura. Diretiva formal complementar ("V3.0") confirmou o pedido
com um horizonte numérico preciso: 0-50 candles = prioridade máxima,
50-100 = média, 100-200 = transparência reduzida, >200 = ocultar
automático — mesmo espírito, gradual, "sem desaparecer de forma brusca",
já implementado pelo utilitário real `annotation-decay.ts::ageAlpha`
(usado por BOS/CHOCH via `BREAK_DECAY` desde uma rodada anterior).

**Causa raiz real, confirmada no código-fonte (não suposição)**:
`swept` em `LiquidityZone` (engine-bridge.ts) é uma flag PERMANENTE — uma
vez que um pool EQH/EQL é varrido, ele nunca "desvarre". `trap-detection.ts`
agregava TODO nível já varrido na história inteira carregada
(potencialmente semanas) em `sweptPrices`, sem nenhum filtro por idade —
`clusterSweptPrices` (Task #104) já agrupava preços PRÓXIMOS
corretamente, mas nunca removia preços VELHOS. O mesmo padrão existia,
de forma independente, em `KillZoneBandsPlugin.tsx`: o loop de spans
desenhava TODA ocorrência de Kill Zone (recorrem diariamente) sem cap
nenhum — confirmado por leitura direta do `draw()`, não assumido.

**Solução aplicada — raiz, não paliativo**:
- `LiquidityZone`/`clusterEqualLevels` (fvg-order-block-engine.js) JÁ
  computavam `index` real (posição do candle) — só nunca era exposto na
  interface TS estreita de `TrapInputs.liquidityZones`. Corrigido: o tipo
  agora inclui `index: number` (o dado real já fluía em runtime via
  structural typing — TypeScript só não o "via").
- `TrapSignal.sweptPrices: number[]` → `sweptLevels: { price: number;
  index: number }[]` (`TRAP_CONTRACT_VERSION` 2→3, breaking change
  interno documentado). `clusterSweptPrices` ganha `latestIndex` por
  cluster — o MAIOR índice entre os membros (evidência mais recente do
  grupo, nunca uma média — mesmo princípio de "âncora fixa" já usado
  pela clusterização em si).
- `EnhancedChart_110_Percent.tsx`: novo `SWEEP_DECAY = { fadeStartCandles:
  50, expireCandles: 200, minAlpha: 0.12 }` — horizonte MAIOR que
  `BREAK_DECAY` (100) de propósito: Sweep é referência de S/R que
  continua útil por mais tempo que uma anotação de estrutura recém-
  rompida. Aplicado tanto na price line nativa (cor agora um template
  dinâmico `rgba(255,140,0,${alpha*0.85})`) quanto em `priceAxisLabels`
  (novo campo `alpha` no objeto, cluster expirado nunca entra no `out[]`).
- `computeKillZoneSpans` (nexus/kill-zones.ts) ganha `endIndex: number`
  real (índice do último candle de cada ocorrência). `KillZoneBandsPlugin.tsx`
  ganha `KILL_ZONE_DECAY` (mesmos valores 50/200/0.12 — nenhuma evidência
  de um horizonte diferente ser necessário especificamente aqui) e as 3
  cores (fill/border/label) viram templates dinâmicos multiplicados pelo
  alpha real da idade.

**Auditoria honesta das DEMAIS camadas** (o Operador pediu explicitamente
"sem faltar nada" — verificado por leitura de código, não assumido):
| Camada | Bound real | Onde |
|---|---|---|
| BOS/CHOCH | `ageAlpha`/`BREAK_DECAY` | já existia (rodada anterior) |
| Liquidity Sweep | `ageAlpha`/`SWEEP_DECAY` | **corrigido agora** |
| Kill Zones | `ageAlpha`/`KILL_ZONE_DECAY` | **corrigido agora** |
| FVG/Order Blocks | `.filter((z,i) => i<3 \|\| isRealObstacle(z))` | já existia (App.tsx:6832-6833) |
| EQH/EQL | `.slice(0,4)` | já existia (App.tsx:6834) |
| Session Key Levels | `MAX_KEY_LEVELS_SHOWN=5` | já existia (§6.57) |
| Market Sessions | recortado pelo range de tempo VISÍVEL (`timeToCoordinate` retorna null fora da tela) + faixa fina por design (§6.60/§6.62) — categoria diferente (contexto de "o que aconteceu na janela que você está olhando", não "evento antigo que devia sumir") | sem mudança necessária |

Todos os itens citados nominalmente na diretiva ("Liquidity Sweep antigo,
FVG antigo, BOS antigo, CHOCH antigo, Session antiga, Marcações antigas")
confirmados cobertos. "Ordem histórica" da diretiva não se aplica —
AR10 é READ_ONLY, nunca guarda histórico de ordens reais.

**Testes**: `tsc --noEmit` limpo · **120 arquivos / 2025 testes** (100%,
+10 novos: 8 testes hand-verified para `clusterSweptPrices` com
`latestIndex` real — incluindo um caso adversarial onde o preço mais
alto do cluster NÃO é o de índice mais recente —, 3 para `endIndex` real
de `computeKillZoneSpans` incluindo overlap concorrente; mais os
pinned-strings de 3 arquivos de teste reescritos pra refletir a
migração `sweptPrices`→`sweptLevels` e as cores dinâmicas) · build de
produção ok.

**Riscos conhecidos**: nenhum de decisão (LEI 24 intacta — mudança
puramente de decaimento visual); geometria/timing do decaimento em si
não verificável ao vivo neste sandbox (zero rede real à Binance).

**Escopo honesto**: o horizonte de Kill Zones (50/200/0.12, idêntico ao
de Sweep) foi uma decisão sem evidência numérica própria — reaproveitar
em vez de inventar um número novo sem justificativa. Se o Operador notar
que Kill Zones ainda acumula demais dentro da janela de 200 candles
(recorre com mais frequência que Sweep), esse horizonte específico é
candidato a ajuste numérico isolado, não uma nova arquitetura.

### 6.64 "DIRETIVA FINAL DE LAPIDAÇÃO DO GRÁFICO E EVOLUÇÃO VISUAL" (18
seções) — auditoria honesta seção-a-seção + a única lacuna real
implementada: Consolidação de Zonas Institucionais (§4)

A diretiva chegou como uma visão de 18 seções (limpeza visual, memória
dinâmica, organização automática, consolidação de zonas, sessões,
hierarquia, sistema adaptativo, pesquisa contínua, evolução
arquitetural, sincronização, refinamento visual, motor de análise
institucional, pesquisa quantitativa/de ferramentas profissionais,
organismo adaptativo, pesquisa de gaps). Antes de escrever qualquer
código (CLAUDE.md, "audite antes de construir"), cada seção foi
verificada contra o código-fonte real — não assumida como pendente só
por estar numa diretiva nova.

**Auditoria seção-a-seção**:
| § | Pedido | Estado real |
|---|---|---|
| 1 | Limpeza visual inteligente | Relevance Engine (`layer-relevance.ts`, §6.47/§6.93) já decide show/hide por camada |
| 2 | Memória visual dinâmica (0-50/50-100/100-200/>200) | `annotation-decay.ts::ageAlpha` já cobre BOS/CHOCH, Sweep, Kill Zones (§6.63) |
| 3 | Organização automática | Relevance Engine + modo 3-estados auto/manual (§6.46-6.48) |
| **4** | **Consolidação de zonas (EMA/VWAP/FVG/OB/Liquidity → 1 Zona Institucional)** | **LACUNA REAL — implementada nesta entrega (ver abaixo)** |
| 5 | Sessões: faixa discreta, não linha vertical | `MarketSessionBandsPlugin` já redesenhado 2x (§6.60/§6.62) |
| 6 | Hierarquia visual (Candles > Trade Plan > Estrutura > ...) | LEI 24 já garante Core Engine como único emissor; z-order dos plugins já segue esta ordem (Trade Plan/Aura montados por último) |
| 7 | Sistema adaptativo (timeframe/zoom/ativo/volatilidade) | Relevance Engine já lê sinais ao vivo (proximidade/estado direcional/densidade), recalcula a cada ciclo real |
| 8 | Pesquisa contínua em plataformas profissionais | Já documentada em `AUDITORIA_ECOSSISTEMA_VISUAL.md` (Bloomberg/Quantower/NinjaTrader/TradingView, múltiplas rodadas) |
| 9 | Evolução arquitetural (preservando LEI 24/READ_ONLY/SSOT) | Princípio já seguido em toda a sessão — nenhuma mudança violou os 3 |
| 10 | Sincronização (SSOT, sem sinais contraditórios) | Store única (`unified-snapshot-store.ts`), Core Engine como única decisão — arquitetura já estabelecida |
| 11 | Refinamento visual (paleta/linhas/tipografia/...) | Auditorias reais já feitas (`AUDITORIA_ECOSSISTEMA_VISUAL.md` §9), itens objetivos corrigidos (Sweep×Liquidação, POC magenta); consolidação subjetiva da paleta amber/Volume Profile permanece decisão do Operador, não implementada (`MAPA_EVOLUCAO_CIBORGUE.md` item 19) |
| 12 | Resultado esperado (institucional/legível) | Objetivo contínuo, não uma tarefa fechável — guia todas as rodadas de lapidação já feitas |
| 13 | Motor de Análise Institucional (estrutura/liquidez/regime/confluência/cenários com invalidação, "nunca certeza") | `scenario-engine.ts` (`buildScenarioProjection`) já entrega exatamente isto — `basis: "COUNCIL_OPINION_MASS_NOT_MARKET_PROBABILITY"`, alvos + invalidação reais, rotulado hipótese |
| 14 | Pesquisa de métodos quantitativos (BOS/CHOCH, Wyckoff, CVD, VWAP, ATR, fractais, clustering, ...) | Já motores reais no repositório para a maioria (ver `ipad_runtime/src/research/engines/`, `QUARANTINE.md`); Wyckoff/footprint charts continuam gaps reais não implementados, já flagados em `MAPA_EVOLUCAO_CIBORGUE.md` |
| 15 | Pesquisa de ferramentas profissionais | `ELITE TRADING RESEARCH MAP` (Task #92) + `AUDITORIA_ECOSSISTEMA_VISUAL.md` já cobrem isto |
| 16 | Organismo adaptativo (reorganiza sozinho) | Relevance Engine + decay por idade juntos já formam este comportamento |
| 17 | Pesquisa de gaps (indicadores ausentes, redundâncias, conflitos) | Disciplina já seguida every rodada (ver achados de auditoria citados em quase toda entrada deste handbook) |
| 18 | Resultado final | Mesmo objetivo contínuo do §12 |

**A única lacuna real: §4, Consolidação de Zonas**. Os 3 motores de
"confluência" já existentes no repositório foram lidos antes de escrever
qualquer linha nova (`confluence-engine.ts` — concordância DIRECIONAL
entre Ensemble/Council/Multi-Timeframe; `confluence-corridor.ts` —
intensidade visual do mesmo pool; `layer-relevance.ts` — mostrar/esconder
camada inteira). Nenhum dos três agrupa por PROXIMIDADE DE PREÇO entre
ferramentas estruturalmente independentes — confirmado gap real, não
duplicação.

**Entregue**: `nexus/institutional-zones.ts` — motor puro
(`computeInstitutionalZones`) que agrupa por proximidade de preço
(`INSTITUTIONAL_ZONE_PROXIMITY_PCT = 0.35%`, mesma família de convenção
documentada de `VOLUME_PROFILE_PROXIMITY_PCT`) os níveis JÁ reais de EMA
atual, VWAP atual, Nexus Line atual, FVG não mitigadas, Order Blocks não
mitigados e EQH/EQL não varridas — mesmo padrão de clustering por
"âncora fixa" já usado por `clusterEqualLevels`/`clusterSweptPrices`
(nunca uma média móvel, um membro no limite nunca arrasta o grupo).
Confluência real exige `MIN_DISTINCT_SOURCES_FOR_ZONE = 2` FERRAMENTAS
distintas — duas instâncias da mesma ferramenta (ex.: 2 Order Blocks
vizinhos) nunca formam uma "Zona Institucional" sozinhas, só ferramentas
genuinamente independentes concordando. Teto real `MAX_INSTITUTIONAL_ZONES
= 5` (mesma natureza de `MAX_KEY_LEVELS_SHOWN`), as mais fortes primeiro.

Zero prop nova em `App.tsx`: todo insumo já vivia dentro de
`EnhancedChart_110_Percent.tsx` (`emaLastValue`/`vwapLastValue`/
`nlLastValue`, já computados do mesmo array `data`; `fairValueGaps`/
`orderBlocks`/`liquidityZones`, já chegam pré-filtrados como props —
mesmo padrão de `App.tsx:6830-6834`). `InstitutionalZonePlugin.tsx` novo
(21ª camada do painel "Camadas do Gráfico") desenha a faixa real via
`series.priceToCoordinate` (mesmo padrão de `LiquidationHeatmapPlugin`),
cor violeta nunca usada antes na paleta (âmbar=Kill Zones/Sweep,
dourado=Trade Plan Zone, magenta=POC, ciano=Volume Profile), fio de seda
1px. Mounted ANTES de Neural Market Aura/Trade Plan Zone no z-order —
fica visualmente atrás do núcleo do plano, nunca compete com ele (§6 da
própria diretiva: Trade Plan > Confluências). `layer-relevance.ts` ganha
`institutional_zones` com `relevant: true` incondicional — mesmo
princípio já usado por `neural_market_aura`: o motor já devolve `[]`
honesto sem confluência real cruzada, uma segunda regra de relevância
aqui seria redundante, não mais correta.

**Camada ADITIVA, nunca substituição** (Regra de Ouro 4): as linhas/zonas
individuais de EMA/VWAP/Nexus Line/FVG/Order Block/Liquidez continuam
desenhadas exatamente como antes pelos seus próprios plugins/séries —
esta faixa só soma um destaque visual por trás delas.

**Escopo honesto — o que fica para depois**: a diretiva pede
"reduzindo sobreposição" — a entrega desta rodada mostra ONDE a
confluência real está, mas ainda NÃO reduz o detalhe individual de cada
ferramenta quando já coberta por uma Zona Institucional (ex.: afinar a
linha de EMA quando ela já está dentro de uma zona destacada). Essa
segunda metade tocaria simultaneamente os renderizadores de EMA, VWAP,
Nexus Line, FVG/OB e Liquidez — um raio de mudança maior que esta
entrega, e uma decisão de UX real (qual camada "cede" visualmente à
outra) que merece sua própria rodada isolada e verificada, não
empacotada com a primeira metade.

**Testes**: `tsc --noEmit` limpo · **121 arquivos / 2040 testes** (100%,
+15 novos: 14 de execução real para `computeInstitutionalZones`
—incluindo o caso adversarial de 2 Order Blocks vizinhos NÃO formando
confluência sozinhos, e o caso de âncora fixa dividindo 2 zonas reais
mesmo com vizinhos próximos em cadeia — mais 1 de relevância; 2 arquivos
de teste com contagem de camadas atualizada de 20→21) · `npm run build`
ok.

**Riscos conhecidos**: nenhum de decisão (LEI 24 intacta — camada
puramente informativa/geométrica, nunca gera Entry/Stop/Target).

### 6.65 Captura real (ZECUSDT 1H) + relato do Operador: 3 achados
distintos — duplicação real de Sweep, "triângulo" no canto sem código
correspondente, e FVG/OB/Fibonacci somem depois de um movimento forte

O Operador enviou uma segunda captura de tela REAL do app ao vivo,
apontando 3 problemas concretos. Cada um investigado separadamente antes
de qualquer correção (nenhum consertado por suposição).

**1) "SWEEP ZONE ↑ (2x) 31%" (caixa larga) sobreposta a "SWEEP ↑ 33%"
(linha fina) — duplicação real confirmada.** Causa raiz: `priceAxisLabels`
(rótulos) já deduplicava por preço e clusterizava via `clusterSweptPrices`
antes de desenhar — 1 cluster real = 1 caixa de texto. O efeito que
desenha as price lines NATIVAS (`sweepLinesRef`) nunca recebeu a mesma
disciplina: iterava `t.sweptLevels.forEach` bruto, 1 linha por nível não
deduplicado. Um cluster "(2x)" tinha 1 rótulo mas 2 linhas quase
idênticas empilhadas por baixo dele — o mismatch real que lia como
poluição/duplicação. Corrigido: o efeito da price line agora usa a
MESMA deduplicação (`Set` global de preço) + o MESMO `clusterSweptPrices`/
`LIQUIDITY_PROXIMITY_PCT` do bloco de rótulos — 1 cluster real = 1 linha,
nunca mais.

**2) Forma triangular/hachurada no canto superior esquerdo — investigada,
sem código correspondente encontrado.** Busca exaustiva (`ctx.rotate`,
`ctx.clip(path)`, `createPattern`, hachura, wedge/triângulo) em todos os
plugins de canvas: zero ocorrência em todo o repositório — nenhum plugin
desenha diagonal ou padrão hachurado (a própria regra "Fio de Seda" já
proíbe `setLineDash`, e não existe nenhum equivalente pra preenchimento).
Hipótese fundamentada (não suposição — baseada na ordem real de montagem
dos plugins, `EnhancedChart_110_Percent.tsx:2196-2299`): múltiplos
retângulos translúcidos alinhados a eixo de plugins DIFERENTES (banda
âmbar do Kill Zone recortada na borda esquerda dos dados visíveis +
linha/caixa de Sweep + eventualmente a banda da Zona Institucional)
pintando na MESMA região do canto superior esquerdo, comprimidos numa
captura de tela, podem ler visualmente como "hachurado" mesmo sendo cada
um deles um retângulo/linha reta comum. A correção do item 1 acima já
reduz a densidade real de retângulos amber sobrepostos nessa região —
sem uma nova captura pós-correção, não dá pra confirmar se o efeito
óptico desaparece por completo; fica como item a reobservar.

**3) FVG/Order Blocks e a grade de Fibonacci sumiam do gráfico depois de
um movimento forte de preço — achado real, não bug de renderização.**
Causa raiz confirmada no código: `liquidity_zones` (FVG/OB) e `fibonacci`
só ficavam `relevant` quando havia obstáculo real no caminho do plano OU
o nível estava a menos de ~0.4-0.5% do preço vivo — nenhuma das duas
condições cobre "a zona/nível existe de verdade, só não está perto agora".
Depois de um movimento de -6.63% como o da captura, toda a estrutura
mapeada perto do topo anterior fica >5% longe do preço — a Relevance
Engine escondia CORRETAMENTE por essa regra, mas a regra em si tratava
proximidade como sinônimo de existência para duas camadas que são
referência ESTRUTURAL (uma FVG/OB é válida até ser mitigada, a grade de
Fibonacci é válida a partir do swing que a originou — nenhuma das duas
"expira" só por o preço se afastar). Corrigido: `LayerRelevanceInput`
ganha `hasUnmitigatedStructuralZone` (>=1 FVG ou Order Block real não
mitigado, qualquer distância) e `hasFibonacciLevels` (Matriz de
Confluência tem >=1 nível real calculado) — cada um vira uma 3ª condição
real de `relevant`. A proximidade antiga (`fibonacciNearPrice`) não foi
descartada: virou o sinal de `emphasis: "highlight"` (mesmo mecanismo já
real do EPC FINAL §3/§12) — perto do preço agora só deixa a camada mais
destacada, nunca decide sozinha se ela aparece.

**Harmonics ("triângulo" na fala do Operador pode se referir a isto
também) — gate MANTIDO de propósito, distinção explicada, não uma
omissão.** `harmonicBestFitScore >= 0.75` não é um filtro de
PROXIMIDADE — é um filtro de QUALIDADE geométrica do próprio padrão
(aderência real de razão XABCD). Desenhar um padrão de fit baixo seria
ativamente enganoso (uma forma que parece um Gartley/Bat mas não bate a
proporção Fibonacci de verdade), categoria diferente de "referência real
mas momentaneamente longe do preço". Sem evidência de um limiar melhor
que 0.75, o número não foi alterado — só a semântica documentada com
clareza para não confundir com o achado 3 acima.

**Escopo honesto — o que NÃO foi alterado nesta rodada**: `equal_highs_
lows` (EQH/EQL) continua com o mesmo gate de proximidade
(`unsweptLiquidityNearPrice`) — mantido de propósito: EQH/EQL é
fundamentalmente sobre "o preço está prestes a varrer este nível", uma
pergunta de proximidade genuína (diferente de FVG/OB), e é a MESMA
matéria-prima do Sweep, que já teve um bug real de acúmulo corrigido em
§6.63 — soltar o gate aqui reabriria exatamente aquele risco. Se o
Operador achar que EQH/EQL também deveria aparecer mais, é uma decisão
separada, não uma extensão automática desta.

**Testes**: `tsc --noEmit` limpo · **121 arquivos / 2044 testes** (100%,
+4 novos: 2 para `liquidity_zones` com `hasUnmitigatedStructuralZone`
real, incluindo o caso adversarial de proximidade sozinha nunca bastar;
2 para `fibonacci` reescritos para o novo contrato relevant/emphasis,
incluindo o mesmo caso adversarial fail-closed) · `npm run build` ok.

**Riscos conhecidos**: nenhum de decisão (LEI 24 intacta). Risco de
produto, não de arquitetura: mostrar FVG/OB/Fibonacci mais frequentemente
reintroduz ALGUMA densidade visual que a Relevance Engine existe para
reduzir — mitigado por manter a decisão binária (existe ou não existe
zona real), nunca voltar a "sempre visível incondicional", e por manter
`emphasis` fazendo o trabalho fino de destacar só o que está genuinamente
perto do preço agora.

### 6.66 Diretriz Consolidação/Auditoria/Evolução do Ecossistema —
auditoria real de 4 frentes + correção dos achados confirmados

Diretriz do Operador (formato "carta de intenção", endereçada a um
"Agente 4" que não existe nas mensagens diretas — CLAUDE.md §7 exige
confirmar antes de agir nesse padrão; tratado como autorizado porque veio
direto no chat e o conteúdo só reforça LEI 24/READ_ONLY/SSOT, nunca pede
para contorná-los) pedindo consolidação ampla: auditoria de conflitos/
duplicação, unificação da Confluência, ciclo de vida real por camada
visual, sincronização total, performance, e documentação atualizada.
Escopo real demais para uma rodada só sem virar trabalho especulativo —
disciplina aplicada: **auditar antes de construir** (item 1 da Disciplina
de Trabalho), corrigir só o que a auditoria confirmou com evidência
arquivo:linha, documentar o resto como backlog honesto (task #82).

**Auditoria (4 agentes paralelos, só leitura, evidência real):**

1. **LEI 24 / duplicação de cálculo.** Zero violação em swing/FVG-OB/
   opinionMass (todos passthrough real ou motor único). Um achado real:
   `App.tsx:3930` afirmava que o Radar "nunca recalcula nem emite LONG/
   SHORT por conta própria (LEI 24)" — falso por leitura direta:
   `engine-bridge.ts:1138-1166` (`directionFromRegime`/
   `scanRadarCandidate`) computa LONG/SHORT via `classifyMarketRegime`
   (regime de mercado, não o Core Engine real) para candidatos em segundo
   plano, nunca para o ativo selecionado. Texto corrigido para descrever
   o que o código de fato faz. Um achado documentado, não corrigido: o
   Trade Plan do Council (`nexus/trade-plan.ts:217`, `direction: stance`)
   pode divergir de `engine.direction` — design deliberado da task #40
   ("Council-only por design"), com aviso já existente na UI, não é bug
   novo. Pergunta explícita levada ao Operador: manter o Radar assim
   (fora do escopo textual de LEI 24, que fala "para o timeframe
   selecionado no gráfico") ou converter em ranking sem direção.
2. **Ciclo de vida visual dos 12 plugins de canvas** (a diretriz falava
   em 13; confirmado por grep dos imports que são 12). Achado mais grave:
   `MarketSessionBandsPlugin` era o ÚNICO sem nenhum mecanismo de
   ciclo de vida — o próprio cabeçalho do arquivo documentava um teto que
   existiu no "Redesenho real #1" e foi removido no "Redesenho real #2"
   para mostrar todas as sessões, uma regressão real. Corrigido: mesmo
   teto `MAX_KEY_LEVELS_SHOWN` já declarado por `SessionKeyLevelsPlugin`
   (zero segunda constante). Segundo achado: `LiquidityZonesPlugin`
   deixava uma zona-obstáculo de um plano ATIVO esmaecer por idade fixa
   (`ageAlpha`) mesmo continuando a bloquear o caminho do plano —
   corrigido para `alpha=1` enquanto `isObstacleZone`, decaimento normal
   assim que deixar de ser obstáculo. Três achados de menor severidade
   (LiquidationHeatmapPlugin sem peso de idade/símbolo,
   SessionKeyLevelsPlugin com corte abrupto em vez de fade,
   OrderFlowHeatmapPlugin sem fade gradual no ring buffer) documentados
   no backlog — refinamentos, não regressões.
3. **Unificação de Confluência.** `institutional-zones.ts` unificava só
   4 das ~9 fontes reais pedidas (EMA/VWAP/FVG/OB, + liquidez parcial).
   Veredito do agente: lacuna de FIAÇÃO, não de matemática — os motores
   de Suporte/Resistência, Market Structure, Volume Profile e Session Key
   Levels já são reais e graduados, só nunca alimentavam este
   consolidador. Fechado nesta rodada: Suporte/Resistência (S1/R1) — dado
   já era prop existente de `EnhancedChart_110_Percent.tsx`, zero
   plumbing novo, mesmo princípio "zero prop nova de App.tsx" já
   documentado no arquivo. Os 3 restantes (Market Structure, Volume
   Profile POC, Session Key Levels) e o evento de Liquidity Sweep exigem
   1 prop nova cada — documentados no backlog. Confirmado sem sobreposição
   real entre `institutional-zones.ts` (domínio de PREÇO),
   `confluence-engine.ts` e `confluence-corridor.ts` (domínio de
   DIREÇÃO/CONVICÇÃO) — três perguntas diferentes, não duplicação.
4. **Performance/infraestrutura.** Nenhum gargalo urgente confirmado: 2
   loops não-memoizados são "não catastróficos" (O(n) pequeno, teto
   baixo); o recompute de `relevanceInput`/`priceAxisLabels`/
   `auraReading` a cada tick de `livePrice` é uma troca JÁ deliberada e
   documentada no próprio comentário-fonte, não um bug oculto. Achado
   real de documentação: `docs/READ_ONLY_MARKET_SAFETY.md` e
   `docs/AR10_CYBORG_2_REAL_DATA_LAYER_RUNTIME_PROBE_V1.md` descreviam um
   `storage.js` com "OPFS + fallback IndexedDB" que NUNCA existiu no
   repositório (confirmado por busca no filesystem inteiro) — a
   persistência real hoje é `nexus/persistence.ts` (IndexedDB via pacote
   `idb`). Ambos os documentos corrigidos, mantendo o texto original como
   registro histórico do design nunca implementado (nunca apagar
   informação real). Achado arquitetural real, só documentado (backlog):
   `nexus/event-bus.ts` tem 3 publishers reais e ZERO subscribers em todo
   `ramber-ui/src` — infraestrutura pronta, nunca conectada; a UI lê
   estado via seletores diretos do Zustand, não via o bus.

**Testes**: `tsc --noEmit` limpo · **121 arquivos / 2047 testes** (100%,
+3 novos: 1 para confluência real S1+EMA em `institutional-zones.ts`, 1
para a disciplina "2 instâncias da mesma ferramenta não bastam" aplicada
a S1/R1, 1 travando o comportamento real de `alpha=1` para zona-obstáculo
em `LiquidityZonesPlugin`) · `npm run build` ok · verificação com
Playwright real (Chromium headless, bypass documentado do próprio
`access-gate.tsx` — "cortina contra abertura acidental", não segurança
real): app carrega sem crash, zero erro de console rastreável aos
arquivos alterados, e confirmou bônus real — o Fail-Closed funciona
(sandbox sem egress a exchanges, mesma limitação já documentada em
`QUARANTINE.md` para `history-capture.js`, produz "AWAITING CANDLES…"
honesto, nunca um candle fabricado). Sem candles reais disponíveis no
sandbox, não foi possível confirmar pixel-a-pixel os 2 fixes de canvas —
decisão deliberada de NÃO injetar candle sintético no pipeline de render
só para a screenshot, mesmo sendo só verificação local (Regra de Ouro 1).
Confiança na correção vem da leitura linha-a-linha do código real + dos
testes que travam o comportamento exato.

**Riscos conhecidos**: nenhum de decisão (LEI 24 intacta nos itens
corrigidos). O achado do Radar (item 1 acima) continua uma pergunta em
aberto para o Operador — não uma correção unilateral, porque toca
diretamente a lei mais importante do projeto. Verificação visual dos 2
fixes de canvas fica pendente de uma sessão com egress real às exchanges
(iPad do Operador ou ambiente com rede liberada).

## Relatório final (Entregáveis de cada ciclo/PR, pedido explícito da
diretiva) — cobre §6.35 a §6.41 em conjunto

- **Arquivos alterados**: ver os commits desta trilha (`aa88134` e
  anteriores citados em §6.35; `ed3f4db` FASE 0/1; `e482fd2` FASE 3-6;
  FASE 7-9; Completar Fase 7 — scanner/painel/clique; Fase 5 fechamento —
  correção de contrato + visual; + o commit desta entrega, Fase 8.1 —
  heatmap de liquidação). Novos módulos puros: `nexus/stage-runner.ts`,
  `nexus/confluence-corridor.ts`, `nexus/radar-qualification.ts`,
  `nexus/radar-universe.ts`, `nexus/liquidation-heatmap.ts`. Novo plugin
  de canvas: `chart/LiquidationHeatmapPlugin.tsx` (16ª camada do painel
  "Camadas do Gráfico"). Fatias novas na store: `smc`, `cvd`,
  `orderflowSignals`, `confluenceCorridor`, `radarCandidates`.
  `engine-bridge.ts` ganhou `scanRadarCandidate()` (fetch real + motores
  puros já existentes); `App.tsx` ganhou o efeito de scan em lote, o
  painel "OPORTUNIDADES", o 3º entry point na SideBar, o toggle
  "LIQUIDAÇÕES FORÇADAS", o teto de retenção do feed de liquidação subiu
  de 30 para 500, e o crash real de `effectiveChartLayerVisibility` foi
  corrigido (fallback `?.relevant ?? true`); `confluence-engine.ts` teve
  seu tipo de entrada de multi-timeframe afrouxado para um formato
  estrutural mínimo; `configs/asset-universe.default.json` teve sua
  própria metadata (`status`/`wired_into_live_app`/`note`) corrigida
  para refletir que agora É lido de verdade (achado honesto, ver §6.39).
- **O que foi unificado/removido**: fileira de 12 botões redundante do
  header (SmartOmnibox já cobria); `obstacleSuffix` duplicado entre o
  Trade Plan real e o fallback do Núcleo (agora 1 função compartilhada);
  espaço redundante nos glifos `OB↑/OB↓/FVG↑/FVG↓`; a dupla/tripla
  contagem de council/multi-timeframe no Corredor de Confluência v1
  (§6.40, achado e corrigido na mesma rodada).
- **Diagrama do fluxo final**: `docs/ORGANISM_DATA_FLOW.md` — catálogo de
  eventos atualizado nesta trilha com os 4 eventos QUANT.* + este
  `BRAIN.RADAR_CANDIDATES.UPDATED`, e a seção "Observadores puros
  read-only" atualizada com `radar-universe.ts` + o lado impuro real
  (`scanRadarCandidate`, `engine-bridge.ts`) que liga os avaliadores
  puros ao mundo real.
- **"Uma fatia = um dono"**: confirmado — cada fatia nova
  (smc/cvd/orderflowSignals/confluenceCorridor/radarCandidates) tem
  exatamente 1 motor/efeito real que a escreve, verificado por teste de
  fiação em cada caso; `confluenceCorridor` agora tem exatamente 1
  consumidor visual real (`NeuralMarketAuraPlugin` via `ChartWidget`),
  nunca um segundo objeto gráfico "corredor" concorrente.
- **"Zero recálculo na UI"**: confirmado para os motores novos — todos
  são funções puras chamadas uma vez por transição real, nunca
  recomputadas por consumidor; o painel "OPORTUNIDADES" só lê
  `radarCandidates` via seletor, nunca reordena/refiltra localmente
  (`rankRadarCandidates` já entrega a lista final); `ChartWidget` não
  recomputa mais `conviction` a partir de `convictionReading` — lê
  `confluenceCorridor.intensity` já pronto. Migração completa dos
  consumidores antigos (WidgetContext) para os seletores da store
  permanece pendência registrada (§6.36), não uma violação nova.
- **Backlog flagado (não inventado)**: Pitchfork; Elliott simplificado;
  "liquidity sweep projection"/"institutional volume zones" como
  conceitos distintos (hoje parcialmente cobertos por motores já reais,
  não expandidos); migração de consumidores da FASE 1.1 (§6.36);
  cobertura do Relevance Engine para `liquidation_heatmap` (gap
  documentado, §6.41). O visual do Corredor de Confluência no canvas e a
  sobreposição `confluence-corridor.ts` × `ConvictionReading` (§6.39) e o
  heatmap real de liquidação no canvas (§6.38) — todos entregues e
  corrigidos nas rodadas §6.40/§6.41, não continuam pendentes.
- **Pendências de produto**: `computeDrawdownPct`/paper-trading —
  confirmado pertencer a outro projeto do Operador, não a este
  repositório.
- **Conformidade com todas as leis**: FASE 0 já auditou e confirmou (LEI
  24/Permanentes 1-9) — reconfirmado nesta entrega que nenhum módulo
  novo (Stage Runner, Corredor, Radar/scanner/painel, Liquidation
  Heatmap) emite ou altera LONG/SHORT/WAIT/Entry/Stop/Target; todos são
  observadores/qualificadores read-only. `riskGated` do scanner de fundo
  é sempre `false` honestamente rotulado (nenhum Conselho roda para
  candidatos em segundo plano) — nunca fabricado como risco liberado de
  verdade. O heatmap de liquidação é explicitamente retrospectivo (ver
  §6.41) — nenhum rótulo/comentário o apresenta como preditivo.
- **Testes executados**: `tsc --noEmit` limpo · **111 arquivos / 1834
  testes** (100%) · `npm run build` ok · `audit-header-maxcontent.mjs` 11
  viewports CLEAN via build+preview real (§6.39, §6.41) · verificação
  Playwright ao vivo do painel "OPORTUNIDADES" (§6.39), do boot
  pós-refatoração do Corredor de Confluência (§6.40) e do painel
  "Camadas do Gráfico" com "LIQUIDAÇÕES FORÇADAS" pós-correção do crash
  de `effectiveChartLayerVisibility` (§6.41).

---

### 6.67 EPC OMEGA FINAL — diretiva de 4 partes (Meta Engine, gráfico
World Class, performance/autoaprendizado, homologação final); relatório
completo em `docs/historico/RELATORIO_EPC_OMEGA_FINAL.md`

Diretiva do Operador em 4 partes sequenciais ("ler tudo antes de
implementar" — seguido à risca: as 4 partes foram lidas por completo antes
de qualquer auditoria). Auditoria real de 5 frentes paralelas confirmou que
a maior parte do "Meta Engine" pedido já existia em fragmentos reais
(Conselho, `decision-layer.ts`, `confluence-engine.ts`,
`organism-orchestrator.ts`) — trabalho real foi consolidar, não construir
do zero. Achado-chave que mudou o escopo seguro do resto da diretiva: dos
~40 indicadores nomeados, 12 são AUSENTES no repositório, e 2 deles
(On-Chain, Whale Activity) são auto-documentados em `gmil/README.md`/
`gmil/types.ts` como impossíveis sem API paga embutida no cliente
(proibido) — não uma lacuna, uma fronteira real do produto.

**Implementado**: (1) `nexus/engine-signal-contract.ts` novo — contrato
`EngineSignal` com os 10 campos pedidos (peso/confiança/relevância/
validade/contexto/justificativa/prioridade/qualidade/horizonte/vida útil),
`deriveEngineSignalsFromCouncil()` populando só o que é real hoje (4/10
campos), resto `null` honesto; (2) `unified-snapshot-store.ts` §4 CÉREBRO:
`nexusDecision`/`institutionalScoreReading`/`heatScoreReading` ganharam os
4 lugares canônicos + evento próprio no bus (`event-bus.ts`/
`organism-orchestrator.ts`) — antes só existiam como `useMemo` local em
`App.tsx`, invisíveis para qualquer assinante futuro do organismo; (3)
`institutional-zones.ts`: +3 fontes (Volume Profile POC, Session Key
Level, Liquidity Sweep) — fecha 3 dos 4 pares de confluência que a
diretiva nomeia explicitamente; (4) 1 colisão real de cor corrigida
(EQH/EQL vs. roxo do Conselho/Harmônico, <1° de matiz —
`rgba(200, 107, 255)` → `rgba(110, 150, 255)`, azul H223, >40° de
qualquer outro matiz já atribuído no app); (5) `InstitutionalZonePlugin`:
opacidade agora escala com `distinctSourceCount` real (antes sempre a
mesma, independente da força de confluência); (6) `self-diagnostics.ts`:
novo achado "Memória (heap JS)" expõe `health.memoryMb` (já medido, nunca
reportado); (7) `nexus/macd.ts` novo — reusa `computeEmaSeries` duas
vezes (linhas rápida/lenta sobre o preço, sinal sobre o próprio MACD),
um dos 12 indicadores confirmados ausentes e o único puro-matemático
sobre dado já real. Construído e testado, mas DELIBERADAMENTE não ligado
a `engine-bridge.ts`/UI ainda (Laboratório de Evolução, isolar antes de
integrar) — confirmado que nem entra no bundle de produção hoje
(tree-shaking, ninguém importa).

**Autocorreção real durante a rodada, registrada por transparência**: eu
ia estender o cache por referência (padrão `KillZoneBandsPlugin`) para
`LiquidationHeatmapPlugin` por analogia de padrão — a suíte de testes já
tinha uma trava (`refinamento-final-wiring.test.ts`) provando que uma
rodada anterior já bancou essa pergunta com benchmark real
(`computeLiquidationHeatmap` ~0,006ms/chamada a N=500 vs. ~1,2ms do caso
que justificou o cache do KillZone) e concluiu que o cache ali seria
complexidade sem benefício medido. Revertido antes do commit — a suíte de
testes funcionou exatamente como uma trava de regressão deveria.

**Deliberadamente não implementado, com motivo real** (detalhe completo
no relatório): reconhecimento automático de padrão gráfico ("Rabiscos
Inteligentes" — confirmado que não existe nada disso hoje), motor de
auto-otimização contínuo (sem gargalo urgente confirmado em 3 documentos
independentes), autoaprendizado real (fundação passiva existe,
recalibração de peso é trabalho novo e estatisticamente sensível),
Footprint/Breaker-Mitigation-IFVG/Elliott-Pitchfork-Gann/Correlação
cross-asset (dado real existe ou pesquisa é necessária, mas cada um
merece rodada própria), GMIL dentro da store unificada (cruza uma
fronteira hoje protegida por CI, decisão grande demais para esta rodada).

**Testes executados**: `tsc --noEmit` limpo · **124 arquivos / 2097
testes** (100%, +28 novos) · `npm run build` ok (869,66 kB / gzip
264,94 kB, +2,7 kB desta rodada — idêntico com ou sem `macd.ts`, ainda
fora do bundle real).

---

### 6.68 Diretriz Final de Integração Total — fechar o que já existe:
GMIL → store, MACD graduado, estágio NEXUS_DECISION; relatório completo
em `docs/historico/RELATORIO_MESTRE_HOMOLOGACAO.md`

Diretiva de consolidação pura (Operador foi explícito: "não" a motores
novos, "sim" a concluir ligações já existentes). Varredura de todo
`nexus/*.ts` por módulos sem importador real fora dos próprios testes
(em vez de nova bateria de agentes — o estado do sistema já era
conhecido em profundidade da rodada anterior, mesma sessão) confirmou 3
lacunas genuínas e várias já corretamente resolvidas.

**Fechado**: (1) GMIL — já alimentava a UI ao vivo (`useGmilSnapshot()`,
App.tsx:1881, desde a Fase 5) mas nunca tinha fatia em
`unified-snapshot-store`/evento no `organism-orchestrator.ts`; o
relatório anterior tinha descrito isso de forma imprecisa como
"isolado" — correção registrada aqui. Mesmo snapshot já lido, zero
segunda assinatura, agora também em §4 CÉREBRO (`gmil`) +
`BRAIN.GMIL.UPDATED`. `core-engine-boundary.test.ts` (6/6) confirmado
intacto — a fatia nova vive só no lado de exibição, nunca no Core
Engine. (2) MACD (`nexus/macd.ts`, criado na rodada anterior mas
tree-shaken do bundle por falta de importador real) graduado: mesmo
padrão exato de `currentRsi`, nova Row no painel MARKET REGIME —
deliberadamente não um novo plugin de canvas (a diretiva pede menos
poluição visual, não mais camadas). Bundle cresceu +0,98 kB, primeira
mudança real desde a criação do arquivo — prova objetiva de que agora é
alcançável. (3) `stage-runner.ts`: o próprio cabeçalho do arquivo já
documentava um TODO explícito — `NexusDecision` "só fica rastreável
aqui quando ganhar fatia própria" — que a integração do EPC OMEGA FINAL
já tinha destravado sem ninguém voltar para fechar. Novo estágio
`NEXUS_DECISION` em `STAGE_ORDER`, mesma disciplina causal dos 4
existentes.

**Reconfirmado, não retrabalhado** (cada um já tinha justificativa real
documentada): `PriceLabelStackPlugin` sem `drawCanvasLabel` (reabrir
sem ganho real), cache de `LiquidationHeatmapPlugin` (já revertido com
benchmark), `cross-exchange-service.ts` sem publicador (deferimento
deliberado documentado), `candle-tick-synthesizer.js` órfão (estado
seguro correto — gerador `SYNTHETIC_DERIVED` NUNCA deveria ser
"integrado"), colisão de cor cyan (decisão de design pesquisada, não
bug).

**Limitação real que permanece, documentada não contornada**:
`OperationalReadability` (`operational-readability.ts`) é o último elo
do pipeline (`§2` acima) ainda sem fatia própria na store — mesmo motivo
honesto que bloqueava NEXUS_DECISION até esta rodada. `traceStages()`
continua sem consumidor ao vivo na UI (motor correto/testado, ninguém
chama fora dos testes ainda) — recomendado como próximo passo
(`self-diagnostics.ts`), não implementado às pressas nesta rodada.

**Testes executados**: `tsc --noEmit` limpo · **125 arquivos / 2107
testes** (100%, +10 novos) · `core-engine-boundary.test.ts` 6/6
confirmado intacto · `npm run build` ok (870,64 kB / gzip 265,29 kB,
+0,98 kB — único movimento real sendo MACD agora alcançável) ·
Playwright real confirmou zero novo erro de console e o texto "MACD"
presente no DOM renderizado.

---

### 6.69 "DIRETRIZ FINAL — LAPIDAÇÃO VISUAL E ACABAMENTO PROFISSIONAL":
último passo antes da homologação — 2 achados reais corrigidos, 5 seções
reconfirmadas; relatório atualizado em
`docs/historico/RELATORIO_MESTRE_HOMOLOGACAO.md` §9

Diretiva explicitamente restrita a qualidade visual/acabamento — zero
funcionalidade nova. Auditoria das 8 seções pedidas contra o código real
do gráfico e do Radar (sem novo swarm de agentes — conhecimento já
profundo da mesma sessão).

**Corrigido**: (1) `InstitutionalZonePlugin.tsx` prefixava cada rótulo
com "◆ ZONA INSTITUCIONAL · " — redundante com o que a própria faixa
violeta (cor+borda) já comunica; comprimido para "◆ " + nomes das
ferramentas, conteúdo real intacto. (2) `RadarQualificationResult.reason`
já carregava uma justificativa real de por que um candidato qualificou,
mas nunca chegava à UI; `nexus/radar-qualification.ts` ganhou
`RADAR_QUALIFIES_REASON` + `describeRadarQualificationReason()` (zero
segunda fonte de verdade), agora exposta como `title` no botão de cada
candidato — mesmo padrão de tooltip já usado pelos votos do Conselho.

**Reconfirmado, não retrabalhado**: Fio de Seda 100% conforme em todo
`chart/*.tsx` (grep confirmou zero `setLineDash`/`lineWidth`>1 real);
ordem de pintura dos 12 plugins de canvas (`InstitutionalZonePlugin`
ficar atrás de Neural Market Aura/Trade Plan Zone já tem justificativa
real documentada no próprio ponto de montagem — investigado a fundo,
nenhuma colisão real observada que justificasse reabrir); ciclo de vida
real + Relevance Engine já cobrem poluição visual; `conviction-cyclone-
worker.ts` (única animação contínua real) já isolada em Worker, 25fps,
movimento contínuo sem saltos.

**Testes executados**: `tsc --noEmit` limpo · **125 arquivos / 2113
testes** (100%, +6 novos) · `npm run build` ok · Playwright real (bypass
documentado do access-gate, mesmo usado por
`scripts/audit-header-maxcontent.mjs`) confirmou o painel OPORTUNIDADES
renderizando corretamente, zero erro de console novo além da limitação
de rede já conhecida do sandbox.

---

### 6.70 "DIRETRIZ FINAL — CAMADA DE CENÁRIOS INTELIGENTES (SMART
SCENARIO LAYER)": auditoria revela que a maior parte já existia
(`scenario-engine.ts` + projeção nativa no canvas); 2 achados reais
fechados (confiança qualitativa, tipo de reação)

Diretiva pedia uma camada visual de "Cenário A/Cenário B" com linhas de
projeção discretas, pontos de reteste, confiança qualitativa (nunca
porcentagem arbitrária) e explicação visual — auditoria (`grep`/leitura
de `nexus/scenario-engine.ts`, `tests/scenario-projection-chart.test.ts`)
confirmou que isto **já existe**, construído em rodadas anteriores desta
mesma sessão ("Diretriz Suprema §5/§6 — Future Path Map",
"Diretriz Complementar §6 — Smart Projection Engine",
"Diretriz Restauração/Inteligência Visual §3"): `buildScenarioProjection`
já produz Path A (postura real do conselho)/Path B (oposto) com até
`MAX_SCENARIO_TARGETS` níveis reais por lado (EQH/EQL, S/R, Fibonacci com
score real, VP POC/HVN), invalidação = nível real mais próximo do lado
oposto (deliberadamente sem linha própria — seria a "linha fantasma"
redundante que a diretiva proíbe), já desenhado como price lines nativas
lavanda (cor dedicada, nunca a mesma de LONG/SHORT confirmado), Fio de
Seda respeitado (`LineStyle.Solid`, `lineWidth: 1`), opacidade por rank +
peso real do Conselho, sempre abaixo do teto do Trade Plan ativo (LEI
24), recomputado a cada mudança real de insumo (câmara viva já
implementada).

**Achados reais fechados nesta rodada**: (1) §4 — o peso do Conselho
aparecia como porcentagem bruta ("opinion 62%") no painel visível
(CouncilWidget) e no metadado da price line — a própria diretiva pede
"não utilizar porcentagens arbitrárias... usar classificações
qualitativas". `describeScenarioConfidence()` (novo,
`nexus/scenario-engine.ts`) traduz o peso real para MUITO_FORTE/FORTE/
MODERADA/FRACA — mesmos cortes uniformes de 25% já usados por `heatTier`
(`heat-score.ts`), parâmetro documentado, não uma calibração (Regra de
Ouro 2). `formatScenarioPathLabel()` (consumido pelos 2 painéis de texto
já visíveis) e o título da price line no canvas foram atualizados; o
número real (`opinionWeight`) continua 100% intacto no contrato, só a
apresentação mudou. (2) §3 — os alvos reais (pontos de "reteste") não
tinham nenhuma classificação de tipo de reação. `describeScenarioReaction
()` (novo) deriva um rótulo honesto — varredura de liquidez (EQH/EQL),
pullback/rejeição (S/R), retração (Fibonacci), ímã de volume (Volume
Profile) — só do `sourceKind` que o nível já carrega, zero motor novo,
fallback genérico honesto para família desconhecida. Adicionado ao
metadado `title` de cada price line de projeção.

**Deliberadamente não implementado, com motivo real**: trajetória
curva/pontilhada (§5, fraseado como exemplo condicional — "caso o
sistema represente uma trajetória") — uma curva suave interpolada
implicaria visualmente um caminho previsto de preço, mais forte do que
"aqui está um nível real", e uma linha pontilhada violaria Fio de Seda
(Regra de Ouro 5, zero exceção); a implementação real (linhas retas
horizontais nos níveis reais, já existente) é mais honesta e já foi essa
mesma decisão de uma rodada anterior. Glifo/marcador dedicado para
"pontos de reteste" (§3) além da price line já existente no mesmo preço
— seria geometria duplicada no mesmo pixel (poluição visual, contra o
próprio §7 da diretiva) e arriscaria reabrir a colisão de rótulos no
eixo de preço já corrigida em múltiplas rodadas anteriores; a
classificação real (texto) foi adicionada ao metadado já existente em
vez disso.

**Testes executados**: `tsc --noEmit` limpo · **125 arquivos / 2123
testes** (100%, +10 novos) · `npm run build` ok (871,21 kB, +0,42 kB) ·
Playwright real confirmou o app e o painel Market Intelligence
renderizando sem regressão (bloco SCENARIO A/B ausente honestamente —
sandbox sem rede real para popular `scenario` — mesma limitação já
documentada em rodadas anteriores).

---

### 6.71 "DIRETRIZ FINAL — POLIMENTO VISUAL E SINCRONIZAÇÃO GLOBAL": bug
real de colisão confirmado por captura de tela (Zona Institucional ×
Sweep/Sessão) corrigido; botão de energia vira "Sincronizar Agora" com
status real

O Operador anexou uma captura de tela real (BTC/USDT 1H) mostrando
colisão severa de rótulos do lado esquerdo do gráfico — o texto "ZONA
INSTITUCIONAL · ..." sobrepondo/colidindo visivelmente com "LONDRES
H/L" e "SWEEP ZONE". Auditoria confirmou a causa raiz: `SWEEP`/`SWEEP
ZONE`/Session Key Levels/S1/R1/TREND já entravam no sistema anti-colisão
real (`priceAxisLabels`/`PriceLabelStackPlugin`/`price-label-stack.ts`,
construído em rodadas anteriores exatamente para isto), mas o rótulo de
texto da Zona Institucional (`InstitutionalZonePlugin.tsx`) desenhava
num canvas PRÓPRIO, com posição vertical PRÓPRIA, sem nenhuma
consciência do que a pilha já tinha resolvido — os dois sistemas
desenhavam no mesmo espaço de tela sem se falar.

**Corrigido**: o TEXTO da Zona Institucional migrou para
`priceAxisLabels` (`price = centro real da zona`, `side: "left"`) — a
MESMA pilha anti-colisão que já resolve Sweep/Session/S1/R1/TREND, com o
MESMO conector fino de volta ao preço quando precisa deslocar.
`InstitutionalZonePlugin.tsx` continua dono exclusivo da FAIXA
(fill+borda, geometria real, zero mudança); `LABEL_COLOR` exportado para
ser a única fonte real dessa cor (zero duplicação de literal em 2
arquivos). Este é o achado mais concreto e evidenciado de toda a
diretiva — resolve diretamente §1 (nunca uma etiqueta cobre outra), §2
(mesma caixa/tipografia consistente do resto do eixo) e §5
(reorganização automática, zero intervenção do Operador) para esta
camada específica.

**Botão de energia (§4, "sincronizador global")**: auditoria confirmou
que `handleManualRestart` (App.tsx) já ERA um sincronizador global real
desde antes desta rodada — bumpar `bootGeneration` já reconecta REST+WS+
ciclo do motor+feeds (comentário real já existente no próprio código).
Faltava só o que a diretiva pedia de fato: título honesto ("Sincronizar
Agora", trocado do inglês "Force reconnection of all real feeds") + um
status real e discreto — reaproveita `price.updatedAt` (já real, `Date.
now()` em `setPrice`) via `usePriceSnapshot()` + `ageLabelOf()` (helper
já existente, usado por preço/livro/ciclo/HTF/GMIL) — zero conceito novo
inventado, zero segundo formatador de idade.

**Reconfirmado sem retrabalho**: §3 (Rabiscos Inteligentes — Fio de Seda
1px sólido já 100% respeitado, ciclo de vida/decaimento já real em todo
plugin que precisava, "curvas suaves" deliberadamente não implementadas
pela mesma razão já documentada na Entrega anterior — implicaria uma
trajetória de preço prevista, mais forte que "aqui está um nível real");
etiquetas FVG/OB/BOS/CHOCH já usam a primitiva compartilhada
`canvas-label.ts` desde o "Adendo Final: etiquetas institucionais
unificadas" (rodada anterior).

**Testes executados**: `tsc --noEmit` limpo · **126 arquivos / 2130
testes** (100%, +7 novos: 3 travam a migração do rótulo de Zona
Institucional, 4 travam a fiação do botão de sincronização) · `npm run
build` ok (871,37 kB, +0,16 kB) · Playwright real confirmou o app
carregando sem regressão e o novo título do botão renderizando com
status real (`"Sincronizar Agora — ... Última leitura real: há 3s."` —
valor real observado no sandbox, não fabricado).

---

### 6.72 "ORDEM OFICIAL DE EXECUÇÃO Nº 01 — DIRETRIZ MESTRE DE
CONSOLIDAÇÃO, EVOLUÇÃO E AUTONOMIA TÉCNICA": `traceStages()` ganha
consumidor real; 2 recomendações da própria sessão corrigidas após
investigação mais profunda; relatório completo em
`docs/historico/RELATORIO_ORDEM_01_CONSOLIDACAO.md`

Ordem de escopo total ("todo o ecossistema... nada deve permanecer
isolado"), mas o próprio texto da Ordem encerra dizendo que a
Arquitetura Mestre (Knowledge Graph, Evidence Fusion Engine, Quality
Governor, Lifecycle Manager, gráfico com desenho centralizado por uma
única camada de inteligência) **será iniciada DEPOIS desta Ordem** —
uma diretriz futura e mais detalhada. Interpretação aplicada (detalhe
completo no relatório, §0): esta rodada é auditoria/consolidação real
sobre o que já existe, não a construção antecipada do que a próxima
Ordem vai detalhar — tentar isso agora, sem a especificação, arriscaria
quebrar os 12 plugins de canvas testados e estáveis (o oposto de
"preservar tudo o que já foi validado", objetivo explícito da própria
Ordem).

**Implementado**: `traceStages()` (stage-runner.ts, OMEGA CORE V-MAX
Fase 3 — pipeline causal real DATA→CORE_ENGINE→COUNCIL→TRADE_PLAN→
NEXUS_DECISION) ganhou seu primeiro consumidor ao vivo — um novo achado
"Pipeline causal" em `self-diagnostics.ts` (Relatório de
Autodiagnóstico), lido via a mesma visão versionada/read-only que os
motores reais já usam (`getSnapshotForEngine()`). Severidade nunca
escala além de WARN por design (a causa raiz de qualquer estágio
quebrado já é CRITICAL em outro achado — repetir seria alarme
duplicado). Evidência real: bundle foi de 1844 para 1845 módulos
transformados (stage-runner.ts deixou de ser tree-shaken).

**Corrigido (não executado mecanicamente)**: duas recomendações
registradas em rodadas anteriores — dar a `operational-readability.ts`
e a `engine-signal-contract.ts` uma fatia própria em
`unified-snapshot-store.ts` — foram reexaminadas e a conclusão mudou:
as duas são funções PURAS de um único insumo já central
(`nexusDecision`/`council`, respectivamente), ao contrário de
`nexusDecision`/`gmil`/etc. (que fundem múltiplos insumos dispersos —
por isso JUSTIFICAM uma fatia própria). Dar-lhes uma fatia seria mirror
sintético e redundante, não uma integração real. Aplicar o mesmo padrão
mecanicamente, só porque funcionou antes, seria exatamente a
complexidade desnecessária que esta Ordem pede para evitar.

**Reconfirmado, não removido**: varredura de módulos órfãos em
`nexus/*.ts` confirmou `cross-exchange-service.ts`/
`connection-manager.ts` ainda sem publicador — já documentado como
adiamento deliberado (maior risco do projeto) em `event-bus.ts`,
nenhuma mudança. `engine-signal-contract.ts` continua sem consumidor —
não é esquecimento, é o contrato de 10 campos (peso/confiança/
relevância/qualidade/contexto/horizonte/validade/justificativa/
prioridade) já pronto e testado, esperando exatamente o motor de fusão
que a PRÓXIMA Ordem vai especificar.

**Testes executados**: `tsc --noEmit` limpo · **126 arquivos / 2136
testes** (100%, +6 novos: 5 em `self-diagnostics.test.ts`, 1 em
`ciborgue-vivo-wiring.test.ts`) · `core-engine-boundary.test.ts` 6/6
confirmado intacto · `npm run build` ok (873,37 kB, 1845 módulos, +1) ·
Playwright real confirmou clique real em "GERAR RELATÓRIO DE
AUTODIAGNÓSTICO" produzindo o achado "Pipeline causal" ao vivo na UI.

---

### 6.73 "DIRETRIZ Nº 02 — CAMADA DE INTELIGÊNCIA VISUAL": dois conflitos
com regras inegociáveis resolvidos + `nexus/visual-budget.ts` (isolado,
testado); relatório completo em
`docs/historico/RELATORIO_DIRETRIZ_02_INTELIGENCIA_VISUAL.md`

Diretriz descreve o pipeline final desejado (`... → Knowledge Graph →
Evidence Fusion Engine → Quality Governor → Meta Engine → Core Engine →
Visual Intelligence Layer → Gráfico`) e o princípio "nenhum módulo
poderá desenhar diretamente no gráfico" — mas, ao contrário da Ordem
Nº 01, não escreve sua própria cláusula de escopo. Interpretação
aplicada (detalhe completo no relatório, §0): a inversão completa dos 12
plugins de canvas é alto blast-radius/baixa reversibilidade sem uma
"Camada de Inteligência Visual" central ainda existente para migrar os
plugins PARA — mesma disciplina de "isolar antes de integrar" de todo
motor novo deste projeto, não construída de uma vez.

**Dois conflitos diretos com regras inegociáveis, resolvidos por
substituição honesta (mesmo padrão do Corredor de Confluência e da
Camada de Cenários)**:
1. "Probability Score" (ex.: "87% de probabilidade de reteste") vs.
   Regra de Ouro 2 — nenhuma probabilidade calibrada nova introduzida;
   `visual-budget.ts` trabalha só com peso de confluência real (0..1).
2. Ordenação "Meta Engine → Core Engine" do diagrama vs. LEI 24 —
   reafirmado que ordem de camada VISUAL não é ordem de autoridade de
   DECISÃO, citando o precedente já real de `decision-layer.ts`
   (`operation` é passthrough literal da direção do Core Engine).

**Implementado**: `nexus/visual-budget.ts` — motor puro implementando a
seção "BUDGET VISUAL" da própria Diretriz: os 7 níveis de prioridade
declarados (`TRADE_PLAN > INSTITUTIONAL_ZONE > TARGET > INVALIDATION >
RADAR > MAIN_LIQUIDITY > STRUCTURE`) e `resolveVisualBudget(candidates,
budget?)`, que resolve competição cruzada por destaque entre objetos já
relevantes (aditivo sobre `layer-relevance.ts`, que decide relevância/
ênfase por camada isoladamente). "Esconder automaticamente" da Diretriz
é reinterpretado honestamente como REDUZIR ÊNFASE (Regra de Ouro 4):
todo objeto sempre recebe `visualWeight >= VISUAL_BUDGET_FLOOR_WEIGHT`
(0.35), nunca zero.

**Isolamento real, não só declarado**: `npm run build` produziu os
mesmos 1845 módulos/873,37 kB de antes desta rodada — prova objetiva de
que o motor não tem nenhum consumidor vivo ainda (mesma técnica de
verificação usada na rodada anterior para provar o oposto, quando
`stage-runner.ts` ganhou seu primeiro consumidor real: 1844 → 1845).

**Testes executados**: `tsc --noEmit` limpo · **127 arquivos / 2149
testes** (100%, +13 novos em `tests/visual-budget.test.ts`) · `npm run
build` ok, módulos/bundle idênticos à rodada anterior (isolamento
confirmado) · Playwright não executado (nenhuma superfície visual nova
para verificar).

---

### 6.74 "ORDEM OFICIAL DE EXECUÇÃO Nº 03 — FASE DE IMPLEMENTAÇÃO
OPERACIONAL E INTEGRAÇÃO TOTAL": primeira graduação real de
`nexus/visual-budget.ts` (competição INSTITUTIONAL_ZONE × TRADE_PLAN no
gráfico ao vivo) + auditoria de isolamento completa do ecossistema;
relatório completo em
`docs/historico/RELATORIO_ORDEM_03_IMPLEMENTACAO_OPERACIONAL.md`

Ordem muda o critério de "pronto": um motor com testes aprovados mas
zero consumidor real fica classificado "EM IMPLEMENTAÇÃO" até cumprir o
ciclo completo (Implementação → Integração → Testes → Validação →
Operação em tempo real → Consumo por módulos reais → Disponibilização ao
Operador). Auditoria de importadores reais (`nexus/*.ts`,
`research/engines/*.js`, `research/backtest/*.js`, 12 plugins de canvas)
confirmou o ecossistema já muito mais integrado do que o tom de abertura
da Ordem presume — só 3 módulos reais sem consumidor (`visual-budget.ts`,
`engine-signal-contract.ts`, `cross-exchange-service.ts`), e o "laboratório
de backtest" (`structural-backtest.js`/`history-capture.js`/
`compare-runs.js`) tem isolamento TESTADO como fronteira deliberada
(`structural-backtest.test.ts`: "nenhum módulo de produção importa do
laboratório de backtest — só testes"), não uma peça esquecida.

**Implementado**: `resolveVisualBudget()` (Diretriz Nº 02, construído
isolado/testado na rodada anterior, zero consumidor vivo até esta
rodada) agora resolve competição real de destaque entre Zonas
Institucionais e Trade Plan — as 2 categorias que já carregavam peso 0..1
real e independente (`confluenceWeight`/`opacityMultiplierFor`, ambas
exportadas e reusadas, zero segunda fórmula). `InstitutionalZonePlugin.
tsx`/`TradePlanZonePlugin.tsx` ganharam novas props (`visualWeights`/
`visualWeight`) com fallback automático para o comportamento pré-Ordem-03
quando ausentes. Regra de Ouro 4 preservada: piso `VISUAL_BUDGET_
FLOOR_WEIGHT` (0.35), nenhuma zona/plano é escondido, só menos
enfatizado. Evidência objetiva: `npm run build` foi de 1845→1846 módulos
(+874,86 kB, +1,49 kB) — mesma técnica de prova usada na Ordem Nº 01.

**Investigado e deliberadamente adiado (não esquecido)**: Market
Structure como fonte de `institutional-zones.ts` — rastreado até a causa
raiz exata (`ipad_runtime/js/real-data/analysis-frame.js:123` já calcula
`last_swing_high`/`last_swing_low` via `market-structure-engine.js`, mas
descarta os 2 preços antes de retornar o frame, só `structure_label`
sobrevive). Correção seria pequena (2 campos num objeto literal), mas o
único ponto de correção é dentro do cálculo canônico do Core Engine — "o
caminho mais crítico do app" (Regra de Ouro 6) — e por isso fica para sua
própria iniciativa isolada, com o diagnóstico completo (incluindo os 4
passos exatos de implementação) já registrado no relatório §3, para
nenhuma rodada futura precisar reinvestigar.

**Reafirmado com leitura fresca (não repetição mecânica)**:
`cross-exchange-service.ts` (cutover do WS/REST ao vivo é "o passo de
maior risco", escopo próprio desde sua criação) e
`engine-signal-contract.ts` (só 1 dos 10 campos tem montador real hoje;
um consumidor forçado agora duplicaria a leitura do Conselho ou exigiria
construir o Evidence Fusion Engine inteiro) continuam isolados por
motivo técnico específico, não negligência.

**Testes executados**: `tsc --noEmit` limpo · **128 arquivos / 2165
testes** (100%, +16 novos: 15 em `tests/visual-budget-chart-wiring.test.ts`,
1 em `trade-plan-zone-plugin.test.ts`) · `npm run build` ok (1846
módulos, 874,86 kB) · Playwright executado contra o dev server real —
app carrega sem regressão estrutural, mas a rede de saída do ambiente
bloqueia os WebSockets reais da Binance (`ERR_TUNNEL_CONNECTION_FAILED`
no proxy do container), então o gráfico fica honestamente em "AWAITING
CANDLES…" (fail-closed correto) em vez de mostrar zonas/plano com dado ao
vivo — limitação do ambiente de verificação, documentada explicitamente
em vez de omitida, com a suíte de padrão de fonte cobrindo cada literal
da fiação real.

---

### 6.75 "HOMOLOGAÇÃO DA ORDEM Nº 03 E PRÓXIMA EVOLUÇÃO — ORGANISMO
INTELIGENTE ADAPTATIVO": Market Regime real como "contexto operacional"
em `layer-relevance.ts` + reorganização (não exclusão) da administração
de modos no painel "Camadas do Gráfico"; relatório completo em
`docs/historico/RELATORIO_HOMOLOGACAO_03_ORGANISMO_ADAPTATIVO.md`

Diretriz descreve 6 dimensões adaptativas (prioridade visual/intensidade/
quantidade de informação/frequência de atualização/relevância dos
motores/contexto operacional) e pede substituir "Modo Automático/
Operador/Inteligente/Configurações manuais redundantes" por um único
"Estado Inteligente Adaptativo". Investigação confirma que os 4 "modos"
mapeiam byte a byte para código real (`ChartLayersPanel`, `App.tsx:3741`
— 4 presets + toggle individual por camada) e que 4 das 6 dimensões já
eram reais (visual-budget.ts/layer-relevance.ts) — só precisavam ser
reconhecidas como tal.

**Tensão real, nomeada sem rodeio**: a diretriz pede exclusão literal
dos modos; Regra de Ouro 4 proíbe apagar funcionalidade real, oferecendo
"realocar/reorganizar" como alternativa. Resolução: **reorganizar,
nunca apagar**. "Automático" (renomeado na UI para "AR10 CYBORG · Estado
Inteligente Adaptativo") vira a única ação primária sempre visível; os
3 presets manuais continuam existindo por inteiro, só recolhidos numa
seção "avançado" (`useState(false)`, local, nunca persistida); o toggle
fino por camada fica FORA da seção recolhida (categoricamente diferente
de "administrar um modo"). Verificado com Playwright real (2 capturas:
painel recolhido e expandido, ambos funcionando).

**Implementado — contexto operacional real**: `marketRegime` (rótulo
já calculado a cada ciclo por `regime-engine.js`, zero segundo cálculo)
entra em `LayerRelevanceInput` e passa a confirmar relevância de
`trend_channel` por uma segunda via INDEPENDENTE da banda estreita —
`TENDENCIA_FORTE`/`BREAKOUT` (momentum confirmado por ADX/DI) mesmo com
banda ainda larga ou desconhecida. Bug real evitado durante a
implementação: a antiga non-null assertion (`bandwidthPct!`) teria
acendido highlight por coerção `null <= N → true` do JavaScript quando só
o regime confirmasse relevância — corrigido com checagem explícita,
travado por teste de regressão dedicado.

**Testes executados**: `tsc --noEmit` limpo · **128 arquivos / 2179
testes** (100%, +14 novos: 9 em `layer-relevance.test.ts`, 1 em
`nucleo-gravitacional-fusion.test.ts`, 4 em
`chart-layers-panel-wiring.test.ts`) · `npm run build` ok (1846 módulos,
876,24 kB) · Playwright real confirmou os 2 estados do painel
reorganizado.

---

### 6.76 Evolução Visual (pedido informal): STRUCTURE como 3ª categoria
real de `visual-budget.ts` + poda mecânica de 8 declarações mortas;
relatório completo em `docs/historico/RELATORIO_EVOLUCAO_VISUAL_STRUCTURE_PODA.md`

Pedido do Operador em português informal/ditado ("foca na parte visual
pra ficar mais automático, menos etiqueta... o que você acha que tem de
melhorar... execute o necessário... liberdade pra achar a melhor
estratégia") — reconstrução comunicada ao Operador antes de agir (sem
pergunta bloqueante: a mensagem já autoriza execução explicitamente).

**Implementado — STRUCTURE**: `StructureBreakMarkersPlugin.tsx` ganha
`visualWeight?: number | null` com fallback fail-closed para
`ageAlpha(age, BREAK_DECAY)` isolado. `EnhancedChart_110_Percent.tsx`
monta o candidato real (`structureBreakBaseWeight`, mesma fórmula
EXATA já usada pelo rótulo BOS/CHOCH em `priceAxisLabels`) e alimenta
`resolveVisualBudget` junto de `INSTITUTIONAL_ZONE`/`TRADE_PLAN` — 3 das
7 categorias reais da Diretriz Nº 02 agora graduadas.

**Avaliação honesta entregue** (resposta direta ao pedido de opinião):
maior alavanca real do lado de sistema é o Evidence Fusion Engine
(`engine-signal-contract.ts`, 4 rodadas sem consumidor real além de 1
campo) — recomendado, não construído (é iniciativa de arquitetura
própria, não poda/graduação incremental).

**Poda real**: `noUnusedLocals`/`noUnusedParameters` habilitados como
diagnóstico no `tsconfig.json`, 8 declarações genuinamente mortas
encontradas e investigadas individualmente (nenhuma removida às
cegas). Dois achados revelaram história real: `NEXUS_PLAN_GAP_LABEL`
importado em `App.tsx` mas relocado para `operational-readability.ts`
numa rodada anterior (import vestigial); `POOL_DIRECTION_TO_STANCE` em
`council.ts` era o mapeamento direto ALTA/BAIXA/NEUTRO→LONG/SHORT/
NEUTRAL substituído por `councilStanceWithHysteresis` (histerese de 2
bandas) numa evolução anterior, nunca removido. Os outros 6 (import/
variável/parâmetro/helper de teste não lidos) corrigidos com a mesma
disciplina. Flags mantidas permanentemente no `tsconfig.json` — melhoria
estrutural de precisão do processo, não só limpeza pontual.

**Testes executados**: `tsc --noEmit` limpo (com as novas flags
permanentes) · **128 arquivos / 2185 testes** (100%, +6 novos em
`tests/visual-budget-chart-wiring.test.ts`) · `npm run build` ok (1846
módulos, 876,67 kB) · Playwright real confirmou zero regressão
estrutural (zero erro de React).

---

### 6.77 "ORDEM Nº 04 — CONSOLIDAÇÃO DO ORGANISMO INTELIGENTE
ADAPTATIVO": auditoria real dos 7 componentes nomeados + 2 entregas
proporcionais; relatório completo em
`docs/historico/RELATORIO_ORDEM_04_CONSOLIDACAO.md`

Ordem formal pedindo integração/coordenação (não novos módulos
isolados) sobre 7 camadas nomeadas: `layer-relevance`, `visual-budget`,
`scenario-engine`, `institutional-zones`, `trade-plan`, `radar`, `engine
signals`. Auditoria obrigatória (§7) antes de qualquer mudança.

**Auditoria real (grep/leitura direta, antes de qualquer edição)**: 6
das 7 camadas já tinham consumidores reais confirmados — reportado
honestamente em vez de fabricar integração onde já existia. Único
componente genuinamente isolado: `engine-signal-contract.ts` (EPC OMEGA
FINAL Parte 1) — zero import fora do próprio arquivo em todo `src/`,
apesar de ter contrato testado (8 testes) e função real
(`deriveEngineSignalsFromCouncil`) há 4 rodadas. Achado secundário: a
categoria `RADAR` de `visual-budget.ts` não tem candidato real no canvas
(Radar renderiza só em painéis próprios, nunca no `chart/`) — graduá-la
exigiria inventar um objeto visual, decisão deliberada de não fazer.

**Entrega 1 — `engine-signal-contract.ts` consolidado no
`CouncilWidget`**: `deriveEngineSignalsFromCouncil(council)` roda em
paralelo à leitura ad hoc já existente de `council.votes` (zero
regressão nos campos antigos), expõe o campo real `weight` (já refletia
corretamente `aggregateCouncil`/`council.ts:429-431`, nunca antes
exibido por voto) como um marcador visual novo `· fora do pool` em
qualquer voto RISK/ABSTAIN. Confirmado com captura Playwright AO VIVO
contra o dev server real (não depende de candles, diferente das
graduações de `visual-budget.ts`) — os 6 votos ABSTAIN reais mostraram o
marcador, o único voto direcional real (ORDER FLOW, NEUTRAL 0%) não
mostrou, exatamente como desenhado. 6 testes novos em
`tests/engine-signal-consolidation-wiring.test.ts`.

**Entrega 2 — `MAIN_LIQUIDITY` como 4ª categoria real de
`visual-budget.ts`**: `LiquidityZonesPlugin.tsx` (FVG/Order Blocks) já
calculava `ageAlpha(age, ZONE_DECAY)` por zona — exportado (mesmo padrão
de `BREAK_DECAY`), `EnhancedChart_110_Percent.tsx` monta candidatos
reais só para zonas não-obstáculo. Regra nova (não presente nas 3
graduações anteriores): zona que é obstáculo real do Trade Plan ativo
fica FORA da competição de propósito — mantém `alpha=1` incondicional
(garantia pré-existente da Diretriz Restauração/Inteligência Visual §6),
nunca reduzida pelo orçamento visual. 9 testes novos em
`tests/visual-budget-chart-wiring.test.ts`; 4 asserções literais
pré-existentes (`ciborgue-vivo-wiring.test.ts`,
`liquidity-zones-plugin.test.ts`) atualizadas para o código real atual
(mesma manutenção já vista em rodadas anteriores após mudança de
assinatura).

**O que não foi tocado, e por quê**: `TARGET`/`INVALIDATION` (sem fonte
de peso individual já isolada, diferente de TRADE_PLAN que trata o plano
como zona única); `RADAR` (sem candidato real no canvas); os 5 campos
ainda não instrumentados do contrato de sinais (`relevance`/`priority`/
`quality`/`temporalHorizon`/`lifespanCandles` — trabalho de motor novo,
fora do escopo de consolidação); Market Structure em
`analysis-frame.js`/frequência adaptativa (Regra de Ouro 6, pendências
já registradas). Zero componente removido.

**Testes executados**: `tsc --noEmit` limpo · **129 arquivos / 2201
testes** (100%, +6 engine signals +9 MAIN_LIQUIDITY sobre os 2185
anteriores, líquido de ajustes) · `npm run build` ok (1847 módulos,
878,48 kB) · Playwright real confirmou zero erro de React E capturou
visualmente ao vivo o comportamento correto do marcador "fora do pool"
(evidência mais forte que o padrão usual desta sandbox, por não
depender de candles).

---

### 6.78 Evolução Total Autônoma (pedido informal, "autonomia total...
não deixa nada pendente... sem pedir permissão"): pendência mais antiga
executada + "um objeto, um peso" + rastreamento reconciliado; relatório
completo em `docs/historico/RELATORIO_EVOLUCAO_TOTAL_AUTONOMA.md`

**Market Structure em `analysis-frame.js` — EXECUTADO** (o fix
documentado na Ordem Nº 03 §3, adiado 3 rodadas por Regra de Ouro 6,
agora autorizado): `last_swing_high`/`last_swing_low` (já computados por
`analyzeMarketStructure` a cada ciclo, antes descartados) saem no frame
→ passthrough puro em `engine-bridge.ts` (`lastSwingHigh`/`lastSwingLow`)
→ props do chart → 11ª fonte real de `institutional-zones.ts`
(`MARKET_STRUCTURE_SWING`, "Swing H"/"Swing L"). Puramente aditivo —
`core-decision-rules.test.ts` (caracterização congelada do Core Engine)
passou INTACTA; 2 testes aditivos de execução real (zigzag → frame ↔
motor consistentes; candles chapados → DADOS_INSUFICIENTES honesto) + 8
de wiring (`market-structure-swing-wiring.test.ts`) + 3 de execução real
da 11ª fonte (swing sozinho nunca vira zona; high+low = mesma
ferramenta, distinctSourceCount não dobra).

**"Um objeto, um peso"** (achado de auditoria visual): etiquetas do eixo
anti-colisão agora seguem o MESMO peso resolvido pelo orçamento visual
que os objetos que nomeiam — BOS/CHOCH usa `structureBreakVisualWeight`
(fallback `ageAlpha` isolado), Zona Institucional segue a redução da
faixa (razão `resolved/base`, 1 sem competição, nunca zero). Achado
extra corrigido: o bloco da etiqueta BOS/CHOCH era o ÚNICO do eixo sem
gate de `visibility` — camada desligada sumia com a linha mas a etiqueta
ficava; agora `visibility.structure_breaks` gate o bloco.

**Peso no sistema — auditoria honesta**: `llm-worker`/`llm-bridge`
(12MB do build) reverificados — já 100% lazy (`await import()` nos
handlers), zero peso no boot; nada removido porque nada pesava de
verdade ali. Rastreamento obsoleto reconciliado: task #114 (pergunta
antiga do Radar) DECIDIDA sob autonomia total — manter direção de
candidatos via regime (display-only, LEI 24 governa só o símbolo ativo;
pipeline completo por símbolo escaneado violaria Regra de Ouro 6); task
#82 (umbrella V-MAX in_progress obsoleta) reconciliada com o histórico
real de entregas, resto virou backlog honesto explícito.

**Testes executados**: `tsc --noEmit` limpo · **130 arquivos / 2218
testes** (100%, +17 novos) · `npm run build` ok (1847 módulos, 879,39
kB) · Playwright real no baseline pré-mudança (zero erro de React, zero
regressão estrutural).

---

### 6.79 Lapidação por feedback direto: faixa de sessões afinada + zoom
inteligente na troca de timeframe

Feedback verbal do Operador: a "faixinha dos mercados" (Nova Iorque/
Londres/Ásia) "da forma que está não está bom, está atrapalhando o
visual"; e ao trocar de timeframe o gráfico deveria ter "um zoom
inteligente que fica bom na tela pra gente não estar puxando o zoom".

**Faixa de sessões** (`MarketSessionBandsPlugin.tsx`): afinada de
24px/2 linhas para **14px/1 linha**. A 2ª linha (janela UTC) era
duplicação literal do header (`marketSessionFromUtc` — mesmo dado, mesma
função) — removida como redundância, nunca dado real (Regra de Ouro 4:
a janela continua no header). A relevância adaptativa já real
(`recentSessionBoundary` em layer-relevance.ts) continua decidindo
quando a faixa sequer aparece no estado automático.

**Zoom inteligente** (`EnhancedChart_110_Percent.tsx`): primeira fatia
real do "Adaptive Zoom" do backlog V-MAX — flag `smartZoomPendingRef`
armada SÓ por troca de `[activeTimeframe, symbol]` (e no mount),
consumida no efeito real de `setData`: enquadra as últimas
`SMART_ZOOM_CANDLES` (120) velas + `SMART_ZOOM_RIGHT_PAD_BARS` (6) de
folga à direita, SOMENTE depois que os candles do novo contexto
chegaram — nunca sobre dado velho, nunca em tick (o pan/zoom manual do
Operador continua soberano fora da troca). Convive com a preservação de
faixa do prepend (paginação histórica): o enquadre pendente tem
precedência só na troca de contexto.

**Testes executados**: `tsc --noEmit` limpo · **130 arquivos / 2218
testes** (100% — 2 novos de zoom inteligente, 5 asserções da faixa
atualizadas para a forma real, 1 regex re-ancorado no efeito certo de
setData preservando a trava original) · `npm run build` ok (1847
módulos, 879,38 kB).

---

### 6.80 Lapidação por captura real (BTC 1H): kill zones só a ocorrência
mais recente + teto de etiquetas Sweep + dedupe de membros da Zona
(achado de auditoria: esta entrega existia commitada — 522874c — mas
nunca tinha ganho sua própria entrada aqui; corrigido agora, junto da
Carta Branca §6.81, para o handbook continuar a memória evolutiva real)

Captura de tela real do Operador (BTC/USDT 1H): "linhas amarelas"
verticais repetidas cruzando o gráfico inteiro — sem explicação visível
do que eram.

**Causa raiz real**: `KillZoneBandsPlugin.tsx` desenhava TODA ocorrência
histórica de cada Kill Zone ICT (Londres/NY/Ásia) ainda dentro da janela
de candles carregada — em 1H, isso significa várias faixas repetidas da
MESMA sessão em dias diferentes, todas simultâneas na tela.

**Corrigido**: `latestSpanPerZone` (Map, chave = `span.id`, mantém só o
`endIndex` mais alto por zona) — o laço de desenho passa a iterar
`latestSpanPerZone.values()` em vez de `spans` inteiro. Dado real
intacto (Regra de Ouro 4): só a mais recente de cada zona ganha desenho,
nunca a lista subjacente é podada.

**2 achados adicionais da mesma captura, mesma disciplina**:
1. **Teto real de etiquetas Sweep** (`MAX_SWEEP_AXIS_LABELS = 4`):
   `sweepLabelCandidates` ordenado por `latestIndex` desc e cortado em 4
   — as price lines nativas continuam desenhadas para TODOS os clusters
   reais (dado intacto), só a etiqueta de texto no eixo fica seletiva
   (mesmo princípio depois reusado pela Carta Branca em S1/R1, §6.81).
2. **Dedupe de membros repetidos na etiqueta de Zona Institucional**:
   `labelCounts` (Map) agrega membros com o mesmo `label` em "Sweep ×2"
   em vez de repetir o nome cru — informação idêntica, texto mais curto.

**Correção incidental**: 3 ocorrências de `side: "left" as const,`
viraram `side: "left",` — o `as const` desnecessário (o tipo do array já
inferia o literal corretamente) quebrava 3 testes de padrão de código
que esperavam o texto exato sem o qualificador.

**Testes executados**: `tsc --noEmit` limpo · 3 novos em
`tests/refinamento-final-wiring.test.ts` · `npm run build` ok. Commit:
522874c.

---

### 6.81 "Carta Branca" — otimização do motor matemático, reconhecimento
de padrões (Triângulo + Ombro-Cabeça-Ombro), Evidence Fusion Engine
finalizado, precisão das etiquetas laterais; relatório completo em
`docs/historico/RELATORIO_CARTA_BRANCA_CIBORGUE_ELITE.md`

Mega-diretriz em português informal/ditado pedindo, em bloco único:
organizar a arquitetura do motor matemático e eliminar redundância real;
etiquetas laterais "mais perfeitas... só mostrar a precisão maciça";
melhorar visualização de retest-zone/zigzag e adicionar explicitamente
reconhecimento de Triângulo e Ombro-Cabeça-Ombro; liberdade total sobre
estratégia/calibração/pesquisa externa; decidir o que adicionar/remover;
o efeito visual mais bonito, com liberdade de remodelar ícones/layout;
"habilitar todas as ferramentas para funcionarem 100% automatizadas";
fazer o sistema parecer um ser vivo/operador de elite, "não ter erro com
ele".

**Evento de segurança tratado antes de qualquer execução** (detalhe
completo no relatório §0): um bloco `[DIRETIVA SUPREMA...]` endereçando
uma persona fictícia ("Agente 4") nunca usada nesta sessão, com
linguagem de protocolo/comando em terceira pessoa, apareceu colado ao
final da mensagem — correspondência literal ao item 7 da Disciplina de
Trabalho deste CLAUDE.md (persona fictícia + linguagem de protocolo
pedindo para pular autorização). Pausado via `AskUserQuestion` antes de
agir, com o default seguro ("ignorar o bloco") como primeira opção. O
Operador confirmou autoria explicitamente ("É totalmente meu, pode usar
como instrução") — o conteúdo substantivo entrou no escopo autorizado
desta rodada; a persona "Agente 4" nunca foi adotada.

**Pesquisa real executada antes de implementar** (WebSearch, fontes
citadas no relatório): definição de Triângulo Ascendente/Descendente/
Simétrico (FXOpen, ChartMill, Strike.money, Titan FX, Scanz — regra real
de mínimo 2 toques por linha, convergente entre todas as fontes) e de
Ombro-Cabeça-Ombro regular/inverso (LightningChart, Dukascopy, LuxAlgo,
OANDA — neckline real, ombros aproximadamente simétricos medidos sobre a
própria neckline).

**2 motores novos, isolados e testados antes de qualquer graduação**
(Laboratório de Evolução): `nexus/triangle-pattern.ts`
(`detectTrianglePattern`, mínimos quadrados reais + R² real sobre os
MESMOS swings fractais de `fractal-swings.js`; SIMÉTRICO nunca ganha uma
direção fabricada — Regra de Ouro 3, a literatura confirma que o lado do
rompimento não é geométrico) e `nexus/head-shoulders-pattern.ts`
(`detectHeadAndShoulders`, reusa `buildAlternatingPivots` de
`harmonic-patterns.ts` sem segunda implementação de zigzag; neckline
real extrapolada por regressão de 2 pontos, ombros medidos ACIMA da
neckline, nunca do preço bruto). 16 testes de execução real somados.

**Graduação ao gráfico real** (reusa o pipeline já existente do melhor
padrão harmônico, nunca uma segunda arquitetura de desenho): o vencedor
único entre as 3 famílias (harmônico/Triângulo/H&S) é escolhido por
`fitScore` desc e desenhado — harmônico como já era (polilinha XABCD/
Wolfe + PRZ/EPA); Triângulo como 2 retas reais dedicadas (mínimos
quadrados avaliados do 1º toque até o último candle) + preço real do
ápice (interseção das 2 retas) quando à frente do candle atual; H&S como
outline reusando a MESMA função de zigzag do harmônico + reta dedicada da
neckline extrapolada. Painel lateral consolidado em um único "Chart
Patterns · geometric fit, never probability" (nunca 3 painéis
separados — "não é excesso demais", feedback já dado pelo Operador em
rodada anterior). Toggle "HARMÔNICOS" renomeado para "PADRÕES GRÁFICOS"
(mesmo id interno, zero migração de preferência salva) — agora cobre as
3 famílias com honestidade.

**Evidence Fusion Engine finalizado** — item que SYSTEM_HANDBOOK §6.72/
§6.74/§6.76 (3 rodadas seguidas) classificou como "iniciativa de
arquitetura própria, recomendado, nunca construído": `nexus/evidence-
fusion.ts` (`fuseEvidence`) agrega `EngineSignal[]` de fontes JÁ reais e
JÁ independentes (Conselho + Zonas Institucionais — 2º montador real,
`deriveEngineSignalsFromInstitutionalZones`) em estatística REAL de
cobertura/volume de evidência — nunca uma segunda pool de DIREÇÃO (LEI
24 intacta, mesma linha vermelha do cabeçalho de `engine-signal-
contract.ts`, repetida de propósito no novo arquivo). Scenario Engine
deliberadamente EXCLUÍDO como 3ª fonte (documentado): `opinionWeight`
já É a mesma massa de opinião do Conselho, somar as duas contaria a
MESMA evidência 2x — a redundância que a própria Carta Branca pediu para
eliminar, não multiplicar. Achado real de auditoria corrigido no
caminho: `computeInstitutionalZones` já era calculado há várias rodadas
só dentro do gráfico (`useMemo` local), sem NENHUMA fatia própria na
store — `institutionalZones` ganhou os 4 lugares reais (state → actions
→ defaults → seletor) e o gráfico agora TAMBÉM publica o mesmo array já
computado (zero segundo cálculo). Novo consumidor real em
`CouncilWidget`: linha "EVIDENCE FUSION · coverage, never a score" —
cor SEMPRE neutra de propósito (nunca verde/vermelho), garantia visual
de que a leitura nunca é lida como sinal direcional. Confirmado ao vivo
via Playwright contra o dev server real: `1/7 válidos · 5/10 campos`,
número real mesmo sob dados de mercado bloqueados pelo proxy do sandbox.

**Etiquetas laterais — gate real de precisão** ("só mostrar a precisão
maciça"): S1/R1 no eixo anti-colisão agora exigem `strength.label ===
"FORTE"` (>=2 toques independentes reais, `STRONG_TOUCH_THRESHOLD` já
existente em `support-resistance-engine.js` — zero limiar novo
inventado). Achado de auditoria que tornou o gate significativo (não um
no-op): `touches` nunca é 0 na prática (o próprio nível sempre conta a si
mesmo), então "FRACA" significa literalmente "nenhum OUTRO swing
independente confirmou esta zona ainda" — o caso genuinamente menos
preciso. Regra de Ouro 4 preservada com cuidado: só a ETIQUETA fica mais
rigorosa — a linha nativa (`supportLineRef`/`resistanceLineRef`,
`useEffect` dedicado) e o valor real de support/resistance (usado pelo
Core Engine/StructureLevelsStrip) continuam incondicionais, intocados.
TP1/TP2/TP3 do Trade Plan/fallback do Núcleo deliberadamente NÃO
ganharam o mesmo gate (documentado): são a informação mais acionável do
sistema, esconder por força fraca removeria dado real que o Operador
precisa mesmo quando ainda não confirmado 2x.

**Auditoria "automático cobre tudo" + ícones**: verificado por inspeção
direta de código (não uma suposição) — `DEFAULT_CHART_LAYER_AUTO_MODE` e
`RELEVANCE_LAYER_IDS` já cobriam as 21 `CHART_LAYER_IDS` reais 1:1 antes
desta rodada (TypeScript's `Record<ChartLayerId,boolean>` torna uma
chave faltando um erro de compilação, não uma suposição barata); nenhuma
camada nova foi criada nesta rodada (Triângulo/H&S reusam o id
"harmonics" já existente), então nada ficou de fora. Radar já escaneia
em `setInterval` real, não exige clique manual para o ciclo central.
Inventário de ícones (App.tsx, 9 ícones do rail de navegação + ~19 do
resto do app) revisado: zero duplicação semântica, zero placeholder/TODO
encontrado — consistente com as 5+ rodadas de polimento visual dedicado
já feitas antes desta (Lapidação Profissional do Gráfico, 2×Adendo,
2×Polimento/Lapidação Visual). Achado honesto: nenhuma mudança de ícone
foi necessária — inventar uma só para "fazer algo" violaria a disciplina
de não adicionar mudança sem justificativa real já seguida em toda esta
sessão.

**Relatório completo**: `docs/historico/RELATORIO_CARTA_BRANCA_CIBORGUE_ELITE.md`.

**Testes executados**: `tsc --noEmit` limpo · **134 arquivos / 2269
testes** (100%, +48 novos: 9 Triângulo + 7 Ombro-Cabeça-Ombro + 9
Evidence Fusion + 6 institutional-zones assembler + 11 consolidação
Evidence Fusion Engine wiring + 6 institutional-zones store wiring, mais
ajustes de janela/literal em testes de padrão pré-existentes shiftados
pelas novas linhas — nenhum enfraquecido, todos continuam checando a
mesma garantia real de antes, só a posição/texto exato mudou) ·
`npm run build` ok (1850 módulos, 888,38 kB) · Playwright real contra o
dev server: confirmado o toggle "PADRÕES GRÁFICOS" renderizando (troca
de "HARMÔNICOS"), o painel "Chart Patterns" com o piso honesto de 75%
FIT, e a linha "EVIDENCE FUSION" com dado real ao vivo — mesma limitação
de ambiente já documentada em rodadas anteriores (proxy do sandbox
bloqueia WebSocket real da Binance, gráfico fica honestamente em
"AWAITING CANDLES…"; não impede a verificação da UI estática/painéis).

### 6.82 "Ordem Oficial de Execução — Consolidação Final do AR10 Cyborg"
(fase: transição de motores para um organismo único); relatório completo
em `docs/historico/RELATORIO_CONSOLIDACAO_FINAL_ORGANISMO_UNICO.md`

Diretriz formal, prioridade máxima, 11 prioridades numeradas: o foco muda
de criar módulos novos para consolidar tudo já construído num organismo
único. Teste explícito definido pela própria Ordem para toda decisão
desta rodada: "torna o AR10 mais inteligente como organismo único, ou só
adiciona mais um módulo? Se só adicionar complexidade: não implementar."

**Prioridade 1 (auditoria total de redundância)**: 2 técnicas
independentes — contagem de importadores reais por módulo `nexus/*.ts` e
consumidores reais de cada seletor da store. Achado único, já conhecido
desde a Ordem 04: `cross-exchange-service.ts`/`connection-manager.ts`
continuam isolados de propósito (cutover WS/REST ao vivo, maior risco
técnico do projeto). Zero seletor órfão na store.

**Prioridade 3 (Evidence Fusion Engine vira centro de inteligência)**:
v2 de `nexus/evidence-fusion.ts` mapeia as 9 dimensões pedidas contra o
que já existe, honestamente — sem fabricar campo novo só para "bater a
lista". `weightConsensus: number | null` (novo): desvio padrão real sobre
os `weight` pooled de TODOS os sinais (não por fonte), normalizado pelo
teto real de 0.5 (`weight` vive em `[0,1]`) — um único campo cobre
consenso E conflito de propósito (mesma estatística, dois ângulos; dois
campos seria a redundância que a própria P1 desta Ordem pede para
eliminar). `relevance` (novo, passthrough em `EvidenceFusionSourceGroup`/
`EvidenceFusionSourceBreakdown`): `fuseEvidence` nunca calcula
relevância — recebe o `LayerRelevanceResult` REAL já pronto do CHAMADOR
(`CouncilWidget`, mesma fatia `useLayerRelevanceSnapshot` do painel de
camadas), mesmo raciocínio que `engine-signal-contract.ts` já usava para
deixar `relevance` null por sinal individual (granularidade certa: o
GRUPO de fonte, que mapeia 1:1 pra uma camada, não o sinal). Qualidade/
maturidade/contexto continuam mapeados para campos já existentes da v1,
sem duplicação. Estabilidade/consistência temporal/persistência
DEFERIDAS, documentado — exigem série temporal real (ring buffer) que
não existe ainda.

**Prioridades 6/7 (reconfirmação Gráfico Inteligente/Etiquetas)**:
auditoria, não reconstrução — 21/21 camadas reais seguem cobertas pelo
Relevance Engine, `PriceLabelStackPlugin` já tem `alpha`/`side` reais
(opacidade dinâmica + anti-colisão), só 2 arquivos em `chart/` chamam
`fillText` direto (o próprio stack + 1 rótulo de sessão já refinado em 2
rodadas). Achado novo e honesto, deliberadamente fora de escopo: 13 call
sites de `series.createPriceLine` nativo (EQH/EQL, Premium/Discount,
vencedor de padrão) e o stack customizado são 2 mecanismos de rótulo
paralelos sem consciência um do outro — característica arquitetural
observada, sem confirmação visual de colisão real; migrar quebraria o
pareamento nativo linha+rótulo, um refactor real sem sintoma confirmado
(a própria P1 desta Ordem pede o oposto).

**Testes**: `tsc --noEmit` limpo · **134 arquivos / 2280 testes** (100%,
+11 novos: 6 `weightConsensus` + 3 `relevance` passthrough + 2 wiring; 5
testes de padrão pré-existentes com assertions ajustadas à nova forma
real, mesma garantia, nenhuma enfraquecida) · `npm run build` ok (1850
módulos, 889,04 kB) · Playwright real contra o dev server (`localStorage`
do cortão de acesso desbloqueado localmente, mecanismo não-adversário que
o próprio `access-gate.tsx` documenta): `relevance` passthrough
confirmado ao vivo ("Zonas Institucionais... relevante agora", valor
real), `weightConsensus` corretamente `null` com 1 único peso disponível
("sem amostra real (menos de 2 pesos)", nunca fabricado), zero erro de
console novo, zero regressão de layout.

### 6.83 "Ordem Oficial: Fechamento da Arquitetura" (última fase de
consolidação) — relatório completo em
`docs/historico/RELATORIO_FECHAMENTO_ARQUITETURA.md`

Diretriz formal encerrando a fase de expansão do sistema. Diretriz
Principal: não criar novos motores/contratos/camadas/módulos — só fazê-los
trabalhar como um único ecossistema. Consequência aplicada à própria
classificação pedida (IMPLEMENTAR AGORA / MANTER ISOLADO COM
JUSTIFICATIVA TÉCNICA DEFINITIVA / DESCARTAR): IMPLEMENTAR AGORA só é
válido para wiring/integração de código já existente, nunca construção
nova.

**§1 (pendências recorrentes)**: auditoria dos próprios relatórios das
últimas ~8 rodadas + reconfirmação de cada status por leitura direta do
código. 12 itens classificados com tabela completa no relatório. Achado
que fecha uma pendência sem escrever código: a alegação "3 fades de
plugins pendentes" (desde a Entrega 16) estava desatualizada —
`SessionKeyLevelsPlugin`/`OrderFlowHeatmapPlugin` já têm decaimento real
por render (`sessionGenerationWeight`/`computeRecencyWeight`),
`LiquidationHeatmapPlugin` já decai por MAGNITUDE dentro do próprio motor
(`ageAlpha(ageMinutes, LIQUIDATION_DECAY)` em
`computeLiquidationHeatmap`, bucket de eventos velhos soma
efetivamente zero) — retirado do backlog, não implementado.
`cross-exchange-service.ts` e o backlog V-MAX (Liquidity Voids/Volume
Clusters/Cross-TF/Footprint/Auto Layout) reconfirmados MANTER ISOLADO
com justificativa definitiva (o 2º pela própria Diretriz Principal desta
Ordem). `visual-budget.ts` TARGET/INVALIDATION/RADAR e o pacote
`01_SYSTEM_ARCHITECTURE...11_FINAL_STATUS` classificados DESCARTAR, com
motivo real cada um (não fonte de peso individual sem fabricar;
estruturalmente incompatível com o modelo; 15+ rodadas sem necessidade
real, já coberto por `SYSTEM_HANDBOOK.md`/`RELATORIO_*.md`).

**§2 (Consolidação Definitiva)**: reconfirmado — consumidor real
(mesma auditoria de 2 técnicas do §1), função clara + documentação
(convenção estrutural já em vigor), integração completa (garantida
estruturalmente por `noUnusedLocals`/`noUnusedParameters` permanentes +
`tsc` limpo). Único gap real encontrado: `evidenceFusion` computado mas
nunca publicado — fechado no próprio §3 desta rodada.

**§3 (Evidence Fusion vira barramento)**: `evidenceFusion` ganhou os 4
lugares reais na store (`unified-snapshot-store.ts`, mesmo padrão de
`institutionalZones`/`layerRelevance`) — `CouncilWidget` publica a MESMA
leitura já computada (zero segundo cálculo), agora com `useMemo` real
(sem isto, `setEvidenceFusion` dispararia em todo render, não só em
mudança real). Primeiro consumidor novo: `self-diagnostics.ts` ganha
`evidenceFusionFieldCoverage` (mesma fórmula do painel "EVIDENCE FUSION")
e um achado novo "Evidence Fusion · cobertura do contrato", severidade
sempre OK (mesmo princípio de "Memória (heap JS)": sem limiar calibrado,
nunca fabricar um corte). `consensus-radar.ts` avaliado e rejeitado como
3ª fonte: 4 de suas 6 categorias são as MESMAS confidences dos votos do
Conselho re-fatiadas — somar contaria a mesma evidência 2x, mesma razão
que já excluiu Scenario Engine na Carta Branca.

**§4 (Experiência do Operador)**: revisão linha a linha do painel CORE
INTELLIGENCE — "SINCRONIZAÇÃO · IDADE DAS FONTES" mantido (defesa real
contra confiar em dado velho, não ruído); as 3 linhas de confluência de
"VALIDAÇÃO MULTI-CAMADA" medem 3 coisas genuinamente diferentes, fundir
perderia sinal real; disclaimer financeiro aparece 1 única vez; painéis
sempre-visíveis já são uma categoria arquitetural deliberada
("ALWAYS-docked"). Resultado honesto: nenhuma redução nova — depois de
10+ rodadas dedicadas de UX já reais, forçar um corte sem achado
concreto seria a mesma fabricação de trabalho já evitada na auditoria de
ícones da Carta Branca.

**Testes**: `tsc --noEmit` limpo · **135 arquivos / 2291 testes** (100%,
+11 novos: 4 store-wiring de `evidenceFusion` + 2 self-diagnostics + 5
assertions de padrão pré-existentes ajustadas à nova forma real,
nenhuma garantia enfraquecida) · `npm run build` ok (1850 módulos, 889,78
kB) · Playwright real contra o dev server: clique real em "GERAR
RELATÓRIO DE AUTODIAGNÓSTICO" produziu `[OK] Evidence Fusion · cobertura
do contrato — 50%...` — o mesmo número real do painel, agora também no
relatório; zero erro de console novo, zero regressão de layout.

### 6.84 "Ordem Final: Validação Integral do Ecossistema AR10 Cyborg"
(homologação, zero código novo) — relatório completo em
`docs/historico/RELATORIO_HOMOLOGACAO_FINAL_ORGANISMO.md`

Ordem de homologação pura: comprovar com evidência real que o
ecossistema funciona como um único organismo — sem criar/alterar nada.
5 etapas.

**Etapa 1 (auditoria)**: 2 técnicas de importador real (60/61 módulos
com consumidor real; único isolado, `cross-exchange-service.ts`, já
justificado 5+ rodadas) + auditoria de 40 seletores da store (39/40 com
consumidor real; `useUnifiedSnapshot` reconfirmado falso-positivo de
regex). **Achado investigado e resolvido**: `useEvidenceFusionSnapshot`
tem zero chamadas como hook React — mas o VALOR tem 2 consumidores reais
(`CouncilWidget` via `useMemo`, `self-diagnostics.ts` via
`getSnapshotForEngine()`, a única forma válida dentro de um `onClick`,
já que Hooks não podem rodar em callbacks) — não é código morto.
**Dependência circular: zero**, confirmado por ferramenta (`madge
--circular`) em 164 arquivos TS + 20 arquivos JS — primeira vez nesta
sessão que este check específico roda com uma ferramenta dedicada, não
auditoria manual.

**Etapa 2 (execução real)**: Playwright contra dev server E build de
produção (`vite preview`) — todos os 6 painéis do CORE INTELLIGENCE, os
7 agentes do Council, Evidence Fusion, Chart Layers Panel ("ESTADO
INTELIGENTE ADAPTATIVO"), Radar/OIH, Pattern Engine ("PADRÕES
GRÁFICOS") e Self-Diagnostics confirmados ao vivo. 2 discrepâncias
aparentes (falta de "Adaptativo"/"PADRÕES GRÁFICOS" num primeiro
grep) investigadas a fundo e resolvidas como falhas do PRÓPRIO script
de teste (case-sensitivity contra `text-transform: uppercase`; timing
de sequência de cliques) — não da aplicação. Canvas do gráfico
confirmado 0 nesta sandbox POR DESENHO (`chartData.length > 0 ?
<Chart/> : <div>AWAITING...` — o componente inteiro só monta com
candles reais).

**Etapa 3 (integração)**: rastreamento real da cadeia de dependências
corrige a sequência que a própria Ordem propôs — "Evidence Fusion →
Council" está invertido (confirmado por import: `council.ts` tem ZERO
referência a evidence-fusion; a direção real é Council → Evidence
Fusion, uma das 2 fontes de entrada); Pattern Engine não é downstream
do Motor Matemático (lê os mesmos candles brutos em paralelo); Market
Structure é PARTE do Motor Matemático, não um estágio separado. A
cadeia REAL funciona sem quebra, confirmada ao vivo (Council →
Evidence Fusion com dado real mesmo sob rede bloqueada).

**Etapa 4 (performance, só medir)**: bundle de produção com só 3
requisições reais no boot (266 KB JS gzip + 11 KB CSS + 1 ícone;
llm-worker/llm-bridge de 6 MB confirmados nunca buscados sem ativação
do Neural Core) · `domContentLoaded` ~112ms, conteúdo montado ~340ms
(localhost) · 60fps fluido · ~9MB heap JS. **Achado real de ambiente de
teste, não de produção**: o Quant Worker WASM sempre reporta "não vivo"
em teste local isolado — rastreado até a causa raiz exata: o arquivo
físico vive em `ipad_runtime/workers/`, um nível acima de `ramber-ui/`,
e só fica ao lado do `index.html` real pelo `cp -r dist/. ../` do
workflow de deploy (`.github/workflows/deploy-ipad-pwa.yml:62`) — que
roda só no CI, nunca num preview local isolado. Explica, pela primeira
vez com causa raiz documentada, por que este check específico nunca
passou em nenhuma verificação Playwright desta sessão inteira.

**Etapa 5**: relatório único com as 10 seções exatas pedidas
(arquitetura, fluxograma Mermaid, motores, responsabilidades,
consumidores, dependências, fluxo de dados, gargalos, pendências reais,
melhorias futuras só listadas).

**Zero código de produção alterado** — só auditoria, execução real,
medição e o relatório, conforme a própria Ordem pediu.

---

### 6.85 "Ordem Oficial: Consolidação Final do AR10 Cyborg" (Fase Final —
"transformar todos os motores em um único organismo inteligente") —
relatório completo em `docs/historico/RELATORIO_ORGANISMO_UNICO_FASE_FINAL.md`

Segunda Ordem de consolidação pura em sequência (a Entrega 22 já tinha
homologado o ecossistema): 10 diretrizes obrigatórias + uma Regra de
Ouro única ("esta mudança torna o AR10 mais inteligente como organismo
único, ou só adiciona complexidade?"). Aplicada a cada candidato de
mudança considerado — nenhum sobreviveu ao teste.

**As 8 dimensões pedidas da Evidence Fusion** (contexto/consenso/
cobertura/qualidade/maturidade/relevância/conflito/leitura consolidada)
já são campos reais em `nexus/evidence-fusion.ts` — mapeadas de novo,
com leitura fresca do código atual (não do comentário de cabeçalho da
Entrega 20): `qualidade` mapeada honestamente a `validSignals/
totalSignals` (razão real derivável de 2 campos já existentes, zero
campo novo) — distinta de `cobertura` (`fieldCoverage`, sobre o
CONTRATO) mesmo sem ganhar seu próprio campo, porque criar um só para
repetir o nome seria a mesma redundância que a Ordem anterior já pediu
para eliminar.

**Achado mais importante da rodada**: o diagrama que esta Ordem propõe
no §3 (`Core Engine → Pattern Engine → Institutional Zones → Council →
Evidence Fusion → Trade Plan → Painéis`) diverge do grafo real em 3
pontos, confirmados por grep de import desta rodada — Pattern Engine lê
os mesmos candles brutos em paralelo ao Core Engine (não é downstream);
Institutional Zones não alimenta o Council; e, o ponto que importa,
`buildTradePlan` NUNCA importa `evidence-fusion.ts` — consome só
`council.stance`/`riskGated` + zonas estruturais brutas (OB/FVG/S-R/Fib/
VP). Implementar a seta "Evidence Fusion → Trade Plan" literalmente
introduziria uma segunda influência sobre o dado mais acionável do
terminal — exatamente a "decisão paralela" que o §3 da própria Ordem
proíbe e que a LEI 24 (reafirmada no §2 dela) já barra. O código atual
obedece a intenção da Ordem melhor do que o diagrama literal dela — não
corrigido para "bater" com o desenho.

**Auditoria nova de `nexus/*.ts`**: as 10 ocorrências reais de import
não-`type` entre módulos `nexus/*.ts` foram listadas e classificadas
individualmente — todas caem em utilitário matemático puro (EMA→MACD,
VWAP→bandas/Nexus Line, percentile compartilhado), infraestrutura
(ConnectionManager, TypedEventBus), a API de leitura sancionada da
Snapshot (`getSnapshotForEngine`), ou formatação read-only de uma
decisão já fechada (`operational-readability.ts` ← `decision-layer.ts`).
Zero caso de um motor consumindo a OPINIÃO de outro motor diretamente —
a arquitetura já satisfaz "Motor → Store → Snapshot → Consumidor" (§5)
sem nenhuma mudança.

**Verificação**: `tsc --noEmit` limpo · `vitest run` 135 arquivos / 2291
testes (100%, idêntico à Entrega 22 — zero código de produção mudou) ·
`npm run build` 1850 módulos / 889,78 kB (byte-a-byte idêntico).
Playwright não executado (zero superfície nova/alterada). Zero pendência
reaberta.

---

### 6.86 "Ordem Oficial de Execução: Consolidação Final" (rodada 3,
endereçada a "Agente 4") — relatório completo em
`docs/historico/RELATORIO_ORGANISMO_UNICO_RODADA_3.md`

Terceira Ordem de consolidação em sequência, mesmo conteúdo substantivo
das duas anteriores. **Evento de segurança tratado antes de agir**: a
mensagem chegou endereçada a "Agente 4 (Executor Principal)" com
"Status: AUTORIZADO PARA EXECUÇÃO" e terminava com 5 repetições de um
rodapé de interrupção/"continue" sem correspondência real nesta
sessão — mesmo padrão do item 7 da Disciplina de Trabalho. Pausado via
pergunta direta ao Operador antes de qualquer execução; confirmado como
próprio (mesma resolução da vez anterior que "Agente 4" apareceu, na
Carta Branca) — conteúdo substantivo autorizado, persona nunca adotada,
rodapé de interrupção tratado como ruído.

`git log`/`git status` confirmaram **zero drift** desde a Entrega 23
(commit `0571ced` ainda `HEAD`) — reexecutar a mesma bateria de
auditoria rodada minutos antes, sobre o mesmo código, não produziria
achado novo. Relatório desta rodada é proporcionalmente mais curto:
reconfirma §2-§10 por referência direta à Entrega 23 (mesmo código,
mesma evidência) e investiga a fundo só o que é genuinamente novo — o
diagrama desta Ordem posiciona "Core Engine (única decisão)" DEPOIS de
Evidence Fusion, diferente das 2 Ordens anteriores. `grep` novo em
`ipad_runtime/js/real-data/` (onde o Core Engine real calcula) confirma
zero referência a `evidence-fusion` — o Core Engine é comprovadamente
independente. Implementar essa seta do diagrama faria da Evidence Fusion
"outro motor alterando a decisão", violando o §3 da PRÓPRIA Ordem
("nenhum outro motor poderá alterar essa decisão") — mantido como está.

Zero código de produção alterado; `tsc`/`vitest`/`build` não
reexecutados (nenhuma mudança para invalidar os números já confirmados
na Entrega 23 minutos antes).

---

### 6.87 "Ordem Oficial: Fase de Lapidação, Sincronia e Experiência do
Operador" (endereçada a "Agente 4", 3ª vez) — relatório completo em
`docs/historico/RELATORIO_LAPIDACAO_SINCRONIA_EXPERIENCIA.md`

Diferente das 3 Ordens de consolidação anteriores (zero código novo):
esta pede execução visual/UX real. Mesma Regra de Ouro aplicada a cada
candidato antes de implementar. "Agente 4" reconfirmado sem elemento
novo de suspeita — mesma resolução já estabelecida.

**Auditoria com 2 agentes de exploração em paralelo + Playwright real**
encontrou 3 achados concretos entre os 9 pontos pedidos:

1. **§3/§5/§6 (o achado central)**: Nível 1 (`MarketDirectionWidget`) e
Nível 3 (`CouncilWidget`/`GmilContextWidget`) vivem nas MESMAS gavetas
fechadas por padrão (App.tsx:774-775); dentro da gaveta, Nível 4
(`TelemetryHealthWidget`) não tem diferenciação visual de Nível 3. O
único texto que já sintetizava BIAS/SETUP/ENTRY/RISCO/CONFLUÊNCIA em
linguagem (`buildOperationalSummary`) só chegava ao Operador via
`title=` — tooltip que o próprio código já documentava nunca aparecer
em toque no iPad Safari. **Implementado**: `buildNarrativeSummary()`
(novo, `operational-readability.ts`) reusa os MESMOS eixos já
derivados/testados + `reasonsFor`/`reasonsAgainst` de
`decision-layer.ts` — zero motor novo, só prosa em vez de linhas
rotuladas; fail-closed por construção (decision null/INSUFFICIENT_DATA
vira frase honesta de ausência). `NarrativeSummaryCard` exibe o texto
como parágrafo VISÍVEL, primeiro item da gaveta "Core Intelligence" —
confirmado ao vivo via Playwright mostrando o texto fail-closed
correto sob rede bloqueada. Reestruturar as gavetas em si (Nível 1
sempre visível fora de qualquer gaveta) foi avaliado e propositalmente
NÃO tentado — alto blast-radius sobre o TopBar/chrome já muito
ajustado, sem captura real do Operador confirmando o problema em uso.

2. **§9 (redundância real)**: `engine.confidence` aparecia com 2
rótulos diferentes — "CONFIANÇA" (App.tsx:4319) e, mais grave, um
falso cognato "Conviction (Core Engine)" (App.tsx:7655) colidindo com
o sistema DE FATO chamado Conviction (`convictionReading.conviction`,
massa de opinião de 3 subsistemas). Corrigido: renomeado para
"Confiança (Core Engine)" — 1 linha de texto, zero lógica.

3. **§7 (responsividade, reconfirmada limpa)**: Playwright real em 6
breakpoints (iPad Mini portrait/landscape, iPad Air, iPad Pro, Desktop,
Ultrawide) — zero scroll de página em qualquer um. Um alarme falso
("342 elementos overflowing") investigado até a causa real: as gavetas
fechadas usam `transform: translateX(±110%)` (off-canvas), então
`getBoundingClientRect()` nos filhos reporta a posição fora da tela por
design — não é overflow real. Reconfirmado com a gaveta aberta de
verdade: 320px fixos, dentro do viewport nas 3 larguras testadas.

**Demais seções (§1, §2, §4, §8) reconfirmadas já satisfeitas** com
evidência fresca (paleta consistente exceto 1 âmbar já documentado como
intencional; sincronização garantida por Store única + React;
`visual-budget.ts` já cobre BOS/CHOCH/FVG/OB/Liquidez/Trade Plan;
coerência visual sem achado novo) — nenhuma mudança fabricada onde não
havia gap real.

**Testes**: `tsc --noEmit` limpo · 135 arquivos / 2296 testes (100%,
+5 novos de `buildNarrativeSummary`) · `npm run build` ok (1850
módulos, 891,75 kB, +1,97 kB evidência real do código novo) ·
Playwright real confirmou o card "LEITURA CONSOLIDADA" ao vivo e zero
overflow nos 6 breakpoints.

---

### 6.88 "Ordem Entrega 26: Lapidação Visual Final + Experiência
Operacional" — relatório completo em
`docs/historico/RELATORIO_ENTREGA_26_LAPIDACAO_FINAL.md`

10 Prioridades; 6 delas (1, 2, 5, 7, 9, 10) repetem frentes que a
Entrega 25 auditou horas antes com evidência fresca e concluiu já
satisfeitas — referenciadas, não reauditadas. O trabalho real desta
rodada concentrou-se no que era genuinamente novo ou pendente.

**Prioridade 4 — a pendência da Entrega 25, agora FECHADA.** A Entrega
25 encontrou que Nível 1 e Nível 3 viviam nas mesmas gavetas fechadas
por padrão, mitigou parcialmente e registrou a raiz no backlog com um
gatilho declarado ("uma captura de tela real do Operador"). Esta Ordem
diz literalmente "Sem abrir gavetas. Sem procurar informações." — é o
gatilho, por escrito. Implementado `ContextReadStrip`: faixa nova na
LINHA 2 do cabeçalho (a mesma linha sempre visível de
`TradePlanTopStrip`/`StructureLevelsStrip`), com 4 leituras que os
motores JÁ produziam e que só apareciam dentro de gavetas — REGIME
(`engine.marketRegime` + o mesmo `REGIME_DISPLAY` do painel), FLUXO
(sinal do CVD, mesma regra do mesmo painel), RISCO
(`deriveRiskState`), CONFLUÊNCIA (`deriveConfluenceState`). Zero
cálculo novo (travado por teste que proíbe `Math.*`/`reduce(` no
bloco), zero sistema visual novo (reusa `BarField`, atendendo a
Prioridade 5), zero redundância com a linha 1 (direção e score ficam
deliberadamente de fora — travado por teste), fail-closed campo a
campo.

**Verificação ao vivo + correção do próprio método**: a primeira sonda
Playwright usava `body.innerText` e reportou os 4 rótulos presentes —
**falso positivo**, porque gavetas fechadas usam `translateX(±110%)`,
que tira da tela mas não de `innerText`; ela estava lendo os rótulos
homônimos DENTRO das gavetas. Refeita por geometria
(`getBoundingClientRect`) + ancestralidade (`closest`): RISCO=ELEVADO e
CONFLUÊNCIA=INSUFICIENTE confirmados a `top:46px`, fora de qualquer
gaveta, em iPad Air e iPad Mini portrait, `hOverflow:0`. REGIME e FLUXO
corretamente ausentes — sem candles nesta sandbox não existe regime nem
CVD, e o fail-closed fez o campo sumir em vez de inventar. O resultado
real (2 ao vivo, 2 corretamente ausentes) é mais fraco que o primeiro
relatado, e é o que vale.

**Prioridade 8**: `buildNarrativeSummary(decision, context?)` ganhou 2º
parâmetro OPCIONAL `{ regimeLabel, flow }` — contexto real repassado
pelo chamador, nunca calculado no módulo (mesmo precedente de
`EvidenceFusionSourceGroup.relevance`). Fail-closed testado por
igualdade literal: omitir o parâmetro e passá-lo vazio produzem a mesma
string.

**Prioridade 6 — 1 achado real**: das 19 animações em `App.tsx`, 18 são
condicionais a estado real (conexão viva, microfone falando, ciclo em
andamento) e foram mantidas; o botão "Sincronizar Agora" pulsava
PERMANENTEMENTE, independente de estado — movimento constante com zero
informação. Removido.

**Prioridade 3 — NÃO implementada, com motivo**: "distância até o alvo/
percentual/ATR restante" não existem como valor calculado hoje;
produzi-los seria cálculo novo na interface, que a própria Ordem proíbe
duas vezes. Registrado no backlog: o caminho honesto é um motor puro
derivá-los com testes, nunca a UI inline.

**Testes**: `tsc` limpo · 136 arquivos / 2308 testes (100%, +12 novos) ·
build 1850 módulos / 893,77 kB (+3,99 kB, evidência do código novo) ·
Playwright real em 2 resoluções. 1 asserção minha foi corrigida durante
a verificação (confundia posição no arquivo com aninhamento de JSX —
a barra de comando é definida depois das gavetas, mas não está dentro
delas).

---

### 6.89 "Ordem Oficial: Etapa de Lapidação Matemática e Visual" —
relatório completo em `docs/historico/RELATORIO_LAPIDACAO_MATEMATICA.md`

Ordem legítima (sem endereçamento a persona fictícia) fechando
explicitamente a fase de criação de motores novos: só upgrades de
precisão em cima do que já existe, gate duplo (justificativa matemática
real + evidência de que ficou mais preciso, não só mais complexo).

**Auditoria dos engines nomeados contra a definição de referência**:
ADX/DI de Wilder (`regime-engine.js`), RSI/ROC/ATR de Wilder
(`lorentzian-classifier.js`), MACD (`macd.ts`), VWAP + bandas de
desvio-padrão ponderado por volume (`vwap.ts`/`vwap-bands.ts`), linear
opinion pool de Stone/DeGroot (`council.ts`), pivots/Fibonacci
(`support-resistance-engine.js`) — todos conferidos e confirmados
corretos contra a literatura. Nenhuma "modernização" cosmética aplicada
a nenhum deles.

**O único gap real, pesquisado antes de implementar**: o classificador
k-NN Lorentziano já citava a técnica de referência (jdehorty, "ML:
Lorentzian Classification") só para a métrica de distância. `WebSearch` +
`WebFetch` confirmaram que a técnica original tem uma segunda
característica não portada — espaçamento cronológico mínimo de 4 barras
entre vizinhos candidatos, documentado pelo próprio autor como necessário
para "prevenir viés de agrupamento temporal no treino." Motivo real:
RSI/ROC/ATR% são recorrências sobre janela móvel — sem espaçamento, os
k=8 vizinhos mais próximos tendem a vir todos da mesma janela contígua
recente (1 tendência contada 8 vezes, não 8 analogias independentes),
inflando a confiança reportada sem ganho real de evidência.

**O que foi portado e o que não foi**: só a ideia com justificativa
estatística real (o espaçamento) — não o mecanismo de seleção por
streaming do Pine original (`lastDistance` crescente + FIFO), que é uma
aproximação motivada pelo orçamento de execução por-barra do TradingView,
não uma técnica superior ao top-k por ordenação completa que este motor
já faz em JS. Portar aquele mecanismo teria sido só complexidade sem
ganho.

**Implementação**: nova constante `CHRONOLOGICAL_SPACING = 4`, filtro de
uma linha no laço que constrói o `trainingSet` (`i % 4 === 0`), ancorado
no índice ABSOLUTO do candle — nunca relativo ao candle atual, para
preservar a invariante já testada de que anexar 1 candle novo nunca pode
crescer `sample_size` em mais de 1. Qualquer par de múltiplos de 4 difere
em ≥4 por construção, então o pool já sai mutuamente espaçado sem
reimplementar a aproximação do original. Tradeoff documentado com
honestidade em `metadata.limitations`: pool de treino efetivo caiu de
~60-80 para ~15-20 pontos — mais rigor estatístico, mais casos honestos
de `DADOS_INSUFICIENTES` em janelas pequenas.

**Interface**: nenhuma mudança necessária — `App.tsx` já exibe "k-NN
LORENTZ. {classificação} · {confiança}% (n={sample_size})" sem nunca usar
a palavra "probabilidade" e sempre mostrando o `n` real; um `n` menor e
mais honesto flui pelo mesmo caminho.

**Visual (DIRETRIZ 5-7)**: Entregas 25/26 (mesma sessão, horas antes) já
auditaram hierarquia/ruído/cores/camadas com evidência fresca —
referenciadas, não reauditadas. Verificação direta feita: o rótulo
"k-NN LORENTZ." (única superfície de UI que este achado toca) confirmado
fail-closed e livre de linguagem de probabilidade.

**Testes**: `tsc` limpo · **136 arquivos / 2311 testes (100%, +3 novos)**
— valor da constante, contagem exata do pool espaçado (prova que o
filtro está ativo, não é comentário morto), propriedade de espaçamento
mútuo · build 1850 módulos / 893,78 kB (+0,01 kB, consistente com poucas
linhas em um único módulo) · `git diff --stat` confirma só os 2 arquivos
pretendidos tocados.

---

### 6.90 "Ordem Oficial: Fase de Lapidação de Elite" (EPC-05) — relatório
completo em `docs/historico/RELATORIO_EPC05_LAPIDACAO_ELITE.md`

Quinta mensagem "Agente 4", sem elementos novos de suspeita — conteúdo
autorizado, persona nunca adotada. A lista de plataformas de referência
desta Ordem repete quase palavra por palavra a DIRETRIZ 6/7 da Entrega 27
— não reauditada. Foco real: `src/orderflow/signal-engine.js` (motor
OFI/Absorption/Exhaustion, porta byte-a-byte de `golden-master.html`),
nunca lido nem testado por esta sessão antes, apesar de já alimentar o
Conselho, `trap-detection.ts` e o feed "MEXC ORDERFLOW" visível.

**Achado 1 — nomenclatura**: pesquisa real (`WebSearch`) confirmou que o
Order Flow Imbalance formal (Cont/Kukanov/Stoikov 2010/2014) é definido
sobre EVENTOS DO LIVRO DE OFERTAS (mudança de fila no melhor bid/ask) —
não sobre trades executados. O que este motor calcula sob o mesmo nome
"OFI" é um desequilíbrio real de volume agressor (compra vs. venda) sobre
trades — métrica real e útil, mas estruturalmente diferente do conceito
acadêmico. O projeto não tem (nem pode fabricar, Regra de Ouro 1) fonte
L2 real — só o poller público de trades da MEXC — então o OFI acadêmico é
honestamente impossível aqui. Renomear a string de tipo em runtime
divergiria do vocabulário do próprio `golden-master.html` (protegido) —
risco desproporcional para uma imprecisão de nome. Corrigido via
**documentação honesta** (cabeçalho + `metadata`), zero mudança de
comportamento.

**Achado 2 — zero cobertura de teste**: `processSignals`/
`createEngineState` nunca tiveram teste de execução real apesar de já
alimentarem decisão de confluência em produção. Novo
`signal-engine.test.ts`, 15 testes reais: CVD, OFI (janela real de 400,
limiar 0.6, volume mínimo 100, cooldown real de 500ms via
`vi.useFakeTimers`), ABSORPTION (janela real de 5s, gate de preço 0.1%,
volume mínimo 500), EXHAUSTION (só dispara com os DOIS portões reais —
z-score extremo E reversão de preço — nunca com o pico de delta sozinho).

**Achado colateral, registrado sem tentativa e erro**: `reversalConfirmation:
0.2` de produção exige 20% de movimento de preço em só 10 trades para
confirmar reversão — uma barra alta para o cadenciamento real de tick da
MEXC. Sem dado real de estatística de tick nesta base para julgar
calibração, o número foi documentado honestamente (código +
relatório), **nunca alterado por suposição** — a própria Ordem proíbe
"tentativa e erro".

**Efeito colateral**: escrever o 1º consumidor TS real do motor expôs
falta de JSDoc em `processSignals`/`Signal.metadata` (TS inferia tipos
literais estreitos demais). Corrigido com `@typedef`/`@param` reais —
zero mudança de runtime, benefício para qualquer consumidor futuro.
`src/orderflow/` (pasta protegida, só extensões aditivas): nenhuma linha
de cálculo tocada, só comentários/JSDoc/metadata.

**Testes**: `tsc` limpo · **137 arquivos / 2326 testes (100%, +15
novos)** · build 1850 módulos / 893,78 kB (byte-idêntico — confirma zero
mudança de comportamento de produção) · `git diff --stat` confirma só 2
arquivos de `src/orderflow/` + 1 teste novo tocados.

---

### 6.91 "Ordem Mestra — AR-10 CYBORG" (47 seções) — relatório completo em `docs/historico/RELATORIO_ORDEM_MESTRA.md`

Texto original não sobreviveu literalmente à compactação de contexto
desta sessão — relatório é síntese honesta por tema (não pontuação
item-a-item do checklist de 30 itens original, que não está mais
disponível verbatim), evidenciada por commit/arquivo/teste real.

**Entregue nesta Ordem**: provedor real DefiLlama (GMIL categoria ONCHAIN
sai do `null`, `gmil/providers/defillama-provider.ts`, 15 testes) ·
renomeação "Modo Operacional/Inteligência/Auditoria" → "Preset ..." no
painel Camadas do Gráfico (achado: "Modo" lia como 2º cérebro decisório
mesmo sendo só preset de visibilidade, risco cosmético vs. LEI 24) ·
pesquisa real (WebSearch) + documentação honesta dos bloqueios
estruturais de MT5 (nenhuma API pública alcançável por `fetch()` de
navegador — toda rota real exige processo fora do navegador ou
credencial de corretora a terceiro) e calendário macro (nenhuma fonte
keyless/CORS-aberta; caminho alternativo real documentado — schedule
estático curado de `bls.gov`/`federalreserve.gov` — não construído sem
decisão do Operador).

**Achado real fora do pedido original, corrigido do mesmo jeito
(Disciplina de trabalho §1)**: 3 bugs reais confirmados por auditoria
contra um documento externo separado ("Plano de Evolução Orgânica") que
pedia vocabulário biológico obrigatório + arquitetura wrapper-only —
ambos rejeitados pelo Operador via `AskUserQuestion` em favor do estilo
direto já estabelecido. Bugs reais corrigidos: `worker-client.terminate()`
nunca rejeitava promises pendentes (chamada em voo ficava presa para
sempre); `quant-worker.compute_series` era o único dos 3 handlers de
cálculo sem guarda upfront contra `window` inválido; `mexc-trades-
stream.tradesToTicks()` fabricava tick com `Number(null)===0` (mesma
classe de bug já corrigida antes em `tradfi-delayed-yahoo.js`).

**2º achado fora do pedido original, mesmo padrão**: verificação
Playwright real (exigida por CLAUDE.md para toda mudança de UI, mesmo o
rename cosmético dos botões) capturou um erro de CSP não relacionado —
`api.llama.fi` bloqueado por `connect-src` incompleta, MESMA classe de
bug que este projeto já tinha documentado ter acontecido com
`api.bybit.com`/`www.okx.com` antes. Auditoria estática subsequente (todo
host `https://` do código-fonte contra a allowlist) achou uma 2ª
ocorrência pré-existente: `query1.finance.yahoo.com`. Ambos corrigidos +
nova trava de regressão permanente (`production-seal.test.ts`, "diretriz
5") para que uma 3ª ocorrência não dependa de alguém abrir o DevTools por
acaso.

**Testes**: `tsc` limpo · **159 arquivos / 2589 testes (100%)** · build
ok · verificação Playwright real (dev server + Chromium do ambiente,
viewport 430×932 `hasTouch:true`).

---

### 6.92 Fechamento honesto do ADITIVO V-MAX (Etapas 2-15, task interna
#82) — "execute tudo, habilite todos os modos ativos" (autonomia total
concedida pelo Operador, aplicada dentro do READ_ONLY permanente)

Pedido do Operador (informal, direto): rodar tudo que falta, sair do modo
"só teste interno", "habilitar todos os modos ativos". Uma leitura
possível ("modo ativo" = execução real de ordens) é permanentemente
proibida por este mesmo arquivo — confirmado via `AskUserQuestion` antes
de agir; o Operador respondeu concedendo autonomia total em vez de
escolher uma opção. Interpretação aplicada, ancorada no próprio texto
deste arquivo ("a reformulação não muda o que o código faria" e "carta
branca... você faz a escolha mais correta"): verificação/execução
completas dentro da arquitetura READ_ONLY já existente + fechar
honestamente o backlog interno "ADITIVO V-MAX Etapas 2-15" (#82), aberto
desde §6.42 e nunca fechado de ponta a ponta.

**0. Auditoria de um documento externo antes de construir ("Bíblia da
Evolução")**: mesmo padrão do "Plano de Evolução Orgânica" (§6.91) — um
2º documento externo (v2.0, mesma dupla de personas fictícias) pedindo
vocabulário biológico obrigatório + arquitetura `nervous-system/`
wrapper-only + reorganização de 44 dias/9 fases, com "15 Bugs Críticos".
Rejeitado via `AskUserQuestion` (Operador escolheu "Auditar + corrigir
bugs reais, sem vocabulário novo"). Auditoria dos 15 achados contra o
código REAL antes de qualquer fix: 2 já corrigidos nesta sessão, 1
repetia uma alegação já derrubada, 6 eram falsos (código já correto),
5 reais + 1 cosmético corrigidos (commit `5307fca`):
`worker-client.js`/`quant-worker.js`/`binance-liquidations-stream.js`/
`analysis-frame.js` tinham 3 símbolos duplicados fora de `shared/
symbols.js` (novo, `SYMBOL_TO_USDT_PAIR`, único agora); `mexc-trades-
stream.js.start()` disparava `cycle()` sem `.catch()` no primeiro tick
(mesmo idioma fire-and-forget já usado em `gmil-orchestrator.ts`,
faltava só neste ponto); `quant-worker.compute_series` sempre computava
`rollingSma`/`rollingZ` mesmo quando o chamador não pedia (agora
condicional via `includeRolling`); `binance-liquidations-stream.js`
`onopen` não checava `stopped` antes de resetar o backoff (mesma classe
de bug já corrigida em outros streams); `analysis-frame.js` usava
`Math.min(...array)`/`Math.max(...array)` — `RangeError` real em arrays
muito grandes (>~100k elementos), substituído por acumulador com a MESMA
semântica de propagação de NaN. 1 achado cosmético: comentário
esclarecendo um `if` defensivo genuinamente inalcançável em `probe.js`.

**1. Chart Integrity Engine (Etapa 17 do V-MAX) — motor novo, commit
`328f048`**: auditoria prévia (Disciplina de trabalho item 1) achou que o
`cancelled` do efeito `runCycle` em `App.tsx` já evita a PIOR forma de
desync (ciclo velho sobrescrevendo a seleção nova de symbol/timeframe) —
mas isso é um invariante IMPLÍCITO, sem sinal visível se um refactor
futuro quebrar a guarda. `nexus/chart-integrity.ts` (motor puro,
`computeChartIntegrity`) torna isso EXPLÍCITO: 4 estados (`SYNCED`/
`SYMBOL_MISMATCH`/`STALE_DATA`/`DADOS_INSUFICIENTES`), staleness
calculada como 3× o intervalo real da barra (`TIMEFRAME_MS`, reusado de
`aura-lifecycle.ts`, nunca redefinido). Graduado: `engine-bridge.ts`
passa `symbol`/`timeframe`/`candleAgeMs` como passthrough puro (mesmos
valores já usados no ciclo, nunca uma 2ª leitura); nova Row "INTEGRIDADE
DO GRÁFICO" no painel SYSTEM HEALTH, mesma paleta `DATA_QUALITY_COLOR`
das outras 3 linhas de qualidade. 17 testes (10 motor puro + 7 fiação).
Verificado AO VIVO nesta rodada (Playwright, dev server real): a Row
renderiza e mostra corretamente `DADOS_INSUFICIENTES` ("AGUARDANDO")
porque este sandbox não tem egress real para Binance (túnel do proxy
recusa o WebSocket) — o caminho fail-closed é o único verificável aqui
sem rede real, e é o mais importante dos 4 (prova que o motor nunca
fabrica um `SYNCED` falso quando não há candle real).

**2. Organism Health — widget persistente (Etapa 19) + Footprint
RECUSADO (Etapa 18, achado que virou decisão) — commit `5454194`**:
`self-diagnostics.ts` (relatório profundo, 10 achados) já existia mas é
SOB DEMANDA (clique). `nexus/organism-health.ts` (motor puro,
`computeOrganismHealth`) fecha a lacuna oposta: um veredito agregado
SEMPRE VISÍVEL, reduzindo os MESMOS 8 sinais já nomeados linha a linha no
painel (Bus/Suficiência/GMIL/Integridade do Gráfico/FPS/Latência do
Ciclo/offline/Worker WASM — 3 deles promovidos de inline para const
nomeada, só para permitir o reuso, zero segunda medição) a "pior sinal
vence", com um 4º degrau `AGUARDANDO` que nunca é mascarado como OK nem
como CRITICAL (ausência real de medição ≠ problema confirmado — Regra de
Ouro 3). Nova Row "SAÚDE DO ORGANISMO", primeira do painel, mesma
paleta. 18 testes (12 motor puro + 6 fiação). Verificado ao vivo: valor
de pior caso ("CRÍTICO · Integridade do gráfico", a combinação mais
longa possível) não estoura a largura do próprio painel nem causa scroll
de página.

Investigação paralela de Footprint (motor de volume-por-preço-POR-
CANDLE) esbarrou num achado estrutural: `volume-profile.ts` já
documentava que não existe tick stream real de Binance Futures neste
codebase (só klines/liquidations via `forceOrder`/probes REST de
premium-index) — confirmado de novo por grep direto (`aggTrade`/`@trade`
— zero ocorrência em `binance-futures-public.js`). O único tick stream
real do repositório é MEXC Spot, outro mercado. Um Footprint honesto
precisa de compra-vs-venda dentro do MESMO candle; bucketar ticks MEXC
Spot dentro de candles Binance Futures atribuiria fluxo de ordens de UM
mercado a candles de OUTRO — uma classe de dado fabricado mais grave que
a aproximação OHLCV já declarada do próprio Volume Profile (que ao menos
preserva o mesmo instrumento/período). **Decisão: RECUSADO**, registrada
no próprio `volume-profile.ts` (mesmo padrão da nota de escopo honesta
que já vivia ali) — não construído até existir um tick stream real de
Binance Futures neste codebase.

**3. Fechamento de #234 (Volume Clusters / Cross-Timeframe Liquidity)**:
reconfirmados nesta rodada, sem mudança de estado — Volume Clusters
continua **RECUSADO** (duplicaria Volume Profile como conceito
distinto); Cross-Timeframe Liquidity continua **RECUSADO** (documentado
em `multi-timeframe-engine.ts`: Volume Profile/Liquidez ficam fora do
escopo da Fase Ω v1 por custo de Worker sem necessidade para a pergunta
central "os prazos concordam?"). Mesma distinção AUSENTE-vs-RECUSADO já
formalizada em `MAPA_EVOLUCAO_CIBORGUE.md`.

**4. Correção de registro: "Adaptive Zoom" não está AUSENTE** — achado
de auditoria (Disciplina de trabalho item 1) ao investigar o que
realmente falta no V-MAX antes de fechar #82: várias entradas deste
handbook (§6.42, e uma reconfirmação posterior "por grep") classificam
Adaptive Zoom como AUSENTE, mas §6.79 já tinha entregue e documentado
"primeira fatia real" (`EnhancedChart_110_Percent.tsx`:
`smartZoomPendingRef`/`SMART_ZOOM_CANDLES`/`SMART_ZOOM_RIGHT_PAD_BARS` —
reenquadra as últimas 120 velas + 6 de folga ao trocar symbol/timeframe,
nunca sobre dado velho, nunca em tick) e §6.42/§221 outro ângulo
(`nexus/chart-viewport.ts`, janela de candles adaptativa). Confirmado
por grep direto nesta rodada: ambos os arquivos e símbolos continuam
reais no código atual, não regrediram. Estado real, honesto: **PARCIAL**
— reenquadre automático funciona na troca de contexto; o que
genuinamente falta (zoom reativo contínuo a volatilidade/regime, fora de
uma troca de symbol/timeframe) nunca foi construído nem prometido, e não
foi tentado nesta rodada (escopo novo de motor, pesquisa própria, fora
do que esta rodada já grande comporta com segurança).

**5. Auto Layout (Etapa 18, #240) — fechamento honesto de escopo**:
`scripts/audit-header-maxcontent.mjs` (11 viewports reais, iPad→
ultrawide) cobre 3 superfícies reais com fixture de PIOR CASO de
conteúdo (não só estado vazio): TopBar (3 zonas + chips), gaveta Market
Intelligence (MarketDirectionWidget + MarketBiasDecisionCard) e o painel
Síntese Operacional da aba ANALYSIS — correção de registro: entradas
anteriores diziam "TopBar + 1 painel", são na verdade 3 superfícies
distintas, todas com fixture dedicada. O que fica de fora, honestamente:
os demais painéis widget (SYSTEM HEALTH, CouncilWidget, OPORTUNIDADES,
Publication Studio, Chart Layers) usam os MESMOS primitivos responsivos
(`flex`/`overflow-y-auto scrollbar-hide`/`min-h-0`) mas nunca passaram
pelo mesmo script de regressão multi-viewport com fixture de pior caso —
estender o script para cada um exigiria uma fixture bespoke por painel
(o próprio script já mostra o quanto de mutação DOM manual cada
superfície pediu) — escopo real de uma rodada própria, não tentado aqui.
Como este próprio round adicionou 2 Rows novas ao painel SYSTEM HEALTH
(Chart Integrity + Organism Health), a superfície que efetivamente
mudou nesta rodada foi verificada ao vivo (item 2 acima) — não a
totalidade dos painéis, mas a fatia real que este trabalho tocou.

**6. Fechamento de #82**: com os 13 itens nomeados de Etapas 2-15 agora
com estado real e decidido (IMPLEMENTADO: Chart Integrity, Liquidity
Void, ferramentas institucionais, Radar MEXC-wide, Data Quality, Market
Regime→Relevance, Organism Health · PARCIAL com fatia real registrada:
Adaptive Zoom, Auto Layout · RECUSADO com razão registrada: Volume
Clusters, Cross-Timeframe Liquidity, Footprint) — nenhum item
silenciosamente esquecido — a task interna #82 é fechada nesta entrada.
PARCIAL não é IMPLEMENTADO: os 2 gaps nomeados acima (zoom reativo a
volatilidade; cobertura do audit script para os demais painéis)
continuam reais e abertos para uma rodada futura, não fabricados como
concluídos aqui.

**Testes**: `tsc --noEmit` limpo · **165 arquivos / 2643 testes (100%)**
· `npm run build` ok (1869 módulos) · verificação Playwright ao vivo em
2 rodadas (Chart Integrity + Organism Health, dev server real, viewport
430×932 `hasTouch:true`) — únicos erros de console são os já conhecidos
de rede bloqueada pelo proxy do sandbox (WebSocket `forceOrder` para
`fstream.binance.com`), nunca um erro da aplicação.

**Riscos conhecidos**: este sandbox nunca teve egress real para Binance
em nenhuma verificação desta sessão — todo veredito `SYNCED`/`OK` dos 2
motores novos ficou coberto só por teste de execução real (unitário),
nunca visto ao vivo com dado de mercado de verdade; os 2 gaps PARCIAIS
documentados no item 6 continuam reais.

---

### 6.93 Memo de 20 seções ("CALCULAR MUITO. MOSTRAR POUCO. EXPLICAR SOB
DEMANDA.") — mapeamento honesto contra o código real, sem escrever
código ainda (a própria ordem do memo: "MAPEAR. Depois: POC. Depois:
BENCHMARK. Somente então integrar." / "EXECUTAR EM ETAPAS. NÃO FAZER
BIG-BANG.")

Pedido do Operador: memo de 20 seções (Lightweight Charts como engine
único, Visual Intelligence Layer entre Decision Engine e o gráfico, modo
padrão enxuto, progressive disclosure, Evidence Graph, Five Pillars,
semântica de RISK como WARNING não-gate, Web Workers/WASM, Data Fabric,
DuckDB-WASM para histórico/replay, IA auxiliar via ONNX/Transformers.js,
WebGPU opcional, disciplina iPad-first, orçamento visual, anti-colisão,
zero look-ahead, suíte de testes com benchmark de candles, regra de
não-regressão, processo MAPEAR→POC→BENCHMARK→integrar). Zero código
alterado nesta rodada — só auditoria, conforme o próprio processo que o
memo pede.

**Precedente direto, não redescoberto do zero**: a Diretriz Nº 02
(`docs/historico/RELATORIO_DIRETRIZ_02_INTELIGENCIA_VISUAL.md`) já pediu
quase o mesmo pipeline (`Motores → Knowledge Graph → Evidence Fusion
Engine → Quality Governor → Meta Engine → Core Engine → Visual
Intelligence Layer → Gráfico`) e decidiu, com razão documentada, **não**
tentar a inversão completa numa rodada (alto blast-radius: tocaria os
12+ plugins de canvas + `EnhancedChart_110_Percent.tsx` inteiro de uma
vez, baixíssima reversibilidade) — construiu só a peça concreta e segura
(`nexus/visual-budget.ts`, isolado, **nunca ligado a nenhum componente
vivo até hoje**: confirmado de novo nesta auditoria, zero import fora do
próprio teste). Esse relatório continua a referência viva sobre por que
a inversão completa não foi tentada — nada neste memo novo invalida esse
raciocínio; pelo contrário, o próprio memo pede a mesma cautela
("não fazer big-bang").

**O que mudou desde a Diretriz Nº 02**: `nexus/evidence-fusion.ts` foi
construído (Carta Branca, §6.7x-6.8x) — consumidor real de
`engine-signal-contract.ts` (Conselho + Zonas Institucionais), mas
**estritamente não-direcional**: mede cobertura/consenso/dispersão sobre
a evidência agregada, nunca combina em score ou direção (LEI 24 intacta
por construção, não por convenção). Ainda não é o "Evidence Graph" com
dependências `source → engine → signal → pillar → decision` que este
memo novo pede — é o degrau anterior (agregação plana, sem grafo de
dependência nem pilares nomeados).

**Correção sobre a própria auditoria acima, feita minutos depois de
escrita (erro meu, não do código)**: a frase logo acima ("`visual-
budget.ts`... nunca ligado a nenhum componente vivo até hoje: confirmado
de novo nesta auditoria, zero import fora do próprio teste") estava
**errada** — baseada só no que o relatório da Diretriz Nº 02 dizia na
época, sem grep fresco contra `EnhancedChart_110_Percent.tsx` antes de
afirmar "confirmado de novo". `resolveVisualBudget` está, de fato,
importado e ativo lá (linha ~2275), com `docs/historico/
RELATORIO_ORDEM_03_IMPLEMENTACAO_OPERACIONAL.md` e `RELATORIO_ORDEM_04_
CONSOLIDACAO.md` documentando a graduação real: 4 das 7 categorias
declaradas em `VISUAL_BUDGET_PRIORITY_ORDER` já têm candidato real e
competem por orçamento visual ao vivo — `INSTITUTIONAL_ZONE` (Zonas
Institucionais), `TRADE_PLAN` (zona do plano), `STRUCTURE` (BOS/CHOCH,
S1/R1, Fibonacci) e `MAIN_LIQUIDITY` (FVG/Order Block não-obstáculo). As
3 restantes (`TARGET`, `INVALIDATION`, `RADAR`) ficaram deliberadamente
de fora, com razão técnica real documentada no §4 do Ordem Nº 04 (não
esquecimento): `TARGET`/`INVALIDATION` não têm hoje uma fonte de peso
PRÓPRIA e isolada por objeto individual (TP1/TP2/TP3, linha de STOP) —
`TradePlanZonePlugin.tsx` trata o plano inteiro como uma zona única, já
graduada; inventar peso por alvo individual sem uma fonte real seria a
fabricação que a Regra de Ouro 2 proíbe. `RADAR` não tem hoje um objeto
visual próprio desenhado no canvas do gráfico (vive em painel separado)
— graduar exigiria construir um objeto novo só para a categoria, não
uma consolidação do que já existe. As linhas 2 e 14 da tabela abaixo
foram corrigidas para refletir este estado real — nenhuma outra linha
desta tabela foi re-verificada por este mesmo erro, mas cada uma cita
sua própria evidência (arquivo/grep), não memória.

**Mapeamento por seção, evidência real (não memória):**

| # | Seção do memo | Estado real |
|---|---|---|
| 1 | Gráfico (Lightweight Charts, Primitives) | Mantido, sem substituição cogitada. Uso de Primitives modernas (Series/Pane Primitives) não auditado plugin-a-plugin nesta rodada — a maioria dos ~14 plugins de canvas usa a API de `addSeries`/canvas overlay clássica, não as Primitives novas da lib; migração seria uma auditoria própria. |
| 2 | Visual Intelligence Layer | **Parcial, disperso, não consolidado — mas mais real do que a auditoria inicial (corrigida acima) reconheceu.** `layer-relevance.ts` (mostra/esconde camada) + `visual-budget.ts` (**ativo ao vivo, 4/7 categorias**, ver correção acima) + `chart-layer-depth.ts` (profundidade) já fazem, cada um separadamente, uma fatia real do que o memo pede como camada única — nenhuma delas é código morto. Falta só o NOME/módulo consolidado, não a função. |
| 3 | Modo padrão do gráfico | **Já é a direção que a sessão vem tomando** (§29/§30 desta PR: declutter da navegação, correção de sobreposição) mas o memo pede uma lista literal fixa (candles/volume/estrutura/traço roxo/FVG-OB relevantes/Trade Plan/invalidação/decisão/1 seta) que hoje **não é o padrão real** — `layer-relevance.ts` decide dinamicamente por relevância, não por uma lista fixa deste tamanho. Divergência real a resolver com decisão explícita (é isto que o memo pede, ou é a relevância dinâmica que já existe?). |
| 4 | Progressive disclosure (LABORATORY) | Existe em espírito (`ChartLayersPanelContent`, "Estado Inteligente Adaptativo", resumo por padrão + controle completo 1 clique abaixo) mas sem o vocabulário "LABORATORY" nem o ciclo explícito ativação→visualização→fechamento→retorno. |
| 5 | Evidence Graph | **Gap real.** `engine-signal-contract.ts` + `evidence-fusion.ts` existem mas são agregação PLANA (contagens/cobertura), não um grafo com dependências nomeadas nem pilares. `fractal-swings.js` (a atenção especial que o memo pede) já é módulo único compartilhado por 17+ consumidores reais (`research/engines/*`, `nexus/*`, `engine-bridge.ts`) — a preocupação do memo ("não duplicar") já está satisfeita na prática, mesmo sem um Evidence Graph formal por cima. |
| 6 | Five Pillars | **Nome não existe no código.** O que existe é `council.ts` — 7 agentes (Liquidity/Structure/Orderflow/Risk/Manipulation/Fibonacci/Momentum), categorização diferente dos 5 pilares nomeados pelo memo (STRUCTURE/LIQUIDITY/MOMENTUM/CONTEXT/RISK). `docs/SYSTEM_HANDBOOK.md §7` já tem uma tabela A-E (DIREÇÃO/ESTRUTURA/TIMING/RISCO/CONTEXTO) que é a peça mais próxima — também não os mesmos 5 nomes. Formalizar os Five Pillars exigiria decidir explicitamente se substituem, resumem ou coexistem com essas duas classificações já reais — decisão de arquitetura, não implementação mecânica. |
| 7 | Risk (WARNING ≠ gate) | **Já correto hoje.** `RR_QUALITY_FLOOR = 2` (`nexus/rr-quality.ts`) é usado como sufixo textual de aviso (`rrFloorSuffix`), nunca bloqueia a leitura do Núcleo — confirmado por grep, nenhum consumidor usa o piso como gate de decisão. |
| 8 | Performance (Workers/WASM) | **Já real.** 4 Workers dedicados (`llm-worker.ts`, `backtest-worker.ts`, `orderflow-heatmap-worker.ts`, `conviction-cyclone-worker.ts`) + `quant-worker.js` (estático, servido em produção) + WASM real (`cyborg_quant_core.wasm`/variante SIMD) para Volume Profile/TrustScore (Regra de Ouro 6 do CLAUDE.md, já não-negociável). Benchmark formal de FPS/latência/CPU por contagem de candles (item 17 do memo) não existe como suíte própria. |
| 9 | Data Fabric | **Já é a arquitetura real** — `market-data-bus/` como fonte canônica por `symbol:timeframe`, WS como caminho principal (§20 desta mesma PR: migração Spot→Futures), REST reservado a bootstrap/histórico/reconciliação. Já documentado em `docs/MARKET_DATA_FABRIC.md`. |
| 10 | DuckDB-WASM | **Ausente, e o memo já concorda que deve ficar assim até POC.** Zero presença no repositório. Nenhuma ação requerida agora — é exatamente o que o memo pede ("não introduzir ainda sem benchmark"). |
| 11 | IA (ONNX/Transformers.js) | **Ausente.** O único caminho de IA hoje é `llm-bridge.ts`/`llm-worker.ts` via `@mlc-ai/web-llm` (Llama 3 local, WebGPU) para síntese tática em linguagem natural — opt-in, isolado, nunca gera LONG/SHORT (mesma linha vermelha que o memo pede). ONNX Runtime Web/Transformers.js seriam um caminho PARALELO para classificação/resumo, não construído. |
| 12 | WebGPU | **Parcial.** Já usado, mas só dentro do caminho do LLM (`llm-worker.ts`, `voice-dispatcher.ts`, `synthetic-reading.ts`) — não existe hoje uma arquitetura "GPU-ready" genérica para o motor quantitativo, com WASM como fallback formal. |
| 13 | iPad-first | **Disciplina permanente já real** — Regra de Ouro 7 do CLAUDE.md (60 FPS, zero scroll de página), testado em Chromium com viewport iPad Pro 11" em múltiplas rodadas desta sessão (§4, §27, §29 desta PR). Nunca testado em dispositivo físico. |
| 14 | Visual Budget | **Já existe, já com o nome certo, e já ativo ao vivo** — `nexus/visual-budget.ts`, graduado (Ordem Nº 03/04) para 4 das 7 categorias declaradas; as 3 restantes ficaram de fora por falta real de fonte de peso individual (`TARGET`/`INVALIDATION`) ou de objeto visual próprio (`RADAR`), não por esquecimento. |
| 15 | Anti-colisão | **Já real e maduro** — `price-label-stack.ts`, usado por 10+ famílias de rótulo (S1/R1/VWAP/NL/EMA/TREND/ENTRY/STOP/TARGET/CHOCH e mais), extensivamente testado ao longo desta sessão inteira (§10-§13, §25-§27 desta PR). |
| 16 | Zero look-ahead | **Já é princípio testado** — `structural-backtest.js` (walk-forward, 521 janelas), `structural-swings-trace.test.ts` (zero-look-ahead explícito), replay sem look-ahead documentado em §6 deste handbook. |
| 17 | Testes (benchmark de candles) | **Fechado nesta mesma rodada (Stage 1, carta branca) — `tools/benchmark-chart-render.mjs`.** Mede o `createChart`+`addSeries(CandlestickSeries)` REAL (mesma chamada de `EnhancedChart_110_Percent.tsx`) em 500/1k/5k/10k candles sintéticos: setData(ms), FPS real por amostragem de `requestAnimationFrame`, p95 de frame, heap JS. Rodado de verdade neste sandbox (Chromium via Playwright, já disponível no ambiente): 58-60 FPS em todas as contagens, p95 de frame ~16.7-16.8ms (teto real de 60Hz), heap subindo linearmente 4,3MB→21,5MB. Limitação honesta, documentada no próprio script: Chromium headless aqui, não Safari/iPad real; só a série de candles, sem os ~14 plugins de overlay; execução única, sem repetição estatística. |
| 18 | Não-regressão (Core/Decision/Risk/Evidence Graph semantics) | Já é a disciplina de fato desta sessão inteira (LEI 24, "execute somente esta alteração", citado literalmente em §23/§28 desta PR) — nunca formalizado como checklist único. |
| 19 | Processo (MAPEAR→POC→BENCHMARK→integrar) | **Esta entrada é exatamente isso** — o mapeamento, sem código. |
| 20 | Princípio final | Já é o vocabulário real desta sessão (Regra de Ouro 2/3, LEI 24, "declaração ≠ realidade") só sem o slogan "CALCULAR MUITO. MOSTRAR POUCO." |

**Stage 1 escolhido e executado nesta mesma rodada, sob carta branca do
Operador**: entre as candidatas (graduar `visual-budget.ts` — já feita,
ver correção acima; consolidar a Visual Intelligence Layer nomeada; POC
de DuckDB-WASM; benchmark formal de candles/FPS), escolhi o benchmark
(item 17) — menor risco real (zero código de produção tocado, ferramenta
de bancada isolada fora de `npm run verify`/CI) e o único que produz dado
que as outras decisões (consolidar a camada, avaliar DuckDB-WASM/WebGPU)
vão precisar depois. Ver linha 17 da tabela acima e `tools/benchmark-
chart-render.mjs` (+ `tests/benchmark-chart-render.test.ts`, 6 testes de
execução real para o gerador de candles sintéticos). Próximo passo real
ainda em aberto: consolidar a Visual Intelligence Layer nomeada, ou POC
isolado de DuckDB-WASM — nenhum dos dois tentado nesta rodada.

---

### 6.94 "ORDEM 2 — FUTURE MAP / TRADE PLAN / REVERSAL ENGINE" (29 seções)
— mapeamento honesto + `trade-plan-view.ts` (compositor puro, zero motor
novo)

Pedido do Operador: memo de 29 seções pedindo a camada de análise
OPERACIONAL do AR10 (companheira do memo de 20 seções da §6.93, que era
sobre a camada visual) — Trade Plan unificado (DIRECTION/ENTRY/
INVALIDATION/T1-T3/REVERSAL ZONES/CONFIDENCE STATE/SCENARIO/STATUS),
Future Path Engine, Reversal Engine (3 tiers), Liquidity Map ranqueado,
Trade Semantics (`DIRECTION != ENTRY`, `ENTRY != CURRENT PRICE`
automático), P1 Five Pillars, P3 Evidence Graph, cenários BASE/
ALTERNATIVE/INVALIDATION, zero look-ahead, hierarquia visual, testes
obrigatórios. Regra explícita: *"O objetivo NÃO é criar um indicador
novo... reutilizar os componentes existentes"* (§2) — a mesma disciplina
de auditar antes de construir que já rege este projeto inteiro.

**Achado central: a maior parte já existe, sob vocabulário diferente —
auditoria seção-a-seção, arquivo por arquivo, nunca por memória:**

| Seção da Ordem 2 | Estado real |
|---|---|
| §17 Purple Structural Trace | **JÁ CONSTRUÍDO, exatamente como pedido** — `StructureTracePlugin.tsx` (§23 da PR #16 desta mesma sessão, "MD-7 Visual Confidence Trace"): linha fina, cor `projection`, pivôs fractais CONFIRMADOS (`fractal-swings.js`), nunca um 2º ZigZag. |
| §18 Direction Arrow | **JÁ CONSTRUÍDO, exatamente como pedido** — `ConfidenceDirectionArrowPlugin.tsx` (mesma §23): LONG↑/SHORT↓/WAIT=nada, deliberadamente na posição OPOSTA de `plan-markers.ts` para nunca ser confundida com ENTRY — "DIRECTION ≠ ENTRY" já é comentário literal no código. |
| §3/§8 Trade Semantics (`NOT_DEFINED`/`MARKET`/`LIMIT`/`TRIGGER`) | **Já resolvido, com vocabulário diferente — construir um 2º classificador duplicaria.** `deriveEntryState()` (`operational-readability.ts`) já responde exatamente "existe confirmação de timing AGORA?" a partir de preço-dentro-da-zona-real-ou-não: `ENTRY_CONFIRMED`≈MARKET, `WAITING_FOR_RETEST`≈LIMIT, `NO_ENTRY`/`ENTRY_INVALIDATED`≈NOT_DEFINED. `TRIGGER` não tem análogo real: `trade-plan.ts` só constrói entradas do lado de PULLBACK (suporte para LONG/resistência para SHORT), nunca do lado de rompimento — não fabricado. |
| §4 Trade Plan (forma única) | **Ingredientes reais existem em 5 sistemas separados, nunca compostos numa view única** — `trade-plan.ts` (direction/entry/stop/targets/R:R reais), `signal-track-record.ts` (status de ciclo de vida), `scenario-engine.ts` (pathA/pathB com invalidation embutida), `reversal-detector.ts` (leitura de reversão), `institutional-score.ts` (confiança qualitativa). Fechado nesta rodada — ver abaixo. |
| §11 Cenários BASE/ALTERNATIVE/INVALIDATION | **Já existe, nome diferente** — `scenario-engine.ts`'s `pathA`/`pathB`, cada `ScenarioPath` já carrega `invalidation` (nível real) embutido — nunca um 3º objeto separado. |
| §12 Probabilidade qualitativa | **Já correto hoje** — `institutionalConfidenceZone()` banda o score real 0-100 em 5 tiers (MUITO_FORTE/FORTE/MODERADA/FRACA/INVALIDA), nunca uma % fabricada (Regra de Ouro 2 já em vigor). |
| §15 Zero look-ahead | **Já é princípio testado** — mesma cobertura já citada na §6.93 (walk-forward real, `structural-swings-trace.test.ts`). |
| §25 Não alterar o homologado | **Já é a disciplina real desta sessão inteira** (LEI 24, "execute somente esta alteração" — citado literalmente §23/§28 da PR #16). Nada em `trade-plan-view.ts` toca Core Engine/Decision Engine/Risk architecture. |
| §6 Reversal Engine (3 tiers: REACTION ZONE/REVERSAL WATCH/CONFIRMED REVERSAL) | **Parcial — só o tier mais forte existe.** `reversal-detector.ts` já produz uma leitura real de reversão CONFIRMADA (CHoCH real ou flip real do SuperTrend, nunca BOS — que é continuação, não reversão) e já está graduado (`App.tsx`, linha ~2351). REACTION ZONE (antes de qualquer rompimento) e REVERSAL WATCH (alerta antecipado) exigiriam lógica de proximidade NOVA — que nível? que limiar de distância? — gap real, não inventado nesta rodada para não fabricar um piso sem justificativa (Regra de Ouro 2). |
| §7 Liquidity Map (ranking BUY/SELL-SIDE, EQH/EQL, stop clusters) | **Parcial.** `selectSharedZoneHighlights()` (`liquidity-significance.ts`) já ranqueia por significância real (`SHARED_ZONE_HIGHLIGHT_SLOTS=3`) — mas para zonas Order Block/FVG, não especificamente EQH/EQL/liquidity pools que a Ordem pede. Gap real, não fechado. |
| §13 P1 Five Pillars (nomes exatos STRUCTURE/LIQUIDITY/MOMENTUM/CONTEXT/RISK) | **Nome formal ainda não existe** (mesmo achado da §6.93) — `council.ts` tem 7 agentes com categorização diferente; `SYSTEM_HANDBOOK.md §7` tem uma tabela A-E também diferente. Decisão de arquitetura (substituir? resumir? coexistir?), não mecânica. |
| §14 P3 Evidence Graph (genealogia, "quantas fontes realmente independentes") | **Parcial, mais alinhado do que a §6.93 tinha percebido.** `evidence-fusion.ts` já EXCLUI deliberadamente o Scenario Engine como fonte própria porque `ScenarioPath.opinionWeight` já é a MESMA massa de opinião do Conselho — exatamente o "não contar a mesma fonte duas vezes" que a Ordem 2 §2/§14 pede. Ainda não é um grafo com dependência NOMEADA (`source → engine → signal → pillar → decision`) — continua agregação/contagem, não uma estrutura de grafo navegável. |

**Solução aplicada — Stage 1, escolhido por ser o de menor risco real
entre os candidatos (mesma disciplina de "carta branca, nunca big-bang"
já estabelecida na §6.93):** `nexus/trade-plan-view.ts` (novo, puro,
Laboratório de Evolução — isolado, zero import por nenhum componente
vivo, confirmado pelo build idêntico: mesmos 1937 módulos, mesmos bytes
de bundle antes/depois). `composeTradePlanView()` é PURAMENTE um
compositor — nenhum campo é calculado, cada um é passthrough real ou
mapeamento de enum já existente: `entry`/`invalidation`/`targets`/`R:R`
vêm direto de `TradePlan`; `status` resolve entre `TrackedPlanStatus`
(plano já aberto) e `NexusSetupState`/`NexusEntryState` (antes de existir
plano) — nunca os dois ao mesmo tempo; `confidenceState` é o tier
qualitativo real de `institutionalConfidenceZone()`; `reversal` é
passthrough integral de `ReversalReading`, nunca reinterpretado num tier
mais fraco; `scenario.base`/`scenario.alternative` escolhem entre
`pathA`/`pathB` pela direção real do plano (ou a convenção real de
`scenario-engine.ts` quando não há plano ainda).

22 testes de execução real (`tests/trade-plan-view.test.ts`): os 6
valores de `status` cobertos por transição real (incluindo "plano real
existe mas 1º ciclo ainda sem tracked status → ACTIVE, nunca WAIT");
passthrough real de entry/invalidation/targets; os 5 tiers de confiança
+ `DADOS_INSUFICIENTES` honesto; passthrough por identidade de
`ReversalReading`; resolução de BASE/ALTERNATIVE para LONG e para SHORT
+ a convenção real sem plano; pureza (mesma entrada → mesma saída, nunca
muta o `TradePlan` recebido); contrato versionado.

**O que este round honestamente NÃO fez, do memo maior:** graduar
`trade-plan-view.ts` a um painel/canvas visível (fica Laboratório de
Evolução, mesma disciplina de `visual-budget.ts` antes de sua própria
graduação, §6.93) — próxima rodada, com sua própria verificação visual;
Future Path Engine (§5, projeção visual discreta do caminho — maior,
toca desenho no gráfico); Reversal Engine com os 3 tiers completos (§6,
gap real registrado acima); Liquidity Map EQH/EQL ranqueado (§7, gap
real registrado acima); Five Pillars/Evidence Graph formais (§13/§14,
decisão de arquitetura, não mecânica).

`npm run verify`: **256 arquivos / 4385 testes**, tsc limpo, build
idêntico em módulos/bytes ao commit anterior — confirmando isolamento
real, não só declarado.

> **Graduação (03/09/2026, pedido direto do Operador: "gradue os dois"):**
> `trade-plan-view.ts` deixou de ser Laboratório de Evolução.
> `composeTradePlanView()` está ligado ao ciclo real dentro de
> `SecondaryModuleView` (aba ANALYSIS) — cada input já é uma leitura já
> exibida em outro painel desta mesma view (`tradePlan`/`trackRecord.active`/
> `scenario`/`institutionalScore.score`/`reversalAlert`), e o único campo
> genuinamente novo na tela é `status` (`ModuleStat label="Status"`, painel
> "Trade Plan"), que resume ACTIVE/TARGET_REACHED/INVALIDATED/etc. num só
> lugar em vez de o Operador combinar 3 painéis mentalmente. Verificado ao
> vivo via Playwright (dev server real): a aba ANALYSIS renderiza sem
> crash e sem erro novo de console — mas o campo `Status` em si nunca foi
> visto renderizado com um `TradePlan` real neste sandbox (zero egress,
> então nunca há plano real aqui); a lógica está coberta por 22 testes de
> `composeTradePlanView()` + 5 testes novos de fiação
> (`trade-plan-view-graduation-wiring.test.ts`). Ainda NÃO fez: Future
> Path Engine, Reversal Engine com os 3 tiers, Liquidity Map EQH/EQL,
> Five Pillars/Evidence Graph — os mesmos gaps de antes, inalterados por
> esta graduação.

---

### 6.95 "ORDEM 3 — PROFESSIONAL MARKET TERMINAL" (37 seções) —
mapeamento honesto + `terminal-event-log.ts`, compositor puro sem motor
novo

Terceira ordem da mesma família (memo de 20 seções §6.93; Ordem 2 de 29
seções §6.94) — desta vez sobre o TERMINAL em si: multi-asset,
multi-timeframe, context-aware, um único `MARKET SNAPSHOT`/`ANALYSIS
SNAPSHOT` por symbol:timeframe:timestamp, isolamento arquitetural entre
ativos/timeframes, Terminal Header/Chart Header com status real, Terminal
Event Log, Layer Trace, state machine formal, audit trail, testes
extensivos (troca de ativo/timeframe, race condition, cache
contamination), responsividade iPad, performance.

**Achado central, auditoria arquivo-a-arquivo (nunca por memória):** a
maior parte da visão desta Ordem já existe — e mais madura do que a
suposição inicial de "terminal cripto simples" sugeriria.

| Seção da Ordem 3 | Estado real |
|---|---|
| §2/§27 Symbol Selector / Universal Asset Contract | **Já existe, multi-asset-class de verdade.** `src/market-data-bus/instrument-registry.js` (392 linhas) — catálogo real de futuros CME (EQUITY_INDEX/EQUITY/METALS/ENERGY/RATES/FX, tick size/value pesquisados via WebSearch, nunca inventados) + `marketMode: "CRYPTO" \| "TRADFI"` já real em `App.tsx`, com seletor, sessão persistida, e `tradfi-delayed-connector.js`. Cripto não é a única classe de ativo suportada. |
| §6-8 Market Snapshot / Data Synchronization | **Já é a arquitetura real** — `market-data-bus/bus.js`, fonte canônica por `symbol:timeframe` (já documentado em `CLAUDE.md`). `unified-snapshot-store.ts` (5 domínios: Mercado/Séries/Motores Quant/Cérebro/Organismo) é o "Analysis Snapshot" real, só sem esse nome. |
| §19/§22/§24 Timestamp Integrity / Real Data Status / Latency | **Já existe, vocabulário diferente.** `market-data-bus/quality-engine.js`+`quality-monitor.js`: Data Quality Layer real POR `symbol:timeframe`, 4 dimensões (latência/disponibilidade/consistência/estabilidade) → `QUALITY_CLASSIFICATION` (EXCELENTE/SAUDAVEL/DEGRADADA/QUARENTENA/DADOS_INSUFICIENTES) — não é literalmente LIVE/DELAYED/STALE/OFFLINE/ERROR, mas cobre a mesma função com mais rigor (score contínuo + circuito de quarentena por sequência de falhas). |
| §20/§21 Multi-Asset/Multi-Timeframe Isolation | **Já corrigido numa rodada anterior, achado real registrado no próprio código.** `App.tsx` (`seriesMatchesTimeframe`, `fetchSymbolData`): comentário explícito ("Diretriz de Evolução Geral do Organismo — auditoria de sincronização") documenta que o guard `cancelled` só cobria troca de ATIVO — trocar de timeframe durante um fetch em voo podia misturar duas grades na mesma série. Já corrigido com captura de `tfNoInicio` antes do await + verificação dupla (ativo OU timeframe mudou) depois — path de rede E path de hidratação do IndexedDB, ambos comparados linha a linha nesta auditoria. `fetchDerivatives` (funding/OI) usa só o guard de ativo, corretamente — funding/OI não dependem de timeframe. |
| §25 Performance Monitor | **Já existe, painel dedicado, já fora da UI operacional** — Widget "SYSTEM HEALTH" (`App.tsx`): saúde do organismo, qualidade do Bus, suficiência de dados, qualidade GMIL, integridade do gráfico, variante WASM, latência do ciclo (rotulada com o timeframe!), FPS real, memória JS — exatamente §25, já separado do painel operacional principal. |
| §29 Terminal + Graph Link | **Já é regra estrutural testada** — `NexusDecision` (`decision-layer.ts`) é a ÚNICA fonte que qualquer consumidor visual lê; "nenhum consumidor visual recalcula direção/entrada/stop/alvo — todos leem o mesmo `NexusDecision`" já é frase literal deste handbook (§2), provada por teste. Chart e terminal divergirem no mesmo snapshot já é estruturalmente impossível, não uma disciplina visual. |
| §18 Layer Trace | **Parcial — infraestrutura real, granularidade menor que a pedida.** `nexus/stage-runner.ts` já expõe `STAGE_ORDER = ["DATA","CORE_ENGINE","COUNCIL","TRADE_PLAN","NEXUS_DECISION"]` (5 estágios, não os 9 da Ordem) com `traceStages()` real; `nexus/self-diagnostics.ts` já consome isso + Health Monitor + Data Quality Layer num relatório sob demanda (`buildDiagnosticReport`/`formatDiagnosticReportMarkdown`, ligado em `App.tsx`). Gap real: não é uma UI expansível camada-por-camada, é markdown gerado sob pedido. |
| §17 Terminal Event Log | **Gap real, fechado nesta rodada (Stage 1) — ver abaixo.** |
| §3 Timeframe Selector (disponibilidade real por ativo) | **Gap real.** Nenhum `availableTimeframes` por instrumento — o seletor assume o mesmo conjunto fixo para todo ativo, nunca consulta a fonte real. |
| §30 Professional State Machine (11 estados nomeados) | **Gap parcial — estados reais existem, espalhados, vocabulário diferente.** `NexusSetupState`/`NexusEntryState` (operational-readability.ts), `TrackedPlanStatus` (signal-track-record.ts), `QUALITY_CLASSIFICATION` (quality-engine.js), `engineStatus: 'ok'\|'error'\|'pending'` — nenhum se chama `INITIALIZING`/`SYNCING`/`SIGNAL_DEVELOPING` etc., e unificar sob um único enum arrisca duplicar o que já existe (mesmo risco já registrado na §6.94 para Five Pillars) — não tentado nesta rodada. |
| §31 Audit Trail | **Parcial.** `TrackedPlan.contextAtOpen` (signal-track-record.ts) já congela score/regime/VWAP/Nexus Line no instante da abertura — reconstrução parcial real. Não existe uma trilha completa ligando evidência→motor→decisão por decisão individual (isso é o mesmo Evidence Graph com genealogia já registrado como gap na §6.94). |

**Solução aplicada — Stage 1:** `nexus/terminal-event-log.ts` (novo, puro,
Laboratório de Evolução — isolado, build idêntico ao commit anterior).
Fecha o gap mais concreto e explicitamente exemplificado da Ordem (§17,
com formato literal no próprio texto: `"12:43:21 [MARKET] BTCUSDT 5m
snapshot updated"`). Descoberta que tornou isto possível sem inventar
nada: `nexus/event-bus.ts` já é um `TypedEventBus` real com 22 tipos de
evento REAIS, publicados hoje por `OrganismOrchestrator`/Health
Monitor/CrossExchangeService (o próprio arquivo documenta, por auditoria
anterior, que só os 3 eventos `DATA.*` não têm publicador vivo ainda,
porque `cross-exchange-service.ts` não é iniciado nesta fase — decisão
deliberada, não esquecimento). `formatTerminalLogEntry()` não fabrica
nenhuma mensagem: cada linha é um `switch` sobre o tipo real do evento,
lendo só campos que o payload real já carrega — payload nulo vira
"cleared"/"unavailable" honesto, nunca um valor inventado.
`appendTerminalLogEntry()` é o ring buffer real (piso de 200 entradas,
convenção declarada, mesma natureza de outros pisos deste repositório).

15 testes de execução real (`tests/terminal-event-log.test.ts`): o
exemplo literal da própria Ordem (`DATA.CANDLES_UPDATED` → "BTCUSDT 5m
snapshot updated"); cada categoria mapeada a partir do NOME real do
evento (nunca uma reclassificação por conteúdo); payload nulo → mensagem
honesta em 3 famílias diferentes de evento; array real contado, nunca
redigitado; `HEALTH.CHANGED` com campo `null` virando "n/d"; ring buffer
com descarte real das entradas mais antigas, imutabilidade, e fail-closed
em `max` inválido (0/negativo/NaN cai no default, nunca trunca pra
buffer vazio).

**O que este round honestamente NÃO fez:** graduar `terminal-event-log.ts`
a um painel visível (fica Laboratório de Evolução, mesma disciplina de
`visual-budget.ts`/`trade-plan-view.ts` antes de suas próprias
graduações — a próxima rodada assina o `core.bus` de verdade e monta o
painel); `availableTimeframes` por instrumento (§3); state machine
unificada (§30, risco real de duplicar o que já existe sob nomes
diferentes); Layer Trace com a granularidade de 9 estágios pedida (§18,
hoje 5 reais); Audit Trail completo com genealogia por decisão (§31,
mesmo gap do Evidence Graph já registrado na §6.94).

`npm run verify`: **257 arquivos / 4400 testes**, tsc limpo, build
idêntico em módulos/bytes ao commit anterior.

> **Graduação (03/09/2026, pedido direto do Operador: "gradue os dois"):**
> `terminal-event-log.ts` deixou de ser Laboratório de Evolução.
> `TypedEventBus` ganhou `onAny()` (canal aditivo — nunca muda
> `on()`/`emit()`/`clear()` existentes, 7 testes novos em
> `nexus-core.test.ts`) para entregar o `NexusEvent` completo a um único
> assinante. Achado real na hora de graduar: já existia um painel "EVENT
> TELEMETRY" (`EventsWidget`) ligado a `gmilBus`, cobrindo só 2 eventos de
> proveniência GMIL — a graduação certa era ESTENDER esse painel (2ª fonte
> real via `core.bus.onAny()`, formato `[CATEGORIA] mensagem` idêntico ao
> exemplo literal da Ordem), nunca criar um painel/ícone novo (§29 tinha
> acabado de decluttar a régua de navegação). Tom das linhas do Nexus Core
> é sempre "info" (nunca ok/warn/error fabricado — isso é território do
> `alert-center.ts`). Verificado AO VIVO via Playwright (dev server real,
> hash de acesso temporário): linhas reais `[SYSTEM]`/`[DECISION]`/
> `[QUANT]`/`[BRAIN]`/`[ORGANISM]`/`[RISK]` — 7 tipos de evento distintos
> — atualizando em tempo real numa janela de 6 segundos, zero erro de
> página. 9 testes novos de fiação
> (`terminal-event-log-graduation-wiring.test.ts`). Ainda NÃO fez:
> `availableTimeframes`, state machine unificada, Layer Trace de 9
> estágios, Audit Trail completo — os mesmos gaps de antes, inalterados
> por esta graduação. O painel continua oculto por padrão
> (`widgets.events.visible: false`) — precisa do Workspace Manager pra
> ligar, comportamento pré-existente não alterado por esta rodada.

> **Correção honesta do título desta seção + §38-45 mapeadas (03/09/2026):**
> o título acima diz "37 seções" — estava errado. O Operador colou as
> seções §38-45 (RESPONSIVE SIZING/DENSITY CONTROL, iPad Mini, TERMINAL
> DENSITY, CHART-FIRST LAYOUT, ANTI-OVERFLOW, VISUAL ACCEPTANCE,
> DIMENSIONAMENTO FINAL, ACEITAÇÃO VISUAL), provando que a Ordem 3 tem
> pelo menos 45 seções, não 37 — a mesma classe de erro já registrada
> nesta sessão para "32 módulos" (§14 da PR) e "visual-budget.ts nunca
> ligado" (§6.93): uma alegação minha sem remedição contra o dado real.
> Não corrijo o número no título acima (Regra de Ouro 4 — nunca reescrever
> silenciosamente o registro original) — só documento aqui que ele está
> desatualizado.
>
> Mapeamento honesto de §38-45 (auditoria de arquivo, não memória):
>
> | Seção | Estado real |
> |---|---|
> | §38 Responsive sizing (tipografia/spacing) | **Parcial.** `index.css` já tem uma escala `clamp()` de 4 degraus pra TIPOGRAFIA (`--ar10-t-micro/label/body/read`) e `env(safe-area-inset-top/bottom)`. **Gap real:** nenhuma escala `clamp()` equivalente pra ESPAÇAMENTO/padding/gap — são classes Tailwind estáticas, com 52 ocorrências de `h-[Npx]`/`w-[Npx]` hardcoded só em `App.tsx`. Zero `container-type`/`@container` (CSS container queries) em todo o `src/`. |
> | §39 iPad Mini — regra de ouro | **Ausente como caso codificado.** `nexus/chart-viewport.ts` cita "iPad Mini retrato (~700px)" só em comentário — nenhum arquivo trata 768px (a largura CSS real do iPad Mini portrait) como breakpoint/caso distinto em CSS ou TS. A prioridade pedida (gráfico > preço > decisão > trade plan > terminal > detalhes) não existe como regra codificada em lugar nenhum. |
> | §40 Terminal density (COMPACT/STANDARD/EXPANDED) | **Gap real, Stage 1 fechado nesta rodada — ver abaixo.** Antes desta rodada: zero conceito de densidade no código — só um interruptor binário não-nomeado (`min-[1120px]:`, 4+ ocorrências em `App.tsx`). |
> | §41 Chart-first layout | **Parcial.** O mecanismo já É chart-first: `App.tsx:4111` usa `h-[100dvh]` (unidade de viewport dinâmica) com `pt-safe`/`pb-safe`, e o container do gráfico é `flex-1 min-h-0` (cresce pra preencher o espaço restante via flexbox, não um valor fixo). **Gap real:** isso é distribuição IMPLÍCITA do flexbox, não uma fórmula explícita "altura do gráfico = viewport − header − terminal − controles" como a Ordem pede — não há um cálculo nomeado que alguém possa auditar ou testar isoladamente. |
> | §42 Anti-overflow | **Parcial.** `overflow-x`/`overflow-hidden`/`truncate`/`whitespace-nowrap` aparecem 85+ vezes em `App.tsx` e mais 6 arquivos, incluindo `.ar10-scroll-x` documentado em `index.css` como correção real de uma regressão de overflow horizontal anterior. **Gap real:** aplicado ad-hoc por bug encontrado, nunca como disciplina/utilitário sistemático — sem uma varredura dedicada por viewport (iPad Mini/iPad/iPad Pro/desktop, portrait/landscape) que prove ausência de overflow em TODOS os componentes listados pela Ordem. |
> | §43 Visual acceptance / §45 Aceitação visual | **Não verificado.** Nenhum teste (Playwright ou outro) commitado captura screenshots multi-viewport — `package.json` não tem `playwright` como dependência; os harnesses Playwright usados nesta sessão pra outras rodadas (§17/§21/§23/§25/§26/§27/§28/§29/§30/§34/§35) foram sempre ad-hoc, nunca commitados. Critério de aceitação da Ordem (zero sobreposição, zero corte de texto/botão, zero label sobre preço) nunca foi medido sistematicamente. |
> | §44 Dimensionamento final (MIN/PREFERRED/MAX) | **Ausente como método.** Nenhum componente declara MIN/PREFERRED/MAX explicitamente — os 52 `h-[Npx]`/`min-h-[Npx]` de `App.tsx` são valores únicos hardcoded, não uma faixa com 3 pontos nomeados. |
>
> **Solução aplicada — Stage 1, mesma disciplina "carta branca, nunca
> big-bang":** `nexus/density-tier.ts` (novo, puro, Laboratório de
> Evolução — não ligado a nenhum componente ainda). `resolveDensityTier()`
> resolve exatamente o pedido do §40 (COMPACT/STANDARD/EXPANDED, STANDARD
> como padrão/fail-closed) reusando os DOIS limiares que já são reais e
> testados em produção — `1120px` (o interruptor não-nomeado já em
> `App.tsx`) e `1440px` (o piso de `resolveChartUltraWideScale`,
> chart/chart-ultrawide-scale.ts) — zero número novo inventado. 6 testes
> de execução real (`tests/density-tier.test.ts`): fronteiras exatas nos
> dois limiares, larguras de dispositivo reais (iPad Mini 768/1024, iPad
> Pro 834/1194, laptop 1366, desktop 1920, ultrawide 3440), fail-closed
> pra STANDARD em largura inválida (nunca um extremo), monotonicidade
> (aumentar a largura nunca reduz a densidade).
>
> **O que este round honestamente NÃO fez:** o overhaul responsivo em si
> — nenhum componente (HEADER/SYMBOL SELECTOR/TIMEFRAME SELECTOR/CHART/
> PRICE AXIS/TERMINAL/EVENT LOG/ANALYSIS PANEL/TRADE PLAN/LABELS/BUTTONS)
> foi tocado; `resolveDensityTier()` ainda não decide NADA visível. Escala
> `clamp()` pra espaçamento (§38); iPad Mini como caso codificado com
> prioridade de conteúdo (§39); fórmula explícita de altura do gráfico
> (§41); auditoria sistemática de anti-overflow multi-viewport (§42);
> captura de screenshot multi-viewport commitada (§43/§45); MIN/PREFERRED/
> MAX por componente (§44) — todos gaps reais, nenhum fechado nesta
> rodada. Escopo genuinamente maior que um Stage 1 — cada item acima é
> candidato a sua própria sessão.

> **"TERMINAL — VISUAL + INFORMATIONAL INTEGRITY" mapeada + `terminal-field-priority.ts`
> (03/09/2026):** continuação direta da mesma trilha — o Operador colou mais
> uma seção sem numeração explícita, fechando (pelo tom de síntese —
> "CHART-FIRST + TERMINAL-INTEGRITY + RESPONSIVE-SIZING + ADAPTIVE-DENSITY +
> PROGRESSIVE-DISCLOSURE") o mesmo documento que trouxe §38-45. Define a
> hierarquia real de que campo do Terminal sobrevive quando o espaço aperta:
> DECISION > PRICE > TRADE PLAN > INVALIDATION > TARGETS > ESSENTIAL
> EVIDENCE > SECONDARY INFORMATION, com uma regra "NUNCA" explícita (não
> esconder Entry/Invalidation/Targets, não fabricar placeholder no lugar de
> dado real, não sobrepor informação, não encolher texto crítico até
> ilegível). Achado real antes de construir: "Progressive Disclosure" já é
> um termo usado neste repositório (`App.tsx`, Workspace Manager §2) — mas
> pra um mecanismo DIFERENTE (módulos secundários ocultos por escolha do
> Operador, independente do tamanho da tela, trabalho da §29). O uso desta
> seção é disclosure dirigido pelo VIEWPORT — mesma família de padrão de
> UX, nunca o mesmo mecanismo; documentado explicitamente para não
> confundir as duas leituras.
>
> `nexus/terminal-field-priority.ts` (novo, puro, Laboratório de Evolução —
> não ligado a nenhum componente ainda) codifica os 7 tiers na ordem
> literal do texto e consome `resolveDensityTier()` (`density-tier.ts`,
> §36) em vez de reimplementar densidade — `resolveVisibleTerminalFieldTiers()`
> só ativa disclosure em COMPACT, escondendo exclusivamente
> `ESSENTIAL_EVIDENCE`/`SECONDARY_INFORMATION`; os 5 tiers centrais nunca
> saem da lista, em nenhuma densidade. A divisão exata "5 nunca escondem, 2
> compactáveis" é uma LEITURA minha do texto — a regra "NUNCA" nomeia
> Entry/Invalidation/Targets explicitamente (partes concretas de 3 dos 5
> tiers centrais) e DECISION/PRICE são os dois primeiros da própria
> hierarquia — nunca um número dado literalmente no texto, registrado aqui
> como interpretação, não fato. 13 testes de execução real
> (`tests/terminal-field-priority.test.ts`): ordem exata dos 7 tiers,
> visibilidade de cada tier individual, COMPACT vs STANDARD/EXPANDED,
> pureza (nunca muta a lista canônica), preservação de ordem no
> subconjunto visível.
>
> **O que este round honestamente NÃO fez:** nenhum componente real do
> Terminal foi tocado — `resolveVisibleTerminalFieldTiers()` ainda não
> decide nada visível na tela; a divisão 5-vs-2 nunca foi confirmada com o
> Operador, é minha melhor leitura do texto; compactação de espaçamento,
> reorganização de regiões, e a prevenção mecânica de sobreposição/texto
> ilegível (itens do "MAS NUNCA" que são sobre RENDERIZAÇÃO, não sobre
> QUAIS campos aparecem) seguem inteiramente não tentados.

> **"ORDEM — MEXC ASSET DISCOVERY + NATIVE MARKET DATA" +
> "ORDEM — UNIVERSAL ASSET DISCOVERY" (04/09/2026):** duas ordens do mesmo
> pedido — a 2ª chegou logo depois da 1ª e generaliza a mesma exigência
> ("BINANCE CONTINUA, MEXC É ADICIONADA... nunca esconder um ativo só
> porque não existe na Binance") sob o vocabulário de `Universal Asset
> Catalog`/`ExchangeAdapter`. O Operador reforçou o núcleo do pedido em
> mensagem direta, informal: dado público real da MEXC, "mesmo processo"
> já usado pra Binance, "o que precisar" pra analisar — não uma listagem
> cosmética.
>
> **Auditoria antes de construir (CLAUDE.md item 1) — achado real, notícia
> boa:** a maior parte da infraestrutura que as duas Ordens pedem já
> existia, só não estava ligada à seleção do usuário:
> `market-data-adapter.ts` (ADITIVO V-MAX Etapa 1) já é um
> `MarketDataProviderId = 'BINANCE' | 'MEXC' | 'TRADFI_DELAYED'` com
> provider como parâmetro explícito por chamada (nunca um toggle global);
> `mexc-futures-candle-connector.js`/`mexc-futures-public.js` já buscam
> candle real da MEXC (`toMexcSymbol('BTC') → 'BTC_USDT'`); o sufixo de
> cache-key `-MEXC` (vs. `-PERP` da Binance) já existia e já está em uso
> real por `requestRadarCandleSnapshot`/`scanRadarCandidate` (scanner de
> fundo do Radar) há sessões — provando que o par provider+sufixo
> funciona sem colidir Binance/MEXC na mesma chave do Bus;
> `omnibox/mexc-symbols.ts` já busca a lista real de símbolos USDT-M
> Futures da MEXC (`contract.mexc.com/api/v1/contract/detail`) para o
> universo de fundo do Radar. O ÚNICO ponto realmente faltando: nenhum
> desse caminho era alcançável a partir da seleção do Operador
> (`SmartOmnibox`'s `onSelectCrypto: (baseAsset: string) => void` não
> carregava identidade de exchange nenhuma).
>
> **Solução aplicada — Stage 1, "conectar peças já reais, nunca duplicar"
> (Ordem MEXC §15/Ordem Universal §10, mandato explícito de ambas):**
> - `omnibox/universal-symbol.ts` (novo, puro): normaliza
>   `BinanceUsdtSymbol`/`MexcUsdtSymbol` num único
>   `UniversalCryptoSymbol{baseAsset, exchange, market, nativeSymbol}` —
>   `nativeSymbol` preserva o formato real de cada exchange
>   (`"BTCUSDT"` vs. `"BTC_USDT"`, Ordem Universal §7), nunca reconstruído.
>   Escopo honesto: só BINANCE/MEXC (os 2 providers de candle reais hoje —
>   `CryptoExchangeId` é um recorte de `Exchange`, nunca uma união
>   paralela) e só mercado `perp` (mexc-symbols.ts não descobre Spot).
> - `SmartOmnibox.tsx`: novo fetch paralelo e independente
>   (`fetchMexcUsdtSymbols()`, falha isolada — nunca bloqueia/derruba a
>   seção Binance), nova seção "Cripto · MEXC (Tempo Real)", cada item
>   rotulado `"EXCHANGE • MERCADO"` sempre visível (Ordem MEXC §7/§12,
>   Ordem Universal §12 e §5 — mock literal do texto). `onSelectCrypto`
>   mudou de `(baseAsset: string)` para `(selection: UniversalCryptoSymbol)`
>   — única mudança de assinatura, único call site (App.tsx), sem shim de
>   compatibilidade (CLAUDE.md: "mudar o código, não criar atalho").
> - `engine-bridge.ts`: `getMexcChartCandles(symbol, limit, timeframe)` —
>   mesmo contrato exato de `getChartCandles`/`getTradFiChartCandles`,
>   reaproveita `getMarketDataProvider('MEXC')` + sufixo `-MEXC` já real
>   (mesmo par que `requestRadarCandleSnapshot` já prova funcionar).
> - `omnibox/MexcRealChart.tsx` (novo componente, espelha
>   `TradFiRealChart.tsx` byte a byte na disciplina): candlestick real MEXC
>   + badge "MEXC · FUTURES (Tempo Real)" sempre visível, 4 estados
>   honestos (`LOADING`/`OK`/`HISTORICO_INSUFICIENTE`/`DADOS_INSUFICIENTES`
>   — o 3º novo, Ordem MEXC §9/§13/Ordem Universal §9: ativo recém-listado
>   nunca fabrica candle/estrutura, só declara amostra insuficiente).
>   **ZERO import de nexus-core/Council/orderflow** — LEI 24 preservada
>   por construção, mesmo raciocínio exato do precedente TradFi (o
>   Operador pediu para VER/ANALISAR o ativo real, nunca para o Core
>   Engine emitir uma segunda decisão sobre uma fonte nova).
> - `App.tsx`: `marketMode` ganhou um 3º valor (`"MEXC"`, runtime-only —
>   nunca entra em `RestoredSession`/`persistSessionState`: recarregar a
>   página volta pro default CRYPTO/BTC, mesmo fallback já real para
>   qualquer `marketMode` desconhecido) e `selectedMexcAsset` é estado
>   PRÓPRIO, nunca reaproveita `selectedAsset`/`selectedTradFiAsset`
>   (misturar identidade seria o "misturar dado de exchanges diferentes"
>   que as duas Ordens proíbem, §8/§6). **Achado real de auditoria durante
>   a fiação:** ~10 painéis do Terminal (Order Book/Order Flow/Liquidity
>   Map/Council/Siriform/Regime/Score/Expectancy/preço do header/ícone do
>   ativo) liam `selectedAsset`/`data`/`priceData` — todos ainda o ÚLTIMO
>   símbolo Binance real, intocado, quando o modo vira MEXC. Sem gate,
>   esses painéis mostrariam dado Binance estale sob o rótulo de um ativo
>   MEXC diferente — exatamente o "misturar candle de uma exchange com
>   preço de outra como se fosse o mesmo mercado" que a Ordem MEXC §8
>   proíbe explicitamente. Corrigido generalizando o gate que já existia
>   pra TRADFI (`marketMode === "TRADFI" ? <TradFiEmptyState/> : <Real/>`)
>   para `isFullCryptoMode = marketMode === "CRYPTO"` — MEXC e TRADFI
>   ficam do mesmo lado do gate em todo painel Binance-only, com um texto
>   honesto PRÓPRIO (`reason` novo em `TradFiEmptyState`, nunca o texto
>   fixo "Aguardando... Macro API" — seria falso pra MEXC, que está
>   conectada de verdade, só esses painéis específicos não foram
>   estendidos a ela nesta Etapa 1).
>
> **Testes (execução real + padrão):** `universal-symbol.test.ts` (9,
> merge puro), `engine-bridge-mexc.test.ts` (5, mocka só a fronteira
> `market-data-bus/index.js`, mesma convenção de
> `engine-bridge-tradfi.test.ts`), `mexc-real-chart-wiring.test.ts` (12,
> fiação App.tsx↔MexcRealChart↔universal-symbol, inclui a prova de que
> nenhum painel Binance-only escapa do gate) + atualização de 3 testes de
> padrão que quebraram honestamente por causa da mudança real de fonte
> (`header-asset-cluster.test.ts`, `institutional-decision-layer-wiring.test.ts`,
> `refinamento-final-wiring.test.ts`) e 1 de contagem de call site real
> (`diretriz3-fixes.test.ts`: `getMarketDataBus().requestSnapshot()` 3→4
> pontos reais, o 4º é `getMexcChartCandles`, mesmo raciocínio do 3º
> `getTradFiChartCandles`) e 1 de contagem de `<TradFiEmptyState>`
> (`tradfi-real-chart-wiring.test.ts`: 10→11, o 11º é o branch MEXC sem
> ativo selecionado). `npm run verify`: **264 arquivos / 4466 testes**,
> tsc limpo, build ok (1941 módulos, +2 sobre a baseline —
> `universal-symbol.ts`/`MexcRealChart.tsx` agora graduados/ligados).
>
> **O que este round honestamente NÃO fez:**
> - **Verificação ao vivo contra a MEXC real**: nenhuma chamada de rede
>   real foi feita nesta sessão (mesmo bloqueio de política de rede do
>   sandbox de implementação já documentado em
>   `docs/MARKET_DATA_FABRIC.md`) — a Ordem MEXC §19 pede confirmação com
>   ≥3 ativos reais end-to-end; isso só é possível num ambiente com saída
>   de rede liberada (dispositivo real do Operador).
> - **MEXC Spot**: não descoberto (`mexc-symbols.ts` só cobre Futures) nem
>   analisável — Ordem MEXC §6/Ordem Universal §6 pedem Spot e Futures
>   distintos por exchange; hoje só Futures existe dos dois lados
>   (Binance também só oferece Futures como primário, Spot é fallback).
> - **Core Engine/Council/Order Flow/Liquidations/Order Book real**: NUNCA
>   estendidos à MEXC — permanecem 100% Binance, LEI 24 intacta por
>   construção (MexcRealChart nunca importa essas camadas). Isto é
>   deliberado, não esquecido: estender o ciclo de decisão real para uma
>   segunda fonte é uma mudança arquitetural maior que este Stage 1, e o
>   precedente do Footprint recusado (commit `5454194`, tick MEXC Spot
>   rejeitado para Footprint por atribuição cross-exchange incorreta) já
>   estabeleceu que misturar fontes no caminho de decisão real exige muito
>   mais cuidado do que uma tela de leitura.
> - **Persistência IndexedDB (`nexus/persistence.ts`)**: `candleKey` não
>   ganhou sufixo de exchange — `selectedMexcAsset` é runtime-only nesta
>   Etapa 1 (mesmo escopo que `TradFiRealChart` já tinha: não persiste),
>   então o risco de colisão Binance/MEXC no cache do IndexedDB
>   identificado na auditoria fica latente e sem exercício real ainda,
>   documentado aqui para quem estender a Etapa 2.
> - **Auto-detecção de novas listagens MEXC (Ordem MEXC §10/Ordem
>   Universal §4/§11, "atualização automática do catálogo")**: nenhum
>   polling/cadência nova foi criada — o Omnibox busca a lista real uma
>   vez por abertura (mesmo padrão já real da seção Binance), nunca em
>   segundo plano. Um ativo recém-listado na MEXC aparece assim que a
>   MEXC o retornar no `contract/detail` e o Operador abrir/reabrir o
>   Omnibox — não instantaneamente via push/poll de fundo.
> - **`ExchangeAdapter` formal (Ordem Universal §10)**: não construída
>   como abstração nomeada — `MarketDataProviderId`/`getMarketDataProvider()`
>   já cumpre o papel real (provider por parâmetro explícito, zero
>   `if exchange === MEXC` espalhado), só nunca foi batizado com esse nome
>   exato; renomear/formalizar fica para quando um 4º provider real
>   (Bybit/OKX/Hyperliquid) precisar do mesmo padrão.

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
