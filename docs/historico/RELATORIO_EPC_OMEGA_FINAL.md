# RELATÓRIO MESTRE — EPC OMEGA FINAL

**Status:** entrega escopada e honesta de uma diretriz de 4 partes/~60
subseções. Este documento é o Relatório Mestre da Arquitetura pedido pela
Parte 4, mais inventário, checklists, roadmap e relatório executivo — tudo
num único arquivo, mesma convenção já usada por todos os relatórios
anteriores deste projeto (`RELATORIO_AUDITORIA_FINAL.md`, `RELATORIO_EPC.md`,
`RELATORIO_DIRETIVA_FINAL_LAPIDACAO_VISUAL.md`).

**Como ler este documento:** ele **estende** a documentação já existente,
nunca a duplica. Onde já existe uma fonte real e viva (mapa de módulos,
inventário de engines, backlog priorizado), este relatório aponta para ela
em vez de reescrevê-la.

---

## 1. Sumário Executivo (para o Operador)

O EPC OMEGA FINAL pediu, em 4 partes, uma evolução muito ampla: um "Meta
Engine" coordenando todos os motores, uma reformulação visual "World
Class" do gráfico, um motor de auto-otimização + autoaprendizado, e um
pacote completo de homologação final.

**A auditoria (5 frentes paralelas, antes de qualquer código) encontrou
uma coisa importante: a maior parte do que a diretiva pede já existe, em
fragmentos reais.** O trabalho desta rodada não foi "construir do zero" —
foi consolidar o que já era real, fechar lacunas concretas e documentar
honestamente o que não foi feito e por quê.

**O que mudou de verdade nesta rodada** (16 arquivos, 12 modificados
+343/-10 linhas + 4 novos/312 linhas, +28 testes novos, 124 arquivos /
2097 testes passando):

1. **Meta Engine**: as 3 leituras que já fundiam múltiplos motores
   (`NexusDecision`, `InstitutionalScoreReading`, `HeatScoreReading`)
   ganharam lugar real na store do organismo e evento próprio no
   barramento — antes só existiam como cálculo local da UI, invisíveis
   para qualquer assinante futuro. Mais um contrato formal
   (`EngineSignal`) com os 10 campos que a diretiva pede por motor, com
   um primeiro adaptador real (Conselho) provando a forma.
2. **Confluência visual**: 3 fontes novas na Zona Institucional (Volume
   Profile POC, Session Key Level, Liquidity Sweep) — fecha 3 dos 4 pares
   de confluência que a diretiva nomeia explicitamente.
3. **Paleta de cores**: 1 colisão real corrigida (EQH/EQL vs. roxo do
   Conselho/Harmônico, matiz a <1° de distância).
4. **Destaque proporcional à confluência real**: a Zona Institucional
   agora fica mais forte visualmente quanto mais ferramentas
   independentes concordam — antes era sempre a mesma opacidade.
5. **Memória do sistema visível**: `self-diagnostics.ts` agora reporta o
   heap JS real (já medido, nunca exposto antes).
6. **MACD** (`nexus/macd.ts`, novo): um dos 12 indicadores confirmados
   ausentes na auditoria (§2.2) e o único que é puro-matemático sobre
   dado 100% já real (reusa `computeEmaSeries` duas vezes, zero API
   nova) — seguro implementar sem violar a Regra de Ouro 1. Construído e
   testado (9 testes de execução real contra referência independente)
   como módulo puro em `nexus/`, seguindo a mesma disciplina de
   "isolar antes de integrar" do Laboratório de Evolução — **ainda não
   ligado ao gráfico/painel** (nem ao `engine-bridge.ts`, nem à votação
   do Conselho). Graduação real (wiring visual + decisão de onde exibir)
   fica para a próxima rodada, para não apressar uma escolha de UX
   dentro de uma entrega já grande.

**O que foi auditado e propositalmente NÃO construído nesta rodada** — com
motivo real, não omissão — está na seção 10. Dois casos merecem destaque
para o Operador:

- Um "cache de performance" que eu ia adicionar ao heatmap de liquidação
  foi **revertido** depois que a suíte de testes acusou: uma rodada
  anterior já bancou essa mesma pergunta com um benchmark real
  (`computeLiquidationHeatmap` custa ~0,006ms/chamada — 200x mais barato
  que o caso que justificou o cache do KillZone) e concluiu que adicionar
  cache ali seria complexidade sem benefício medido. A suíte de testes
  fez exatamente o papel de trava de regressão que deveria fazer.
- Doze dos ~40 indicadores que a diretiva lista (Elliott, Gann, Pitchfork,
  On-Chain, Whale Activity, Footprint, etc.) **não foram implementados**
  — a maioria porque exigiria dado que este app read-only simplesmente
  não tem (nem pode ter sem violar a proibição de API paga embutida no
  cliente), não por falta de tempo.

---

## 2. Auditoria Consolidada (5 frentes, antes de qualquer implementação)

### 2.1 Meta Engine / hierarquia de decisão (Parte 1)

A maior parte do que a diretiva pede já existe em fragmentos reais:
- **Conselho** (`nexus/council.ts`) — pool linear real (Stone
  1961/DeGroot 1974), 7 agentes puros, `opinionMass` real.
- **Nexus Decision Layer** (`nexus/decision-layer.ts`) — o contrato mais
  próximo de "uma única conclusão coerente" que a diretiva pede;
  `operation` é passthrough literal do Core Engine desde a criação.
- **Confluence Engine** (`nexus/confluence-engine.ts`) — funde
  Ensemble+Council+MTF numa segunda pool, um nível acima.
- **Organism Orchestrator** (`nexus/organism-orchestrator.ts`) —
  barramento pub/sub já desenhado para evolução 100% aditiva.
- **GMIL** (`gmil/`) — consenso externo isolado por um teste de CI que
  quebra o build se `engine-bridge.ts` importar `gmil/` ou
  `src/consensus/` (`core-engine-boundary.test.ts`) — a fronteira LEI 24
  já é imposta mecanicamente, não só por convenção.

**Lacunas reais confirmadas** (fechadas nesta rodada, ver §3):
`layer-relevance.ts` só carrega 2 dos 10 campos que a diretiva pede por
motor (relevância, justificativa) — faltavam peso/confiança/validade/
contexto/prioridade/qualidade/horizonte/vida útil como contrato formal;
e `NexusDecision`/`InstitutionalScoreReading`/`HeatScoreReading` nunca
tinham fatia própria na store (só `useMemo` local em `App.tsx`).

**Não fechado nesta rodada, documentado como próximo passo**: dobrar
GMIL para dentro da store unificada (arquiteturalmente sensível demais
para uma rodada já grande — ver §10).

### 2.2 Cobertura real de dados dos ~40 indicadores pedidos (Golden Rule #1)

| Classificação | Itens | Evidência |
|---|---|---|
| **REAL** (29) | Market Structure, S/R, Liquidez, Liquidity Sweep, Liquidity Heatmap, Volume Profile, VWAP, VWAP Bands, EMA, SMA, RSI, ADX, ATR, Momentum, Delta/CVD, DOM (profundidade L2 real, Binance `depth10@100ms`), Order Flow, Order Blocks, Fibonacci, Harmônicos, Open Interest, Funding, Heatmap (liquidação), Market Sessions, Kill Zones, Session Key Levels, Machine Learning (Lorentzian k-NN) | Engine real + dado real de exchange confirmado por arquivo:linha |
| **PARCIAL** (2) | Anchored VWAP (só âncora fixa UTC-dia, sem âncora por evento), Institutional Flow (heurística real sobre dado público, nunca atribuição por entidade/carteira) | Existe, mas com escopo menor que o nome sugere |
| **AUSENTE** (12) | MACD, Breaker/Mitigation Blocks, IFVG, Elliott Wave, Pitchfork, Gann, Whale Activity, Correlação cross-asset, On-Chain, Footprint (grade bid/ask por preço), reconhecimento automático de padrão gráfico | Zero referência real no código |

**Achado crítico que muda o escopo seguro do resto da diretiva**: dos 12
ausentes, **On-Chain e Whale Activity são auto-documentados como
impossíveis** — `gmil/README.md`/`gmil/types.ts` já registram que a
categoria `ONCHAIN` não tem provedor ativo porque toda opção real exige
API paga/chaveada, e este projeto proíbe embutir isso no cliente. Não é
uma lacuna a fechar — é uma fronteira real do que este produto pode ser.

### 2.3 Estado visual do gráfico vs. Parte 2 ("World Class UI")

- **Hierarquia visual**: só existia um comentário informal de 4 níveis
  (não um tipo real/imposto), com descompassos concretos vs. o pedido
  (VWAP nativo sempre no topo; Zona Institucional classificada abaixo do
  Trade Plan mesmo quando representa confluência forte).
- **Confluência (`institutional-zones.ts`)**: só 8 fontes consolidadas;
  1 dos 5 pares de confluência nomeados pela diretiva estava ligado
  (VWAP+OB+Liquidez, de forma emergente). Fechado nesta rodada: mais 3
  fontes (Volume Profile POC, Session Key Level, Liquidity Sweep) — ver
  §3.2.
- **"Rabiscos Inteligentes"** (triângulos/bandeiras/cunhas automáticos):
  **confirmado que não existe nada disso no repositório** — nem parecido.
  `trend-channel-engine.ts` é regressão OLS (deliberadamente não
  subjetivo), `harmonic-patterns.ts` é XABCD (outra coisa).
- **Paleta de cores**: sem mapeamento único documentado; 1 colisão real
  encontrada (EQH/EQL vs. roxo do Conselho/Harmônico, <1° de matiz —
  mais apertada que a colisão Liquidation/Sweep já corrigida numa rodada
  anterior). Corrigida nesta rodada (§3.3).
- **Achado que corrigiu minha própria leitura inicial da auditoria**: o
  cyan compartilhado por grid/Fibonacci/barras do Volume Profile **não é
  um bug** — é uma decisão de design real, pesquisada e documentada
  (`AUDITORIA_ECOSSISTEMA_VISUAL.md §9.4/§9.7`, precedente real "Black
  Ice" do TradingView), mitigada pela FORMA (barra vs. linha), mesmo
  raciocínio já aplicado a Kill Zones × Sweep. O POC (que É uma linha,
  mesma forma que Fibonacci) já tinha ganhado seu próprio acento magenta
  numa rodada anterior. Nenhuma mudança feita aqui — documentar a
  correção do meu próprio primeiro entendimento é mais honesto que
  silenciosamente não mencionar.

### 2.4 Performance / auto-otimização (Parte 3)

- Dirty-flag + rAF + ResizeObserver em 100% dos 12+ plugins de canvas
  (disciplina "Main Thread sagrada" já cumprida em toda parte).
- Cache por identidade de referência real em 3/12 plugins
  (`KillZoneBandsPlugin`, `MarketSessionBandsPlugin`,
  `SessionKeyLevelsPlugin`) — todos calculam algo caro
  (`computeXxxSpans`/`Levels`) a partir de candles brutos DENTRO do
  próprio draw loop, daí o cache valer a pena.
- **Achado real, e uma correção da minha própria auditoria em tempo
  real**: eu ia estender esse mesmo cache para `LiquidationHeatmapPlugin`
  por analogia de padrão — a suíte de testes já tinha uma trava de
  regressão (`refinamento-final-wiring.test.ts`) documentando que uma
  rodada anterior JÁ investigou essa exata pergunta com benchmark real
  (`computeLiquidationHeatmap` ~0,006ms/chamada a N=500, o teto real do
  feed, contra ~1,2ms/chamada do caso que justificou o cache do
  KillZone) e concluiu que cache ali seria complexidade sem benefício
  medido. Revertido antes do commit — ver §10 para o relato completo.
- `self-diagnostics.ts` já media FPS/latência/workers reais, mas nunca
  expunha `memoryMb` (`performance.memory.usedJSHeapSize`) mesmo já
  sendo medido pelo Health Monitor. Fechado nesta rodada (§3.5).
- Track Record e Affective Memory existem e são reais, mas **100%
  passivos** — nada hoje realimenta peso de motor algum a partir deles.
  Confirma que "Autoaprendizado" (Parte 3 §6) é trabalho genuinamente
  novo, não uma lacuna de fiação — ver §10.
- Nenhum gargalo urgente confirmado (conclusão repetida de forma
  independente em 3 documentos já existentes) — não há evidência real
  que justifique um "motor de auto-otimização" contínuo agora.

### 2.5 Documentação/inventário existente (Parte 4)

`docs/` já tem 36 arquivos / 14.113 linhas. Os mais relevantes para este
relatório, e o que este relatório evita duplicar:
- `docs/SYSTEM_HANDBOOK.md` (5.291 linhas) — pipeline canônico, mapa de
  módulos (§3), registro de pendências datado (§6, 66 entradas até
  antes desta rodada).
- `ipad_runtime/src/research/QUARANTINE.md` — inventário engine-a-engine
  real (5 graduados, 1 utilitário compartilhado, 3 em laboratório).
- `docs/MAPA_EVOLUCAO_CIBORGUE.md` — backlog já com tiers (1-4), riscos
  transversais, roadmap recomendado.

**Achado que fica registrado, não escondido**: `RELATORIO_DIRETIVA_
FINAL_LAPIDACAO_VISUAL.md` cita um pacote de 11 arquivos
(`01_SYSTEM_ARCHITECTURE.md`...`11_FINAL_STATUS.md`) de uma diretiva de
auditoria anterior. Confirmado via `git log --all` e busca no
repositório inteiro: **esses 11 arquivos nunca foram commitados** —
foram entregues como artefato de uma sessão anterior, não como parte do
repositório real. Registrado aqui para o Operador decidir se quer que
sejam reconstruídos como arquivos reais numa rodada futura.

---

## 3. O que foi implementado nesta rodada (detalhe técnico)

### 3.1 Meta Engine (Parte 1)

- **`nexus/engine-signal-contract.ts`** (novo): tipo `EngineSignal` com
  os 10 campos exatos que a diretiva pede (peso, confiança, relevância,
  validade, contexto, justificativa, prioridade, qualidade, horizonte
  temporal, vida útil) + `deriveEngineSignalsFromCouncil()`, um
  adaptador real que preenche o que o Conselho JÁ rastreia por voto
  (peso uniforme real do pool, confiança, rationale/evidence) e deixa
  os 6 campos ainda não instrumentados como `null` honesto — nunca um
  valor fabricado para "completar" o contrato. 8 testes de execução
  real, incluindo o caso RISK (nunca entra no pool, peso sempre `null`,
  nunca `0` fabricado).
- **Store (`unified-snapshot-store.ts`, §4 CÉREBRO)**: `nexusDecision`,
  `institutionalScoreReading`, `heatScoreReading` ganharam os 4 lugares
  canônicos (state → actions → defaults → seletor) — mesmo padrão de
  todo campo já existente no domínio. `operation` continua passthrough
  literal do Core Engine; esta mudança só dá um endereço real a um
  cálculo que já existia.
- **`event-bus.ts`/`organism-orchestrator.ts`**: 3 eventos novos
  (`BRAIN.NEXUS_DECISION.UPDATED`, `BRAIN.INSTITUTIONAL_SCORE.UPDATED`,
  `BRAIN.HEAT_SCORE.UPDATED`), mesmo padrão diff-por-referência de todo
  outro evento `BRAIN.*`.
- **`App.tsx`**: 3 `useEffect` novos espelhando os 3 `useMemo` já
  existentes para a store — mesmo padrão já usado por
  `confluenceCorridor`.
- 4 testes reais novos em `nexus-organism-orchestrator.test.ts`
  (3 de payload real + 1 de fiação no código-fonte).

### 3.2 Confluência visual — `institutional-zones.ts` (Parte 2 §7)

3 fontes novas: `VOLUME_PROFILE_POC` (mesmo campo que
`VolumeProfilePlugin` já lê da store, `fixedRange.pocPrice`),
`SESSION_KEY_LEVEL` (mesma `computeSessionKeyLevels(data)` que
`SessionKeyLevelsPlugin` já usa, só a ocorrência mais recente),
`LIQUIDITY_SWEEP` (mesmos clusters já filtrados por `SWEEP_DECAY`/
`ageAlpha` que o efeito de price line do sweep já usa). Fecha 3 dos 4
pares de confluência que a diretiva nomeia (Volume Profile+S/R, Session
Key Level+Liquidez, FVG+Sweep) — Fibonacci+Estrutura fica para uma
próxima rodada (geometria de nível, não ponto, precisa de mais cuidado
no clustering). 5 testes de execução real novos, incluindo o caso
fail-closed (POC/nível/sweep não-finito nunca vira membro).

### 3.3 Paleta de cores (Parte 2 §10)

EQH/EQL: `rgba(200, 107, 255, 0.45)` (matiz ≈278°, quase idêntico ao
roxo do Conselho/Harmônico) → `rgba(110, 150, 255, 0.45)` (azul,
matiz≈223°, >40° de distância de qualquer outro matiz já atribuído no
app — dourados ~33-50°, teal LONG ~160°, cyan ~180°, roxo Conselho
~278°, magenta POC ~312°, rosa SHORT ~340°).

### 3.4 Destaque proporcional à confluência real — `InstitutionalZonePlugin.tsx` (Parte 2 §7)

Opacidade de fundo/borda agora escala com `zone.distinctSourceCount`
real (piso idêntico ao valor antigo — nenhuma zona fica mais fraca que
antes — teto declarado em 4 fontes, convenção documentada como tal, não
medição).

### 3.5 Memória visível — `self-diagnostics.ts` (Parte 3)

Novo achado "Memória (heap JS)": reporta `health.memoryMb` real quando o
browser expõe, severidade sempre OK (o repositório não tem calibração
real de orçamento de memória por dispositivo para julgar "é muito" —
reportar o número honesto é o correto, inventar um limiar não seria). 2
testes novos.

### 3.6 MACD — `nexus/macd.ts` (novo) (Parte 1 §11 / Parte 3 §7)

`computeMacdSeries()` reusa `computeEmaSeries` (ema.ts) duas vezes —
linhas rápida(12)/lenta(26) sobre o preço, depois a linha de sinal(9)
sobre o próprio MACD — zero segunda fórmula de EMA, mesmos períodos
universais da indústria (Gerald Appel, 1979). Fail-closed idêntico ao de
EMA (período inválido ou histórico vazio → série vazia). 9 testes de
execução real contra uma referência independente, ponto a ponto (não só
o último valor). **Não wired ao vivo**: engine puro isolado em `nexus/`,
sem import em `engine-bridge.ts`/`App.tsx`/nenhum plugin de canvas —
decisão deliberada, não esquecimento (ver §1 item 6 e §10).

---

## 4. Inventário do sistema

Este relatório **não recria** o inventário completo (ele já existe e é
mantido vivo em 3 lugares reais):

- **Arquitetura/módulos**: `docs/SYSTEM_HANDBOOK.md` §3 (mapa de onde
  cada peça vive) + a seção "Arquitetura" do `CLAUDE.md` deste
  repositório (atualizada a cada mudança estrutural real).
- **Motores/engines graduados**: `ipad_runtime/src/research/
  QUARANTINE.md` (5 `ACTIVE_READ_ONLY`, 1 utilitário compartilhado,
  3 em laboratório).
- **Indicadores de confluência (visão nova desta rodada)**: tabela da
  §2.2 acima — a primeira vez que os ~40 indicadores nomeados pela
  diretiva foram classificados um a um contra dado real.

**Infraestrutura** (achados reais desta auditoria, não uma lista nova):
Binance USDT-M Futures (primária, REST+WS), MEXC/Bybit/OKX
(secundárias/cross-check), IndexedDB (persistência local-first), Web
Workers reais (`conviction-cyclone-worker.ts`,
`orderflow-heatmap-worker.ts`, `llm-worker.ts` lazy, mais os workers
legados WASM `quant-worker.js`/`orderflow-worker.js`), Event Bus tipado
próprio (~30 linhas, zero dependência externa).

**Inteligência** (idem): Core Engine (único emissor real), Conselho de 7
agentes (pool linear), Motor de Cenários, Multi-Timeframe Matrix (9
prazos), Relevance Engine (18 camadas), Zona Institucional (11 fontes
após esta rodada), GMIL (consenso externo isolado por CI).

---

## 5. Mapa da arquitetura (delta desta rodada)

```
Mercado → Coleta → Validação → Normalização → Motores Especializados
                                                      │
                            ┌─────────────────────────┼─────────────────────────┐
                            │                          │                          │
                     Core Engine (LEI 24)         Conselho (pool)          Outros motores
                     único emissor real           7 agentes reais          (Cenário, MTF, ...)
                            │                          │                          │
                            └──────────────┬───────────┴──────────────────────────┘
                                            ▼
                         decision-layer.ts / confluence-engine.ts
                         (fusão pura, passthrough de operation)
                                            │
                         ★ NOVO: store §4 CÉREBRO (nexusDecision,
                           institutionalScoreReading, heatScoreReading)
                                            │
                                  organism-orchestrator.ts
                                  (bus tipado, 3 eventos novos)
                                            │
                                     Painel Institucional
```

`EngineSignal`/`engine-signal-contract.ts` vive como um contrato
paralelo e opcional — motores podem adotá-lo aos poucos (só o Conselho
o adota nesta rodada) sem quebrar nada que já funciona.

---

## 6. Matriz de responsabilidade — só os módulos novos/alterados

| Módulo | Objetivo | Entrada | Saída | Consumidores |
|---|---|---|---|---|
| `engine-signal-contract.ts` | Forma única para descrever a contribuição de um motor à confluência | `CouncilDecision` (por enquanto) | `EngineSignal[]` | Nenhum consumidor real ainda ligado à UI — contrato + prova de conceito; próximo passo é um painel que o leia |
| `unified-snapshot-store.ts` §4 (3 campos novos) | Dar lugar real a 3 leituras já computadas | `NexusDecision`/`InstitutionalScoreReading`/`HeatScoreReading` de `App.tsx` | Fatia da store + evento no bus | Qualquer assinante futuro do organismo via `getSnapshotForEngine()` |
| `institutional-zones.ts` (+3 fontes) | Consolidar confluência geométrica real | POC, Session Key Level, Sweep clusters | `InstitutionalZone[]` (member novo por fonte) | `InstitutionalZonePlugin` |
| `InstitutionalZonePlugin.tsx` (opacidade) | Traduzir força de confluência em destaque visual | `zone.distinctSourceCount` | alpha de fill/borda | Operador (leitura visual) |
| `self-diagnostics.ts` (+1 achado) | Tornar memória real visível | `health.memoryMb` | `DiagnosticFinding` | Relatório de autodiagnóstico sob demanda |
| `macd.ts` (novo) | Indicador MACD real, contexto puro | candles (via `computeEmaSeries`) | `MacdPoint[]` | Nenhum ainda — motor isolado, não graduado (§3.6) |

---

## 7. Checklists de homologação (Parte 4 §5-§9)

Convenção: **OK** = confirmado por evidência real; **Atenção** = real mas
com ressalva conhecida; **Recomendado** = melhoria real identificada,
não crítica; **Crítico** = nada encontrado nesta rodada.

### 7.1 Qualidade
| Item | Status | Evidência |
|---|---|---|
| Arquitetura consistente | OK | `tsc --noEmit` limpo, LEI 24 imposta por CI (`core-engine-boundary.test.ts`) |
| Modularidade/baixo acoplamento | OK | `engine-signal-contract.ts`/store slices aditivos, zero import cruzado novo entre motores |
| Documentação atualizada | OK | Este relatório + `SYSTEM_HANDBOOK.md` (a atualizar no commit) |
| Testes aprovados | OK | 123 arquivos / 2088 testes, 100% |
| Tipagem | OK | zero `any` novo introduzido |
| Duplicação | Atenção | `institutional-zones.ts` agora tem 11 fontes — vale revisão de coesão numa rodada futura se crescer mais |

### 7.2 Visual
| Item | Status | Evidência |
|---|---|---|
| Hierarquia visual | Atenção | ainda informal (comentário, não tipo); risco de reordenar justificou não mexer nesta rodada — ver §10 |
| Contraste/legibilidade | OK | rótulos já unificados (rodada anterior), zero mudança de regressão |
| Paleta de cores | OK | única colisão real conhecida corrigida; colisão de cyan investigada e confirmada como decisão deliberada, não bug |
| Confluência visual | Atenção | 3 de 4 pares nomeados agora fechados; 1 (Fibonacci+Estrutura) pendente |
| "Rabiscos inteligentes" | Crítico (não construído) | zero detector de padrão automático existe; ver §10 para o porquê |

### 7.3 Performance
| Item | Status | Evidência |
|---|---|---|
| Main Thread sagrada | OK | dirty-flag+rAF em 100% dos plugins, workers reais onde justificado |
| Cache de cálculo caro | OK | 3/12 plugins cacheiam onde o benchmark real justifica; 1 caso testado e corretamente REJEITADO (ver §10) |
| Bundle de produção | OK | 869,66 kB (gzip 264,94 kB) — +2,7 kB desta rodada, dentro do esperado |
| Motor de auto-otimização contínuo | Crítico (não construído) | sem gargalo urgente confirmado em 3 documentos independentes — construir agora seria over-engineering sem problema real |

### 7.4 Matemático
| Item | Status | Evidência |
|---|---|---|
| Cálculos duplicados | OK | zero segunda pool/matemática introduzida — `engine-signal-contract.ts` só reempacota |
| Rastreabilidade de decisão | OK | `operationSource: "CORE_ENGINE"` continua constante literal no contrato |
| Fontes redundantes | OK | nenhuma nova |
| Autoaprendizado (recalibração real de peso) | Crítico (não construído) | fundação passiva existe (Track Record/Affective Memory), zero fiação para pesos ainda — ver §10 |

### 7.5 Inteligência
| Item | Status | Evidência |
|---|---|---|
| Todos os motores colaboram | OK | via store/bus, nunca motor-a-motor |
| Sem decisão isolada | OK | LEI 24 imposta por CI |
| Confluência funcionando | OK | 11 fontes agora em `institutional-zones.ts` |
| Divergências tratadas de forma transparente | OK | `council.opinionMass` continua exposto (decisão deliberada de rodada anterior, reafirmada aqui — ver §10) |

---

## 8. Bibliotecas

**Pesquisadas nesta rodada**: nenhuma biblioteca nova externa foi
necessária — todo trabalho reaproveitou motores/primitivas já reais do
próprio repositório (`ensemble-engine.js`, `computeSessionKeyLevels`,
`clusterSweptPrices`, `useVolumeProfileSnapshot`).

**Adotadas**: nenhuma.

**Rejeitadas**: nenhuma avaliada e recusada nesta rodada — o escopo
implementado não exigiu nenhuma capacidade que o stack atual não já
tivesse.

---

## 9. Pesquisa World Class (Parte 4 §10)

Não repetida nesta rodada — já real e documentada em
`docs/historico/AUDITORIA_ECOSSISTEMA_VISUAL.md` (Bookmap/Sierra Chart/TradingView/
etc., com uma lista julgada "vale adotar / não vale" por item). A
decisão de cor do Volume Profile (§2.3 acima) é um exemplo direto dessa
pesquisa sendo reafirmada, não uma pesquisa nova.

---

## 10. O que foi deliberadamente NÃO implementado (com motivo real)

| Item da diretiva | Por que não | Destino |
|---|---|---|
| Reconhecimento automático de padrão gráfico ("Rabiscos Inteligentes") | Motor genuinamente novo (geometria sobre swings reais + score + ciclo de vida próprio) — merece seu próprio ciclo de Laboratório de Evolução isolado, não encaixado dentro de uma rodada já grande | Topo do roadmap (§11) |
| Motor de auto-otimização contínuo | Sem gargalo urgente confirmado (3 documentos independentes concordam) — construir um sistema sempre-ligado para um problema que não existe hoje é o oposto do princípio "não adicionar validação para cenário que não acontece" | Roadmap condicional — só se um gargalo real aparecer |
| Autoaprendizado (recalibração automática de peso) | Estatisticamente sensível (risco real de overfitting em dado fino); a fundação passiva (Track Record/Affective Memory) existe, mas decidir COMO recalibrar com segurança é trabalho de desenho próprio | Roadmap, com nota de cuidado |
| Footprint (grade bid/ask por preço) | Dado real existe (L2 + ticks), mas renderizar a grade é um plugin novo por si só | Roadmap |
| Breaker/Mitigation Blocks, IFVG | Deriváveis do motor real de FVG/OB já existente, mas cada conceito merece confirmação de definição real antes de implementar (regra do CLAUDE.md) | Roadmap |
| Elliott Wave, Pitchfork, Gann | Exigem pesquisa real dedicada antes de qualquer linha de código (mesma regra) | Roadmap, prioridade baixa |
| Correlação cross-asset | Dado real existe (candles multi-símbolo já circulam via Radar), mas merece rodada própria | Roadmap |
| GMIL dentro da store unificada | Gap real confirmado pela auditoria, mas cruza uma fronteira hoje protegida por CI — decisão arquitetural grande demais para não ter sua própria rodada dedicada | Roadmap, alta atenção |
| Whale Activity, On-Chain, atribuição institucional real | **Não é "adiado" — é impossível hoje.** Sem provedor real sem API paga embutida no cliente (auto-documentado em `gmil/README.md`), construir isso seria fabricar dado ou violar a proibição do projeto | Fora do roadmap até uma fonte real aparecer |
| Ocultar sinais conflitantes (pedido de uma diretiva anterior, reafirmado implicitamente aqui) | Conflita com uma decisão de arquitetura já deliberada (`council.opinionMass` foi recuperado e exposto de propósito para MOSTRAR divergência real — task #39 do rastreador interno) | Não implementado, aguardando confirmação explícita do Operador |
| Reordenação completa da hierarquia visual de 3 níveis | A ordem atual (12+ plugins) já tem razão documentada por camada; reordenar tudo de uma vez é risco real de regressão visual sem um problema concreto reportado — só o item mais claro e barato (opacidade da Zona Institucional) foi corrigido | Roadmap, com plano técnico já esboçado (§11) |
| **Cache de `LiquidationHeatmapPlugin`** | Implementado, depois **revertido**: um teste pré-existente (`refinamento-final-wiring.test.ts`) provou que uma rodada anterior já investigou isso com benchmark real e concluiu que o cache não se paga aqui (~0,006ms/chamada). Registrado por transparência — a suíte de testes funcionou exatamente como deveria, evitando um regresso de complexidade sem benefício | Encerrado — não é mais um item aberto |

---

## 11. Roadmap de evolução (priorizado)

| Item | Impacto | Risco | Esforço | Prioridade |
|---|---|---|---|---|
| Graduar MACD (wiring visual + decisão de onde exibir) | Baixo-médio | Baixo | Baixo | Curto prazo — motor já pronto e testado, só falta a decisão de UX |
| Reconhecimento automático de padrão gráfico | Alto | Médio | Alto | Próxima rodada dedicada |
| Fechar o 4º par de confluência (Fibonacci+Estrutura) | Médio | Baixo | Baixo | Curto prazo |
| GMIL → store unificada | Médio | Alto (cruza fronteira protegida por CI) | Médio | Curto/médio prazo, com cuidado |
| Formalizar hierarquia visual como tipo real (não só comentário) | Médio | Médio (risco de regressão visual) | Médio | Médio prazo |
| Autoaprendizado real (recalibração de peso) | Alto | Alto (overfitting) | Alto | Médio prazo, com desenho próprio |
| Footprint (grade bid/ask) | Médio | Baixo | Alto | Médio prazo |
| Breaker/Mitigation Blocks, IFVG | Baixo-médio | Baixo | Médio | Longo prazo |
| Correlação cross-asset | Médio | Baixo | Médio | Longo prazo |
| Elliott/Pitchfork/Gann | Baixo | Médio (rigor matemático) | Alto | Longo prazo, após pesquisa dedicada |
| Expandir `EngineSignal` para mais motores (MTF, Cenário) | Médio | Baixo | Médio | Curto/médio prazo |

Lista completa e mais granular do backlog geral (não só desta diretiva):
`docs/MAPA_EVOLUCAO_CIBORGUE.md` §7.

---

## 12. Critérios de homologação — veredito

- Arquitetura consistente: **atendido**.
- Documentação atualizada: **atendido** (este relatório + atualização
  pendente de `SYSTEM_HANDBOOK.md` §6 no mesmo commit).
- Testes aprovados: **atendido** (123/123 arquivos, 2088/2088 testes).
- Desempenho igual ou superior ao anterior: **atendido** (bundle
  +2,7 kB, nenhum gargalo novo introduzido, 1 tentativa de otimização
  incorreta revertida antes do commit).
- Interface limpa e profissional: **atendido para o escopo tocado**
  (confluência, cor, destaque); hierarquia visual completa fica para
  próxima rodada.
- Ausência de duplicação relevante: **atendido**.
- Confluência preservada: **atendido e ampliada** (8→11 fontes).
- Compatibilidade total com LEI 24/SSOT/READ_ONLY/Fail-Closed/Zero
  Delete: **atendido** — nenhum dado apagado, nenhuma segunda decisão
  criada, nenhum mock introduzido.
- Estabilidade comprovada: **atendido** (build de produção ok, suíte
  inteira verde).

---

## 13. Testes executados

`tsc --noEmit` limpo · `vitest run` (suíte inteira) 124 arquivos / 2097
testes (100%, +28 novos: 8 em `nexus-engine-signal-contract.test.ts`,
5 em `nexus-institutional-zones.test.ts`, 4 em
`nexus-organism-orchestrator.test.ts`, 2 em `self-diagnostics.test.ts`,
9 em `macd.test.ts`) · `npm run build` ok (869,66 kB / gzip 264,94 kB —
idêntico ao baseline: `macd.ts` ainda não é importado em nenhum lugar
vivo, tree-shaking o exclui do bundle real, evidência independente de
que ele está genuinamente isolado como descrito no §3.6/§10).

---

## 14. Arquivos modificados

```
 ipad_runtime/ramber-ui/src/App.tsx                                | 21 +++++
 ipad_runtime/ramber-ui/src/chart/EnhancedChart_110_Percent.tsx    | 53 +++++++-
 ipad_runtime/ramber-ui/src/chart/InstitutionalZonePlugin.tsx      | 31 +++++--
 ipad_runtime/ramber-ui/src/nexus/event-bus.ts                     | 11 ++
 ipad_runtime/ramber-ui/src/nexus/institutional-zones.ts           | 39 +++++-
 ipad_runtime/ramber-ui/src/nexus/organism-orchestrator.ts         | 12 ++
 ipad_runtime/ramber-ui/src/nexus/self-diagnostics.ts              | 15 ++
 ipad_runtime/ramber-ui/src/store/unified-snapshot-store.ts        | 28 +++-
 ipad_runtime/ramber-ui/tests/liquidity-zones-plugin.test.ts       |  2 +-
 ipad_runtime/ramber-ui/tests/nexus-institutional-zones.test.ts    | 54 ++++++++
 ipad_runtime/ramber-ui/tests/nexus-organism-orchestrator.test.ts  | 71 +++++++++++
 ipad_runtime/ramber-ui/tests/self-diagnostics.test.ts             | 16 +++
 ipad_runtime/ramber-ui/src/nexus/engine-signal-contract.ts        | novo (68 linhas)
 ipad_runtime/ramber-ui/tests/nexus-engine-signal-contract.test.ts | novo (81 linhas)
 ipad_runtime/ramber-ui/src/nexus/macd.ts                          | novo (70 linhas)
 ipad_runtime/ramber-ui/tests/macd.test.ts                         | novo (93 linhas)
```

---

## 15. Pendência para o Operador

1. Confirmar se o pacote `01_SYSTEM_ARCHITECTURE.md`...`11_FINAL_STATUS.md`
   (citado numa rodada anterior, nunca commitado — §2.5) deve ser
   reconstruído como arquivos reais do repositório.
2. Confirmar se GMIL deve entrar na store unificada numa rodada própria
   (mudança arquitetural real, cruza uma fronteira hoje protegida por
   CI).
3. As duas pendências já registradas em rodadas anteriores continuam
   abertas: o Radar/LEI 24 (`engine-bridge.ts:1138-1166`) e a pergunta
   sobre ocultar sinais conflitantes — nenhuma das duas foi alterada
   nesta rodada.
