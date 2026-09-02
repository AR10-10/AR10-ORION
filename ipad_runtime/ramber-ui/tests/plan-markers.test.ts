// Suíte de EXECUÇÃO REAL das setas de entrada/saída.
//
// PEDIDO DO OPERADOR: "com as setinhas indicando a entrada e saída, todo no
// gráfico, bem perfeitamente".
//
// AUDITORIA ANTES DE CONSTRUIR: `grep -rn "setMarkers|createSeriesMarkers|
// SeriesMarker"` no repositório voltou ZERO ocorrências. As etiquetas
// EN/ST/TP já existiam, mas etiqueta de eixo responde "a que PREÇO", nunca
// "em QUAL MOMENTO" — sem marcador temporal o Operador não via no gráfico
// onde o plano abriu nem onde fechou.
//
// Aqui o bug provável é "a seta cai na vela errada" ou "aponta para o lado
// errado" — os dois erram em SILÊNCIO e mentem sobre um evento real. Por
// isso tudo abaixo executa a função de verdade.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildPlanMarkers, candleIndexAt, type PlanMarkerSource } from "../src/chart/plan-markers";
import { DEFAULT_MIN_OPPORTUNITY_SCORE } from "../src/nexus/institutional-score";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");

const T0 = 1_700_000_000; // segundos
const PASSO = 900; // 15m
const velas = (n: number) => Array.from({ length: n }, (_, i) => ({ time: T0 + i * PASSO }));
/** ms no MEIO da vela i — o caso realista (evento não cai na abertura exata). */
const noMeioDa = (i: number) => (T0 + i * PASSO + PASSO / 2) * 1000;

const plano = (over: Partial<PlanMarkerSource> = {}): PlanMarkerSource => ({
  plan: { direction: "LONG" },
  openedAt: noMeioDa(3),
  status: "TARGET_HIT",
  resolvedAt: noMeioDa(7),
  ...over,
});

describe("a seta cai na vela que CONTÉM o evento, nunca na mais próxima", () => {
  it("evento no meio de uma vela ancora naquela vela", () => {
    const c = velas(20);
    const m = buildPlanMarkers([plano()], c);
    expect(m).toHaveLength(2);
    expect(m[0].time).toBe(c[3].time);
    expect(m[1].time).toBe(c[7].time);
  });

  it("evento exatamente na abertura da vela pertence a ela, não à anterior", () => {
    const c = velas(10);
    const m = buildPlanMarkers([plano({ openedAt: c[4].time * 1000, resolvedAt: null, status: "OPEN" })], c);
    expect(m).toHaveLength(1);
    expect(m[0].time).toBe(c[4].time);
  });

  it("evento um segundo ANTES da abertura pertence à vela anterior", () => {
    const c = velas(10);
    const m = buildPlanMarkers([plano({ openedAt: (c[4].time - 1) * 1000, resolvedAt: null, status: "OPEN" })], c);
    expect(m[0].time).toBe(c[3].time);
  });

  it("candleIndexAt devolve o índice real, e -1 fora da janela", () => {
    const c = velas(10);
    expect(candleIndexAt(c, noMeioDa(0))).toBe(0);
    expect(candleIndexAt(c, noMeioDa(9))).toBe(9);
    expect(candleIndexAt(c, (T0 - 5) * 1000)).toBe(-1); // antes da série
  });
});

describe("direção: a seta aponta para o lado certo, e entrada ≠ saída", () => {
  it("LONG entra com ↑ abaixo da vela e sai com ↓ acima", () => {
    const [entrada, saida] = buildPlanMarkers([plano({ plan: { direction: "LONG" } })], velas(20));
    expect(entrada.shape).toBe("arrowUp");
    expect(entrada.position).toBe("belowBar");
    expect(saida.shape).toBe("arrowDown");
    expect(saida.position).toBe("aboveBar");
  });

  it("SHORT é o espelho exato", () => {
    const [entrada, saida] = buildPlanMarkers([plano({ plan: { direction: "SHORT" } })], velas(20));
    expect(entrada.shape).toBe("arrowDown");
    expect(entrada.position).toBe("aboveBar");
    expect(saida.shape).toBe("arrowUp");
    expect(saida.position).toBe("belowBar");
  });

  it("entrada e saída NUNCA ficam visualmente idênticas", () => {
    // Usar a mesma seta nas duas pontas tornaria impossível ler no gráfico
    // qual é qual — o defeito mais provável desta feature.
    for (const dir of ["LONG", "SHORT"] as const) {
      const [e, s] = buildPlanMarkers([plano({ plan: { direction: dir } })], velas(20));
      expect(e.shape, dir).not.toBe(s.shape);
      expect(e.position, dir).not.toBe(s.position);
    }
  });
});

describe("resultado real da saída, nunca uma cor otimista", () => {
  it("alvo e stop têm cores distintas", () => {
    const alvo = buildPlanMarkers([plano({ status: "TARGET_HIT" })], velas(20))[1];
    const stop = buildPlanMarkers([plano({ status: "STOP_HIT" })], velas(20))[1];
    expect(alvo.color).not.toBe(stop.color);
  });

  it("REPLACED é NEUTRO — não foi ganho nem perda", () => {
    // Pintar de verde ou vermelho afirmaria um resultado que nunca houve:
    // o plano foi substituído por uma leitura nova antes de resolver.
    const alvo = buildPlanMarkers([plano({ status: "TARGET_HIT" })], velas(20))[1];
    const stop = buildPlanMarkers([plano({ status: "STOP_HIT" })], velas(20))[1];
    const rep = buildPlanMarkers([plano({ status: "REPLACED" })], velas(20))[1];
    expect(rep.color).not.toBe(alvo.color);
    expect(rep.color).not.toBe(stop.color);
    expect(rep.text).toBe("SUBSTITUÍDO");
  });

  it("o texto diz o que aconteceu, sem eufemismo", () => {
    expect(buildPlanMarkers([plano({ status: "STOP_HIT" })], velas(20))[1].text).toBe("SAÍDA · STOP");
    expect(buildPlanMarkers([plano({ status: "PARTIAL_HIT" })], velas(20))[1].text).toBe("SAÍDA · PARCIAL");
  });
});

describe("filtro de confiança — pedido do Operador: só a entrada com confluência real", () => {
  it("score abaixo do piso omite o PAR inteiro, nunca só uma seta órfã", () => {
    const c = velas(20);
    const m = buildPlanMarkers([plano({ contextAtOpen: { score: DEFAULT_MIN_OPPORTUNITY_SCORE - 1 } })], c);
    expect(m).toEqual([]);
  });

  it("score exatamente no piso ainda mostra — o corte é '< piso', não '<= piso'", () => {
    const c = velas(20);
    const m = buildPlanMarkers([plano({ contextAtOpen: { score: DEFAULT_MIN_OPPORTUNITY_SCORE } })], c);
    expect(m).toHaveLength(2);
  });

  it("score real acima do piso mostra o par normalmente", () => {
    const c = velas(20);
    const m = buildPlanMarkers([plano({ contextAtOpen: { score: 95 } })], c);
    expect(m).toHaveLength(2);
    expect(m[0].text).toContain("ENTRADA");
  });

  it("plano ABERTO (sem saída ainda) com score fraco também some", () => {
    const c = velas(20);
    const m = buildPlanMarkers(
      [plano({ status: "OPEN", resolvedAt: null, contextAtOpen: { score: 10 } })],
      c,
    );
    expect(m).toEqual([]);
  });

  it("fail-open: contextAtOpen ausente (registro antigo) continua aparecendo", () => {
    const c = velas(20);
    const { contextAtOpen: _omit, ...semContexto } = plano();
    const m = buildPlanMarkers([semContexto as PlanMarkerSource], c);
    expect(m).toHaveLength(2);
  });

  it("fail-open: score null (indisponível na abertura) nunca é tratado como 'abaixo'", () => {
    const c = velas(20);
    const m = buildPlanMarkers([plano({ contextAtOpen: { score: null } })], c);
    expect(m).toHaveLength(2);
  });

  it("lista mista: só o plano com confluência real passa, o outro some por inteiro", () => {
    const c = velas(20);
    const fraco = plano({ openedAt: noMeioDa(2), resolvedAt: noMeioDa(5), contextAtOpen: { score: 20 } });
    const forte = plano({ openedAt: noMeioDa(10), resolvedAt: noMeioDa(15), contextAtOpen: { score: 80 } });
    const m = buildPlanMarkers([fraco, forte], c);
    expect(m).toHaveLength(2);
    expect(m.every((marker) => marker.time === c[10].time || marker.time === c[15].time)).toBe(true);
  });
});

describe("fail-closed — nunca uma seta num momento que não existiu", () => {
  it("plano ABERTO não ganha seta de saída", () => {
    const m = buildPlanMarkers([plano({ status: "OPEN", resolvedAt: null })], velas(20));
    expect(m).toHaveLength(1);
    expect(m[0].text).toContain("ENTRADA");
  });

  it("evento fora da janela de candles NÃO é preso na borda", () => {
    // A alternativa preguiçosa (clampar na primeira/última vela) poria a
    // seta numa vela onde nada aconteceu. Este é o teste central do módulo.
    const c = velas(10);
    const antigo = plano({ openedAt: (T0 - 10 * PASSO) * 1000, resolvedAt: (T0 - 5 * PASSO) * 1000 });
    expect(buildPlanMarkers([antigo], c)).toEqual([]);
  });

  it("saída fora da janela não vira seta, mas a entrada dentro dela continua", () => {
    const c = velas(10);
    const m = buildPlanMarkers([plano({ openedAt: noMeioDa(2), resolvedAt: (T0 + 500 * PASSO) * 1000 })], c);
    expect(m).toHaveLength(1);
    expect(m[0].text).toContain("ENTRADA");
  });

  it("tempo inválido nunca lança nem vira marcador", () => {
    const c = velas(10);
    expect(buildPlanMarkers([plano({ openedAt: NaN, resolvedAt: NaN })], c)).toEqual([]);
    expect(() => buildPlanMarkers([plano({ openedAt: Infinity })], c)).not.toThrow();
  });

  it("sem planos ou sem candles devolve lista vazia", () => {
    expect(buildPlanMarkers([], velas(10))).toEqual([]);
    expect(buildPlanMarkers([plano()], [])).toEqual([]);
    expect(buildPlanMarkers(null as never, velas(10))).toEqual([]);
  });
});

describe("contrato da lib respeitado", () => {
  it("tempos saem em ordem não-decrescente — a lib exige", () => {
    const c = velas(40);
    const planos = [
      plano({ openedAt: noMeioDa(20), resolvedAt: noMeioDa(30) }),
      plano({ openedAt: noMeioDa(2), resolvedAt: noMeioDa(25) }), // fora de ordem de propósito
    ];
    const m = buildPlanMarkers(planos, c);
    for (let i = 1; i < m.length; i++) {
      expect(m[i].time as number).toBeGreaterThanOrEqual(m[i - 1].time as number);
    }
  });

  it("cada marcador tem id único — dois na MESMA vela é caso real", () => {
    // A saída de um plano e a entrada do seguinte caem juntas com
    // frequência; sem id a lib não os diferencia.
    const c = velas(20);
    const planos = [
      plano({ openedAt: noMeioDa(2), resolvedAt: noMeioDa(8) }),
      plano({ openedAt: noMeioDa(8), resolvedAt: noMeioDa(15) }),
    ];
    const m = buildPlanMarkers(planos, c);
    const ids = m.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// FIAÇÃO
// ---------------------------------------------------------------------------
describe("as setas chegam ao gráfico de verdade", () => {
  const chart = () => read("../src/chart/EnhancedChart_110_Percent.tsx");
  const app = () => read("../src/App.tsx");

  it("usa a primitiva NATIVA da lib, nunca um canvas novo", () => {
    // A seta precisa ficar ancorada na VELA; a primitiva da lib já resolve
    // isso em pan/zoom sem nenhum loop de rAF a mais.
    const src = chart();
    expect(src).toContain("createSeriesMarkers");
    expect(src).toContain("buildPlanMarkers(planMarkers ?? [], data)");
  });

  it("o dado vem do Track Record real — ativo + histórico, zero segunda fonte", () => {
    const src = app();
    expect(src).toContain("const planMarkersForChart = useMemo(");
    expect(src).toContain("...trackRecordForChart.history");
    expect(src).toContain("planMarkers={planMarkersForChart}");
  });

  it("acompanha trade_plan_zone — nenhum interruptor novo", () => {
    // O Operador pediu explicitamente MENOS modos.
    expect(chart()).toContain("visibility.trade_plan_zone ? buildPlanMarkers(");
  });

  it("o plugin é limpo no unmount, como toda outra ref", () => {
    const src = chart();
    const i = src.indexOf("chart.remove();");
    const fim = src.indexOf("\n    };", i);
    expect(src.slice(i, fim)).toContain("planMarkersRef.current = null;");
  });
});
