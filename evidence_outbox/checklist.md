# Checklist de Evidência — AR10_CYBORG_2_REAL_IPAD_HOLD_FIX_NATIVE_APP_SHELL_ONE_BUTTON_HEADER_VAULT_EXPORT_V1

Continuação direta de
`AR10_CYBORG_2_IPAD_LANDSCAPE_VAULT_AUTOSAVE_EXPORT_AND_REAL_DATA_POLICY_FIX_V1`
(Mission 6) — mesmo branch (`claude/eloquent-cannon-qyt86y`), mesmo PR (#3),
sem reinício. Esta missão (Mission 7) responde a feedback real de
screenshot em iPad físico que identificou 8 problemas concretos: header
cortado, chips de segurança mal posicionados, sensação de "página web" em
vez de app nativo, beco sem saída na instalação ausente, painel de
exportação mostrando nomes genéricos como se já tivessem sido exportados,
fluxo principal de um botão não óbvio, rodapé/legal grande demais, e
áreas avançadas/técnicas dominando a primeira tela. Marcado apenas o que
foi de fato editado e verificado nesta sessão.

## Fase 1 — Header sem corte, com safe-area

- [x] `header.app-topbar` (novo) é filho direto de `<body>`, **fora** de
      `.runtime-shell` — nunca herda o `max-width`/padding do shell, então
      não pode repetir o bug de corte visto no iPad real.
- [x] Removida a técnica de "sangria" com margem negativa (`.mode-banner`,
      `margin: calc(var(--safe-t) * -1 - 12px) ...`) que era a causa raiz
      do corte — substituída por padding simples com
      `env(safe-area-inset-*)` (`--safe-t/-r/-b/-l`), sem nenhuma margem
      negativa em `.app-topbar`.
- [x] Layout pedido: esquerda = "AR10 Cyborg" (`.tb-brand`), centro = status
      compacto do runtime (`.tb-status`, `#topbar-status`), direita =
      chips `READ_ONLY`/`FAIL_CLOSED` (`.tb-chip`) + botões "Atualizar
      sistema"/"Analisar sistema"/"Modo avançado".
- [x] `.app-topbar` usa `flex-wrap: wrap` em três níveis (topbar e cada um
      dos três grupos `.tb-left/.tb-center/.tb-right`) — em telas estreitas
      os itens quebram para a linha de baixo em vez de cortar ou
      estourar a largura.
- [x] `.tb-status` tem `overflow:hidden`+`text-overflow:ellipsis` e é
      ocultado abaixo de 600px (o mesmo estado já aparece na legenda do
      Siriform) — nunca força scroll horizontal.
- [x] `.runtime-shell` perdeu o `padding-top` com safe-area (o topbar já
      cobre isso) e o `@media (display-mode: standalone)` que empurrava
      esse padding extra — removido por ficar redundante/morto.

## Fase 2 — Um botão principal, fluxo automático de 14 passos

- [x] Botão único e visualmente dominante na tela inicial: `.hero-cta`
      `#btn-prepare-cyborg`, texto verbatim **"Preparar / Atualizar Cyborg
      neste iPad"**, dentro do `siriform-card` (não mais dentro da grade
      técnica do Local Pack Manager).
- [x] `handlePrepareCyborg()` (reescrito) verifica primeiro se já existe
      instalação válida (`getInstalledVaultMeta()`); se sim, tenta
      `autoRepairVault()` antes de qualquer download; só baixa/reinstala
      quando não há instalação prévia ou o reparo falhou por motivo que
      não seja checksum. `FAIL_CLOSED` (estado `blocked`) se o checksum
      falhar — nunca sobrescreve nada.
- [x] Sequência cobre verificação de SHA256, instalação no Safari
      Storage/OPFS/IndexedDB/Cache, replay e diagnóstico automáticos
      (`handleRunReplay()` + `handleRunDiagnostics()` chamados no final do
      fluxo) e atualização de todos os painéis de status.
- [x] Texto final exato ao concluir com sucesso: **"Cyborg pronto neste
      iPad."** (`siriform.setSiriformState('success', 'Cyborg pronto neste
      iPad.')`), também usado no boot quando o Vault já está `READY`.
- [x] Duplicata removida: a grade técnica antiga tinha um segundo
      `id="btn-prepare-cyborg"` (bug de id duplicado introduzido durante a
      edição, corrigido antes do commit) — agora existe exatamente um.

## Fase 3 — Instalação ausente nunca é um beco sem saída

- [x] `handleCheckLocalInstall()` (reescrito) distingue dois casos lendo
      `getInstalledVaultMeta()` **antes** de decidir a mensagem:
      (a) nunca instalado (`before` nulo/sem checksums) → mensagem guiada
      "Instalação local ainda não preparada. Toque em 'Preparar / Atualizar
      Cyborg neste iPad'." — nunca um texto técnico de erro;
      (b) instalado porém corrompido → tenta `autoRepairVault()`
      automaticamente **antes** de mostrar qualquer falha.
- [x] Reparo automático com sucesso → "Instalação reparada."; reparo sem
      sucesso → aponta para "Reparar instalação" no Modo avançado (nunca
      sugere download manual).
- [x] `FAIL_CLOSED` (checksum inválido durante o reparo automático) vira
      estado `blocked` com mensagem "Bloqueado por segurança. Toque em
      'Reparar instalação' no Modo avançado." — estado anterior preservado,
      nada é sobrescrito.
- [x] "Limpar/Reinstalar" continua existindo só no Modo avançado, como
      último recurso manual com confirmação (`handleClearReinstall`,
      inalterado nesta missão).

## Fase 4 — Painel de exportação sem nomes falsos

- [x] `renderExportPanel()` (reescrito) ramifica em `a.filename`: só mostra
      um nome de arquivo real (`EXPORTADO`, classe `v-ok`) quando aquele
      tipo já foi de fato exportado nesta sessão.
- [x] Quando nada foi exportado ainda, mostra mensagem honesta por tipo
      via `EXPORT_EMPTY_LABEL` — "Nenhum backup do pacote local exportado
      ainda.", "Nenhum relatório exportado ainda.", "Nenhuma evidência
      exportada ainda.", "Nenhum DECAP exportado ainda." (classe
      `.export-name-empty`, estilo dim/itálico **adicionado nesta sessão**
      em `ipad-runtime.css` — a classe já era usada por `app.js` desde a
      Mission 6, mas não tinha regra CSS própria até agora) — nunca o nome
      genérico do pacote interno
      (`AR10_CYBORG_LOCAL_PACK_V1.ar10pack`) como se já tivesse sido
      baixado.
- [x] Rótulo de visibilidade ao lado de cada item ausente reflete a
      origem real: `DISPONÍVEL PARA EXPORTAR` / `SOB DEMANDA` / `INTERNO` /
      `FUTURO` (`visLabel` em `app.js`, inalterado — já existia desde a
      Mission 6).
- [x] `js/export-manifest.js` não precisou de nenhuma mudança: o padrão de
      nome único carimbado `AR10_CYBORG_[TYPE]_[VERSION]_[YYYYMMDD_HHMMSS].
      [ext]` (`uniqueName()`) e o registro de exportações reais
      (`downloadArtifact()`) já estavam corretos — o bug estava só na
      renderização em `app.js`, não na política de nomes.

## Fase 5 — Limpeza visual "tipo app"

- [x] Header gigante centralizado (`.nebula-header`, dead CSS depois da
      edição) removido; topbar compacto assume a identidade visual.
- [x] Rodapé reduzido de 4 linhas (incluindo o codinome de entrega da
      Mission 5: `AR10_CYBORG_2_FINAL_IPAD_ONE_LINK_SIRIFORM_LLAMA_DEPLOY_V1`)
      para uma única linha: "AR10 Cyborg 2.0 · READ_ONLY / FAIL_CLOSED ·
      Local-first · Sem live trading · v2.0.0".
- [x] Divulgação progressiva: 13 cards técnicos/avançados (voice-status,
      runtime-status, feature-detect, quant-engine, ai-models, replay,
      analysis-frame, data-policy, decision-frame, vault-evidence,
      vault-local, local-pack-manager/manutenção, export-panel) movidos
      para `<section class="advanced-section" id="advanced-section"
      hidden>` — saem da primeira tela e só aparecem sob toque em "Modo
      avançado".
- [x] Tela principal (`.bento`, agora só com `siriform-card` +
      `cyborg-readiness-panel`) responde de cara às 5 perguntas do
      brief: pronto/seguro/Vault OK/precisa atualizar/qual botão apertar —
      via Siriform + badges de lei + hero CTA + resumo unificado de
      Readiness.
- [x] Texto de onboarding do antigo "Local Pack Manager" (agora
      "Manutenção / Técnico") atualizado para apontar de volta ao botão
      principal em vez de repetir instruções de fluxo manual.

## Fase 6 — Siriform Command Center

- [x] Vocabulário de estado do avatar renomeado de
      `idle/listening/thinking/responding/installing/analyzing/read_only/
      fail_closed` (ad-hoc) para o vocabulário fixo exigido: `idle,
      listening, thinking, updating, checking, repairing, success,
      warning, blocked` (`js/siriform.js`, `STATES`/`DEFAULT_CAPTIONS`/
      `TRANSIENT_STATES`) — ~30 chamadas em `app.js` migradas e
      confirmadas por grep (zero ocorrência dos nomes antigos restante,
      exceto a trilha de voz `voice_responding`, que é independente por
      design e não muda).
- [x] CSS `.siriform-avatar[data-state="..."]` reescrito com uma regra por
      estado novo (cor/ritmo distintos para `checking`, `updating`,
      `repairing`, `success`, `warning`, `blocked`) — nenhum estado do
      vocabulário fica sem estilo.
- [x] Orbe permanece central, calmo no `idle` (animação mais lenta) e
      reage de forma visível porém não exagerada nos estados transitórios
      (`TRANSIENT_STATES` volta a `idle` depois de ~3.6s; `blocked` fica
      fixo até nova ação, igual ao comportamento antigo do `fail_closed`).
- [x] `@media (prefers-reduced-motion: reduce)` (novo, no topo do CSS) zera
      `animation-duration`/`transition-duration` globalmente — não existia
      antes desta missão.
- [x] Chips `READ_ONLY`/`FAIL_CLOSED` agora vivem no topbar (sempre
      visíveis, compactos) além dos badges de lei já existentes dentro do
      `siriform-card`.

## Fase 7 — Hierarquia de botões

- [x] Ações normais visíveis fora do Modo avançado: (1) "Preparar /
      Atualizar Cyborg neste iPad" (hero CTA), (2) "Atualizar sistema"
      (`#btn-tb-update`, topbar), (3) "Analisar sistema" (`#btn-tb-analyze`,
      topbar, roda `handleCheckSafari()` + `handleCheckLocalInstall()`).
- [x] Tudo o resto vive em `#advanced-section`, revelado por
      `#btn-tb-advanced` ("Modo avançado" ⇄ "Ocultar modo avançado",
      `aria-expanded` sincronizado): "Baixar pacote para backup",
      "Importar pacote manual", "Verificar SHA256 manual", "Rodar
      Diagnóstico Técnico Offline", "Rodar Replay Técnico Offline",
      "Reparar instalação", "Limpar/Reinstalar" (mantido como botão
      `danger`).
- [x] Botão antigo "Atualizar pacote local" (`#btn-update-pack`) removido
      do HTML — sua função já é coberta por "Atualizar sistema" no topbar
      (`handleUpdateLocalPack`, mesma função, só re-wireada para o novo
      botão).
- [x] `wireAdvancedToggle()` (novo) liga o botão do topbar ao atributo
      `hidden` da seção e faz scroll suave até ela ao abrir.

## Fase 8 — Aceite final (auditoria estática)

- [x] HTML balanceado: leitura de pilha de tags (`section/div/header/
      footer/button/p/span/h2/h3`) termina com pilha vazia — sem tag
      órfã. Zero `id` duplicado (auditado com `sort | uniq -c`).
- [x] CSS balanceado: 157 `{` / 157 `}`, 328 `(` / 328 `)`.
- [x] Cross-check de ids: 76 em `els{}` + 21 `getElementById` diretos = 97
      ids únicos referenciados por `app.js` — **0 ausentes** em
      `index.html`.
- [x] `header.app-topbar` é o único header com `position: sticky` na
      página (o antigo `.mode-banner` sticky foi removido, não duplicado).
- [x] Nenhum `margin` negativo restante ligado a safe-area em todo o CSS
      (a causa raiz do corte no iPad real foi eliminada, não mascarada).
- [x] `.advanced-section` segue a mesma régua de colunas balanceadas do
      `.bento` (`column-count: 2`/`3` nos mesmos breakpoints, `break-inside:
      avoid` por card) — Modo avançado também não cria coluna vazia nem
      corta card ao meio em paisagem.
- [x] Rodapé com uma linha; nenhum header vazio gigante; um único botão de
      ação primária fora do Modo avançado.

## Segurança (14 leis) — confirmação cruzada nesta sessão

- [x] Execução permanece `DISABLED_BY_POLICY`; nenhuma rota de rede nova,
      nenhum endpoint de corretora, nenhuma função de ordem foi tocada
      nesta missão (mudanças são 100% de UI/estado local).
- [x] `grep -rn "localStorage"` em `js/`, `index.html`, `service-worker.js`
      — zero ocorrências.
- [x] `grep -rE "order_send|placeOrder|sendOrder|api_secret|private_key"` —
      única ocorrência é a string de diagnóstico em `diagnostics.js`
      confirmando a ausência dessa função (pré-existente, não tocada).
- [x] `grep "fetch(|XMLHttpRequest|WebSocket("` em `app.js`/`siriform.js`/
      `service-worker.js` — único `fetch(` é o cache-first do próprio
      Service Worker, já guardado por `if (new URL(req.url).origin !==
      self.location.origin) return;` (same-origin only, pré-existente).
- [x] CSP em `index.html` inalterada nesta missão.
- [x] READ_ONLY/FAIL_CLOSED permanecem visíveis: chips fixos no topbar +
      badges de lei no `siriform-card` + estado `blocked` do avatar.

## Verificação técnica local (sem rede, sem browser real)

- [x] `node --check` em todos os `.js` sob `ipad_runtime/` (14 arquivos,
      incluindo `app.js`, `siriform.js`, `service-worker.js`,
      `pack-manager.js`, `export-manifest.js`) — todos OK.
- [x] `json.load` em todos os `.json`/`.webmanifest`/`.ar10pack` do
      projeto — todos válidos.
- [x] `CACHE_VERSION` do Service Worker `v6` → `v7` (conteúdo de
      `index.html`/`css/ipad-runtime.css`/`js/app.js`/`js/siriform.js`
      mudou; lista de `PRECACHE_URLS` não mudou — nenhum arquivo novo
      foi introduzido nesta missão).
- [x] `evidence_outbox/manifest.sha256.json` regenerado para os 5 arquivos
      que mudaram (`index.html`, `css/ipad-runtime.css`, `js/app.js`,
      `js/siriform.js`, `service-worker.js`); os demais hashes
      permanecem idênticos (payload do `.ar10pack`/wasm/dataset
      intocado).
- [x] `EXPORT_MANIFEST.json`: campo `generated_for` atualizado para o
      codinome desta missão; política de nome único em si não mudou.

## Não verificado nesta sessão (honestidade operacional)

- [ ] Teste em Safari real de iPad físico (a motivação original desta
      missão foi um screenshot real) — ambiente sem iPad/Safari físico
      disponível. Header sem corte, safe-area e ausência de overflow
      horizontal foram validados por auditoria estática de CSS/HTML, não
      por renderização real na tela que reportou o problema.
- [ ] Comportamento real de `position: sticky` do novo `.app-topbar`
      durante rotação de tela e em modo standalone (PWA instalado) —
      validado por leitura de código (sem margem negativa, sem
      `max-width` herdado), não por dispositivo real.
- [ ] Toque real no botão "Modo avançado" com leitor de tela (VoiceOver) —
      `aria-expanded` e `aria-label` foram mantidos/adicionados por
      leitura de código, não testados com VoiceOver real.
