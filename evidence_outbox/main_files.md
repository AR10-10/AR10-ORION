# Main Files — AR10 Cyborg 2.0 iPad Runtime

Evidência de inventário para
`AR10_CYBORG_2_VISUAL_POLISH_MULTI_ASSET_RESEARCH_AND_CONNECTOR_ARCHITECTURE_V1`
— continuação direta de `AR10_CYBORG_2_FINAL_IPAD_ONE_LINK_SIRIFORM_LLAMA_DEPLOY_V1`
(mesmo branch/PR). Todos os caminhos sob `ipad_runtime/` são relativos a
esse diretório. Hashes completos em `manifest.sha256.json` neste mesmo
diretório.

## Arquivos do payload do PWA (carregados pelo runtime)

| Arquivo | Papel | Mudou nesta entrega? |
|---|---|---|
| `index.html` | Tela única do painel | Sim — `cyborg-readiness-panel` (resumo de 14 campos), `.onboarding-hint` |
| `manifest.webmanifest` | Metadados PWA | Não |
| `service-worker.js` | Cache-first/offline-first | Sim — `CACHE_VERSION` → `v4` (nenhum arquivo novo no precache; bump necessário para forçar invalidação de cache em clientes já instalados) |
| `css/ipad-runtime.css` | Tema visual completo | Sim — estilos do Cyborg Readiness Panel e do onboarding hint (140 chaves balanceadas, +4 vs. entrega anterior) |
| `js/app.js` | Orquestrador da tela e dos botões | Sim — `refreshCyborgReadiness()`, ramo `MISSING`→`v-fail` em `classFor()`, ids `cr-*` |
| `js/siriform.js` | Máquina de estados do Avatar | Não nesta entrega |
| `js/voice.js` | Siriform Voice Layer (Web Speech API) | Não nesta entrega |
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
| `AR10_CYBORG_LOCAL_PACK_V1.ar10pack` | Pacote de instalação local | Sim — reempacotado (`tools/build_pack.py`) só para embutir `manifest.models.json` corrigido; payload wasm/dataset inalterado, `pack/checksums.sha256` confirma |
| `pack/manifest.pack.json` | Manifesto legível do pacote | Não |
| `pack/manifest.models.json` | Roadmap Meta Llama/Transformers/ONNX | Sim — 1 link de doc corrigido (`META_LLAMA_WEB_NATIVE_ROUTE.md` → `META_LLAMA_WEBLLM_ROUTE.md`) |
| `pack/runtime_config.json` | Flags de postura de segurança | Não |
| `pack/checksums.sha256` | Checksums verificáveis via CLI | Regenerado (valores idênticos — payload binário não mudou) |

## Configuração nova (`ipad_runtime/configs/`) — não carregada em runtime, registro/documentação

| Arquivo | Papel |
|---|---|
| `asset-universe.default.json` | Universo de classes de ativo (crypto_spot/futures, stock_futures_synthetic, equities_real, etf, index, fx, custom_user_defined) com `security_posture` idêntico ao do pack |
| `asset-universe.schema.json` | Contrato de schema do arquivo acima |
| `connector-registry.default.json` | Fonte de verdade de 14 conectores (capacidades, status, risco, `execution_supported: false` nas 14) |
| `data-sources.readonly.json` | View derivada e gerada programaticamente do registro acima, filtrada para o subconjunto read-only |
| `strategy-playbook.default.json` | Espelho estruturado de `docs/STRATEGY_PLAYBOOK.md` |

## Scaffolding nova (`ipad_runtime/src/research/`) — stubs, não conectados ao `index.html`

- `connectors/{mexc,mexc-stock-futures,mexc-realstocks,binance,coingecko,coinglass,yahoo-finance,google-finance,tradingview,custom,mt5,native-companion}/index.js` (12 conectores) + `connectors/registry/index.js` (agregador) — 13 arquivos.
- `engines/{trend,momentum,volatility-regime,support-resistance,retracement,volume-profile,liquidity,market-structure,funding-oi,futures-flow,risk,signal-fusion,scenario-builder}-engine.js` (13 motores) + `engines/index.js` (agregador) — 14 arquivos.

## Documentação nova nesta entrega (`docs/`)

- `docs/READ_ONLY_MARKET_SAFETY.md`
- `docs/IPAD_PWA_VISUAL_POLISH_HANDOFF.md`
- `docs/PROMPT_CACHING_AND_AGENT_CONTEXT_STRATEGY.md`
- `docs/CONNECTOR_REGISTRY_DESIGN.md`
- `docs/DATA_SOURCE_MATRIX.md`
- `docs/FUTURE_READY_ASSET_CLASS_REGISTRY.md`
- `docs/MULTI_ASSET_RESEARCH_LIBRARY.md`
- `docs/STRATEGY_PLAYBOOK.md`
- `docs/ANALYSIS_OUTPUT_CONTRACT.md`

## Documentação renomeada nesta entrega (conteúdo expandido, não só nome)

- `docs/META_LLAMA_WEB_NATIVE_ROUTE.md` → `docs/META_LLAMA_WEBLLM_ROUTE.md`
- `docs/APPLE_INTELLIGENCE_AND_SIRI_ROUTE.md` → `docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md`

## Documentação atualizada nesta entrega (conteúdo, não renomeada)

- `docs/DATA_SOURCE_MATRIX.md` — seção "Ver também" passou a citar
  `data-sources.readonly.json` e `READ_ONLY_MARKET_SAFETY.md`.
- `docs/PROMPT_CACHING_AND_AGENT_CONTEXT_STRATEGY.md` — Stable Block 02
  passou a citar `READ_ONLY_MARKET_SAFETY.md` como referência expandida
  das mesmas 12 leis.
- `docs/FINAL_IPAD_ONE_LINK_GUIDE.md` — pequeno ajuste já presente no
  working tree antes desta sessão (sem relação com o gap de
  documentação fechado aqui).
- `evidence_outbox/manifest.sha256.json`, `evidence_outbox/checklist.md`,
  `evidence_outbox/main_files.md` (este arquivo).

## Arquivos confirmados sem mudança nesta entrega

- `docs/GITHUB_PAGES_FIX.md`, `docs/DEPLOY_GUIDE.md`,
  `docs/PROMOTION_CHECKLIST.md`, `docs/IPAD_DIRECT_GUIDE.md`.
- `js/siriform.js`, `js/voice.js` — não fazia parte do escopo desta
  sessão (Fase B de voz já entregue anteriormente); confirmados ainda
  consistentes com a documentação nova (`READ_ONLY_MARKET_SAFETY.md`,
  `IPAD_PWA_VISUAL_POLISH_HANDOFF.md`) por leitura cruzada.
- `wasm-src/`, `wasm/cyborg_quant_core.wasm`, `data/btcusdt_replay.json`,
  `icons/` — nenhuma mudança nesta entrega exigia recompilar o WASM ou
  regenerar dataset/ícones.

## Arquivos intencionalmente não criados nesta entrega

Nenhum conector com `enabled_now: true`, nenhuma chamada de rede real
para MEXC/Binance/CoinGecko/CoinGlass/Yahoo/Google/MT5, nenhum modelo
Meta Llama embutido, nenhuma lógica de decisão real no
`decision-frame-panel` (continua `STUB CONTROLLED`). Todo o scaffolding
de `src/research/` é estrutura/contrato — não há rota de execução nova
em nenhum arquivo desta entrega.
