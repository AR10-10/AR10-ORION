# Checklist de Evidência — AR10_CYBORG_2_PANEL_DEPLOY_AND_REPOSITORY_ALIGNMENT_V1

Marcado apenas o que foi de fato executado e verificado nesta sessão —
nenhum item abaixo é "assumido como passando".

## Painel / Nebula Core / Siriform Avatar

- [x] Painel consolidado em `index.html` com os 18 cards pedidos (header
      premium, Siriform Avatar, status global, modo de runtime, Safari
      Local Runtime, Local Pack Manager, Feature Detection, WASM Quant
      Engine, WebGPU/WebGL/Canvas, WebLLM/Llama, Transformers/ONNX,
      Replay BTC/USDT, AnalysisFrame, DecisionFrame, Vault/Evidence, guia
      Add to Home Screen, logs amigáveis, perfis Light/Balanced/Heavy).
- [x] Siriform Avatar (`js/siriform.js`) com os 8 estados obrigatórios:
      `idle, listening, thinking, responding, installing, analyzing,
      read_only, fail_closed`.
- [x] Frases em português conectadas aos estados reais (ex.: "Runtime
      Safari detectado.", "Pacote local ainda não instalado.", "Replay
      BTC/USDT pronto para análise.", "Execução real bloqueada. Modo
      seguro ativo.").
- [x] `fail_closed` reservado para falhas reais de segurança (checksum
      divergente em `handleVerifySha`/`handleInstallStorage`) — não é
      decorativo.
- [x] Badges permanentes visíveis: `READ_ONLY`, `FAIL_CLOSED`,
      `Execution Lock: ACTIVE`, `Private Keys: DISABLED`,
      `Live Trading: BLOCKED`.
- [x] DecisionFrame rotulado `STUB CONTROLLED`, sem lógica de
      decisão/ordem.
- [x] WebLLM/Transformers/ONNX rotulados `FUTURE`, sem modelo embutido.
- [x] Perfis de processamento (Light/Balanced/Heavy) alteram de fato o
      `windowSize` usado no cálculo SMA/EMA via WASM (10/20/40) — não é
      um toggle decorativo.

## Verificação técnica local (sem rede)

- [x] `node --check js/app.js` — sintaxe OK.
- [x] `node --check js/siriform.js` — sintaxe OK.
- [x] `node --check js/pack-manager.js` — sintaxe OK.
- [x] Todos os 30 ids referenciados em `els{}` (app.js) existem em
      `index.html` (script de verificação cruzada, 0 ausentes).
- [x] Todos os ids de botão (`btn-*`) usados por `wireButtons()` existem
      em `index.html`.
- [x] `<section>` abre/fecha balanceado em `index.html` (11/11).
- [x] Servido localmente via `python3 -m http.server`; `index.html`,
      `css/ipad-runtime.css`, `js/app.js`, `js/siriform.js`,
      `js/feature-detect.js`, `service-worker.js`, `manifest.webmanifest`
      retornaram HTTP 200.
- [x] `manifest.webmanifest` é JSON válido após a alteração de nome.
- [x] `sha256sum -c pack/checksums.sha256` confere (`wasm` e dataset
      inalterados, payload do `.ar10pack` continua íntegro).
- [x] Campos retornados por `feature-detect.js` (`webgpu`, `webgl`) batem
      com os nomes lidos em `app.js`.
- [x] Campos retornados por `replay-engine.js` (`onMeta`) batem com os
      nomes lidos em `renderAnalysisFrame`/`app.js`.
- [x] `pack-manager.reloadVaultState()` corrigido para devolver `reason`
      também no caminho de falha (antes só gravava em storage, nunca
      retornava — o card Vault/Evidence ficaria sempre sem motivo exibido).

## Repositório / nome do projeto

- [x] Busca por "Organização Escolar" ou qualquer nome incoerente em todo
      o repositório (`.md/.json/.html/.yml/.yaml/.toml`) — **nenhuma
      ocorrência encontrada**, nesta sessão e na anterior.
- [x] Metadados reais do repositório via API (`search_repositories`):
      `full_name=AR10-10/AR10-ORION`, owner `AR10-10` (conta de usuário,
      não organização), `private=true`, `has_pages=false`.
- [x] Nome do sub-produto iPad alinhado em `manifest.webmanifest` (`name`),
      `index.html` (`<title>`), `ipad_runtime/README.md` (título) e
      cross-link adicionado em `README.md` (raiz).
- [x] Repositório `AR10-ORION` mantido como está (não renomeado) — decisão
      registrada no HTML canônico: o repo é o organismo inteiro (Cockpit
      Python + sub-produtos), renomeá-lo para um nome específico do iPad
      seria tecnicamente incorreto e quebraria URLs de clone/PR existentes.

## Deploy / HTTPS

- [x] Branch `claude/eloquent-cannon-qyt86y` sincronizada com `origin`.
- [x] PR #3 confirmado aberto (draft) via API antes de escrever o
      relatório final.
- [x] Check run `deploy` do PR #3 reconfirmado **failure** nesta sessão,
      com o log completo capturado (`Resource not accessible by
      integration` ao tentar criar o site do Pages).
- [x] `has_pages: false` reconfirmado via API nesta sessão (não é uma
      suposição herdada da sessão anterior).
- [x] Nenhuma ferramenta MCP do GitHub disponível nesta sessão habilita
      Pages ou renomeia repositório — reconfirmado via `ToolSearch` antes
      de declarar HOLD.

## Documentação entregue

- [x] `docs/AR10_CYBORG_2_PANEL_DEPLOY_AND_REPOSITORY_ALIGNMENT_V1.html`
      (handoff canônico, 12 seções).
- [x] `docs/DEPLOY_GUIDE.md`, `docs/IPAD_DIRECT_GUIDE.md`,
      `docs/GITHUB_PAGES_FIX.md`, `docs/PROMOTION_CHECKLIST.md`.
- [x] `evidence_outbox/manifest.sha256.json`,
      `evidence_outbox/checklist.md` (este arquivo),
      `evidence_outbox/main_files.md`.

## Não verificado nesta sessão (honestidade operacional)

- [ ] Teste manual no Safari real de iPad físico (ambiente não tem
      iPad/Safari real disponível — apenas `http.server` local e
      `node --check`).
- [ ] Link HTTPS público real (depende do toggle manual de
      Settings → Pages → Source, fora do alcance de qualquer token/MCP
      disponível nesta sessão).
