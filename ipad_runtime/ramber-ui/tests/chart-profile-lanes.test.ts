// chart-profile-lanes.test.ts — achado real (reclamação direta do
// Operador: "o sistema agora tem camada duplicada... tipo o volume
// profile, o volume"): VolumeProfilePlugin, TpoProfilePlugin e
// DepthChartPlugin desenhavam todos a partir do mesmo cssWidth (mesma
// faixa de pixels) sempre que mais de um estava visível ao mesmo tempo
// (o caso comum — os 3 defaults são true em visibilidade E modo
// automático, ver DEFAULT_CHART_LAYER_VISIBILITY/DEFAULT_CHART_LAYER_
// AUTO_MODE em EnhancedChart_110_Percent.tsx). Convenção mista de
// sempre: a matemática pura das lanes (fronteira real, "os números estão
// certos?") ganha execução real; a fiação nos 3 plugins ("esqueceram de
// ligar A com B de novo?") ganha teste de padrão de código.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  getProfileLaneOffsetFraction,
  getProfileLaneWidthFraction,
  getProfileLaneRightEdgePx,
  getProfileLaneMaxBarWidthPx,
  getChartBodyBounds,
  getChartRightEdgeFraction,
  CHART_LEFT_EDGE_FRACTION,
  CHART_MIN_BODY_PX,
  PROFILE_LANES_MAX_TOTAL_FRACTION,
  resolveProfileLanes,
  type ChartProfileLaneId,
} from "../src/chart/chart-profile-lanes";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

describe("chart-profile-lanes: matemática pura de offset/largura", () => {
  it("volume_profile é a lane 0 (rightmost) — offset zero, comportamento visual idêntico a antes", () => {
    expect(getProfileLaneOffsetFraction("volume_profile")).toBe(0);
    expect(getProfileLaneRightEdgePx("volume_profile", 1000)).toBe(1000);
  });

  it("tpo_profile começa exatamente onde a lane do volume_profile termina", () => {
    // Com as 3 ativas o teto PROFILE_LANES_MAX_TOTAL_FRACTION entra em cena
    // e todas encolhem proporcionalmente — o offset deixou de ser a soma
    // crua (0.16) e passou a ser a soma ESCALADA. O invariante que importa
    // continua: começa exatamente onde a anterior acaba.
    const escala = 0.34 / (0.16 + 0.14 + 0.18);
    expect(getProfileLaneOffsetFraction("tpo_profile")).toBeCloseTo(0.16 * escala, 10);
    expect(getProfileLaneRightEdgePx("tpo_profile", 1000)).toBeCloseTo(1000 - 160 * (0.34 / 0.48), 10);
  });

  it("order_book_depth começa depois de volume_profile + tpo_profile somados (já escalados pelo teto)", () => {
    expect(getProfileLaneOffsetFraction("order_book_depth")).toBeCloseTo((0.16 + 0.14) * (0.34 / 0.48), 10);
    expect(getProfileLaneRightEdgePx("order_book_depth", 1000)).toBeCloseTo(1000 - 300 * (0.34 / 0.48), 10);
  });

  it("fail-closed: id desconhecido devolve offset 0 (nunca NaN/undefined)", () => {
    expect(getProfileLaneOffsetFraction("nao_existe" as ChartProfileLaneId)).toBe(0);
  });

  it("getProfileLaneMaxBarWidthPx escala linearmente com cssWidth (mesma fração, 2x largura => 2x px)", () => {
    const w500 = getProfileLaneMaxBarWidthPx("order_book_depth", 500);
    const w1000 = getProfileLaneMaxBarWidthPx("order_book_depth", 1000);
    expect(w1000).toBeCloseTo(w500 * 2, 10);
  });

  it("invariante real: as 3 lanes nunca se sobrepõem, para qualquer cssWidth real", () => {
    const cssWidth = 1440; // monitor real comum, mesma ordem de grandeza do caso do Operador
    const ids: ChartProfileLaneId[] = ["volume_profile", "tpo_profile", "order_book_depth"];
    const spans = ids.map((id) => {
      const right = getProfileLaneRightEdgePx(id, cssWidth);
      const width = getProfileLaneMaxBarWidthPx(id, cssWidth);
      return { id, left: right - width, right };
    });
    // Ordenado por `left` decrescente (volume_profile é o mais à direita).
    spans.sort((a, b) => b.left - a.left);
    for (let i = 0; i < spans.length - 1; i++) {
      // A borda esquerda de uma lane nunca é menor que a borda direita da
      // próxima (nunca cruza pra dentro da lane vizinha) — epsilon real de
      // ponto flutuante (soma de frações vs. soma de produtos não é
      // bit-idêntica, ex.: (0.16+0.14)*W vs 0.16*W+0.14*W), nunca uma
      // colisão real: a ordem de grandeza (~1e-13px) é invisível em
      // qualquer canvas real.
      expect(spans[i].left).toBeGreaterThanOrEqual(spans[i + 1].right - 1e-9);
    }
  });

  it("soma das 3 larguras fica dentro de um orçamento real de tela (nunca > 60% do chart mesmo no pior caso simultâneo)", () => {
    const total =
      getProfileLaneWidthFraction("volume_profile") +
      getProfileLaneWidthFraction("tpo_profile") +
      getProfileLaneWidthFraction("order_book_depth");
    expect(total).toBeLessThan(0.6);
  });
});

describe("chart-profile-lanes: fiação real nos 3 plugins (nunca cssWidth literal de novo)", () => {
  const volumeProfilePlugin = () => read("../src/chart/VolumeProfilePlugin.tsx");
  const tpoProfilePlugin = () => read("../src/chart/TpoProfilePlugin.tsx");
  const depthChartPlugin = () => read("../src/chart/DepthChartPlugin.tsx");

  it("VolumeProfilePlugin importa e usa a lane compartilhada", () => {
    const src = volumeProfilePlugin();
    expect(src).toContain('import { getProfileLaneRightEdgePx, getProfileLaneMaxBarWidthPx, type ChartProfileLaneId } from "./chart-profile-lanes";');
    expect(src).toContain('getProfileLaneRightEdgePx("volume_profile", cssWidth, activeLanes)');
    expect(src).toContain('getProfileLaneMaxBarWidthPx("volume_profile", cssWidth, activeLanes)');
    expect(src).not.toContain("MAX_BAR_WIDTH_FRACTION");
    expect(src).not.toContain("ctx.fillRect(cssWidth - w,");
  });

  it("TpoProfilePlugin importa e usa a lane compartilhada (bars + POC + Initial Balance)", () => {
    const src = tpoProfilePlugin();
    expect(src).toContain('import { getProfileLaneRightEdgePx, getProfileLaneMaxBarWidthPx, type ChartProfileLaneId } from "./chart-profile-lanes";');
    expect(src).toContain('getProfileLaneRightEdgePx("tpo_profile", cssWidth, activeLanes)');
    expect(src).toContain('getProfileLaneMaxBarWidthPx("tpo_profile", cssWidth, activeLanes)');
    expect(src).not.toContain("MAX_BAR_WIDTH_FRACTION");
    expect(src).not.toContain("ctx.fillRect(cssWidth - w,");
    // As 2 linhas de Initial Balance (drawIbLine) também migraram do
    // cssWidth literal para a lane — não só o POC.
    expect(src).not.toContain("ctx.moveTo(cssWidth - maxBarWidth,");
  });

  it("DepthChartPlugin importa e usa a lane compartilhada (bids/asks + wall + label)", () => {
    const src = depthChartPlugin();
    expect(src).toContain('import { getProfileLaneRightEdgePx, getProfileLaneMaxBarWidthPx, type ChartProfileLaneId } from "./chart-profile-lanes";');
    expect(src).toContain('getProfileLaneRightEdgePx("order_book_depth", cssWidth, activeLanes)');
    expect(src).toContain('getProfileLaneMaxBarWidthPx("order_book_depth", cssWidth, activeLanes)');
    expect(src).not.toContain("MAX_BAR_WIDTH_FRACTION");
    expect(src).not.toContain("ctx.fillRect(cssWidth - w,");
    expect(src).not.toContain("cssWidth - w - size.width - 4");
  });

  it("LiquidationHeatmapPlugin NUNCA vira uma LANE DE PERFIL (continua ancorado à esquerda, precedente OMEGA CORE V-MAX Fase 8.1)", () => {
    // A regra que esta guarda protege é "não entra na família da DIREITA" —
    // e continua valendo. O que mudou: ele passou a consumir a reserva da
    // borda ESQUERDA do mesmo módulo (CHART_LEFT_EDGE_FRACTION), porque a
    // medição achou a colisão dele com as etiquetas estruturais do lado
    // esquerdo. A guarda antiga proibia a string do módulo inteiro e não
    // sabia distinguir os dois lados; agora proíbe o que realmente importa.
    const src = read("../src/chart/LiquidationHeatmapPlugin.tsx");
    expect(src).not.toContain("getProfileLane");            // nenhuma lane de perfil
    expect(src).not.toContain("ChartProfileLaneId");
    expect(src).toContain("CHART_LEFT_EDGE_FRACTION");      // usa a borda esquerda declarada
    expect(src).toContain("ctx.fillRect(0, y, longW, h)");  // e continua ancorado em x=0
  });
});

// ============================================================================
// RESERVA DE BORDAS — "cada objeto no seu canto, nada cobrindo nada"
// ============================================================================
describe('getChartBodyBounds: o corpo livre entre as faixas de borda', () => {
  it('a faixa direita é a soma real das lanes ATIVAS, já limitada pelo teto', () => {
    // Antes: soma crua das 3 (0.48 — quase metade da tela só de painéis).
    // Agora: derivada das ativas E limitada. Se alguém mexer numa lane ou
    // no teto e esquecer deste número, o teste pega.
    const somaCrua = getProfileLaneWidthFraction('volume_profile')
      + getProfileLaneWidthFraction('tpo_profile')
      + getProfileLaneWidthFraction('order_book_depth');
    expect(somaCrua).toBeGreaterThan(PROFILE_LANES_MAX_TOTAL_FRACTION);
    expect(getChartRightEdgeFraction()).toBeCloseTo(PROFILE_LANES_MAX_TOTAL_FRACTION, 10);
  });

  it('o corpo NÃO invade nenhuma das duas faixas', () => {
    const w = 1200;
    const b = getChartBodyBounds(w);
    expect(b.left).toBeCloseTo(w * CHART_LEFT_EDGE_FRACTION, 6);
    expect(b.right).toBeCloseTo(w * (1 - getChartRightEdgeFraction()), 6);
    expect(b.width).toBeGreaterThan(0);
  });

  it('COLISÃO 1 RESOLVIDA: a barra de liquidação cabe inteira na faixa esquerda', () => {
    // Ela desenha de x=0 até cssWidth*CHART_LEFT_EDGE_FRACTION; o corpo começa
    // exatamente onde ela termina. Zero pixel de sobreposição.
    const w = 1200;
    const fimDaLiquidacao = w * CHART_LEFT_EDGE_FRACTION;
    expect(getChartBodyBounds(w).left).toBeCloseTo(fimDaLiquidacao, 6);
  });

  it('COLISÃO 2 RESOLVIDA: o corpo termina antes da primeira lane de perfil', () => {
    const w = 1200;
    const inicioDosPerfis = w * (1 - getChartRightEdgeFraction());
    expect(getChartBodyBounds(w).right).toBeCloseTo(inicioDosPerfis, 6);
  });

  it('fail-closed em tela estreita: devolve o gráfico INTEIRO em vez de um corpo inútil', () => {
    // DEFEITO QUE ESTE TESTE PEGOU: a 1ª versão gateava por `right <= left`.
    // Como os dois são frações da MESMA largura, a razão é constante e aquilo
    // nunca podia ser verdade — ramo morto se passando por proteção. O gate
    // real é um mínimo ABSOLUTO em px.
    const estreita = 400; // corpo seria 400*0.38 = 152px < CHART_MIN_BODY_PX
    const b = getChartBodyBounds(estreita);
    expect(estreita * (1 - getChartRightEdgeFraction()) - estreita * CHART_LEFT_EDGE_FRACTION)
      .toBeLessThan(CHART_MIN_BODY_PX); // a premissa do cenário é real
    expect(b.left).toBe(0);
    expect(b.right).toBe(estreita);
    expect(b.width).toBe(estreita);
  });

  it('o fallback é ALCANÇÁVEL e tem fronteira real (não é ramo morto)', () => {
    const limiar = CHART_MIN_BODY_PX / (1 - getChartRightEdgeFraction() - CHART_LEFT_EDGE_FRACTION);
    expect(getChartBodyBounds(limiar * 0.9).left).toBe(0);        // abaixo: gráfico inteiro
    expect(getChartBodyBounds(limiar * 1.1).left).toBeGreaterThan(0); // acima: faixas respeitadas
  });

  it('fail-closed em largura inválida: zeros honestos, nunca NaN na geometria', () => {
    for (const bad of [0, -100, Number.NaN, Infinity]) {
      const b = getChartBodyBounds(bad as number);
      expect(Number.isFinite(b.left)).toBe(true);
      expect(Number.isFinite(b.right)).toBe(true);
      expect(Number.isFinite(b.width)).toBe(true);
    }
  });

  it('as faixas somadas deixam corpo real em qualquer tela de uso (iPad a 4K)', () => {
    for (const w of [1024, 1366, 1440, 1920, 2560, 3840]) {
      const b = getChartBodyBounds(w);
      expect(b.width / w).toBeGreaterThan(0.3); // sobra pelo menos 30% para os candles
    }
  });
});

describe("empacotamento DINÂMICO — a causa raiz da etiqueta no meio do gráfico", () => {
  it("uma lane sozinha encosta no eixo: offset ZERO, nunca espaço reservado para lanes ocultas", () => {
    // Era este o defeito: com VP e TPO ocultos, order_book_depth ainda
    // começava a 0.30 da borda e desenhava sobre as velas, deixando 30%
    // de faixa reservada e VAZIA à direita dela.
    expect(getProfileLaneOffsetFraction("order_book_depth", ["order_book_depth"])).toBe(0);
    expect(getProfileLaneOffsetFraction("tpo_profile", ["tpo_profile"])).toBe(0);
  });

  it("duas lanes ativas empacotam entre si — a oculta não reserva nada", () => {
    // VP oculto: depth vem logo depois de tpo, não depois de vp+tpo.
    const ativo = ["tpo_profile", "order_book_depth"] as const;
    expect(getProfileLaneOffsetFraction("tpo_profile", ativo)).toBe(0);
    expect(getProfileLaneOffsetFraction("order_book_depth", ativo)).toBeCloseTo(0.14, 10);
  });

  it("a ordem de empilhamento é sempre a canônica, não a ordem em que o chamador listou", () => {
    const embaralhado = ["order_book_depth", "volume_profile"] as const;
    expect(getProfileLaneOffsetFraction("volume_profile", embaralhado)).toBe(0);
    expect(getProfileLaneOffsetFraction("order_book_depth", embaralhado)).toBeCloseTo(0.16, 10);
  });

  it("nenhum perfil visível não reserva NADA — o corpo do gráfico é a tela inteira", () => {
    expect(getChartRightEdgeFraction([])).toBe(0);
    const body = getChartBodyBounds(1200, []);
    expect(body.right).toBe(1200);
  });

  it("o teto só entra quando a soma natural o ultrapassa — 2 lanes cabem sem encolher", () => {
    // 0.16 + 0.14 = 0.30 < 0.34, então nada é escalado.
    expect(getChartRightEdgeFraction(["volume_profile", "tpo_profile"])).toBeCloseTo(0.30, 10);
    // As 3 somam 0.48 > 0.34 — aí sim encolhem.
    expect(getChartRightEdgeFraction()).toBeCloseTo(0.34, 10);
  });

  it("quando o teto entra, todas encolhem PROPORCIONALMENTE — nenhuma é sacrificada", () => {
    const lanes = resolveProfileLanes();
    const escala = 0.34 / 0.48;
    expect(lanes.get("volume_profile")!.widthFraction).toBeCloseTo(0.16 * escala, 10);
    expect(lanes.get("tpo_profile")!.widthFraction).toBeCloseTo(0.14 * escala, 10);
    expect(lanes.get("order_book_depth")!.widthFraction).toBeCloseTo(0.18 * escala, 10);
    // E a proporção relativa entre elas é preservada.
    expect(lanes.get("order_book_depth")!.widthFraction / lanes.get("tpo_profile")!.widthFraction)
      .toBeCloseTo(0.18 / 0.14, 10);
  });

  it("as 3 lanes nunca podem ocupar mais que o teto declarado", () => {
    expect(PROFILE_LANES_MAX_TOTAL_FRACTION).toBeLessThan(0.5);
    for (const combo of [
      ["volume_profile"],
      ["volume_profile", "tpo_profile"],
      ["volume_profile", "tpo_profile", "order_book_depth"],
    ] as const) {
      expect(getChartRightEdgeFraction(combo)).toBeLessThanOrEqual(PROFILE_LANES_MAX_TOTAL_FRACTION + 1e-9);
    }
  });
});
