# AR10 — Auditoria: "Sincronização de Dados, Anotações Inteligentes e
## Ajuste de Etapas"

> **Pedido:** documento do Operador com o mesmo título, 5 seções técnicas
> + plano de 5 fases (~12-16 dias pela estimativa do próprio documento).
> **Escopo desta auditoria:** confrontar cada seção com infraestrutura
> real já existente antes de qualquer linha de implementação — mesma
> disciplina das duas auditorias anteriores desta mesma frente
> (`AUDITORIA_MARKETBRAIN.md`, e a resposta já implementada em
> `unified-presentation.ts`/badge Conflitos).
> **Achado principal, adiantado:** a premissa central do documento (§1 —
> "3 fontes de dados desconectadas, cada motor calcula com número
> diferente") não corresponde à arquitetura real deste repositório. O
> problema que o documento descreve já tem uma solução madura em
> produção — construir a "Data Sync Layer" proposta seria duplicar
> `ipad_runtime/src/market-data-bus/` quase campo a campo.

---

## 1. §1-2 (Data Sync Layer): já existe, com o MESMO desenho

O documento propõe um `NormalizedCandle` com schema único, resolução de
conflito entre fontes por prioridade, e garantias (`monotonic`,
`gapless`, `consistent`, `fresh`, `provenance`). Isso já é
`ipad_runtime/src/market-data-bus/`, peça por peça:

| Documento pede | Já existe em | Evidência real |
|---|---|---|
| `NormalizedCandle` (schema único `{open,high,low,close,volume,...}`) | `normalizer.js::normalizeCandles()` | "converte candles de QUALQUER conector para a forma canônica única `{t,o,h,l,c,v}`... para que um futuro segundo conector nunca precise que analysis-frame.js/App.tsx saibam de onde os dados vieram" — comentário do próprio arquivo, palavra por palavra o objetivo do documento |
| `guarantees.monotonic` / `.consistent` | `integrity-validator.js::validateCandleSeries()` | rejeita a série inteira (fail-closed) em `timestamp_nao_estritamente_crescente`, `high_menor_que_low`, `high_abaixo_de_open_ou_close`, `preco_nao_positivo`, `volume_negativo` — os MESMOS 5 critérios do `DataGuarantees` do documento |
| `guarantees.fresh` / staleness | `time-synchronizer.js::computeAsOf/computeAgeMs/isStale` | "idade real de um snapshot... calculada sempre a partir do timestamp real do último candle confirmado, nunca do horário em que o fetch terminou" |
| Qualidade por fonte (0-1, 4 dimensões) | `quality-engine.js` + `quality-monitor.js` | "null significa 'não medido ainda' — nunca tratado como 0 nem como 1" — mesma honestidade do `DataGuarantees.provenance` |
| Buffer/janela sem gap | `candle-ring-buffer.js` | — |
| Telemetria/proveniência do pipeline | `pipeline-telemetry.js` | — |

**O que o documento propõe que genuinamente não existe:** um envelope
`source: {origin, receivedAt, sequence, hash}` exposto POR CANDLE aos
consumidores (hoje a proveniência vive em telemetria do pipeline, não
anexada a cada candle individual). É um gap real, mas pequeno — uma
extensão de schema, não uma camada nova.

**Por que o cenário central do §1.1/1.3 não se aplica aqui:**
`bus.js` (o Market Data Bus ao vivo) não tem nenhum conceito de modo
"replay" misturado — busquei por `replay|mode` no arquivo inteiro e não
há nenhuma ocorrência. Replay/backtest é um caminho de código
inteiramente separado (`structural-backtest.js`, captura de histórico
com proveniência própria — Entregas #8/#10 desta mesma sessão), nunca
concorrente com o WebSocket ao vivo pela mesma vela. O cenário "3 fontes
competindo pelo mesmo candle ao mesmo tempo" (WebSocket vs. Replay CSV
vs. Cache) não é uma condição real deste app — é um padrão genérico de
outras arquiteturas de trading, não uma observação deste código.

**Conclusão:** construir a "Data Sync Layer" do zero duplicaria uma
peça já madura, já testada, já em produção. Se houver um sintoma real
(BOS que some no zoom, VWAP que muda com timeframe, confluência que
oscila sem o preço mover — os exemplos do §1.3), a causa mais provável
não é "dados desincronizados entre fontes" — é um bug de recálculo/
memoização em algum consumidor específico, que merece ser reproduzido e
diagnosticado como um bug pontual (mesmo padrão de correções reais já
feitas nesta sessão, ex.: task #30 `engineFallbackLevels` lendo campo
errado), não resolvido "por baixo" com uma camada de dados nova.

## 2. §3 (Anotações Inteligentes): mecanismos reais já cobrem a maior
## parte, espalhados em vez de unificados

| Documento pede | Já existe em | Gap real |
|---|---|---|
| Fade por idade (`lifecycle.visibility` FULL→FADED→GHOST) | `chart/annotation-decay.ts::ageAlpha()` — decaimento por IDADE EM CANDLES (não relógio de parede, decisão deliberada documentada), compartilhado por `LiquidityZonesPlugin`/`StructureBreakMarkersPlugin`/Aura | nenhum — mesmo mecanismo, vocabulário diferente |
| Auto-hide por regime/proximidade (`autoHide.whenRegimeMismatch`, distância do preço) | `nexus/layer-relevance.ts` — já tem `MARKET_REGIME_TREND_LABELS`, proximidade por camada (`LIQUIDITY_PROXIMITY_PCT`, `FIBONACCI_PROXIMITY_PCT`, etc.), thresholds de destaque | nenhum — mesmo mecanismo |
| Cores dinâmicas por relevância (§3.5) | `nexus/visual-budget.ts` (ênfase/opacidade por camada, Entrega EPC FINAL §3/§12) | nenhum — mesmo mecanismo |
| Agrupamento de anotações próximas (§3.6) | `nexus/institutional-zones.ts` — clustering/consolidação real de zonas sobrepostas, já graduado (`InstitutionalZonePlugin`) | cobre zonas institucionais (FVG/OB/S-R); **não cobre anotações desenhadas pelo Operador** (trendline/medição manuais) — esse recorte específico é o único gap real desta seção |

**Conclusão:** a "SmartAnnotation" unificada do documento não existe
como uma classe/interface única — mas os 4 mecanismos que ela descreve
já existem, cada um no seu módulo, já testados, já em produção. Unificar
sob uma única interface seria puramente uma refatoração de vocabulário,
não uma capacidade nova. O único gap funcional real é agrupamento
para anotações desenhadas manualmente pelo Operador (trendline/
medição), que hoje não têm o mesmo tratamento de cluster que as zonas
institucionais.

## 3. §4 (Transições Fluidas): objetivo já alcançado por mecanismos ad-hoc

A arquitetura de canvas deste repositório (`CLAUDE.md`: "canvas próprio,
dirty-flag + rAF, ResizeObserver, fio de seda") já suporta redesenho
animado; o decaimento por idade (`annotation-decay.ts`) já produz fade
suave; price-lines já usam "templates dinâmicos... decaimento por idade"
(achado confirmado em teste real desta sessão, Sweep/Liquidation Heatmap,
v3). Uma `StageTransition`/máquina de estados visual unificada
(INACTIVE→APPROACHING→ACTIVE→FADING→GONE) não existe como abstração
central, mas o resultado visível (elementos que aparecem/somem
gradualmente, nunca "piscam") já é o comportamento real na maioria dos
plugins que usam decay. Não há um caso concreto reportado pelo Operador
de "pisca/salta" que já não tenha sido corrigido nesta sessão (ex.:
tasks #105 "Sweep labels acumulam sem decaimento" — já corrigido). Sem
uma captura real de um caso que ainda pisca, construir uma máquina de
estados nova seria generalizar uma solução para um problema não
confirmado hoje.

## 4. §5 (Probabilidade Calibrada): a única seção com um gap real e novo

`nexus/expectancy.ts` (Entrega 42/44) já é a espinha dorsal honesta
deste pedido: `MIN_TRADES_FOR_VALID_EXPECTANCY = 30`, `computeExpectancy()`
com `winRate`/`expectancyR`, `evaluateSignalFilter()` com fallback
honesto abaixo da amostra mínima — já wireado em `risk-engine.js`
(Entrega 44) e exibido em `ExpectancyCard`. A apresentação em 3 camadas
do §5.5 (estatística real / heurística com aviso / dados insuficientes)
já é a política ativa, não uma proposta.

**O que é genuinamente novo:** o `ScenarioFingerprint` (§5.3) — hoje o
Track Record (`signal-track-record.ts`) agrupa resultados por
`symbol:timeframe` (task #12 desta sessão), nunca por uma assinatura do
CENÁRIO (regime + estrutura + direção do sweep + forma do perfil de
volume + posição VWAP). Isso significa que hoje "BTC 15m" é uma única
amostra estatística, mesmo que metade dos trades tenha acontecido em
regime de tendência forte e a outra metade em consolidação — cenários
com dinâmica bem diferente sendo misturados na mesma estatística. Um
fingerprint de cenário permitiria expectancy real por FAMÍLIA de
configuração, não só por símbolo:timeframe. Isto é real, novo, e o
único ponto de todo o documento que exigiria matemática/dado genuinamente
inédito — mas depende de acumular amostra nova por fingerprint (o
mesmo piso de 30 casos já exigido), então o valor só aparece depois de
operar um bom tempo com o fingerprint já registrado nos planos.

---

## 5. Recomendação

Não recomendo iniciar a Fase 1 do documento como especificada (Data
Sync Layer) — seria semanas de trabalho duplicando `market-data-bus/`
já maduro. Das 5 seções:

- **§1-2:** nenhuma ação — infraestrutura já resolve o problema real.
  Se um sintoma concreto aparecer (BOS sumindo no zoom etc.), tratar
  como bug pontual reproduzível, não como justificativa para uma
  camada nova.
- **§3:** nenhuma ação nos 3 mecanismos já cobertos. Único gap real
  (agrupamento de anotações manuais do Operador) é pequeno o bastante
  para uma entrega futura isolada, se e quando o Operador confirmar que
  vale a pena (o canvas hoje raramente acumula tantas anotações manuais
  a ponto de precisar de colapso).
- **§4:** nenhuma ação sem um caso real reportado de transição abrupta
  ainda não corrigida.
- **§5:** o único item com valor real e novo — `ScenarioFingerprint` no
  Track Record — mas depende de prioridade do Operador frente às outras
  3 frentes já em andamento nesta sessão (ferramentas de desenho,
  MarketBrain/Evolução Incremental) e ainda sem resposta sobre
  sequenciamento.
