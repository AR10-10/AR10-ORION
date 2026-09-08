# Pesquisa de referências externas — MASTER ORDER §74-B

**O que este documento é:** o bloco **B — RESEARCH** do §74, entregue no
formato que a Ordem pede (referência · arquitetura observada · o que o AR10
já possui · o que falta · o que vale incorporar · o que NÃO vale copiar).

**Limite de profundidade, declarado antes de tudo:** foram lidas a
**documentação oficial e as descrições de arquitetura** de cada projeto,
não os códigos-fonte inteiros. Onde a leitura foi só documental, está
escrito. Nenhuma afirmação aqui é "eu li o código e confirmo" a menos que
diga exatamente isso. Nenhum destes projetos foi executado — este ambiente
não tem egress para nada (medido: CoinGecko, Binance, MEXC, Bybit e OKX,
todos falharam).

**Por que existe:** a Ordem manda auditar antes de construir para **não
duplicar motores**. Este documento é o registro de qual ideia externa vale
a pena e qual não vale — para uma sessão futura não refazer a pesquisa.

---

## 1. Concept Drift — ADWIN e Page-Hinkley

**Arquitetura observada.** ADWIN mantém uma janela deslizante **adaptativa**
e, a cada nova amostra, examina **todas as divisões possíveis** da janela,
comparando as médias das duas sub-janelas. O limiar de "diferença
significativa" é **derivado por limite de Hoeffding**, não escolhido pelo
usuário — o algoritmo é descrito como **parameter-free**. Quando detecta
mudança, a janela **encolhe** para conter só o que é consistente com o novo
regime. Page-Hinkley acumula desvios da média corrente e alarma quando o
acumulado passa de um limiar **definido pelo usuário** — e a literatura
registra que PH/CUSUM são **sensíveis a esse parâmetro**, com trade-off
direto entre falso alarme e detecção real.

**O que o AR10 já possui.** `nexus/drift-detector.ts` (§6.120): compara
janela recente contra base **disjunta**, escalando pelo **erro padrão da
própria base** (`σ_base/√n`). As bandas 1σ/2σ/3σ são **convenção declarada**
— e o módulo diz isso explicitamente, em vez de fingir calibração.

**O que falta.** Exatamente o que ADWIN resolve: **o limiar ainda é
escolhido**, não derivado. E a janela é **fixa** (`RECENT_TRADES_WINDOW`
= 20), enquanto ADWIN a **dimensiona sozinho** conforme o dado.

**O que vale incorporar.** O limite de **Hoeffding** para derivar o corte,
substituindo as bandas declaradas — é a única coisa nesta pesquisa que
remove uma convenção do AR10 e a troca por algo **derivado**. Isso está
alinhado ao princípio que o projeto já aplica quatro vezes (freshness,
referência independente, mediana de volatilidade, erro padrão do drift):
*o limiar honesto é o que os próprios dados declaram*. **É a evolução
recomendada** do `drift-detector`, e é uma decisão de escopo do Operador
porque substituiria o núcleo estatístico de um módulo recém-entregue.

**O que NÃO vale copiar.** **Page-Hinkley**: trocaria a convenção atual por
**outra** convenção (o limiar do usuário) — sem ganho de honestidade. E a
**janela auto-encolhente** de ADWIN em cima de um Track Record com teto de
100 trades encolheria a amostra abaixo dos pisos que este projeto já exige
para falar qualquer coisa; a ideia do bound é aproveitável, o
redimensionamento agressivo não é.

---

## 2. Freqtrade — Advanced Orderflow

**Arquitetura observada.** Ativado por `use_public_trades`, exige o
download de **trades brutos**. Expõe no dataframe: `trades`, `orderflow`
(footprint), `imbalances`, `bid`/`ask` (volume por lado), `delta`,
`min_delta`, `max_delta`, `total_trades`, `stacked_imbalances_bid/ask`.
Parametrizado por `scale` (tamanho do bin de preço), `stacked_imbalance_range`
(quantos níveis consecutivos desequilibrados contam) e `cache_size`. A
própria documentação avisa: **startup lento e uso de memória maior**,
porque trades brutos são volumosos.

**O que o AR10 já possui.** CVD, delta, absorção, exaustão, OFI, sweep,
traps corroborados, muros de book por venue, intensidade de eventos —
`microstructure-snapshot.ts`, `order-book-depth.ts`, `trap-detection.ts`,
`orderflow-history.ts`, mais o feed real de trades da MEXC.

**O que falta.** O **footprint por bin de preço** e o **stacked imbalance**
(N níveis consecutivos desequilibrados). O AR10 tem delta agregado por
candle, não a distribuição bid/ask **dentro** do candle por faixa de preço.

**O que vale incorporar.** O conceito de **stacked imbalance** —
desequilíbrio isolado é ruído, desequilíbrio **empilhado em níveis
consecutivos** é o sinal. É uma redução barata sobre dado que o AR10 já
recebe, e casa com a disciplina de "exigir corroboração" que
`trap-detection.ts` já pratica.

**O que NÃO vale copiar.** O **footprint completo persistido**. A própria
documentação do Freqtrade admite o custo de memória e startup — e o AR10 é
uma PWA com alvo de **60 FPS em iPad Safari** (Regra de Ouro 7) e memória
limitada. Guardar trades brutos por candle para N candles é exatamente o
tipo de coisa que quebra esse alvo. Se um dia entrar, entra em Worker com
ring buffer, nunca no main thread.

---

## 3. Backtest event-driven (Axiom e equivalentes)

**Arquitetura observada.** O padrão que se repete em todos: **sinal gerado
em `t`, execução em `t+1`** para eliminar look-ahead por construção;
*execution handler* separado que consome eventos de ordem e produz eventos
de fill, modelando comissão e slippage; proteção contra viés por
**alinhamento de candle e exclusão do candle pendente**.

**O que o AR10 já possui.** `trade-simulation.ts` (comissão + slippage +
funding reais sobre desfecho REAL, nunca simulado), `walk-forward-calibration.ts`
(treina em `[0,i)`, prevê `i`), `shadow-calibration.ts`, e o laboratório de
backtest estrutural que se declara honestamente "subconjunto estrutural
candle-only".

**O que falta.** A **exclusão explícita do candle pendente** como
invariante testada em todo o caminho de análise — hoje isso é garantido por
disciplina caso a caso, não por um mecanismo único.

**O que vale incorporar.** A ideia de **`t` decide, `t+1` executa** como
invariante **verificável por teste** em vez de convenção respeitada. O AR10
já a cumpre no walk-forward e no shadow; o que falta é um teste que a
prove no caminho inteiro.

**O que NÃO vale copiar.** O **motor de backtest completo**. O AR10
deliberadamente **não** reconstrói um segundo histórico sintético — usa o
Track Record REAL (decisão registrada em `trade-simulation.ts`). Trocar
desfecho real por replay simulado seria uma regressão de honestidade, não
um avanço.

---

## 4. Hummingbot — separação de responsabilidades

**Arquitetura observada.** Três camadas: **Connectors** (padronizam ordens
e dados entre exchanges), **Executors** (fluxo de trabalho discreto, com
ciclo de vida `active → closed/failed`, autocontidos e *feitos para
terminar*, não para rodar sem fim) e **Controllers** (compõem executors,
comunicam-se por **fila de eventos**, acoplamento fraco).

**O que o AR10 já possui.** `market-data-bus/` como fonte canônica única
por `symbol:timeframe` (equivalente funcional do Connector), `TypedEventBus`
e o `organism-orchestrator`.

**O que falta.** Nada que o AR10 deva ter. **Executors são a camada de
execução de ordens** — e o AR10 é `READ_ONLY` incondicional.

**O que NÃO vale copiar.** **A camada Executor inteira.** É a parte do
Hummingbot que coloca, gerencia e cancela ordens reais. Importá-la seria
construir precisamente o caminho de execução que o `CLAUDE.md` proíbe em
qualquer reformulação. Vale ler pela **disciplina de fronteira** (cada
camada com um contrato), não pelo que ela executa.

---

## Veredito consolidado

| # | referência | vale incorporar? |
|---|---|---|
| 1 | **ADWIN** (Hoeffding bound) | **SIM — a recomendação principal.** Troca convenção por limiar derivado. Decisão de escopo do Operador. |
| 2 | Freqtrade — *stacked imbalance* | **Sim, o conceito.** Barato sobre dado já recebido. |
| 3 | Event-driven — `t`/`t+1` como teste | **Sim, como invariante testada.** |
| 4 | Page-Hinkley | Não — troca convenção por convenção. |
| 5 | Freqtrade — footprint persistido | Não — custo de memória incompatível com 60 FPS em iPad. |
| 6 | Motor de backtest completo | Não — o AR10 usa desfecho real, não replay. |
| 7 | Hummingbot Executors | **Nunca** — é a camada de execução de ordens. |

**Nada disto foi implementado.** Este documento é pesquisa, e a Ordem manda
uma fase por vez. Os itens 1, 2 e 3 são as evoluções reais recomendadas, na
ordem de valor.

---

## Fontes

- [ADWIN — scikit-multiflow](https://scikit-multiflow.readthedocs.io/en/stable/api/generated/skmultiflow.drift_detection.ADWIN.html)
- [blablahaha/concept-drift](https://github.com/blablahaha/concept-drift)
- [Autoregressive based drift detection (arXiv)](https://arxiv.org/pdf/2203.04769)
- [Freqtrade — Advanced Orderflow](https://www.freqtrade.io/en/stable/advanced-orderflow/)
- [freqtrade/docs/advanced-orderflow.md](https://github.com/freqtrade/freqtrade/blob/develop/docs%2Fadvanced-orderflow.md)
- [Event-driven backtesting engine (t/t+1)](https://github.com/Luczinsritter/event_driven_backtesting_engine)
- [backtest-kit — look-ahead protection](https://github.com/tripolskypetr/backtest-kit)
- [Hummingbot — Strategy V2 Architecture](https://hummingbot.org/strategies/v2-strategies/)
- [Hummingbot — Executors](https://hummingbot.org/strategies/v2-strategies/executors/)
- [Hummingbot — Connector Architecture](https://hummingbot.org/connectors/connectors/architecture/)
