// TpoProfilePlugin.tsx — Entrega 41 (TPO / Market Profile, gap real
// nomeado desde a auditoria v16.0 ULTRA §12.2/12.3: "só precisa de OHLC
// de candle, sem tick stream"). Desenha o perfil TPO REAL da sessão
// corrente (nexus/tpo-profile.ts) como barras horizontais ancoradas à
// direita — mesma arquitetura provada do VolumeProfilePlugin (barra
// proporcional por linha) — mais Value Area (realce de faixa), POC
// (linha) e Initial Balance (2 linhas de referência).
//
// Fonte de dado: `data`, a MESMA série real de candles já threadada a
// SessionKeyLevelsPlugin/KillZoneBandsPlugin — nunca uma segunda
// assinatura/fetch. Cache por identidade de referência (mesmo padrão de
// SessionKeyLevelsPlugin): computeTpoProfile só reroda quando `data` de
// fato muda, nunca a cada pan/zoom/resize (draw() roda nesses eventos,
// mas o perfil em si não depende deles).
//
// Nota honesta de escopo visual (1º corte): cada linha do modelo já
// carrega as letras reais do período (result.rows[i].letters) — dado
// real disponível para uma evolução futura (glifo por letra em zoom
// alto/tooltip). O desenho aqui é uma BARRA proporcional à contagem de
// TPO por linha — mesma gramática visual do Volume Profile já presente
// no mesmo gráfico (imediatamente legível lado a lado; texto por letra
// em ~40 linhas seria pequeno demais pra ler no espaço real disponível).
//
// "Fio de Seda" (Regra de Ouro 5): POC e Initial Balance são linhas 1px
// sólidas reais, nunca setLineDash.
//
// Lane própria (achado real, ver chart-profile-lanes.ts): este plugin
// ancorava em cssWidth, EXATAMENTE a mesma faixa de pixels que
// VolumeProfilePlugin — os "perfis irmãos" citados acima colidiam de
// verdade sempre que os dois estavam relevantes/visíveis ao mesmo tempo
// (o caso comum, os dois defaults são true). Agora TPO Profile é a 2ª
// lane, imediatamente à esquerda da lane do Volume Profile — nunca cruza
// para o espaço dele.
import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { computeTpoProfile, type TpoProfileResult } from "../nexus/tpo-profile";
import { getProfileLaneRightEdgePx, getProfileLaneMaxBarWidthPx } from "./chart-profile-lanes";
// Linhas TPO: azul-neutro já usado pra estrutura (mesmo tom-base de
// #8ab4f8 onipresente no HUD) — deliberadamente NUNCA o cyan do Volume
// Profile: os dois perfis podem estar ligados ao mesmo tempo, e cores
// iguais confundiriam qual barra pertence a qual perfil.
const ROW_FILL = "rgba(138, 180, 248, 0.10)";
const ROW_FILL_VALUE_AREA = "rgba(138, 180, 248, 0.24)";
// POC do TPO: âmbar (já na paleta — Kill Zones/paredes de liquidez do
// Order Book Depth), deliberadamente DIFERENTE do magenta já usado pelo
// POC de Volume Profile — os dois POCs medem coisas diferentes (contagem
// de TEMPO vs. VOLUME) e podem cair em preços diferentes; a mesma cor
// faria parecer o mesmo nível quando não é.
const POC_LINE = "rgba(240, 208, 111, 0.85)";
// Initial Balance: mesma dupla real já usada por S1/R1/SessionKeyLevels
// (teto estrutural = vermelho, piso estrutural = verde) — IB alto/baixo
// tem o MESMO papel estrutural (referência de range, nunca direção).
const IB_HIGH = "rgba(255, 0, 85, 0.5)";
const IB_LOW = "rgba(0, 255, 170, 0.5)";

interface TpoProfilePluginProps {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  data: { time: number; high: number; low: number }[];
}

export function TpoProfilePlugin({ chart, series, data }: TpoProfilePluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef(data);
  const markDirtyRef = useRef<(() => void) | null>(null);
  const cacheRef = useRef<{ data: typeof data; result: TpoProfileResult | null }>({ data: [], result: null });

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

      let result: TpoProfileResult | null;
      if (cacheRef.current.data === dataRef.current) {
        result = cacheRef.current.result;
      } else {
        const reading = computeTpoProfile(dataRef.current);
        result = reading.status === "OK" ? reading.result : null;
        cacheRef.current = { data: dataRef.current, result };
      }
      if (!result) return; // DADOS_INSUFICIENTES real — nada desenhado, nunca um perfil fabricado

      const maxCount = result.rows.reduce((m, row) => Math.max(m, row.letters.length), 0);
      if (!(maxCount > 0)) return;

      const laneRight = getProfileLaneRightEdgePx("tpo_profile", cssWidth);
      const maxBarWidth = getProfileLaneMaxBarWidthPx("tpo_profile", cssWidth);
      const rowWidthPrice = (result.rangeMax - result.rangeMin) / result.rowCount;

      for (let i = 0; i < result.rows.length; i++) {
        const count = result.rows[i].letters.length;
        if (count === 0) continue;
        const priceLow = result.rangeMin + i * rowWidthPrice;
        const priceHigh = priceLow + rowWidthPrice;
        const yLow = series.priceToCoordinate(priceLow);
        const yHigh = series.priceToCoordinate(priceHigh);
        if (yLow === null || yHigh === null) continue; // fora da área visível — Fail-Closed, nunca extrapola
        const y = Math.min(yLow, yHigh);
        const h = Math.max(1, Math.abs(yLow - yHigh) - 0.5);
        const w = (count / maxCount) * maxBarWidth;
        const inValueArea = i >= result.valueAreaLowIndex && i <= result.valueAreaHighIndex;
        ctx.fillStyle = inValueArea ? ROW_FILL_VALUE_AREA : ROW_FILL;
        ctx.fillRect(laneRight - w, y, w, h);
      }

      const pocY = series.priceToCoordinate(result.pocPrice);
      if (pocY !== null) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = POC_LINE;
        ctx.beginPath();
        ctx.moveTo(laneRight - maxBarWidth, pocY + 0.5);
        ctx.lineTo(laneRight, pocY + 0.5);
        ctx.stroke();
      }

      // Initial Balance só desenhado quando os 2 primeiros períodos já
      // fecharam de verdade — nunca um IB parcial apresentado como final.
      if (result.initialBalanceComplete) {
        const drawIbLine = (price: number, color: string) => {
          const y = series.priceToCoordinate(price);
          if (y === null) return;
          ctx.lineWidth = 1;
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.moveTo(laneRight - maxBarWidth, Math.round(y) + 0.5);
          ctx.lineTo(laneRight, Math.round(y) + 0.5);
          ctx.stroke();
        };
        drawIbLine(result.initialBalanceHigh, IB_HIGH);
        drawIbLine(result.initialBalanceLow, IB_LOW);
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

  // width/height explícitos: <canvas> é replaced element — inset:0
  // sozinho não o estica (mesmo achado já documentado no VolumeProfilePlugin).
  return (
    <canvas
      ref={canvasRef}
      data-plugin="tpo-profile"
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
