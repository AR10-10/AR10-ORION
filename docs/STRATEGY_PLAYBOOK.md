# Strategy Playbook — design de estrategias de leitura (AR10 Cyborg 2.0)

Documento pareado com `ipad_runtime/configs/strategy-playbook.default.json`
(`config_id: AR10_CYBORG_STRATEGY_PLAYBOOK_DEFAULT_V1`). O conteudo aqui e
no JSON deve permanecer consistente — este documento e a leitura humana
do mesmo playbook; o JSON e a forma estruturada do mesmo conteudo.

**Status honesto**: `FUTURE_READY_REFERENCE_ONLY`. Nenhum codigo do PWA
(`index.html`, `js/app.js` ou qualquer outro modulo) le, ordena ou executa
este JSON hoje. Este e um documento de **design de estrategia**, nao um
motor de decisao implementado. Ele descreve criterios qualitativos para um
humano — ou um futuro research engine — avaliar o estado do mercado e
produzir um raciocinio. Nenhuma linha deste playbook abre, fecha ou
modifica posicao alguma.

## Regra vinculante de confianca (verbatim, prioridade maxima)

> **"Confidence must be heuristic unless a validated backtest exists. Do
> not present heuristic confidence as statistical probability."**

Esta instrucao do responsavel pelo produto e a regra mais importante
deste documento e do JSON pareado. Em termos praticos:

- Toda estrategia abaixo usa uma tag qualitativa de confianca —
  **LOW / MEDIUM / HIGH** — nunca um numero de probabilidade.
- A tag e calculada por **quantos `confidence_inputs` estao alinhados
  simultaneamente** no momento da leitura (ex.: 1 de 4 alinhados → `LOW`;
  3 de 4 alinhados → `HIGH`). Isso e contagem de criterios concordantes,
  nao frequencia historica.
- **Nao existe backtest validado neste repositorio.** Nenhuma estrategia
  abaixo cita uma taxa de acerto (win-rate), nenhuma cita "X% de
  probabilidade", e nenhuma deve citar — em nenhuma versao futura deste
  documento — um numero estatistico que nao venha de um backtest real,
  auditavel e versionado neste repositorio. Ate que tal backtest exista e
  seja documentado, `confidence_model.type` no JSON pareado permanece
  `HEURISTIC_QUALITATIVE_ONLY`.
- Frases como "73% de chance" ou "win-rate de 68%" sao **proibidas** em
  qualquer estrategia deste playbook, presente ou futura, enquanto esta
  condicao se mantiver.

## O que este documento e o que ele nao e

- **E**: design de criterios de leitura — `long_criteria` / `short_criteria`
  / `wait_criteria` — para classificar o estado atual do mercado em uma de
  tres rotas descritivas.
- **E**: insumo para o contrato de saida de analise (ver
  `docs/ANALYSIS_OUTPUT_CONTRACT.md`) — toda estrategia aqui produz uma
  leitura que se encaixa em ROTA A (Long) / ROTA B (Short) / ROTA C
  (Wait/No Trade).
- **NAO e**: codigo de execucao, motor de decisao automatizado, ou
  qualquer coisa que gere uma ordem. Este runtime e READ_ONLY / FAIL_CLOSED
  por lei interna (ver `ipad_runtime/README.md`); nenhuma estrategia deste
  playbook muda esse fato.
- **NAO e**: uma fonte de estatistica de desempenho. Nao ha numero de
  win-rate, drawdown historico ou expectativa matematica em nenhuma
  estrategia abaixo, porque nao ha backtest validado neste repositorio.

## Como ler cada estrategia

Cada estrategia abaixo segue exatamente os mesmos nove campos do JSON
pareado:

| Campo | Significado |
|---|---|
| `required_data` | Quais dados a leitura precisa para ser avaliada com responsabilidade. |
| `market_condition` | Em que tipo de mercado esta estrategia se aplica. |
| `long_criteria` | Condicoes que, alinhadas, sustentam uma leitura ROTA A (Long). |
| `short_criteria` | Condicoes que, alinhadas, sustentam uma leitura ROTA B (Short). |
| `wait_criteria` | Condicoes que sustentam ROTA C (Wait/No Trade) para esta estrategia. |
| `invalidation` | O que torna a leitura atual obsoleta e exige reavaliacao. |
| `risk_notes` | Observacoes de risco especificas desta leitura (nunca gestao de posicao real). |
| `confidence_inputs` | Quais criterios alimentam a tag heuristica LOW/MEDIUM/HIGH. |
| `limitations` | Onde esta leitura e fraca, ambigua ou depende de dados que podem faltar. |

---

## 1. Continuacao de Tendencia (`trend-continuation`)

Avalia se uma tendencia direcional ja estabelecida tem condicoes de
continuar, usando alinhamento de medias moveis e estrutura de
topos/fundos.

- **required_data**: candles OHLC do timeframe da analise; SMA e/ou EMA de
  pelo menos duas janelas (curta e longa); estrutura de topos e fundos
  (higher highs/higher lows ou lower highs/lower lows); volume relativo
  recente (opcional, reforca confianca se presente).
- **market_condition**: mercado em tendencia clara (alta ou baixa), sem
  sinais de exaustao ou divergencia evidente no timeframe analisado.
- **long_criteria**: preco acima da EMA/SMA de referencia com a media
  curta acima da longa; sequencia de fundos ascendentes nos ultimos
  pivots; pullback recente respeitou media/suporte sem rompimento de
  fechamento.
- **short_criteria**: espelho do `long_criteria` — preco abaixo das
  medias na ordem invertida, topos descendentes, pullback respeitando
  resistencia.
- **wait_criteria**: medias entrelacadas/cruzando repetidamente sem
  inclinacao clara; estrutura de topos/fundos mista; historico de candles
  insuficiente para calcular as janelas configuradas.
- **invalidation**: fechamento alem da media longa de referencia contra a
  tendencia assumida, ou rompimento do ultimo pivot estrutural.
- **risk_notes**: estrategias de continuacao tendem a entrar tarde em
  reversoes; sem gestao de posicao real neste runtime — qualquer leitura
  e insumo para decisao humana.
- **confidence_inputs**: alinhamento das medias na mesma direcao; numero
  de pivots consecutivos confirmando a estrutura; respeito ao pullback
  sem rompimento de fechamento; volume relativo crescente na direcao da
  tendencia (se disponivel).
- **limitations**: medias moveis tem atraso inerente (lagging), podendo
  gerar leituras tardias em reversoes rapidas. Sem backtest validado;
  confianca e sempre qualitativa, nunca probabilidade.

## 2. Rotacao em Range (`range-rotation`)

Avalia oportunidades de rotacao entre extremos de um range lateral bem
definido, comprando perto do suporte e vendendo perto da resistencia do
range.

- **required_data**: candles OHLC; niveis de suporte/resistencia do range
  (maximas/minimas recentes); largura do range para dimensionar zonas de
  entrada; oscilador de posicao relativa dentro do range (opcional).
- **market_condition**: mercado lateralizado, sem tendencia direcional
  clara, com pelo menos dois toques validos em cada extremo do range no
  historico recente.
- **long_criteria**: preco proximo ao limite inferior; pelo menos um
  toque anterior nesse suporte sem rompimento de fechamento; range ainda
  sem rompimento confirmado em nenhum extremo.
- **short_criteria**: espelho — preco proximo ao limite superior, toque
  anterior validado na resistencia, sem rompimento confirmado.
- **wait_criteria**: preco no meio do range; menos de dois toques por
  extremo (limites ainda nao validados); rompimento de fechamento recente
  em qualquer extremo (reavaliar como `breakout-confirmation`).
- **invalidation**: fechamento (nao apenas pavio) alem de um dos limites
  do range.
- **risk_notes**: ranges podem se romper sem aviso; operar contra um
  limite em formacao de breakout e o risco principal. Nenhuma ordem e
  gerada por este runtime.
- **confidence_inputs**: numero de toques historicos validados em cada
  extremo; simetria da reacao nos dois extremos; ausencia de rompimento
  recente; largura do range relativa a volatilidade recente.
- **limitations**: definicao de "limite do range" e sensivel a escolha de
  janela de lookback — leitura visual/heuristica, sem criterio estatistico
  formal. Sem backtest validado.

## 3. Confirmacao de Rompimento (`breakout-confirmation`)

Avalia se um rompimento de nivel relevante (suporte, resistencia ou
range) tem confirmacao suficiente para ser tratado como movimento
direcional, em vez de falso rompimento.

- **required_data**: candles OHLC; nivel de referencia rompido; volume
  relativo no candle de rompimento (fortemente recomendado); candles
  subsequentes para checar retest.
- **market_condition**: nivel testado multiplas vezes recentemente, com
  pressao crescente em uma direcao.
- **long_criteria**: fechamento (nao so pavio) acima da resistencia/range;
  volume relativo acima da media (se disponivel); retest respeitado como
  novo suporte.
- **short_criteria**: espelho — fechamento abaixo do suporte/range, volume
  de confirmacao, retest respeitado como nova resistencia.
- **wait_criteria**: rompimento apenas por pavio sem fechamento
  confirmado; volume indisponivel ou abaixo da media; retest ainda em
  andamento sem confirmar ou negar o nivel.
- **invalidation**: fechamento de volta para o lado original logo apos o
  rompimento (fakeout), especialmente sem volume de confirmacao.
- **risk_notes**: falsos rompimentos sao o erro mais comum desta familia;
  exigir fechamento e volume reduz mas nao elimina o risco.
- **confidence_inputs**: rompimento por fechamento (nao pavio); volume
  relativo acima da media (se disponivel); retest respeitado; numero de
  testes anteriores do nivel antes do rompimento.
- **limitations**: dado de volume pode nao estar disponivel para todos os
  instrumentos/fontes (ver `EVIDENCE` em `docs/ANALYSIS_OUTPUT_CONTRACT.md`);
  na ausencia de volume a leitura usa so estrutura de preco, ficando mais
  fraca. Sem backtest validado.

## 4. Reversao por Varredura de Liquidez (`liquidity-sweep-reversal`)

Avalia se um movimento rapido que rompe um extremo de liquidez evidente
(stop-hunt classico) seguido de reversao imediata indica armadilha de
liquidez, nao rompimento real.

- **required_data**: candles OHLC de timeframe mais curto (para ver o
  pavio de varredura com granularidade); nivel de liquidez evidente
  (maxima/minima obvia, redonda, ou extremo de range muito testado);
  velocidade/tamanho do pavio em relacao aos candles recentes; dados de
  liquidacao, se disponiveis, como reforco de evidencia.
- **market_condition**: nivel de liquidez obvio sendo varrido por
  movimento rapido com reversao no mesmo candle ou no imediatamente
  seguinte.
- **long_criteria**: pavio que varre minima de liquidez evidente seguido
  de fechamento de volta acima dela; varredura visivelmente mais
  rapida/abrupta que candles anteriores; liquidacoes short concentradas na
  regiao varrida (se disponivel).
- **short_criteria**: espelho — pavio varre maxima de liquidez, fechamento
  de volta abaixo, liquidacoes long concentradas na regiao (se
  disponivel).
- **wait_criteria**: pavio de varredura sem reversao clara (fechamento
  permanece alem do nivel); nivel nao suficientemente obvio/redondo para
  justificar a leitura; dados de liquidacao indisponiveis sem outra
  confirmacao.
- **invalidation**: fechamento subsequente que rompe novamente o nivel
  varrido na direcao original (sugere rompimento real, nao armadilha).
- **risk_notes**: leitura de reversao contra-movimento — risco mais alto
  que estrategias de continuacao; dados de liquidacao raramente sao 100%
  completos ou em tempo real.
- **confidence_inputs**: clareza/redondez do nivel varrido; velocidade do
  pavio comparada aos candles anteriores; fechamento de volta confirmado
  no mesmo candle ou no proximo; concentracao de liquidacoes na regiao
  (se disponivel).
- **limitations**: distinguir "varredura de liquidez" de "rompimento real
  que ainda nao confirmou" e dificil em tempo real — taxa de leitura
  ambigua mais alta que as outras estrategias do playbook. Sem backtest
  validado; nenhuma probabilidade numerica deve ser atribuida.

## 5. Contrarian por Funding Extremo (`funding-extreme-contrarian`)

Avalia se uma taxa de funding (funding rate) extrema e persistente
sugere posicionamento excessivo em um lado do mercado de derivativos,
favorecendo uma leitura contraria a essa multidao.

- **required_data**: funding rate atual e historico recente
  (`FUTURES/DERIVATIVES DATA`); duracao da persistencia do funding
  extremo; preco a vista/referencia para contexto; open interest (se
  disponivel).
- **market_condition**: funding rate consistentemente extremo (muito
  positivo ou muito negativo) por varios periodos consecutivos.
- **long_criteria**: funding muito negativo e persistente (mercado
  pagando para manter short); preco nao confirma a tese bearish implicita;
  open interest estavel/crescente durante a persistencia (se disponivel).
- **short_criteria**: espelho — funding muito positivo e persistente,
  preco nao confirma a tese bullish, OI estavel/crescente.
- **wait_criteria**: funding dentro de faixa normal/historica; funding
  extremo mas recente (poucos periodos, sem persistencia); dado de
  funding indisponivel ou desatualizado.
- **invalidation**: funding extremo se normaliza rapidamente sem qualquer
  movimento de preco na direcao contraria esperada.
- **risk_notes**: funding extremo pode persistir por longos periodos em
  tendencias fortes sem reverter — leitura de timing dificil.
- **confidence_inputs**: magnitude do funding em relacao a media historica
  recente; numero de periodos consecutivos de extremo; divergencia entre
  funding extremo e comportamento real do preco; open interest crescente
  durante o desequilibrio (se disponivel).
- **limitations**: funding varia por exchange/instrumento — este playbook
  nao define uma unica fonte como autoritativa (ver `Data quality` no
  contrato de saida). Sem backtest validado; nao ha numero historico de
  tempo-para-reversao documentado neste repositorio.

## 6. Tendencia com Expansao de Open Interest (`oi-expansion-trend`)

Avalia se um movimento direcional de preco acompanhado de expansao de
open interest indica entrada de posicionamento novo (tendencia com
"combustivel" real), em vez de apenas fechamento de posicoes existentes.

- **required_data**: candles OHLC; open interest atual e variacao recente
  (`FUTURES/DERIVATIVES DATA`); volume do periodo; funding rate como dado
  complementar (opcional).
- **market_condition**: movimento direcional de preco ocorrendo
  simultaneamente com aumento consistente de open interest no mesmo
  periodo.
- **long_criteria**: preco subindo enquanto OI tambem sobe; volume
  compativel ou acima da media; funding nao excessivamente negativo
  (sinal de fragilidade dos longs).
- **short_criteria**: espelho — preco caindo com OI subindo, volume
  reforcando, funding nao excessivamente positivo.
- **wait_criteria**: preco em movimento direcional mas OI caindo
  (fechamento de posicoes existentes, nao entrada nova); preco e OI sem
  correlacao clara; dado de OI indisponivel ou desatualizado.
- **invalidation**: reversao de preco acompanhada de queda abrupta de OI.
- **risk_notes**: OI crescente nao garante continuidade — apenas sugere
  participacao nova, nao que essa participacao esta certa.
- **confidence_inputs**: consistencia da correlacao preco-OI ao longo de
  varios periodos (nao um candle isolado); magnitude da expansao de OI
  vs. media historica; volume confirmando a expansao; funding ainda
  saudavel (nao extremo) durante a expansao.
- **limitations**: open interest agregado por exchange pode nao
  representar o mercado inteiro (fragmentacao entre exchanges); este
  playbook nao consolida multiplas fontes de OI. Sem backtest validado.

## 7. Reversao a Media por Perfil de Volume (`volume-profile-mean-reversion`)

Avalia se o preco se distanciou significativamente de uma zona de alto
volume negociado (point of control / area de valor) o suficiente para
favorecer uma leitura de retorno a essa zona.

- **required_data**: candles OHLC; perfil de volume do periodo de
  referencia (zonas de maior volume / point of control), quando
  disponivel; distancia atual do preco a essa zona; volatilidade recente
  (desvio padrao) para calibrar "distancia significativa".
- **market_condition**: preco afastado de uma zona de alto volume
  negociado identificavel, sem catalisador direcional claro sustentando o
  afastamento.
- **long_criteria**: preco abaixo da zona de alto volume a uma distancia
  maior que a variacao tipica recente (ex.: multiplos desvios padrao);
  nenhuma confirmacao de tendencia nova sustentando o afastamento; perda
  de momentum nos candles recentes (corpos menores, pavios de rejeicao).
- **short_criteria**: espelho — preco acima da zona, mesma distancia
  estatistica, mesma ausencia de confirmacao de tendencia, mesma perda de
  momentum.
- **wait_criteria**: preco proximo da zona de alto volume (pouco ou nenhum
  afastamento para reverter); perfil de volume indisponivel; afastamento
  presente mas com confirmacao de tendencia nova (outra estrategia se
  aplica melhor).
- **invalidation**: preco continua se afastando com momentum crescente,
  sem sinal de rejeicao (sugere tendencia real, nao extensao a reverter).
- **risk_notes**: mercados em tendencia forte podem se afastar de zonas de
  volume historico por longos periodos sem reverter; esta leitura assume
  regime de mean-reversion, que nem sempre se aplica.
- **confidence_inputs**: magnitude do afastamento em relacao a
  volatilidade recente; presenca de sinais de perda de momentum;
  clareza/qualidade do dado de perfil de volume disponivel; ausencia de
  confirmacao de tendencia nova.
- **limitations**: perfil de volume detalhado por preco pode nao estar
  disponivel em todas as fontes deste runtime; quando ausente, a leitura
  degrada para uma aproximacao usando apenas distancia estatistica
  (desvio padrao/z-score) do `AnalysisFrame` real (ver
  `ipad_runtime/js/replay-engine.js`). Sem backtest validado.

## 8. Retest de Suporte/Resistencia (`support-resistance-retest`)

Avalia se o retorno do preco a um nivel de suporte ou resistencia ja
validado anteriormente (retest) oferece uma leitura direcional com base
no comportamento historico daquele nivel.

- **required_data**: candles OHLC; nivel de suporte/resistencia
  previamente identificado e validado (pelo menos um toque anterior
  relevante); comportamento do preco nas aproximacoes anteriores; volume
  relativo na aproximacao atual (opcional).
- **market_condition**: preco retornando a um nivel que ja reagiu de
  forma identificavel em pelo menos uma ocasiao anterior no historico
  recente.
- **long_criteria**: aproximacao de suporte que ja gerou reacao de alta
  anteriormente; candles de aproximacao mostrando desaceleracao perto do
  nivel; nenhum fechamento abaixo do nivel durante a aproximacao atual.
- **short_criteria**: espelho — resistencia com reacao de queda anterior,
  desaceleracao na aproximacao, nenhum fechamento acima do nivel.
- **wait_criteria**: nivel ainda sem historico de reacao suficiente
  (apenas um toque, sem reacao clara); aproximacao com momentum forte sem
  desaceleracao (maior chance de rompimento — ver
  `breakout-confirmation`); distancia atual ao nivel ainda grande.
- **invalidation**: fechamento que rompe o nivel testado, contrariando o
  comportamento historico esperado (reavaliar como possivel breakout).
- **risk_notes**: niveis que reagiram no passado nao tem garantia de
  reagir novamente; numero de toques anteriores e contexto de tendencia
  maior alteram a confiabilidade do nivel.
- **confidence_inputs**: numero de reacoes historicas validas anteriores
  no mesmo nivel; consistencia do tipo de reacao nas ocasioes anteriores;
  presenca de desaceleracao de momentum na aproximacao atual; alinhamento
  do retest com a tendencia maior.
- **limitations**: identificacao de "o mesmo nivel" depende de tolerancia
  de preco (niveis raramente repetem exatamente); este playbook nao
  define uma largura de zona fixa. Sem backtest validado.

## 9. Confluencia Multi-Timeframe (`multi-timeframe-confluence`)

Avalia se a leitura direcional de um timeframe menor esta alinhada com a
estrutura de um timeframe maior, usando essa confluencia como reforco
(ou contraindicacao) da leitura.

- **required_data**: candles OHLC de pelo menos dois timeframes distintos
  (entrada e contexto maior); estrutura de tendencia/range identificada
  em cada timeframe (ver `trend-continuation`/`range-rotation` para os
  criterios base); niveis de suporte/resistencia relevantes em cada
  timeframe.
- **market_condition**: setup direcional identificavel no timeframe menor
  (de entrada), com o timeframe maior (de contexto) disponivel para
  checagem de alinhamento ou conflito.
- **long_criteria**: setup LONG identificado no timeframe de entrada (por
  qualquer outra estrategia deste playbook); timeframe maior tambem em
  estrutura de alta ou neutra; nivel de suporte do timeframe maior
  proximo o suficiente para invalidacao adicional.
- **short_criteria**: espelho — setup SHORT no timeframe de entrada,
  timeframe maior em estrutura de baixa ou neutra, nivel de resistencia do
  timeframe maior proximo.
- **wait_criteria**: setup do timeframe de entrada em conflito direto com
  a estrutura do timeframe maior; timeframe de contexto maior indisponivel
  ou com historico insuficiente; nenhum setup de entrada identificado no
  timeframe menor.
- **invalidation**: mesma invalidacao da estrategia de entrada usada no
  timeframe menor, reforcada negativamente se o timeframe maior tambem
  virar contra a leitura.
- **risk_notes**: estrategia de filtro de reforco/contraindicacao sobre
  outra leitura, nao uma estrategia independente — sempre depende de um
  setup base de outra entrada deste playbook.
- **confidence_inputs**: grau de alinhamento entre timeframe de entrada e
  contexto (alinhamento total = tag mais alta); qualidade/confianca do
  setup base no timeframe de entrada (herda `confidence_inputs` da
  estrategia de origem); proximidade de niveis relevantes do timeframe
  maior; numero de timeframes adicionais que tambem concordam, quando
  avaliados.
- **limitations**: quanto mais timeframes exigidos para concordar, menor a
  frequencia de setups validos — troca explicita entre robustez e raridade
  do sinal. Sem backtest validado; nenhuma frequencia historica de
  concordancia multi-timeframe e afirmada neste repositorio.

## 10. Alta Volatilidade — Sem Trade (`high-volatility-no-trade`)

Identifica condicoes de volatilidade anormalmente alta ou dados
inconsistentes/insuficientes em que a leitura responsavel e **WAIT por
definicao**, independente de qualquer outro criterio direcional parecer
presente.

- **required_data**: candles OHLC recentes (para medir volatilidade via
  desvio padrao/z-score, ja disponivel no `AnalysisFrame` real);
  comparacao da volatilidade atual com a tipica recente do mesmo
  instrumento; data quality flags de qualquer outra fonte usada na
  analise (ver `EVIDENCE` no contrato de saida).
- **market_condition**: volatilidade recente significativamente acima do
  tipico para o instrumento/timeframe, ou qualidade de dados insuficiente
  para qualquer leitura direcional responsavel — tipicamente em torno de
  eventos de noticia, baixa liquidez extrema, ou falha de fonte de dados.
- **long_criteria**: **nao aplicavel por definicao** — esta estrategia
  nunca produz leitura LONG. Sua existencia e justamente impedir leituras
  direcionais quando `wait_criteria` se aplica.
- **short_criteria**: **nao aplicavel por definicao** — pelo mesmo motivo
  acima, espelhado.
- **wait_criteria**: volatilidade recente acima de um multiplo claro da
  volatilidade tipica do instrumento; z-score do preco em territorio
  extremo; qualquer dado obrigatorio das outras estrategias deste playbook
  ausente/desatualizado/baixa qualidade; gap de preco anormal entre
  candles consecutivos sem explicacao de dados disponivel.
- **invalidation**: nao aplicavel no sentido tradicional — a "saida" desta
  leitura e a normalizacao da volatilidade e/ou o restabelecimento de
  dados completos e atuais, momento em que outra estrategia do playbook
  passa a ser avaliavel.
- **risk_notes**: esta e a estrategia de protecao do playbook — existe
  para que **ROTA C — WAIT/NO TRADE** (ver
  `docs/ANALYSIS_OUTPUT_CONTRACT.md`) seja sempre uma saida legitima e
  honesta, nunca um afterthought. Forcar uma leitura LONG/SHORT em alta
  volatilidade ou dados ruins e o erro que esta estrategia existe para
  prevenir.
- **confidence_inputs**: magnitude do desvio de volatilidade em relacao ao
  tipico; numero de campos de dados obrigatorios ausentes ou de baixa
  qualidade; presenca de gaps de preco anormais sem explicacao.
- **limitations**: definir "tipico" para volatilidade exige uma janela de
  referencia historica, que pode variar por instrumento e regime de
  mercado — este playbook nao fixa um numero universal. Esta e a unica
  estrategia do conjunto cujo proposito explicito e produzir WAIT, nunca
  LONG ou SHORT — isso e intencional, nao uma lacuna de design.

---

## Relacao com o restante do sistema (honestidade de escopo)

- Este playbook e consumido conceitualmente pelo contrato de saida
  descrito em `docs/ANALYSIS_OUTPUT_CONTRACT.md` — cada estrategia aqui
  produz uma leitura que se encaixa em ROTA A/B/C daquele contrato.
- A implementacao real e atual deste runtime e muito mais simples que
  este playbook: `ipad_runtime/js/replay-engine.js` calcula apenas
  candles/SMA/EMA/stddev/z-score (`AnalysisFrame` real, estatistica
  descritiva). Nenhuma das 10 estrategias acima esta codificada em
  JavaScript, Rust/WASM ou qualquer outro lugar deste repositorio — sao
  criterios de design para avaliacao humana ou para um research engine
  futuro, nao codigo executavel.
- O card `decision-frame-panel` em `ipad_runtime/index.html` (`STUB
  CONTROLLED`) e o limite explicito hoje: nenhuma logica de decisao ou
  sinal de ordem existe neste runtime, e nenhuma estrategia deste playbook
  muda isso.
- Nenhuma estrategia deste playbook, presente ou futura, autoriza
  execucao real, ordem, posicao, API secret ou qualquer rota bloqueada por
  `ipad_runtime/README.md` ("O que continua bloqueado, por design, sem
  exceção").
