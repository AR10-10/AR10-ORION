// SessionKeyLevelsPlugin.tsx — Pedido do Operador (captura de um indicador
// de referência: "Key Levels", sessões Ásia/Londres/Nova York ancoradas em
// timezone, estilo de linha configurável). Pesquisa real confirmada
// (TradingView — "Session Highs & Lows", "Key Session & Levels", "Trading
// Sessions with High/Low Levels"): o padrão real desta família de
// indicadores é plotar a MÁXIMA e a MÍNIMA de cada sessão institucional
// como um NÍVEL HORIZONTAL de preço — conceito ICT/SMC real (liquidez
// tende a descansar acima da máxima/abaixo da mínima de uma sessão já
// encerrada; o extremo vira referência de S/R daqui pra frente).
//
// nexus/market-session.ts::computeSessionKeyLevels já faz a derivação pura
// (companion function da MESMA partição de sessão real que já serve o
// header — nunca uma 3ª definição paralela de "o que é Ásia/Londres/NY";
// kill-zones.ts tem sua própria janela ESTREITA para um propósito
// DIFERENTE, ver header daquele arquivo). Este plugin só resolve a
// geometria real (linha horizontal, início real na hora em que a sessão
// abriu, estendendo até a borda direita visível — o mesmo espírito de
// "referência válida daqui pra frente" que TradePlanZonePlugin já usa).
//
// Cor: MESMA dupla verde/vermelho já usada por Suporte/Resistência (S1/R1,
// EnhancedChart_110_Percent.tsx) e por LONG_RGB/SHORT_RGB
// (NeuralMarketAuraPlugin) — a máxima da sessão é estruturalmente um teto
// (mesmo papel de R1), a mínima um piso (mesmo papel de S1). Zero tom novo
// na paleta (mesma disciplina de VWAP bands/Kill Zones, §6.54/§6.55).
//
// Declutter deliberado: só as últimas MAX_KEY_LEVELS_SHOWN ocorrências
// (a sessão corrente + as mais recentes já fechadas) são desenhadas —
// convenção declarada (mesmo espírito de MARKET_SESSION_RECENT_BOUNDARY_
// CANDLES), nunca a história inteira carregada (isso empilharia dezenas de
// linhas cruzando o gráfico inteiro em qualquer janela de vários dias).
//
// Achado real do Operador ("as etiquetas não podem ficar em cima do valor
// do ativo"): a versão original desenhava um rótulo de texto flutuante
// direto na coordenada Y do preço (o próprio high/low) — exatamente onde
// um candle/pulso de preço tem mais chance real de estar, por definição
// (um Key Level É o preço que a sessão tocou). Este canvas agora desenha
// SÓ a linha real (nenhum texto flutuante) — a sessão CORRENTE (a mais
// recente, ainda em andamento) ganha seu rótulo real no sistema
// anti-colisão do eixo (EnhancedChart_110_Percent.tsx::priceAxisLabels,
// currentSessionKeyLevel), nunca competindo com a área de candles. As
// sessões já fechadas continuam como referência visual real (cor + linha),
// sem rótulo próprio — mesma migração pro eixo aplicada à Liquidity Sweep
// no mesmo achado (causa real ali era outra: title nativo nunca chegava a
// renderizar em lugar nenhum com axisLabelVisible:false — ver comentário
// completo em EnhancedChart_110_Percent.tsx).
//
// LEI 24: display only, puro contexto estrutural — nunca uma decisão.
//
// Correção real (Diretriz Final de Lapidação Visual, Parte 1/3 — mesmo
// achado da auditoria de ciclo de vida: corte abrupto por contagem em vez
// de fade real por relevância): o 6º nível simplesmente sumia inteiro
// (`slice(-MAX_KEY_LEVELS_SHOWN)`) em vez de esmaecer progressivamente.
// Agora usa sessionGenerationWeight (nexus/market-session.ts) — MESMA
// função/MESMOS números (100%/40%/20%/0%) que MarketSessionBandsPlugin,
// já que ambos particionam a MESMA série de sessões — zero segunda tabela
// de decaimento. MAX_KEY_LEVELS_SHOWN permanece exportado (histórico de
// import de MarketSessionBandsPlugin já migrado, mas manter o nome não
// quebra nenhum consumidor externo que ainda dependa dele).
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { computeSessionKeyLevels, sessionGenerationWeight, type SessionKeyLevel } from "../nexus/market-session";

const HIGH_COLOR_OPEN = "rgba(242, 54, 69, 0.55)";
const HIGH_COLOR_CLOSED = "rgba(242, 54, 69, 0.32)";
const LOW_COLOR_OPEN = "rgba(8, 153, 129, 0.55)";
const LOW_COLOR_CLOSED = "rgba(8, 153, 129, 0.32)";

// Convenção declarada (mesmo espírito de MARKET_SESSION_RECENT_BOUNDARY_
// CANDLES em layer-relevance.ts) — nunca uma medição: últimas 5 ocorrências
// reais (a corrente + as 4 mais recentes já fechadas) cobrem
// aproximadamente 1 dia da partição de 5 sessões, o horizonte real que um
// Operador consulta num Key Level (hoje/ontem), não uma semana inteira.
export const MAX_KEY_LEVELS_SHOWN = 5;

interface SessionKeyLevelsPluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number; high: number; low: number }[];
}

export function SessionKeyLevelsPlugin({ chart, series, data }: SessionKeyLevelsPluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef(data);
  const markDirtyRef = useRef<(() => void) | null>(null);
  // Mesmo achado/mesmo fix de §6.56 (KillZoneBandsPlugin/
  // MarketSessionBandsPlugin) — computeSessionKeyLevels só depende de
  // `data`, nunca do range visível, mas draw() roda a cada pan/zoom/resize.
  // Cache por identidade de referência desde o NASCIMENTO deste plugin,
  // nunca uma correção retroativa.
  const levelsCacheRef = useRef<{ data: typeof data; levels: SessionKeyLevel[] } | null>(null);

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
      if (levels.length === 0) return; // amostra curta demais pra fechar nenhuma sessão real ainda — honesto, nada a desenhar.

      const recent = levels.slice(-MAX_KEY_LEVELS_SHOWN);
      const timeScale = chart.timeScale();

      // Só a LINHA real — nenhum texto flutuante (ver header do arquivo).
      // O rótulo legível da sessão corrente vive no eixo
      // (priceAxisLabels/currentSessionKeyLevel); sessões já fechadas ficam
      // como referência visual pura (cor + posição), sem texto próprio.
      const drawLevel = (price: number, startTime: number, color: string) => {
        const y = series.priceToCoordinate(price);
        if (y === null) return; // fora da faixa de preço visível agora — Fail-Closed: nunca extrapola.
        const xStartRaw = timeScale.timeToCoordinate(startTime as unknown as Time);
        // Sessão pode ter começado antes da janela visível de tempo — a
        // MESMA lógica honesta de "clipa, nunca esconde" já usada pelo
        // KillZoneBandsPlugin: o nível ainda é real, só a origem exata que
        // fica fora de vista.
        const xStart = xStartRaw === null ? 0 : Math.max(0, xStartRaw);
        if (xStart >= cssWidth) return; // sessão inteira à direita da área visível — nada real a desenhar ainda.
        const yLine = Math.round(y) + 0.5;

        // Fio de Seda (Regra de Ouro 5): 1px sólida real, nunca setLineDash.
        ctx.lineWidth = 1;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(xStart, yLine);
        ctx.lineTo(cssWidth, yLine);
        ctx.stroke();
      };

      for (let i = 0; i < recent.length; i++) {
        const level = recent[i];
        const openColorHigh = level.closed ? HIGH_COLOR_CLOSED : HIGH_COLOR_OPEN;
        const openColorLow = level.closed ? LOW_COLOR_CLOSED : LOW_COLOR_OPEN;
        // Fade real por geração (mesma sessionGenerationWeight de
        // MarketSessionBandsPlugin, mesmos números 100/40/20%) — clamp em
        // generationsBack=2 pra reusar só as 3 constantes já declaradas
        // pelo Operador em vez de inventar 2 números novos (gen3/gen4):
        // o horizonte de MAX_KEY_LEVELS_SHOWN=5 (~1 dia, já justificado
        // acima) continua o mesmo, só o piso de opacidade passa a ser 20%
        // em vez de um degrau binário aberto/fechado.
        const generationsBack = Math.min(recent.length - 1 - i, 2);
        const weight = sessionGenerationWeight(generationsBack);
        ctx.globalAlpha = weight;
        drawLevel(level.high, level.startTime, openColorHigh);
        drawLevel(level.low, level.startTime, openColorLow);
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
