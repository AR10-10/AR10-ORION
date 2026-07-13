// NeuralMarketAuraPlugin.tsx — Neural Market Aura (NMA), especificação do
// Operador. Mesma arquitetura de overlay já estabelecida por
// LiquidityZonesPlugin/StructureBreakMarkersPlugin/TradePlanZonePlugin
// (Canvas 2D próprio, dirty-flag + rAF, ResizeObserver, fio de seda 1px
// sólido) — zero segunda arquitetura, só mais uma instância dela para o
// dado real do aura-lifecycle.ts. Ver o cabeçalho de aura-lifecycle.ts
// para o racional completo de escopo/honestidade.
//
// Divisão de responsabilidade com TradePlanZonePlugin (zero duplicação):
// aquele plugin já desenha a CAIXA da zona de entrada (um range real);
// este plugin NUNCA redesenha essa caixa — desenha o CORREDOR (entrada até
// o alvo) e o marcador de proximidade do alvo, um canal visual novo e
// distinto.
//
// "Largura do corredor" (Regra de Ouro honestidade): NÃO é incerteza sobre
// o preço do alvo — o alvo continua uma linha de preço exata e imutável
// (EnhancedChart_110_Percent). É a MASSA DE CONVICÇÃO real (Confluence
// Engine, 0..1) — mesmo princípio já usado pela espessura de barra do
// Volume Profile (magnitude real, nunca incerteza de preço). Convicção
// alta = corredor concentrado perto do preço atual (estreito); convicção
// baixa = corredor difuso, espalhado por mais tempo visível (amplo) — a
// mesma leitura de "cone de confiança" que estreita com mais confiança.
//
// Fio de Seda (Regra de Ouro 5, "zero exceção"): todo traço de borda deste
// plugin é lineWidth=1 sólido, nunca setLineDash, nunca uma largura
// variável — a convicção fala pelo PREENCHIMENTO/gradiente, nunca pela
// linha. As linhas de preço reais (entry/stop/target) nunca são tocadas
// aqui.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { AuraReading } from "../nexus/aura-lifecycle";

interface NeuralMarketAuraPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  aura: AuraReading | null;
}

// Mesma paleta direcional já usada em toda a UI (BOS/CHOCH, badges de
// direção): verde real para ALTA/sucesso, vermelho real para BAIXA/stop —
// um significado por cor em todo o app, nunca uma segunda paleta.
const LONG_RGB = "0, 255, 170";
const SHORT_RGB = "255, 0, 85";
const NEUTRAL_RGB = "138, 180, 248"; // mesmo azul-acinzentado usado para "neutro/informativo" em toda a UI

function phaseRgb(phase: AuraReading["phase"], direction: "LONG" | "SHORT"): string {
  // Enquanto o plano está aberto (BIRTH/ESTABLISHED), a cor comunica
  // DIREÇÃO. Uma vez resolvido, comunica RESULTADO real — um SHORT que
  // bate o alvo é um sucesso real (verde), não "vermelho porque é short".
  if (phase === "TARGET_HIT") return LONG_RGB;
  if (phase === "STOP_HIT") return SHORT_RGB;
  if (phase === "REPLACED") return NEUTRAL_RGB;
  return direction === "LONG" ? LONG_RGB : SHORT_RGB;
}

// Largura do corredor em pixels, do preço atual (borda direita) para trás:
// interpola entre um mínimo concentrado (convicção 1) e um máximo difuso
// (convicção 0 ou desconhecida). Parâmetros documentados — mesma natureza
// dos outros limiares visuais já escolhidos neste arquivo/sessão.
const CORRIDOR_MIN_PX = 60;
const CORRIDOR_MAX_PX = 220;
function corridorWidthPx(widthFactor: number | null): number {
  const f = widthFactor ?? 0; // convicção desconhecida => leitura mais difusa/conservadora, nunca a mais confiante
  return CORRIDOR_MAX_PX - f * (CORRIDOR_MAX_PX - CORRIDOR_MIN_PX);
}

export function NeuralMarketAuraPlugin({ chart, series, aura }: NeuralMarketAuraPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ aura });
  const markDirtyRef = useRef<(() => void) | null>(null);

  stateRef.current = { aura };

  useEffect(() => {
    markDirtyRef.current?.();
  }, [aura]);

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

      const { aura: reading } = stateRef.current;
      // Sem leitura real (nenhum plano rastreado, ou já dissolvida por
      // completo) => nada a desenhar, honesto — mesma regra do
      // StructureBreakMarkersPlugin.
      if (!reading || reading.status !== "OK" || !reading.plan || reading.fadeAlpha <= 0) return;

      const { plan, phase, targetProximity, corridorWidthFactor, pulseIntensity, fadeAlpha } = reading;
      const entryMid = (plan.entry.low + plan.entry.high) / 2;
      const yEntry = series.priceToCoordinate(entryMid);
      const yTarget = series.priceToCoordinate(plan.target.price);
      if (yEntry === null || yTarget === null) return; // fora da faixa de preço visível agora — Fail-Closed, nunca extrapola.

      const rgb = phaseRgb(phase, plan.direction);
      const top = Math.min(yEntry, yTarget);
      const bottom = Math.max(yEntry, yTarget);
      const bandHeight = Math.max(1, bottom - top);
      const bandWidth = Math.min(cssWidth, corridorWidthPx(corridorWidthFactor));
      const bandX = cssWidth - bandWidth; // ancorado na borda direita (preço atual), o corredor se estende para trás no tempo.

      // Preenchimento em gradiente vertical (entrada -> alvo) — a
      // convicção fala pela LARGURA/opacidade deste retângulo, nunca por
      // uma linha de marcação. Market Pulse (ATR% real normalizado)
      // modula a intensidade de base: mercado quieto = quase transparente,
      // volátil = mais vívido — mesma leitura da especificação.
      const pulse = pulseIntensity ?? 0.3; // sem ATR real ainda: leitura moderada, nunca a mais intensa
      const baseAlpha = (0.06 + 0.22 * pulse) * fadeAlpha;
      const gradient = ctx.createLinearGradient(0, top, 0, bottom);
      gradient.addColorStop(0, `rgba(${rgb}, ${baseAlpha})`);
      gradient.addColorStop(1, `rgba(${rgb}, ${baseAlpha * 1.6})`); // mais vívido perto do alvo — "atração" real do corredor
      ctx.fillStyle = gradient;
      ctx.fillRect(bandX, top, bandWidth, bandHeight);

      // Fio de Seda: a única linha de marcação deste plugin é a borda
      // superior do corredor (o lado "novo", o mais recente) — 1px sólida
      // real, nunca tracejada, nunca mais grossa que 1px independente da
      // convicção (a convicção já falou pela largura do preenchimento).
      ctx.globalAlpha = fadeAlpha;
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${rgb}, ${Math.min(1, baseAlpha * 3)})`;
      // Borda do lado do alvo — sempre o lado "novo" do corredor, independente da direção.
      ctx.beginPath();
      ctx.moveTo(bandX, Math.round(yTarget) + 0.5);
      ctx.lineTo(cssWidth, Math.round(yTarget) + 0.5);
      ctx.stroke();

      // Marcador de proximidade do alvo — 3 estados reais (Target Life
      // Cycle da especificação, comprimido para o único alvo real que o
      // TradePlan atual tem — ver cabeçalho de aura-lifecycle.ts).
      const markerX = cssWidth - 14;
      const markerY = yTarget;
      ctx.globalAlpha = fadeAlpha;
      ctx.lineWidth = 1;
      if (targetProximity === "HIT") {
        ctx.fillStyle = `rgba(${rgb}, 0.85)`;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${rgb}, 1)`;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 8, 0, Math.PI * 2);
        ctx.stroke();
      } else if (targetProximity === "APPROACHING") {
        ctx.fillStyle = `rgba(${rgb}, 0.55)`;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${rgb}, 0.8)`;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 7, 0, Math.PI * 2);
        ctx.stroke();
      } else if (targetProximity === "WAITING") {
        ctx.strokeStyle = `rgba(${rgb}, 0.4)`;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
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
