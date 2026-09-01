# AR10 CYBORG — Modelo Definitivo de Painéis (pesquisa de plataformas elite)

Pedido direto do Operador (mensagem de voz): "pegar as plataformas de
trade de mesa, de painéis de mesa, de bot, de sistema... pesquisa
profunda... junta tudo e agora definir o modelo definitivo". Este
documento faz as duas coisas — pesquisa real via `WebSearch` sobre 4
categorias de plataforma + convenções de mercado, e a síntese num
modelo concreto — seguindo a mesma disciplina de
`ELITE_TRADING_RESEARCH_MAP.md` (evidência real com fonte, comparação
honesta com o código real do AR10, nunca popularidade sem base).

**Limite honesto declarado**: `WebSearch` devolve sínteses de busca
(um modelo menor lendo os resultados), não HTML bruto de cada site —
mesma limitação já registrada no `ELITE_TRADING_RESEARCH_MAP.md` §2
("WebFetch direto... retornou HTTP 403"). Um achado da própria busca
("velas de alta em azul") contradiz a convenção real universal
(verde=alta) e foi descartado abaixo — sinal de que síntese de busca
pode errar em detalhe fino; toda afirmação de cor/número foi
cross-checada contra pelo menos 2 fontes independentes antes de entrar
neste documento como fato.

**Nunca é "a versão final"** (Protocolo do Organismo Vivo): "modelo
definitivo" aqui significa a direção concreta e fundamentada agora —
não uma trava contra evolução futura.

---

## 1. O que foi pesquisado (4 categorias + 3 convenções)

### 1.1 Terminais institucionais de mesa (Bloomberg Terminal / LSEG Workspace-Refinitiv Eikon)

LSEG Workspace (ex-Refinitiv Eikon) ~$22k/ano, 19,6% de market share,
~90% da profundidade de dado do Bloomberg por preço menor. Interface
descrita como "moderna e customizável", mas menos "streamlined" que o
Bloomberg segundo usuários reais. Cobre ações/renda fixa/FX/
commodities/derivativos/ESG. Fonte: comparações reais de mercado
(SpotSaaS, Comstock, WinApplications), não documentação oficial de
UI/UX detalhada — a pesquisa não achou material técnico de layout de
painel específico, só posicionamento competitivo. **Aplicável ao
AR10**: confirma o padrão já conhecido (multi-painel denso, hotkey-
first) mas não trouxe detalhe novo de grid/dimensão — já coberto com
mais profundidade por `ELITE_TRADING_RESEARCH_MAP.md` §8 item 1
(Descartar layout Bloomberg-sempre-visível para iPad, manter como
inspiração de densidade de informação, não de mecânica de janela).

### 1.2 Terminais cripto-nativos (Coinglass, TensorCharts)

Coinglass: dashboard único combinando order flow + book L2/L3 +
heatmap de liquidação + funding + open interest + sentimento — MESMA
lista de dados que o AR10 já tem, mas apresentados como confirma o
Operador já pediu (liquidação real, não estimada — o AR10 já é
**melhor** nisso, confirmado por `ELITE_TRADING_RESEARCH_MAP.md` §2
item 9). TensorCharts: heatmap de ordens/trades + contador + níveis de
S/R + book avançado + alarmes de volume/velocidade — foco em DOM
(profundidade) ao vivo, granularidade de tick. **Aplicável ao AR10**:
confirma que o "vocabulário visual" de heatmap de liquidez/liquidação
já adotado pelo AR10 é o mesmo vocabulário real da categoria líder
cripto-nativa — não uma lacuna, uma paridade já resolvida.

### 1.3 Bots / sistemas de automação (3Commas, Cryptohopper, Freqtrade, HaasOnline)

Todos são "configurar um bot → acompanhar estado" — DCA/Grid/Signal
bots (3Commas), Strategy Designer visual + marketplace (Cryptohopper),
estratégia em Python livre (Freqtrade, self-hosted), HaasScript
("engine room", iterativo). Nenhum é um terminal de LEITURA/decisão
como o AR10 — são consoles de CONTROLE de posições automatizadas
(exatamente a categoria que o AR10 rejeita por design, READ_ONLY
incondicional). **Aplicável ao AR10**: zero adoção de mecânica (a
categoria inteira pressupõe execução real, que o AR10 nunca fará) —
mas o padrão visual "estado do bot sempre visível, card compacto por
estratégia" é o mesmo padrão que o `RadarPanel`/`ScannerWidget`
(candidatos, não posições) já usam. Confirma, não muda, direção atual.

### 1.4 Plataformas desktop com workspace dockável (NinjaTrader, Sierra Chart, TradingView Desktop)

NinjaTrader: `File → Workspaces → Save/Restore Workspace`, cada
workspace é um arquivo com posição/config de cada chart, recuperável
por timestamp se corrompido. TradingView Desktop: suporte nativo
multi-monitor sem as limitações de navegador. **Aplicável ao AR10**:
o AR10 JÁ tem o equivalente funcional — `WorkspaceManagerPanel`
(5 estados: Pinned/Docked/Collapsed/Hidden/Floating, por módulo) +
`restoredSession` (`localStorage`, hidrata layout/camadas/EMA/tema no
boot). A DIFERENÇA real: NinjaTrader/TradingView Desktop permitem
MÚLTIPLOS workspaces nomeados e trocáveis (ex.: "Day Trading" vs.
"Análise Macro"); o AR10 tem só 1 workspace vivo por vez. Ver §3.

### 1.5 Dashboards gerais 2026 (Linear, Stripe, Grafana, Vercel)

Achado mais concreto e citável desta pesquisa: **"sidebar navigation
(240-280px) + card-based metric strip (4-6 KPIs) + flexible 12-column
content grid"** é o padrão dominante 2026 fora do domínio financeiro —
e ambos os temas (claro/escuro) são esperados por padrão. Princípios:
1 job por dashboard, 3-5 métricas de alto valor no canto superior-
esquerdo, agrupar por espaço em branco (não borda), cor reservada só
para status. **Aplicável ao AR10, com 1 divergência deliberada e
justificada**: o AR10 já usa sidebar fina de ícone (48-56px, não
240-280px — decisão V16.1/Fase M.1, gaveta por demanda em vez de
sidebar larga sempre expandida, mandato "Gráfico reina sozinho no
boot"); `ContextReadStrip` já é literalmente a "card-based metric
strip" (REGIME/FLUXO/RISCO/CONFLUÊNCIA sempre visível, topo). A
divergência real: **zero tema claro** — decisão deliberada, não
lacuna (ver §4).

### 1.6 Convenções de cor/tipografia de terminal profissional

Padrão real corroborado por múltiplas fontes independentes (Zerodha
Varsity, IBKR BookTrader docs, NinjaTrader/Webull forums): **verde =
lado ask/alta, vermelho = lado bid/baixa** em Time & Sales; IBKR
BookTrader usa amarelo para melhor bid, verde para melhor ask. A
afirmação "vela de alta = azul" (um resultado da busca) **não bate**
com nenhuma fonte séria e foi descartada — a convenção real e universal
é verde=alta/vermelho=baixa. **Já no AR10**: `upColor: "#089981"` /
`downColor: "#F23645"` em `EnhancedChart_110_Percent.tsx` — as cores
EXATAS oficiais do TradingView, confirmadas por grep direto no código
(convergência já feita, task #325, commit anterior desta sessão) —
zero ação necessária, achado que CONFIRMA que o AR10 já está alinhado
com a convenção real de mercado, não com o resultado espúrio da busca.

### 1.7 Ergonomia física de mesa (multi-monitor)

"Golden Arc" 2026: monitores em arco semicircular equidistantes do
olho; layout comum 3x2 ou 2x2, monitor primário 27-32" 4K central,
secundários 24-27" para book/notícias/sentimento; braços articulados
para altura/inclinação independente. **Aplicável ao AR10 (só
indiretamente — é hardware, não software)**: reforça por que a
responsividade "monitor grande/pequeno" que o Operador pediu importa
de verdade — um operador real terá o AR10 num dos monitores secundários
do arco (24-27", não o monitor 4K central dedicado ao gráfico de outra
plataforma) tanto quanto num monitor único. A escala ULTRA LED já
implementada nesta sessão (`chart-ultrawide-scale.ts`, 3 breakpoints
até 4K/UltraWide) já cobre esse espectro real.

### 1.8 Bibliotecas de dockagem (dockview, rc-dock, golden-layout)

`dockview` é hoje o sucessor mais adotado (116k downloads/semana,
zero dependência, tabs+grupos+grid+splitviews+drag-and-drop+popout de
janela) — usado para construir interfaces "estilo IDE" (VS Code é o
caso de uso citado pela própria doc). `rc-dock` é mais simples
(21k downloads/semana), indicado para workspace com abas básico.
`golden-layout` é o mais antigo (6,7k★ GitHub, mas caindo em adoção
frente ao dockview). **Aplicável ao AR10**: nenhum destes é adotado
hoje — o sistema de gavetas fechadas (`.terminal-left/-right/
-properties`, position:absolute+translateX) é deliberadamente MAIS
SIMPLES que um docking manager completo, porque o mandato real
(V16.1) é "o Gráfico reina sozinho, o resto é secundário sob demanda"
— um sistema de dock completo (arrastar/redimensionar/popup de janela)
resolveria um problema que o AR10 não tem (o Operador nunca pediu para
mover o Order Book pra cima do gráfico, por exemplo). Ver §3 para onde
isso PODERIA entrar de forma real e escopada.

---

## 2. Cruzamento honesto: o que já bate, o que diverge por escolha, o que é lacuna real

| Elemento do "modelo elite" pesquisado | Estado real no AR10 | Veredito |
|---|---|---|
| Sidebar fina de navegação por ícone | `SideBar`/`RightRail`, 48-56px (`w-12 md:w-14`), dentro da faixa Apple HIG 44pt já citada em `ELITE_TRADING_RESEARCH_MAP.md` §8.6 | **Já implementado** — mais estreito que o "256px" genérico de SaaS por decisão real (gráfico domina, gavetas sob demanda) |
| Strip de métricas-chave sempre visível no topo | `ContextReadStrip` (REGIME/FLUXO/RISCO/CONFLUÊNCIA) + `TopBar` (preço/símbolo/timeframe/decisão) | **Já implementado** |
| Painel lateral dockado, 280-320px | `.terminal-left`/`.terminal-right`/`.terminal-properties` — `min(320px, 90vw)`, responsivo | **Já implementado** — 320px bate com o padrão "sidebar de detalhe" das plataformas pesquisadas |
| Grid de conteúdo flexível (cards) | `terminal-strip`, `ModulePanel`/`ModuleStat` — cards reais, agrupados por widget | **Já implementado** |
| Cor reservada só para status (verde/vermelho/âmbar) | Paleta já convergida à TradingView (`#089981`/`#F23645`), tons de cyan/âmbar para contexto neutro | **Já implementado** |
| Tipografia monoespaçada para número | `font-mono` no shell inteiro (`App.tsx` raiz), `ui-monospace/'SF Mono'/'JetBrains Mono'` nos preços do eixo | **Já implementado** |
| Workspace management (salvar/restaurar layout) | `WorkspaceManagerPanel` (5 estados) + `restoredSession` (localStorage) | **Já implementado**, com 1 lacuna real: só 1 workspace nomeado por vez (ver §3.1) |
| Dark-mode-first / alto contraste | 100% dark, zero tema claro | **Divergência deliberada** — terminal de decisão, não SaaS genérico; pesquisa da própria sessão (`ELITE_TRADING_RESEARCH_MAP.md` §8.3) já validou alto contraste sobre glassmorphism/tema claro para leitura de número |
| Dockagem arrastar/redimensionar/popup de janela | Não existe — gavetas fixas (abrir/fechar, nunca mover/redimensionar) | **Lacuna real, mas fora do mandato V16.1 hoje** (ver §3.2) |
| Múltiplos workspaces nomeados e trocáveis | Não existe — 1 sessão viva | **Lacuna real e pequena** (ver §3.1) |
| Heatmap de liquidação/liquidez | `liquidation_heatmap`/`order_flow_heatmap` — feed REAL, não estimado | **Já implementado, e melhor que a referência pesquisada** (Coinglass/TradingView usam proxy estimado) |

**Achado central desta pesquisa**: dos ~10 elementos reais do "modelo
elite" pesquisado, **8 já existem no AR10**, 1 é divergência
deliberada e já validada (tema único, dark-first), e só **2** são
lacunas reais e escopáveis. Isso não é um resultado decepcionante —
é a confirmação, com fonte externa nova, de que a arquitetura visual
construída ao longo desta sessão já convergiu para o mesmo lugar que
terminais profissionais reais convergiram por conta própria.

---

## 3. As 2 lacunas reais — escopo concreto, nunca especulativo

### 3.1 Múltiplos workspaces nomeados (baixo risco, aditivo)

Hoje `restoredSession` persiste UM estado (chartLayers/EMA/tema/
widgets). NinjaTrader/TradingView Desktop permitem nomear e trocar
entre vários (“Day Trading” vs. “Análise Macro”). Para o AR10: um
segundo nível opcional sobre o `WorkspaceManagerPanel` já existente —
salvar o estado atual sob um nome, listar/trocar entre presets salvos.
Zero motor novo — é serialização do que já existe hoje sob uma chave
nomeada em vez de uma única chave fixa. **Quarentena** — candidato
real para uma rodada própria e pequena, não uma reescrita.

### 3.2 Dockagem real (arrastar/redimensionar) — só SE o mandato mudar

`dockview` é o candidato tecnicamente correto SE o Operador algum dia
quiser mover/redimensionar painéis livremente (em vez de abrir/fechar
gavetas fixas). Isto NÃO é recomendado agora: contradiz diretamente o
mandato V16.1 ("o Gráfico reina sozinho, gavetas fechadas por
padrão") que o próprio Operador escolheu depois de rejeitar a V16
original (3 colunas sempre visíveis). Registrado aqui como referência
técnica real (não uma "seria legal ter" vaga) — se o pedido for feito
no futuro, `dockview` é a biblioteca correta (zero dependência, adoção
real, suporta exatamente o padrão IDE que seria necessário), não
`golden-layout` (perdendo adoção) nem construir do zero. **Laboratório,
gated por decisão explícita do Operador** — nunca implementado sem
esse pedido específico, porque mudaria a filosofia central de layout.

---

## 4. O modelo definitivo (síntese)

Não é uma reescrita — é a confirmação nomeada, com evidência externa,
da arquitetura que este projeto já convergiu para construir. Cinco
princípios, cada um já real no código, citados para nunca precisar
ser re-derivados numa sessão futura:

1. **Hierarquia de 3 zonas, não N painéis simultâneos**: barra de
   comando sempre visível no topo (`TopBar`+`ContextReadStrip`) → palco
   central dominante (o Gráfico, ~100% da área útil por padrão) →
   gavetas sob demanda nas duas bordas (`terminal-left/-right/
   -properties`, 320px, fechadas por padrão, mutual exclusion). Isto
   É o "modelo elite" real — não uma versão simplificada dele. Bloomberg-
   style "N painéis sempre abertos" foi pesquisado e re-confirmado como
   incompatível com o alvo real do AR10 (iPad Safari, zero-scroll).
2. **Cor é status, nunca decoração**: verde/vermelho = direção real
   (preço, P&L, bid/ask), âmbar = atenção real (risco elevado, dado
   insuficiente), cyan = identidade AR10 (branding, nunca dado). Já
   implementado; este documento é a trava de que nenhuma cor nova
   entra fora dessas 3 categorias sem justificativa.
3. **Tipografia monoespaçada para todo número, sempre**: já
   implementado; nenhuma exceção introduzida por engano.
4. **320px é o tamanho real de painel lateral "profissional"** — não
   240px (SaaS genérico) nem 400px+ (desperdiça área do gráfico no
   alvo real, iPad). Confirmado por comparação direta com o padrão
   pesquisado (§1.5) E já era o tamanho real usado por Core
   Intelligence antes desta pesquisa — o painel Properties (entrega
   anterior desta sessão) só seguiu a convenção já certa.
5. **Dark-first é a escolha certa para um terminal de decisão, não
   uma dívida** — divergência deliberada do padrão SaaS genérico
   (que espera os 2 temas), com justificativa técnica real (contraste
   para leitura de número > preferência estética), já validada por
   pesquisa anterior desta sessão E agora reforçada por 2 fontes novas
   (BookTrader/Time & Sales — terminais profissionais reais também
   não têm ambiguidade de tema, contraste máximo é o padrão da
   categoria).

---

## 5. Riscos identificados

- Este documento inteiro depende de sínteses de busca (`WebSearch`),
  não leitura direta de HTML/documentação oficial de cada plataforma
  (mesma limitação de `ELITE_TRADING_RESEARCH_MAP.md` §2) — um detalhe
  já foi pego como espúrio (§1.6) e descartado; qualquer novo detalhe
  fino (não já corroborado por 2+ fontes ou pelo próprio código do
  AR10) deveria ser tratado como hipótese, não fato, até confirmação
  adicional.
- §3.2 (dockagem real) é deliberadamente NÃO recomendado para
  implementação agora — registrar a lib certa (`dockview`) aqui não é
  autorização para construir; é para não ter que re-pesquisar se o
  pedido chegar no futuro.
- Nenhuma mudança de código foi feita nesta rodada — este é um
  documento de pesquisa+decisão, consistente com o pedido do Operador
  ("definir o modelo"), não um pedido de implementação imediata.

---

## 6. Fontes

- LSEG Workspace/Bloomberg: [SpotSaaS](https://www.spotsaas.com/compare/bloomberg-terminal-vs-refinitiv-eikon), [Comstock](https://www.comstock-interactivedata.com/bloomberg-terminal-vs-refinitiv-eikon/), [WinApplications](https://www.winapplications.com/software/refinitiv-eikon)
- Coinglass/TensorCharts: [CoinGlass Pro](https://www.coinglass.com/pro), [CoinGlass](https://www.coinglass.com/), [TensorCharts](https://tensorcharts.com/)
- Bots: [Freqtrade vs 3Commas vs Cryptohopper](https://alexbobes.com/crypto/freqtrade-vs-3commas-vs-cryptohopper/)
- Workspace dockável: [NinjaTrader Workspaces](https://support.ninjatrader.com/s/article/Workspaces-NinjaTrader-Desktop?language=en_US), [NinjaTrader Forum — Restoring Workspaces](https://forum.ninjatrader.com/forum/ninjatrader-8/platform-technical-support-aa/1203936-restoring-workspaces)
- Dashboards 2026: [Dashboard Design Patterns 2026](https://artofstyleframe.com/blog/dashboard-design-patterns-web-apps/), [Dashboard Design Best Practices 2026](https://5of10.com/articles/dashboard-design-best-practices/)
- Cor/Time & Sales: [Zerodha Varsity — Trading Terminal](https://zerodha.com/varsity/chapter/the-trading-terminal/), [IBKR BookTrader Colors](https://www.ibkrguides.com/traderworkstation/booktrader-colors.htm), [Webull — Time & Sales colors](https://www.webull.com/help/faq/1138-What-do-the-different-colors-in-Time-Sales-data-represent)
- Ergonomia de mesa: [Multi-Monitor Trading Setups 2026](https://nerdbot.com/2026/06/19/multi-monitor-trading-setups-how-pro-traders-build-their-workstations/), [Trading Desk Setup](https://tradewiththepros.com/trading-desk-setup/)
- Dockagem: [dockview.dev](https://dockview.dev/), [npm trends — dockview vs flexlayout-react vs golden-layout vs rc-dock](https://npmtrends.com/dockview-vs-flexlayout-react-vs-golden-layout-vs-rc-dock), [rc-dock GitHub](https://github.com/ticlo/rc-dock)
