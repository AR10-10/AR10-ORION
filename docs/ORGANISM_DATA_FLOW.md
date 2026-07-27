# O Fluxo de Dados do Organismo AR10-CYBORG

> Ordem "Próxima Evolução do Organismo" — o AR10-CYBORG funciona como **um
> único organismo vivo e coeso**, não como um conjunto de módulos
> independentes. Este documento é o mapa oficial de como o dado circula, e o
> contrato que toda evolução futura obedece.

Camada central de orquestração ("sistema nervoso"):
`ipad_runtime/ramber-ui/src/nexus/` — **Nexus Core** (`nexus-core.ts`, ciclo
de vida + a única instância real do bus) + **Typed Event Bus**
(`event-bus.ts`, contrato tipado de eventos) + **Organism Orchestrator**
(`organism-orchestrator.ts`, gateway de leitura versionado + tradutor
escrita→evento), sobre o **UnifiedGlobalSnapshot**
(`store/unified-snapshot-store.ts`, o objeto de fusão, domínios §1–§5).

---

## As três leis de circulação

1. **Leitura** — todo motor/serviço lê o organismo **exclusivamente** através
   do UnifiedGlobalSnapshot:
   - contexto imperativo (serviços, motores, futuros workers):
     `getSnapshotForEngine()` — visão versionada
     (`ENGINE_SNAPSHOT_CONTRACT_VERSION = 1`), sequenciada (`seq` = geração do
     organismo) e tipada **só com estado** (as ações ficam fora do tipo: motor
     lê, nunca escreve fora da própria fatia). Consumidor real hoje: o Health
     Monitor.
   - contexto React (UI, HUD, NucleoVoiceOrb): os seletores atômicos da
     própria store (`useCouncilSnapshot`, `usePriceSnapshot`, ...) — a MESMA
     fonte, com assinatura reativa por fatia.
2. **Publicação** — todo motor entrega sua saída como **escrita de UMA fatia**
   do snapshot (actions §3/§4/§5). O Organism Orchestrator assina a store UMA
   vez e traduz cada escrita real em **exatamente um evento tipado** no bus,
   com payload = a **mesma referência** escrita (zero cópia, zero segunda
   forma do dado). Motores nunca chamam `emit()` diretamente.
3. **Zero comunicação motor→motor** — toda interação passa pela camada
   central. O caso que existia (o Conselho entregava a variável `decision` em
   mãos ao Motor de Cenários, no mesmo efeito) foi eliminado: o Conselho
   escreve `council`, a store notifica, o Motor de Cenários relê a decisão da
   fatia (`useCouncilSnapshot`) — e `BRAIN.COUNCIL.UPDATED` sai no bus para
   qualquer futuro assinante, sem que o Conselho saiba que ele existe.

## O fluxo, ponta a ponta

```
1. ENTRADA (dado real, único coletor: App.tsx; conectores dormentes no CrossExchangeService)
   WebSocket preço/livro (Binance Futures) · REST funding/OI · REST trades (MEXC)
   cross-checks Bybit/OKX · navigator.onLine · requestAnimationFrame (FPS real)
        │  espelhado por efeitos de sincronização (nenhuma segunda rede)
        ▼
2. MOTORES (processamento — Main Thread sagrada)
   WASM quant-worker: volume_profile · trust_score · sma/ema/zscore (fora da main)
   Puros em nexus/: council (6 agentes + Meta-Agent) · scenario-engine ·
   trap-detection · fibonacci-confluence · affective-memory (decaimento lazy)
        │  cada motor ESCREVE sua fatia (setCouncil, setScenario, setVolumeProfile, ...)
        ▼
3. UNIFIEDGLOBALSNAPSHOT (fusão — §1 MERCADO · §2 SÉRIES · §3 QUANT · §4 CÉREBRO · §5 ORGANISMO)
   uma fatia por dado, um dono por fatia; null explícito = fail-closed honesto
        │  Organism Orchestrator (assinatura única da store; seq += 1 por transição)
        ▼
4. TYPED EVENT BUS (notificação — Nexus Core, publicador único por evento)
   QUANT.* · BRAIN.* · ORGANISM.* (orquestrador) · HEALTH.CHANGED (Health Monitor)
   DATA.* (CrossExchangeService) · UI.*/OFFLINE.CHANGED (orquestrador)
        │
        ▼
5. CONSUMO
   UI/HUD (seletores atômicos: gráfico, VolumeProfilePlugin, CouncilWidget, cenários A/B)
   NucleoVoiceOrb (engineStatus/offline/CPI reais) · futuros motores (bus + gateway)
```

Latência da mediação: a divisão conselho→cenário custa um commit de re-render
(<1 frame) entre decisão e projeção — o preço honesto de nenhum motor tocar
no outro.

## Catálogo de eventos e seus publicadores únicos

Um evento nunca tem dois emissores. Payload de saída de motor = o contrato da
própria fatia (referência idêntica à escrita na store).

| Evento | Payload | Publicador único |
| --- | --- | --- |
| `DATA.CANDLES_UPDATED` / `DATA.ORDERBOOK_UPDATED` / `DATA.CONNECTION_CHANGED` | símbolo/tf/exchange/estado | CrossExchangeService (Fase 0.5, dormente) |
| `HEALTH.CHANGED` | `HealthSnapshot` | Health Monitor (2 s) |
| `UI.SYMBOL_CHANGED` / `UI.TIMEFRAME_CHANGED` / `OFFLINE.CHANGED` | símbolo/tf/offline | Organism Orchestrator (primeiro emissor vivo destes tipos da Fase 0) |
| `QUANT.VOLUME_PROFILE.UPDATED` | `{ profile: VolumeProfileSnapshot \| null }` | Organism Orchestrator |
| `QUANT.FIBONACCI.UPDATED` | `{ matrix: FibonacciConfluenceMatrix \| null }` | Organism Orchestrator |
| `QUANT.SMC.UPDATED` | `{ zones: SmcZonesSnapshot \| null }` (FVG/OB/liquidez, OMEGA CORE V-MAX Fase 1.1) | Organism Orchestrator |
| `QUANT.CVD.UPDATED` | `{ cvd: number \| null }` (Fase 1.1) | Organism Orchestrator |
| `QUANT.ORDERFLOW_SIGNALS.UPDATED` | `{ signals: OrderflowSignal[] }` (Fase 1.1) | Organism Orchestrator |
| `QUANT.CONFLUENCE_CORRIDOR.UPDATED` | `{ reading: ConfluenceCorridorReading \| null }` (Fase 5, contrato v2 — conviction (ConvictionReading inteira) + obstáculos, zero probabilidade; v1 tinha 4 componentes com dupla contagem real, corrigido — ver SYSTEM_HANDBOOK.md §6.40) | Organism Orchestrator |
| `BRAIN.COUNCIL.UPDATED` | `{ decision: CouncilDecision \| null }` | Organism Orchestrator |
| `BRAIN.SCENARIO.UPDATED` | `{ projection: ScenarioProjection \| null }` | Organism Orchestrator |
| `BRAIN.TRAPS.UPDATED` | `{ traps: TrapSignal[] }` | Organism Orchestrator |
| `BRAIN.TRADE_PLAN.UPDATED` | `{ plan: TradePlan \| null }` (entry zone / stop / target from real structure) | Organism Orchestrator |
| `BRAIN.RADAR_CANDIDATES.UPDATED` | `{ candidates: RadarQualificationResult[] }` (OMEGA CORE V-MAX Fase 7 completa; ADITIVO V-MAX Etapa 9 estendeu o universo de Binance-only para Binance + MEXC paginado — só candidatos JÁ qualificados/ranqueados, `rankRadarCandidates`, cada um com `provider` de proveniência) | Organism Orchestrator |
| `ORGANISM.TRUST.UPDATED` | `{ score: TrustScoreSnapshot \| null }` | Organism Orchestrator |
| `ORGANISM.AFFECT.UPDATED` | `{ cpi, memory }` (uma ingestão real = um evento) | Organism Orchestrator |
| `ORGANISM.TRACK_RECORD.UPDATED` | `{ record: TrackRecordState }` (honest first-touch signal accuracy, persisted) | Organism Orchestrator |

O bus é **notificação**, o snapshot é **estado**: não há replay. Todo
consumidor novo faz a leitura inicial pelo snapshot e então assina o bus —
nunca o contrário.

## Observadores puros read-only (OMEGA CORE V-MAX Fase 3/7)

Três módulos em `nexus/` não escrevem fatia nenhuma e não publicam
evento — são **avaliadores/extratores puros**, chamados sob demanda ou
por um orquestrador impuro externo, lendo/recebendo só o que já é real em
outro lugar:

- **`nexus/stage-runner.ts`** (`traceStages(snapshot, seq)`) — formaliza o
  Pipeline canônico (§2 do `SYSTEM_HANDBOOK.md`) como 4 estágios
  inspecionáveis hoje (`DATA → CORE_ENGINE → COUNCIL → TRADE_PLAN`), cada
  um `{ok, reason}` — fail-closed causal (nenhum `ok=true` depois de um
  `ok=false`). Os 2 últimos elos do pipeline §2
  (`buildNexusDecision`/`OperationalReadability`) ainda não têm fatia
  própria — não rastreáveis por este módulo ainda, gap honesto registrado.
- **`nexus/radar-qualification.ts`** (`qualifyRadarCandidate`/
  `rankRadarCandidates`) — Fase 7 (Radar/OIH): avalia UM candidato já
  pronto (estrutura + Trade Plan + riskGated + Corredor de Confluência,
  todos já reais) contra o filtro mínimo da diretiva, sem recalcular nada.
  Chamado repetidamente pelo efeito de scan em lote de `App.tsx` (ver
  abaixo) — o próprio módulo continua sem saber de rede/tempo/UI.
- **`nexus/radar-universe.ts`** (`extractRadarUniverseSymbols`) — filtra
  `configs/asset-universe.default.json` aos grupos `asset_class ===
  "CRYPTO"` (exclui o grupo de equities de mineração/IA) e deduplica por
  símbolo. Puro sobre um import estático — zero I/O próprio.

O lado **impure** que liga os dois acima ao mundo real vive em
`engine-bridge.ts` (mesma convenção do arquivo: toda função que busca
rede mora lá, nunca num módulo `nexus/*` puro): `scanRadarCandidate(symbol,
timeframe)` busca candles reais (`requestFuturesCandleSnapshot`), roda os
motores puros já existentes (`analyzeMarketStructure`/
`analyzeSupportResistance`/`classifyMarketRegime`), monta um `TradePlan`
real (S/R apenas — sem FVG/OB, custo de fetch extra não vale para
varredura de fundo) com `riskGated: false` sempre honesto (nenhum
Conselho roda para candidatos de fundo), e uma confluência-leve: monta
sua própria `ConvictionReading` "leve" via `buildConvictionReading`
(confluence-engine.ts, ensemble/council `null` honestos, só o membro
Multi-Timeframe é legível sobre 3 prazos de referência) e alimenta essa
leitura inteira em `computeConfluenceCorridor` (Fase 5, contrato v2) —
zero segunda fórmula de pool, mesmo motor que o ativo selecionado usa. O
efeito em `App.tsx` orquestra o LOTE (3 candidatos + 2s de respiro, ciclo
completo a cada 5min, exclui `selectedAsset`) e escreve o resultado
ranqueado na fatia `radarCandidates` — nenhum dos 2 módulos puros acima
sabe que um scanner ou um timer existe.

## Receita de evolução 100% aditiva (motor novo)

Integrar um motor novo **sem modificar nenhum módulo existente de motor**:

1. Contrato versionado próprio em `src/nexus/<motor>.ts` (módulo puro).
2. Fatia própria + action no UnifiedGlobalSnapshot (adição no domínio certo,
   §1→§5; null/vazio honesto como default) + seletor atômico.
3. Leitura exclusiva via `getSnapshotForEngine()` (ou seletores, em React).
4. Um caso novo de diff no Organism Orchestrator + um membro novo na união
   `NexusEvent` (extensão de união é aditiva por definição).
5. Testes na suíte de sincronização + reset da fatia nos RESETs das suítes de
   store/health.

O Nexus Core, o bus, a store e os motores existentes permanecem intocados.

## Fail-Closed em cada estágio

- **Entrada**: sem WS/REST real → fatia fica no vazio honesto (`null`, `[]`,
  `pending`); nada é interpolado. Regra de Ouro 1: zero mocks, zero
  `Math.random()` no fluxo de mercado.
- **Motores**: sem insumo real → `ABSTAIN` (conselho, riskGated), `null`
  (VP/fib/cenário/trust), lista vazia (armadilhas). Degradação declarada,
  nunca disfarçada.
- **Snapshot**: troca de ativo zera séries e derivações (`null` explícito é
  transição REAL — assinantes sabem que o dado se foi, nunca exibem resultado
  velho de outro ativo).
- **Bus**: handler com exceção nunca derruba os demais nem o publicador
  (try/catch por assinante). Consequência para testes: asserção dentro de
  handler seria engolida — a suíte coleta nos handlers e afirma fora.
- **Orquestrador**: parado → a publicação para, mas `getSnapshotForEngine()`
  continua devolvendo o estado real (fail-closed no contador `seq`, nunca no
  conteúdo). Nada é fabricado, agendado ou interpolado; custo por transição =
  comparações `===` por fatia (Main Thread sagrada).

## Insumos pré-store (estado honesto e rota de migração)

`smcZones` (FVG/OB/EQH-EQL) e o S/R do motor legado (`engine.support/
resistance`, rótulos de estrutura) vivem como estado React do coletor único
(App.tsx) e ainda não têm fatia na store; conselho/cenário/armadilhas os
recebem como parâmetro do próprio coletor — dado real do MESMO commit de
render, não comunicação motor→motor. Migração futura (aditiva, pela receita
acima): fatia `§3 smc` + leitura via gateway. `cvd`/`orderflowSignals` idem
(o histórico real já está em §2 `orderflowHistory`).

## Provas de sincronização (suíte real)

`tests/nexus-organism-orchestrator.test.ts` (21 testes): visão versionada
(contrato/seq/zero-cópia) · um write = um evento com a mesma referência ·
null fail-closed publicado · escrita idêntica = zero eventos espúrios ·
causalidade preservada (ordem dos writes = ordem dos eventos) · ingestão
afetiva atômica (memória+cpi = uma geração) · publicador único
(HEALTH.CHANGED nunca sai do orquestrador) · idempotência StrictMode ·
cadeia fim-a-fim conselho→store→bus→cenário sem contato direto · travas de
fonte (App.tsx sem handoff direto; Health Monitor lendo pelo gateway).
Complementos: `nexus-core.test.ts` (bus/ciclo de vida),
`unified-snapshot-store.test.ts` (fusão), `nexus-health-monitor.test.ts`.
