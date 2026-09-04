import { describe, expect, it } from 'vitest';
import {
  computeViewportCandles,
  MAX_VIEWPORT_CANDLES,
  MIN_VIEWPORT_CANDLES,
  TARGET_PX_PER_CANDLE,
} from '../src/nexus/chart-viewport';

// Execução real (não padrão de fonte): a Ordem "FECHAMENTO DO AR10
// CYBORG" §5 pede uma janela de 60-200 velas adaptada ao espaço real.
// O bug mais provável aqui é matemático (a conta sair da faixa, ou
// enquadrar mais velas do que existem), então todo teste abaixo roda a
// função de verdade.
describe('Ordem FECHAMENTO §5: janela de candles adaptativa (substitui a constante fixa 120)', () => {
  it('a faixa declarada é exatamente a que a Ordem pediu (60-200)', () => {
    expect(MIN_VIEWPORT_CANDLES).toBe(60);
    expect(MAX_VIEWPORT_CANDLES).toBe(200);
  });

  // Larguras REAIS de área de plotagem medidas neste projeto (ver o
  // harness Playwright da Entrega 31: painel do gráfico ~1052px num
  // viewport de 1180 no iPad Air, descontadas as réguas de navegação).
  it('viewports reais produzem enquadres distintos — o defeito que a Ordem apontou era o MESMO 120 em todos', () => {
    const abundant = 5000; // histórico farto: a densidade de dados não limita
    const ipadMini = computeViewportCandles({ widthPx: 700, availableCandles: abundant });
    const ipadAir = computeViewportCandles({ widthPx: 1052, availableCandles: abundant });
    const desktop = computeViewportCandles({ widthPx: 1750, availableCandles: abundant });

    expect(ipadMini).toBe(100); // 700/7
    expect(ipadAir).toBe(150); // 1052/7 = 150,28 -> 150
    expect(desktop).toBe(200); // 1750/7 = 250 -> teto real da faixa

    // a propriedade que importa: telas maiores nunca mostram MENOS velas
    expect(ipadMini).toBeLessThan(ipadAir);
    expect(ipadAir).toBeLessThanOrEqual(desktop);
  });

  it('a densidade por vela fica na faixa legível real em cada viewport (é a razão de ser do TARGET_PX_PER_CANDLE)', () => {
    for (const widthPx of [700, 900, 1052, 1400, 1750]) {
      const n = computeViewportCandles({ widthPx, availableCandles: 5000 });
      const pxPerCandle = widthPx / n;
      expect(pxPerCandle).toBeGreaterThanOrEqual(4); // abaixo disso a vela vira traço
      expect(pxPerCandle).toBeLessThanOrEqual(12); // acima disso lê como "poucos dados"
    }
  });

  it('teto real: tela muito larga não passa de 200 velas (nunca um gráfico ilegível de tão comprimido)', () => {
    expect(computeViewportCandles({ widthPx: 3840, availableCandles: 5000 })).toBe(MAX_VIEWPORT_CANDLES);
  });

  it('piso real: painel estreito não desce de 60 velas (nunca um gráfico sem contexto de tendência)', () => {
    expect(computeViewportCandles({ widthPx: 300, availableCandles: 5000 })).toBe(MIN_VIEWPORT_CANDLES);
  });

  it('densidade de dados real: nunca enquadra mais velas do que existem — enquadrar o vazio comprime as velas reais contra a borda (defeito listado na própria §5)', () => {
    // desktop pediria 200, mas só existem 80 velas reais
    expect(computeViewportCandles({ widthPx: 1750, availableCandles: 80 })).toBe(80);
    // e mesmo abaixo do piso da faixa: 40 velas reais nunca viram 60
    expect(computeViewportCandles({ widthPx: 1750, availableCandles: 40 })).toBe(40);
  });

  it('fail-closed: largura ainda não medida (0/NaN no primeiro render, antes do ResizeObserver) cai no piso — nunca NaN, nunca enquadre absurdo', () => {
    expect(computeViewportCandles({ widthPx: 0, availableCandles: 5000 })).toBe(MIN_VIEWPORT_CANDLES);
    expect(computeViewportCandles({ widthPx: Number.NaN, availableCandles: 5000 })).toBe(MIN_VIEWPORT_CANDLES);
    expect(computeViewportCandles({ widthPx: -100, availableCandles: 5000 })).toBe(MIN_VIEWPORT_CANDLES);
  });

  it('fail-closed: série ainda vazia/não-finita não trava o enquadre em zero — devolve a janela por largura, e o chamador só aplica quando há dado real', () => {
    expect(computeViewportCandles({ widthPx: 1052, availableCandles: 0 })).toBe(150);
    expect(computeViewportCandles({ widthPx: 1052, availableCandles: Number.NaN })).toBe(150);
  });

  it('sempre inteiro (é índice lógico de barra na lightweight-charts — fração produziria enquadre borrado)', () => {
    for (const widthPx of [333, 701, 1051, 1237]) {
      const n = computeViewportCandles({ widthPx, availableCandles: 4321 });
      expect(Number.isInteger(n)).toBe(true);
    }
    expect(Number.isInteger(computeViewportCandles({ widthPx: 1750, availableCandles: 87.6 }))).toBe(true);
  });

  it('monotônica em largura: nenhum ponto da faixa faz a janela ENCOLHER quando a tela cresce', () => {
    let prev = 0;
    for (let w = 100; w <= 3000; w += 25) {
      const n = computeViewportCandles({ widthPx: w, availableCandles: 5000 });
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });

  it('o alvo declarado de px por vela é o que a conta realmente usa (regressão: mudar a constante muda o enquadre)', () => {
    const widthPx = TARGET_PX_PER_CANDLE * 130; // dentro da faixa, longe dos limites
    expect(computeViewportCandles({ widthPx, availableCandles: 5000 })).toBe(130);
  });
});
