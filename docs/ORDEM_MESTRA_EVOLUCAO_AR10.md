# ORDEM MESTRA — Evolução do AR10 ORION

**Documento único.** Auditoria cruzada código × documentação, com
classificação honesta por evidência, e a ordem executável no fim.

**Regra aplicada em tudo abaixo:** onde não houve medição real, está
escrito **DADOS INSUFICIENTES** — nunca uma estimativa disfarçada de fato.

**Nota de forma:** o pedido se dirige a "Agente 2" e manda produzir ordem
para "Agente 4". Essas personas não existem nesta sessão. Nenhuma foi
encenada; o conteúdo técnico foi executado integralmente. Registrado
conforme CLAUDE.md §7.

---

## 1. Diagnóstico executivo

O AR10 está **muito melhor fatorado do que a quantidade de módulos
sugere**, e **muito mais raso na decisão do que a quantidade de camadas
sugere**. Esses dois fatos, juntos, são o diagnóstico.

- 8 motores graduados, 87 módulos `nexus/`, 26 camadas de gráfico, 16
  plugins, 3.454 testes verdes, 1 único módulo órfão em `nexus/`.
- E a decisão LONG/SHORT/WAIT inteira cabe em **6 linhas** de
  cruzamento de médias, mapeadas 1:1 até a UI sem nenhum gate.

Dos 17 pares de duplicação investigados, **15 não eram duplicação**. Dos
3 módulos de saúde, **nenhum duplica os outros** — os headers documentam
a divisão. O sistema não sofre de inchaço: sofre de **desproporção entre
contexto exibido e profundidade decisória**.

A conclusão que orienta toda a ordem final: **não adicionar camada.
Aprofundar a decisão e unificar as duas fontes de verdade que faltam.**

---

## 2. Arquitetura atual real (medida)

```
CONECTORES (Binance/MEXC/Bybit/OKX + CoinGecko/Yahoo/DefiLlama)
   ↓
market-data-bus/            ← SSOT de candles por symbol:timeframe
   ↓
js/real-data/analysis-frame.js    SMA/EMA/stddev/zscore (WASM)
   ↓
js/research/research-engine.js    trendBias() — 6 linhas
   ↓                              (3 rotas SEMPRE calculadas)
js/research/trade-setup-matrix.js ALTA→LONG · BAIXA→SHORT · resto→WAIT
   ↓                              mapeamento 1:1, ZERO gate
engine-bridge.ts:531              realCycle.signal
   ↓
App.tsx:1904                      engine.direction
   ↓
Council · Trade Plan · Scenario · Voz · Alertas · 26 camadas de gráfico
```

Tudo à direita de `engine.direction` é **confluência/contexto** (LEI 24).
Nenhum dos 8 motores participa de escolher a direção.

---

## 3. Mapa de fontes de verdade

| Domínio | Fonte canônica | Estado |
|---|---|---|
| Candles / preço | `market-data-bus/` (`requestSnapshot`) | **IMPLEMENTADO E CONFIRMADO** |
| Swings fractais | `fractal-swings.js` | **CONFIRMADO** — 10 importadores, zero reimplementação |
| Order Blocks / FVG | `fvg-order-block-engine.js` | **CONFIRMADO** |
| Volume Profile | worker WASM | **CONFIRMADO** |
| Risco / sizing | `src/risk/risk-engine.js` | **CONFIRMADO** — único que dimensiona |
| Estrutura | `market-structure-engine.js` | **CONFIRMADO** — BOS/CHoCH importa dele |
| Saúde | `health-monitor.ts` mede; `self-diagnostics.ts` e `organism-health.ts` sintetizam | **CONFIRMADO** — zero segunda medição |
| **ATR / volatilidade** | — | **DUPLICADO** |
| **Alertas** | — | **DUPLICADO (cobertura partida)** |
| Ticker / order book / trades | WS único em `App.tsx:1453` | **CONFIRMADO** — 1 WebSocket real |

---

## 4. Mapa de duplicações

Detalhe completo em `docs/MAPA_DUPLICACAO_2026-08-18.md`. Resumo com a
classificação A–F pedida:

| Par | Veredicto | Ação |
|---|---|---|
| ATR (`lorentzian-classifier.js:196` × `regime-engine.js:163`) | mesma matemática, 2 implementações vivas | **B — consolidar** |
| Alert Center × Voice Dispatcher | cobertura disjunta do mesmo domínio | **C — uma fonte, outra derivação** |
| CVD × Delta | CVD é soma corrente do delta; delta da exaustão zera, CVD não | **A — manter ambas** |
| Volume × Volume Profile | agrega por tempo × por bucket de preço | **A** |
| Order Book × Liquidity Zones | repouso agora × inferida do histórico | **A** |
| Liquidity Zones × Sweep | `swept` é campo da própria zona | **C** |
| FVG × Order Blocks | regras geométricas diferentes | **A** |
| Structure × BOS/CHoCH | bos-choch **importa** market-structure | **C** |
| EMA × trendBias | trendBias **é** a comparação; existe uma só | **A** |
| Health ×3 | 1 medição, 2 sínteses de granularidade oposta | **A** |
| Volume Profile × TPO × `timeframe-profile` | o terceiro **não é profile** — é vocabulário de timeframe | **A** (mas ver §17: colisão de nome) |
| Múltiplas fontes de preço | 2º `fetch()` direto já removido (`engine-bridge.ts:579`) | **RESOLVIDO** |
| Risk | fonte única | **RESOLVIDO** |
| Múltiplos verdicts direcionais (32/99 módulos) | matemáticas diferentes, nenhum decide | **não é duplicação** — ver §10 |
| GMIL × Nexus | GMIL é macro global; não produz alerta nem sinal | **A** |
| LLM × motor determinístico | **DADOS INSUFICIENTES** — não auditado nesta passagem |
| Múltiplos event buses / stores | 1 store (`unified-snapshot-store`), 1 bus (`event-bus.ts`) | **RESOLVIDO** |

---

## 5. Mapa de módulos órfãos

| Módulo | Linhas | Classificação | Ação |
|---|---|---|---|
| `supertrend-engine.js` | 166 | **IMPLEMENTADO, MAS DESCONECTADO** — testado, 0 importadores | **QUARANTINE → graduar na Fase D** |
| `hmm-regime-model.js` | 383 | **ÓRFÃO por decisão documentada** (task #272) | **QUARANTINE — manter, não graduar** |
| `institutional-blocks.js` | 210 | **IMPLEMENTADO, MAS DESCONECTADO** — criado nesta sessão, 24 testes + 4 mutações | **graduar na Fase D** |
| `cross-exchange-service.ts` | 263 | **ÓRFÃO** — deferral documentado (Fase 0.6) | **QUARANTINE** |

Total: **1.022 linhas sem consumidor**, todas rastreadas e justificadas.
Nenhuma é código morto acidental. **Nenhuma deve ser removida.**

---

## 6. Mapa de sincronização

`PRODUTOR → TRANSFORMAÇÃO → ESTADO → CONSUMIDOR`

| Cadeia | Estado |
|---|---|
| WS Binance → `App.tsx:1453` → orderBook/priceData → engine | **1 WebSocket real** — risco de double-subscription baixo |
| REST 30s → `market-data-bus` → store → engine-bridge → App | **CONFIRMADO** |
| `connection-manager.ts` → heartbeat → reconexão com backoff | **CONFIRMADO** |
| BOS/CHoCH → **duas rotas**: props (App/ChartWidget) e `TerminalSnapshot` (voz) | **SINCRONIZAÇÃO IMPERFEITA** — sem fatia na store; é a causa da cobertura partida de alerta |
| Race conditions / stale data / troca de ativo com async pendente | **DADOS INSUFICIENTES** — exigiria sessão ao vivo com egress, que este ambiente não tem |

---

## 7. Mapa de frequências

**16 `setInterval` reais.** Classificados nos 4 níveis pedidos:

| Nível | Cadência | Quem | Achado |
|---|---|---|---|
| 1 — tick | evento WS | order book, trades, tape | correto |
| 2 — curto | **30 s** | `fetchSymbolDataGuarded` **e** `runCycle` | **DOIS timers na mesma cadência e no mesmo domínio** |
| 3 — análise | **60 s** | `fetchDerivativesGuarded` **e** `runMultiTimeframeCycle` | **DOIS timers na mesma cadência** |
| 3 — análise | `RADAR_SCAN_FULL_CYCLE_MS` | radar | correto |
| 4 — lento | `provider.intervalMs` | GMIL (por provedor) | correto |
| UI | 1 s | relógio | correto |
| infra | próprio | heartbeat, health snapshot, cyclone worker | correto |

**Achado:** 4 dos timers do `App.tsx` colapsam em **2 cadências
canônicas**. Não é bug — é o "múltiplos timers para o mesmo ciclo" que a
ordem manda caçar. `live-candle-sync.ts` **não** é um terceiro timer de
30 s: a menção está num comentário (verificado).

---

## 8. Mapa de decisão LONG/SHORT/WAIT

**Estado: IMPLEMENTADO, MAS RASO.** Ver §2.

O que a ordem pede em §10 e o que existe hoje:

| Pedido | Existe |
|---|---|
| Direção: bullish/bearish/neutral/**transitional** | **PARCIAL** — só ALTA/BAIXA/NEUTRO |
| Evidências: estrutura, liquidez, volume, order flow, derivados, regime, multi-TF, macro | **TODAS existem** — mas nenhuma entra na direção |
| Estado: confirmação / pré-confirmação / **conflito** / invalidação | **PARCIAL** — conflito existe (`unified-presentation.ts`), mas não é estado da decisão |
| WAIT como decisão válida | **CONFIRMADO** — `rota_c_wait` é sempre calculada com razão e gatilho de reavaliação |

**A arquitetura de evidências que a ordem pede já está construída inteira
— ela só não está ligada ao emissor.** Esse é o achado central do
sistema.

---

## 9. Mapa de cenários

`scenario-engine.ts` (contrato v2):

| Campo pedido (§11) | Existe |
|---|---|
| Cenário A / B | **CONFIRMADO** — `pathA` / `pathB` |
| **Cenário C (defesa/reversão)** | **AUSENTE** |
| direção | **sim** |
| TP1/TP2/TP3 | **sim** — `targets[]`, teto `MAX_SCENARIO_TARGETS = 3`, cada um com `sourceKind` real |
| invalidação | **sim** — nível real do lado oposto |
| entrada / stop / extensão | **AUSENTE** no cenário (existem no Trade Plan) |
| condição de ativação | **AUSENTE** |
| estado atual | **AUSENTE** |
| nível de confiança | **sim** — `opinionWeight`, com o rótulo permanente `basis: "COUNCIL_OPINION_MASS_NOT_MARKET_PROBABILITY"` |

---

## 10. Mapa de targets

**"Por que este preço?" já é respondido.** Cada `ScenarioLevel` carrega
`sourceKind` (`EQH`, `SR_RESISTANCE_1`, `FIB_61.8`, `VP_POC`…), e os
alvos do Trade Plan carregam `basis` + `obstacleCount`.

**Consolidação de fontes coincidentes — PARCIAL:**

- **Existe** para zonas de liquidez: `fuseLiquidityZones()` produz
  `FusedLiquidityZone.memberCount` — a "evidence count" exata que a ordem
  pede, mais `alpha` (o mais forte vence, nunca a média) e `isObstacle`.
- **Existe** para zonas institucionais: `InstitutionalZone` +
  `InstitutionalZoneMember`.
- **NÃO existe para os alvos.** Se 5 motores apontarem para
  praticamente o mesmo preço, o Trade Plan continua escolhendo por
  ranking, não fundindo em TARGET ZONE + EVIDENCE COUNT + SCORE.

---

## 11. Mapa de confidence × probability

**Estado: CONFIRMADO, e é o ponto mais forte do sistema.**

- `scenario-engine.ts` carrega `basis:
  "COUNCIL_OPINION_MASS_NOT_MARKET_PROBABILITY"` **no tipo** — a
  separação é estrutural, não uma convenção verbal.
- `support-resistance-engine.js:31` e `research-engine.js` declaram
  explicitamente que não estimam probabilidade por falta de backtest.
- `expectancy.ts` só fala com ≥30 trades resolvidos
  (`MIN_TRADES_FOR_VALID_EXPECTANCY`).
- `platt-calibration.ts` existe para calibrar **quando houver amostra**.

**Nada a corrigir aqui.** É o item em que o repositório já está acima do
que a ordem exige.

---

## 12. Mapa de microestrutura

| Componente | Estado |
|---|---|
| order book, bid/ask imbalance, spread, walls | **CONFIRMADO** |
| sweeps, absorption, exhaustion | **CONFIRMADO** (auditado contra microestrutura real, task #199) |
| tape, footprint, CVD, volume profile | **CONFIRMADO** |
| open interest, funding, liquidation | **CONFIRMADO** |
| **basis** | **IMPLEMENTADO, MAS NÃO CONSUMIDO** — `derivatives-provider.ts:57` calcula `basisPct`; `research-engine.js:211` ainda devolve `DADOS_INSUFICIENTES` com comentário obsoleto |
| **cross-exchange divergence** | **ÓRFÃO** — `cross-exchange-service.ts`, 0 consumidores |
| MBO | **IMPOSSÍVEL COM A INFRAESTRUTURA ATUAL** — nenhuma API pública de cripto retail expõe |

Camada mais completa do sistema.

---

## 13. Mapa visual

- 26 camadas registradas, 16 plugins, registro 5-vias com testes que
  travam espelhamento 1:1.
- Relevance Engine + Visual Budget já implementam show/hide/ênfase por
  contexto.
- Paleta canônica com teste anti-drift que varre `chart/*`.
- **Colisão de nome real:** três arquivos `*-profile` onde só dois são
  profile (`timeframe-profile.ts` é vocabulário de timeframe). Risco de
  leitura, não de execução.
- Auditoria visual profunda (§17: sobreposição, labels duplicados,
  touch targets, responsividade iPad): **DADOS INSUFICIENTES** — exige
  captura real com Playwright em sessão com dado ao vivo.

---

## 14. Mapa de voz

`computeAlerts()` em `voice-dispatcher.ts` já é um router com prioridade
(`CRITICAL`/`ALERT`/`INFO`) e anti-repetição por chave de evento
(`structureBreakKey` nunca repete o mesmo evento vivo).

**O que falta é exatamente o "único Voice Decision Router" da §19:** hoje
ele é o **segundo produtor de alertas**, não um consumidor de um produtor
único. `EVENTO → IMPORTÂNCIA → COOLDOWN → PRIORIDADE → FALA` existe, mas
a etapa `EVENTO` tem duas origens.

---

## 15. Mapa de memória

**CONFIRMADO e rastreável:** Track Record por `symbol:timeframe`,
`signal-track-record.ts`, `scenario-fingerprint.ts`,
`trade-simulation.ts` (custo real: comissão + slippage + funding),
`expectancy.ts`. Cada entrada carrega contexto de abertura, resultado e
proveniência.

**AUSENTE:** o elo `resultado → aprendizado` não realimenta nenhum
cálculo além da expectância. Não é "IA que aprende sozinha" e o
repositório nunca afirmou que fosse.

---

## 16. Mapa de performance

| Item | Medido |
|---|---|
| Bundle | llm-worker 5.887 KB · llm-bridge 5.771 KB · index 1.016 KB = **~12,7 MB** |
| Workers | **3** — `llm-worker`, `conviction-cyclone-worker`, `orderflow-heatmap-worker` |
| Main thread | 8 motores + 87 módulos + 26 camadas **calculam na main thread** |
| WASM | ativo (SMA/EMA/stddev/zscore, Volume Profile, TrustScore, Kelly) |
| FPS / latência / memória / smoke iPad Safari | **DADOS INSUFICIENTES** — exige dispositivo e sessão ao vivo |

---

## 17. Mapa de estabilidade

`health-monitor.ts` já mede latência por exchange, FPS, memória JS,
status de workers, freshness e offline, publicando via `HEALTH.CHANGED`.
`connection-manager.ts` faz heartbeat + reconexão com backoff.
Fail-closed é o comportamento padrão de todos os motores auditados.

**AUSENTE:** o contrato formal `NORMAL → DEGRADED → LIMITED →
FAIL_CLOSED` como máquina de estados única. Hoje a degradação é real mas
distribuída por módulo, sem um estado global declarado.

---

## 18. Tecnologias investigadas

| Tecnologia | Aplicabilidade | Veredicto |
|---|---|---|
| **OffscreenCanvas** | mover desenho das 26 camadas para worker | **CANDIDATO** — mas §26 da ordem proíbe sem iniciativa isolada. Concordo. |
| **WASM SIMD** | já em uso (binários scalar+SIMD) | **JÁ IMPLEMENTADO** |
| **Ring buffer** | histórico de tape/CVD | **CANDIDATO** — ganho real de GC |
| **Change-point detection online** | detectar mudança de regime sem janela fixa | **CANDIDATO FORTE** — é o tipo de profundidade que a decisão precisa |
| **Calibração probabilística** | `platt-calibration.ts` já existe | **JÁ IMPLEMENTADO, esperando amostra** |
| WebGPU | render | **DESCARTADO** — sem benchmark que justifique; §26 proíbe |
| SharedArrayBuffer / WASM threads | paralelismo | **DESCARTADO** — exige COOP/COEP, quebra o PWA local-first |
| CRDT | estado colaborativo | **DESCARTADO** — não há multiusuário |
| RL / agentes | decisão | **DESCARTADO agora** — §14 exige baseline validado antes |

**Princípios de sistemas críticos (§21) já presentes:** watchdog
(heartbeat), health monitoring, graceful degradation, fail-safe,
provenance, bounded retry com backoff. **Ausentes:** state reconciliation
formal e checkpoint/recovery.

---

## 19. Backlog priorizado

### P0 — integridade (dado incorreto ou decisão incoerente)
- **P0.1** Unificar produtor de `AlertEvent`. Hoje um evento real
  (BOS/CHoCH) é falado e não é visto; outro (sweep) é visto e não é
  falado. Mesma verdade, dois canais desalinhados.
- **P0.2** Dar rota canônica a BOS/CHoCH (fatia na store + evento no
  bus) — é a causa raiz de P0.1 e está documentada como pendência real
  no próprio `alert-center.ts`.

### P1 — decisão
- **P1.1** **Fase A: backtest sem look-ahead** sobre histórico real com
  proveniência. `structural-backtest.js` e a captura já existem. Sem
  isto, tudo abaixo é troca de heurística não validada por outra.
- **P1.2** Ligar `basis` ao frame do Core Engine e corrigir o comentário
  obsoleto de `research-engine.js:211`.
- **P1.3** Cenário C (defesa/reversão) + condição de ativação e estado
  atual nos cenários A/B.
- **P1.4** TARGET ZONE com evidence count para alvos — reusando
  `fuseLiquidityZones`, que já faz exatamente isso para zonas.

### P2 — performance
- **P2.1** Unificar as 2 cadências duplicadas (30 s e 60 s).
- **P2.2** LLM sob demanda — corta ~80% do primeiro acesso.
- **P2.3** Core Engine → Worker. **Isolada, sozinha, nunca junto.**

### P3 — clareza
- **P3.1** Unificar ATR (task #342), conferindo antes o período efetivo
  de `regime-engine`.
- **P3.2** Renomear `timeframe-profile.ts` (colisão de nome).
- **P3.3** Auditoria visual profunda com captura real.

### P4 — evolução
- **P4.1** Graduar `institutional-blocks` e `supertrend-engine`.
- **P4.2** Contrato formal `NORMAL → DEGRADED → LIMITED → FAIL_CLOSED`.
- **P4.3** Change-point detection online.

---

## 20. Ordem exata de implementação

1. **P0.2** (rota canônica de BOS/CHoCH) — habilita P0.1.
2. **P0.1** (produtor único de alerta; voz e UI viram consumidores).
3. **P1.1** (backtest) — **portão**: nada de P1.3/P1.4/P4.1 antes disto.
4. **P1.2** (basis) — barato, independente.
5. **P2.1** (cadências) — barato, independente.
6. **P3.1** (ATR).
7. **P1.3 / P1.4** (cenário C, target zone).
8. **P4.1** (graduar motores dormentes).
9. **P2.2** (LLM sob demanda).
10. **P2.3** (Core Engine → Worker) — **sozinha**.

---

## 21. Testes obrigatórios e critérios de aceitação

Antes de declarar qualquer fase concluída:

- `tsc --noEmit` limpo · build de produção · **suíte completa** (baseline
  atual: **3.454 testes / 209 arquivos / 0 falhas**).
- **Prova de não-duplicação:** teste que falhe se existir mais de um
  produtor de `AlertEvent`; teste que falhe se `computeAtrPercent` for
  reimplementado.
- **Prova de sincronização:** teste de troca de ativo e de timeframe com
  requisição async pendente.
- **Prova de rastreabilidade da decisão:** teste que verifique que
  `engine.direction` tem origem única e citável.
- **Prova de READ_ONLY:** teste que falhe diante de qualquer string de
  envio de ordem ou chave de API — em qualquer arquivo.
- **Prova de fail-closed:** entrada vazia/inválida devolve
  `DADOS_INSUFICIENTES`, nunca zero.
- Mutação deliberada em toda matemática nova, como já é praxe aqui.
- **Benchmarks de FPS/latência/memória e smoke iPad Safari: se não forem
  medidos, NÃO declarar como validados.**

---

## 22. Checklist final

- [ ] Um só produtor de `AlertEvent`; voz e UI só consomem.
- [ ] BOS/CHoCH com fatia na store e evento no bus.
- [ ] Backtest real executado; número publicado como veio.
- [ ] `basis` chegando ao frame; comentário obsoleto corrigido.
- [ ] Uma cadência canônica por domínio.
- [ ] Um só ATR.
- [ ] Cenário C existindo.
- [ ] Alvos com evidence count.
- [ ] `READ_ONLY` + `FAIL_CLOSED` intactos e testados.
- [ ] Nenhuma funcionalidade removida sem prova de redundância.

---

## 23. O que NÃO fazer

Reafirmado da ordem e confirmado pela auditoria:

- Não adicionar indicador. A proporção contexto/decisão já está
  invertida.
- Não consolidar os 15 pares que **não** são duplicação.
- Não remover as 1.022 linhas órfãs — todas são quarentena justificada.
- Não substituir `trendBias()` por outra heurística **antes** do
  backtest. Seria trocar uma regra não validada por outra.
- Não mover render para WebGPU/Worker sem benchmark e sem iniciativa
  isolada.
- **Não construir Camada F (shadow/paper com integração de ordem).**
  READ_ONLY é inviolável sob qualquer reformulação. Paper trading manual
  local já existe e continua permitido.

---

## 24. Critério de "sistema vivo"

A cadeia `DADOS → CONTEXTUALIZAÇÃO → ANÁLISE → CONFLUÊNCIA → CENÁRIOS →
RISCO → DECISÃO → MONITORAMENTO → EVENTO → VOZ → RESULTADO → MEMÓRIA →
REAVALIAÇÃO` **existe inteira e é rastreável**, com dois pontos frouxos
já nomeados: **DECISÃO** (6 linhas) e **EVENTO→VOZ** (dois produtores).

Fechados P0 e P1.1, o critério passa a ser cumprido de verdade.

---

## 25. Ordem final, executável

**Contexto:** a auditoria está feita e medida. Não repetir a auditoria.

**Fazer, nesta ordem, uma fase por entrega:**

**Fase 1 — P0.2 + P0.1 (alertas).**
Arquivos: `nexus/alert-center.ts`, `voice/voice-dispatcher.ts`,
`voice/voice-intents.ts`, `store/unified-snapshot-store.ts`,
`nexus/event-bus.ts`, o `OrganismOrchestrator`.
Criar a fatia de BOS/CHoCH na store (4 lugares, domínio §4 Cérebro,
seguindo o campo mais recente do mesmo domínio) e o evento no bus.
Migrar `alert-center.ts` para produzir os 8 eventos da tabela §14.
Converter `voice-dispatcher.computeAlerts()` em **consumidor**: mantém
prioridade, cooldown e anti-repetição; perde a detecção própria.
Teste que falhe se surgir um segundo produtor.
**Não mudar nenhuma matemática.**

**Fase 2 — P1.1 (backtest).**
Arquivos: `structural-backtest.js`, a captura de histórico com
proveniência, `tools/measure-reversal-lead.mjs`.
Rodar sem look-ahead, out-of-sample, walk-forward, múltiplos regimes,
com custo real. Publicar o número **como vier**. Se vier ruim, o
resultado é o entregável.

**Fase 3 — P1.2 + P2.1 + P3.1 (dívidas baratas).**
`basis` até o frame; comentário obsoleto de `research-engine.js:211`
corrigido; 4 timers → 2 cadências; ATR unificado após conferir período.

**Depois disso, e só depois:** P1.3, P1.4, P4.1, P2.2 e — sozinha —
P2.3.

**Preservar sem exceção:** READ_ONLY, FAIL_CLOSED, zero dado sintético,
LEI 24, "confluência nunca é probabilidade", `golden-master.html`,
`src/orderflow/` só aditivo.

---

## 26. Nota final de honestidade

Três coisas desta ordem **não puderam ser medidas** neste ambiente e
estão marcadas como **DADOS INSUFICIENTES**, não estimadas: race
conditions em sessão ao vivo, benchmarks de FPS/latência/memória em iPad
Safari, e a auditoria visual profunda por captura real. Todas exigem
egress de rede e/ou dispositivo — nenhum dos dois existe aqui.

E a maior de todas: **desempenho de mercado**. Nada neste documento
afirma que o AR10 acerta ou erra. A Fase 2 existe justamente para
transformar essa lacuna em número.
