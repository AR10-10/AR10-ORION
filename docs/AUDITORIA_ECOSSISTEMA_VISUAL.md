# AUDITORIA + PESQUISA DO ECOSSISTEMA VISUAL DO GRÁFICO

Revisão honesta do que o gráfico do AR10 CYBORG desenha hoje, comparação
com o que terminais profissionais de futuros/order-flow oferecem, e uma
lista priorizada — com veredito honesto — do que vale (e do que NÃO vale)
adicionar. Feita a pedido do Operador ("faz a revisão, gera uma pesquisa
pra ver o que falta... ou ferramenta demais, que acho que demais nunca é
de mais pra analisar... mas com julgamento profissional").

Regra desta auditoria: **auditar antes de propor** (código real lido,
nunca suposição), **pesquisar de verdade** (fontes reais abaixo), e
**julgar** — o Operador pediu explicitamente para eu dizer o que seria
excesso, não só empilhar ferramenta.

---

## 1. Pergunta concreta do Operador — RESPONDIDA e CORRIGIDA

> "aquela zona vermelha que aparecia tipo de liquidez... era pra cima ou
> era pra baixo? Está aparecendo?"

**Está aparecendo, sim.** A "zona vermelha tipo liquidez" é uma de duas
coisas reais, ambas desenhadas:

- **FVG/Order Block BEARISH** (`LiquidityZonesPlugin`): fundo vermelho
  (`rgba(255,0,85,...)`) = zona de **oferta/baixa** — o preço tende a
  reagir para **baixo** ao tocá-la. O correspondente verde é
  demanda/alta (reage para **cima**).
- **Heatmap de profundidade L2** (`OrderFlowHeatmapPlugin`): células
  vermelhas = **asks** (liquidez de venda, acima do preço); verdes =
  bids (liquidez de compra, abaixo).

**Achado real e correção aplicada nesta rodada**: o rótulo da zona
FVG/OB dizia só `"FVG"` / `"OB"` — a direção vinha **só da cor**, exigindo
que o Operador já soubesse a convenção (vermelho=baixa). Isso é
exatamente a confusão relatada ("era pra cima ou pra baixo?"). Corrigido:
o rótulo agora carrega o glifo de direção real do motor SMC — **`FVG ↑` /
`OB ↑`** (bullish, demanda, viés de alta) e **`FVG ↓` / `OB ↓`** (bearish,
oferta, viés de baixa), mesmo vocabulário ↑/↓ já usado por VWAP/Nexus
Line. A marca de obstáculo (`⚠`) continua acompanhando quando a zona está
no caminho de um alvo do plano ativo. Verificado com harness Playwright:
a zona vermelha agora lê `OB ↓` / `FVG ↓` sem ambiguidade.

---

## 2. Inventário completo do que o gráfico desenha HOJE

Lido direto do código (`EnhancedChart_110_Percent.tsx` + plugins). O
ecossistema atual é grande — 22 camadas reais, todas com toggle no painel
"Camadas do Gráfico" quando aplicável:

### Preço e tendência
- **Velas** (candlestick real, com patch de tick ao vivo).
- **VWAP** ancorada ao dia UTC (linha + estado direcional COMPRADOR/
  VENDEDOR/NEUTRA).
- **EMA** de período configurável (9/21/50/200).
- **Nexus Line** (equilíbrio suavizado, estado direcional).
- **Trend Channel** (regressão OLS 50 ±2σ, faixa + identidade lateral).

### Smart Money Concepts (forte)
- **FVG** (Fair Value Gaps) bullish/bearish, área preenchida + direção ↑/↓.
- **Order Blocks** bullish/bearish, área + direção ↑/↓.
- **Liquidez EQH/EQL** (Equal Highs/Lows) como linhas.
- **BOS / CHOCH** (rompimento/mudança de estrutura) marcados.
- **Premium / Discount** (dealing range: topo/EQ 50%/fundo).
- **Destaque de obstáculo estrutural** (⚠) nas zonas que cruzam o caminho
  de um alvo do plano ativo.

### Order flow / volume
- **Heatmap de profundidade L2** (bid/ask ao longo do tempo).
- **Bolhas de trades grandes** (compra verde / venda vermelha).
- **CVD** (Cumulative Volume Delta, sub-escala própria).
- **Volume Profile** (WASM: POC + HVN, barras à direita).

### Padrões e projeção
- **Harmônicos** (Gartley/Bat/Butterfly/Crab/Cypher/Shark/AB=CD/Wolfe) —
  polilinha XABCD + PRZ + EPA/ETA da Wolfe.
- **Fibonacci** (níveis reais da Matriz de Confluência, opacidade por
  score).
- **Scenario Engine v2** (até 3 alvos por rota + invalidação, honesto:
  massa de opinião do Conselho, nunca "probabilidade").
- **Trade Plan** (ENTRY/STOP/TARGET1-3 com R:R, distância %, ETA fundida,
  ratchet de stop break-even/trailing, REACHED/BREACHED) — agora no
  sistema anti-colisão do eixo.
- **Neural Market Aura** (corredor de convicção).

### Níveis do eixo (sistema anti-colisão unificado)
- S1/R1, VWAP, Nexus Line, EMA, último preço (ao vivo), Trend Channel,
  ENTRY/STOP/TARGET — todos resolvidos por `PriceLabelStackPlugin` para
  nunca se sobreporem.

### Indicadores COMPUTADOS mas não desenhados (alimentam a decisão)
- **RSI de Wilder**, **ADX**, **ATR** — entram no Council (overbought/
  oversold), no regime de mercado e na confluência. O Operador vê o
  RESULTADO (decisão do Core Engine, convicção, Council), não o cru.

### Cross-exchange / derivativos
- **Binance/MEXC/Bybit/OKX** — cross-check de preço/funding/Open Interest
  (hoje em painel/header, ver §4 item 5).

---

## 3. Comparação com terminais profissionais (pesquisa real)

Terminais de referência para order flow / SMC em cripto: ATAS, Bookmap,
GetChart, LuxAlgo (fontes no fim). O que eles têm de padrão:

| Recurso profissional | AR10 tem? | Nota |
|---|---|---|
| Heatmap de liquidez (L2 depth) | ✅ | `OrderFlowHeatmapPlugin` |
| CVD / delta acumulado | ✅ | sub-escala própria |
| Volume Profile / POC / HVN | ✅ | WASM real |
| Order Blocks / FVG / BOS-CHOCH | ✅ | suíte SMC forte |
| Liquidez EQH/EQL | ✅ | linhas |
| Bolhas de trades grandes / whale | ✅ | por trade real |
| Open Interest / Funding | ⚠️ | coletado, **não desenhado** no gráfico |
| **Footprint / cluster (bid×ask por vela)** | ❌ | ATAS-style — ver §4.1 |
| **Bandas da VWAP (±σ)** | ❌ | tem VWAP, falta as bandas — §4.2 |
| **Padrões geométricos (triângulo/cunha/bandeira)** | ❌ | tem harmônicos, falta clássicos — §4.3 |
| **Liquidation heatmap / níveis de liquidação** | ❌ | precisa fonte nova — §4.4 |
| Osciladores desenhados (MACD/RSI/Ichimoku) | ⚙️ | RSI/ADX computados, ver §5 |
| Desenho manual (trendline/fibo à mão) | ❌ | outra categoria de produto — §5 |

Conclusão honesta: no núcleo de **order flow + SMC**, o AR10 já está no
nível de um terminal profissional. As lacunas reais são pontuais.

---

## 4. Lacunas REAIS que valem a pena — priorizadas

### 4.1 Footprint / cluster chart (volume bid×ask por vela) — ALTO valor
O padrão-ouro do order flow (ATAS/Bookmap): dentro de cada vela, o volume
executado dividido entre bid (venda agressora) e ask (compra agressora),
revelando absorção e exaustão que o CVD agregado não mostra. O AR10 tem
CVD + heatmap L2, mas não o footprint por vela.
- **Dado**: precisa de trades por tick agregados por vela.
  `orderflow-history` já coleta trades — **auditar a granularidade real**
  antes de prometer (se só carrega CVD agregado por ~4s, não dá pra
  reconstruir o footprint honestamente; se carrega trades individuais,
  dá).
- **Custo**: camada de render nova + agregação. Motor puro em
  `research/engines/` primeiro (Laboratório de Evolução), graduado só
  depois de teste real.
- **Veredito**: vale muito, mas **decisão do Operador** (motor novo) +
  auditoria de dado antes.

### 4.2 Bandas da VWAP (±1σ / ±2σ) — ALTO valor, BAIXO custo
Padrão institucional: VWAP com bandas de desvio-padrão. O AR10 já computa
a VWAP real (`vwap.ts`); as bandas são o MESMO cálculo + o desvio real da
série (zero dado novo, zero fonte nova). Duas linhas fio-de-seda a mais,
mesma arquitetura das outras. Reforça o "bater o olho" (preço esticado vs
a média volumétrica).
- **Veredito**: **melhor custo-benefício da lista**. Escopo pequeno,
  aditivo, sem risco de fabricar dado. Recomendo como o próximo passo
  visual concreto quando o Operador autorizar.

### 4.3 Padrões geométricos clássicos (triângulo/cunha/bandeira) — MÉDIO
O Operador pediu "triângulo" explícito. O AR10 detecta harmônicos e o
Trend Channel (regressão), mas não triângulos/cunhas/bandeiras clássicos
(topos e fundos convergentes/paralelos). Algoritmo conhecido e determinís-
tico (regressão de swings de topo e de fundo + teste de convergência), se
encaixa no `fractal-swings.js` já existente.
- **Custo**: motor puro novo (`research/engines/`), suíte de execução
  real, graduação via `engine-bridge`.
- **Risco honesto**: definir "é um triângulo" tem tolerância subjetiva —
  precisa de limiar geométrico bem justificado (nunca um número inventado)
  e fail-closed (sem convergência clara, não desenha um palpite).
- **Veredito**: vale, é escopo definido, mas **motor novo = decisão do
  Operador** + pesquisa da definição canônica antes de implementar.

### 4.4 Open Interest / Funding DESENHADO no gráfico — MÉDIO, dado já existe
O OI e o funding já são coletados (cross-exchange/derivativos) mas hoje
aparecem em painel/header, não como série no gráfico. Desenhar OI como
sub-série (igual ao CVD) deixa o Operador ver divergências preço×OI
(distribuição vs acumulação) direto no gráfico — ganho real com **dado que
já existe**, sem fonte nova.
- **Veredito**: bom custo-benefício (dado pronto). Escopo médio (nova
  sub-escala). Recomendo depois das bandas da VWAP.

### 4.5 Liquidation heatmap — ALTO valor, mas BLOQUEADO em fonte de dado
Onde posições alavancadas são liquidadas (padrão em cripto: Coinglass/
GetChart). É o único item "grande" que a base de código **não pode**
entregar hoje: não é um cálculo, é uma **fonte de dado nova** (stream de
liquidação da Binance ou API tipo Coinglass) que precisaria entrar na CSP
e nos conectores.
- **Veredito**: honestamente **bloqueado** — não é falta de código, é uma
  decisão de adicionar uma fonte externa nova (com o custo de manutenção/
  confiabilidade que isso traz). Fica registrado como candidato, não como
  próximo passo imediato.

---

## 5. O que seria "ferramenta demais" — NÃO recomendo (julgamento honesto)

O Operador pediu para eu julgar, não só empilhar. Estes contradiziam a
tese do produto:

- **Osciladores clássicos desenhados em série (MACD, Stochastic, Ichimoku,
  Bollinger, RSI como sub-painel permanente)**: a tese do AR10 é
  **confluência que decide por você** — RSI/ADX/ATR já alimentam o Council
  e o regime. Desenhar 5 osciladores para o Operador ler e interpretar
  manualmente é exatamente a "sopa de indicadores" que o design evita, e
  contradiz o "bater o olho, o Core Engine decide". Seria ruído, não
  sinal. **Exceção mínima possível**: UM oscilador de momentum discreto
  (ex.: RSI) como sub-painel OPCIONAL por toggle, só se o Operador quiser
  auditar o cru — mas com a ressalva explícita de que a decisão já
  incorpora essa leitura.
- **Ferramentas de desenho MANUAL (trendline/retângulo/Fibonacci à mão)**:
  mudaria a categoria do produto — de terminal de auto-análise para editor
  de gráfico (tipo TradingView). Escopo enorme e valor questionável num
  sistema cuja tese é "a máquina desenha o que é real, você decide". Só
  faria sentido com uma decisão estratégica do Operador de mudar a
  natureza do produto — não é uma "feature a mais", é outro produto.

---

## 6. Resumo executivo — o que fazer com esta pesquisa

| # | Item | Veredito | Bloqueio |
|---|---|---|---|
| — | Direção ↑/↓ nos rótulos FVG/OB | **✅ FEITO nesta rodada** | — |
| 4.2 | Bandas da VWAP (±σ) | **Recomendo primeiro** | só autorização |
| 4.4 | OI/Funding desenhado | Recomendo em seguida | só autorização (dado pronto) |
| 4.1 | Footprint / cluster | Vale muito | decisão + auditoria de granularidade do dado |
| 4.3 | Triângulo/cunha/bandeira | Vale (pediu explícito) | decisão (motor novo) + pesquisa da definição |
| 4.5 | Liquidation heatmap | Candidato forte | **fonte de dado nova** |
| 5 | Osciladores/desenho manual | **Não recomendo** | contradiz a tese do produto |

Nada aqui foi construído sem pedido além do fix de direção (4.2–4.5 são
motores/camadas novas ou dependem de fonte nova — todos ficam para o
Operador decidir). Nenhum dado foi fabricado; nenhuma "probabilidade" foi
inventada; o conjunto atual já é o de um terminal de elite no núcleo de
order flow + SMC — as lacunas reais são pontuais e estão listadas com
custo e bloqueio honestos.

---

## Fontes (pesquisa real)
- [ATAS — Order Flow & Volume Analysis Software](https://atas.net/)
- [ATAS — Heatmap Trading / Liquidity Heat Map](https://atas.net/blog/heatmap/)
- [Bookmap — Heatmap Indicator & Liquidity Heatmap](https://bookmap.com/en/features)
- [Bookmap — Order Flow Strategies](https://bookmap.com/en/content/order-flow-strategies)
- [GetChart — Pro Indicators (Liquidation Heatmap, CVD, Order Flow)](https://getchart.cc/en/features)
- [LuxAlgo — Liquidity Structure & Order Flow](https://www.luxalgo.com/library/indicator/liquidity-structure-order-flow/)
