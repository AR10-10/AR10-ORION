import { describe, expect, it } from "vitest";
import {
  fromBinanceSymbol,
  fromMexcSymbol,
  mergeUniversalCryptoSymbols,
  type UniversalCryptoSymbol,
} from "../src/omnibox/universal-symbol";
import type { BinanceUsdtSymbol } from "../src/omnibox/binance-symbols";
import type { MexcUsdtSymbol } from "../src/omnibox/mexc-symbols";

const BTC_BINANCE: BinanceUsdtSymbol = { symbol: "BTCUSDT", baseAsset: "BTC", market: "perp" };
const ETH_BINANCE_SPOT: BinanceUsdtSymbol = { symbol: "ETHUSDT", baseAsset: "ETH", market: "spot" };
const BTC_MEXC: MexcUsdtSymbol = { symbol: "BTC_USDT", baseAsset: "BTC" };
const XYZ_MEXC: MexcUsdtSymbol = { symbol: "XYZ_USDT", baseAsset: "XYZ" };

describe("universal-symbol: normalização pura Binance/MEXC", () => {
  it("fromBinanceSymbol preserva baseAsset/market real e marca exchange BINANCE", () => {
    expect(fromBinanceSymbol(BTC_BINANCE)).toEqual({
      baseAsset: "BTC",
      exchange: "BINANCE",
      market: "perp",
      nativeSymbol: "BTCUSDT",
    });
    expect(fromBinanceSymbol(ETH_BINANCE_SPOT).market).toBe("spot");
  });

  it("fromMexcSymbol marca exchange MEXC e market perp (só Futures existe hoje)", () => {
    const result = fromMexcSymbol(BTC_MEXC);
    expect(result).toEqual({
      baseAsset: "BTC",
      exchange: "MEXC",
      market: "perp",
      nativeSymbol: "BTC_USDT",
    });
  });

  it("nativeSymbol nunca é reconstruído — preserva o formato real de cada exchange (underscore MEXC vs. concatenado Binance)", () => {
    expect(fromBinanceSymbol(BTC_BINANCE).nativeSymbol).toBe("BTCUSDT");
    expect(fromMexcSymbol(BTC_MEXC).nativeSymbol).toBe("BTC_USDT");
  });

  it("mergeUniversalCryptoSymbols junta as duas fontes sem perder nenhum item", () => {
    const merged = mergeUniversalCryptoSymbols([BTC_BINANCE, ETH_BINANCE_SPOT], [BTC_MEXC, XYZ_MEXC]);
    expect(merged).toHaveLength(4);
    expect(merged.filter((s) => s.exchange === "BINANCE")).toHaveLength(2);
    expect(merged.filter((s) => s.exchange === "MEXC")).toHaveLength(2);
  });

  it("um ativo só na MEXC continua presente — nunca escondido por 'não existir na Binance' (Ordem Universal §1)", () => {
    const merged = mergeUniversalCryptoSymbols([BTC_BINANCE], [XYZ_MEXC]);
    const xyz = merged.find((s) => s.baseAsset === "XYZ");
    expect(xyz).toBeDefined();
    expect(xyz?.exchange).toBe("MEXC");
  });

  it("lista vazia de um lado (fetch falhou ou ainda não carregou) nunca quebra o merge — fail-closed por fonte", () => {
    expect(mergeUniversalCryptoSymbols([], [])).toEqual([]);
    expect(mergeUniversalCryptoSymbols([BTC_BINANCE], [])).toHaveLength(1);
    expect(mergeUniversalCryptoSymbols([], [BTC_MEXC])).toHaveLength(1);
  });

  it("BTC nas duas exchanges vira dois itens distintos, nunca deduplicado/misturado (Ordem MEXC §6 / Ordem Universal §6)", () => {
    const merged = mergeUniversalCryptoSymbols([BTC_BINANCE], [BTC_MEXC]);
    expect(merged).toHaveLength(2);
    const exchanges = merged.filter((s) => s.baseAsset === "BTC").map((s) => s.exchange).sort();
    expect(exchanges).toEqual(["BINANCE", "MEXC"]);
  });

  it("pureza: nunca muta os arrays de entrada", () => {
    const binance = [BTC_BINANCE];
    const mexc = [BTC_MEXC];
    const binanceCopy = [...binance];
    const mexcCopy = [...mexc];
    mergeUniversalCryptoSymbols(binance, mexc);
    expect(binance).toEqual(binanceCopy);
    expect(mexc).toEqual(mexcCopy);
  });

  it("shape de UniversalCryptoSymbol expõe exatamente os 4 campos documentados", () => {
    const result: UniversalCryptoSymbol = fromBinanceSymbol(BTC_BINANCE);
    expect(Object.keys(result).sort()).toEqual(["baseAsset", "exchange", "market", "nativeSymbol"]);
  });
});
