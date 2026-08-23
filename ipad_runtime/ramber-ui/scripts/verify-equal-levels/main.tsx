// Harness de VERIFICAÇÃO VISUAL do trecho EQH/EQL (CLAUDE.md, Disciplina de
// trabalho §4: "para mudanças visuais/de UI, uma verificação real com
// Playwright — nunca reportar sucesso sem ter rodado isso").
//
// Monta o LiquidityZonesPlugin REAL sobre um lightweight-charts REAL. Os
// candles abaixo são fixture de RENDERIZAÇÃO, nunca dado de mercado: este
// arquivo não é importado por nenhum caminho do app (vive em scripts/, fora
// de src/), então a Regra de Ouro 1 — zero dado sintético no fluxo de
// mercado real — continua valendo integralmente.
// A folha real do app: sem ela as classes utilitárias do plugin
// ("absolute inset-0") viram nomes inertes e o <canvas> — elemento
// "replaced" — entra no fluxo normal e empurra o gráfico para baixo. Foi
// exatamente o que aconteceu na primeira captura desta verificação.
import "../../src/index.css";
import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { LiquidityZonesPlugin, type EqualLevelMark } from "../../src/chart/LiquidityZonesPlugin";
import { chartLocale } from "../../src/chart/tick-mark-format";

const T0 = 1_700_000_000;
const PEAKS = [10, 20, 30];
const data = Array.from({ length: 60 }, (_, i) => {
  const alto = PEAKS.includes(i);
  const low = alto ? 105 : 98;
  const high = alto ? 110 : 100;
  return { time: (T0 + i * 900) as UTCTimestamp, open: (low + high) / 2, high, low, close: (low + high) / 2 };
});

const pools: EqualLevelMark[] = [
  { type: "EQUAL_HIGH", price: 110, touches: 3, index: 30, firstIndex: 10, touchIndices: PEAKS },
];

function Harness() {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState<{ chart: IChartApi; series: ISeriesApi<"Candlestick"> } | null>(null);

  useEffect(() => {
    if (!boxRef.current) return;
    const chart = createChart(boxRef.current, {
      width: 1200,
      height: 500,
      layout: { background: { color: "#050912" }, textColor: "#8A94A0" },
      grid: { vertLines: { color: "#0e1626" }, horzLines: { color: "#0e1626" } },
      // Mesma proteção de locale do gráfico real — ver chartLocale().
      localization: { locale: chartLocale() },
      timeScale: { timeVisible: true },
    });
    const series = chart.addSeries(CandlestickSeries, {});
    series.setData(data);
    chart.timeScale().fitContent();
    setReady({ chart, series });
    (window as unknown as { __pronto: boolean }).__pronto = true;
    return () => chart.remove();
  }, []);

  return (
    <div ref={boxRef} style={{ position: "relative", width: 1200, height: 500 }}>
      <LiquidityZonesPlugin
        chart={ready?.chart ?? null}
        series={ready?.series ?? null}
        data={data}
        fairValueGaps={[]}
        orderBlocks={[]}
        equalLevels={pools}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
