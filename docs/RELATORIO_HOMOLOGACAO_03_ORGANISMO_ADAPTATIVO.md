# RELATÓRIO — HOMOLOGAÇÃO DA ORDEM Nº 03 E PRÓXIMA EVOLUÇÃO

## Organismo Inteligente Adaptativo

**Status:** Ordem Nº 03 homologada conforme o próprio texto do Operador
confirma. Esta rodada entrega o primeiro passo real e verificável da
"próxima evolução" — auditoria completa, uma peça real de "contexto
operacional", e a reorganização (não exclusão) da administração de
modos — com o restante honestamente escopado para rodadas futuras.

---

## §0. Interpretação — o que é vocabulário real e o que é visão

A diretriz descreve o "Organismo Inteligente Adaptativo" por 6
dimensões que devem se ajustar sozinhas: prioridade visual, intensidade
dos elementos, quantidade de informações exibidas, frequência de
atualização, relevância dos motores, contexto operacional. E pede,
antes de qualquer implementação nova, uma auditoria real classificando
cada módulo em 4 categorias.

Investigação (§1) confirma que "Modo Automático / Modo Operador / Modo
Inteligente / Configurações manuais redundantes" **não é retórica** —
mapeia byte a byte para código real: os 4 botões de preset do painel
"Camadas do Gráfico" (`ChartLayersPanel`, `App.tsx:3741`) —
`applyChartLayerPreset("automatic"|"operational"|"intelligence"|"audit")`
— mais o toggle individual em cada uma das 21 camadas. Isso muda a
natureza da tarefa: não é preciso inventar um conceito novo de "modo",
só decidir o que fazer com um que já existe.

Das 6 dimensões, a auditoria (§1) mostra que **4 já são reais** (prioridade
visual e intensidade: `visual-budget.ts`, graduado na Ordem Nº 03;
quantidade de informação: `layer-relevance.ts` decide show/hide por
camada; relevância dos motores: o próprio `layer-relevance.ts` é
exatamente isso) — só precisavam ser reconhecidas/consolidadas como tal,
não construídas do zero. Uma (**contexto operacional**) tinha uma lacuna
real e concreta — fechada nesta rodada (§2). Uma (**frequência de
atualização**) é uma dimensão genuinamente nova, sem equivalente hoje, e
fica deliberadamente fora do escopo desta rodada (§4) — motivo técnico
específico, não negligência.

Quanto a "substituir... por..." os 4 modos: o texto da diretriz pede a
troca literal. CLAUDE.md, Regra de Ouro 4, é igualmente claro: "nunca
apagar dado real ou funcionalidade — só realocar/reorganizar quando
necessário". As duas instruções tensionam de verdade aqui — resolução
aplicada e justificada por extenso em §3: **reorganizar, não apagar**.

---

## §1. Auditoria consolidada — status real por categoria

Construída sobre a varredura de importadores reais já feita na Ordem
Nº 03 (reconfirmada, sem mudança de veredito onde não houve mudança de
código):

| Categoria | Módulos/áreas reais |
|---|---|
| **(1) Já integrado** | A esmagadora maioria de `nexus/*.ts` (49 de 52 arquivos); os 12 plugins de canvas; `visual-budget.ts` (graduado na Ordem Nº 03); `layer-relevance.ts` (agora com `marketRegime`, §2). |
| **(2) Ainda isolado** | `engine-signal-contract.ts`, `cross-exchange-service.ts` — sem mudança de código desde a Ordem Nº 03, reconfirmados abaixo (§4). |
| **(3) Com justificativa técnica** | O laboratório de backtest (`structural-backtest.js`/`history-capture.js`/`compare-runs.js`) — isolamento TESTADO como fronteira LEI 24, não uma peça esquecida (mesmo achado da Ordem Nº 03, reconfirmado). |
| **(4) Pode ser consolidado** | Os 4 presets do `ChartLayersPanel` — identificado nesta rodada como o alvo real e concreto de "Modo Automático/Operador/Inteligente/Configurações manuais redundantes". Resolvido em §3. |

Nenhum módulo mudou de categoria por conta desta auditoria isolada —
as mudanças reais desta rodada (§2/§3) é que criam movimento entre
categorias (contexto operacional passa a existir; os presets manuais
saem da posição "administrada pelo operador todo dia" para "disponível,
mas secundária").

---

## §2. Implementado — Market Regime como "contexto operacional" real

**O que**: `LayerRelevanceInput` ganha `marketRegime: string | null` —
o MESMO rótulo já calculado a cada ciclo por `regime-engine.js` (Wilder
ADX/DI + percentil de largura de banda de Bollinger:
`TENDENCIA_FORTE`/`TENDENCIA_MODERADA`/`CONSOLIDACAO`/`COMPRESSAO`/
`BREAKOUT`), já em uso por Risk Engine/Confluência/Radar em outros
pontos de `App.tsx` — zero segundo cálculo, só um novo consumidor do
mesmo dado real (`engine?.marketRegime?.regime`).

**Onde**: `trend_channel` (a camada mais naturalmente ligada a regime de
mercado). Duas justificativas REAIS e independentes agora tornam o
canal relevante — nunca a mesma pergunta duas vezes: banda estreita
(`trendChannelBandwidthPct`) é COMPRESSÃO (coiled, rompimento
pendente); regime `TENDENCIA_FORTE`/`BREAKOUT` é MOMENTUM já confirmado
por ADX/DI (o canal pode estar largo, expandindo COM a tendência).
`BREAKOUT` sozinho já basta para o extremo do highlight (o rótulo mais
acionável do motor); `TENDENCIA_FORTE` sozinho confirma relevância mas
não o extremo.

**Bug evitado durante a implementação**: a linha original usava
`input.trendChannelBandwidthPct!` (non-null assertion) — segura quando
só bandwidth decidia relevância, mas `null <= N` avalia `true` em
JavaScript (null vira 0 na comparação). Como agora `trendChannelRelevant`
também pode ser `true` só pelo regime (bandwidth ainda `null`), a
asserção mentiria para o TypeScript e acenderia highlight por coerção
de tipo, não por dado real. Corrigido com checagem explícita de
null antes de qualquer comparação — travado por teste dedicado
("nunca usa `!` não-nulo... banda null com regime confirmado não pode
virar highlight por coerção null->0").

**Testes**: 9 novos em `layer-relevance.test.ts` (execução real — os 5
rótulos de regime, ambas justificativas isoladas e combinadas, o piso
do highlight, a regressão de coerção null->0) + 1 novo em
`nucleo-gravitacional-fusion.test.ts` (fiação real: `App.tsx` alimenta
`marketRegime` com o valor real, sem segundo cálculo).

---

## §3. Implementado — reorganização do painel "Camadas do Gráfico"

**A tensão real, nomeada sem rodeio**: a diretriz pede a substituição
literal dos 4 modos. Regra de Ouro 4 proíbe apagar funcionalidade real,
oferecendo "realocar/reorganizar" como a alternativa correta quando a
exclusão total não é estritamente necessária. Este não é um caso de
regra de segurança inegociável (como Regra de Ouro 2/LEI 24, onde só
existe recusar) — é uma decisão real de produto, e apagar 3 presets +
o toggle fino por camada é irreversível-de-confiança (se o Operador
precisar de volta amanhã, teve que pedir de novo) numa área onde este
agente não tem como validar com uso real se o adaptativo sozinho já
basta em todo cenário.

**Resolução aplicada**: reorganizar, nunca apagar.

1. **"AR10 CYBORG · Estado Inteligente Adaptativo"** (o preset
   `automatic` já existente, agora com esse nome de exibição) vira a
   ÚNICA ação primária sempre visível no topo do painel — botão
   destacado, com subtítulo real de status ("ativo agora — leitura
   pronta, sem modo pra administrar" quando já é o estado corrente).
2. Os 3 presets manuais (Modo Operacional/Modo Inteligência/Modo
   Auditoria) continuam existindo **por inteiro, byte a byte** — mesmos
   `onClick`, mesma lógica em `applyChartLayerPreset` (zero linha
   removida da função) — só reposicionados dentro de uma seção
   "Predefinições manuais (avançado)", recolhida por padrão
   (`useState(false)`, estado puramente local do painel, nunca
   persistido entre sessões).
3. O toggle individual por camada (21 camadas, `toggleChartLayer`/
   `resetChartLayerToAuto`) fica **fora** da seção recolhida, sempre
   visível — decisão deliberada: um ajuste fino numa camada específica
   não é "administrar um modo", é uma correção pontual que o Operador
   pode querer mesmo confiando no adaptativo para tudo o mais.

**Por que isso cumpre o espírito real da diretriz**: no dia a dia — a
experiência que "o operador não deve administrar modos" describe — o
painel agora mostra UMA ação (já ativa por padrão desde sempre,
`DEFAULT_CHART_LAYER_AUTO_MODE` = todas as 21 camadas automáticas) e
nada mais, a menos que o Operador escolha abrir o avançado. Nenhuma
capacidade real foi perdida; a hierarquia visual mudou de fato
(confirmado por captura real de tela abaixo).

**Verificação visual real (Playwright, dev server local)**: painel
recolhido mostra só o botão primário + a linha de disclosure; clique
real no disclosure expande e revela os 3 presets reais intactos, com
seus estilos/estados de "ativo" preservados. Duas capturas de tela
confirmam ambos os estados.

**Testes**: 4 novos em `chart-layers-panel-wiring.test.ts` — trava as
DUAS metades da promessa: nada foi apagado (os 3 `onClick` reais
continuam no arquivo) E a hierarquia mudou de verdade (Automático fora
do bloco condicional; toggle individual também fora, categoricamente
diferente de "modo").

---

## §4. Deliberadamente NÃO tentado nesta rodada, com justificativa

- **Frequência de atualização adaptativa**: nenhum código real ajusta
  cadência de WS/REST hoje — construir isso tocaria o pipeline de dados
  do Core Engine (`market-data-bus`, `engine-bridge.ts`), o mesmo
  "caminho mais crítico do app" que a Ordem Nº 03 já identificou para o
  gap de Market Structure. Mesma disciplina (Regra de Ouro 6): merece
  sua própria iniciativa isolada, não bundlada com o resto desta rodada.
- **"Quantidade de informações exibidas" como um dial explícito**: hoje
  é binário por camada (`relevant` true/false via `layer-relevance.ts`)
  mais o orçamento cruzado (`visual-budget.ts`). Um "dial" contínuo de
  densidade de informação (ex.: "mostrar só as 3 camadas mais fortes
  agora") seria uma peça nova real, não uma reorganização — não
  construída sem escopo mais claro do que "quantidade" deveria
  significar operacionalmente.
- **`engine-signal-contract.ts` / `cross-exchange-service.ts`**:
  reconfirmados isolados com o MESMO motivo técnico da Ordem Nº 03 (nada
  mudou no código desde então que altere o veredito) — ver tabela §1.
- **Aplicar `marketRegime` a outras camadas além de `trend_channel`**:
  Premium/Discount é o próximo candidato natural (ICT: mais acionável em
  mercado em RANGE do que em tendência forte) — não feito nesta rodada
  para manter o escopo de "contexto operacional" pequeno e bem
  verificado numa única camada primeiro, em vez de redesenhar várias
  regras de relevância de uma vez.

---

## §5. O que permaneceu pendente e o motivo técnico

Nenhum item novo além do já registrado na Ordem Nº 03 (Market Structure
em `analysis-frame.js`, MACD como 8º voto do Council) — inalterado,
sem retrabalho.

---

## §6. Sugestões para a próxima evolução

1. **Estender `marketRegime` a Premium/Discount** — mesma disciplina
   desta rodada (uma camada de cada vez, testada isoladamente).
2. **Frequência de atualização, como sua própria iniciativa isolada**
   (Regra de Ouro 6) — decidir primeiro O QUE adapta (intervalo de
   poll? prioridade de reconexão?) antes de tocar o pipeline real.
3. Itens já válidos da Ordem Nº 03 (correção de Market Structure em
   `analysis-frame.js`, graduação das 5 categorias restantes de
   `visual-budget.ts`, Evidence Fusion Engine de escopo mínimo)
   continuam de pé.

---

## Verificação final

- `tsc --noEmit`: limpo.
- `vitest run`: **128 arquivos / 2179 testes (100%)** — 2165 antes desta
  rodada + 14 novos (9 em `layer-relevance.test.ts`, 1 em
  `nucleo-gravitacional-fusion.test.ts`, 4 em
  `chart-layers-panel-wiring.test.ts`).
- `npm run build`: ok — 1846 módulos (sem mudança — nenhum arquivo novo
  criado, só edições), bundle principal 876,24 kB (+1,38 kB sobre a
  Ordem Nº 03, coerente com a JSX/lógica nova adicionada).
- Playwright: executado contra o dev server real. Painel "Camadas do
  Gráfico" aberto de verdade (clique real no botão do rodapé) — captura
  confirma o botão primário "AR10 CYBORG · Estado Inteligente
  Adaptativo" e o disclosure recolhido; segundo clique real no
  disclosure confirma os 3 presets manuais intactos ao expandir. Mesma
  limitação de rede já documentada na Ordem Nº 03 (proxy do ambiente
  bloqueia WS da Binance) não afeta esta verificação — o painel é UI
  pura, independente de candle ao vivo.

## Critérios de homologação — veredito

| Critério | Veredito |
|---|---|
| Auditoria completa antes de implementar | Atendido (§1) — reconfirma a varredura da Ordem Nº 03 e localiza os "4 modos" no código real. |
| Contexto operacional real | Atendido (§2) — `marketRegime` real, zero segundo cálculo, bug de coerção de tipo evitado e travado por teste. |
| Operador não administra modos, na prática do dia a dia | Atendido (§3) — Automático é a única ação primária sempre visível; nada foi apagado (Regra de Ouro 4). |
| Toda evolução sai do laboratório com integração real + teste automatizado + teste funcional + validação visual | Atendido — 14 testes novos, Playwright real com 2 capturas de tela. |
| Não criar novos módulos isolados | Atendido — zero arquivo novo nesta rodada; tudo é extensão de módulos já reais e já integrados. |

**Veredito geral**: homologado dentro do escopo real que esta rodada
permite com segurança — uma dimensão real do "Organismo Inteligente
Adaptativo" (contexto operacional) fechada e testada, a administração
de modos reorganizada (não apagada, com o raciocínio da tensão real
documentado por extenso), e o restante (frequência de atualização,
dial de quantidade) honestamente escopado para iniciativas futuras
dedicadas.
