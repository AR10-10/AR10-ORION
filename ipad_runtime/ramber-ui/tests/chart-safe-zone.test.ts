// chart-safe-zone.test.ts — ORDEM 2A ("Fechar gap de notificações / Chart
// Spatial Safety"). Prova a garantia real que a ordem exige (§14 — "não
// aceitar 'deve funcionar', precisamos de PASS com teste e/ou medição
// objetiva"):
//
//   TOAST RECT ∩ CRITICAL CHART RECT = EMPTY
//
// A garantia matemática desta suíte: sempre que `maxVisible > 0` (o
// stack realmente desenha algo), `top + maxHeight` nunca alcança o topo
// real do gráfico — nem em uma resolução isolada, em TODAS as classes de
// viewport reais (iPad Mini/iPad/iPad Pro portrait+landscape, desktop)
// mais os casos extremos (gráfico maximizado colando no topo, sem
// gráfico montado nesta aba).
import { describe, it, expect } from "vitest";
import { computeToastPlacement } from "../src/chart/chart-safe-zone";

// Alturas de viewport reais (CSS px) das mesmas classes de dispositivo já
// usadas na rodada de QA responsiva anterior (A1): iPad Mini, iPad, iPad
// Pro 11"/12.9", desktop — portrait e landscape.
const DEVICE_HEIGHTS = [
  1133, // iPad Mini portrait
  744, // iPad Mini landscape
  1180, // iPad (10th gen) portrait
  820, // iPad (10th gen) landscape
  1194, // iPad Pro 11" portrait
  834, // iPad Pro 11" landscape
  1366, // iPad Pro 12.9" portrait
  1024, // iPad Pro 12.9" landscape
  900, // desktop < 1120
  1080, // desktop >= 1440
];

// chartTop reais: o valor medido ao vivo (171, viewport 1366x1024 desktop,
// ver relatório da ORDEM 2) + uma faixa de outros valores plausíveis,
// incluindo os extremos: 0 (gráfico maximizado colando no topo do
// viewport — App.tsx documenta esse modo) e valores bem grandes (chart
// widget pequeno, empurrado pra baixo por outros painéis).
const CHART_TOPS = [0, 1, 40, 80, 103, 171, 250, 400, 600, 900];

describe("computeToastPlacement: garantia real — nunca alcança o gráfico", () => {
  it("com gráfico montado: top+maxHeight nunca alcança chartTop, em toda combinação de device height x chartTop", () => {
    for (const viewportHeight of DEVICE_HEIGHTS) {
      for (const chartTop of CHART_TOPS) {
        if (chartTop >= viewportHeight) continue; // combinação fisicamente impossível (gráfico fora da tela)
        const p = computeToastPlacement(chartTop, viewportHeight);
        if (p.maxVisible > 0) {
          expect(
            p.top + p.maxHeight,
            `viewportHeight=${viewportHeight} chartTop=${chartTop} => top=${p.top} maxHeight=${p.maxHeight}`,
          ).toBeLessThan(chartTop);
        }
      }
    }
  });

  it("gráfico maximizado (chartTop=0, sem margem nenhuma acima): nunca desenha nada — mais seguro que desenhar sobre a única vela visível", () => {
    const p = computeToastPlacement(0, 1024);
    expect(p.maxVisible).toBe(0);
  });

  it("chartTop real medido ao vivo (Playwright, ORDEM 2, viewport 1366x1024 desktop): garantia continua valendo", () => {
    const p = computeToastPlacement(171, 1024);
    expect(p.top + p.maxHeight).toBeLessThan(171);
    expect(p.maxVisible).toBeGreaterThan(0); // espaço real suficiente pro modo compacto nesta resolução
  });

  it("sem gráfico montado (chartTop=null — aba SETTINGS/outro módulo): usa o rodapé real do viewport, nunca None por falta de dado", () => {
    for (const viewportHeight of DEVICE_HEIGHTS) {
      const p = computeToastPlacement(null, viewportHeight);
      expect(p.top + p.maxHeight).toBeLessThanOrEqual(viewportHeight);
      expect(p.maxVisible).toBeGreaterThan(0);
    }
  });

  it("fail-closed: chartTop inválido (negativo/NaN/Infinity) é tratado como 'sem gráfico', nunca uma posição fabricada", () => {
    for (const bad of [-1, NaN, -Infinity, Infinity]) {
      const semGrafico = computeToastPlacement(null, 1024);
      const comInvalido = computeToastPlacement(bad, 1024);
      if (Number.isFinite(bad) && (bad as number) < 0) {
        // negativo tratado como "sem gráfico" (hasChart exige >= 0)
        expect(comInvalido).toEqual(semGrafico);
      }
      // NaN/±Infinity nunca produzem NaN na saída.
      expect(Number.isFinite(comInvalido.top)).toBe(true);
      expect(Number.isFinite(comInvalido.maxHeight)).toBe(true);
    }
  });

  it("determinístico: mesma entrada sempre produz a mesma saída", () => {
    expect(computeToastPlacement(171, 1024)).toEqual(computeToastPlacement(171, 1024));
    expect(computeToastPlacement(null, 900)).toEqual(computeToastPlacement(null, 900));
  });

  it("múltiplos toasts (item 7 da ordem): maxVisible cresce com a faixa livre, nunca ultrapassa o que cabe de verdade", () => {
    const apertado = computeToastPlacement(120, 1024); // faixa livre curta
    const folgado = computeToastPlacement(900, 1024); // faixa livre grande (gráfico pequeno, empurrado pra baixo)
    expect(folgado.maxVisible).toBeGreaterThanOrEqual(apertado.maxVisible);
    // Mesmo no caso folgado, a garantia de não alcançar o gráfico segue valendo.
    expect(folgado.top + folgado.maxHeight).toBeLessThan(900);
  });

  it("faixa livre real medida ao vivo (chartTop=171, desktop 1366x1024, ver relatório ORDEM 2): cabe exatamente 1 cartão completo, modo normal", () => {
    const p = computeToastPlacement(171, 1024); // floor=159, top=80 (abaixo dos banners), maxHeight=79 >= CARD_HEIGHT(64)
    expect(p.compact).toBe(false);
    expect(p.maxVisible).toBe(1);
  });

  it("modo compacto: sinalizado exatamente quando a faixa livre não cabe um cartão completo mas cabe a linha de 1 alerta", () => {
    const p = computeToastPlacement(120, 1024); // floor=108, top=80, maxHeight=28 — abaixo de CARD_HEIGHT(64), acima de COMPACT_ROW_HEIGHT(22)
    expect(p.compact).toBe(true);
    expect(p.maxVisible).toBe(1);
  });

  it("faixa livre grande o bastante para cartões completos: modo normal, mais de 1 visível quando a folga permitir", () => {
    const p = computeToastPlacement(500, 1024);
    expect(p.compact).toBe(false);
    expect(p.maxVisible).toBeGreaterThanOrEqual(1);
  });
});
