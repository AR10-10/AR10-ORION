// Fiação (convenção do CLAUDE.md: aqui o bug provável é "esqueceram de
// conectar A com B", então o teste é de padrão no código-fonte real).
//
// O que estes testes travam, em ordem de importância:
//   1. os 3 números que DECIDEM o sinal saem mesmo do motor real e chegam
//      até a UI — o defeito clássico deste repositório é um campo computado
//      todo ciclo e descartado antes de chegar na tela;
//   2. a UI NÃO reimplementa a fronteira do Núcleo (seria uma 2ª decisão);
//   3. o badge está na âncora que nunca some por largura de tela;
//   4. LEI 24: nada daqui volta para o Core Engine.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");
const bridge = readFileSync(resolve(__dirname, "../src/engine-bridge.ts"), "utf8");
const engine = readFileSync(resolve(__dirname, "../../js/research/research-engine.js"), "utf8");
const frame = readFileSync(resolve(__dirname, "../../js/real-data/analysis-frame.js"), "utf8");

describe("cadeia real: analysis-frame → engine-bridge → App", () => {
  it("analysis-frame continua produzindo sma/ema (a origem real)", () => {
    expect(frame).toMatch(/^\s*sma:\s*result\.sma,/m);
    expect(frame).toMatch(/^\s*ema:\s*result\.ema,/m);
  });

  it("trendBias continua sendo a ÚNICA fronteira, e usa exatamente esses 3 campos", () => {
    // Se esta função mudar de forma, o motor de distância passa a medir uma
    // fronteira que não existe mais — é o teste que avisa.
    expect(engine).toMatch(/export function trendBias\(frame\)/);
    expect(engine).toMatch(/frame\.last_price\s*>\s*frame\.sma\s*&&\s*frame\.ema\s*>=\s*frame\.sma/);
    expect(engine).toMatch(/frame\.last_price\s*<\s*frame\.sma\s*&&\s*frame\.ema\s*<=\s*frame\.sma/);
  });

  it("engine-bridge declara E repassa sma/ema (declarar sem repassar é o bug clássico)", () => {
    expect(bridge).toMatch(/^\s*sma\?:\s*number\s*\|\s*null;/m);
    expect(bridge).toMatch(/^\s*ema\?:\s*number\s*\|\s*null;/m);
    expect(bridge).toMatch(/^\s*sma:\s*isNum\(frame\.sma\)\s*\?\s*frame\.sma\s*:\s*null,/m);
    expect(bridge).toMatch(/^\s*ema:\s*isNum\(frame\.ema\)\s*\?\s*frame\.ema\s*:\s*null,/m);
  });

  it("App lê os 3 do realCycle, incluindo o FECHAMENTO (não o ticker ao vivo)", () => {
    // A armadilha real: comparar o preço do ticker contra uma SMA de
    // fechamentos daria uma distância sutilmente errada. lastClose vem da
    // MESMA série que a SMA.
    expect(app).toMatch(/lastClose:\s*cycleOk\s*\?\s*\(realCycle\?\.lastPrice\s*\?\?\s*null\)\s*:\s*null,/);
    expect(app).toMatch(/sma:\s*cycleOk\s*\?\s*\(realCycle\?\.sma\s*\?\?\s*null\)\s*:\s*null,/);
    expect(app).toMatch(/ema:\s*cycleOk\s*\?\s*\(realCycle\?\.ema\s*\?\?\s*null\)\s*:\s*null,/);
  });

  it("a leitura é memoizada sobre os 3 campos reais, não recalculada a cada render", () => {
    expect(app).toMatch(/computeDecisionDistance\(\{[\s\S]{0,600}?lastPrice:\s*engine\.lastClose/);
    expect(app).toMatch(/computeDecisionDistance\(\{[\s\S]{0,600}?sma:\s*engine\.sma/);
    expect(app).toMatch(/computeDecisionDistance\(\{[\s\S]{0,600}?ema:\s*engine\.ema/);
    // O ATR real entra pela MESMA fonte única do Market Regime Engine.
    expect(app).toMatch(/atrPercent:\s*engine\.marketRegime\?\.atrPercent\s*\?\?\s*null/);
    expect(app).toMatch(
      /\[engine\.lastClose,\s*engine\.sma,\s*engine\.ema,\s*engine\.marketRegime\?\.atrPercent\]/,
    );
  });
});

describe("a UI não reimplementa a fronteira (uma decisão, nunca duas)", () => {
  it("App não compara sma/ema por conta própria em nenhum lugar", () => {
    // Qualquer comparação direta entre os dois campos na UI seria uma
    // segunda cópia da fronteira do Núcleo — exatamente o que este
    // repositório proíbe.
    expect(app).not.toMatch(/engine\.ema\s*[<>]=?\s*engine\.sma/);
    expect(app).not.toMatch(/engine\.sma\s*[<>]=?\s*engine\.ema/);
    expect(app).not.toMatch(/engine\.lastClose\s*[<>]=?\s*engine\.sma/);
  });

  it("o badge formata pelo motor, nunca com um toFixed próprio", () => {
    expect(app).toMatch(/formatDecisionDistance\(side\.gapPercent\)/);
  });
});

describe("o badge chega mesmo à tela, no lugar certo", () => {
  it("existe e está montado na TopBar", () => {
    expect(app).toMatch(/function DecisionDistanceBadge\(\)/);
    expect(app).toMatch(/<DecisionDistanceBadge \/>/);
  });

  it("fica na âncora DIREITA FIXA — a região que nunca entra no scroll", () => {
    // Medido por posição no arquivo: o badge tem que aparecer DEPOIS do
    // comentário que abre a âncora direita fixa e ANTES do NucleoVoiceOrb,
    // que é o "botão do microfone" citado pelo Operador.
    const ancora = app.indexOf("Âncora direita fixa");
    const badge = app.indexOf("<DecisionDistanceBadge />");
    const orbe = app.indexOf("<NucleoVoiceOrb />");
    expect(ancora).toBeGreaterThan(-1);
    expect(badge).toBeGreaterThan(ancora);
    expect(orbe).toBeGreaterThan(badge);
  });

  it("fail-closed: sem leitura real o badge some, nunca mostra 0%", () => {
    // Um "0%" sem dado seria a pior leitura possível — o Operador entenderia
    // "está colado no limiar".
    expect(app).toMatch(/if \(!reading \|\| reading\.status !== "OK"\) return null;/);
  });

  it("usa a escala tipográfica compartilhada, não mais um corpo ad-hoc", () => {
    expect(app).toMatch(/className="ar10-t-micro font-bold tracking-wider"/);
    expect(app).toMatch(/className="ar10-t-label font-black font-mono tabular-nums"/);
  });

  it("a frase honesta do motor chega ao Operador (tooltip), não fica órfã", () => {
    expect(app).toMatch(/title=\{describeDecisionDistance\(reading, which\)\}/);
  });
});

describe("LEI 24 — display-only", () => {
  it("decisionDistance nunca é lido por nada que produza uma decisão", () => {
    // Varre TODA linha que menciona decisionDistance e prova que nenhuma
    // atribui direção/sinal/plano. É a checagem que impede este medidor de
    // virar, num commit futuro, uma segunda fonte de LONG/SHORT.
    const linhas = app.split("\n").filter((l) => l.includes("decisionDistance"));
    expect(linhas.length).toBeGreaterThan(0);
    for (const linha of linhas) {
      expect(linha).not.toMatch(/\b(setDirection|direction\s*=|signal\s*=|setSignal|tradePlan\s*=)/);
    }
  });

  it("o Core Engine (js/) não importa nada do medidor", () => {
    expect(engine).not.toMatch(/^\s*(import|require)[^\n]*decision-distance/m);
    expect(frame).not.toMatch(/^\s*(import|require)[^\n]*decision-distance/m);
  });
});
