// chart-history-pagination.test.ts — Auditoria de arquitetura (revisão
// completa): trava a paginação histórica real do gráfico (achado: janela
// fixa de 200 candles, borda dura ao arrastar para trás, sem NENHUM
// caminho de carregar mais história). Duas partes: (1) as duas funções
// puras reais (mergeFreshTail em App.tsx, detectPrependCount em
// EnhancedChart_110_Percent.tsx) testadas por execução real, não só por
// padrão no código-fonte — a lógica de fronteira aqui é fácil de acertar
// errado silenciosamente; (2) padrão no código-fonte para a fiação real
// (nunca passa pelo Market Data Bus, dedupe, teto de memória).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mergeFreshTail, type ChartCandle } from '../src/App.tsx';
import { detectPrependCount, type EnhancedChartCandle } from '../src/chart/EnhancedChart_110_Percent';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const c = (time: number, close = 100): ChartCandle => ({ time, open: close, high: close, low: close, close, volume: 10 });

describe('mergeFreshTail: refresh periódico funde de volta, nunca apaga história paginada', () => {
  it('existing vazio: devolve fresh (primeira carga real)', () => {
    expect(mergeFreshTail([], [c(100)])).toEqual([c(100)]);
  });

  it('fresh vazio (falha real de rede não deveria nem chegar aqui, mas fail-closed): devolve fresh vazio, nunca inventa dado', () => {
    expect(mergeFreshTail([c(100)], [])).toEqual([]);
  });

  it('sem paginação (existing <= janela de fresh): comporta-se identico a um replace — zero mudança do caso comum', () => {
    const existing = [c(100), c(200)];
    const fresh = [c(100), c(200), c(300)];
    expect(mergeFreshTail(existing, fresh)).toEqual(fresh);
  });

  it('com paginação real: história MAIS ANTIGA que fresh é preservada, fresh é autoritativo a partir do seu próprio início', () => {
    const existing = [c(50), c(100), c(200)]; // 50 veio de uma página paginada
    const fresh = [c(100), c(200), c(300)]; // refresh periódico real, mesma janela de sempre
    expect(mergeFreshTail(existing, fresh)).toEqual([c(50), c(100), c(200), c(300)]);
  });

  it('corta pelo lado MAIS ANTIGO quando estoura o teto real (MAX_CHART_HISTORY=2000) — o mais recente nunca é descartado', () => {
    const existing = Array.from({ length: 1999 }, (_, i) => c(i)); // history real acumulada por paginação
    const fresh = [c(1999), c(2000), c(2001)]; // refresh periódico real: 1999 (overlap) + 2 candles novos
    const merged = mergeFreshTail(existing, fresh);
    expect(merged).toHaveLength(2000); // 1999 + 3 = 2002, cortado para o teto
    expect(merged[0].time).toBe(2); // os 2 mais antigos (time 0, 1) foram descartados
    expect(merged[merged.length - 1].time).toBe(2001); // o mais recente nunca é descartado
  });
});

describe('detectPrependCount: só reconhece um prepend real e limpo — nunca um falso positivo', () => {
  it('prev vazio ou next mais curto/igual: 0 (nunca um deslocamento inventado)', () => {
    expect(detectPrependCount([], [c(1) as unknown as EnhancedChartCandle])).toBe(0);
    expect(detectPrependCount([c(1) as unknown as EnhancedChartCandle], [c(1) as unknown as EnhancedChartCandle])).toBe(0);
    expect(detectPrependCount(null, [c(1) as unknown as EnhancedChartCandle])).toBe(0);
    expect(detectPrependCount([c(1) as unknown as EnhancedChartCandle], undefined)).toBe(0);
  });

  it('prepend real e limpo: retorna a contagem exata de candles novos na frente', () => {
    const prev = [c(100), c(200), c(300)] as unknown as EnhancedChartCandle[];
    const next = [c(50), c(75), c(100), c(200), c(300)] as unknown as EnhancedChartCandle[];
    expect(detectPrependCount(prev, next)).toBe(2);
  });

  it('crescimento real mas NÃO um prepend limpo (sufixo não bate) — 0, nunca um deslocamento errado', () => {
    const prev = [c(100), c(200), c(300)] as unknown as EnhancedChartCandle[];
    const next = [c(50), c(100), c(201), c(300), c(400)] as unknown as EnhancedChartCandle[]; // c(200) virou c(201): não é o mesmo prev
    expect(detectPrependCount(prev, next)).toBe(0);
  });

  it('refresh periódico do topo (tail muda, tamanho igual ou maior mas não é prefixo+prev): 0', () => {
    const prev = [c(100), c(200), c(300)] as unknown as EnhancedChartCandle[];
    const next = [c(200), c(300), c(400), c(500)] as unknown as EnhancedChartCandle[]; // cresceu, mas do lado ERRADO (tail, não head)
    expect(detectPrependCount(prev, next)).toBe(0);
  });
});

describe('Fiação real: getOlderChartCandles nunca passa pelo Market Data Bus (fonte compartilhada, cache errado corromperia outros consumidores)', () => {
  it('chama collectBinanceFuturesKlines diretamente, nunca requestFuturesCandleSnapshot/getMarketDataBus', () => {
    const bridge = read('../src/engine-bridge.ts');
    const fnMatch = bridge.match(/export async function getOlderChartCandles\(([\s\S]*?)\n\}/);
    expect(fnMatch, 'getOlderChartCandles não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain('collectBinanceFuturesKlines({');
    expect(body).toContain('endTime:');
    expect(body).not.toContain('requestFuturesCandleSnapshot');
    expect(body).not.toContain('getMarketDataBus');
  });

  it('probe()/collectBinanceFuturesKlines aceitam endTime real, repassado até a URL nativa da Binance', () => {
    const publicConnector = read('../../js/real-data/binance-futures-public.js');
    expect(publicConnector).toContain('endTime } = {}) {');
    expect(publicConnector).toContain("`&endTime=${encodeURIComponent(Math.round(endTime))}`");
    const futuresConnector = read('../../src/market-data-bus/binance-futures-candle-connector.js');
    expect(futuresConnector).toContain('export async function collectBinanceFuturesKlines({ symbol, timeframe, limit, endTime }) {');
    expect(futuresConnector).toContain('includeDerivatives: false, endTime });');
  });
});

describe('Fiação real: App.tsx dedupe, teto de memória e escopo por symbol:timeframe', () => {
  it('handleRequestOlderCandles: dedupe real por time, corta pelo lado mais antigo ao estourar o teto', () => {
    const app = read('../src/App.tsx');
    const fnMatch = app.match(/const handleRequestOlderCandles = useCallback\(async \(\) => \{([\s\S]*?)\n {2}\}, \[selectedAsset, chartTimeframe, chartData\]\);/);
    expect(fnMatch, 'handleRequestOlderCandles não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain('const existingTimes = new Set(prev.map((c) => c.time));');
    expect(body).toContain('const deduped = older.filter((c) => !existingTimes.has(c.time));');
    expect(body).toContain('merged.slice(merged.length - MAX_CHART_HISTORY)');
  });

  it('noMoreOlderCandlesRef reseta ao trocar symbol OU timeframe — nunca fica travado num "sem mais história" de outra chave', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('noMoreOlderCandlesRef.current = false;\n  }, [chartTimeframe, selectedAsset]);');
  });

  it('fetchSymbolData (refresh periódico) usa mergeFreshTail, nunca mais um replace cego de chartData', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('setChartData((prev) => mergeFreshTail(prev, candles));');
    // A troca de timeframe continua um replace intencional (história de OUTRO
    // timeframe não é comparável) — nunca deve virar merge por engano.
    const tfEffectMatch = app.match(/getChartCandles\(selectedAsset, CHART_CANDLE_LIMIT, chartTimeframe\)\.then\(\(candles\) => \{([\s\S]*?)\n {4}\}\);/);
    expect(tfEffectMatch, 'efeito de troca de timeframe não encontrado').not.toBeNull();
    expect(tfEffectMatch![1]).toContain('setChartData(candles);');
    expect(tfEffectMatch![1]).not.toContain('mergeFreshTail');
  });

  // Relato real do Operador (voz): "esse gráfico também tem que buscar os
  // dado... de qualquer ativo... direto da raiz". Achado desta sessão: o
  // gráfico JÁ busca `selectedAsset` (a string real, seja ela um dos 5
  // favoritos OU qualquer símbolo achado via SmartOmnibox) — não existe
  // lista fixa em lugar nenhum deste efeito. As duas travas abaixo garantem
  // que isso não regride silenciosamente para uma lista hardcoded.
  it('efeito de candles do gráfico busca IMEDIATAMENTE em QUALQUER troca de selectedAsset — zero lista fixa de favoritos', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('getChartCandles(selectedAsset, CHART_CANDLE_LIMIT, chartTimeframe).then((candles) => {\n      if (!cancelled && candles) setChartData(candles);\n    });\n    return () => {\n      cancelled = true;\n    };\n  }, [chartTimeframe, selectedAsset]);');
  });

  it('troca de ativo limpa todo estado do ativo ANTERIOR num efeito próprio escopado só a [selectedAsset] — nunca deixa dado velho mislabeled', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('setPriceData(null);');
    expect(idx, 'efeito de reset ao trocar de ativo não encontrado').toBeGreaterThan(-1);
    const block = app.slice(Math.max(0, idx - 30), idx + 1500);
    expect(block).toContain('setChartData([]);');
    expect(block).toContain('setOrderBook({ bids: [], asks: [] });');
    expect(block).toMatch(/\}, \[selectedAsset\]\);/);
  });

  it('ChartWidget repassa onRequestOlderCandles até EnhancedChart_110_Percent — mesma prop, ponta a ponta', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('<ChartWidget chartData={chartData} onRequestOlderCandles={handleRequestOlderCandles} />');
    expect(app).toContain('function ChartWidget({ chartData, onRequestOlderCandles }: any) {');
    expect(app).toContain('onRequestOlderCandles={onRequestOlderCandles}');
  });
});

describe('Fiação real: EnhancedChart_110_Percent desloca a faixa visível SÓ num prepend real', () => {
  it('efeito de `data` usa detectPrependCount para decidir se captura/restaura a faixa visível — nunca incondicional', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    const s = chart;
    expect(s).toContain('const prependedCount = detectPrependCount(prevChartDataRef.current, data);');
    expect(s).toContain('const savedRange = prependedCount > 0 ? chartRef.current?.timeScale().getVisibleLogicalRange() ?? null : null;');
    expect(s).toContain('from: savedRange.from + prependedCount,');
    expect(s).toContain('to: savedRange.to + prependedCount,');
  });

  it('assinatura de subscribeVisibleLogicalRangeChange existe, com unsubscribe real no cleanup', () => {
    const chart = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(chart).toContain('chartReady.chart.timeScale().subscribeVisibleLogicalRangeChange(handler);');
    expect(chart).toContain('chartReady.chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);');
    expect(chart).toContain('onRequestOlderCandles?: () => void;');
  });
});
