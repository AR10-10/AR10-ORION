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

  return (
    <div className="cyber-panel flex-1 min-h-[280px] flex flex-col gap-1 p-2">
      <div className="flex items-center justify-between shrink-0 px-1 gap-2">
        <span className="text-[0.6rem] font-bold text-[#a0f0ff]/80 tracking-wide uppercase truncate">
          {instrument.display_name} · {instrument.contract_code} · {instrument.designated_contract_market}
        </span>
        <span className="flex items-center gap-1 text-[0.5rem] font-bold tracking-[0.1em] text-[#ffb020]/80 uppercase shrink-0">
          <Clock size={10} /> DELAYED · Yahoo Finance (não-oficial)
        </span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
      {status === "LOADING" && (
        <div className="flex items-center justify-center gap-2 py-6 text-[0.55rem] text-[#8ab4f8]/60 uppercase tracking-wide">
          <Radio size={14} className="animate-pulse-glow" /> Buscando candles reais...
        </div>
      )}
      {status === "DADOS_INSUFICIENTES" && (
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
