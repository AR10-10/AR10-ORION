// Suíte de EXECUÇÃO REAL do motor institutional-blocks.js (Breaker /
// Mitigation Block). Convenção do projeto: matemática de fronteira ganha
// execução real; fiação entre módulos ganha teste de padrão no fonte. Aqui
// o bug mais provável é "a regra está sutilmente errada" — então tudo
// abaixo executa o motor de verdade sobre candles construídos à mão.
//
// POR QUE FIXTURES EXPLÍCITOS E NÃO GERADOS: a confirmação de swing
// fractal em fractal-swings.js é ESTRITA (`cmp >= v` derruba a
// confirmação). Séries geradas por rampa/senóide produzem empates exatos
// ou monotonicidade, e nesses casos o motor corretamente não vê swing
// nenhum — o teste passaria sem nunca exercitar a regra. Cada série abaixo
// tem o pico cravado à mão e verificado.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  analyze,
  metadata,
  BLOCK_SCAN_WINDOW,
  lastConfirmedSwing,
  findFailureIndex,
  detectSweep,
  // Motor .js puro consumido direto pelo teste — sem @ts-expect-error:
  // os motores deste projeto são tipados por JSDoc, então o import
  // resolve limpo e a diretiva viraria erro TS2578 por não ter nada
  // para suprimir.
} from "../../src/research/engines/institutional-blocks.js";
import {
  FRACTAL_K,
  findSwings,
} from "../../src/research/engines/fractal-swings.js";

type Candle = { o: number; h: number; l: number; c: number };
const c = (o: number, h: number, l: number, cl: number): Candle => ({ o, h, l, c: cl });

// ---------------------------------------------------------------------------
// Base comum das séries: um swing high REAL cravado no índice 2 (h=110),
// seguido de uma descida que produz um Order Block de ALTA no índice 7
// (vela de baixa 101→99.5, seguida de vela que fecha em 105, acima do
// high 101.5 dela — deslocamento real).
// ---------------------------------------------------------------------------
const BASE: Candle[] = [
  c(99, 100, 98, 99.5), //  0
  c(99.5, 101, 99, 100.5), //  1
  c(100.5, 110, 100, 104), //  2  ← swing high real em 110
  c(104, 104.5, 102, 103), //  3
  c(103, 103.2, 101.5, 102), //  4
  c(102, 102.5, 100.5, 101), //  5
  c(101, 101.2, 100, 100.5), //  6
  c(101, 101.5, 99, 99.5), //  7  ← Order Block de ALTA: top 101.5 / bottom 99
  c(99.5, 106, 99.4, 105), //  8  ← deslocamento (close 105 > 101.5)
];

/** Varreu a liquidez de 110 antes de quebrar → BREAKER. */
const breakerSeries: Candle[] = [
  ...BASE,
  c(105, 112, 104, 111), //  9  ← máxima 112 > swing high 110 = varredura
  c(111, 111.5, 95, 96), // 10  ← FECHA em 96, abaixo do bottom 99 = falha
  c(96, 100.5, 95.5, 100), // 11  ← volta para dentro da zona = reteste
];

/** Mesma falha, SEM varrer os 110 antes → MITIGATION. */
const mitigationSeries: Candle[] = [
  ...BASE,
  c(105, 108, 104, 107), //  9  ← máxima 108 < 110: nenhuma liquidez varrida
  c(107, 107.5, 95, 96), // 10  ← mesma falha por fechamento
  c(96, 100.5, 95.5, 100), // 11
];

/** O bloco nunca falha — preço só continua subindo. */
const survivingSeries: Candle[] = [
  ...BASE,
  c(105, 112, 104, 111), //  9
  c(111, 113, 108, 112), // 10
  c(112, 114, 111, 113), // 11
];

/** O pavio atravessa o bloco mas o FECHAMENTO não — não é falha. */
const wickOnlySeries: Candle[] = [
  ...BASE,
  c(105, 112, 104, 111), //  9
  c(111, 111.5, 95, 100), // 10  ← pavio até 95 (abaixo de 99), fecha em 100
  c(100, 101, 98, 99.5), // 11  ← pavio até 98, fecha em 99.5
];

describe("institutional-blocks — contrato do motor", () => {
  it("declara metadata honesta e read-only", () => {
    expect(metadata.engine).toBe("institutional-blocks");
    expect(metadata.status).toBe("ACTIVE_READ_ONLY");
    expect(metadata.required_data).toContain("ohlcv_series");
    expect(metadata.limitations.length).toBeGreaterThan(0);
  });

  it("BLOCK_SCAN_WINDOW é uma janela finita e real", () => {
    expect(Number.isFinite(BLOCK_SCAN_WINDOW)).toBe(true);
    expect(BLOCK_SCAN_WINDOW).toBeGreaterThan(0);
  });
});

describe("institutional-blocks — fail-closed", () => {
  it("sem entrada nenhuma devolve DADOS_INSUFICIENTES, nunca lista vazia disfarçada de OK", () => {
    const out = analyze();
    expect(out.status).toBe("DADOS_INSUFICIENTES");
    expect(out.blocks).toBeUndefined();
  });

  it("com candles abaixo do mínimo devolve DADOS_INSUFICIENTES com a razão real", () => {
    const out = analyze({ ohlcv_series: BASE });
    expect(out.status).toBe("DADOS_INSUFICIENTES");
    expect(out.reason).toContain(String(BASE.length));
  });

  it("entrada não-array não quebra e cai em DADOS_INSUFICIENTES", () => {
    // O cast é deliberado: o contrato JSDoc já proíbe isto em tempo de
    // tipo, e o teste existe justamente para provar que o motor também se
    // defende em tempo de execução — que é de onde vem dado real.
    const garbage = (v: unknown) => analyze({ ohlcv_series: v as Array<object> });
    expect(garbage(null).status).toBe("DADOS_INSUFICIENTES");
    expect(garbage("BTCUSDT").status).toBe("DADOS_INSUFICIENTES");
    expect(garbage({ length: 99 }).status).toBe("DADOS_INSUFICIENTES");
  });
});

describe("institutional-blocks — a distinção real Breaker vs Mitigation", () => {
  it("varredura de liquidez ANTES da falha ⇒ BREAKER, com polaridade INVERTIDA", () => {
    const out = analyze({ ohlcv_series: breakerSeries });
    expect(out.status).toBe("OK");
    expect(out.blocks).toHaveLength(1);

    const b = out.blocks[0];
    expect(b.kind).toBe("BREAKER");
    expect(b.originType).toBe("BULLISH");
    // O ponto inteiro do conceito: um OB de alta que quebra vira OFERTA.
    expect(b.direction).toBe("BAIXA");
    expect(b.index).toBe(7);
    expect(b.failIndex).toBe(10);
    expect(b.top).toBe(101.5);
    expect(b.bottom).toBe(99);
    expect(b.sweptLevel).toBe(110);
    expect(b.sweepIndex).toBe(9);
    expect(out.breaker_count).toBe(1);
    expect(out.mitigation_count).toBe(0);
  });

  it("MESMA falha sem varredura antes ⇒ MITIGATION, com polaridade PRESERVADA", () => {
    const out = analyze({ ohlcv_series: mitigationSeries });
    expect(out.status).toBe("OK");
    expect(out.blocks).toHaveLength(1);

    const b = out.blocks[0];
    expect(b.kind).toBe("MITIGATION");
    expect(b.originType).toBe("BULLISH");
    // Mitigation NÃO inverte — segue sendo demanda não preenchida.
    expect(b.direction).toBe("ALTA");
    expect(b.failIndex).toBe(10);
    expect(b.sweptLevel).toBeNull();
    expect(b.sweepIndex).toBeNull();
    expect(out.mitigation_count).toBe(1);
    expect(out.breaker_count).toBe(0);
  });

  it("as duas séries diferem SÓ na máxima da vela 9 — a classificação vem daí e de mais nada", () => {
    // Blindagem contra a mutação mais provável: alguém "simplificar" o
    // motor e classificar por qualquer outra coisa que não a varredura.
    const diff = breakerSeries
      .map((cd, i) => (JSON.stringify(cd) === JSON.stringify(mitigationSeries[i]) ? null : i))
      .filter((i): i is number => i !== null);
    expect(diff).toEqual([9, 10]); // 10 muda só o open (consequência de 9)
    expect(breakerSeries[9].h).toBeGreaterThan(110);
    expect(mitigationSeries[9].h).toBeLessThan(110);

    expect(analyze({ ohlcv_series: breakerSeries }).blocks[0].kind).toBe("BREAKER");
    expect(analyze({ ohlcv_series: mitigationSeries }).blocks[0].kind).toBe("MITIGATION");
  });
});

describe("institutional-blocks — o que NÃO é um bloco", () => {
  it("Order Block que nunca falhou não vira Breaker nem Mitigation", () => {
    const out = analyze({ ohlcv_series: survivingSeries });
    expect(out.status).toBe("OK");
    expect(out.blocks).toHaveLength(0);
    expect(out.breaker_count).toBe(0);
    expect(out.mitigation_count).toBe(0);
  });

  it("pavio atravessando a zona NÃO é falha — só fechamento conta", () => {
    // A mínima 95 da vela 10 fura o bottom 99 do bloco; o fechamento 100
    // não. Se alguém trocar `close` por `low` em findFailureIndex, este
    // teste passa a acusar um bloco que não existe.
    expect(wickOnlySeries[10].l).toBeLessThan(99);
    expect(wickOnlySeries[10].c).toBeGreaterThan(99);

    const out = analyze({ ohlcv_series: wickOnlySeries });
    expect(out.status).toBe("OK");
    expect(out.blocks).toHaveLength(0);
  });
});

describe("institutional-blocks — reteste real da zona", () => {
  it("marca retested quando o preço volta para dentro do bloco depois da falha", () => {
    const out = analyze({ ohlcv_series: breakerSeries });
    expect(out.blocks[0].retested).toBe(true);
    expect(out.untested_count).toBe(0);
  });

  it("não marca retested quando o preço nunca voltou", () => {
    // Mesma falha, mas o preço despenca e some — nunca reencosta em [99, 101.5].
    const noRetest: Candle[] = [
      ...BASE,
      c(105, 112, 104, 111),
      c(111, 111.5, 95, 96),
      c(96, 97, 90, 91), // some para baixo, nunca reencosta na zona
    ];
    const out = analyze({ ohlcv_series: noRetest });
    expect(out.blocks[0].kind).toBe("BREAKER");
    expect(out.blocks[0].retested).toBe(false);
    expect(out.untested_count).toBe(1);
  });
});

describe("lastConfirmedSwing — causalidade, o detalhe que quase todo indicador erra", () => {
  const swings = [
    { index: 2, price: 110 },
    { index: 5, price: 120 },
    { index: 9, price: 130 },
  ];

  it("no candle 6 o swing do índice 5 ainda NÃO está confirmado (precisa de K candles à direita)", () => {
    expect(FRACTAL_K).toBe(2);
    // 5 + 2 = 7 > 6 → invisível ainda. A referência real é o swing do índice 2.
    expect(lastConfirmedSwing(swings, 6)).toEqual({ index: 2, price: 110 });
  });

  it("no candle 7 o swing do índice 5 acabou de ficar confirmado", () => {
    expect(lastConfirmedSwing(swings, 7)).toEqual({ index: 5, price: 120 });
  });

  it("antes de qualquer confirmação devolve null, nunca um nível chutado", () => {
    expect(lastConfirmedSwing(swings, 0)).toBeNull();
    expect(lastConfirmedSwing([], 50)).toBeNull();
  });
});

describe("findFailureIndex / detectSweep — unidades isoladas", () => {
  const bullishBlock = { type: "BULLISH", index: 7, top: 101.5, bottom: 99 };

  it("findFailureIndex acha o primeiro FECHAMENTO abaixo do bottom num bloco de alta", () => {
    expect(findFailureIndex(breakerSeries, bullishBlock, 9)).toBe(10);
  });

  it("findFailureIndex devolve -1 quando o bloco nunca falhou", () => {
    expect(findFailureIndex(survivingSeries, bullishBlock, 9)).toBe(-1);
  });

  it("findFailureIndex num bloco de BAIXA exige fechamento ACIMA do top (espelho exato)", () => {
    const bearishBlock = { type: "BEARISH", index: 2, top: 104, bottom: 100 };
    // A vela 8 fecha em 105, acima do top 104.
    expect(findFailureIndex(breakerSeries, bearishBlock, 4)).toBe(8);
  });

  it("detectSweep só acusa varredura quando o extremo REALMENTE supera o swing confirmado", () => {
    const highs = findSwings(breakerSeries, FRACTAL_K, true);
    const lows = findSwings(breakerSeries, FRACTAL_K, false);
    const swept = detectSweep(breakerSeries, bullishBlock, 10, highs, lows);
    expect(swept.swept).toBe(true);
    expect(swept.level).toBe(110);

    const mHighs = findSwings(mitigationSeries, FRACTAL_K, true);
    const mLows = findSwings(mitigationSeries, FRACTAL_K, false);
    const notSwept = detectSweep(mitigationSeries, bullishBlock, 10, mHighs, mLows);
    expect(notSwept.swept).toBe(false);
  });

  it("sem swing de referência confirmado, detectSweep devolve swept=false — nunca assume", () => {
    const out = detectSweep(breakerSeries, bullishBlock, 10, [], []);
    expect(out.swept).toBe(false);
    expect(out.level).toBeNull();
  });
});

describe("institutional-blocks — aceita as duas convenções de OHLC do projeto", () => {
  it("nomes longos {open,high,low,close} produzem exatamente o mesmo resultado que {o,h,l,c}", () => {
    const long = breakerSeries.map((cd) => ({ open: cd.o, high: cd.h, low: cd.l, close: cd.c }));
    const a = analyze({ ohlcv_series: breakerSeries });
    const b = analyze({ ohlcv_series: long });
    expect(b.status).toBe("OK");
    expect(b.blocks).toEqual(a.blocks);
  });
});

describe("institutional-blocks — reuso real, zero segunda implementação", () => {
  const src = readFileSync(
    resolve(__dirname, "../../src/research/engines/institutional-blocks.js"),
    "utf-8",
  );

  it("consome os Order Blocks do motor que já existe, nunca redetecta", () => {
    expect(src).toMatch(/from '\.\/fvg-order-block-engine\.js'/);
    expect(src).toMatch(/analyzeOrderFlowZones/);
    // Nenhuma redefinição local de Order Block.
    expect(src).not.toMatch(/function\s+findOrderBlocks/);
  });

  it("consome os swings de fractal-swings.js, nunca reimplementa o laço fractal", () => {
    expect(src).toMatch(/from '\.\/fractal-swings\.js'/);
    expect(src).toMatch(/findSwings\(/);
    expect(src).not.toMatch(/function\s+findSwings/);
  });

  it("não usa dado sintético em nenhuma forma (Regra de Ouro 1)", () => {
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/\bmock\b/i);
  });
});
