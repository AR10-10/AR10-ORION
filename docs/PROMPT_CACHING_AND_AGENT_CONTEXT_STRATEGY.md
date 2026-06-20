# Prompt Caching e Agent Context Strategy — como um agente de IA deve estruturar o proprio contexto neste repositorio

Documento de design para qualquer agente de codigo de IA (incluindo o que
gerou boa parte deste repositorio) que trabalhe no AR10-ORION/AR10 Cyborg
2.0 em multiplas sessoes/missoes. Nao e documentacao de produto — e
documentacao de **como organizar prompts e contexto** para trabalhar
neste codigo de forma eficiente, segura e sem inventar memoria que o
agente nao tem de verdade.

## O que e Prompt Caching (conceito geral)

Prompt Caching e uma tecnica de infraestrutura de modelos de linguagem:
quando um prefixo **estavel e identico** de um prompt e reenviado em
varias chamadas seguidas, o provedor do modelo pode reaproveitar o
processamento desse prefixo em vez de reprocessa-lo do zero a cada
chamada. Na pratica isso reduz **latencia** (resposta mais rapida) e
**custo** (menos processamento repetido cobrado) quando uma sessao faz
multiplas chamadas que compartilham uma base de contexto comum — por
exemplo, instrucoes de sistema, regras de seguranca do produto, ou um
resumo estavel da arquitetura do repositorio que nao muda entre uma
chamada e a proxima.

Pontos centrais que valem para qualquer provedor que ofereca Prompt
Caching (este documento descreve o conceito de forma generica, nao
amarra a um fornecedor especifico):

- O cache so e reaproveitado se o prefixo enviado for **byte-a-byte
  identico** ao que foi cacheado antes — qualquer diferenca no inicio do
  prompt (mesmo um espaco, mesmo um timestamp) invalida o cache a partir
  daquele ponto.
- O cache tem uma **janela de validade (TTL)** — depois de expirar, a
  proxima chamada reprocessa o prefixo do zero (e tipicamente cria um
  cache novo, se o prefixo se repetir de novo).
- Cache e uma otimizacao de **desempenho/custo**, nao uma forma de
  "ensinar" o modelo algo novo — o conteudo cacheado e exatamente o
  mesmo conteudo que seria enviado sem cache, so que processado de forma
  mais eficiente na infraestrutura do provedor.

## Cache-Aware Prompt Architecture (ordenacao que importa)

Para se beneficiar de Prompt Caching, um prompt precisa ser organizado
com o **conteudo estavel primeiro** e o **conteudo dinamico por ultimo**.
Isso e o oposto de como muita gente escreve prompt por instinto (colocar
a pergunta/tarefa atual no topo) — aqui a ordem certa e invertida de
proposito:

```
[ ESTAVEL — muda raramente, fica na frente, maximiza acerto de cache ]
[ ESTAVEL — muda raramente, fica na frente, maximiza acerto de cache ]
[ ESTAVEL — muda raramente, fica na frente, maximiza acerto de cache ]
[ ESTAVEL — muda raramente, fica na frente, maximiza acerto de cache ]
[ DINAMICO — muda a cada tarefa, fica no fim, nunca quebra o prefixo acima ]
```

Por que essa ordem e nao a intuitiva ("a tarefa de hoje primeiro"): o
acerto de cache exige que o **prefixo** do prompt seja identico entre
chamadas. Se o conteudo que muda a cada chamada (a missao do dia, a
evidencia coletada agora, o pedido de correcao especifico) estiver no
**inicio** do prompt, todo o resto do prompt que vem depois dele tambem
muda de posicao relativa e o cache nunca acerta — mesmo que o conteudo
"estavel" em si nao tenha mudado nem uma linha. Colocando o dinamico
**sempre no fim**, o prefixo estavel permanece byte-a-byte identico entre
chamadas, e e exatamente esse prefixo que o cache consegue reaproveitar.

## Os blocos deste repositorio (nomes vinculantes)

Para o AR10-ORION/AR10 Cyborg 2.0, o contexto de um agente de codigo deve
ser organizado nestes cinco blocos, nesta ordem exata — os quatro
primeiros sao o prefixo estavel (candidato a cache); o quinto e sempre o
conteudo dinamico, sempre por ultimo.

### Stable Block 01 — Project Identity

O que e este repositorio, em termos que raramente mudam:

- **AR10 ORION** (raiz do monorepo, `src/`, `config/`, `data/`):
  organismo agentico autonomo com Cockpit UI "Ciborgue" para HFT
  cripto, servido por host local com Tunel Reverso para acesso global.
  Este bloco e referencia de identidade apenas — um agente trabalhando em
  `ipad_runtime/` nao deve editar nada sob `src/`, `config/` ou `data/`
  da raiz; sao produtos relacionados mas tecnicamente separados dentro do
  mesmo monorepo.
- **AR10 Cyborg 2.0** (sub-produto, `ipad_runtime/`): PWA iPad-first,
  codinome interno `AR10_CYBORG_2_IPAD_ONE_TAP_CLOUD_RUNTIME_V1`. Abre
  direto no Safari do iPad via HTTPS, sem depender de Mac Mini, MacBook,
  servidor local, terminal ou ZIP como fluxo principal.
- Este e o tipo de fato que **raramente muda** entre sessoes — a
  identidade do produto, nao o que esta sendo feito hoje. Por isso vive
  no bloco estavel, no topo do prompt.

### Stable Block 02 — Safety Laws

A lista de leis de seguranca vinculantes para todo o produto. Esta lista
e a mesma, palavra por palavra, em qualquer sessao, qualquer missao,
qualquer agente — e exatamente por isso que pertence ao bloco mais
estavel do prompt:

```
READ_ONLY
FAIL_CLOSED
NO_REAL_TRADING
NO_ORDER_EXECUTION
NO_API_SECRET
NO_PRIVATE_KEYS
NO_MEXC_PRIVATE
NO_MT5_ORDER_SEND
NO_ORDER_BY_LLM
NO_ORDER_BY_VOICE
NO_SECRET_IN_LOCALSTORAGE
NO_FAKE_DATA
```

Estas leis ja aparecem espalhadas pelo codigo e pela documentacao deste
repositorio sob nomes equivalentes (ver `ipad_runtime/README.md` —
"O que continua bloqueado, por design, sem exceção"; ver
`ipad_runtime/configs/asset-universe.default.json` campo
`security_posture`; ver `docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md`
— frases bloqueadas por politica). `docs/READ_ONLY_MARKET_SAFETY.md` e o
indice consolidado e citavel destas mesmas 12 leis, lei por lei, com a
aplicacao real (arquivo e mecanismo) de cada uma — este bloco e o resumo
"sempre identico" que um agente deve carregar no prefixo estavel; aquele
documento e a referencia expandida para quando for preciso auditar onde,
de fato, cada lei e aplicada. Este bloco existe para consolidar a mesma
lista em um lugar unico, citavel verbatim em qualquer prompt, sem precisar
reescrever a politica de seguranca a cada missao. Nenhum agente
trabalhando neste repositorio deve gerar codigo, configuracao ou
documentacao que viole qualquer item desta lista — isso vale mesmo para
documentacao puramente descritiva, como os documentos que acompanham este
(`docs/STRATEGY_PLAYBOOK.md`, `docs/ANALYSIS_OUTPUT_CONTRACT.md`,
`docs/READ_ONLY_MARKET_SAFETY.md`, e este proprio arquivo).

### Stable Block 03 — Runtime Architecture

Visao de alto nivel da arquitetura tecnica, tambem estavel entre
sessoes:

- **iPad Safari PWA**: instalacao via Adicionar a Tela de Inicio, sem
  loja de apps, `manifest.webmanifest` + `service-worker.js`
  cache-first/offline-first.
- **Motor quant WASM**: `wasm/cyborg_quant_core.wasm`, compilado de Rust
  (`wasm-src/cyborg_quant_core/`), exporta apenas estatistica descritiva
  (`sma`, `ema`, `stddev`, `zscore_last`, `max_val`, `min_val`) — nenhuma
  funcao de ordem ou execucao existe no binario.
- **Siriform** (voz e avatar): camada de voz/UI implementada hoje
  (`js/voice.js`, `js/siriform.js`) sobre Web Speech API nativa, sem
  modelo de linguagem.
- **Meta Llama/WebLLM (rota futura)**: roadmap declarado (`status:
  FUTURE` em todo o manifesto), nao implementado nesta versao — ver
  `docs/META_LLAMA_WEBLLM_ROUTE.md` para a analise completa de
  viabilidade.

Este bloco muda com menos frequencia que uma missao individual, mas mais
frequencia que o Bloco 01 ou 02 — por exemplo, quando um novo modulo
real e adicionado a `ipad_runtime/js/` ou quando uma camada antes
`FUTURE` passa a `IMPLEMENTED`. Ainda assim, dentro de uma mesma missao
ou de um conjunto de missoes correlatas, este bloco permanece identico,
o que o qualifica para o prefixo estavel.

### Stable Block 04 — UI/UX Contract

Convencoes de interface que se repetem em todo o painel e raramente
mudam:

- **Fluxo de botoes existente**: Verificar Safari → Preparar Cyborg
  neste iPad → Baixar Pacote Local / Importar Pacote do Arquivos →
  Verificar SHA256 → Instalar no Safari Storage → Rodar Diagnostico
  Offline → Rodar Replay BTC/USDT → Adicionar a Tela de Inicio (ver
  `ipad_runtime/README.md`, secao "Como abrir no iPad").
- **Convencoes do painel de status**: cards sequenciais dentro da mesma
  pagina (`siriform-card` → `runtime-status-panel` →
  `feature-detect-panel` → `quant-engine-widget` → `ai-models-panel` →
  `replay-wrap` → `analysis-frame-panel` → `decision-frame-panel` →
  `vault-evidence-card` → `local-pack-manager`), sem rotas novas, sem SPA
  router.
- **Vocabulario `v-ok` / `v-fail` / `v-info`**: classes CSS de status em
  `ipad_runtime/css/ipad-runtime.css` — `v-ok` (verde, sucesso real
  verificado), `v-fail` (vermelho, falha real), `v-info` (ciano,
  informativo neutro), `v-pending` (neutro, aguardando verificacao).
  Qualquer novo campo de status que um agente adicionar a UI deve
  reusar este vocabulario, nunca inventar uma quarta cor/semantica sem
  necessidade.

Assim como o Bloco 03, este muda menos que uma missao individual mas
mais que a identidade do produto — relevante o suficiente para ficar no
prefixo estavel, desde que a sessao nao esteja literalmente mudando essas
convencoes.

### Dynamic Block — Current Mission / Evidence / Fix Request

Este e o **unico bloco que muda a cada tarefa**, e por isso e o unico
que vai **sempre por ultimo** em qualquer prompt. Conteudo tipico deste
bloco:

- A missao especifica desta sessao (ex.: "criar os tres documentos de
  design X, Y, Z").
- Evidencia coletada durante a investigacao desta missao (ex.: trechos
  de codigo lidos, resultado de comandos executados, arquivos
  encontrados).
- Pedidos de correcao especificos (ex.: "o JSON anterior nao validou,
  corrija a linha N").
- Qualquer dado que so existe porque esta tarefa especifica esta
  acontecendo agora — timestamps, IDs de sessao, caminhos de arquivo
  especificos do dia.

Nada deste bloco deve "subir" para os blocos estaveis (01-04) só porque
parece importante — a importancia de um fato nao e o criterio; o
criterio e **se o mesmo conteudo, byte-a-byte, vai se repetir em
chamadas futuras**. Se vai, ele pertence a um bloco estavel. Se nao
(porque e especifico desta missao), ele pertence ao bloco dinamico,
mesmo que seja "importante".

## Por que esta ordem importa para eficiencia de cache

Com os blocos 01-04 sempre na mesma ordem, sempre identicos
byte-a-byte entre chamadas de uma mesma sessao (ou entre sessoes
proximas que reusam o mesmo prefixo), o prefixo inteiro (Blocos 01-04)
se torna candidato a acerto de cache em toda chamada subsequente — só o
Bloco Dinamico no final precisa ser reprocessado do zero a cada vez.
Isso significa, na pratica: menos latencia por chamada (resposta mais
rapida) e menos custo de processamento repetido, sem perder nenhuma
informacao — o conteudo estavel continua sendo enviado e considerado
pelo modelo a cada chamada, so que de forma mais eficiente na
infraestrutura do provedor.

Quanto maiores e mais numerosos os Blocos 01-04 em relacao ao Bloco
Dinamico, maior o beneficio relativo de cache — porque uma fracao maior
do prompt total cai no prefixo reaproveitavel.

## O que quebra o cache (exemplo concreto)

Acerto de cache exige **prefixo identico**. Qualquer edicao dentro de um
bloco estavel invalida o cache a partir do **ponto exato da edicao em
diante** — nao so daquele bloco, mas de **todo o conteudo que vem depois
dele no prompt**, incluindo outros blocos estaveis que nem foram
tocados. Exemplo concreto com os blocos deste documento:

```
Bloco 01 (Identity)     — sem mudanca
Bloco 02 (Safety Laws)  — UMA PALAVRA EDITADA AQUI
Bloco 03 (Architecture) — sem mudanca
Bloco 04 (UI Contract)  — sem mudanca
Bloco Dinamico          — sempre muda, sempre sem cache de qualquer forma
```

Mesmo que so o Bloco 02 tenha sido editado, o cache se perde para o
Bloco 02 **e tambem** para os Blocos 03 e 04 — porque o prefixo "Bloco
01 + Bloco 02 editado" ja nao e identico a nenhum prefixo cacheado
anteriormente, e tudo que vem depois dessa diferenca conta como prefixo
novo, nunca visto, mesmo que o texto dos Blocos 03/04 em si nao tenha
mudado uma linha.

Consequencias praticas desse comportamento, para quem mantem os blocos
estaveis deste repositorio:

- **Editar blocos estaveis deve ser raro.** Cada edicao custa um
  acerto de cache perdido para tudo que vem depois dela no prompt, nao
  so para a linha editada.
- **Apendice (append-only) e preferivel a edicao no meio**, quando
  possivel. Adicionar um item novo ao final de uma lista estavel
  (ex.: uma nova lei de seguranca apendada ao fim do Bloco 02) preserva
  o prefixo anterior intacto e cacheavel; o cache so se perde a partir do
  ponto de insercao, nao antes dele.
- **Reordenar blocos estaveis tem o mesmo custo que editar conteudo.**
  Trocar a ordem dos Blocos 03 e 04, por exemplo, invalida o cache de
  ambos e de tudo depois, mesmo que nenhuma palavra individual tenha
  mudado — porque o prefixo (a sequencia de bytes) e diferente.
- **O Bloco Dinamico nunca tem cache "salvo" de uma missao para a
  proxima**, e isso e esperado e correto — ele e dinamico por
  definicao. O ganho de cache vem inteiramente dos Blocos 01-04 ficarem
  estaveis por cima dele.

## Por que segredos NUNCA podem ir em contexto cacheado/prompted

Esta e uma regra de seguranca, nao so de boa pratica de prompt. Conteudo
de prompt cacheado **persiste no lado do provedor por uma janela de TTL**
— ou seja, depois que um prompt contendo um segredo e enviado, esse
segredo pode continuar armazenado na infraestrutura do provedor por um
periodo apos a chamada, fora do controle direto de quem enviou o prompt.
Isso vale para qualquer segredo: `MEXC_API_KEY`/`MEXC_API_SECRET`,
`MT5_PASSWORD`, `INGEST_TOKEN`, `CLOUD_DB_TOKEN`, ou qualquer chave
privada — os mesmos campos que `README.md` da raiz do monorepo descreve
como vivendo em `config/encrypted_credentials.env` com permissao `0600`
e "nunca sobe para o GitHub".

Consequencias diretas para como um agente deve montar contexto neste
repositorio:

- Nenhum dos quatro blocos estaveis (01-04) deve conter um segredo real,
  nem mesmo "so para referencia" ou "so neste ambiente de
  desenvolvimento" — eles sao justamente os blocos com maior chance de
  serem reenviados, cacheados, e persistidos por mais tempo.
- O Bloco Dinamico tambem nao deve conter segredos, mesmo sendo o bloco
  "de uma vez so" — qualquer conteudo enviado ao modelo, cacheado ou
  nao, sai do controle exclusivo de quem enviou.
- Isso e absolutamente coerente com a lei `NO_API_SECRET` do Bloco 02
  (Safety Laws) e com `NO_SECRET_IN_LOCALSTORAGE` — a politica de "sem
  segredo neste runtime" nao se aplica so ao codigo do PWA, se aplica
  tambem a qualquer prompt que um agente de codigo construa para
  trabalhar neste repositorio.
- Se uma tarefa exige referenciar *que* um segredo existe (ex.: "o
  `INGEST_TOKEN` protege o endpoint `/ingest`"), isso e diferente de
  colocar o **valor** do segredo no prompt — o nome/proposito de uma
  variavel de ambiente nao e sensivel; o valor sempre e.

## Por que cache nao e memoria permanente

Um erro facil de cometer: tratar um acerto de cache como se fosse o
agente "lembrando" de algo entre sessoes. Isso esta errado por
construcao:

- **Cache expira.** A janela de TTL de qualquer entrada de cache e
  finita — depois que expira, a proxima chamada reprocessa o prefixo
  inteiro do zero, como se o cache nunca tivesse existido. Nao ha
  garantia de que um cache de uma sessao de ontem ainda exista hoje.
- **Cache e otimizacao de desempenho, nao banco de dados.** A funcao do
  cache e processar mais rapido/mais barato um prefixo que **ja seria
  enviado de qualquer forma** — ele nao guarda nada que nao estivesse
  explicitamente no prompt. Se um fato importante so existe "porque o
  cache lembra", esse fato na verdade nao existe persistentemente em
  lugar nenhum — e uma ilusao de durabilidade.
- **Trabalho real precisa ser salvo em arquivo ou commit, nunca
  "confiado" ao cache.** Qualquer decisao, descoberta ou artefato que um
  agente precise que sobreviva entre sessoes tem que ser escrito em
  disco (arquivo versionado, commit, documentacao) — exatamente como os
  documentos que este proprio arquivo descreve
  (`docs/STRATEGY_PLAYBOOK.md`, `docs/ANALYSIS_OUTPUT_CONTRACT.md`,
  `ipad_runtime/configs/strategy-playbook.default.json`). Cache pode
  acelerar o **processamento** do contexto estavel da proxima vez que
  ele for enviado de novo — mas quem garante que o contexto existe da
  proxima vez e o arquivo no disco, nao o cache.
- Pratica consequente para este repositorio: os Blocos 01-04 devem
  refletir **o que esta escrito nos arquivos reais do repositorio**
  (README, docs, manifestos JSON) — nunca um resumo mental do agente que
  só existiria "porque o cache ainda esta quente". Se o cache expirar
  (ou se uma sessao nova comecar do zero, sem cache algum), reconstruir
  os Blocos 01-04 a partir dos arquivos reais deve produzir o mesmo
  conteudo, sempre — porque a fonte de verdade e o arquivo, nao o cache.

## Resumo pratico para qualquer agente que abrir este repositorio

1. Monte o prompt com Blocos 01-04 primeiro, nesta ordem fixa, depois o
   Bloco Dinamico por ultimo.
2. Edite os Blocos 01-04 raramente; quando precisar, prefira apendice ao
   final de uma lista a reescrever o meio de um bloco.
3. Nunca inclua um valor de segredo (API key, senha, token) em nenhum
   bloco, estavel ou dinamico.
4. Nao trate um cache "quente" como memoria — toda informacao que precisa
   sobreviver entre sessoes tem que estar em um arquivo real do
   repositorio, nao só no historico de prompts de uma sessao anterior.
5. Os Blocos 01-04 devem ser reconstruíveis a partir dos arquivos reais
   deste repositorio em qualquer momento — eles sao um resumo
   organizado da fonte de verdade que já existe em disco, não uma fonte
   de verdade paralela.
