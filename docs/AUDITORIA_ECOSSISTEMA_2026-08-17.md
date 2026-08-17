# Auditoria do Ecossistema — 2026-08-17

Pedido do Operador: avaliar o sistema todo, cada caixinha e cada objeto, para
ver se há repetição, se algo trava ou atrasa outra parte, e o que precisa ser
corrigido, evoluído, retirado ou adicionado.

Método: **medir, não opinar.** Toda seção abaixo é resultado de script ou
benchmark real, não de leitura impressionista. Onde o resultado contradisse a
premissa da pergunta, isso está registrado.

---

## 1. Dado morto (campo computado e nunca exibido)

Esta é a classe de bug que o projeto já pegou 3 vezes (#89 Target 3, #90
Consenso hardcoded, #91 affectiveMemory), então foi a primeira a ser medida.

Script: extrai os campos da interface de estado de `unified-snapshot-store.ts` e
procura cada um em TODO o resto do código.

| métrica | valor |
|---|---|
| campos declarados na store | **121** |
| sem nenhuma referência fora da store | 2 (`harmonicPatterns`, `setOffline`) |
| **dado morto real após verificação** | **0** |

**Os 2 candidatos eram falso positivo, e a razão importa:**

- `setOffline` — chamado no próprio arquivo da store (linha 649, listener de
  `window.online`). Vivo, só auto-contido.
- `harmonicPatterns` — **escrito** em `App.tsx:2281`
  (`st.setHarmonicPatterns(...)`) e **lido** em `App.tsx:7796` via
  `useHarmonicPatternsSnapshot()`. O grep pelo nome cru não achou porque o
  consumidor usa o **hook seletor**, não o campo.

**Ponto cego do método, registrado para a próxima auditoria:** um campo lido
apenas por seletor parece morto para uma busca pelo nome. Qualquer auditoria
futura de dado morto tem de resolver `useXSnapshot` → campo antes de concluir.

**Veredito: a store está limpa.** 121 campos, zero desperdício.

---

## 2. Duplicação real

Script: toda `function` definida em mais de um arquivo de `src/**`.

| nome | arquivos | classificação |
|---|---|---|
| `post` | 2 workers | **Benigno** — helper local de `postMessage`; workers são isolados por definição, compartilhar exigiria um módulo comum só para 2 linhas |
| `insufficient` | `aura-lifecycle`, `confluence-engine`, `eta-engine` | **Não é duplicação** — 3 assinaturas e 3 tipos de retorno diferentes (`AuraReading`/`ConfluenceReading`/`EtaReading`). É a MESMA convenção de nome para o construtor fail-closed de cada motor, o que é consistência boa |
| `fmtPrice` | `publication/canvas-primitives`, `nexus/market-analysis` | **Duplicação deliberada** — corpo idêntico (1 linha), mas `nexus/` importar de `publication/` inverteria a camada. Mesma justificativa já documentada para `fmtWallPrice` |
| `pushHistory` | `paper-trading`, `signal-track-record` | **Duplicação real, minor** — mesma lógica (append + teto), mas tipos diferentes (`SimulatedPosition[]`/`TrackedPlan[]`) e **tetos diferentes**. 3 linhas cada |

**Decisão sobre `pushHistory`:** fica. Extrair um genérico acopla 2 módulos
independentes por 3 linhas, com risco não-zero e benefício ~zero. Registrado
como conhecido e aceito, não como esquecido.

**Veredito: zero duplicação nociva.**

---

## 3. Bloqueio e atraso (a pergunta central)

Benchmark real dos motores síncronos no teto real de `MAX_CHART_HISTORY = 2000`
candles, mediana de 12 execuções após warm-up.

### Ciclo estrutural (roda a cada 30s)

| motor | mediana | pior |
|---|---|---|
| `detectHarmonicPatterns` | 0.12ms | 1.67ms |
| `detectTrianglePattern` | 0.07ms | 0.09ms |
| `detectHeadAndShoulders` | 0.12ms | 0.17ms |
| `computePremiumDiscount` | 0.00ms | 0.01ms |
| **soma** | **0.31ms** | — |

### Por mudança de dado (redraw)

| motor | mediana | pior |
|---|---|---|
| `computeTrendChannel` | 0.13ms | 1.56ms |
| `computeKillZoneSpans` | 2.72ms | 4.43ms |
| `computeSessionKeyLevels` | 1.18ms | 2.44ms |
| **soma** | **4.03ms** | — |

Orçamento de 1 frame a 60fps = **16.7ms**.

**Detalhe decisivo:** os 2 mais caros (`computeKillZoneSpans` 2.72ms e
`computeSessionKeyLevels` 1.18ms) **já têm cache por identidade de referência**
nos respectivos plugins (`spansCacheRef`/`levelsCacheRef`, chaveados em
`dataRef.current`). Eles NÃO recomputam em pan/zoom — só quando os candles de
fato mudam. O custo real por frame durante pan/zoom é ~0.13ms.

**Veredito: não existe problema de travamento ou atraso.** O ciclo estrutural
usa 0.31ms a cada 30 segundos. O pior caso absoluto de redraw usa 24% de um
frame, e só acontece quando o dado muda. A premissa de "algo travando e
atrasando o ecossistema" **não se confirma na medição** — e isso é registrado
como resultado, não como suposição otimista.

---

## 4. O que de fato foi corrigido nesta sessão

| achado | natureza | como foi encontrado |
|---|---|---|
| 2.3 | S1/R1 fora do orçamento visual | auditoria de código |
| 2.4 | Sem sinal de "reanalisando" após alvo | pedido do Operador |
| 2.5 | Motor de Cenários sem nenhum controle | auditoria de código |
| 2.6 | Kill Zone de altura total | **captura ao vivo do Operador** |
| 2.7 | Fibonacci com hierarquia invertida | pedido do Operador |
| 3.1 | 30 tons de cor → 6 famílias | **medição de matiz** |
| 3.2 | Etiqueta WALL duplicada e fora da lane | **captura ao vivo do Operador** |
| 3.3 | Regressão contra índice, plot contra tempo | **eliminação de hipóteses** |

## 5. O padrão que mais custa ao sistema

Três dos oito achados acima são **reincidências** — erro que já tinha sido
corrigido em um lugar e não foi propagado para os irmãos:

| achado | já tinha sido corrigido em |
|---|---|
| 2.6 (altura da Kill Zone) | mesma reclamação anterior; a correção mexeu só na CONTAGEM de ocorrências |
| 3.1 (drift de cor) | auditoria anterior parou no `DepthChartPlugin` e concluiu "só ele" |
| 3.3 (regressão por índice) | `lorentzian-classifier.js`, tasks #195/#196 ("espaçamento cronológico") |

**Isto, e não falta de recurso, é o que impede o sistema de fechar em 100%.** A
contramedida adotada nesta sessão é trava automatizada em vez de disciplina:
`canvas-palette.test.ts` mede matiz a cada rodada; `chart-time-ribbon-lanes.test.ts`
proíbe desenho de altura total; os testes do Achado 3.3 exigem resíduo zero em
série com buraco. Nenhuma dessas 3 classes volta por revisão manual esquecida.

**Recomendação de método:** ao corrigir qualquer motor, procurar os irmãos com a
mesma forma ANTES de fechar. Os 3 casos acima teriam sido pegos por um grep de
5 minutos.

---

## 6. O que continua faltando (honesto)

### Teto analítico real
**Validação histórica calibrada.** Hoje toda "confiança" do sistema é massa de
opinião de um pool linear, e é honesto assim porque não existe backtest sobre
histórico real que sustente uma probabilidade. `structural-backtest.js` e a
captura de histórico já existem; fechar o laço é o que permitiria chamar um
número de probabilidade sem mentir. **É o maior item pendente do projeto.**

### Camada visual
- Heatmap do livro **no tempo** (assinatura do Bookmap). Dado já existe em
  `l2-history.ts`; falta motor + plugin.
- Colisão do eixo direito com os rótulos da GRADE NATIVA da lib (visível nas 2
  capturas do Operador). Nosso anti-colisão não conhece os rótulos que a
  própria `lightweight-charts` desenha.
- Paleta fora do gráfico (badges/widgets/telemetria do `App.tsx`) — o Achado
  3.1 cobriu só o canvas, e meia-migração é pior que nenhuma.

### Limite duro (não é pendência, é impossibilidade)
Detecção de iceberg/spoof na fidelidade do ATAS exige **Level 3 / market-by-order**
(log de ordens individuais). O feed público da Binance não expõe order IDs.
Registrado como inatingível com dado público, para nunca voltar como "a fazer".

### Backlog menor, já rastreado
#279 (tamanho de etiquetas), #283 (caixas de confluência → overlay lateral),
#294/#295 (import/export CSV + journal), #340 (Andrews Pitchfork), #342 (ATR%).

---

# Segunda passada — pontas soltas (o Operador estava certo)

O Operador contestou a conclusão da §1 ("store limpa") dizendo que ainda havia
ponta solta. **Ele estava certo, e a falha era do método.**

## O buraco no método da primeira passada

A §1 mediu "campo referenciado em qualquer lugar fora da store". Isso **conflui
escrita com leitura**: um campo escrito por um setter aparece como
"referenciado" pelo próprio setter e escapa da detecção. É exatamente a classe
do achado #91 (affectiveMemory), que era escrito e nunca exibido.

Segunda passada separou **escritores** de **leitores**, e resolveu o segundo
ponto cego já registrado (campo lido só por `useXSnapshot`).

## Ponta solta 1 — `orderBooks`: fatia write-only

| | |
|---|---|
| **Escritores** | 3 — `App.tsx:3395`, `cross-exchange-service.ts:199` (BINANCE), `cross-exchange-service.ts:246` (MEXC) |
| **Leitores** | **0** |
| **Único seletor** | `useExchangeOrderBooks` (store:670) — **nunca importado em lugar nenhum** |
| **`consensus-radar.ts` usa?** | Não — não lê `orderBooks` nem faz fetch próprio |

O livro L2 de 3 exchanges é capturado e gravado na store a cada tick, e **nada
no sistema o lê**. Não é lixo: é dado real e valioso (comparação de livro entre
corretoras é justamente o que sustentaria o "Consenso Entre Corretoras"). É uma
feature construída até a metade — a captura existe, a superfície nunca foi feita.

**Decisão é do Operador, porque as 2 saídas são legítimas e opostas:**
- **Surfacing** — construir a leitura de consenso entre corretoras sobre esses
  dados (o motor de destino, `consensus-radar.ts`, existe e hoje não os usa).
- **Poda** — parar de escrever, removendo 3 chamadas e uma fatia da store.

Não decido isso sozinho: a Regra de Ouro 4 proíbe apagar dado real, e "surfacing"
é uma feature nova. Fica registrado como pendência **nomeada**, não como
"sistema limpo".

## Ponta solta 2 — `health.isOnline`: segundo campo para o mesmo fato

O sistema tem **dois** campos de conectividade:

| campo | escrito por | lido por | veredito |
|---|---|---|---|
| `offline` (topo) | `setOffline`, listeners de `window.online/offline` | `useOfflineSnapshot()` em `App.tsx:6180` | **Vivo e exibido** |
| `health.isOnline` | inicializado de `navigator.onLine` em `EMPTY_HEALTH` | **ninguém** | **Vestígio** |

Duas caixinhas para o mesmo fato, e só uma é usada. Não há divergência visível
hoje justamente porque a segunda nunca é lida — mas é precisamente o tipo de
duplicação que produz "dois lugares dizendo coisas diferentes" na primeira vez
que alguém ligar a segunda.

**Recomendação:** remover `isOnline` de `HealthSnapshot` e manter `offline` como
fonte única. Zero dado real perdido — `offline` carrega o mesmo fato e é o que
já aparece na tela. Não executado nesta rodada porque remover campo de store é
mudança de contrato, e a Regra de Ouro 4 pede confirmação do Operador.

## Placar corrigido da auditoria de store

| métrica | 1ª passada | 2ª passada (correta) |
|---|---|---|
| campos de estado analisados | 121 (incluía setters) | **67** (só estado) |
| dado morto real | "0" | **2** (`orderBooks`, `health.isOnline`) |
| seletores exportados | não medido | 48 |
| seletores nunca importados | não medido | **14** (candidatos a poda; `useExchangeOrderBooks` é um deles e confirma a ponta solta 1) |

## Lição de método (a terceira desta sessão)

As três falhas de auditoria desta sessão têm a MESMA forma: **a medição parecia
rigorosa e tinha um ponto cego que a fazia devolver "está limpo".**

1. grep por nome cru → campo lido por seletor parecia morto (falso positivo)
2. "referenciado em qualquer lugar" → campo write-only parecia vivo (falso negativo, **o pior dos dois**)
3. auditoria de cor anterior → mediu só entre famílias, não dentro delas

Um "está tudo limpo" só vale acompanhado do método e do seu ponto cego declarado.
Esta seção existe para que a próxima auditoria comece já sabendo dos três.

---

# 3ª passada — execução das duas pontas soltas

Ordem do Operador (autorização explícita, textual): *"Pode habilitar tudo que
tem de ser habilitado principalmente das corretora das fontes de dados todas
pra ficar 100 por cento sincronizados nada pendente... o que você achar
adiciona achasse se remove."*

Isso resolve as duas decisões que a 2ª passada deixou nomeadas e **não**
executadas. As duas saídas foram opostas de propósito: uma ponta era feature
pela metade (habilitar), a outra era duplicação (remover).

## Ponta solta 1 — RESOLVIDA POR SURFACING

`nexus/cross-exchange-book.ts` (motor puro novo) + `tests/cross-exchange-book.test.ts`
(17 testes de execução real) + card **LIVRO ENTRE PRAÇAS · EXECUÇÃO** no widget
Validação Multi-Camada.

O que o motor mede sobre o livro L2 que já era capturado:

| leitura | por que só existe cruzando praças |
|---|---|
| melhor bid / melhor ask **entre** corretoras | quem opera numa praça precisa saber se outra tem preço melhor — é a diferença entre executar no topo do livro e atrás dele |
| **spread consolidado** (melhor ask − melhor bid, cruzando praças) | se fica **negativo**, existe desalinhamento real entre praças; impossível de enxergar olhando uma corretora só |
| desvio de cada mid contra a **mediana** das praças | mediana e não média: uma praça com feed travado não arrasta a referência (mesmo cuidado do Achado 3.3) |

Fail-closed real (Regra de Ouro 3): praça sem livro, sem um dos lados, com
preço/tamanho não finito, ou com snapshot mais velho que
`CROSS_EXCHANGE_MAX_BOOK_AGE_MS` (15s) é **excluída**, nunca preenchida com
zero. Menos de `CROSS_EXCHANGE_MIN_VENUES` (2) praças válidas ⇒
`DADOS_INSUFICIENTES` com a razão real na tela — comparar um livro de 30s atrás
com um de agora produziria um "desalinhamento" que é só atraso, não mercado.

LEI 24: display only. O card é rotulado **EXECUÇÃO** e fica **fora** da contagem
de confluência (`checks[]`), que é sobre direção — este dado é sobre *onde*
executar, nunca sobre *o quê*.

**Nada da captura foi tocado** (Regra de Ouro 4): os 3 escritores continuam
gravando exatamente como antes. A entrega é a metade que faltava.

### Erro cometido e corrigido dentro desta própria entrega

A primeira versão do wiring exportou `describeCrossExchangeBook()` e mostrou na
UI apenas uma linha binária `Livro Entre Praças (3) ✓ REAL` — a frase honesta do
motor **não tinha consumidor nenhum**. Era a mesma ponta solta que esta entrega
veio fechar, uma camada acima. Corrigido para o card completo, e o teste
`cross-exchange-book-wiring.test.ts` passou a travar exatamente isso ("a frase
honesta do motor chega à tela"). Registro aqui porque o padrão é o assunto do
documento: **a metade cara é fácil de construir; a metade que aparece é a que
some.**

## Ponta solta 2 — RESOLVIDA POR REMOÇÃO

`health.isOnline` removido de `nexus/types.ts`, `nexus/health-monitor.ts` (a
escrita) e `store/unified-snapshot-store.ts` (`EMPTY_HEALTH`), mais 6 fixtures de
teste. `offline` fica como fonte única — é o campo que os listeners reais de
`window.online/offline` alimentam e que `useOfflineSnapshot()` exibe.

Zero dado real perdido: o fato ("estamos online?") continua na store, num campo
só, o que já era o único lido. O comentário em `types.ts` guarda o porquê, e o
teste em `nexus-health-monitor.test.ts` trava a decisão com regex
(`\bisOnline\s*\??\s*:`) nos 3 arquivos — se alguém reintroduzir o campo
duplicado, a suíte quebra em vez de deixar passar.

## Placar depois da 3ª passada

| métrica | 2ª passada | agora |
|---|---|---|
| dado morto real | 2 | **0** |
| seletores nunca importados | 14 | **13** (`useExchangeOrderBooks` saiu da lista — tem leitor real) |
| campos de estado | 67 | 67 (nenhum adicionado: a leitura é derivada, não uma 2ª cópia) |

## O que continua pendente, honestamente

- **13 seletores exportados sem importador.** Candidatos a poda, não dado morto:
  são funções de leitura, não estado capturado e descartado. Precisa da mesma
  separação escritor/leitor aplicada campo a campo antes de remover qualquer um.
- **Heatmap de livro ao longo do tempo** (estilo Bookmap) — o dado já existe em
  `l2-history.ts`. É construir, não habilitar.
- **Validação histórica calibrada** — o teto analítico real deste repositório, e
  a única coisa que tornaria honesto falar em "probabilidade" (Regra de Ouro 2).
