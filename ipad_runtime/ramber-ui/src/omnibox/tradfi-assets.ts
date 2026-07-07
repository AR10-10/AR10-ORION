// tradfi-assets.ts — Overhaul Cross-Market (Missão 2, diretriz 3): a
// taxonomia de mercado tradicional exigida pela ordem de ignição.
// HARDCODED DE PROPÓSITO: este sistema não tem (e não finge ter) nenhuma
// API Macro ligada hoje — a lista existe para o Operador navegar a
// categorização e para a conexão FUTURA de uma fonte real; escolher
// qualquer um destes ativos nunca dispara uma chamada de rede (ver
// TradFiEmptyState.tsx e o modo `marketMode==='TRADFI'` em App.tsx).
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
