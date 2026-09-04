// Suíte da TRAVA DE PROVENIÊNCIA do executor de backtest
// (tools/run-backtest.mjs).
//
// Esta é a parte do executor que mais precisa de teste, porque é a única
// coisa entre o projeto e um número fabricado. A auditoria registrou que
// nenhum motor deste repositório jamais foi medido contra mercado real, e
// que o único arquivo de dados presente se declara sintético. Um número
// saído dali viraria argumento de venda — a trava existe para tornar isso
// impossível, e estes testes existem para provar que ela não afrouxa.
//
// O teste mais importante do arquivo é o último: ele carrega o
// btcusdt_replay.json REAL do repositório e exige que a trava o recuse.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertRealProvenance } from "../../tools/run-backtest.mjs";

/** Exige recusa e devolve o motivo. Existe porque `expect(out.ok).toBe(false)`
 *  não estreita a união para o TypeScript — sem isto, ler `out.reason` é
 *  erro de tipo, e o teste perderia justamente a asserção que importa. */
const recusa = (payload: unknown): string => {
  // O tipo vem por JSDoc de um .mjs, e a união não discrimina do lado do
  // TypeScript — daí o shape explícito aqui em vez de um narrowing que não
  // acontece. O comportamento verificado é o mesmo.
  const out = assertRealProvenance(payload) as { ok: boolean; reason?: string };
  if (out.ok) throw new Error("esperava recusa da trava, veio aceite");
  return out.reason ?? "";
};

/** Captura real mínima que DEVE passar: páginas com fonte, candles, e
 *  nenhuma declaração de dado fabricado. */
const capturaReal = () => ({
  formatVersion: 1,
  symbol: "BTCUSDT",
  timeframe: "15m",
  candleCount: 2,
  candles: [
    { t: 1_700_000_000, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 },
    { t: 1_700_000_900, o: 1.5, h: 2.5, l: 1, c: 2, v: 12 },
  ],
  pages: [
    { pageIndex: 0, fetchedAt: "2026-08-18T00:00:00Z", rawSampleHash: "abc123", sourceId: "binance_futures", candleCount: 2 },
  ],
  pageCount: 1,
  contiguous: true,
  gaps: [],
  succeeded: true,
});

describe("trava de proveniência — o que ela ACEITA", () => {
  it("captura real com páginas, fonte e candles passa", () => {
    expect(assertRealProvenance(capturaReal())).toEqual({ ok: true });
  });
});

describe("trava de proveniência — o que ela RECUSA", () => {
  it("payload ausente ou não-objeto", () => {
    expect(assertRealProvenance(null).ok).toBe(false);
    expect(assertRealProvenance(undefined).ok).toBe(false);
    expect(assertRealProvenance("BTCUSDT").ok).toBe(false);
  });

  it("kind declarado como sintético, em qualquer variação", () => {
    for (const kind of [
      "SYNTHETIC_OFFLINE_SAMPLE",
      "synthetic",
      "MOCK_DATA",
      "fake-series",
      "GENERATED_SERIES",
      "demo",
    ]) {
      expect(recusa({ ...capturaReal(), kind }), `kind "${kind}" deveria ser recusado`).toContain("sintetico");
    }
  });

  it("payload que admite não ter conexão real com exchange", () => {
    expect(assertRealProvenance({ ...capturaReal(), live: false }).ok).toBe(false);
    expect(assertRealProvenance({ ...capturaReal(), exchange_connection: "NONE" }).ok).toBe(false);
  });

  it("sem páginas de proveniência — não dá para auditar o número depois", () => {
    expect(assertRealProvenance({ ...capturaReal(), pages: [] }).ok).toBe(false);
    expect(assertRealProvenance({ ...capturaReal(), pages: undefined }).ok).toBe(false);
  });

  it("página sem sourceId derruba a captura inteira, não só aquela página", () => {
    const meio = capturaReal();
    expect(recusa({
      ...meio,
      pages: [...meio.pages, { pageIndex: 1, sourceId: null, candleCount: 2 }],
    })).toContain("source_id");
  });

  it("sem candles não existe amostra", () => {
    expect(assertRealProvenance({ ...capturaReal(), candles: [] }).ok).toBe(false);
  });
});

describe("trava de proveniência — o caso real que motivou tudo", () => {
  it("RECUSA o data/btcusdt_replay.json que existe neste repositório", () => {
    const path = resolve(__dirname, "../../data/btcusdt_replay.json");
    const payload = JSON.parse(readFileSync(path, "utf-8"));

    // Primeiro: o arquivo é mesmo o que a auditoria disse que era.
    expect(payload.kind).toBe("SYNTHETIC_OFFLINE_SAMPLE");
    expect(payload.live).toBe(false);
    expect(payload.exchange_connection).toBe("NONE");
    expect(payload.candles.length).toBeGreaterThan(0); // tem dado — e é justamente por isso que a trava importa

    // Depois: a trava o recusa.
    expect(recusa(payload)).toContain("sintetico");
  });
});

// ---------------------------------------------------------------------------
// O EXECUTOR PRECISA RODAR NO NODE — e não rodava.
//
// DEFEITO REAL, encontrado executando a ferramenta em vez de lê-la: a captura
// abortava com `self is not defined` na página 0, ANTES de qualquer chamada
// de rede. `self` existe em browser e Web Worker, nunca no Node. Como o
// sandbox deste projeto não tem egress, a falha vinha sendo lida como "sem
// internet" — mas o executor estava quebrado para TODO MUNDO, inclusive numa
// máquina com rede, que é exatamente o único lugar onde ele serve para algo.
//
// A cadeia abaixo é o que `run-backtest.mjs` carrega. Qualquer global só de
// browser nela derruba a única ferramenta capaz de produzir um número real.
// ---------------------------------------------------------------------------
describe("a cadeia do executor de backtest roda em Node puro", () => {
  const CADEIA = [
    "../../tools/run-backtest.mjs",
    "../../src/research/backtest/history-capture.js",
    "../../src/research/backtest/structural-backtest.js",
    "../../src/market-data-bus/binance-futures-candle-connector.js",
    "../../js/real-data/probe.js",
    "../../js/real-data/binance-futures-public.js",
  ];

  /** Remove comentários antes de procurar o global: `self` e `window`
   *  aparecem legitimamente em texto explicativo (inclusive no comentário
   *  que documenta esta própria correção). Sexta ocorrência nesta trilha da
   *  mesma armadilha — afirmar uma string que também casa com comentário. */
  const semComentarios = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("nenhum módulo da cadeia usa global exclusivo de browser", () => {
    for (const rel of CADEIA) {
      const src = semComentarios(readFileSync(resolve(__dirname, rel), "utf8"));
      // `self` como identificador solto, nunca `.self` nem `self_algo`.
      expect(src, `${rel} usa 'self'`).not.toMatch(/(^|[^.\w])self\s*[.)\[]/);
      expect(src, `${rel} usa 'window'`).not.toMatch(/(^|[^.\w])window\s*[.)\[]/);
      expect(src, `${rel} usa 'document'`).not.toMatch(/(^|[^.\w])document\s*[.)\[]/);
      expect(src, `${rel} usa 'localStorage'`).not.toMatch(/(^|[^.\w])localStorage\s*[.)\[]/);
    }
  });

  it("a varredura está mesmo olhando arquivos reais (não passa por vacuidade)", () => {
    for (const rel of CADEIA) {
      const src = readFileSync(resolve(__dirname, rel), "utf8");
      expect(src.length, `${rel} vazio`).toBeGreaterThan(500);
    }
  });

  it("a detecção de AbortController é agnóstica de runtime", () => {
    const probe = readFileSync(resolve(__dirname, "../../js/real-data/probe.js"), "utf8");
    // Forma executável: a checagem real, nunca a palavra solta.
    expect(probe).toContain("typeof AbortController === 'function'");
    expect(probe).not.toMatch(/'AbortController'\s+in\s+self/);
  });

  it("a cadeia inteira IMPORTA de verdade no Node — a prova final", async () => {
    // Um import real derruba qualquer global de browser no topo do módulo,
    // que é a forma como este defeito apareceu. Nenhuma regex substitui isto.
    for (const rel of CADEIA) {
      await expect(import(resolve(__dirname, rel)), `${rel} não importa em Node`).resolves.toBeDefined();
    }
  });
});
