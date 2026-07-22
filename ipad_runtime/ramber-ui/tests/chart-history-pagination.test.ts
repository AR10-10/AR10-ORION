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
    // Fase 2 do backtest honesto (captura de histórico com proveniência)
    // acrescentou returnEvidence com default false — o scroll-back do
    // gráfico (getOlderChartCandles) não passa esse campo, então seu
    // comportamento real é bit-a-bit idêntico a antes.
    expect(futuresConnector).toContain('export async function collectBinanceFuturesKlines({ symbol, timeframe, limit, endTime, returnEvidence = false }) {');
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

  it('Achado real (auditoria de sincronização entre widgets): fetchSymbolData/fetchDerivatives checam isStale() antes de TODO setState — uma resposta tardia do ativo trocado nunca aplica dado do ativo errado', () => {
    const app = read('../src/App.tsx');
    const symbolFnMatch = app.match(/const fetchSymbolData = async \(isStale: \(\) => boolean\): Promise<boolean> => \{([\s\S]*?)\n {2}\};/);
    expect(symbolFnMatch, 'fetchSymbolData não encontrada com o parâmetro isStale').not.toBeNull();
    const symbolBody = symbolFnMatch![1];
    // 2 checagens: uma depois de getChartCandles, outra depois do fetch do ticker —
    // o ativo pode trocar durante QUALQUER um dos dois awaits, não só o primeiro.
    expect(symbolBody.match(/if \(isStale\(\)\) return true;/g)).toHaveLength(2);
    // a checagem vem ANTES do setState correspondente, nunca depois
    expect(symbolBody.indexOf('if (isStale()) return true;')).toBeLessThan(symbolBody.indexOf('setChartData((prev) => mergeFreshTail'));

    const derivFnMatch = app.match(/const fetchDerivatives = async \(isStale: \(\) => boolean\): Promise<boolean> => \{([\s\S]*?)\n {2}\};/);
    expect(derivFnMatch, 'fetchDerivatives não encontrada com o parâmetro isStale').not.toBeNull();
    const derivBody = derivFnMatch![1];
    expect(derivBody).toContain('if (!isStale()) {\n        setDerivatives({');
    expect(derivBody).toContain('if (!isStale()) setDerivatives({ fundingRate: null, openInterest: null });');
    expect(derivBody).toContain('if (!isStale()) {\n      setCrossExchangeCheck(compareCrossExchange(binanceMarkPrice, bybit));');

    // os DOIS call sites (retry de boot E o setInterval de refresh) usam a
    // MESMA closure guardada — nunca a função crua sem proteção.
    const bootEffectMatch = app.match(/useEffect\(\(\) => \{\n {4}let unmounted = false;\n[\s\S]*?\n {2}\}, \[bootGeneration, selectedAsset\]\);/);
    expect(bootEffectMatch, 'efeito de boot/WS não encontrado').not.toBeNull();
    const bootBody = bootEffectMatch![0];
    expect(bootBody).toContain('const fetchSymbolDataGuarded = () => fetchSymbolData(() => unmounted);');
    expect(bootBody).toContain('const fetchDerivativesGuarded = () => fetchDerivatives(() => unmounted);');
    expect(bootBody).toContain('retryBoot(fetchSymbolDataGuarded, () => unmounted)');
    expect(bootBody).toContain('retryBoot(fetchDerivativesGuarded, () => unmounted)');
    expect(bootBody).toContain('setInterval(fetchSymbolDataGuarded, 30000)');
    expect(bootBody).toContain('setInterval(fetchDerivativesGuarded, 60000)');
    expect(bootBody).toContain('unmounted = true;'); // cleanup real, não só a variável declarada
    expect(bootBody).not.toContain('retryBoot(fetchSymbolData,'); // a função crua nunca deve voltar a ser passada direto
    expect(bootBody).not.toContain('retryBoot(fetchDerivatives,');
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
    // Evolução Profunda §11/§13-J acrescentou setMultiTimeframeContext(null)
    // real ao mesmo efeito, a Diretriz Suprema de Evolução Integrativa
    // acrescentou os 3 resets de derivatives/cross-exchange, e o Aditivo
    // §27 (MEXC Futures, 4ª fonte) acrescentou um 4º reset de
    // cross-exchange — janela ampliada de novo para caber o conteúdo novo
    // (limite ainda finito: continua provando que é um efeito PRÓPRIO e
    // contido, nunca o arquivo inteiro).
    const block = app.slice(Math.max(0, idx - 30), idx + 2734);
    expect(block).toContain('setChartData([]);');
    expect(block).toContain('setOrderBook({ bids: [], asks: [] });');
    expect(block).toContain('useUnifiedSnapshotStore.getState().setMultiTimeframeContext(null);');
    expect(block).toMatch(/\}, \[selectedAsset\]\);/);
    // Diretriz de Evolução Geral do Organismo §6.8 (achado real): o antigo
    // resetTrackRecord (zerava tudo) foi substituído por um efeito PRÓPRIO
    // logo depois, que arquiva/restaura por symbol:timeframe — nunca mais
    // um reset cego dentro deste efeito de troca de ativo.
    expect(block).not.toContain('resetTrackRecord');
    const archiveEffectMatch = app.match(/const key = candleKey\(selectedAsset, chartTimeframe as Timeframe\);\n {4}const archived = useUnifiedSnapshotStore\.getState\(\)\.trackRecordArchive\[key\];\n {4}useUnifiedSnapshotStore\.getState\(\)\.hydrateTrackRecord\(archived \?\? EMPTY_TRACK_RECORD\);\n {4}return \(\) => \{\n {6}useUnifiedSnapshotStore\.getState\(\)\.archiveTrackRecord\(key\);\n {4}\};\n {2}\}, \[selectedAsset, chartTimeframe\]\);/);
    expect(archiveEffectMatch, 'efeito de arquivo/restauração do track record não encontrado').not.toBeNull();
  });

  it('Diretriz Suprema de Evolução Integrativa §3 (achado real de auditoria): funding/OI e os DOIS cross-exchange checks agora resetam no mesmo efeito de troca de ativo — antes ficavam mostrando o valor do ativo ANTERIOR até fetchDerivatives resolver (até 8s de atraso real no pior caso)', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('setPriceData(null);');
    const block = app.slice(Math.max(0, idx - 30), idx + 2000);
    expect(block).toContain('setDerivatives({ fundingRate: null, openInterest: null });');
    expect(block).toContain('setCrossExchangeCheck({ ok: false, priceDeltaPct: null, consensus: "INDISPONIVEL" });');
    expect(block).toContain('setOkxCrossExchangeCheck({ ok: false, priceDeltaPct: null, consensus: "INDISPONIVEL" });');
    // mesmos valores exatos dos useState iniciais — nunca um sentinel novo
    // inventado, o mesmo "carregando" honesto que o primeiro boot já usa.
    expect(app).toContain('const [crossExchangeCheck, setCrossExchangeCheck] = useState<CrossExchangeCheck>({\n    ok: false,\n    priceDeltaPct: null,\n    consensus: "INDISPONIVEL",\n  });');
    expect(app).toContain('const [derivatives, setDerivatives] = useState<DerivativesState>({\n    fundingRate: null,\n    openInterest: null,\n  });');
  });

  it('liquidações NÃO precisam resetar por ativo: o próprio label já se declara exchange-wide, nunca fingindo ser por símbolo — achado de auditoria confirmando que não é um bug de staleness', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('Forced Liquidations · Binance Futures (real feed');
    expect(app).toContain('no key — engine-bridge.ts\'s startRealLiquidationFeed). Exchange-wide,');
    expect(app).toContain('not BTC-only — large forced liquidations anywhere are the real signal');
    const idx = app.indexOf('setPriceData(null);');
    const block = app.slice(Math.max(0, idx - 30), idx + 2000);
    expect(block).not.toContain('setLiquidations');
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
