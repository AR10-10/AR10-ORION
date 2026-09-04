// Execução real: a pergunta aqui é geométrica ("o painel cobre a barra de
// comando?"), então os números são calculados de verdade e comparados contra
// as zonas proibidas.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  resolveFloatingWidgetOrigin,
  floatingWidgetSlot,
  FLOATING_WIDGET_WIDTH,
  FLOATING_WIDGET_HEIGHT,
} from "../src/nexus/floating-widget-origin";

// As mesmas fronteiras declaradas no módulo — repetidas aqui de propósito:
// se alguém afrouxar as constantes lá, estes testes precisam falhar, não
// acompanhar em silêncio.
const HEADER_SAFE_TOP = 96;
const RAIL_SAFE_LEFT = 64;

const VIEWPORTS: Array<[string, number, number]> = [
  ["iPad Mini retrato", 744, 1133],
  ["iPad Air retrato", 820, 1180],
  ["iPad Pro paisagem", 1366, 1024],
  ["notebook", 1440, 900],
  ["desktop", 1920, 1080],
  ["ultrawide", 3440, 1440],
];

const IDS = ["orderbook", "orderflow", "heatmap", "scanner", "exposure", "events", "chart"];

describe("resolveFloatingWidgetOrigin — nunca cobre o que não pode", () => {
  it("nunca nasce por cima da barra de comando, em nenhuma viewport", () => {
    for (const [, w, h] of VIEWPORTS) {
      for (const id of IDS) {
        const o = resolveFloatingWidgetOrigin(id, w, h);
        expect(o.y).toBeGreaterThanOrEqual(HEADER_SAFE_TOP);
      }
    }
  });

  it("nunca nasce por cima da régua de navegação esquerda", () => {
    for (const [, w, h] of VIEWPORTS) {
      for (const id of IDS) {
        const o = resolveFloatingWidgetOrigin(id, w, h);
        expect(o.x).toBeGreaterThan(RAIL_SAFE_LEFT);
      }
    }
  });

  it("não nasce mais no canto superior esquerdo do gráfico (o defeito medido)", () => {
    // (100, 100) era o valor literal antigo. Em qualquer viewport com espaço
    // real, a âncora do canto inferior direito fica MUITO longe disso.
    for (const [, w, h] of VIEWPORTS) {
      const o = resolveFloatingWidgetOrigin("orderbook", w, h);
      expect(o.x === 100 && o.y === 100).toBe(false);
    }
  });

  it("em telas com espaço, ancora à direita e embaixo (canto de menor densidade)", () => {
    const [, w, h] = ["desktop", 1920, 1080] as const;
    const o = resolveFloatingWidgetOrigin("orderbook", w, h);
    // Metade direita da tela...
    expect(o.x).toBeGreaterThan(w / 2);
    // ...e metade inferior.
    expect(o.y).toBeGreaterThan(h / 2);
  });

  it("cabe inteiro dentro da janela quando há espaço para isso", () => {
    for (const [nome, w, h] of VIEWPORTS) {
      const o = resolveFloatingWidgetOrigin("scanner", w, h);
      const cabeHorizontal = RAIL_SAFE_LEFT + 16 + FLOATING_WIDGET_WIDTH + 16 <= w;
      const cabeVertical = HEADER_SAFE_TOP + FLOATING_WIDGET_HEIGHT + 16 <= h;
      if (cabeHorizontal) expect(o.x + o.width, nome).toBeLessThanOrEqual(w);
      if (cabeVertical) expect(o.y + o.height, nome).toBeLessThanOrEqual(h);
    }
  });
});

describe("resolveFloatingWidgetOrigin — escalonamento por id", () => {
  it("dois painéis diferentes não nascem no mesmo pixel (o 2º defeito medido)", () => {
    // O escalonamento tem 4 posições; com 7 ids reais alguns colidem por
    // construção, mas o conjunto tem que produzir MAIS DE UMA posição — o
    // defeito antigo produzia exatamente uma para todos.
    const posicoes = new Set(
      IDS.map((id) => {
        const o = resolveFloatingWidgetOrigin(id, 1920, 1080);
        return `${o.x},${o.y}`;
      }),
    );
    expect(posicoes.size).toBeGreaterThan(1);
  });

  it("é determinístico: o mesmo id devolve sempre o mesmo lugar", () => {
    for (const id of IDS) {
      const a = resolveFloatingWidgetOrigin(id, 1440, 900);
      const b = resolveFloatingWidgetOrigin(id, 1440, 900);
      expect(a).toEqual(b);
    }
  });

  it("floatingWidgetSlot fica sempre dentro do intervalo de posições", () => {
    for (const id of [...IDS, "", "x", "um-id-bem-mais-longo-que-o-normal"]) {
      const slot = floatingWidgetSlot(id);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(4);
      expect(Number.isInteger(slot)).toBe(true);
    }
  });

  it("id ausente cai na posição 0, nunca em NaN", () => {
    expect(floatingWidgetSlot(null)).toBe(0);
    expect(floatingWidgetSlot(undefined)).toBe(0);
    expect(floatingWidgetSlot("")).toBe(0);
  });
});

describe("resolveFloatingWidgetOrigin — fail-closed", () => {
  it("viewport inválida cai no ponto seguro, nunca em NaN ou negativo", () => {
    for (const [w, h] of [
      [NaN, 1080],
      [1920, NaN],
      [0, 0],
      [-100, -100],
      [Infinity, 1080],
    ] as Array<[number, number]>) {
      const o = resolveFloatingWidgetOrigin("orderbook", w, h);
      expect(Number.isFinite(o.x)).toBe(true);
      expect(Number.isFinite(o.y)).toBe(true);
      expect(o.x).toBeGreaterThan(RAIL_SAFE_LEFT);
      expect(o.y).toBeGreaterThanOrEqual(HEADER_SAFE_TOP);
    }
  });

  it("tela minúscula ainda devolve coordenadas usáveis (clamp vence a âncora)", () => {
    const o = resolveFloatingWidgetOrigin("orderbook", 320, 200);
    expect(o.x).toBe(RAIL_SAFE_LEFT + 16);
    expect(o.y).toBe(HEADER_SAFE_TOP);
  });
});

describe("floating-widget-origin — fiação real em App.tsx", () => {
  const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");

  it("o Rnd não usa mais coordenadas literais", () => {
    expect(app).not.toMatch(/default=\{\{\s*x:\s*100,\s*y:\s*100/);
  });

  it("o Rnd consome resolveFloatingWidgetOrigin de verdade", () => {
    expect(app).toMatch(/default=\{resolveFloatingWidgetOrigin\(/);
    expect(app).toMatch(/^\s*import\s*\{[^}]*resolveFloatingWidgetOrigin[^}]*\}\s*from\s*"\.\/nexus\/floating-widget-origin"/m);
  });

  it("o módulo é puro (a leitura de window acontece no chamador, não nele)", () => {
    const src = readFileSync(resolve(__dirname, "../src/nexus/floating-widget-origin.ts"), "utf8");
    expect(src).not.toMatch(/\bwindow\./);
    expect(src).not.toMatch(/Math\.random/);
  });
});
