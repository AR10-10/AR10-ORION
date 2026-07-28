// MarketSessionBandsPlugin.tsx — EPC OMEGA FINAL, Etapa 10 ("Institutional
// Session Engine: marcar Ásia/Londres/Nova York e mudanças de sessão").
// market-session.ts já calculava a sessão real (Refinamento Final §1) mas
// só aparecia como texto no header — auditoria da Etapa 1 confirmou que a
// mudança de sessão nunca tinha uma marca própria no gráfico.
//
// Redesenho real (ADENDO "Refinamento das Sessões e Limpeza Visual",
// diretiva com imagem de referência — pediu explicitamente "faixas
// discretas no topo/eixo do tempo" em vez de linhas verticais repetidas):
// a versão original desenhava uma linha 1px de ALTURA TOTAL (topo a base
// do painel) para CADA transição de sessão na amostra carregada — como
// sessões trocam ~5x/dia (Ásia/Londres/Londres+NY/Nova York/Pacífico,
// ver market-session.ts), qualquer janela de alguns dias em timeframe
// baixo (1m-15m) empilhava dezenas de linhas quase idênticas cruzando o
// gráfico inteiro, competindo com candle/estrutura/liquidez — o oposto
// do papel real desta camada (Prioridade Baixa, puro pano de fundo
// temporal, AUDITORIA_ECOSSISTEMA_VISUAL.md §9.2/§9.3).
//
// Fix real: nenhuma linha vertical mais. Cada sessão vira um SEGMENTO de
// uma faixa fina (STRIP_HEIGHT_PX) rente à borda inferior do painel —
// mesma ideia de "faixa discreta no eixo do tempo" pedida na diretiva,
// zero pixel de linha cruzando a área de candle. Geometria de retângulo
// (início/fim reais) já é o mesmo padrão de KillZoneBandsPlugin — a
// diferença real: sessão é uma PARTIÇÃO CONTÍNUA (100% do tempo pertence
// a alguma sessão, nunca lacuna), então a faixa é sempre preenchida de
// ponta a ponta (nunca ocasional como Kill Zone) — exatamente por isso
// tem que ser fina/rente à borda, nunca altura total como Kill Zone (uma
// faixa sempre-presente em altura total tingiria o painel inteiro o
// tempo todo, a MESMA classe de poluição visual que está sendo corrigida
// aqui, só trocando "muitas linhas" por "um bloco permanente").
//
// Dado: reaproveita computeSessionKeyLevels (já real, já testada,
// consumida por SessionKeyLevelsPlugin/EnhancedChart::
// currentSessionKeyLevel) em vez de computeSessionBoundaries — precisa de
// SEGMENTOS (startTime/endTime/closed por ocorrência), não pontos de
// transição; zero segunda função de derivação. computeSessionBoundaries
// continua viva (App.tsx ainda a usa para o sinal de relevância
// recentSessionBoundary — consumidor diferente, propósito diferente:
// "quão recente foi a ÚLTIMA troca", nunca geometria de desenho).
//
// Ênfase real (mesma disciplina 2 vezes já provada nesta sessão —
// SessionKeyLevelsPlugin closed/open, BOS/CHOCH ageAlpha): só a sessão
// CORRENTE (última, closed:false) ganha alpha alto + rótulo de texto;
// sessões já fechadas ficam como faixa de referência mais discreta, sem
// texto próprio — reduz de "um rótulo por transição" pra "um rótulo
// total", nunca zero contexto (Regra de Ouro 4: realoca, não apaga).
//
// LEI 24: display only, puro contexto temporal — nunca uma decisão.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { computeSessionKeyLevels, type SessionKeyLevel } from "../nexus/market-session";

// Discreto de propósito — contexto de fundo, nunca compete visualmente com
// estrutura (BOS/CHOCH), liquidez (EQH/EQL) ou o Trade Plan. Mesmo tom
// slate-gray já "dono" desta camada, só a GEOMETRIA mudou.
const STRIP_HEIGHT_PX = 4; // faixa fina rente à base — nunca altura total (ver header do arquivo).
const BAND_COLOR_CLOSED = "rgba(148, 163, 184, 0.22)";
const BAND_COLOR_OPEN = "rgba(148, 163, 184, 0.50)";
const LABEL_COLOR = "rgba(148, 163, 184, 0.85)";
const MIN_LABEL_WIDTH_PX = 40; // abaixo disto, o rótulo não cabe — a faixa ainda desenha, só o texto pula.

interface MarketSessionBandsPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number; high: number; low: number }[];
}

export function MarketSessionBandsPlugin({ chart, series, data }: MarketSessionBandsPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef(data);
  const markDirtyRef = useRef<(() => void) | null>(null);
  // Evolução do Organismo (Fase 2, "menor cálculos duplicados"): mesmo
  // achado/mesmo fix de KillZoneBandsPlugin — computeSessionKeyLevels só
  // depende de `data`, nunca do range visível, mas draw() roda a cada
  // pan/zoom/resize. Cache por identidade de referência evita recomputar
  // um resultado idêntico a cada redraw.
  const levelsCacheRef = useRef<{ data: typeof data; levels: SessionKeyLevel[] } | null>(null);

  // Sempre a versão mais recente dos candles para o loop de desenho ler —
  // mesmo padrão de LiquidityZonesPlugin/StructureBreakMarkersPlugin.
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

      const cached = levelsCacheRef.current;
      let levels: SessionKeyLevel[];
      if (cached && cached.data === dataRef.current) {
        levels = cached.levels;
      } else {
        levels = computeSessionKeyLevels(dataRef.current);
        levelsCacheRef.current = { data: dataRef.current, levels };
      }
      if (levels.length === 0) return; // timeframe sem transição real na amostra (ex. candles diários) — honesto, nada a marcar.

      const timeScale = chart.timeScale();
      // Meia-largura de barra real (mesma correção de KillZoneBandsPlugin):
      // sem isto, o retângulo cortaria visualmente metade do candle na
      // fronteira entre 2 sessões.
      const halfBar = (timeScale.options().barSpacing ?? 0) / 2;
      const yTop = cssHeight - STRIP_HEIGHT_PX;
      const lastIndex = levels.length - 1;

      for (let i = 0; i < levels.length; i++) {
        const level = levels[i];
        const isOpen = !level.closed;
        const x1 = timeScale.timeToCoordinate(level.startTime as unknown as Time);
        // Sessão corrente: estende até a borda direita real ("ainda em
        // andamento", mesmo espírito de TradePlanZonePlugin/SessionKeyLevelsPlugin
        // pra referências vivas). Sessão fechada: até o próprio fim real.
        const x2 = isOpen ? cssWidth : timeScale.timeToCoordinate(level.endTime as unknown as Time);
        if (x1 === null || x2 === null) continue; // fora da área visível agora — Fail-Closed: nunca extrapola.

        const rectX = Math.min(x1, x2) - halfBar;
        const rectWidth = Math.max(1, Math.abs(x2 - x1) + halfBar * 2);
        const clippedX = Math.max(0, rectX);
        const clippedWidth = Math.min(rectX + rectWidth, cssWidth) - clippedX;
        if (clippedWidth <= 0) continue;

        ctx.fillStyle = isOpen ? BAND_COLOR_OPEN : BAND_COLOR_CLOSED;
        ctx.fillRect(clippedX, yTop, clippedWidth, STRIP_HEIGHT_PX);

        // Só a sessão CORRENTE ganha rótulo (ver header do arquivo) — as
        // fechadas ficam só como faixa de referência, sem texto próprio.
        if (i === lastIndex && clippedWidth >= MIN_LABEL_WIDTH_PX) {
          ctx.font = "9px -apple-system, sans-serif";
          ctx.textBaseline = "bottom";
          ctx.fillStyle = LABEL_COLOR;
          ctx.fillText(level.label.toUpperCase(), clippedX + 3, yTop - 2);
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
