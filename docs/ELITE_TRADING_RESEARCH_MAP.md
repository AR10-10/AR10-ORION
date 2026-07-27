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

*(Pesquisa em andamento — agente dedicado, cobrindo Pine Script,
Replay, Alertas, Screener, Heatmaps de setor/mercado. Parte da
comparação de indicadores de order flow/liquidez já está coberta por
`AUDITORIA_ECOSSISTEMA_VISUAL.md` §3, citada e não repetida aqui.)*

**Placeholder — preenchido quando o agente de pesquisa retornar.**

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

*(Pesquisa em andamento — agente dedicado, cobrindo ATR/Position
Sizing, Kelly Criterion, Drawdown, Monte Carlo, Walk Forward,
Out-of-Sample.)*

**Placeholder — preenchido quando o agente de pesquisa retornar.**

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
