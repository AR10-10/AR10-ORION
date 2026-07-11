// nexus-affective-memory.test.ts — V-MAX Fase 1 item 5: trava a Memória
// Afetiva (Reward/Pain com decaimento exponencial) e o CPI. Matemática
// pura e determinística — nenhum relógio real, `at` sempre explícito.
import { describe, it, expect } from 'vitest';
import {
  ingestAffectiveEvent,
  computeCpi,
  EMPTY_AFFECTIVE_STATE,
  AFFECTIVE_HALF_LIFE_MS,
  AFFECTIVE_EVENT_WEIGHTS,
  AFFECTIVE_CONTRACT_VERSION,
} from '../src/nexus/affective-memory';

const T0 = 1_000_000;

describe('ingestAffectiveEvent: decaimento exponencial real aplicado NA ingestão', () => {
  it('primeiro evento soma o peso documentado sem decaimento', () => {
    const s = ingestAffectiveEvent(EMPTY_AFFECTIVE_STATE, 'ENGINE_CYCLE_OK', T0);
    expect(s.reward).toBeCloseTo(AFFECTIVE_EVENT_WEIGHTS.ENGINE_CYCLE_OK.weight, 12);
    expect(s.pain).toBe(0);
    expect(s.eventCount).toBe(1);
    expect(s.lastEventAt).toBe(T0);
    expect(s.contractVersion).toBe(AFFECTIVE_CONTRACT_VERSION);
  });

  it('exatamente UMA meia-vida depois, o acumulador antigo vale metade', () => {
    let s = ingestAffectiveEvent(EMPTY_AFFECTIVE_STATE, 'FEED_WS_DOWN', T0); // pain 0.5
    s = ingestAffectiveEvent(s, 'ENGINE_CYCLE_OK', T0 + AFFECTIVE_HALF_LIFE_MS);
    expect(s.pain).toBeCloseTo(0.25, 12); // 0.5 decaído por meia-vida exata
    expect(s.reward).toBeCloseTo(0.1, 12); // evento novo entra sem decaimento
  });

  it('duas meias-vidas => um quarto (exponencial real, não linear)', () => {
    let s = ingestAffectiveEvent(EMPTY_AFFECTIVE_STATE, 'DATA_STALE', T0); // pain 0.45
    s = ingestAffectiveEvent(s, 'ENGINE_CYCLE_OK', T0 + 2 * AFFECTIVE_HALF_LIFE_MS);
    expect(s.pain).toBeCloseTo(0.45 / 4, 12);
  });

  it('relógio andando para trás nunca amplifica retroativamente (fator 1)', () => {
    let s = ingestAffectiveEvent(EMPTY_AFFECTIVE_STATE, 'ENGINE_CYCLE_OK', T0);
    s = ingestAffectiveEvent(s, 'ENGINE_CYCLE_OK', T0 - 60_000);
    expect(s.reward).toBeCloseTo(0.2, 12); // 0.1 + 0.1, sem decaimento nem boost
  });

  it('estado é imutável — a ingestão devolve um objeto novo', () => {
    const s = ingestAffectiveEvent(EMPTY_AFFECTIVE_STATE, 'ENGINE_CYCLE_OK', T0);
    expect(s).not.toBe(EMPTY_AFFECTIVE_STATE);
    expect(EMPTY_AFFECTIVE_STATE.reward).toBe(0);
  });
});

describe('computeCpi: honesto antes de dado real, razão reward/(reward+pain) depois', () => {
  it('null antes de QUALQUER evento real — nunca um índice de exemplo', () => {
    expect(computeCpi(EMPTY_AFFECTIVE_STATE)).toBeNull();
  });

  it('só rewards => 1.0; só pains => 0.0', () => {
    const r = ingestAffectiveEvent(EMPTY_AFFECTIVE_STATE, 'ENGINE_CYCLE_OK', T0);
    expect(computeCpi(r)).toBe(1);
    const p = ingestAffectiveEvent(EMPTY_AFFECTIVE_STATE, 'ENGINE_CYCLE_ERROR', T0);
    expect(computeCpi(p)).toBe(0);
  });

  it('mistura real => fração exata da massa reward', () => {
    let s = ingestAffectiveEvent(EMPTY_AFFECTIVE_STATE, 'ENGINE_CYCLE_ERROR', T0); // pain 0.6
    s = ingestAffectiveEvent(s, 'FEED_WS_UP', T0); // reward 0.25, dt 0
    expect(computeCpi(s)).toBeCloseTo(0.25 / 0.85, 12);
  });

  it('a razão é INVARIANTE sob decaimento igual — CPI entre eventos não muda, por matemática', () => {
    let s = ingestAffectiveEvent(EMPTY_AFFECTIVE_STATE, 'ENGINE_CYCLE_ERROR', T0);
    s = ingestAffectiveEvent(s, 'FEED_WS_UP', T0);
    const before = computeCpi(s)!;
    // Um evento de peso desprezível muito depois: ambos acumuladores decaem
    // pelo MESMO fator antes da soma — a razão anterior é preservada no
    // limite; aqui verificamos a direção: reward novo puxa o CPI para cima.
    const later = ingestAffectiveEvent(s, 'ENGINE_CYCLE_OK', T0 + 10 * AFFECTIVE_HALF_LIFE_MS);
    const after = computeCpi(later)!;
    expect(after).toBeGreaterThan(before); // memória antiga (dolorosa) decaiu; o presente saudável domina
  });

  it('recência pesa mais: a MESMA sequência de eventos, com a dor mais antiga, dá CPI maior', () => {
    // dor primeiro, reward por último (dor decai) vs dor por último (dor fresca)
    let oldPain = ingestAffectiveEvent(EMPTY_AFFECTIVE_STATE, 'FEED_WS_DOWN', T0);
    oldPain = ingestAffectiveEvent(oldPain, 'FEED_WS_UP', T0 + 3 * AFFECTIVE_HALF_LIFE_MS);
    let freshPain = ingestAffectiveEvent(EMPTY_AFFECTIVE_STATE, 'FEED_WS_UP', T0);
    freshPain = ingestAffectiveEvent(freshPain, 'FEED_WS_DOWN', T0 + 3 * AFFECTIVE_HALF_LIFE_MS);
    expect(computeCpi(oldPain)!).toBeGreaterThan(computeCpi(freshPain)!);
  });
});

describe('tabela de pesos: ordenação de severidade documentada é coerente', () => {
  it('toda fonte REWARD tem peso positivo e toda PAIN idem (nunca zero/negativo)', () => {
    for (const spec of Object.values(AFFECTIVE_EVENT_WEIGHTS)) {
      expect(spec.weight).toBeGreaterThan(0);
      expect(spec.weight).toBeLessThanOrEqual(1);
    }
  });

  it('erro de motor dói mais que queda de WS, que dói mais que erro do poller (ordenação documentada)', () => {
    const w = AFFECTIVE_EVENT_WEIGHTS;
    expect(w.ENGINE_CYCLE_ERROR.weight).toBeGreaterThan(w.FEED_WS_DOWN.weight);
    expect(w.FEED_WS_DOWN.weight).toBeGreaterThan(w.ORDERFLOW_FEED_ERROR.weight);
  });

  it('recuperação recompensa menos do que a falha correspondente doeu', () => {
    const w = AFFECTIVE_EVENT_WEIGHTS;
    expect(w.FEED_WS_UP.weight).toBeLessThan(w.FEED_WS_DOWN.weight);
    expect(w.DATA_FRESH_AGAIN.weight).toBeLessThan(w.DATA_STALE.weight);
  });
});
