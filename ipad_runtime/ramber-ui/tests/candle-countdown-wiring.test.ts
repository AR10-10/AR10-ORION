// candle-countdown-wiring.test.ts — achado real do Operador ("não mostra
// quanto tempo um [candle de] 1 minuto tá mostrando"). Convenção mista já
// estabelecida (CLAUDE.md): a matemática real (nexus/candle-countdown.ts)
// já ganhou teste de execução real em candle-countdown.test.ts; este
// arquivo trava só a FIAÇÃO — que o badge existe, lê o candle real certo,
// tem seu próprio tick de 1s isolado (nunca um segundo setInterval global
// nem um recálculo do resto da árvore), e está montado no cabeçalho do
// gráfico ao lado do OHLC/seletor de timeframe.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const app = readFileSync(join(__dirname, "../src/App.tsx"), "utf8");

function badgeBlock(): string {
  const start = app.indexOf("function CandleCountdownBadge(");
  expect(start).toBeGreaterThan(-1);
  const end = app.indexOf("function OhlcReadout(", start);
  expect(end).toBeGreaterThan(start);
  return app.slice(start, end);
}

describe("CandleCountdownBadge: motor real, zero segundo cálculo", () => {
  it("importa computeCandleCountdown de nexus/candle-countdown.ts — nunca reimplementa a aritmética", () => {
    expect(app).toContain('import { computeCandleCountdown } from "./nexus/candle-countdown";');
    expect(badgeBlock()).toContain("computeCandleCountdown(last?.time, timeframe, nowMs)");
  });

  it("lê o último candle do MESMO array `candles` recebido via prop — nunca um segundo fetch/estado", () => {
    const block = badgeBlock();
    expect(block).toContain("candles[candles.length - 1]");
    expect(block).not.toContain("useContext");
    expect(block).not.toContain("livePrice");
  });

  it("fail-closed: sem contagem real (candle/timeframe ausente), não renderiza nada", () => {
    expect(badgeBlock()).toContain("if (!countdown) return null;");
  });

  it("tick de 1s LOCAL a este componente (mesmo padrão de FooterBar/DataFreshnessBanner) — nunca um segundo relógio global", () => {
    const block = badgeBlock();
    expect(block).toContain("setInterval(() => setNowMs(Date.now()), 1000)");
    expect(block).toContain("clearInterval(id)");
  });

  it("escondido em telas muito estreitas (sm:) pra nunca espremer o seletor de timeframe no iPad Mini", () => {
    expect(badgeBlock()).toContain("hidden sm:flex");
  });
});

describe("CandleCountdownBadge: montado no cabeçalho do gráfico, entre OHLC e o seletor de timeframe", () => {
  it("<ChartWidget> passa chartData/chartTimeframe reais — o MESMO par que o gráfico e o seletor já usam", () => {
    const idx = app.indexOf("<CandleCountdownBadge");
    expect(idx, "<CandleCountdownBadge> não encontrado no JSX").toBeGreaterThan(-1);
    const tag = app.slice(idx, idx + 120);
    expect(tag).toContain("candles={chartData}");
    expect(tag).toContain("timeframe={chartTimeframe}");
    // Depois de OhlcReadout, antes do seletor de timeframe (CHART_TIMEFRAMES.map) — mesma ordem de leitura: OHLC → contagem → timeframe.
    const ohlcIdx = app.indexOf("<OhlcReadout candles={chartData} hoverCandle={hoveredCandle} />");
    const timeframeSelectorIdx = app.indexOf("{CHART_TIMEFRAMES.map((tf) =>");
    expect(ohlcIdx).toBeGreaterThan(-1);
    expect(idx).toBeGreaterThan(ohlcIdx);
    expect(timeframeSelectorIdx).toBeGreaterThan(idx);
  });
});
