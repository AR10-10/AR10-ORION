# Checklist de Evidência — AR10_CYBORG_2_FINAL_IPAD_ONE_LINK_SIRIFORM_LLAMA_DEPLOY_V1

Continuação direta de `AR10_CYBORG_2_PANEL_DEPLOY_AND_REPOSITORY_ALIGNMENT_V1`
— mesmo branch (`claude/eloquent-cannon-qyt86y`), mesmo PR (#3), sem
reinício. Marcado apenas o que foi de fato executado e verificado nesta
sessão — nenhum item abaixo é "assumido como passando".

## ONE-LINK / Preparar Cyborg neste iPad

- [x] Botão `btn-prepare-cyborg` adicionado ao Local Pack Manager (10
      botões agora), ligado a `handlePrepareCyborg()`.
- [x] Pipeline reaproveita primitivos existentes
      (`downloadLocalPack`/`verifySha256`/`installToSafariStorage`/
      `initWasm`/`handleRunReplay`/`handleRunDiagnostics`) — nenhuma rota
      de execução nova foi criada.
- [x] Abort `FAIL_CLOSED` real: `return` antecipado se `verifySha256`
      reportar `allOk === false`, antes de qualquer instalação.
- [x] Catch-all cobre falha não prevista, sempre cai em `fail_closed`.

## Siriform Voice Layer

- [x] `js/voice.js` criado: Web Speech API + Speech Synthesis, `pt-BR`,
      janela de escuta única (`continuous=false`).
- [x] 8 comandos permitidos, cada um despachado para o mesmo handler que
      o botão equivalente já usa (`dispatchVoiceCommand` em `app.js`).
- [x] 7 frases bloqueadas por política, checadas com prioridade sobre
      qualquer comando permitido (`matchCommand` em `voice.js`).
- [x] Resposta obrigatória verbatim — "Execução real está bloqueada. O
      Cyborg está em READ_ONLY / FAIL_CLOSED." — confirmada idêntica em
      `BLOCKED_RESPONSE` (`voice.js`) e `voice_blocked_by_policy`
      (`siriform.js`).
- [x] 8 estados de voz (`data-voice-state`) implementados como trilha
      independente do `data-state` de atividade do mesmo avatar.
- [x] Painel "Siriform Voice" (`st-voice`, `st-speech-rec`,
      `st-speech-syn`, `st-mic-perm`) lido via sonda funcional real
      (`voice.getVoiceStatus()`), nunca assumido como `OK`.
- [x] Botão de microfone com 6 variantes visuais
      (`[data-voice-state="..."]` no CSS), incluindo animação de pulso
      para `voice_listening`.
- [x] Ações rápidas (Diagnóstico/Replay/Análise/Relatório) ligadas aos
      mesmos handlers usados pela voz e pelos botões do Local Pack
      Manager.

## Meta Llama / Native Companion (documentação honesta)

- [x] `docs/META_LLAMA_WEB_NATIVE_ROUTE.md` criado — nome correto da
      família, realismo Llama 4 Scout/Maverick/Behemoth, engines
      candidatos, motivo de não embutir modelo, listas PODE/NUNCA
      idênticas a `capabilities_if_installed`/`capabilities_never` de
      `pack/manifest.models.json`.
- [x] `docs/APPLE_INTELLIGENCE_AND_SIRI_ROUTE.md` criado — camada
      implementada (Siriform Voice) vs. camada futura (Native Companion
      Route / App Intents / Siri Shortcuts), sem promessa de prazo.
- [x] Campos de status novos (`st-llama-layer`, `st-llama-profile`,
      `st-llama-runtime`, `st-llama-webgpu`) todos `FUTURE`/sondados,
      nenhum "fake installed".
- [x] Seletor Light/Balanced/Heavy do Replay também atualiza
      `st-llama-profile` — reaproveitamento, não toggle duplicado.

## Layout responsivo (referência visual real recebida)

- [x] Grid CSS 2 colunas (`@media (min-width: 900px)`) e 3 colunas
      (`@media (min-width: 1300px)`) via `grid-column` direto em ids
      existentes — sem reordenar o DOM.
- [x] Abaixo de 900px, layout permanece coluna única na ordem natural do
      documento (Siriform primeiro) — mesma experiência mobile/iPad
      retrato já validada antes desta entrega.

## Verificação técnica local (sem rede, sem browser real)

- [x] `node --check js/app.js`, `service-worker.js`, `js/siriform.js`,
      `js/voice.js` — sintaxe OK.
- [x] CSS: chaves `{`/`}` balanceadas (136/136) em `css/ipad-runtime.css`.
- [x] Todos os ids em `els{}` (app.js) existem em `index.html` — 0
      ausentes (script de verificação cruzada).
- [x] Todos os ids de `getElementById` direto em `app.js` existem em
      `index.html` — 0 ausentes.
- [x] Os 2 ids estáticos não cobertos por `els{}`
      (`st-siri-native`/`st-apple-intel`) confirmados como
      intencionalmente estáticos (roadmap fixo, não sondado em runtime).
- [x] Todos os 22 arquivos do precache do Service Worker (
      `CACHE_VERSION = 'cyborg-ipad-runtime-v3'`) existem em disco —
      checado um a um.
- [x] Seletores `data-voice-state`/`.mic-button`/`.quick-actions`/
      `.qa-btn` do CSS confirmados contra os elementos reais de
      `index.html`.
- [x] `siriform.setVoiceState` confirmado escrevendo no mesmo atributo
      (`data-voice-state`) e nos mesmos nomes de estado lidos pelo CSS.
- [x] `<section>` abre/fecha balanceado em `index.html` (12/12).
- [x] `manifest.webmanifest` válido como JSON após esta entrega.
- [x] `AR10_CYBORG_LOCAL_PACK_V1.ar10pack` válido como JSON, estrutura
      top-level intacta (`format`/`package`/`manifest`/`models_manifest`/
      `runtime_config`/`checksums`/`files`).
- [x] `sha256sum -c pack/checksums.sha256` confere (`wasm` e dataset
      inalterados).
- [x] Servido localmente via `python3 -m http.server`; `index.html`
      retornou HTTP 200.
- [x] HTML canônico (`docs/AR10_CYBORG_2_FINAL_IPAD_ONE_LINK_SIRIFORM_LLAMA_DEPLOY_V1.html`)
      com tags balanceadas e exatamente 15 `<section class="block">`.

## Deploy / HTTPS

- [x] Branch `claude/eloquent-cannon-qyt86y` confirmada sincronizada com
      `origin` antes desta entrega.
- [x] PR #3 reconfirmado aberto (draft) via API nesta sessão.
- [x] Check run `deploy` do PR #3 reconfirmado **failure** nesta sessão
      (rodou novamente hoje, mesmo resultado já diagnosticado em
      `docs/GITHUB_PAGES_FIX.md`).
- [x] Nenhuma ferramenta MCP do GitHub disponível habilita Pages —
      reconfirmado.

## Documentação entregue

- [x] `docs/AR10_CYBORG_2_FINAL_IPAD_ONE_LINK_SIRIFORM_LLAMA_DEPLOY_V1.html`
      (handoff canônico, 15 seções).
- [x] `docs/FINAL_IPAD_ONE_LINK_GUIDE.md` (novo).
- [x] `docs/APPLE_INTELLIGENCE_AND_SIRI_ROUTE.md` (novo).
- [x] `docs/META_LLAMA_WEB_NATIVE_ROUTE.md` (novo).
- [x] `docs/IPAD_DIRECT_GUIDE.md` atualizado (aponta para o fluxo de um
      toque como caminho recomendado, mantém o passo a passo manual).
- [x] `docs/GITHUB_PAGES_FIX.md` reconfirmado sem mudanças necessárias
      (mesmo bloqueio de infraestrutura, nenhuma regressão).
- [x] `evidence_outbox/manifest.sha256.json` regenerado (22 arquivos,
      hashes reais recalculados nesta sessão, incluindo `js/voice.js`
      novo).
- [x] `evidence_outbox/checklist.md` (este arquivo).
- [x] `evidence_outbox/main_files.md` atualizado.

## Não verificado nesta sessão (honestidade operacional)

- [ ] Teste manual no Safari real de iPad físico — ambiente de execução
      não tem iPad/Safari real disponível, nem ferramenta de
      browser/screenshot (Chromium/Puppeteer ausentes neste container) —
      reconfirmado por busca explícita antes de declarar esta limitação.
- [ ] Teste de microfone físico real / permissão de microfone real —
      mesmo motivo acima; `voice.js` foi verificado por leitura de código
      e cross-check estático contra `index.html`/CSS, não por execução
      em navegador real.
- [ ] Link HTTPS público real — depende do toggle manual de
      Settings → Pages → Source (seção 13 do HTML canônico), fora do
      alcance de qualquer token/MCP disponível nesta sessão.
- [ ] Validação de que o grid CSS responsivo renderiza sem lacunas
      visuais inesperadas em viewport real de iPad — risco cosmético
      assumido e documentado (seção 3 do HTML canônico), não testado
      visualmente.
