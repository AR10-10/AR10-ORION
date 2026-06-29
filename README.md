# AR10 Cyborg 1.0 PRO — iPad One-Tap Cloud Runtime

Linha ativa de desenvolvimento do projeto AR10. PWA standalone, 100%
local-first, pensado para abrir direto no Safari do iPad via HTTPS — sem
Mac Mini, MacBook, servidor local, terminal ou túnel.

**Link único e oficial:** https://ar10-10.github.io/AR10-ORION/

Sempre `READ_ONLY` / `FAIL_CLOSED`: sem MT5, sem MEXC private endpoint, sem
API secret, sem ordem, sem live trading. Arquitetura completa e guia de
deploy em [`ipad_runtime/README.md`](ipad_runtime/README.md) e
[`docs/DEPLOY_GUIDE.md`](docs/DEPLOY_GUIDE.md).

- Codinome interno: `AR10_CYBORG_2_IPAD_ONE_TAP_CLOUD_RUNTIME_V1`
- Vitrine "Ciborgue" (Nebula Core / Siriform Avatar) com motor quant
  próprio (Rust → WASM, estatística descritiva read-only: sma/ema/stddev/
  zscore), replay BTC/USDT sintético offline e Local Pack Manager
  (`.ar10pack`, verificação SHA-256 via Web Crypto)
- Todo o desenvolvimento ativo do projeto (branch `claude/eloquent-cannon-qyt86y`,
  PR #6) acontece dentro de [`ipad_runtime/`](ipad_runtime/) — único
  diretório publicado pelo GitHub Pages
  (`.github/workflows/deploy-ipad-pwa.yml`)

O esqueleto original do AR10 ORION V5.0 (organismo Python/host local) que
existia neste repositório foi removido — referência histórica apenas em
`git log` (commit `7d8c58b`), não em arquivos vivos. A linha ativa e única é
o AR10 Cyborg 1.0 PRO acima.
