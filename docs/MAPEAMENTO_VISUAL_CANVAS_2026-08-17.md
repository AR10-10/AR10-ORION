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
| 2.1 | VPOC (Volume Profile) e TPOC (TPO Profile) — mesmo conceito "Point of Control", 2 produtores, 2 linhas+rótulos simultâneos por padrão. Mesmo raciocínio se estende a VAH/VAL (Volume Profile não desenha VAH/VAL hoje — só TPO desenha — então só o POC está de fato duplicado; VAH/VAL não, por ora) | Real, sob a regra nova | **Resolvida nesta rodada — ver FASE 3** |
| 2.2 | Pilha de rótulos esquerda (TREND/TPOC/3F) lida como bloco único a um relance | Não é duplicação nem bug de colisão — `resolveLabelStackPositions` foi reverificado com a função real (`price-label-stack.ts`) e comprovadamente mantém 7px de vão entre caixas adjacentes. O que existe é sub-diferenciação visual (cores muito próximas, texto sempre cinza neutro) | Candidato real para FASE 5 (Label Collision Manager) — não corrigido nesta rodada, registrado como pendência |
| 2.3 | Linhas estruturais sem rótulo em nenhum lugar da tela quando perdem a disputa pelo teto de 3 (`MAX_CONTEXT_LABELS`) | Decisão já documentada/deliberada (Especificação Visual v1) — não é bug novo | Candidato real para FASE 5 |
| 2.4 | Todo o resto do checklist do §2 (Volume/EMA/Sweep/Wall/S-R/Kill Zones/Sessões/Trade Plan) | — | Confirmado single-owner, zero duplicação |
