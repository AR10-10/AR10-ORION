# RELATÓRIO — DIRETRIZ Nº 02

## Camada de Inteligência Visual (Visual Intelligence Layer)

**Status:** executada dentro de um escopo real e seguro (ver §0) — um
motor isolado e testado, não a inversão arquitetural completa que a
Diretriz descreve.

---

## §0. Interpretação da Diretriz — o que é desta etapa e o que fica para depois

A Diretriz Nº 02 é, pelo seu próprio conteúdo, a Ordem que a Ordem Nº 01
prometeu ("será iniciada a implementação da Arquitetura Mestre... o
gráfico inteligente"). Ao contrário da Ordem Nº 01, porém, o texto desta
Diretriz **não contém, em si, uma cláusula própria de escopo** — ela
descreve o pipeline final desejado (`Mercado → Aquisição de Dados →
Motores Especializados → Knowledge Graph → Evidence Fusion Engine →
Quality Governor → Meta Engine → Core Engine → Visual Intelligence Layer
→ Gráfico`) e o princípio "nenhum módulo poderá desenhar diretamente no
gráfico" como o alvo final, sem marcar explicitamente uma parte como
"próxima rodada".

Isso não torna a inversão completa segura de tentar numa única rodada.
Pelo contrário: é exatamente o cenário em que a disciplina de trabalho
deste projeto (CLAUDE.md, "Laboratório de Evolução: isolar antes de
integrar") e o princípio de proporcionalidade de risco (blast radius)
precisam substituir uma cláusula de escopo que a própria Diretriz não
escreveu. Interpretação aplicada, e por quê:

1. **Dois conflitos diretos com regras inegociáveis do projeto** (§1
   abaixo) precisam de resolução ANTES de qualquer código — não são
   detalhe de implementação, são pontos onde o texto literal da Diretriz
   pede algo que o CLAUDE.md proíbe. Resolvido por substituição honesta,
   seguindo o mesmo padrão já usado nesta sessão para casos idênticos
   (Corredor de Probabilidade → Corredor de Confluência; Camada de
   Cenários → confiança qualitativa em vez de percentual arbitrário).
2. **A inversão completa do gráfico** (12 plugins de canvas independentes
   — cada um lendo um motor real e desenhando direto, testado e estável
   desde o início do projeto — colapsados numa única "Camada de
   Inteligência Visual" central que decide o quê/quando/quanto tempo
   mostrar para TODOS eles) é uma mudança de arquitetura de alto risco e
   baixa reversibilidade: toca os 12 plugins, o `EnhancedChart_110_
   Percent.tsx` inteiro, e todo o sistema de camadas (`layer-relevance.ts`,
   `CHART_LAYER_IDS`, `ChartLayersPanel`). Tentar isso de uma vez, sem uma
   especificação de contrato "Knowledge Graph"/"Evidence Fusion Engine"
   ainda inexistente no código, é a "implementação apressada" que este
   projeto sempre evitou (ver Ordem Nº 01 §0, mesmo raciocínio aplicado
   à sua própria inversão de escopo maior).
3. **O que É real e seguro fazer agora**: implementar, isolado e testado
   (Laboratório de Evolução), a única seção da Diretriz que já é
   suficientemente concreta para ter uma matemática própria, sem exigir
   nenhuma peça arquitetural ainda inexistente — a seção "BUDGET VISUAL"
   (prioridade de 7 níveis: Trade Plan > Zona Institucional > Alvos >
   Invalidação > Radar > Liquidez Principal > Estrutura). Esse motor
   nasce sem nenhuma ligação com `App.tsx`/o gráfico, exatamente como
   todo motor novo deste projeto nasceu (`scenario-engine.ts`,
   `institutional-zones.ts`, `layer-relevance.ts` — todos começaram
   isolados e só foram ligados ao vivo depois de suas suítes provarem o
   comportamento).
4. Cada seção da Diretriz é endereçada explicitamente abaixo — nenhuma
   fica sem resposta, mesmo quando a resposta é "avaliada, deliberadamente
   não construída ainda, e por quê" (§3/§4).

---

## §1. Dois conflitos diretos com regras inegociáveis — resolução

### 1.1 "Probability Score" (ex.: "87% de probabilidade de reteste") vs. Regra de Ouro 2

A Diretriz pede, na seção PROBABILIDADE, um "Probability Score" com o
exemplo literal "Existe 87% de probabilidade de reteste nesta região."

CLAUDE.md, Regra de Ouro 2, é explícito e não-negociável: *"'Confiança'/
'força' nunca é 'probabilidade'... nunca uma probabilidade calibrada de
acerto de mercado, porque este repositório não tem histórico de
backtest real que sustente essa afirmação honestamente."* Este
repositório tem, sim, um backtest real (`structural-backtest.js` +
`signal-track-record.ts`, ver §3) — mas ele mede a taxa de acerto
histórica real de planos já formados, não gera uma probabilidade
calibrada de eventos futuros específicos como "reteste desta região
específica". Fabricar um número como "87%" sem essa calibração real
seria precisamente o dado sintético disfarçado de leitura real que a
Regra de Ouro 1 e 3 também proíbem (fail-closed: sem dado real
suficiente, o motor devolve `null`/rótulo qualitativo, nunca um número
inventado).

**Resolução aplicada** (mesmo padrão já usado nesta sessão para o
Corredor de Confluência e para a Camada de Cenários Inteligentes): onde
a Diretriz pede um "Probability Score" percentual, a resposta honesta é
uma **métrica real de confluência/força**, nunca uma probabilidade
calibrada. Nada nesta rodada introduz um número de probabilidade novo —
`visual-budget.ts` (§2) trabalha inteiramente com `baseWeight` (peso de
confluência real, 0..1), nunca com uma probabilidade.

### 1.2 Ordenação "Meta Engine → Core Engine" vs. LEI 24

O diagrama de pipeline da Diretriz lista `Meta Engine → Core Engine`
nessa ordem, o que — lido literalmente como fluxo de decisão — sugeriria
que uma camada de fusão alimenta ou precede o Core Engine.

LEI 24 (CLAUDE.md) é igualmente não-negociável: *"O Core Engine é o único
emissor real de LONG/SHORT/WAIT... Nenhuma camada de análise/confluência
... pode gerar uma segunda decisão de trading ou bloquear/alterar a
decisão do Core Engine."*

**Resolução aplicada**: a ordem de um diagrama de camadas VISUAIS não
implica ordem de autoridade de DECISÃO. O precedente real já existe no
próprio código — `decision-layer.ts` (linha 11, comentário original do
módulo): *"`operation` é PASSTHROUGH literal da direção do Core Engine —
o único emissor real de LONG/SHORT/WAIT do sistema. Este módulo não
pondera, não vota, não bloqueia e não altera nada."* Qualquer "Meta
Engine"/camada de fusão futura segue exatamente essa mesma regra: pode
ler o resultado do Core Engine e adicionar contexto/confluência
visual — nunca o contrário. Nada nesta rodada implementa um Meta Engine;
quando um for construído (§6), este é o contrato que ele herda, sem
exceção.

---

## §2. O que foi implementado — `nexus/visual-budget.ts`

Novo motor puro, isolado (`ipad_runtime/ramber-ui/src/nexus/visual-
budget.ts`), implementando literalmente a seção "BUDGET VISUAL" da
Diretriz:

- `VISUAL_BUDGET_PRIORITY_ORDER`: os 7 níveis reais declarados pela
  própria Diretriz, na ordem exata — `TRADE_PLAN > INSTITUTIONAL_ZONE >
  TARGET > INVALIDATION > RADAR > MAIN_LIQUIDITY > STRUCTURE`.
- `resolveVisualBudget(candidates, budget?)`: função determinística e
  pura — candidatos reais (`id`, `category`, `baseWeight` 0..1 já
  calculado por outro motor) entram, cada um sai com um `visualWeight`
  final e uma flag `reduced`. Ordena por prioridade declarada, depois por
  `baseWeight` real dentro da mesma categoria; distribui o "orçamento"
  (`DEFAULT_VISUAL_BUDGET = 4`, convenção documentada) em ordem de
  prioridade; quando o orçamento se esgota, reduz peso — nunca abaixo de
  `VISUAL_BUDGET_FLOOR_WEIGHT = 0.35`.

**A reinterpretação central, documentada no próprio cabeçalho do
arquivo**: a Diretriz pede que "o sistema deverá esconder automaticamente
os elementos menos importantes". Regra de Ouro 4 (CLAUDE.md) proíbe
apagar dado real ou funcionalidade. Este motor nunca esconde — ele
**reduz ênfase visual, nunca abaixo de um piso honesto**. Um objeto que
perde a disputa pelo orçamento continua real e visível, só menos
enfatizado. Isso é aditivo sobre `layer-relevance.ts`, que já decide
`relevant` (mostra/não mostra a CAMADA inteira) e `emphasis` (`"normal"`/
`"highlight"`) — cada camada isoladamente. `visual-budget.ts` é a peça
SEGUINTE: resolve competição CRUZADA entre objetos JÁ relevantes, quando
muitos competem por destaque ao mesmo tempo (ex.: 3 Zonas Institucionais
+ um Trade Plan ativo + 2 alvos do Radar, todos "relevantes" ao mesmo
tempo — qual ganha ênfase plena?).

**Isolamento real, não apenas declarado**: `visual-budget.ts` não é
importado por nenhum módulo vivo (`App.tsx`, `EnhancedChart_110_
Percent.tsx`, nenhum plugin de canvas) — só pelo seu próprio teste. Prova
objetiva: o `npm run build` desta rodada produziu exatamente os mesmos
**1845 módulos transformados** e o mesmo bundle principal (**873,37 kB**)
de antes desta rodada — se o motor estivesse ligado a qualquer caminho
vivo, o número teria mudado (foi exatamente assim que a rodada anterior
provou que `stage-runner.ts` tinha ganhado seu primeiro consumidor real:
1844 → 1845). Aqui o número ficou parado de propósito.

**Testes**: `tests/visual-budget.test.ts`, execução real (convenção deste
repo para matemática nova de fronteira) — 13 testes cobrindo: a ordem
exata dos 7 níveis; peso pleno quando cabe no orçamento; lista vazia;
competição cruzada entre categorias (prioridade mais alta sempre vence);
independência da ordem de entrada; competição dentro da mesma categoria
(maior `baseWeight` vence); piso nunca violado (incluindo orçamento
zero/negativo, uso indevido); `baseWeight` zero honesto nunca inflado até
o piso; grampeamento de `baseWeight` fora de `[0,1]`; passthrough de
identidade (`id`/`category`); e o valor-padrão `DEFAULT_VISUAL_BUDGET`.

Três casos de teste foram corrigidos durante a verificação desta rodada
(erro do próprio teste, não do motor): usavam `baseWeight` acima de 1
(2, 3, 10) esperando que o valor bruto sobrevivesse à competição — mas o
contrato do módulo (documentado no próprio `VisualBudgetCandidate`,
"Peso real já existente... (0..1)") grampeia `baseWeight` para `[0,1]`
ANTES de qualquer competição, por design (mesma disciplina testada
separadamente no bloco "grampeado a [0,1]"). Os três casos foram
reescritos com entradas dentro do contrato real (`baseWeight` em
`[0,1]`, orçamento ajustado para realmente gerar competição) — nenhuma
mudança no motor em si.

---

## §3. Inventário honesto — o que já serve esta visão, antes desta rodada

A Diretriz descreve uma visão ambiciosa; auditoria antes de construir
(CLAUDE.md, Disciplina de trabalho item 1) confirma que boa parte da
visão **já existe**, em peças reais e testadas, mesmo sem o nome "Visual
Intelligence Layer":

| Seção da Diretriz | Já existe hoje |
|---|---|
| "O gráfico não calcula" | Já majoritariamente verdadeiro — os 12+ plugins de canvas (`InstitutionalZonePlugin`, `LiquidityZonesPlugin`, `StructureBreakMarkersPlugin`, etc.) recebem valores JÁ computados por motores reais como props e fazem só geometria de pixel (posição, cor, layout) — não rodam análise própria. Auditoria exaustiva plugin-a-plugin não foi refeita nesta rodada (seria o primeiro passo real de uma graduação futura, §6). |
| "Menos elementos" / budget visual | `layer-relevance.ts` (show/hide + `emphasis` por camada) + `visual-budget.ts` (novo, §2 — competição cruzada entre objetos já relevantes). |
| Etiquetas | `canvas-label.ts` (tipografia/cantos unificados) + `price-label-stack.ts` (anti-colisão real do eixo, usado por 10+ famílias de rótulo, mais a migração de Zonas Institucionais desta mesma sessão). |
| Projeções | `scenario-engine.ts` — Cenário A/B, linhas de projeção discretas, confiança qualitativa (`describeScenarioConfidence`, nunca percentual arbitrário — Rodada "Smart Scenario Layer" desta mesma sessão). |
| Fusão (parcial) | `institutional-zones.ts` já consolida múltiplas ferramentas (EMA/VWAP/FVG/OB/Liquidez) que apontam a mesma região de preço numa única Zona Institucional — é uma fusão real, geométrica, só ainda não estendida a TODOS os tipos de evidência que uma Camada de Fusão completa cobriria. |
| Explainability | `title=` real em price lines (`scenario-engine.ts`: `describeScenarioReaction`), tooltip por candidato do Radar (rodada anterior, "§6 Radar: per-candidate justification"), e agora o botão de sincronização com status real (`ageLabelOf`). Nenhum destes é um "motor de explicação" central, mas todos já respondem "por quê" honestamente com dado real, não texto genérico. |
| Aprendizado | `signal-track-record.ts` + `structural-backtest.js` (`ipad_runtime/src/research/backtest/`) — taxa de acerto histórica REAL de planos formados, por `symbol:timeframe`, com proveniência. Não é um sistema de aprendizado ao vivo que ajusta pesos automaticamente, mas é uma métrica real, não fabricada. |

Nada acima foi modificado nesta rodada — é reconfirmação de inventário,
não trabalho novo (a única peça nova é `visual-budget.ts`, §2).

---

## §4. O que foi deliberadamente NÃO tentado, e por quê

- **Knowledge Graph** — nenhuma estrutura de grafo de conhecimento existe
  no repositório hoje. Construir um exige primeiro decidir seu schema
  (nós = quê? arestas = quê?) — decisão de arquitetura que a própria
  Diretriz não detalha o suficiente para implementar sem inventar
  unilateralmente. Risco de "código morto especulativo" se construído
  sem um consumidor real imediato.
- **Evidence Fusion Engine** (contrato de 10 campos já preparado em
  `engine-signal-contract.ts`, ver Ordem Nº 01 §7) — o contrato existe e
  está testado, mas continua sem motor de fusão real que o alimente ou
  consuma. Construir o motor de fusão em si, cruzando múltiplos motores
  independentes, é uma peça de alto blast-radius que merece sua própria
  rodada isolada (mesmo padrão de todo motor novo deste projeto).
- **Quality Governor** / **Lifecycle Manager** — não especificados o
  suficiente na Diretriz para implementar sem inventar contrato próprio;
  mencionados só nominalmente.
- **Inversão completa "nenhum módulo desenha diretamente"** — tocaria os
  12 plugins de canvas + `EnhancedChart_110_Percent.tsx` inteiro,
  simultaneamente. Alto blast-radius, baixíssima reversibilidade num
  único commit, e sem uma "Camada de Inteligência Visual" central ainda
  existente para migrar os plugins PARA. A ordem correta de execução
  (mesma disciplina de `visual-budget.ts` e de todo motor anterior deste
  projeto) é: motor central nasce isolado e provado primeiro → migração
  plugin-a-plugin depois, uma de cada vez, cada uma com sua própria
  verificação Playwright — nunca um "big bang" que arrisca os 12 plugins
  testados e estáveis de uma vez.
- **"Probability Score" literal** — recusado por conflito direto com
  Regra de Ouro 2 (§1.1); não há uma versão "light" disso a construir,
  é uma linha vermelha do projeto.
- **Meta Engine como peça de decisão** — recusado por conflito direto com
  LEI 24 (§1.2); um Meta Engine display-only, se construído no futuro,
  segue o contrato do §1.2 sem exceção.

---

## §5. O que permaneceu pendente e o motivo técnico

Nenhum item novo além dos já registrados em rodadas anteriores (Ordem
Nº 01 §6/§7) — esta rodada não resolveu nem tornou obsoleta nenhuma
pendência prévia:

- Cutover de `cross-exchange-service.ts`/`connection-manager.ts` — maior
  risco do projeto, adiamento deliberado, sem mudança.
- `engine-signal-contract.ts` sem consumidor — aguardando o Evidence
  Fusion Engine real (§4 acima), não esquecido.
- Regime-based direction do Radar para candidatos de fundo
  (`engine-bridge.ts:1138-1166`) e a Parte 5 de esconder sinais
  conflitantes — duas perguntas em aberto ao Operador, não respondidas
  em nenhuma rodada desde que foram registradas; nenhuma delas foi
  tocada nesta rodada.

---

## §6. Sugestões para a próxima evolução

1. **Graduar `visual-budget.ts`**: ligar ao vivo como uma segunda camada
   sobre `layer-relevance.ts` dentro de `EnhancedChart_110_Percent.tsx`
   — cada família de objeto (Zonas Institucionais, alvos do Trade Plan,
   candidatos do Radar) alimenta `resolveVisualBudget` com seu
   `baseWeight` real já existente (`confluenceWeight`, `distinctSourceCount`,
   1.0 para objetos binários), e `visualWeight`/`reduced` regula opacidade
   — nunca visibilidade — no desenho. Isso prova o motor com dado ao
   vivo antes de qualquer plugin ser reescrito.
2. **Evidence Fusion Engine, escopo mínimo real**: começar por UM
   consumidor concreto de `engine-signal-contract.ts` (ex.: só Zonas
   Institucionais + Cenários, as duas famílias que já produzem um peso
   0..1 real) antes de tentar cobrir todos os motores de uma vez.
3. **Auditoria plugin-a-plugin de "o gráfico não calcula"**: confirmar,
   um plugin de cada vez, que nenhum faz análise própria além de
   geometria de pixel — candidata natural para a rodada que efetivamente
   iniciar a migração para desenho centralizado.
4. Itens já registrados na Ordem Nº 01 (MACD como 8º voto do Council,
   última fonte de `institutional-zones.ts`) continuam válidos e
   inalterados.

---

## Verificação final

- `tsc --noEmit`: limpo.
- `vitest run`: **127 arquivos / 2149 testes (100%)** — 2136 antes desta
  rodada + 13 novos (`tests/visual-budget.test.ts`).
- `npm run build`: ok — **1845 módulos transformados, bundle principal
  873,37 kB** — idênticos à rodada anterior, confirmando objetivamente
  que `visual-budget.ts` está isolado (zero consumidor vivo), como o
  próprio cabeçalho do arquivo declara.
- Playwright: não executado nesta rodada — não há nenhuma superfície
  visual nova para verificar (o motor não está ligado a nenhum
  componente renderizado); seria verificação fabricada testar uma tela
  que não mudou.

## Critérios de homologação — veredito

| Critério | Veredito |
|---|---|
| Conflitos com regras inegociáveis resolvidos | Atendido — Probability Score e ordenação Meta/Core Engine resolvidos por substituição honesta (§1), sem exceção às regras. |
| Peça concreta da Diretriz implementada | Atendido — `visual-budget.ts`, seção "BUDGET VISUAL", isolado e testado (§2). |
| Inversão arquitetural completa | Não tentada nesta rodada — declinada com justificativa explícita de risco/reversibilidade (§0, §4), não esquecida nem ignorada. |
| Inventário honesto do que já existe | Atendido (§3) — nenhuma duplicação nova introduzida. |
| Zero regressão | Atendido — 2149/2149 testes, build idêntico em módulos/bytes. |
| Documentação atualizada | Este relatório + `docs/SYSTEM_HANDBOOK.md` (mesmo commit). |
| Pendências sem justificativa | Nenhuma — toda pendência em §5 tem motivo técnico real, e §6 propõe o caminho concreto de evolução. |

**Veredito geral**: esta etapa está homologada **dentro do escopo real
que a disciplina deste projeto permite para uma única rodada** — dois
conflitos de regra resolvidos honestamente, uma peça matemática real e
concretamente especificada pela Diretriz construída, isolada e provada
por teste, e um caminho explícito e sequenciado (§6) para as partes
maiores (Fusão, Knowledge Graph, inversão do gráfico) que a própria
Diretriz descreve mas que nenhuma rodada seria capaz de entregar com
segurança de uma só vez sem arriscar os 12 plugins de canvas já
validados.
