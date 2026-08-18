// Testes de EXECUÇÃO REAL (convenção do CLAUDE.md: o bug mais provável aqui
// é "a matemática está sutilmente errada", não "esqueceram de conectar A com
// B") — o motor é chamado de verdade, com números escolhidos para que a
// resposta certa seja calculável à mão.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeDecisionDistance,
  formatDecisionDistance,
  describeDecisionDistance,
  formatAtrUnits,
} from "../src/nexus/decision-distance";

describe("computeDecisionDistance — fail-closed", () => {
  it("devolve DADOS_INSUFICIENTES sem preço real", () => {
    const r = computeDecisionDistance({ lastPrice: null, sma: 100, ema: 100 });
    expect(r.status).toBe("DADOS_INSUFICIENTES");
    expect(r.long).toBeNull();
    expect(r.short).toBeNull();
    expect(r.current).toBeNull();
  });

  it("devolve DADOS_INSUFICIENTES sem SMA ou sem EMA", () => {
    expect(computeDecisionDistance({ lastPrice: 100, sma: null, ema: 100 }).status).toBe("DADOS_INSUFICIENTES");
    expect(computeDecisionDistance({ lastPrice: 100, sma: 100, ema: undefined }).status).toBe("DADOS_INSUFICIENTES");
  });

  it("rejeita NaN/Infinity em qualquer das 3 entradas", () => {
    expect(computeDecisionDistance({ lastPrice: NaN, sma: 100, ema: 100 }).status).toBe("DADOS_INSUFICIENTES");
    expect(computeDecisionDistance({ lastPrice: 100, sma: Infinity, ema: 100 }).status).toBe("DADOS_INSUFICIENTES");
    expect(computeDecisionDistance({ lastPrice: 100, sma: 100, ema: -Infinity }).status).toBe("DADOS_INSUFICIENTES");
  });

  it("rejeita preço zero ou negativo (divisão por zero / preço impossível)", () => {
    expect(computeDecisionDistance({ lastPrice: 0, sma: 100, ema: 100 }).status).toBe("DADOS_INSUFICIENTES");
    expect(computeDecisionDistance({ lastPrice: -5, sma: 100, ema: 100 }).status).toBe("DADOS_INSUFICIENTES");
  });
});

describe("computeDecisionDistance — o lado já satisfeito tem distância ZERO", () => {
  it("em ALTA clara (preço acima da SMA, EMA acima da SMA) LONG está a 0%", () => {
    const r = computeDecisionDistance({ lastPrice: 110, sma: 100, ema: 105 });
    expect(r.status).toBe("OK");
    expect(r.current).toBe("LONG");
    expect(r.long!.gapPercent).toBe(0);
    expect(r.long!.binding).toBeNull();
    // E o outro lado está longe: preço precisa CAIR 10/110 = 9.0909…% e a EMA
    // precisa cair 5/110 = 4.5454…% — manda o maior (o preço).
    expect(r.short!.pricePercent).toBeCloseTo((10 / 110) * 100, 10);
    expect(r.short!.emaPercent).toBeCloseTo((5 / 110) * 100, 10);
    expect(r.short!.gapPercent).toBeCloseTo((10 / 110) * 100, 10);
    expect(r.short!.binding).toBe("price");
  });

  it("em BAIXA clara SHORT está a 0% e LONG carrega a distância", () => {
    const r = computeDecisionDistance({ lastPrice: 90, sma: 100, ema: 95 });
    expect(r.current).toBe("SHORT");
    expect(r.short!.gapPercent).toBe(0);
    expect(r.short!.binding).toBeNull();
    expect(r.long!.pricePercent).toBeCloseTo((10 / 90) * 100, 10);
    expect(r.long!.emaPercent).toBeCloseTo((5 / 90) * 100, 10);
    expect(r.long!.gapPercent).toBeCloseTo((10 / 90) * 100, 10);
  });
});

describe("computeDecisionDistance — o max manda, nunca a média", () => {
  it("uma condição satisfeita e a outra não NÃO zera a distância", () => {
    // Preço 101 > SMA 100 (condição de preço do LONG já vale ⇒ 0), mas a EMA
    // está 98, abaixo da SMA ⇒ LONG ainda não vale. A distância tem que ser a
    // da EMA, não 0 e não a média (que seria metade e mentiria "está perto").
    const r = computeDecisionDistance({ lastPrice: 101, sma: 100, ema: 98 });
    expect(r.current).toBe("NEUTRO");
    expect(r.long!.pricePercent).toBe(0);
    expect(r.long!.emaPercent).toBeCloseTo((2 / 101) * 100, 10);
    expect(r.long!.gapPercent).toBeCloseTo((2 / 101) * 100, 10);
    expect(r.long!.binding).toBe("ema");
  });

  it("quando o preço é o gargalo, binding é 'price'", () => {
    // Preço 99 < SMA 100 (falta 1 pra cima); EMA 100 já está em cima da SMA
    // (condição de média do LONG já vale, gap 0). Manda o preço.
    const r = computeDecisionDistance({ lastPrice: 99, sma: 100, ema: 100 });
    expect(r.long!.emaPercent).toBe(0);
    expect(r.long!.pricePercent).toBeCloseTo((1 / 99) * 100, 10);
    expect(r.long!.binding).toBe("price");
  });

  it("gapPercent é sempre o máximo das duas parcelas, nas duas direções", () => {
    const cases = [
      { lastPrice: 100, sma: 100.5, ema: 99 },
      { lastPrice: 250.25, sma: 249, ema: 251 },
      { lastPrice: 1, sma: 1.2, ema: 0.9 },
      { lastPrice: 68000, sma: 67900, ema: 68100 },
    ];
    for (const c of cases) {
      const r = computeDecisionDistance(c);
      expect(r.status).toBe("OK");
      expect(r.long!.gapPercent).toBe(Math.max(r.long!.pricePercent, r.long!.emaPercent));
      expect(r.short!.gapPercent).toBe(Math.max(r.short!.pricePercent, r.short!.emaPercent));
    }
  });

  it("nenhuma parcela é jamais negativa (condição satisfeita vira 0 exato)", () => {
    const cases = [
      { lastPrice: 110, sma: 100, ema: 105 },
      { lastPrice: 90, sma: 100, ema: 95 },
      { lastPrice: 100, sma: 100, ema: 100 },
      { lastPrice: 7.5, sma: 7.5, ema: 8 },
    ];
    for (const c of cases) {
      const r = computeDecisionDistance(c);
      for (const s of [r.long!, r.short!]) {
        expect(s.pricePercent).toBeGreaterThanOrEqual(0);
        expect(s.emaPercent).toBeGreaterThanOrEqual(0);
        expect(s.gapPercent).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("computeDecisionDistance — `current` reproduz trendBias() EXATAMENTE", () => {
  // Réplica literal de trendBias() (js/research/research-engine.js) só para o
  // teste: se o motor divergisse dela, a tela mostraria duas verdades
  // diferentes sobre a mesma decisão. Este é o teste que trava isso.
  const trendBiasReplica = (p: number, s: number, e: number): "LONG" | "SHORT" | "NEUTRO" => {
    if (p > s && e >= s) return "LONG";
    if (p < s && e <= s) return "SHORT";
    return "NEUTRO";
  };

  it("bate com a réplica em uma varredura densa dos 3 valores", () => {
    let checked = 0;
    for (let p = 96; p <= 104; p += 0.5) {
      for (let s = 96; s <= 104; s += 0.5) {
        for (let e = 96; e <= 104; e += 0.5) {
          const r = computeDecisionDistance({ lastPrice: p, sma: s, ema: e });
          expect(r.current).toBe(trendBiasReplica(p, s, e));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(4000); // a varredura rodou de verdade
  });

  it("preço exatamente na SMA não é LONG nem SHORT (nem > nem <)", () => {
    const r = computeDecisionDistance({ lastPrice: 100, sma: 100, ema: 100 });
    expect(r.current).toBe("NEUTRO");
    // Distância 0 nos dois lados é a leitura HONESTA aqui: as desigualdades
    // são estritas no preço, então está exatamente em cima da fronteira.
    expect(r.long!.gapPercent).toBe(0);
    expect(r.short!.gapPercent).toBe(0);
  });

  it("o lado com current satisfeito tem SEMPRE gap 0, nunca o contrário", () => {
    for (let p = 98; p <= 102; p += 0.25) {
      for (let s = 98; s <= 102; s += 0.25) {
        for (let e = 98; e <= 102; e += 0.25) {
          const r = computeDecisionDistance({ lastPrice: p, sma: s, ema: e });
          if (r.current === "LONG") expect(r.long!.gapPercent).toBe(0);
          if (r.current === "SHORT") expect(r.short!.gapPercent).toBe(0);
        }
      }
    }
  });
});

describe("formatDecisionDistance", () => {
  it("distância zero é '0%', nunca '0.00%'", () => {
    expect(formatDecisionDistance(0)).toBe("0%");
  });

  it("distância minúscula vira '<0.01%' e nunca um zero enganoso", () => {
    expect(formatDecisionDistance(0.004)).toBe("<0.01%");
    expect(formatDecisionDistance(0.0000001)).toBe("<0.01%");
    // A armadilha real: toFixed(2) de 0.004 daria "0.00%", indistinguível de
    // "já satisfeito".
    expect(formatDecisionDistance(0.004)).not.toBe("0.00%");
  });

  it("distância normal usa 2 casas", () => {
    expect(formatDecisionDistance(1.2345)).toBe("1.23%");
    expect(formatDecisionDistance(9.0909)).toBe("9.09%");
  });

  it("entrada inválida vira travessão, nunca um número inventado", () => {
    expect(formatDecisionDistance(null)).toBe("—");
    expect(formatDecisionDistance(undefined)).toBe("—");
    expect(formatDecisionDistance(NaN)).toBe("—");
  });
});

describe("describeDecisionDistance — honestidade do texto", () => {
  it("nunca usa vocabulário de probabilidade (Regra de Ouro 2)", () => {
    const readings = [
      computeDecisionDistance({ lastPrice: 110, sma: 100, ema: 105 }),
      computeDecisionDistance({ lastPrice: 101, sma: 100, ema: 98 }),
      computeDecisionDistance({ lastPrice: null, sma: 100, ema: 100 }),
    ];
    // A frase honesta do próprio motor CONTÉM a palavra ("...não
    // probabilidade..."), de propósito — é a negação explícita. O que não pode
    // existir é uma AFIRMAÇÃO probabilística; então a ressalva sai do texto
    // antes da varredura, e o que sobra tem que estar limpo.
    const proibido = /probabilidad|chance|% de acerto|vai subir|vai cair|previs/i;
    for (const r of readings) {
      for (const which of ["long", "short"] as const) {
        const texto = describeDecisionDistance(r, which);
        expect(texto.replace(/n[ãa]o probabilidade/gi, "")).not.toMatch(proibido);
      }
    }
  });

  it("diz explicitamente que é distância, não probabilidade", () => {
    const r = computeDecisionDistance({ lastPrice: 101, sma: 100, ema: 98 });
    expect(describeDecisionDistance(r, "long")).toMatch(/não probabilidade/i);
  });

  it("nomeia qual condição está travando", () => {
    const emaTravando = computeDecisionDistance({ lastPrice: 101, sma: 100, ema: 98 });
    expect(describeDecisionDistance(emaTravando, "long")).toMatch(/EMA precisa andar/i);
    const precoTravando = computeDecisionDistance({ lastPrice: 99, sma: 100, ema: 100 });
    expect(describeDecisionDistance(precoTravando, "long")).toMatch(/preço precisa andar/i);
  });

  it("lado satisfeito é descrito como satisfeito, não como '0% de distância'", () => {
    const r = computeDecisionDistance({ lastPrice: 110, sma: 100, ema: 105 });
    expect(describeDecisionDistance(r, "long")).toMatch(/já satisfeito/i);
  });

  it("sem dado real, avisa em vez de descrever uma distância", () => {
    const r = computeDecisionDistance({ lastPrice: null, sma: null, ema: null });
    expect(describeDecisionDistance(r, "long")).toMatch(/sem leitura real/i);
  });
});

describe("decision-distance — disciplina do módulo", () => {
  const src = readFileSync(resolve(__dirname, "../src/nexus/decision-distance.ts"), "utf8");

  it("é puro: zero rede, zero acesso a window/document, zero Math.random", () => {
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/\bwindow\./);
    expect(src).not.toMatch(/\bdocument\./);
  });

  it("documenta a limitação real (fronteira móvel) no próprio arquivo", () => {
    expect(src).toMatch(/limita[çc]/i);
    expect(src).toMatch(/fronteira anda|limiar se move/i);
  });
});

describe("distância em ATR — a escala de volatilidade real", () => {
  it("converte a distância para múltiplos do ATR real", () => {
    // Preço 100, SMA 101 ⇒ falta 1/100 = 1% pra LONG. Com ATR 2%, isso é
    // meia vela típica: 0.5× ATR. Conta verificável à mão.
    const r = computeDecisionDistance({ lastPrice: 100, sma: 101, ema: 101, atrPercent: 2 });
    expect(r.long!.gapPercent).toBeCloseTo(1, 10);
    expect(r.long!.atrUnits).toBeCloseTo(0.5, 10);
  });

  it("o MESMO percentual vale coisas diferentes em regimes diferentes", () => {
    // Este é o ponto inteiro da métrica: 1% de distância é quase nada num
    // mercado que anda 3% por vela, e muito num que anda 0.2%.
    const calmo = computeDecisionDistance({ lastPrice: 100, sma: 101, ema: 101, atrPercent: 0.2 });
    const agitado = computeDecisionDistance({ lastPrice: 100, sma: 101, ema: 101, atrPercent: 3 });
    expect(calmo.long!.gapPercent).toBeCloseTo(agitado.long!.gapPercent, 10); // mesmo %
    expect(calmo.long!.atrUnits).toBeCloseTo(5, 10); // 5 velas típicas — longe
    expect(agitado.long!.atrUnits).toBeCloseTo(1 / 3, 10); // um terço de vela — perto
    expect(calmo.long!.atrUnits!).toBeGreaterThan(agitado.long!.atrUnits!);
  });

  it("lado já satisfeito tem 0 em ATR também (nunca um resíduo)", () => {
    const r = computeDecisionDistance({ lastPrice: 110, sma: 100, ema: 105, atrPercent: 2 });
    expect(r.long!.gapPercent).toBe(0);
    expect(r.long!.atrUnits).toBe(0);
  });

  it("fail-closed: sem ATR real, a leitura em ATR não existe (nunca é estimada)", () => {
    const semAtr = computeDecisionDistance({ lastPrice: 100, sma: 101, ema: 101 });
    expect(semAtr.status).toBe("OK"); // o percentual continua real
    expect(semAtr.long!.atrUnits).toBeNull();
    expect(semAtr.short!.atrUnits).toBeNull();
  });

  it("ATR zero ou negativo devolve null, nunca Infinity", () => {
    // A armadilha real: 1 / 0 = Infinity, que a UI mostraria como um número
    // gigante e falso em vez de "não sei".
    for (const atrPercent of [0, -1, NaN, Infinity]) {
      const r = computeDecisionDistance({ lastPrice: 100, sma: 101, ema: 101, atrPercent });
      expect(r.long!.atrUnits, String(atrPercent)).toBeNull();
    }
  });

  it("formatAtrUnits nunca confunde 'quase zero' com 'já satisfeito'", () => {
    expect(formatAtrUnits(0)).toBe("0×");
    expect(formatAtrUnits(0.01)).toBe("<0.05×");
    expect(formatAtrUnits(0.01)).not.toBe("0.00× ATR");
    expect(formatAtrUnits(0.5)).toBe("0.50× ATR");
    expect(formatAtrUnits(null)).toBe("—");
    expect(formatAtrUnits(NaN)).toBe("—");
  });

  it("a frase honesta menciona a volatilidade só quando ela é real", () => {
    const comAtr = computeDecisionDistance({ lastPrice: 100, sma: 101, ema: 101, atrPercent: 2 });
    const semAtr = computeDecisionDistance({ lastPrice: 100, sma: 101, ema: 101 });
    expect(describeDecisionDistance(comAtr, "long")).toMatch(/ATR de Wilder 14/);
    expect(describeDecisionDistance(semAtr, "long")).not.toMatch(/ATR/);
  });
});
