# Relatório — "Ordem Entrega 26: Lapidação Visual Final + Experiência Operacional"

## §0. Proveniência e escopo honesto

Quarta mensagem endereçada a "Agente 4" nesta sessão. Nenhum elemento
novo de suspeita (sem rodapé de interrupção fabricado, sem pedido de
bypass) — aplicada a mesma resolução já estabelecida e confirmada
explicitamente pelo Operador duas vezes: **conteúdo substantivo
autorizado, a persona "Agente 4" nunca adotada.**

**Sobreposição real com a Entrega 25, dita sem rodeio**: das 10
Prioridades desta Ordem, as Prioridades 1, 2, 5, 7, 9 e 10 repetem
frentes que a Entrega 25 auditou há poucas horas com evidência fresca
(paleta, sincronização, hierarquia, camadas do gráfico, coerência
visual) e concluiu já satisfeitas — reauditar as mesmas linhas sobre o
mesmo código produziria os mesmos resultados. Este relatório não repete
essa auditoria; referencia-a e concentra o trabalho no que é
genuinamente novo ou genuinamente pendente.

**O que mudou de verdade**: a Prioridade 4 desta Ordem diz, literalmente,
"Sem abrir gavetas. Sem procurar informações." Isso é *exatamente* a
lacuna que a Entrega 25 encontrou, documentou e deixou registrada no
backlog com um gatilho declarado: *"gatilho definitivo: uma captura de
tela real do Operador mostrando o problema em uso"*. Esta Ordem é esse
gatilho, por escrito e mais explícito que uma captura. Por isso a raiz
foi atacada nesta rodada, não adiada de novo.

---

## §1. Prioridade 4 — a lacuna real, agora fechada

### O problema (herdado da auditoria da Entrega 25)

As leituras consolidadas — regime, fluxo, risco, confluência — existiam,
eram reais e eram calculadas a cada ciclo, mas **só apareciam dentro das
gavetas fechadas por padrão** (`leftDrawerOpen`/`rightDrawerOpen =
useState(false)`, `App.tsx:774-775`). O Operador precisava abrir uma
gaveta e procurar para responder "tendência? risco? contexto?".

### O que foi implementado

`ContextReadStrip` — uma faixa nova na **linha 2 do cabeçalho**, a mesma
linha sempre visível onde o Trade Plan (`TradePlanTopStrip`) e S1/R1
(`StructureLevelsStrip`) já viviam. Quatro campos:

| Campo | Fonte REAL já existente | Onde só aparecia antes |
|---|---|---|
| REGIME | `engine.marketRegime` (regime-engine.js, ADX/DI) + o mesmo `REGIME_DISPLAY` do painel | Painel MARKET REGIME (gaveta) |
| FLUXO | sinal do CVD real, mesma regra do mesmo painel | Painel MARKET REGIME (gaveta) |
| RISCO | `deriveRiskState(nexusDecision)` (Operational Readability Layer) | Painel Trade Plan (aba) |
| CONFLUÊNCIA | `deriveConfluenceState(nexusDecision)` (idem) | Painel Trade Plan (aba) |

**Zero cálculo novo** — regra explícita desta Ordem ("não recalcular
dados na interface"). Os 4 campos são leitura de valores que os motores
já produzem; travado por teste (`not.toMatch(/Math\.(sqrt|pow|log)|reduce\(/)`
dentro do bloco do componente).

**Zero redundância** — as Prioridades 1/9 desta mesma Ordem pedem reduzir
ruído, então direção LONG/SHORT (já no `CoreSignalBadge`) e percentual de
confluência institucional (já no badge de score) foram deliberadamente
**deixados de fora**: já são sempre visíveis na linha 1. Travado por
teste.

**Zero sistema visual novo** — reusa o `BarField` que as 2 faixas irmãs
já usam (atende a Prioridade 5: "tudo deve parecer parte do mesmo
organismo"), nunca um chip/painel próprio. Travado por teste.

**Fail-closed campo a campo** — cada campo só existe quando seu valor
real existe; sem nenhum dos quatro, a faixa inteira some (altura zero),
nunca uma fileira de traços fabricados.

### Verificação ao vivo (e uma correção do meu próprio método)

Playwright real contra o dev server, iPad Air (1180×820) e iPad Mini
portrait (768×1024), **gavetas fechadas**:

- **RISCO = ELEVADO** e **CONFLUÊNCIA = INSUFICIENTE** renderizados a
  `top: 46px`, `insideViewport: true`, `closest('.terminal-left,
  .terminal-right') === null` — ou seja, comprovadamente **fora de
  qualquer gaveta**, na barra sempre visível. Confirmado também na
  captura de tela.
- **REGIME e FLUXO não renderizaram** — e isto é o comportamento
  **correto**, não um defeito: nesta sandbox a rede de saída bloqueia os
  WebSockets reais da Binance, então não existem candles → não existe
  `marketRegime` nem CVD real. O fail-closed funcionou exatamente como
  desenhado (o campo some em vez de inventar "regime desconhecido").
- `hOverflow: 0` nas duas resoluções — a faixa nova não quebrou o
  layout.

**Correção de método, registrada honestamente**: minha primeira sonda
usava `document.body.innerText.includes(...)` e reportou os 4 rótulos
como presentes. Isso era **falso positivo** — as gavetas fechadas usam
`transform: translateX(±110%)`, que tira o elemento da tela mas **não**
o remove de `innerText`. A sonda estava lendo os rótulos homônimos dos
painéis dentro das gavetas. Refiz a verificação por geometria
(`getBoundingClientRect`) + ancestralidade (`closest`), que é o que
sustenta os números acima. O resultado real (2 campos ao vivo, 2
corretamente ausentes) é mais fraco que o primeiro relatado — e é o que
vale.

---

## §2. Prioridade 8 — narrativa refinada com contexto real

A "LEITURA CONSOLIDADA" da Entrega 25 cobria viés/estrutura/timing/
confluência/risco. O exemplo desta Ordem abre com contexto de mercado
("Mercado em tendência de alta. Liquidez acima da média."), que faltava.

`buildNarrativeSummary(decision, context?)` ganhou um segundo parâmetro
**opcional**: `{ regimeLabel, flow }`. Mesmo precedente já estabelecido
por `EvidenceFusionSourceGroup.relevance` — o valor chega **pronto do
chamador**, o módulo nunca o calcula (o `NarrativeSummaryCard` lê o
mesmo `REGIME_DISPLAY` e o mesmo sinal de CVD que o painel MARKET REGIME
já usa; zero segundo vocabulário, zero segundo cálculo).

Fail-closed preservado e testado: omitir o parâmetro e passá-lo vazio
produzem **exatamente a mesma string** (asserção literal no teste); um
contexto real nunca sobrescreve as frases honestas de ausência
(`decision` null / `INSUFFICIENT_DATA`).

Leitura resultante, com contexto real disponível:
> "Mercado com viés de alta. Regime de mercado: Tendência Forte ALTA.
> Pressão de fluxo compradora. Estrutura real mapeada e entrada
> confirmada agora. …"

---

## §3. Prioridade 6 — um achado real de animação

Auditoria das 19 ocorrências de `animate-pulse`/`animate-spin`/
`animate-ping` em `App.tsx`. **18 são condicionais a um estado real** e
portanto informam algo (ponto de conexão ao vivo, microfone falando,
anel de ciclo em andamento, alerta ativo) — todas mantidas.

**1 era ruído puro**: o botão "Sincronizar Agora" (`App.tsx`, canto
direito da barra) pulsava **permanentemente**, independente de qualquer
estado, no canto mais estável da interface — movimento constante
carregando zero informação, exatamente o que a Prioridade 6 pede para
eliminar ("movimentos desnecessários... quase imperceptíveis").
Removido; `hover`/`active` continuam dando o feedback de interação, e
nenhuma informação foi perdida.

---

## §4. Prioridades 1, 2, 5, 7, 9, 10 — já auditadas, referenciadas

Detalhe completo em `docs/historico/RELATORIO_LAPIDACAO_SINCRONIA_EXPERIENCIA.md`
(Entrega 25), sobre o mesmo código que segue no `HEAD`:

| Prioridade desta Ordem | Onde já foi auditada | Resultado |
|---|---|---|
| 1 e 9 (limpeza/auditoria de camadas do gráfico) | Entrega 25 §4 | `visual-budget.ts` + `layer-relevance.ts` já cobrem BOS/CHOCH, FVG/OB, Liquidez/Sweep, Trade Plan — reduzem ênfase, nunca escondem (piso `VISUAL_BUDGET_FLOOR_WEIGHT`) |
| 2 (hierarquia visual) | Entrega 25 §3 | Achado real documentado; **atacado nesta rodada** pela Prioridade 4 acima |
| 5 (sincronização entre painéis) | Entrega 25 §1/§2 | Store única + React garantem sincronia; `BarField` reusado nesta rodada mantém a linguagem visual única |
| 7 (cores/contraste) | Entrega 25 §1 | 1 tom de verde, 1 de vermelho, 2 de âmbar (o 2º documentado como intencional) |
| 10 (experiência premium) | — | Consequência das demais; nada fabricado para "mostrar algo" |

**Prioridade 3 (Trade Plan mais legível) — não implementada, com motivo
honesto**: Entry/Stop/TP1-3/R:R já são sempre visíveis na linha 2
(`TradePlanTopStrip`). Os campos adicionais que a Ordem lista —
"distância até o alvo", "percentual", "ATR restante" — **não existem
como valor calculado hoje**; produzi-los seria criar cálculo novo na
interface, que a própria Ordem proíbe duas vezes ("Tudo sem criar novos
cálculos" / "Não recalcular dados na interface"). Fica registrado no
backlog: se o Operador quiser esses três campos, o caminho honesto é um
motor puro derivá-los (com testes), não a UI computá-los inline.

---

## §5. Testes executados

- `tsc --noEmit` limpo.
- `vitest run`: **136 arquivos / 2308 testes (100%)**, +12 novos
  (4 de contexto real na narrativa + 8 de fiação da faixa sempre
  visível). 1 asserção minha foi **corrigida durante a verificação**:
  eu havia escrito um teste que confundia posição no arquivo com
  aninhamento de JSX (a barra de comando é *definida* depois das
  gavetas, mas não está *dentro* delas) — reescrito para checar
  containment real do bloco das gavetas, que é a garantia que importa.
- `npm run build`: 1850 módulos, **893,77 kB** (+3,99 kB vs. Entrega 25
  — evidência objetiva do código novo).
- Playwright real: 2 resoluções, gavetas fechadas, geometria +
  ancestralidade (ver §1), `hOverflow: 0`, captura de tela anexa ao
  raciocínio.

## Resultado

A pendência de hierarquia que a Entrega 25 deixou explicitamente
registrada no backlog está **fechada**: o Operador agora lê regime,
fluxo, risco e confluência sem abrir gaveta nenhuma. A narrativa ganhou
o contexto de mercado que o exemplo da Ordem pedia. Uma animação
puramente decorativa saiu. Nenhum motor novo, nenhum contrato novo,
nenhuma decisão nova — LEI 24 intacta, `core-engine-boundary` e
`core-decision-rules` passando entre os 2308.
