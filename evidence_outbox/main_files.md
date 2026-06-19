# Main Files — AR10 Cyborg 2.0 iPad Runtime

Evidência de inventário para `AR10_CYBORG_2_PANEL_DEPLOY_AND_REPOSITORY_ALIGNMENT_V1`.
Todos os caminhos são relativos a `ipad_runtime/`. Hashes completos em
`manifest.sha256.json` neste mesmo diretório.

| Arquivo | Papel | Mudou nesta entrega? |
|---|---|---|
| `index.html` | Tela única do painel (Nebula Core) | Sim — reestruturado, novos cards |
| `manifest.webmanifest` | Metadados PWA (nome, ícones, standalone) | Sim — nome alinhado |
| `service-worker.js` | Cache-first/offline-first, mesma origem | Sim — precache + versão de cache |
| `css/ipad-runtime.css` | Tema "Ciborgue" + Nebula Core/Siriform | Sim — seção Nebula Core adicionada |
| `js/app.js` | Orquestrador da tela e dos botões | Sim — Siriform, AnalysisFrame, perfis |
| `js/siriform.js` | Máquina de estados do Siriform Avatar | **Novo** |
| `js/feature-detect.js` | Sondas funcionais de cada API do Safari | Não |
| `js/crypto-utils.js` | SHA-256 via Web Crypto, base64 | Não |
| `js/storage.js` | OPFS com fallback para IndexedDB | Não |
| `js/pack-manager.js` | Download/import/verify/install/clear do `.ar10pack` | Sim — `reloadVaultState` agora retorna `reason` |
| `js/replay-engine.js` | Replay BTC/USDT (canvas) via worker | Não |
| `js/diagnostics.js` | Diagnóstico 100% offline | Não |
| `js/worker-client.js` | RPC promise↔postMessage com o Web Worker | Não |
| `workers/quant-worker.js` | Carrega o WASM, roda indicadores fora da UI thread | Não |
| `wasm/cyborg_quant_core.wasm` | Motor real (Rust→WASM), só estatística descritiva | Não |
| `data/btcusdt_replay.json` | Dataset sintético offline (`live: false`) | Não |
| `AR10_CYBORG_LOCAL_PACK_V1.ar10pack` | Pacote de instalação local (JSON+base64) | Não (payload inalterado, checksums confirmados) |
| `pack/manifest.pack.json` | Manifesto legível do pacote | Não |
| `pack/manifest.models.json` | Roadmap WebLLM/Transformers/ONNX (`FUTURE`) | Não |
| `pack/runtime_config.json` | Flags de postura de segurança documentadas | Não |
| `pack/checksums.sha256` | Checksums verificáveis via CLI | Não |
| `README.md` (raiz) | Visão geral do organismo AR10 ORION V5.0 | Sim — seção de cross-link para `ipad_runtime/` |
| `ipad_runtime/README.md` | Documentação do sub-produto iPad | Sim — título alinhado + seção Nebula Core/Siriform |

## Arquivos novos nesta entrega

- `ipad_runtime/js/siriform.js`
- `docs/AR10_CYBORG_2_PANEL_DEPLOY_AND_REPOSITORY_ALIGNMENT_V1.html`
- `docs/DEPLOY_GUIDE.md`
- `docs/IPAD_DIRECT_GUIDE.md`
- `docs/GITHUB_PAGES_FIX.md`
- `docs/PROMOTION_CHECKLIST.md`
- `evidence_outbox/manifest.sha256.json`
- `evidence_outbox/checklist.md`
- `evidence_outbox/main_files.md`

## Arquivos intencionalmente não tocados

`wasm-src/`, `wasm/cyborg_quant_core.wasm`, `data/btcusdt_replay.json`,
`tools/`, `icons/` — nenhuma mudança nesta entrega exigia recompilar o WASM
ou regenerar o dataset/ícones/pacote; o `.ar10pack` continua validando
contra `pack/checksums.sha256` (confirmado via `sha256sum -c`).
