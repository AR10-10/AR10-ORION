// radar-universe.test.ts — OMEGA CORE V-MAX Fase 7 (completar Radar/OIH).
// Execução real da função pura, INCLUINDO contra o arquivo real do
// repositório (não só fixtures) — prova que o filtro/dedupe funciona
// sobre o dado de verdade que o scanner vai consumir em produção.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { extractRadarUniverseSymbols, type AssetUniverseFile } from '../src/nexus/radar-universe';

const here = dirname(fileURLToPath(import.meta.url));

describe('extractRadarUniverseSymbols: fixture controlada', () => {
  const fixture: AssetUniverseFile = {
    groups: [
      {
        group: 'crypto_a', label: 'A', asset_class: 'CRYPTO',
        symbols: [
          { symbol: 'BTC', group: 'crypto_a', asset_class: 'CRYPTO', status: 'ACTIVE_REFERENCE' },
          { symbol: 'ETH', group: 'crypto_a', asset_class: 'CRYPTO', status: 'ACTIVE_REFERENCE' },
        ],
      },
      {
        group: 'crypto_b', label: 'B', asset_class: 'CRYPTO',
        symbols: [
          { symbol: 'BTC', group: 'crypto_b', asset_class: 'CRYPTO', status: 'ACTIVE_REFERENCE' }, // duplicado real (cross-grupo)
          { symbol: 'SOL', group: 'crypto_b', asset_class: 'CRYPTO', status: 'ACTIVE_REFERENCE' },
        ],
      },
      {
        group: 'equities', label: 'Equities', asset_class: 'EQUITY',
        symbols: [
          { symbol: 'MARA', group: 'equities', asset_class: 'EQUITY', status: 'ACTIVE_REFERENCE' },
        ],
      },
    ],
  };

  it('filtra só grupos/símbolos CRYPTO, exclui EQUITY por completo', () => {
    const symbols = extractRadarUniverseSymbols(fixture);
    expect(symbols).not.toContain('MARA');
  });

  it('deduplica símbolo repetido entre grupos (BTC aparece 1x, não 2x)', () => {
    const symbols = extractRadarUniverseSymbols(fixture);
    expect(symbols.filter((s) => s === 'BTC')).toHaveLength(1);
  });

  it('mantém a ordem real de primeira aparição', () => {
    const symbols = extractRadarUniverseSymbols(fixture);
    expect(symbols).toEqual(['BTC', 'ETH', 'SOL']);
  });

  it('grupos/entradas vazios não quebram (fail-closed honesto, nunca lança)', () => {
    expect(extractRadarUniverseSymbols({ groups: [] })).toEqual([]);
  });
});

describe('extractRadarUniverseSymbols: arquivo REAL do repositório', () => {
  it('produz uma lista real, não vazia, e nunca inclui os tickers de ações conhecidos (MARA/RIOT/CLSK)', () => {
    const raw = readFileSync(resolve(here, '../../configs/asset-universe.default.json'), 'utf8');
    const universe = JSON.parse(raw) as AssetUniverseFile;
    const symbols = extractRadarUniverseSymbols(universe);
    expect(symbols.length).toBeGreaterThan(10);
    expect(symbols).toContain('BTC');
    expect(symbols).not.toContain('MARA');
    expect(symbols).not.toContain('RIOT');
    expect(symbols).not.toContain('CLSK');
  });

  it('BTC e DOGE (reais duplicados entre crypto_top_liquidity e pow_mining_crypto) aparecem exatamente 1 vez cada', () => {
    const raw = readFileSync(resolve(here, '../../configs/asset-universe.default.json'), 'utf8');
    const universe = JSON.parse(raw) as AssetUniverseFile;
    const symbols = extractRadarUniverseSymbols(universe);
    expect(symbols.filter((s) => s === 'BTC')).toHaveLength(1);
    expect(symbols.filter((s) => s === 'DOGE')).toHaveLength(1);
  });
});
