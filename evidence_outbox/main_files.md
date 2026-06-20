# Main Files — AR10 Cyborg 2.0 iPad Runtime

Evidência de inventário para
`AR10_CYBORG_2_IPAD_LANDSCAPE_VAULT_AUTOSAVE_EXPORT_AND_REAL_DATA_POLICY_FIX_V1`
(Mission 6) — continuação direta de
`AR10_CYBORG_2_IPAD_LOCAL_VAULT_SAFE_AUTOMATION_POLISH_V1` (mesmo
branch/PR). Caminhos sob `ipad_runtime/` relativos a esse diretório. Hashes
completos em `manifest.sha256.json` neste mesmo diretório.

## Arquivos do payload do PWA (carregados pelo runtime)

| Arquivo | Papel | Mudou nesta entrega? |
|---|---|---|
| `index.html` | Tela única do painel | Sim — wrapper `.bento` para o layout paisagem; painel `data-policy-panel`; painel `export-panel`; rótulos de diagnóstico no replay/analysis; "Logs do Sistema" → "Telemetria ao Vivo" com `telemetry-latest` |
| `manifest.webmanifest` | Metadados PWA | Não |
| `service-worker.js` | Cache-first/offline-first | Sim — `CACHE_VERSION` → `v6`; precache passa a incluir `js/export-manifest.js` e `js/data-policy.js` |
| `css/ipad-runtime.css` | Tema visual completo | Sim — layout paisagem reescrito (grade explícita → multicoluna balanceada `.bento`); estilos de `.diagnostic-note`, `.data-policy-panel`, `.export-panel`/`.export-row`/`.export-tag`, `.telemetry-latest`/`.telemetry-card` |
| `js/app.js` | Orquestrador da tela e dos botões | Sim — imports de `export-manifest`/`data-policy`; `telemetry-latest` em `log()`; `refreshDataPolicyPanel()`/`renderExportPanel()`; `handleExportReport()`/`handleExportEvidence()`; `handleRepairInstall()` via `autoRepairVault()`; auto-reparo no boot; fluxos internos usam `fetchLocalPack()` |
| `js/siriform.js` | Máquina de estados do Avatar | Não |
| `js/voice.js` | Siriform Voice Layer | Não |
| `js/feature-detect.js` | Sondas funcionais do Safari | Não |
| `js/crypto-utils.js` | SHA-256 via Web Crypto, base64 | Não |
| `js/storage.js` | OPFS com fallback IndexedDB | Não (Mission 5 já adicionou `deleteFile`; reusado por `installToSafariStorage`/auto-reparo) |
| `js/pack-manager.js` | Download/import/verify/install/clear/repair do `.ar10pack` | Sim — `fetchLocalPack()` (memória, sem download) separado de `downloadLocalPack()` (nome único); `rebuildIndexFromStorage()` e `autoRepairVault()` novos; import de `export-manifest` |
| `js/export-manifest.js` | **NOVO** — nomes únicos carimbados + registro de exportações + lista do painel | Sim (novo) |
| `js/data-policy.js` | **NOVO** — política de dados de mercado em runtime (espelha o config) | Sim (novo) |
| `js/replay-engine.js` | Replay BTC/USDT (canvas) via worker | Não |
| `js/diagnostics.js` | Diagnóstico offline | Não |
| `js/worker-client.js` | RPC com o Web Worker | Não |
| `workers/quant-worker.js` | Carrega o WASM, roda indicadores | Não |
| `wasm/cyborg_quant_core.wasm` | Motor real (Rust→WASM) | Não |
| `data/btcusdt_replay.json` | Dataset sintético offline | Não |
| `AR10_CYBORG_LOCAL_PACK_V1.ar10pack` | Pacote de instalação local | Não — payload byte-idêntico (nenhum manifesto/binário mudou nesta missão) |
| `pack/manifest.pack.json` | Manifesto legível | Não |
| `pack/manifest.models.json` | Roadmap de modelos | Não |
| `pack/runtime_config.json` | Flags de postura de segurança | Não |
| `pack/checksums.sha256` | Checksums via CLI | Não (regenerado idêntico) |

## Configuração nova/atualizada (`ipad_runtime/configs/`)

| Arquivo | Papel | Mudou? |
|---|---|---|
| `market-data-policy.json` | **NOVO** — fonte declarativa da política de dados reais (espelha `js/data-policy.js`) | Sim (novo) |
| `asset-universe*.json`, `connector-registry.default.json`, `data-sources.readonly.json`, `strategy-playbook.default.json` | Scaffolding da Mission 4 | Não |

## Documentação

- `docs/REAL_DATA_POLICY.md` — **NOVO**: dados sintéticos (diagnóstico) vs.
  dados reais (fonte pública/somente-leitura ou `DADOS INSUFICIENTES`).
- `docs/READ_ONLY_MARKET_SAFETY.md` — 14ª lei `LOCAL_FIRST` adicionada
  (bloco verbatim + linha de tabela); auto-reparo descrito em `FAIL_CLOSED`;
  ref a `REAL_DATA_POLICY.md`; contagem "13 leis" → "14 leis".
- `docs/PROMPT_CACHING_AND_AGENT_CONTEXT_STRATEGY.md` — `LOCAL_FIRST` no
  bloco de leis (Stable Block 02); "13 leis" → "14 leis".
- `docs/DATA_SOURCE_MATRIX.md` — "13 leis" → "14 leis"; ref a
  `REAL_DATA_POLICY.md`.
- `docs/IPAD_PWA_VISUAL_POLISH_HANDOFF.md` — "13 leis" → "14 leis".
- `ipad_runtime/README.md` — cadeia de cards atualizada (bento paisagem,
  `data-policy-panel`, `export-panel`, Telemetria) e auto-reparo do Vault.

## Evidência (`evidence_outbox/`)

- `EXPORT_MANIFEST.json` — **NOVO** (política de nome único + inventário de
  artefatos exportáveis).
- `manifest.sha256.json` — regenerado (24 entradas, +`export-manifest.js`,
  +`data-policy.js`; hashes novos para `index.html`, `css`, `app.js`,
  `pack-manager.js`, `service-worker.js`).
- `checklist.md`, `main_files.md` (este arquivo) — reescritos para Mission 6.

## Arquivos intencionalmente não criados/alterados

Nenhum conector com `enabled_now: true`, nenhuma chamada de rede real,
nenhum endpoint privado, nenhuma função de ordem/execução, nenhum modelo
embutido. Os dois módulos novos (`export-manifest.js`, `data-policy.js`) não
fazem rede (sem `fetch`/`XHR`/`WebSocket`). A análise de mercado real é
honestamente `DADOS INSUFICIENTES` (NO_FAKE_DATA). O novo layout paisagem,
o auto-reparo e os exports **leem e descrevem mais** — nunca **executam
mais** do que o runtime já fazia.
