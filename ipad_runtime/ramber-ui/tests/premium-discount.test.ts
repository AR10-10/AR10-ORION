// premium-discount.test.ts — Refinamento Final §7: execução real do motor
// Premium/Equilibrium/Discount. Fixtures construídas no teste (permitido —
// a Regra de Ouro 1 proíbe dado sintético no FLUXO real de mercado, não em
// suíte de teste de motor puro, mesma convenção de eta-engine.test.ts).
//
// Truque das fixtures: candles com high === low === v (doji degenerado) —
// findSwings compara highs entre highs e lows entre lows, então o MESMO v
// vira o preço exato do swing dos dois lados, sem offset a compensar.
import { describe, it, expect } from 'vitest';
import { computePremiumDiscount, PREMIUM_DISCOUNT_CONTRACT_VERSION } from '../src/nexus/premium-discount';

const c = (v: number) => ({ high: v, low: v });

// Zigzag com 5 candles por perna (k=2 confirma o fractal): sobe até o
// topo, desce até o fundo, sobe um pouco — último swing high = 1100 (idx 4),
// último swing low = 1000 (idx 8).
const zigzag = [
  c(1040), c(1060), c(1080), c(1090), c(1100), // topo confirmado em idx 4
  c(1080), c(1040), c(1010), c(1000), // fundo em idx 8...
  c(1020), c(1030), // ...confirmado por 2 vizinhos maiores
];

describe('computePremiumDiscount: dealing range real = últimos swings confirmados', () => {
  it('range = último swing high (1100) e último swing low (1000); equilibrium = 1050', () => {
    const r = computePremiumDiscount({ candles: zigzag, price: 1050 });
    expect(r).not.toBeNull();
    expect(r!.contractVersion).toBe(PREMIUM_DISCOUNT_CONTRACT_VERSION);
    expect(r!.rangeHigh.price).toBe(1100);
    expect(r!.rangeLow.price).toBe(1000);
    expect(r!.equilibrium).toBe(1050);
    expect(r!.basis).toBe('LAST_CONFIRMED_FRACTAL_SWINGS');
  });

  it('preço no meio exato => EQUILIBRIUM, pct = 50', () => {
    const r = computePremiumDiscount({ candles: zigzag, price: 1050 });
    expect(r!.zone).toBe('EQUILIBRIUM');
    expect(r!.pricePositionPct).toBe(50);
  });

  it('acima da banda (padrão ±5pp) => PREMIUM; abaixo => DISCOUNT', () => {
    expect(computePremiumDiscount({ candles: zigzag, price: 1056 })!.zone).toBe('PREMIUM'); // 56%
    expect(computePremiumDiscount({ candles: zigzag, price: 1044 })!.zone).toBe('DISCOUNT'); // 44%
  });

  it('bordas da banda são EQUILIBRIUM (45% e 55% inclusos, > / < estritos)', () => {
    expect(computePremiumDiscount({ candles: zigzag, price: 1055 })!.zone).toBe('EQUILIBRIUM');
    expect(computePremiumDiscount({ candles: zigzag, price: 1045 })!.zone).toBe('EQUILIBRIUM');
  });

  it('banda configurável: band=0 faz 50.0001% já ser PREMIUM', () => {
    expect(computePremiumDiscount({ candles: zigzag, price: 1050.01, equilibriumBandPct: 0 })!.zone).toBe('PREMIUM');
  });

  it('preço fora do range: pct cru <0 / >100 (rompimento visível, nunca clampado)', () => {
    const above = computePremiumDiscount({ candles: zigzag, price: 1150 })!;
    expect(above.pricePositionPct).toBeGreaterThan(100);
    expect(above.zone).toBe('PREMIUM');
    const below = computePremiumDiscount({ candles: zigzag, price: 950 })!;
    expect(below.pricePositionPct).toBeLessThan(0);
    expect(below.zone).toBe('DISCOUNT');
  });

  it('fail-closed: candles insuficientes, preço não-finito, ou sem swing => null', () => {
    expect(computePremiumDiscount({ candles: zigzag.slice(0, 3), price: 1050 })).toBeNull();
    expect(computePremiumDiscount({ candles: zigzag, price: null })).toBeNull();
    expect(computePremiumDiscount({ candles: zigzag, price: NaN })).toBeNull();
    // série monotônica: nenhum swing high interno confirmável dos dois lados
    const mono = Array.from({ length: 12 }, (_, i) => c(1000 + i * 10));
    expect(computePremiumDiscount({ candles: mono, price: 1050 })).toBeNull();
  });

  it('range degenerado (último high <= último low) => null honesto', () => {
    // fundo ANTIGO alto (1100 em idx 4 como low), topo recente baixo — força inversão
    const weird = [
      c(1120), c(1110), c(1105), c(1102), c(1100), // low decrescente... vira swing low? não: é monotônico decrescente, sem confirmação
      c(1101), c(1102), c(1103), c(1104), c(1105),
    ];
    // série em V: único swing low no meio, nenhum swing high interno => null por falta de high
    expect(computePremiumDiscount({ candles: weird, price: 1102 })).toBeNull();
  });
});
