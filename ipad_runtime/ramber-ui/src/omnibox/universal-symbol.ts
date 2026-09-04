// universal-symbol.ts — ORDEM "MEXC ASSET DISCOVERY + NATIVE MARKET DATA"
// (§3 Smart Omnibox, resultados agrupados por exchange) + ORDEM "UNIVERSAL
// ASSET DISCOVERY" (§3 Universal Asset Catalog, §5 Smart Omnibox, §7 Symbol
// Resolution — mesma ordem, o Operador generalizou o pedido MEXC para uma
// regra permanente: "não queremos lista fixa, queremos catálogo descoberto
// dinamicamente"). Este módulo é a camada de normalização mínima que as
// duas ordens pedem — puro, zero rede, zero estado.
//
// O QUE JÁ EXISTIA (auditado antes de construir, CLAUDE.md item 1): duas
// fontes reais e já testadas, cada uma com seu próprio formato de símbolo
// nativo —
//   • omnibox/binance-symbols.ts — BinanceUsdtSymbol{symbol:"BTCUSDT",
//     baseAsset:"BTC", market:"perp"|"spot"} — hoje a ÚNICA fonte que o
//     SmartOmnibox usa.
//   • omnibox/mexc-symbols.ts — MexcUsdtSymbol{symbol:"BTC_USDT",
//     baseAsset:"BTC"} — já busca dado público real
//     (contract.mexc.com/api/v1/contract/detail) para o universo de
//     background do Radar (Etapa 9), mas nunca chegou à busca do Operador.
// O que faltava não eram os dois conectores (os dois já existiam e já são
// reais) — era um formato ÚNICO para o SmartOmnibox exibir os dois lado a
// lado, com o rótulo de exchange SEMPRE visível (Ordem MEXC §7/§12, Ordem
// Universal §12: "o usuário precisa saber exatamente qual mercado está
// abrindo").
//
// Escopo honesto desta Etapa 1 (documentado também no SYSTEM_HANDBOOK):
//   • Só BINANCE e MEXC — os dois únicos providers reais de candle hoje
//     (`market-data-adapter.ts`'s MarketDataProviderId). `Exchange`
//     (nexus/types.ts) já é uma união mais ampla (inclui BYBIT/OKX,
//     cross-check de preço, nunca fonte de candle) — CryptoExchangeId
//     abaixo é um recorte explícito dela, não uma união nova e paralela.
//   • Só mercado "perp" (USDT-M Futures) para os dois lados. mexc-symbols.ts
//     só descobre contratos Futures (endpoint /api/v1/contract/detail) —
//     não existe ainda um conector de candle MEXC Spot no repositório, e
//     inventar um símbolo "spot" sem um conector real por trás violaria a
//     Regra de Ouro 1. O SPOT/FUTURES distintos por exchange que as duas
//     Ordens pedem (Ordem MEXC §6, Ordem Universal §6) fica documentado
//     como pendência real, não fabricado aqui.
import type { Exchange } from "../nexus/types";
import type { BinanceUsdtSymbol } from "./binance-symbols";
import type { MexcUsdtSymbol } from "./mexc-symbols";

/** Recorte de `Exchange` (nexus/types.ts) para as exchanges que já têm um
 *  provider de candle real (`market-data-adapter.ts`). BYBIT/OKX ficam de
 *  fora de propósito: hoje são só cross-check de preço consultivo
 *  (cross-exchange/bybit-futures.ts, okx-futures.ts), nunca fonte de candle
 *  — incluí-los aqui sem um provider real por trás fabricaria uma opção
 *  que o Omnibox não conseguiria de fato carregar. */
export type CryptoExchangeId = Extract<Exchange, "BINANCE" | "MEXC">;

/** Identidade normalizada de um ativo cripto pesquisável no Omnibox — a
 *  Ordem Universal Asset Discovery (§7 Symbol Resolution) pede exatamente
 *  isto: "manter internamente uma identidade normalizada do ativo, mas
 *  preservar o símbolo original utilizado pela exchange". `nativeSymbol` é
 *  esse símbolo original (nunca reconstruído/adivinhado no outro lado —
 *  cada conector já sabe converter baseAsset→nativeSymbol sozinho, ex.
 *  mexc-futures-public.js's toMexcSymbol). */
export interface UniversalCryptoSymbol {
  baseAsset: string;
  exchange: CryptoExchangeId;
  market: "perp" | "spot";
  nativeSymbol: string;
}

export function fromBinanceSymbol(s: BinanceUsdtSymbol): UniversalCryptoSymbol {
  return { baseAsset: s.baseAsset, exchange: "BINANCE", market: s.market, nativeSymbol: s.symbol };
}

/** mexc-symbols.ts só descobre contratos Futures reais — ver nota de
 *  escopo no header deste arquivo. */
export function fromMexcSymbol(s: MexcUsdtSymbol): UniversalCryptoSymbol {
  return { baseAsset: s.baseAsset, exchange: "MEXC", market: "perp", nativeSymbol: s.symbol };
}

/** Junta as duas fontes reais num catálogo único exibível — puro, nunca
 *  esconde um ativo só porque não existe na outra exchange (Ordem
 *  Universal §1, REGRA PRINCIPAL). Uma lista vazia de qualquer lado (fetch
 *  falhou, ou ainda não carregou) simplesmente não contribui itens — nunca
 *  um erro, mesmo fail-closed independente por fonte que o SmartOmnibox já
 *  aplica à Binance sozinha hoje. */
export function mergeUniversalCryptoSymbols(
  binance: readonly BinanceUsdtSymbol[],
  mexc: readonly MexcUsdtSymbol[],
): UniversalCryptoSymbol[] {
  return [...binance.map(fromBinanceSymbol), ...mexc.map(fromMexcSymbol)];
}
