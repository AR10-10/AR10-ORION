// KillZoneBandsPlugin.tsx — Pedido do Operador ("ferramentas mais
// precisas"): ICT Kill Zones no CANVAS (o badge do header já existe,
// §6.48 — este plugin fecha a lacuna do desenho real). Pesquisa real
// confirmada (scripts reais de ICT Killzones no TradingView — TFLab/
// TakingProphets/BryceWH/0xCryptoVince — todos desenham a mesma
// convenção: retângulo/caixa sombreada cobrindo a janela de tempo real,
// nunca uma linha única como Market Sessions). Mesma arquitetura de
// overlay (Canvas 2D próprio, dirty-flag + rAF, ResizeObserver) já
// provada 3x (LiquidityZonesPlugin/StructureBreakMarkersPlugin/
// MarketSessionBandsPlugin) — quarta instância dela, geometria de
// retângulo (início+fim reais) como LiquidityZonesPlugin, não linha
// única como MarketSessionBandsPlugin (Kill Zone é uma JANELA, sessão
// de mercado é uma partição contínua).
//
// Cor: MESMO âmbar `#ffb020` já usado pelo badge de Kill Zone no header
// (App.tsx) — reaproveita o papel visual já existente da mesma
// ferramenta, nunca introduz um tom novo na paleta (achado direto da
// auditoria de consolidação de cores, DIRETRIZES AVANÇADAS §4/§6.53).
//
// LEI 24: display only, puro contexto temporal — nunca uma decisão.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { computeKillZoneSpans, type KillZoneSpan } from "../nexus/kill-zones";

const FILL_COLOR = "rgba(255, 176, 32, 0.06)";
const BORDER_COLOR = "rgba(255, 176, 32, 0.22)";
const LABEL_COLOR = "rgba(255, 176, 32, 0.65)";
const MIN_LABEL_WIDTH_PX = 40; // abaixo disto, o rótulo não cabe — a caixa ainda desenha, só o texto pula.

interface KillZoneBandsPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number }[];
}

export function KillZoneBandsPlugin({ chart, series, data }: KillZoneBandsPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef(data);
  const markDirtyRef = useRef<(() => void) | null>(null);
  // Evolução do Organismo (Fase 2, "menor cálculos duplicados"): benchmark
  // real confirmou computeKillZoneSpans em ~1.2ms/chamada no teto real de
  // MAX_CHART_HISTORY=2000 candles (App.tsx) — nada alarmante isolado, mas
  // draw() roda a cada pan/zoom/resize (rAF), e o resultado é IDÊNTICO
  // entre esses redraws porque só depende de `data`, nunca do range
  // visível. Cache por identidade de referência (dataRef.current só troca
  // de objeto quando App.tsx chama setChartData de verdade) elimina o
  // recálculo redundante sem introduzir fingerprint/hash algum.
  const spansCacheRef = useRef<{ data: typeof data; spans: KillZoneSpan[] } | null>(null);

  // Sempre a versão mais recente dos candles para o loop de desenho ler —
  // mesmo padrão de LiquidityZonesPlugin/MarketSessionBandsPlugin.
  dataRef.current = data;

  useEffect(() => {
    markDirtyRef.current?.();
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!chart || !series || !canvas) return;

    let rafScheduled = false;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      if (cssWidth === 0 || cssHeight === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const pxWidth = Math.round(cssWidth * dpr);
      const pxHeight = Math.round(cssHeight * dpr);
      if (canvas.width !== pxWidth || canvas.height !== pxHeight) {
        canvas.width = pxWidth;
        canvas.height = pxHeight;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const cached = spansCacheRef.current;
      let spans: KillZoneSpan[];
      if (cached && cached.data === dataRef.current) {
        spans = cached.spans;
      } else {
        spans = computeKillZoneSpans(dataRef.current);
        spansCacheRef.current = { data: dataRef.current, spans };
      }
      if (spans.length === 0) return; // amostra sem nenhuma kill zone real (comum — a maior parte do dia não tem nenhuma).

      const timeScale = chart.timeScale();
      // Meia-largura de barra real (lightweight-charts): sem isto, o
      // retângulo iria do CENTRO do primeiro candle ao CENTRO do último,
      // cortando visualmente metade de cada candle nas bordas.
      const halfBar = (timeScale.options().barSpacing ?? 0) / 2;
      ctx.font = "9px -apple-system, sans-serif";
      ctx.textBaseline = "top";

      for (const span of spans) {
        const x1 = timeScale.timeToCoordinate(span.startTime as unknown as Time);
        const x2 = timeScale.timeToCoordinate(span.endTime as unknown as Time);
        if (x1 === null || x2 === null) continue; // fora da área visível agora — Fail-Closed: nunca extrapola.

        const rectX = Math.min(x1, x2) - halfBar;
        const rectWidth = Math.max(1, Math.abs(x2 - x1) + halfBar * 2);
        const clippedX = Math.max(0, rectX);
        const clippedWidth = Math.min(rectX + rectWidth, cssWidth) - clippedX;
        if (clippedWidth <= 0) continue;

        ctx.fillStyle = FILL_COLOR;
        ctx.fillRect(clippedX, 0, clippedWidth, cssHeight);
        // Fio de Seda (Regra de Ouro 5): 1px sólida real nas bordas
        // verticais da janela, nunca setLineDash.
        ctx.lineWidth = 1;
        ctx.strokeStyle = BORDER_COLOR;
        ctx.beginPath();
        ctx.moveTo(Math.round(rectX) + 0.5, 0);
        ctx.lineTo(Math.round(rectX) + 0.5, cssHeight);
        ctx.moveTo(Math.round(rectX + rectWidth) + 0.5, 0);
        ctx.lineTo(Math.round(rectX + rectWidth) + 0.5, cssHeight);
        ctx.stroke();

        if (clippedWidth >= MIN_LABEL_WIDTH_PX) {
          ctx.fillStyle = LABEL_COLOR;
          ctx.fillText(span.label.toUpperCase(), clippedX + 3, 3);
        }
      }
    };

    const markDirty = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        draw();
      });
    };
    markDirtyRef.current = markDirty;

    const onRangeChange = () => markDirty();
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    const resizeObserver = new ResizeObserver(() => markDirty());
    resizeObserver.observe(canvas);

    markDirty(); // primeiro desenho real assim que o chart/série existem.

    return () => {
      markDirtyRef.current = null;
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      resizeObserver.disconnect();
    };
  }, [chart, series]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
