# Fusion Research Quarantine

Codinome interno: `AR10_CYBORG_FUSION_RESEARCH_QUARANTINE_V1`.

**Status desta árvore: apenas os 2 engines graduados abaixo são ACTIVE_READ_ONLY.
Todo o restante foi excluído em 2026-06-30 (purge de código morto).**

## Estado atual do diretório

```
src/research/
├── QUARANTINE.md                   ← este arquivo
└── engines/
    ├── support-resistance-engine.js   ACTIVE_READ_ONLY (graduado 2026-06-25)
    └── market-structure-engine.js     ACTIVE_READ_ONLY (graduado 2026-06-25)
```

**Removidos em 2026-06-30 (purge):**
- `connectors/` — diretório inteiro (13 stubs binance, coingecko, coinglass, custom,
  google-finance, mexc, mexc-realstocks, mexc-stock-futures, mt5, native-companion,
  registry, tradingview, yahoo-finance). Nenhum tinha import real; todos declaravam
  `current_status: 'FUTURE'` e nunca foram importados por `js/**`.
- `engines/momentum-engine.js`, `volatility-regime-engine.js`, `funding-oi-engine.js`,
  `futures-flow-engine.js`, `liquidity-engine.js`, `retracement-engine.js`,
  `trend-engine.js`, `risk-engine.js`, `volume-profile-engine.js`,
  `scenario-builder.js`, `signal-fusion-engine.js`, `index.js` — 12 stubs inativos,
  todos `status: 'FUTURE'`, zero import real.

## Engines graduados (ACTIVE_READ_ONLY)

- **`engines/support-resistance-engine.js`** — pivots/swing high-low (método fractal)
  + extensão de Fibonacci sobre candles reais de `js/real-data/mexc-public.js`.
  Importado por `js/real-data/analysis-frame.js`. Zero `fetch()` novo, zero
  credencial, zero `order_send`.
- **`engines/market-structure-engine.js`** — detecção de HH/HL/LH/LL (swing structure)
  sobre os mesmos candles reais. Importado por `js/real-data/analysis-frame.js`.
  Zero `fetch()` novo, zero credencial, zero `order_send`.

Ambos adicionados a `PRECACHE_URLS` em `service-worker.js` na graduação (v-25 →
v-26, 2026-06-25). Ambos são funções puras de cálculo, sem estado global, sem
import reverso de volta para `js/**`.

## Regra de quarentena daqui para frente

Nenhum arquivo de `src/research/**` pode ser importado por `js/**` sem,
no mesmo commit:

1. Implementar lógica real (não só trocar o status com stub por baixo) e atualizar
   `current_status` de `'FUTURE'`/`'PLANNED'` para um valor real.
2. Adicionar o(s) arquivo(s) a `PRECACHE_URLS` em `ipad_runtime/service-worker.js` —
   import novo sem precache quebra a 1ª navegação offline.
3. Se o módulo exigir rede real, adicionar o domínio à CSP `connect-src` de
   `ipad_runtime/index.html` como diff isolado e revisável.
4. Se o módulo exigir credencial, resolver via política equivalente a
   `WindowsLocalSecretPolicy`/`TelegramAuxSecretPolicy` — nunca no frontend,
   nunca no repositório, nunca no storage do PWA.
