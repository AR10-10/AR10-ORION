// synthetic-tick-boundary.test.ts — A FRONTEIRA QUE FALTAVA.
//
// ACHADO DESTA VARREDURA (caça pedida pelo Operador: "ver o que tá
// faltando"). Uma sonda por exports sem consumidor de produção encontrou
// `src/orderflow/candle-tick-synthesizer.js` — o ÚNICO módulo do
// repositório que FABRICA dado de mercado (deriva ticks com lado BUY/SELL a
// partir de candles agregados).
//
// O módulo em si é exemplar em honestidade: `status: 'SYNTHETIC_DERIVED'`,
// cabeçalho dizendo com todas as letras "isto NÃO é uma fita de negociação
// real", limitações medidas (inclusive a matemática: o desequilíbrio
// agregado fica estruturalmente abaixo do que um stream real produziria), e
// a regra escrita — "deve ser usado apenas em DataState.REPLAY; nunca
// rotulado como LIVE na UI".
//
// O PROBLEMA NÃO É O MÓDULO — É QUE ESSA REGRA SÓ EXISTIA EM COMENTÁRIO.
//
// Este repositório JÁ tem o padrão certo para isso, aplicado a outros
// módulos de laboratório: `history-capture.test.ts` varre a árvore de
// produção provando que nenhum módulo importa a Fase 2 do backtest, e
// `hmm-regime-model.test.ts` faz o mesmo para o motor HMM dormente. O
// sintetizador de ticks — justamente o mais perigoso dos três, porque
// fabrica DADO DE MERCADO e a Regra de Ouro 1 é "zero mocks, zero dado
// sintético no fluxo de mercado real" — era o único SEM guarda.
//
// Uma regra documentada e não imposta é a que quebra em silêncio: nada
// impede uma sessão futura de importar isto no caminho ao vivo, e o sintoma
// (números de order flow que parecem reais e não são) não apontaria para cá.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, relative } from "node:path";

const RAIZ = resolve(__dirname, "../..");
const SINTETIZADOR = resolve(RAIZ, "src/orderflow/candle-tick-synthesizer.js");

/** Caminhos que compõem o app AO VIVO. Nenhum deles pode alcançar o
 *  sintetizador. `src/orderflow/` fica de fora porque é onde o próprio
 *  módulo mora (o motor de order flow pode consumi-lo num harness de
 *  replay); `src/research/` fica de fora porque é o Laboratório. */
const CAMINHOS_AO_VIVO = [
  resolve(RAIZ, "ramber-ui/src"), // a aplicação inteira
  resolve(RAIZ, "js/real-data"), // conectores de mercado REAL
  resolve(RAIZ, "js/research"), // o motor que decide LONG/SHORT
  resolve(RAIZ, "src/market-data-bus"), // a fonte canônica por símbolo
];

function varrer(dir: string, aoAchar: (caminho: string, src: string) => void) {
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // caminho ausente nunca derruba a guarda
  }
  for (const e of entradas) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      varrer(p, aoAchar);
    } else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) {
      aoAchar(p, readFileSync(p, "utf8"));
    }
  }
}

describe("FRONTEIRA (Regra de Ouro 1): dado sintético nunca alcança o fluxo ao vivo", () => {
  it("NENHUM módulo do caminho ao vivo importa o sintetizador de ticks", () => {
    const infratores: string[] = [];
    for (const raiz of CAMINHOS_AO_VIVO) {
      varrer(raiz, (p, src) => {
        // Forma EXECUTÁVEL (import/require real), NUNCA a string solta.
        // A primeira versão desta guarda casou com `mexc-trades-stream.js`,
        // que só CITA o sintetizador num comentário — e a citação é
        // legítima e informativa: aquele conector é a fita de trades REAIS
        // que o cabeçalho do sintetizador dizia faltar. Mencionar é
        // documentação; IMPORTAR é a violação.
        const importa =
          /(?:import|from)\s+["'][^"']*candle-tick-synthesizer/.test(src) ||
          /require\(\s*["'][^"']*candle-tick-synthesizer/.test(src) ||
          /\bsynthesizeTicksFromCandles\s*\(/.test(src);
        if (importa) infratores.push(relative(RAIZ, p));
      });
    }
    expect(infratores, "dado sintético alcançou o caminho ao vivo").toEqual([]);
  });

  it("a varredura está mesmo olhando para arquivos reais (a guarda não é vazia por acidente)", () => {
    // Uma guarda que varre uma pasta inexistente passa sempre e não guarda
    // nada. Este teste prova que os caminhos existem e têm conteúdo.
    let vistos = 0;
    for (const raiz of CAMINHOS_AO_VIVO) varrer(raiz, () => { vistos++; });
    expect(vistos, "a varredura não encontrou arquivo nenhum").toBeGreaterThan(50);
  });
});

describe("o tick sintético é sempre RASTREÁVEL como sintético", () => {
  const src = () => readFileSync(SINTETIZADOR, "utf8");

  it("o rótulo padrão de exchange marca a origem — nunca o nome de uma corretora real", () => {
    // Se este default virasse "BINANCE" ou "MEXC", os ticks fabricados
    // ficariam indistinguíveis dos reais para TODO consumidor a jusante.
    // É a única coisa que separa os dois no dado em si.
    expect(src()).toContain("const exchange = opts.exchange || 'REPLAY_SYNTHETIC';");
  });

  it("o status declarado continua dizendo que é derivado, não observado", () => {
    expect(src()).toContain("status: 'SYNTHETIC_DERIVED'");
  });

  it("as limitações reais continuam escritas — inclusive a regra de uso", () => {
    const s = src();
    expect(s).toContain("Nao e trade tape real");
    expect(s).toContain("DataState.REPLAY");
    // A limitação MEDIDA (o desequilíbrio estruturalmente abaixo do real) é
    // o que impede alguém de ler "0 sinais no replay" como bug de fiação.
    expect(s).toContain("estruturalmente abaixo");
  });
});

describe("higiene do próprio sintetizador", () => {
  it("é determinístico: zero Math.random, zero rede", () => {
    // Mesma higiene já exigida de history-capture.js. Um sintetizador com
    // aleatoriedade produziria uma fita diferente a cada execução, e
    // nenhum replay seria reproduzível.
    const s = readFileSync(SINTETIZADOR, "utf8");
    expect(s).not.toMatch(/Math\.random/);
    expect(s).not.toMatch(/\bfetch\(|WebSocket/);
  });

  it("o caminho dentro da vela respeita a direção real do candle", () => {
    // open→low→high→close num candle de alta, o espelho num de baixa. É a
    // convenção declarada no cabeçalho; trocá-la mudaria o lado inferido de
    // cada perna e, com ele, todo o desequilíbrio derivado.
    expect(readFileSync(SINTETIZADOR, "utf8")).toContain("return c >= o ? [o, l, h, c] : [o, h, l, c];");
  });
});

describe("os outros módulos de laboratório continuam cercados", () => {
  // Esta guarda não substitui as que já existiam — confirma que a família
  // inteira continua fechada, para o padrão não se perder.
  it("o guarda da Fase 2 do backtest continua existindo", () => {
    expect(readFileSync(resolve(__dirname, "history-capture.test.ts"), "utf8")).toContain(
      "só o worker de backtest autorizado importa a Fase 2",
    );
  });

  it("o guarda do motor HMM dormente continua existindo", () => {
    expect(readFileSync(resolve(__dirname, "hmm-regime-model.test.ts"), "utf8")).toContain(
      "nenhum módulo de produção importa ainda",
    );
  });
});
