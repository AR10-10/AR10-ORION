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
// Diretriz Final de Lapidação Visual, Adendo, Parte 11 ("etiquetas
// profissionais"): texto nu direto sobre a zona virou caixa real (canto
// suave + contraste garantido) — mesma primitiva compartilhada por
// KillZoneBandsPlugin/LiquidationHeatmapPlugin/InstitutionalZonePlugin,
// zero segunda implementação de "caixa de etiqueta".
import { drawCanvasLabel } from "../nexus/canvas-label";
// Ordem de Fechamento (Operador: "não ficar poluído, só as marca certeira"):
// achado real de auditoria — cada FVG/OB bruto desenhava seu próprio
// retângulo full-width independente, sem nenhuma consciência de outras
// zonas do MESMO tipo sobrepostas no preço. Com muitas zonas reais ativas
// ao mesmo tempo (comum em mercado real), o preenchimento translúcido de
// cada caixa EMPILHA visualmente (alpha composto) — a "parede de cor"
// literal que a Ordem descreve. fuseLiquidityZones funde, só para exibição,
// zonas próximas/sobrepostas do MESMO grupo semântico — zero segundo
// cálculo de obstáculo/peso/idade (ver uso abaixo).
import { fuseLiquidityZones, type FusableZoneInput } from "../nexus/liquidity-zone-fusion";
import { LIQUIDITY_PROXIMITY_PCT } from "../nexus/layer-relevance";

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
const FVG_BULLISH: ZonePalette = { fill: "rgba(8, 153, 129, 0.10)", border: "rgba(8, 153, 129, 0.30)" };
const FVG_BEARISH: ZonePalette = { fill: "rgba(242, 54, 69, 0.10)", border: "rgba(242, 54, 69, 0.30)" };
const OB_BULLISH: ZonePalette = { fill: "rgba(8, 153, 129, 0.15)", border: "rgba(8, 153, 129, 0.40)" };
const OB_BEARISH: ZonePalette = { fill: "rgba(242, 54, 69, 0.15)", border: "rgba(242, 54, 69, 0.40)" };

// Diretriz Restauração/Inteligência Visual §6 ("risco visual... obstáculo
// estrutural"): MESMA cor/hierarquia acima — o preenchimento nunca muda
// ("não é pra tirar as cor do gráfico não" continua valendo aqui também) —
// só a borda fica bem mais opaca quando esta MESMA zona já desenhada é, no
// plano ATIVO, um obstáculo real no caminho entrada→alvo
// (trade-plan.ts:obstacleZonesInPath, reusado por App.tsx — zero segundo
// cálculo). Sem plano ativo, obstacleZones vem vazio e nada muda.
const FVG_BULLISH_OBSTACLE: ZonePalette = { fill: "rgba(8, 153, 129, 0.10)", border: "rgba(8, 153, 129, 0.85)" };
const FVG_BEARISH_OBSTACLE: ZonePalette = { fill: "rgba(242, 54, 69, 0.10)", border: "rgba(242, 54, 69, 0.85)" };
const OB_BULLISH_OBSTACLE: ZonePalette = { fill: "rgba(8, 153, 129, 0.15)", border: "rgba(8, 153, 129, 0.85)" };
const OB_BEARISH_OBSTACLE: ZonePalette = { fill: "rgba(242, 54, 69, 0.15)", border: "rgba(242, 54, 69, 0.85)" };

// Pedido do Operador ("ver o que está faltando... pra ele chegar na
// perfeição"): Liquidity Void (liquidity-void-engine.js) — deliberadamente
// NÃO reusa o par verde/vermelho de FVG/OB. Pesquisa real (WebSearch,
// citada no motor) confirma que um Void tipicamente CONTÉM vários FVGs —
// as duas camadas vão se sobrepor no preço com frequência real, e
// fuseLiquidityZones (abaixo) nunca funde entre kinds diferentes (Regra de
// Ouro 4) — reusar a mesma cor faria exatamente a "parede de cor" que a
// Ordem de Fechamento já corrigiu para zonas do MESMO kind. Par
// ciano/magenta: alta distinção visual, nenhuma outra camada do gráfico
// usa essa família (FVG/OB/Sessão=verde/vermelho, Sweep=laranja,
// harmônico/triângulo/OCO=roxo, Zona Institucional=lavanda).
const VOID_BULLISH: ZonePalette = { fill: "rgba(0, 98, 255, 0.10)", border: "rgba(0, 98, 255, 0.35)" };
const VOID_BEARISH: ZonePalette = { fill: "rgba(236, 81, 205, 0.10)", border: "rgba(236, 81, 205, 0.35)" };
const VOID_BULLISH_OBSTACLE: ZonePalette = { fill: "rgba(0, 98, 255, 0.10)", border: "rgba(0, 98, 255, 0.85)" };
const VOID_BEARISH_OBSTACLE: ZonePalette = { fill: "rgba(236, 81, 205, 0.10)", border: "rgba(236, 81, 205, 0.85)" };

function paletteFor(kind: "FVG" | "OB" | "VOID", type: "BULLISH" | "BEARISH", isObstacle: boolean): ZonePalette {
  if (kind === "FVG") {
    if (isObstacle) return type === "BULLISH" ? FVG_BULLISH_OBSTACLE : FVG_BEARISH_OBSTACLE;
    return type === "BULLISH" ? FVG_BULLISH : FVG_BEARISH;
  }
  if (kind === "VOID") {
    if (isObstacle) return type === "BULLISH" ? VOID_BULLISH_OBSTACLE : VOID_BEARISH_OBSTACLE;
    return type === "BULLISH" ? VOID_BULLISH : VOID_BEARISH;
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
// Ordem Nº 04 (§4/§5, MAIN_LIQUIDITY em visual-budget.ts): exportado pelo
// mesmo motivo que BREAK_DECAY já é exportado de StructureBreakMarkersPlugin
// — EnhancedChart_110_Percent.tsx reusa esta MESMA curva para montar o
// candidato de orçamento visual, zero segunda curva de decaimento.
export const ZONE_DECAY: DecayConfig = { fadeStartCandles: 30, expireCandles: 100, minAlpha: 0.15 };

interface LiquidityZonesPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number }[];
  fairValueGaps: FillableZone[];
  orderBlocks: FillableZone[];
  // Pedido do Operador ("ver o que está faltando... pra ele chegar na
  // perfeição"): Liquidity Void (liquidity-void-engine.js) — mesmo shape
  // real FillableZone (type/top/bottom/index), kind próprio ("VOID") na
  // fusão/paleta abaixo. Opcional/fail-closed: ausente/vazio => desenho
  // idêntico ao de antes desta camada existir.
  liquidityVoids?: FillableZone[];
  // Diretriz Restauração/Inteligência Visual §6: zonas reais (as MESMAS já
  // desenhadas acima, identificadas por low/high) que o Trade Plan ATIVO
  // cruza a caminho de algum alvo — opcional/fail-closed: ausente/vazio =>
  // desenho idêntico ao de sempre, nenhuma zona em ênfase.
  obstacleZones?: { low: number; high: number }[];
  // Ordem Nº 04: peso visual já resolvido pelo orçamento visual cruzado
  // (visual-budget.ts, categoria MAIN_LIQUIDITY), por posição no array
  // ORIGINAL de fairValueGaps/orderBlocks — undefined/null (padrão) cai no
  // ageAlpha isolado de sempre (fail-closed, comportamento anterior
  // preservado). Zonas-obstáculo IGNORAM este peso de propósito (ver
  // drawZone abaixo) — a garantia de alpha=1 é mais forte que a
  // competição por orçamento.
  fvgVisualWeights?: (number | undefined)[];
  obVisualWeights?: (number | undefined)[];
  // Liquidity Void ainda não entra na competição cruzada de orçamento
  // visual (visual-budget.ts) — v1 deliberadamente escopado: undefined
  // aqui cai no MESMO fallback fail-closed de ageAlpha isolado que
  // fvgVisualWeights/obVisualWeights já tinham antes de entrarem no
  // orçamento cruzado. Entrar no orçamento é uma evolução futura própria,
  // não um requisito para a camada existir e ser honesta hoje.
  voidVisualWeights?: (number | undefined)[];
}

export function LiquidityZonesPlugin({ chart, series, data, fairValueGaps, orderBlocks, liquidityVoids, obstacleZones, fvgVisualWeights, obVisualWeights, voidVisualWeights }: LiquidityZonesPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zonesRef = useRef({ fairValueGaps, orderBlocks, liquidityVoids, data, obstacleZones, fvgVisualWeights, obVisualWeights, voidVisualWeights });
  const markDirtyRef = useRef<(() => void) | null>(null);

  // Sempre a versão mais recente das zonas/candles para o loop de desenho
  // ler — nunca dispara o efeito de setup abaixo de novo (evita reabrir a
  // conexão com o chart/reassinar os listeners a cada atualização de dado).
  zonesRef.current = { fairValueGaps, orderBlocks, liquidityVoids, data, obstacleZones, fvgVisualWeights, obVisualWeights, voidVisualWeights };

  useEffect(() => {
    markDirtyRef.current?.();
  }, [fairValueGaps, orderBlocks, liquidityVoids, data, obstacleZones, fvgVisualWeights, obVisualWeights, voidVisualWeights]);

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
      const { fairValueGaps: fvgs, orderBlocks: obs, liquidityVoids: voids, data: candles, obstacleZones: obstacles, fvgVisualWeights: fvgWeights, obVisualWeights: obWeights, voidVisualWeights: voidWeights } = zonesRef.current;

      const currentIndex = candles.length - 1;
      // Identidade por low/high real (mesmos números, zero recálculo) —
      // nunca por índice/posição, que pode divergir entre a lista de zonas
      // do gráfico e a lista de obstáculos do plano.
      const isObstacle = (zone: FillableZone) =>
        (obstacles ?? []).some((o) => o.low === zone.bottom && o.high === zone.top);

      // Correção real (Diretriz Consolidação/Auditoria/Evolução, auditoria
      // de ciclo de vida, achado confirmado): uma zona que é obstáculo
      // real do plano ATIVO agora (mesma isObstacle() usada na paleta e no
      // rótulo ⚠ abaixo — zero segundo cálculo) nunca deve esmaecer por
      // idade fixa enquanto continuar bloqueando o caminho do plano —
      // "nunca em tempo fixo, sempre por relevância real" é exatamente o
      // caso de uma zona antiga que ainda é o obstáculo estrutural de uma
      // operação aberta. Volta a decair normalmente assim que deixar de
      // ser obstáculo (plano fechado ou preço já passou da zona).
      //
      // Ordem Nº 04: zona-obstáculo IGNORA resolvedWeight de propósito —
      // a garantia de alpha=1 (risco real do plano ativo) nunca se dobra
      // à competição por orçamento visual. Zona comum usa o peso já
      // resolvido pela competição cruzada (visual-budget.ts) quando
      // presente; ausente/null cai no ageAlpha isolado de sempre
      // (fail-closed, mesmo comportamento de antes desta rodada). Resolvido
      // por zona BRUTA, antes da fusão — a fusão abaixo só decide como
      // agrupar/desenhar, nunca recalcula decaimento/obstáculo.
      const resolveAlpha = (zone: FillableZone, isObstacleZone: boolean, resolvedWeight?: number) => {
        const age = currentIndex - zone.index;
        return isObstacleZone ? 1 : resolvedWeight !== undefined && resolvedWeight !== null ? resolvedWeight : ageAlpha(age, ZONE_DECAY);
      };

      const drawZone = (zone: { top: number; bottom: number; index: number; alpha: number }, palette: ZonePalette, label: string) => {
        const point = candles[zone.index];
        if (!point) return; // índice fora da janela real de candles — nunca desenha um palpite.
        if (zone.alpha <= 0) return; // "esquecida" — só da tela, ver comentário de ageAlpha acima.
        const x1 = timeScale.timeToCoordinate(point.time as unknown as Time);
        const y1 = series.priceToCoordinate(zone.top);
        const y2 = series.priceToCoordinate(zone.bottom);
        if (x1 === null || y1 === null || y2 === null) return; // fora da área visível agora — Fail-Closed: nunca extrapola.
        const rectX = x1;
        const rectY = Math.min(y1, y2);
        const rectHeight = Math.max(1, Math.abs(y2 - y1));
        const rectWidth = cssWidth - rectX;
        if (rectWidth <= 0) return;
        ctx.globalAlpha = zone.alpha;
        ctx.fillStyle = palette.fill;
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        // Fio de Seda: 1px sólida real (Canvas 2D nunca usa setLineDash aqui).
        ctx.lineWidth = 1;
        ctx.strokeStyle = palette.border;
        ctx.strokeRect(rectX + 0.5, rectY + 0.5, Math.max(0, rectWidth - 1), Math.max(0, rectHeight - 1));
        // Label elegante (Ordem "Ciborgue Vivo" §1, caixa real desde a
        // Diretriz Final Adendo Parte 11): identifica o tipo direto no
        // gráfico, sem abrir painel nenhum — mesma opacidade decrescente
        // da própria zona (globalAlpha já ativo aqui), nunca compete
        // visualmente com uma zona já velha. Caixa usa a cor de borda da
        // paleta (mais opaca que o fill) — contraste garantido pela
        // primitiva, nunca decidido por acaso.
        if (rectWidth > 24 && rectHeight > 10) {
          drawCanvasLabel(ctx, rectX + 3, rectY + 3, { fill: palette.border, text: label });
        }
        ctx.globalAlpha = 1;
      };

      // Achado real (pergunta do Operador: "aquela zona vermelha tipo
      // liquidez, era pra cima ou pra baixo?"): o rótulo dizia só "FVG"/"OB"
      // — a direção vinha SÓ da cor (verde=alta/demanda abaixo,
      // vermelho=baixa/oferta acima), o que exige o Operador já saber a
      // convenção de cor. Glifo ↑/↓ explícito (mesmo vocabulário de
      // VWAP/NL): BULLISH=↑ (zona de demanda, viés de alta), BEARISH=↓
      // (zona de oferta, viés de baixa). Zero cálculo novo — z.type já é a
      // direção real do motor SMC.
      // OMEGA CORE V-MAX Fase 4 (§4.4 — auditoria "Bate-Olho"): forma
      // compacta exata pedida é "FVG↑/FVG↓/OB↑/OB↓" (sem espaço entre a
      // sigla e o glifo) — havia um espaço aqui. Zero mudança de
      // informação/cor/direção, só a mesma string mais compacta.
      const dir = (t: "BULLISH" | "BEARISH") => (t === "BULLISH" ? "↑" : "↓");

      // Ordem de Fechamento (Operador: "não ficar poluído... marca
      // certeira"): funde, só para exibição, zonas do MESMO kind+type cujo
      // intervalo de preço se sobrepõe ou fica próximo
      // (LIQUIDITY_PROXIMITY_PCT — mesma constante real já usada para
      // clusterizar Sweeps/Session Key Levels, zero limiar novo inventado).
      // BULLISH nunca funde com BEARISH, FVG nunca funde com OB — fenômenos
      // estruturais reais distintos; fundi-los apagaria informação real
      // (Regra de Ouro 4). memberCount>1 vira "×N" no rótulo — mesma
      // convenção já usada por Sweep/Zona Institucional agrupados.
      const drawGroup = (raw: FillableZone[], weights: (number | undefined)[] | undefined, kind: "FVG" | "OB" | "VOID", type: "BULLISH" | "BEARISH") => {
        const fusable: FusableZoneInput[] = [];
        raw.forEach((z, i) => {
          if (z.type !== type) return;
          const obstacle = isObstacle(z);
          fusable.push({ top: z.top, bottom: z.bottom, index: z.index, isObstacle: obstacle, alpha: resolveAlpha(z, obstacle, weights?.[i]) });
        });
        for (const group of fuseLiquidityZones(fusable, LIQUIDITY_PROXIMITY_PCT)) {
          const palette = paletteFor(kind, type, group.isObstacle);
          const label = `${kind}${dir(type)}${group.memberCount > 1 ? ` ×${group.memberCount}` : ""}${group.isObstacle ? " ⚠" : ""}`;
          drawZone(group, palette, label);
        }
      };

      drawGroup(fvgs, fvgWeights, "FVG", "BULLISH");
      drawGroup(fvgs, fvgWeights, "FVG", "BEARISH");
      drawGroup(obs, obWeights, "OB", "BULLISH");
      drawGroup(obs, obWeights, "OB", "BEARISH");
      drawGroup(voids ?? [], voidWeights, "VOID", "BULLISH");
      drawGroup(voids ?? [], voidWeights, "VOID", "BEARISH");
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
