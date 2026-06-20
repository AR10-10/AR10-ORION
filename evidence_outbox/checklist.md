# Checklist de Evidência — AR10_CYBORG_2_IPAD_LOCAL_VAULT_SAFE_AUTOMATION_POLISH_V1

Continuação direta de
`AR10_CYBORG_2_VISUAL_POLISH_MULTI_ASSET_RESEARCH_AND_CONNECTOR_ARCHITECTURE_V1`
— mesmo branch (`claude/eloquent-cannon-qyt86y`), mesmo PR (#3), sem
reinício. Esta missão (Mission 5) é de **polimento de automação local
segura** — painel "Vault Local do iPad", fluxo de salvamento/atualização
automática do pacote local, e reconciliação dos botões do Local Pack
Manager. Não é uma fase de live trading; nenhuma capacidade de execução
foi adicionada. Marcado apenas o que foi de fato executado e verificado
nesta sessão — nenhum item abaixo é "assumido como passando".

## Vault Local do iPad (painel novo)

- [x] Seção `#vault-local-panel` adicionada em `index.html` entre
      `vault-evidence-panel` e `local-pack-manager` — 16 campos de status
      (`vl-pack`, `vl-pack-name`, `vl-pack-version`, `vl-sha256`,
      `vl-sw-cache`, `vl-cache-api`, `vl-idb`, `vl-opfs`, `vl-wasm`,
      `vl-replay`, `vl-updated`, `vl-cache-version`, `vl-storage-used`,
      `vl-storage-quota`, `vl-safety`, `vl-repair`), todos populados por
      `refreshVaultLocalPanel(vault)` (`js/app.js`) a partir de sondagens
      reais (nenhum valor decorativo).
- [x] Texto verbatim de onboarding incluído no painel: "O Cyborg salva
      automaticamente os arquivos necessários no armazenamento seguro do
      Safari/PWA. Você não precisa procurar uma pasta raiz. Esta área
      mostra o que está instalado, validado e pronto para uso neste
      iPad."
- [x] `refreshVaultLocalPanel()` chamada a partir do único chokepoint
      `refreshVaultAndReplayStatus()` (`js/app.js`) — cobre `boot`,
      `handleDownloadPack`, `handleInstallStorage`, `handleClearReinstall`,
      `handlePrepareCyborg` e os 3 novos handlers, sem precisar duplicar a
      chamada em cada um.
- [x] Armazenamento usado / cota disponível lidos via
      `navigator.storage.estimate()` (`storageEstimate()` em
      `js/storage.js`, função pré-existente, reaproveitada sem
      duplicação).
- [x] Rótulos PT-BR exatos usados nos campos de status —
      `INSTALADO`/`OK`/`ATUALIZADO`/`DESATUALIZADO`/`AUSENTE`/`CORROMPIDO`/
      `LIMITADO`/`REINSTALAÇÃO NECESSÁRIA`/`BLOQUEADO POR SEGURANÇA` —
      mapeados para as 5 classes CSS já existentes via `classFor()`
      estendido; **nenhuma sexta classe de status criada** (confirmado:
      `v-ok`/`v-fail`/`v-info`/`v-pending`/`v-limited` continuam sendo as
      únicas 5 classes usadas em `js/app.js` e `css/ipad-runtime.css`).
- [x] `NO_FAKE_LOCAL_AI_CLAIMS` (lei nova, ver seção de segurança abaixo):
      `vaultFreshness` começa `null` a cada carregamento de página e só
      recebe `'ATUALIZADO'`/`'DESATUALIZADO'` depois de uma comparação de
      versão de fato feita nesta sessão — nunca assumido por omissão.

## Fluxo de salvamento/atualização automática local (8 passos)

- [x] `handleCheckLocalInstall()` — verifica estado instalado localmente
      sem rede (consulta apenas o meta já salvo + recalcula SHA-256 dos
      arquivos já gravados).
- [x] `handleUpdateLocalPack()` — compara versão local vs. pacote
      carregado; baixa/reinstala somente se houver diferença real de
      versão; do contrário reporta `ATUALIZADO` sem reescrever nada.
- [x] `handleRepairInstall()` — força reverificação + reinstalação
      incondicional (usado quando o usuário suspeita de corrupção), sempre
      `FAIL_CLOSED` se o checksum não bater.
- [x] `installToSafariStorage()` (`js/pack-manager.js`) reescrita para
      seguir a ordem seguro-primeiro: (1) verifica SHA-256 do pacote
      carregado, (2) aborta com `FAIL_CLOSED` se inválido — **antes** de
      tocar em qualquer arquivo já instalado, (3) grava os arquivos novos
      já validados, (4) só then remove arquivos antigos que não existem
      mais no pacote novo (`deleteFile()`, novo em `js/storage.js`,
      reaproveitando `idbDelete` já existente), (5) atualiza o meta do
      Vault com `installedAt` preservado e `updatedAt` novo.
- [x] Nunca apaga o estado anterior antes de confirmar que o novo
      conteúdo é válido — limpeza de cache antigo só ocorre depois da
      gravação validada, nunca antes.
- [x] `pack/manifest.pack.json` ganhou o campo `pack_version: "1.0.0"`
      necessário para a comparação de versão local-vs-remoto sem
      depender de heurística de timestamp.

## Botões do Local Pack Manager (reconciliação 10 → 13)

- [x] 5 botões pedidos pela missão mapeados contra os botões existentes:
      "Preparar tudo neste iPad" (`btn-prepare-cyborg`, já existia,
      rótulo ajustado), "Verificar instalação local" (`btn-check-install`,
      **novo**), "Atualizar pacote local" (`btn-update-pack`, **novo**),
      "Reparar instalação" (`btn-repair-install`, **novo**),
      "Limpar/Reinstalar" (`btn-clear-reinstall`, já existia, rótulo
      inalterado).
- [x] Nenhum handler existente quebrado — os 10 botões anteriores
      continuam com o mesmo `id`/listener; os 3 novos foram adicionados em
      `wireButtons()` sem remover nenhum `addEventListener` anterior.
- [x] Contagem real confirmada nesta sessão via grep de
      `id="btn-` em `index.html`: **13 botões** dentro de
      `#runtime-actions` (`local-pack-manager`).
- [x] "Limpar/Reinstalar" mantém estilo destrutivo (`class="rt-btn
      danger"`) + diálogo de confirmação com explicação do que será
      removido (`handleClearReinstall()`, mensagem detalhada, reseta
      `vaultFreshness` para `null` após a ação).

## Documentação atualizada nesta sessão

- [x] `docs/READ_ONLY_MARKET_SAFETY.md` — 13ª lei `NO_FAKE_LOCAL_AI_CLAIMS`
      adicionada (bloco verbatim + linha na tabela + nota explicativa
      distinguindo de `NO_FAKE_DATA`); todas as 6 ocorrências de "12
      leis" no arquivo corrigidas para "13 leis".
- [x] `docs/PROMPT_CACHING_AND_AGENT_CONTEXT_STRATEGY.md` — Stable Block
      02 atualizado com `NO_FAKE_LOCAL_AI_CLAIMS`; referência cruzada
      "12 leis" → "13 leis" corrigida.
- [x] `docs/DATA_SOURCE_MATRIX.md` — referência "12 leis" → "13 leis"
      corrigida.
- [x] `docs/IPAD_PWA_VISUAL_POLISH_HANDOFF.md` — referência "12 leis" →
      "13 leis" corrigida.
- [x] `ipad_runtime/README.md` — cadeia de cards corrigida para incluir
      `cyborg-readiness-panel`, `voice-status-panel` (ambos já existentes
      desde a Mission 4, nunca documentados nesta prosa) e
      `vault-local-panel` (novo); contagem de botões corrigida de "9" para
      "13" (refletindo o estado real atual, não o estado pré-Mission-4).
- [x] Busca grep-wide confirmada: nenhuma outra ocorrência de "12 leis"
      restante em `docs/` após estas 4 correções.

## Verificação técnica local (sem rede, sem browser real) — refeita nesta sessão

- [x] `node --input-type=module --check` nos 39 arquivos `.js` sob
      `ipad_runtime/` (runtime + workers + `src/research/**`) — sintaxe
      OK, zero falhas, incluindo os 3 arquivos editados nesta missão
      (`js/app.js`, `js/pack-manager.js`, `js/storage.js`) e
      `service-worker.js`.
- [x] `json.load` em todos os 9 arquivos JSON sob `ipad_runtime/`
      (`configs/*.json`, `data/btcusdt_replay.json`, `pack/*.json`) —
      todos válidos, incluindo `pack/manifest.pack.json` com o novo campo
      `pack_version`.
- [x] CSS: chaves `{`/`}` balanceadas (140/140) em
      `css/ipad-runtime.css` após adicionar `#vault-local-panel` aos
      breakpoints de 900px/1300px (sem nova classe CSS).
- [x] HTML: `<section>` balanceado (14/14), `<div>` balanceado (80/80),
      `<button>` balanceado (22/22) em `index.html` — verificado por
      parser de tags próprio, não apenas contagem de substring.
- [x] Cross-check programático: todos os 69 ids no array `els{}` de
      `js/app.js` (incluindo os 16 novos `vl-*`) existem em
      `index.html` (110 ids totais declarados) — 0 ausentes.
- [x] Todos os 21 arquivos reais do precache do Service Worker (mais a
      raiz `./`, servida pelo próprio diretório) existem em disco —
      checado um a um nesta sessão.
- [x] `CACHE_VERSION` incrementado `v4` → `v5` em `service-worker.js` —
      necessário porque `index.html`/`css/ipad-runtime.css`/`js/app.js`/
      `js/pack-manager.js`/`js/storage.js` mudaram de conteúdo nesta
      entrega.
- [x] `tools/build_pack.py` re-executado: `AR10_CYBORG_LOCAL_PACK_V1.ar10pack`
      reempacotado (87730 bytes) para embutir o `manifest.pack.json`
      atualizado (`pack_version` novo); `pack/checksums.sha256`
      regenerado — hashes de `wasm/cyborg_quant_core.wasm` e
      `data/btcusdt_replay.json` confirmados **inalterados** (nenhum dos
      dois payloads binários mudou nesta missão; só o manifesto JSON
      embutido mudou).
- [x] `evidence_outbox/manifest.sha256.json` regenerado
      programaticamente (22 entradas) — hashes recalculados para os 8
      arquivos que mudaram de conteúdo (`index.html`,
      `css/ipad-runtime.css`, `js/app.js`, `js/pack-manager.js`,
      `js/storage.js`, `service-worker.js`, `pack/manifest.pack.json`,
      `AR10_CYBORG_LOCAL_PACK_V1.ar10pack`).

## Segurança (13 leis) — confirmação cruzada nesta sessão

- [x] `execution_supported: false` ainda nas 14 entradas de
      `connector-registry.default.json` — nenhum conector tocado nesta
      missão.
- [x] `grep -rn "localStorage"` em `js/` e `index.html` — zero
      ocorrências, base real de `NO_SECRET_IN_LOCALSTORAGE` ainda válida
      após os novos `vl-*`/`deleteFile()`/handlers (nenhum deles usa
      `localStorage`; o Vault continua 100% OPFS/IndexedDB).
- [x] `installToSafariStorage()` confirmado: limpeza de arquivo antigo
      (`deleteFile`) só ocorre **depois** da verificação SHA-256 e da
      gravação dos arquivos novos — nunca antes, preservando
      `FAIL_CLOSED` (uma falha no meio do processo nunca deixa o Vault
      sem o pacote anterior funcional).
- [x] Nenhuma nova rota de rede, campo de chave/segredo, ou função de
      ordem introduzida pelos 3 novos handlers ou pelo novo painel —
      confirmado por leitura completa do diff antes do commit.
- [x] 13ª lei `NO_FAKE_LOCAL_AI_CLAIMS` confirmada como já implementada
      (não aspiracional) antes de ser documentada: `vaultFreshness`
      realmente começa `null` no código, e os detectores `FUTURE`
      (`feature-detect.js`) e `manifest.models.json` já usavam esse
      literal antes desta sessão — o documento apenas nomeia o padrão já
      existente.

## Deploy / HTTPS

- [x] Branch `claude/eloquent-cannon-qyt86y` é a branch de trabalho ativa.
- [x] PR #3 — ver resposta final para reconfirmação de status nesta
      sessão.
- [ ] Run do workflow `Deploy iPad Runtime (GitHub Pages)` disparada pelo
      push desta sessão — ver `main_files.md` / resposta final para o
      resultado.
- [ ] Verificação de `https://ar10-10.github.io/AR10-ORION/` pós-push —
      ver resposta final.

## Não verificado nesta sessão (honestidade operacional)

- [ ] Teste manual no Safari real de iPad físico — ambiente de execução
      não tem iPad/Safari real disponível, nem ferramenta de
      browser/screenshot. Em particular, o layout do novo painel
      `#vault-local-panel` nos breakpoints 900px/1300px não foi validado
      visualmente, apenas por leitura de CSS.
- [ ] Teste de `navigator.storage.estimate()` com quota real de
      dispositivo — comportamento depende do Safari real; código
      confirmado correto por leitura, não por execução em browser.
- [ ] `js/siriform.js`, `js/voice.js` inalterados nesta missão — fora do
      escopo (Mission 5 não toca a camada de voz).
