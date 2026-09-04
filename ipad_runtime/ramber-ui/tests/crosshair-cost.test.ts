// Custo real do crosshair — o caminho mais quente do gráfico.
//
// PEDIDO DO OPERADOR (duas frases da mesma mensagem, sobre a mesma coisa):
// "aquela linha que a gente coisa com mouse, ela também tem que ficar bem
// levezinha" e "não pode ter delay com a sincronização, tempo real".
//
// MEDIÇÃO QUE ORIGINOU ESTE ARQUIVO. O handler de `subscribeCrosshairMove`
// era:
//
//     const hovered = data.find((c) => c.time === hoveredTime);
//     onHoverCandleChange(hovered ?? null);
//
// `subscribeCrosshairMove` dispara na taxa do PONTEIRO — dezenas de eventos
// por segundo num trackpad, contínuo durante um arraste com o dedo no iPad.
// Três custos empilhados por evento:
//
//   1. varredura LINEAR de todo o array de candles;
//   2. `onHoverCandleChange` chamado SEMPRE, inclusive quando o candle sob o
//      cursor não mudou — cada chamada é um setState no App.tsx, um único
//      componente de ~12.000 linhas, reconciliando a árvore inteira para
//      exibir exatamente os mesmos números;
//   3. `data` no dep array: assinar/desassinar a cada tick.
//
// Estes testes não medem FPS (não há dispositivo aqui). Travam as três
// CONDIÇÕES ESTRUTURAIS que tornam o caminho barato — se qualquer uma se
// perder, o "delay" volta sem nenhum teste vermelho avisando.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const chart = () =>
  readFileSync(resolve(__dirname, "../src/chart/EnhancedChart_110_Percent.tsx"), "utf-8");

/** Corpo do efeito que assina o crosshair. */
const handlerBlock = (): string => {
  const src = chart();
  const i = src.indexOf("chartReady.chart.subscribeCrosshairMove(handler);");
  expect(i, "assinatura do crosshair não encontrada").toBeGreaterThan(-1);
  const inicio = src.lastIndexOf("useEffect(() => {", i);
  return src.slice(inicio, i);
};

describe("busca do candle sob o cursor é O(1), nunca varredura por evento", () => {
  it("a varredura linear morreu", () => {
    expect(handlerBlock()).not.toMatch(/data\.find\(/);
  });

  it("existe um índice por tempo, construído fora do handler", () => {
    const src = chart();
    expect(src).toContain("hoverDataRef");
    expect(src).toContain("new Map<number, EnhancedChartCandle>()");
    // O índice é reconstruído quando `data` muda — nunca por evento.
    expect(src).toMatch(/hoverDataRef\.current\.index = index;[\s\S]{0,400}\}, \[data\]\);/);
  });

  it("o handler consulta o índice, não o array", () => {
    expect(handlerBlock()).toContain("estado.index.get(hoveredTime)");
  });
});

describe("guarda de identidade — mover dentro do mesmo candle não custa nada", () => {
  it("evento com o mesmo tempo sai antes de notificar", () => {
    const bloco = handlerBlock();
    expect(bloco).toContain("if (hoveredTime === estado.ultimoTime) return;");
  });

  it("sair da área do gráfico duas vezes seguidas também não notifica duas vezes", () => {
    expect(handlerBlock()).toContain("if (estado.ultimoTime === null) return;");
  });

  it("um tick no candle ao vivo invalida a guarda — o header nunca congela", () => {
    // Sem isto, o candle ao vivo receberia ticks e a guarda impediria o
    // consumidor de ver os valores novos: leveza virando dado velho.
    expect(chart()).toContain("hoverDataRef.current.ultimoTime = null;");
  });
});

describe("a assinatura não é refeita a cada tick", () => {
  it("`data` saiu do dep array do efeito que assina", () => {
    const src = chart();
    const i = src.indexOf("chartReady.chart.unsubscribeCrosshairMove(handler);");
    expect(i).toBeGreaterThan(-1);
    const deps = src.slice(i, src.indexOf("]);", i) + 3);
    expect(deps).toContain("[chartReady, onHoverCandleChange]");
    expect(deps).not.toContain("data]");
  });
});

describe('a linha do cursor ficou "bem levezinha" — pedido literal do Operador', () => {
  it("a cor da linha é translúcida, não o cinza opaco de antes", () => {
    const src = chart();
    expect(src).toContain("const CROSSHAIR_LINE_COLOR = \"rgba(117, 134, 150, 0.42)\"");
    expect(src).not.toContain('vertLine: { color: "#758696"');
    expect(src).not.toContain('horzLine: { color: "#758696"');
  });

  it("as duas linhas usam a MESMA constante — nunca uma clarinha e outra não", () => {
    const src = chart();
    expect(src).toContain("vertLine: { color: CROSSHAIR_LINE_COLOR, width: 1");
    expect(src).toContain("horzLine: { color: CROSSHAIR_LINE_COLOR, width: 1");
  });

  it("Fio de Seda: continua 1px sólida — leveza veio da cor, nunca de tracejado", () => {
    const src = chart();
    const i = src.indexOf("crosshair: {");
    const bloco = src.slice(i, src.indexOf("},", src.indexOf("horzLine", i)));
    expect(bloco).toContain("width: 1");
    expect(bloco).toContain("style: LineStyle.Solid");
    expect(bloco).not.toContain("LineStyle.Dashed");
    expect(bloco).not.toContain("LineStyle.Dotted");
  });

  it("o RÓTULO do crosshair continua opaco — leveza na linha, nunca no número", () => {
    // Um rótulo translúcido sobre velas seria ilegível, e é nele que o
    // Operador lê o preço/hora exatos ao medir um nível.
    const src = chart();
    const i = src.indexOf("crosshair: {");
    const bloco = src.slice(i, src.indexOf("},", src.indexOf("horzLine", i)));
    expect(bloco).toContain('labelBackgroundColor: "#131722"');
  });
});
