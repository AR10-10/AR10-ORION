// Fiação: o bug provável aqui é "a fonte foi declarada mas lê um campo que
// não existe" ou "alguém transformou o consenso numa segunda decisão".
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");
const engineJs = readFileSync(resolve(__dirname, "../../js/research/research-engine.js"), "utf8");
const matrix = readFileSync(resolve(__dirname, "../../js/research/trade-setup-matrix.js"), "utf8");

describe("as 7 fontes direcionais leem campos REAIS já resolvidos", () => {
  const fontes: Array<[string, RegExp]> = [
    ["Estrutura", /normalizeSide\(engine\.marketStructureLabel\)/],
    ["Regime", /normalizeSide\(engine\.marketRegime\?\.direction \?\? null\)/],
    ["HTF", /normalizeSide\(engine\.htfMarketStructureLabel\)/],
    ["Conselho", /normalizeSide\(councilFromSnapshot\?\.stance \?\? null\)/],
    ["Lorentziano", /normalizeSide\(realCycle\?\.lorentzian\?\.classification \?\? null\)/],
    ["CVD", /sideFromSigned\(num\(cvd\) \? cvd : null\)/],
    ["Livro", /sideFromSigned\(engine\.imbalance, 0\.05\)/],
  ];

  for (const [nome, re] of fontes) {
    it(`${nome} vem de um campo real, nunca recalculado na UI`, () => {
      expect(app).toMatch(re);
    });
  }

  it("o Núcleo entra como REFERÊNCIA, nunca como uma das fontes", () => {
    // Se engine.direction aparecesse dentro do array de sources, ele estaria
    // votando em si mesmo — o alinhamento sairia inflado por construção.
    const bloco = app.slice(
      app.indexOf("const directionalConsensus = useMemo("),
      app.indexOf("return computeDirectionalConsensus("),
    );
    expect(bloco.length).toBeGreaterThan(100);
    expect(bloco).not.toMatch(/side:\s*normalizeSide\(engine\.direction\)/);
    expect(app).toMatch(/return computeDirectionalConsensus\(normalizeSide\(engine\.direction\), sources\)/);
  });

  it("cada fonte declara O QUE mede — a informação que faltava e gerava a dúvida", () => {
    // "BID 54%" ao lado de um badge SHORT só parece contradição enquanto o
    // Operador não sabe que um é liquidez PARADA e o outro é viés de tendência.
    expect(app).toMatch(/liquidez PARADA no livro/);
    expect(app).toMatch(/nunca uma probabilidade calibrada/);
    expect(app).toMatch(/nunca em consolidação/);
  });

  it("a zona morta do livro existe (ruído não vira voto)", () => {
    expect(app).toMatch(/sideFromSigned\(engine\.imbalance, 0\.05\)/);
  });
});

describe("o painel chega à tela e é honesto", () => {
  it("existe e está montado na gaveta Market Intelligence", () => {
    expect(app).toMatch(/function DirectionalSyncPanel\(\)/);
    expect(app).toMatch(/<DirectionalSyncPanel \/>/);
  });

  it("aparece ANTES dos outros widgets da gaveta (é a leitura de entrada)", () => {
    const painel = app.indexOf("<DirectionalSyncPanel />");
    const direcao = app.indexOf("<MarketDirectionWidget />");
    expect(painel).toBeGreaterThan(-1);
    expect(painel).toBeLessThan(direcao);
  });

  it("fail-closed: sem leitura real não renderiza zeros", () => {
    expect(app).toMatch(/if \(!r \|\| r\.status !== "OK"\) return null;/);
  });

  it("mostra o denominador REAL (alinhadas/reportando), nunca um percentual solto", () => {
    // "{r.aligned}/{r.reporting}" é auto-explicativo; um "71%" sozinho
    // esconderia que só 7 de 7 fontes falaram — ou que só 3 falaram.
    expect(app).toMatch(/\{r\.aligned\}\/\{r\.reporting\}/);
  });

  it("a frase honesta do motor chega ao tooltip", () => {
    expect(app).toMatch(/title=\{describeDirectionalConsensus\(r\)\}/);
  });

  it("o ✗ nunca aparece quando não há referência (seria lido como discordância)", () => {
    expect(app).toMatch(/s\.agrees === true \? "✓" : s\.agrees === false \? "✗" : "·"/);
  });
});

describe("mapa de liquidez: acima e abaixo", () => {
  it("usa a borda que o preço encontra PRIMEIRO, não sempre o mesmo lado", () => {
    // Usar sempre z.top (ou sempre z.bottom) daria distância sistematicamente
    // errada em metade dos casos — erro sutil e invisível na tela.
    expect(app).toMatch(/const edge = z\.bottom > price \? z\.bottom : z\.top;/);
  });

  it("só zonas NÃO mitigadas e pools NÃO varridos entram", () => {
    expect(app).toMatch(/if \(z\.mitigated\) continue;/);
    expect(app).toMatch(/if \(z\.swept \|\| !Number\.isFinite\(z\.price\)\) continue;/);
  });

  it("as 4 famílias reais de zona entram no mapa", () => {
    for (const kind of ['"FVG"', '"OB"', '"VOID"', '"POOL"']) {
      expect(app, kind).toContain(kind);
    }
  });

  it("mostra contagem E distância dos dois lados, com seta de direção", () => {
    expect(app).toMatch(/▲ LIQ/);
    expect(app).toMatch(/LIQ ▼/);
    expect(app).toMatch(/liq\.above\.distancePercent/);
    expect(app).toMatch(/liq\.below\.distancePercent/);
  });

  it("o viés de liquidez é declarado como NÃO-previsão", () => {
    expect(app).toMatch(/nunca uma previsão de para onde o preço vai/);
  });
});

describe("LEI 24 — o consenso nunca vira decisão", () => {
  it("nenhuma linha que menciona o consenso atribui direção/sinal/plano", () => {
    const linhas = app
      .split("\n")
      .filter((l) => l.includes("directionalConsensus") || l.includes("liquidityMap"));
    expect(linhas.length).toBeGreaterThan(0);
    for (const linha of linhas) {
      expect(linha).not.toMatch(/\b(setDirection|direction\s*=[^=]|signal\s*=[^=]|setSignal|tradePlan\s*=[^=])/);
    }
  });

  it("o Core Engine continua sendo o único emissor — nada em js/ importa o módulo", () => {
    expect(engineJs).not.toMatch(/directional-consensus/);
    expect(matrix).not.toMatch(/directional-consensus/);
  });

  it("trendBias continua intocada — a fronteira real não mudou", () => {
    expect(engineJs).toMatch(/frame\.last_price\s*>\s*frame\.sma\s*&&\s*frame\.ema\s*>=\s*frame\.sma/);
    expect(matrix).toMatch(/signal:\s*'LONG'/);
    expect(matrix).toMatch(/signal:\s*'SHORT'/);
  });
});
