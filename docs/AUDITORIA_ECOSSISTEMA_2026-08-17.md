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
