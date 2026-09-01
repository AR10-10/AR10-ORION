# AR10 CYBORG — Mapa de Evolução do Organismo

**Fotografia de**: 2026-09-01 (2ª revisão, mesmo dia) · **Criado em**: 2026-07-27 ·
**Escopo**: `ipad_runtime/` (read-only, USDT-M Futures/Perpétuo) ·
**Pedido de origem**: Operador — "mapeia tudo que tem de ser feito e a
evolução de todos os sistema do ciborgue".

> **Revisão de 2026-09-01 — por que ela existe (1ª rodada).** Este documento
> se declara uma FOTOGRAFIA, e a nota de manutenção no rodapé manda
> refrescar a tabela "nunca deixe uma classificação ficar sabidamente
> errada". Ele tinha derivado por 5 semanas: dizia 21 camadas de gráfico
> quando existem 30, classificava como PARCIAL/AUSENTE três subsistemas que
> foram concluídos desde então, e listava como pendente um item de backlog
> que já estava entregue. Cada linha abaixo marcada "(revisão 2026-09-01)"
> foi conferida contra o código por `grep`/contagem real nesta sessão, nunca
> de memória — as contagens vêm das guardas de teste que travam esses mesmos
> números.
>
> **2ª rodada, mesmo dia — pedido do Operador: "continue, ver tudo que tem
> de ser feito... cada milímetro".** A fotografia da 1ª rodada já estava
> parcialmente velha de novo: 5 commits picaram depois dela (a fronteira do
> eixo de preço, o z-index do canvas nativo, a correção de duas camadas mal
> classificadas, Andrews Pitchfork graduado). Linhas marcadas
> "(revisão 2026-09-01, 2ª rodada)" são desta passada. É o mesmo padrão
> registrado no rodapé: a fotografia derivou de novo em poucas horas, não em
> semanas — a disciplina de refrescar não é uma tarefa de uma vez, é
> recorrente por natureza.

## O que este documento É e o que ele NÃO É

- **NÃO é** o `docs/ELITE_TRADING_RESEARCH_MAP.md` — aquele documento
  pesquisa o **ecossistema externo** (TradingView, MQL5, GitHub OSS,
  papers) e pergunta "o que existe lá fora que o AR10 poderia aprender".
- **É** o inverso: um raio-X **interno** — todo subsistema real que já
  existe neste repositório, classificado pelo estado real de
  implementação, mais o backlog do que falta, consolidado num só lugar.
  Onde os dois se cruzam (ex.: um item do backlog nasceu de uma
  comparação externa), este documento referencia a seção correspondente
  do research map em vez de duplicar o texto.
- É uma **fotografia**, não um log cronológico — para o histórico
  completo de como cada peça chegou ao estado atual (achados, decisões,
  riscos, testes de cada rodada), a fonte de verdade continua sendo
  `docs/SYSTEM_HANDBOOK.md` §6 (que só cresce, nunca é reescrito). Este
  mapa refresca a tabela de auditoria mais recente (`SYSTEM_HANDBOOK.md`
  §6.42, "EPC OMEGA FINAL — Etapa 1") com tudo que mudou desde então, e
  organiza o que sobrou em um backlog priorizado único — hoje ele existia
  espalhado entre §6.42, o research map §10-12 e a lista de subitens da
  task interna "ADITIVO V-MAX Etapas 2-15".
- Vocabulário de estado (mesmo de §6.42, closed vocabulary, sempre com
  evidência): **IMPLEMENTADO** · **PARCIAL** (existe, mas com um gap real
  e nomeado) · **AUSENTE** (zero ocorrência no código) · **RECUSADO**
  (avaliado e descartado deliberadamente, com razão registrada — não é a
  mesma coisa que AUSENTE, que só significa "ainda não construído").
- **Também NÃO é** o `docs/historico/AUDITORIA_CONSOLIDACAO_EVOLUCAO.md` — aquele
  documento é o registro de UMA rodada específica de auditoria profunda
  (duplicação/gargalos de código, censo visual completo, sincronização/
  consistência de decisão) com achados, correções aplicadas e
  justificativa técnica de cada uma. Este mapa é a fotografia contínua
  do estado; aquele é o log de uma investigação pontual — os itens de
  backlog que ela encontrou já foram mesclados na tabela §7 abaixo.

---

## 1. Núcleo de decisão

| Subsistema | Estado | Evidência / nota |
|---|---|---|
| Core Engine | IMPLEMENTADO | Único emissor real de LONG/SHORT/WAIT (LEI 24), intocado por qualquer camada de confluência nova desde o congelamento da lei (§6.36). |
| Conselho (Council) | IMPLEMENTADO | 7 agentes reais, linear opinion pool Stone (1961)/DeGroot (1974) via `src/consensus`. Limitação real e documentada: `OrderflowAgent` lê CVD spot MEXC enquanto o resto do Conselho lê perp Binance — cross-market por design, não um bug. |
| Risk Engine | IMPLEMENTADO | `risk-engine.js` — dimensionamento Vol/ATR + capping por Kelly fracionado fixo por faixa de força do Comitê; nunca estima win-rate real (`ASSUMED_WIN_RATE = 0.5` permanente). Validado externamente pelo research map §7 como a resolução mais defensável da controvérsia Samuelson vs. Ziemba/Thorp do Critério de Kelly. |
| Trade Plan | IMPLEMENTADO | ETA (`eta-engine.ts`), Obstáculos (`obstacleCount`), Conviction (`institutional-score.ts`) — cada campo com módulo de dono único. Break Even/Trailing Stop são Council-only por decisão já resolvida. |
| Stage Runner | **IMPLEMENTADO** (revisão 2026-09-01) | `nexus/stage-runner.ts` deixou de ser chamado só pelo próprio teste: `App.tsx` importa `traceStages` e o alimenta com o snapshot real (`stageTrace: traceStages(engineView.snapshot, engineView.seq)`). Continua read-only — nunca bloqueia nada, exatamente como a classificação PARCIAL anterior descrevia que deveria. |
| Chart Integrity Engine | AUSENTE | Zero verificação real de desincronização Snapshot→TradePlan→HUD→Chart→Voice — nada no código impede um render defasado entre essas 5 camadas. |

## 2. Dados, qualidade e memória

| Subsistema | Estado | Evidência / nota |
|---|---|---|
| Market Data Bus | IMPLEMENTADO | Fonte canônica única por `symbol:timeframe`; paginação histórica nunca passa pelo Bus (por design, evita corromper o snapshot canônico). |
| Market Data Adapter (Binance/MEXC) | IMPLEMENTADO | `BinanceProvider`/`MEXCProvider` (ADITIVO V-MAX Etapa 1). |
| GMIL (consenso global) | PARCIAL | 4 de 6 categorias com provider real; ONCHAIN/MACRO ficam `null` permanentemente — exigiriam chave de API, proibida pelas Restrições Permanentes. |
| Data Quality Monitor | **IMPLEMENTADO** (mudou desde §6.42) | Antes fragmentado em 3 motores sem vocabulário comum; `nexus/data-quality-vocabulary.ts` (§6.47/§6.50) unificou rótulo/cor sobre Market Data Bus + GMIL + `data-sufficiency.js`, sem fundir a matemática deles. `research.data_sufficiency` deixou de ser descartado — agora chega em `RealCycleResult.dataSufficiency`. |
| Cross-Exchange (Bybit/OKX/MEXC vs. Binance) | IMPLEMENTADO | `trustScore.crossExchangeConvergence`, real 0-1; corrigido nesta trilha para alimentar também a linha "Consenso Entre Corretoras" do `DecisionValidationWidget` (bug de comentário desatualizado, §6.49). |
| Track Record / Backtest estrutural | IMPLEMENTADO | `structural-backtest.js` (núcleo puro) + captura de histórico com proveniência; arquivado por `symbol:timeframe`. Botão de backtest real dentro do app (autorizado pelo Operador via `AskUserQuestion`). |
| Paper Trading (simulação local) | **IMPLEMENTADO** (revisão 2026-09-01 — a linha acima dizia "fora de escopo") | O Operador pediu explicitamente, com especificação própria, e a classificação anterior ("pertence a outro projeto") deixou de valer. `nexus/paper-trading.ts` (contrato v2): saldo simulado, curva de capital, drawdown atual/máximo, DCA com preço médio ponderado, alavancagem+margem e leitura honesta de liquidação. É **aritmética local sobre preço real**, categoricamente diferente de execução — nenhuma ordem sai do app, nenhuma credencial existe, a Restrição Permanente #1 continua intacta. A liquidação é uma LEITURA derivada, nunca uma mutação automática de posição. |
| Affective Memory (reward/pain) | IMPLEMENTADO | 8 call sites reais; exposto via tooltip no `CouncilWidget` (§6.49) — antes só o ratio derivado (CPI) era visível. |

## 3. Gráfico e visual

| Subsistema | Estado | Evidência / nota |
|---|---|---|
| Camadas do gráfico (canvas) | IMPLEMENTADO — **31 camadas** (revisão 2026-09-01, 2ª rodada; dizia 30 na 1ª) | 31 camadas reais (`CHART_LAYER_IDS`, contagem travada por teste) — FVG/OB, BOS/CHOCH, Liquidity Heatmap, Volume Profile, Trade Plan Zone, Neural Market Aura, EMA, Trend Channel, VWAP, Nexus Line, CVD, Fibonacci, Premium/Discount, Harmônicos, EQH/EQL, Liquidações Forçadas, Liquidity Sweep, Sessões, Kill Zones (ICT, §6.55), Session Key Levels (§6.57), Zona Institucional (§6.64), Pivot Points, Ichimoku, Divergência de Delta, **Andrews Pitchfork** (a 31ª — ver §6 e §9). |
| Relevance Engine (Fusion) | **IMPLEMENTADO — 31/31** (revisão 2026-09-01, 2ª rodada; 30/30 na 1ª) | `nexus/layer-relevance.ts` cobria 15/18 desde a Fase 8.1, fechou 18/18 em §6.51; `kill_zones` (§6.55), `session_key_levels` (§6.57), `institutional_zones` (§6.64) e mais 4 graduações da mesma sessão (Pivot Points/Ichimoku/Delta/Pitchfork) somaram-se depois, todas já com regra própria desde o nascimento (nunca repetiram o gap retroativo) — cobertura continua 1:1 com `CHART_LAYER_IDS`, sem exceção documentada. |
| Zona Institucional (confluência de preço entre ferramentas) | **IMPLEMENTADO — metade aditiva** (novo, §6.64) | `nexus/institutional-zones.ts` agrupa EMA/VWAP/Nexus Line/FVG/OB/EQH-EQL por proximidade real de preço (>=2 ferramentas distintas) numa faixa única (`InstitutionalZonePlugin.tsx`). Deliberadamente NÃO reduz o detalhe individual de cada ferramenta quando já coberta pela faixa (a metade "reduzindo sobreposição" da diretiva) — decisão de UX maior, candidata a rodada isolada própria. |
| Target 1/2/3 no canvas | IMPLEMENTADO | Target 3 (extensão Fibonacci 61.8%) chegava a ser calculado todo ciclo e descartado antes da UI — corrigido em §6.49 (threading completo `support-resistance-engine.js` → `engine-bridge.ts` → canvas). |
| Smart Labels / anti-colisão | IMPLEMENTADO | `chart/label-compaction.ts`. |
| Adaptive Zoom | AUSENTE | Zero sistema deliberado de zoom adaptativo — só o subproduto geométrico passivo de `priceToCoordinate`. |
| Fronteira eixo×gráfico (4ª dimensão do layout) | **IMPLEMENTADO** (novo, revisão 2026-09-01, 2ª rodada) | `chart/chart-plot-area.ts` — junto de lanes horizontais/verticais e `chart-layer-depth.ts` (z), fecha a 4ª dimensão: onde o desenho para antes do eixo de preço. Achado medido antes de construir: nenhum dos 18 overlays media `priceScale('right').width()`; 6 plugins corriam por baixo dos números do eixo, e as etiquetas invadiam as velas em até 20,3px. O eixo passou a ter a largura do próprio conteúdo (quantizada, com histerese). |
| Profundidade do canvas nativo (z-index) | **IMPLEMENTADO** (novo, revisão 2026-09-01, 2ª rodada) | `chart-layer-depth.ts`: o container nativo da lib (velas + 7 camadas sem canvas próprio: cvd/supertrend/pivot_points/premium_discount/scenario_projection/harmonics/liquidity_sweep) nunca tinha z-index — `auto` — e ficava embaixo de TODOS os overlays, provado em Chromium. `CHART_NATIVE_CANVAS_Z_INDEX` fecha isso para as camadas que são linha de 1px. Resíduo declarado: harmonics/liquidity_sweep (tier "event") ainda dividem o mesmo canvas nativo — migrá-las para plugin próprio é trabalho real, não feito de carona (auditoria 2026-09-01 concluiu que são 4 famílias de padrão geométrico distintas — XABCD, Wolfe EPA/ETA, H&S neckline, Triângulo — não uma migração pequena). |
| Auto Layout | PARCIAL | `audit-header-maxcontent.mjs` cobre 11 viewports reais, mas só TopBar + 1 painel — não a área do gráfico/grid completo. |
| Forecast no canvas | PARCIAL | `realCycle.forecast` existe e é real, mas só aparece como lista de texto no HUD, nunca desenhado no canvas. |
| OI/Funding como camada do gráfico | AUSENTE | Dado real já existe (GMIL/cross-exchange), mas nunca é desenhado no canvas — hoje só texto em painel. |
| ZigZag como overlay próprio | **IMPLEMENTADO** (revisão 2026-09-01; a linha dizia PARCIAL) | Graduado do Laboratório na Entrega 47 (`research/engines/zigzag-engine.js` → `ZigZagPlugin.tsx`), camada `zigzag` própria e toggleable. Depois disso o limiar de reversão passou a escalar pelo ATR% do timeframe selecionado (`atrScaledZigZagDeviationPct`), em vez do default fixo. |
| SuperTrend | **IMPLEMENTADO** (novo nesta revisão) | `research/engines/supertrend-engine.js` graduado 2026-08-23 — trailing stop de 1px, camada própria. |
| Padrões de vela (Nison) | **IMPLEMENTADO** (novo nesta revisão) | `research/engines/candlestick-patterns.js` graduado 2026-08-18, detecção por corpo/sombra real. |
| Perfil TPO (Steidlmayer/CBOT) | **IMPLEMENTADO** (novo nesta revisão) | `nexus/tpo-profile.ts` + `TpoProfilePlugin.tsx` — gap nomeado desde a auditoria v16.0 ULTRA. |
| Pivot Points clássicos (Floor Trader) | **IMPLEMENTADO** (novo nesta revisão) | `research/engines/pivot-points-engine.js` graduado 2026-09-01 — PP/R1-3/S1-3 do candle diário anterior FECHADO (filtrado por tempo real, nunca por posição no array). Primeiro dos 2 gaps não-redundantes da auditoria do ecossistema de indicadores. |
| Ichimoku Kinko Hyo | **IMPLEMENTADO** (novo nesta revisão) | `research/engines/ichimoku-engine.js` graduado 2026-09-01 — Tenkan/Kijun/Senkou A-B/Chikou + nuvem Kumo projetada 26 barras à frente. Segundo e último gap não-redundante da mesma auditoria. Introduziu no projeto a técnica de desenhar ALÉM do último candle (`timeScale().logicalToCoordinate`), que nenhum overlay anterior fazia. |
| Divergência de Delta (preço × CVD) | **IMPLEMENTADO** (novo nesta revisão) | `research/engines/delta-divergence-engine.js` graduado 2026-09-01. Ficou 8 dias em quarentena por uma razão que já tinha caído (retenção de CVD subiu de 120 para 900 amostras no mesmo dia em que foi registrada). Única camada cuja relevância é a LEITURA e não a existência do motor. |
| Paleta canônica do canvas | **IMPLEMENTADO** (revisão 2026-09-01 — ver Tier 3 item 20) | `chart/canvas-palette.ts`: exatamente 6 famílias semânticas (`attention`/`bullish`/`measurement`/`projection`/`institutional`/`bearish`), com `tests/canvas-palette.test.ts` impedindo a entrada de qualquer matiz saturado novo. Resolve, no lado do GRÁFICO, o item que o Tier 3 listava como "precisa de decisão do Operador". |
| Kill Zones (ICT) | **IMPLEMENTADO — canvas incluído** (mudou desde §6.53) | `nexus/kill-zones.ts` (§6.48) — badge no header; `KillZoneBandsPlugin.tsx` (§6.55) fechou o desenho real no canvas (retângulo âmbar, mesma cor do badge), camada própria com Relevance Engine desde o nascimento. |
| VWAP ±σ bands | **IMPLEMENTADO** (mudou desde §6.53) | `nexus/vwap-bands.ts` (§6.54) — desvio-padrão real ponderado por volume, k=1/2, mesmo toggle da VWAP (nunca uma nova camada). |
| Session Key Levels (máxima/mínima de sessão) | **IMPLEMENTADO** (novo, §6.57) | Pedido do Operador (captura de indicador de referência) — `computeSessionKeyLevels` em `market-session.ts` (reaproveita a partição já real), `SessionKeyLevelsPlugin.tsx`, cor reaproveitada de S1/R1, camada própria com Relevance Engine desde o nascimento. PDH/PDL (companion comum deste tipo de indicador) fica como candidato de próxima rodada, não implementado ainda. |

## 4. Inteligência, radar e contexto

| Subsistema | Estado | Evidência / nota |
|---|---|---|
| Multi-Timeframe Matrix | IMPLEMENTADO | Confluência real entre timeframes, nunca uma 2ª decisão (LEI 24). |
| Confluence Corridor (ex-"Corredor de Probabilidade") | IMPLEMENTADO | Nome corrigido para honestidade (Regra de Ouro 2) na trilha Fusion; contrato v2 corrigido em §6.40. |
| Radar / OIH (Oportunidades) | **IMPLEMENTADO** (mudou desde §6.42) | v1 real (§6.38/§6.39) rodava só sobre `asset-universe.default.json` (~30-41 símbolos curados Binance); scan real MEXC-wide (`fetchMexcUsdtSymbols` + `scanRadarCandidate(..., 'MEXC')`) foi ligado ao painel "OPORTUNIDADES" (§6.45/task #85) — universo hoje cobre Binance curado + MEXC completo, não mais só a lista curada. |
| Market Regime Detector | **IMPLEMENTADO** (revisão 2026-09-01; a linha dizia PARCIAL com "zero ocorrência") | O gap fechou exatamente como a linha antiga previa: `layer-relevance.ts` hoje lê `marketRegime` (7 ocorrências, campo próprio em `LayerRelevanceInput`), e a relevância de `trend_channel` combina largura de banda real COM regime real — "compressão e momentum confirmados juntos", ou momentum por ADX/DI mesmo com banda larga. Era o item 10 do backlog Tier 2 (antes da inserção do item 9 novo nesta rodada — ver §7). |
| Organism Health | PARCIAL | `nexus/organism-orchestrator.ts` + `useHealthSnapshot()` já são contínuos, confirmados ligados em `App.tsx` nesta rodada; `self-diagnostics.ts` (relatório profundo) continua sob demanda (clique), não um monitor contínuo — mesma leitura de §6.42, sem mudança. |
| Voice (TTS/STT) | IMPLEMENTADO | Reais do browser, push-to-talk; `computeAlerts` só reage a transição real de estado. |
| Event Bus | IMPLEMENTADO | `nexus/event-bus.ts` + `gmil/event-bus.ts` — domínios separados de propósito. |

## 5. O que foi deliberadamente RECUSADO (não é "ainda não fizemos")

Distinção importante para não reabrir debate já fechado sem motivo novo:

| Item | Por quê foi recusado |
|---|---|
| Execução real de ordens (qualquer reformulação) | Restrição Permanente #1 (READ_ONLY/FAIL_CLOSED incondicional) — confirmado explicitamente com o Operador via `AskUserQuestion` nesta mesma trilha (§6.48) quando o pedido reapareceu reformulado. |
| Dynamic Trend Projection (extrapolar o Trend Channel para o futuro) | `trend-channel-engine.ts`: extrapolação OLS classificada como estatisticamente não-confiável — recusa técnica documentada, não uma lacuna esquecida. |
| Cross-Timeframe Liquidity | Exclusão deliberada documentada em `multi-timeframe-engine.ts`. |
| Liquidity Voids / Volume Clusters como camadas distintas | Avaliados e descartados — duplicariam LVN (já parte do Volume Profile real) e o próprio Volume Profile, sem conceito genuinamente novo por trás. |
| Probabilidade calibrada de acerto (ex.: "72% de chance de subir") | Regra de Ouro 2 — este repositório não tem backtest real que sustente uma calibração honesta; a resposta correta é sempre uma métrica de confluência/confiança, nunca um número inventado. |
| Institutional Volume Zones | Sem conceito distinto do Volume Profile já real — mesmo raciocínio de Liquidity Voids acima. Não confundir com "Zona Institucional" (§6.64, seção 3 acima) — esta é confluência de PREÇO entre ferramentas independentes (EMA/VWAP/FVG/OB/Liquidez), zero relação com volume/Volume Profile. |

## 6. AUSENTES sem decisão de recusa (backlog real, não descarte)

**Revisão 2026-09-01 (1ª rodada):** Triângulos saiu desta lista — `nexus/
triangle-pattern.ts` existe e é real (com o ápice projetado no gráfico),
assim como `head-shoulders-pattern.ts` e a EPA da Wolfe em
`harmonic-patterns.ts`.

**Revisão 2026-09-01 (2ª rodada):** Andrews Pitchfork TAMBÉM saiu — motor
puro pesquisado (StockCharts/Optuma/GoCharting/Coghlan Capital) + 21 testes
de execução real + plugin de canvas, graduado no mesmo dia (ver §9). Com
ele, **o conjunto de ferramentas de gráfico com nome próprio ausentes e não
bloqueadas chega a zero** — o que resta abaixo está travado por dado
(Footprint) ou por decisão do Operador (SMT Divergence, Chart Integrity
Engine).

Elliott Wave, Wyckoff (reconfirmado
por grep 2026-09-01 — zero ocorrência), Footprint (zero ocorrência — bloqueado por
disponibilidade de dado, não por decisão de produto), SMT Divergence
(precisaria de um 2º ativo correlacionado no pipeline), Previous Day
High/Low — PDH/PDL (§6.57: companion comum do mesmo tipo de indicador
"Key Levels" recém-implementado; a mesma `computeSessionKeyLevels`
generalizada para uma partição diária resolveria, mas não foi pedida
ainda — escopo da Entrega 4/PR #15 era responder ao pedido concreto do
Operador, não expandir além dele).

---

## 7. Backlog técnico consolidado (mescla research map §11 + subitens
abertos desta auditoria + achados novos de
`AUDITORIA_CONSOLIDACAO_EVOLUCAO.md`)

### Tier 1 — barato, baixo risco, próxima rodada natural
1. ~~Kill Zones **no canvas**~~ — **feito, §6.55** (`KillZoneBandsPlugin.tsx`,
   camada própria `kill_zones`, Relevance Engine coberto desde o
   nascimento).
2. ~~VWAP ±σ bands~~ — **feito, §6.54** (`nexus/vwap-bands.ts`, wiring no
   mesmo toggle da VWAP).
3. Auditoria de touch-target 44×44pt (iPad Safari, Regra de Ouro 7).
4. Auditoria de list-virtualization (order book / Radar / Omnibox —
   verificar se listas longas já virtualizam ou têm risco de framerate).
5. Checar a dependência `reconnecting-websocket` (research map §9,
   item de minutos).
6. Documentar/decidir quais elementos do gráfico sempre desenhados sem
   toggle próprio (S1/R1, linhas do Trade Plan, alvos de fallback do
   Core Engine, projeções de Cenário A/B) deveriam ganhar um toggle real
   — hoje "Camadas do Gráfico" implica ser a superfície de controle
   completa e não é. Decisão + rótulo, não motor novo.
7. `AbortController` nos 2 fetches privados que não passam pelo Market
   Data Bus (ticker em `fetchSymbolData`, funding+OI em
   `fetchDerivatives`) — isolado, seguro, valor baixo (só eficiência de
   rede: a correção de aplicação de dado obsoleto já existe via
   `isStale()`, ver `AUDITORIA_CONSOLIDACAO_EVOLUCAO.md` §3.1/§7).

### Tier 2 — médio, 1 rodada dedicada cada
8. ~~Andrews Pitchfork~~ — **feito** (revisão 2026-09-01, 2ª rodada):
   motor puro + 21 testes + plugin de canvas, projeção de 60 barras além
   do último candle pela mesma técnica que o Ichimoku introduziu. Ver §9.
9. Migrar `harmonics`/`liquidity_sweep` para canvas próprio (novo,
   revisão 2026-09-01, 2ª rodada) — o único resíduo real que sobra da
   correção de profundidade acima: as duas dividem o canvas NATIVO
   (z-index fixo, sem individualidade) com cvd/supertrend/pivot_points/
   premium_discount/scenario_projection. Investigado nesta rodada e
   propositalmente NÃO feito de carona: `harmonics` sozinho embute 4
   famílias de padrão com matemática própria (XABCD, Wolfe EPA/ETA, H&S
   com neckline extrapolada, Triângulo por mínimos quadrados) — mover para
   plugin de canvas é reimplementar geometria fina de 4 motores, não mover
   código. `liquidity_sweep` é simples (cluster de price lines com
   decaimento, mesma forma já migrada para outras camadas) e pode sair
   sozinho numa rodada pequena; `harmonics` merece sessão própria com
   verificação visual real (impossível neste sandbox sem egress).
10. ~~Market Regime → Relevance Engine~~ — **feito** (revisão 2026-09-01):
   `layer-relevance.ts` lê `marketRegime` e a relevância de `trend_channel`
   combina largura de banda real com regime real. Ver §4 acima.
11. ~~Drawdown/Track Record~~ — **feito** (revisão 2026-09-01), por um
    caminho diferente do previsto: as métricas nasceram no Paper Trading
    (`nexus/paper-trading.ts` v2 — curva de capital, drawdown atual/máximo,
    pico de equity), a pedido explícito do Operador, e não como um cálculo
    adicional sobre o Track Record arquivado. O item continua aberto SE o
    que se quiser for drawdown do histórico REAL resolvido — são duas
    séries diferentes, e confundi-las seria o tipo de imprecisão que este
    documento existe para evitar.
12. Auto Layout — estender `audit-header-maxcontent.mjs` (ou
    equivalente) para cobrir a área do gráfico/grid inteira, não só
    TopBar+1 painel.
13. Forecast no canvas (dado já real em `realCycle.forecast`, só falta
    o desenho — cuidado para não confundir com Target1/2/3 real).
14. Unificar ATR% — hoje existem duas fórmulas divergentes: Wilder real
    (`lorentzian-classifier.js`, não usada por ninguém fora do próprio
    módulo) e uma média simples (`market-regime/regime-engine.js`) que
    É a canônica real consumida pelo Risk Engine/ETA/VWAP-NL. Precisa de
    cuidado real — toca matemática de sizing (achado
    `AUDITORIA_CONSOLIDACAO_EVOLUCAO.md` §5).
15. Política de eviction real no Market Data Bus/Quality Monitor/
    Pipeline Telemetry — crescimento de memória garantido (não
    especulativo), confirmado via o scanner do Radar paginando o
    universo MEXC inteiro a cada 5min; singleton compartilhado, exige
    desenho que não quebre o contrato de dedupe já testado (achado
    `AUDITORIA_CONSOLIDACAO_EVOLUCAO.md` §5).
16. Hardening de `mergeFreshTail` contra granularidade mista de candle
    — janela de corrida real (não determinística) entre o refresh REST
    de 30s e a troca de timeframe; função pura, testável isolada, baixo
    raio de explosão (achado `AUDITORIA_CONSOLIDACAO_EVOLUCAO.md` §3.3).

### Tier 3 — precisa de decisão do Operador antes de começar
17. Footprint — bloqueado por disponibilidade de dado (volume por
    preço intra-candle não está nas fontes atuais); precisa avaliar se
    alguma fonte real cobre isso antes de sequer prototipar.
18. SMT Divergence — exigiria formalizar um 2º ativo correlacionado
    dentro do pipeline (hoje o app é mono-ativo por ciclo).
19. Chart Integrity Engine — decisão de escopo: o que exatamente conta
    como "desincronização" entre as 5 camadas (Snapshot/TradePlan/HUD/
    Chart/Voice) e o que fazer quando detectada (bloquear render? só
    avisar?) precisa de definição do Operador antes de implementar.
20. Consolidar a paleta de cores por eixo semântico — hoje 9 eixos
    diferentes (direção, saúde do sistema, conectividade, qualidade de
    dado, tier de confluência, Heat Score, CPI/Trust Score, alerta/trap)
    reaproveitam a mesma paleta verde/vermelho/dourado; internamente
    consistente em cada eixo, ambíguo entre eixos. Grande — toca dezenas
    de widgets — precisa de decisão de design do Operador sobre a nova
    paleta antes de implementar (achado `AUDITORIA_CONSOLIDACAO_EVOLUCAO.md` §4).
    **Detalhamento real do lado do GRÁFICO** (Lapidação Profissional,
    `AUDITORIA_ECOSSISTEMA_VISUAL.md` §9.4/§9.7): 5 tons de amarelo/âmbar
    distintos pra 5 conceitos (Entry/VWAP-neutro/pico-Liquidation/Kill
    Zones/Sweep) e o mesmo cyan exato pra Fibonacci E Volume Profile —
    mesmas 2 decisões pendentes de design, agora com inventário completo
    e cores exatas nomeadas.
    **Resolvido no lado do GRÁFICO (revisão 2026-09-01):**
    `chart/canvas-palette.ts` fechou o inventário inteiro em 6 famílias
    semânticas declaradas, com `tests/canvas-palette.test.ts` travando a
    regra — nenhum matiz saturado novo entra sem passar por ela. Os 5 tons
    de amarelo viraram a família `attention` única; o cyan
    Fibonacci×Volume Profile virou `measurement`. **O que continua em
    aberto é só o lado dos WIDGETS** (os 9 eixos semânticos fora do
    canvas), que segue precisando de decisão de design do Operador.
    Registro anterior preservado:
    **Parcialmente resolvido em §6.59** (`SYSTEM_HANDBOOK.md`): dentro da
    família amarela, o par Sweep×pico-Liquidation não era ambiguidade de
    design — era 2° de matiz na mesma luminosidade/saturação/alpha
    (comprovado por conversão RGB→HSL), ou seja, praticamente a mesma cor
    por acidente. Diferenciado sem esperar decisão do Operador (mecânico,
    evidência objetiva).
    **Também resolvido em §6.61** (`SYSTEM_HANDBOOK.md`): o cyan
    Fibonacci×Volume Profile virou o mesmo tipo de caso mecânico ao ser
    reexaminado — a colisão real nunca foi "barras vs. linha", era o POC
    (única linha real do Volume Profile) na MESMA cor exata que
    Fibonacci (também linha). POC migrou pra magenta `rgba(236,81,205,
    0.75)` (precedente real: presets "Aurora Glass"/"Obsidian Precision"
    destacam POC com acento próprio); barras seguem cyan (precedente
    real: preset "Black Ice"). Só resta como decisão de design pendente:
    Entry/VWAP-neutro/Kill Zones dentro da mesma família amarela —
    nenhum desses pares tem uma colisão objetiva comprovada do mesmo
    jeito, só sobreposição conceitual de família de cor.

### Tier 4 — grande, arquitetural, cada um merece sua própria trilha
21. Migração WidgetContext → seletores Zustand granulares — dívida já
    flagada há várias rodadas, agora com validação externa (research
    map §9: é o antipadrão que a comunidade Zustand documenta como
    causa raiz de re-render desnecessário, `eslint-plugin-granular-
    selectors` existe justamente pra isso) e evidência concreta nova
    (o gap de timing real entre `priceData`/TopBar e
    `usePriceSnapshot()`/gráfico é a mesma dívida — ver
    `AUDITORIA_CONSOLIDACAO_EVOLUCAO.md` §3.3).
22. Mover o ciclo do Core Engine para Web Worker — Regra de Ouro 6 exige
    que isso seja uma iniciativa isolada e cuidadosa, nunca misturada
    com outra mudança.
23. `OffscreenCanvas` + rendering em Worker para os overlays mais
    pesados (Liquidation Heatmap, Order Flow Heatmap) — mesma cautela
    da Regra de Ouro 6.
24. Chart Integrity Engine (implementação, após a decisão de escopo do
    Tier 3).
25. Adaptive Zoom (sistema deliberado, não o subproduto passivo atual).

---

## 8. Riscos transversais conhecidos (afetam múltiplos subsistemas)

- **Sandbox de desenvolvimento sem egress de rede real**: toda
  verificação ao vivo neste ambiente roda sem dados reais da Binance/
  MEXC/Bybit/OKX (`ERR_TUNNEL_CONNECTION_FAILED` consistente). Isso é
  uma limitação do ambiente de build, não do produto — mas significa que
  boa parte da "verificação ao vivo" documentada em `SYSTEM_HANDBOOK.md`
  prova a FIAÇÃO (wiring) e o comportamento fail-closed, nunca o
  resultado com dado de mercado real em movimento.
- **Bundle do LLM (`llm-worker`/`llm-bridge`) em ~6MB cada**: investigado
  em §6.46 (ORDEM DIRETA) — já isolado do bundle principal via
  code-splitting; redução adicional do tamanho absoluto não foi tentada
  (fora do escopo daquela auditoria).
- **`WidgetContext` como fonte de leitura em paralelo aos seletores da
  store**: migração incompleta (Tier 4, item 21 acima) — não é uma
  inconsistência de dado em geral (mesma fonte real por trás dos dois
  caminhos), mas já tem 1 instância concreta onde o TIMING diverge
  (`priceData`/TopBar vs. `usePriceSnapshot()`/gráfico, ver item 21) —
  maioria dos casos continua sendo dívida de performance/manutenção,
  não de correção.
- **GMIL ONCHAIN/MACRO permanentemente `null`**: não é um bug — é a
  Restrição Permanente de nunca guardar credenciais de API se
  cumprindo; qualquer solução futura precisaria ser uma fonte pública
  sem chave, e nenhuma foi encontrada com qualidade suficiente até hoje
  (research map §8).

---

## 9. Roadmap recomendado (ordem sugerida, não uma promessa de cronograma)

1. Tier 1 em andamento (baixo custo, fecha lacunas pequenas já
   mapeadas) — VWAP ±σ bands (§6.54) e Kill Zones no canvas (§6.55) já
   entregues, resposta direta ao pedido recorrente do Operador por
   "ferramentas mais precisas". Restam: touch-target 44×44pt,
   list-virtualization, `reconnecting-websocket`, escopo de toggle para
   S1/R1/Trade Plan/Cenário.
2. ~~Market Regime → Relevance Engine~~ — **feito** (revisão 2026-09-01).
   Com ele, toda relevância de camada vem de sinal real já mapeado.
3. ~~Andrews Pitchfork~~ — **feito** (revisão 2026-09-01, 2ª rodada). A
   auditoria do ecossistema de indicadores fechou os 2 candidatos reais
   não-redundantes (Pivot Points, Ichimoku) numa rodada e o Pitchfork na
   seguinte, descartando 4 osciladores por redundância comprovada — RSI de
   Wilder + CVD/Delta/Volume Profile já cobrem o que CCI/Stochastic/
   Williams %R/MFI dariam, e Keltner é redundante com Bollinger Bandwidth +
   SuperTrend. **Com isso, zero ferramentas de gráfico com nome próprio
   ausentes e não bloqueadas restam** — próximo item real é a migração de
   harmonics/liquidity_sweep para canvas próprio (Tier 2 novo, abaixo), não
   mais um gap de cobertura.
4. Decisão do Operador sobre os itens de Tier 3 (Footprint, SMT
   Divergence, escopo do Chart Integrity Engine, paleta por eixo semântico
   **do lado dos widgets** — o lado do gráfico já foi resolvido por
   `canvas-palette.ts`, ver Tier 3 item 20) — sem essa decisão, qualquer trabalho nesses 4
   itens seria suposição, não implementação.
5. Tier 4 — cada item como sua própria trilha isolada e cuidadosa
   (mesma disciplina já usada para toda mudança de Main Thread/Core
   Engine neste projeto).

---

*Manutenção: este documento é uma fotografia — refresque a tabela quando
um item real de estado mudar (mesmo padrão do `CLAUDE.md`), nunca deixe
uma classificação ficar sabidamente errada. O histórico de COMO cada
mudança aconteceu continua vivendo em `docs/SYSTEM_HANDBOOK.md` §6.*

*Lição medida na revisão de 2026-09-01, registrada porque é o modo de
falhar deste arquivo: a instrução acima existia desde o primeiro dia e
mesmo assim ele derivou 5 semanas — 21 camadas viraram 30, três PARCIAIS
viraram IMPLEMENTADOS, e um item de backlog seguia listado como pendente
depois de entregue. Uma fotografia desatualizada é pior que nenhuma: ela
manda a próxima sessão construir algo que já existe, ou ignorar algo que
quebrou. O único remédio que funcionou aqui foi conferir cada linha contra
o código com `grep`/contagem real — as afirmações numéricas deste
documento têm guarda de teste no repositório (a contagem de camadas, por
exemplo, quebra a suíte se alguém somar uma sem atualizar as 5 listas).
É o mesmo defeito recorrente que o `QUARANTINE.md` registra 5 vezes:
uma declaração afirmando o que o código não faz.*

*2ª rodada, mesmas horas — a prova de que a lição acima é estrutural, não
um evento raro: ao reabrir o documento por pedido do Operador ("continue,
cada milímetro"), 5 commits picados desde a 1ª rodada já tinham derivado a
fotografia de novo (30→31 camadas, Pitchfork saiu de AUSENTE, dois itens de
backlog concluídos). Nenhum aqui é um erro de leitura — é o tempo real entre
"refresquei" e "mudou de novo" sendo menor que uma sessão de trabalho. A
consequência prática, não só a lição: revisão de estado e trabalho de
implementação não são fases separadas neste projeto — refrescar o mapa é
parte do MESMO commit que muda o que ele descreve, nunca uma tarefa
adiada para depois.*
