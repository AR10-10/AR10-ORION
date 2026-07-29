// InstitutionalZonePlugin.tsx — DIRETIVA FINAL DE LAPIDAÇÃO DO GRÁFICO §4
// ("Consolidação de zonas"): desenha as Zonas Institucionais reais já
// computadas por computeInstitutionalZones (nexus/institutional-zones.ts,
// zero cálculo aqui) como uma faixa horizontal de largura total — mesma
// arquitetura de overlay (Canvas 2D próprio, dirty-flag + rAF,
// ResizeObserver, geometria via series.priceToCoordinate) já provada por
// LiquidationHeatmapPlugin/VolumeProfilePlugin para faixas ancoradas em
// PREÇO (não em tempo, ao contrário de KillZoneBandsPlugin/
// MarketSessionBandsPlugin).
//
// Camada ADITIVA, nunca uma substituição (Regra de Ouro 4 — "nunca apagar
// dado real ou funcionalidade"): as linhas/zonas individuais de EMA/VWAP/
// Nexus Line/FVG/Order Block/Liquidez continuam desenhadas exatamente
// como antes por seus próprios plugins/séries — esta faixa só soma um
// destaque visual único por trás delas, mostrando ao Operador ONDE várias
// ferramentas independentes concordam, sem remover o detalhe individual
// de cada uma. Reduzir esse detalhe individual quando já coberto por uma
// Zona Institucional é uma decisão de UX maior, deliberadamente NÃO feita
// nesta entrega (ver nota no commit/PR).
//
// Cor: violeta (rgba(167,139,250,...)) — auditoria de paleta confirmou
// que nenhuma camada existente usa esta família de matiz (âmbar = Kill
// Zones/Sweep, dourado = Trade Plan Zone, magenta = POC, ciano = Volume
// Profile, verde/vermelho = LONG/SHORT), evitando colidir com qualquer
// papel visual já estabelecido.
//
// LEI 24: display-only puro — apenas desenha o que o motor já decidiu ser
// uma confluência geométrica real, nunca lê nem altera decisão nenhuma.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { InstitutionalZone } from "../nexus/institutional-zones";

// Diretriz Final — Polimento Visual e Sincronização Global §1/§2 (achado
// real via captura de tela do Operador, BTC/USDT 1H): o rótulo de texto
// desta faixa vivia num canvas PRÓPRIO, desenhado por posição vertical
// PRÓPRIA (centro real da zona), sem nenhuma consciência dos rótulos já
// resolvidos por priceAxisLabels/PriceLabelStackPlugin (SWEEP/SWEEP ZONE/
// Session Key Levels/S1/R1/TREND — todos no MESMO sistema anti-colisão
// desde rodadas anteriores). Resultado real visível na captura: o texto
// "ZONA INSTITUCIONAL · ..." sobrepondo/colidindo com "LONDRES H/L" e
// "SWEEP ZONE" sempre que uma zona institucional caía perto de outro
// nível real — exatamente a classe de bug que price-label-stack.ts existe
// para eliminar, só que a Zona Institucional nunca tinha entrado nele.
// Correção: o TEXTO migrou para priceAxisLabels (EnhancedChart_110_
// Percent.tsx, side:"left", price = centro real da zona) — agora resolve
// colisão na MESMA pilha que tudo o mais do lado esquerdo, com o MESMO
// conector fino de volta ao preço quando precisa deslocar. Este plugin
// continua dono exclusivo da FAIXA (fill+borda, dado geométrico real —
// zero mudança aqui); LABEL_COLOR exportado para ser a única fonte real
// dessa cor, nunca duplicada como literal em dois arquivos.
export const LABEL_COLOR = "rgba(216, 205, 254, 0.90)";

const ZONE_HUE_RGB = "167, 139, 250";

// EPC OMEGA FINAL Parte 2 §7 ("Confluência Visual": "quanto maior a
// confluência, maior o destaque visual"): antes desta rodada a faixa
// desenhava sempre com a MESMA opacidade, com 2 ou com 5 ferramentas
// concordando — o motor já carrega distinctSourceCount real
// (computeInstitutionalZones, zero cálculo novo aqui), só nunca virava
// destaque visual. Piso = valor idêntico ao antigo (nenhuma zona real
// fica mais fraca que antes); teto em 4 fontes é convenção declarada
// (mesmo espírito de LIQUIDITY_HIGHLIGHT_MIN_OBSTACLES em
// layer-relevance.ts) — nenhuma zona observada até hoje passou de 4
// fontes distintas, não uma medição.
const CONFLUENCE_FLOOR_SOURCES = 2;
const CONFLUENCE_CEIL_SOURCES = 4;
const FILL_ALPHA_MIN = 0.07;
const FILL_ALPHA_MAX = 0.16;
const BORDER_ALPHA_MIN = 0.35;
const BORDER_ALPHA_MAX = 0.65;

function confluenceWeight(distinctSourceCount: number): number {
  const span = CONFLUENCE_CEIL_SOURCES - CONFLUENCE_FLOOR_SOURCES;
  const clamped = Math.max(CONFLUENCE_FLOOR_SOURCES, Math.min(CONFLUENCE_CEIL_SOURCES, distinctSourceCount));
  return span > 0 ? (clamped - CONFLUENCE_FLOOR_SOURCES) / span : 0;
}

interface InstitutionalZonePluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  zones: InstitutionalZone[];
}

export function InstitutionalZonePlugin({ chart, series, zones }: InstitutionalZonePluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zonesRef = useRef(zones);
  const markDirtyRef = useRef<(() => void) | null>(null);

  // Sempre a versão mais recente para o loop de desenho ler — mesmo
  // padrão de dataRef em KillZoneBandsPlugin/LiquidationHeatmapPlugin.
  zonesRef.current = zones;

  useEffect(() => {
    markDirtyRef.current?.();
  }, [zones]);

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

      const currentZones = zonesRef.current;
      if (currentZones.length === 0) return; // sem confluência real agora — nada desenhado, nunca um exemplo.

      for (const zone of currentZones) {
        const yTop = series.priceToCoordinate(zone.top);
        const yBottom = series.priceToCoordinate(zone.bottom);
        if (yTop === null || yBottom === null) continue; // fora da área de preço visível agora — Fail-Closed, nunca extrapola.

        const rectY = Math.min(yTop, yBottom);
        const rectHeight = Math.max(1, Math.abs(yBottom - yTop));
        const weight = confluenceWeight(zone.distinctSourceCount);

        ctx.fillStyle = `rgba(${ZONE_HUE_RGB}, ${(FILL_ALPHA_MIN + weight * (FILL_ALPHA_MAX - FILL_ALPHA_MIN)).toFixed(3)})`;
        ctx.fillRect(0, rectY, cssWidth, rectHeight);
        // Fio de Seda (Regra de Ouro 5): 1px sólida real nas bordas
        // horizontais da faixa, nunca setLineDash.
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(${ZONE_HUE_RGB}, ${(BORDER_ALPHA_MIN + weight * (BORDER_ALPHA_MAX - BORDER_ALPHA_MIN)).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(rectY) + 0.5);
        ctx.lineTo(cssWidth, Math.round(rectY) + 0.5);
        ctx.moveTo(0, Math.round(rectY + rectHeight) + 0.5);
        ctx.lineTo(cssWidth, Math.round(rectY + rectHeight) + 0.5);
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
