# Mapa de duplicação — AR10 ORION

**Método exigido pela ordem:** *"Não assumir que nomes diferentes
significam funções diferentes. Comparar matematicamente o que cada módulo
realmente calcula."* Cada par abaixo foi verificado lendo a matemática
real, não o nome do arquivo.

**Veredictos usados:**

- `DUPLICADO` — mesma matemática, duas implementações vivas. Consolidar.
- `DERIVADO` — um consome o outro. Arquitetura correta, não mexer.
- `DISTINTO` — nomes parecidos, matemática diferente. Não é duplicação.
- `ASSIMÉTRICO` — não é duplicação de código, é **cobertura partida**:
  o mesmo evento real chega a um consumidor e não chega a outro.
- `RESOLVIDO` — já foi duplicação, já foi consolidado, verificado agora.

---

## Os 17 pares da lista obrigatória

| # | Par investigado | Veredicto | O que a matemática real mostra |
|---|---|---|---|
| 1 | Volume × Volume Profile | **DISTINTO** | Barra de volume agrega por **tempo**; `volume-profile.ts` agrega por **bucket de preço** (histograma, POC, HVN/LVN). Eixos de agregação diferentes. O histograma pesado vem pronto do worker WASM — SSOT correto. |
| 2 | Volume × Delta | **DERIVADO** | Delta é volume **assinado** pelo lado do tick (`side === BUY ? +vol : -vol`). Uma primitiva, não duas. |
| 3 | CVD × Delta | **DERIVADO** | `signal-engine.js:136` — CVD é a soma corrente do delta. O `currentDelta` da exaustão é uma **janela rolante que zera**; o CVD **nunca zera**. Propósitos diferentes sobre a mesma primitiva, uma implementação só. |
| 4 | Order Book × Liquidity | **DISTINTO** | Order Book = liquidez **em repouso agora** (bid/ask, WS ao vivo). Liquidity Zones = liquidez **inferida do histórico** (Equal Highs/Lows sobre OHLC). Fontes de dado diferentes. |
| 5 | Liquidity Zones × Liquidity Sweep | **DERIVADO** | O sweep é o campo `swept` da própria zona (`fvg-order-block-engine.js:142`) — o evento de a zona ser rompida, não uma segunda detecção. |
| 6 | FVG × Order Blocks | **DISTINTO** | Mesmo arquivo, regras geométricas diferentes: FVG = não-sobreposição entre a vela i−1 e i+1; OB = última vela oposta antes de deslocamento por fechamento. |
| 7 | Structure × BOS/CHoCH | **DERIVADO** | `bos-choch-engine.js` **importa** `market-structure-engine.js` e `fractal-swings.js`. Zero recálculo. |
| 8 | EMA × Trend Bias | **DISTINTO (mesma coisa, uma implementação)** | `trendBias()` **é** a comparação preço×SMA e EMA×SMA. Não há duas — há uma, e ela é a decisão inteira (ver auditoria de verificação). |
| 9 | **ATR em múltiplos lugares** | **DUPLICADO** | Duas implementações vivas independentes: `computeAtrPercent` (Wilder-14, `lorentzian-classifier.js:196`) e `atrPercent` (`regime-engine.js:163`). Uma terceira dorme em `hmm-regime-model.js`. **Única duplicação matemática real encontrada.** |
| 10 | Risk em múltiplos lugares | **RESOLVIDO / SSOT-OK** | `src/risk/risk-engine.js` é o único que dimensiona (`min(tamanho_vol%, teto_kelly%, 100)`). `engine-bridge.ts` só repassa campos. Kelly vive uma vez, em WASM. |
| 11 | **Alertas duplicados** | **ASSIMÉTRICO — achado principal** | Ver seção própria abaixo. |
| 12 | **Voice dispatcher × Alert Center × GMIL** | **ASSIMÉTRICO** | Idem. GMIL não produz alerta — é contexto macro, categoria à parte. |
| 13 | Múltiplos verdicts direcionais | **DISTINTO, mas é o problema de produto** | 32 de 99 módulos emitem alta/baixa por matemáticas diferentes (ADX/DI, k-NN Lorentziano, estrutura fractal, MACD, multi-TF). Nenhum decide — só `trendBias()` decide. Não é duplicação de código; é **excesso de opinião sobre uma decisão rasa**. |
| 14 | Múltiplas fontes de preço | **RESOLVIDO** | `market-data-bus/` é a fonte canônica por `symbol:timeframe`. `engine-bridge.ts:579` documenta que o segundo `fetch()` direto a `api.binance.com/klines` **já foi removido**. Binance/MEXC/Bybit/OKX entram como cross-check, não como segunda verdade. |
| 15 | Múltiplos cálculos de tendência | **DISTINTO** | Ver #13. |
| 16 | Múltiplos cálculos de volatilidade | **DUPLICADO** | É o mesmo achado do #9 — ATR é o cálculo de volatilidade. |
| 17 | Múltiplas leituras de contexto | **DERIVADO** | `unified-presentation.ts` e Evidence Fusion leem os agregadores existentes; não recalculam. |

---

## Achado principal — cobertura de alerta partida

Não é duplicação de código. É pior e mais barato de corrigir: **dois
motores de alerta independentes, com cobertura quase disjunta.**

| Evento real | Vira alerta **visual** (`alert-center.ts`) | Vira alerta **falado** (`voice-dispatcher.ts`) |
|---|---|---|
| Track record resolvido | **sim** | não |
| Liquidity Sweep | **sim** | não |
| Mudança de direção do Núcleo | não | **sim** |
| Divergência Núcleo × Lorentziano | não | **sim** |
| Liquidação institucional | não | **sim** |
| Absorção no fluxo | não | **sim** |
| Saúde do motor | não | **sim** |
| BOS / CHoCH | **não** | **sim** |

O Operador **ouve** um CHoCH e **não vê** alerta nenhum dele. E **vê** um
sweep que nunca é falado. Mesmo sistema, dois vocabulários de severidade,
duas rotas de dado.

### O detalhe que fecha o caso

O cabeçalho de `alert-center.ts` registra que BOS/CHoCH **não podia** ser
alertado porque *"não têm fatia na unified-snapshot-store nem evento no
bus hoje"*. Isso continua verdade **sobre a rota canônica**. Mas
`voice-intents.ts:54-56` mostra que `structureBreakKey`,
`structureBreakType` e `structureBreakDirection` **já estão montados** no
`TerminalSnapshot`, e a regra 6 de `voice-dispatcher.ts` **já alerta sobre
eles há tempo**, por outra rota.

Ou seja: **o dado não falta — falta a rota canônica.** A justificativa
escrita no `alert-center.ts` está correta na disciplina de proveniência e
**desatualizada no fato**.

---

## Regra de Uma Única Verdade — estado real

A ordem pede SSOT com definição, fonte, proveniência, timestamp, versão,
confiança e consumidor. Onde isso já existe:

| Domínio | SSOT | Estado |
|---|---|---|
| Candles / preço | `market-data-bus/` (`requestSnapshot`) | **existe e é respeitado** |
| Swings fractais | `fractal-swings.js` | **existe** — 10 importadores, zero reimplementação |
| Order Blocks | `fvg-order-block-engine.js` | **existe** |
| Volume Profile | worker WASM | **existe** |
| Dimensionamento de risco | `risk-engine.js` | **existe** |
| **ATR / volatilidade** | — | **NÃO EXISTE** — duas implementações vivas |
| **Alertas** | — | **NÃO EXISTE** — dois produtores independentes |

---

## Ação recomendada, ranqueada por (valor ÷ risco)

1. **Unificar o alerta.** Um produtor canônico de `AlertEvent`; voz e UI
   viram dois **consumidores** do mesmo evento, cada um escolhendo como
   apresentar. Resolve os 8 eventos da tabela de uma vez e acaba com o
   descompasso ver/ouvir. Baixo risco: nenhuma matemática muda.
2. **Unificar o ATR.** Uma implementação de Wilder-14, os demais
   consomem. Já rastreado como task #342. Risco baixo, mas exige conferir
   que `regime-engine` usa o mesmo período efetivo antes de trocar.
3. **Não mexer em nada de #1 a #8, #10, #14, #17.** Não são duplicação —
   são arquitetura correta. Consolidar ali seria arrumar o que não está
   quebrado.
4. **#13 não se resolve com código.** 32 módulos opinando sobre uma
   decisão de 6 linhas é problema de **profundidade da decisão**, e a
   correção passa pela validação contra mercado real (Fase A), não por
   remover camada.

---

## Nota de método

Nenhuma funcionalidade foi removida ou proposta para remoção sem prova de
redundância, conforme a ordem exige. Dos 17 pares investigados, apenas
**um** é duplicação matemática real (ATR) e **um** é cobertura partida
(alertas). Os outros 15 sobreviveram à comparação — o que é, por si, um
resultado da auditoria: o ecossistema está mais bem fatorado do que a
quantidade de módulos sugere.
