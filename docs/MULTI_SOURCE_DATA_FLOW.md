# AR10-CYBORG — Multi-Source Data Flow

> Deliverable of the "Multi-Source Ingestion + Real-Time Synchronization" order.
> English is the standard language for all new code, comments and documentation.
> Companion document: `docs/ORGANISM_DATA_FLOW.md` (central orchestration layer).

## The pipeline

```
1. SOURCES (real public endpoints only — no API keys, read-only by design)
   BINANCE  Futures WebSocket  ticker + L2 depth (primary live feed, drives cockpit)
   BINANCE  Futures REST       klines/candles (Market Data Bus), funding, open interest,
                               forced-liquidation stream (public WS)
   MEXC     Spot REST          last price + real L2 depth (cross-exchange/mexc-spot.ts)
                               + trade-by-trade feed for the Order Flow Engine
   BYBIT    Perp REST          mark price (cross-exchange/bybit-futures.ts)
   OKX      Perp REST          mark price (cross-exchange/okx-futures.ts)
        │
        ▼
2. NORMALIZATION LAYER
   Every connector is a pure extractor + a thin fetch wrapper:
   extract<Source>PerpTicker(json) → PerpTicker { ok, price, fundingRate, openInterest }
   mexcDepthToSnapshot(json)       → { ok, bids[], asks[] }   (price/size levels,
                                     asks descending — one convention system-wide)
   Market Data Bus (ipad_runtime/src/market-data-bus/) normalizes and
   integrity-validates candle series before any consumer sees them.
   Malformed payloads fail closed: ok:false / empty — never a fabricated value.
        │
        ▼
3. UNIFIED GLOBAL SNAPSHOT (src/store/unified-snapshot-store.ts)
   The fusion object, organized by domain (§1 MARKET → §5 ORGANISM).
   One slice per datum, one owner per slice. Explicit null = honest degradation.
        │
        ▼
4. TYPED EVENT BUS (src/nexus/event-bus.ts + organism-orchestrator.ts)
   Every real slice write is translated into exactly one typed event
   (payload = the same reference written to the store, zero copy).
   One publisher per event type, never two.
        │
        ▼
5. CONSUMERS
   UI (atomic selectors — each component re-renders only when ITS slice changes)
   Chart (live-candle-sync.ts folds the real ticker price into the forming candle
   via series.update() — sub-second bar/chart synchronization, engines untouched)
   Engines (read exclusively via getSnapshotForEngine(), publish via store writes)
```

## Real-time synchronization guarantees

- **Top bar ↔ chart**: both read the same real WebSocket ticker. The forming
  candle is patched via `nexus/live-candle-sync.ts` (pure, fail-closed: it
  never fabricates a new bar's open — only the REST/kline feed opens bars).
  Measured staleness dropped from up to **30,000 ms** (REST resync cadence)
  to the **WebSocket tick cadence (sub-second)** — the same freshness as the bar.
- **Motors ↔ UI**: both read the same `UnifiedGlobalSnapshot` state. Structural
  engines (SMC / Fibonacci / Volume Profile) recompute only on a real new or
  closed candle, never per price tick — Main Thread stays sacred.
- **Cross-source consistency**: Bybit/OKX mark prices feed the TrustScore
  divergence metric (perp vs perp). MEXC Spot participates in the visual
  cross-check but deliberately NOT in TrustScore: spot vs perp carries a real
  basis (premium/discount) that is market, not distrust — documented decision
  in `cross-exchange/mexc-spot.ts`.

## How to add a new data source (clean, additive recipe)

1. **Connector module** in `src/cross-exchange/<source>.ts`: a pure
   `extract...` function (unit-testable, fail-closed on any malformed payload)
   plus a thin `fetch...` wrapper that returns `ok:false` on any network/HTTP
   error — never throws, never blocks the primary feed.
2. **Type registration**: add the source to the `Exchange` union in
   `src/nexus/types.ts` — only AFTER the real connector exists (the union's
   own governance comment forbids declaring an exchange without one).
3. **Polling/streaming**: wire it into `nexus/cross-exchange-service.ts`
   (REST poll via `pollRestExchange`, or a supervised WebSocket via
   `ConnectionManager`). Write results only to `UnifiedGlobalSnapshot` slices
   (`connections`, `orderBooks`, `candles`) and publish only via the existing
   `DATA.*` bus events.
4. **Tests**: pure extractor cases (well-formed, malformed, empty) in
   `tests/cross-exchange.test.ts` + service-level cases (LIVE/DEGRADED
   transitions, no event noise on repeated identical results) in
   `tests/nexus-cross-exchange-service.test.ts`. Follow the MEXC block as the
   reference example.
5. **Never**: fabricate fields the source does not provide (MEXC Spot has no
   funding rate — it stays `null`); mix instrument types into honesty-critical
   metrics without documenting the basis; add a second publisher for an
   existing event type.

## Source-of-truth inventory (what is real today)

| Data | Source | Transport | Written to |
| --- | --- | --- | --- |
| Live price, 24h stats | Binance | WebSocket (ticker) | `price` slice + top bar + forming candle |
| L2 depth (cockpit) | Binance | WebSocket (depth10@100ms) | `orderBook` slice |
| Candles (all 14 timeframes) | Binance Futures | REST via Market Data Bus | `candles` + chart |
| Funding / Open Interest | Binance Futures | REST | `derivatives` slice |
| Forced liquidations | Binance Futures | public WebSocket | Alerts view + tactical widget |
| Trade-by-trade order flow (CVD, OFI, absorption, exhaustion) | MEXC | REST poll (4s) | Order Flow Engine → signals + `orderflowHistory` |
| Cross-check mark price | Bybit, OKX | REST poll | TrustScore divergences + consensus badge |
| Cross-check price + L2 depth | MEXC Spot | REST poll | `connections.MEXC` + `orderBooks.MEXC` (dormant service) |
| Macro context (BTC dominance, Fear & Greed) | CoinGecko + alternative.me | REST poll (GMIL) | GMIL context widget + News view providers panel |

No news feed, no TradFi/macro market API, and no order execution exist in this
codebase — the corresponding views say exactly that instead of pretending
(fail-closed by design).
