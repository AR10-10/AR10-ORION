# Relatório — "Ordem Oficial: Etapa de Lapidação Matemática e Visual (AR10 Cyborg)"

## §0. Proveniência e escopo honesto

Sem endereçamento a persona fictícia, sem rodapé fabricado — Ordem Oficial
legítima na voz já estabelecida da sessão. Diferente em espécie das
últimas rodadas: não pede consolidação/auditoria de arquitetura, pede
**upgrades de precisão em cima de motores JÁ existentes**, com pesquisa
real como pré-requisito e evidência real como critério de aceitação — e
fecha explicitamente a fase de criação de motores ("A partir desta Ordem
fica encerrada a criação de novos motores").

Interpretação aplicada, nas palavras das 10 diretrizes: nenhum motor novo;
toda mudança precisa de justificativa matemática real (DIRETRIZ 8) e de
evidência de que ficou mais preciso, não só mais complexo (DIRETRIZ 3/9);
pesquisa real via ferramentas reais antes de tocar qualquer técnica com
nome próprio (DIRETRIZ 2, mesma regra já permanente do CLAUDE.md); a
Regra de Ouro da própria Ordem — "isto aumenta a inteligência do
organismo?" — decide cada candidato individualmente.

---

## §1. Auditoria: engines reais contra a definição de referência

Antes de propor qualquer mudança, os cálculos nomeados centrais foram
lidos e conferidos contra a definição clássica/de referência real:

| Engine | Técnica | Resultado da auditoria |
|---|---|---|
| `src/market-regime/regime-engine.js` | ADX/+DI/−DI de Wilder (14), Bollinger Bandwidth (20/2) | Fórmulas conferem exatamente com Wilder (1978) e Bollinger — suavização recursiva, DX, ADX por média de Wilder, bandwidth = 2kσ/média. **Correto, nada a mudar.** |
| `src/research/engines/lorentzian-classifier.js` | RSI de Wilder (14), ROC (9), ATR% de Wilder (14) | Todas as 3 recorrências conferem com a definição textbook. **Gap real encontrado**: ver §2. |
| `nexus/macd.ts` | MACD (Appel 1979), 12/26/9 | Reusa a mesma EMA já real duas vezes (preço, depois a própria linha MACD) — sem segunda fórmula de EMA. **Correto.** |
| `nexus/vwap.ts` + `nexus/vwap-bands.ts` | VWAP + bandas de desvio-padrão ponderado por volume | Preço típico (H+L+C)/3, variância ponderada por volume (não desvio simples dos closes) — mesma convenção documentada em TradingView/Sierra Chart/TrendSpider/MultiCharts. **Correto.** |
| `nexus/council.ts` | Linear opinion pool (Stone 1961/DeGroot 1974) | Delega ao motor real já testado (`src/consensus/ensemble-engine.js`) — Meta-Agent não reimplementa a agregação. **Correto.** |
| `src/research/engines/support-resistance-engine.js` | Pivots/swing fractal + extensão de Fibonacci (61.8%) | Reusa `fractal-swings.js` (zero segunda detecção de swing), força por confluência real de toques. **Correto.** |
| `nexus/percentile.ts` | Percentil "nearest-rank" (sempre um ponto real da amostra) | Escolha deliberada e documentada (nunca interpola um valor sintético) — consistente com a Regra de Ouro 1. **Correto, é design intencional.** |

Nenhum destes precisou de mudança — o que confirma, com evidência fresca,
que rodadas anteriores desta sessão já deixaram o núcleo quantitativo em
conformidade real com a literatura. O único gap genuíno encontrado está
no classificador k-NN Lorentziano, detalhado abaixo.

---

## §2. Pesquisa real (DIRETRIZ 2) e o achado: espaçamento cronológico

O comentário do próprio `lorentzian-classifier.js` já citava a técnica de
referência pelo nome ("Machine Learning: Lorentzian Classification",
jdehorty) só para a métrica de distância. Pesquisa real (`WebSearch` +
`WebFetch`, fontes: TradingView/jdehorty, ProRealCode, GitHub) confirmou
que a técnica original tem uma SEGUNDA característica, não portada até
agora: **espaçamento cronológico mínimo de 4 barras entre vizinhos
candidatos**, que o próprio autor documenta como necessário para
"garantir distribuição cronologicamente uniforme dos vizinhos" e
"prevenir viés de agrupamento temporal no treino."

**Por que isso é precisão real, não só complexidade (teste da DIRETRIZ 3)**:
RSI/ROC/ATR% são recorrências sobre janela móvel — candles adjacentes têm
features quase idênticas por construção (autocorrelação). Sem
espaçamento, os k=8 vizinhos mais próximos por distância Lorentziana
tendem a vir todos da MESMA janela contígua recente: não são 8 analogias
históricas independentes votando, é 1 tendência recente contada 8 vezes.
Isso infla artificialmente a "confiança" reportada (`|voteSum|/k` fica
perto de 1 quase sempre que o mercado está em qualquer tendência
consistente) sem nenhum ganho real de evidência — o oposto do que a Regra
de Ouro 2 exige de qualquer número de confiança/confluência deste
sistema.

**O que foi portado e o que foi deliberadamente descartado**: o mecanismo
de seleção do Pine Script original (`lastDistance` crescente + remoção
FIFO) é uma aproximação de streaming motivada pelo orçamento de execução
por-barra do TradingView — não é estatisticamente superior a um top-k por
ordenação completa. Este motor já ordena o pool inteiro de candidatos por
distância (`distances.sort(...)`), o que é estritamente mais preciso que
a aproximação do original. Portar aquele mecanismo seria só complexidade
sem ganho (violaria a própria DIRETRIZ 3). Só a IDEIA com justificativa
estatística real — o espaçamento — foi implementada.

## §3. Implementação

`lorentzian-classifier.js`: nova constante exportada
`CHRONOLOGICAL_SPACING = 4` (mesmo valor da técnica de referência) e um
filtro de uma linha no laço que constrói o `trainingSet` — só considera
candidatos `i % CHRONOLOGICAL_SPACING === 0`. Ancorado no índice
ABSOLUTO do candle (nunca relativo a `currentIndex`/`candles.length`):
qualquer par de múltiplos de 4 difere em pelo menos 4 por construção
matemática, então filtrar o pool já garante espaçamento mútuo entre os k
vizinhos finais — sem precisar reimplementar a aproximação de streaming
do original. A âncora absoluta também preserva a invariante já testada
"anexar 1 candle novo nunca pode fazer `sample_size` crescer mais que 1"
— um índice relativo ao candle atual reclassificaria todo o pool a cada
novo candle, o que teria quebrado essa garantia.

`metadata.concepts`/`metadata.limitations` atualizados com honestidade:
o pool de treino efetivo caiu de ~60-80 pontos para ~15-20 — troca
deliberada de disponibilidade por rigor estatístico, mais casos honestos
de `DADOS_INSUFICIENTES` em janelas pequenas, nunca escondida.

**Verificação de que a interface não precisa mudar**: `App.tsx` já exibe
"k-NN LORENTZ. {classificação} · {confiança}% (n={sample_size})" —
nunca usa a palavra "probabilidade", sempre mostra o `n` real ao lado.
Um `n` menor e mais honesto continua fluindo pelo mesmo caminho sem
nenhuma mudança de UI — a garantia de honestidade (Regra de Ouro 2) já
era estrutural, não precisou de reforço.

### Testes novos (execução real, não só padrão de código)

- `CHRONOLOGICAL_SPACING` é exatamente 4 (trava o valor da técnica de
  referência).
- `sample_size` bate, candle a candle, com a contagem analítica de
  índices `i % 4 === 0` no intervalo `[warmup, lastLabelableIndex]` —
  prova que o filtro está realmente ativo (não é comentário morto) e é
  estritamente menor que a contagem densa antiga.
- Qualquer par de índices aceitos fica a ≥4 candles um do outro (a
  propriedade central que motivou a mudança).
- Toda a suíte pré-existente (determinismo, bounds de confiança,
  neighbors_used==k, crescimento ≤1 por candle novo, DADOS_INSUFICIENTES
  fail-closed) continua passando sem alteração de expectativa — a mudança
  é aditiva sobre o mesmo contrato.

---

## §4. DIRETRIZ 5-7 (visual) — achados novos

Entregas 25 e 26 (mesma sessão, poucas horas antes) já auditaram
hierarquia visual, ruído/animações, cores/contraste e camadas do gráfico
com evidência fresca (Playwright real, 2 resoluções) — reauditar a mesma
superfície sobre o mesmo código produziria os mesmos resultados, então
não foi refeito.

Verificação direta feita nesta rodada, por tocar exatamente a superfície
que a mudança de §2/§3 alimenta: o rótulo "k-NN LORENTZ." em `App.tsx`
(linha ~4212 e ~4376) já é fail-closed (`realCycle?.lorentzian?.ok`),
nunca usa linguagem de probabilidade, e mostra `n=` real — nenhuma
mudança de interface foi necessária nem feita.

Nenhum achado novo de ruído/redundância visual apareceu fora do que já
está registrado e resolvido/adiado nos relatórios da Entrega 25/26.

---

## §5. Testes executados

- `tsc --noEmit`: limpo.
- `vitest run`: **136 arquivos / 2311 testes (100%)**, +3 novos
  (espaçamento cronológico: valor da constante, contagem exata do pool
  espaçado, propriedade de espaçamento mútuo).
- `npm run build`: 1850 módulos, **893,78 kB** (variação de +0,01 kB
  frente à Entrega 26 — consistente com uma mudança de poucas linhas em
  um módulo `.js` já carregado, evidência de que nada mais mudou no
  bundle).
- `git diff --stat`: só os 2 arquivos pretendidos tocados
  (`lorentzian-classifier.js`, `lorentzian-classifier.test.ts`) — zero
  drift em qualquer outro módulo.

## Resultado

Um gap real e pesquisado (não suposto) no único motor onde a auditoria
encontrou um ao vivo: o classificador k-NN Lorentziano agora espaça
cronologicamente seus vizinhos candidatos, reduzindo autocorrelação
temporal no voto — mesma propriedade estatística que a própria técnica de
referência documenta como motivo de existir. Todos os outros motores
nomeados (ADX/DI, RSI, ROC, ATR, MACD, VWAP+bandas, linear opinion pool,
suporte/resistência) foram auditados e confirmados corretos contra a
definição de referência, sem necessidade de mudança — nenhuma
"modernização" cosmética foi aplicada (DIRETRIZ 4). Zero motor novo, zero
mudança de interface, zero segunda fonte de decisão — LEI 24 intacta.
