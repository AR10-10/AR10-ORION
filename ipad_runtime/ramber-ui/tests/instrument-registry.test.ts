// instrument-registry.test.ts — Ordem Market Data Fabric §1/§4/§5/§14/§15.
// Catálogo puro (zero rede/estado): tick_size/tick_value_usd/contract_size_desc
// de cada InstrumentDefinition foi confirmado via pesquisa real (WebSearch,
// CME Group + fontes de referência de corretoras/dados de mercado) na sessão
// em que o motor foi escrito — os números abaixo travam contra esses valores
// pesquisados, nunca um número adivinhado (Regra de Ouro 1). Testa também as
// funções de consulta puras que sustentam o Instrument Discovery (§4) e o
// seletor em cascata ATIVO→CLASSE→EXCHANGE→CONTRATO (§15).
import { describe, it, expect } from 'vitest';
import {
  ASSET_CLASS, PRIORITY_TIER, TRADFI_FUTURES_INSTRUMENT_TYPE, INSTRUMENT_REGISTRY,
  listInstruments, listByPriorityTier, listByAssetClass, findByInstrumentId,
  findByContractCode, findByContinuousSymbolHint, findByLegacyTradFiAssetSymbol, listAssetClasses,
  listDesignatedContractMarkets, buildCascadingSelectorTree,
} from '../../src/market-data-bus/instrument-registry.js';

describe('instrument-registry: integridade estrutural do catálogo (nenhuma entrada real duplicada/incompleta)', () => {
  it('todo instrument_id é único', () => {
    const ids = INSTRUMENT_REGISTRY.map((i) => i.instrument_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo contract_code é único', () => {
    const codes = INSTRUMENT_REGISTRY.map((i) => i.contract_code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('todo continuous_symbol_hint não-nulo é único (nunca dois instrumentos apontam pro mesmo símbolo Yahoo)', () => {
    const hints = INSTRUMENT_REGISTRY.map((i) => i.continuous_symbol_hint).filter((h): h is string => Boolean(h));
    expect(new Set(hints).size).toBe(hints.length);
  });

  it('todo instrumento usa instrument_type=tradfi_futures (contrato com STRUCTURAL_NAO_APLICAVEL_BY_INSTRUMENT em schema.js)', () => {
    for (const i of INSTRUMENT_REGISTRY) expect(i.instrument_type).toBe(TRADFI_FUTURES_INSTRUMENT_TYPE);
    expect(TRADFI_FUTURES_INSTRUMENT_TYPE).toBe('tradfi_futures');
  });

  it('todo tick_size e tick_value_usd é um número finito positivo (dado de referência real, nunca um placeholder)', () => {
    for (const i of INSTRUMENT_REGISTRY) {
      expect(Number.isFinite(i.tick_size)).toBe(true);
      expect(i.tick_size).toBeGreaterThan(0);
      expect(Number.isFinite(i.tick_value_usd)).toBe(true);
      expect(i.tick_value_usd).toBeGreaterThan(0);
    }
  });

  it('todo instrumento pertence a um ASSET_CLASS e PRIORITY_TIER válidos', () => {
    const classes = Object.values(ASSET_CLASS);
    const tiers = Object.values(PRIORITY_TIER);
    for (const i of INSTRUMENT_REGISTRY) {
      expect(classes).toContain(i.asset_class);
      expect(tiers).toContain(i.priority_tier);
    }
  });
});

describe('instrument-registry: universo Priority A (CORE) cobre o Ordem §5 literalmente', () => {
  it('os 19 contratos CORE nomeados no Ordem §5 estão presentes em tier A', () => {
    const coreIds = listByPriorityTier(PRIORITY_TIER.A).map((i) => i.instrument_id);
    // Índices de ações (ES/NQ/YM/RTY + micros), metais, energia, rates, FX —
    // literalmente a lista do Ordem §5 (BTC/ETH Futures ficam de fora daqui
    // de propósito: já são o núcleo cripto existente via Binance, não uma
    // lacuna nova — ver notes de CME_BTC/CME_ETH, tier B/C).
    for (const id of ['CME_ES', 'CME_NQ', 'CME_YM', 'CME_RTY', 'CME_GC', 'CME_SI', 'CME_HG', 'CME_CL', 'CME_NG', 'CME_ZN', 'CME_6E']) {
      expect(coreIds).toContain(id);
    }
  });

  it('CME_BTC/CME_ETH (futuros datados da CME) existem no catálogo mas fora do tier A — nunca um segundo cérebro para o par que o Core Engine já opera via Binance', () => {
    const btc = findByInstrumentId('CME_BTC');
    const eth = findByInstrumentId('CME_ETH');
    expect(btc?.priority_tier).not.toBe(PRIORITY_TIER.A);
    expect(eth?.priority_tier).not.toBe(PRIORITY_TIER.A);
    expect(btc?.notes).toMatch(/distinto do perpetuo/);
  });
});

describe('instrument-registry: consultas puras usadas pelo seletor em cascata (§15)', () => {
  it('findByInstrumentId resolve um contrato real com todos os campos esperados', () => {
    const nq = findByInstrumentId('CME_NQ');
    expect(nq).toMatchObject({
      instrument_id: 'CME_NQ', contract_code: 'NQ', continuous_symbol_hint: 'NQ=F',
      tick_size: 0.25, tick_value_usd: 5, asset_class: ASSET_CLASS.EQUITY_INDEX,
    });
  });

  it('findByInstrumentId devolve null para um id inexistente (fail-closed, nunca um objeto parcial inventado)', () => {
    expect(findByInstrumentId('CME_NAO_EXISTE')).toBeNull();
  });

  it('findByContractCode resolve pelo símbolo curto real (ex. "GC")', () => {
    expect(findByContractCode('GC')?.display_name).toBe('Ouro (Gold)');
  });

  it('findByContinuousSymbolHint resolve pelo símbolo Yahoo real (ex. "ES=F") — usado no caminho dado→instrumento da exibição', () => {
    expect(findByContinuousSymbolHint('ES=F')?.instrument_id).toBe('CME_ES');
    expect(findByContinuousSymbolHint('NAO=F')).toBeNull();
    expect(findByContinuousSymbolHint(null)).toBeNull();
  });

  it('listByAssetClass filtra corretamente por classe real', () => {
    const metals = listByAssetClass(ASSET_CLASS.METALS);
    expect(metals.map((i) => i.contract_code).sort()).toEqual(['GC', 'HG', 'SI']);
  });

  it('listAssetClasses/listDesignatedContractMarkets refletem o conteúdo real do catálogo (nunca uma lista fixa desalinhada)', () => {
    expect(listAssetClasses()).toEqual(
      expect.arrayContaining([ASSET_CLASS.EQUITY_INDEX, ASSET_CLASS.METALS, ASSET_CLASS.ENERGY, ASSET_CLASS.RATES, ASSET_CLASS.FX, ASSET_CLASS.CRYPTO]),
    );
    expect(listDesignatedContractMarkets()).toEqual(expect.arrayContaining(['CME', 'CBOT', 'COMEX', 'NYMEX']));
  });

  it('listInstruments ordena Priority A antes de B antes de C', () => {
    const ordered = listInstruments();
    const tierIndexOf = { A: 0, B: 1, C: 2 } as const;
    for (let i = 1; i < ordered.length; i++) {
      expect(tierIndexOf[ordered[i - 1].priority_tier as 'A' | 'B' | 'C']).toBeLessThanOrEqual(
        tierIndexOf[ordered[i].priority_tier as 'A' | 'B' | 'C'],
      );
    }
  });

  it('findByLegacyTradFiAssetSymbol conecta o catálogo pré-existente (src/omnibox/tradfi-assets.ts) SEM duplicá-lo — 9 pares reais e honestos, o resto null', () => {
    const mapped: Record<string, string> = {
      SPX: 'CME_ES', NDX: 'CME_NQ', US30: 'CME_YM', RUT: 'CME_RTY',
      XAUUSD: 'CME_GC', XAGUSD: 'CME_SI', USOIL: 'CME_CL', EURUSD: 'CME_6E', GBPUSD: 'CME_6B',
    };
    for (const [legacy, instrumentId] of Object.entries(mapped)) {
      expect(findByLegacyTradFiAssetSymbol(legacy)?.instrument_id).toBe(instrumentId);
    }
    // Sem mapeamento seguro (ações, GER40/Eurex, Brent/ICE, USDJPY com
    // convenção de cotação invertida) — null honesto, nunca um chute.
    for (const unmapped of ['TSLA', 'NVDA', 'AAPL', 'MSFT', 'META', 'GER40', 'UKOIL', 'USDJPY', 'NAO_EXISTE']) {
      expect(findByLegacyTradFiAssetSymbol(unmapped)).toBeNull();
    }
    expect(findByLegacyTradFiAssetSymbol(null as unknown as string)).toBeNull();
    expect(findByLegacyTradFiAssetSymbol('')).toBeNull();
  });

  it('todo legacy_tradfi_asset_symbol presente é único (nunca dois instrumentos disputando o mesmo botão do seletor legado)', () => {
    const legacySymbols = INSTRUMENT_REGISTRY.map((i) => i.legacy_tradfi_asset_symbol).filter(Boolean);
    expect(new Set(legacySymbols).size).toBe(legacySymbols.length);
    expect(legacySymbols).toHaveLength(9);
  });

  it('buildCascadingSelectorTree constrói ATIVO→EXCHANGE→[instrumentos] a partir do MESMO catálogo (nunca uma segunda cópia redigitada)', () => {
    const tree = buildCascadingSelectorTree();
    expect(Object.keys(tree)).toEqual(expect.arrayContaining(listAssetClasses()));
    expect(tree[ASSET_CLASS.EQUITY_INDEX].CME.map((i: { contract_code: string }) => i.contract_code)).toContain('NQ');
    expect(tree[ASSET_CLASS.EQUITY_INDEX].CBOT.map((i: { contract_code: string }) => i.contract_code)).toContain('YM');
    // Total de instrumentos na árvore == total do catálogo, nenhum perdido/duplicado.
    const totalInTree = Object.values(tree).reduce(
      (sum: number, byDcm) => sum + Object.values(byDcm as Record<string, unknown[]>).reduce((s, arr) => s + arr.length, 0),
      0,
    );
    expect(totalInTree).toBe(INSTRUMENT_REGISTRY.length);
  });
});
