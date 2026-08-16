// chart-profile-lanes.test.ts — achado real (reclamação direta do
// Operador: "o sistema agora tem camada duplicada... tipo o volume
// profile, o volume"): VolumeProfilePlugin, TpoProfilePlugin e
// DepthChartPlugin desenhavam todos a partir do mesmo cssWidth (mesma
// faixa de pixels) sempre que mais de um estava visível ao mesmo tempo
// (o caso comum — os 3 defaults são true em visibilidade E modo
// automático, ver DEFAULT_CHART_LAYER_VISIBILITY/DEFAULT_CHART_LAYER_
// AUTO_MODE em EnhancedChart_110_Percent.tsx). Convenção mista de
// sempre: a matemática pura das lanes (fronteira real, "os números estão
// certos?") ganha execução real; a fiação nos 3 plugins ("esqueceram de
// ligar A com B de novo?") ganha teste de padrão de código.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  getProfileLaneOffsetFraction,
  getProfileLaneWidthFraction,
  getProfileLaneRightEdgePx,
  getProfileLaneMaxBarWidthPx,
  type ChartProfileLaneId,
} from "../src/chart/chart-profile-lanes";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

describe("chart-profile-lanes: matemática pura de offset/largura", () => {
  it("volume_profile é a lane 0 (rightmost) — offset zero, comportamento visual idêntico a antes", () => {
    expect(getProfileLaneOffsetFraction("volume_profile")).toBe(0);
    expect(getProfileLaneRightEdgePx("volume_profile", 1000)).toBe(1000);
  });

  it("tpo_profile começa exatamente onde a lane do volume_profile termina (0.16)", () => {
    expect(getProfileLaneOffsetFraction("tpo_profile")).toBeCloseTo(0.16, 10);
    expect(getProfileLaneRightEdgePx("tpo_profile", 1000)).toBeCloseTo(840, 10);
  });

  it("order_book_depth começa depois de volume_profile + tpo_profile somados (0.16 + 0.14)", () => {
    expect(getProfileLaneOffsetFraction("order_book_depth")).toBeCloseTo(0.3, 10);
    expect(getProfileLaneRightEdgePx("order_book_depth", 1000)).toBeCloseTo(700, 10);
  });

  it("fail-closed: id desconhecido devolve offset 0 (nunca NaN/undefined)", () => {
    expect(getProfileLaneOffsetFraction("nao_existe" as ChartProfileLaneId)).toBe(0);
  });

  it("getProfileLaneMaxBarWidthPx escala linearmente com cssWidth (mesma fração, 2x largura => 2x px)", () => {
    const w500 = getProfileLaneMaxBarWidthPx("order_book_depth", 500);
    const w1000 = getProfileLaneMaxBarWidthPx("order_book_depth", 1000);
    expect(w1000).toBeCloseTo(w500 * 2, 10);
  });

  it("invariante real: as 3 lanes nunca se sobrepõem, para qualquer cssWidth real", () => {
    const cssWidth = 1440; // monitor real comum, mesma ordem de grandeza do caso do Operador
    const ids: ChartProfileLaneId[] = ["volume_profile", "tpo_profile", "order_book_depth"];
    const spans = ids.map((id) => {
      const right = getProfileLaneRightEdgePx(id, cssWidth);
      const width = getProfileLaneMaxBarWidthPx(id, cssWidth);
      return { id, left: right - width, right };
    });
    // Ordenado por `left` decrescente (volume_profile é o mais à direita).
    spans.sort((a, b) => b.left - a.left);
    for (let i = 0; i < spans.length - 1; i++) {
      // A borda esquerda de uma lane nunca é menor que a borda direita da
      // próxima (nunca cruza pra dentro da lane vizinha) — epsilon real de
      // ponto flutuante (soma de frações vs. soma de produtos não é
      // bit-idêntica, ex.: (0.16+0.14)*W vs 0.16*W+0.14*W), nunca uma
      // colisão real: a ordem de grandeza (~1e-13px) é invisível em
      // qualquer canvas real.
      expect(spans[i].left).toBeGreaterThanOrEqual(spans[i + 1].right - 1e-9);
    }
  });

  it("soma das 3 larguras fica dentro de um orçamento real de tela (nunca > 60% do chart mesmo no pior caso simultâneo)", () => {
    const total =
      getProfileLaneWidthFraction("volume_profile") +
      getProfileLaneWidthFraction("tpo_profile") +
      getProfileLaneWidthFraction("order_book_depth");
    expect(total).toBeLessThan(0.6);
  });
});

describe("chart-profile-lanes: fiação real nos 3 plugins (nunca cssWidth literal de novo)", () => {
  const volumeProfilePlugin = () => read("../src/chart/VolumeProfilePlugin.tsx");
  const tpoProfilePlugin = () => read("../src/chart/TpoProfilePlugin.tsx");
  const depthChartPlugin = () => read("../src/chart/DepthChartPlugin.tsx");

  it("VolumeProfilePlugin importa e usa a lane compartilhada", () => {
    const src = volumeProfilePlugin();
    expect(src).toContain('import { getProfileLaneRightEdgePx, getProfileLaneMaxBarWidthPx } from "./chart-profile-lanes";');
    expect(src).toContain('getProfileLaneRightEdgePx("volume_profile", cssWidth)');
    expect(src).toContain('getProfileLaneMaxBarWidthPx("volume_profile", cssWidth)');
    expect(src).not.toContain("MAX_BAR_WIDTH_FRACTION");
    expect(src).not.toContain("ctx.fillRect(cssWidth - w,");
  });

  it("TpoProfilePlugin importa e usa a lane compartilhada (bars + POC + Initial Balance)", () => {
    const src = tpoProfilePlugin();
    expect(src).toContain('import { getProfileLaneRightEdgePx, getProfileLaneMaxBarWidthPx } from "./chart-profile-lanes";');
    expect(src).toContain('getProfileLaneRightEdgePx("tpo_profile", cssWidth)');
    expect(src).toContain('getProfileLaneMaxBarWidthPx("tpo_profile", cssWidth)');
    expect(src).not.toContain("MAX_BAR_WIDTH_FRACTION");
    expect(src).not.toContain("ctx.fillRect(cssWidth - w,");
    // As 2 linhas de Initial Balance (drawIbLine) também migraram do
    // cssWidth literal para a lane — não só o POC.
    expect(src).not.toContain("ctx.moveTo(cssWidth - maxBarWidth,");
  });

  it("DepthChartPlugin importa e usa a lane compartilhada (bids/asks + wall + label)", () => {
    const src = depthChartPlugin();
    expect(src).toContain('import { getProfileLaneRightEdgePx, getProfileLaneMaxBarWidthPx } from "./chart-profile-lanes";');
    expect(src).toContain('getProfileLaneRightEdgePx("order_book_depth", cssWidth)');
    expect(src).toContain('getProfileLaneMaxBarWidthPx("order_book_depth", cssWidth)');
    expect(src).not.toContain("MAX_BAR_WIDTH_FRACTION");
    expect(src).not.toContain("ctx.fillRect(cssWidth - w,");
    expect(src).not.toContain("cssWidth - w - size.width - 4");
  });

  it("LiquidationHeatmapPlugin NUNCA entra nesta família (ancora à esquerda de propósito, precedente OMEGA CORE V-MAX Fase 8.1)", () => {
    const src = read("../src/chart/LiquidationHeatmapPlugin.tsx");
    expect(src).not.toContain("chart-profile-lanes");
    expect(src).toContain("ctx.fillRect(0, y, longW, h)");
  });
});
