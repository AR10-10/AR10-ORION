# AR10 CYBORG — Elite Trading Research Map

Pesquisa estratégica de metodologias, indicadores, arquiteturas e
ferramentas do ecossistema de trading algorítmico, para identificar
oportunidades de evolução compatíveis com o AR10 CYBORG. Entregável
único, pedido explícito do Operador (diretiva "ELITE TRADING RESEARCH
MAP"), seguindo as Diretrizes Obrigatórias de Pesquisa (§10 da
diretiva) — evidência real, nunca popularidade sem fonte; comparação
explícita com o estado real do código; classificação com justificativa
técnica.

**Status deste documento**: completo — as 9 categorias pedidas (§1-9)
mais a síntese obrigatória pelo §10.5 da diretiva (matriz de lacunas,
backlog priorizado, roadmap, riscos, fontes) estão preenchidas.
Metodologia real em duas frentes: (1) 4 agentes de pesquisa via
`WebSearch` real rodaram em paralelo (MetaTrader/MQL5+Pine Script,
GitHub OSS, Gestão de Risco, UX+Engenharia — 27/07/2026, fontes
citadas em cada seção e consolidadas em §14); (2) Estrutura de Mercado
(§6) e parte de Inteligência Artificial (§5) reaproveitam pesquisa REAL
já feita em rodadas anteriores desta sessão
(`AUDITORIA_ECOSSISTEMA_VISUAL.md`), atualizada onde havia ficado
desatualizada, mais leitura direta do código-fonte real do AR10 (não
suposição) para toda comparação "existe no AR10?" em todas as 9
seções.

**Atualização (01/09/2026, pedido direto do Operador — documento
"Mapeamento de Tecnologias e Plataformas", mesmo espírito desta
pesquisa, escopo explícito: cripto + ativos tradicionais dos EUA,
nunca B3)**: §2 e §5 ganharam achados novos (renderização real do
`lightweight-charts`, e o LLM local que já GRADUOU desde 27/07 — ver
§5); nova §15 cobre território genuinamente não pesquisado antes
(Inteligência On-Chain — Glassnode/Nansen/Dune/Chainalysis — e Dados
Institucionais dos EUA — Bloomberg/FactSet); §13 ganhou 2 achados
urgentes de auditoria (não pedidos, mas exigidos pela Disciplina de
trabalho do CLAUDE.md — "toda limitação real encontrada... entra na
resposta mesmo quando não é o foco"). Mesma barreira de rede já
documentada nesta trilha: `WebFetch` para `developers.binance.com` e
outros domínios de exchange é bloqueado neste sandbox — a pesquisa usa
`WebSearch` e é honesta onde não pôde confirmar com a fonte primária.

---

## Índice

1. [Metodologia e reaproveitamento de pesquisa existente](#1-metodologia)
2. [TradingView (Pine Script, ferramentas)](#2-tradingview)
3. [MetaTrader 5 / MQL5](#3-metatrader--mql5)
4. [GitHub — projetos open-source](#4-github)
5. [Inteligência Artificial aplicada a mercados](#5-inteligência-artificial)
6. [Estrutura de Mercado (Smart Money Concepts / Wyckoff)](#6-estrutura-de-mercado)
7. [Gestão de Risco](#7-gestão-de-risco)
8. [Interface e UX](#8-interface-e-ux)
9. [Engenharia](#9-engenharia)
10. [Matriz de lacunas consolidada](#10-matriz-de-lacunas-consolidada)
11. [Backlog técnico priorizado](#11-backlog-técnico-priorizado)
12. [Roadmap de evolução](#12-roadmap-de-evolução)
13. [Riscos identificados](#13-riscos-identificados)
14. [Fontes e referências técnicas](#14-fontes-e-referências-técnicas)
15. [Inteligência On-Chain e Dados Institucionais dos EUA](#15-inteligência-on-chain-e-dados-institucionais-dos-eua)

---

## 1. Metodologia

Regra vinculante desta pesquisa (§10.1 da diretiva, e Regra de Ouro 2
do próprio AR10): nenhuma tecnologia é recomendada por popularidade
sozinha. Toda entrada do catálogo tem objetivo, benefícios,
limitações, evidência real (fonte citada) e comparação honesta com o
que já existe no código — nunca um "seria legal ter" sem essa base.

**Reaproveitamento, não duplicação**: este projeto já tem 2 rodadas
reais de pesquisa técnica anterior, com fontes citadas e verificadas:

- `docs/historico/AUDITORIA_ECOSSISTEMA_VISUAL.md` §3 (comparação com terminais
  profissionais — ATAS/Bookmap/GetChart/LuxAlgo), §7 (inventário do
  motor quantitativo/`nexus/`), §8 (Sierra Chart/Exocharts, IA
  aplicada a previsão de cripto — papers reais). Data de referência:
  2026-07-21.
- `docs/historico/RELATORIO_EPC.md` — inteligências recuperadas/bugs corrigidos
  na mesma trilha.

Este documento CITA e ATUALIZA essas seções (parte do inventário do
AR10 mudou desde então — Liquidation Heatmap, Liquidity Sweep, Sessões
institucionais, Kill Zones e Target 3 foram entregues DEPOIS daquela
pesquisa) em vez de repeti-las. As seções 2-5, 7-9 deste documento
cobrem as áreas GENUINAMENTE não pesquisadas ainda (MetaTrader/MQL5,
GitHub OSS, Gestão de Risco formal, UX/Engenharia amplos) pedidas pela
diretiva atual.

**Classificação (§10.4 da diretiva)** — vocabulário fechado usado na
coluna "Decisão" de cada tabela abaixo:

| Classificação | Significado |
|---|---|
| **Produção** | Já existe no AR10, funcionando, graduado. |
| **Homologação** | Existe no AR10 mas precisa de verificação/ajuste antes de considerar completo. |
| **Quarentena** | Candidato a construir, mas isolado como módulo puro primeiro (padrão já estabelecido no projeto — `research/engines/`), nunca direto no caminho ao vivo. |
| **Experimental** | Vale prototipar para aprender, sem compromisso de produção. |
| **Laboratório** | Ideia real, mas precisa de pesquisa/decisão adicional antes de qualquer código. |
| **Pesquisar Mais** | Evidência insuficiente ainda para decidir. |
| **Descartar** | Avaliado e rejeitado, com justificativa técnica. |

---

## 2. TradingView

Pesquisa real via `WebSearch` (agente dedicado). **Limite honesto
declarado pelo próprio agente**: `WebFetch` direto em
`tradingview.com`/`mql5.com`/`metatrader5.com` retornou HTTP 403 de
forma consistente — o relatório se apoia em sínteses de busca real
sobre o conteúdo dessas páginas, não em leitura linha-a-linha do HTML.
Suficiente para "o que existe e como funciona", não equivale a
auditoria de código-fonte de terceiros.

| # | Nome | Categoria | Existe no AR10? | Decisão |
|---|---|---|---|---|
| 1 | Smart Money Concepts (LuxAlgo, all-in-one) | Indicador | ⚠️ PARCIAL — AR10 tem a MESMA cobertura conceitual (FVG/OB/BOS-CHOCH/EQH-EQL/Premium-Discount) mas como TypeScript/canvas nativo integrado ao Core Engine, não um indicador Pine isolado sobre velas | **Produção** (arquitetura já superior — integração nativa com decisão, não só overlay visual) |
| 2 | Fair Value Gap — variante Volumétrica (soma volume dentro da zona + proporção comprador/vendedor) | Indicador | ❌ NÃO — `liquidity_zones` desenha a zona geométrica, sem volume agregado dentro dela | **Laboratório**: melhoria real (não reempacotamento), reaproveitaria volume já real por candle; escopo pequeno |
| 3 | TradingView Volume Profile (nativo, 5 variantes) | Indicador | ✅ SIM — WASM real, POC + HVN | **Produção** |
| 4 | CVD (Cumulative Volume Delta) | Indicador | ✅ SIM — `cvd` (chart layer) | **Produção** — metodologia de inferência de polaridade (open/close relativo, tie-break) não comparada linha a linha nesta rodada |
| 5 | TradingView Bar Replay (+ Synchronized multi-gráfico) | Replay | ⚠️ PARCIAL — `src/replay/` já é o Motor de Replay real usado pelo laboratório de backtest (§7.6); sincronização MULTI-símbolo simultânea não se aplica ao AR10 hoje (visão de 1 ativo por vez) | **Produção** (para o caso de uso real do AR10) — sync multi-símbolo é **Descartar**: não combina com o design de "um ativo selecionado por vez" |
| 6 | TradingView Alerts / Webhooks | Alertas | ❌ NÃO | **Laboratório com cautela explícita**: alertas de LEITURA (ex. "Kill Zone abriu", "estrutura mudou") são compatíveis com READ_ONLY; um webhook que dispara AUTOMAÇÃO EXTERNA de execução, mesmo que o AR10 nunca envie a ordem diretamente, é o tipo de "reformulação" que a regra permanente do projeto pede para tratar com o mesmo cuidado de um pedido de execução real — qualquer implementação futura precisa deixar claro que é notificação, nunca um gatilho de trading |
| 7 | TradingView Screener (Stock + Pine Screener Beta) | Screener | ✅ SIM (equivalente funcional) — Radar/OIH já escaneia um universo (Binance curado + MEXC paginado) contra lógica de pontuação própria, exatamente o papel do Pine Screener | **Produção** |
| 8 | TradingView Heatmap de setor/mercado (cor=variação, tamanho=peso) | Heatmap | ❌ NÃO | **Laboratório**: o Radar já produz os dados (cada candidato tem direção+confluência); render-los como grade de calor em vez de lista seria reaproveitamento de dado já real, não um motor novo |
| 9 | TradingView Liquidation Heatmap — **proxy/estimado**, não dado real (a própria TradingView não tem feed de liquidação real; usa heurística de preço/volatilidade) | Heatmap | ✅ SIM, e **melhor** — `liquidation_heatmap` do AR10 usa feed real de liquidações forçadas, não uma estimativa | **Produção** (achado que confirma vantagem real, não lacuna) |
| 10 | Bar Magnifier / Deep Backtesting (fidelidade intrabar via timeframe inferior) | Backtesting | ❌ NÃO — `structural-backtest.js` opera na resolução do candle, sem reconstrução intrabar | **Laboratório**, baixa prioridade — o próprio backtest já é honesto sobre medir só o subconjunto estrutural candle-only (§7.6); ganho de precisão intrabar teria retorno pequeno frente à honestidade já existente sobre a limitação |
| 11 | Deeptest (biblioteca Pine de comunidade: Sharpe/Sortino/VaR/CVaR/drawdown/Monte Carlo/Walk-Forward num só pacote) | Backtesting | ❌ NÃO | Ver §7 (Gestão de Risco) — mesmo conjunto de lacunas (Drawdown, Monte Carlo, Walk-Forward formal), cross-referenciado aqui para não duplicar análise |

**Achado transversal do próprio agente, reafirmado**: SMC/ICT (order
blocks, FVG, BOS/CHoCH, premium/discount) é a categoria de indicador
mais replicada em ambos os ecossistemas pesquisados — mas a fonte
(Michael J. Huddleston/"ICT") nunca publicou uma definição formal
única, então duas implementações com o mesmo nome de conceito não
garantem medir a mesma coisa. Vale como contexto para o próprio AR10:
suas escolhas de tolerância/definição SMC são tão legítimas quanto
qualquer outra, desde que documentadas (já são).

**Achado novo (01/09/2026) — o motor de renderização em si, não só os
indicadores**: pedido do Operador para "pesquisar como renderizam
milhões de pontos sem travar o navegador". Confirmado via `WebSearch`
(GitHub oficial `tradingview/lightweight-charts`, DeepWiki, releases):
padrão view/renderer (uma *view* prepara dado por frame, um *renderer*
desenha no canvas; `ChartModel` coordena, `PaneWidget` é a área
retangular de cada série), *data conflation* automática (candles a
menos de 0,5px de distância na tela viram um só ponto ao dar zoom-out
— nunca desenha mais do que o olho consegue distinguir), e suporte
recente a `devicePixelContentBox` para pixel-perfeito em qualquer
densidade de tela. **Isto não é uma lacuna do AR10** — o item 6.1 de
§4 já confirma que `lightweight-charts` (a própria biblioteca da
TradingView, Apache-2.0) é a base real do gráfico do AR10, então
"absorver a tecnologia de renderização deles" já é estrutural, não um
gap a fechar. O que É real e vale registrar: o AR10 não roda por cima
dessa base nenhum equivalente à *data conflation* nos SEUS PRÓPRIOS
overlays de canvas (FVG/OB, ZigZag, Pivot Points etc. desenham 1
objeto por dado real, sem coalescer em zoom-out extremo) — candidato
honesto pra §9/§11, não urgente (o próprio `lightweight-charts` já
resolve isso para as séries nativas; o overlay que mais desenha hoje,
`liquidity_zones`, já tem um teto de 3 pela arbitragem de orçamento
compartilhado — ver `nexus/liquidity-significance.ts`).

---

## 3. MetaTrader 5 / MQL5

Mesma rodada de pesquisa do agente acima (mesma limitação de acesso
declarada — WebFetch bloqueado, WebSearch usado).

| # | Nome | Categoria | Existe no AR10? | Decisão |
|---|---|---|---|---|
| 1 | MQL5 Standard Library — Trade/Money-Management classes (`CMoneyFixedRisk`, `CMoneySizeOptimized`, etc.) | Biblioteca | ⚠️ PARCIAL — `risk-engine.js` cobre o mesmo PAPEL (calcular tamanho de posição a partir de regra de risco) como função pura autocontida, sem hierarquia de classes OOP nem execução real acoplada (MQL5 é pensado para enviar ordem; o AR10 nunca envia) | **Produção** — arquitetura mais simples E mais segura para o propósito real do AR10 (cálculo desacoplado de execução) |
| 2 | MT5 Strategy Tester — Modeling Quality / tick real vs. sintético | Backtesting | ❌ NÃO diretamente aplicável — o AR10 nunca simula preenchimento de ordem (não executa), então "fidelidade de fill" não é um problema que o AR10 precisa resolver | **Descartar** — fora de escopo por design, não lacuna |
| 3 | Otimização por Algoritmo Genético (espaço de parâmetros grande) | Otimização | ❌ NÃO, e coerente com §7.7: o AR10 não otimiza parâmetro nenhum contra histórico por princípio (RSI 70/30, piso R:R, ATR budgets são convenções declaradas) | **Descartar** — o próprio motivo de existir (acelerar otimização) não se aplica a um sistema que não otimiza |
| 4 | Walk-Forward Analysis / Monte Carlo no MT5 — **não nativo**, exige biblioteca/automação externa mesmo no MQL5 | Otimização/Metodologia | Ver §7.5-7.6 | Cross-referenciado — achado interessante: nem o MT5 (a plataforma mais madura de EAs) resolveu isso nativamente; reforça que é lacuna genuína da indústria, não peculiaridade do AR10 |
| 5 | Arquitetura orientada a eventos + "Single Trade Gateway" (todo pedido de ordem passa por 1 verificador central de risco) | Metodologia/Arquitetura | ✅ SIM, em espírito — LEI 24 do AR10 (Core Engine como único emissor real de LONG/SHORT/WAIT, nenhuma camada de confluência pode gerar uma segunda decisão) é a MESMA ideia arquitetural (um único ponto de decisão, tudo mais é consultivo), aplicada a leitura em vez de execução | **Produção** — achado que VALIDA a arquitetura já escolhida pelo AR10 como alinhada com boas práticas reconhecidas, não uma lacuna |
| 6 | Motores de detecção de padrão em MQL5 (Order Blocks OOP, harmônicos, Wolfe Wave — tolerâncias variam por autor, sem padrão único) | Indicador | ✅ SIM — AR10 já tem Order Blocks, harmônicos (Gartley/Bat/Butterfly/Crab/Cypher/Shark) e Wolfe Wave (com PRZ/EPA) | **Produção** — confirma paridade com o estado da arte da comunidade MQL5, mesma observação de "tolerância é escolha documentada, não padrão único" já seguida pelo AR10 |

**Achado do próprio agente que vale registrar por si só**: MQL5
CodeBase/Market não tem equivalente a "open-source com licença
padrão" (cada produto é livre ou comercial, sem convenção uniforme);
TradingView formalizou isso com 3 modos explícitos (open-source/
MPL-2.0, protected, invite-only). Diferença real de maturidade de
governança entre as duas comunidades — não relevante para decisão
técnica do AR10, mas relevante para qualquer avaliação futura de
"vale a pena adaptar código de terceiros" (checar licença sempre,
nunca assumir).

---

## 4. GitHub

Pesquisa real via `WebSearch` + verificação direta de página de
repositório (estrelas/licença/data do último commit, 27/07/2026) —
agente dedicado, 18 entradas + notas honestas sobre projetos avaliados
e descartados (inclusive um caso, OpenBB, onde o agente preferiu
reportar incerteza sobre qual repositório é hoje o canônico em vez de
arriscar apontar o errado).

| # | Nome | Categoria | Licença | Existe no AR10? | Decisão |
|---|---|---|---|---|---|
| 1.1 | freqtrade (bot cripto, 52,7k★) | Trading algorítmico | GPL-3.0 | N/A — freqtrade EXECUTA ordens; o AR10 nunca o fará por design | **Descartar** — categoria de produto incompatível por princípio, não avaliação técnica |
| 1.2 | Hummingbot (market-making/arbitragem, 19,2k★) | Trading algorítmico | Apache-2.0 | N/A, mesmo motivo | **Descartar** |
| 1.3 | NautilusTrader (núcleo Rust, paridade backtest/live, 25,1k★) | Trading algorítmico | LGPL-3.0 | Referência arquitetural interessante (núcleo Rust + plano de controle Python é o mesmo PARADIGMA de "WASM para cálculo + JS para orquestração" que o AR10 já usa) — mas executa ordens, não adotável como dependência | **Pesquisar mais** só como referência de padrão, nunca como código a importar |
| 2.1 | Qlib (Microsoft, pipeline de IA quant, 46,7k★, MIT) | Quant/IA | MIT | Cross-referenciado com §5 (Inteligência Artificial) — mesma conclusão já documentada: nenhum motor de ML preditivo novo é recomendado, então Qlib não muda a decisão | Ver §5 |
| 2.2 | TA-Lib (200+ indicadores, referência de indústria desde 2001) | Quant (feature engineering) | BSD | ⚠️ PARCIAL — AR10 já implementa RSI de Wilder/ADX/ATR nativamente em JS/TS puro (nunca dependeu de TA-Lib), consistente com o princípio local-first do projeto; TA-Lib exigiria compilar núcleo C ou usar binding WASM não-oficial | **Produção** (escolha já validada) — mas cada indicador nativo do AR10 deveria ser periodicamente conferido contra a fórmula canônica (mesma disciplina já em CLAUDE.md: "confirme a definição real antes de implementar") |
| 3.1 | Flowsurface (Rust desktop, footprint+heatmap de DOM, Binance/Bybit/Hyperliquid/OKX/MEXC — quase o MESMO conjunto de exchanges do AR10) | Order Flow | GPL-3.0 | ❌ NÃO (app desktop nativo, não embutível numa stack web) | **Pesquisar mais** — referência de design visual para Footprint (candidato já identificado em §6), não código reaproveitável |
| 3.2 | lightweight-orderflow-charts (footprint/delta/heatmap/volume-profile **sobre o MESMO `lightweight-charts` que o AR10 usa**, bindings React) | Order Flow | MIT | ❌ NÃO adotado — mas é o achado mais diretamente comparável à stack real do AR10 nesta pesquisa toda | **Pesquisar mais, com cautela declarada pelo próprio agente**: 8 estrelas, 1 único contribuidor, zero evidência de adoção em produção — vale como referência de API/design ao construir Footprint próprio, nunca como dependência a instalar |
| 4.1 | Perspective (FINOS/J.P. Morgan — WASM+Worker+streaming, pivot/analytics) | Dashboards | Apache-2.0 | Não é dependência candidata (motor genérico de pivot, não candle/order-flow) | **Produção-como-validação**: 2ª confirmação externa independente (depois de §9 achado 9) de que WASM+Worker+streaming é padrão real usado por instituição financeira de verdade, não uma escolha exótica do AR10 |
| 5.1 | reconnecting-websocket — **abandonado desde 2020**; sucessor mantido é PartySocket (Cloudflare) | WebSocket | MIT | ⚠️ NÃO CONFIRMADO se o AR10 depende dele — indícios (tooltips mencionando "reconexão automática" real) sugerem lógica própria, não esta lib especificamente | **Pesquisar mais**: se o AR10 depende da lib abandonada, migrar para PartySocket é candidato de manutenção real; se a lógica já é própria, nenhuma ação necessária — vale uma checagem rápida de `package.json` |
| 5.2 | ccxt (100+ exchanges unificadas, REST+WS, 43,4k★) | WebSocket | MIT | ❌ NÃO — AR10 usa conectores bespoke por exchange (`binance-futures-public.js`, `mexc-futures-public.js`, etc.) | **Produção (escolha correta, não lacuna)**: ccxt inclui capacidade de EXECUÇÃO em 100+ exchanges — importar essa superfície inteira num projeto cujo princípio #1 é nunca executar seria trazer risco desnecessário para dentro do bundle. Conectores mínimos, só-leitura, escritos à mão são a escolha mais alinhada com READ_ONLY, mesmo custando mais trabalho de manutenção |
| 6.1 | TradingView lightweight-charts | Visualização | Apache-2.0 | ✅ SIM — é a base real do gráfico do AR10 | **Produção** |
| 6.2 | KLineChart (alternativa TS, zero dependências) | Visualização | Apache-2.0 | ❌ NÃO | **Descartar** — trocar a base do gráfico seria reescrita de altíssimo risco sem motivo técnico real identificado |
| 6.3 | uPlot (~50KB, teto de performance da categoria — números autorreportados pelo mantenedor, não verificados de forma independente) | Visualização/Performance | MIT | ❌ NÃO usado | **Referência de benchmark, não substituição**: útil como "chão de comparação" se algum dia o AR10 precisar provar seu próprio orçamento de FPS sob carga real — não uma ação agora |
| 7.1 | QuantConnect Lean (event-driven, paridade backtest/live) | Backtesting | Apache-2.0 | Filosoficamente distante — Lean é framework de EXECUÇÃO completo | **Descartar** como dependência; referência conceitual de "o que backtesting event-driven profissional parece" |
| 7.2 | vectorbt (vetorizado, varredura de milhares de parâmetros) | Backtesting | Apache-2.0 c/ Commons Clause | Menos relevante ainda — o AR10 delibera­damente NÃO otimiza parâmetro contra histórico (§7.7); o caso de uso central do vectorbt (grid search massivo) não se aplica à filosofia do projeto | **Descartar** — não por qualidade técnica, por incompatibilidade de princípio |
| 8.1 | hftbacktest (reconstrução real de order book L2/L3, latência de fila modelada) | Replay | MIT | ❌ NÃO — `structural-backtest.js` opera em resolução de candle, não reconstrói order book histórico | **Laboratório, gated por dado**: mais rigoroso que o backtest atual do AR10, mas exige histórico tick/L2/L3 completo que o projeto não armazena hoje — lacuna de DADO antes de ser lacuna de engenharia |
| 8.2 | QuantReplay (Quod Financial, FIX+REST) | Replay | Apache-2.0 | ❌ NÃO | **Pesquisar mais**, baixa prioridade — projeto pequeno (41★), pouca evidência de adoção |
| 9.1 | DuckDB-Wasm (SQL analítico local-first, WASM+OPFS) | Performance | MIT | Cross-referenciado com §9 achado 11 (IndexedDB vs. OPFS) — mesma lacuna, mesma cautela: suporte a OPFS é desigual no Safari/iOS, a própria plataforma-alvo do AR10 | Ver §9 |

**Achado mais valioso desta seção**: a ausência de ccxt (5.2) não é
uma lacuna — é a confirmação mais clara encontrada em toda a pesquisa
de que o AR10 já aplica corretamente seu próprio princípio READ_ONLY
até na escolha de dependências, não só no código que escreve. E o
projeto mais "parecido" tecnicamente com o AR10
(`lightweight-orderflow-charts`, item 3.2 — mesma lib de gráfico,
mesma stack) é pequeno e imaturo o bastante para confirmar, por
comparação direta, que o AR10 é hoje mais maduro do que a maioria das
tentativas abertas do mesmo problema específico (order flow sobre
`lightweight-charts` em React/TS).

---

## 5. Inteligência Artificial

Pesquisa REAL já feita nesta sessão (`AUDITORIA_ECOSSISTEMA_VISUAL.md`
§8.2, 2026-07-21) sobre ML/IA aplicada à previsão de direção de
criptomoedas. Achado central, direto das fontes (papers reais citados
— MDPI/Forecast, ScienceDirect, Springer, PMC, arXiv):

> "Pure technical analysis achieves directional accuracy of
> approximately 40-45% for Bitcoin price movements over 7-day
> horizons — marginally better than random chance."

Mais achados da mesma pesquisa: séries de cripto se comportam de
forma próxima a ruído Browniano; modelos ingênuos às vezes superam
deep learning complexo; modelos "caixa-preta" sofrem de baixa
interpretabilidade; manipulação/wash trading distorce os próprios
indicadores que os modelos consomem; não existe benchmark padrão
comparável entre estudos.

| Nome | Categoria | Objetivo | Evidência | Existe no AR10? | Decisão |
|---|---|---|---|---|---|
| LSTM/GRU para previsão de preço | Deep Learning sequencial | Prever direção/preço futuro | Papers citados mostram desempenho ~40-45% (pouco acima do acaso) para horizontes de 7 dias | NÃO — e a pesquisa recomenda contra | **Descartar**: a literatura real não sustenta a promessa; construir um violaria a Regra de Ouro 2 (confiança nunca é probabilidade calibrada sem backtest real) |
| Transformers para séries temporais financeiras | Deep Learning (atenção) | Capturar dependências de longo alcance | Mesma limitação de interpretabilidade/robustez reportada para modelos complexos em geral | NÃO | **Descartar** pelo mesmo motivo — nenhuma evidência real de vantagem sobre modelos simples nesta classe de ativo |
| XGBoost / LightGBM / Random Forest | ML de árvores (feature-based) | Classificação/regressão sobre features de mercado | Mais interpretável que deep learning, mas ainda sujeito às mesmas distorções de dado (wash trading, ausência de benchmark padrão) | PARCIAL — `lorentzian-classifier.js` já é uma classificação k-NN sobre features reais, no mesmo espírito (confluência honesta, `sampleSize` sempre reportado) | **Produção** (o espírito já existe) — não há justificativa real para trocar k-NN por árvores sem evidência de ganho concreto |
| Reinforcement Learning para trading | ML (política de decisão) | Aprender política de entrada/saída por recompensa | Fora do escopo de qualquer evidência encontrada nesta pesquisa (RL para trading real tem histórico ainda mais fraco de generalização out-of-sample que supervised learning) | NÃO, e permanentemente fora de escopo — o AR10 nunca executa ordens (READ_ONLY incondicional), então "aprender uma política de execução" não tem onde atuar | **Descartar** — incompatível com a arquitetura permanente do projeto, não uma lacuna técnica |
| Pool de opinião linear (Stone 1961 / DeGroot 1974) | Agregação estatística transparente | Combinar múltiplas leituras reais em um consenso auditável | Método clássico, bem documentado, cada peso é rastreável (ao contrário de uma rede neural) | SIM — é o motor do Council e do Ensemble | **Produção** — e a pesquisa em IA acima *valida* essa escolha: abordagens simples/interpretáveis não são inferiores às complexas nesta classe de ativo, e são honestas sobre o que realmente sabem |

**Conclusão herdada e reafirmada**: nenhum motor de ML/DL novo para
prever preço é recomendado. Qualquer pedido futuro de "usa IA pra
prever o preço" deve apontar para esta seção — não é uma limitação de
engenharia do AR10, é o que a própria literatura mostra hoje.

**Atualização real (01/09/2026) — uma categoria DIFERENTE de "IA" já
graduou desde que a tabela acima foi escrita**: o pedido do Operador
("Integração de IA... ONNX... LSTM") citava exatamente a classe de
modelo que a tabela acima já pesquisou e rejeitou (previsão numérica
de preço). Mas existe hoje, real e ligado (`ramber-ui/src/llm-bridge.ts`
+ `llm-worker.ts`, `@mlc-ai/web-llm`), uma categoria diferente: **Llama
3 8B rodando 100% local via WebGPU**, num Worker dedicado (nunca o
main thread — Regra de Ouro 6), que não PREVÊ preço nenhum — só
sintetiza em linguagem natural os campos REAIS que o Core Engine já
calculou (`buildTacticalContext()` serializa só dado real: heurística
de tendência, classificação Lorentziana, zonas SMC, order flow) e tem
o próprio prompt de sistema proibido explicitamente de inventar nível
de preço ou insinuar que uma ordem foi/deveria ser enviada. É opt-in
(download de vários GB só quando o Operador ativa), com feature-
detection real de `navigator.gpu` (falha fechado e honesto se ausente,
nunca tenta e quebra).

Achado de auditoria de documentação (não deste doc — do `CLAUDE.md`
raiz): sua seção "Como isto se conecta aos três Protocolos" ainda
descreve "IA Orchestration (Llama)" como "uma feature real possível,
não construída sem pedido explícito do Operador" — mas essa frase é
sobre um Motor de Autocrítica (uma IA que audita a ARQUITETURA do
próprio AR10), categoria que de fato continua não construída; não é
sobre esta síntese tática de mercado, que já existe e está em
produção. As duas são aplicações genuinamente diferentes da mesma
infraestrutura (WebLLM/Llama local) — nenhuma frase do CLAUDE.md está
tecnicamente errada, mas a ausência total de menção a `llm-bridge.ts`/
`llm-worker.ts` na seção Arquitetura do CLAUDE.md (que a própria
diretriz do arquivo pede para manter atualizada "conforme o sistema
cresce") é um gap real de documentação — a mesma classe de achado que
esta trilha já corrigiu repetidas vezes em `QUARANTINE.md`.

**O que isto significa para o pedido "ONNX + LSTM" do Operador**: a
resposta honesta não é "construir isso agora" — é que (1) a literatura
real já pesquisada acima mostra que um LSTM/preditor numérico não teria
base honesta pra existir (Regra de Ouro 2), e (2) a infraestrutura que
o pedido realmente buscava (inferência de rede neural local, em tempo
real, sobre dado tático real) já existe, já é mais adequada ao
princípio READ_ONLY do projeto (síntese narrativa, não decisão
numérica), e já está em produção — não como ONNX, como WebLLM, por um
motivo concreto e já registrado no próprio código: uma tentativa
anterior de pedido ONNX nesta mesma sessão foi recusada por não existir
nenhum modelo treinado real pra rodar (rodar um runtime de inferência
sem modelo treinado seria teatro, não IA real — ver comentário de
abertura de `llm-bridge.ts`).

---

## 6. Estrutura de Mercado

Pesquisa direta do código-fonte real (`chart/`, `nexus/`,
`src/research/engines/`) desta sessão — não pesquisa externa nova,
já que o inventário do AR10 aqui é conhecido com certeza direta (leitura
do código, não estimativa). Cross-referenciado com
`AUDITORIA_ECOSSISTEMA_VISUAL.md` §2 (que ficou desatualizada em 3
pontos, corrigidos na tabela abaixo — camadas entregues DEPOIS daquela
pesquisa: Liquidation Heatmap, Liquidity Sweep, Sessões).

| Conceito | Nome técnico | Existe no AR10? | Módulo | Decisão |
|---|---|---|---|---|
| Break of Structure | BOS | ✅ SIM | `structure_breaks` (chart layer), `market-structure-engine.js` | **Produção** |
| Change of Character | CHoCH | ✅ SIM | mesmo módulo acima, rótulo combinado "BOS/CHOCH" | **Produção** |
| Market Structure Shift | MSS | ⚠️ AMBÍGUO | — | **Pesquisar mais**: MSS é usado por diferentes educadores ICT como sinônimo de CHoCH OU como um conceito distinto (mudança de estrutura intradiária vs. mudança de caráter em timeframe maior) — a literatura não é consistente. Antes de tratar como lacuna real, vale confirmar se o AR10 já cobre a intenção real por trás do termo (provavelmente sim, via CHoCH) ou se há uma distinção genuína valendo um rótulo próprio |
| Fair Value Gaps | FVG | ✅ SIM | `liquidity_zones` (chart layer) | **Produção** |
| Order Blocks | OB | ✅ SIM | mesmo módulo (`liquidity_zones`) | **Produção** |
| Liquidity Sweeps | — | ✅ SIM | `liquidity_sweep` (chart layer, EPC OMEGA FINAL Etapa 10) — **entregue depois** da pesquisa de `AUDITORIA_ECOSSISTEMA_VISUAL.md`, que ainda não o listava | **Produção** |
| Equal Highs/Lows (liquidez) | EQH/EQL | ✅ SIM | `equal_highs_lows` (chart layer) | **Produção** |
| Premium/Discount (dealing range) | — | ✅ SIM | `premium_discount` (chart layer) | **Produção** |
| Wyckoff (fases de acumulação/distribuição, Spring/Upthrust) | — | ❌ NÃO — confirmado por busca direta no código (`grep -ri wyckoff`, zero ocorrências) | — | **Laboratório**: metodologia real e amplamente reconhecida, mas exigiria um motor novo de classificação de fase (Acumulação/Markup/Distribuição/Markdown + eventos Spring/UTAD) sobre a mesma série de swings que `fractal-swings.js` já detecta — candidato genuíno a `research/engines/` isolado, testado, e só então graduado. Não confundir com Market Regime Engine existente (que classifica tendência/consolidação por ADX/bandwidth, não por fase Wyckoff) |
| Volume Profile / POC / HVN | — | ✅ SIM | `volume_profile` (chart layer, WASM real) | **Produção** |
| Cumulative Volume Delta | CVD | ✅ SIM | `cvd` (chart layer) | **Produção** |
| VWAP | — | ✅ SIM | `vwap` (chart layer, ancorada ao dia UTC) | **Produção** |
| Bandas de desvio-padrão da VWAP (±1σ/±2σ) | — | ❌ NÃO — confirmado: só o Trend Channel (OLS) tem bandas ±σ; a VWAP não | — | **Quarentena**: já sinalizado como lacuna real de "alto valor, baixo custo" em `AUDITORIA_ECOSSISTEMA_VISUAL.md` §4.2 há várias rodadas, nunca implementado. Matemática simples (desvio-padrão do preço em torno da própria VWAP, mesma janela ancorada), reaproveitaria a MESMA série que `vwap.ts` já calcula — candidato de baixo risco, alto valor pra próxima rodada de "ferramentas exatas" |
| Footprint / cluster chart (bid×ask por vela) | — | ❌ NÃO | — | **Laboratório** (já documentado como "alto valor, mas depende de granularidade de dado" em `AUDITORIA_ECOSSISTEMA_VISUAL.md` §4.1) — bloqueado por fonte de dado, não por engenharia |
| Padrões harmônicos (Gartley/Bat/Butterfly/Crab/Cypher/Shark/Wolfe) | — | ✅ SIM | `harmonics` (chart layer) | **Produção** |
| Fibonacci de confluência | — | ✅ SIM | `fibonacci` (chart layer, Matriz de Confluência) | **Produção** |
| Andrews Pitchfork | — | ❌ NÃO | — | **Quarentena** — já identificado nas diretivas mais recentes do Operador como prioridade #1 das Ferramentas Institucionais; matemática bem definida (3 pivôs → linha mediana + 2 canais paralelos), reaproveitaria `fractal-swings.js` |
| SMT Divergence (divergência entre ativos correlacionados) | — | ❌ NÃO | — | **Laboratório** — precisa de um 2º ativo correlacionado (BTC×ETH é o par padrão da literatura ICT) rodando em paralelo; mais complexo de fiar que Pitchfork |
| ICT Kill Zones | — | ✅ SIM (parcial) | `nexus/kill-zones.ts` — badge no header, ainda SEM anotação no canvas do gráfico | **Homologação** — motor pronto e testado, falta a superfície visual completa (Session Bands no canvas) |
| Sessões institucionais (Ásia/Londres/NY) | — | ✅ SIM | `market_sessions` (chart layer) + `market-session.ts` | **Produção** |
| Liquidation Heatmap | — | ✅ SIM | `liquidation_heatmap` (chart layer) — **entregue depois** da pesquisa antiga, que ainda listava isso como lacuna (❌ desatualizado em `AUDITORIA_ECOSSISTEMA_VISUAL.md` §3) | **Produção** |
| Open Interest / Funding desenhado no gráfico | — | ⚠️ PARCIAL | coletado e usado no Council/Regime, mas não desenhado como linha/marcador no candle | **Laboratório** (mesmo veredito de `AUDITORIA_ECOSSISTEMA_VISUAL.md` §4.4 — dado já existe, é decisão de layout) |

**Achado desta seção**: das lacunas REAIS de Estrutura de Mercado, só 3
são candidatas de baixo risco pra próxima rodada — **bandas de VWAP**
(mais simples), **Andrews Pitchfork** (já priorizado pelo Operador,
mais envolvente por ser um novo plugin de canvas completo) e
**Wyckoff** (maior escopo, mas metodologia real e valiosa). SMT
Divergence e Footprint seguem bloqueados por complexidade/dado,
consistente com o veredito já documentado.

---

## 7. Gestão de Risco

Pesquisa real via `WebSearch` (agente dedicado), priorizando papers
originais/peer-reviewed e documentação de plataformas profissionais
como fonte primária. Controvérsias reais da literatura (Kelly pleno
vs. fracionário, o que Monte Carlo prova vs. não prova) são reportadas
como controvérsias, nunca resolvidas artificialmente.

Os 7 métodos formam dois grupos: **(1) dimensionamento em tempo real**
(ATR, Position Sizing, Kelly) — respondem "quanto arriscar numa
posição"; **(2) validação offline** (Monte Carlo, Walk Forward,
Out-of-Sample) — respondem "essa estratégia tem edge real, ou é ruído
ajustado?". Drawdown conecta os dois grupos.

### 7.1 ATR (Average True Range) como unidade de risco

**Origem**: J. Welles Wilder Jr., *New Concepts in Technical Trading
Systems*, 1978 (mesmo livro do RSI/ADX). **Fórmula real**: `TR_t =
max[High_t−Low_t, |High_t−Close_(t-1)|, |Low_t−Close_(t-1)|]`; `ATR_t
= (ATR_(t-1)×(n−1) + TR_t)/n` — suavização de Wilder (equivalente a
EMA com α=1/n), NÃO uma média móvel simples. Uso em sizing: `Tamanho =
(Capital × %Risco) / (k × ATR)`. **Limitação real**: é volatilidade
*passada* (lagging), não prediz rupturas de regime (gaps, liquidações
em cascata). **Maturidade**: muito alta, padrão de fato há 47 anos.

**Existe no AR10?** ✅ **SIM, Produção** — `risk-engine.js`:
`unidade_de_risco% = max(stop_dist%, ATR%)` (ATR real vindo do Market
Regime Engine). Confirma exatamente o "Percent Volatility Model" da
pesquisa (item 7.2 abaixo), já combinado com o stop real da rota.

### 7.2 Position Sizing (família de modelos)

**Origem**: Van K. Tharp, *The Definitive Guide to Position Sizing
Strategies*. **Modelo relevante**: Percent Risk Model — `Tamanho =
(Capital × %Risco_por_trade) / |Entrada − Stop|`, tipicamente
0,5%–2% do equity (heurística de indústria, não teorema).
**Limitação real**: por si só não diferencia qualidade/confiança do
setup — arrisca o mesmo % em trade de alta e baixa convicção, a menos
que combinado com outra camada.

**Existe no AR10?** ✅ **SIM, Produção** — `risk-engine.js` combina
EXATAMENTE essa limitação real: o Percent Risk Model puro (`stop_dist%`)
É combinado com ATR% (item 7.1) via `max()`, e o resultado ainda passa
por um teto de Kelly fracionado ponderado pela força REAL do comitê
(item 7.3) — ou seja, a "diferenciação por confiança" que a pesquisa
aponta como limitação do modelo puro já é o que o AR10 adiciona por
cima.

### 7.3 Kelly Criterion e Kelly Fracionário

**Origem**: John L. Kelly Jr., *Bell System Technical Journal*, 1956.
Kelly fracionário: MacLean/Thorp/Ziemba, *Quantitative Finance*.
**Fórmula**: `f* = p − q/b` (forma de trading: `K% = W − (1−W)/R`).
**Controvérsia REAL e documentada** (não resolvida na literatura):
Paul Samuelson (Nobel 1970) publicou objeções formais ao critério de
Kelly como "ótimo universal"; Ziemba/Thorp/MacLean responderam
formalmente — é uma disputa acadêmica de peso, não um ponto fechado.
**Limitação crítica**: Kelly pleno assume p e b **conhecidos com
exatidão** — em trading real são estimativas ruidosas; superestimar o
edge leva a apostar acima do Kelly real, que a própria matemática do
modelo mostra ser pior que não apostar. 0,5× Kelly captura ~75% do
crescimento com ~25% da variância (MacLean/Thorp/Ziemba).

**Existe no AR10?** ✅ **SIM, Produção — e já resolve a limitação
crítica da forma mais honesta possível**: `risk-engine.js` NUNCA
estima p (a taxa de acerto). Fixa `p₀ = 0.5` permanentemente
("moeda honesta — o motor não reivindica edge direcional nenhum") e
deriva Kelly pleno só da assimetria real do R:R (`Kelly_pleno = 0.5 −
0.5/b`) — positivo só quando b>1. Por cima disso, aplica frações FIXAS
e conservadoras (1/2, 1/4, 1/8-Kelly, nunca Kelly pleno) escalonadas
pela força REAL do comitê. Isto é precisamente a forma que a pesquisa
recomenda como mais defensável: em vez de estimar p de uma amostra
pequena e não-estacionária (o cerne da crítica de Samuelson), o AR10
recusa-se a estimar p e usa uma constante honesta — o "edge" reportado
nunca é maior que o que a assimetria de payoff sozinha sustenta.

### 7.4 Drawdown (Max Drawdown, Duration, Recovery Factor, Calmar Ratio)

**Origem**: Magdon-Ismail & Atiya, *Risk Magazine*, 2004 (tratamento
analítico); CFA Institute (padronização). **Achado real importante**:
a literatura de processos estocásticos mostra que o **drawdown
esperado cresce com a raiz do tempo** — quanto mais tempo um sistema
roda, maior o MDD esperado, mesmo sem mudança de regime. Um MDD
histórico NÃO é um teto para o MDD futuro.

**Existe no AR10?** ❌ **NÃO** — nenhum motor de drawdown (realizado ou
projetado) existe hoje. O Track Record real (`signal-track-record.ts`)
já persiste resultado de plano por symbol:timeframe, então o dado bruto
pra calcular MDD real já existe parcialmente — calcular MDD sobre isso
seria aditivo, não um motor novo do zero. **Laboratório**.

### 7.5 Monte Carlo Simulation (validação de estratégia)

**Origem acadêmica rigorosa**: Halbert White, "A Reality Check for
Data Snooping", *Econometrica*, 2000; Sullivan/Timmermann/White,
*Journal of Finance*, 1999. **Prática comercial**: reshuffle (mesmos
trades, ordem embaralhada) ou resampling (bootstrap com reposição).
**Limitação crítica, ênfase deliberada da pesquisa**: Monte Carlo
**NÃO testa se a estratégia tem edge real** — reembaralha os MESMOS
trades já ocorridos. Se o conjunto original vem de uma estratégia
overfitted, o Monte Carlo produz uma distribuição elegante e igualmente
sem validade preditiva. Pressupõe implicitamente trades i.i.d. —
premissa frequentemente falsa em mercados reais (autocorrelação de
regime, clusters de volatilidade).

**Existe no AR10?** ❌ **NÃO** — nenhuma forma de reamostragem/
reembaralhamento de trades existe. **Laboratório**, mas de prioridade
baixa dado o próprio veredito da pesquisa: sem uma amostra grande de
trades reais (o Track Record ainda é jovem, symbol:timeframe por
symbol:timeframe), Monte Carlo sobre poucos trades reais teria pouco
valor — e aplicá-lo cedo demais correria o risco real, já documentado
por esta pesquisa, de parecer "validação" sem ser.

### 7.6 Walk Forward Analysis

**Origem**: Robert Pardo, *Design, Testing, and Optimization of
Trading Systems*, 1992. **Metodologia real**: janela IS (otimização) +
janela OOS (teste, nunca vista) deslizando no tempo; **Walk-Forward
Efficiency (WFE) = Performance OOS / Performance IS** (heurística de
mercado: WFE≥50% aceitável, não um teorema formal). **Limitação
real**: WFA não elimina overfitting — só reduz a chance de um
overfitting óbvio passar despercebido; a escolha do tamanho de
janela é ela mesma um hiperparâmetro com efeito grande (pesquisa
recente, arXiv 2602.10785).

**Existe no AR10?** ⚠️ **PARCIAL** — `research/backtest/
structural-backtest.js` (Fase 1, "backtest honesto") já roda uma
medição de desfechos estruturais **no espírito walk-forward**: usa o
Motor de Replay real, processa candle a candle cronologicamente
(nunca olha à frente), conta alvo/stop/não-resolvido sobre uma REGRA
FIXA (não otimizada). A diferença real para Walk-Forward Analysis
"de livro-texto" (Pardo): não há etapa de OTIMIZAÇÃO de parâmetros em
janela IS seguida de teste OOS — a regra estrutural é fixa por
design, então o conceito de "degradação IS→OOS" não se aplica da
mesma forma. **Homologação** — já é honesto sobre o que mede
(contagem de desfechos, nunca probabilidade futura, campo próprio no
contrato avisando isso), mas o nome "backtest" convida à comparação
com WFA formal, que ele não é.

### 7.7 Out-of-Sample (OOS) Testing

**Origem**: princípio fundamental de estatística/ML (Hastie/
Tibshirani/Friedman); extensão a finança quantitativa: Marcos López de
Prado, *Advances in Financial Machine Learning*, 2018 (Combinatorial
Purged Cross-Validation); Bailey & López de Prado, "The Deflated
Sharpe Ratio", *Journal of Portfolio Management*, 2014 — ajusta o
Sharpe observado pelo número de configurações testadas, penalizando
estatisticamente a seleção múltipla.

**Existe no AR10?** ❌ **NÃO** como conceito formal (não há separação
explícita treino/teste em nada do AR10) — mas **estruturalmente quase
inevitável por construção**: o AR10 não otimiza NENHUM parâmetro
contra dado histórico (RSI 70/30, piso R:R 1:2, ATR budgets — todos
são convenções declaradas, nunca ajustadas por fit em dados passados,
princípio já documentado no próprio código como "mesma natureza do
RSI 70/30... convenções documentadas e ajustáveis, nunca medições").
Isso significa que boa parte do risco que OOS testing existe para
detectar (overfitting de parâmetro) já não se aplica da mesma forma —
não porque o AR10 testou e validou, mas porque nunca ajustou parâmetro
nenhum a dado histórico para começo de conversa. **Pesquisar mais**:
vale mais como um princípio a MANTER (nunca introduzir otimização de
parâmetro sem também introduzir OOS/walk-forward formal) do que como
lacuna a fechar agora.

---

## 8. Interface e UX

Pesquisa real via `WebSearch` (agente dedicado, 8 entradas), com nível
de evidência classificado por entrada (Alta/Média/Baixa — declarado
quando um número vem de material de marketing de vendor sem benchmark
independente).

| # | Nome | Existe no AR10? | Decisão |
|---|---|---|---|
| 1 | Multi-painel Bloomberg (N painéis + navegação por teclado dedicada) | ❌ NÃO, deliberadamente | **Descartar** — o próprio achado da pesquisa confirma: pressupõe teclado físico completo, tensiona direto com zero-scroll/tela única do iPad. AR10 já escolheu o caminho certo (abas/gavetas) para essa restrição |
| 2 | Heatmap com renderização acelerada por GPU (shaders, não Canvas 2D) | ❌ NÃO — `OrderFlowHeatmapPlugin`/`LiquidationHeatmapPlugin` usam Canvas 2D com dirty-flag+rAF | **Pesquisar mais**: headroom real de performance disponível, mas SEM evidência hoje de que o heatmap atual seja gargalo (nenhuma auditoria de perf desta sessão flagrou isso) — não vale reescrever em WebGL sem um problema real medido primeiro |
| 3 | Glassmorphism / "Liquid Glass" (Apple, obrigatório em apps iOS até set/2026) | ❌ NÃO — estética atual é neon sobre quase-preto, alto contraste | **Descartar**, com validação externa: a própria pesquisa aponta baixo contraste sobre fundo borrado como risco real para leitura de número — exatamente o motivo pelo qual um terminal de decisão não deveria adotar. Confirma a escolha visual já feita, não sinaliza mudança |
| 4 | Heatmap de setor/correlação entre ativos | ❌ NÃO | Ver §2 item 8 (Radar como fonte de dado) — mesma lacuna, não duplicada aqui |
| 5 | Layout multi-timeframe sincronizado (N gráficos lado a lado) | ✅ SIM, na forma certa para o formato do AR10 — Matriz Multi-Timeframe já mostra confluência de 6 prazos numa única leitura de dados, não N canvases simultâneos | **Produção** — a própria pesquisa recomenda esse caminho para viewport único ("painel secundário compacto" em vez de grid de gráficos); é exatamente o que o AR10 já tem |
| 6 | Touch targets 44×44pt (Apple HIG) + gestos sem colisão com o sistema | ⚠️ NÃO VERIFICADO nesta rodada | **Homologação**: candidato barato para uma auditoria real (Playwright + medição de bounding box dos controles) — direto sob a mesma mandato "60fps iPad Safari" já existente no projeto. Risco adicional real sinalizado pela pesquisa: relato recente de iPadOS ignorar `supportedInterfaceOrientations` sob certas condições — vale confirmar na versão real de iPadOS em uso, nunca assumir da documentação |
| 7 | PWA: shell stale-while-revalidate + dado de mercado SEMPRE network-first/sem cache | ✅ SIM, exatamente — `sw/build-sw.mjs` faz precache do shell + SWR e EXPLICITAMENTE nunca intercepta GET cross-origin nem dado de mercado (travado por teste real, `production-seal.test.ts`) | **Produção** — validação externa direta de um padrão que o AR10 já implementa com precisão |
| 8 | Skeleton screens / Optimistic UI / INP (Core Web Vital oficial) | ⚠️ PARCIAL — AR10 usa texto honesto "AGUARDANDO" em vez de skeleton animado (mais simples, mais honesto sobre incerteza de forma); ZERO optimistic UI em dado de mercado (nunca aplicado) | **Produção para o padrão certo, Descartar deliberado para o errado**: a própria pesquisa identifica que optimistic UI aplicado a preço ANTES da confirmação real via WebSocket seria fabricar dado — exatamente o que o AR10 nunca faz, por princípio, não por limitação técnica. INP como métrica formal (Core Web Vital, meta ≤200ms) não é medido explicitamente hoje — FPS/latência de ciclo já são (SYSTEM HEALTH), mas não a métrica INP padronizada especificamente; **Pesquisar mais** de baixa prioridade |

---

## 9. Engenharia

Pesquisa real via `WebSearch` (agente dedicado, 10 entradas),
priorizando papers peer-reviewed e documentação oficial (React
Working Group, web.dev/Chrome team, MDN) como fonte primária.

| # | Nome | Existe no AR10? | Decisão |
|---|---|---|---|
| 9 | Rust/WASM para cálculo pesado (paper ACM IMC 2021: até 47,71× mais rápido para entradas pequenas, mas pode ser MAIS LENTO para entradas grandes — não é ganho uniforme) | ✅ SIM — Volume Profile/TrustScore já rodam em WASM via `quant-worker.js` | **Produção** — risco real sinalizado pela pesquisa (custo de marshalling JS↔WASM na fronteira, ganho não garantido para toda carga) vale como item de vigilância contínua, não ação imediata |
| 10 | WASM SIMD (vetorização) + WASM threads (`SharedArrayBuffer`+COOP/COEP) | ⚠️ PARCIAL — `wasmVariant` ('escalar' \| 'simd128') já é telemetria real existente, confirmando que o AR10 já detecta/usa SIMD128 quando disponível; multithreading via `SharedArrayBuffer` **não confirmado** nesta pesquisa (exigiria checar headers COOP/COEP no deploy real) | SIMD: **Produção**. Threads: **Pesquisar mais** — não verificado, não assumir |
| 11 | OPFS (Origin Private File System) vs. IndexedDB para persistência local | ❌ NÃO — `nexus/persistence.ts` (`saveCandles`/`loadCandles`/`saveTrackRecord`) usa IndexedDB | **Laboratório de baixa prioridade**: a própria pesquisa recomenda OPFS só acima de ~10 mil documentos — o volume real de candles/track-record cacheado pelo AR10 provavelmente não justifica a complexidade adicional (OPFS de baixa latência só funciona DENTRO de um Worker) ainda |
| 12 | RPC transparente sobre Web Workers (padrão Comlink) | ⚠️ PARCIAL — `QuantWorkerClient` já é uma ponte real Worker↔UI, mas arquitetura própria do projeto, não a biblioteca Comlink especificamente (não verificado se usa `postMessage` cru ou um padrão equivalente) | **Pesquisar mais**: mesmo papel arquitetural preenchido; trocar por Comlink não seria uma lacuna a fechar, seria uma refatoração sem motivo real identificado |
| 13 | `OffscreenCanvas` + Worker (mover DESENHO, não só cálculo, para fora da main thread) | ❌ NÃO — os plugins de canvas do AR10 (dirty-flag+rAF+ResizeObserver) rodam no thread principal, por design documentado | **Quarentena, com cautela explícita**: cruza direto com a Regra de Ouro 6 do projeto ("Main Thread sagrada... mover para Worker exige sua própria iniciativa isolada e cuidadosa, nunca uma mudança apressada junto de outras coisas") — candidato real, mas nunca uma mudança de escopo pequeno |
| 14 | Dirty-flag + `requestAnimationFrame` + batching de draw calls | ✅ SIM, arquitetura padrão de TODA camada visual do AR10 (canvas próprio, dirty-flag, rAF, ResizeObserver — documentado como convenção obrigatória para qualquer nova anotação visual) | **Produção** — validação externa direta e forte de uma decisão arquitetural já madura |
| 15 | `useSyncExternalStore` (React 18, elimina "tearing" de store externa) | ✅ SIM, indiretamente — Zustand (usado pelo AR10) já usa `useSyncExternalStore` internamente desde a v4, então o AR10 herda essa garantia sem precisar implementar nada à parte | **Produção** (via dependência, não código próprio) |
| 16 | Zustand: seletores granulares + `useShallow` (evita re-render quando qualquer parte da store muda) | ✅ SIM para a store unificada (`useCpiSnapshot`/`useTrustScoreSnapshot`/etc. já são seletores granulares por domínio) — mas ⚠️ o padrão **contrário** (selecionar o objeto inteiro) é exatamente o que `WidgetContext` faz para a maioria dos widgets legados | **Produção onde já migrado; achado que reforça uma dívida já documentada**: a pesquisa nomeia com precisão o antipadrão que a migração `WidgetContext`→seletores (flagged repetidamente nesta sessão, ainda "fora de escopo" a cada rodada) resolveria — evidência externa de que não é só limpeza cosmética, é uma classe de bug de performance conhecida (existe até um lint específico, `eslint-plugin-granular-selectors`, para pegar essa regressão) |
| 17 | React Compiler (React 19, memoização automática em build-time, estável desde out/2025) | ❌ NÃO aplicável ainda — AR10 está em React 18 | **Pesquisar mais**: real, mas gated por uma decisão de upgrade de major version do React, fora do escopo de uma mudança pontual |
| 18 | Virtualização de listas (`react-window`) + throttling/batching de WebSocket | ⚠️ NÃO VERIFICADO em detalhe — TopBar já é comentado como recomputando no máximo ~1×/s no tick de preço (sugere ALGUM throttling já existente), mas nenhuma lista do AR10 (book L2, candidatos do Radar, símbolos do Omnibox) foi confirmada como virtualizada nesta pesquisa | **Homologação**: candidato de auditoria real — se o book de profundidade ou a lista de símbolos do Omnibox renderiza todas as linhas sem windowing, é o tipo de achado "dado real computado mas renderizado de forma cara" que esta sessão já corrigiu várias vezes em outras camadas |

**Achado mais acionável desta seção**: o item 16 (Zustand
granular vs. seletor de objeto inteiro) é a primeira evidência EXTERNA
e nomeada precisamente que confirma a dívida arquitetural do
`WidgetContext` como uma classe de bug de performance reconhecida na
indústria — não apenas "ficaria mais organizado". Isso não muda a
decisão de mantê-la fora de escopo por ora (é uma mudança grande,
invasiva, que toca dezenas de widgets), mas fortalece a justificativa
para priorizá-la quando uma rodada dedicada for aberta.

---

## 10. Matriz de lacunas consolidada

Todas as lacunas REAIS identificadas nas seções 2-9 (excluindo tudo
classificado **Produção** ou **Descartar** — já resolvido ou
deliberadamente fora de escopo), organizadas por classificação
(§10.4).

### Quarentena (candidato real, isolar como módulo puro antes de integrar)

| Item | Seção de origem | Por quê está pronto para uma rodada dedicada |
|---|---|---|
| Andrews Pitchfork | §6 | Matemática bem definida (3 pivôs → mediana + 2 canais), reaproveita `fractal-swings.js` já graduado, já é prioridade #1 nas diretivas mais recentes do Operador |
| Bandas de desvio-padrão da VWAP (±1σ/±2σ) | §6 | Reaproveita a série que `vwap.ts` já calcula; documentado como "alto valor, baixo custo" há várias rodadas, nunca puxado |
| `OffscreenCanvas` + Worker para desenho (mover RENDERIZAÇÃO, não só cálculo, do main thread) | §9 | Real e genuíno, mas cruza direto com a Regra de Ouro 6 do próprio projeto — precisa da mesma disciplina isolada já usada para decisões de Worker |

### Homologação (existe, precisa de verificação/conclusão)

| Item | Seção de origem | O que falta |
|---|---|---|
| ICT Kill Zones no CANVAS (hoje só badge no header) | §6 | Session Bands visual, mesmo padrão de graduação incremental já usado por `market-session.ts` |
| Walk-Forward formal vs. o que `structural-backtest.js` já faz | §7 | Já é honesto no espírito walk-forward (processa cronologicamente, nunca olha à frente), mas não tem etapa de otimização IS→OOS — decidir se vale formalizar ou deixar como está |
| Touch targets 44×44pt (Apple HIG) em toda a UI | §8 | Auditoria real (Playwright + bounding box), nunca feita explicitamente |
| Virtualização de listas longas (book L2, candidatos do Radar, símbolos do Omnibox) | §9 | Confirmar se alguma renderiza sem windowing — mesma classe de achado "dado real caro de mais para renderizar" já corrigida várias vezes nesta sessão |

### Laboratório (ideia real, precisa de módulo novo isolado)

| Item | Seção de origem | Bloqueio real |
|---|---|---|
| Wyckoff (fases de acumulação/distribuição, Spring/UTAD) | §6 | Nenhum — motor novo genuíno, zero presença hoje (confirmado por grep) |
| Métricas de Drawdown (MDD/Duration/Recovery Factor/Calmar) | §7 | Nenhum bloqueio de dado — Track Record (`signal-track-record.ts`) já persiste resultado por symbol:timeframe |
| SMT Divergence | §6 | Precisa de um 2º ativo correlacionado (BTC×ETH) rodando em paralelo |
| Footprint / cluster chart (bid×ask por vela) | §6, §2, §4 | Granularidade de dado — já documentado como bloqueado há várias rodadas |
| FVG variante Volumétrica (soma volume dentro da zona) | §2 | Nenhum — melhoria pequena sobre `liquidity_zones` já graduado |
| Heatmap de setor/mercado sobre os candidatos do Radar | §2 | Nenhum — reaproveitaria dado que o Radar já produz |
| Reconstrução real de order book histórico (estilo `hftbacktest`) | §4 | Dado — exigiria armazenar tick/L2/L3 completo, que o AR10 não guarda hoje |

### Pesquisar mais (evidência insuficiente pra decidir agora)

| Item | Seção de origem |
|---|---|
| Monte Carlo simulation sobre o Track Record | §7 — baixa prioridade: amostra de trades reais ainda pequena, aplicar cedo demais arriscaria parecer "validação" sem ser |
| MSS (Market Structure Shift) como rótulo distinto de CHoCH | §6 — literatura ICT não é consistente sobre se é sinônimo |
| WASM threads (`SharedArrayBuffer`+COOP/COEP) | §9 — não confirmado se já existe ou não |
| RPC estilo Comlink sobre os Workers | §9 — `QuantWorkerClient` já preenche o papel, trocar não teria motivo identificado |
| React Compiler (React 19) | §9 — gated por upgrade de major version |
| INP como Web Vital formal medido | §8 — telemetria equivalente (FPS/latência de ciclo) já existe |
| Dependência de `reconnecting-websocket` (abandonada desde 2020) | §4 — checagem rápida de `package.json` resolveria isto em minutos |

### A dívida arquitetural que atravessa tudo

**Migração `WidgetContext` → seletores granulares da store** — flagged
repetidamente nesta sessão como "fora de escopo" a cada rodada (§6.36,
§6.43, §6.45 do `SYSTEM_HANDBOOK.md`). Esta pesquisa (§9, achado 16)
encontrou a primeira validação EXTERNA e nomeada com precisão: é
exatamente o antipadrão "seletor de objeto inteiro" que a literatura
de Zustand documenta como causa raiz de re-renderização desnecessária
— confirmado grave o bastante para a comunidade ter criado um lint
dedicado (`eslint-plugin-granular-selectors`) só para essa classe de
regressão. Não muda a decisão de mantê-la fora do escopo de uma
mudança pontual (é grande, invasiva, toca dezenas de widgets), mas
fortalece a prioridade real de uma rodada dedicada futura.

---

## 11. Backlog técnico priorizado

Priorizado por impacto × complexidade — Tier 1 primeiro (mais valor
por menos risco).

**Tier 1 — baixa complexidade, pronto para a próxima rodada:**
1. Checar dependência de `reconnecting-websocket` (§4) — minutos, resolve uma incerteza
2. Auditoria real de touch targets 44×44pt (§8) — Playwright, sem mudança de arquitetura
3. Auditoria de virtualização de listas longas (§9) — pode revelar um bug real de performance já existente
4. Bandas de VWAP ±σ (§6) — matemática simples, reaproveita série já calculada

**Tier 2 — complexidade média, alto valor, bem definido:**
5. Andrews Pitchfork completo (motor puro + canvas plugin) (§6) — já priorizado pelo Operador
6. Kill Zones no canvas (Session Bands) (§6) — motor já pronto, só falta a superfície visual
7. Métricas de Drawdown sobre o Track Record real (§7) — dado já existe, é síntese nova

**Tier 3 — complexidade média-alta, precisa de desenho próprio antes de codar:**
8. Heatmap de setor sobre os candidatos do Radar (§2) — reaproveita dado, mas é uma visualização nova
9. FVG Volumétrico (§2) — pequeno em escopo, mas altera um engine já graduado
10. Resolver a pergunta de granularidade de dado para Footprint (§6, §2, §4) — decisão que desbloqueia ou fecha definitivamente esse item

**Tier 4 — grande, precisa de rodada dedicada isolada:**
11. Wyckoff (motor novo completo) (§6)
12. SMT Divergence (2º ativo correlacionado) (§6)
13. `OffscreenCanvas`+Worker para renderização (§9) — sob a disciplina da Regra de Ouro 6
14. Migração `WidgetContext` → seletores granulares (§9) — dívida validada externamente, mas grande e invasiva

**Permanentemente fora de escopo (Descartar, com justificativa técnica registrada em cada seção):** qualquer motor de ML/DL preditivo de preço (§5); qualquer dependência com capacidade de execução real — ccxt, freqtrade, Hummingbot, QuantConnect Lean, vectorbt (grid search de parâmetro incompatível com o princípio de nunca otimizar contra histórico) (§4, §7); glassmorphism (§8); layout multi-painel estilo Bloomberg com navegação por teclado (§8); replay multi-gráfico sincronizado (não se aplica à visão de 1 ativo por vez) (§2); genetic algorithm optimization (§3).

---

## 12. Roadmap de evolução

Sequenciamento sugerido — não um compromisso de prazo (este projeto
não tem sprints formais), mas uma ordem real de dependência e risco.

**Fase A — auditorias baratas (podem entrar na próxima rodada, em paralelo entre si):**
`reconnecting-websocket` check → touch targets → virtualização de listas.
Nenhuma depende das outras; todas são baixo risco, alta clareza de
"terminado".

**Fase B — Ferramentas Institucionais de baixo custo:**
Bandas de VWAP → Andrews Pitchfork → Kill Zones no canvas. Nessa
ordem por complexidade crescente (matemática simples → motor+plugin
novo → graduação de motor já existente).

**Fase C — Inteligência sobre dado já existente:**
Métricas de Drawdown sobre o Track Record. Não depende da Fase B,
pode rodar em paralelo.

**Fase D — decisões de produto antes de codar:**
Resolver granularidade de dado para Footprint (decide se vira Fase E
ou é definitivamente descartado); desenhar o heatmap de setor do
Radar.

**Fase E — motores novos maiores (cada um merece sua PRÓPRIA rodada isolada, nunca combinados):**
Wyckoff · SMT Divergence · Footprint (se a Fase D destravar) ·
`OffscreenCanvas`+Worker (sob Regra de Ouro 6).

**Fase F — a dívida grande, quando houver uma rodada inteira dedicada a ela:**
Migração `WidgetContext` → seletores granulares. Não bloqueia nada
das fases anteriores nem é bloqueada por elas — é ortogonal, mas cada
rodada que adiciona um widget novo lendo de `WidgetContext` aumenta o
custo futuro da migração.

---

## 13. Riscos identificados

**Achados urgentes de auditoria (01/09/2026, não pedidos — encontrados
no caminho da pesquisa de §2/§15, e registrados por exigência da
Disciplina de trabalho do CLAUDE.md item 1: "toda limitação real
encontrada... entra na resposta ao Operador mesmo quando não é o foco
da tarefa"):**

- **Feed de liquidações — RESOLVIDO (02/09/2026).** A suspeita acima
  (feed degradado desde 23/04/2026) foi confirmada e corrigida. A
  confirmação que faltava (WebFetch bloqueado, sem egress real neste
  sandbox) veio via `WebSearch` — os resultados indexados da própria
  página "Important WebSocket Change Notice" e do anúncio de upgrade
  (`binance.com`, 06/03/2026) confirmam: `!forceOrder@arr` pertence à
  categoria `/market`, e a URL nova é o formato combinado
  `wss://fstream.binance.com/market/stream?streams=!forceOrder@arr`
  (envelope `{stream, data}`, mesmo padrão que `App.tsx` já usa para
  ticker/depth). `js/real-data/binance-liquidations-stream.js` corrigido
  (URL + desembrulho do envelope antes de `parseLiquidationMessage`,
  que continua puro/inalterado), 3 testes novos em
  `binance-liquidations-stream.test.ts` (URL correta, desembrulho real,
  fail-open na forma). **Ainda não verificado contra uma conexão ao
  vivo** (mesma barreira de rede de sempre) — o Operador confirma no
  ambiente com egress real se o painel "INSTITUTIONAL LIQUIDATIONS ·
  REAL" volta a receber eventos.
- **Preço/book ao vivo (ticker+depth, `App.tsx`) conectava em Binance
  SPOT (`stream.binance.com`), não Futures — RESOLVIDO (02/09/2026).**
  V15.1 GOD TIER (já documentado em `diretriz3-fixes.test.ts`) afirma
  "Futuros exclusivo... extinguindo qualquer roteamento de gráficos para
  mercado Spot" para todo o resto do sistema (candles via REST,
  funding/OI, Pivot Points) — o WS de ticker+depth que alimenta
  `priceData.price` era a única exceção real. Corrigido com autorização
  explícita do Operador (a mudança altera os NÚMEROS exibidos ao vivo):
  migrado para `wss://fstream.binance.com` real. A arquitetura final
  ficou diferente da hipótese registrada aqui antes — não é um único
  combined-stream `/stream?streams=ticker/depth` como se imaginava, e
  sim **duas conexões separadas por categoria** (mesma reestruturação de
  URL de 06/03/2026 já aplicada ao fix de liquidações acima):
  `wss://fstream.binance.com/market/stream?streams=<symbol>usdt@ticker`
  (categoria `/market`, confirmado via pesquisa) e
  `wss://fstream.binance.com/public/stream?streams=<symbol>usdt@depth10@100ms`
  (categoria `/public` — feeds de alta frequência como `@depth`,
  evidência forte mas não uma citação direta tão explícita quanto a do
  ticker). Cada conexão agora é supervisionada por uma
  `ConnectionManager` real (`nexus/connection-manager.ts` — máquina de
  reconnect+backoff+heartbeat já construída e testada nesta mesma
  sessão) em vez do reconnect manual que existia antes; `wsLive` agora é
  fail-closed de verdade — só `true` quando AMBAS as conexões (preço E
  book) estão `LIVE`, nunca um fallback silencioso pra Spot se uma
  cair. 5 testes novos de padrão-no-código-fonte em
  `ws-live-feed-futures-migration.test.ts`. **Ainda não verificado
  contra uma conexão ao vivo** (mesma barreira de rede de sempre,
  agravada aqui pela incerteza real sobre `/public` vs `/market` para
  depth) — o Operador confirma no ambiente com egress real se o preço/
  book seguem atualizando normalmente e se o "basis" Spot↔Futures
  desaparece dos números exibidos.

- **Risco de escopo**: este documento tem ~40 itens catalogados
  entre as 9 categorias. A tentação real é tratá-lo como um checklist
  a esgotar — o próprio espírito da diretiva original (Ordem Direta de
  Evolução Contínua) pede o oposto: simplicidade e consistência antes
  de quantidade de funcionalidade. Cada item do backlog (§11) precisa
  continuar sendo avaliado individualmente quando chegar sua vez, não
  just "executado porque está na lista".
- **Risco de dado**: Footprint, SMT Divergence e reconstrução de order
  book histórico (hftbacktest-style) dependem de granularidade/volume
  de dado que o AR10 não confirma ter hoje — qualquer rodada nesses
  itens precisa começar confirmando a fonte real antes de escrever
  motor algum.
- **Risco de licença**: qualquer código de terceiros eventualmente
  adaptado (nenhum recomendado nesta pesquisa para reuso direto, mas
  referências de arquitetura foram citadas) precisa ter licença
  reconferida no momento real do uso — várias das entradas GPL-3.0/
  LGPL-3.0 (Flowsurface, freqtrade, NautilusTrader) são copyleft forte,
  incompatível com adaptação direta de código sem replicar a licença.
- **Risco de plataforma**: OPFS (citado em §4 e §9) tem suporte
  historicamente desigual no Safari/iOS — exatamente a plataforma-alvo
  do AR10. Qualquer decisão de adotar depende de validação na versão
  real de iPadOS em uso, nunca da documentação genérica.
- **Risco de honestidade de evidência**: vários números citados pelos
  4 agentes de pesquisa (FPS de heatmap GPU, benchmark do uPlot, 90ms
  vs. 850ms do OPFS) vêm de material autorreportado por
  mantenedores/vendors, não de benchmark independente — cada um está
  sinalizado no texto onde aparece; nenhuma decisão de arquitetura
  deveria se apoiar SÓ nesses números sem medir no ambiente real do
  AR10 primeiro.
- **Risco já mitigado, registrado por transparência**: o pedido
  original do Operador que originou esta sessão continha um pedido de
  habilitar execução real de ordens, recusado explicitamente antes
  desta pesquisa começar (ver histórico da sessão). Nenhum item deste
  documento reabre essa questão — TODAS as entradas de "trading
  algorítmico" com capacidade de execução real (freqtrade, Hummingbot,
  Lean, ccxt) foram classificadas Descartar por esse motivo,
  consistentemente.

---

## 14. Fontes e referências técnicas

### Herdadas de pesquisa anterior desta sessão
`docs/historico/AUDITORIA_ECOSSISTEMA_VISUAL.md` — ATAS, Bookmap, GetChart,
LuxAlgo (order flow/heatmap); Sierra Chart, TraderVPS, Exocharts
(terminais profissionais); MDPI/Forecast, ScienceDirect, Springer,
PMC, arXiv (IA aplicada a previsão de cripto).

### Gestão de Risco (§7)
Kelly (1956, Bell System Technical Journal); Thorp (Kelly Criterion
and the Stock Market); MacLean/Thorp/Ziemba (Quantitative Finance,
fractional Kelly); resposta a Samuelson (Journal of Portfolio
Management, 42:1); Wilder (New Concepts in Technical Trading
Systems, 1978); Magdon-Ismail & Atiya (Maximum Drawdown, Risk
Magazine 2004 / SSRN); Journal of Applied Probability (Brownian
motion drawdown); White (A Reality Check for Data Snooping,
Econometrica 2000); Sullivan/Timmermann/White (Journal of Finance
1999); Aronson (Evidence-Based Technical Analysis); Pardo (The
Evaluation and Optimization of Trading Strategies, Wiley 2008); arXiv
2602.10785 (walk-forward window sensitivity); López de Prado
(Advances in Financial Machine Learning, 2018); Bailey & López de
Prado (Deflated Sharpe Ratio, JPM 2014).

### TradingView / MetaTrader/MQL5 (§2-3)
Documentação oficial MQL5.com (Standard Library, Strategy Tester,
Strategy Optimization, artigos 138/2612/3279/3280/4347/7290/7583/
13162/18555/18884/19331/21273/22291/22383/23250/23341); documentação
oficial TradingView (Pine Script Docs, Support Solutions sobre Bar
Replay/Screener/Heatmaps/Webhooks/Bar Magnifier/Deep Backtesting);
LuxAlgo (Smart Money Concepts, Fair Value Gap); scripts de comunidade
citados (CVD oficial da própria TradingView, Deeptest/Fractalyst).

### GitHub OSS (§4)
freqtrade, Hummingbot, NautilusTrader, Qlib (Microsoft), TA-Lib,
Flowsurface, lightweight-orderflow-charts, Perspective (FINOS/J.P.
Morgan), reconnecting-websocket/PartySocket (Cloudflare), ccxt,
TradingView lightweight-charts, KLineChart, uPlot, QuantConnect Lean,
vectorbt, hftbacktest, QuantReplay (Quod Financial), DuckDB-Wasm —
URLs completas de repositório e data de verificação (27/07/2026) no
relatório de origem do agente de pesquisa, preservadas nos commits
desta trilha.

### UX / Engenharia (§8-9)
Bloomberg UX Blog; ATAS/Bookmap (heatmap GPU); Apple (Human Interface
Guidelines, Liquid Glass); web.dev/Chrome team (INP, Canvas
performance, PWA update patterns, OffscreenCanvas, virtualização);
paper ACM IMC 2021 (WASM vs. JS benchmark); Figma Engineering Blog;
RxDB (IndexedDB vs. OPFS); GoogleChromeLabs/Comlink; React Working
Group (`useSyncExternalStore` design discussion, GitHub); React.dev
(React Compiler); documentação Zustand (pmndrs) + caso real Trendyol
Tech; react-window (bvaughn).

**Nota de proveniência**: todas as citações acima vieram de pesquisa
REAL via `WebSearch` (4 agentes de pesquisa em paralelo, 27/07/2026) —
nenhuma foi gerada de memória. Onde uma fonte não pôde ser confirmada
com o mesmo rigor das demais (ex.: `WebFetch` bloqueado por HTTP 403
em `mql5.com`/`tradingview.com`/`rxdb.info`), isso está sinalizado
explicitamente na seção correspondente, nunca escondido.

### On-Chain / Dados Institucionais dos EUA (§15)
`research.glassnode.com` (Exchange Metrics); `docs.glassnode.com`
(Entity-Adjusted Metrics, Transactions API); `insights.glassnode.com`
(How Many Entities Hold Bitcoin); Dune Docs (`docs.dune.com`,
Decoded Tables, Multichain Decoding), `dune.com/blog/decoding-contracts`;
FinBERT — paper original (Araci, 2019, arXiv, "FinBERT: Financial
Sentiment Analysis with Pre-trained Language Models") e aplicações a
10-K/10-Q (ResearchGate); Binance Open Platform
(`developers.binance.com`, WebSocket Streams, Important WebSocket
Change Notice, Liquidation Order Streams) — `WebFetch` direto bloqueado
neste sandbox (mesma barreira de todo domínio de exchange), síntese via
`WebSearch` sobre o conteúdo dessas páginas oficiais.

**Nota de proveniência (01/09/2026)**: pesquisa real via `WebSearch`
desta sessão. Bloomberg Terminal e FactSet/Capital IQ NÃO têm
documentação técnica pública de arquitetura interna (são produtos
comerciais fechados, sem GitHub/whitepaper de engenharia) — §15 é
honesto sobre isso: não "dissecou" nada que não existe publicamente,
reportou o que É de conhecimento público (existência/proposta de valor
de cada categoria de dado) e nada além disso.

---

## 15. Inteligência On-Chain e Dados Institucionais dos EUA

Pesquisa nova (01/09/2026), pedido direto do Operador (documento
"Mapeamento de Tecnologias e Plataformas para Evolução do Ecossistema
AR10") — escopo explícito do próprio pedido: **cripto e ativos
tradicionais dos EUA, nunca B3**. Território genuinamente não coberto
por §1-14: nada em `ipad_runtime/` hoje consome dado ON-CHAIN (endereço/
carteira/smart contract) — todo dado real do AR10 vem de klines/
orderbook/liquidations da própria exchange (Binance/MEXC/Bybit/OKX),
nunca de um nó de blockchain ou provedor de indexação. Isso não é uma
omissão — é consistente com "Fontes: Binance como primária, MEXC/Bybit/
OKX secundárias" já declarado no CLAUDE.md — mas significa que toda
entrada desta seção é **categoria de dado nova**, não motor de cálculo
sobre dado já fluindo (diferente de todo o resto deste documento).

| # | Nome | Categoria | Existe no AR10? | Decisão |
|---|---|---|---|---|
| 15.1 | Glassnode — Entity-Adjusted Metrics (clustering proprietário de endereços em "entidades", heurísticas de coinbase/change-address) | On-chain | ❌ NÃO | **Laboratório, gated por dado**: metodologia real e citável (heurísticas padrão da indústria + clustering proprietário), mas Glassnode é uma API paga — qualquer adoção exige decisão de custo/assinatura do Operador antes de qualquer motor de cálculo, não uma decisão técnica |
| 15.2 | Exchange Netflow/Inflow/Outflow (Glassnode, derivado do clustering acima) | On-chain | ❌ NÃO | **Laboratório, mesmo bloqueio de 15.1**: métrica real de pressão de liquidez (saldo entrando/saindo de exchange), mas exige a MESMA fonte de dado on-chain paga — não é um cálculo que o AR10 pode derivar do que já tem (klines/orderbook não contêm endereço nenhum) |
| 15.3 | Nansen — rotulagem de carteiras ("smart money", 500M+ endereços rotulados) | On-chain | ❌ NÃO | **Pesquisar mais, baixa prioridade**: complementar a Glassnode (rotulagem vs. série temporal), mesmo bloqueio de fonte de dado paga; radar de "fluxo institucional" citado no pedido do Operador é uma metáfora real mas o AR10 já tem um radar PRÓPRIO (OIH/Scanner) sobre dado de exchange, categoria diferente de "smart money" on-chain |
| 15.4 | Chainalysis — rastreamento/rotulagem para compliance | On-chain | ❌ NÃO, e provavelmente **Descartar**: o produto central da Chainalysis é compliance/investigação (AML, rastreamento forense) — categoria de produto distante do propósito de inteligência de mercado do AR10, mesmo que a tecnologia de clustering se sobreponha com 15.1/15.3 |
| 15.5 | Dune Analytics — tabelas decodificadas via ABI de smart contract (SQL sobre evento/função decodificados) | On-chain | ❌ NÃO, e **Descartar** como fonte de dado para o AR10 hoje: Dune decodifica ATIVIDADE DE CONTRATO (swaps DEX, mints NFT, governança) — o AR10 opera sobre Futures/Perpétuo CEX (Binance), onde a atividade relevante nunca passa por um smart contract público. Tecnicamente interessante, categoria de dado errada para o propósito real do AR10 |
| 15.6 | FinBERT — modelo aberto (MIT/uso livre), pré-treinado em corpus financeiro real (10-K/10-Q/earnings calls/newswire, ~4,9 bilhões de tokens), sentimento sobre texto financeiro | NLP | ❌ NÃO | **Laboratório, gated por FONTE DE TEXTO, não por modelo**: FinBERT em si é aberto e RODÁVEL localmente (inclusive via `onnxruntime-web`, ou reaproveitando o Worker do WebLLM já existente — ver §5), mas o AR10 hoje não tem NENHUM feed de notícia/filing real — o bloqueio real não é o modelo, é a ausência de fonte de texto (mesma classe de "lacuna de dado antes de lacuna de engenharia" já documentada em §10 para Footprint/hftbacktest) |
| 15.7 | Bloomberg Terminal — atalhos de teclado / navegação por comando | UX | Não aplicável — arquitetura de INPUT (teclado físico dedicado, function keys), o AR10 é touch-first (iPad) por decisão de plataforma permanente | **Descartar** — categoria de UX incompatível com a plataforma-alvo, não uma lacuna |
| 15.8 | Bloomberg Terminal — modelos de correlação de portfólio em tempo real entre dezenas de ativos | Risco/Quant | ⚠️ PARCIAL — o AR10 opera sobre 1 ativo selecionado por vez (mesmo design já validado em §2 item 5 pra Bar Replay); GMIL (`nexus/gmil`) já agrega contexto de MÚLTIPLOS ativos/categorias pro consenso global, mas não é uma matriz de correlação cross-asset | **Laboratório, baixa prioridade**: correlação real entre os pares que o Radar já varre é calculável a partir de dado já real (closes históricos), mas é uma mudança de escopo real (matriz N×N, não um motor de 1 ativo) — não confundir com o Motor de Cenários existente, que já é por-ativo |
| 15.9 | Bloomberg Terminal — NLP sobre notícias/filings SEC pra sentimento acionável | NLP | ❌ NÃO | Ver 15.6 — mesmo bloqueio de fonte de texto; Bloomberg tem a vantagem estrutural real de já possuir o feed de notícia proprietário, o que o AR10 não tem e não pode replicar sem uma decisão de fonte de dado nova |
| 15.10 | FactSet/Capital IQ — normalização de demonstrativos financeiros (balanços comparáveis entre empresas) | Dados corporativos | Não aplicável — o AR10 opera sobre USDT-M Futures/Perpétuo (cripto), não ações; "demonstrativo financeiro de empresa" não tem equivalente no domínio real do projeto | **Descartar** — categoria de dado do domínio errado, não uma lacuna |

**Achado central desta seção**: ao contrário de §2-9 (onde a maioria
dos itens era "motor de cálculo sobre dado que o AR10 já tem"), TODA
entrada real e aplicável aqui (15.1, 15.2, 15.6, 15.9) esbarra no MESMO
bloqueio — **fonte de dado nova**, não engenharia. Isso muda a natureza
da decisão: não é "vale a pena construir o motor", é "vale a pena
pagar/integrar uma fonte de dado externa nova" — uma decisão de custo e
de superfície de rede nova (GMIL já documenta em §2 do
`MAPA_EVOLUCAO_CIBORGUE.md` que ONCHAIN/MACRO ficam `null`
permanentemente por exigirem chave de API, hoje fora do escopo das
Restrições Permanentes do projeto). Nenhuma entrada desta seção deveria
avançar para código sem essa decisão do Operador vir primeiro — a
mesma disciplina de "Laboratório de Evolução: isolar antes de
integrar" do CLAUDE.md, aplicada aqui à fonte de dado antes mesmo do
motor.
