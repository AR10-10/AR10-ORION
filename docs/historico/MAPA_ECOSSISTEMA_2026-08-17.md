# Mapa do Ecossistema AR10 CYBORG — medido, não opinado

Pedido do Operador: *"mapear todo o ecossistema, principalmente a parte
gráfica, pra ficar mais perfeita... pesquisa também e todas plataforma que
existe... adicionar perfeitamente cada objeto no tanto certo, se não tem nada
aleatório... só as coisas úteis, que dá resultado principalmente no sistema
matemático... como ele é um ser vivo ele tem que se virar sozinho também, dele
ver que é reversão e já mudar a posição de long ou short."*

Método: medição direta do código (grep/leitura/contagem), nunca suposição.
Toda afirmação abaixo tem arquivo e linha.

---

# PARTE 1 — O ACHADO PRINCIPAL: a dobradiça de duas linhas

Esta é a resposta à pergunta da reversão, e é o achado mais importante já
levantado nesta trilha de auditorias.

## 1.1 Onde a decisão LONG/SHORT realmente nasce

Sob a LEI 24, o **Core Engine é o único emissor real** de LONG/SHORT/WAIT.
Rastreando o caminho completo:

```
App.tsx  →  realCycle  →  engine-bridge.ts:515
                             matrix.signal
                          js/research/trade-setup-matrix.js:44
                             const bias = research.trend_bias_heuristico
                          js/research/research-engine.js:192
                             const bias = trendBias(frame)
                          js/research/research-engine.js:35   ◄── AQUI
```

E `trendBias` é, na íntegra:

```js
function trendBias(frame) {
    if (!Number.isFinite(frame.last_price) || !Number.isFinite(frame.sma) || !Number.isFinite(frame.ema)) return 'INDEFINIDO';
    if (frame.last_price > frame.sma && frame.ema >= frame.sma) return 'ALTA';   // → LONG
    if (frame.last_price < frame.sma && frame.ema <= frame.sma) return 'BAIXA';  // → SHORT
    return 'NEUTRO';                                                             // → WAIT
}
```

**A decisão inteira do sistema é: preço vs. SMA, e EMA vs. SMA.** Duas
comparações de média móvel sobre uma janela de 20 candles
(`buildRealAnalysisFrame({ ..., windowSize: 20 })`, engine-bridge.ts:499).

## 1.2 O que NÃO entra na decisão

Medição dos imports reais dos dois arquivos que produzem o bias:

| arquivo | importa |
|---|---|
| `research-engine.js` | `schema.js`, `data-sufficiency.js` — **nenhum motor** |
| `analysis-frame.js` | `schema.js`, `support-resistance-engine.js`, `market-structure-engine.js` |

`market_structure` é calculado e **passa direto** pelo `research-engine`
(linha 213, `market_structure: frame.market_structure`) sem nunca tocar o
`bias`. É passageiro, não motorista.

Portanto **não entram na decisão**, apesar de existirem, funcionarem e serem
calculados a cada ciclo:

| motor real | o que detecta | entra na decisão? |
|---|---|---|
| `bos-choch-engine.js` | **CHoCH = a definição literal de reversão estrutural** | ❌ |
| `supertrend-engine.js` | flip de tendência por ATR | ❌ |
| `lorentzian-classifier.js` | classificação k-NN | ❌ |
| `head-shoulders-pattern.ts` | padrão de **reversão** por definição | ❌ |
| `harmonic-patterns.ts` | PRZ (zona de reversão potencial) | ❌ |
| `zigzag-engine.js` | pivôs estruturais | ❌ |
| `regime-engine.js` | ADX/regime | ❌ |
| `liquidity-void-engine.js`, `fvg-order-block-engine.js` | desequilíbrio | ❌ |
| Council, Ensemble, Multi-Timeframe Matrix, Evidence Fusion | confluência agregada | ❌ |
| **25 camadas de gráfico** (§2) | tudo o que aparece na tela | ❌ |

Isso não é bug: é a **LEI 24 funcionando exatamente como escrita**. Toda
inteligência nova é "confluência/contexto exibido ao Operador — display only,
a menos que o próprio Operador peça explicitamente para mudar essa
hierarquia."

## 1.3 A resposta honesta sobre reversão

**Ele vira sozinho? Sim — mecanicamente.** Quando o preço cruza abaixo da SMA
e a EMA acompanha, `ALTA` vira `BAIXA` e o badge vira SHORT. Sem intervenção.

**Ele vê a reversão? Não.** Ele vê a *consequência* dela, depois.

Um cruzamento de médias é, por construção, o detector de reversão **mais
lento que existe**: a média só cruza depois que preço suficiente já se moveu
para arrastar a média. A pesquisa confirma o que a matemática já diz — o CHoCH
dispara *antes* de cruzamento de média, MACD ou divergência de RSI, e é
justamente por isso que é o sinal de entrada mais precoce do arcabouço Smart
Money ([FXOpen](https://fxopen.com/blog/en/what-is-a-change-of-character-choch-in-trading-definition-signals-and-examples/),
[ATAS](https://atas.net/blog/understanding-change-of-character-choch-in-trading/),
[Zaye Capital](https://zayecapitalmarkets.com/what-is-choch-change-of-character-in-trading/)).

**E o CHoCH já está construído, testado e rodando neste repositório** —
`bos-choch-engine.js`, desenhado no gráfico pelo `StructureBreakMarkersPlugin`.
Ele só não tem permissão de falar com o Núcleo.

> O gargalo do "ser vivo que se vira sozinho" **não é matemática faltando.**
> É matemática pronta, medida, desenhada na tela — e proibida de decidir.

---

# PARTE 2 — Mapa do ecossistema gráfico

## 2.1 As 25 camadas (`CHART_LAYER_IDS`, EnhancedChart_110_Percent.tsx:252)

| # | camada | motor real por trás | categoria |
|---|---|---|---|
| 1 | `liquidity_zones` | `fvg-order-block-engine.js` + `liquidity-zone-fusion.ts` | estrutura |
| 2 | `structure_breaks` | `bos-choch-engine.js` | **reversão** |
| 3 | `order_flow_heatmap` | `orderflow/` (OFI/absorção/exaustão) | fluxo |
| 4 | `volume_profile` | WASM (`cyborg_quant_core`) | volume |
| 5 | `trade_plan_zone` | `council.ts` / fallback do Núcleo | plano |
| 6 | `neural_market_aura` | `aura-lifecycle.ts` + worker dedicado | contexto |
| 7 | `ema` | `nexus/ema.ts` | tendência |
| 8 | `trend_channel` | `trend-channel-engine.ts` (regressão OLS) | tendência |
| 9 | `vwap` | VWAP ±σ | valor |
| 10 | `nexus_line` | `nexus-line.ts` | valor |
| 11 | `cvd` | delta cumulativo real | fluxo |
| 12 | `fibonacci` | `fibonacci-confluence.ts` | estrutura |
| 13 | `premium_discount` | `premium-discount.ts` | estrutura |
| 14 | `harmonics` | `harmonic-patterns.ts` + triângulo + OCO | **reversão** |
| 15 | `equal_highs_lows` | EQH/EQL | liquidez |
| 16 | `liquidation_heatmap` | `liquidation-heatmap.ts` | derivativos |
| 17 | `liquidity_sweep` | `trap-detection.ts` | **reversão** |
| 18 | `market_sessions` | `market-session.ts` | tempo |
| 19 | `kill_zones` | `kill-zones.ts` | tempo |
| 20 | `session_key_levels` | `market-session.ts` (mesma partição) | nível |
| 21 | `institutional_zones` | `institutional-zones.ts` (consolidação) | confluência |
| 22 | `order_book_depth` | `order-book-depth.ts` | livro |
| 23 | `tpo_profile` | `tpo-profile.ts` | volume/tempo |
| 24 | `zigzag` | `zigzag-engine.js` | estrutura |
| 25 | `scenario_projection` | `scenario-engine.ts` | projeção |

**Nada aleatório encontrado.** Cada uma das 25 tem motor real, determinístico,
com suíte de testes. Zero `Math.random()` no fluxo de mercado (Regra de Ouro 1
verificada). Nenhuma camada é decorativa: a última auditada como "só efeito"
(`neural_market_aura`) foi justamente a que ganhou teste explícito de
compreensão.

## 2.2 Governança visual — por que não polui

Quatro mecanismos reais, todos com teste:

1. **`layer-relevance.ts`** — modo Automático decide o que aparece pelo
   contexto real (regime + proximidade + existência).
2. **`visual-budget.ts`** — orçamento de tinta por categoria; o que não cabe
   no orçamento não desenha.
3. **`chart-profile-lanes.ts` / `chart-time-ribbon-lanes.ts`** — geometria de
   faixas (horizontal e vertical) para nada colidir com nada.
4. **`canvas-palette.ts`** — 6 famílias de cor, separação mínima de 24° de
   matiz, com teste anti-deriva que quebra a suíte se alguém introduzir uma
   cor fora do sistema.

Este é o "cada objeto no tanto certo" que o Operador pediu — e já está de pé.

## 2.3 Performance medida (não estimada)

No teto real de 2000 candles: ciclo estrutural 0,31 ms; redesenho completo
4,03 ms contra orçamento de quadro de 16,7 ms. As duas camadas mais caras
(`computeKillZoneSpans` 2,72 ms, `computeSessionKeyLevels` 1,18 ms) já têm
cache por referência, então o custo real de pan/zoom por quadro é ≈ 0,13 ms.
**Não há gargalo.**

---

# PARTE 3 — Pesquisa: o que as plataformas de elite têm

Comparação contra Bookmap, Sierra Chart, ATAS, Quantower, Jigsaw
([United Daytraders](https://united-daytraders.com/blog/best-order-flow-trading-platforms),
[CoinCodeCap](https://coincodecap.com/bookmap-vs-gocharting-vs-atas-vs-jigsaw-vs-quantower),
[ATAS](https://atas.net/blog/best-heatmap-trading-software-2026/),
[SCS](https://www.scstudies.com/blog/sierra-chart-vs-bookmap-orderflow-2026)).

| recurso de elite | plataforma de referência | AR10 hoje |
|---|---|---|
| Footprint / Numbers Bars | Sierra, ATAS | ✅ existe |
| Delta / CVD | todas | ✅ existe |
| Absorção e exaustão | ATAS, Sierra | ✅ existe (`orderflow/`) |
| DOM / profundidade | Jigsaw, Quantower | ✅ existe |
| Volume Profile / TPO | todas | ✅ existe (ambos) |
| Heatmap de liquidação | Bookmap-like | ✅ existe |
| **Heatmap do LIVRO ao longo do tempo** | **Bookmap (o diferencial dele)** | ❌ **falta** |
| **Delta divergence como sinal de reversão** | **Sierra (Delta Candle Color)** | ⚠️ dado existe, leitura não |
| Cluster/imbalance empilhado | ATAS, Sierra | ⚠️ parcial |
| **Validação histórica calibrada** | todas as sérias | ❌ **falta (o teto real)** |

**Conclusão da pesquisa:** em *ferramental de leitura* o AR10 já está no nível
das plataformas caras — em alguns pontos acima (nenhuma delas tem Council,
Evidence Fusion ou orçamento visual automático). O que falta é de outra
natureza: **duas coisas de dado/tempo** (heatmap de livro; delta divergence
como leitura) e **uma de honestidade estatística** (backtest calibrado).

---

# PARTE 4 — Julgamento: o que fazer

## 4.1 O que NÃO fazer

- **Não adicionar mais camada de gráfico.** 25 é o limite útil; a governança
  visual já trabalha para caber. Camada nova agora piora, não melhora.
- **Não inventar "probabilidade".** Sem backtest calibrado, qualquer % de
  acerto seria fabricado (Regra de Ouro 2).

## 4.2 O que fazer, em ordem de impacto real

**1. Reversão no Núcleo — o único item que responde ao pedido do Operador.**
Descrito na Parte 1. Exige decisão explícita dele (LEI 24). Detalhado em §5.

**2. Delta divergence como leitura nomeada.** O dado (delta por candle) já
existe; falta a leitura "preço fez máxima nova e o delta não acompanhou" —
absorção clássica, e um dos sinais de reversão mais precoces do fluxo. Reusa
`orderflow/`, não é motor novo.

**3. Heatmap do livro ao longo do tempo.** `l2-history.ts` já guarda o
histórico. É o diferencial do Bookmap e a única lacuna real de ferramental.

**4. Validação histórica calibrada.** O teto. Só ela torna honesto medir se
qualquer mudança acima melhorou alguma coisa.

## 4.3 Ordem correta (e por quê)

O item 4 deveria vir **antes** do item 1 na ordem ideal de engenharia: mudar o
coração da decisão sem medir contra histórico real é exatamente o que a
Disciplina de Trabalho §5 do CLAUDE.md manda não fazer. A infraestrutura
existe (`structural-backtest.js`, Track Record por `symbol:timeframe`,
`trade-simulation.ts` com custo real).

**Recomendação honesta:** construir a reversão como **motor puro isolado**,
medi-la contra o histórico real, e só então decidir se ela substitui,
complementa ou não toca o `trendBias`. É o Laboratório de Evolução do
CLAUDE.md §3 aplicado ao caso mais crítico possível.

---

# PARTE 5 — A decisão que só o Operador pode tomar

A LEI 24 diz, textualmente, que a hierarquia só muda "se o próprio Operador
pedir explicitamente". O pedido *"dele ver que é reversão e já mudar a posição
de long ou short"* é esse pedido. Mas **como** fazer tem saídas materialmente
diferentes:

| opção | o que muda | risco |
|---|---|---|
| **A — Núcleo enxerga reversão** | `trendBias` passa a considerar CHoCH/SuperTrend além das médias | Alto: muda o coração; sem backtest é fé |
| **B — Veto de reversão** | Núcleo mantém as médias, mas CHoCH contrário força WAIT (nunca inverte sozinho) | Médio: mais conservador, some sinal tardio errado |
| **C — Alerta de reversão** | Nada muda na decisão; um aviso real e destacado "estrutura virou contra o sinal atual" | Baixo: zero risco, mas continua sendo o Operador que vira |
| **D — Medir primeiro** | Motor puro + backtest real, decisão depois com número na mão | Nenhum, só tempo |

Nada disso toca a restrição permanente: **o sistema continua READ_ONLY**.
"Mudar a posição" aqui significa mudar a *leitura* que o sistema emite —
nunca executar ordem, nunca mover capital, nunca guardar chave de corretora.
Isso não muda em nenhuma das quatro opções.

---

# Placar honesto deste mapa

| pergunta do Operador | resposta medida |
|---|---|
| dá pra mapear tudo? | Sim — feito acima |
| tem coisa aleatória? | **Não.** 25/25 camadas com motor real e teste |
| cada objeto no tanto certo? | Sim — 4 mecanismos de governança visual, todos com teste |
| falta o quê das plataformas de elite? | 2 itens reais (heatmap de livro, delta divergence) + backtest |
| ele se vira sozinho na reversão? | **Vira, mas tarde** — por cruzamento de média, o detector mais lento que existe |
| o que trava a evolução? | **Não é matemática faltando. É matemática pronta e proibida de decidir.** |

---

# ADENDO — o executor da medição, e um alerta que ele já produziu

`ipad_runtime/tools/measure-reversal-lead.mjs` fecha a metade que faltava: o
instrumento de `reversal-detector.ts` era uma biblioteca sem forma de ser
executada — a mesma "feature construída até a metade" que este documento
critica, criada por mim na entrega anterior.

```bash
node ipad_runtime/tools/measure-reversal-lead.mjs
node ipad_runtime/tools/measure-reversal-lead.mjs --symbol ETHUSDT --interval 1h
```

Roda os motores REAIS barra a barra (`trendBias` importado, `bos-choch-engine`,
`supertrend-engine`), **sem lookahead** — cada barra é avaliada só com o
histórico até ela. Fail-closed: sem rede real, sem número.

## Por que ele não roda aqui

As 5 corretoras são negadas pela política de rede deste ambiente (403 no
CONNECT), e o único candle do repositório é declaradamente sintético
(`replay-fixture.v1.json`: `live: false`, `exchange_connection: NONE`). Rodar a
medição ali produziria um número sobre um gerador. Na máquina do Operador
(`README_LOCAL.md`) o comando produz o número real.

## Validação de mecanismo (NÃO é resultado de mercado)

Executado sobre o fixture sintético, só para provar que o cano funciona:

| medida | valor |
|---|---|
| candles | 640 |
| viradas do Núcleo emparelhadas | 47 |
| eventos estruturais | 218 (199 CHoCH + 19 SuperTrend) |
| mediana da vantagem | **0 barras** |
| antes / empate / depois | 13 / 14 / **20** |

**O resultado 0 é uma boa notícia sobre o instrumento.** Numa série sem
estrutura real de mercado, um medidor viciado teria devolvido vantagem
positiva. Ele devolveu zero, com mais casos "depois" que "antes" — a correção
anti-viés (janela simétrica) está funcionando de verdade.

## ALERTA REAL que a validação levantou

**199 CHoCH em 580 barras ≈ 1 a cada 3 candles.** CHoCH real é evento raro e
significativo; nessa frequência ele não é "mudança de caráter", é ruído com
nome bonito.

Duas explicações possíveis, e a diferença importa muito:
- a série sintética é patologicamente serrilhada (provável — é um gerador), ou
- `bos-choch-engine.js` está com o gate de swing frouxo demais.

**Isto precisa ser checado no dado real antes de qualquer decisão.** Se o BTC
real também der ~1 CHoCH a cada 3 barras, então a evidência estrutural não
está pronta para influenciar o Núcleo em hipótese nenhuma — e a resposta
honesta ao pedido do Operador passaria a ser "primeiro apertar o detector,
depois falar em reversão". O executor imprime `eventosEstruturais` justamente
para essa checagem ser a primeira coisa que se olha.
