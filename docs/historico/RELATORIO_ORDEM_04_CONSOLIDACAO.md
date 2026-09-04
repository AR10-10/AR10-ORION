# RELATÓRIO — Ordem Nº 04: Consolidação do Organismo Inteligente Adaptativo

**Status:** executado — auditoria real dos 7 componentes nomeados pela
Ordem (§4) antes de qualquer alteração (§7), seguida de duas entregas
reais e proporcionais ao que a auditoria efetivamente encontrou.

---

## §0. Leitura da Ordem

A Ordem Nº 04 pede uma fase de **integração, coordenação e maturidade
operacional** — não novos módulos isolados. Nomeia 7 camadas para
"consolidar progressivamente, sem criar duplicação": `layer-relevance`,
`visual-budget`, `scenario-engine`, `institutional-zones`, `trade-plan`,
`radar`, `engine signals`. Exige auditoria real antes de qualquer mudança
(§7: módulos ativos, módulos isolados, consumidores reais, duplicações,
riscos) e proíbe remover qualquer componente sem justificativa técnica.

---

## §1. Auditoria real — mapa dos 7 componentes nomeados

Feita por grep/leitura direta do código real (nunca suposição), antes de
qualquer edição. Achado central: **6 das 7 camadas já estavam
genuinamente integradas** — a Ordem presume um risco de fragmentação que,
checado, não se confirma na maior parte do sistema. Reportado honestamente
em vez de fabricar trabalho de "integração" onde já existe.

| Camada nomeada | Status real | Consumidores reais confirmados |
|---|---|---|
| `layer-relevance.ts` | **ATIVA** | `App.tsx` (ChartLayersPanel/relevanceInput), `EnhancedChart_110_Percent.tsx`, `unified-snapshot-store.ts` |
| `visual-budget.ts` | **ATIVA (parcial)** | Só `EnhancedChart_110_Percent.tsx` — 3/7 categorias já graduadas antes desta rodada (INSTITUTIONAL_ZONE, TRADE_PLAN, STRUCTURE); RADAR/TARGET/INVALIDATION/MAIN_LIQUIDITY declaradas mas sem candidato real até esta rodada |
| `scenario-engine.ts` | **ATIVA** | `App.tsx`, `EnhancedChart_110_Percent.tsx` (desenho no canvas), `event-bus.ts`, `unified-snapshot-store.ts` |
| `institutional-zones.ts` | **ATIVA** | `EnhancedChart_110_Percent.tsx`, `InstitutionalZonePlugin.tsx` |
| `trade-plan.ts` | **ATIVA (núcleo)** | 10 consumidores reais, incluindo a cadeia do Core Engine (`decision-layer.ts`, `engine-bridge.ts`, `eta-engine.ts`, `signal-track-record.ts`, `aura-lifecycle.ts`, `radar-qualification.ts`) |
| `radar` (`consensus-radar.ts` + `radar-universe.ts` + `radar-qualification.ts`) | **ATIVA** | `App.tsx` (loop de scan, painel OPORTUNIDADES, CouncilWidget "RADAR DE CONSENSO"), `unified-snapshot-store.ts` |
| `engine-signal-contract.ts` ("engine signals") | **ISOLADO** | **ZERO** — nenhum import fora do próprio arquivo em todo `src/`, confirmado por grep |

Achado secundário sobre `visual-budget.ts`: a categoria `RADAR` (uma das 7
declaradas em `VISUAL_BUDGET_PRIORITY_ORDER`) não tem hoje NENHUM objeto
real desenhado no canvas do gráfico — `consensus-radar`/`radar-qualification`
renderizam em painéis próprios (CouncilWidget/"OPORTUNIDADES"), nunca no
`chart/`. Graduar essa categoria exigiria inventar um objeto visual novo
só para preencher uma prioridade declarada — decisão deliberada de NÃO
fazer isso (violaria "zero módulo/dado fabricado").

**Único componente genuinamente isolado: `engine-signal-contract.ts`.**
Existe desde EPC OMEGA FINAL Parte 1 (4 rodadas atrás) com um contrato de
10 campos testado (`nexus-engine-signal-contract.test.ts`, 8 testes reais)
e uma função real (`deriveEngineSignalsFromCouncil`) que já reflete
corretamente a lógica de pool do Conselho (`council.ts:429-431`) — mas sem
nenhum consumidor vivo. Esta é a entrega central desta rodada (§2).

---

## §2. Entrega 1 — `engine-signal-contract.ts` consolidado no `CouncilWidget`

`CouncilWidget` (`App.tsx`) já renderizava `council.votes` diretamente,
linha a linha (agente/postura/confiança/racional). Essa leitura ad hoc
continua — **zero regressão visual nos campos existentes** — mas agora
roda em paralelo com `deriveEngineSignalsFromCouncil(council)`, que
reempacota os MESMOS votos na forma única `EngineSignal[]` (reformatação
pura, mesmo padrão já usado por `formatScenarioPathLabel` no mesmo
componente — LEI 24 intacta, nunca uma segunda pool).

O campo `weight` do contrato (um dos ~4 já rastreados de verdade, ver
`docs/historico/RELATORIO_EPC_OMEGA_FINAL.md` Parte 1) é `null` exatamente quando um
voto está estruturalmente fora do pool linear real do Conselho — RISK
(portão fail-closed, nunca voto direcional) ou ABSTAIN (ausência real de
opinião). Essa distinção já EXISTIA no cálculo (`aggregateCouncil`,
`quorum = directional.length`) mas nunca era exibida POR VOTO — só o
efeito agregado aparecia ("quórum 1/6"). Agora cada voto fora do pool
ganha um marcador real `· fora do pool`, com tooltip explicando o motivo.

**Verificação visual real (não só teste unitário — Ordem §6):** capturada
com Playwright contra o dev server local. Diferente das mudanças de
`visual-budget.ts` (que dependem de candles ao vivo, indisponíveis nesta
sandbox — ver §5), o Conselho computa mesmo em estado fail-closed
("Conselho travado (risco)"), então a captura abaixo mostra o
comportamento real, não um mock:

```
VOTO DO CONSELHO · TRAVADO (RISCO)     ABSTAIN · coesão — · quórum 1/6

LIQUIDEZ · fora do pool                ABSTAIN
  sem preço real de referência ainda — impossível situar os pools
ESTRUTURA · fora do pool               ABSTAIN
  nenhum rótulo real de estrutura disponível ainda (motor sem ciclo ok)
ORDER FLOW                             NEUTRAL 0%
  CVD da sessão exatamente zero — fluxo equilibrado
RISCO · fora do pool                   ABSTAIN
  condições operacionais degradadas — conselho travado (fail-closed)
MANIPULAÇÃO · fora do pool             ABSTAIN
FIBONACCI · fora do pool               ABSTAIN
MOMENTUM (RSI) · fora do pool          ABSTAIN
```

Confirma exatamente o comportamento desenhado: os 6 votos ABSTAIN ganham
o marcador; o único voto com opinião real (ORDER FLOW, NEUTRAL 0% — 0 é
confiança real, não ausência) **não** ganha — ele está de fato no pool.
Screenshot completo em
`/tmp/claude-0/.../scratchpad/ordem04-after-click.png` (caminho de sessão,
não versionado).

**Testes**: `tests/engine-signal-consolidation-wiring.test.ts` (novo, 6
testes) — trava o import, a derivação dentro do widget, o pareamento por
índice, o marcador condicional e a ausência de regressão nos campos
antigos. A lógica pura de `deriveEngineSignalsFromCouncil` já tinha 8
testes de execução real (`nexus-engine-signal-contract.test.ts`,
pré-existente) — nenhum mudou, porque o contrato em si não foi alterado,
só ganhou um consumidor.

---

## §3. Entrega 2 — `MAIN_LIQUIDITY` como 4ª categoria real de `visual-budget.ts`

Continuação direta da graduação começada na Diretriz Nº 02 (2
categorias) e estendida na Evolução Visual (STRUCTURE, 3ª). Auditoria
desta rodada localizou a fonte de peso real que faltava: `LiquidityZonesPlugin.tsx`
(FVG/Order Blocks) já calcula `ageAlpha(age, ZONE_DECAY)` por zona,
individualmente — mesma disciplina exata de `StructureBreakMarkersPlugin.tsx`
antes de sua graduação.

**Regra nova, não presente nas 3 graduações anteriores:** zonas que são
**obstáculo real** do Trade Plan ativo (`obstacleZones`, Diretriz
Restauração/Inteligência Visual §6) ficam **fora da competição de
propósito** — nunca entram como candidato do orçamento visual. Essas
zonas têm hoje a garantia de `alpha=1` incondicional enquanto bloqueiam o
caminho de uma operação ativa; deixar o orçamento visual reduzi-las
(mesmo respeitando o piso 0.35) esconderia risco estrutural real do
Operador só porque outras camadas (Trade Plan, Zona Institucional,
Estrutura) já "gastaram" o orçamento naquele ciclo. `drawZone` no plugin
ignora `resolvedWeight` quando `isObstacleZone` é verdadeiro — dupla
trava (o lado do gráfico nunca envia obstáculo como candidato; o plugin
nunca aplicaria o peso mesmo que recebesse).

Mecânica idêntica às 3 graduações anteriores fora essa regra: `ZONE_DECAY`
exportado do plugin (zero segunda curva, mesmo padrão de `BREAK_DECAY`),
`EnhancedChart_110_Percent.tsx` monta candidatos reais (`liquidity-fvg-${i}`/
`liquidity-ob-${i}`) só para zonas não-obstáculo com `ageAlpha > 0`,
`resolveVisualBudget` decide o resto, pesos resolvidos voltam para o
plugin via `fvgVisualWeights`/`obVisualWeights` (paralelos por índice ao
array original, fallback fail-closed para o `ageAlpha` isolado quando
ausente — comportamento anterior 100% preservado).

**Testes**: 9 novos em `tests/visual-budget-chart-wiring.test.ts` (mesmo
arquivo das 3 graduações anteriores) — exportação de `ZONE_DECAY`, props
novas com fallback, a regra de exclusão de obstáculo (nos dois lados:
plugin e chart), o `forEach` com índice, o ref/dirty-check, e o candidato
real no chart com a exclusão por `isObstacle`.

**Efeito colateral corrigido nesta rodada**: mudar as chamadas internas de
`drawZone`/`zonesRef` quebrou 4 asserções literais pré-existentes em 2
arquivos de teste mais antigos (`ciborgue-vivo-wiring.test.ts`,
`liquidity-zones-plugin.test.ts`) que travavam o texto exato das linhas
antigas. Mesma classe de manutenção já vista em rodadas anteriores
(import relocado quebrando um teste de padrão) — todas as 4 atualizadas
para a forma real atual, com comentário explicando a mudança, nunca
enfraquecidas.

---

## §4. O que NÃO foi tocado, e por quê

- **`TARGET`/`INVALIDATION`** (2 das 3 categorias restantes de
  `visual-budget.ts`) — auditoria desta rodada não achou uma fonte de
  peso PRÓPRIA já existente e isolada por objeto individual (TP1/TP2/TP3,
  linha de STOP) do jeito que STRUCTURE/MAIN_LIQUIDITY tinham prontas.
  `TradePlanZonePlugin.tsx` hoje trata o plano como uma zona única
  (`opacityMultiplierFor`, já graduada como categoria `TRADE_PLAN`) — não
  há hoje uma opacidade individual por alvo/stop para reaproveitar sem
  inventar peso novo. Fica identificado, não forçado.
- **`RADAR`** — sem candidato real no canvas (ver achado §1); graduar
  exigiria um objeto visual novo só para a categoria, não uma consolidação
  real.
- **Evidence Fusion Engine mais amplo** (usar os campos ainda não
  instrumentados do contrato — `relevance`/`priority`/`quality`/
  `temporalHorizon`/`lifespanCandles`) — a Entrega 1 usa o campo `weight`,
  já real; os outros 5 campos continuam `null` honesto porque nenhum motor
  real os preenche ainda (mesma nota do próprio `engine-signal-contract.ts`).
  Instrumentar esses campos é trabalho de motor novo, fora do escopo de
  "consolidar o que já existe".
- **Market Structure em `analysis-frame.js` / frequência de atualização
  adaptativa** — pendências já registradas em rodadas anteriores (Ordem
  Nº 03, Homologação Nº 03), Regra de Ouro 6 (Core Engine é iniciativa
  isolada própria). Sem mudança nesta rodada.
- **Nenhum componente foi removido.** A Ordem §7 proíbe remoção sem
  justificativa técnica — a auditoria não encontrou nenhum dos 7
  componentes nomeados morto ou duplicado a ponto de justificar remoção;
  o único achado real (`engine-signal-contract.ts` isolado) foi resolvido
  por integração, não por remoção.

---

## §5. Verificação final

- `tsc --noEmit`: limpo (`noUnusedLocals`/`noUnusedParameters`
  permanentes desde a rodada anterior, sem novo achado).
- `vitest run`: **129 arquivos / 2201 testes (100%)** — 2185 antes desta
  rodada + 6 (engine signals) + 9 (MAIN_LIQUIDITY) + 1 (`ZONE_DECAY` já
  contado acima) − ajustes de 4 asserções pré-existentes atualizadas
  (não removidas, só re-apontadas para o código real atual).
- `npm run build`: ok — 1847 módulos, bundle principal 878,48 kB (variação
  desprezível frente à rodada anterior).
- Playwright: dev server real local. Zero erro de React
  (`REACT_ERROR_COUNT=0`). Limitação de rede já documentada em todas as
  rodadas anteriores (proxy bloqueia Binance REST/WebSocket,
  `ERR_TUNNEL_CONNECTION_FAILED`) segue impedindo ver candles ao vivo —
  por isso as mudanças de `visual-budget.ts`/MAIN_LIQUIDITY (que dependem
  de zonas FVG/OB reais desenhadas) não puderam ser confirmadas
  pixel-a-pixel nesta sessão, mesma honestidade das 3 graduações
  anteriores. A Entrega 1 (CouncilWidget), por não depender de candles,
  **foi confirmada visualmente ao vivo** (§2) — evidência mais forte que
  o padrão usual desta sandbox.

## Critérios de homologação — veredito

| Critério (Ordem Nº 04) | Veredito |
|---|---|
| §7 Auditoria antes de alterar | Feita e documentada em §1 — mapa real dos 7 componentes, 6 já ativos, 1 isolado identificado com evidência de grep. |
| §4 Consolidar sem duplicar | `engine-signal-contract.ts` ganhou consumidor real sem criar um segundo painel (reusa o `CouncilWidget` existente); `visual-budget.ts` ganhou 4ª categoria reusando peso já existente (`ZONE_DECAY`), zero segunda curva. |
| §6 Execução real, não só teste unitário | Entrega 1 verificada com captura visual ao vivo real (§2); Entrega 2 com teste de padrão + build + tsc, visual bloqueado só pela limitação de rede já conhecida (honestamente reportado, não escondido). |
| §8 Nenhuma remoção sem justificativa | Zero componente removido; único achado de isolamento resolvido por integração. |
| Organismo simples para o Operador, complexo só internamente | CouncilWidget ganha 1 marcador novo, discreto, com tooltip — zero novo painel, zero novo modo. |

**Veredito geral**: escopo real e auditado — 6 de 7 camadas nomeadas já
estavam consolidadas (reportado honestamente em vez de inflado); a única
lacuna real (`engine-signal-contract.ts`) foi fechada com um consumidor
concreto e visualmente verificado; a 4ª categoria de `visual-budget.ts`
estende a mesma disciplina das 3 anteriores com uma trava de segurança
nova (obstáculo real nunca perde ênfase por competição visual). Nenhuma
funcionalidade real perdida; nenhum módulo novo isolado criado.
