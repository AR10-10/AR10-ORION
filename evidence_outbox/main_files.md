# Main Files — AR10 Cyborg 2.0 iPad Runtime

Evidência de inventário para
`AR10_CYBORG_2_IPAD_LOCAL_VAULT_SAFE_AUTOMATION_POLISH_V1` (Mission 5) —
continuação direta de
`AR10_CYBORG_2_VISUAL_POLISH_MULTI_ASSET_RESEARCH_AND_CONNECTOR_ARCHITECTURE_V1`
(mesmo branch/PR). Todos os caminhos sob `ipad_runtime/` são relativos a
esse diretório. Hashes completos em `manifest.sha256.json` neste mesmo
diretório.

## Arquivos do payload do PWA (carregados pelo runtime)

| Arquivo | Papel | Mudou nesta entrega? |
|---|---|---|
| `index.html` | Tela única do painel | Sim — nova seção `#vault-local-panel` (16 campos de status); 3 novos botões (`btn-check-install`, `btn-update-pack`, `btn-repair-install`) em `local-pack-manager`; rótulos ajustados |
| `manifest.webmanifest` | Metadados PWA | Não |
| `service-worker.js` | Cache-first/offline-first | Sim — `CACHE_VERSION` → `v5` (nenhum arquivo novo no precache; bump necessário para forçar invalidação de cache em clientes já instalados) |
| `css/ipad-runtime.css` | Tema visual completo | Sim — `#vault-local-panel` adicionado aos breakpoints 900px/1300px (140 chaves balanceadas, mesma contagem — só reorganização de seletores existentes, nenhuma classe nova) |
| `js/app.js` | Orquestrador da tela e dos botões | Sim — `refreshVaultLocalPanel()`, 3 novos handlers (`handleCheckLocalInstall`, `handleUpdateLocalPack`, `handleRepairInstall`), `vaultFreshness`, `classFor()` estendido para os rótulos PT-BR do Vault, `handleClearReinstall()` com confirmação detalhada |
| `js/siriform.js` | Máquina de estados do Avatar | Não nesta entrega |
| `js/voice.js` | Siriform Voice Layer (Web Speech API) | Não nesta entrega |
| `js/feature-detect.js` | Sondas funcionais do Safari | Não |
| `js/crypto-utils.js` | SHA-256 via Web Crypto, base64 | Não |
| `js/storage.js` | OPFS com fallback para IndexedDB | Sim — novo export `deleteFile(relPath)` (reaproveita `idbDelete` já existente) para a limpeza segura pós-atualização |
| `js/pack-manager.js` | Download/import/verify/install/clear do `.ar10pack` | Sim — `installToSafariStorage()` reescrita: ordem segura (verifica → grava novo → só então limpa antigo), versão/timestamp no meta do Vault; novo export `getInstalledVaultMeta()` |
| `js/replay-engine.js` | Replay BTC/USDT (canvas) via worker | Não |
| `js/diagnostics.js` | Diagnóstico 100% offline | Não |
| `js/worker-client.js` | RPC promise↔postMessage com o Web Worker | Não |
| `workers/quant-worker.js` | Carrega o WASM, roda indicadores fora da UI thread | Não |
| `wasm/cyborg_quant_core.wasm` | Motor real (Rust→WASM) | Não |
| `data/btcusdt_replay.json` | Dataset sintético offline | Não |
| `AR10_CYBORG_LOCAL_PACK_V1.ar10pack` | Pacote de instalação local | Sim — reempacotado (`tools/build_pack.py`) para embutir `manifest.pack.json` com o novo campo `pack_version`; payload wasm/dataset inalterado, `pack/checksums.sha256` confirma |
| `pack/manifest.pack.json` | Manifesto legível do pacote | Sim — novo campo `pack_version: "1.0.0"`, usado pela comparação local-vs-remoto em `handleUpdateLocalPack`/`handleCheckLocalInstall` |
| `pack/manifest.models.json` | Roadmap Meta Llama/Transformers/ONNX | Não |
| `pack/runtime_config.json` | Flags de postura de segurança | Não |
| `pack/checksums.sha256` | Checksums verificáveis via CLI | Regenerado (valores idênticos — payload binário não mudou) |

## Documentação atualizada nesta entrega (conteúdo, não renomeada)

- `docs/READ_ONLY_MARKET_SAFETY.md` — 13ª lei `NO_FAKE_LOCAL_AI_CLAIMS`
  adicionada (bloco verbatim, linha de tabela, nota explicativa); todas
  as referências "12 leis" no arquivo corrigidas para "13 leis".
- `docs/PROMPT_CACHING_AND_AGENT_CONTEXT_STRATEGY.md` — Stable Block 02
  ganhou `NO_FAKE_LOCAL_AI_CLAIMS`; referência "12 leis" → "13 leis".
- `docs/DATA_SOURCE_MATRIX.md` — referência "12 leis" → "13 leis" na
  seção "Ver também".
- `docs/IPAD_PWA_VISUAL_POLISH_HANDOFF.md` — referência "12 leis" → "13
  leis" na tabela de relação com outros documentos.
- `ipad_runtime/README.md` — cadeia de cards do painel corrigida para
  incluir `cyborg-readiness-panel`/`voice-status-panel` (já existentes
  desde a Mission 4, nunca citados nesta prosa) e `vault-local-panel`
  (novo); contagem de botões do Local Pack Manager corrigida para 13.
- `evidence_outbox/manifest.sha256.json`, `evidence_outbox/checklist.md`,
  `evidence_outbox/main_files.md` (este arquivo).

## Arquivos confirmados sem mudança nesta entrega

- `docs/GITHUB_PAGES_FIX.md`, `docs/DEPLOY_GUIDE.md`,
  `docs/PROMOTION_CHECKLIST.md`, `docs/IPAD_DIRECT_GUIDE.md`,
  `docs/CONNECTOR_REGISTRY_DESIGN.md`,
  `docs/FUTURE_READY_ASSET_CLASS_REGISTRY.md`,
  `docs/MULTI_ASSET_RESEARCH_LIBRARY.md`, `docs/STRATEGY_PLAYBOOK.md`,
  `docs/ANALYSIS_OUTPUT_CONTRACT.md`,
  `docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md`,
  `docs/META_LLAMA_WEBLLM_ROUTE.md`.
- `js/siriform.js`, `js/voice.js` — fora do escopo desta sessão (camada
  de voz não tocada na Mission 5).
- `wasm-src/`, `wasm/cyborg_quant_core.wasm`, `data/btcusdt_replay.json`,
  `icons/` — nenhuma mudança nesta entrega exigia recompilar o WASM ou
  regenerar dataset/ícones.
- `ipad_runtime/configs/*.json`, `ipad_runtime/src/research/**` —
  scaffolding da Mission 4, não tocado nesta missão.

## Arquivos intencionalmente não criados nesta entrega

Nenhum conector com `enabled_now: true`, nenhuma chamada de rede real,
nenhum modelo Meta Llama embutido, nenhuma lógica de decisão real no
`decision-frame-panel` (continua `STUB CONTROLLED`), nenhuma função de
envio de ordem em nenhuma camada nova (`vl-*`, novos handlers,
`deleteFile`). O novo painel "Vault Local do iPad" e o fluxo de
salvamento/atualização automática **leem e descrevem mais** o estado
local — nunca **executam mais** do que o runtime já fazia antes desta
missão.
