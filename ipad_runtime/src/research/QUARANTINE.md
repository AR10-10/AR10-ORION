# Fusion Research Quarantine

Codinome interno: `AR10_CYBORG_FUSION_RESEARCH_QUARANTINE_V1`.

**Status desta árvore: apenas os 4 engines graduados + 1 utilitário
compartilhado abaixo são ACTIVE_READ_ONLY. Todo o restante foi excluído em
2026-06-30 (purge de código morto).**

**Correção (Auditoria Mestra 360°, secao 4 / remediação item 2, 2026-07-03):
`fvg-order-block-engine.js` e `lorentzian-classifier.js` já estavam
graduados e importados por `ramber-ui/src/engine-bridge.ts` desde
2026-07-01 (`metadata.status: 'ACTIVE_READ_ONLY'` em ambos), mas nunca
haviam sido acrescentados a este documento — este é um puro gap de
documentação, não um problema de código: nenhum dos dois faz `fetch()`
novo, usa credencial ou chama `order_send`.**

## Estado atual do diretório

```
src/research/
├── QUARANTINE.md                   ← este arquivo
└── engines/
    ├── support-resistance-engine.js   ACTIVE_READ_ONLY (graduado 2026-06-25)
    ├── market-structure-engine.js     ACTIVE_READ_ONLY (graduado 2026-06-25)
    ├── fvg-order-block-engine.js      ACTIVE_READ_ONLY (graduado 2026-07-01)
    ├── lorentzian-classifier.js       ACTIVE_READ_ONLY (graduado 2026-07-01)
    ├── bos-choch-engine.js            ACTIVE_READ_ONLY (graduado 2026-07-12)
    └── fractal-swings.js              utilitário compartilhado (extraído 2026-07-03,
                                        não é um engine — ver secao "Utilitários" abaixo)
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
  credencial, zero `order_send`. (V11.5 Fase 6, 2026-07-03) Cada nível também
  ganha uma classificação FORTE/FRACA por confluência real de swings
  (`resistance_1_strength`/`resistance_2_strength`/`support_1_strength`/
  `support_2_strength`) — contagem determinística, nunca uma probabilidade
  estatística (sem backtest neste repositório para sustentar isso). O
  Risk:Reward real (`risk_reward_ratio`, razão de distâncias já reais) foi
  adicionado em `js/research/target-tracker.js`, não aqui.
- **`engines/market-structure-engine.js`** — detecção de HH/HL/LH/LL (swing structure)
  sobre os mesmos candles reais. Importado por `js/real-data/analysis-frame.js`.
  Zero `fetch()` novo, zero credencial, zero `order_send`.

Ambos adicionados a `PRECACHE_URLS` em `service-worker.js` na graduação (v-25 →
v-26, 2026-06-25). Ambos são funções puras de cálculo, sem estado global, sem
import reverso de volta para `js/**`.

- **`engines/fvg-order-block-engine.js`** (graduado 2026-07-01) — Fair Value
  Gaps, Order Blocks e zonas de liquidez (Equal Highs/Equal Lows) — Smart
  Money Concepts — detectados por padrão geométrico determinístico sobre os
  mesmos candles reais do gráfico. Importado por
  `ramber-ui/src/engine-bridge.ts`. Zero `fetch()` novo, zero credencial,
  zero `order_send`. Sem candles suficientes, retorna `DADOS_INSUFICIENTES`
  — nunca inventa uma zona.
- **`engines/lorentzian-classifier.js`** (graduado 2026-07-01) — classificador
  k-NN Lorentziano, um sinal de confluência INDEPENDENTE do Core Engine
  (nunca gate/sobrescreve o LONG/SHORT/WAIT primário). Importado por
  `ramber-ui/src/engine-bridge.ts`. Reporta sempre `sampleSize` junto da
  classificação — amostra pequena nunca vira confiança inflada.
- **`engines/bos-choch-engine.js`** (graduado 2026-07-12, Ordem "Ciborgue
  Vivo") — Break of Structure / Change of Character: reaproveita
  `fractal-swings.js` e o `structure_label` de `market-structure-engine.js`
  (zero segunda detecção de swing/estrutura), só adiciona a varredura real
  de rompimento por fechamento além do último swing confirmado. Importado
  por `ramber-ui/src/engine-bridge.ts`. Display only (LEI 24) — alimenta
  anotações temporárias no gráfico e o alerta de estrutura, nunca uma
  segunda decisão de trading. Zero `fetch()` novo, zero credencial, zero
  `order_send`.

Nota sobre `PRECACHE_URLS`: em 2026-07-03 (Auditoria Mestra 360°, secao 2) o
`service-worker.js` atual foi confirmado como um shim de autodestruição (zero
`PRECACHE_URLS`, `activate` limpa todos os caches e força
`unregister()`) — a app React de produção não depende de cache-first
precache algum hoje. A regra de quarentena abaixo permanece escrita para
`js/**` (a árvore vanilla, que ainda usa esse mecanismo); os dois engines
acima foram importados por `ramber-ui/src/engine-bridge.ts` (TypeScript/React),
não por `js/**`, e por isso não se aplicam ao passo 2 da regra abaixo.

## Utilitários compartilhados (não são engines, não têm `metadata.status`)

- **`engines/fractal-swings.js`** (extraído 2026-07-03, remediação item 5 da
  Auditoria Mestra 360°) — `FRACTAL_K`/`findSwings()`, o algoritmo de detecção
  de swing high/low por confirmação fractal (K=2 candles de cada lado) que
  antes estava triplicado, quase idêntico, em `support-resistance-engine.js`,
  `market-structure-engine.js` e `fvg-order-block-engine.js` — cada um com sua
  própria constante `FRACTAL_K` redeclarada. Sem lógica própria de sinal, só a
  primitiva geométrica compartilhada; os três engines acima o importam.

## Laboratório de backtest (nunca caminho de produção)

- **`backtest/structural-backtest.js`** (2026-07-20, fase 1 da iniciativa
  "histórico real + backtest honesto" — a única evolução nomeada como mais
  importante na conclusão da Diretriz de Evolução de Produto, autorizada
  pelo Operador). Medidor de desfechos estruturais em walk-forward: reusa o
  Motor de Replay REAL (`src/replay/`) e os engines graduados candle-only
  (`market-structure-engine` + `support-resistance-engine`) — zero
  matemática de mercado nova; a regra estrutural é de MEDIÇÃO do
  laboratório, documentada no cabeçalho. Saída = CONTAGEM de eventos da
  amostra com aviso de honestidade gravado no contrato ("NUNCA
  probabilidade futura, NUNCA o desempenho do sistema completo ao vivo").
  Status: **LABORATÓRIO** — nenhum módulo de produção importa daqui
  (fronteira travada por teste em
  `ramber-ui/tests/structural-backtest.test.ts`); só se aplica a regra de
  quarentena abaixo se um dia for graduado, o que exigirá antes a fase 2
  (captura/armazenamento de histórico REAL — sem ela, qualquer número
  daqui descreve apenas a série fornecida).

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
