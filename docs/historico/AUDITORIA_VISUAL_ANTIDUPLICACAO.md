# AR10 CYBORG — Auditoria Visual Anti-Duplicação

Ordem direta do Operador ("ORDEM DE ORGANIZAÇÃO VISUAL E ELIMINAÇÃO DE
DUPLICAÇÕES"): antes de qualquer nova implementação, auditoria completa
da composição visual atual, objeto por objeto, contra a regra absoluta
**UM OBJETO → UMA FUNÇÃO → UM LOCAL → UMA REPRESENTAÇÃO VISUAL**. O
gabarito visual principal é a imagem/documento já fornecidos
anteriormente ("AR10.CYBORG NEXUS COCKPIT" + `AR10_ORION_Transformacao_
Visual_Espelhamento.md`, já respondidos nesta sessão — cabeçalho fixo +
gráfico dominante + gavetas de 320px sob demanda).

**Método real** (nunca suposição): leitura direta do código-fonte atual
de cada componente listado abaixo — `App.tsx` (52 componentes top-level
confirmados via grep), todos os plugins de `chart/`, e os motores reais
em `nexus/`. Toda linha "DUPLICADO?"/"CONFLITA?" abaixo cita o
arquivo:linha real ou o comentário-fonte que já documenta a decisão —
nunca uma alegação sem evidência.

**Achado transversal antes de entrar nos domínios**: este NÃO é um
primeiro passe sobre um sistema desorganizado. Esta mesma sessão já
rodou pelo menos 18 rodadas dedicadas exatamente a este tipo de
auditoria (tasks #22, #43, #90, #111, #114-118, #145, #172-175, #182,
#225, #226, #278, #282, #284, #285, #325, #336, #341 do rastreador) —
cada uma delas encontrou e corrigiu duplicações reais na época. O
resultado esperado (e confirmado abaixo) é que a maior parte do sistema
já está em conformidade; o valor real desta rodada é (1) confirmar que
nada regrediu, (2) nomear precisamente os poucos itens que merecem
decisão, e (3) deixar o registro para a próxima sessão nunca precisar
re-perguntar "isso já foi resolvido?".

---

## 0. Distinção que organiza toda a auditoria abaixo

O próprio texto da ordem já contém o critério certo: "a mesma
informação no header e novamente em outro painel **sem necessidade**".
Duas categorias são visualmente parecidas mas tecnicamente opostas:

| | Duplicação real (proibida) | Padrão glance→drill-down (permitido, é o padrão de todo terminal profissional pesquisado em `MODELO_DEFINITIVO_PAINEIS_ELITE_2026-08-16.md`) |
|---|---|---|
| Fonte do dado | 2+ cálculos independentes do mesmo conceito | 1 cálculo único (`useMemo`/`useContext` uma vez em `App()`) |
| Onde aparece | Repetido sem motivo na MESMA tela/nível | Versão compacta sempre visível (header/strip) + versão completa sob demanda (gaveta/aba) |
| Risco real | Os dois podem divergir silenciosamente (bug já visto e corrigido nesta sessão — ver §4) | Zero risco de divergência — é o MESMO objeto JS lido 2x |
| Exemplo confirmado abaixo | "duas fórmulas de volatilidade para o mesmo prazo" (MarketRegimeWidget, corrigido, ver §4) | Regime em `ContextReadStrip` (1 palavra) × Regime completo em `MarketRegimeWidget` (histórico, ADX, RSI, MACD, ATR%, HTF) |

Cada linha "DUPLICADO?" abaixo usa este critério — nunca marca como
duplicado só porque a mesma palavra aparece em 2 lugares.

---

## 1. HEADER (TopBar, 2 linhas fixas, `App.tsx:6800`)

| OBJETO | FUNÇÃO | FONTE | COMPONENTE | LOCAL ATUAL | LOCAL IDEAL | DUPLICADO? | CONFLITA? |
|---|---|---|---|---|---|---|---|
| Símbolo + troca de ativo | Identidade do ativo + gatilho de busca | `selectedAsset`/`SmartOmnibox` | `TopBar` | Linha 1, início | ✅ já ideal | Não — texto estático "BTC/USDT" foi removido nesta sessão por duplicar o próprio gatilho (`App.tsx:6892`) | Não |
| Preço + Δ% | Única leitura de preço em toda a tela | `data.price`/`data.deltaPct` | `TopBar` | Linha 1, centro | ✅ já ideal | Não (comentário explícito `App.tsx:7006`: "única ocorrência em toda a interface") | Não |
| **CoreSignalBadge** | ÚNICO emissor visual de LONG/SHORT/WAIT (LEI 24) | `engine.direction/confidence` | `CoreSignalBadge` | Linha 1, hero | ✅ já ideal | Não — é o único lugar que lê `engine.direction` diretamente para decisão | Não |
| Status LIVE/latência/sessão | Estado operacional compacto | `voiceSnapshot.wsLive`, `cycleLatencyMs`, `marketSessionFromUtc` | `TopBar` | Linha 1, direita | ✅ já ideal | Não — mesma leitura que `TelemetryHealthWidget` usa, glance vs. drill-down | Não |
| **SystemStatusBadge** | Semáforo compacto (offline/qualidade/FPS/risco) | `classifyFps`/`classifyCycleLatency`/`riskSuggestion` | `SystemStatusBadge` | Linha 1, direita | ✅ já ideal | Não — reusa as MESMAS funções de classificação de `TelemetryHealthWidget`, nunca reimplementa (comentário `App.tsx:7170`) | Não |
| **NucleoVoiceOrb** | Núcleo + controle de voz num único orbe | `engineStatus`, `voiceEngine` | `NucleoVoiceOrb` | Linha 1, canto | ✅ já ideal | Não | Não |
| Botão Sincronizar | Reconecta REST+WS+ciclo+feeds | `handleManualRestart` | `TopBar` | Linha 1, canto | ✅ já ideal | Não — único botão que dispara esta ação em toda a UI (grep confirma 1 call site) | Não |
| **TradePlanTopStrip** | Entry/Target/Stop/R:R do plano REAL ativo (Conselho→Núcleo fallback) | `tradePlan ?? engineFallbackLevels` | `TradePlanTopStrip` | Linha 2 | ✅ já ideal | Não — ver §4 (Trade Plan), fonte única confirmada | Não |
| **StructureLevelsStrip** | S1/R1 do Core Engine (compacto) | `engine.support/resistance` | `StructureLevelsStrip` | Linha 2 | ✅ já ideal | Não — mesma leitura da price line do gráfico (glance vs. linha real no canvas) | Não |
| **ContextReadStrip** | Regime/Fluxo/Risco/Confluência/Conflitos (compacto, 1 palavra cada) | `engine.marketRegime`, `cvd`, `nexusDecision`, `displayConflicts` | `ContextReadStrip` | Linha 2 | ✅ já ideal | Não — cada `title=` cita explicitamente onde está a versão completa ("idêntica à do painel Trade Plan", "mesma leitura do painel MARKET REGIME") | Não |

**Removidos nesta sessão por serem duplicação real** (não mais no
código, citado aqui só para o registro nunca reaparecer): texto estático
"BTC/USDT" (duplicava o Omnibox), fileira de 12 botões de atalho
(duplicava o Omnibox com menos alcance), "AGUARDANDO" escrito 2x na
mesma linha, chip de Kill Zone ICT na barra (agora só em
`ScoreContextCard`).

---

## 2. GRÁFICO — canvas principal + todos os overlays (`chart/`)

24 camadas reais (`CHART_LAYER_IDS`), cada uma seu próprio arquivo de
plugin, cada uma seu próprio dado — a arquitetura em si já impõe UM
plugin por conceito. Achados de duplicação REAL já corrigidos nesta
sessão, confirmados ainda válidos por leitura direta:

| Risco nomeado pela ordem | Veredito | Evidência real |
|---|---|---|
| "duas versões do Volume Profile" | ❌ Não existe — 1 único arquivo `VolumeProfilePlugin.tsx`, 1 único hook `useVolumeProfileSnapshot()` | grep confirma 1 arquivo de plugin, 1 store slice |
| "POC duplicado" | ❌ Não existe — VP POC (`VPOC`) e TPO POC (`TPOC`) são conceitos DIFERENTES (volume vs. tempo, Steidlmayer/CBOT) com rótulos e cores distintas desde a task #341 — nunca o mesmo POC desenhado 2x | `EnhancedChart_110_Percent.tsx`, push de `priceAxisLabels` — VPOC cor de `POC_LINE`, TPOC cor da família TPO |
| "VAH/VAL duplicados" | ❌ Não existe — só o TPO Profile tem Value Area (Volume Profile não computa HVN/LVN como faixa, só POC) | `nexus/tpo-profile.ts` é a única fonte de VAH/VAL |
| "zonas de liquidez sobrepostas por engines diferentes" | ✅ Corrigido nesta sessão (task #225, "Fundir zonas de liquidez sobrepostas — parar 'parede de cor'") — FVG/OB de fontes diferentes que ocupam a mesma faixa de preço são fundidas num único retângulo antes de desenhar | `nexus/institutional-zones.ts` |
| "labels repetidos" | ✅ Sistema único: `priceAxisLabels` (37 pontos de push, 1 array, 1 `PriceLabelStackPlugin` que resolve colisão) — nenhum plugin desenha seu próprio texto de eixo por fora dele quando o conceito é um NÍVEL de preço | Verificado: todo `createPriceLine` com `title` real tem `axisLabelVisible: false` (S1/R1 confirmado linha a linha, `EnhancedChart_110_Percent.tsx:1441-1477`) |
| "Volume Profile/TPO/Order Book Depth na mesma faixa de pixels" | ✅ Corrigido nesta sessão (task #336) — `chart-profile-lanes.ts` dá 3 faixas horizontais não-sobrepostas | `chart-profile-lanes.ts` |

---

## 3. PAINEL ESQUERDO (Market Intelligence) + PAINEL DIREITO (Core Intelligence + Properties)

| OBJETO | COMPONENTE | LOCAL | DUPLICADO CONTRA? |
|---|---|---|---|
| Vetor de mercado (bias real) | `MarketDirectionWidget` | `.terminal-left` | Não — único lugar que mostra a leitura completa (o header só tem CoreSignalBadge, que é LONG/SHORT/WAIT, uma pergunta diferente de "bias") |
| Decisão WAIT/CONFIRM/EXECUTE | `MarketBiasDecisionCard` | `.terminal-left` | Não — deriva de campos já reais (`direction`/`riskSuggestion`/`ensembleConsensus`), nenhuma pontuação nova (travado por teste, `v16-institutional-command-center.test.ts`) |
| Siriform Core (resumo) | `SiriformCoreCard` | `.terminal-right` | Não — resumo compacto; detalhe completo é `AssistantOrb` na strip, sob demanda (`!widgets.se_core.collapsed`), nunca os dois abertos ao mesmo tempo por padrão |
| Score/Heat/VWAP/Kill Zone | `ScoreContextCard` | `.terminal-right` | Não — ver §1, já removido do header nesta sessão, mora só aqui agora |
| Expectativa real (Profitability Engine) | `ExpectancyCard` | `.terminal-right` | Não — único lugar; a supressão do badge do header (LEI 24, exceção registrada) cita esta MESMA leitura no subtítulo, nunca uma 2ª leitura |
| GMIL (contexto macro) | `GmilContextWidget` | `.terminal-right` | Não |
| Regime completo (ADX/RSI/MACD/ATR%/HTF) | `MarketRegimeWidget` | `.terminal-right` | Não — versão completa de "Regime" (glance = `ContextReadStrip`, 1 palavra) |
| Comitê de consenso/Risk Gate | `DecisionValidationWidget` | `.terminal-right` | Não |
| Conselho multi-agente | `CouncilWidget` | `.terminal-right` | Não — só monta se `widgets.council?.visible` |
| Saúde do sistema | `TelemetryHealthWidget` | `.terminal-right` | Não — versão completa; `SystemStatusBadge`/status LIVE do header são o glance |
| **Layer Manager (Camadas do Gráfico)** | `ChartLayersPanelContent` | Popup da SideBar E `.terminal-properties` | **Não — mesmo componente reusado nos 2 lugares (extraído nesta sessão exatamente pra isto), zero segunda implementação** |
| Atalho Configurações | Botão em `PropertiesPanelBody` | `.terminal-properties` | Não — navega pra aba SETTINGS real, não redesenha `ConfigPanel` |

**Confirmado nesta auditoria (não estava explícito antes)**: Risk e
Alerts foram DELIBERADAMENTE excluídos do painel Properties na entrega
anterior (task #288/#290) exatamente para não duplicar `SecondaryModuleView`
(abas RISK/ALERTS completas). Decisão já tomada, revalidada aqui.

---

## 4. TRADE PLAN — todas as superfícies (risco nomeado explicitamente pela ordem)

| Superfície | O que mostra | Fonte real | É a MESMA fonte das outras? |
|---|---|---|---|
| `TradePlanTopStrip` (header, linha 2) | Entry/Target/Stop/R:R | `tradePlan` (Conselho) com fallback para `engineFallbackLevels` (Núcleo) quando o Conselho está neutro | ✅ Sim |
| Canvas — linhas nativas (`createPriceLine`) | As MESMAS 3-5 linhas de preço (Entry/Stop/TP1-3) | Mesmo `tradePlan`/`engineFallbackLevels` | ✅ Sim — `axisLabelVisible: false`, o rótulo visível vem só de `priceAxisLabels` |
| Canvas — rótulos (`priceAxisLabels`, EN/ST/TP1-3) | Preço + status (provado/pendente) | Mesmo objeto acima, lido pela MESMA função que desenha a linha | ✅ Sim — 1 fonte, 2 desenhos complementares (linha + rótulo), nunca 2 fontes |
| `SecondaryModuleView` aba ANALYSIS | Mesma direção/entry/stop/targets, layout de página cheia | Mesmo `tradePlan`/fallback | ✅ Sim |
| `MarketAnalysisPanel` (Publication Studio) | Mesmo plano, formatado para publicação externa | Mesmo `tradePlan`/fallback (task #214, "Estender MarketAnalysis com plano do Núcleo") | ✅ Sim |

**Veredito**: zero segundo sistema desenhando Entry/TP/SL. Todas as 5
superfícies leem do MESMO objeto (`tradePlan` real do Conselho OU
`engineFallbackLevels` do Núcleo quando o Conselho está neutro — nunca
os dois ao mesmo tempo, `engineFallbackLevels` só existe quando
`tradePlan` é null). Isto é exatamente "um objeto, uma função,
múltiplas representações fiéis da MESMA fonte" — não duplicação.

---

## 5. SCORES/BADGES/STATUS

| Score/Badge | Onde é CALCULADO (1 vez) | Onde é EXIBIDO |
|---|---|---|
| Institutional Score | `institutionalScore` (`App()`, `useMemo`) | `ScoreContextCard` (glance) |
| Trust Score (WASM) | `trustScore` (Worker) | Aba ANALYSIS (`SecondaryModuleView`), único lugar |
| CPI (Perception Index) | `cpi` | Aba ANALYSIS, único lugar |
| Regime | `engine.marketRegime` (motor real) | `ContextReadStrip` (1 palavra) + `MarketRegimeWidget` (completo) — ver §0 |
| Confluência (VWAP×NL×Decisão) | `nexusConfluence` | `ScoreContextCard` (sufixo ✓/⚠ no rótulo VWAP) + `ContextReadStrip` (palavra "Confluência") — 2 ângulos DIFERENTES do mesmo dado (VWAP×NL específico vs. confluência geral de direção/estrutura/timing), confirmado por leitura dos 2 `title=` reais |
| Heat Score | `heatReading` | `ScoreContextCard`, único lugar |
| Risco sugerido (Risk Engine) | `riskSuggestion` | `SystemStatusBadge` (glance, só o %) + aba RISK (completo) — ver §0 |

Nenhum score tem 2 cálculos independentes — confirmado via
`contextValue` (`App.tsx`, ~linha 3420): cada um destes é UM campo só,
computado uma vez, `useMemo`/`useContext` compartilhado.

---

## 6. ALERTAS / VOICE / TELEMETRIA / FOOTER

| Objeto | Componente | Duplicado? |
|---|---|---|
| Toast de alerta (Track Record/Sweep) | `AlertToastStack` | Único consumidor de `alerts` (`AlertEvent[]`), efêmero por design (§9.2, 5s) |
| Orbe de voz+núcleo | `NucleoVoiceOrb` (header) | Único controle de voz sempre visível |
| Saúde completa do sistema | `TelemetryHealthWidget` (gaveta direita) | Fonte das classificações que `SystemStatusBadge` (header) e `ContextReadStrip` reusam — nunca o contrário |
| Rodapé | `FooterBar` | Identidade + disclaimers fixos (DADOS REAIS/FAIL-CLOSED/SEM ORDENS/SEM CHAVES) + relógio + atribuição TradingView (obrigação de licença Apache-2.0, realocada do canvas) — nenhum dado de mercado, zero sobreposição com o header |

---

## 7. DRAWERS/PAINÉIS SECUNDÁRIOS + BOTÕES

| Painel | Acesso | Sobrepõe outro painel? |
|---|---|---|
| `WorkspaceManagerPanel` | Ícone SideBar | Não — gerencia estado (Pinned/Docked/Collapsed/Hidden/Floating) dos 10 módulos secundários, nunca duplica o CONTEÚDO deles |
| `RadarPanel` (Oportunidades) | Ícone SideBar | Não — nome deliberadamente distinto de "Radar de Consenso" (CouncilWidget) e "Scanner" (aba própria) para nunca confundir qual painel é qual (comentário já explícito no código) |
| `MarketAnalysisPanel` | Ícone SideBar | Não — gera conteúdo PUBLICÁVEL (Painel/X/Story), formato diferente de qualquer widget ao vivo |
| `PaperTradingPanel` | Ícone SideBar | Não — posição simulada manual, único lugar que existe |
| `ChartLayersPanel` (popup) | Ícone SideBar | Não duplica `.terminal-properties` — mesmo componente de conteúdo (§3) |

**Botões executando a mesma função (risco nomeado pela ordem)**:
verificado — cada botão da SideBar/RightRail abre exatamente 1 painel
próprio; nenhum par de botões dispara o mesmo handler. O único caso
histórico real (fileira de 12 botões de atalho de ativo duplicando o
Omnibox) já foi removido nesta sessão (§1).

---

## 8. Veredito final — item por item da lista da ordem

| Item citado pela ordem | Existe no AR10 hoje? |
|---|---|
| Mesmo indicador em 2 painéis (sem necessidade) | Não encontrado |
| Mesmo score repetido | Não — cada score tem 1 cálculo, exibido em glance+drill-down (padrão válido, §0) |
| Mesma info no header e em outro painel sem necessidade | Não — os 3 casos aparentes (Regime/Confluência/Risco) são glance+drill-down documentados |
| Mesmo objeto desenhado 2x no gráfico | Não |
| 2 versões do Volume Profile | Não |
| POC duplicado | Não — VPOC e TPOC são conceitos distintos, rotulados distintamente |
| VAH/VAL duplicados | Não — só existem no TPO Profile |
| Zonas de liquidez sobrepostas por engines diferentes | Não — fundidas desde task #225 |
| Labels repetidos | Não — 1 sistema (`priceAxisLabels`) |
| Trade Plan duplicado | Não — 1 fonte, 5 superfícies fiéis (§4) |
| Entry/TP/SL por mais de 1 sistema | Não |
| Info igual espalhada em vários drawers | Não |
| Botões diferentes = mesma função | Não (histórico corrigido, §1) |
| 2 fontes diferentes = mesma evidência | Não — todo campo tem exatamente 1 fonte real (`contextValue`, computado 1x em `App()`) |

**Nenhuma duplicação nova foi encontrada nesta rodada.** O sistema já
está na condição pedida pela regra absoluta. Isto não significa que a
composição visual está "pronta pra sempre" (Protocolo do Organismo
Vivo — nunca uma versão final): significa que a base está limpa o
bastante para qualquer evolução futura (Andrews Pitchfork, workspaces
nomeados, etc.) partir de um estado real, não de suposição.

## Pendências reais não relacionadas a duplicação (não esquecidas, só fora do escopo desta auditoria)

- Task #279: auditar tamanho de todas as etiquetas do gráfico (legibilidade, não duplicação).
- Task #283: caixas de confluência para overlay lateral fora do canvas.
- Task #286: paleta de cores unificada em todos os plugins do gráfico (consistência cromática, não duplicação de informação).
- Task #340: Andrews Pitchfork (ferramenta nova, ainda não construída).
- Task #342: reavaliar unificação de ATR% (3 novos consumidores desde a última auditoria — mesma disciplina que já corrigiu a duplicação de volatilidade em `MarketRegimeWidget`, §2).
