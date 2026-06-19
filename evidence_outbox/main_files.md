# Main Files — AR10 Cyborg 2.0 iPad Runtime

Evidência de inventário para
`AR10_CYBORG_2_FINAL_IPAD_ONE_LINK_SIRIFORM_LLAMA_DEPLOY_V1` — continuação
direta de `AR10_CYBORG_2_PANEL_DEPLOY_AND_REPOSITORY_ALIGNMENT_V1` (mesmo
branch/PR). Todos os caminhos sob `ipad_runtime/` são relativos a esse
diretório. Hashes completos em `manifest.sha256.json` neste mesmo
diretório.

| Arquivo | Papel | Mudou nesta entrega? |
|---|---|---|
| `index.html` | Tela única do painel | Sim — microfone, ações rápidas, painel Siriform Voice, campos Llama, botão Preparar Cyborg |
| `manifest.webmanifest` | Metadados PWA | Não |
| `service-worker.js` | Cache-first/offline-first | Sim — `js/voice.js` no precache, `CACHE_VERSION` → `v3` |
| `css/ipad-runtime.css` | Tema visual completo | Sim — mic button, quick actions, grid responsivo 2/3 colunas |
| `js/app.js` | Orquestrador da tela e dos botões | Sim — voz, Preparar Cyborg, ações rápidas, status Llama |
| `js/siriform.js` | Máquina de estados do Avatar | Sim — trilha `data-voice-state` (8 estados de voz) |
| `js/voice.js` | Siriform Voice Layer (Web Speech API) | **Novo** |
| `js/feature-detect.js` | Sondas funcionais do Safari | Não |
| `js/crypto-utils.js` | SHA-256 via Web Crypto, base64 | Não |
| `js/storage.js` | OPFS com fallback para IndexedDB | Não |
| `js/pack-manager.js` | Download/import/verify/install/clear do `.ar10pack` | Não |
| `js/replay-engine.js` | Replay BTC/USDT (canvas) via worker | Não |
| `js/diagnostics.js` | Diagnóstico 100% offline | Não |
| `js/worker-client.js` | RPC promise↔postMessage com o Web Worker | Não |
| `workers/quant-worker.js` | Carrega o WASM, roda indicadores fora da UI thread | Não |
| `wasm/cyborg_quant_core.wasm` | Motor real (Rust→WASM) | Não |
| `data/btcusdt_replay.json` | Dataset sintético offline | Não |
| `AR10_CYBORG_LOCAL_PACK_V1.ar10pack` | Pacote de instalação local | Sim (entrega anterior — `manifest.models.json` reempacotado; payload wasm/dataset inalterado, checksums confirmados) |
| `pack/manifest.pack.json` | Manifesto legível do pacote | Não |
| `pack/manifest.models.json` | Roadmap Meta Llama/Transformers/ONNX | Sim (entrega anterior — realismo Llama 4 Scout/Maverick/Behemoth, perfis de processamento) |
| `pack/runtime_config.json` | Flags de postura de segurança | Não |
| `pack/checksums.sha256` | Checksums verificáveis via CLI | Não |

## Arquivos novos nesta entrega

- `ipad_runtime/js/voice.js`
- `docs/AR10_CYBORG_2_FINAL_IPAD_ONE_LINK_SIRIFORM_LLAMA_DEPLOY_V1.html`
- `docs/FINAL_IPAD_ONE_LINK_GUIDE.md`
- `docs/APPLE_INTELLIGENCE_AND_SIRI_ROUTE.md`
- `docs/META_LLAMA_WEB_NATIVE_ROUTE.md`

## Arquivos atualizados nesta entrega (conteúdo, não só nome)

- `ipad_runtime/index.html`, `ipad_runtime/js/app.js`,
  `ipad_runtime/js/siriform.js`, `ipad_runtime/css/ipad-runtime.css`,
  `ipad_runtime/service-worker.js` — ver tabela acima para o que mudou
  em cada um.
- `docs/IPAD_DIRECT_GUIDE.md` — nota no topo apontando para o novo fluxo
  de um toque; passo a passo manual original mantido intacto abaixo.
- `evidence_outbox/manifest.sha256.json`,
  `evidence_outbox/checklist.md`, `evidence_outbox/main_files.md` (este
  arquivo).

## Arquivos confirmados sem mudança nesta entrega

- `docs/GITHUB_PAGES_FIX.md` — reconfirmado (check run `deploy` ainda
  `failure`, mesmo bloqueio de admin do GitHub Pages).
- `docs/DEPLOY_GUIDE.md`, `docs/PROMOTION_CHECKLIST.md`.
- `wasm-src/`, `wasm/cyborg_quant_core.wasm`, `data/btcusdt_replay.json`,
  `tools/`, `icons/` — nenhuma mudança nesta entrega exigia recompilar o
  WASM ou regenerar dataset/ícones; `.ar10pack` continua validando contra
  `pack/checksums.sha256`.

## Arquivos intencionalmente não criados nesta entrega

Nenhum app nativo companion (Swift/SwiftUI), nenhum App Intent, nenhum
modelo Meta Llama embutido, nenhum shard de download incremental — todos
roadmap declarado (`FUTURE`) em
`docs/APPLE_INTELLIGENCE_AND_SIRI_ROUTE.md` e
`docs/META_LLAMA_WEB_NATIVE_ROUTE.md`, não funcionalidades parcialmente
implementadas.
