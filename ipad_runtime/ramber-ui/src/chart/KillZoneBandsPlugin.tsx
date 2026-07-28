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
// Decaimento por idade (achado real de captura de tela do Operador —
// mesma causa raiz de trap-detection.ts v3: sem decaimento, TODA
// ocorrência de Kill Zone na história inteira carregada ficava
// permanente, empilhando janelas repetidas — recorrem diariamente, então
// isto acumula rápido). computeKillZoneSpans agora expõe `endIndex` real
// (nexus/kill-zones.ts) — mesmo utilitário/mesma curva de
// annotation-decay.ts::ageAlpha já usado por BOS/CHOCH (BREAK_DECAY) e
// Liquidity Sweep (SWEEP_DECAY, EnhancedChart_110_Percent.tsx) — zero
// terceira técnica de decaimento inventada. Mesmo horizonte 50/200/0.12
// pedido pelo Operador pra "marcações antigas" em geral (nenhuma
// evidência de um número diferente ser necessário especificamente aqui).
//
// LEI 24: display only, puro contexto temporal — nunca uma decisão.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { computeKillZoneSpans, type KillZoneSpan } from "../nexus/kill-zones";
import { ageAlpha, type DecayConfig } from "./annotation-decay";
// Diretriz Final de Lapidação Visual, Adendo, Parte 11: rótulo de nome da
// janela virou caixa real (mesma primitiva de LiquidityZonesPlugin/
// LiquidationHeatmapPlugin/InstitutionalZonePlugin).
import { drawCanvasLabel } from "../nexus/canvas-label";

export const KILL_ZONE_DECAY: DecayConfig = { fadeStartCandles: 50, expireCandles: 200, minAlpha: 0.12 };

// Alphas BASE (na frescura máxima) — multiplicados pelo decaimento real
// por idade a cada desenho, nunca uma rgba fixa.
const FILL_ALPHA = 0.06;
const BORDER_ALPHA = 0.22;
const LABEL_ALPHA = 0.65;
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

      const totalCandles = dataRef.current.length;
      for (const span of spans) {
        const age = totalCandles - 1 - span.endIndex;
        const alpha = ageAlpha(age, KILL_ZONE_DECAY);
        if (alpha <= 0) continue; // expirado (>200 candles) — some da TELA, mesma honestidade de "esquecido" de BOS/CHOCH/Sweep.

        const x1 = timeScale.timeToCoordinate(span.startTime as unknown as Time);
        const x2 = timeScale.timeToCoordinate(span.endTime as unknown as Time);
        if (x1 === null || x2 === null) continue; // fora da área visível agora — Fail-Closed: nunca extrapola.

        const rectX = Math.min(x1, x2) - halfBar;
        const rectWidth = Math.max(1, Math.abs(x2 - x1) + halfBar * 2);
        const clippedX = Math.max(0, rectX);
        const clippedWidth = Math.min(rectX + rectWidth, cssWidth) - clippedX;
        if (clippedWidth <= 0) continue;

        ctx.fillStyle = `rgba(255, 176, 32, ${(alpha * FILL_ALPHA).toFixed(3)})`;
        ctx.fillRect(clippedX, 0, clippedWidth, cssHeight);
        // Fio de Seda (Regra de Ouro 5): 1px sólida real nas bordas
        // verticais da janela, nunca setLineDash.
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255, 176, 32, ${(alpha * BORDER_ALPHA).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(Math.round(rectX) + 0.5, 0);
        ctx.lineTo(Math.round(rectX) + 0.5, cssHeight);
        ctx.moveTo(Math.round(rectX + rectWidth) + 0.5, 0);
        ctx.lineTo(Math.round(rectX + rectWidth) + 0.5, cssHeight);
        ctx.stroke();

        if (clippedWidth >= MIN_LABEL_WIDTH_PX) {
          // Diretriz Final Adendo Parte 11: caixa real em vez de texto nu
          // — mesma cor/mesmo decaimento real de antes (alpha*LABEL_ALPHA
          // já bakeada no rgba), só a primitiva de desenho muda.
          drawCanvasLabel(ctx, clippedX + 3, 3, { fill: `rgba(255, 176, 32, ${(alpha * LABEL_ALPHA).toFixed(3)})`, text: span.label.toUpperCase() });
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
