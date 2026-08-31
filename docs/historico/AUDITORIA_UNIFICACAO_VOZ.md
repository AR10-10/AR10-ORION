# AR10 — Auditoria: Unificação da Inteligência/Voz Central

> **Pedido:** Diretriz de Continuidade "Unificação da Inteligência Central"
> (upload do Operador) — Fase 1 (§6.1): auditoria sem alterar código.
> **Escopo:** arquitetura lógica central. Sobrevivência em segundo plano
> (Service Worker/`visibilitychange`) fica fora por pedido explícito do
> próprio documento (§8, regra 9) — já registrada como iniciativa isolada
> própria na auditoria anterior desta sessão.
> **Método:** evidência real (`file:line`), zero suposição — mesma
> disciplina do resto do repositório.

---

## 0. Correção da tabela de arquivos recebida (§1.1 do documento)

O documento lista `context/`, `structure/`, `liquidity/`, `scenario/`,
`trade-plan/`, `track-record/`, `event-bus/` como diretórios próprios.
Nenhum desses diretórios existe. Os motores reais são arquivos individuais
dentro de `ramber-ui/src/nexus/` (TypeScript, puro) ou
`ipad_runtime/src/*/` (JavaScript, puro, importado direto por
`ramber-ui/src`). Tabela corrigida:

| Nome no documento | Caminho real |
|---|---|
| Context/Structure Engine | `ipad_runtime/src/market-regime/regime-engine.js` (`classifyMarketRegime`) |
| Liquidity Engine | `ramber-ui/src/nexus/institutional-zones.ts` + `nexus/trap-detection.ts` |
| Risk Engine | `ipad_runtime/src/risk/risk-engine.js` (`buildRiskSuggestion`) |
| Scenario Engine | `ramber-ui/src/nexus/scenario-engine.ts` (`buildScenarioProjection`) |
| GMIL | `ramber-ui/src/gmil/` — confere |
| Voice Engine | `ramber-ui/src/voice/` (5 arquivos) — confere |
| Alert Center | `ramber-ui/src/nexus/alert-center.ts` — confere (caminho completo) |
| Trade Plan / Track Record | `nexus/trade-plan.ts` + `nexus/signal-track-record.ts` |
| Event Bus | `nexus/event-bus.ts` — confere como arquivo, não diretório; **existe um segundo, `gmil/event-bus.ts`, achado novo desta rodada (§3 abaixo)** |

---

## 1. Mapa do estado atual (§4.2.1)

### 1.1 Ciclos contínuos reais (produtores com clock próprio)

| Ciclo | Local | Cadência |
|---|---|---|
| Core Engine | `App.tsx:1579` `setInterval(runCycle, 30000)` | 30s |
| Multi-timeframe (6 TFs) | `App.tsx:1608` `setInterval(runMultiTimeframeCycle, 60000)` | 60s |
| Radar scanner | `App.tsx:1720`, `RADAR_SCAN_FULL_CYCLE_MS` (`App.tsx:584`) | 5min |
| REST/derivatives | `App.tsx:1366-1367` | 30s/60s |
| GMIL (5 providers) | `gmil/gmil-orchestrator.ts:120`, intervalos próprios `:27-75` | 90s–300s |

Nenhum tem tratamento de aba em segundo plano (fora de escopo aqui, já
registrado na auditoria anterior).

### 1.2 Motores puros por domínio (recomputados a cada ciclo, sem clock próprio)

| Motor | Arquivo | Produz |
|---|---|---|
| Zonas institucionais | `nexus/institutional-zones.ts:78-84,149` | `InstitutionalZone[]` (cluster de 11 fontes reais) |
| Traps/Sweep | `nexus/trap-detection.ts:61-71,92` | `TrapSignal[]` |
| Regime | `ipad_runtime/src/market-regime/regime-engine.js:187,234-249` | `{regime, direction, evidence:{adx,...}}` |
| Risco | `ipad_runtime/src/risk/risk-engine.js:127-138` | `{suggested_position_pct, kelly_cap_pct, effective_win_rate,...}` |
| Cenário | `nexus/scenario-engine.ts:61-68,72` | `{pathA, pathB}` (opinião do Council, nunca probabilidade de mercado) |
| Corredor de confluência | `nexus/confluence-corridor.ts:65-76,96` | `{intensity 0..1, components}` |
| Decisão unificada (só acionável) | `nexus/decision-layer.ts` | `NexusDecision` — operação/confiança/entrada/stop/TP1-3/motivo |
| Consenso não-direcional | `nexus/evidence-fusion.ts:8-26,81-94` | cobertura/consenso — **nunca** stance/score combinado, por design |
| Expectativa real | `nexus/expectancy.ts:54-114,142-189` | `ExpectancyStats`, `FilterResult` (≥30 trades reais) |
| Trade Plan | `nexus/trade-plan.ts:51-72` | `TradePlan` (Council-gated) |
| Track Record | `nexus/signal-track-record.ts` | `TrackRecordState` (histórico resolvido) |

### 1.3 Voz — 5 arquivos, mais completos do que o documento supõe

| Arquivo | Papel |
|---|---|
| `voice/voice-engine.ts` | TTS puro — fila de prioridade (`CRITICAL/ALERT/INFO`), `speak(text, priority)` |
| `voice/voice-recognition.ts` | STT — só push-to-talk, **de propósito** (comentário no código: "prometer 'always listen' seria mentir sobre o que o Safari sustenta") |
| `voice/voice-intents.ts` | Request-response — `matchIntent`/`buildResponse` sobre `TerminalSnapshot` |
| `voice/voice-dispatcher.ts:21-141` | **Proativo, já em produção** — `computeAlerts(prev,next)`, diff puro, 7 categorias reais (vetor, divergência Lorentziana, liquidação, absorção, saúde do motor, BOS/CHoCH, ciclo de vida do Trade Plan + queda de convicção) |
| `voice/VoiceControlWidget.tsx` | Única superfície React |

### 1.4 Alert Center

`nexus/alert-center.ts` — `deriveTrackRecordAlert` (linha 87, só
TARGET_HIT/PARTIAL_HIT/STOP_HIT, REPLACED excluído por design) e
`deriveSweepAlert` (linha 154, STOP_HUNT_TOPO/FUNDO). Desde o commit
`0e70dfb` (esta sessão), `AlertEvent` tem campo opcional `speech?: string`
— só `deriveSweepAlert` o preenche.

### 1.5 GMIL — narrativa quase nula, LLM é sistema separado

`gmil/gmil-voice-alerts.ts`'s `describeProviderHealthChange()` fala só
mudança de estado de circuit breaker — **não** narra cenário/risco/análise
de mercado como o documento supõe. O LLM local (`llm-bridge.ts` +
`llm-worker.ts`, Llama 3 via WebLLM) é um sistema **totalmente separado**
de GMIL (zero import cruzado, confirmado por grep) — opt-in (botão,
~5GB), um tiro só (sem loop), nunca falado (zero `voiceEngine` no
arquivo). `synthetic-reading.ts` (narrativa sempre-ligada, baseada em
regras) também nunca é falado.

---

## 2. Grafo de fluxo (§4.2.2)

Não existe UM grafo hoje — existem **3 pipelines reais, paralelos,
independentes**, cada um com seu próprio Transformador+Decisor fundidos
numa função de diff, convergindo só no destino final
(`voiceEngine.speak`):

```
PIPELINE 1 — voice-dispatcher (o mais antigo, o mais completo)
  engine/realCycle + Lorentzian + order flow + trade-plan + track-record
    → App.tsx:2938 useMemo<TerminalSnapshot>  [Normalização própria]
    → computeAlerts(prev, next)               [Transformador+Decisor fundidos]
    → voiceEngine.speak                        [Falante]
    → (sem Registrador — prevVoiceSnapshotRef só serve ao próximo diff,
       não é uma memória consultável por fora)

PIPELINE 2 — alert-center (o mais novo, parcialmente ligado)
  trap-detection.ts / signal-track-record.ts
    → organism-orchestrator.ts                 [publica no bus real]
    → App.tsx:3221 / App.tsx:3246 (2 assinaturas)
    → deriveTrackRecordAlert / deriveSweepAlert [Transformador+Decisor fundidos]
    → setAlerts (toast, sempre) + voiceEngine.speak (só Sweep, só desde 0e70dfb)
    → Registrador PARCIAL: seenSweepIdsRef / lastTrackRecordEntryRef —
      cada um isolado no seu próprio efeito, nenhum consultável de fora

PIPELINE 3 — GMIL (o mais isolado)
  5 providers REST → gmil-orchestrator.ts (circuit breakers)
    → gmilBus (gmil/event-bus.ts, import em App.tsx:315)
       [BUS PRÓPRIO — achado novo, não é nexus/event-bus.ts]
    → App.tsx:9260 gmilBus.on("PROVIDER_HEALTH_CHANGED", ...)
    → gmil-voice-alerts.ts's describeProviderHealthChange (App.tsx:9270)
       [Transformador+Decisor]
    → voiceEngine.speak                         [Falante]
    → (sem Registrador dedicado)
```

**Dead-ends confirmados** (produzem, mas não alimentam nenhum pipeline):

- `institutionalZones` — motor real, campo real na store, **sem evento no
  bus** (achado já registrado na auditoria anterior — nenhum consumidor
  pode reagir a "uma zona nova se formou" sem antes existir o evento).
- `riskSuggestion` — nem chega à store; vive só como `useMemo` local em
  `App.tsx` (achado já registrado).
- `llm-bridge.ts` / `synthetic-reading.ts` — dead-end **intencional**
  (opt-in, um tiro só, nunca conectado à voz).

---

## 3. Duplicações (§4.2.3)

A tabela do documento recebido assume duplicação ampla. A auditoria real
encontra algo mais preciso: **hoje só 1 evento real tem computação
duplicada** (Track Record); o resto do medo do documento é sobre o que
vai acontecer se mais motores forem ligados à voz sem uma política
central — real, mas ainda não materializado.

| Evento real | Sistemas que reagem | Overlap hoje |
|---|---|---|
| Trade Plan aberto / zona de entrada / alvo provado | voice-dispatcher (fala) | 1 sistema, sem overlap |
| Trade Plan resolvido (TARGET_HIT/PARTIAL_HIT/STOP_HIT) | voice-dispatcher (fala, via diff de `TerminalSnapshot`) **e** alert-center (toast, via bus) | **2 sistemas, mesma resolução real, 2 leituras independentes.** Não duplica FALA hoje só porque `deriveTrackRecordAlert` foi deliberadamente impedido de ganhar `speech` (decisão registrada + travada por teste no commit `0e70dfb`) — mas a computação em si já é dupla. |
| Trade Plan resolvido = REPLACED | voice-dispatcher (fala) | alert-center exclui por design — diferença de escopo real, não bug |
| Liquidity Sweep | alert-center (toast + fala) | 1 sistema — voice-dispatcher não tem categoria de sweep |
| Mudança de vetor / BOS-CHoCH / liquidação / absorção | voice-dispatcher (fala) | 1 sistema cada |
| Circuit breaker do GMIL | gmil-voice-alerts (fala) | 1 sistema, por um 3º bus totalmente separado |
| Cenário / Regime / Risco / Confluência | **nenhum fala hoje** | 0 sistemas — isto é gap, não duplicação |

---

## 4. Gaps que impedem uma leitura única (§4.2.4)

1. `institutionalZones` sem evento no bus.
2. `riskSuggestion` fora da store compartilhada.
3. `decision-layer.ts`'s `NexusDecision` é o candidato mais próximo de
   "leitura única" mas cobre só campos acionáveis — não carrega zonas,
   regime, risco ou corredor de confluência.
4. **3 buses/mecanismos de evento distintos**: `nexus/event-bus.ts`,
   `gmil/event-bus.ts` (achado novo), e o diff local do voice-dispatcher
   (que não é um bus — é um `useEffect` comparando snapshots).
5. Nenhuma `VoiceMemory` consultável — 3 memórias isoladas
   (`prevVoiceSnapshotRef`, `seenSweepIdsRef`, `lastTrackRecordEntryRef`),
   nenhuma exposta a um consumidor externo.
6. Nenhuma política de relevância central — cada pipeline decide sozinho
   com sua própria regra ad hoc.
7. Dedup por identidade existe (mesmo sweep não fala 2x); dedup por
   **categoria/cooldown** não existe — nada impede sweep + BOS + vetor
   disparando em sequência no mesmo ciclo de 30s.
8. `probability` calibrada continua, por design, **inexistente** (Regra
   de Ouro 2) — qualquer `MarketReading.scenarios.confidence` futuro
   precisa ficar `null`/`DADOS_INSUFICIENTES` sempre. Gap permanente,
   não um bug a corrigir.
9. Segundo plano — fora de escopo aqui (§8 regra 9 do documento recebido).

---

## 5. Avaliação honesta do contrato proposto (§5 do documento)

O contrato `MarketReading` é implementável reaproveitando dado que já
existe quase por completo — **a exceção é a política de relevância em
si**, que precisa ser escrita do zero:

**Já existe o dado, falta só o "encaixe":**
`context.regime` deveria usar as strings reais de `regime-engine.js`
(`TENDENCIA_FORTE/MODERADA/COMPRESSAO/BREAKOUT/CONSOLIDACAO`), não as que
o documento supõe (`TRENDING/RANGING/CHOPPY`). `scenarios.primary/
alternatives` mapeia para `pathA/pathB` do `scenario-engine.ts` (hoje
exatamente 2 paths, não uma lista arbitrária — reshape leve, não
matemática nova). `risk.rrr/expectancy` mapeia direto para
`trade-plan.riskRewardRatios` + `expectancy.ts`. `scenarios.confidence`
mapeia para o `basis: 'COUNCIL_OPINION_MASS_NOT_MARKET_PROBABILITY'' já
documentado no próprio `scenario-engine.ts`.

**Existe o dado, mas falta a lógica de diff (a política de relevância
§5.2 do documento, item a item):**

| Regra de relevância proposta | Dado existe? | Lógica de diff existe? |
|---|---|---|
| Trade Plan atinge entrada/alvo/stop | Sim | **Sim** (voice-dispatcher item 7) |
| BOS/CHoCH | Sim | **Sim** (voice-dispatcher item 6) |
| Sweep + confluência estrutural | Sim (separados) | Não — combinação nova |
| Mudança de cenário principal (A→B) | Sim (recomputado a cada ciclo) | Não — não existe "cenário anterior" persistido pra comparar |
| Mudança de regime | Sim | Não |
| R:R muda >20% | Sim | Não |
| Confluência atinge 80+ (novo máximo) | Sim | Não — não existe "máximo corrido" |
| **Alerta de risco (drawdown próximo do limite)** | **Não, conceitualmente** | — |

O último item merece nota própria: este é um sistema **READ_ONLY**, sem
posição real aberta, sem equity curve real — "drawdown" no sentido do
documento (perda de portfólio se aproximando de um limite) não tem
denominador real hoje. Um equivalente honesto seria "preço se aproximando
do stop do Trade Plan ativo" (dado real, `nexus/trade-plan.ts`), que é
conceitualmente diferente de drawdown de portfólio — precisa ser
redefinido antes de virar código, não implementado como está escrito.

---

## 6. Conclusão da Fase 1

Auditoria concluída, zero código alterado (conforme pedido). O quadro
real é mais favorável do que o documento supõe em alguns pontos (voz
proativa já madura, maior parte dos motores já produz dado real e
tipado) e revela um achado novo que o documento não via (`gmil/
event-bus.ts` é um SEGUNDO bus de eventos, não o mesmo `nexus/
event-bus.ts` — são 3 mecanismos de decisão, não 2 mais um caso avulso).

**Escopo real da Fase 2** (contrato de tipos, ainda sem migrar nenhum
`speak()` existente, por §6.2/§8 regra 7 do documento — não remover
funcional antes de substituto testado): caberia ao Operador confirmar se
o próximo passo é montar o contrato `MarketReading` completo agora, ou
resolver primeiro a única duplicação REAL já existente (Track Record,
§3 acima) como passo isolado e menor antes da arquitetura completa.
