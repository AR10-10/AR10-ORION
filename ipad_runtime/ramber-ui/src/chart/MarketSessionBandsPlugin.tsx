// MarketSessionBandsPlugin.tsx — EPC OMEGA FINAL, Etapa 10 ("Institutional
// Session Engine: marcar Ásia/Londres/Nova York e mudanças de sessão").
// market-session.ts já calculava a sessão real (Refinamento Final §1) mas
// só aparecia como texto no header — auditoria da Etapa 1 confirmou que a
// mudança de sessão nunca tinha uma marca própria no gráfico.
//
// Redesenho real #1 (ADENDO "Refinamento das Sessões e Limpeza Visual"):
// a versão original desenhava uma linha 1px de ALTURA TOTAL por transição
// de sessão — dezenas de linhas quase idênticas em qualquer janela de
// vários dias. Fix: faixa fina rente à base, só a sessão corrente com
// rótulo (ver histórico completo em SYSTEM_HANDBOOK.md §6.60).
//
// Redesenho real #2 ("chegar mais próximo possível" de uma imagem de
// referência enviada pelo Operador — pedido explícito, não suposição):
// a referência mostra uma faixa mais informativa no TOPO do painel, com
// TODAS as sessões visíveis rotuladas (nome + janela), não só a corrente.
// Adotado o que é diretamente compatível com a arquitetura real:
// - Posição: topo (y=0), não mais rente à base — mesmo espírito da
//   referência ("faixa discreta acima do candle"). Risco de colisão com
//   o candle avaliado antes de mover: a escala de preço principal usa a
//   margem PADRÃO real da lib (`scaleMargins: { top: 0.2, bottom: 0.1 }`,
//   confirmado em node_modules/lightweight-charts/dist/typings.d.ts —
//   nunca lida de memória) — 20% de respiro já reservado acima do maior
//   preço visível, folga real suficiente para uma faixa de
//   BAND_HEIGHT_PX na prática, sem precisar mexer no scaleMargins do
//   painel principal (mudança maior, mais arriscada, não necessária aqui).
// - Rótulo: TODA sessão visível ganha nome + janela UTC real (via
//   marketSessionFromUtc, mesmo dado já usado no header — zero segunda
//   fonte), não só a corrente — mas o texto só desenha se a largura real
//   do segmento comportar (MIN_LABEL_WIDTH_PX),
//   nunca espremido ilegível.
// - Cor: A referência usa tons distintos por sessão; decisão consciente
//   de NÃO copiar isso — a auditoria de paleta desta mesma sessão
//   (AUDITORIA_ECOSSISTEMA_VISUAL.md §9.4/§9.6) já documentou que Market
//   Sessions é Prioridade BAIXA por design (pano de fundo, nunca deveria
//   competir por atenção) e que introduzir uma família de cor nova por
//   sessão contradiria o próprio achado desta auditoria ("evitar cor
//   demais"). O efeito visual de "uma sessão se destaca" da referência é
//   alcançado aqui por INTENSIDADE (a sessão corrente com alpha bem mais
//   alto), não por matiz novo — mesmo tom slate-gray já "dono" desta
//   camada, só a geometria e a densidade de rótulo mudaram.
//
// Dado: reaproveita computeSessionKeyLevels (já real, já testada,
// consumida por SessionKeyLevelsPlugin/EnhancedChart::
// currentSessionKeyLevel) — precisa de SEGMENTOS (startTime/endTime/
// closed por ocorrência), não pontos de transição; zero segunda função
// de derivação. computeSessionBoundaries continua viva (App.tsx ainda a
// usa para o sinal de relevância recentSessionBoundary — consumidor
// diferente, propósito diferente: "quão recente foi a ÚLTIMA troca",
// nunca geometria de desenho).
//
// LEI 24: display only, puro contexto temporal — nunca uma decisão.
//
// Correção real, rodada 1 (Diretriz Consolidação/Auditoria/Evolução,
// auditoria de ciclo de vida dos 12 plugins): o "Redesenho real #2" acima
// removeu deliberadamente o teto de contagem que existia no "Redesenho
// real #1" para mostrar todas as sessões nomeadas — mas isso reintroduziu
// exatamente a poluição visual sem limite que o Redesenho #1 já tinha
// corrigido uma vez. Este era o ÚNICO dos 12 plugins do gráfico sem
// nenhum mecanismo de ciclo de vida. Primeira correção: corte binário
// reusando MAX_KEY_LEVELS_SHOWN de SessionKeyLevelsPlugin.
//
// Correção real, rodada 2 (Diretriz Final de Lapidação Visual, Parte 1 —
// pedido explícito com números exatos: "sessão atual 100%, imediatamente
// anterior 40%, 2 sessões atrás 20%, histórico distante 0% removido"): o
// corte binário da rodada 1 virou fade real por geração via
// sessionGenerationWeight (nexus/market-session.ts) — mesma função
// compartilhada com SessionKeyLevelsPlugin, zero segunda tabela de
// decaimento. O preço volta a ser o protagonista: só 3 gerações reais
// desenham, cada uma mais discreta que a anterior, nunca dezenas de
// faixas na mesma opacidade.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { computeSessionKeyLevels, sessionGenerationWeight, SESSION_GENERATION_FADE, type SessionKeyLevel } from "../nexus/market-session";
// Achado 2.6: a altura/posição desta faixa deixou de ser um número local e
// passou a vir da lane compartilhada — mesmo valor real de sempre (14px no
// topo, zero mudança visual aqui), agora de fonte única com a faixa de
// Kill Zones logo abaixo, que antes desenhava por cima do gráfico inteiro.
import { getTimeRibbonLaneTopPx, getTimeRibbonLaneHeightPx } from "./chart-time-ribbon-lanes";

// Discreto de propósito — contexto de fundo, nunca compete visualmente com
// estrutura (BOS/CHOCH), liquidez (EQH/EQL) ou o Trade Plan. Mesmo tom
// slate-gray já "dono" desta camada — INTENSIDADE (alpha) distingue a
// sessão corrente das já fechadas E decai por geração (ver header do
// arquivo), zero matiz novo.
// Lapidação por feedback direto do Operador ("a faixinha dos mercados...
// da forma que está não está bom, está atrapalhando o visual"): a faixa
// afinou de 24px/2 linhas para 14px/1 linha. A 2ª linha (janela UTC) era
// DUPLICAÇÃO literal do header (marketSessionFromUtc — mesmo dado, mesma
// função), então removê-la daqui é remover redundância, nunca dado real
// (Regra de Ouro 4: a janela continua visível no header de sempre).
// Achado 2.6: mesmo 14px de sempre, agora vindo da lane compartilhada —
// nunca mais um número local que pode divergir da camada vizinha.
const BAND_TOP_PX = getTimeRibbonLaneTopPx("market_session"); // 0 — primeira lane da faixa.
const BAND_HEIGHT_PX = getTimeRibbonLaneHeightPx("market_session"); // topo do painel — nome da sessão em 1 linha.
const BAND_COLOR_CLOSED = "rgba(148, 163, 184, 0.16)";
const BAND_COLOR_OPEN = "rgba(148, 163, 184, 0.42)";
const BORDER_COLOR = "rgba(148, 163, 184, 0.30)";
const LABEL_COLOR_CLOSED = "rgba(203, 213, 225, 0.55)";
const LABEL_COLOR_OPEN = "rgba(226, 232, 240, 0.95)";
const MIN_LABEL_WIDTH_PX = 44; // abaixo disto, nome não cabe — a faixa ainda desenha, só o texto pula.

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

      // Ciclo de vida real por geração (ver header do arquivo): só as
      // SESSION_GENERATION_FADE.maxGenerationsShown ocorrências mais
      // recentes sequer entram no loop — além disso o peso já seria 0.
      const recent = levels.slice(-SESSION_GENERATION_FADE.maxGenerationsShown);

      const timeScale = chart.timeScale();
      // Meia-largura de barra real (mesma correção de KillZoneBandsPlugin):
      // sem isto, o retângulo cortaria visualmente metade do candle na
      // fronteira entre 2 sessões.
      const halfBar = (timeScale.options().barSpacing ?? 0) / 2;

      for (let i = 0; i < recent.length; i++) {
        const level = recent[i];
        const isOpen = !level.closed;
        // generationsBack=0 é sempre a última entrada (a corrente/aberta,
        // por construção de computeSessionKeyLevels — cronológico, mais
        // recente por último); 1 = imediatamente anterior; 2 = 2 atrás.
        const generationsBack = recent.length - 1 - i;
        const weight = sessionGenerationWeight(generationsBack);
        if (weight <= 0) continue; // geração distante demais — "removido automaticamente".

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

        // globalAlpha aplica o peso da geração por cima da cor base — mesmo
        // padrão já usado por LiquidityZonesPlugin/StructureBreakMarkersPlugin
        // para decaimento real (ver annotation-decay.ts), reset pra 1 no fim
        // de cada iteração pra nunca vazar pro próximo desenho.
        ctx.globalAlpha = weight;

        ctx.fillStyle = isOpen ? BAND_COLOR_OPEN : BAND_COLOR_CLOSED;
        ctx.fillRect(clippedX, BAND_TOP_PX, clippedWidth, BAND_HEIGHT_PX);

        // Divisor real entre sessões (Fio de Seda, Regra de Ouro 5): 1px
        // sólida, nunca setLineDash. Só a borda ESQUERDA de cada segmento
        // — a direita de um é a esquerda do próximo (partição contígua,
        // desenhar as duas dobraria o traço no mesmo pixel).
        if (i > 0) {
          ctx.lineWidth = 1;
          ctx.strokeStyle = BORDER_COLOR;
          ctx.beginPath();
          ctx.moveTo(Math.round(rectX) + 0.5, BAND_TOP_PX);
          ctx.lineTo(Math.round(rectX) + 0.5, BAND_TOP_PX + BAND_HEIGHT_PX);
          ctx.stroke();
        }

        if (clippedWidth >= MIN_LABEL_WIDTH_PX) {
          ctx.font = "9px -apple-system, sans-serif";
          ctx.textBaseline = "top";
          ctx.fillStyle = isOpen ? LABEL_COLOR_OPEN : LABEL_COLOR_CLOSED;
          // 1 linha só (ver comentário de BAND_HEIGHT_PX): a janela UTC que
          // vivia aqui como 2ª linha era o MESMO marketSessionFromUtc do
          // header — removida como duplicação, o dado continua no header.
          ctx.fillText(level.label.toUpperCase(), clippedX + 4, BAND_TOP_PX + 3);
        }
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
      style={{ width: "100%", height: "100%" }}
    />
  );
}
