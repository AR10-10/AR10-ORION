# AR10 CYBORG — Auditoria de Consolidação e Evolução

**Data**: 2026-07-27 · **Diretiva de origem**: "DIRETRIZES AVANÇADAS DE
AUDITORIA, CONSOLIDAÇÃO E EVOLUÇÃO DO AR10 CYBORG" (Operador, 8 seções).

## Sumário executivo

Esta é a auditoria mais profunda já feita neste repositório na dimensão
de **duplicação/gargalos**, **elementos visuais** e **sincronização/
consistência de decisão** — as três dimensões que os dois documentos
irmãos (`ELITE_TRADING_RESEARCH_MAP.md`, ecossistema externo;
`MAPA_EVOLUCAO_CIBORGUE.md`, estado por subsistema) não cobriam na
mesma granularidade. Este documento não os substitui — cita e referencia
os dois onde já respondem a uma seção pedida, e cobre o que é
genuinamente novo aqui: 3 agentes de auditoria reais rodaram em paralelo
(read-only, zero edição própria) e encontraram **1 bug real de
severidade ALTA** (já corrigido e testado nesta mesma rodada), 1 gap
estrutural de sincronização (documentado, não corrigido — precisa de
rodada própria), 2 gargalos reais de memória (documentados, não
corrigidos — precisam de rodada própria), e uma dispersão real de
linguagem visual (9 significados diferentes reaproveitando a mesma
paleta de cores) — mais 5 correções pequenas e seguras já aplicadas e
verificadas.

**Nada nesta rodada tocou o Core Engine, a matemática do Comitê, ou
qualquer superfície de execução real — todas as correções são
aditivas/de sincronização/de rótulo, nunca uma segunda lógica de
decisão (LEI 24 intacta).**

---

## 1. Metodologia

3 agentes reais, paralelos, background, `subagent_type=general-purpose`,
explicitamente instruídos como **read-only** (só relatam, nunca editam):

- **Agente A — Ecossistema/duplicação/gargalos**: leu todo
  `ipad_runtime/src/research/engines/`, `risk/`, `orderflow/`,
  `consensus/`, `market-data-bus/`, `market-regime/`, `telemetry/`, os
  51 arquivos de `ramber-ui/src/nexus/`, os 13 de `ramber-ui/src/gmil/`
  e `cross-exchange/`, `engine-bridge.ts` (1236 linhas) e
  `unified-snapshot-store.ts` (610 linhas) inteiros.
- **Agente B — Censo visual completo**: leu `EnhancedChart_110_Percent.tsx`
  (1994 linhas), os 13 arquivos de `chart/` (9 plugins + 3 helpers), e
  as ~25 funções-widget relevantes de `App.tsx` (9067 linhas).
- **Agente C — Sincronização/consistência de decisão**: auditou timing
  entre `App.tsx`, `engine-bridge.ts`, `unified-snapshot-store.ts`, o
  Market Data Bus, os plugins de canvas e os singletons de
  orquestração/saúde/voz.

Cada achado abaixo cita arquivo:linha real — nada é especulação. Onde um
achado já era um padrão deliberado e documentado no próprio código
(muitos existem — este repositório tem uma disciplina real de
autocrítica em comentários), os agentes foram instruídos a NÃO
re-reportar como bug, e não re-reportaram.

---

## 2. Mapa completo da arquitetura (novo nesta rodada: contagem real de
superfície)

Cobertura confirmada por leitura direta (não estimativa):

| Camada | Arquivos | Papel |
|---|---|---|
| Engines puros (`ipad_runtime/src/research/engines/`) | 6 graduados + 1 utilitário | Cálculo determinístico, zero rede/estado — ver `QUARANTINE.md` |
| `nexus/` (`ramber-ui/src/nexus/`) | 51 arquivos | Camada de leitura/derivação entre os engines e a UI — a maior superfície única do repositório |
| `chart/` (`ramber-ui/src/chart/`) | 13 arquivos | 1 componente principal (`EnhancedChart_110_Percent.tsx`) + 9 plugins de overlay + 3 helpers puros |
| `gmil/` | 13 arquivos | Consenso global de contexto externo (funding/OI/liquidez/macro) |
| `cross-exchange/` | 5 arquivos | Cross-check Bybit/OKX (serviço construído, deliberadamente não iniciado — ver §5) |
| `App.tsx` | 1 arquivo, 9067+ linhas | Único coletor real de dado (WS/REST), dono de todo estado React, monta ~25 widgets |
| `unified-snapshot-store.ts` | 1 arquivo, 610+ linhas | Espelho Zustand+Immer, 5 domínios, seletores atômicos |
| `engine-bridge.ts` | 1 arquivo, 1236 linhas | Ponte entre os engines `.js` e o React/TS |

Mapa de dependências (arquitetura real, confirmada pelos 3 agentes,
nunca invertida em lugar nenhum): **engines puros → engine-bridge.ts →
estado React (App.tsx) → [espelho passivo] → store Zustand → seletores
→ widgets**. `App.tsx` continua a única fonte real de coleta (Local-
First, WS/REST) — a store nunca dispara rede própria, confirmado por
todos os 3 agentes independentemente.

Dado real do inventário completo de subsistemas (IMPLEMENTADO/PARCIAL/
AUSENTE) já vive em `docs/MAPA_EVOLUCAO_CIBORGUE.md` §1-6 — não
duplicado aqui.

---

## 3. Mapa de sincronização

### 3.1 Padrão real já em uso (confirmado correto pelo Agente C)

Todo ciclo assíncrono recorrente real (`runCycle` do Core Engine,
`runMultiTimeframeCycle`, `runRadarScan`, `fetchSymbolData`,
`fetchDerivatives`) usa uma flag de fechamento (`cancelled`) ou um
parâmetro `isStale()` — verificada **depois de cada `await`**, antes de
qualquer escrita de estado. `fetchSymbolData` chega a checar duas vezes
(depois do fetch de candles E depois do fetch de ticker), com o
comentário explícito "ativo trocou durante o fetch — descarta, nunca
aplica dado do ativo errado". Todos os `setInterval`/listeners
verificados (WS, REST, radar, MEXC orderflow, liquidação, health
monitor, orquestrador, worker do Conviction Cyclone) limpam
corretamente no cleanup — zero vazamento encontrado.

### 3.2 Bug real HIGH encontrado e CORRIGIDO nesta rodada

`store.price` (a fatia lida por `usePriceSnapshot()`, consumida pelo
gráfico como `livePrice` e por vários widgets) **nunca resetava ao
trocar de ativo**. Causa raiz: o efeito-espelho que copia `priceData`
(estado React local) para dentro da store tinha um guard
`if (priceData) ...` — quando `priceData` volta a `null` na troca de
ativo (reset intencional, efeito próprio), o guard silenciosamente
**pulava** a escrita em vez de repassar o reset. `orderBook`/
`derivatives` nunca tiveram este bug porque seus valores de reset já
são objetos verdadeiros (`{bids:[],asks:[]}`), então sempre passavam
pelo `if`.

**Efeito real observável**: o painel de Derivativos mostrava o preço do
ativo ANTERIOR ao lado do rótulo do ativo NOVO; o gráfico estendia a
vela mais recente do ativo novo usando o preço do ativo velho
(`patchLastCandleWithLiveTick` não valida magnitude/símbolo), produzindo
um pavio falso que persistia até o próximo resync REST (até ~30s).

**Correção**: `EMPTY_PRICE` (já existia como constante privada da store)
agora é exportado e repassado explicitamente — `setPrice(priceData ??
EMPTY_PRICE)`, mesmo padrão que `orderBook`/`derivatives` já usavam
corretamente. Zero mudança de comportamento fora do caso de bug (quando
`priceData` é real, o comportamento é idêntico ao de antes).

### 3.3 Gap estrutural real, documentado, NÃO corrigido nesta rodada

Duas pipelines de preço independentes e estruturalmente fora de sincronia
por pelo menos 1 commit de render: `TopBar`/`TradePlanTopStrip` leem
`priceData` (prop React direta, rápida) enquanto o gráfico lê
`usePriceSnapshot()` (espelho Zustand do mesmo `priceData`, sempre 1
commit atrás). Um comentário existente no código afirmava que os dois
eram "a mesma fonte" — **falso**, corrigido nesta rodada (só o texto;
ver §6). O gap real de timing continua existindo — é a mesma dívida já
rastreada de migração WidgetContext→seletores (Tier 4 do backlog),
agora com evidência concreta nova: numa quebra real de stop, o badge
"STOP BREACHED" da tira superior e o rótulo do próprio gráfico para o
MESMO preço de stop podem discordar por uma fração de segundo.

Também documentado, não corrigido: uma janela de corrida real (não
determinística, precisa de uma coincidência de timing) entre o refresh
REST de 30s e a troca de timeframe, que poderia — só nesse cenário raro
— concatenar candles de duas granularidades diferentes em `chartData`.
Ver backlog §9.

---

## 4. Mapa dos elementos visuais

Censo completo: **18 camadas do gráfico** (todas mapeadas: origem,
condição real de exibição, dado, cor, prominência), **10 pontos reais
de `createPriceLine`**, **9 plugins de canvas** (arquitetura idêntica
em todos: canvas próprio, dirty-flag+rAF, `ResizeObserver`, fio de
seda), e ~25 indicadores de HUD/widget mapeados em `App.tsx`.

**Achado concreto e específico pedido pelo Operador ("linhas
douradas/amarelas")**: não existe UMA linha dourada — existem
**4 elementos reais e documentados**, cada um intencional:
1. Tint "neutro" de VWAP/Nexus Line (branco-dourado, opacidade baixa) —
   `EnhancedChart_110_Percent.tsx:404-412`.
2. Linha de preço + zona de Entrada do Trade Plan (âmbar) —
   `EnhancedChart_110_Percent.tsx:1451`, `TradePlanZonePlugin.tsx:39-40`.
3. Linha de Liquidity Sweep (âmbar forte, só quando um STOP_HUNT real é
   detectado) — `EnhancedChart_110_Percent.tsx:1019`.
4. Rótulo de pico do Liquidation Heatmap (dourado) —
   `LiquidationHeatmapPlugin.tsx:36`.

Nenhum é um bug — cada um é uma cor de papel único, real e consistente
dentro da sua própria camada.

**Achado maior, o real problema de "lapidação visual"**: uma única
paleta (verde `#00ffaa`/vermelho `#ff0055`/dourado `#f0d06f` + primos
próximos) é reaproveitada, byte a byte, em **9 eixos semânticos
diferentes e não relacionados** pelo app inteiro — direção de mercado,
saúde do sistema, status de conectividade (a MESMA bolinha `w-1.5 h-1.5`
reaproveitada em 6+ indicadores independentes: WS, saúde geral, ciclo do
motor, provedor GMIL, feed MEXC, log de eventos), qualidade de dado,
tier de confluência institucional, Heat Score (intensidade, nunca
direção), CPI/Trust Score/tendência de convicção, e alerta/trap (o
card de Traps é sempre vermelho, mesmo quando o sweep favorece um LONG
— vermelho aqui significa "alerta", não "baixista"). Dentro de cada
eixo a convenção é 100% consistente (nenhuma inversão de cor
encontrada); o risco é inteiramente CRUZADO — um relance rápido numa
bolinha colorida sem ler o rótulo não diz qual sistema ela reporta.

**Evidência de que o próprio código já sabe disso**: `NeuralMarketAuraPlugin.tsx`
(linhas 74-93) documenta, no próprio cabeçalho, uma versão anterior real
que colorjuia o corredor de convicção por DIREÇÃO do trade — produzindo
uma contradição visual real (corredor de um SHORT desenhado vermelho,
terminando num alvo que é sempre verde). O conserto (cor por FASE, não
direção) já existe — mas nunca foi generalizado para os indicadores de
HUD acima, que repetem a mesma classe de ambiguidade.

**1 correção pontual aplicada nesta rodada** (a única do achado de cor
pequena o bastante para ser segura sem tocar dezenas de widgets):
`MarketBiasDecisionCard`'s `LevelCard` de Entrada usava ciano
`#00f0ff`, destoando de TODO o resto do app (Entrada é âmbar/dourado em
todo lugar, inclusive no próprio gráfico) — corrigido para `#f0d06f`,
o mesmo tom real já usado. Stop/Alvo já batiam.

**Achado secundário real**: "Camadas do Gráfico" implica ser a
superfície de controle completa, mas vários elementos reais desenhados
sempre (S1/R1, as próprias linhas de preço do Trade Plan, os alvos de
fallback do Core Engine, as projeções de Cenário A/B) não são
controlados por NENHUM toggle — não é necessariamente um bug (alguns
são deliberadamente isentos, como `trade_plan_zone`/
`neural_market_aura` já são), mas é uma lacuna de documentação real:
nada no painel avisa disso. Registrado no backlog §9, não corrigido.

---

## 5. Lacunas identificadas (ecossistema — Agente A)

| # | Lacuna | Severidade | Ação nesta rodada |
|---|---|---|---|
| 1 | Duas fórmulas de ATR% divergentes: uma Wilder-correta (`lorentzian-classifier.js`, não usada por ninguém fora do próprio módulo) e uma média simples (`market-regime/regime-engine.js`) que É a canônica real consumida pelo Risk Engine, ETA e VWAP/NL | MÉDIA | Documentado, não corrigido — toca a matemática de sizing do Risk Engine, precisa de rodada própria e cuidadosa |
| 2 | Market Data Bus/Quality Monitor/Pipeline Telemetry nunca evictam entradas — crescimento garantido (não especulativo) via o scanner do Radar paginando o universo MEXC inteiro a cada 5min | MÉDIA-ALTA | Documentado, não corrigido — exige desenhar uma política de eviction sobre um singleton compartilhado, sem quebrar o contrato de dedupe que outros testes já dependem |
| 3 | `unified-snapshot-store.candles` era o único campo acumulador sem teto, ao contrário de 4 campos-irmãos no mesmo arquivo | MÉDIA | **CORRIGIDO nesta rodada** — ver §6 |
| 4 | `cross-exchange-service.ts`/`connection-manager.ts` (440 linhas somadas) totalmente construídos e testados, zero call site em produção (deliberado, documentado no próprio arquivo); 3 eventos `DATA.*` do Event Bus sem publicador vivo hoje | BAIXA-MÉDIA | Nota de documentação **adicionada** nesta rodada (ver §6); wiring real fica pra decisão de produto futura |

## 6. Conflitos encontrados + registro das melhorias já realizadas

Cada item abaixo: achado → correção aplicada → justificativa técnica →
teste → risco.

1. **`store.price` não resetava na troca de ativo (HIGH)**. Corrigido em
   `App.tsx` (efeito-espelho de `setPrice`) + `EMPTY_PRICE` exportado de
   `unified-snapshot-store.ts`. Justificativa: mesmo padrão já correto
   usado por `orderBook`/`derivatives` no mesmo bloco — zero lógica
   nova, só remove uma supressão acidental. Teste: 5 casos reais em
   `diretrizes-avancadas-fixes.test.ts` (guard removido, fallback
   presente, import correto, export correto, vizinhos não regrediram).
   Risco: nenhum identificado — o `?? EMPTY_PRICE` é estritamente mais
   correto que o comportamento anterior em todo cenário.
2. **Comentário factualmente errado** em `EnhancedChart_110_Percent.tsx`
   afirmando que a barra superior usa "o mesmo `usePriceSnapshot()`"
   do gráfico — falso, TopBar lê `priceData` direto. Corrigido (só o
   texto do comentário; o gap real de timing que ele tentava descrever
   continua documentado, ver §3.3). Risco: zero (comentário puro).
3. **`candles` sem teto de memória**. Novo módulo puro
   `nexus/candles-cache.ts` (`touchCandlesSymbol`, LRU real por ordem
   de inserção, teto = 12 = tamanho do universo curado `ASSETS` em
   `App.tsx`) — mesmo padrão arquitetural das 4 fatias-irmãs já
   capadas (`l2History`/`orderflowHistory`/`institutionalScoreHistory`/
   `trackRecord.history`), cada uma com seu próprio motor puro e
   capacidade declarada. Teste: 6 casos reais de execução em
   `nexus-candles-cache.test.ts` (LRU real, nunca despeja o símbolo
   recém-tocado, nunca cresce além do teto). Risco: um símbolo fora dos
   12 curados (busca avulsa via SmartOmnibox) pode ser despejado e
   precisar recarregar do zero ao ser revisitado — comportamento
   honesto e esperado, nunca um dado incorreto.
4. **3 eventos `DATA.*` do Event Bus sem publicador vivo, documentação
   enganosa por omissão**. Comentário adicionado em `event-bus.ts`
   avisando explicitamente que `cross-exchange-service.ts` (o único
   publicador possível) não está iniciado nesta fase — antes um futuro
   assinante desses eventos ficaria esperando pra sempre, sem erro,
   sem aviso. Risco: zero (documentação pura).
5. **Rótulo "DECISÃO" sem qualificação em `CouncilWidget`** — a única
   linha do widget sem tooltip, ao contrário das linhas-irmãs
   (Scenario A/B já explicita "never market probability"). Renomeado
   para "VOTO DO CONSELHO" + tooltip explícito citando LEI 24 (o
   Conselho pode divergir do Core Engine por um ciclo real,
   `decision-layer.ts` já documenta isso). Teste: 2 casos reais em
   `diretrizes-avancadas-fixes.test.ts`. Risco: zero (rótulo/tooltip
   puro, nenhum dado real muda).
6. **Cor de Entrada inconsistente em `MarketBiasDecisionCard`** — ciano
   `#00f0ff` onde todo o resto do app usa âmbar `#f0d06f` pra Entrada.
   Corrigido. Teste: 2 casos reais. Risco: zero (troca de valor de cor
   isolada, `accent` é só uma prop de estilo).

**Testes de toda a rodada**: `tsc --noEmit` limpo · **119 arquivos /
1950 testes** (100%, +12 novos: 6 em `nexus-candles-cache.test.ts` + 6
em `diretrizes-avancadas-fixes.test.ts`) · build de produção ok · 2
janelas de teste de padrão-fixo widened (mesma manutenção de baixo risco
já vista em rodadas anteriores) · verificação Playwright ao vivo
("VOTO DO CONSELHO" + tooltip renderizados corretamente, zero erro de
console real).

---

## 7. Tecnologias pesquisadas / comparação com o estado da arte

A pesquisa externa exaustiva (TradingView, MQL5, GitHub OSS, IA,
Estrutura de Mercado, Gestão de Risco, UX, Engenharia) já vive em
`docs/ELITE_TRADING_RESEARCH_MAP.md` — não duplicada aqui. Pesquisa
NOVA desta rodada, especificamente sobre sincronização de estado (a
dimensão que faltava naquele documento):

- Padrão real de mercado (2026) para cancelar requisições obsoletas:
  `AbortController` com `signal` passado ao `fetch`, sempre abortando o
  controller anterior antes de criar um novo, guardado em `useRef`
  (não `useState`) para não causar re-render. **Comparação com o AR10
  real**: `AbortController` não é usado em NENHUM fetch do app — mas o
  padrão alternativo (flag `cancelled`/`isStale()` fechada sobre o
  efeito, checada após cada `await`) já cobre a garantia de
  CORREÇÃO (nunca aplicar dado obsoleto), verificado real e
  consistente pelo Agente C em todos os ciclos recorrentes. A lacuna
  real que sobra é só de EFICIÊNCIA (uma requisição obsoleta continua
  consumindo rede até resolver, mesmo descartada) — baixa prioridade,
  registrada no backlog, não implementada nesta rodada (a superfície
  seguramente isolada — os 2 fetches privados de ticker/derivativos —
  tem valor menor que o risco de tocar o Market Data Bus compartilhado,
  que usa deduplicação de requisições concorrentes incompatível com
  abort per-caller sem desenho próprio).
- Padrão real de mercado para eventos: sistemas orientados a evento
  reduzem drift e inconsistência de UI em dashboards com múltiplas
  fontes concorrentes — confirma que a arquitetura já escolhida pelo
  AR10 (Event Bus tipado, um único publicador por tipo de evento) é a
  direção correta; o gap real não é arquitetural, é de EXECUÇÃO (os 3
  eventos `DATA.*` sem publicador, achado #4 acima).

Fontes: [useState Race Conditions & Gotchas in React](https://leo88.medium.com/usestate-race-conditions-gotchas-in-react-and-how-to-fix-them-48f0cddb9702) · [Why real-time frontends break at scale](https://blog.logrocket.com/real-time-frontends-break-scale/) · [AbortController 2026: Cancel Fetch Properly](https://www.w3tweaks.com/javascript/javascript-abortcontroller-cancel-fetch/) · [JavaScript AbortController — Cancel Fetch, Fix Race Conditions](https://javascriptbit.com/javascript-abortcontroller-cancel-fetch-race-conditions/)

---

## 8. Recomendações priorizadas / Backlog consolidado (novos itens desta
rodada — mesclados ao backlog completo em `MAPA_EVOLUCAO_CIBORGUE.md` §7)

| Item | Tier | Nota |
|---|---|---|
| Unificar ATR% (Wilder em todo lugar, aposentar a média simples) | 2 (precisa cuidado — toca Risk Engine) | Novo, achado #1 §5 |
| Política de eviction real no Market Data Bus/Quality Monitor/Pipeline Telemetry | 2 (singleton compartilhado, desenho próprio) | Novo, achado #2 §5 |
| Fechar o gap de timing entre `priceData` (TopBar) e `usePriceSnapshot()` (gráfico) | 4 (é a mesma migração WidgetContext→seletores já rastreada — agora com evidência concreta) | Novo, §3.3 |
| Hardening de `mergeFreshTail` contra granularidade mista de candle (janela de corrida real, não determinística) | 2 (função pura, testável isolada, baixo raio de explosão) | Novo, §3.3 |
| Consolidar a paleta de cores por eixo semântico (9 eixos hoje reaproveitando as mesmas cores) | 3 (grande, toca dezenas de widgets — precisa de decisão de design do Operador sobre a nova paleta antes de implementar) | Novo, §4 |
| Documentar/decidir quais elementos do gráfico deveriam ganhar toggle próprio (S1/R1, linhas de Cenário) | 1 (barato — é decisão + rótulo, não motor novo) | Novo, §4 |
| `AbortController` nos 2 fetches privados (ticker, funding+OI) | 1 (isolado, seguro, baixo valor — só eficiência de rede) | Novo, §7 |

---

## 9. Riscos e benefícios esperados

**Riscos das correções já aplicadas**: nenhum identificado — todas são
aditivas (novo módulo puro + import), correções de supressão acidental
(reverte pro padrão já correto dos vizinhos), ou texto puro (comentário/
rótulo/tooltip). Nenhuma toca o Core Engine, o Comitê, o Risk Engine ou
qualquer cálculo de decisão.

**Benefícios esperados**: o bug de `store.price` era o mais impactante
já encontrado nesta trilha de auditorias — corrigia um pavio falso real
no gráfico visível em toda troca de ativo, não um caso raro. O teto de
`candles` fecha a única lacuna de memória desta rodada segura o
bastante para corrigir sem desenho novo. As correções de rótulo/cor
(CouncilWidget, Entrada) removem exatamente o tipo de ambiguidade visual
que o Operador pediu para eliminar — "bater o olho e entender".

**Riscos dos itens NÃO corrigidos (backlog)**: documentados
individualmente em §5/§8 — nenhum foi escondido. O maior risco real
seria tentar corrigir ATR%/Bus eviction/paleta de cores apressadamente
dentro desta mesma rodada, que já entregou 6 correções verificadas; a
disciplina deste projeto (Regra de Ouro 6, "iniciativa isolada e
cuidadosa") existe exatamente para itens desta escala.

---

*Este documento é o registro de UMA rodada de auditoria — para o estado
atual consolidado de todos os subsistemas, ver
`docs/MAPA_EVOLUCAO_CIBORGUE.md`; para o histórico completo de como
cada peça deste sistema chegou ao estado atual, ver
`docs/SYSTEM_HANDBOOK.md` §6.*
