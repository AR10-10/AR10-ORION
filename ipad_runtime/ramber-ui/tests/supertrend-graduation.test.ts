// GRADUAÇÃO de supertrend-engine.js (SuperTrend, Olivier Seban).
//
// Segundo motor desta rodada que existia com suíte de execução real (18
// casos) e ZERO importadores. Mesmo padrão de falha já registrado para
// institutional-blocks.js: um motor correto que ninguém consome não é
// inteligência entregue.
//
// O SuperTrend é um TRAILING STOP: a banda de cima só desce ou fica parada
// enquanto o preço está acima dela; a de baixo só sobe ou fica parada
// enquanto o preço está abaixo. É essa catraca — não as bandas — que o
// separa de um par tipo Keltner que inverte a cada respiro do mercado. A
// matemática disso tem suíte própria; aqui o bug provável é de FIAÇÃO.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeSuperTrend } from "../src/engine-bridge";
import { splitSuperTrendSeries } from "../src/chart/supertrend-series";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");
const bridge = () => read("../src/engine-bridge.ts");
const chart = () => read("../src/chart/EnhancedChart_110_Percent.tsx");
const app = () => read("../src/App.tsx");

describe("o motor deixou de ter zero importadores", () => {
  it("engine-bridge importa o motor real, nunca uma segunda implementação", () => {
    const src = bridge();
    expect(src).toContain("from '../../src/research/engines/supertrend-engine.js'");
    expect(src).toContain("export function computeSuperTrend(");
  });

  it("o wrapper é fino — nenhuma regra de travamento reimplementada aqui", () => {
    const src = bridge();
    const i = src.indexOf("export function computeSuperTrend(");
    const corpo = src.slice(i, src.indexOf("\n}", i));
    expect(corpo).toContain("computeSuperTrendPure(candles, period, multiplier)");
    expect(corpo).toContain("return result.points;");
    // A catraca é o coração do indicador — se aparecesse aqui seria uma
    // segunda matemática, exatamente o que a Regra de Ouro 4 proíbe.
    expect(corpo).not.toContain("finalUpper");
    expect(corpo).not.toContain("basicLower");
  });
});

describe("fail-closed de verdade — execução real do caminho ponta a ponta", () => {
  it("série curta demais para o aquecimento de Wilder devolve lista vazia", () => {
    const curta = Array.from({ length: 5 }, (_, i) => ({
      open: 100 + i,
      high: 101 + i,
      low: 99 + i,
      close: 100 + i,
    }));
    expect(computeSuperTrend(curta)).toEqual([]);
  });

  it("entrada inválida nunca lança nem devolve linha fabricada", () => {
    expect(computeSuperTrend([])).toEqual([]);
    // Em runtime o motor pode receber lixo (dado de cache corrompido, uma
    // resposta parcial); o cast é a forma honesta de exercitar esse caminho.
    expect(computeSuperTrend(null as unknown as [])).toEqual([]);
  });

  it("com histórico real suficiente devolve pontos com a forma esperada", () => {
    // Série com tendência clara e uma reversão — o suficiente para o motor
    // aquecer e produzir os dois sentidos.
    const candles: Array<{ open: number; high: number; low: number; close: number }> = [];
    for (let i = 0; i < 40; i++) {
      const base = 100 + i * 0.8;
      candles.push({ open: base, high: base + 1, low: base - 1, close: base + 0.5 });
    }
    for (let i = 0; i < 40; i++) {
      const base = 132 - i * 0.9;
      candles.push({ open: base, high: base + 1, low: base - 1, close: base - 0.5 });
    }
    const pontos = computeSuperTrend(candles);
    expect(pontos.length).toBeGreaterThan(0);
    for (const p of pontos) {
      expect(Number.isFinite(p.line)).toBe(true);
      expect(["UP", "DOWN"]).toContain(p.trend);
      expect(typeof p.flipped).toBe("boolean");
      expect(p.index).toBeGreaterThanOrEqual(0);
      expect(p.index).toBeLessThan(candles.length);
    }
    // A reversão construída de propósito tem de aparecer como flip real.
    expect(pontos.some((p) => p.flipped)).toBe(true);
  });
});

describe("desenho: duas séries nativas, porque a lib não colore segmentos", () => {
  it("existe uma série por sentido de tendência", () => {
    const src = chart();
    expect(src).toContain("supertrendUpRef");
    expect(src).toContain("supertrendDownRef");
  });

  it("o gráfico usa a fonte única da separação, nunca uma segunda cópia", () => {
    const src = chart();
    expect(src).toContain("splitSuperTrendSeries<UTCTimestamp>(");
    expect(src).toContain('from "./supertrend-series"');
  });

  it("os trechos da outra tendência entram como whitespace — EXECUÇÃO real", () => {
    // Sem o buraco, a lib ligaria os trechos com uma reta e desenharia um
    // stop que nunca existiu.
    const { up, down } = splitSuperTrendSeries<number>(
      [
        { index: 0, line: 10, trend: "UP", flipped: false },
        { index: 1, line: 11, trend: "UP", flipped: false },
        { index: 2, line: 20, trend: "DOWN", flipped: true },
        { index: 3, line: 21, trend: "DOWN", flipped: false },
      ],
      (i) => i * 100,
    );
    // Mesma quantidade de pontos nas duas: a série de tempos é completa.
    expect(up).toHaveLength(4);
    expect(down).toHaveLength(4);
    // Onde a tendência é a outra, o ponto NÃO carrega value.
    expect(up[3].value).toBeUndefined();
    expect(down[0].value).toBeUndefined();
    expect(down[1].value).toBeUndefined();
  });

  it("o candle do FLIP entra nas duas séries — sem buraco no instante que mais importa", () => {
    const { up, down } = splitSuperTrendSeries<number>(
      [
        { index: 0, line: 10, trend: "UP", flipped: false },
        { index: 1, line: 20, trend: "DOWN", flipped: true },
      ],
      (i) => i * 100,
    );
    expect(up[1].value).toBe(20);
    expect(down[1].value).toBe(20);
  });

  it("índice fora da janela real e linha não-finita são descartados, nunca desenhados", () => {
    const { up, down } = splitSuperTrendSeries<number>(
      [
        { index: 0, line: 10, trend: "UP", flipped: false },
        { index: 99, line: 12, trend: "UP", flipped: false }, // fora da janela
        { index: 1, line: NaN, trend: "UP", flipped: false }, // leitura inválida
      ],
      (i) => (i < 2 ? i * 100 : undefined),
    );
    expect(up).toHaveLength(1);
    expect(down).toHaveLength(1);
  });

  it("Fio de Seda: 1px sólida nas duas, sem rótulo de eixo novo", () => {
    const src = chart();
    const i = src.indexOf("const supertrendUp = chart.addSeries(LineSeries, {");
    expect(i).toBeGreaterThan(-1);
    const bloco = src.slice(i, i + 700);
    expect(bloco.match(/lineWidth: 1/g)?.length).toBe(2);
    expect(bloco.match(/lineStyle: LineStyle\.Solid/g)?.length).toBe(2);
    expect(bloco.match(/lastValueVisible: false/g)?.length).toBe(2);
    expect(bloco).not.toContain("LineStyle.Dashed");
  });

  it("as duas séries são limpas no unmount, como toda outra ref", () => {
    const src = chart();
    const i = src.indexOf("chart.remove();");
    const fim = src.indexOf("\n    };", i);
    const cleanup = src.slice(i, fim);
    expect(cleanup).toContain("supertrendUpRef.current = null;");
    expect(cleanup).toContain("supertrendDownRef.current = null;");
  });
});

describe("camada real no gerenciador — nunca uma anotação sem controle", () => {
  it("id declarado, com profundidade e visibilidade padrão", () => {
    expect(chart()).toContain('"supertrend",');
    expect(chart().match(/supertrend: true,/g)?.length).toBe(2); // visibility + auto mode
    expect(read("../src/chart/chart-layer-depth.ts")).toContain('supertrend: "line",');
  });

  it("aparece no painel de camadas do Operador", () => {
    expect(app()).toContain('{ id: "supertrend", label: "SUPERTREND" },');
  });

  it("esconder alterna visible nas séries nativas, nunca desmonta/recomputa", () => {
    const src = chart();
    expect(src).toContain("supertrendUpRef.current.applyOptions({ visible: visibility.supertrend });");
    expect(src).toContain("supertrendDownRef.current.applyOptions({ visible: visibility.supertrend });");
  });

  it("a relevância é por EXISTÊNCIA real, nunca por proximidade ao preço", () => {
    // Decisão deliberada e a mais fácil de errar aqui: um trailing stop é
    // justamente mais informativo quando está LONGE do preço (mostra quanta
    // folga a tendência ainda tem). A régua de proximidade esconderia a
    // camada exatamente quando ela mais diz alguma coisa.
    const rel = read("../src/nexus/layer-relevance.ts");
    expect(rel).toContain("supertrend: input.hasSuperTrend");
    expect(rel).toContain("hasSuperTrend: boolean;");
    expect(app()).toContain("const hasSuperTrend = Array.isArray(chartData) && computeSuperTrend(chartData).length > 0;");
  });

  it("entra no orçamento visual com custo 1 — a lib desenha um traço só", () => {
    expect(read("../src/nexus/layer-relevance.ts")).toContain("supertrend: 1,");
  });
});

describe("LEI 24 — display only", () => {
  it("a tendência do SuperTrend nunca vira decisão nem filtro do Núcleo", () => {
    const src = app();
    expect(src).not.toMatch(/computeSuperTrend[\s\S]{0,300}engine\.direction/);
    expect(src).not.toMatch(/superTrend[\s\S]{0,200}setDirection/i);
  });

  it("o App só usa o motor para a régua de relevância — nada mais", () => {
    // Uma segunda chamada seria um segundo consumidor a auditar; se algum
    // dia existir, este teste obriga a revisar o que ele faz com a leitura.
    expect(app().match(/computeSuperTrend\(/g)).toHaveLength(1);
  });
});

describe("documentado no QUARANTINE.md", () => {
  it("a entrada de graduação existe", () => {
    const q = read("../../src/research/QUARANTINE.md");
    expect(q).toContain("supertrend-engine.js");
    expect(q.toLowerCase()).toContain("trailing stop");
  });
});
