# AR10 CYBORG — Mapa de Evolução do Organismo

**Data**: 2026-07-27 · **Escopo**: `ipad_runtime/` (read-only, USDT-M
Futures/Perpétuo) · **Pedido de origem**: Operador — "mapeia tudo que tem
de ser feito e a evolução de todos os sistema do ciborgue".

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
- **Também NÃO é** o `docs/AUDITORIA_CONSOLIDACAO_EVOLUCAO.md` — aquele
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
| Stage Runner | PARCIAL | `nexus/stage-runner.ts` é um traçador read-only real (`DATA→CORE_ENGINE→COUNCIL→TRADE_PLAN`) — nunca bloqueia nada, mas ainda não está fiado a `App.tsx`/UI; hoje só o próprio teste o chama. |
| Chart Integrity Engine | AUSENTE | Zero verificação real de desincronização Snapshot→TradePlan→HUD→Chart→Voice — nada no código impede um render defasado entre essas 5 camadas. |

## 2. Dados, qualidade e memória

| Subsistema | Estado | Evidência / nota |
|---|---|---|
| Market Data Bus | IMPLEMENTADO | Fonte canônica única por `symbol:timeframe`; paginação histórica nunca passa pelo Bus (por design, evita corromper o snapshot canônico). |
| Market Data Adapter (Binance/MEXC) | IMPLEMENTADO | `BinanceProvider`/`MEXCProvider` (ADITIVO V-MAX Etapa 1). |
| GMIL (consenso global) | PARCIAL | 4 de 6 categorias com provider real; ONCHAIN/MACRO ficam `null` permanentemente — exigiriam chave de API, proibida pelas Restrições Permanentes. |
| Data Quality Monitor | **IMPLEMENTADO** (mudou desde §6.42) | Antes fragmentado em 3 motores sem vocabulário comum; `nexus/data-quality-vocabulary.ts` (§6.47/§6.50) unificou rótulo/cor sobre Market Data Bus + GMIL + `data-sufficiency.js`, sem fundir a matemática deles. `research.data_sufficiency` deixou de ser descartado — agora chega em `RealCycleResult.dataSufficiency`. |
| Cross-Exchange (Bybit/OKX/MEXC vs. Binance) | IMPLEMENTADO | `trustScore.crossExchangeConvergence`, real 0-1; corrigido nesta trilha para alimentar também a linha "Consenso Entre Corretoras" do `DecisionValidationWidget` (bug de comentário desatualizado, §6.49). |
| Track Record / Backtest estrutural | IMPLEMENTADO | `structural-backtest.js` (núcleo puro) + captura de histórico com proveniência; arquivado por `symbol:timeframe`. Sem paper-trading/drawdown ao vivo — confirmado pertencer a outro projeto do Operador, fora de escopo. |
| Affective Memory (reward/pain) | IMPLEMENTADO | 8 call sites reais; exposto via tooltip no `CouncilWidget` (§6.49) — antes só o ratio derivado (CPI) era visível. |

## 3. Gráfico e visual

| Subsistema | Estado | Evidência / nota |
|---|---|---|
| Camadas do gráfico (canvas) | IMPLEMENTADO | 20 camadas reais (`CHART_LAYER_IDS`) — FVG/OB, BOS/CHOCH, Liquidity Heatmap, Volume Profile, Trade Plan Zone, Neural Market Aura, EMA, Trend Channel, VWAP, Nexus Line, CVD, Fibonacci, Premium/Discount, Harmônicos, EQH/EQL, Liquidações Forçadas, Liquidity Sweep, Sessões, Kill Zones (ICT, §6.55), Session Key Levels (§6.57). |
| Relevance Engine (Fusion) | **IMPLEMENTADO — 20/20** (mudou desde §6.53) | `nexus/layer-relevance.ts` cobria 15/18 desde a Fase 8.1, fechou 18/18 em §6.51; `kill_zones` (§6.55) e `session_key_levels` (§6.57) somaram-se depois, ambas já com regra própria desde o nascimento (nunca repetiram o gap retroativo) — cobertura continua 1:1 com `CHART_LAYER_IDS`, sem exceção documentada. |
| Target 1/2/3 no canvas | IMPLEMENTADO | Target 3 (extensão Fibonacci 61.8%) chegava a ser calculado todo ciclo e descartado antes da UI — corrigido em §6.49 (threading completo `support-resistance-engine.js` → `engine-bridge.ts` → canvas). |
| Smart Labels / anti-colisão | IMPLEMENTADO | `chart/label-compaction.ts`. |
| Adaptive Zoom | AUSENTE | Zero sistema deliberado de zoom adaptativo — só o subproduto geométrico passivo de `priceToCoordinate`. |
| Auto Layout | PARCIAL | `audit-header-maxcontent.mjs` cobre 11 viewports reais, mas só TopBar + 1 painel — não a área do gráfico/grid completo. |
| Forecast no canvas | PARCIAL | `realCycle.forecast` existe e é real, mas só aparece como lista de texto no HUD, nunca desenhado no canvas. |
| OI/Funding como camada do gráfico | AUSENTE | Dado real já existe (GMIL/cross-exchange), mas nunca é desenhado no canvas — hoje só texto em painel. |
| ZigZag como overlay próprio | PARCIAL | Existe só como helper interno em `fractal-swings.js`, nunca uma camada própria toggleable. |
| Kill Zones (ICT) | **IMPLEMENTADO — canvas incluído** (mudou desde §6.53) | `nexus/kill-zones.ts` (§6.48) — badge no header; `KillZoneBandsPlugin.tsx` (§6.55) fechou o desenho real no canvas (retângulo âmbar, mesma cor do badge), camada própria com Relevance Engine desde o nascimento. |
| VWAP ±σ bands | **IMPLEMENTADO** (mudou desde §6.53) | `nexus/vwap-bands.ts` (§6.54) — desvio-padrão real ponderado por volume, k=1/2, mesmo toggle da VWAP (nunca uma nova camada). |
| Session Key Levels (máxima/mínima de sessão) | **IMPLEMENTADO** (novo, §6.57) | Pedido do Operador (captura de indicador de referência) — `computeSessionKeyLevels` em `market-session.ts` (reaproveita a partição já real), `SessionKeyLevelsPlugin.tsx`, cor reaproveitada de S1/R1, camada própria com Relevance Engine desde o nascimento. PDH/PDL (companion comum deste tipo de indicador) fica como candidato de próxima rodada, não implementado ainda. |

## 4. Inteligência, radar e contexto

| Subsistema | Estado | Evidência / nota |
|---|---|---|
| Multi-Timeframe Matrix | IMPLEMENTADO | Confluência real entre timeframes, nunca uma 2ª decisão (LEI 24). |
| Confluence Corridor (ex-"Corredor de Probabilidade") | IMPLEMENTADO | Nome corrigido para honestidade (Regra de Ouro 2) na trilha Fusion; contrato v2 corrigido em §6.40. |
| Radar / OIH (Oportunidades) | **IMPLEMENTADO** (mudou desde §6.42) | v1 real (§6.38/§6.39) rodava só sobre `asset-universe.default.json` (~30-41 símbolos curados Binance); scan real MEXC-wide (`fetchMexcUsdtSymbols` + `scanRadarCandidate(..., 'MEXC')`) foi ligado ao painel "OPORTUNIDADES" (§6.45/task #85) — universo hoje cobre Binance curado + MEXC completo, não mais só a lista curada. |
| Market Regime Detector | PARCIAL | Motor real (Wilder ADX/DI + Bollinger, `market-regime/regime-engine.js`) segue existindo, mas **ainda não alimenta `layer-relevance.ts`** — confirmado nesta rodada (grep direto, zero ocorrência). Candidato natural: relevância de `trend_channel`/`ema` reagindo ao regime real (tendência vs. lateralização), não só à largura de banda. |
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
| Institutional Volume Zones | Sem conceito distinto do Volume Profile já real — mesmo raciocínio de Liquidity Voids acima. |

## 6. AUSENTES sem decisão de recusa (backlog real, não descarte)

Pitchfork/Andrews Pitchfork, Elliott Wave, Triângulos, Wyckoff (confirmado
por grep — zero ocorrência), Footprint (zero ocorrência — bloqueado por
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
8. Andrews Pitchfork (motor puro + plugin de canvas) — já priorizado
   pelo Operador em rodada anterior.
9. Market Regime → Relevance Engine (fechar o gap confirmado na §4
   acima — `regime-engine.js` real, mas `layer-relevance.ts` ainda não
   lê nada dele).
10. Drawdown/Track Record — métricas adicionais sobre o histórico já
    real e arquivado.
11. Auto Layout — estender `audit-header-maxcontent.mjs` (ou
    equivalente) para cobrir a área do gráfico/grid inteira, não só
    TopBar+1 painel.
12. Forecast no canvas (dado já real em `realCycle.forecast`, só falta
    o desenho — cuidado para não confundir com Target1/2/3 real).
13. Unificar ATR% — hoje existem duas fórmulas divergentes: Wilder real
    (`lorentzian-classifier.js`, não usada por ninguém fora do próprio
    módulo) e uma média simples (`market-regime/regime-engine.js`) que
    É a canônica real consumida pelo Risk Engine/ETA/VWAP-NL. Precisa de
    cuidado real — toca matemática de sizing (achado
    `AUDITORIA_CONSOLIDACAO_EVOLUCAO.md` §5).
14. Política de eviction real no Market Data Bus/Quality Monitor/
    Pipeline Telemetry — crescimento de memória garantido (não
    especulativo), confirmado via o scanner do Radar paginando o
    universo MEXC inteiro a cada 5min; singleton compartilhado, exige
    desenho que não quebre o contrato de dedupe já testado (achado
    `AUDITORIA_CONSOLIDACAO_EVOLUCAO.md` §5).
15. Hardening de `mergeFreshTail` contra granularidade mista de candle
    — janela de corrida real (não determinística) entre o refresh REST
    de 30s e a troca de timeframe; função pura, testável isolada, baixo
    raio de explosão (achado `AUDITORIA_CONSOLIDACAO_EVOLUCAO.md` §3.3).

### Tier 3 — precisa de decisão do Operador antes de começar
16. Footprint — bloqueado por disponibilidade de dado (volume por
    preço intra-candle não está nas fontes atuais); precisa avaliar se
    alguma fonte real cobre isso antes de sequer prototipar.
17. SMT Divergence — exigiria formalizar um 2º ativo correlacionado
    dentro do pipeline (hoje o app é mono-ativo por ciclo).
18. Chart Integrity Engine — decisão de escopo: o que exatamente conta
    como "desincronização" entre as 5 camadas (Snapshot/TradePlan/HUD/
    Chart/Voice) e o que fazer quando detectada (bloquear render? só
    avisar?) precisa de definição do Operador antes de implementar.
19. Consolidar a paleta de cores por eixo semântico — hoje 9 eixos
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
20. Migração WidgetContext → seletores Zustand granulares — dívida já
    flagada há várias rodadas, agora com validação externa (research
    map §9: é o antipadrão que a comunidade Zustand documenta como
    causa raiz de re-render desnecessário, `eslint-plugin-granular-
    selectors` existe justamente pra isso) e evidência concreta nova
    (o gap de timing real entre `priceData`/TopBar e
    `usePriceSnapshot()`/gráfico é a mesma dívida — ver
    `AUDITORIA_CONSOLIDACAO_EVOLUCAO.md` §3.3).
21. Mover o ciclo do Core Engine para Web Worker — Regra de Ouro 6 exige
    que isso seja uma iniciativa isolada e cuidadosa, nunca misturada
    com outra mudança.
22. `OffscreenCanvas` + rendering em Worker para os overlays mais
    pesados (Liquidation Heatmap, Order Flow Heatmap) — mesma cautela
    da Regra de Ouro 6.
23. Chart Integrity Engine (implementação, após a decisão de escopo do
    Tier 3).
24. Adaptive Zoom (sistema deliberado, não o subproduto passivo atual).

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
  store**: migração incompleta (Tier 4, item 20 acima) — não é uma
  inconsistência de dado em geral (mesma fonte real por trás dos dois
  caminhos), mas já tem 1 instância concreta onde o TIMING diverge
  (`priceData`/TopBar vs. `usePriceSnapshot()`/gráfico, ver item 20) —
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
2. Market Regime → Relevance Engine (fecha o último gap real do Fusion
   Engine; depois deste, TODA relevância de camada vem de sinal real
   já mapeado, zero exceção pendente).
3. Andrews Pitchfork (ferramenta institucional já priorizada).
4. Decisão do Operador sobre os itens de Tier 3 (Footprint, SMT
   Divergence, escopo do Chart Integrity Engine, nova paleta de cores
   por eixo semântico) — sem essa decisão, qualquer trabalho nesses 4
   itens seria suposição, não implementação.
5. Tier 4 — cada item como sua própria trilha isolada e cuidadosa
   (mesma disciplina já usada para toda mudança de Main Thread/Core
   Engine neste projeto).

---

*Manutenção: este documento é uma fotografia — refresque a tabela quando
um item real de estado mudar (mesmo padrão do `CLAUDE.md`), nunca deixe
uma classificação ficar sabidamente errada. O histórico de COMO cada
mudança aconteceu continua vivendo em `docs/SYSTEM_HANDBOOK.md` §6.*
