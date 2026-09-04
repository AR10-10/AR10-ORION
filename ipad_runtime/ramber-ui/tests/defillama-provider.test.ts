// defillama-provider.test.ts — Ordem Mestra §7 (On-Chain e DeFi): GMIL
// categoria ONCHAIN sai do null honesto pela primeira vez. Mesma convenção
// de gmil-expansion.test.ts (derivatives-provider): execução real das
// funções puras + fetch() mockado só na fronteira de rede, nunca a lógica
// de parse/lean em si.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  tvlChangeToLean,
  parseHistoricalChainTvl,
  fetchOnchainTvlFlow,
  TVL_CHANGE_EXTREME,
  LOOKBACK_SECONDS,
} from '../src/gmil/providers/defillama-provider';

describe('defillama-provider: tvlChangeToLean é fluxo real clampado, nunca fabricado', () => {
  it('TVL estável (0% em 7d) => lean exatamente 0', () => {
    expect(tvlChangeToLean(100, 100)).toBe(0);
  });

  it('+5% (TVL_CHANGE_EXTREME) => lean exatamente 1; -5% => lean exatamente -1', () => {
    expect(tvlChangeToLean(100 * (1 + TVL_CHANGE_EXTREME), 100)).toBeCloseTo(1, 10);
    expect(tvlChangeToLean(100 * (1 - TVL_CHANGE_EXTREME), 100)).toBeCloseTo(-1, 10);
  });

  it('variação além do extremo satura em ±1, nunca extrapola', () => {
    expect(tvlChangeToLean(200, 100)).toBe(1);
    expect(tvlChangeToLean(10, 100)).toBe(-1);
  });

  it('metade do extremo (+2.5%) => lean exatamente 0.5 (mapeamento linear real)', () => {
    expect(tvlChangeToLean(102.5, 100)).toBeCloseTo(0.5, 10);
  });

  it('entrada não-finita ou base inválida (<=0) => null honesto, nunca um lean chutado', () => {
    expect(tvlChangeToLean(null, 100)).toBeNull();
    expect(tvlChangeToLean(100, null)).toBeNull();
    expect(tvlChangeToLean(NaN, 100)).toBeNull();
    expect(tvlChangeToLean(100, 0)).toBeNull();
    expect(tvlChangeToLean(100, -5)).toBeNull();
  });
});

describe('defillama-provider: parseHistoricalChainTvl é fail-closed sobre a forma real da resposta', () => {
  const T0 = 1_700_000_000; // múltiplo exato de 86400 dias a partir daqui, ver pontos abaixo

  function seriesOf(n: number, tvlAt: (i: number) => number) {
    return Array.from({ length: n }, (_, i) => ({ date: T0 + i * 86400, tvl: tvlAt(i) }));
  }

  it('série real de 20 dias: pega o ÚLTIMO ponto como atual e o ponto real mais próximo de 7 dias antes (nunca interpolado)', () => {
    const series = seriesOf(20, (i) => 100 + i); // dia i tem tvl = 100+i
    const parsed = parseHistoricalChainTvl(series);
    expect(parsed.ok).toBe(true);
    expect(parsed.currentTvl).toBe(119); // dia 19 (último)
    expect(parsed.pastTvl).toBe(112); // dia 12 = dia 19 - 7
    expect(parsed.currentDate).toBe(T0 + 19 * 86400);
  });

  it('ordem de chegada não importa — array embaralhado produz o mesmo resultado (ordena internamente por data real)', () => {
    const series = seriesOf(20, (i) => 100 + i);
    const shuffled = [...series].reverse();
    expect(parseHistoricalChainTvl(shuffled)).toEqual(parseHistoricalChainTvl(series));
  });

  it('resposta não é array, ou é array vazio => DADOS_INSUFICIENTES honesto', () => {
    expect(parseHistoricalChainTvl(null).ok).toBe(false);
    expect(parseHistoricalChainTvl({ foo: 1 }).ok).toBe(false);
    expect(parseHistoricalChainTvl([]).ok).toBe(false);
  });

  it('pontos com date/tvl não-numéricos são descartados; sobrando menos de 2 pontos reais => fail-closed', () => {
    const parsed = parseHistoricalChainTvl([
      { date: 'x', tvl: 100 },
      { date: T0, tvl: 'y' },
      { date: T0 + 86400, tvl: -5 }, // tvl negativo real não existe, descartado
    ]);
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toBe('pontos_reais_insuficientes_apos_filtragem');
  });

  it('exatamente 1 ponto real válido => fail-closed (não há variação para calcular sem um segundo ponto)', () => {
    expect(parseHistoricalChainTvl([{ date: T0, tvl: 100 }]).ok).toBe(false);
  });

  it('LOOKBACK_SECONDS é real e igual a 7 dias em segundos', () => {
    expect(LOOKBACK_SECONDS).toBe(7 * 86400);
  });
});

describe('fetchOnchainTvlFlow: mocka só fetch() (fronteira de rede), mesma convenção de derivatives-provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resposta real e completa => ok:true, lean real calculado a partir dos campos crus', async () => {
    const T0 = 1_700_000_000;
    const series = Array.from({ length: 10 }, (_, i) => ({ date: T0 + i * 86400, tvl: 100 + i * 2 }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => series });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchOnchainTvlFlow();
    expect(fetchMock).toHaveBeenCalledWith('https://api.llama.fi/v2/historicalChainTvl');
    expect(result.ok).toBe(true);
    expect(result.fields.currentTvlUsd).toBe(118); // dia 9: 100+18
    expect(typeof result.lean).toBe('number');
    expect(result.lean).not.toBeNull();
  });

  it('HTTP não-ok real => ok:false, lean null, nunca fabrica leitura', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchOnchainTvlFlow();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('http_500');
    expect(result.lean).toBeNull();
    expect(result.fields).toEqual({});
  });

  it('fetch() rejeita (rede/CORS real) => capturado, ok:false honesto, nunca lança para o chamador', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchOnchainTvlFlow();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Failed to fetch');
    expect(result.lean).toBeNull();
  });

  it('schema inesperado (não-array) => ok:false honesto', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'not found' }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchOnchainTvlFlow();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('resposta_nao_e_array_ou_vazia');
  });
});
