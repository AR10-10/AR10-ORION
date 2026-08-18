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
import { getChartLayerZIndex } from "./chart-layer-depth";
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
export const LABEL_COLOR = "rgba(217, 205, 254, 0.90)";

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

// Ordem "Lapidação Visual Final + Nova Linguagem de Gráfico" §3: a faixa
// (fillRect de largura total) é a representação mais honesta que existe
// para este dado — InstitutionalZone não carrega um índice de formação
// (é confluência de indicadores AGORA, não uma estrutura histórica como
// FVG/OB, que já desenham só do candle real de formação até a direita —
// ver LiquidityZonesPlugin), então estreitar a largura fabricaria uma
// origem que o motor não calcula. O pedido real e implementável aqui é
// outro, dito quase literalmente na Ordem: "faixa que ganha intensidade
// apenas quando o preço se aproxima" — zero fabricação, só um segundo
// fator real (distância ao preço vivo) multiplicando o peso que a
// confluência já resolve. PROXIMITY_FLOOR nunca chega a 0 (Regra de Ouro
// 4: a zona nunca desaparece por estar longe, só perde ênfase) — mesmo
// espírito de FILL_ALPHA_MIN/BORDER_ALPHA_MIN acima, um piso, não um
// apagamento. Limiares declarados (mesma honestidade de rrFloorSuffix/
// NEXUS_CLOSED_WINDOW_MS neste repositório — parâmetro assumido, nunca
// medição): dentro de 0.5% (o mesmo "perto" já usado em todo o app via
// LIQUIDITY_PROXIMITY_PCT) o boost é pleno; a partir de 3% de distância,
// a zona cai para o piso e passa a valer só pela confluência pura.
const PROXIMITY_FULL_PCT = 0.5;
const PROXIMITY_FADE_PCT = 3;
const PROXIMITY_FLOOR = 0.5;

// Exportada para execução real (não só padrão de fonte): é matemática
// nova (curva de decaimento por distância), não fiação entre módulos —
// mesma convenção deste repositório de "lógica pura de fronteira ganha
// teste de execução real" (CLAUDE.md).
export function proximityFactor(centerPrice: number, livePrice: number | null | undefined): number {
  // Fail-closed: sem preço vivo ainda (carregamento inicial), nunca
  // fabrica uma distância — comportamento idêntico ao de antes desta
  // correção (peso 100% pela confluência).
  if (typeof livePrice !== "number" || !Number.isFinite(livePrice) || livePrice <= 0) return 1;
  const distPct = (Math.abs(centerPrice - livePrice) * 100) / livePrice;
  if (distPct <= PROXIMITY_FULL_PCT) return 1;
  if (distPct >= PROXIMITY_FADE_PCT) return PROXIMITY_FLOOR;
  const span = PROXIMITY_FADE_PCT - PROXIMITY_FULL_PCT;
  const t = (distPct - PROXIMITY_FULL_PCT) / span;
  return 1 - t * (1 - PROXIMITY_FLOOR);
}

// Exportado — Ordem Oficial de Execução Nº 03 ("Implementação
// Operacional"): esta é a mesma função que EnhancedChart_110_Percent.tsx
// agora reusa para montar o candidato real de INSTITUTIONAL_ZONE que
// alimenta nexus/visual-budget.ts (Diretriz Nº 02, construído isolado na
// rodada anterior — esta é sua primeira graduação real). Zero segunda
// fórmula: o baseWeight que entra na competição cruzada por orçamento
// visual é exatamente este mesmo número.
export function confluenceWeight(distinctSourceCount: number): number {
  const span = CONFLUENCE_CEIL_SOURCES - CONFLUENCE_FLOOR_SOURCES;
  const clamped = Math.max(CONFLUENCE_FLOOR_SOURCES, Math.min(CONFLUENCE_CEIL_SOURCES, distinctSourceCount));
  return span > 0 ? (clamped - CONFLUENCE_FLOOR_SOURCES) / span : 0;
}

interface InstitutionalZonePluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  zones: InstitutionalZone[];
  // Ordem Nº 03: peso visual final real, já resolvido por
  // resolveVisualBudget (competição CRUZADA com o Trade Plan — nunca só
  // a força PRÓPRIA da zona) — um valor por índice de `zones`, mesma
  // ordem. Ausente/undefined num índice = sem competição real ainda
  // resolvida pelo chamador; cai de volta no confluenceWeight isolado de
  // sempre (fail-closed para o comportamento já validado antes desta
  // rodada, nunca um valor fabricado).
  visualWeights?: (number | undefined)[];
  // Ordem "Lapidação Visual Final + Nova Linguagem de Gráfico" §3: MESMO
  // preço vivo já usado pelo resto do gráfico (patch da vela, rótulo
  // `live` do eixo) — zero segunda coleta. Opcional/fail-closed: ausente
  // = comportamento de sempre (peso só por confluência).
  livePrice?: number | null;
}

export function InstitutionalZonePlugin({ chart, series, zones, visualWeights, livePrice }: InstitutionalZonePluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zonesRef = useRef(zones);
  const visualWeightsRef = useRef(visualWeights);
  const livePriceRef = useRef(livePrice);
  const markDirtyRef = useRef<(() => void) | null>(null);

  // Sempre a versão mais recente para o loop de desenho ler — mesmo
  // padrão de dataRef em KillZoneBandsPlugin/LiquidationHeatmapPlugin.
  zonesRef.current = zones;
  visualWeightsRef.current = visualWeights;
  livePriceRef.current = livePrice;

  useEffect(() => {
    markDirtyRef.current?.();
  }, [zones, visualWeights, livePrice]);

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
      const currentVisualWeights = visualWeightsRef.current;

      for (let i = 0; i < currentZones.length; i++) {
        const zone = currentZones[i];
        const yTop = series.priceToCoordinate(zone.top);
        const yBottom = series.priceToCoordinate(zone.bottom);
        if (yTop === null || yBottom === null) continue; // fora da área de preço visível agora — Fail-Closed, nunca extrapola.

        const rectY = Math.min(yTop, yBottom);
        const rectHeight = Math.max(1, Math.abs(yBottom - yTop));
        // Ordem Nº 03: usa o peso já resolvido pela competição cruzada
        // (nexus/visual-budget.ts) quando o chamador forneceu um real para
        // este índice; cai de volta na força PRÓPRIA da zona (sem
        // competição) quando não — nunca um valor fabricado.
        const resolvedWeight = currentVisualWeights?.[i];
        const baseWeight = resolvedWeight !== undefined ? resolvedWeight : confluenceWeight(zone.distinctSourceCount);
        // §3 ("ganha intensidade apenas quando o preço se aproxima"):
        // segundo fator real e independente — nunca substitui a
        // confluência, só a modula pela distância real ao preço vivo.
        const weight = baseWeight * proximityFactor(zone.centerPrice, livePriceRef.current);

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
      style={{ width: "100%", height: "100%", zIndex: getChartLayerZIndex("institutional_zones") }}
    />
  );
}
