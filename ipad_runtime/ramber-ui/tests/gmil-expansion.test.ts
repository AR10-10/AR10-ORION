// gmil-expansion.test.ts — permanent regression suite for the GMIL
// expansion (V15 Fase E: category taxonomy, the 4 constitutional biases,
// the real DERIVATIVES provider's pure functions). Imports the REAL
// modules (never a mock); only network is absent — the provider's parse/
// lean functions are pure by design, same convention as
// mexc-trades-stream.js.
import { describe, it, expect } from 'vitest';
import {
  aggregateContextBiases,
  BIAS_CATEGORY_MAP,
  type CategorizedConsensusInput,
} from '../src/gmil/context-aggregator';
import { computeConsensus } from '../src/gmil/consensus-engine';
import {
  fundingToLean,
  parsePremiumIndex,
  FUNDING_EXTREME,
} from '../src/gmil/providers/derivatives-provider';

const input = (
  providerId: string,
  category: CategorizedConsensusInput['category'],
  lean: number | null,
  weight = 1,
): CategorizedConsensusInput => ({ providerId, category, lean, weight });

describe('gmil-expansion: fundingToLean é posicionamento real clampado, nunca fabricado', () => {
  it('funding zero => lean exatamente 0', () => {
    expect(fundingToLean(0)).toBe(0);
  });

  it('funding no extremo histórico (±0.05%) => lean exatamente ±1', () => {
    expect(fundingToLean(FUNDING_EXTREME)).toBe(1);
    expect(fundingToLean(-FUNDING_EXTREME)).toBe(-1);
  });

  it('funding além do extremo é clampado, nunca extrapola [-1,1]', () => {
    expect(fundingToLean(0.01)).toBe(1);
    expect(fundingToLean(-0.01)).toBe(-1);
  });

  it('meio do caminho é linear (0.025% => 0.5)', () => {
    expect(fundingToLean(FUNDING_EXTREME / 2)).toBeCloseTo(0.5, 10);
  });

  it('entrada não-finita/null => null (nunca um lean chutado)', () => {
    expect(fundingToLean(null)).toBeNull();
    expect(fundingToLean(NaN)).toBeNull();
  });
});

describe('gmil-expansion: parsePremiumIndex é fail-closed sobre a forma real da resposta', () => {
  it('resposta válida => funding + basis real (mark vs index, em %)', () => {
    const parsed = parsePremiumIndex({ lastFundingRate: '0.00025', markPrice: '50100', indexPrice: '50000' });
    expect(parsed.ok).toBe(true);
    expect(parsed.fundingRate).toBeCloseTo(0.00025, 10);
    expect(parsed.basisPct).toBeCloseTo(0.2, 10); // (50100-50000)/50000 * 100
  });

  it('funding ausente => ok false com motivo, nunca um número inventado', () => {
    const parsed = parsePremiumIndex({ markPrice: '50100', indexPrice: '50000' });
    expect(parsed.ok).toBe(false);
    expect(parsed.fundingRate).toBeNull();
    expect(parsed.reason).toContain('lastFundingRate');
  });

  it('mark/index inválidos => basis null, mas funding real ainda passa', () => {
    const parsed = parsePremiumIndex({ lastFundingRate: '0.0001', markPrice: '0', indexPrice: 'abc' });
    expect(parsed.ok).toBe(true);
    expect(parsed.basisPct).toBeNull();
  });

  it('resposta lixo => fail-closed total', () => {
    expect(parsePremiumIndex(null).ok).toBe(false);
    expect(parsePremiumIndex({}).ok).toBe(false);
  });
});

describe('gmil-expansion: agregação por categoria (V15 Cap. 6) — LEI 04 preservada', () => {
  const derivatives = input('derivatives_positioning', 'DERIVATIVES', 0.6);
  const onchain = input('whale_flows_futuro', 'ONCHAIN', -0.2);
  const macro = input('dxy_futuro', 'MACRO', -0.8);
  const blockchain = input('coingecko_global', 'BLOCKCHAIN', 0.3);
  const sentiment = input('fear_greed_index', 'SENTIMENT', 0.9);

  it('contextScore é EXATAMENTE computeConsensus sobre todas as entradas (mesma matemática, não uma segunda)', () => {
    const inputs = [derivatives, onchain, macro, blockchain, sentiment];
    const biases = aggregateContextBiases(inputs);
    expect(biases.contextScore).toEqual(computeConsensus(inputs));
  });

  it('institutionalBias só ouve DERIVATIVES+ONCHAIN — sentimento/macro ficam de fora', () => {
    const biases = aggregateContextBiases([derivatives, onchain, macro, blockchain, sentiment]);
    expect(biases.institutionalBias.contributingProviders.sort()).toEqual(
      ['derivatives_positioning', 'whale_flows_futuro'].sort(),
    );
    // média ponderada real de 0.6 e -0.2 com pesos iguais
    expect(biases.institutionalBias.score).toBeCloseTo(0.2, 10);
  });

  it('macroBias só ouve MACRO, liquidityBias só ouve BLOCKCHAIN', () => {
    const biases = aggregateContextBiases([derivatives, onchain, macro, blockchain, sentiment]);
    expect(biases.macroBias.contributingProviders).toEqual(['dxy_futuro']);
    expect(biases.macroBias.score).toBeCloseTo(-0.8, 10);
    expect(biases.liquidityBias.contributingProviders).toEqual(['coingecko_global']);
    expect(biases.liquidityBias.score).toBeCloseTo(0.3, 10);
  });

  it('categoria sem provedor ativo => score null honesto (o gancho da Fase E), nunca um neutro fabricado', () => {
    // Estado REAL de produção hoje: sem provedor ONCHAIN nem MACRO.
    const biases = aggregateContextBiases([derivatives, blockchain, sentiment]);
    expect(biases.macroBias.score).toBeNull();
    expect(biases.macroBias.sampleSize).toBe(0);
    // institutional continua real só com derivativos
    expect(biases.institutionalBias.score).toBeCloseTo(0.6, 10);
  });

  it('provedor com peso 0 (circuito aberto) é excluído de TODOS os vieses, igual ao consenso', () => {
    const deadDerivatives = input('derivatives_positioning', 'DERIVATIVES', 0.6, 0);
    const biases = aggregateContextBiases([deadDerivatives, blockchain]);
    expect(biases.institutionalBias.score).toBeNull();
    expect(biases.contextScore.contributingProviders).toEqual(['coingecko_global']);
  });

  it('lean null (ex.: trending_coins) nunca entra em viés nenhum', () => {
    const attention = input('trending_coins', 'ATTENTION', null);
    const biases = aggregateContextBiases([attention, blockchain]);
    expect(biases.contextScore.contributingProviders).toEqual(['coingecko_global']);
  });

  it('o mapa categoria→viés é o documentado e é imutável', () => {
    expect(BIAS_CATEGORY_MAP.institutionalBias).toEqual(['DERIVATIVES', 'ONCHAIN']);
    expect(BIAS_CATEGORY_MAP.macroBias).toEqual(['MACRO']);
    expect(BIAS_CATEGORY_MAP.liquidityBias).toEqual(['BLOCKCHAIN']);
    expect(Object.isFrozen(BIAS_CATEGORY_MAP)).toBe(true);
  });
});
