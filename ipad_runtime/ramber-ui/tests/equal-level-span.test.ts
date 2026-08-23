// Suíte do trecho de nível de liquidez (EQH/EQL).
//
// DEFEITO RELATADO (Operador, sobre a tela real): "aquele risco que fica
// quando o ativo topa faz duas, três vezes no mesmo lugar, aquela linha
// amarela — antigamente elas não atravessavam o gráfico todo, ela só
// marcava um pedaço da linha, não ficava grandona, marcava quantas vezes
// ela testou naquela mesma zona".
//
// CAUSA MEDIDA: EQH/EQL era desenhado com `createPriceLine`, primitiva que
// SEMPRE atravessa o gráfico inteiro (a lib não tem parâmetro de
// início/fim), e a contagem viajava num `title` que o painel de velas nunca
// renderizou. O dado real existia; morria na primitiva.
//
// O teste mais importante deste arquivo é o primeiro: ele reproduz o
// defeito relatado — o trecho nunca pode cobrir a largura toda — e exige
// que ele não volte.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  resolveEqualLevelSegment,
  EQUAL_LEVEL_MIN_SEGMENT_PX,
  EQUAL_LEVEL_RIGHT_LEAD_PX,
} from "../src/chart/equal-level-span";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf-8");

describe("o defeito relatado — a linha atravessava o gráfico todo", () => {
  it("um pool testado no meio do gráfico marca só o meio, nunca a largura toda", () => {
    const seg = resolveEqualLevelSegment(400, 520, 1200)!;
    expect(seg).not.toBeNull();
    expect(seg.x1).toBe(400);
    expect(seg.x2).toBeLessThan(1200); // não chega na borda direita
    expect(seg.x1).toBeGreaterThan(0); // nem na esquerda
  });

  it("o trecho é uma fração pequena do canvas, não a maior parte dele", () => {
    const canvas = 1200;
    const seg = resolveEqualLevelSegment(400, 520, canvas)!;
    expect((seg.x2 - seg.x1) / canvas).toBeLessThan(0.25);
  });

  it("mesmo um pool com toques muito espaçados não vira largura total", () => {
    // Primeiro toque na borda esquerda visível, último quase no preço vivo.
    const seg = resolveEqualLevelSegment(10, 1100, 1200)!;
    // Cobre o intervalo REAL medido (é isso que o motor viu), mas o fim é o
    // último toque + sobra — nunca a borda por decreto.
    expect(seg.x2).toBe(1100 + EQUAL_LEVEL_RIGHT_LEAD_PX);
    expect(seg.x2).toBeLessThan(1200);
  });
});

describe("o trecho cobre exatamente o intervalo REAL entre os toques", () => {
  it("começa no primeiro toque e termina no último (mais a sobra de leitura)", () => {
    const seg = resolveEqualLevelSegment(300, 500, 1000)!;
    expect(seg.x1).toBe(300);
    expect(seg.x2).toBe(500 + EQUAL_LEVEL_RIGHT_LEAD_PX);
  });

  it("ordem dos argumentos não importa — o intervalo é o mesmo fenômeno", () => {
    const a = resolveEqualLevelSegment(300, 500, 1000);
    const b = resolveEqualLevelSegment(500, 300, 1000);
    expect(a).toEqual(b);
  });

  it("nunca se estende para a ESQUERDA do primeiro toque real", () => {
    // Alargar para trás sugeriria toques mais antigos do que o motor mediu.
    for (const [f, l] of [[300, 302], [300, 500], [10, 12]] as const) {
      const seg = resolveEqualLevelSegment(f, l, 1000)!;
      expect(seg.x1, `primeiro toque ${f}`).toBe(Math.min(f, l));
    }
  });
});

describe("piso de legibilidade — a única licença tomada, e é de forma", () => {
  it("toques em candles vizinhos ainda produzem um trecho visível", () => {
    // Sem piso isto seriam 2px + sobra: some num gráfico com zoom afastado.
    const seg = resolveEqualLevelSegment(600, 602, 1400)!;
    expect(seg.x2 - seg.x1).toBe(EQUAL_LEVEL_MIN_SEGMENT_PX);
  });

  it("o piso cresce para a direita (o presente), nunca para trás", () => {
    const seg = resolveEqualLevelSegment(600, 602, 1400)!;
    expect(seg.x1).toBe(600);
  });

  it("um trecho que já é largo o bastante não é alterado pelo piso", () => {
    const seg = resolveEqualLevelSegment(100, 400, 1000)!;
    expect(seg.x2 - seg.x1).toBeGreaterThan(EQUAL_LEVEL_MIN_SEGMENT_PX);
    expect(seg.x2).toBe(400 + EQUAL_LEVEL_RIGHT_LEAD_PX);
  });
});

describe("recorte à janela visível", () => {
  it("toque fora da tela à esquerda desenha só a parte visível", () => {
    const seg = resolveEqualLevelSegment(-300, 120, 1000)!;
    expect(seg.x1).toBe(0);
    expect(seg.x2).toBe(120 + EQUAL_LEVEL_RIGHT_LEAD_PX);
  });

  it("trecho que termina depois da borda direita para na borda", () => {
    const seg = resolveEqualLevelSegment(900, 990, 1000)!;
    expect(seg.x2).toBe(1000);
  });

  it("pool inteiramente fora da janela não desenha nada", () => {
    expect(resolveEqualLevelSegment(-900, -700, 1000)).toBeNull();
    expect(resolveEqualLevelSegment(1400, 1600, 1000)).toBeNull();
  });
});

describe("fail-closed", () => {
  it("coordenada não-finita nunca vira um trecho inventado", () => {
    expect(resolveEqualLevelSegment(NaN, 500, 1000)).toBeNull();
    expect(resolveEqualLevelSegment(300, Infinity, 1000)).toBeNull();
  });

  it("canvas sem largura real não desenha", () => {
    expect(resolveEqualLevelSegment(300, 500, 0)).toBeNull();
    expect(resolveEqualLevelSegment(300, 500, -10)).toBeNull();
    expect(resolveEqualLevelSegment(300, 500, NaN)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FIAÇÃO (convenção do projeto: o bug provável aqui é "esqueceram de ligar
// A com B", não "a matemática está errada" — por isso padrão no código).
// ---------------------------------------------------------------------------
describe("a primitiva de largura total morreu de verdade", () => {
  const chart = () => read("../src/chart/EnhancedChart_110_Percent.tsx");
  const plugin = () => read("../src/chart/LiquidityZonesPlugin.tsx");

  it("o gráfico não cria mais price line para EQH/EQL", () => {
    const src = chart();
    // O `title` era a assinatura exata da price line removida.
    expect(src).not.toContain('title: `${z.type === "EQUAL_HIGH" ? "EQH" : "EQL"} x${z.touches}`');
  });

  it("quem desenha agora é o canvas que FVG/OB já usavam — zero canvas novo", () => {
    // Um 17º canvas seria mais um ResizeObserver e mais um loop de rAF no
    // main thread, contra o "deixa o sistema leve" do Operador.
    expect(plugin()).toContain("resolveEqualLevelSegment");
    expect(chart()).toContain("equalLevels={");
  });

  it("a contagem de toques aparece no gráfico, não num title invisível", () => {
    expect(plugin()).toContain("×${pool.touches}");
  });

  it("cada toque real ganha sua marca — a evidência por trás da contagem", () => {
    expect(plugin()).toContain("pool.touchIndices");
  });

  it("Fio de Seda: o trecho é 1px sólido, nunca tracejado", () => {
    const src = plugin();
    // Forma EXECUTÁVEL, nunca a string solta: "setLineDash" aparece de
    // propósito nos comentários que explicam a Regra de Ouro 5, e casar com
    // o comentário seria falso positivo.
    expect(src).not.toMatch(/ctx\.setLineDash\(/);
    expect(src).toContain("ctx.lineWidth = 1;");
  });

  it("a camada EQH/EQL não some quando o Operador desliga só as zonas SMC", () => {
    // As duas camadas dividem o mesmo canvas agora; se o gate continuasse
    // sendo só `visibility.liquidity_zones`, desligar zonas apagaria EQH/EQL
    // junto — regressão silenciosa no gerenciador de camadas.
    expect(chart()).toContain("visibility.liquidity_zones || visibility.equal_highs_lows");
  });

  it("props vazias são constantes de módulo — sem redraw por render", () => {
    const src = chart();
    expect(src).toContain("const NO_FILLABLE_ZONES");
    expect(src).not.toContain("fairValueGaps={(fairValueGaps ?? []) as FillableZone[]}");
  });
});
