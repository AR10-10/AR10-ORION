import { describe, expect, it } from 'vitest';
import {
  computeExpectancy,
  evaluateSignalFilter,
  MIN_TRADES_FOR_VALID_EXPECTANCY,
} from '../src/nexus/expectancy';
import type { TradeCostResult } from '../src/nexus/trade-simulation';

function mkResult(netR: number, status: TradeCostResult['status'] = netR > 0 ? 'TARGET_HIT' : 'STOP_HIT'): TradeCostResult {
  return {
    status,
    direction: 'LONG',
    entryMid: 100,
    riskPoints: 1,
    grossR: netR,
    commissionR: 0,
    slippageR: 0,
    fundingR: 0,
    netR,
    holdingMs: 0,
    regime: null,
  };
}

// Espalha winCount vitórias e lossCount derrotas numa ordem real e
// intercalada (Bresenham: espaçamento o mais uniforme possível), nunca em
// blocos separados ([...wins, ...losses]) — um bloco separado gera um
// drawdown artificial (toda a sequência de derrotas junta) e um final
// artificial (os últimos N trades caindo todos do mesmo lado), o que
// contaminaria testes de badge/maxDrawdown/performance-recente com um
// artefato da fixture, não do algoritmo real.
function interleave(winCount: number, winR: number, lossCount: number, lossR: number): TradeCostResult[] {
  const total = winCount + lossCount;
  const out: TradeCostResult[] = [];
  for (let i = 0; i < total; i++) {
    const isWin = Math.floor(((i + 1) * winCount) / total) > Math.floor((i * winCount) / total);
    out.push(mkResult(isWin ? winR : lossR));
  }
  return out;
}

describe('computeExpectancy: os 2 cenários exatos do documento (hitRate sozinho engana)', () => {
  it('68% hit rate + R:R 1:0.4 -> expectativa NEGATIVA (o "acerto alto" perde dinheiro)', () => {
    // 100 trades: 68 vitórias @ +0.4R, 32 derrotas @ -1.0R
    const results: TradeCostResult[] = [
      ...Array.from({ length: 68 }, () => mkResult(0.4)),
      ...Array.from({ length: 32 }, () => mkResult(-1.0)),
    ];
    const stats = computeExpectancy(results)!;
    expect(stats.winRate).toBeCloseTo(0.68, 10);
    expect(stats.avgWinR).toBeCloseTo(0.4, 10);
    expect(stats.avgLossR).toBeCloseTo(1.0, 10);
    // (0.68*0.4) - (0.32*1.0) = 0.272 - 0.32 = -0.048
    expect(stats.expectancyR).toBeCloseTo(-0.048, 4);
    expect(stats.expectancyR).toBeLessThan(0);

    const filter = evaluateSignalFilter(results);
    expect(filter.show).toBe(false); // SUPRIMIDO — autorização explícita do Operador (LEI 24)
    expect(filter.badge).toBe('red');
  });

  it('42% hit rate + R:R 1:2.5 -> expectativa POSITIVA (o "acerto baixo" ganha dinheiro)', () => {
    // 100 trades: 42 vitórias @ +2.5R, 58 derrotas @ -1.0R, intercaladas
    // (nunca em bloco — ver interleave()) para o badge refletir só a
    // expectativa real, sem um drawdown/final artificial da ordem da fixture.
    const results: TradeCostResult[] = interleave(42, 2.5, 58, -1.0);
    const stats = computeExpectancy(results)!;
    expect(stats.winRate).toBeCloseTo(0.42, 10);
    // (0.42*2.5) - (0.58*1.0) = 1.05 - 0.58 = 0.47
    expect(stats.expectancyR).toBeCloseTo(0.47, 4);
    expect(stats.expectancyR).toBeGreaterThan(0);

    const filter = evaluateSignalFilter(results);
    expect(filter.show).toBe(true);
    expect(filter.badge).toBe('amber');
  });
});

describe('evaluateSignalFilter: supressão (LEI 24, exceção autorizada) só com amostra válida', () => {
  it('amostra < 30 trades NUNCA suprime, mesmo com expectativa aparentemente negativa (ausência de prova != prova de inviabilidade)', () => {
    const results: TradeCostResult[] = [
      ...Array.from({ length: 5 }, () => mkResult(0.4)),
      ...Array.from({ length: 10 }, () => mkResult(-1.0)),
    ];
    expect(results.length).toBeLessThan(MIN_TRADES_FOR_VALID_EXPECTANCY);
    const filter = evaluateSignalFilter(results);
    expect(filter.show).toBe(true);
    expect(filter.badge).toBe('neutral');
    expect(filter.label).toBe('DADOS INSUFICIENTES');
  });

  it('badge verde exige expectativa > 1.0R real', () => {
    const results: TradeCostResult[] = Array.from({ length: 40 }, () => mkResult(1.5));
    const filter = evaluateSignalFilter(results);
    expect(filter.badge).toBe('green');
    expect(filter.label).toBe('ALTA EXPECTATIVA');
  });

  it('win rate < 30% rebaixa o badge em 1 nível mesmo com expectativa alta', () => {
    // winRate baixo mas expectativa > 1R: poucas vitórias muito grandes.
    // Intercalado 1 vitória a cada 5 trades (L,L,L,L,W) — nunca em bloco —
    // pra isolar só o rebaixamento por winRate: com essa ordem o maior
    // drawdown real fica em 4R (4 derrotas seguidas antes de cada vitória
    // de +10R), abaixo do limiar de 5R, e os últimos 20 trades reais (4
    // ciclos completos) somam +24R — nem o rebaixamento por maxDrawdown
    // nem o aviso de performance recente disparam junto.
    const results: TradeCostResult[] = interleave(8, 10, 32, -1.0); // 20% win rate
    const stats = computeExpectancy(results)!;
    expect(stats.winRate).toBeLessThan(0.3);
    expect(stats.expectancyR).toBeGreaterThan(1.0); // (0.2*10)-(0.8*1)=2-0.8=1.2R, "green" antes do rebaixamento
    expect(stats.maxDrawdownR).toBeCloseTo(4, 10);
    const filter = evaluateSignalFilter(results);
    expect(filter.warning).toBeNull();
    expect(filter.badge).toBe('cyan'); // rebaixado de green -> cyan
  });

  it('maxDrawdown real acima do limiar rebaixa o badge em 1 nível', () => {
    // Sequência com um drawdown real grande antes de fechar positivo.
    const results: TradeCostResult[] = [
      mkResult(0.5),
      ...Array.from({ length: 10 }, () => mkResult(-1.0)), // drawdown real de 10R
      ...Array.from({ length: 25 }, () => mkResult(2.0)),
    ];
    const stats = computeExpectancy(results)!;
    expect(stats.maxDrawdownR).toBeGreaterThan(5);
    const filter = evaluateSignalFilter(results);
    // expectativa geral fica bem positiva, mas o badge é rebaixado por causa do MaxDD real
    expect(filter.stats!.expectancyR).toBeGreaterThan(1.0);
    expect(filter.badge).not.toBe('green');
  });

  it('últimos 20 trades reais negativos força badge VERMELHO + aviso, mesmo com expectativa geral positiva (nunca suprime sozinho)', () => {
    const results: TradeCostResult[] = [
      ...Array.from({ length: 40 }, () => mkResult(2.0)), // histórico geral forte
      ...Array.from({ length: 20 }, () => mkResult(-1.0)), // últimos 20 reais, todos negativos
    ];
    const filter = evaluateSignalFilter(results);
    expect(filter.stats!.expectancyR).toBeGreaterThan(0); // geral ainda positivo
    expect(filter.badge).toBe('red');
    expect(filter.warning).toContain('CUIDADO');
    expect(filter.show).toBe(true); // show só depende da expectativa GERAL, nunca do aviso recente sozinho
  });
});

describe('computeExpectancy: edge cases', () => {
  it('amostra vazia -> null (nunca um 0 fabricado)', () => {
    expect(computeExpectancy([])).toBeNull();
  });

  it('zero derrotas reais -> profitFactor e recoveryFactor nunca Infinity fabricado', () => {
    const results: TradeCostResult[] = Array.from({ length: 5 }, () => mkResult(1.0));
    const stats = computeExpectancy(results)!;
    expect(stats.avgLossR).toBe(0);
    expect(stats.profitFactor).toBeNull(); // sem perda real na amostra — null honesto, nunca Infinity
    expect(stats.recoveryFactor).toBeNull(); // maxDrawdownR=0 (equity só sobe) — null honesto, nunca Infinity
  });

  it('equity que só sobe -> maxDrawdownR = 0 real, recoveryFactor null (divisão por zero nunca fabricada)', () => {
    const results: TradeCostResult[] = Array.from({ length: 5 }, () => mkResult(1.0));
    const stats = computeExpectancy(results)!;
    expect(stats.maxDrawdownR).toBe(0);
    expect(stats.recoveryFactor).toBeNull();
  });

  it('desvio padrão zero (todo netR idêntico) -> Sharpe null, nunca uma divisão por zero fabricada', () => {
    const results: TradeCostResult[] = Array.from({ length: 5 }, () => mkResult(1.0));
    const stats = computeExpectancy(results)!;
    expect(stats.sharpeRatio).toBeNull();
  });

  it('maxConsecutiveLosses conta a sequência real mais longa, não o total de derrotas', () => {
    const results: TradeCostResult[] = [
      mkResult(1), mkResult(-1), mkResult(-1), mkResult(-1), mkResult(1), mkResult(-1),
    ];
    const stats = computeExpectancy(results)!;
    expect(stats.maxConsecutiveLosses).toBe(3);
  });

  it('precisão decimal real preservada (mínimo 4 casas, nunca arredondamento grosseiro)', () => {
    const results: TradeCostResult[] = [
      ...Array.from({ length: 7 }, () => mkResult(0.3333)),
      ...Array.from({ length: 13 }, () => mkResult(-0.6667)),
    ];
    const stats = computeExpectancy(results)!;
    const expected = (7 / 20) * 0.3333 - (13 / 20) * 0.6667;
    expect(stats.expectancyR).toBeCloseTo(expected, 6);
  });
});
