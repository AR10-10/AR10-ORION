// PriceLabelStackPlugin.tsx — desenha os rótulos de eixo REAIS (S1/R1/
// VWAP/NL/EMA/último preço) num overlay <canvas> próprio, com posição
// vertical resolvida por price-label-stack.ts para NUNCA colidir.
// Substitui os "last value label"/"axis label" nativos dessas séries/
// price lines (desligados em EnhancedChart_110_Percent.tsx —
// lastValueVisible:false / axisLabelVisible:false) porque a lib não tem
// nenhuma consciência cross-série da posição de cada rótulo, e por isso
// nunca evita colisão sozinha — achado real de captura de tela do
// Operador (BTC/USDT 1H, preço formando perto de R1: R1/VWAP/NL/último
// preço todos empilhados/ilegíveis no canto do eixo).
//
// Mesma arquitetura de overlay do resto do gráfico (canvas próprio,
// dirty-flag + rAF, ResizeObserver) — "Fio de Seda": o CONECTOR fino que
// liga um rótulo deslocado de volta ao preço real (quando precisa
// deslocar) é 1px sólido, nunca tracejado, mesma disciplina de qualquer
// outra linha de marcação deste gráfico. Nenhum preço muda — só a
// posição vertical do RÓTULO pode deslocar, e a informação nunca
// desaparece: o conector garante que o operador sempre sabe onde o
// preço real está, mesmo quando o texto precisou se mover pra não
// colidir.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { resolveLabelStackPositions } from "./price-label-stack";

export interface PriceAxisLabel {
  price: number;
  text: string;
  // Mesma cor real já usada pela linha/série que este rótulo representa
  // — nunca uma cor nova (S1/R1 = verde/vermelho de sempre, VWAP/NL =
  // cor de estado real, EMA = azul-material, último preço = up/down da
  // própria vela).
  color: string;
  // Opcional (default 1 — opaco, comportamento de sempre para todo rótulo
  // existente): decaimento real por idade (ex.: BOS/CHOCH via ageAlpha/
  // BREAK_DECAY, StructureBreakMarkersPlugin) — "o sistema pensa e depois
  // esquece" sem perder a garantia de zero colisão deste plugin.
  alpha?: number;
}

// Altura real de uma etiqueta (px) — folga para o texto 9px + padding
// vertical, mesma ordem de grandeza da fonte já usada nos outros
// overlays deste gráfico.
export const LABEL_HEIGHT_PX = 16;
// Achado real via harness Playwright (verificação desta correção):
// alimentar o resolvedor com minGapPx = LABEL_HEIGHT_PX faz duas
// etiquetas colidindo ficarem exatamente ENCOSTADAS (gap zero) — nunca
// sobrepostas de fato, mas visualmente lidas como "uma coisa só" quando
// as cores/larguras são bem diferentes (ex.: "VWAP ↓ 64854.83" ao lado
// de um número solto sem prefixo). MIN_GAP_PX folgado garante uma fresta
// real e visível entre duas etiquetas mesmo no pior caso — "cada desenho
// no lugar preciso, nunca um em cima do outro" de verdade, não só
// matematicamente.
const MIN_GAP_PX = LABEL_HEIGHT_PX + 4;
const LABEL_PADDING_X = 5;
const RIGHT_MARGIN_PX = 2;

// Achado real via harness Playwright (verificação desta correção): as
// cores reaproveitadas (rgba(...), 0.65/0.75/0.85) são translúcidas de
// propósito para as LINHAS do gráfico — mas usadas como fundo de uma
// CAIXA de rótulo, deixam o tick do eixo de preço nativo (sempre
// desenhado pela própria lib atrás, ex.: "64800.00") sangrar através.
// Os "last value label" nativos que este overlay substitui SEMPRE foram
// blocos 100% opacos — mesma convenção aqui, só na cor de FUNDO da caixa
// (o conector fino continua com a opacidade real da linha, abaixo).
function opaque(rgba: string): string {
  const m = rgba.match(/rgba?\(([^,]+),([^,]+),([^,]+)(?:,[^)]+)?\)/);
  return m ? `rgb(${m[1]},${m[2]},${m[3]})` : rgba;
}

interface PriceLabelStackPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  labels: PriceAxisLabel[];
}

export function PriceLabelStackPlugin({ chart, series, labels }: PriceLabelStackPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef(labels);
  const markDirtyRef = useRef<(() => void) | null>(null);

  // Sempre a versão mais recente dos rótulos para o loop de desenho ler
  // — nunca dispara o efeito de setup abaixo de novo (mesmo padrão de
  // LiquidityZonesPlugin/StructureBreakMarkersPlugin).
  labelsRef.current = labels;

  useEffect(() => {
    markDirtyRef.current?.();
  }, [labels]);

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
      ctx.font = "9px -apple-system, sans-serif";

      const withNaturalY = labelsRef.current
        .map((l) => {
          const coord = series.priceToCoordinate(l.price);
          // Coordinate é um tipo nominal da própria lib (branded number) —
          // convertido pra number puro aqui, na fronteira: price-label-
          // stack.ts é matemática de posicionamento genérica, nunca deve
          // depender de um tipo específico da lightweight-charts.
          return coord === null ? null : { ...l, naturalY: coord as unknown as number };
        })
        .filter((e): e is PriceAxisLabel & { naturalY: number } => e !== null);
      if (withNaturalY.length === 0) return;

      const resolved = resolveLabelStackPositions(withNaturalY, MIN_GAP_PX);

      for (const entry of resolved) {
        // Decaimento real por idade (BOS/CHOCH) — default 1 preserva o
        // comportamento de sempre (opaco) para todo rótulo que não declara
        // alpha (S1/R1/VWAP/NL/EMA/TREND/ENTRY/STOP/TARGET/etc).
        const labelAlpha = entry.alpha ?? 1;
        const textWidth = ctx.measureText(entry.text).width;
        const boxWidth = textWidth + LABEL_PADDING_X * 2;
        const boxX = cssWidth - RIGHT_MARGIN_PX - boxWidth;
        const boxY = entry.resolvedY - LABEL_HEIGHT_PX / 2;
        if (boxY + LABEL_HEIGHT_PX < 0 || boxY > cssHeight) continue; // fora da área visível — Fail-Closed, nunca desenha fora do canvas

        // Conector fino de volta ao preço real quando o rótulo deslocou
        // — Fio de Seda (1px sólida, nunca tracejada). Nunca aparece
        // quando o rótulo já está na própria posição natural.
        if (Math.abs(entry.resolvedY - entry.naturalY) > 0.5) {
          ctx.strokeStyle = entry.color;
          ctx.globalAlpha = 0.5 * labelAlpha;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(boxX - 0.5, entry.naturalY);
          ctx.lineTo(boxX - 0.5, entry.resolvedY);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        ctx.globalAlpha = labelAlpha;
        ctx.fillStyle = opaque(entry.color);
        ctx.fillRect(boxX, boxY, boxWidth, LABEL_HEIGHT_PX);

        ctx.fillStyle = "#050810"; // texto escuro sobre fundo colorido — mesmo contraste dos tags nativos que este overlay substitui
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(entry.text, boxX + LABEL_PADDING_X, entry.resolvedY + 0.5);
        ctx.globalAlpha = 1;
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
      // Achado real via harness Playwright (Diretriz de Refinamento Visual
      // §5/§6): a lightweight-charts desenha seus PRÓPRIOS canvases
      // internos (painel principal + gutter do eixo de preço) com
      // z-index:1/z-index:2 explícitos. Sem um z-index explícito aqui, ESTE
      // canvas cai no z-index:auto — e por regra do CSS (stacking context),
      // z-index positivo SEMPRE pinta por cima de z-index:auto, não importa
      // a ordem no DOM. Resultado real observado: o próprio ticker nativo
      // do eixo (ex.: "64800.00", desenhado pela lib em intervalos
      // "redondos" independente de qualquer série) vazava por cima da
      // caixa opaca de um rótulo nosso sempre que os dois calhavam perto
      // (ex.: R1 ~64807 vs. tick nativo 64800.00) — exatamente a colisão
      // visual que este plugin existe para eliminar. z-index bem acima do
      // maior valor usado pela lib (2) garante que este overlay SEMPRE
      // pinta por último, cobrindo o tick nativo por completo.
      style={{ width: "100%", height: "100%", zIndex: 5 }}
    />
  );
}
