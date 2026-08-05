# Matriz de Fontes de Dado (Data Source Matrix) — V1

*Sub-produto `ipad_runtime/` (AR10 Cyborg 2.0). Leitura derivada de
`ipad_runtime/configs/connector-registry.default.json` — qualquer alteração
de conteúdo deve ser feita primeiro no JSON e depois refletida aqui, nunca
o contrário. Ver `docs/CONNECTOR_REGISTRY_DESIGN.md` para o contrato de
schema completo. Nenhum conector listado abaixo está ativo no app ao vivo
nesta fase — todos têm `enabled_now: false` no registro.*

## Como ler esta matriz

- **Status** usa o vocabulário fechado de `current_status` definido em
  `docs/CONNECTOR_REGISTRY_DESIGN.md` (`PLANNED`, `FUTURE`,
  `REQUIRES_API_KEY`, `UNSUPPORTED_ON_IPAD` etc.).
- **Risco** é a classificação qualitativa `risk_level` do registro
  (`LOW`/`MEDIUM`/`HIGH`), usada só para priorização interna.
- A coluna **Execução** está presente em todas as tabelas só para reforçar
  visualmente o invariante: é **sempre "Não"**, sem nenhuma exceção, em
  toda linha desta matriz.

## Matriz principal: conector x capacidades de dado

Legenda de capacidade: `●` presente nesta entrada, `—` ausente.

| Conector | candles | ticker | order_book | funding | open_interest | liquidations | long_short_ratio | volume_delta | market_cap | equity_price | stock_futures_price | trading_hours | corporate_actions | news | economic_calendar | account_state_readonly | positions_readonly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `mexc-public-market-adapter` | ● | ● | ● | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `mexc-futures-public-adapter` | ● | ● | ● | ● | ● | ● | ● | — | — | — | — | — | — | — | — | — | — |
| `mexc-stock-futures-adapter` | ● | ● | — | — | — | — | — | — | — | — | ● | — | — | — | — | — | — |
| `mexc-realstocks-adapter` | ● | ● | — | — | — | — | — | — | — | ● | — | ● | — | — | — | — | — |
| `binance-futures-public-adapter` | ● | ● | ● | ● | ● | ● | ● | ● | — | — | — | — | — | — | — | — | — |
| `coingecko-market-data-adapter` | ● | ● | — | — | — | — | — | — | ● | — | — | — | — | — | — | — | — |
| `coinglass-derivatives-data-adapter` | — | — | — | ● | ● | ● | ● | ● | — | — | — | — | — | — | — | — | — |
| `yahoo-finance-adapter` | ● | — | — | — | — | — | — | — | — | ● | — | ● | ● | — | — | — | — |
| `google-finance-adapter` | — | — | — | — | — | — | — | — | — | ● | — | ● | — | — | — | — | — |
| `google-sheets-import-adapter` | ● | — | — | — | — | — | — | — | — | ● | — | — | — | — | ● | — | — |
| `tradingview-compatible-route` | ● | ● | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `custom-csv-import-route` | ● | — | — | — | — | — | — | — | — | ● | — | — | — | — | — | — | — |
| `mt5-bridge-adapter` | ● | ● | — | — | — | — | — | — | — | — | — | — | — | — | — | ● | ● |
| `native-companion-adapter` | ● | ● | — | — | — | — | — | — | — | — | — | — | — | ● | — | — | — |

Nenhum conector desta matriz expõe `execution` como capacidade, e nenhum
deles jamais exporia (campo `execution_supported` é `false` em todas as 14
entradas — ver `docs/CONNECTOR_REGISTRY_DESIGN.md`, seção "Invariante de
execução").

## Matriz secundária: conector x classe de ativo, status, risco e execução

| Conector | Classes de ativo | Status | Risco | Execução |
|---|---|---|---|---|
| `mexc-public-market-adapter` | crypto_spot | `PLANNED` | LOW | Não |
| `mexc-futures-public-adapter` | crypto_futures | `PLANNED` | LOW | Não |
| `mexc-stock-futures-adapter` | stock_futures_synthetic (`SYNTHETIC_DERIVATIVE_EXPOSURE`) | `PLANNED` | MEDIUM | Não |
| `mexc-realstocks-adapter` | equities_real (`REAL_EQUITY_ROUTE_IF_AVAILABLE`, region-dependent) | `PLANNED` | MEDIUM | Não |
| `binance-futures-public-adapter` | crypto_futures | `PLANNED` | LOW | Não |
| `coingecko-market-data-adapter` | crypto_spot | `PLANNED` | LOW | Não |
| `coinglass-derivatives-data-adapter` | crypto_futures | `REQUIRES_API_KEY` | MEDIUM | Não |
| `yahoo-finance-adapter` | equities_real, etf, index, tradfi_regulated_futures | `PLANNED`¹ | LOW | Não |
| `google-finance-adapter` | equities_real, etf, index | `UNSUPPORTED_ON_IPAD` | LOW | Não |
| `google-sheets-import-adapter` | custom_user_defined | `PLANNED` | LOW | Não |
| `tradingview-compatible-route` | crypto_spot, crypto_futures, equities_real | `FUTURE` | MEDIUM | Não |
| `custom-csv-import-route` | custom_user_defined, crypto_spot, crypto_futures, equities_real | `PLANNED` | LOW | Não |
| `mt5-bridge-adapter` (role: `READ_ONLY_PLACEHOLDER`) | crypto_spot, crypto_futures, equities_real, fx | `FUTURE` | HIGH | Não |
| `native-companion-adapter` | crypto_spot, crypto_futures | `FUTURE` | MEDIUM | Não |

¹ **Atualização real (Ordem Market Data Fabric, Fase 1):** o slice
`tradfi_regulated_futures` deste conector (futuros datados/regulados da
CME — ES/NQ/YM/RTY/GC/SI/CL/6E/6B; distinto de `stock_futures_synthetic`)
agora tem implementação real e testada — `ipad_runtime/js/real-data/
tradfi-delayed-yahoo.js` + `ipad_runtime/src/market-data-bus/tradfi-
delayed-connector.js`, ligado ao Instrument Registry real
(`instrument-registry.js`) e a `App.tsx` (modo TRADFI, 9 dos 17 ativos
legados). `current_status` continua honestamente `PLANNED`: nenhuma
chamada real contra `query1.finance.yahoo.com` foi executada em nenhuma
sessão de implementação até agora (sandbox sem saída de rede para esse
host) — só avança para `ACTIVE_READ_ONLY` quando uma sonda real (mesmo
padrão de `probe.js`) passar contra a rede de verdade num ambiente com
saída liberada. O slice original deste connector_id
(`equities_real`/`etf`/`index`) continua 100% `PLAN_ONLY`, sem nenhum
código implementado. Ver `docs/MARKET_DATA_FABRIC.md` para o relato
completo desta fase.

## Cobertura por classe de ativo

Quais conectores (uma vez implementados) cobririam cada classe de ativo —
útil para identificar onde há redundância (mais de uma fonte possível) e
onde há um único candidato:

| Classe de ativo | Conectores candidatos |
|---|---|
| `crypto_spot` | `mexc-public-market-adapter`, `coingecko-market-data-adapter`, `tradingview-compatible-route`, `custom-csv-import-route`, `mt5-bridge-adapter`, `native-companion-adapter` |
| `crypto_futures` | `mexc-futures-public-adapter`, `binance-futures-public-adapter`, `coinglass-derivatives-data-adapter`, `tradingview-compatible-route`, `custom-csv-import-route`, `mt5-bridge-adapter`, `native-companion-adapter` |
| `equities_real` | `mexc-realstocks-adapter` (region-dependent), `yahoo-finance-adapter`, `google-finance-adapter` (`UNSUPPORTED_ON_IPAD`), `tradingview-compatible-route`, `custom-csv-import-route`, `mt5-bridge-adapter` |
| `stock_futures_synthetic` | `mexc-stock-futures-adapter` (único candidato; explicitamente sintético, não é equity real) |
| `etf` / `index` | `yahoo-finance-adapter`, `google-finance-adapter` (`UNSUPPORTED_ON_IPAD`) |
| `tradfi_regulated_futures` | `yahoo-finance-adapter` (único candidato; implementação real desde a Ordem Market Data Fabric Fase 1, ver nota¹ acima — distinto de `stock_futures_synthetic`, que é derivativo sintético de exchange cripto, não o contrato futuro regulado real) |
| `fx` | `mt5-bridge-adapter` (único candidato) |
| `custom_user_defined` | `google-sheets-import-adapter`, `custom-csv-import-route` |

Leitura prática desta tabela: `crypto_spot` e `crypto_futures` têm múltiplos
candidatos redundantes (boa resiliência caso uma fonte fique instável ou
mude rate limit), enquanto `stock_futures_synthetic` e `fx` têm hoje um
único candidato declarado cada — uma futura indisponibilidade desses dois
conectores específicos deixaria aquela classe de ativo sem fonte
alternativa já mapeada no registro.

## Cobertura por capacidade de dado

Quantos conectores (uma vez implementados) ofereceriam cada capacidade —
útil para identificar capacidades bem cobertas versus capacidades raras:

| Capacidade | Nº de conectores | Conectores |
|---|---|---|
| `candles` | 12 | mexc-public-market, mexc-futures-public, mexc-stock-futures, mexc-realstocks, binance-futures-public, coingecko-market-data, yahoo-finance, google-sheets-import, tradingview-compatible, custom-csv-import, mt5-bridge, native-companion |
| `ticker` | 9 | mexc-public-market, mexc-futures-public, mexc-stock-futures, mexc-realstocks, binance-futures-public, coingecko-market-data, tradingview-compatible, mt5-bridge, native-companion |
| `order_book` | 3 | mexc-public-market, mexc-futures-public, binance-futures-public |
| `funding` | 3 | mexc-futures-public, binance-futures-public, coinglass-derivatives-data |
| `open_interest` | 3 | mexc-futures-public, binance-futures-public, coinglass-derivatives-data |
| `liquidations` | 3 | mexc-futures-public, binance-futures-public, coinglass-derivatives-data |
| `long_short_ratio` | 3 | mexc-futures-public, binance-futures-public, coinglass-derivatives-data |
| `volume_delta` | 2 | binance-futures-public, coinglass-derivatives-data |
| `market_cap` | 1 | coingecko-market-data |
| `equity_price` | 5 | mexc-realstocks, yahoo-finance, google-finance, google-sheets-import, custom-csv-import |
| `stock_futures_price` | 1 | mexc-stock-futures |
| `trading_hours` | 3 | mexc-realstocks, yahoo-finance, google-finance |
| `corporate_actions` | 1 | yahoo-finance |
| `news` | 1 | native-companion |
| `economic_calendar` | 1 | google-sheets-import |
| `account_state_readonly` | 1 | mt5-bridge (placeholder, read-only) |
| `positions_readonly` | 1 | mt5-bridge (placeholder, read-only) |
| `execution` | 0 | nenhum — vocabulário existe, mas nenhuma entrada o utiliza, e `execution_supported` é `false` em todo o registro independentemente disso |

Nota de honestidade: as contagens acima descrevem o que cada conector
**ofereceria depois de implementado**, não o que está disponível hoje no
app — nenhum conector tem `enabled_now: true` nesta fase, e a única fonte
de dado real e ativa no runtime ao vivo continua sendo o replay sintético
offline (`data/btcusdt_replay.json`).

## Resumo por status

| Status | Quantidade | Conectores |
|---|---|---|
| `PLANNED` | 9 | mexc-public-market, mexc-futures-public, mexc-stock-futures, mexc-realstocks, binance-futures-public, coingecko-market-data, yahoo-finance, google-sheets-import, custom-csv-import |
| `FUTURE` | 3 | tradingview-compatible, mt5-bridge, native-companion |
| `REQUIRES_API_KEY` | 1 | coinglass-derivatives-data |
| `UNSUPPORTED_ON_IPAD` | 1 | google-finance |
| `ACTIVE_READ_ONLY` | 0 | nenhum conector está ativo em produção nesta fase |

## Ver também

- `ipad_runtime/configs/connector-registry.default.json` — fonte de verdade desta matriz.
- `ipad_runtime/configs/data-sources.readonly.json` — view derivada do registro, filtrada para o subconjunto read-only (sem metadado rico), com o contrato global `execution_supported: false` reafirmado para inspeção rápida.
- `docs/CONNECTOR_REGISTRY_DESIGN.md` — contrato de schema, vocabulários e invariante de execução.
- `docs/READ_ONLY_MARKET_SAFETY.md` — as 14 leis de segurança vinculantes que esta matriz e o registro de conectores implementam.
- `docs/REAL_DATA_POLICY.md` — política de dados sintéticos (diagnóstico) vs. dados reais (fonte pública/somente-leitura ou `DADOS INSUFICIENTES`).
- `ipad_runtime/src/research/connectors/` — stubs de módulo por conector.
