// Testes de EXECUÇÃO REAL do motor de padrões de vela. Convenção mista do
// CLAUDE.md: aqui o bug mais provável é "a matemática está sutilmente
// errada" (uma sombra medida do lado errado, um engolfo aceito por pavio,
// um martelo classificado como enforcado) — então tudo abaixo executa o
// motor de verdade, nunca varre padrão no código-fonte.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// O motor é .js puro mas TIPADO por JSDoc — o mesmo checkJs que cobre os
// outros engines graduados vale aqui, então nenhum @ts-expect-error é
// necessário (e um desnecessário quebraria o tsc, achado real deste passo).
import {
  analyze,
  classifyAt,
  candleGeometry,
  isDoji,
  hasHammerShape,
  hasInvertedHammerShape,
  isMarubozu,
  isEngulfing,
  isHarami,
  penetrationRatio,
  DOJI_BODY_RATIO,
  SHADOW_BODY_RATIO,
  SIGNIFICANT_BODY_ATR,
  MIDPOINT_PENETRATION,
} from "../../src/research/engines/candlestick-patterns.js";

type C = { t: number; o: number; h: number; l: number; c: number; v?: number };

const candle = (o: number, h: number, l: number, c: number, t = 0): C => ({ t, o, h, l, c, v: 100 });

// ── Séries reais de contexto ───────────────────────────────────────────
// market-structure-engine precisa de swings fractais CONFIRMADOS (HH/HL ou
// LH/LL) para devolver ESTRUTURA_ALTA/BAIXA — e a confirmação é ESTRITA
// (fractal-swings.js quebra em `cmp >= v`, ou seja, empate não confirma).
//
// Achado real do próprio processo de teste: a 1ª versão destas fábricas era
// uma rampa com "wiggle" e produzia ZERO swings — série monotônica não tem
// extremo local. A 2ª versão, uma senoide amostrada em inteiros, produzia
// empates EXATOS de máxima entre candles vizinhos (`high` idêntico), que a
// regra estrita também recusa. Só uma série construída a partir de pivôs
// explícitos, com um pico/vale cravado no candle que fecha cada perna,
// gera a estrutura real que os padrões de reversão exigem. As duas versões
// anteriores passariam despercebidas como "o motor não detectou nada" — na
// verdade era o fail-closed do motor funcionando certo sobre uma fixture
// degenerada.
function fromPivots(pivots: number[], perLeg = 5): C[] {
  const prices: number[] = [];
  for (let p = 0; p < pivots.length - 1; p++) {
    const a = pivots[p];
    const b = pivots[p + 1];
    for (let s = 0; s < perLeg; s++) prices.push(a + (b - a) * (s / perLeg));
  }
  prices.push(pivots[pivots.length - 1]);
  const out: C[] = [];
  for (let i = 0; i < prices.length - 1; i++) {
    const open = prices[i];
    const close = prices[i + 1];
    const closesLeg = (i + 1) % perLeg === 0;
    const up = close > open;
    out.push(
      candle(
        open,
        Math.max(open, close) + (closesLeg && up ? 6 : 1.5),
        Math.min(open, close) - (closesLeg && !up ? 6 : 1.5),
        close,
        i * 60,
      ),
    );
  }
  return out;
}

/** Pernas alternadas com topos e fundos DESCENDENTES (LH + LL reais). */
function downtrendSeries(n = 55): C[] {
  const pivots = [1000];
  let high = 1000;
  while (pivots.length * 5 < n + 5) {
    pivots.push(high - 60); // fundo mais baixo
    high -= 30; // topo mais baixo
    pivots.push(high);
  }
  return fromPivots(pivots);
}

/** Pernas alternadas com topos e fundos ASCENDENTES (HH + HL reais). */
function uptrendSeries(n = 55): C[] {
  const pivots = [1000];
  let low = 1000;
  while (pivots.length * 5 < n + 5) {
    pivots.push(low + 60); // topo mais alto
    low += 30; // fundo mais alto
    pivots.push(low);
  }
  return fromPivots(pivots);
}

describe("candleGeometry — a medição básica, de onde tudo depende", () => {
  it("mede corpo e sombras nos lados certos numa vela de alta", () => {
    // open 100, close 110, high 115, low 95
    const g = candleGeometry(candle(100, 115, 95, 110));
    expect(g.body).toBe(10);
    expect(g.range).toBe(20);
    expect(g.upperShadow).toBe(5); // 115 - max(100,110)
    expect(g.lowerShadow).toBe(5); // min(100,110) - 95
    expect(g.bullish).toBe(true);
    expect(g.bearish).toBe(false);
  });

  it("numa vela de BAIXA as sombras continuam do lado certo (open e close trocam de papel)", () => {
    // Este é o erro clássico: usar close como topo sempre.
    const g = candleGeometry(candle(110, 115, 95, 100));
    expect(g.body).toBe(10);
    expect(g.upperShadow).toBe(5); // 115 - max(110,100) = 115-110
    expect(g.lowerShadow).toBe(5); // min(110,100) - 95 = 100-95
    expect(g.bearish).toBe(true);
  });

  it("range zero não vira divisão por zero disfarçada de leitura", () => {
    const g = candleGeometry(candle(100, 100, 100, 100));
    expect(g.range).toBe(0);
    expect(g.bodyRatio).toBeNull();
  });

  it("candle inválido devolve null, nunca NaN silencioso", () => {
    expect(candleGeometry({ o: NaN, h: 1, l: 1, c: 1 } as unknown as C)).toBeNull();
  });

  it("aceita as DUAS formas de candle do repositório ({o,h,l,c} e {open,high,low,close})", () => {
    const a = candleGeometry({ o: 100, h: 110, l: 90, c: 105 } as unknown as C);
    const b = candleGeometry({ open: 100, high: 110, low: 90, close: 105 } as unknown as C);
    expect(a.body).toBe(b.body);
    expect(a.upperShadow).toBe(b.upperShadow);
  });
});

describe("formas isoladas", () => {
  it("doji: corpo <= 10% do range", () => {
    expect(isDoji(candleGeometry(candle(100, 110, 90, 100.5)))).toBe(true); // corpo 0.5 / range 20
    expect(isDoji(candleGeometry(candle(100, 110, 90, 108)))).toBe(false); // corpo 8 / range 20
    expect(DOJI_BODY_RATIO).toBe(0.1);
  });

  it("martelo: sombra inferior >= 2x corpo E sombra superior curta", () => {
    // corpo 2 (100->102), sombra inferior 10 (90), superior 1 (103)
    expect(hasHammerShape(candleGeometry(candle(100, 103, 90, 102)))).toBe(true);
    expect(SHADOW_BODY_RATIO).toBe(2);
  });

  it("um PIÃO (sombras longas dos DOIS lados) NÃO é martelo — é o falso positivo clássico", () => {
    // corpo 2, sombra inferior 10, sombra superior 10 → indecisão, não martelo
    expect(hasHammerShape(candleGeometry(candle(100, 112, 90, 102)))).toBe(false);
  });

  it("estrela cadente/martelo invertido: a forma ESPELHADA do martelo", () => {
    // corpo 2, sombra superior 10, inferior 1
    expect(hasInvertedHammerShape(candleGeometry(candle(100, 112, 99, 102)))).toBe(true);
    expect(hasHammerShape(candleGeometry(candle(100, 112, 99, 102)))).toBe(false);
  });

  it("marubozu: praticamente sem sombra", () => {
    expect(isMarubozu(candleGeometry(candle(100, 110, 100, 110)))).toBe(true);
    expect(isMarubozu(candleGeometry(candle(100, 115, 95, 110)))).toBe(false);
  });
});

describe("engolfo — a regra é de CORPO, nunca de pavio (definição clássica real)", () => {
  it("engolfo de alta real: corpo cobre o corpo anterior inteiro", () => {
    const prev = candleGeometry(candle(110, 112, 104, 105)); // baixa, corpo 105..110
    const cur = candleGeometry(candle(104, 116, 103, 112)); // alta, corpo 104..112
    expect(isEngulfing(prev, cur)).toBe(true);
  });

  it("NÃO engolfa quando só o PAVIO cobre — o erro que trocaria a definição real", () => {
    // Fixture ENDURECIDA por teste de mutação. A 1ª versão deste caso
    // passava pelo motivo errado: era recusada pelo guard `cur.body >
    // prev.body`, não pela regra corpo-vs-pavio — trocar o motor para usar
    // high/low mantinha os 34 testes verdes. Esta fixture isola a regra:
    //   prev: baixa, corpo 108..110 (pequeno), pavios 107..111
    //   cur:  alta,  corpo 104..107.5 (MAIOR que o da prev), pavios 103..112
    // Pelos PAVIOS a cur cobre a prev inteira (112>=111 e 103<=107) e o
    // corpo é maior — um motor que medisse pavio dirigia "engolfo".
    // Pelos CORPOS não cobre (107.5 < 110), que é a definição real.
    const prev = candleGeometry(candle(110, 111, 107, 108));
    const cur = candleGeometry(candle(104, 112, 103, 107.5));
    expect(cur.body).toBeGreaterThan(prev.body); // o guard de tamanho NÃO é o que recusa
    expect(cur.high).toBeGreaterThanOrEqual(prev.high); // pelo pavio, cobriria
    expect(cur.low).toBeLessThanOrEqual(prev.low);
    expect(isEngulfing(prev, cur)).toBe(false); // pelo CORPO, não cobre
  });

  it("duas velas da MESMA direção nunca são engolfo", () => {
    const prev = candleGeometry(candle(100, 106, 99, 105));
    const cur = candleGeometry(candle(99, 112, 98, 110));
    expect(isEngulfing(prev, cur)).toBe(false);
  });

  it("harami é o INVERSO do engolfo (contido, não cobrindo) — e os dois nunca coincidem", () => {
    const prev = candleGeometry(candle(112, 114, 98, 100)); // baixa grande, corpo 100..112
    const cur = candleGeometry(candle(103, 109, 102, 107)); // alta pequena, contida
    expect(isHarami(prev, cur)).toBe(true);
    expect(isEngulfing(prev, cur)).toBe(false);
  });
});

describe("penetrationRatio — a regra real do ponto médio (Piercing/Dark Cloud)", () => {
  it("mede a fração REAL do corpo anterior penetrada", () => {
    // prev baixa: open 110, close 100 (corpo 10). cur alta fecha em 106 → 60%
    const prev = candleGeometry(candle(110, 111, 99, 100));
    const cur = candleGeometry(candle(99, 107, 98, 106));
    expect(penetrationRatio(prev, cur)).toBeCloseTo(0.6, 10);
    expect(penetrationRatio(prev, cur)!).toBeGreaterThan(MIDPOINT_PENETRATION);
  });

  it("velas na mesma direção não têm penetração definida (null, nunca 0)", () => {
    const prev = candleGeometry(candle(100, 111, 99, 110));
    const cur = candleGeometry(candle(101, 112, 100, 111));
    expect(penetrationRatio(prev, cur)).toBeNull();
  });
});

describe("O ACHADO CENTRAL: a MESMA vela muda de nome e de direção conforme a tendência", () => {
  // Martelo e Enforcado são geometricamente idênticos. Se o motor errar
  // isto, emite o lado oposto — a classe de defeito mais cara do terminal.
  const hammerShape = (base: number) => candle(base, base + 3, base - 30, base + 2);

  it("silhueta de martelo numa QUEDA = Martelo (viés de ALTA)", () => {
    const s = downtrendSeries(60);
    s[s.length - 1] = hammerShape(s[s.length - 2].c);
    const r = analyze({ ohlcv_series: s });
    expect(r.status).toBe("OK");
    expect(r.structureContext).toBe("ESTRUTURA_BAIXA");
    const last = r.patterns[r.patterns.length - 1];
    expect(last.code).toBe("HAMMER");
    expect(last.direction).toBe("ALTA");
  });

  it("a MESMA silhueta numa ALTA = Enforcado (viés de BAIXA)", () => {
    const s = uptrendSeries(60);
    s[s.length - 1] = hammerShape(s[s.length - 2].c);
    const r = analyze({ ohlcv_series: s });
    expect(r.structureContext).toBe("ESTRUTURA_ALTA");
    const last = r.patterns[r.patterns.length - 1];
    expect(last.code).toBe("HANGING_MAN");
    expect(last.direction).toBe("BAIXA");
    // A prova explícita de que é a MESMA forma: só o nome/direção mudou.
    expect(hasHammerShape(candleGeometry(s[s.length - 1]))).toBe(true);
  });

  it("sem estrutura confirmada, NENHUM padrão de reversão é emitido (fail-closed real)", () => {
    // Série lateral pura: market-structure não confirma ALTA nem BAIXA.
    const s: C[] = [];
    for (let i = 0; i < 60; i++) {
      const base = 1000 + (i % 2 === 0 ? 2 : -2);
      s.push(candle(base, base + 3, base - 3, base + (i % 2 === 0 ? -1 : 1), i * 60));
    }
    s[s.length - 1] = candle(1000, 1003, 970, 1002);
    const r = analyze({ ohlcv_series: s });
    const reversals = r.patterns.filter((p: { kind: string }) => p.kind === "REVERSAL");
    expect(reversals).toHaveLength(0);
  });
});

describe("padrões de reversão de 2 e 3 velas, com o contexto certo", () => {
  it("engolfo de alta no fim de uma QUEDA é detectado e nomeado", () => {
    const s = downtrendSeries(60);
    const prevClose = s[s.length - 3].c;
    // Vela pequena de baixa, depois vela grande de alta engolfando o corpo.
    s[s.length - 2] = candle(prevClose, prevClose + 2, prevClose - 8, prevClose - 6);
    s[s.length - 1] = candle(prevClose - 7, prevClose + 40, prevClose - 8, prevClose + 35);
    const r = analyze({ ohlcv_series: s });
    const last = r.patterns[r.patterns.length - 1];
    expect(last.code).toBe("BULLISH_ENGULFING");
    expect(last.direction).toBe("ALTA");
    expect(last.kind).toBe("REVERSAL");
  });

  it("estrela da manhã (3 velas) exige a 3ª fechar além do ponto médio da 1ª", () => {
    const s = downtrendSeries(60);
    const base = s[s.length - 4].c;
    // 1ª: baixa grande (base -> base-40). Ponto médio = base-20.
    s[s.length - 3] = candle(base, base + 2, base - 42, base - 40);
    // 2ª: corpo pequeno (indecisão).
    s[s.length - 2] = candle(base - 41, base - 38, base - 44, base - 40);
    // 3ª: alta grande fechando ACIMA do ponto médio da 1ª.
    s[s.length - 1] = candle(base - 40, base - 8, base - 41, base - 10);
    const r = analyze({ ohlcv_series: s });
    const last = r.patterns[r.patterns.length - 1];
    expect(last.code).toBe("MORNING_STAR");
    expect(last.candles).toBe(3);
  });

  it("marubozu é CONTINUAÇÃO e não é bloqueado por falta de estrutura", () => {
    const s: C[] = [];
    for (let i = 0; i < 60; i++) {
      const base = 1000 + (i % 2 === 0 ? 2 : -2);
      s.push(candle(base, base + 3, base - 3, base + (i % 2 === 0 ? -1 : 1), i * 60));
    }
    const b = s[s.length - 2].c;
    s[s.length - 1] = candle(b, b + 30, b, b + 30); // sem sombra, corpo grande
    const r = analyze({ ohlcv_series: s });
    const last = r.patterns[r.patterns.length - 1];
    expect(last.code).toBe("MARUBOZU_BULL");
    expect(last.kind).toBe("CONTINUATION");
  });
});

describe("honestidade e fail-closed", () => {
  it("candles insuficientes para o ATR real => DADOS_INSUFICIENTES, nunca um padrão chutado", () => {
    const r = analyze({ ohlcv_series: downtrendSeries(10) });
    expect(r.status).toBe("DADOS_INSUFICIENTES");
  });

  it("entrada vazia/inválida não quebra", () => {
    expect(analyze({}).status).toBe("DADOS_INSUFICIENTES");
    expect(analyze({ ohlcv_series: null as unknown as C[] }).status).toBe("DADOS_INSUFICIENTES");
  });

  it("doji é INDECISÃO — direction null de propósito, nunca ALTA/BAIXA fabricada", () => {
    const s = downtrendSeries(60);
    const b = s[s.length - 2].c;
    s[s.length - 1] = candle(b, b + 15, b - 15, b + 0.2); // corpo desprezível
    const r = analyze({ ohlcv_series: s });
    const doji = r.patterns.find((p: { code: string }) => p.code === "DOJI");
    expect(doji).toBeDefined();
    expect(doji.direction).toBeNull();
    expect(doji.kind).toBe("INDECISION");
  });

  it("nenhum padrão carrega probabilidade — só medições reais (bodyAtr/confirmed)", () => {
    const s = downtrendSeries(60);
    s[s.length - 1] = candle(s[s.length - 2].c, s[s.length - 2].c + 3, s[s.length - 2].c - 30, s[s.length - 2].c + 2);
    const r = analyze({ ohlcv_series: s });
    for (const p of r.patterns) {
      expect(p).not.toHaveProperty("probability");
      expect(p).not.toHaveProperty("winRate");
      expect(p).not.toHaveProperty("accuracy");
      expect(typeof p.bodyAtr === "number" || p.bodyAtr === null).toBe(true);
    }
  });

  it("`confirmed` é null (não false) quando ainda não existe vela seguinte", () => {
    const s = downtrendSeries(60);
    s[s.length - 1] = candle(s[s.length - 2].c, s[s.length - 2].c + 3, s[s.length - 2].c - 30, s[s.length - 2].c + 2);
    const r = analyze({ ohlcv_series: s });
    const last = r.patterns[r.patterns.length - 1];
    // O último padrão da série nunca tem vela seguinte para confirmá-lo.
    expect(last.index).toBe(s.length - 1);
    expect(last.confirmed).toBeNull();
  });

  it("só UM padrão por candle — nunca uma pilha de rótulos concorrentes", () => {
    const s = downtrendSeries(60);
    s[s.length - 1] = candle(s[s.length - 2].c, s[s.length - 2].c + 3, s[s.length - 2].c - 30, s[s.length - 2].c + 2);
    const r = analyze({ ohlcv_series: s });
    const indices = r.patterns.map((p: { index: number }) => p.index);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it("a varredura respeita a janela recente declarada", () => {
    const r = analyze({ ohlcv_series: downtrendSeries(200) });
    for (const p of r.patterns) expect(p.index).toBeGreaterThanOrEqual(200 - 40);
  });

  it("SIGNIFICANT_BODY_ATR trava o 'corpo grande' em unidades de ATR, nunca em preço absoluto", () => {
    expect(SIGNIFICANT_BODY_ATR).toBe(0.5);
    const src = readFileSync(resolve(__dirname, "../../src/research/engines/candlestick-patterns.js"), "utf8");
    // A conversão ATR% -> preço tem que existir: sem ela "corpo grande"
    // seria um número em dólares, sem sentido entre ativos.
    expect(src).toMatch(/atrPrice\s*=\s*\(atrPct\s*\/\s*100\)\s*\*\s*cur\.close/);
  });
});

describe("disciplina do módulo (pureza + LEI 24)", () => {
  const src = readFileSync(resolve(__dirname, "../../src/research/engines/candlestick-patterns.js"), "utf8");

  it("é puro: zero rede, zero aleatório, zero relógio", () => {
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/WebSocket/);
    expect(src).not.toMatch(/Date\.now/);
  });

  it("reusa o ATR e a estrutura já graduados — zero segunda matemática", () => {
    expect(src).toMatch(/import \{ computeAtrPercent \} from '\.\/lorentzian-classifier\.js'/);
    expect(src).toMatch(/from '\.\/market-structure-engine\.js'/);
  });

  it("declara explicitamente que não é probabilidade e que é display-only", () => {
    expect(src).toMatch(/NUNCA reporta probabilidade de acerto/);
    expect(src).toMatch(/LEI 24/);
  });

  it("classifyAt é exportado — o contexto de tendência é PARÂMETRO, nunca recalculado por dentro", () => {
    expect(typeof classifyAt).toBe("function");
    expect(src).toMatch(/export function classifyAt\(candles, i, atrSeries, structureLabel\)/);
  });
});
