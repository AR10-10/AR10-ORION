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
// Correção real (Achado 2.6, Visual Cleanup & Rendering Audit 5ª rodada —
// SEGUNDA reclamação do Operador sobre o mesmo objeto, com as mesmas
// palavras: "aquelas outra vertical descendo... do mercado aberto fechado,
// ela não devia descer não, ela devia aparecer bem pequenininha só uma...
// não precisa poluir tanto o gráfico"): a correção anterior (comentário
// abaixo, no loop) mexeu em QUANTAS ocorrências desenhavam, nunca na
// ALTURA de cada uma — a coluna âmbar continuava indo de y=0 a
// y=cssHeight, atravessando todo o preço. A causa raiz da reclamação
// nunca tinha sido tocada, por isso ela voltou.
//
// Agora a janela vive numa faixa fina própria no topo, ao lado da faixa de
// sessões, com geometria vinda de chart-time-ribbon-lanes.ts (fonte única
// — as duas camadas de contexto de TEMPO nunca mais podem se sobrepor).
// O que a camada carrega continua real e completo: QUANDO (a extensão em
// x é exatamente a mesma de antes — quais candles estão dentro da janela)
// e QUÃO RECENTE (o mesmo alpha do decaimento real por idade). O que saiu
// foi só a altura e o rótulo de nome — este último era duplicação literal
// do badge "Kill Zone ·" do header (App.tsx), a mesma redundância já
// removida da 2ª linha da faixa de sessões, e o próprio pedido dispensa
// o detalhe explicitamente ("você pode nem saber que a hora que o mercado
// abria"). Regra de Ouro 4 preservada: computeKillZoneSpans continua
// computando tudo, zero dado real apagado.
//
// LEI 24: display only, puro contexto temporal — nunca uma decisão.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { computeKillZoneSpans, type KillZoneSpan } from "../nexus/kill-zones";
import { ageAlpha, type DecayConfig } from "./annotation-decay";
import { getTimeRibbonLaneTopPx, getTimeRibbonLaneBottomPx, getTimeRibbonLaneHeightPx } from "./chart-time-ribbon-lanes";

export const KILL_ZONE_DECAY: DecayConfig = { fadeStartCandles: 50, expireCandles: 200, minAlpha: 0.12 };

// Alphas BASE (na frescura máxima) — multiplicados pelo decaimento real
// por idade a cada desenho, nunca uma rgba fixa.
//
// Achado 2.6: os valores antigos (0.06/0.22) eram calibrados para uma
// LAVAGEM de altura total — 6% de preenchimento sobre a coluna inteira
// tinha presença visual justamente por cobrir centenas de pixels de
// altura. Numa faixa de 6px o mesmo 0.06 seria literalmente invisível, o
// que apagaria a camada de fato (Regra de Ouro 4). Recalibrados para a
// nova geometria, na mesma ordem de grandeza da faixa de sessões vizinha
// (BAND_COLOR_OPEN = 0.42 / BORDER_COLOR = 0.30 em
// MarketSessionBandsPlugin.tsx) — mesma legibilidade de antes num espaço
// muito menor, nunca mais presença por tamanho.
const FILL_ALPHA = 0.38;
const BORDER_ALPHA = 0.55;

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

      // Achado 2.6: geometria vertical vem da lane compartilhada, nunca
      // mais de `0`/`cssHeight` — a faixa não pode descer o gráfico nem
      // invadir a faixa de sessões vizinha.
      const laneTop = getTimeRibbonLaneTopPx("kill_zone");
      const laneBottom = getTimeRibbonLaneBottomPx("kill_zone");
      const laneHeight = getTimeRibbonLaneHeightPx("kill_zone");

      const totalCandles = dataRef.current.length;
      // Lapidação por captura real do Operador (BTC 1H, ~6 dias visíveis:
      // "essas linhas amarelas descendo de cima pra baixo estão
      // atrapalhando o gráfico"): TODA ocorrência histórica dentro do
      // decay (200 candles ≈ 8 dias no 1H) desenhava faixa de altura
      // total — uma cerca de ~18 janelas mortas. Kill zone é contexto do
      // AGORA: só a ocorrência MAIS RECENTE de cada janela desenha (o
      // decay continua esmaecendo essa também). computeKillZoneSpans
      // segue computando todas — dado intacto, só o desenho é seletivo.
      const latestSpanPerZone = new Map<string, KillZoneSpan>();
      for (const span of spans) {
        const prev = latestSpanPerZone.get(span.id);
        if (!prev || span.endIndex > prev.endIndex) latestSpanPerZone.set(span.id, span);
      }
      for (const span of latestSpanPerZone.values()) {
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
        ctx.fillRect(clippedX, laneTop, clippedWidth, laneHeight);
        // Fio de Seda (Regra de Ouro 5): 1px sólida real nas bordas
        // verticais da janela, nunca setLineDash. Achado 2.6: o traço
        // agora vai só do topo à base da PRÓPRIA lane — é o que marca o
        // início/fim exatos da janela sem atravessar o preço.
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255, 176, 32, ${(alpha * BORDER_ALPHA).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(Math.round(rectX) + 0.5, laneTop);
        ctx.lineTo(Math.round(rectX) + 0.5, laneBottom);
        ctx.moveTo(Math.round(rectX + rectWidth) + 0.5, laneTop);
        ctx.lineTo(Math.round(rectX + rectWidth) + 0.5, laneBottom);
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
