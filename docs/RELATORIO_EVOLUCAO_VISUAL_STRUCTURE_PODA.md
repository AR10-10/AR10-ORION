# RELATÓRIO — Evolução Visual: STRUCTURE no Orçamento Visual + Poda Real

**Status:** executado — pedido informal do Operador ("foca na parte
visual pra ficar mais automático, menos etiqueta... o que você acha que
tem de melhorar... execute o necessário... liberdade pra achar a melhor
estratégia") interpretado como: (1) continuar a graduação de
`visual-budget.ts` (única peça já concretamente escopada para "menos
etiqueta, mais automático"), (2) avaliação honesta do lado de sistema,
(3) poda real e mecânica de código genuinamente morto.

---

## §0. Interpretação da mensagem

Mensagem recebida em português informal/ditado, com trechos ambíguos.
Reconstrução aplicada, comunicada ao Operador antes de agir: continuar
evoluindo, com foco na parte visual do gráfico para ficar mais
automática e mostrar menos etiquetas permanentes (mais "interno"),
avaliação honesta do que precisa melhorar (inclusive no lado de
sistema), e remover o que não é necessário para o sistema ficar mais
inteligente/preciso — com liberdade total de estratégia.

Nenhuma pergunta bloqueante foi necessária: a mensagem já autoriza
execução explicitamente. A reconstrução foi comunicada em texto antes
de qualquer mudança de código, para o Operador poder corrigir a
interpretação se necessário.

---

## §1. Avaliação honesta (resposta direta a "o que você acha que tem de melhorar")

**Lado visual**: o caminho mais concreto e já escopado é terminar a
graduação de `nexus/visual-budget.ts` (Diretriz Nº 02 → Ordem Nº 03) —
construído com 7 categorias de prioridade reais, mas só 2
(`INSTITUTIONAL_ZONE`/`TRADE_PLAN`) estavam realmente competindo por
orçamento visual. `STRUCTURE` (BOS/CHOCH) era a próxima mais óbvia — já
sugerida no próprio relatório da Ordem Nº 03 §6 — porque
`StructureBreakMarkersPlugin.tsx` já expunha um peso 0..1 real
(`ageAlpha(age, BREAK_DECAY)`), zero peso novo a inventar.

**Lado sistema**: minha recomendação honesta e mais forte é o **Evidence
Fusion Engine** — `engine-signal-contract.ts` existe há 4 rodadas (Ordem
Nº 01, Diretriz Nº 02, Ordem Nº 03, Homologação Nº 03) com um contrato de
10 campos pronto e testado, mas só 1 campo tem um motor real que o
preenche. É a peça que mais moveria o sistema em direção a "mais
inteligente" — só não foi construída nesta rodada porque é uma
iniciativa de arquitetura multi-motor genuína, não algo que cabe junto
de uma rodada de poda/graduação visual sem virar pressa.

**Poda real**: habilitar `noUnusedLocals`/`noUnusedParameters` no
`tsconfig.json` (diagnóstico temporário, depois mantido permanentemente)
revelou 8 declarações genuinamente mortas — pequeno, mas real, e um
achado honesto de que o "system" também tinha gordura real acumulada
ao longo de ~150 rodadas.

---

## §2. Implementado — STRUCTURE como 3ª categoria real de `visual-budget.ts`

Mesmo padrão exato das 2 categorias anteriores: `StructureBreakMarkersPlugin.tsx`
ganha prop `visualWeight?: number | null` com fallback fail-closed para
`ageAlpha(age, BREAK_DECAY)` isolado (comportamento anterior,
preservado). `EnhancedChart_110_Percent.tsx` monta o candidato real
(`structureBreakBaseWeight`, mesma fórmula EXATA já usada pelo rótulo
BOS/CHOCH em `priceAxisLabels` — zero segunda curva de decaimento) e
alimenta `resolveVisualBudget` junto das 2 categorias já graduadas.

Agora, quando um rompimento estrutural recente compete pelo mesmo
orçamento visual que Zonas Institucionais/Trade Plan, ele participa da
mesma resolução de prioridade real — em vez de sempre desenhar na
opacidade da sua própria idade, isolado das outras categorias.

**Testes**: 6 novos em `tests/visual-budget-chart-wiring.test.ts`
(mesmo arquivo das 2 graduações anteriores — fiação real da prop, do
fallback, e da fórmula honesta de `structureBreakBaseWeight`).

---

## §3. Poda real — 8 declarações mortas encontradas e corrigidas

Diagnóstico: `noUnusedLocals`/`noUnusedParameters` habilitados
temporariamente no `tsconfig.json`, `tsc --noEmit` rodado, cada achado
investigado individualmente antes de qualquer remoção (nenhum removido
às cegas — 2 casos exigiram entender a HISTÓRIA do código antes de
decidir o que fazer):

| Arquivo | Achado | Causa raiz real | Correção |
|---|---|---|---|
| `App.tsx:198` | `NEXUS_PLAN_GAP_LABEL` importado, nunca lido | Relocado para `operational-readability.ts` numa rodada anterior (o próprio módulo já importa direto de `decision-layer.ts`) — App.tsx manteve uma cópia vestigial do import | Removido do import; teste que travava a linha antiga (`refinamento-final-wiring.test.ts`) atualizado para a forma real atual |
| `App.tsx:5210` | `bootAt` desestruturado em `TopBar`, nunca lido | Fica no estado/contexto real (usado só como valor de contexto, sem NENHUM consumidor real hoje) — `TopBar` especificamente nunca precisou dele | Removido só da desestruturação de `TopBar`; o estado/contexto em si não foi tocado (ver §5) |
| `EnhancedChart_110_Percent.tsx:1861` | `target` não lido dentro de um `.forEach` | Só `i` (índice) é usado no corpo do loop | Renomeado para `_target` (convenção padrão TS para "intencionalmente não usado") |
| `nexus/council.ts:362` | `POOL_DIRECTION_TO_STANCE`, nunca lido | Mapeamento direto ALTA/BAIXA/NEUTRO→LONG/SHORT/NEUTRAL — substituído por `councilStanceWithHysteresis` (histerese de 2 bandas, documentada extensamente logo abaixo) numa evolução anterior; a tabela antiga nunca foi removida | Removida por inteiro — comportamento real do Council é 100% do `councilStanceWithHysteresis`, confirmado pelos testes existentes intactos |
| `tests/chart-layers-panel-wiring.test.ts:450` | helper `app` nunca chamado | Testes do describe já usavam `const a = read(...)` direto | Helper removido |
| `tests/history-capture.test.ts:133` | `endTime` desestruturado, nunca lido | O teste (`maxPages nunca vira laço sem fim`) só precisa da CONTAGEM de chamadas, nunca do valor de `endTime` | `endTime` removido da assinatura do mock |
| `tests/refinamento-final-wiring.test.ts:327` | `const a = app()`, nunca lido | O teste usa só `read('.../operational-readability.ts')` | Linha removida |
| `tests/wolfe-eta-range.test.ts:4` | `MIN_FIT_SCORE` importado, nunca lido | Import não utilizado | Removido do import |

**Decisão de manter o diagnóstico permanentemente**: `noUnusedLocals`/
`noUnusedParameters` ficam ligados no `tsconfig.json` daqui pra frente —
custo zero em runtime, e evita que esta MESMA classe de achado (import/
variável esquecida depois de uma relocação ou substituição) se acumule
de novo silenciosamente ao longo de futuras rodadas. É uma melhoria
real e permanente de precisão do processo, não só uma limpeza pontual.

---

## §4. O que NÃO foi tocado, e por quê

- **`bootAt` em si** (o `useState`/entrada no contexto) — só a
  desestruturação morta em `TopBar` foi removida. O valor continua
  computado e disponível no contexto para quem eventualmente quiser
  (ex.: um indicador futuro de "conectado há X"); removê-lo por inteiro
  seria uma decisão de produto maior (matar uma capacidade em vez de só
  podar um uso morto), fora do escopo de uma poda mecânica.
- **Evidence Fusion Engine** — recomendado em §1 como a maior alavanca
  real do lado de sistema, deliberadamente não construído: é uma
  iniciativa de arquitetura própria (múltiplos motores), não uma poda ou
  graduação incremental.
- **Frequência de atualização adaptativa / Market Structure em
  `analysis-frame.js`** — pendências já registradas (Ordem Nº 03,
  Homologação Nº 03), sem mudança nesta rodada.
- **As 3 categorias restantes de `visual-budget.ts`** (`TARGET`,
  `INVALIDATION`, `RADAR`, `MAIN_LIQUIDITY`) — cada uma precisa de sua
  própria fonte de peso real identificada (nem todas têm um `ageAlpha`-
  like já pronto como `STRUCTURE` tinha); não forçadas nesta rodada.

---

## Verificação final

- `tsc --noEmit` (com `noUnusedLocals`/`noUnusedParameters` agora
  permanentes): limpo, zero achados.
- `vitest run`: **128 arquivos / 2185 testes (100%)** — 2179 antes desta
  rodada + 6 novos.
- `npm run build`: ok — 1846 módulos (sem mudança — zero arquivo novo),
  876,67 kB (variação desprezível).
- Playwright: executado contra o dev server real. App carrega sem
  regressão estrutural (zero erro de React, mesma limitação de rede já
  documentada em rodadas anteriores impede ver o gráfico com dado ao
  vivo nesta sessão).

## Critérios de homologação — veredito

| Critério | Veredito |
|---|---|
| Continuar a evolução visual (menos etiqueta, mais automático) | Atendido — 3ª categoria real de `visual-budget.ts` graduada (STRUCTURE), mesma disciplina das 2 anteriores. |
| Avaliação honesta do que precisa melhorar | Respondida em §1, com recomendação concreta (Evidence Fusion Engine) e justificativa de por que não foi construída agora. |
| Remover o que não é necessário | 8 declarações mortas reais, cada uma investigada individualmente (não removida às cegas), 2 delas revelando história real de refatoração (`NEXUS_PLAN_GAP_LABEL` relocado, `POOL_DIRECTION_TO_STANCE` substituído pela histerese). |
| Ficar mais inteligente/preciso | `noUnusedLocals`/`noUnusedParameters` permanentes — melhoria estrutural de precisão do processo, não só desta rodada. |

**Veredito geral**: escopo real e proporcional para uma rodada iniciada
por um pedido informal — uma peça visual concreta graduada, uma
avaliação honesta entregue, poda real e verificada, zero funcionalidade
real perdida.
