// market-data-adapter.ts — ADITIVO V-MAX Etapa 1 (Market Data Adapter,
// PRIORIDADE ABSOLUTA): "Não substituir Binance por MEXC. Não criar um
// pipeline paralelo para MEXC. Criar uma camada única de abstração"
// (texto literal da diretiva do Operador).
//
//   Radar / Core Engine cycle
//         ↓
//   MarketDataAdapter (este arquivo)
//         ↓
//   Provider Ativo (BinanceProvider | MEXCProvider)
//         ↓
//   UnifiedGlobalSnapshot (via Market Data Bus, para quem passa por ele)
//
// O QUE JÁ EXISTIA (auditado antes de construir, CLAUDE.md item 1): o
// Market Data Bus (market-data-bus/bus.js) sempre foi agnóstico de
// exchange — `requestSnapshot({..., collect})` recebe `collect` como
// função INJETADA pelo chamador, nunca hardcoded dentro do Bus. O que
// faltava não era o Bus, era um segundo `collect` real para MEXC (só
// existia o de Binance, collectBinanceFuturesKlines) e um lugar ÚNICO
// que resolvesse "qual `collect` uso" — hoje espalhado como um import
// direto de collectBinanceFuturesKlines em cada call site
// (engine-bridge.ts). Este módulo é esse lugar único: a partir de agora
// NENHUM consumidor importa collectBinanceFuturesKlines/
// collectMexcFuturesKlines diretamente — todos passam por
// getMarketDataProvider(id).collect.
//
// Provider é um PARÂMETRO EXPLÍCITO por chamada, nunca um toggle global
// mutável. Esse é o risco que este projeto mais evita (CLAUDE.md: "não
// tem histórico de backtest real" / trava de fonte primária) — um
// switch global poderia trocar a fonte do ciclo de decisão real
// silenciosamente. Omitir `provider` cai no default BINANCE: o mesmo
// comportamento de sempre para todo consumidor que ainda não pede outra
// coisa (Core Engine cycle, gráfico, paginação histórica — nenhum
// muda de fonte nesta entrega). MEXC fica disponível para um consumidor
// que peça explicitamente (Radar/OIH, Etapa 9 — ainda não ligado nesta
// entrega, ver nota de cache-key abaixo).
//
// NOTA DE ARQUITETURA para quem ligar o Radar ao MEXCProvider (Etapa 9):
// a chave de cache do Bus é `${symbol}:${timeframe}` (bus.js#_keyOf) —
// SEM conhecimento de provider. Dois providers pedindo o MESMO symbol/
// timeframe colidiriam na mesma entrada do Bus e poderiam misturar
// candles de duas exchanges diferentes sob uma única chave. A convenção
// já real para isto é o sufixo de cache-key (`-PERP`, ver
// requestFuturesCandleSnapshot em engine-bridge.ts) — um futuro caller
// MEXC deve usar um sufixo PRÓPRIO (ex. `${symbol}-MEXC`, já suportado
// por collectMexcFuturesKlines, que aceita e remove tanto `-PERP` quanto
// `-MEXC`) para nunca colidir com a entrada Binance do mesmo ativo.
//
// Arquitetura preparada para Bybit/OKX/Hyperliquid futuros (texto da
// diretiva): MarketDataProviderId é a união fechada onde um novo id
// entra; nenhum provider novo é implementado nesta entrega além dos 2
// pedidos — os cross-checks já reais de Bybit/OKX (cross-exchange/
// bybit-futures.ts, okx-futures.ts) continuam exatamente como são
// (comparação de preço consultiva, nunca fonte de candle), fora do
// escopo deste adapter até o Operador pedir candles reais dessas fontes.
import { collectBinanceFuturesKlines, collectMexcFuturesKlines } from '../../src/market-data-bus/index.js';

export type MarketDataProviderId = 'BINANCE' | 'MEXC';

export interface MarketDataCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface MarketDataCollectOpts {
  symbol: string;
  timeframe: string;
  limit: number;
  endTime?: number;
}

export interface MarketDataProvider {
  id: MarketDataProviderId;
  label: string;
  collect: (opts: MarketDataCollectOpts) => Promise<MarketDataCandle[]>;
}

export const DEFAULT_MARKET_DATA_PROVIDER: MarketDataProviderId = 'BINANCE';

const PROVIDERS: Record<MarketDataProviderId, MarketDataProvider> = {
  BINANCE: {
    id: 'BINANCE',
    label: 'Binance USDT-M Futures',
    collect: (opts) => collectBinanceFuturesKlines(opts) as Promise<MarketDataCandle[]>,
  },
  MEXC: {
    id: 'MEXC',
    label: 'MEXC USDT-M Futures',
    collect: (opts) => collectMexcFuturesKlines(opts) as Promise<MarketDataCandle[]>,
  },
};

/** Único ponto de resolução "qual provider" de todo o organismo.
 *  Default BINANCE (fonte primária, CLAUDE.md) — nunca uma suposição
 *  silenciosa: todo call site crítico (ciclo do Core Engine, paginação
 *  histórica) passa 'BINANCE' explicitamente mesmo assim, por clareza. */
export function getMarketDataProvider(id: MarketDataProviderId = DEFAULT_MARKET_DATA_PROVIDER): MarketDataProvider {
  return PROVIDERS[id];
}

export const MARKET_DATA_PROVIDER_IDS: readonly MarketDataProviderId[] = ['BINANCE', 'MEXC'] as const;
