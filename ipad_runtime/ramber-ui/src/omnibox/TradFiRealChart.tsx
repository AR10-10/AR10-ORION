// TradFiRealChart.tsx — Ordem Market Data Fabric, Fase 1: primeiro candle
// REAL de um instrumento TradFi/CME chegando à tela (Ordem §16/§21 — "não
// parar na infraestrutura", "mostrar o resultado real: ativo, preço,
// timestamp, fonte, estado da fonte, candles"). Irmão de TradFiEmptyState
// (mesmo diretório, mesma família): quando findByLegacyTradFiAssetSymbol
// resolve um instrumento real do catálogo, este componente substitui o
// EmptyState só no gráfico principal — todo o resto do marketMode==='TRADFI'
// (order book, order flow, heatmap, Siriform, Council, Regime) continua em
// TradFiEmptyState, honesto: aqueles dados são estruturalmente
// NAO_APLICAVEL (funding/liquidations, mecânica de perpétuo) ou
// DADOS_INSUFICIENTES (order_book/open_interest — conceitos reais para um
// futuro CME, mas nenhum conector deste catálogo os busca ainda).
//
// DELIBERADAMENTE MINIMALISTA: só candlestick real + badge de proveniência
// (fonte/DELAYED) — nenhum dos ~20 overlays/plugins do Institutional Chart
// Engine (LiquidityZonesPlugin, InstitutionalZonePlugin, VWAP, etc.) e
// ZERO Core Engine/Council/nexusDecision. LEI 24 exige que o Core Engine
// seja o ÚNICO emissor de LONG/SHORT/WAIT — rodar essa mesma maquinaria
// sobre dado TradFi criaria uma segunda superfície de decisão sem o
// Operador ter pedido essa mudança explicitamente (ele só pediu para VER
// o dado real, Ordem §16, nunca para o Core Engine analisar futuros CME).
// Este componente nunca importa nexus-core.ts/o ciclo do Council — não há
// como ele virar uma segunda fonte de sinal por acidente de import.
//
// Achado real pós-Fase-1 (docs/MARKET_DATA_FABRIC.md, "Fase 3" — confirmado
// ao vivo pelo próprio Operador rodando no PC dele): o conector Yahoo
// delayed é bloqueado por CORS estrutural do lado do servidor da Yahoo, não
// um bug daqui. Quando status vira DADOS_INSUFICIENTES e o instrumento tem
// tradingview_symbol cadastrado, este componente cai para
// TradingViewAdvancedChart (widget real, hospedado pela própria
// TradingView — contorna o CORS por não ser um fetch() nosso). A tentativa
// real via Yahoo continua rodando primeiro sempre — o widget é só o
// fallback honesto para quando ela falha, nunca substitui a tentativa real.
import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { Radio, Clock } from "lucide-react";
import { getTradFiChartCandles } from "../engine-bridge";
import { TradingViewAdvancedChart } from "./TradingViewAdvancedChart";

// Mesma cadência do ciclo cripto principal (ver comentário de
// HTF_REFRESH_MS em engine-bridge.ts: "o ciclo principal roda a cada 30s
// (App.tsx)") — nenhuma cadência nova inventada.
const REFRESH_MS = 30_000;

/** Subconjunto real do InstrumentDefinition (instrument-registry.js) que
 *  este componente precisa — declarado aqui (não importado de um .js via
 *  JSDoc) seguindo a mesma convenção que engine-bridge.ts já usa para
 *  todo motor .js: o lado TS define seu próprio tipo local casado com a
 *  forma real do JS, nunca uma segunda implementação do dado em si. */
export interface TradFiChartInstrument {
  instrument_id: string;
  display_name: string;
  contract_code: string;
  designated_contract_market: string;
  tick_size: number;
  tick_value_usd: number;
  tradingview_symbol?: string;
}

interface TradFiCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type LoadStatus = "LOADING" | "OK" | "DADOS_INSUFICIENTES";

export function TradFiRealChart({
  instrument,
  timeframe,
}: {
  instrument: TradFiChartInstrument;
  timeframe: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [status, setStatus] = useState<LoadStatus>("LOADING");
  const [lastCandle, setLastCandle] = useState<TradFiCandle | null>(null);

  // Efeito 1 (deps []): cria o chart real UMA vez por montagem — mesmo
  // padrão de EnhancedChart_110_Percent.tsx (nunca recriar o chart a cada
  // atualização de dado). autoSize:true usa o ResizeObserver interno da
  // própria lib.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8ab4f8",
        fontFamily: "ui-monospace, monospace",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(0, 240, 255, 0.06)" },
        horzLines: { color: "rgba(0, 240, 255, 0.06)" },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: "rgba(138, 180, 248, 0.15)" },
      timeScale: {
        borderColor: "rgba(138, 180, 248, 0.15)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      autoSize: true,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#00ffaa",
      downColor: "#ff0055",
      borderVisible: false,
      wickUpColor: "#00ffaa",
      wickDownColor: "#ff0055",
      priceLineVisible: true,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Efeito 2: busca candles reais (instrument_id + timeframe) via o MESMO
  // getTradFiChartCandles que a Ordem Market Data Fabric acabou de ligar
  // ao Instrument Registry + conector delayed real — nunca um fetch
  // paralelo. Poll a cada REFRESH_MS enquanto montado, mesma cadência do
  // ciclo cripto principal.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const candles = await getTradFiChartCandles(instrument.instrument_id, 200, timeframe);
      if (cancelled) return;
      if (!candles || candles.length === 0) {
        setStatus("DADOS_INSUFICIENTES");
        return;
      }
      seriesRef.current?.setData(
        candles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
      setLastCandle(candles[candles.length - 1]);
      setStatus("OK");
    }
    setStatus("LOADING");
    setLastCandle(null);
    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [instrument.instrument_id, timeframe]);

  // Fallback real (achado pós-Fase-1, ver comentário no topo do arquivo):
  // só troca para o widget da TradingView quando a tentativa real via
  // Yahoo já rodou e falhou honestamente E o instrumento tem um símbolo
  // cadastrado — nunca antes da tentativa real, nunca para instrumentos
  // sem mapeamento (SOFR/futuros cripto da CME continuam no texto
  // DADOS_INSUFICIENTES simples, mesmo comportamento de sempre).
  const showTradingViewFallback = status === "DADOS_INSUFICIENTES" && Boolean(instrument.tradingview_symbol);

  return (
    <div className="cyber-panel flex-1 min-h-[280px] flex flex-col gap-1 p-2">
      <div className="flex items-center justify-between shrink-0 px-1 gap-2">
        <span className="text-[0.6rem] font-bold text-[#a0f0ff]/80 tracking-wide uppercase truncate">
          {instrument.display_name} · {instrument.contract_code} · {instrument.designated_contract_market}
        </span>
        <span className="flex items-center gap-1 text-[0.5rem] font-bold tracking-[0.1em] text-[#ffb020]/80 uppercase shrink-0">
          <Clock size={10} /> {showTradingViewFallback ? "DELAYED · TradingView (fallback real)" : "DELAYED · Yahoo Finance (não-oficial)"}
        </span>
      </div>
      {/* containerRef nunca desmonta (só fica oculto) — o chart nativo já
         foi criado nele por Efeito 1; remover do DOM condicionalmente
         deixaria a instância de lightweight-charts órfã quando o poll de
         Efeito 2 tentasse atualizar depois. */}
      <div ref={containerRef} className={showTradingViewFallback ? "hidden" : "flex-1 min-h-0"} />
      {showTradingViewFallback && instrument.tradingview_symbol && (
        <>
          <div className="text-[0.5rem] text-[#ffb020]/70 uppercase tracking-wide px-1 shrink-0 text-center">
            Fonte delayed própria indisponível nesta tentativa (bloqueio real de CORS do lado da Yahoo) · widget real da TradingView
          </div>
          <TradingViewAdvancedChart symbol={instrument.tradingview_symbol} />
        </>
      )}
      {!showTradingViewFallback && status === "LOADING" && (
        <div className="flex items-center justify-center gap-2 py-6 text-[0.55rem] text-[#8ab4f8]/60 uppercase tracking-wide">
          <Radio size={14} className="animate-pulse-glow" /> Buscando candles reais...
        </div>
      )}
      {!showTradingViewFallback && status === "DADOS_INSUFICIENTES" && (
        <div className="flex items-center justify-center gap-2 py-6 text-[0.55rem] text-[#ff0055]/80 uppercase tracking-wide text-center px-4">
          DADOS_INSUFICIENTES · fonte delayed indisponível nesta tentativa (nunca simulado)
        </div>
      )}
      {status === "OK" && lastCandle && (
        <div className="text-[0.55rem] text-[#8ab4f8]/60 px-1 shrink-0">
          Último close real: {lastCandle.close} · tick {instrument.tick_size} (${instrument.tick_value_usd}/tick)
        </div>
      )}
    </div>
  );
}
