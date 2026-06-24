# Main Files — AR10 Cyborg 2.0 iPad Runtime

Evidência de inventário para
`AR10_CYBORG_2_REAL_IPAD_HOLD_FIX_NATIVE_APP_SHELL_ONE_BUTTON_HEADER_VAULT_EXPORT_V1`
(Mission 7) — continuação direta de
`AR10_CYBORG_2_IPAD_LANDSCAPE_VAULT_AUTOSAVE_EXPORT_AND_REAL_DATA_POLICY_FIX_V1`
(Mission 6, mesmo branch/PR). Caminhos sob `ipad_runtime/` relativos a esse
diretório. Hashes completos em `manifest.sha256.json` neste mesmo diretório.

Esta missão nasceu de feedback real de uso num iPad físico (screenshot):
cabeçalho cortado à esquerda, sensação de "página web" em vez de app nativo,
beco sem saída na instalação ausente, painel de exportação mostrando nomes
genéricos como se já tivessem sido exportados, e excesso de áreas
avançadas/técnicas dominando a tela principal. Nenhuma lei de segurança foi
tocada — apenas estrutura visual, copy e fluxo de UI.

## Arquivos do payload do PWA (carregados pelo runtime)

| Arquivo | Papel | Mudou nesta entrega? |
|---|---|---|
| `index.html` | Tela única do painel | Sim — novo `<header class="app-topbar">` fora de `.runtime-shell` (substitui `.mode-banner`); botão único `.hero-cta` (`btn-prepare-cyborg`) dentro do `.bento`; todos os painéis técnicos/avançados movidos para `<section class="advanced-section" hidden>`; removido botão `id` duplicado e `btn-update-pack` (superado pelo topbar); rótulos de manutenção renomeados (Fase 7); rodapé reduzido a 1 linha |
| `manifest.webmanifest` | Metadados PWA | Não |
| `service-worker.js` | Cache-first/offline-first | Sim — `CACHE_VERSION` → `v7` (nenhum arquivo novo no precache, apenas invalidação do cache antigo com o HTML/CSS/JS reestruturados) |
| `css/ipad-runtime.css` | Tema visual completo | Sim — `.mode-banner` (técnica de bleed com margem negativa, causa raiz do corte real no iPad) **removida por completo**; novo `.app-topbar`/`.tb-left`/`.tb-center`/`.tb-right`/`.tb-chip`/`.tb-btn` só com padding positivo + `env(safe-area-inset-*)`; `.nebula-header` morto removido; estados do Siriform renomeados/expandidos (`idle/listening/thinking/updating/checking/repairing/success/warning/blocked`); `.hero-cta`; `.export-name-empty`; regra universal `prefers-reduced-motion`; `.advanced-section` somada às mesmas media queries multicoluna do `.bento` |
| `js/app.js` | Orquestrador da tela e dos botões | Sim — `handlePrepareCyborg()` novo (fluxo único de 1 botão: verifica Safari/SW/cache/pacote/Vault, repara antes de reinstalar, baixa só se necessário, valida SHA256/WASM/replay, termina em "Cyborg pronto neste iPad."); `handleCheckLocalInstall()` reescrito para nunca terminar em beco sem saída (estado nunca instalado vs. corrompido com auto-reparo primeiro); `refreshTopbarStatus()` novo; `wireAdvancedToggle()` novo; vocabulário de estados do Siriform migrado |
| `js/siriform.js` | Máquina de estados do Avatar | Sim — vocabulário de estados migrado para `idle/listening/thinking/updating/checking/repairing/success/warning/blocked` (cobre Fase 6 por completo) |
| `js/voice.js` | Siriform Voice Layer | Não (track de voz é independente do estado visual do orb) |
| `js/feature-detect.js` | Sondas funcionais do Safari | Não |
| `js/crypto-utils.js` | SHA-256 via Web Crypto, base64 | Não |
| `js/storage.js` | OPFS com fallback IndexedDB | Não |
| `js/pack-manager.js` | Download/import/verify/install/clear/repair do `.ar10pack` | Não (Mission 6 já tinha `autoRepairVault()`/`rebuildIndexFromStorage()`; esta missão só consome essas funções de um jeito mais guiado a partir do `app.js`) |
| `js/export-manifest.js` | Nomes únicos carimbados + registro de exportações + lista do painel | Não (lógica já correta desde Mission 6; Fase 4 desta missão foi só a exibição honesta no `app.js`/CSS) |
| `js/data-policy.js` | Política de dados de mercado em runtime | Não |
| `js/replay-engine.js` | Replay BTC/USDT (canvas) via worker | Não |
| `js/diagnostics.js` | Diagnóstico offline | Não |
| `js/worker-client.js` | RPC com o Web Worker | Não |
| `workers/quant-worker.js` | Carrega o WASM, roda indicadores | Não |
| `wasm/cyborg_quant_core.wasm` | Motor real (Rust→WASM) | Não |
| `data/btcusdt_replay.json` | Dataset sintético offline | Não |
| `AR10_CYBORG_LOCAL_PACK_V1.ar10pack` | Pacote de instalação local | Não — payload byte-idêntico |
| `pack/manifest.pack.json` | Manifesto legível | Não |
| `pack/manifest.models.json` | Roadmap de modelos | Não |
| `pack/runtime_config.json` | Flags de postura de segurança | Não |
| `pack/checksums.sha256` | Checksums via CLI | Não |

## Configuração (`ipad_runtime/configs/`)

Nenhuma mudança nesta missão — todos os arquivos de `configs/` são iguais à
Mission 6.

## Documentação

Nenhum arquivo em `docs/` foi alterado nesta missão — as 14 leis de
segurança e a política de dados reais já estavam corretas e completas desde
a Mission 6. Esta missão é puramente estrutural/visual no `ipad_runtime/`.

## Evidência (`evidence_outbox/`)

- `EXPORT_MANIFEST.json` — campo `generated_for` atualizado para a Mission 7;
  inventário de artefatos exportáveis inalterado (mesma política de nome
  único, mesmo `js/export-manifest.js`).
- `manifest.sha256.json` — `generated_for`/`continues_from` atualizados;
  hashes recalculados para os 5 arquivos que mudaram de conteúdo nesta
  missão (`index.html`, `service-worker.js`, `css/ipad-runtime.css`,
  `js/app.js`, `js/siriform.js`); as demais 19 entradas permanecem
  byte-idênticas à Mission 6.
- `checklist.md`, `main_files.md` (este arquivo) — reescritos para a
  Mission 7.

## Arquivos intencionalmente não criados/alterados

Nenhum conector com `enabled_now: true`, nenhuma chamada de rede real,
nenhum endpoint privado, nenhuma função de ordem/execução, nenhum modelo
embutido. Nenhum dos módulos JS ganhou `fetch`/`XHR`/`WebSocket` novo nesta
missão. As 14 leis de segurança (`READ_ONLY`, `FAIL_CLOSED`, `LOCAL_FIRST`,
`NO_REAL_TRADING`, `NO_ORDER_EXECUTION`, `NO_API_SECRET`,
`NO_PRIVATE_KEYS`, `NO_MEXC_PRIVATE`, `NO_MT5_ORDER_SEND`,
`NO_ORDER_BY_LLM`, `NO_ORDER_BY_VOICE`, `NO_SECRET_IN_LOCALSTORAGE`,
`NO_FAKE_DATA`, `NO_FAKE_LOCAL_AI_CLAIMS`) não foram tocadas — esta missão
reorganiza **como a UI apresenta e guia** o que o runtime já fazia, nunca
**o que ele executa**. Execução permanece `DISABLED_BY_POLICY`.
