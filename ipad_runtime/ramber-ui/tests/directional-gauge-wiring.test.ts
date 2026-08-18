// Fiação do anel/gauge dentro de DirectionalSyncPanel — "constrói uma bola...
// um só aparece, tipo longa ou short, com essa porcentagem, bem
// profissional" (pedido direto do Operador). O bug mais provável aqui é "o
// componente virou uma SEGUNDA leitura de direção" ou "os dois lados
// aparecem ao mesmo tempo" — não "a matemática está errada" (isso já é
// coberto por tests/directional-gauge.test.ts, execução real sobre o motor
// puro). Por isso este arquivo é 100% varredura de padrão no código-fonte.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");

describe("DirectionalGaugeRing — o anel nunca é uma segunda fonte de direção", () => {
  it("existe e é montado dentro de DirectionalSyncPanel, antes do return do painel", () => {
    const painelIdx = app.indexOf("function DirectionalSyncPanel()");
    const anelDeclIdx = app.indexOf("function DirectionalGaugeRing(");
    const anelUsoIdx = app.indexOf("<DirectionalGaugeRing reading={gaugeReading} />");
    expect(anelDeclIdx, "DirectionalGaugeRing não encontrado").toBeGreaterThan(-1);
    expect(painelIdx, "DirectionalSyncPanel não encontrado").toBeGreaterThan(-1);
    // O componente é declarado ANTES do painel que o usa (mesma ordem de
    // leitura de qualquer outro helper deste arquivo).
    expect(anelDeclIdx).toBeLessThan(painelIdx);
    expect(anelUsoIdx).toBeGreaterThan(painelIdx);
  });

  it("a leitura do anel vem de computeGaugeReading(r) — a MESMA leitura de directionalConsensus, zero segunda fonte", () => {
    expect(app).toMatch(/const gaugeReading = computeGaugeReading\(r\);/);
    // Nunca um segundo useMemo/cálculo de consenso só para o anel.
    const bloco = app.slice(
      app.indexOf("function DirectionalSyncPanel()"),
      app.indexOf("<DirectionalGaugeRing reading={gaugeReading} />"),
    );
    expect(bloco).not.toMatch(/computeDirectionalConsensus\(/);
  });

  it("mostra só o percentual formatado (formatGaugePercent) e a seta canônica (directionArrow) — nunca um número/glifo inventado na UI", () => {
    const anel = app.slice(app.indexOf("function DirectionalGaugeRing("), app.indexOf("function DirectionalSyncPanel()"));
    expect(anel).toMatch(/formatGaugePercent\(reading\.percent\)/);
    expect(anel).toMatch(/directionArrow\(reading\.side\)/);
  });

  it('só UM lado aparece por vez — o ramo "OK" mostra side/percent, o fail-closed mostra travessão, nunca os dois simultâneos', () => {
    const anel = app.slice(app.indexOf("function DirectionalGaugeRing("), app.indexOf("function DirectionalSyncPanel()"));
    expect(anel).toMatch(/reading\.status === "OK" \? `\$\{directionArrow\(reading\.side\)\} \$\{reading\.side\}` : "—"/);
    // O preenchimento colorido do anel também só desenha com leitura OK —
    // sem isso, ficaria um arco cheio "por acidente" sem direção real.
    expect(anel).toMatch(/\{reading\.status === "OK" && \(/);
  });

  it("a cor do preenchimento vem de reading.color (directionColor via directional-gauge.ts) — nunca um hex solto neste componente", () => {
    const anel = app.slice(app.indexOf("function DirectionalGaugeRing("), app.indexOf("function DirectionalSyncPanel()"));
    expect(anel).not.toMatch(/#00ffaa/);
    expect(anel).not.toMatch(/#ff0055/);
    expect(anel).toMatch(/stroke=\{reading\.color\}/);
  });

  it("o rótulo do anel repete a honestidade do módulo puro — nunca deixa a superfície bonita esconder o disclaimer", () => {
    const anel = app.slice(app.indexOf("function DirectionalGaugeRing("), app.indexOf("function DirectionalSyncPanel()"));
    expect(anel).toMatch(/NUNCA uma probabilidade calibrada de acerto do trade/);
  });

  it("a contagem exata (aligned/reporting) continua real e visível — o anel é apresentação nova, nunca substitui o dado bruto (Regra de Ouro 4)", () => {
    expect(app).toMatch(/\{r\.aligned\}\/\{r\.reporting\} fontes/);
  });
});

describe("liquidez: largura em ATR chega ao tooltip sem recalcular (formatZoneAtrWidth)", () => {
  it("computeZoneSignificance é chamado UMA vez por zona no mapa de liquidez — o resultado decide filtro E largura exibida", () => {
    const bloco = app.slice(app.indexOf("const liquidityMap = useMemo<LiquidityMapReading>("), app.indexOf("}, [smcZones, liquidityVoids, priceData?.price]);"));
    expect(bloco).toMatch(/const sig = computeZoneSignificance\(z\.top, z\.bottom, price, atrPercent\);/);
    expect(bloco).toMatch(/if \(!sig\.significant\) continue;/);
    expect(bloco).toMatch(/widthAtrUnits: sig\.widthAtrUnits/);
    // Nunca uma segunda chamada de computeZoneSignificance dentro do mesmo
    // laço além da já capturada em `sig` acima.
    const chamadas = bloco.match(/computeZoneSignificance\(/g) ?? [];
    expect(chamadas.length).toBe(1);
  });

  it("o tooltip de LIQ acima/abaixo usa formatZoneAtrWidth sobre o alvo mais próximo real, nunca uma zona qualquer", () => {
    expect(app).toMatch(/liq\.above\.nearest\.kind\} · \$\{formatZoneAtrWidth\(liq\.above\.nearest\.widthAtrUnits\)/);
    expect(app).toMatch(/liq\.below\.nearest\.kind\} · \$\{formatZoneAtrWidth\(liq\.below\.nearest\.widthAtrUnits\)/);
  });

  it("LiquidityTarget carrega widthAtrUnits como campo opcional — POOL nunca fabrica uma largura que não tem", () => {
    const consensus = readFileSync(resolve(__dirname, "../src/nexus/directional-consensus.ts"), "utf8");
    expect(consensus).toMatch(/widthAtrUnits\?: number \| null;/);
  });
});
