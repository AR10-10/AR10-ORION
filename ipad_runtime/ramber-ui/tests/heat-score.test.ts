// heat-score.test.ts — Diretriz Mestra §1/§12: execução real do Heat Score
// (intensidade de ATIVIDADE — nunca probabilidade/direção; ver módulo).
import { describe, it, expect } from 'vitest';
import { computeHeatScore, heatTier, HEAT_DELTA_PCT_CAP, HEAT_LIQUIDATION_CAP } from '../src/nexus/heat-score';

describe('computeHeatScore: média simples de componentes reais, fail-closed', () => {
  it('3 componentes no teto => 100 EXTREMO', () => {
    const r = computeHeatScore({ bandwidthPercentile: 100, deltaPct: HEAT_DELTA_PCT_CAP, recentLiquidationCount: HEAT_LIQUIDATION_CAP });
    expect(r.status).toBe('OK');
    expect(r.score).toBe(100);
    expect(r.tier).toBe('EXTREMO');
    expect(r.components).toHaveLength(3);
  });

  it('3 componentes zeradas => 0 FRIO (mercado parado é leitura real, não erro)', () => {
    const r = computeHeatScore({ bandwidthPercentile: 0, deltaPct: 0, recentLiquidationCount: 0 });
    expect(r.score).toBe(0);
    expect(r.tier).toBe('FRIO');
  });

  it('Δ24h negativo conta pela MAGNITUDE (|Δ|) — atividade não tem direção', () => {
    const up = computeHeatScore({ bandwidthPercentile: 50, deltaPct: 5, recentLiquidationCount: null });
    const down = computeHeatScore({ bandwidthPercentile: 50, deltaPct: -5, recentLiquidationCount: null });
    expect(up.score).toBe(down.score);
  });

  it('tetos documentados: Δ24h de 25% e 40 liquidações saturam nos caps, nunca estouram 100', () => {
    const r = computeHeatScore({ bandwidthPercentile: 0, deltaPct: 25, recentLiquidationCount: 40 });
    // componentes: 0 + 1 + 1 => média 2/3 => 67
    expect(r.score).toBe(67);
  });

  it('fail-closed: menos de 2 componentes reais => DADOS_INSUFICIENTES, score null', () => {
    const r = computeHeatScore({ bandwidthPercentile: 80, deltaPct: null, recentLiquidationCount: null });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.score).toBeNull();
    expect(r.tier).toBeNull();
    expect(computeHeatScore({ bandwidthPercentile: null, deltaPct: NaN, recentLiquidationCount: null }).status).toBe('DADOS_INSUFICIENTES');
  });

  it('2 componentes bastam (média das disponíveis — zero componente fabricada para completar)', () => {
    const r = computeHeatScore({ bandwidthPercentile: 60, deltaPct: 3, recentLiquidationCount: null });
    expect(r.status).toBe('OK');
    expect(r.components).toHaveLength(2);
    // (0.6 + 0.3)/2 = 0.45 => 45
    expect(r.score).toBe(45);
    expect(r.tier).toBe('MORNO');
  });

  it('faixas do tier nos cortes documentados (25/50/75)', () => {
    expect(heatTier(24)).toBe('FRIO');
    expect(heatTier(25)).toBe('MORNO');
    expect(heatTier(49)).toBe('MORNO');
    expect(heatTier(50)).toBe('QUENTE');
    expect(heatTier(74)).toBe('QUENTE');
    expect(heatTier(75)).toBe('EXTREMO');
  });

  it('contrato nunca fala em probabilidade (Regra de Ouro 2 travada no nível do fonte)', () => {
    const src = require('node:fs').readFileSync(require.resolve('../src/nexus/heat-score.ts'), 'utf8');
    expect(src).not.toMatch(/probabilit|probabilidade de acerto|chance de/i);
  });
});
