// chart-time-ribbon-lanes.test.ts — Achado 2.6 (Visual Cleanup & Rendering
// Audit, 5ª rodada). Reclamação direta do Operador, SEGUNDA vez sobre o
// mesmo objeto: "aquelas outra vertical descendo... do mercado aberto
// fechado, ela não devia descer não, ela devia aparecer bem pequenininha
// só uma... não precisa poluir tanto o gráfico".
//
// KillZoneBandsPlugin desenhava `fillRect(x, 0, w, cssHeight)` + 2 bordas
// verticais de 0 a cssHeight — coluna âmbar atravessando todo o preço. A
// correção anterior (registrada no header do próprio plugin, com a mesma
// reclamação em outras palavras) mexeu só em QUANTAS ocorrências
// desenhavam, nunca na ALTURA — por isso a reclamação voltou.
//
// Mesma convenção mista de chart-profile-lanes.test.ts: a matemática pura
// das lanes ("os números estão certos e as faixas nunca se sobrepõem?")
// ganha execução real; a fiação nos 2 plugins ("esqueceram de ligar A com
// B / alguém voltou a desenhar de altura total?") ganha padrão de código.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  getTimeRibbonLaneTopPx,
  getTimeRibbonLaneHeightPx,
  getTimeRibbonLaneBottomPx,
  TIME_RIBBON_TOTAL_HEIGHT_PX,
  type ChartTimeRibbonLaneId,
} from "../src/chart/chart-time-ribbon-lanes";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

const ALL_LANES: ChartTimeRibbonLaneId[] = ["market_session", "kill_zone"];

describe("chart-time-ribbon-lanes: geometria real das faixas de contexto de tempo", () => {
  it("market_session preserva EXATAMENTE a geometria que já era real (y=0, 14px) — migrar para a lane não podia mudar nada nessa camada", () => {
    expect(getTimeRibbonLaneTopPx("market_session")).toBe(0);
    expect(getTimeRibbonLaneHeightPx("market_session")).toBe(14);
    expect(getTimeRibbonLaneBottomPx("market_session")).toBe(14);
  });

  it("kill_zone começa exatamente onde a faixa de sessões termina — zero pixel de sobreposição, zero buraco entre as duas", () => {
    expect(getTimeRibbonLaneTopPx("kill_zone")).toBe(getTimeRibbonLaneBottomPx("market_session"));
  });

  it('kill_zone é "bem pequenininha" de fato (pedido literal): 6px, menos da metade da faixa de sessões e abaixo da altura de uma caixa de rótulo (13px em nexus/canvas-label.ts) — não desenha rótulo por construção', () => {
    expect(getTimeRibbonLaneHeightPx("kill_zone")).toBe(6);
    expect(getTimeRibbonLaneHeightPx("kill_zone")).toBeLessThan(getTimeRibbonLaneHeightPx("market_session") / 2);
    expect(getTimeRibbonLaneHeightPx("kill_zone")).toBeLessThan(13);
  });

  it("nenhum par de lanes se sobrepõe — invariante real varrida sobre TODAS as combinações, não só o par de hoje (protege a próxima camada de tempo que for adicionada)", () => {
    for (const a of ALL_LANES) {
      for (const b of ALL_LANES) {
        if (a === b) continue;
        const aTop = getTimeRibbonLaneTopPx(a);
        const aBottom = getTimeRibbonLaneBottomPx(a);
        const bTop = getTimeRibbonLaneTopPx(b);
        const bBottom = getTimeRibbonLaneBottomPx(b);
        // Intervalos [top, bottom) disjuntos: um termina antes do outro começar.
        expect(aBottom <= bTop || bBottom <= aTop).toBe(true);
      }
    }
  });

  it("bottom é sempre top + height, para toda lane real — nunca uma 2ª aritmética no chamador", () => {
    for (const id of ALL_LANES) {
      expect(getTimeRibbonLaneBottomPx(id)).toBe(getTimeRibbonLaneTopPx(id) + getTimeRibbonLaneHeightPx(id));
    }
  });

  it("TIME_RIBBON_TOTAL_HEIGHT_PX é a soma real de todas as lanes (20px) e a faixa inteira ocupa uma fração ínfima de um painel real — nunca mais 100% da altura", () => {
    expect(TIME_RIBBON_TOTAL_HEIGHT_PX).toBe(ALL_LANES.reduce((s, id) => s + getTimeRibbonLaneHeightPx(id), 0));
    expect(TIME_RIBBON_TOTAL_HEIGHT_PX).toBe(20);
    // Painel real típico do app (ChartWidget num iPad/desktop): a faixa
    // inteira fica em ~4% da altura. Antes, SÓ a Kill Zone usava 100%.
    const realisticPanelHeightPx = 520;
    expect(TIME_RIBBON_TOTAL_HEIGHT_PX / realisticPanelHeightPx).toBeLessThan(0.05);
  });

  it("fail-closed: id não cadastrado devolve 0 em vez de NaN/undefined — mesmo contrato de getProfileLaneOffsetFraction (chart-profile-lanes.ts)", () => {
    const unknown = "camada_que_nao_existe" as ChartTimeRibbonLaneId;
    expect(getTimeRibbonLaneHeightPx(unknown)).toBe(0);
    expect(getTimeRibbonLaneTopPx(unknown)).toBe(0);
    expect(getTimeRibbonLaneBottomPx(unknown)).toBe(0);
  });
});

describe("Achado 2.6: os 2 plugins de tempo consomem a lane, nunca mais um número local", () => {
  const killZones = () => read("../src/chart/KillZoneBandsPlugin.tsx");
  const sessions = () => read("../src/chart/MarketSessionBandsPlugin.tsx");

  it("KillZoneBandsPlugin: regressão travada — zero desenho de altura total (o bug que o Operador reclamou 2x)", () => {
    const s = killZones();
    expect(s).not.toMatch(/fillRect\(clippedX, 0, clippedWidth, cssHeight\)/);
    expect(s).not.toMatch(/lineTo\([^)]*, cssHeight\)/);
    expect(s).not.toMatch(/moveTo\([^)]*, 0\)\s*;[\s\S]{0,80}cssHeight/);
  });

  it("KillZoneBandsPlugin: preenchimento e bordas vivem dentro da própria lane (laneTop/laneBottom/laneHeight reais)", () => {
    const s = killZones();
    expect(s).toContain('const laneTop = getTimeRibbonLaneTopPx("kill_zone");');
    expect(s).toContain('const laneBottom = getTimeRibbonLaneBottomPx("kill_zone");');
    expect(s).toContain('const laneHeight = getTimeRibbonLaneHeightPx("kill_zone");');
    expect(s).toContain("ctx.fillRect(clippedX, laneTop, clippedWidth, laneHeight);");
    expect(s).toContain("ctx.moveTo(Math.round(rectX) + 0.5, laneTop);");
    expect(s).toContain("ctx.lineTo(Math.round(rectX) + 0.5, laneBottom);");
  });

  it("KillZoneBandsPlugin: Fio de Seda intacto (Regra de Ouro 5) — 1px sólida, zero setLineDash, mesmo com a geometria nova", () => {
    const s = killZones();
    expect(s).toContain("ctx.lineWidth = 1;");
    expect(s).not.toMatch(/\.setLineDash\(/);
  });

  it("KillZoneBandsPlugin: o dado real continua computado por inteiro (Regra de Ouro 4) — só o desenho encolheu, computeKillZoneSpans e o decaimento por idade seguem iguais", () => {
    const s = killZones();
    expect(s).toContain("spans = computeKillZoneSpans(dataRef.current);");
    expect(s).toContain("const alpha = ageAlpha(age, KILL_ZONE_DECAY);");
    expect(s).toContain("export const KILL_ZONE_DECAY: DecayConfig = { fadeStartCandles: 50, expireCandles: 200, minAlpha: 0.12 };");
  });

  it("KillZoneBandsPlugin: o rótulo saiu junto com a altura — drawCanvasLabel não é mais importado (era duplicação literal do badge do header, App.tsx)", () => {
    const s = killZones();
    expect(s).not.toContain("drawCanvasLabel");
    expect(s).not.toContain("MIN_LABEL_WIDTH_PX");
  });

  it("MarketSessionBandsPlugin: passou a ler a mesma fonte de geometria, sem mudar nenhum valor real (continua y=0/14px)", () => {
    const s = sessions();
    expect(s).toContain('import { getTimeRibbonLaneTopPx, getTimeRibbonLaneHeightPx } from "./chart-time-ribbon-lanes";');
    expect(s).toContain('const BAND_TOP_PX = getTimeRibbonLaneTopPx("market_session");');
    expect(s).toContain('const BAND_HEIGHT_PX = getTimeRibbonLaneHeightPx("market_session");');
    expect(s).toContain("ctx.fillRect(clippedX, BAND_TOP_PX, clippedWidth, BAND_HEIGHT_PX);");
    expect(s).toContain("ctx.lineTo(Math.round(rectX) + 0.5, BAND_TOP_PX + BAND_HEIGHT_PX);");
  });
});
