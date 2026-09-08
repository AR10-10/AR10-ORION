// level-touch-window.test.ts — §4 da ordem "NÚCLEO + POSICIONAMENTO
// INTELIGENTE": "as linhas não devem atravessar o gráfico inteiro —
// limitar a 2-3 toques relevantes".
//
// Execução real: a pergunta aqui é "os índices escolhidos estão certos?"
// (quais toques, em que ordem, quantos ficam de fora), nunca "esqueceram
// de ligar A com B".
import { describe, it, expect } from "vitest";
import {
  resolveLevelTouchWindow,
  LEVEL_MAX_RELEVANT_TOUCHES,
} from "../src/chart/level-touch-window";

describe("a janela vem da especificação do Operador, não de um número inventado", () => {
  it("LEVEL_MAX_RELEVANT_TOUCHES é o limite superior do '2-3 toques' pedido", () => {
    expect(LEVEL_MAX_RELEVANT_TOUCHES).toBe(3);
  });
});

describe("caso comum: poucos toques cabem inteiros", () => {
  it("2 toques → janela cobre exatamente os 2, nada omitido", () => {
    const w = resolveLevelTouchWindow([40, 12]);
    expect(w).toEqual({
      firstIndex: 12,
      lastIndex: 40,
      touchesShown: 2,
      touchesTotal: 2,
      omittedOlder: 0,
    });
  });

  it("1 toque só ainda é uma janela real (traço curto, nunca largura total)", () => {
    const w = resolveLevelTouchWindow([77]);
    expect(w?.firstIndex).toBe(77);
    expect(w?.lastIndex).toBe(77);
    expect(w?.touchesShown).toBe(1);
    expect(w?.omittedOlder).toBe(0);
  });

  it("exatamente 3 toques → todos entram, nada omitido", () => {
    const w = resolveLevelTouchWindow([5, 30, 90]);
    expect(w?.firstIndex).toBe(5);
    expect(w?.lastIndex).toBe(90);
    expect(w?.omittedOlder).toBe(0);
  });
});

describe("§4: o defeito real — o traço nascia em x=0 e cruzava tudo", () => {
  it("com 6 toques, a janela começa no 4º MAIS RECENTE, não no primeiro da amostra", () => {
    // Amostra realista de S1: o motor conta 6 swings na banda, espalhados
    // por toda a janela. Sem esta função, primeiro×último = 3..240 =
    // praticamente o gráfico inteiro.
    const w = resolveLevelTouchWindow([3, 18, 60, 155, 198, 240]);
    expect(w?.firstIndex).toBe(155); // os 3 mais recentes: 155, 198, 240
    expect(w?.lastIndex).toBe(240);
    expect(w?.touchesShown).toBe(3);
    expect(w?.touchesTotal).toBe(6);
    expect(w?.omittedOlder).toBe(3);
    // A prova do §4: o traço encolheu de 237 candles para 85.
    expect(w!.lastIndex - w!.firstIndex).toBeLessThan(240 - 3);
  });

  it("a ordem de entrada nunca importa — o motor não garante ordenação", () => {
    const ordenado = resolveLevelTouchWindow([3, 18, 60, 155, 198, 240]);
    const bagunçado = resolveLevelTouchWindow([240, 3, 155, 60, 240 - 42, 18]);
    // (240-42 = 198, o mesmo conjunto embaralhado)
    expect(bagunçado).toEqual(ordenado);
  });

  it("nunca escolhe os mais antigos por engano (regressão do erro clássico de slice)", () => {
    const w = resolveLevelTouchWindow([0, 1, 2, 500]);
    expect(w?.lastIndex).toBe(500);
    expect(w?.firstIndex).toBe(1); // 1, 2, 500 — o 0 fica de fora
    expect(w?.omittedOlder).toBe(1);
  });
});

describe("Regra de Ouro 4: o toque antigo é omitido do TRAÇO, nunca apagado do sistema", () => {
  it("touchesTotal continua contando a evidência inteira", () => {
    const w = resolveLevelTouchWindow([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(w?.touchesTotal).toBe(10);
    expect(w?.touchesShown).toBe(3);
    // Quem lê a decisão consegue dizer "×10, 7 fora da janela" — a
    // informação não some, ela só deixa de puxar o traço para trás.
    expect(w!.touchesShown + w!.omittedOlder).toBe(w!.touchesTotal);
  });
});

describe("dedupe: dois swings no MESMO candle são um ponto de partida só", () => {
  it("índices repetidos não consomem a janela nem inflam a contagem", () => {
    const w = resolveLevelTouchWindow([10, 10, 10, 50, 90]);
    expect(w?.touchesTotal).toBe(3);
    expect(w?.firstIndex).toBe(10);
    expect(w?.lastIndex).toBe(90);
    expect(w?.omittedOlder).toBe(0);
  });

  it("sem dedupe o traço encolheria por engano — prova do contrário", () => {
    // Se as repetições contassem, os '3 mais recentes' seriam 90,90,90 e
    // o traço viraria um ponto. Este teste trava esse defeito.
    const w = resolveLevelTouchWindow([10, 50, 90, 90, 90]);
    expect(w?.firstIndex).toBe(10);
    expect(w?.lastIndex).toBe(90);
  });
});

describe("fail-closed (Regra de Ouro 3): sem índice real, nada é inventado", () => {
  it("null/undefined/não-array → null (chamador mantém o desenho de hoje)", () => {
    expect(resolveLevelTouchWindow(null)).toBeNull();
    expect(resolveLevelTouchWindow(undefined)).toBeNull();
    expect(resolveLevelTouchWindow([])).toBeNull();
  });

  it("índices inválidos são descartados, nunca viram NaN na janela", () => {
    const w = resolveLevelTouchWindow([Number.NaN, -1, 1.5, Infinity, 42]);
    expect(w?.firstIndex).toBe(42);
    expect(w?.lastIndex).toBe(42);
    expect(w?.touchesTotal).toBe(1);
  });

  it("array só com lixo → null, nunca um trecho fabricado", () => {
    expect(resolveLevelTouchWindow([Number.NaN, -3, 2.7])).toBeNull();
  });

  it("índice 0 é VÁLIDO (primeiro candle da amostra), nunca confundido com ausência", () => {
    const w = resolveLevelTouchWindow([0]);
    expect(w).not.toBeNull();
    expect(w?.firstIndex).toBe(0);
  });
});

describe("pureza e determinismo", () => {
  it("mesma entrada → mesma saída, sempre", () => {
    const idx = [7, 19, 33, 88];
    expect(resolveLevelTouchWindow(idx)).toEqual(resolveLevelTouchWindow(idx));
  });

  it("não muta a entrada (o motor reusa esse array)", () => {
    const idx = [90, 10, 50, 30];
    const copia = [...idx];
    resolveLevelTouchWindow(idx);
    expect(idx).toEqual(copia);
  });

  it("firstIndex nunca passa de lastIndex — invariante do traço", () => {
    for (const caso of [[1], [9, 2], [5, 5, 5], [100, 1, 50, 7, 88, 3]]) {
      const w = resolveLevelTouchWindow(caso);
      expect(w!.firstIndex).toBeLessThanOrEqual(w!.lastIndex);
    }
  });
});

describe("LEI 24: geometria de apresentação, nunca decisão", () => {
  it("a janela não expõe direção, score nem probabilidade", () => {
    const chaves = Object.keys(resolveLevelTouchWindow([1, 2, 3])!);
    for (const proibida of ["direction", "stance", "score", "confidence", "probability"]) {
      expect(chaves).not.toContain(proibida);
    }
  });
});
