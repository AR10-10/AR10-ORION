# AR10 CYBORG — Elite Trading Research Map

Pesquisa estratégica de metodologias, indicadores, arquiteturas e
ferramentas do ecossistema de trading algorítmico, para identificar
oportunidades de evolução compatíveis com o AR10 CYBORG. Entregável
único, pedido explícito do Operador (diretiva "ELITE TRADING RESEARCH
MAP"), seguindo as Diretrizes Obrigatórias de Pesquisa (§10 da
diretiva) — evidência real, nunca popularidade sem fonte; comparação
explícita com o estado real do código; classificação com justificativa
técnica.

**Status deste documento**: em construção incremental. 4 frentes de
pesquisa (MetaTrader/MQL5+Pine Script, GitHub OSS, Gestão de Risco,
UX+Engenharia) rodam em paralelo via agentes de pesquisa real
(WebSearch, fontes citadas) — as seções correspondentes são
preenchidas conforme cada uma retorna, marcadas explicitamente onde
ainda faltam. As seções que este documento herda de pesquisa REAL já
feita em rodadas anteriores desta sessão (Estrutura de Mercado, parte
de IA, parte de comparação com terminais profissionais) já estão
completas abaixo, com a data de referência de cada uma.

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

---

## 1. Metodologia

Regra vinculante desta pesquisa (§10.1 da diretiva, e Regra de Ouro 2
do próprio AR10): nenhuma tecnologia é recomendada por popularidade
sozinha. Toda entrada do catálogo tem objetivo, benefícios,
limitações, evidência real (fonte citada) e comparação honesta com o
que já existe no código — nunca um "seria legal ter" sem essa base.

**Reaproveitamento, não duplicação**: este projeto já tem 2 rodadas
reais de pesquisa técnica anterior, com fontes citadas e verificadas:

- `docs/AUDITORIA_ECOSSISTEMA_VISUAL.md` §3 (comparação com terminais
  profissionais — ATAS/Bookmap/GetChart/LuxAlgo), §7 (inventário do
  motor quantitativo/`nexus/`), §8 (Sierra Chart/Exocharts, IA
  aplicada a previsão de cripto — papers reais). Data de referência:
  2026-07-21.
- `docs/RELATORIO_EPC.md` — inteligências recuperadas/bugs corrigidos
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

## 3. MetaTrader 5 / MQL5

*(Pesquisa em andamento — agente dedicado.)*

**Placeholder — preenchido quando o agente de pesquisa retornar.**

---

## 4. GitHub

*(Pesquisa em andamento — agente dedicado, cobrindo projetos de
trading algorítmico, quant, order flow, dashboards financeiros,
WebSocket, visualização, backtesting, replay, performance/WASM.)*

**Placeholder — preenchido quando o agente de pesquisa retornar.**

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

*(Pesquisa em andamento — agente dedicado, cobrindo dashboards
profissionais, glassmorphism, heatmaps, multi-timeframe,
responsividade iPad, PWA, performance percebida.)*

**Placeholder — preenchido quando o agente de pesquisa retornar.**

---

## 9. Engenharia

*(Pesquisa em andamento — agente dedicado, cobrindo Rust/WASM,
IndexedDB/OPFS, Workers, padrões React/TS para estado em tempo real.)*

**Placeholder — preenchido quando o agente de pesquisa retornar.**

---

## 10. Matriz de lacunas consolidada

**Placeholder — montada depois que todas as seções de pesquisa
retornarem, cruzando os achados de 2-9 com classificação real.**

---

## 11. Backlog técnico priorizado

**Placeholder.**

---

## 12. Roadmap de evolução

**Placeholder.**

---

## 13. Riscos identificados

**Placeholder.**

---

## 14. Fontes e referências técnicas

Herdadas de pesquisa anterior (`AUDITORIA_ECOSSISTEMA_VISUAL.md`,
seção "Fontes"): ATAS, Bookmap, GetChart, LuxAlgo (order flow/heatmap);
Sierra Chart, TraderVPS, Exocharts (terminais profissionais); MDPI/
Forecast, ScienceDirect, Springer, PMC, arXiv (IA aplicada a cripto).

**As demais fontes desta rodada (MetaTrader/MQL5, GitHub, Gestão de
Risco, UX/Engenharia) serão anexadas aqui conforme cada pesquisa
retornar.**
