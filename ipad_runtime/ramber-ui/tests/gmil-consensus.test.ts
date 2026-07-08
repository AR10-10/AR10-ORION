// gmil-consensus.test.ts — permanent regression suite for the GMIL
// Consensus Engine (LEI 04: weighted, consultative-only score). Imports
// the REAL module (never a mock) from ramber-ui/src itself. Reconstructs,
// as a versioned suite, the ad-hoc verification done when this engine was
// built and later re-verified across the Protocolo Mestre audits (zero
// import from this module back into the Core Engine — that boundary is
// enforced by the absence of an import statement, not by a test; a test
// here can only ever verify the math of the score itself).
import { describe, it, expect } from 'vitest';
import { computeConsensus, type ConsensusInput } from '../src/gmil/consensus-engine';

describe('gmil-consensus: fail-closed on no usable input', () => {
  it('returns a null score (never a fabricated neutral 0) with zero inputs', () => {
    const result = computeConsensus([]);
    expect(result.score).toBeNull();
    expect(result.sampleSize).toBe(0);
    expect(result.contributingProviders).toEqual([]);
  });

  it('excludes providers with weight 0, and returns null if that leaves nothing usable', () => {
    const inputs: ConsensusInput[] = [{ providerId: 'a', lean: 0.5, weight: 0 }];
    const result = computeConsensus(inputs);
    expect(result.score).toBeNull();
  });

  it('excludes providers with a null lean', () => {
    const inputs: ConsensusInput[] = [{ providerId: 'a', lean: null, weight: 1 }];
    const result = computeConsensus(inputs);
    expect(result.score).toBeNull();
  });

  it('excludes providers with a non-finite lean (NaN/Infinity), never lets it poison the average', () => {
    const inputs: ConsensusInput[] = [
      { providerId: 'bad', lean: NaN, weight: 1 },
      { providerId: 'good', lean: 0.4, weight: 1 },
    ];
    const result = computeConsensus(inputs);
    expect(result.score).toBe(0.4);
    expect(result.contributingProviders).toEqual(['good']);
  });
});

describe('gmil-consensus: weighted average is real math, not a plain mean', () => {
  it('a single usable provider produces a score exactly equal to its own lean', () => {
    const result = computeConsensus([{ providerId: 'solo', lean: 0.73, weight: 0.9 }]);
    expect(result.score).toBe(0.73);
    expect(result.sampleSize).toBe(1);
  });

  it('two equally-weighted providers average to the midpoint', () => {
    const result = computeConsensus([
      { providerId: 'a', lean: 1, weight: 1 },
      { providerId: 'b', lean: -0.5, weight: 1 },
    ]);
    expect(result.score).toBeCloseTo(0.25, 10);
  });

  it('a higher-weight provider pulls the score toward its own lean (not a plain mean)', () => {
    const result = computeConsensus([
      { providerId: 'heavy', lean: 1, weight: 3 },
      { providerId: 'light', lean: -1, weight: 1 },
    ]);
    // Weighted mean: (1*3 + -1*1) / 4 = 0.5 — the plain mean would be 0.
    expect(result.score).toBeCloseTo(0.5, 10);
    expect(result.score).not.toBeCloseTo(0, 5);
  });

  it('reports sampleSize and contributingProviders honestly (only the usable ones)', () => {
    const result = computeConsensus([
      { providerId: 'usable-1', lean: 0.2, weight: 0.5 },
      { providerId: 'usable-2', lean: -0.1, weight: 0.5 },
      { providerId: 'zero-weight', lean: 0.9, weight: 0 },
      { providerId: 'null-lean', lean: null, weight: 0.8 },
    ]);
    expect(result.sampleSize).toBe(2);
    expect(result.contributingProviders).toEqual(['usable-1', 'usable-2']);
  });
});

describe('gmil-consensus: score stays within the documented [-1,1] range for real inputs', () => {
  it('never exceeds the range even with mixed extreme leans', () => {
    const result = computeConsensus([
      { providerId: 'a', lean: 1, weight: 0.7 },
      { providerId: 'b', lean: 1, weight: 0.3 },
    ]);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.score).toBeGreaterThanOrEqual(-1);
  });
});
