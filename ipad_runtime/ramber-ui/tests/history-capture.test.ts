// history-capture.test.ts — execução REAL da paginação de histórico com
// proveniência (Fase 2 da iniciativa "histórico real + backtest
// honesto"). Prova as propriedades que tornam a amostra confiável para a
// Fase 3: paginação correta para trás, proveniência real por página,
// dedup por sobreposição, detecção EXATA de gaps, fail-closed que nunca
// descarta dado bom já capturado, teto de segurança contra laço sem fim,
// e a fronteira de laboratório (zero fio com produção).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { captureHistoricalCandles } from '../../src/research/backtest/history-capture.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

type Evidence = { candles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>; fetched_at?: string; raw_sample_hash?: string; source_id?: string };

function candle(t: number): { t: number; o: number; h: number; l: number; c: number; v: number } {
  return { t, o: 100, h: 101, l: 99, c: 100, v: 10 };
}

function evidence(times: number[], tag: string): Evidence {
  return {
    candles: times.map(candle),
    fetched_at: `2026-07-20T00:00:00.000Z#${tag}`,
    raw_sample_hash: `hash-${tag}`,
    source_id: 'binance-futures-public-adapter',
  };
}

describe('captureHistoricalCandles — paginação real para trás sobre fetchPage injetado', () => {
  it('pagina corretamente até o alvo: 2 páginas contíguas, endTime da 2ª derivado do candle mais antigo da 1ª (oldest-1)*1000', async () => {
    const step = 3600;
    const base = 500 * step;
    const pageA = [base, base + step, base + 2 * step]; // mais recente
    const pageB = [base - 3 * step, base - 2 * step, base - step]; // mais antiga, contígua com pageA

    const calls: Array<{ endTime?: number }> = [];
    const fetchPage = vi.fn(async ({ endTime }: { endTime?: number }) => {
      calls.push({ endTime });
      if (calls.length === 1) return evidence(pageA, 'A');
      if (calls.length === 2) return evidence(pageB, 'B');
      return evidence([], 'vazio');
    });

    const r = await captureHistoricalCandles({ symbol: 'BTC', timeframe: '1h', targetCandleCount: 6, fetchPage });

    expect(calls[0].endTime).toBeUndefined();
    expect(calls[1].endTime).toBe((base - 1) * 1000);
    expect(r.candleCount).toBe(6);
    expect(r.pageCount).toBe(2);
    expect(r.reachedTarget).toBe(true);
    expect(r.stopReason).toBe('alvo_atingido');
    expect(r.succeeded).toBe(true);
    expect(r.contiguous).toBe(true);
    expect(r.gaps).toEqual([]);
    // ordenado ascendente
    for (let i = 1; i < r.candles.length; i++) expect(r.candles[i].t).toBeGreaterThan(r.candles[i - 1].t);
  });

  it('proveniência real de cada página (fetched_at/raw_sample_hash/source_id) aparece em pages[] — mesmo Evidence Object do Real Data Layer', async () => {
    const fetchPage = vi.fn(async () => evidence([1000, 1100, 1200], 'X'));
    const r = await captureHistoricalCandles({ symbol: 'BTC', timeframe: '100s', targetCandleCount: 3, fetchPage });
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0]).toMatchObject({
      pageIndex: 0,
      fetchedAt: '2026-07-20T00:00:00.000Z#X',
      rawSampleHash: 'hash-X',
      sourceId: 'binance-futures-public-adapter',
      candleCount: 3,
    });
  });

  it('dedup por tempo quando páginas se sobrepõem (a página mais antiga repete o candle mais recente da anterior)', async () => {
    let call = 0;
    const fetchPage = vi.fn(async () => {
      call++;
      if (call === 1) return evidence([300, 400, 500], 'A'); // 500 é o candle mais antigo desta página
      if (call === 2) return evidence([100, 200, 500], 'B'); // 500 repetido de propósito
      return evidence([], 'fim');
    });
    const r = await captureHistoricalCandles({ symbol: 'BTC', timeframe: '100s', targetCandleCount: 6, fetchPage });
    // 6 candles brutos, 1 duplicado (t=500) => 5 únicos
    expect(r.candleCount).toBe(5);
    const times = r.candles.map((c) => c.t);
    expect(new Set(times).size).toBe(times.length);
    expect(times).toEqual([100, 200, 300, 400, 500]);
  });

  it('detecta gap EXATO (não a fração tolerante de quality-engine.js) e marca cobertura como não contígua', async () => {
    const step = 3600;
    // gap deliberado entre t=step e t=3*step (delta=2*step, esperado=step)
    const fetchPage = vi.fn(async () => evidence([0, step, 3 * step, 4 * step], 'gap'));
    const r = await captureHistoricalCandles({ symbol: 'BTC', timeframe: '1h', targetCandleCount: 4, fetchPage });
    expect(r.contiguous).toBe(false);
    expect(r.gaps).toEqual([
      { afterTime: step, beforeTime: 3 * step, expectedStepSeconds: step, actualDeltaSeconds: 2 * step },
    ]);
  });

  it('história esgotada na exchange antes do alvo: sucesso honesto (nunca uma falha), reachedTarget fica false', async () => {
    let call = 0;
    const fetchPage = vi.fn(async () => {
      call++;
      if (call === 1) return evidence([100, 200, 300], 'A');
      return evidence([], 'esgotado'); // exchange não tem mais história
    });
    const r = await captureHistoricalCandles({ symbol: 'BTC', timeframe: '100s', targetCandleCount: 1000, fetchPage });
    expect(r.stopReason).toBe('historia_esgotada_na_exchange');
    expect(r.succeeded).toBe(true);
    expect(r.reachedTarget).toBe(false);
    expect(r.candleCount).toBe(3);
  });

  it('fail-closed: falha real de rede no meio da paginação PARA a captura mas preserva o que já foi acumulado — nunca descarta dado bom nem finge sucesso', async () => {
    let call = 0;
    const fetchPage = vi.fn(async () => {
      call++;
      if (call === 1) return evidence([100, 200, 300], 'A');
      throw new Error('conector_binance_futures_estado:BLOCKED_BY_CORS');
    });
    const r = await captureHistoricalCandles({ symbol: 'BTC', timeframe: '100s', targetCandleCount: 1000, fetchPage });
    expect(r.succeeded).toBe(false);
    expect(r.stopReason).toContain('falha_na_pagina_1:');
    expect(r.stopReason).toContain('BLOCKED_BY_CORS');
    // a página 0, que teve sucesso real, continua na amostra
    expect(r.candleCount).toBe(3);
    expect(r.pageCount).toBe(1);
  });

  it('teto de segurança maxPages nunca vira laço sem fim contra a rede real', async () => {
    let call = 0;
    const fetchPage = vi.fn(async ({ endTime }: { endTime?: number }) => {
      call++;
      const base = 10_000_000 - call * 300;
      return evidence([base, base + 100, base + 200], `p${call}`);
    });
    const r = await captureHistoricalCandles({
      symbol: 'BTC', timeframe: '100s', targetCandleCount: 999_999, maxPages: 3, fetchPage,
    });
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(r.pageCount).toBe(3);
    expect(r.stopReason).toBe('maxPages_atingido_antes_do_alvo');
    expect(r.succeeded).toBe(false);
    expect(r.reachedTarget).toBe(false);
  });

  it('contrato honesto: formatVersion, aviso e parâmetros declarados exportados', async () => {
    const mod = await import('../../src/research/backtest/history-capture.js');
    expect(mod.HISTORY_CAPTURE_FORMAT_VERSION).toBe(1);
    expect(mod.HISTORY_CAPTURE_DEFAULT_PAGE_SIZE).toBe(1000);
    expect(mod.HISTORY_CAPTURE_DEFAULT_MAX_PAGES).toBe(50);
    expect(mod.CAPTURE_AVISO).toContain('NÃO garante qualidade de mercado');
    expect(mod.CAPTURE_AVISO).toContain('nunca, por si só, uma afirmação de desempenho ou de probabilidade futura');
    const fetchPage = vi.fn(async () => evidence([1, 2], 'v'));
    const r = await captureHistoricalCandles({ symbol: 'BTC', timeframe: '100s', targetCandleCount: 2, fetchPage });
    expect(r.formatVersion).toBe(1);
    expect(r.aviso).toBe(mod.CAPTURE_AVISO);
  });
});

describe('fetchRealPage — mesmo conector real do scroll-back do gráfico (collectBinanceFuturesKlines), nunca uma segunda implementação de fetch', () => {
  afterEach(() => {
    vi.doUnmock('../../js/real-data/binance-futures-public.js');
    vi.resetModules();
  });

  it('pede o Evidence Object completo (returnEvidence:true) através do MESMO conector real, ponta a ponta', async () => {
    // resetModules ANTES do mock: history-capture.js (e a cadeia
    // collectBinanceFuturesKlines → probeBinanceFutures) já pode ter sido
    // importado estaticamente por outro describe deste mesmo arquivo —
    // sem isto o import dinâmico abaixo devolveria os módulos já
    // resolvidos e cacheados ANTES do mock existir.
    vi.resetModules();
    vi.doMock('../../js/real-data/binance-futures-public.js', () => ({
      probe: vi.fn(async () => ({
        state: 'ACTIVE_READ_ONLY',
        evidence: {
          candles: [{ t: 1, o: 1, h: 1, l: 1, c: 1, v: 1 }],
          fetched_at: '2026-07-20T00:00:00.000Z',
          raw_sample_hash: 'abc123',
          source_id: 'binance-futures-public-adapter',
        },
      })),
    }));
    const { fetchRealPage: fetchRealPageFresh } = await import('../../src/research/backtest/history-capture.js');
    const result = await fetchRealPageFresh({ symbol: 'BTC', timeframe: '1h', limit: 1000, endTime: undefined });
    expect(result.candles).toHaveLength(1);
    expect(result.fetched_at).toBe('2026-07-20T00:00:00.000Z');
    expect(result.raw_sample_hash).toBe('abc123');
    expect(result.source_id).toBe('binance-futures-public-adapter');
  });
});

describe('history-capture.js — fronteira de laboratório e higiene de fonte', () => {
  it('FRONTEIRA (LEI 24): nenhum módulo de produção importa a Fase 2 do backtest — só testes', () => {
    const roots = [resolve(here, '../src'), resolve(here, '../../src')];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === 'backtest') continue; // o próprio lab não se acusa
          walk(p);
        } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
          const src = readFileSync(p, 'utf8');
          if (src.includes('research/backtest/history-capture')) offenders.push(p);
        }
      }
    };
    for (const root of roots) walk(root);
    expect(offenders).toEqual([]);
  });

  it('history-capture.js nunca chama fetch/WebSocket diretamente — todo I/O real passa por fetchPage (injetável, default é o conector real já testado em outro lugar)', () => {
    const src = readFileSync(resolve(here, '../../src/research/backtest/history-capture.js'), 'utf8');
    expect(src).not.toMatch(/\bfetch\(|WebSocket|Math\.random/);
  });
});
