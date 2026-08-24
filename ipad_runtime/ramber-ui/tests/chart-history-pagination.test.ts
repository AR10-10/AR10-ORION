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
import { mergeFreshTail, expectedStepSeconds, seriesMatchesTimeframe, type ChartCandle } from '../src/App.tsx';
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
  it('chama getMarketDataProvider(\'BINANCE\').collect diretamente (ADITIVO V-MAX Etapa 1), nunca requestFuturesCandleSnapshot/getMarketDataBus', () => {
    const bridge = read('../src/engine-bridge.ts');
    const fnMatch = bridge.match(/export async function getOlderChartCandles\(([\s\S]*?)\n\}/);
    expect(fnMatch, 'getOlderChartCandles não encontrada').not.toBeNull();
    const body = fnMatch![1];
    expect(body).toContain("getMarketDataProvider('BINANCE').collect({");
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
    // 2 checagens: uma depois de getChartCandles, outra depois do fetch do
    // ticker — o ativo pode trocar durante QUALQUER um dos dois awaits.
    expect(symbolBody.match(/if \((?:isStale|trocou)\(\)\) return true;/g)).toHaveLength(2);
    // A PRIMEIRA guarda (a que protege os candles) cobre ativo E TIMEFRAME:
    // trocar de 15m para 1H com um fetch de 15m em voo fundia duas grades
    // de tempo numa série só — defeito real desta auditoria. A SEGUNDA
    // continua sendo só `isStale()` de propósito: ela protege
    // `setScannerData`, um ticker de 24h de uma lista fixa de símbolos, que
    // não tem nada a ver com o timeframe do gráfico.
    expect(symbolBody).toContain('if (trocou()) return true;');
    expect(symbolBody).toContain('chartTimeframeRef.current !== tfNoInicio');
    // a checagem vem ANTES do setState correspondente, nunca depois
    expect(symbolBody.indexOf('if (trocou()) return true;')).toBeLessThan(symbolBody.indexOf('setChartData((prev) => mergeFreshTail'));

    const derivFnMatch = app.match(/const fetchDerivatives = async \(isStale: \(\) => boolean\): Promise<boolean> => \{([\s\S]*?)\n {2}\};/);
    expect(derivFnMatch, 'fetchDerivatives não encontrada com o parâmetro isStale').not.toBeNull();
    const derivBody = derivFnMatch![1];
    expect(derivBody).toContain('if (!isStale()) {\n        setDerivatives((prev) => ({');
    expect(derivBody).toContain('if (!isStale()) setDerivatives((prev) => ({ ...prev, fundingRate: null, openInterest: null }));');
    // v16.0 ULTRA §15.4: long/short ratio é um fetch PRÓPRIO, independente
    // do de funding/OI acima (endpoint diferente) — mesma guarda isStale()
    // nos 2 caminhos (sucesso e catch), nunca um setState desprotegido só
    // porque é um campo "a mais".
    expect(derivBody).toContain('if (!isStale()) setDerivatives((prev) => ({ ...prev, longShortRatio: ratio }));');
    expect(derivBody).toContain('if (!isStale()) setDerivatives((prev) => ({ ...prev, longShortRatio: null }));');
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
    // acrescentou os 3 resets de derivatives/cross-exchange, o Aditivo §27
    // (MEXC Futures, 4ª fonte) acrescentou um 4º reset de cross-exchange, e
    // o OMEGA CORE V-MAX (Fase 1.1) acrescentou o reset explícito de
    // setCvd(null) na store (fatia nova), e a Fase 5 acrescentou o reset
    // de setConfluenceCorridor(null) — janela ampliada de novo para caber
    // o conteúdo novo (limite ainda finito: continua provando que é um
    // efeito PRÓPRIO e contido, nunca o arquivo inteiro).
    const block = app.slice(Math.max(0, idx - 30), idx + 4100);
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
    // Janela ampliada (OMEGA CORE V-MAX Fase 1.1/5: setCvd(null)/
    // setConfluenceCorridor(null) novos entram ANTES destas linhas no
    // mesmo efeito) — mesmo racional de janela finita da suíte irmã acima.
    const block = app.slice(Math.max(0, idx - 30), idx + 2400);
    expect(block).toContain('setDerivatives({ fundingRate: null, openInterest: null, longShortRatio: null });');
    expect(block).toContain('setCrossExchangeCheck({ ok: false, priceDeltaPct: null, consensus: "INDISPONIVEL" });');
    expect(block).toContain('setOkxCrossExchangeCheck({ ok: false, priceDeltaPct: null, consensus: "INDISPONIVEL" });');
    // mesmos valores exatos dos useState iniciais — nunca um sentinel novo
    // inventado, o mesmo "carregando" honesto que o primeiro boot já usa.
    expect(app).toContain('const [crossExchangeCheck, setCrossExchangeCheck] = useState<CrossExchangeCheck>({\n    ok: false,\n    priceDeltaPct: null,\n    consensus: "INDISPONIVEL",\n  });');
    expect(app).toContain('const [derivatives, setDerivatives] = useState<DerivativesState>({\n    fundingRate: null,\n    openInterest: null,\n    longShortRatio: null,\n  });');
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
    // priceData={priceData} (Ordem "Unificação da Inteligência Operacional"
    // §4 — correção de latência real/gap-price-sync-wiring): literal
    // re-fixado, a garantia real (onRequestOlderCandles ponta a ponta)
    // continua idêntica.
    expect(app).toContain(
      '<ChartWidget chartData={chartData} onRequestOlderCandles={handleRequestOlderCandles} priceData={priceData} />',
    );
    expect(app).toContain('function ChartWidget({ chartData, onRequestOlderCandles, priceData }: any) {');
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

// ---------------------------------------------------------------------------
// MISTURA DE TIMEFRAMES — defeito real encontrado em auditoria, partindo do
// pedido do Operador sobre a Fibonacci ("ela tem de fazer um novo mapeamento
// na análise, cada tempo gráfico").
//
// A guarda de "resposta velha" do fetch periódico cobria só a troca de
// ATIVO. Trocar de 15m para 1H com um fetch de 15m em voo deixava os candles
// de 15m serem FUNDIDOS na série de 1H: uma série única com duas grades de
// tempo, sobre a qual Fibonacci, S/R, SMC e BOS/CHOCH passavam a mapear
// swings. Nenhum erro, nenhum log — só leitura errada.
//
// Aqui o bug provável é "a matemática da fusão aceita o que não devia", por
// isso execução real da função pura.
// ---------------------------------------------------------------------------
describe("mergeFreshTail nunca funde duas grades de tempo diferentes", () => {
  const H = 3600;
  const serie = (t0: number, passo: number, n: number): ChartCandle[] =>
    Array.from({ length: n }, (_, i) => ({
      time: t0 + i * passo,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1,
    }));

  it("candles de 15m chegando sobre uma série de 1H substituem, nunca fundem", () => {
    const umaHora = serie(1_700_000_000, H, 200);
    // 15m cobrindo uma janela recente — exatamente o caso real.
    const quinzeMin = serie(1_700_000_000 + 150 * H, H / 4, 300);
    const out = mergeFreshTail(umaHora, quinzeMin);
    expect(out).toEqual(quinzeMin);
  });

  it("o contrário também: 1H sobre uma série de 15m substitui", () => {
    const quinzeMin = serie(1_700_000_000, H / 4, 300);
    const umaHora = serie(1_700_000_000 + 50 * H, H, 200);
    expect(mergeFreshTail(quinzeMin, umaHora)).toEqual(umaHora);
  });

  it("nenhuma série resultante mistura passos — a garantia que interessa", () => {
    const umaHora = serie(1_700_000_000, H, 200);
    const quinzeMin = serie(1_700_000_000 + 150 * H, H / 4, 300);
    const out = mergeFreshTail(umaHora, quinzeMin);
    const passos = new Set<number>();
    for (let i = 1; i < out.length; i++) passos.add(out[i].time - out[i - 1].time);
    expect([...passos]).toEqual([H / 4]);
  });

  it("MESMA grade continua fundindo — a paginação histórica não pode regredir", () => {
    // Este é o caso que a função existe para servir: história antiga já
    // carregada por arraste + refresh da cauda, ambos no MESMO timeframe.
    const antigos = serie(1_700_000_000, H, 200);
    const cauda = serie(1_700_000_000 + 150 * H, H, 100);
    const out = mergeFreshTail(antigos, cauda);
    expect(out.length).toBeGreaterThan(cauda.length);
    expect(out[0].time).toBe(antigos[0].time);
    expect(out[out.length - 1].time).toBe(cauda[cauda.length - 1].time);
  });

  it("um buraco real no histórico não é confundido com troca de grade", () => {
    // Manutenção de exchange deixa um vão de várias barras. A mediana dos
    // passos ignora isso — trocar de timeframe muda a mediana, um buraco
    // isolado não.
    const comBuraco = serie(1_700_000_000, H, 100);
    comBuraco.push({ time: comBuraco[99].time + 12 * H, open: 100, high: 101, low: 99, close: 100, volume: 1 });
    const cauda = serie(comBuraco[comBuraco.length - 1].time + H, H, 60);
    const out = mergeFreshTail(comBuraco, cauda);
    expect(out.length).toBeGreaterThan(cauda.length); // fundiu de verdade
  });

  it("amostra curta demais não afirma grade nenhuma — fail-closed sem inventar regra", () => {
    const doisCandles: ChartCandle[] = [
      { time: 1_700_000_000, open: 1, high: 1, low: 1, close: 1, volume: 0 },
      { time: 1_700_000_000 + H, open: 1, high: 1, low: 1, close: 1, volume: 0 },
    ];
    // Com 2 candles não dá para medir mediana de passo com confiança; a
    // função volta ao comportamento de fusão de sempre em vez de decidir
    // por adivinhação.
    const cauda = serie(1_700_000_000 + 5 * H, H, 50);
    expect(() => mergeFreshTail(doisCandles, cauda)).not.toThrow();
  });
});

describe("a guarda de timeframe existe no fetch periódico (a 1ª camada)", () => {
  it("o fetch confere o timeframe capturado, não só o ativo", () => {
    const src = read('../src/App.tsx');
    expect(src).toContain("const tfNoInicio = chartTimeframeRef.current;");
    expect(src).toContain("chartTimeframeRef.current !== tfNoInicio");
    // A gravação Local-First usa o timeframe REALMENTE buscado.
    expect(src).toContain("saveCandles(selectedAsset, tfNoInicio as Timeframe, candles)");
  });
});

// ---------------------------------------------------------------------------
// SINCRONIA DE TEMPO GRÁFICO (pedido do Operador: "pra não ter erro do tempo
// gráfico de um horário pra outro").
//
// O caminho de REDE já era guardado em dois pontos: `tfNoInicio`/`trocou()`
// em fetchSymbolData, e a comparação de grades em mergeFreshTail. A
// hidratação do CACHE (IndexedDB) não tinha nenhum dos dois — e é a única
// outra porta por onde uma série entra no gráfico.
// ---------------------------------------------------------------------------
describe("grade da série x timeframe declarado", () => {
  const serie = (passoSegundos: number, n = 10): ChartCandle[] =>
    Array.from({ length: n }, (_, i) => ({
      time: 1_700_000_000 + i * passoSegundos,
      open: 100, high: 101, low: 99, close: 100, volume: 5,
    })) as ChartCandle[];

  it("o passo esperado vem da MESMA tabela do perfil de camadas, nunca de uma segunda", () => {
    expect(expectedStepSeconds("1m")).toBe(60);
    expect(expectedStepSeconds("15m")).toBe(900);
    expect(expectedStepSeconds("1h")).toBe(3600);
    expect(expectedStepSeconds("4h")).toBe(14400);
    expect(expectedStepSeconds("1d")).toBe(86400);
  });

  it("aceita a série cuja grade REALMENTE bate com o timeframe", () => {
    expect(seriesMatchesTimeframe(serie(900), "15m")).toBe(true);
    expect(seriesMatchesTimeframe(serie(3600), "1h")).toBe(true);
  });

  it("REJEITA a série de outra grade sob o timeframe errado — o defeito real", () => {
    // Cache gravado como 15m contendo série de 1h (contaminação real possível
    // no IndexedDB, gravada antes da correção de mistura de grades), ou série
    // do timeframe antigo chegando depois de uma troca.
    expect(seriesMatchesTimeframe(serie(3600), "15m")).toBe(false);
    expect(seriesMatchesTimeframe(serie(900), "1h")).toBe(false);
    expect(seriesMatchesTimeframe(serie(60), "1d")).toBe(false);
  });

  it("um buraco real no histórico NÃO faz a série ser rejeitada (mediana, nunca média)", () => {
    // Paragem de exchange: um intervalo maior no meio. A grade continua sendo
    // 15m — rejeitar aqui seria descartar dado real por suposição.
    const comBuraco = serie(900, 12);
    comBuraco[6].time += 900 * 5; // um salto real
    for (let i = 7; i < comBuraco.length; i++) comBuraco[i].time += 900 * 5;
    expect(seriesMatchesTimeframe(comBuraco, "15m")).toBe(true);
  });

  it("FAIL-CLOSED nas duas direções: sem timeframe conhecido ou sem amostra, nunca rejeita", () => {
    // Regra de Ouro 4: não dá para provar que a série está errada sem saber o
    // passo esperado — na dúvida o dado real permanece.
    for (const tf of [null, undefined, "", "abacaxi"]) {
      expect(seriesMatchesTimeframe(serie(900), tf as string), `tf ${tf}`).toBe(true);
    }
    expect(expectedStepSeconds("abacaxi")).toBeNull();
    // amostra curta demais para afirmar uma grade
    expect(seriesMatchesTimeframe(serie(3600, 2), "15m")).toBe(true);
  });
});

describe("a hidratação do cache guarda o timeframe como o caminho de rede", () => {
  const app = () => read("../src/App.tsx");

  it("captura o timeframe ANTES do await e descarta se trocou durante ele", () => {
    // Quinta vez nesta trilha que uma mutação de FIAÇÃO passaria verde com a
    // função pura testada a fundo e a CHAMADA não travada. Aqui a chamada
    // real fica travada.
    const src = app();
    const i = src.indexOf("const persisted = await loadCandles(");
    expect(i, "hidratação do cache não encontrada").toBeGreaterThan(-1);
    const bloco = src.slice(i - 400, i + 700);
    expect(bloco).toContain("const tfNoInicio = chartTimeframeRef.current;");
    expect(bloco).toContain("await loadCandles(selectedAsset, tfNoInicio as Timeframe)");
    expect(bloco).toContain("if (cancelled || chartTimeframeRef.current !== tfNoInicio) return;");
  });

  it("valida a GRADE da série persistida antes de aplicar", () => {
    const src = app();
    const i = src.indexOf("const persisted = await loadCandles(");
    const bloco = src.slice(i, i + 900);
    expect(bloco).toContain("if (!seriesMatchesTimeframe(persisted as ChartCandle[], tfNoInicio)) return;");
  });

  it("o guard antigo cobria só troca de ATIVO — a regressão que isto impede", () => {
    // Se o `cancelled` voltasse a ser a única condição, a série do timeframe
    // antigo entraria de novo. O efeito não recria ao trocar de timeframe
    // (deps são [bootGeneration, selectedAsset]), então `cancelled` nunca
    // dispara nesse caso.
    const src = app();
    const i = src.indexOf("const persisted = await loadCandles(");
    const bloco = src.slice(i, i + 400);
    expect(bloco).not.toMatch(/if \(cancelled \|\| !persisted/);
  });
});
