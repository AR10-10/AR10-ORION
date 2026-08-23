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
import { createChart, CandlestickSeries, LineSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { LiquidityZonesPlugin, type EqualLevelMark, type FillableZone } from "../../src/chart/LiquidityZonesPlugin";
import { chartLocale } from "../../src/chart/tick-mark-format";
// SuperTrend: as MESMAS funções reais que o gráfico usa — o bridge do motor
// e a separação em duas séries. Nunca uma cópia da lógica, que poderia
// divergir e fazer esta verificação mentir.
import { computeSuperTrend } from "../../src/engine-bridge";
import { splitSuperTrendSeries } from "../../src/chart/supertrend-series";

const T0 = 1_700_000_000;
const PEAKS = [10, 20, 30];
// Série com um platô (onde vivem os topos iguais do EQH) seguido de alta e
// reversão — o suficiente para o SuperTrend aquecer o ATR de Wilder e
// mostrar os DOIS sentidos com um flip real no meio.
const data = Array.from({ length: 120 }, (_, i) => {
  let mid: number;
  if (i < 60) mid = PEAKS.includes(i) ? 107.5 : 99;
  else if (i < 90) mid = 99 + (i - 60) * 0.9;
  else mid = 126 - (i - 90) * 1.1;
  const low = mid - 1.2;
  const high = mid + 1.2;
  return { time: (T0 + i * 900) as UTCTimestamp, open: mid, high, low, close: mid };
});

const pools: EqualLevelMark[] = [
  { type: "EQUAL_HIGH", price: 110, touches: 3, index: 30, firstIndex: 10, touchIndices: PEAKS },
];

// Graduação de institutional-blocks.js: um Breaker (direção OPERACIONAL já
// invertida pelo motor) e um Mitigation, para conferir na tela que os dois
// desenham no MESMO canvas com a hierarquia certa (borda presente,
// preenchimento fraco — um bloco que já falhou é referência estrutural,
// não zona ativa de mesma força).
const breakers: FillableZone[] = [{ type: "BEARISH", top: 103, bottom: 101.5, index: 36 }];
const mitigations: FillableZone[] = [{ type: "BULLISH", top: 99.5, bottom: 98.2, index: 44 }];

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

    // Mesmas duas LineSeries do gráfico real (verde alta / vermelha baixa,
    // 1px sólidas), alimentadas pela MESMA função de separação.
    const stUp = chart.addSeries(LineSeries, {
      color: "rgba(8, 153, 129, 0.70)", lineWidth: 1, priceLineVisible: false,
      lastValueVisible: false, crosshairMarkerVisible: false, title: "",
    });
    const stDown = chart.addSeries(LineSeries, {
      color: "rgba(242, 54, 69, 0.70)", lineWidth: 1, priceLineVisible: false,
      lastValueVisible: false, crosshairMarkerVisible: false, title: "",
    });
    const { up, down } = splitSuperTrendSeries<UTCTimestamp>(
      computeSuperTrend(data),
      (i) => (data[i] ? data[i].time : undefined),
    );
    stUp.setData(up);
    stDown.setData(down);
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
        breakerBlocks={breakers}
        mitigationBlocks={mitigations}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
