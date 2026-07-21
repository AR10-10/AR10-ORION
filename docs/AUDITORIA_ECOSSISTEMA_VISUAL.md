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

## 7. Inventário do motor matemático/quantitativo (EPC §1/§3, pedido do
Operador: "mapear todo ecossistema... o que falta... mais perto dos
100%") — o lado do CÁLCULO, não do desenho

As seções 1-6 acima auditam o que o GRÁFICO desenha. Esta seção audita o
que o SISTEMA CALCULA — os motores em si, se estão conectados de verdade
(nunca construídos e esquecidos), e onde o pipeline quantitativo
realmente tem uma lacuna vs. onde só falta autorização/decisão do
Operador. Verificado por leitura direta do código (grep de import real
+ leitura do cabeçalho de cada módulo), nunca por suposição.

### 7.1 Camada graduada (`ipad_runtime/src/research/engines/`)

5 engines + 1 utilitário compartilhado, todos `ACTIVE_READ_ONLY`,
todos importados de verdade por `engine-bridge.ts`/`analysis-frame.js`
(lista completa e mantida em `research/QUARANTINE.md`, não duplicada
aqui): `support-resistance-engine.js` (S/R fractal + força por
confluência), `market-structure-engine.js` (HH/HL/LH/LL),
`fvg-order-block-engine.js` (FVG/OB/EQH/EQL — SMC), `lorentzian-
classifier.js` (k-NN, confluência independente), `bos-choch-engine.js`
(rompimento de estrutura). Zero código morto nesta camada — os 21
arquivos "FUTURE"/stub sem import real já foram removidos no purge de
2026-06-30 (documentado no próprio `QUARANTINE.md`).

### 7.2 Camada `nexus/` (43 módulos, contagem real via `find`) — status
de conexão real

Auditados via `grep` de import real (não só o nome aparecendo em
comentário) em `App.tsx`/`engine-bridge.ts`/outros módulos `nexus/`.
**42 dos 43 estão conectados de verdade.** O único que não está:

- **`cross-exchange-service.ts`** — serviço UNIFICADO de dados
  multi-exchange (Binance kline+L2 real, Bybit/OKX/MEXC via REST),
  `ConnectionManager` reusável, testado — mas o PRÓPRIO cabeçalho do
  arquivo já documenta, honestamente, por que ele não está ligado:
  *"Deliberadamente NÃO iniciado por App.tsx nesta fase (isso é a Fase
  0.6, escopada à parte por ser o passo de maior risco: substituir o
  WS/REST inline que já funciona em produção)."* Confirmado: o
  `crossExchangeCheck`/`okxCrossExchangeCheck` que JÁ aparecem no header
  hoje vêm de um `useState` mais simples em `App.tsx` (sondas REST
  inline de Bybit/OKX), não desta classe — cross-check multi-exchange
  **já funciona hoje**, só não pela via unificada mais nova. Não é um
  bug nem uma lacuna escondida — é uma decisão de risco já tomada e
  registrada; fica pra quando o Operador quiser autorizar a troca do
  caminho que já está no ar.

Os outros 42 (Council, Confluence Engine, Multi-Timeframe Engine,
Scenario Engine, Trade Plan, ETA Engine, Heat Score, Trap Detection,
Institutional Score, Harmonic Patterns, Premium/Discount, Trend Channel,
VWAP/VWAP State/Nexus Line, RR Quality, Signal Track Record, Affective
Memory, Self-Diagnostics, Organism Orchestrator/Nexus Core/Event Bus,
Connection Manager, Health Monitor, Consensus Radar, Decision Layer/
Operational Readability, Operation Assistant, Volume Profile, Fibonacci
Confluence, L2 History, Orderflow History/Orderflow Heatmap Draw, Market
Session, Timeframe Profile, Persistence, Live Candle Sync, Percentile,
EMA, Aura Lifecycle, Conviction Cyclone Draw, Types) estão todos
conectados e ativos.

### 7.3 Checklist EPC §3 — filtro por filtro, honesto

| Categoria pedida | Cobertura real | Onde |
|---|---|---|
| Filtros/pesos | ✅ | `ensemble-engine.js` (linear opinion pool Stone 1961/DeGroot 1974) + histerese nova do Council (`councilStanceWithHysteresis`, EPC §5/§6) |
| Confluências | ✅ (categoria mais forte) | `confluence-engine.ts`, `institutional-score.ts` (9 insumos → 1 score), `harmonic-patterns.ts`, `premium-discount.ts`, VWAP/NL states |
| Modelos estatísticos | ✅ (descritivos, nunca preditivos calibrados — Regra de Ouro 2) | `lorentzian-classifier.js` (k-NN + sampleSize honesto), `heat-score.ts` (percentil real), `compare-runs.js` (two-proportion z-test, laboratório) |
| Validações estruturais | ✅ | `market-structure-engine.js`, `bos-choch-engine.js`, `fvg-order-block-engine.js`, `support-resistance-engine.js` com força por confluência |
| Validações temporais | ✅ | `multi-timeframe-engine.ts` (1m→1D), `timeframeConfluence` (15m×1H), `market-session.ts` (sessão Londres/NY, já no header) |
| Projeções quantitativas | ✅ (níveis reais, nunca previsão) | `scenario-engine.ts` (Path A/B sobre níveis já mapeados), `eta-engine.ts` (ETA dinâmico, 2 blocos reais nomeados) |
| Modelos de risco | ✅ (escopo honesto de sistema READ_ONLY) | `rr-quality.ts` (piso 1:2 declarado), Risk Gate (Council `riskGated`), `risk_reward_ratio` real (target-tracker.js). Um modelo de VaR/position-sizing não se aplica — não existe posição real para dimensionar (Regra de Ouro 1). |
| Validações multi-timeframe | ✅ | mesma cobertura de "validações temporais" acima — confluência HTF já compara estrutura 15m vs. 1H de verdade |

**Conclusão honesta desta checklist**: nenhuma categoria pedida pelo EPC
§3 está genuinamente ausente. O pipeline quantitativo deste terminal já
cobre, com engines reais e testados, todas as 8 dimensões — a mesma
conclusão da auditoria visual (seção 3 acima): não há lacuna de
"motor/biblioteca faltando" que justifique construir algo novo
especulativo agora.

### 7.4 Achado incidental (fora do escopo original, registrado mesmo
assim — disciplina de auditoria)

`WidgetContext = createContext<any>(null)` (`App.tsx:254`) — todo
consumidor de `useContext(WidgetContext)` recebe um valor `any`, então
um nome de campo errado (ex.: o bug real corrigido em `be1fbf8`,
`engine?.target1` em vez de `engine?.target`) nunca vira erro de
compilação. Não é uma lacuna de MOTOR — é uma lacuna de TIPAGEM que
afeta a PRECISÃO de qualquer novo código escrito contra este Context.
Corrigir de verdade (tipar as ~65 chaves do Context com uma interface
real) é um refactor maior, mais arriscado, que merece sua própria
iniciativa isolada — não uma correção apressada junto de outra coisa
(mesma disciplina da Regra de Ouro 6 para o Core Engine).

### 7.5 O que falta de verdade, resumido

Cruzando esta seção com a seção 6 (resumo executivo visual): **as
lacunas reais deste ecossistema, hoje, são todas já conhecidas e
nomeadas** — nenhuma nova foi descoberta nesta auditoria:
1. Bandas da VWAP, OI/Funding desenhado, footprint/cluster, padrões
   geométricos, liquidation heatmap (seção 6 acima) — aguardando
   autorização/decisão do Operador.
2. `cross-exchange-service.ts` pronto, aguardando decisão de trocar o
   caminho inline que já funciona (Fase 0.6).
3. Backtest Fase 2 (`history-capture.js`) pronto, aguardando decisão de
   ONDE o Operador dispara a captura real + um ambiente com rede real.
4. Tipagem real do `WidgetContext` — fecha uma classe inteira de bug
   silencioso, refactor maior fora de escopo de uma correção pontual.

"Mais perto dos 100%" honesto, neste momento, significa: destravar os 4
itens acima (todos prontos ou quase prontos, todos bloqueados em decisão
— não em matemática faltando) — não inventar um 5º motor especulativo.

---

## 8. EPC §2 — pesquisa técnica estendida (Sierra Chart, Exocharts, IA
aplicada a mercados) — pedido explícito do Operador, repetido em
múltiplas mensagens

### 8.1 Sierra Chart / Exocharts — o que têm que o AR10 não tem

**Sierra Chart**: plataforma muito mais ampla em SUPERFÍCIE (400+
indicadores/estudos, automação de estratégia via script, ChartDOM —
book de ofertas totalmente integrado ao gráfico como ladder visual).
Boa parte dessa amplitude é exatamente o tipo de "ferramenta demais"
já reprovado na seção 5 (osciladores clássicos redesenhados) — não é
uma lacuna real, é uma escolha de produto diferente (editor genérico vs.
terminal de auto-análise). Os 2 diferenciais REAIS que valem nomear:
- **Footprint chart** (bid/ask volume-at-price por vela) — já listado
  como item 4.1 da seção 4 ("Vale muito, decisão + auditoria de
  granularidade do dado"), sem mudança de veredito aqui.
- **ChartDOM** (profundidade de mercado como ladder visual ao lado do
  candle) — o AR10 já tem o book real (bids/asks, imbalance, buy/sell
  %) mas nunca como ladder visual tradicional. Candidato honesto NOVO,
  registrado aqui pela primeira vez: exigiria layout novo (painel
  lateral dedicado), não é um encaixe trivial no gráfico atual — decisão
  de produto, não handicap matemático.
- **Automação de estratégia** (system trading) — permanentemente FORA
  de escopo (READ_ONLY/FAIL_CLOSED incondicional, CLAUDE.md) — nunca um
  gap a fechar, uma fronteira que não se move.

**Exocharts**: foco em order flow pra futuros+cripto, feature-set
bem próximo do que o AR10 já cobre no núcleo (CVD, heatmap de order
flow, footprint-adjacent) — SaaS comercial (~US$38/mês), sem
diferencial técnico que o AR10 ainda não tenha ou já não tenha
avaliado nas seções 3-4.

### 8.2 IA aplicada a mercados — pesquisa real, achado que VALIDA a
disciplina já existente do projeto

Pesquisa em papers/estudos recentes (2025-2026) sobre ML/IA aplicada à
previsão de direção de criptomoedas trouxe um achado direto e
importante:

> **"Pure technical analysis achieves directional accuracy of
> approximately 40-45% for Bitcoin price movements over 7-day
> horizons — marginally better than random chance."**

Mais achados reais da mesma pesquisa:
- Séries de tempo de criptomoedas compartilham propriedades
  semelhantes a ruído Browniano — modelos NAIVE (ingênuos) às vezes
  superam modelos de ML/deep learning mais complexos.
- Modelos "caixa-preta" baseados em correlação sofrem de baixa
  interpretabilidade e robustez.
- Manipulação de mercado e wash trading em exchanges pouco reguladas
  distorcem indicadores de liquidez/volume que modelos dependem.
- Não existe padrão de benchmark comparável ao de finanças
  tradicionais — cada estudo cria sua própria metodologia de avaliação,
  dificultando comparação real entre resultados.

**Por que isto importa pra este projeto, concretamente**: é evidência
EXTERNA e real que confirma — não apenas por cautela interna, mas por
pesquisa de mercado — que a Regra de Ouro 2 (confiança/força nunca é
probabilidade calibrada, porque este repositório não tem backtest real
que sustente essa afirmação) está correta, não excessivamente
conservadora. A abordagem já escolhida pelo AR10 (pools de opinião
lineares transparentes — Stone/DeGroot —, projeções sobre NÍVEIS REAIS
já mapeados, nunca uma rede neural fechada tentando prever preço
diretamente) está mais alinhada com o estado real da pesquisa do que
uma alternativa "mais IA" seria: os próprios papers mostram que
modelos mais complexos e opacos não superam de forma confiável
abordagens simples/interpretáveis nesta classe de ativo. `lorentzian-
classifier.js` (já graduado, confluência independente, nunca decisão
primária) já é o ponto certo nesse espectro — sinal de confluência
honesto, `sampleSize` sempre reportado, nunca fingindo mais certeza do
que a amostra sustenta.

**Conclusão honesta**: nenhuma descoberta desta pesquisa recomenda
construir um preditor de ML novo. Recomendaria o OPOSTO — qualquer
pedido futuro de "usa IA pra prever o preço" deve ser respondido
apontando para esta mesma pesquisa: a literatura real não sustenta essa
promessa hoje, e fabricar uma não seria "mais inteligente", seria menos
honesto.

---

## Fontes (pesquisa real)
- [ATAS — Order Flow & Volume Analysis Software](https://atas.net/)
- [ATAS — Heatmap Trading / Liquidity Heat Map](https://atas.net/blog/heatmap/)
- [Bookmap — Heatmap Indicator & Liquidity Heatmap](https://bookmap.com/en/features)
- [Bookmap — Order Flow Strategies](https://bookmap.com/en/content/order-flow-strategies)
- [GetChart — Pro Indicators (Liquidation Heatmap, CVD, Order Flow)](https://getchart.cc/en/features)
- [LuxAlgo — Liquidity Structure & Order Flow](https://www.luxalgo.com/library/indicator/liquidity-structure-order-flow/)

### Seção 8 (EPC §2)
- [Sierra Chart — plataforma oficial](https://www.sierrachart.com/)
- [TraderVPS — In-Depth Sierra Chart Analysis and Leading Alternatives for 2026](https://www.tradervps.com/blog/sierra-chart-analysis-alternatives-futures-trading)
- [Sierra Chart — Support Board, Order Flow Futures trading Charts](https://www.sierrachart.com/SupportBoard.php?ThreadID=99947)
- [Exocharts — OrderFlow charting platform for futures/crypto](https://exocharts.com/)
- [Causal-Structure-Based Cryptocurrency Price Direction Prediction Model (Forecast, MDPI)](https://doi.org/10.3390/forecast8040058)
- [Predicting cryptocurrency returns with machine learning: high-dimensional factor modeling (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0927538X25003701)
- [Machine learning approaches to cryptocurrency trading optimization: a comparative analysis (Springer, Discover AI)](https://link.springer.com/article/10.1007/s44163-025-00519-y)
- [Evaluating machine learning models for predictive accuracy in cryptocurrency price forecasting (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12571449/)
- [Cryptocurrency Price Forecasting Using Machine Learning (arXiv)](https://arxiv.org/pdf/2508.01419)
- [Forecasting and Trading Cryptocurrencies with Machine Learning Under Changing Market Conditions (Springer)](https://link.springer.com/chapter/10.1007/978-981-96-6839-7_10)
