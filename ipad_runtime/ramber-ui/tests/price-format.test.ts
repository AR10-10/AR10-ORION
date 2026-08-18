// Suíte da fonte única de formatação de preço (nexus/price-format.ts).
//
// DEFEITO RELATADO (Operador, sobre a tela real): "o ativo tem seis
// centavos, cinco centavos, aí o segundo número não aparece pra mim".
//
// CAUSA MEDIDA: SETE cópias da mesma régua — 3 funções `fmtPrice` byte a
// byte idênticas, 2 arrows inline (`const f = (v) => ...`, que a auditoria
// por nome de função não pegou de primeira), o formatador do eixo e o do
// alert-center. Duas casas fixas abaixo de
// 1000 fazem um ativo a 0,0654 aparecer como "0.07" — o dígito que ele
// precisa ler some no arredondamento.
//
// O teste mais importante deste arquivo é o primeiro: ele reproduz o
// defeito relatado e exige que ele não volte.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatPrice, priceDecimals } from "../src/nexus/price-format";

describe("o defeito relatado — preço baixo perdia dígito", () => {
  it("ativo de centavos mostra os dígitos reais, nunca arredondado para 2 casas", () => {
    // A régua antiga devolvia "0.07" — o 5 e o 4 sumiam.
    expect(formatPrice(0.0654)).toBe("0.0654");
    expect(formatPrice(0.0654)).not.toBe("0.07");
  });

  it("preço muito baixo continua legível em vez de virar 0.00", () => {
    // A régua antiga devolvia "0.00": a leitura inteira desaparecia.
    expect(formatPrice(0.000123)).toBe("0.000123");
    expect(formatPrice(0.00000456)).toBe("0.00000456");
  });

  it("seis centavos redondos mostram os dois dígitos, sem cauda de zeros", () => {
    expect(formatPrice(0.06)).toBe("0.06");
    expect(formatPrice(0.05)).toBe("0.05");
  });
});

describe("de 1 para cima NADA muda — o escopo é cirúrgico", () => {
  const antiga = (v: number) => v.toFixed(v >= 1000 ? 0 : 2);

  it("reproduz exatamente a régua antiga em toda faixa >= 1", () => {
    for (const v of [1, 1.5, 9.99, 42.125, 510.28, 999.994, 1000, 1234.5, 68500.7]) {
      expect(formatPrice(v), `preço ${v} mudou de comportamento`).toBe(antiga(v));
    }
  });

  it("o corte de nível redondo do eixo continua existindo, e só quando pedido", () => {
    expect(formatPrice(500, true)).toBe("500");
    expect(formatPrice(500)).toBe("500.00"); // painéis não cortam
    expect(formatPrice(510.28, true)).toBe("510.28"); // não é redondo, não corta
  });
});

describe("precisão acompanha a magnitude", () => {
  it("as faixas seguem a régua declarada", () => {
    expect(priceDecimals(2000)).toBe(0);
    expect(priceDecimals(510.28)).toBe(2);
    expect(priceDecimals(0.5)).toBe(4);
    expect(priceDecimals(0.05)).toBe(5);
    expect(priceDecimals(0.005)).toBe(6);
    expect(priceDecimals(0.0005)).toBe(7);
    expect(priceDecimals(0.00005)).toBe(8);
  });

  it("nunca passa do teto de 8 casas — além disso é ruído, não leitura", () => {
    for (const v of [1e-9, 1e-12, 5e-15]) {
      expect(priceDecimals(v)).toBeLessThanOrEqual(8);
    }
  });

  it("preço negativo usa a magnitude, nunca cai numa faixa errada pelo sinal", () => {
    expect(priceDecimals(-0.0654)).toBe(priceDecimals(0.0654));
    expect(formatPrice(-0.0654)).toBe("-0.0654");
  });
});

describe("fail-closed", () => {
  it("valor não-finito nunca vira 'NaN' na tela", () => {
    expect(formatPrice(NaN)).toBe("—");
    expect(formatPrice(Infinity)).toBe("—");
    expect(formatPrice(-Infinity)).toBe("—");
  });

  it("zero é um preço real e continua formatado, nunca vira travessão", () => {
    expect(formatPrice(0)).toBe("0");
  });
});

describe("fonte única — as sete cópias morreram", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");

  it("nenhum arquivo recopia a régua antiga `toFixed(v >= 1000 ? 0 : 2)`", () => {
    for (const p of [
      "../src/App.tsx",
      "../src/publication/canvas-primitives.ts",
      "../src/nexus/market-analysis.ts",
      "../src/chart/EnhancedChart_110_Percent.tsx",
      "../src/nexus/alert-center.ts",
    ]) {
      // Casa a forma EXECUTÁVEL (return / arrow), nunca a string solta —
      // ela aparece de propósito nos comentários que explicam por que a
      // cópia morreu, e casar com o comentário seria falso positivo.
      const src = read(p);
      expect(src, `${p} ainda RETORNA a régua copiada`).not.toMatch(/return v\.toFixed\(v >= 1000/);
      expect(src, `${p} ainda tem a régua copiada numa arrow`).not.toMatch(/=>\s*v\.toFixed\(v >= 1000/);
    }
  });

  it("todos os consumidores importam a fonte única", () => {
    for (const p of [
      "../src/App.tsx",
      "../src/publication/canvas-primitives.ts",
      "../src/nexus/market-analysis.ts",
      "../src/nexus/alert-center.ts",
    ]) {
      expect(read(p), `${p} não importa a fonte única`).toContain("price-format");
    }
    expect(read("../src/chart/EnhancedChart_110_Percent.tsx")).toContain("price-format");
  });

  it("o eixo do gráfico delega em vez de manter régua própria", () => {
    const src = read("../src/chart/EnhancedChart_110_Percent.tsx");
    expect(src).toContain("return formatPrice(v, true);");
  });
});
