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

// ---------------------------------------------------------------------------
// AUDITORIA: as TRÊS populações de banda de preço que disputam as mesmas 3
// vagas de destaque no canvas — FVG/OB, Voids, e Breaker/Mitigation.
//
// O cabeçalho deste módulo dizia que o filtro cobria "FVG/Order Block/Void".
// Medição real: ele só chegava a FVG e Order Block. As duas ausências têm
// veredictos DIFERENTES, e os dois ficam travados aqui.
// ---------------------------------------------------------------------------
describe("Voids: o filtro seria redundante — e a redundância é uma INVARIANTE, não uma coincidência", () => {
  const motor = readFileSync(
    resolve(__dirname, "../../src/research/engines/liquidity-void-engine.js"),
    "utf8",
  );

  it("o motor de voids já exige >= 1x ATR de deslocamento por candle", () => {
    // Forma EXECUTÁVEL (a declaração real), nunca a string solta: o nome da
    // constante também aparece na lista de `limitations` do metadata e num
    // comentário, e casar com qualquer uma delas provaria nada.
    expect(motor).toMatch(/const\s+VOID_MIN_DISPLACEMENT_RATIO\s*=\s*1\s*;/);
    expect(motor).toMatch(/const\s+VOID_MIN_RUN_LENGTH\s*=\s*2\s*;/);
  });

  it("a zona de void é o envelope do run — nunca mais estreita que o maior candle dele", () => {
    // top = max(high) e bottom = min(low) sobre o run. É isso que garante
    // que a largura da ZONA herda o piso de 1x ATR do CANDLE.
    expect(motor).toMatch(/if\s*\(h\s*>\s*top\)\s*top\s*=\s*h;/);
    expect(motor).toMatch(/if\s*\(l\s*<\s*bottom\)\s*bottom\s*=\s*l;/);
  });

  it("1x ATR fica MUITO acima do piso deste módulo — por isso o filtro não removeria nada", () => {
    const pisoDoMotorEmAtr = 1; // VOID_MIN_DISPLACEMENT_RATIO
    expect(MIN_ZONE_ATR_FRACTION).toBeLessThan(pisoDoMotorEmAtr);
    // A margem é o que torna o argumento robusto mesmo com os dois ATR
    // vindo de janelas diferentes (motor: lorentzian-classifier.js;
    // este módulo: regime-engine.js — ambos Wilder 14).
    expect(pisoDoMotorEmAtr / MIN_ZONE_ATR_FRACTION).toBeGreaterThan(8);
    // Prova executável de que o filtro é no-op nesta faixa: uma zona no
    // MENOR tamanho que o motor de voids consegue produzir já é significativa.
    const atrPct = 2;
    const preco = 100;
    const larguraMinimaDeVoid = (preco * atrPct) / 100; // exatamente 1x ATR
    const r = computeZoneSignificance(preco + larguraMinimaDeVoid, preco, preco, atrPct);
    expect(r.status).toBe("OK");
    expect(r.significant).toBe(true);
  });

  it("o cabeçalho registra o achado em vez de deixar a contradição de pé", () => {
    const src = readFileSync(resolve(__dirname, "../src/nexus/liquidity-significance.ts"), "utf8");
    expect(src).toMatch(/NUNCA a Void/);
    expect(src).toMatch(/VOID_MIN_DISPLACEMENT_RATIO/);
  });
});

describe("Breaker/Mitigation: aqui o filtro FALTAVA de verdade — e agora está ligado", () => {
  const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");

  it("as 3 vagas são disputadas dentro do subconjunto SIGNIFICATIVO, igual a FVG/OB", () => {
    // Quarta vez nesta trilha que uma mutação de FIAÇÃO passaria verde com o
    // motor testado a fundo e a CHAMADA não travada. Aqui a chamada real fica
    // travada, nos dois tipos de bloco.
    expect(app).toContain("const significantBreakers = breakerAll.filter(isSignificantZone);");
    expect(app).toContain("const significantMitigations = mitigationAll.filter(isSignificantZone);");
    expect(app).toContain("significantBreakers.indexOf(b) !== -1 && significantBreakers.indexOf(b) < 3");
    expect(app).toContain("significantMitigations.indexOf(b) !== -1 && significantMitigations.indexOf(b) < 3");
  });

  it("obstáculo real do plano ativo continua ESCAPANDO do teto (Regra de Ouro 4)", () => {
    // A escapatória é o que impede o filtro de apagar informação estrutural:
    // um bloco no caminho entrada→alvo aparece independente do tamanho.
    for (const trecho of [
      "isRealObstacle(b) || significantBreakers.indexOf(b)",
      "isRealObstacle(b) || significantMitigations.indexOf(b)",
    ]) {
      expect(app).toContain(trecho);
    }
  });

  it("a assinatura de isSignificantZone é estrutural — um bloco não é PriceZone", () => {
    // Se voltasse a exigir PriceZone, os blocos precisariam de um cast (uma
    // mentira de tipo) ou de uma SEGUNDA chamada duplicada.
    expect(app).toContain("const isSignificantZone = (z: { top: number; bottom: number }) =>");
  });

  it("a medição que motivou a mudança fica registrada, não só o resultado", () => {
    expect(app).toMatch(/2985 blocos/);
    expect(app).toMatch(/1,27% abaixo do piso/);
  });
});
