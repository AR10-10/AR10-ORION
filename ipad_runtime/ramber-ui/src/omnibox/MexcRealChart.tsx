// MexcRealChart.tsx — Ordem "MEXC ASSET DISCOVERY + NATIVE MARKET DATA"
// (§4 "ativo só MEXC deve ser totalmente analisável sem esperar a
// Binance") + Ordem "UNIVERSAL ASSET DISCOVERY" (mesmo pedido
// generalizado — critério de aceitação §1-8: digitar um ativo só MEXC,
// selecioná-lo, ver EXCHANGE/MARKET/NATIVE SYMBOL corretos, carregar dados
// reais, renderizar o gráfico, analisar só se houver dados suficientes).
// Irmão direto de TradFiRealChart.tsx (mesmo diretório, mesma família e
// mesma disciplina) — não uma segunda arquitetura inventada.
//
// DELIBERADAMENTE MINIMALISTA, mesma razão exata do irmão TradFi: só
// candlestick real + badge de proveniência (exchange/mercado SEMPRE
// visível — Ordem MEXC §7/§12, Ordem Universal §12) — nenhum dos ~20
// overlays/plugins do Institutional Chart Engine, e ZERO Core Engine/
// Council/nexusDecision/orderflow. LEI 24 exige que o Core Engine seja o
// ÚNICO emissor de LONG/SHORT/WAIT — rodar essa maquinaria (ou o Order
// Flow Engine, que hoje só tem poller real para MEXC Spot via
// mexc-trades-stream.js, uma fonte DIFERENTE desta de Futures) sobre este
// gráfico criaria uma segunda superfície de decisão que o Operador não
// pediu explicitamente aqui — ele pediu para ENCONTRAR e VER o ativo MEXC
// real (mensagem direta do Operador nesta sessão: "dado público... mesmo
// processo... pra analisar"), nunca uma segunda máquina de decisão. Este
// componente nunca importa nexus-core.ts/o ciclo do Council — não há como
// virar uma segunda fonte de sinal por acidente de import.
//
// Escopo honesto desta Etapa 1 (ver também SYSTEM_HANDBOOK.md): Futures
// USDT-M apenas (mesmo recorte de universal-symbol.ts — MEXC Spot não tem
// conector de candle neste repositório ainda); sem persistência
// IndexedDB (mesmo precedente de TradFiRealChart — Fase 1 é mostrar o
// dado real, Local-First fica para quando o Operador pedir); sem
// verificação ao vivo contra a rede real (bloqueio de política de rede
// deste sandbox de implementação, o mesmo já documentado em
// docs/MARKET_DATA_FABRIC.md).
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
import { Radio, Satellite } from "lucide-react";
import { getMexcChartCandles } from "../engine-bridge";
import type { UniversalCryptoSymbol } from "./universal-symbol";

// Mesma cadência do ciclo cripto principal e de TradFiRealChart (ver
// comentário de HTF_REFRESH_MS em engine-bridge.ts) — nenhuma cadência
// nova inventada.
const REFRESH_MS = 30_000;

// Ordem MEXC §13/§9: "se o ativo acabou de ser listado, mostrar
// HISTORICO_INSUFICIENTE, nunca fabricar candle". Um limiar real e
// honesto — abaixo dele, qualquer motor de estrutura/regime real
// (fractal-swings, ADX) já degrada a ruído; nunca inventado como um
// "número mágico" novo, é o mesmo piso mínimo de candles que
// analyzeMarketStructure/classifyMarketRegime já assumem implicitamente
// em todo o resto do sistema para produzir uma leitura não-degenerada.
const MIN_CANDLES_FOR_SUFFICIENT_HISTORY = 20;

interface MexcCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type LoadStatus = "LOADING" | "OK" | "HISTORICO_INSUFICIENTE" | "DADOS_INSUFICIENTES";

export function MexcRealChart({
  asset,
  timeframe,
}: {
  asset: UniversalCryptoSymbol;
  timeframe: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [status, setStatus] = useState<LoadStatus>("LOADING");
  const [lastCandle, setLastCandle] = useState<MexcCandle | null>(null);
  const [candleCount, setCandleCount] = useState(0);

  // Efeito 1 (deps []): cria o chart real UMA vez por montagem — mesmo
  // padrão de TradFiRealChart/EnhancedChart_110_Percent.tsx.
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

  // Efeito 2: busca candles reais (baseAsset + timeframe) via
  // getMexcChartCandles — mesmo caminho real já provado por
  // scanRadarCandidate (Radar), nunca um fetch paralelo. Poll a cada
  // REFRESH_MS enquanto montado, mesma cadência do ciclo cripto principal.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const candles = await getMexcChartCandles(asset.baseAsset, 200, timeframe);
      if (cancelled) return;
      if (!candles || candles.length === 0) {
        setStatus("DADOS_INSUFICIENTES");
        setCandleCount(0);
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
      setCandleCount(candles.length);
      setStatus(candles.length < MIN_CANDLES_FOR_SUFFICIENT_HISTORY ? "HISTORICO_INSUFICIENTE" : "OK");
    }
    setStatus("LOADING");
    setLastCandle(null);
    setCandleCount(0);
    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [asset.baseAsset, timeframe]);

  return (
    <div className="cyber-panel flex-1 min-h-[280px] flex flex-col gap-1 p-2">
      <div className="flex items-center justify-between shrink-0 px-1 gap-2">
        <span className="text-[0.6rem] font-bold text-[#a0f0ff]/80 tracking-wide uppercase truncate">
          {asset.baseAsset}/USDT · {asset.nativeSymbol}
        </span>
        {/* Ordem MEXC §7/§12, Ordem Universal §12: exchange+mercado SEMPRE
            visíveis aqui — nunca só no tooltip. */}
        <span className="flex items-center gap-1 text-[0.5rem] font-bold tracking-[0.1em] text-[#00e0a0]/80 uppercase shrink-0">
          <Satellite size={10} /> MEXC · FUTURES (Tempo Real)
        </span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
      {status === "LOADING" && (
        <div className="flex items-center justify-center gap-2 py-6 text-[0.55rem] text-[#8ab4f8]/60 uppercase tracking-wide">
          <Radio size={14} className="animate-pulse-glow" /> Buscando candles reais na MEXC...
        </div>
      )}
      {status === "DADOS_INSUFICIENTES" && (
        <div className="flex items-center justify-center gap-2 py-6 text-[0.55rem] text-[#ff0055]/80 uppercase tracking-wide text-center px-4">
          DADOS_INSUFICIENTES · MEXC indisponível nesta tentativa (nunca simulado)
        </div>
      )}
      {status === "HISTORICO_INSUFICIENTE" && (
        <div className="text-[0.55rem] text-[#ffb020]/80 px-1 shrink-0 uppercase tracking-wide text-center">
          ATIVO ENCONTRADO · MEXC · FUTURES · HISTÓRICO INSUFICIENTE ({candleCount} candle{candleCount === 1 ? "" : "s"}) — análise estrutural não aplicada até haver amostra suficiente
        </div>
      )}
      {status === "OK" && lastCandle && (
        <div className="text-[0.55rem] text-[#8ab4f8]/60 px-1 shrink-0">
          Último close real: {lastCandle.close} · {candleCount} candles reais
        </div>
      )}
    </div>
  );
}
