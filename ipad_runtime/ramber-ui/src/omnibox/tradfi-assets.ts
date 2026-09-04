// tradfi-assets.ts — Overhaul Cross-Market (Missão 2, diretriz 3): a
// taxonomia de mercado tradicional exigida pela ordem de ignição.
// Nascida HARDCODED DE PROPÓSITO ("nenhuma API Macro ligada"), mas isso
// mudou na Ordem Market Data Fabric (ver docs/MARKET_DATA_FABRIC.md):
// findByLegacyTradFiAssetSymbol (src/market-data-bus/instrument-registry.js)
// hoje resolve 14 dos 17 símbolos abaixo para um instrumento real com
// conector Yahoo delayed (9 futuros CME + 5 ações NASDAQ) — escolher um
// desses 14 monta TradFiRealChart (candle real) em vez de TradFiEmptyState.
// Os outros 3 (GER40/Eurex, UKOIL/ICE, USDJPY com convenção de cotação
// invertida do futuro) continuam sem mapeamento seguro, honestamente em
// TradFiEmptyState — ver notes de cada InstrumentDefinition não-mapeada.
// AVISO REAL herdado pelos 14 mapeados: o conector Yahoo delayed tem um
// bloqueio estrutural de CORS documentado (docs/MARKET_DATA_FABRIC.md) —
// "resolve pra um instrumento real" não é o mesmo que "confirmado
// funcionando ao vivo contra a rede real".
export type TradFiCategory = "INDICES_GLOBAIS" | "ACOES_BIG_TECH" | "COMMODITIES" | "FOREX";

export interface TradFiAsset {
  symbol: string;
  name: string;
  category: TradFiCategory;
}

export const TRADFI_CATEGORY_ORDER: readonly TradFiCategory[] = Object.freeze([
  "INDICES_GLOBAIS",
  "ACOES_BIG_TECH",
  "COMMODITIES",
  "FOREX",
]);

export const TRADFI_CATEGORY_LABELS: Readonly<Record<TradFiCategory, string>> = Object.freeze({
  INDICES_GLOBAIS: "Índices Globais",
  ACOES_BIG_TECH: "Ações (Big Techs)",
  COMMODITIES: "Commodities",
  FOREX: "Forex",
});

export const TRADFI_ASSETS: readonly TradFiAsset[] = Object.freeze([
  Object.freeze({ symbol: "SPX", name: "S&P 500", category: "INDICES_GLOBAIS" as const }),
  Object.freeze({ symbol: "NDX", name: "Nasdaq 100", category: "INDICES_GLOBAIS" as const }),
  Object.freeze({ symbol: "RUT", name: "Russell 2000", category: "INDICES_GLOBAIS" as const }),
  Object.freeze({ symbol: "US30", name: "Dow Jones", category: "INDICES_GLOBAIS" as const }),
  Object.freeze({ symbol: "GER40", name: "DAX 40", category: "INDICES_GLOBAIS" as const }),
  Object.freeze({ symbol: "TSLA", name: "Tesla", category: "ACOES_BIG_TECH" as const }),
  Object.freeze({ symbol: "NVDA", name: "Nvidia", category: "ACOES_BIG_TECH" as const }),
  Object.freeze({ symbol: "AAPL", name: "Apple", category: "ACOES_BIG_TECH" as const }),
  Object.freeze({ symbol: "MSFT", name: "Microsoft", category: "ACOES_BIG_TECH" as const }),
  Object.freeze({ symbol: "META", name: "Meta", category: "ACOES_BIG_TECH" as const }),
  Object.freeze({ symbol: "USOIL", name: "Petróleo WTI", category: "COMMODITIES" as const }),
  Object.freeze({ symbol: "UKOIL", name: "Petróleo Brent", category: "COMMODITIES" as const }),
  Object.freeze({ symbol: "XAUUSD", name: "Ouro", category: "COMMODITIES" as const }),
  Object.freeze({ symbol: "XAGUSD", name: "Prata", category: "COMMODITIES" as const }),
  Object.freeze({ symbol: "EURUSD", name: "EUR/USD", category: "FOREX" as const }),
  Object.freeze({ symbol: "GBPUSD", name: "GBP/USD", category: "FOREX" as const }),
  Object.freeze({ symbol: "USDJPY", name: "USD/JPY", category: "FOREX" as const }),
]);
