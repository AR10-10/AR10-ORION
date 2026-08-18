import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeZoneSignificance,
  formatZoneAtrWidth,
  MIN_ZONE_ATR_FRACTION,
} from "../src/nexus/liquidity-significance";

describe("computeZoneSignificance — fail-closed", () => {
  it("sem ATR real, significant é SEMPRE true (nunca esconde por suposição)", () => {
    const r = computeZoneSignificance(101, 100, 100, null);
    expect(r.status).toBe("DADOS_INSUFICIENTES");
    expect(r.significant).toBe(true);
    expect(r.widthAtrUnits).toBeNull();
  });

  it("ATR zero ou negativo também não filtra", () => {
    for (const atr of [0, -1, NaN, Infinity]) {
      const r = computeZoneSignificance(101, 100, 100, atr);
      expect(r.significant, String(atr)).toBe(true);
    }
  });

  it("preço/top/bottom inválidos não filtram", () => {
    for (const [top, bottom, price] of [
      [NaN, 100, 100],
      [101, NaN, 100],
      [101, 100, 0],
      [101, 100, -5],
    ] as Array<[number, number, number]>) {
      expect(computeZoneSignificance(top, bottom, price, 2).significant).toBe(true);
    }
  });

  it("zona invertida (top < bottom, dado corrompido) não é escondida — o defeito é de dado", () => {
    const r = computeZoneSignificance(99, 100, 100, 2);
    expect(r.significant).toBe(true);
    expect(r.widthAtrUnits).toBe(0);
  });
});

describe("computeZoneSignificance — a matemática real", () => {
  it("uma zona larga (2% do preço, ATR 2%) é 1× ATR — bem acima do piso", () => {
    // top=102, bottom=100, price=100 -> largura 2%. ATR 2% -> 1.0x
    const r = computeZoneSignificance(102, 100, 100, 2);
    expect(r.status).toBe("OK");
    expect(r.widthAtrUnits).toBeCloseTo(1.0, 10);
    expect(r.significant).toBe(true);
  });

  it("uma zona minúscula (0.05% do preço, ATR 2%) fica abaixo do piso", () => {
    // largura 0.05%, ATR 2% -> 0.025x, bem abaixo de MIN_ZONE_ATR_FRACTION=0.12
    const r = computeZoneSignificance(100.05, 100, 100, 2);
    expect(r.widthAtrUnits).toBeCloseTo(0.025, 10);
    expect(r.significant).toBe(false);
  });

  it("a MESMA largura absoluta é significativa num ativo calmo e insignificante num agitado", () => {
    // Este é o ponto inteiro do motor: tamanho relativo, não absoluto.
    const calmo = computeZoneSignificance(100.5, 100, 100, 0.3); // largura 0.5%, ATR 0.3% -> 1.67x
    const agitado = computeZoneSignificance(100.5, 100, 100, 8); // mesma largura, ATR 8% -> 0.0625x
    expect(calmo.significant).toBe(true);
    expect(agitado.significant).toBe(false);
  });

  it("o limiar real é o próprio MIN_ZONE_ATR_FRACTION exportado (contrato, não número solto)", () => {
    // Largura construída de trás para frente a partir do limiar, para não
    // depender de arredondamento de ponto flutuante no meio do caminho
    // (100 * (1 + x/100) - 100 não é exatamente x em IEEE 754).
    const price = 100;
    const atrPercent = 4;
    const width = MIN_ZONE_ATR_FRACTION * atrPercent * price / 100; // = 0.48
    const bottom = price;
    const noLimiar = computeZoneSignificance(bottom + width, bottom, price, atrPercent);
    expect(noLimiar.widthAtrUnits).toBeCloseTo(MIN_ZONE_ATR_FRACTION, 10);
    expect(noLimiar.significant).toBe(true); // >= é inclusivo

    const abaixo = computeZoneSignificance(bottom + width * 0.99, bottom, price, atrPercent);
    expect(abaixo.significant).toBe(false);
  });

  it("largura zero (zona pontual) é sempre significativa — não é 'pequena', é uma LINHA", () => {
    const r = computeZoneSignificance(100, 100, 100, 2);
    expect(r.widthAtrUnits).toBe(0);
    expect(r.significant).toBe(true);
  });
});

describe("formatZoneAtrWidth", () => {
  it("segue a mesma disciplina de formatAtrUnits (piso '<0.05×')", () => {
    expect(formatZoneAtrWidth(0)).toBe("0×");
    expect(formatZoneAtrWidth(0.01)).toBe("<0.05×");
    expect(formatZoneAtrWidth(0.01)).not.toBe("0.00× ATR");
    expect(formatZoneAtrWidth(1.5)).toBe("1.50× ATR");
    expect(formatZoneAtrWidth(null)).toBe("—");
    expect(formatZoneAtrWidth(NaN)).toBe("—");
  });
});

describe("liquidity-significance — disciplina do módulo", () => {
  const src = readFileSync(resolve(__dirname, "../src/nexus/liquidity-significance.ts"), "utf8");

  it("é puro: zero rede, zero DOM, zero aleatório", () => {
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/\bwindow\./);
  });

  it("documenta por que os pools de liquidez NÃO são filtrados aqui (achado real, não omissão)", () => {
    expect(src).toMatch(/STRONG_TOUCH_THRESHOLD/);
    expect(src).toMatch(/JÁ passou pelo piso/);
  });
});
