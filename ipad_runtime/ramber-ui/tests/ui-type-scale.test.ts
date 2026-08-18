// A escala tipográfica do DOM vive em CSS, então o teste lê o CSS real e
// prova as duas coisas que importam: (a) o PISO de legibilidade existe e é
// 10px em qualquer tela; (b) o controle interativo que o Operador citou
// nominalmente foi mesmo migrado.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../src/index.css"), "utf8");
const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");

/** Extrai o mínimo real de um clamp(min, pref, max) — o piso da faixa. */
function clampFloorPx(varName: string): number {
  const m = css.match(new RegExp(`${varName}:\\s*clamp\\(\\s*([0-9.]+)px`));
  if (!m) throw new Error(`token ${varName} não encontrado em index.css`);
  return Number(m[1]);
}
function clampCeilPx(varName: string): number {
  const m = css.match(new RegExp(`${varName}:\\s*clamp\\([^)]*?,\\s*([0-9.]+)px\\s*\\)`));
  if (!m) throw new Error(`teto de ${varName} não encontrado em index.css`);
  return Number(m[1]);
}

const DEGRAUS = ["--ar10-t-micro", "--ar10-t-label", "--ar10-t-body", "--ar10-t-read"] as const;

describe("escala tipográfica do DOM — o piso de legibilidade", () => {
  it("os 4 degraus existem e são todos clamp() (responsivos, não congelados)", () => {
    for (const v of DEGRAUS) {
      expect(css).toMatch(new RegExp(`${v}:\\s*clamp\\(`));
    }
  });

  it("NENHUM degrau desce abaixo de 10px, em nenhuma viewport", () => {
    // Este é o número que muda a experiência. O defeito medido era 0.45rem
    // (7.2px) num controle interativo, e 0.3rem (4.8px) no menor caso.
    for (const v of DEGRAUS) {
      expect(clampFloorPx(v), v).toBeGreaterThanOrEqual(10);
    }
  });

  it("a escala é monotônica: cada degrau é maior que o anterior", () => {
    for (let i = 1; i < DEGRAUS.length; i++) {
      expect(clampFloorPx(DEGRAUS[i])).toBeGreaterThan(clampFloorPx(DEGRAUS[i - 1]));
      expect(clampCeilPx(DEGRAUS[i])).toBeGreaterThan(clampCeilPx(DEGRAUS[i - 1]));
    }
  });

  it("cada degrau cresce com a tela (teto > piso), nunca encolhe", () => {
    for (const v of DEGRAUS) {
      expect(clampCeilPx(v), v).toBeGreaterThan(clampFloorPx(v));
    }
  });

  it("as 4 classes utilitárias existem e apontam para os tokens", () => {
    for (const v of DEGRAUS) {
      const classe = v.replace("--ar10-t-", ".ar10-t-");
      expect(css).toMatch(new RegExp(`\\${classe}\\s*\\{\\s*font-size:\\s*var\\(${v}\\);`));
    }
  });
});

describe("seletor de timeframe — o item citado nominalmente pelo Operador", () => {
  it("não usa mais o corpo de 7.2px", () => {
    const bloco = app.slice(app.indexOf("CHART_TIMEFRAMES.map") - 1400, app.indexOf("CHART_TIMEFRAMES.map"));
    expect(bloco).not.toMatch(/text-\[0\.45rem\][^\n]*max-w-\[160px\]/);
  });

  it("o container do seletor usa .ar10-t-body (o degrau de controle interativo)", () => {
    expect(app).toMatch(/className="ar10-t-body flex items-center gap-0\.5 max-w-\[220px\]/);
  });

  it("o alvo de toque cresceu junto com o texto (texto maior em botão apertado seria meia correção)", () => {
    // px-1 py-0.5 era o padding antigo; px-1.5 py-1 é o novo.
    const botao = app.slice(app.indexOf("CHART_TIMEFRAMES.map"), app.indexOf("CHART_TIMEFRAMES.map") + 1400);
    expect(botao).toMatch(/shrink-0 px-1\.5 py-1 rounded transition-colors/);
  });

  it("a largura máxima subiu para o número de opções visíveis não cair", () => {
    // 14 timeframes reais: com fonte maior e a largura antiga, menos opções
    // caberiam antes da rolagem — seria trocar um defeito por outro.
    expect(app).toMatch(/max-w-\[220px\] sm:max-w-\[340px\]/);
  });
});
