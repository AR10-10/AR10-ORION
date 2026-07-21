// LiquidityZonesPlugin.tsx — V-MAX Fase 0.7 (Blueprint §3.1: "Zonas SMC +
// Liquidity | LiquidityZonesPlugin | Canvas Overlay + Fio de Seda |
// Dirty-flag + rAF"). Substitui o par de price lines top/bottom que FVG/OB
// usavam (EnhancedChart_110_Percent.tsx, V18 Sprint 1) por uma área
// colorida real, real por ser exatamente o mesmo dado (computeSmcZones,
// zero cálculo novo) — só a primitiva de desenho muda, de duas linhas de
// largura total para um retângulo do PONTO REAL de formação da zona
// (candle.index → tempo real) até a borda direita do canvas visível.
//
// Pedido explícito do Operador (V18.2): "não é pra tu tirar as cor do
// gráfico não, aonde os mapa de liquidez era pra manter". A cor de cada
// zona é EXATAMENTE a mesma já usada nas price lines que este componente
// substitui (mesmo rgba, hierarquia BULLISH/BEARISH e FVG/OB inalterada)
// — só ganha um preenchimento translúcido além da borda.
//
// "Fio de Seda" (Regra de Ouro 2): a borda de cada zona é 1px sólida —
// nunca pontilhada/tracejada — desenhada com Canvas 2D `strokeRect`
// (lineWidth 1 real, não um `setLineDash`). A distinção entre zonas nunca
// vem do estilo do traço, só de cor/opacidade — mesma lei já travada por
// teste nas price lines de S1/R1/liquidez que continuam intocadas.
//
// Overlay em <canvas> próprio (Blueprint §3.2: "OffscreenCanvas quando
// suportado; fallback Canvas 2D no Safari/iPad" — iPad Safari não suporta
// OffscreenCanvas com contexto 2d transferido para worker de forma
// confiável hoje; desenhar direto no canvas do main thread aqui é
// exatamente esse fallback, não uma omissão), nunca posicionado por
// coordenada fixa: cada redraw resolve preço→pixel via
// series.priceToCoordinate/timeScale.timeToCoordinate reais da própria
// lib, então zonas nunca "descolam" durante pan/zoom.
//
// Dirty-flag + requestAnimationFrame (Blueprint §3.2): nenhum loop
// perpétuo consumindo CPU/bateria à toa — um redraw só é agendado quando
// algo realmente mudou (zonas, candles, range visível ou tamanho), nunca a
// cada frame incondicionalmente. Main thread sagrado: cada redraw é um
// punhado de fillRect/strokeRect, não um cálculo pesado.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { ageAlpha, type DecayConfig } from "./annotation-decay";

export interface FillableZone {
  type: "BULLISH" | "BEARISH";
  top: number;
  bottom: number;
  index: number;
}

interface ZonePalette {
  fill: string;
  border: string;
}

// Mesmo rgba exato das price lines que este overlay substitui — a
// hierarquia visual (OB mais presente que FVG) já existia, só ganha um
// preenchimento proporcionalmente mais translúcido que a borda.
const FVG_BULLISH: ZonePalette = { fill: "rgba(0, 255, 170, 0.10)", border: "rgba(0, 255, 170, 0.30)" };
const FVG_BEARISH: ZonePalette = { fill: "rgba(255, 0, 85, 0.10)", border: "rgba(255, 0, 85, 0.30)" };
const OB_BULLISH: ZonePalette = { fill: "rgba(0, 255, 170, 0.15)", border: "rgba(0, 255, 170, 0.40)" };
const OB_BEARISH: ZonePalette = { fill: "rgba(255, 0, 85, 0.15)", border: "rgba(255, 0, 85, 0.40)" };

// Diretriz Restauração/Inteligência Visual §6 ("risco visual... obstáculo
// estrutural"): MESMA cor/hierarquia acima — o preenchimento nunca muda
// ("não é pra tirar as cor do gráfico não" continua valendo aqui também) —
// só a borda fica bem mais opaca quando esta MESMA zona já desenhada é, no
// plano ATIVO, um obstáculo real no caminho entrada→alvo
// (trade-plan.ts:obstacleZonesInPath, reusado por App.tsx — zero segundo
// cálculo). Sem plano ativo, obstacleZones vem vazio e nada muda.
const FVG_BULLISH_OBSTACLE: ZonePalette = { fill: "rgba(0, 255, 170, 0.10)", border: "rgba(0, 255, 170, 0.85)" };
const FVG_BEARISH_OBSTACLE: ZonePalette = { fill: "rgba(255, 0, 85, 0.10)", border: "rgba(255, 0, 85, 0.85)" };
const OB_BULLISH_OBSTACLE: ZonePalette = { fill: "rgba(0, 255, 170, 0.15)", border: "rgba(0, 255, 170, 0.85)" };
const OB_BEARISH_OBSTACLE: ZonePalette = { fill: "rgba(255, 0, 85, 0.15)", border: "rgba(255, 0, 85, 0.85)" };

function paletteFor(kind: "FVG" | "OB", type: "BULLISH" | "BEARISH", isObstacle: boolean): ZonePalette {
  if (kind === "FVG") {
    if (isObstacle) return type === "BULLISH" ? FVG_BULLISH_OBSTACLE : FVG_BEARISH_OBSTACLE;
    return type === "BULLISH" ? FVG_BULLISH : FVG_BEARISH;
  }
  if (isObstacle) return type === "BULLISH" ? OB_BULLISH_OBSTACLE : OB_BEARISH_OBSTACLE;
  return type === "BULLISH" ? OB_BULLISH : OB_BEARISH;
}

// Ordem "Ciborgue Vivo" (§1, "pensa e depois esquece para não acumular
// peso"): decaimento real por idade em candles (ver annotation-decay.ts —
// mesma função compartilhada com StructureBreakMarkersPlugin, zero
// duplicação). Uma zona jovem desenha na opacidade total de sempre; a
// partir de 30 candles esmaece linearmente até 15%; depois de 100 candles
// some do desenho — "esquecida" apenas da TELA, nunca do dado real:
// smcZones (App.tsx) continua com o registro completo para qualquer outro
// consumidor (ex. Trade Plan), isto só decide o que este canvas pinta.
const ZONE_DECAY: DecayConfig = { fadeStartCandles: 30, expireCandles: 100, minAlpha: 0.15 };

interface LiquidityZonesPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number }[];
  fairValueGaps: FillableZone[];
  orderBlocks: FillableZone[];
  // Diretriz Restauração/Inteligência Visual §6: zonas reais (as MESMAS já
  // desenhadas acima, identificadas por low/high) que o Trade Plan ATIVO
  // cruza a caminho de algum alvo — opcional/fail-closed: ausente/vazio =>
  // desenho idêntico ao de sempre, nenhuma zona em ênfase.
  obstacleZones?: { low: number; high: number }[];
}

export function LiquidityZonesPlugin({ chart, series, data, fairValueGaps, orderBlocks, obstacleZones }: LiquidityZonesPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zonesRef = useRef({ fairValueGaps, orderBlocks, data, obstacleZones });
  const markDirtyRef = useRef<(() => void) | null>(null);

  // Sempre a versão mais recente das zonas/candles para o loop de desenho
  // ler — nunca dispara o efeito de setup abaixo de novo (evita reabrir a
  // conexão com o chart/reassinar os listeners a cada atualização de dado).
  zonesRef.current = { fairValueGaps, orderBlocks, data, obstacleZones };

  useEffect(() => {
    markDirtyRef.current?.();
  }, [fairValueGaps, orderBlocks, data, obstacleZones]);

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

      const timeScale = chart.timeScale();
      const { fairValueGaps: fvgs, orderBlocks: obs, data: candles, obstacleZones: obstacles } = zonesRef.current;

      const currentIndex = candles.length - 1;
      // Identidade por low/high real (mesmos números, zero recálculo) —
      // nunca por índice/posição, que pode divergir entre a lista de zonas
      // do gráfico e a lista de obstáculos do plano.
      const isObstacle = (zone: FillableZone) =>
        (obstacles ?? []).some((o) => o.low === zone.bottom && o.high === zone.top);

      const drawZone = (zone: FillableZone, palette: ZonePalette, label: string) => {
        const point = candles[zone.index];
        if (!point) return; // índice fora da janela real de candles — nunca desenha um palpite.
        const age = currentIndex - zone.index;
        const alpha = ageAlpha(age, ZONE_DECAY);
        if (alpha <= 0) return; // "esquecida" — só da tela, ver comentário de ageAlpha acima.
        const x1 = timeScale.timeToCoordinate(point.time as unknown as Time);
        const y1 = series.priceToCoordinate(zone.top);
        const y2 = series.priceToCoordinate(zone.bottom);
        if (x1 === null || y1 === null || y2 === null) return; // fora da área visível agora — Fail-Closed: nunca extrapola.
        const rectX = x1;
        const rectY = Math.min(y1, y2);
        const rectHeight = Math.max(1, Math.abs(y2 - y1));
        const rectWidth = cssWidth - rectX;
        if (rectWidth <= 0) return;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = palette.fill;
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        // Fio de Seda: 1px sólida real (Canvas 2D nunca usa setLineDash aqui).
        ctx.lineWidth = 1;
        ctx.strokeStyle = palette.border;
        ctx.strokeRect(rectX + 0.5, rectY + 0.5, Math.max(0, rectWidth - 1), Math.max(0, rectHeight - 1));
        // Label elegante (Ordem "Ciborgue Vivo" §1): identifica o tipo direto
        // no gráfico, sem abrir painel nenhum — mesma opacidade decrescente
        // da própria zona, nunca compete visualmente com uma zona já velha.
        if (rectWidth > 24 && rectHeight > 10) {
          ctx.font = "9px -apple-system, sans-serif";
          ctx.fillStyle = palette.border;
          ctx.textBaseline = "top";
          ctx.fillText(label, rectX + 3, rectY + 2);
        }
        ctx.globalAlpha = 1;
      };

      fvgs.forEach((z) => drawZone(z, paletteFor("FVG", z.type, isObstacle(z)), isObstacle(z) ? "FVG ⚠" : "FVG"));
      obs.forEach((z) => drawZone(z, paletteFor("OB", z.type, isObstacle(z)), isObstacle(z) ? "OB ⚠" : "OB"));
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

    // ResizeObserver, não a API de tamanho da própria lib: o mesmo padrão
    // já usado no resto do sistema (Blueprint §3.3) para o buffer de
    // desenho do canvas (que precisa de pixels reais, não CSS) acompanhar
    // o container — desacoplado de qualquer particularidade da lib de
    // gráfico.
    const resizeObserver = new ResizeObserver(() => markDirty());
    resizeObserver.observe(canvas);

    markDirty(); // primeiro desenho real assim que o chart/série existem.

    return () => {
      markDirtyRef.current = null;
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      resizeObserver.disconnect();
    };
  }, [chart, series]);

  // <canvas> é um elemento "replaced" em CSS: position:absolute + inset:0
  // sozinho NÃO o estica para preencher o container (ele mantém o tamanho
  // intrínseco 300x150 do HTML) — precisa de width/height explícitos
  // (achado real via verificação com harness Playwright, não uma
  // suposição). style inline aqui porque é o único jeito 100% confiável
  // de garantir isto independente de qualquer classe utilitária disponível.
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
