// EnhancedChart_110_Percent.tsx — V18 Sprint 1, Tarefa B: "Destravar o
// Gráfico Institucional". Substitui o SVG feito à mão (que só desenhava as
// últimas N velas com espaçamento igual, sem pan, sem zoom real, sem eixo
// temporal de verdade) por lightweight-charts — pan (handleScroll) e zoom
// (handleScale) nativos da própria lib, nunca reimplementados à mão aqui.
//
// Escopo desta Tarefa B (diretriz explícita: "não tente reescrever o
// sistema inteiro de uma vez"): candles reais com pan/zoom/crosshair
// nativos + S1/R1 e zonas SMC reais como price lines nativas
// (createPriceLine) — sempre sincronizadas com pan/zoom porque são
// primitivas da própria lib, nunca posicionadas manualmente em pixels.
// Isto preserva a garantia já estabelecida nesta sessão ("os overlays do
// gráfico — SMC, S/R, FVG — devem continuar existindo e processando dados
// reais"), só muda COMO são desenhados. Fica como próximo passo (não
// fabricado às pressas aqui): um retângulo real por zona (via Plugin API
// de primitives da lightweight-charts) mostrando também ONDE no tempo a
// zona se formou — por ora, price lines de largura total mostram o
// preço real top/bottom de cada zona ainda não mitigada/varrida, o
// mesmo filtro (!mitigated / !swept) e o mesmo cap de contagem que o
// componente antigo já usava.
import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
  type LogicalRange,
} from "lightweight-charts";
// V-MAX Fase 1 (superfície visual, fechamento do §3.1): linha de CVD real
// — a série do orderflowHistory (Fase 1.2) com eixo Y próprio nativo.
import { useOrderflowHistory } from "../store/unified-snapshot-store";
import { LiquidityZonesPlugin, type FillableZone } from "./LiquidityZonesPlugin";
// Ordem "Ciborgue Vivo" §1: anotação temporária de BOS/CHOCH — mesma
// arquitetura de overlay do LiquidityZonesPlugin acima, dado real diferente.
import { StructureBreakMarkersPlugin } from "./StructureBreakMarkersPlugin";
import { OrderFlowHeatmapPlugin } from "./OrderFlowHeatmapPlugin";
// V-MAX Fase 1 (superfície visual): Volume Profile real como overlay de
// barras à direita — dado direto da store (Fase 1.3), ver header do plugin.
import { VolumeProfilePlugin } from "./VolumeProfilePlugin";
// Ordem Final Autonomia Evolução §1: entry zone as a translucent box —
// the chart-side companion to the price lines below.
import { TradePlanZonePlugin } from "./TradePlanZonePlugin";
// Neural Market Aura (especificação do Operador): corredor de convicção
// real entre entrada e alvo — ver o cabeçalho de NeuralMarketAuraPlugin.tsx
// para a divisão de responsabilidade com TradePlanZonePlugin (zero
// duplicação: aquele desenha a caixa da zona, este desenha o corredor).
import { NeuralMarketAuraPlugin } from "./NeuralMarketAuraPlugin";
import type { AuraReading } from "../nexus/aura-lifecycle";
// Correção de latência (Ordem "Sincronização em Tempo Real"): funde o
// último preço real do ticker WS na vela em formação via series.update() —
// nunca via `data`/setData (isso recomputaria SMC/Fibonacci/VP a cada
// tick). Ver header do módulo para o porquê da separação.
import { patchLastCandleWithLiveTick } from "../nexus/live-candle-sync";
import type { Timeframe } from "../nexus/types";
// Signal Precision order: actionable plan drawn as silk-thread price lines.
import type { TradePlan } from "../nexus/trade-plan";
// Research-driven precision order: VWAP, the institutional-standard
// intraday reference level this system was missing entirely (confirmed
// via a full-codebase grep before writing nexus/vwap.ts).
import { computeSessionVwapSeries } from "../nexus/vwap";
// Ordem "Ciborgue Vivo" §1: BOS/CHOCH real (bos-choch-engine.js via
// engine-bridge.ts's computeBosChoch) — mesmo tipo que StructureBreakMarkersPlugin usa.
import type { StructureBreak } from "../engine-bridge";

export interface EnhancedChartCandle {
  time: number; // Unix segundos real (Bus/Binance) — nunca sintetizado
  open: number;
  high: number;
  low: number;
  close: number;
  // V-MAX Fase 1.3: já sempre real em App.tsx's chartData (nunca opcional
  // -fabricado) — declarado aqui como opcional só para não quebrar algum
  // outro chamador de teste que ainda monta um EnhancedChartCandle à mão
  // sem volume; o cálculo real de VWAP abaixo trata ausência como 0 velas
  // válidas (fail-closed), nunca uma média fabricada.
  volume?: number;
}

// V-MAX Fase 0.7: ganha `index` (posição real no array de candles onde a
// zona se formou) — necessário para o LiquidityZonesPlugin desenhar a
// borda esquerda real da área colorida; PriceZone (engine-bridge.ts) já
// carrega esse campo, então nenhum dado novo precisa ser calculado.
export interface EnhancedChartZone {
  type: "BULLISH" | "BEARISH";
  top: number;
  bottom: number;
  index: number;
}

export interface EnhancedChartLiquidity {
  type: "EQUAL_HIGH" | "EQUAL_LOW";
  price: number;
  touches: number;
}

export interface LevelStrength {
  label: "FORTE" | "FRACA";
  touches: number;
}

// V-MAX Fase 1 (superfície visual): nível de retração real da Matriz de
// Confluência (Fase 1.4) — price+ratio+score reais, passados pelo
// ChartWidget a partir da store (mesmo padrão das zonas SMC).
export interface EnhancedChartFibLevel {
  ratio: number;
  price: number;
  score: number;
}

interface EnhancedChartProps {
  data: EnhancedChartCandle[];
  support?: number | null;
  resistance?: number | null;
  supportStrength?: LevelStrength | null;
  resistanceStrength?: LevelStrength | null;
  supportBreakouts?: number;
  resistanceBreakouts?: number;
  fairValueGaps?: EnhancedChartZone[];
  orderBlocks?: EnhancedChartZone[];
  liquidityZones?: EnhancedChartLiquidity[];
  // Ordem "Ciborgue Vivo" §1: rompimento de estrutura real mais recente
  // (BOS/CHOCH). null = nenhum rompimento na amostra, honesto — nunca desenha um palpite.
  structureBreak?: StructureBreak | null;
  fibonacciLevels?: EnhancedChartFibLevel[] | null;
  // Correção de latência: o último preço REAL do ticker WS (mesma fonte da
  // barra superior, já na store desde o primeiro tick) e o timeframe ativo
  // — só para o patch cirúrgico da vela em formação abaixo. Opcionais: sem
  // eles o gráfico funciona exatamente como antes (fail-closed, nunca
  // quebra um chamador que ainda não os passa).
  livePrice?: number | null;
  activeTimeframe?: Timeframe;
  // Trade Plan (real structure only): entry zone / stop / target drawn as
  // silk-thread price lines with English labels. Optional and fail-closed:
  // null/absent draws nothing.
  tradePlan?: TradePlan | null;
  // Neural Market Aura: visual translation of the SAME real Trade Plan +
  // Signal Track Record + Confluence Engine reading above — never a second
  // trading signal (LEI 24). null/DADOS_INSUFICIENTES draws nothing.
  aura?: AuraReading | null;
  // Auditoria de arquitetura (revisão completa) — paginação histórica
  // real: chamado quando o usuário arrasta perto da borda esquerda dos
  // candles já carregados (ver efeito de subscribeVisibleLogicalRangeChange
  // abaixo). Optional/fail-closed: sem esta prop, o gráfico continua
  // exatamente como antes — janela fixa, sem paginação. App.tsx decide
  // como buscar/mesclar a página nova; este componente só detecta a
  // intenção real do usuário.
  onRequestOlderCandles?: () => void;
}

// Auditoria de arquitetura (revisão completa) — paginação histórica real:
// detecta se `next` é EXATAMENTE `prev` com N candles novos prependados na
// frente (mesmo sufixo, mesma ordem, comparado por `time` — App.tsx sempre
// cria arrays novos, nunca a mesma referência). É o ÚNICO caso em que o
// gráfico precisa deslocar a faixa visível manualmente (ver efeito de
// `data` abaixo) para não "pular" para trás quando o usuário está parado
// perto da borda esquerda logo após uma página antiga chegar. Retorna 0
// para qualquer outro tipo de atualização real (troca de timeframe,
// refresh periódico do topo, primeira carga) — nesses casos o
// comportamento padrão de setData() já preserva pan/zoom corretamente
// (comentário original do efeito abaixo), nenhum deslocamento é
// necessário ou seguro.
export function detectPrependCount(
  prev: EnhancedChartCandle[] | null | undefined,
  next: EnhancedChartCandle[] | null | undefined,
): number {
  if (!prev || !next || prev.length === 0 || next.length <= prev.length) return 0;
  const count = next.length - prev.length;
  for (let i = 0; i < prev.length; i++) {
    if (next[count + i]?.time !== prev[i]?.time) return 0;
  }
  return count;
}

// Mesmo formato de texto que o gráfico antigo já usava para S1/R1 — só a
// primitiva que desenha muda (createPriceLine em vez de <span> em pixel
// fixo), a informação real (força/retest/rompimentos) continua idêntica.
function levelTitle(base: string, strength: LevelStrength | null | undefined, breakouts: number | undefined): string {
  if (!strength) return base;
  return `${base} ${strength.label} ${strength.touches}x/${breakouts ?? 0}x`;
}

export function EnhancedChart_110_Percent({
  data,
  support,
  resistance,
  supportStrength,
  resistanceStrength,
  supportBreakouts,
  resistanceBreakouts,
  fairValueGaps,
  orderBlocks,
  liquidityZones,
  structureBreak,
  fibonacciLevels,
  livePrice,
  activeTimeframe,
  tradePlan,
  aura,
  onRequestOlderCandles,
}: EnhancedChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const supportLineRef = useRef<IPriceLine | null>(null);
  const resistanceLineRef = useRef<IPriceLine | null>(null);
  const zoneLinesRef = useRef<IPriceLine[]>([]);
  const fibLinesRef = useRef<IPriceLine[]>([]);
  const tradePlanLinesRef = useRef<IPriceLine[]>([]);
  // Named refs to the stop/target lines specifically (a subset of
  // tradePlanLinesRef above) — lets the hit-boost effect below update
  // color/title in place via applyOptions() instead of tearing down and
  // recreating all trade-plan lines on every live-price tick (which would
  // churn the chart at WebSocket cadence for what is only a color change).
  const stopLineRef = useRef<IPriceLine | null>(null);
  const targetLineRef = useRef<IPriceLine | null>(null);
  const cvdSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Research-driven precision order: VWAP as a native line series on the
  // SAME price scale as the candles (unlike cvdSeriesRef, which needs its
  // own scale because CVD is signed volume, not price) — it overlays
  // directly at the correct real price level.
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Espelha chartRef/seriesRef em state só para o LiquidityZonesPlugin
  // montar assim que o chart existe de verdade — refs sozinhas não
  // disparam re-render, então o plugin ficaria esperando por uma
  // atualização de `data` não relacionada para "descobrir" o chart pronto.
  const [chartReady, setChartReady] = useState<{ chart: IChartApi; series: ISeriesApi<"Candlestick"> } | null>(null);

  // Cria o chart UMA vez por montagem — nunca recriado por troca de
  // timeframe/dado (isso destruiria o estado de pan/zoom do operador a
  // cada atualização, exatamente o "reload"/"reinicializar o gráfico" que
  // a diretriz proíbe). autoSize:true usa o ResizeObserver interno da
  // própria lib — sem media query manual, sem listener de resize próprio.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8ab4f8",
        fontFamily: "ui-monospace, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(0, 240, 255, 0.06)" },
        horzLines: { color: "rgba(0, 240, 255, 0.06)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(138, 180, 248, 0.15)" },
      timeScale: {
        borderColor: "rgba(138, 180, 248, 0.15)",
        timeVisible: true,
        secondsVisible: false,
      },
      // Diretriz explícita do Sprint 1: pan/zoom real e nativo — nunca
      // hand-rolled. handleScroll cobre arrastar (mouse + touch);
      // handleScale cobre roda do mouse + pinça (iPad).
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
      autoSize: true,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#00ffaa",
      downColor: "#ff0055",
      borderVisible: false,
      wickUpColor: "#00ffaa",
      wickDownColor: "#ff0055",
      priceLineVisible: true,
      lastValueVisible: true,
      // Achado real via verificação com harness Playwright (V-MAX Fase
      // 0.7): sem este campo, a lib desenha essa linha automática de
      // último preço tracejada por padrão — quebra silenciosa da Regra de
      // Ouro 2 (Fio de Seda) que nenhum grep no código-fonte pegaria,
      // porque a causa é uma OMISSÃO, não um valor errado escrito aqui.
      priceLineStyle: LineStyle.Solid,
    });
    // V-MAX Fase 1 (fechamento do §3.1): linha de CVD como série NATIVA em
    // escala de preço PRÓPRIA ('cvd', overlay) — CVD é volume assinado, não
    // preço; partilhar a escala das velas o achataria em ruído. Banda
    // inferior (20%) via scaleMargins. Fio de seda: lineWidth 1, sólida.
    // Cor neutra da família de texto (#8ab4f8) — o SINAL do CVD já é
    // exibido com cor semântica no Order Flow widget; aqui a informação é
    // a FORMA da série (fluxo acumulado), não um veredito colorido.
    const cvdSeries = chart.addSeries(LineSeries, {
      priceScaleId: "cvd",
      color: "rgba(138, 180, 248, 0.85)",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    chart.priceScale("cvd").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    cvdSeriesRef.current = cvdSeries;
    // Research-driven precision order: VWAP on the MAIN price scale (no
    // priceScaleId override — it shares the candles' own axis, unlike
    // CVD, since it IS a real price). Neutral off-white, low opacity: a
    // pure reference level, deliberately not competing with the
    // directional/semantic palette (green=bullish, red=bearish, amber=
    // entry) used everywhere else on this chart. Fio de seda: lineWidth
    // 1, solid.
    const vwapSeries = chart.addSeries(LineSeries, {
      color: "rgba(255, 255, 255, 0.45)",
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: "VWAP",
    });
    vwapSeriesRef.current = vwapSeries;
    chartRef.current = chart;
    seriesRef.current = series;
    setChartReady({ chart, series });
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      supportLineRef.current = null;
      resistanceLineRef.current = null;
      zoneLinesRef.current = [];
      fibLinesRef.current = [];
      tradePlanLinesRef.current = [];
      cvdSeriesRef.current = null;
      vwapSeriesRef.current = null;
      setChartReady(null);
    };
  }, []);

  // Atualiza a série EXISTENTE com o candle real — nunca recria o chart.
  // Isto é o que satisfaz "transição suave entre timeframes (sem
  // recarregar tudo)": trocar chartTimeframe em App.tsx só troca o
  // conteúdo de `data`, este efeito só chama setData() na mesma série, e o
  // pan/zoom/crosshair do operador nunca são resetados por isso.
  //
  // Auditoria de arquitetura (revisão completa) — paginação histórica
  // real: a EXCEÇÃO a essa regra é um prepend real (detectPrependCount >
  // 0, ver função acima). Nesse caso específico, TODO índice de barra já
  // visível desloca (candles novos entraram na frente), então a faixa
  // visível REAL (mesma faixa em índice de tempo) teria mudado sob os pés
  // do usuário — captura a faixa antes, aplica o mesmo deslocamento
  // depois. Para qualquer outro tipo de atualização, prependedCount é 0 e
  // este bloco não faz nada — comportamento idêntico ao de sempre.
  const prevChartDataRef = useRef<EnhancedChartCandle[]>([]);
  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) return;
    const formatted = data
      .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
      .map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
    const prependedCount = detectPrependCount(prevChartDataRef.current, data);
    const savedRange = prependedCount > 0 ? chartRef.current?.timeScale().getVisibleLogicalRange() ?? null : null;
    seriesRef.current.setData(formatted);
    if (prependedCount > 0 && savedRange && chartRef.current) {
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: savedRange.from + prependedCount,
        to: savedRange.to + prependedCount,
      });
    }
    prevChartDataRef.current = data;
  }, [data]);

  // Correção de latência (barra superior ↔ gráfico): patch cirúrgico da
  // vela em formação a cada tick real do ticker WS, via series.update() —
  // API nativa da lib pra atualização incremental de UMA barra, nunca um
  // segundo setData(). Deliberadamente ISOLADO do efeito acima: não lê nem
  // escreve `data` como referência de re-render, só o último elemento já
  // renderizado — SMC/Fibonacci/Volume Profile (que dependem de `data` lá
  // em cima, em App.tsx) nunca recomputam por causa de um tick de preço,
  // só quando uma vela REAL nova/fechada chega do REST/kline.
  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) return;
    if (typeof livePrice !== "number" || !activeTimeframe) return;
    const patched = patchLastCandleWithLiveTick(data[data.length - 1], activeTimeframe, livePrice);
    if (!patched) return;
    seriesRef.current.update({ time: patched.time as UTCTimestamp, open: patched.open, high: patched.high, low: patched.low, close: patched.close });
  }, [livePrice, activeTimeframe, data]);

  // Auditoria de arquitetura (revisão completa) — paginação histórica
  // real: achado da auditoria de Chart Engine — não existia NENHUM
  // caminho para carregar mais história ao arrastar para trás (borda dura
  // assim que os candles carregados terminavam). Dispara
  // onRequestOlderCandles quando a borda ESQUERDA da faixa visível chega
  // perto do candle mais antigo já carregado — App.tsx decide como
  // buscar/mesclar/limitar a página nova (fetch real, dedupe, teto de
  // memória); este componente só detecta a intenção real do usuário (ele
  // parou de arrastar perto da borda), nunca decide o que fazer com isso.
  // EDGE_BARS é medido em barras (índice lógico), não em pixels — a mesma
  // margem funciona igual em qualquer nível de zoom. `requested` é
  // reamarrado (não um ref de módulo) a cada nova assinatura: uma vez
  // disparado, só dispara de novo depois que a faixa se afasta da borda —
  // o que acontece sozinho após um prepend bem-sucedido (a faixa é
  // deslocada pelo efeito de `data` acima), ou quando o usuário rola para
  // longe manualmente. Uma falha real (sem mais história, ou erro
  // transitório de rede) nunca entra num loop de novas tentativas.
  useEffect(() => {
    if (!chartReady || !onRequestOlderCandles) return;
    const EDGE_BARS = 20;
    let requested = false;
    const handler = (range: LogicalRange | null) => {
      if (!range || !data || data.length === 0) return;
      if (range.from > EDGE_BARS) {
        requested = false;
        return;
      }
      if (requested) return;
      requested = true;
      onRequestOlderCandles();
    };
    chartReady.chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => {
      chartReady.chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
    };
  }, [chartReady, onRequestOlderCandles, data]);

  // S1/R1 reais — o MESMO engine.support/resistance que os outros widgets
  // já exibem, aqui como price lines nativas (createPriceLine), nunca uma
  // linha desenhada à mão em cima do canvas.
  //
  // "Fio de seda" (pedido explícito do Operador): TODAS as linhas de
  // marcação deste gráfico são SÓLIDAS e finas (lineWidth 1, o mínimo da
  // lib) — nunca pontilhadas/tracejadas. A hierarquia visual entre S1/R1
  // (nível primário) e as zonas SMC (contexto) vem da OPACIDADE da cor,
  // não do estilo do traço: S1/R1 mais presentes, zonas mais translúcidas.
  useEffect(() => {
    if (!seriesRef.current) return;
    if (supportLineRef.current) {
      seriesRef.current.removePriceLine(supportLineRef.current);
      supportLineRef.current = null;
    }
    if (Number.isFinite(support)) {
      supportLineRef.current = seriesRef.current.createPriceLine({
        price: support as number,
        color: "rgba(0, 255, 170, 0.65)",
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: levelTitle("S1", supportStrength, supportBreakouts),
      });
    }
  }, [support, supportStrength, supportBreakouts]);

  useEffect(() => {
    if (!seriesRef.current) return;
    if (resistanceLineRef.current) {
      seriesRef.current.removePriceLine(resistanceLineRef.current);
      resistanceLineRef.current = null;
    }
    if (Number.isFinite(resistance)) {
      resistanceLineRef.current = seriesRef.current.createPriceLine({
        price: resistance as number,
        color: "rgba(255, 0, 85, 0.65)",
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: levelTitle("R1", resistanceStrength, resistanceBreakouts),
      });
    }
  }, [resistance, resistanceStrength, resistanceBreakouts]);

  // Liquidez (Equal High/Low) continua como price line: LiquidityZone
  // (engine-bridge.ts) só carrega um preço único, nunca um top/bottom —
  // não existe uma "área" real para preencher, então uma linha continua
  // sendo a representação honesta (mesmo dado, mesmo filtro !swept de
  // sempre, aplicado rio acima em App.tsx/ChartWidget).
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    zoneLinesRef.current.forEach((line) => series.removePriceLine(line));
    zoneLinesRef.current = [];

    (liquidityZones ?? []).forEach((z) => {
      zoneLinesRef.current.push(
        series.createPriceLine({
          price: z.price,
          color: "rgba(200, 107, 255, 0.45)",
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: false,
          title: `${z.type === "EQUAL_HIGH" ? "EQH" : "EQL"} x${z.touches}`,
        }),
      );
    });
  }, [liquidityZones]);

  // V-MAX Fase 1 (fechamento do §3.1): alimenta a série de CVD com o
  // histórico REAL da store (mesmo orderflowHistory do heatmap — um dado,
  // dois consumidores, zero segunda coleta). time real em ms → segundos da
  // lib com dedupe manter-o-último por segundo (a cadência real do poller é
  // ~4s, então colisões são raras; o guarda existe porque a lib exige tempos
  // estritamente ascendentes). Histórico vazio => série vazia honesta.
  const orderflowHistory = useOrderflowHistory();
  useEffect(() => {
    if (!cvdSeriesRef.current) return;
    const bySecond = new Map<number, number>();
    for (const entry of orderflowHistory) {
      bySecond.set(Math.floor(entry.time / 1000), entry.cvd);
    }
    cvdSeriesRef.current.setData(
      [...bySecond.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([t, cvd]) => ({ time: t as UTCTimestamp, value: cvd })),
    );
  }, [orderflowHistory]);

  // Research-driven precision order: VWAP, computed straight from the
  // same real candle array driving the whole chart (chartData already
  // carries real per-candle volume, V-MAX Fase 1.3) — zero new fetch,
  // zero second data source. UTC-day-anchored (see nexus/vwap.ts header
  // for why); an empty result (no candle in the current UTC day, or a
  // day with zero real volume) sets an empty series — never a fabricated
  // flat line.
  useEffect(() => {
    if (!vwapSeriesRef.current) return;
    const series = computeSessionVwapSeries(data);
    vwapSeriesRef.current.setData(series.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
  }, [data]);

  // V-MAX Fase 1 (superfície visual): níveis reais da Matriz de Confluência
  // Fibonacci como price lines nativas — "fio de seda" (1px sólida, nunca
  // pontilhada); a hierarquia entre níveis vem da OPACIDADE pela confluência
  // real (score ≥ 1 fonte => mais presente), nunca do estilo do traço.
  // Título carrega ratio + score reais ("FIB 61.8% ×2").
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    fibLinesRef.current.forEach((line) => series.removePriceLine(line));
    fibLinesRef.current = [];

    (fibonacciLevels ?? []).forEach((level) => {
      if (!Number.isFinite(level.price)) return;
      fibLinesRef.current.push(
        series.createPriceLine({
          price: level.price,
          color: level.score > 0 ? "rgba(0, 240, 255, 0.55)" : "rgba(0, 240, 255, 0.20)",
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: false,
          title: `FIB ${(level.ratio * 100).toFixed(1)}%${level.score > 0 ? ` ×${level.score}` : ""}`,
        }),
      );
    });
  }, [fibonacciLevels]);

  // Signal Precision order: the Trade Plan drawn on the chart — subtle,
  // silk-thread annotations (1px solid, never dashed; hierarchy only via
  // color/opacity). Entry zone = two lines bounding the real structure
  // (one line when the zone is a zero-width level); Stop and Target with
  // their real structure basis and the R:R in the label. English labels
  // (professional trading terminology). Fail-closed: no plan, no lines.
  useEffect(() => {
    if (!seriesRef.current) return;
    const series = seriesRef.current;
    tradePlanLinesRef.current.forEach((line) => series.removePriceLine(line));
    tradePlanLinesRef.current = [];
    stopLineRef.current = null;
    targetLineRef.current = null;
    if (!tradePlan) return;

    const mk = (price: number, color: string, title: string) => {
      if (!Number.isFinite(price)) return null;
      const line = series.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title,
      });
      tradePlanLinesRef.current.push(line);
      return line;
    };
    const entryColor = "rgba(240, 208, 111, 0.75)"; // amber — the acceptance zone
    if (tradePlan.entry.low === tradePlan.entry.high) {
      mk(tradePlan.entry.low, entryColor, `ENTRY ${tradePlan.direction} · ${tradePlan.entry.basis}`);
    } else {
      mk(tradePlan.entry.high, entryColor, `ENTRY ${tradePlan.direction} · ${tradePlan.entry.basis}`);
      mk(tradePlan.entry.low, "rgba(240, 208, 111, 0.45)", "ENTRY ZONE LOW");
    }
    const stopTitle = `STOP · ${tradePlan.stop.basis}`;
    stopLineRef.current = mk(tradePlan.stop.price, "rgba(255, 0, 85, 0.75)", stopTitle);
    const targetTitle = `TARGET · ${tradePlan.target.basis}${tradePlan.riskRewardRatio !== null ? ` · 1:${tradePlan.riskRewardRatio.toFixed(2)}` : ""}`;
    targetLineRef.current = mk(tradePlan.target.price, "rgba(0, 255, 170, 0.75)", targetTitle);
  }, [tradePlan]);

  // Ordem Final Autonomia Evolução §1: "alertas visuais sutis quando o
  // preço romper estrutura relevante" — the chart-side counterpart to the
  // command bar's TARGET REACHED/STOP BREACHED tone shift
  // (TradePlanTopStrip in App.tsx), same first-touch-style comparison.
  // Deliberately a SEPARATE, lightweight effect: applyOptions() nudges
  // color/title on the two lines already created above in place — it
  // never removes/recreates the trade-plan lines on every WebSocket tick
  // the way the [tradePlan] effect above does on a real plan change.
  // Regra de Ouro 2 ("fio de seda"): hierarchy stays color/opacity-only —
  // lineWidth and lineStyle are never touched here.
  useEffect(() => {
    if (!tradePlan) return;
    const p = typeof livePrice === "number" && Number.isFinite(livePrice) ? livePrice : null;
    if (p === null) return;
    const long = tradePlan.direction === "LONG";
    const targetHit = long ? p >= tradePlan.target.price : p <= tradePlan.target.price;
    const stopHit = !targetHit && (long ? p <= tradePlan.stop.price : p >= tradePlan.stop.price);
    const stopTitle = `STOP · ${tradePlan.stop.basis}`;
    stopLineRef.current?.applyOptions({
      color: stopHit ? "rgba(255, 0, 85, 1)" : "rgba(255, 0, 85, 0.75)",
      title: stopHit ? `${stopTitle} · BREACHED` : stopTitle,
    });
    const targetTitle = `TARGET · ${tradePlan.target.basis}${tradePlan.riskRewardRatio !== null ? ` · 1:${tradePlan.riskRewardRatio.toFixed(2)}` : ""}`;
    targetLineRef.current?.applyOptions({
      color: targetHit ? "rgba(0, 255, 170, 1)" : "rgba(0, 255, 170, 0.75)",
      title: targetHit ? `${targetTitle} · REACHED` : targetTitle,
    });
  }, [tradePlan, livePrice]);

  return (
    <div className="absolute inset-0">
      {/* V-MAX Fase 1.2: densidade L2 + bolhas de trades grandes, ANTES do
         container do chart de propósito — layout.background do chart é
         transparent (acima), então este heatmap fica REALMENTE atrás das
         velas (não só semi-transparente por cima), o visual institucional
         padrão (Bookmap-style) sem precisar de nenhuma API de camadas da
         lib. */}
      <OrderFlowHeatmapPlugin
        chart={chartReady?.chart ?? null}
        series={chartReady?.series ?? null}
      />
      <div ref={containerRef} className="absolute inset-0" />
      {/* V-MAX Fase 0.7: FVG/Order Blocks (bullish|bearish) — mesmo dado real
         de computeSmcZones, já filtrado (!mitigated) e limitado em contagem
         rio acima (App.tsx/ChartWidget), agora como área colorida real
         (Blueprint §3.1 LiquidityZonesPlugin) em vez de duas price lines —
         restaura a cor que o gráfico SVG anterior tinha, sem tirar nenhuma
         cor do gráfico (pedido explícito do Operador). */}
      <LiquidityZonesPlugin
        chart={chartReady?.chart ?? null}
        series={chartReady?.series ?? null}
        data={data}
        fairValueGaps={(fairValueGaps ?? []) as FillableZone[]}
        orderBlocks={(orderBlocks ?? []) as FillableZone[]}
      />
      {/* Ordem "Ciborgue Vivo" §1: BOS/CHOCH real, mesma anotação temporária
         que "pensa e esquece" — mesmo array `data` que LiquidityZonesPlugin
         acima já usa, então o índice do rompimento fica alinhado. */}
      <StructureBreakMarkersPlugin
        chart={chartReady?.chart ?? null}
        series={chartReady?.series ?? null}
        data={data}
        structureBreak={structureBreak ?? null}
      />
      {/* V-MAX Fase 1 (superfície visual): Volume Profile real (Fase 1.3)
         como barras à direita + linha do POC — overlay por cima do chart
         (pointer-events-none), dado direto da store. */}
      <VolumeProfilePlugin
        chart={chartReady?.chart ?? null}
        series={chartReady?.series ?? null}
      />
      {/* Neural Market Aura: the conviction corridor, mounted BEFORE the
         crisp entry-zone box below so the soft gradient stays visually
         underneath it, not competing with it. */}
      <NeuralMarketAuraPlugin
        chart={chartReady?.chart ?? null}
        series={chartReady?.series ?? null}
        aura={aura ?? null}
      />
      {/* Ordem Final Autonomia Evolução §1 ("caixas semi-transparentes"):
         the Trade Plan's entry zone, mounted last so it stays the topmost
         overlay — it is the most actionable, currently-live information
         on the chart, above the more diagnostic FVG/OB zones. */}
      <TradePlanZonePlugin
        chart={chartReady?.chart ?? null}
        series={chartReady?.series ?? null}
        entryLow={tradePlan?.entry.low ?? null}
        entryHigh={tradePlan?.entry.high ?? null}
      />
    </div>
  );
}
