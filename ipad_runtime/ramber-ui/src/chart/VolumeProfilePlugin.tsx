// VolumeProfilePlugin.tsx — V-MAX Fase 1 (superfície visual): desenha o
// Volume Profile REAL (WASM Quant Core, Fase 1.3) como barras horizontais
// ancoradas à direita do gráfico — a representação clássica de VP — mais a
// linha do POC. Mesma arquitetura provada do LiquidityZonesPlugin/
// OrderFlowHeatmapPlugin: <canvas> overlay próprio, dirty-flag +
// requestAnimationFrame (nunca loop perpétuo), geometria SEMPRE resolvida
// via series.priceToCoordinate() real da lib — as barras nunca "descolam"
// no pan/zoom vertical.
//
// Fonte de dado: a store (useVolumeProfileSnapshot) — diferente das zonas
// SMC (que chegam por props já filtradas pelo ChartWidget), o VP é
// propriedade da store desde a Fase 1.3; assinar o seletor aqui evita
// prop-drilling por dois níveis sem nenhum ganho.
//
// Só o perfil FIXED RANGE é desenhado — sobrepor também o de sessão
// duplicaria barras na mesma faixa de preço e viraria ruído visual; o
// perfil de sessão continua real na store para HUD/agentes (decisão de
// legibilidade documentada, não uma omissão de dado).
//
// "Fio de Seda" (Regra de Ouro 2): a linha do POC é lineWidth = 1 sólida
// (nunca setLineDash). Hierarquia visual por cor/opacidade: HVN mais
// presente, LVN mais tênue — nunca pelo estilo do traço.
//
// Largura máxima das barras: fração documentada da largura do chart
// (legibilidade — o perfil contextualiza, nunca cobre as velas). O VALOR
// de cada barra continua 100% real (proporção volume/maxVolume).
//
// Lane própria (achado real, ver chart-profile-lanes.ts): Volume Profile,
// TPO Profile e Order Book Depth desenhavam TODOS a partir do mesmo
// cssWidth — mesma faixa de pixels sempre que mais de um estava visível
// ao mesmo tempo (o caso comum: os 3 defaults são true). Volume Profile é
// a lane 0 (rightmost) — offset sempre 0, então este plugin continua
// visualmente idêntico a antes; só o nome da fonte da fração mudou.
import { useEffect, useRef } from "react";
import { getChartLayerZIndex } from "./chart-layer-depth";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { useVolumeProfileSnapshot } from "../store/unified-snapshot-store";
import { bucketMidPrice } from "../nexus/volume-profile";
import { getProfileLaneRightEdgePx, getProfileLaneMaxBarWidthPx, type ChartProfileLaneId } from "./chart-profile-lanes";
// Barras: cyan monocromático — achado da Lapidação Institucional
// (AUDITORIA_ECOSSISTEMA_VISUAL.md §9.4/§9.7, pesquisa real confirmou que
// isto é um preset legítimo e precedente ("Black Ice", scripts reais de
// Volume Profile no TradingView) mitigado pela FORMA (barra, nunca linha)
// vs. Fibonacci, que também usa este cyan — mesmo raciocínio já aplicado
// a Kill Zones × Sweep (§6.59). Nenhuma mudança aqui.
const BAR_FILL = "rgba(0, 98, 255, 0.10)";
const BAR_FILL_HVN = "rgba(0, 98, 255, 0.22)";
const BAR_FILL_LVN = "rgba(0, 98, 255, 0.04)";
// POC: achado real diferente do das barras — esta É uma linha de preço
// (mesma forma que Fibonacci), então o mesmo cyan exato aqui seria a
// mesma classe de colisão objetiva já corrigida em Sweep×Liquidation-peak
// (§6.59), só que contra Fibonacci em vez de outro elemento âmbar.
// Pesquisa real confirmou precedente pra destacar o POC com um acento
// PRÓPRIO dentro de um perfil monocromático ("Aurora Glass" usa magenta
// pro POC sobre gradiente cyan; "Obsidian Precision" usa branco pro POC
// sobre acento cyan) — magenta H312 escolhido por cair no único
// corredor de matiz real e aberto entre a família roxa (Harmônicos/EQH-
// EQL, H278) e o vermelho SHORT (H340), a ~30° de ambos.
const POC_LINE = "rgba(236, 81, 205, 0.75)";

interface VolumeProfilePluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  /** Quais lanes de perfil estão REALMENTE sendo desenhadas agora. Sem
   *  isto cada plugin assumia que as outras duas sempre existiam e
   *  reservava espaço para lanes ocultas — a causa raiz da etiqueta do
   *  livro flutuando no meio das velas (captura real do Operador). */
  activeLanes?: readonly ChartProfileLaneId[];
}

export function VolumeProfilePlugin({ chart, series, activeLanes }: VolumeProfilePluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const profile = useVolumeProfileSnapshot();
  const profileRef = useRef(profile);
  const markDirtyRef = useRef<(() => void) | null>(null);

  // Mesmo padrão do LiquidityZonesPlugin: o loop de desenho lê sempre a
  // versão mais recente via ref; o efeito de setup nunca reassina por
  // mudança de dado.
  profileRef.current = profile;

  useEffect(() => {
    markDirtyRef.current?.();
  }, [profile]);

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

      const vp = profileRef.current?.fixedRange;
      if (!vp || vp.histogram.length === 0) return; // sem perfil real => nada desenhado, nunca um exemplo

      const maxVolume = vp.histogram.reduce((a, b) => (b > a ? b : a), 0);
      if (!(maxVolume > 0)) return;

      const laneRight = getProfileLaneRightEdgePx("volume_profile", cssWidth, activeLanes);
      const maxBarWidth = getProfileLaneMaxBarWidthPx("volume_profile", cssWidth, activeLanes);
      const hvn = new Set(vp.hvnIndices);
      const lvn = new Set(vp.lvnIndices);

      for (let i = 0; i < vp.histogram.length; i++) {
        const volume = vp.histogram[i];
        if (!(volume > 0)) continue; // bucket sem negociação real => sem barra
        // Bordas reais do bucket em preço → pixels via a própria lib.
        const bucketWidth = (vp.rangeMax - vp.rangeMin) / vp.bucketCount;
        const priceLow = vp.rangeMin + i * bucketWidth;
        const priceHigh = priceLow + bucketWidth;
        const yLow = series.priceToCoordinate(priceLow);
        const yHigh = series.priceToCoordinate(priceHigh);
        if (yLow === null || yHigh === null) continue; // fora da área visível — Fail-Closed, nunca extrapola
        const y = Math.min(yLow, yHigh);
        const h = Math.max(1, Math.abs(yLow - yHigh) - 0.5);
        const w = (volume / maxVolume) * maxBarWidth;
        ctx.fillStyle = hvn.has(i) ? BAR_FILL_HVN : lvn.has(i) ? BAR_FILL_LVN : BAR_FILL;
        ctx.fillRect(laneRight - w, y, w, h);
      }

      // POC: linha horizontal fio de seda no preço real do bucket de maior
      // volume — 1px sólida, nunca pontilhada.
      const pocY = series.priceToCoordinate(bucketMidPrice(vp.pocIndex, vp.rangeMin, vp.rangeMax, vp.bucketCount));
      if (pocY !== null) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = POC_LINE;
        ctx.beginPath();
        ctx.moveTo(laneRight - maxBarWidth, pocY + 0.5);
        ctx.lineTo(laneRight, pocY + 0.5);
        ctx.stroke();
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

    markDirty();

    return () => {
      markDirtyRef.current = null;
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      resizeObserver.disconnect();
    };
  }, [chart, series]);

  // width/height explícitos: <canvas> é replaced element — inset:0 sozinho
  // não o estica (achado real da Fase 0.7, verificado via Playwright).
  return (
    <canvas
      ref={canvasRef}
      data-plugin="volume-profile"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex("volume_profile") }}
    />
  );
}
