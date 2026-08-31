# AR10 — Auditoria: "Arquitetura Central de Inteligência" (MarketBrain)

> **Pedido:** documento do Operador "AR10 — ARQUITETURA CENTRAL DE
> INTELIGÊNCIA — Sincronização Matemática, Probabilidade Calibrada e
> Reflexão Visual em Tempo Real" (11 seções, plano de 5 fases, ~11-15
> dias por estimativa do próprio documento).
> **Escopo desta auditoria:** confrontar cada seção com o que já existe
> real no código (Disciplina de trabalho, item 1 — "procure se já existe
> algo real e reaproveitável... nunca supor") e nomear o conflito com a
> LEI 24 antes de qualquer linha de implementação.
> **Método:** evidência real (`file:line`), zero suposição.
> **Por que uma auditoria e não a Fase 1 direto:** duas perguntas
> diretas sobre pontos que exigem julgamento do Operador (prioridade
> desenho-vs-voz; resolução LEI 24 do MarketBrain) ficaram sem resposta
> nesta sessão. Não fiz uma terceira pergunta — mas construir 5 fases de
> arquitetura por cima de uma ambiguidade constitucional não resolvida
> seria pior do que documentar o real estado e propor um primeiro corte
> pequeno e seguro.

---

## 1. O conflito real: LEI 24

O documento define, em `UnifiedMarketState.executive`:

```typescript
executive: {
  verdict: "COMPRA" | "VENDA" | "NEUTRO" | "DADOS_INSUFICIENTES";
  ...
}
```

...computado por um "Fusion Layer" que resolve conflitos entre Context,
Structure, Liquidity, Risk e Scenario (§2.1, §3). E em §5.3, durante
`TRANSITION`:

> "Trade Plan: **BLOQUEAR** novas entradas — Só permitir se usuário
> confirmar manual."

Isso é, textualmente, uma segunda emissão de decisão e um bloqueio da
operação por uma camada que não é o Core Engine — exatamente o que a
LEI 24 deste repositório proíbe:

> `nexus/decision-layer.ts:10` — "O QUE ISTO NUNCA É (LEI 24,
> inegociável): um segundo emissor de decisão."
> `CLAUDE.md` (LEI 24) — "Nenhuma camada de análise/confluência... pode
> gerar uma segunda decisão de trading **ou bloquear/alterar** a decisão
> do Core Engine."

A LEI 24 já tem exatamente **um** precedente de exceção neste repositório
— Entrega 42 (Profitability Engine), e ela só existe porque foi pedida
**explicitamente pelo Operador via `AskUserQuestion`** ("Authorize full
suppression as specified"), com critério objetivo documentado (amostra
mínima de 30 trades) e escopo estritamente limitado a um componente de
apresentação.

Perguntei o equivalente para o MarketBrain (informativo/passthrough vs.
nova exceção escopada) e a pergunta ficou sem resposta. Sem essa
autorização, o único caminho que não exige uma exceção nova é o padrão
já usado em **6 módulos diferentes** deste mesmo repositório:

| Módulo | Papel | Como resolve "parece decisão" |
|---|---|---|
| `nexus/decision-layer.ts` (v4) | Contrato único Operação+Confiança+Entry+Stop+TP1-3 | `operation` é passthrough literal do Core Engine — zero voto próprio |
| `nexus/nexus-line.ts:131` `nexusConfluenceVerdict` | VWAP × Nexus Line × Decision Layer | "informado, nunca acionado" — `ALINHADA`/`CONFLITO_ESTRUTURAL`, exibido, nunca altera nada |
| `nexus/confluence-corridor.ts` | Corredor de Confluência | "Display-only (LEI 24 / Lei Permanente 1): nunca gera, altera ou bloqueia" |
| `nexus/confluence-engine.ts` | Evidence Fusion | mesma hierarquia inviolável citada no header |
| `nexus/council.ts` | Conselho Multi-Agente | mesma hierarquia — ABSTAIN nunca vira bloqueio do Núcleo |
| `nexus/aura-lifecycle.ts` | Aura de convicção | "leitura própria, nunca decide nada" |

**Decisão aplicada nesta auditoria (default, não uma escolha nova
minha):** sigo esse padrão de 6 módulos. Se este código evoluir para
"MarketBrain" de fato, `executive.verdict` só pode existir como
passthrough do Core Engine (igual a `decision-layer.ts`), e `TRANSITION`
só pode virar aviso visual — nunca bloqueio real de Trade Plan/entrada.
Isso não é uma limitação minha inventando meio-termo: é literalmente o
único caminho que este repositório já autorizou sem pedir uma exceção
nova ao Operador. Se a intenção real for a "nova exceção escopada" (§5.3
bloquear de verdade), isso precisa vir do Operador do mesmo jeito que a
Entrega 42 veio — pedido explícito, critério objetivo, escopo nomeado.

---

## 2. Mapa de reaproveitamento real (seção do documento → o que já existe)

| Seção do documento | Já existe? | Onde | Gap real |
|---|---|---|---|
| §2 `UnifiedMarketState` (contrato único agregando motores) | **Sim, em espírito** | `nexus/decision-layer.ts` (v4) já é "CONTRATO ÚNICO que funde as leituras já existentes numa só resposta operacional" | `conflicts[]` estruturado (lista nomeada de divergências) não existe como array explícito — hoje cada par de motores que colide tem sua própria resolução pontual (ver §3 abaixo), não uma lista central |
| §3 Fusion Layer (resolver conflitos entre motores) | **Parcial — 1 par já resolvido** | `nexusConfluenceVerdict` (`nexus-line.ts:131`) resolve exatamente VWAP×NexusLine×Decision Layer, "informado nunca acionado" | Generalizar para os outros pares que o documento nomeia (§3.1: Regime×Structure, Liquidity×Trend, Risk×Confluência) não existe ainda — é o gap mais real e mais barato de fechar |
| §3.3 Peso dinâmico por regime | **Não existe** | — | Tabela de pesos por regime (`REGIME_WEIGHTS`) é genuinamente nova; hoje nenhum motor reduz seu próprio peso conforme o regime muda |
| §4 Probabilidade honesta (3 camadas) | **Sim, quase completo** | `nexus/expectancy.ts` (Entrega 42/44): `MIN_TRADES_FOR_VALID_EXPECTANCY = 30`, `computeExpectancy()` retorna `winRate`/`expectancyR`/`totalTrades` só quando a amostra é real — a MESMA regra de 3 camadas (estatística real / heurística / insuficiente) já é a política ativa de `risk-engine.js` desde a Entrega 44 | O que falta é só apresentação: separar visualmente as 3 camadas no painel (o documento pede isso em §4.3) — `ExpectancyCard` (Entrega 42) já existe mas não sei se hoje mistura as camadas na UI; não é matemática nova |
| §5 Detecção de mudança de tendência | **Parcial, já mais avançado do que o documento supõe** | `market-regime/regime-engine.js::classifyMarketRegime` já classifica `TENDENCIA_FORTE`/`TENDENCIA_MODERADA`/`CONSOLIDACAO`/`COMPRESSAO`/`BREAKOUT` via ADX real + Bollinger Bandwidth percentil (não é a nomenclatura TRENDING/RANGING/CHOPPY do documento, mas é a mesma ideia, com matemática real já testada); `market-regime/regime-history.js` já rastreia `transitions[]` com `{changed, startedAt}` | Os "hard/soft triggers" específicos do §5.1 (BOS contrário, sweep contrário, etc. com pesos somáveis) não existem como motor único — hoje BOS/CHoCH/Sweep são eventos separados, não uma pontuação agregada de "mudança de tendência". `TRANSITION` bloqueando Trade Plan (§5.3) é o ponto que colide com LEI 24 (§1 acima) |
| §6 Canvas como reflexo (CanvasCommand) | **Parcial, arquitetura diferente hoje** | `nexus/layer-relevance.ts` + `nexus/visual-budget.ts` já arbitram "o que aparece, com que ênfase" — um núcleo central de relevância já existe | O modelo de execução é diferente: hoje cada plugin de canvas (`ipad_runtime/ramber-ui/src/chart/*`) lê a store e desenha a si mesmo (canvas próprio, dirty-flag+rAF, ResizeObserver — arquitetura documentada no `CLAUDE.md`); o documento propõe um emissor central de `CanvasCommand` que os plugins consomem. Isso é uma mudança real de modelo de renderização, não um gap de dado — maior risco de performance/Main-Thread (Regra de Ouro 6) do documento inteiro, e territorialmente separado do resto |
| §7 Ciclo 200ms único | **Não existe como ciclo único; peças existem soltas** | Debounce/cooldown/priority de alerta e voz já existem (`nexus/alert-center.ts`, `nexus/voice-dispatcher.ts`, auditados nesta mesma sessão) | Consolidar tudo num "tick" de 200ms central não existe — hoje cada domínio recalcula por seus próprios `useMemo`/eventos de bus, não por um relógio único. Não é claro que um ciclo síncrono central seja uma melhoria (o modelo reativo atual evita recalcular o que não mudou) |
| §8 Anotações como evidência | **Não existe** | — | Trade Plan Visual (desenho do usuário) não realimenta nenhum motor hoje; é genuinamente novo, mas pequeno e de baixo risco quando chegar a vez |

**Resumo honesto:** das 8 seções técnicas (§2-§8, excluindo §1 problema e
§9-11 plano/regras/resumo), **5 já têm base real substancial** (decision-
layer, nexusConfluenceVerdict, expectancy.ts, regime-engine.js+regime-
history.js, layer-relevance.ts+visual-budget.ts) e **3 são genuinamente
novas** (pesos dinâmicos por regime, hard/soft trigger score de mudança
de tendência, anotações-como-evidência). O maior risco arquitetural real
não é matemática — é o modelo de renderização do canvas (§6) mudar de
"cada plugin lê a store e desenha" para "um emissor central manda
comandos", que é uma decisão de arquitetura separada e maior que merece
seu próprio escopo, não algo para embutir dentro desta entrega.

---

## 3. Proposta de Fase 1 real (pequena, seguindo o padrão já autorizado)

Em vez das 5 fases do documento de uma vez, o corte seguro e pequeno que
não precisa de nenhuma autorização nova é generalizar o único módulo que
já resolve exatamente este problema em miniatura (`nexusConfluenceVerdict`)
para os outros pares de conflito que o documento nomeia em §3.1:

- Regime (`classifyMarketRegime`) × Structure (`market-structure-engine.js`)
- Liquidity Sweep (`nexus/institutional-zones.ts` / sweep já detectado) × Trend direction
- Risk R:R (`risk-engine.js`) × Confluência (Council/`opinionMass`)

Puro, isolado (`nexus/conflict-detector.ts`), testado, **display-only**
igual aos 6 módulos da tabela do §1 — zero wiring em canvas/voz/alerta
nesta entrega, exatamente como `nexusConfluenceVerdict` nasceu antes de
virar `nexusConfluence` em App.tsx. Implementado logo abaixo.

## 4. O que fica explicitamente pendente de decisão do Operador

- **Resolução definitiva LEI 24** (§1): confirmar que passthrough/
  informativo é o caminho certo, ou pedir a exceção escopada nova (nos
  mesmos termos objetivos da Entrega 42) se `TRANSITION` bloquear
  entradas de verdade é intencional.
- **Modelo de renderização do canvas** (§6): manter "cada plugin desenha
  a si mesmo" (arquitetura atual, documentada no `CLAUDE.md`) ou migrar
  para "um emissor central de `CanvasCommand`" — mudança de Main Thread
  (Regra de Ouro 6) que merece sua própria iniciativa isolada, não uma
  sub-tarefa dentro de um documento de 11 seções.
- **Ciclo de 200ms único** (§7): vale a pena um relógio central, ou o
  modelo reativo atual (recalcula só o que mudou, via `useMemo`/bus) já
  cobre o mesmo objetivo sem o custo de um scheduler novo?
- Prioridade real desta frente (Central de Inteligência/MarketBrain) vs.
  a frente de ferramentas de desenho (documento anterior) — pergunta já
  feita duas vezes nesta sessão, ainda sem resposta.
