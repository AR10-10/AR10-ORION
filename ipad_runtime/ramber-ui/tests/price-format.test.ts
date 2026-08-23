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
import { formatPrice, priceDecimals, nativePriceDecimals } from "../src/nexus/price-format";

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

// ---------------------------------------------------------------------------
// PRECISÃO DO EIXO NATIVO — defeito visto em captura real (WLFI/USDT 1H).
//
// A régua adaptativa já tinha chegado aos painéis (SUPPORT 0.05598,
// RESISTÊNCIA 0.061 apareciam certos), mas o EIXO do gráfico mostrava "0.06"
// para todos eles. Causa: `priceFormat` nunca foi configurado, e a
// lightweight-charts assume precision 2 / minMove 0.01 por padrão.
// ---------------------------------------------------------------------------
describe("precisão do eixo nativo acompanha a magnitude do ativo", () => {
  const chart = () => readFileSync(resolve(__dirname, "../src/chart/EnhancedChart_110_Percent.tsx"), "utf-8");

  it("o gráfico configura priceFormat — sem isso a lib fixa 2 casas", () => {
    const src = chart();
    expect(src).toContain("priceFormat: { type: \"price\", precision, minMove:");
  });

  it("a precisão vem da MESMA régua dos painéis, nunca de uma segunda", () => {
    const src = chart();
    expect(src).toContain("nativePriceDecimals(ref)");
    expect(src).toContain("price-format");
  });

  it("minMove é derivado da precisão, nunca um número solto", () => {
    // minMove errado faz a lib arredondar de novo, anulando a precisão.
    expect(chart()).toContain("minMove: Math.pow(10, -precision)");
  });

  it("um ativo de centavos ganha casas suficientes para separar níveis reais", () => {
    // O caso da captura: 0.05598 e 0.061 tinham de virar rótulos DIFERENTES.
    const p = priceDecimals(0.06);
    expect(formatPrice(0.05598)).not.toBe(formatPrice(0.061));
    expect(p).toBeGreaterThanOrEqual(4);
  });

  it("nenhum rótulo de PREÇO do gráfico usa toFixed(2) cravado", () => {
    // Eram três (último preço, TREND, high da sessão) — todos passavam a
    // mostrar "0.06" num ativo de centavos.
    const src = chart();
    expect(src).not.toContain("displayPrice.toFixed(2)");
    expect(src).not.toContain("midPrice.toFixed(2)");
    expect(src).not.toContain("high.toFixed(2)");
  });
});

// ---------------------------------------------------------------------------
// REGRESSÃO PEGA ANTES DE CHEGAR NA TELA.
//
// A primeira versão do fix do eixo usava `priceDecimals` direto no
// `priceFormat` nativo. Como ela devolve 0 casas acima de 1000 (herdado do
// formatador de RÓTULO, onde "65200" lê melhor que "65200.00"), o BTC
// passaria a mostrar o PREÇO VIVO como "64604" em vez de "64603.79".
//
// O `priceFormat` nativo governa três coisas ao mesmo tempo — marcas do
// eixo, crosshair e último preço — e o preço vivo é o que o Operador mais
// lê. Perder centavos ali para ganhar um zero a menos numa marca de grade é
// troca ruim.
// ---------------------------------------------------------------------------
describe("nativePriceDecimals — o eixo nativo nunca perde os centavos", () => {
  it("BTC mantém 2 casas: o preço vivo continua 64603.79, nunca 64604", () => {
    expect(priceDecimals(64603.79)).toBe(0); // régua de RÓTULO: "65200"
    expect(nativePriceDecimals(64603.79)).toBe(2); // régua NATIVA: piso de 2
  });

  it("acima de 1 o piso de 2 casas vale sempre", () => {
    for (const v of [1, 9.99, 510.28, 1000, 68500.7, 250000]) {
      expect(nativePriceDecimals(v), `preço ${v}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("abaixo de 1 a precisão adaptativa passa inteira — é lá que o defeito vivia", () => {
    expect(nativePriceDecimals(0.06)).toBe(priceDecimals(0.06));
    expect(nativePriceDecimals(0.000123)).toBe(priceDecimals(0.000123));
    expect(nativePriceDecimals(0.06)).toBeGreaterThan(2);
  });

  it("nunca é MENOR que a régua de rótulo — só sobe, nunca corta precisão", () => {
    for (const v of [0.00005, 0.005, 0.5, 5, 5000]) {
      expect(nativePriceDecimals(v)).toBeGreaterThanOrEqual(priceDecimals(v));
    }
  });

  it("o gráfico usa a régua NATIVA, não a de rótulo", () => {
    const src = readFileSync(resolve(__dirname, "../src/chart/EnhancedChart_110_Percent.tsx"), "utf-8");
    expect(src).toContain("nativePriceDecimals(ref)");
    expect(src).not.toContain("const precision = priceDecimals(ref)");
  });
});
