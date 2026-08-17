# Mapeamento Visual do Canvas — AR10 CYBORG

FASE 1 (Inventário) + FASE 2 (Mapeamento de duplicações) da "ORDEM
DEFINITIVA — MAPEAMENTO E REFINAMENTO VISUAL DO AR10 CYBORG". Método:
leitura direta do código real (`EnhancedChart_110_Percent.tsx`, cada
plugin em `src/chart/`, `nexus/layer-relevance.ts`) + evidência visual
real (2 screenshots via Playwright contra dado OFFLINE SINTÉTICO
rotulado, `ipad_runtime/data/btcusdt_replay.json` — nunca leitura de
mercado, só para medir pixel/colisão). Sem nenhuma mudança estrutural
até este documento ser apresentado, por instrução explícita do Operador.

Organizado pela própria hierarquia CAMADA 0-7 do pedido — isso já serve
como primeiro resultado real: mostra o quanto da hierarquia pedida já
existe hoje, em vez de assumir que precisa ser criada do zero.

## CAMADA 0 — PREÇO

| OBJETO | Produtor | Fonte de dados | Renderer | Local | Prioridade | Duplicação | Dependências |
|---|---|---|---|---|---|---|---|
| Candles | `lightweight-charts` nativo | `unified-snapshot-store` (klines REST + WS) | série `Candlestick` nativa | canvas central | 0 (máxima) | Nenhuma | `market-data-bus` |
| Preço vivo (last price) | store | WS ticker | `PriceLabelStackPlugin` tier `live` (única entrada nesse tier) | eixo direito, âncora | 0 | Nenhuma — é a ÚNICA etiqueta `live`, teto de 1 já é regra (`price-label-stack.ts`) | `unified-snapshot-store` |

Nada nas camadas abaixo usa `lastValueVisible`/`axisLabelVisible` nativo
da lib para preço ou séries — todos desligados a favor do
`PriceLabelStackPlugin` (achado já documentado desde a Diretriz de
Refinamento Visual). Isso já é, na prática, exatamente o "renderer único
por objeto" pedido no §13 — só nunca tinha esse nome formal.

## CAMADA 1 — ESTRUTURA

| OBJETO | Produtor | Fonte | Renderer | Local | Prioridade | Duplicação | Dependências |
|---|---|---|---|---|---|---|---|
| BOS/CHOCH | `market-structure` (research engine graduado) | candles | `StructureBreakMarkersPlugin` (linha+marcador) + label via `PriceLabelStackPlugin` (`alpha` por decaimento, `annotation-decay.ts`) | canvas + eixo | alta, decai com idade | Nenhuma — 1 motor, 1 desenho, 1 rótulo | `fractal-swings.js` |
| Trend Channel (regressão OLS) | `trend-channel` (research engine) | candles | linhas diagonais no canvas + label `TREND` (`PriceLabelStackPlugin`, tier `context`) | canvas + eixo esquerdo | média (contexto) | Nenhuma | — |
| ZigZag | `zigzag-engine.js` | candles | `ZigZagPlugin` | canvas | baixa/contexto | Nenhuma | `fractal-swings.js` |

## CAMADA 2 — LIQUIDEZ

| OBJETO | Produtor | Fonte | Renderer | Local | Prioridade | Duplicação | Dependências |
|---|---|---|---|---|---|---|---|
| Liquidity Heatmap (book) | `order-book-depth.ts` | WS depth (SPOT, achado de escopo já documentado no header de `DepthChartPlugin.tsx`) | `OrderFlowHeatmapPlugin` | canvas, opacidade já reduzida (task #278) | contextual | Nenhuma | store `orderBook` |
| Order Book Depth (paredes) | mesmo `order-book-depth.ts` (`detectWalls`) | mesmo `orderBook` — **zero 2ª assinatura WS**, confirmado em código | `DepthChartPlugin` (barras ancoradas ao preço) | canvas, lane própria (`chart-profile-lanes.ts`) | contextual→destaque quando é wall | Nenhuma — heatmap e wall são 2 leituras DIFERENTES do MESMO livro (densidade contínua vs. nível concentrado), papéis visuais distintos, não o mesmo conceito 2×. Reusam a MESMA cor canônica bullish/bearish (`canvas-palette.ts`) | `unified-snapshot-store.orderBook` |
| Liquidation Heatmap | `LiquidationHeatmapPlugin` | feed de liquidações reais | canvas | contextual | Nenhuma — conceito diferente (liquidações forçadas ≠ ordens em aberto) | — |
| Liquidity Sweep | `trap-detection.ts` | candles + estrutura | linha nativa (não clusterizada) no canvas + label clusterizado no eixo (fix já registrado: task #111) | canvas + eixo | decai com idade | Nenhuma (já corrigida numa rodada anterior) | — |

## CAMADA 3 — ZONAS

| OBJETO | Produtor | Fonte | Renderer | Local | Prioridade | Duplicação | Dependências |
|---|---|---|---|---|---|---|---|
| FVG + Order Blocks | `liquidity-zones` (bundle único desde task #247) | candles | `LiquidityZonesPlugin` | canvas | contextual, funde zonas sobrepostas (task #225) | Nenhuma — FVG e OB já renderizam pelo MESMO plugin/pipeline, nunca 2 desenhos | — |
| Zonas Institucionais (confluência) | `institutional-zones.ts` — agrega EMA/VWAP/NL/FVG/OB/EQH/EQL quando concordam na mesma faixa | as camadas acima | `InstitutionalZonePlugin` (faixa) + label `NF` no eixo (`3F`, `4F`...) | canvas + eixo esquerdo | dinâmica (`visual-budget.ts` pondera pela concorrência real) | Nenhuma — a faixa NUNCA substitui o desenho individual de cada ferramenta-fonte, só soma destaque; o rótulo é agregado, não repetido por fonte | `visual-budget.ts` |
| Support/Resistance (S1/R1) | nativo (`support`/`resistance` props) | candles | price line nativa (`axisLabelVisible:false`) + label `PriceLabelStackPlugin` | canvas + eixo | contexto | Nenhuma | — |

## CAMADA 4 — FLUXO / VOLUME

| OBJETO | Produtor | Fonte | Renderer | Local | Prioridade | Duplicação | Dependências |
|---|---|---|---|---|---|---|---|
| Volume Profile (histograma) | `nexus` volume-profile calc | candles (janela fixa) | `VolumeProfilePlugin` | lane própria (`chart-profile-lanes.ts`, offset 0) | contextual (relevância por proximidade real ao POC/HVN) | Ver achado 2.1 abaixo | — |
| VPOC (Volume Point of Control) | mesmo cálculo acima | — | linha magenta (`VolumeProfilePlugin`) + label `VPOC` (eixo esquerdo) | canvas + eixo | contexto | **Ver achado 2.1 — mesmo conceito que TPOC** | — |
| TPO Profile (histograma) | `nexus/tpo-profile.ts` (Steidlmayer/CBOT, por CONTAGEM de período) | candles (sessão corrente) | `TpoProfilePlugin` | lane própria (offset 1) | contextual (existência, não proximidade) | Ver achado 2.1 | — |
| TPOC + VAH + VAL + IBH/IBL | mesmo `tpo-profile.ts` | — | linhas + labels no eixo esquerdo | canvas + eixo | contexto | **Ver achado 2.1** | — |
| CVD | nativo | trades agregados | linha/série própria | canvas | contexto (toggle manual) | Nenhuma | — |
| VWAP (+ ±σ bands) | nativo + `vwap-bands` | candles | linha + bandas + label `VWAP` (tier `primary`) | canvas + eixo direito | primary (acionável) | Nenhuma | — |
| EMA | nativo | candles | linha + label `E{period}` | canvas + eixo | primary | Nenhuma | — |
| Footprint | volume-por-preço-por-candle | candles | plugin próprio | canvas (toggle manual) | contexto | Nenhuma — granularidade diferente de Volume Profile (por candle, não agregado na janela) | — |

### Achado 2.1 — a ÚNICA duplicação conceitual real encontrada

Sob a regra nova ("múltiplos produtores podem calcular, mas o CONCEITO só
pode ter UMA representação visual"): **Volume POC/VAH/VAL e TPO
POC/VAH/VAL representam o mesmo conceito** ("onde o mercado considera o
preço mais justo/mais negociado agora") por **duas metodologias
diferentes** (volume-no-preço vs. tempo-no-preço). Confirmado em código:

- `DEFAULT_CHART_LAYER_VISIBILITY.volume_profile = true` **e**
  `.tpo_profile = true` — ambos ligados por padrão simultaneamente.
- `nexus/layer-relevance.ts`: os dois têm critérios de relevância
  **totalmente independentes** (`volume_profile` por proximidade real ao
  preço vivo; `tpo_profile` por mera existência do perfil) — nada os
  torna mutuamente exclusivos hoje.
- Resultado real, confirmado no screenshot (dado sintético offline):
  `TPOC 68377` aparece no rótulo lateral; `VPOC` não apareceu só porque
  perdeu a disputa pelo teto de 3 rótulos (`MAX_CONTEXT_LABELS`) — mas a
  LINHA do VPOC continua desenhada no canvas de qualquer forma (mesma
  lógica de "linha nunca é podada, só o rótulo" documentada em
  `PriceLabelStackPlugin.tsx`). Ou seja: 2 linhas reais de "ponto de
  controle" simultâneas no mesmo gráfico, cada uma com seu próprio nome
  (VPOC/TPOC) para não colidir — o sintoma exato que a nova regra pede
  para eliminar.

Isto **não existia** como duplicação sob a regra antiga desta sessão
(métodos diferentes = produtores diferentes = ok coexistirem, cada um
com seu único dono de renderização) — mas a ORDEM DEFINITIVA piso a
régua mais alto: o mesmo CONCEITO (POC/VAH/VAL) não pode ter 2
representações visuais simultâneas por padrão, mesmo vindo de produtores
diferentes. Resolução aplicada nesta rodada (FASE 3, abaixo).

## CAMADA 5 — CONTEXTO (sessões/kill zones)

| OBJETO | Produtor | Fonte | Renderer | Local | Prioridade | Duplicação |
|---|---|---|---|---|---|---|
| Market Sessions (Ásia/Londres/NY) | `market-session.ts` | horário real (UTC) | `SessionsPlugin` (faixa fina, já reduzida task #103) | canvas de fundo | baixa, nunca domina candle | Nenhuma |
| Kill Zones (ICT) | `kill-zones.ts` | mesmo particionamento de tempo | plugin próprio, já distinto de sessões (§6.48) | canvas | baixa | Nenhuma — conceito diferente (janela institucional estreita ⊂ sessão), já documentado como não-duplicação numa rodada anterior |
| Session Key Levels | `computeSessionKeyLevels` (mesma partição de `market-session.ts`) | máx/mín real de cada sessão | `SessionKeyLevelsPlugin` + label eixo | canvas + eixo | contexto | Nenhuma — reusa a partição, adiciona um conceito novo (nível de preço, não de tempo) |

## CAMADA 6 — TRADE PLAN

| OBJETO | Produtor | Fonte | Renderer | Local | Prioridade |
|---|---|---|---|---|---|
| Entry/Stop/TP1/TP2/TP3 | `tradePlan` (Conselho) OU `engineFallbackLevels` (Núcleo, só quando Conselho ausente — nunca os dois ao mesmo tempo) | Council/Core Engine | linhas no canvas + labels tier `critical` no eixo (mesma função, mesmo input, nunca diverge — comentário explícito no código) | canvas + eixo direito | crítica, nunca podada | Nenhuma — já é "uma entidade visual única" desde a Ordem "Lapidação Visual Final" |
| Trade Plan Zone (faixa) | mesmo `tradePlan` | — | `trade_plan_zone` layer | canvas | crítica | Nenhuma |
| Banner "SEM TRADE PLAN" | `tradePlanAbsenceReason()` — função pura ÚNICA | Council/Core state | usado no header (`TradePlanTopStrip`) **e** no canvas (`EnhancedChart_110_Percent.tsx`) | header + canvas | — | Nenhuma — mesmo padrão "glance + drill-down": 1 cálculo, 2 exibições com detalhe diferente, não 2 cálculos |

## CAMADA 7 — INTELIGÊNCIA

| OBJETO | Produtor | Renderer | Duplicação |
|---|---|---|---|
| Confluência (NF — "3F"/"4F"...) | `institutional-zones.ts` + `visual-budget.ts` | label no eixo esquerdo | Nenhuma |
| Bias/Sinal do Núcleo | Core Engine (LEI 24) | `CoreSignalBadge` (header) — única fonte de LONG/SHORT/WAIT real | Nenhuma (LEI 24 já garante isso) |

## Painéis (fora do canvas)

Mapeamento resumido — já coberto em detalhe em
`AUDITORIA_VISUAL_ANTIDUPLICACAO.md` (sessão anterior), reconfirmado
aqui: painel esquerdo (Core Intelligence) e painel direito (Properties)
**não controlam os mesmos objetos** — Properties é hoje só Layer Manager
+ atalho de Settings (`PropertiesPanelBody`); Risk/Alerts/Trade Plan
ficam em `SecondaryModuleView` (abas RISK/ALERTS) e no
`TradePlanTopStrip`/drawer de Trade Plan, não duplicados em Properties.
Isso diverge do gabarito visual (que lista Risk/Alerts dentro de
Properties) — decisão pendente, não uma duplicação em si (ver resposta
ao Operador).

## Resumo FASE 2 — duplicações encontradas

| # | Achado | Severidade | Ação |
|---|---|---|---|
| 2.1 | VPOC (Volume Profile) e TPOC (TPO Profile) — mesmo conceito "Point of Control", 2 produtores, 2 linhas+rótulos simultâneos por padrão. Mesmo raciocínio se estende a VAH/VAL (Volume Profile não desenha VAH/VAL hoje — só TPO desenha — então só o POC está de fato duplicado; VAH/VAL não, por ora) | Real, sob a regra nova | **Resolvida — ver FASE 3** |
| 2.1-bis | Equilibrium (Premium/Discount, 50% do dealing range) e FIB 50.0% (Fibonacci) — mesmo par de swing real (findSwings compartilhado, confirmado em `engine-bridge.ts:786` e no header de `premium-discount.ts`), logo o MESMO preço sempre que os dois motores computam com sucesso ao mesmo tempo. 2 linhas nativas (`createPriceLine`) nesse ponto por padrão (os 2 layers vêm `true`) | Real, sob a regra nova — achado desta 2ª rodada (Visual Cleanup & Rendering Audit) | **Resolvida — ver §"Visual Cleanup & Rendering Audit" abaixo** |
| 2.2 | Pilha de rótulos esquerda (TREND/POC/confluência) lida como bloco único a um relance | Não é duplicação nem bug de colisão — `resolveLabelStackPositions` foi reverificado com a função real (`price-label-stack.ts`, e via probe de execução real desta rodada) e comprovadamente mantém 7px de vão entre caixas adjacentes. O que existe é sub-diferenciação visual (cores muito próximas, texto sempre cinza neutro) | Candidato real para FASE 5 (Label Collision Manager) — não corrigido, registrado como pendência |
| 2.3 | Linhas estruturais sem rótulo em nenhum lugar da tela quando perdem a disputa pelo teto de 3 (`MAX_CONTEXT_LABELS`) | Decisão já documentada/deliberada (Especificação Visual v1) — não é bug novo | Candidato real para FASE 5 |
| 2.4 | Todo o resto do checklist do §2 (Volume/EMA/Sweep/Wall/S-R/Kill Zones/Sessões/Trade Plan) | — | Confirmado single-owner, zero duplicação |

## Visual Cleanup & Rendering Audit (2ª rodada, "ORDEM DEFINITIVA...")

Baseline real capturado (Playwright, dado sintético offline, mesma técnica já
documentada): dashboard completo e gráfico isolado em 15m e 1H, painel
Properties aberto. Achado 2.1-bis (acima) veio dessa inspeção — visível no
1H, onde Fibonacci e Premium/Discount coexistiam por padrão.

**Resolução aplicada (FASE 3, mesmo padrão do Achado 2.1):** FIB 50.0% vira
o dono canônico do ponto de 50% (carrega confluência real — "×N" no
título — Equilibrium sozinho não); `EnhancedChart_110_Percent.tsx` some
com a linha "Equilibrium · 50%" especificamente quando Fibonacci já vai
desenhar o mesmo preço agora. `rangeHigh`/`rangeLow` (topo/fundo do
range) continuam sempre reais — Fibonacci nunca desenha 0%/100%
(`FIB_RETRACEMENT_RATIOS` não inclui os extremos), então não há
sobreposição nesses 2 pontos. Zero cálculo removido: `premium-discount.ts`
e `fibonacci-confluence.ts` continuam 100% intactos, `premiumDiscount.
equilibrium` continua usado normalmente pela % de posição na faixa
(App.tsx). Verificado com diff de pixel real entre screenshot antes/depois
(mesmo dado sintético, mesmo timeframe 1H): 1.474 pixels mudaram, 100%
concentrados numa única linha horizontal (a linha de Equilibrium removida)
— nenhuma outra mudança real no frame.

### Auditoria de performance (checklist do Operador)

Verificação real (grep estrutural nos 15 plugins de canvas +
`chart-profile-lanes.ts` + leitura de `App.tsx`/`EnhancedChart_110_Percent.tsx`):

- **Renderizações/overlays/listeners duplicados**: NENHUM plugin usa
  `setInterval` (confirmado: 0 ocorrências nos 15 arquivos) — todo redesenho
  é orientado a evento real (WS/range/resize), nunca um polling perpétuo.
  Todos os 15 seguem EXATAMENTE o mesmo padrão (1 `requestAnimationFrame`,
  1 `ResizeObserver`, `subscribeVisibleLogicalRangeChange` +
  `unsubscribe...` no cleanup, guarda `rafScheduled`) — zero exceção,
  confirmado por grep quantitativo linha a linha.
- **Objetos fora da viewport**: já descartados por plugin (`if (y === null)
  return;` — `series.priceToCoordinate` fora da área visível nunca é
  desenhado; mesmo padrão em todos os plugins ancorados a preço).
- **Cálculos repetidos exclusivamente para UI**: nenhum polling encontrado;
  o que existe é recomputação de funções baratas (ex.: `detectWalls` sobre
  no máximo 8 níveis por lado) dentro do próprio `draw()`, já protegida
  pelo dirty-flag — não é "trabalho desperdiçado", é o padrão real e
  intencional deste codebase.
- **Achado real, NÃO corrigido nesta rodada (risco arquitetural, fora de
  escopo de uma limpeza visual)**: `EnhancedChart_110_Percent` e outros
  consumidores leem de um `WidgetContext` único (`contextValue` em
  App.tsx), recomputado com uma lista de dependências muito grande. Isso
  significa que QUALQUER mudança em qualquer uma dessas dependências
  (ex.: um tick de preço) força React a re-executar a função do componente
  do gráfico inteiro (~8700 linhas, 20+ filhos condicionais), mesmo quando
  nenhum plugin específico precisa redesenhar (o canvas em si continua
  protegido pelo dirty-flag, mas o CUSTO DE RECONCILIAÇÃO do React não
  é gratuito). Isto é uma HIPÓTESE fundamentada em leitura de arquitetura,
  não um número medido com profiler real — dividir o contexto ou trocar
  por seletores mais granulares é uma mudança estrutural grande o
  suficiente pra merecer sua própria rodada isolada (mesmo cuidado que a
  Regra de Ouro 6 do CLAUDE.md pede pro ciclo do Core Engine), não algo pra
  fazer de passagem numa limpeza visual.

### Referência CLEO/Cielo — o que pôde ser confirmado

Pesquisa real (WebSearch) confirma o produto: **Cielo** (cielo.finance) é
real, mas é primariamente uma plataforma de rastreio de carteiras on-chain
multichain (30+ redes) com alertas e execução de swap num clique — não um
terminal de candlestick com indicadores e gestão de posição no próprio
gráfico. O princípio de organização citado (resumo → aprofundamento) É
real e verificável: dashboard "Insights" (leaderboard de carteiras por
PnL) → perfil individual da carteira (Portfolio/PnL/Related Wallets) ao
clicar; feed de transações com 2 modos de densidade (Classic/Lite). A
alegação de posições editáveis direto no gráfico não pôde ser confirmada
por nenhuma fonte encontrada — fica marcada como não verificada, não
usada como base de comparação.

## Visual Cleanup & Rendering Audit (3ª rodada — "linha grandona"/"linha
atravessando" do Operador)

Pedido do Operador: reduzir poluição visual, especificamente linhas
compridas/desnecessárias, com cor profissional "que não dói à vista".
`createPriceLine` (lightweight-charts) é uma primitiva nativa que sempre
ocupa 100% da largura do pane — não existe parâmetro de início/fim, então
"encurtar" uma linha nativa exigiria trocar a técnica de renderização
inteira (série custom com dados limitados, ou canvas próprio como os
outros plugins de zona já fazem). Mudança grande demais pra esta rodada;
o alvo real e tratável é a PROEMINÊNCIA (peso visual/alpha), não a
geometria.

### Achado 2.3 — S1/R1 era a única price line sem nenhuma competição por orçamento visual

`grep` confirmou: zero menção de "support"/"resistance" em
`nexus/layer-relevance.ts` E em `nexus/visual-budget.ts`. As linhas
nativas de S1/R1 (`EnhancedChart_110_Percent.tsx`) desenhavam
incondicionalmente (`Number.isFinite(support/resistance)`, sem
`visibility.X`, sem nem entrada em `CHART_LAYER_IDS`) num alpha FIXO
0.65 — FORTE (≥2 toques reais) ou FRACA (1 toque, o próprio nível),
sempre a mesma prominência, nunca cedendo espaço quando Trade Plan/Zona
Institucional/Estrutura já competem pelo mesmo olhar do Operador. Era o
achado mais concreto e evidenciado desta auditoria: toda outra anotação
do gráfico tem no mínimo um toggle `visibility.X`, a maioria também tem
peso resolvido por `nexus/visual-budget.ts` — só S1/R1 não tinha nenhum
dos dois.

**Resolução aplicada:** `levelStrengthBaseWeight(strength)` (novo,
exportado) deriva um peso real 0..1 do MESMO `LevelStrength.touches` que
`support-resistance-engine.js` já computa (piso=1 toque, teto=4 toques —
mesma ordem de grandeza do `CONFLUENCE_CEIL_SOURCES` das zonas
institucionais; zero toque novo contado, zero limiar fabricado). S1/R1
entram como 2 candidatos `category: "STRUCTURE"` no MESMO
`resolveVisualBudget()` que já resolve Trade Plan/Zona
Institucional/Estrutura/Liquidez Principal — a mesma competição cruzada
real, nunca uma segunda arquitetura. `levelLineAlpha(visualWeight)`
(novo, exportado) mapeia o peso resolvido pra uma banda `[0.35, 0.65]`
— teto EXATAMENTE igual ao 0.65 fixo de sempre (zero regressão visual
quando um nível FORTE não tem competição real), piso 0.35 (Regra de Ouro
4: nunca some, só cede ênfase). A cor final da linha nativa E do rótulo
do eixo (`priceAxisLabels`, mesmo `levelLineAlpha`, zero segunda
fórmula) passam a refletir o mesmo peso resolvido.

**Verificação:** `tsc --noEmit` limpo; suíte `vitest` completa
3007/3007 (11 testes novos — execução real das 2 funções puras +
padrão de código confirmando a fiação dos candidatos/pesos/cor, mesmo
critério do resto do arquivo: "matemática sutil" ganha execução real,
"fiação entre módulos" ganha padrão de fonte); `npm run build` limpo
(1889 módulos); Playwright real (dataset sintético OFFLINE já rotulado,
nunca mercado real) confirmou zero erro de console/página em 3 execuções
e presença real de pixels na cor âmbar no canvas renderizado (a
mudança não quebrou a série de renderização nem removeu a cor).

**Pesquisa entregue nesta rodada:** paleta "que não dói à vista" —
confirmado contra fontes reais de 2026 que paletas dark-mode
profissionais para terminais de trading favorecem saturação moderada e
preenchimentos translúcidos sobre neon puro, e que um fundo bem escuro
dessaturado (~#0B0E13) é a base recomendada — o AR10 já usa #0B0E14
(Fase 1 de convergência TradingView), praticamente idêntico. O gap real
remanescente é o par neon `#00ffaa`/`#ff0055` ainda usado em ~10 arquivos
(candles/FVG/OB/structure-breaks/sweep/sessões) — já existe precedente
direto (Trade Plan/preço vivo migraram para o tom TradingView mais suave
`#089981`/`#F23645` por exatamente este motivo). Isto é o item #286
("paleta de cores unificada") — cross-cutting o suficiente (10 arquivos,
identidade visual inteira do gráfico) para merecer sua própria rodada
dedicada com comparação antes/depois completa, não uma extensão desta.

### Achado 2.4 — "bateu o alvo, o sistema já analisa outro parâmetro" era um gap de apresentação, não de dado

Pedido do Operador: quando o sistema valida/bate um alvo, ele deveria
"automaticamente tentar analisar outro parâmetro". Investigação real
(agente de exploração, `signal-track-record.ts`/`App.tsx`/
`aura-lifecycle.ts`) confirmou: o Core Engine (`setInterval` 30s) e o
Trade Plan (`buildTradePlan`, re-derivado a cada ciclo estrutural) já
continuam reavaliando sozinhos, SEM nenhum atraso — o `active` do
track record zera no MESMO tick que prova o último alvo
(`signal-track-record.ts:281-283`), e o próximo `buildTradePlan` real
assume assim que uma estrutura nova qualificar. O gap real nunca foi de
dado — foi de APRESENTAÇÃO: sem plano ativo, a barra de comando e o
canvas sempre mostravam um dos 4 motivos genéricos ("Conselho neutro"
etc.), indistinguível de "nunca houve plano nesta sessão", mesmo no
instante seguinte a um TARGET_HIT/PARTIAL_HIT real. Os únicos
consumidores reais de uma resolução eram todos efêmeros (toast 5s, voz,
fade da Aura em ~12 candles) — nada persistente.

**Resolução aplicada:** `recentResolutionReason()` (novo, App.tsx) cobre
essa janela reusando a MESMA convenção real que a Neural Market Aura já
usa para "por quanto tempo uma resolução ainda é relevante mostrar"
(`DISSOLVE_CONFIG.expireCandles = 12`, agora exportado de
`aura-lifecycle.ts` — zero limiar novo inventado). Só TARGET_HIT/
PARTIAL_HIT entram (validações reais); STOP_HIT continua nos motivos
genéricos de sempre. `tradePlanAbsenceReason()` passa a checar essa
resolução recente PRIMEIRO — nos 2 lugares reais que já mostravam o
motivo de ausência (barra de comando `TradePlanTopStrip` e o canvas via
`ChartWidget`), ambos lendo o MESMO `trackRecord.history` real (zero
segunda fonte).

**Verificação:** `tsc --noEmit` limpo; `vitest` 3011/3011 (14 testes
novos entre as duas correções desta rodada); `npm run build` limpo
(1889 módulos); Playwright real confirmou zero erro de console/página e
que o caminho padrão (sem resolução recente) continua renderizando o
motivo honesto de sempre.

## Visual Cleanup & Rendering Audit (4ª rodada — "liberdade total pra
tirar excessos de linha", pedido do Operador)

### Achado 2.5 — Motor de Cenários (SCENARIO A/B) era a única camada sem NENHUM controle

Auditoria sistemática dos 9 pontos reais de `createPriceLine` (mesma
técnica das rodadas 2-3) confirmou o gap mais completo encontrado até
agora: o Motor de Cenários ("Future Path Map", `scenario-engine.ts`) não
tinha entrada em `CHART_LAYER_IDS` NEM em `layer-relevance.ts` — grep
confirmou zero menção real em qualquer um dos dois arquivos. Diferente
de S1/R1 (Achado 2.3, que já tinha a linha desenhando com alpha real,
só sem competir por orçamento visual), o Scenario Projection não tinha
absolutamente NADA: nem toggle manual no painel Properties, nem
possibilidade de o Relevance Engine reduzir/esconder em modo AUTO —
desenhava sempre que o Conselho produzisse pelo menos 1 alvo projetado,
sem exceção, sem controle do Operador.

**Resolução aplicada:** novo id `scenario_projection` em
`CHART_LAYER_IDS`/`DEFAULT_CHART_LAYER_VISIBILITY`/
`DEFAULT_CHART_LAYER_AUTO_MODE` (mesmo padrão dos outros 24) + gate real
no `useEffect` (`if (!scenario || !visibility.scenario_projection)
return;`) + entrada em `CHART_LAYER_PANEL_MODULES` ("CENÁRIOS (FUTURE
PATH MAP)", painel Properties). `layer-relevance.ts` ganhou o caso
`scenario_projection` — existência real (`hasScenario`: pelo menos 1
alvo projetado em pathA OU pathB), mesmo padrão de
`hasFibonacciLevels`/`hasZigZagPivots`/`hasTpoProfile` — nunca
proximidade ao preço vivo (as 2 rotas já cobrem LONG e SHORT
simultaneamente). `App.tsx` computa `hasScenario` a partir do MESMO
`chartScenario` que o gráfico já recebe — zero segundo cálculo.

**Verificação:** `tsc --noEmit` limpo; `vitest` 3016/3016 (189
arquivos, incluindo o arquivo de teste pré-existente
`scenario-projection-chart.test.ts`, que já travava a fiação da linha
nativa e precisou de 3 ajustes/adições para cobrir o novo gate); `npm
run build` limpo (1889 módulos); Playwright real confirmou zero erro de
console/página.

**Nota honesta sobre o pedido mais amplo do Operador** ("liberdade
total... tirar os excessos... qual a forma correta de evoluir"): a
resposta de fundo é que o sistema já converge para exatamente essa
forma — AUTO/Relevance Engine como modo único, `nexus/visual-budget.ts`
como resolvedor de competição cruzada quando várias camadas relevantes
disputam o mesmo espaço, e cada achado desta auditoria (2.1 a 2.5)
fechando uma lacuna real e específica dentro dessa mesma arquitetura, já
validada e aprovada pelo Operador, em vez de qualquer redesenho novo.
Backlog restante já mapeado e priorizado por evidência real: #286
(paleta unificada — precedente já existe no Trade Plan), #279 (auditoria
de tamanho de etiquetas), #283 (caixas de confluência → overlay
lateral).

## Visual Cleanup & Rendering Audit (5ª rodada — "cada objeto cair em
caixa perfeitamente", "a Fibonacci diferenciada", "a vertical do mercado
aberto/fechado não devia descer")

### Achado 2.6 — Kill Zones: a MESMA reclamação, 2ª vez, porque a causa raiz nunca tinha sido tocada

Este é o achado mais importante da rodada, e o mais desconfortável: o
header de `KillZoneBandsPlugin.tsx` já registrava, palavra por palavra,
uma reclamação anterior do Operador — *"essas linhas amarelas descendo de
cima pra baixo estão atrapalhando o gráfico"*. A correção daquela vez
mexeu em QUANTAS ocorrências desenhavam (passou a desenhar só a mais
recente de cada janela). A **altura** de cada uma nunca foi tocada:
`fillRect(x, 0, w, cssHeight)` + duas bordas verticais de `0` a
`cssHeight` seguiram intactas. Ou seja: tratamos o sintoma (a "cerca" de
18 janelas) e deixamos a causa (cada janela atravessava todo o preço) —
por isso a reclamação voltou nesta sessão, quase com as mesmas palavras.

Auditando o par, apareceu o segundo problema, ainda latente: Market
Sessions e Kill Zones são a MESMA família semântica (janelas de tempo,
nunca níveis de preço), mas cada uma decidia sozinha sua geometria
vertical. Nada impedia que uma passasse a desenhar por cima da outra na
próxima evolução — o mesmo bug de classe que `chart-profile-lanes.ts` já
resolveu para os 3 perfis do lado direito, que colidiam de fato.

**Resolução aplicada:** novo módulo `chart/chart-time-ribbon-lanes.ts`
(irmão direto de `chart-profile-lanes.ts`, mesma técnica no eixo
VERTICAL): `market_session` = 14px no topo (EXATAMENTE o valor real de
hoje — migração de geometria pura, zero mudança visual nessa camada),
`kill_zone` = 6px logo abaixo. `KillZoneBandsPlugin` desenha preenchimento
e bordas dentro da própria lane (`laneTop`/`laneBottom`/`laneHeight`),
nunca mais `0`/`cssHeight`. Alphas base recalibrados (0.06/0.22 →
0.38/0.55): os antigos eram calibrados para uma LAVAGEM de altura total,
e 6% sobre 6px seria literalmente invisível — apagar a camada de fato
violaria a Regra de Ouro 4. O rótulo de nome da janela saiu junto com a
altura: era duplicação literal do badge "Kill Zone ·" do header
(`App.tsx`), a mesma redundância já removida da 2ª linha da faixa de
sessões, e o próprio pedido dispensa o detalhe explicitamente ("você pode
nem saber que a hora que o mercado abria"). `computeKillZoneSpans` e o
decaimento real por idade seguem idênticos — zero dado apagado.

**Verificação REAL (medida, não inspecionada):** o ambiente desta sessão
tem a política de rede negando `fapi.binance.com` (403 no CONNECT do
proxy), então o app real fica corretamente fail-closed ("FALHA AO
CONECTAR AOS FEEDS REAIS (BINANCE)", zero canvas de gráfico) e uma
captura ao vivo do painel era impossível. Em vez de declarar verificação
visual que não aconteceu, foi montado um harness Playwright isolado
(`lightweight-charts` real + `computeKillZoneSpans`/
`computeSessionKeyLevels` reais + timestamps UTC reais de 4 dias como
fixture de harness, nunca no fluxo de mercado) e contados TODOS os pixels
não-transparentes de cada overlay, sem tolerância de cor:

| camada | linhas pintadas | painel |
|---|---|---|
| Kill Zone (depois) | **14–19** (6px) | 520px |
| Kill Zone (antes) | 0–519 (altura total) | 520px |
| Market Session | **0–13** (14px, inalterada) | 520px |

Zero sobreposição entre as duas (fronteira exata 13 \| 14), e a faixa de
tempo inteira passou a ocupar 20px de 520 (~3,8%) contra 100% de antes.

### Achado 2.7 — Fibonacci tinha 2 aparências possíveis, e a hierarquia estava invertida

Pedido: *"a Fibonacci tem de ficar diferenciada pra gente saber qual as
linha dela, como que ela está sendo analisada pro visual"*. Auditoria
confirmou por que a leitura não funcionava: as 5 linhas
(`FIB_RETRACEMENT_RATIOS` = 0.236/0.382/0.5/0.618/0.786) tinham
exatamente 2 aparências — alpha 0.55 se `score > 0`, 0.20 se não. O
**ratio**, que é o que a ferramenta de fato analisa, não entrava na
aparência em nenhum ponto. Consequência real e verificável: um 23.6% com
1 fonte de confluência aparecia MAIS forte que um 61.8% sem nenhuma —
inversão da hierarquia de leitura, justamente na linha que o Operador
precisa achar primeiro. E os níveis primários sem confluência não tinham
NENHUM número na tela (o gate de rótulo era só `score > 0`). Fibonacci
também era, junto com o Motor de Cenários (Achado 2.5), uma das camadas
que nunca competiam por `visual-budget.ts`.

**Resolução aplicada:** peso estrutural real por ratio
(`fibRatioStructuralWeight`): 61.8% (razão áurea) e 50% (ponto médio,
herdado da Teoria de Dow) = níveis de decisão, peso pleno; 38.2%
(complemento de 61.8%) = secundário; 23.6%/78.6% = bordas rasa/profunda.
Isto é hierarquia de LEITURA da ferramenta, explicitamente **nunca** uma
probabilidade ou taxa de acerto (Regra de Ouro 2 — não existe backtest
real aqui que sustentasse isso). `fibRatioBaseWeight(ratio, score)` mistura
70% papel estrutural + 30% confluência real medida — os dois sinais são
reais e independentes ("qual nível esta ferramenta considera decisivo" vs.
"quantas OUTRAS ferramentas concordam com este preço"), nenhum responde
sozinho a pergunta do Operador. Fibonacci entra em `visual-budget.ts` como
STRUCTURE (mesma categoria/prioridade de S1/R1 e BOS/CHOCH — contexto,
nunca decisão; LEI 24). `fibLineAlpha` normaliza a partir do PISO do
orçamento (`VISUAL_BUDGET_FLOOR_WEIGHT`), não de 0, para que os 2 extremos
da banda caiam exatamente em 0.20 e 0.55 — os mesmos 2 valores de sempre,
zero regressão em qualquer ponta, só passou a existir gradiente entre eles
(sem isso o piso de 0.35 empurraria a linha mais fraca para ~0.32,
deixando a camada MAIS carregada que antes — o oposto do pedido).
`fibDeservesAxisLabel` libera rótulo para os ratios primários mesmo sem
confluência; raso continua exigindo confluência real. No pior caso (5
níveis, nenhuma confluência) só 2 rótulos competem — o teto/anti-colisão
por proximidade ao preço vivo continua decidindo quantos de fato cabem.

**Verificação:** `tsc --noEmit` limpo; `vitest` 3048/3048 (190 arquivos,
+32 testes novos — 22 de execução real das funções puras novas, 10 de
fiação); `npm run build` limpo. As funções puras ganharam teste de
execução real (não só padrão de fonte) porque o bug provável aqui era "a
matemática está sutilmente errada" — inclusive um teste que trava
explicitamente a inversão corrigida (61.8% sem confluência > 23.6% com
confluência máxima) e um que prova os 2 extremos da banda de alpha.

### Limitação honesta desta rodada

A verificação visual do app COMPLETO ao vivo não foi possível (rede do
ambiente nega Binance; o app fica fail-closed por design, sem canvas). O
que foi verificado de fato: geometria renderizada em navegador real via
harness isolado (tabela acima), matemática pura por execução real, fiação
por padrão de código, `tsc`/`vitest`/`build` limpos. O que continua
pendente de confirmação: como as 2 mudanças se sentem num painel com
dados reais ao vivo, no iPad — só o Operador pode fechar isso.

### Backlog restante (inalterado, mesma priorização por evidência)

#286 (paleta unificada — precedente já existe no Trade Plan), #279
(auditoria de tamanho de etiquetas), #283 (caixas de confluência →
overlay lateral).

## Auditoria Visual Sistemática (6ª rodada — "julgamento da parte gráfica do
sistema todinho, pra não ficar poluído demais... pesquisa nos terminais mais
profissionais do mundo")

### Achado 3.1 — a poluição tinha um número, e o número era 30

Esta rodada começou medindo em vez de opinando: `grep` de todo
`rgba(r, g, b` em `chart/*` encontrou **30 tripletos RGB distintos**.
Convertidos para HSL e ordenados por matiz, o padrão real apareceu — não eram
30 cores, eram ~7 famílias semânticas espalhadas em 2 a 8 tons quase idênticos:

| matiz | tons | o que era |
|---|---|---|
| 33-50° | **8** | âmbar/amarelo (o pior aglomerado: 8 tons em 17°) |
| 160-170° | 3 | verde/teal |
| 184-193° | 3 | ciano |
| 253-278° | 3 | lavanda/roxo |
| 312-326° | 2 | magenta |
| 340-355° | 3 | vermelho/rosa |
| 207-217° | 2 | azul saturado (+3 slates dessaturados) |

**Pesquisa real (autorizada explicitamente):** o limite prático de uma paleta
categórica é **6-8 cores** — acima de ~6, matizes bem escolhidos já ficam
difíceis de distinguir em elementos pequenos, que é exatamente o caso de uma
linha de 1px. Bloomberg Terminal opera com 5 cores; a paleta padrão do
TradingView, com 7. O princípio de fundo é o data-ink ratio de Tufte, a base
usada por FT/Economist/Bloomberg. A discriminação humana de matiz em alta
saturação precisa de ~15-25° — então os 8 âmbares em 17° eram,
perceptualmente, UMA cor fingindo ser oito.

### Duas conclusões anteriores deste repo foram corrigidas por medição

1. **A versão anterior de `canvas-palette.ts` argumentava** que a maior parte
   dos 25+ tons era "engenharia de matiz deliberada", e concluiu que só o
   DepthChartPlugin tinha drift real. O argumento está CERTO para os intervalos
   ENTRE famílias — e por isso foi preservado. Mas ele nunca foi medido, e não
   cobria os aglomerados DENTRO de cada família, que não tinham nenhum
   comentário no código defendendo qualquer um deles. Isso era drift puro.
2. **O mesmo comentário afirmava** que o magenta do POC ficava "a ~30° do
   vermelho SHORT". Medido: o tom implementado (`255,60,172`, matiz 326°)
   estava a **14°**. A intenção declarada estava certa; o valor implementado
   não a cumpria. O tom adotado agora (`236,81,205`, 312°) cumpre: 43°.

### Decisão do Operador registrada: par alta/baixa

A medição encontrou DOIS pares alta/baixa a 10-15° um do outro — o neon
original (`#00ffaa`/`#ff0055`, 21 usos cada) e o par TradingView
(`#089981`/`#f23645`, adotado só para o Trade Plan na task #325). Eles não
podiam coexistir, e escolher entre eles é identidade visual, não limpeza de
drift — então foi perguntado. **O Operador escolheu os tons TradingView**, que
agora valem para o gráfico inteiro. Menos fluorescente para sessão longa, e
continua a direção já aprovada (task #325, e a saída do estilo neon/CRT nas
tasks #242-246).

### A paleta canônica (6 famílias)

| família | matiz | valor | papel |
|---|---|---|---|
| `attention` | 38° | `245, 158, 11` | nível a observar + contexto de tempo (S1/R1, Kill Zone, sessão, sweep, entrada) |
| `bullish` | 170° | `8, 153, 129` | alta / LONG / bid / alvo |
| `measurement` | 217° | `138, 180, 248` | medição e referência sem viés (Fibonacci, Volume Profile, VWAP, Equilibrium, TPO, ZigZag) |
| `projection` | 255° | `167, 139, 250` | o que ainda NÃO aconteceu (cenário, harmônico) |
| `institutional` | 312° | `236, 81, 205` | zona/perfil institucional (POC) |
| `bearish` | 355° | `242, 54, 69` | baixa / SHORT / ask / stop |

Separação mínima entre famílias: **38°** (folgadamente acima do limiar de 24°).
O ciano da Fibonacci teve de sair porque ficaria a 14° do verde TradingView —
e Fibonacci/Volume Profile/VWAP/Equilibrium/TPO/ZigZag são todos a MESMA coisa
semanticamente (medem onde o preço esteve, sem opinar para onde vai), então
viraram uma família só. Luminosidade e alpha seguem livres dentro de cada
família — é assim que a hierarquia deste projeto sempre funcionou
(`nexus/visual-budget.ts`), e a paleta reforça isso em vez de competir.

### Resultado medido

| | antes | depois |
|---|---|---|
| tripletos RGB distintos no código | **30** | **20** |
| cores com significado | 25 | **15 tons em 6 matizes** |
| pares indistinguíveis (<15°) | 13 | **0** |

### A trava (a parte que importa mais que a limpeza)

O Achado 2.6 ensinou a lição do jeito difícil: a Kill Zone foi reclamada DUAS
vezes porque a primeira correção não deixou nenhum teste impedindo a
regressão. Drift de cor é a mesma classe de problema, e pior — não volta de uma
vez, volta um `rgba()` por vez, cada um parecendo inofensivo na revisão do
próprio PR. Foi assim que chegamos a 30.

`tests/canvas-palette.test.ts` agora MEDE o matiz de toda cor do CÓDIGO de
`chart/*` a cada rodada e falha se aparecer qualquer tom fora das 6 famílias,
ou se duas famílias chegarem a menos de 24° uma da outra. Comentários são
removidos antes da medição (as citações históricas dos tons antigos são
memória legítima — mesma lição do Achado 2.5). Revisão manual não é mais a
defesa.

### Escopo honesto do que NÃO foi feito

A unificação cobre o **canvas** (`src/chart/*`), que é onde a medição dos 30
tons estava e onde a reclamação de poluição vive. O resto da UI (badges,
widgets, telemetria em `App.tsx`) tem a própria paleta e **não** foi migrado —
seria uma superfície muito maior, e meia-migração é pior que nenhuma. Fica
registrado como o próximo passo real dessa frente, não como concluído.
Também não foi possível conferir ao vivo: a rede deste ambiente nega Binance,
então a validação foi `tsc`/`vitest` 3058/3058/`build` + a trava de matiz.
Como a mudança do par alta/baixa se sente com dados reais no iPad só o
Operador pode fechar.
