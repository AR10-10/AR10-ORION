# Relatório — "ORDEM OFICIAL — FASE DE LAPIDAÇÃO DE ELITE DO AR10 CYBORG" (EPC-05)

## §0. Proveniência e escopo honesto

Quinta mensagem endereçada a "Agente 4" nesta sessão (Carta Branca,
Entregas 24/25/26, agora esta). Nenhum elemento novo de suspeita — mesma
resolução já estabelecida e confirmada duas vezes pelo Operador: conteúdo
substantivo autorizado, a persona "Agente 4" nunca adotada.

**Sobreposição real, dita sem rodeio**: a lista "FONTES DE REFERÊNCIA"
desta Ordem (Bloomberg Terminal, Bookmap, ATAS, Sierra Chart, TensorCharts,
LuxAlgo…) é, quase palavra por palavra, a mesma lista da DIRETRIZ 6/7 da
Ordem imediatamente anterior (Round M/Entrega 27, `docs/
RELATORIO_LAPIDACAO_MATEMATICA.md`), que por sua vez já reconfirmava o que
as Entregas 25/26 tinham acabado de auditar com evidência fresca. Refazer
essa mesma pesquisa de plataformas pela 4ª vez não produziria achado novo
— por isso este relatório não a repete. O que esta Ordem pede de genuíno e
ainda não coberto é pesquisa de **microestrutura/HFT/Order Flow** aplicada
a um motor real específico que nenhuma rodada anterior tinha auditado
ainda: `src/orderflow/signal-engine.js`.

---

## §1. Auditoria do Order Flow Engine contra microestrutura real

`src/orderflow/signal-engine.js` é o motor real (porta byte-a-byte de
`golden-master.html`) por trás dos sinais **OFI**, **ABSORPTION** e
**EXHAUSTION** que alimentam o `OrderflowAgent` do Conselho, a
corroboração de stop-hunt em `trap-detection.ts`, e o feed visível "MEXC
ORDERFLOW" no canto do gráfico. Nunca tinha sido lido/auditado
formalmente nesta sessão.

### O achado real: nomenclatura de "OFI"

Pesquisa real (`WebSearch`) confirmou a definição formal de **Order Flow
Imbalance** na literatura de microestrutura (Cont, Kukanov & Stoikov,
*"The Price Impact of Order Book Events"*, 2010/2014, Journal of
Financial Econometrics): OFI é definido sobre **eventos do livro de
ofertas** — mudanças no tamanho da fila no melhor bid/ask — não sobre
trades executados. A pesquisa cita explicitamente que essa abordagem
"baseada na dinâmica do livro de ofertas se mostra superior a métricas
baseadas em volume de trade."

O que `signal-engine.js` calcula, sob o mesmo nome "OFI", é um
**desequilíbrio de volume agressor** (compra vs. venda) sobre uma janela
de 400 ticks de TRADE — uma métrica real, útil, e amplamente usada em
terminais de order flow (o que Bookmap/ATAS/Sierra Chart costumam chamar
de variantes de "Delta"/"Trade Imbalance"), mas **estruturalmente
diferente** do OFI acadêmico formal.

**Por que isso não vira um motor novo nem um rename arriscado**: este
projeto não tem — e não pode fabricar, Regra de Ouro 1 — uma fonte real
de L2/livro de ofertas (só o poller público de trades da MEXC,
`mexc-trades-stream.js`, documentado no próprio código como escolha
deliberada em vez de um WebSocket persistente). O OFI acadêmico é
honestamente impossível de calcular aqui. Renomear a string de tipo
`'OFI'` em runtime (`SignalType.OFI`) divergiria do vocabulário do próprio
`golden-master.html` (arquivo protegido, `label = 'OFI'` na linha 1140) —
risco desproporcional para uma imprecisão de nomenclatura, não um bug
funcional. A correção aplicada foi **documentação honesta**: o cabeçalho
do arquivo, `metadata.description`/`concepts`/`limitations` agora
declaram explicitamente a distinção — futuro leitor (humano ou sessão)
nunca confunde os dois conceitos.

### O achado real nº 2: zero cobertura de teste

Auditoria confirmou que `processSignals`/`createEngineState` — a
matemática real por trás de 3 sinais que alimentam decisão de confluência
— **nunca tiveram um teste de execução real** em toda a árvore
`ramber-ui/tests/`, apesar de já estarem em produção. Isso é exatamente o
tipo de lacuna que o próprio teste desta Ordem existe para achar ("Isso
aumenta a confiança da decisão?" — um motor testado é mais confiável que
um não testado).

**Novo arquivo**: `ramber-ui/tests/signal-engine.test.ts`, 15 testes de
execução real (convenção já estabelecida para lógica pura de fronteira):

- **CVD**: acumula corretamente através de múltiplas chamadas.
- **OFI**: dispara exatamente no tick que completa a janela real de 400,
  com a razão de desequilíbrio real; nunca dispara abaixo do limiar real
  de 0.6 nem abaixo do volume mínimo real de 100; respeita o cooldown
  real de 500ms; dispara de novo quando o cooldown realmente passou
  (`vi.useFakeTimers`/`setSystemTime`, mesma convenção de
  `nexus-health-monitor.test.ts`).
- **ABSORPTION**: dispara com volume alto + preço quase parado na janela
  real de 5s; nunca dispara se o preço se moveu além do limiar real de
  0.1%; nunca dispara se o volume ficou abaixo do mínimo real de 500.
- **EXHAUSTION**: dispara só quando os DOIS portões reais seguram ao
  mesmo tempo — z-score extremo (recorrência de delta) **e** reversão
  real de preço; não dispara só com o pico de delta, antes da reversão
  acontecer; nunca dispara numa série calma/plana.

**Achado colateral, documentado honestamente, não "corrigido" por
tentativa e erro**: `reversalConfirmation: 0.2` (produção) é comparado
direto contra um retorno fracionário bruto de preço nos últimos 10
ticks — ou seja, exige um movimento de **preço de 20% dentro de só 10
trades** para confirmar reversão. Não há dado real de estatística de tick
da MEXC neste sandbox para julgar se isso está calibrado ou foi herdado
sem ajuste do replay sintético de `golden-master.html`. Mudar o número
sem essa evidência seria exatamente "tentativa e erro" — que esta própria
Ordem proíbe ("Nunca por tentativa e erro"). Registrado como achado real
no código (`defaultSettings.exhaustion`) e no relatório; **não
alterado**.

### Efeito colateral positivo: gap de tipagem descoberto e fechado

Escrever o primeiro consumidor TypeScript real de `signal-engine.js`
expôs que `processSignals`'s `settings` e `Signal.metadata` nunca tinham
anotação JSDoc — o TS inferia tipos literais estreitos demais (ex.
`windowSize: 400` em vez de `number`) só porque nenhum consumidor tipado
existia antes. Corrigido com `@typedef`/`@param` reais em
`signal-engine.js` e `value-objects.js` — **zero mudança de
comportamento em runtime** (JSDoc é só anotação estática), benefício para
qualquer consumidor TS futuro deste motor.

**Disciplina de extensão aditiva** (`src/orderflow/` — CLAUDE.md: "só
recebe extensões aditivas, nunca vira um arquivo monolítico de novo"):
todas as mudanças nesta pasta protegida foram comentários/JSDoc/strings
de metadata — nenhuma linha de lógica de cálculo tocada, nenhum arquivo
reestruturado.

---

## §2. Visual/plataformas institucionais (DIRETRIZ deste Ordem)

Como registrado no §0, a lista de plataformas de referência desta Ordem
repete a mesma pesquisa já feita 3 vezes nas rodadas imediatamente
anteriores (Entregas 25, 26, Round M). Nenhuma auditoria nova foi
fabricada sobre o mesmo terreno. Verificação direta feita: o feed "MEXC
ORDERFLOW" (`App.tsx`, ~linha 7451-7478) que exibe os sinais agora
testados — confirmado fail-closed (`AWAIT SINAL REAL…` sem sinal),
densidade visual já mínima (badges de 0.42rem, sem redundância com outros
painéis), nenhuma mudança necessária.

---

## §3. Regras Absolutas — checklist

| Regra | Status |
|---|---|
| Não criar indicadores/motores novos | ✅ zero motor novo — só documentação + testes sobre motor já existente |
| Não aumentar complexidade | ✅ JSDoc é anotação estática; testes não mudam runtime |
| Não duplicar motores | ✅ zero segunda matemática de OFI/Absorption/Exhaustion |
| Não criar decisões paralelas | ✅ LEI 24 intacta — Order Flow continua confluência, nunca decisão |
| Não aumentar ruído visual | ✅ zero mudança de UI |
| Não reduzir performance | ✅ build byte-idêntico (893,78 kB) |
| Não comprometer Fail Closed/Read Only | ✅ intacto |

---

## §4. Testes executados

- `tsc --noEmit`: limpo (inclui a correção do gap de tipagem descoberto).
- `vitest run`: **137 arquivos / 2326 testes (100%)**, +15 novos
  (signal-engine.test.ts).
- `npm run build`: 1850 módulos, **893,78 kB** — byte-idêntico ao Round M
  anterior, confirmando zero mudança de comportamento de produção.
- `git diff --stat`: só os 2 arquivos de `src/orderflow/` (documentação/
  tipagem) + 1 arquivo de teste novo — zero drift em qualquer outro
  módulo.

## Resultado

Um motor real, já em produção, decision-adjacent, que nunca tinha sido
lido por esta sessão nem testado por ninguém — agora tem sua matemática
verificada por 15 testes de execução real, sua nomenclatura corrigida
honestamente contra a literatura formal de microestrutura (sem o risco de
um rename), e um achado de calibração genuíno registrado sem "tentativa e
erro". Zero motor novo, zero mudança visual, zero decisão paralela — LEI
24 e a disciplina aditiva de `src/orderflow/` intactas.
