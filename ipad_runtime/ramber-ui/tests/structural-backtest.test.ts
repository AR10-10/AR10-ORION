// structural-backtest.test.ts — execução REAL do medidor de desfechos
// estruturais (fase 1 da iniciativa "histórico real + backtest honesto").
// Prova as propriedades que tornam o resultado confiável: zero-lookahead,
// resolução first-touch determinística, empate conservador, simetria
// LONG/SHORT por espelhamento exato de preço, dedup de trials, fail-closed
// e honestidade do contrato — sobre a fixture determinística versionada
// (nunca apresentada como mercado real) e séries construídas à mão.
import { describe, it, expect } from 'vitest';
import {
  runStructuralBacktest,
  BACKTEST_AVISO,
  BACKTEST_DEFAULT_HORIZON_BARS,
} from '../../src/research/backtest/structural-backtest.js';
import { generateReplayFixture } from '../../tools/generate-replay-fixture.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

// Série de mão: zigue-zague ASCENDENTE determinístico — fundos e topos
// cada vez mais altos (ESTRUTURA_ALTA real via fractais), amplitude
// suficiente para swings confirmados com FRACTAL_K=2.
// GEOMETRIA DELIBERADA (achado da 1ª execução): a janela precisa terminar
// na fase DESCENDENTE do ciclo (preço mid-range), senão o close fica acima
// do último swing high confirmável e `close < resistance_1` falha — o
// trial não abriria no 1º frame. count deve ser ≡ 0 (mod 8): último
// candle na fase 7 (descida pós-pico), pico confirmado 3 barras antes.
function ascendingZigzag(count: number, t0 = 1_700_000_000, stepS = 900): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const base = 100 + i * 0.5; // deriva ascendente
    const phase = i % 8;
    const wave = phase < 4 ? phase * 2 : (8 - phase) * 2; // sobe até 8 na fase 4, desce de volta
    const mid = base + wave;
    out.push({ t: t0 + i * stepS, o: mid - 0.3, h: mid + 1, l: mid - 1, c: mid + 0.3, v: 10 });
  }
  return out;
}

// Espelho EXATO de preço em torno de K: p -> 2K - p (h e l trocam).
function mirror(candles: Candle[], K = 1000): Candle[] {
  return candles.map((c) => ({ t: c.t, o: 2 * K - c.o, h: 2 * K - c.l, l: 2 * K - c.h, c: 2 * K - c.c, v: c.v }));
}

describe('runStructuralBacktest — fixture determinística versionada (mecânica real, nunca afirmação de mercado)', () => {
  it('roda o walk-forward inteiro sobre a fixture real do replay e devolve o contrato honesto completo', async () => {
    const fixture = generateReplayFixture();
    const r = await runStructuralBacktest({ candles: fixture.candles, symbol: fixture.symbol, timeframe: '15m' });
    expect(r.status).toBe('OK');
    expect(r.read_only).toBe(true);
    expect(r.aviso).toBe(BACKTEST_AVISO);
    expect(r.aviso).toContain('NUNCA probabilidade futura');
    expect(r.provenance.candles).toBe(fixture.candles.length);
    expect(r.provenance.frames).toBe(fixture.candles.length - r.provenance.windowSize + 1);
    // contabilidade fecha: todo trial tem exatamente um desfecho
    const a = r.aggregate;
    expect(a.targetHits + a.stopHits + a.unresolved).toBe(a.samples);
    expect(a.porDirecao.LONG.trials + a.porDirecao.SHORT.trials).toBe(a.samples);
    expect(a.resolved).toBe(a.targetHits + a.stopHits);
    if (a.resolved > 0) {
      expect(a.taxaAlvoAmostra).toBeCloseTo(a.targetHits / a.resolved, 12);
    } else {
      expect(a.taxaAlvoAmostra).toBeNull();
    }
    // trials congelados e ordenados por decisão
    for (let i = 1; i < r.trials.length; i++) {
      expect(r.trials[i].decisionIndex).toBeGreaterThanOrEqual(r.trials[i - 1].decisionIndex);
    }
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.trials)).toBe(true);
  });

  it('ZERO-LOOKAHEAD: mutar candles do futuro NUNCA muda os parâmetros dos trials decididos antes deles (só os desfechos, que são a medição do próprio futuro)', async () => {
    const fixture = generateReplayFixture();
    const base = await runStructuralBacktest({ candles: fixture.candles });
    const M = 400; // corte: tudo depois vira ruído extremo
    const mutated = fixture.candles.map((c: Candle, i: number) =>
      i >= M ? { ...c, o: c.o * 3, h: c.h * 3.2, l: c.l * 2.8, c: c.c * 3 } : c,
    );
    const withNoise = await runStructuralBacktest({ candles: mutated });
    const pick = (r: any) =>
      r.trials
        .filter((t: any) => t.decisionIndex <= M)
        .map((t: any) => [t.decisionIndex, t.direction, t.entry, t.stop, t.target]);
    expect(pick(withNoise)).toEqual(pick(base));
  });
});

describe('runStructuralBacktest — resolução determinística em séries de mão', () => {
  // Janela de 64 (≥60 do regime, e ≡0 mod 8 — termina na fase descendente,
  // ver comentário do gerador) => ESTRUTURA_ALTA com S/R reais e geometria
  // válida no PRIMEIRO frame; os candles seguintes tocam exatamente o que
  // cada caso pede.
  const WINDOW = 64;

  async function firstTrialWith(extra: (levels: { stop: number; target: number; entry: number }) => Candle[]) {
    const windowCandles = ascendingZigzag(WINDOW);
    // roda uma vez só com a janela + 1 candle neutro para descobrir os níveis reais do 1º trial
    const probeTail: Candle[] = [{ t: windowCandles[WINDOW - 1].t + 900, o: 130, h: 130.2, l: 129.8, c: 130, v: 10 }];
    const probe = await runStructuralBacktest({ candles: [...windowCandles, ...probeTail], windowSize: WINDOW, horizonBars: 1 });
    expect(probe.status).toBe('OK');
    expect(probe.trials.length).toBeGreaterThanOrEqual(1);
    const t0 = probe.trials[0];
    expect(t0.direction).toBe('LONG'); // estrutura ascendente real
    expect(t0.decisionIndex).toBe(WINDOW); // decidido no 1º frame — níveis vêm da janela pura, nunca do tail
    const levels = { stop: t0.stop, target: t0.target, entry: t0.entry };
    const tail = extra(levels);
    const full = [...windowCandles, ...tail.map((c, i) => ({ ...c, t: windowCandles[WINDOW - 1].t + 900 * (i + 1) }))];
    const r = await runStructuralBacktest({ candles: full, windowSize: WINDOW, horizonBars: tail.length });
    expect(r.status).toBe('OK');
    expect(r.trials[0].decisionIndex).toBe(WINDOW); // o MESMO trial do probe — mesmos níveis medidos
    return r.trials[0];
  }

  it('TARGET: candle posterior toca só o alvo => TARGET com barsToResolve exato', async () => {
    const trial = await firstTrialWith(({ target, stop }) => [
      // 1º candle neutro (não toca nada), 2º toca só o alvo
      { t: 0, o: (target + stop) / 2, h: (target + stop) / 2 + 0.01, l: stop + 0.01, c: (target + stop) / 2, v: 10 },
      { t: 0, o: target - 0.5, h: target + 0.5, l: stop + 0.01, c: target, v: 10 },
    ]);
    expect(trial.outcome).toBe('TARGET');
    expect(trial.barsToResolve).toBe(2);
  });

  it('STOP: candle posterior toca só o stop => STOP', async () => {
    const trial = await firstTrialWith(({ stop, target }) => [
      { t: 0, o: stop + 1, h: Math.min(stop + 2, target - 0.01), l: stop - 0.5, c: stop + 1, v: 10 },
    ]);
    expect(trial.outcome).toBe('STOP');
    expect(trial.barsToResolve).toBe(1);
  });

  it('EMPATE CONSERVADOR: mesmo candle toca stop E alvo => AMBOS_STOP_CONSERVADOR (o empate nunca vira acerto)', async () => {
    const trial = await firstTrialWith(({ stop, target }) => [
      { t: 0, o: (target + stop) / 2, h: target + 1, l: stop - 1, c: (target + stop) / 2, v: 10 },
    ]);
    expect(trial.outcome).toBe('AMBOS_STOP_CONSERVADOR');
  });

  it('NAO_RESOLVIDO: nenhum toque dentro do horizonte => nunca conta como acerto; barsToResolve null honesto', async () => {
    const trial = await firstTrialWith(({ stop, target }) => [
      { t: 0, o: (target + stop) / 2, h: target - 0.01, l: stop + 0.01, c: (target + stop) / 2, v: 10 },
      { t: 0, o: (target + stop) / 2, h: target - 0.01, l: stop + 0.01, c: (target + stop) / 2, v: 10 },
    ]);
    expect(trial.outcome).toBe('NAO_RESOLVIDO');
    expect(trial.barsToResolve).toBeNull();
  });

  it('SIMETRIA LONG/SHORT: a série espelhada em preço produz os MESMOS trials com direção invertida, níveis espelhados e desfechos idênticos', async () => {
    const windowCandles = ascendingZigzag(WINDOW);
    const tail: Candle[] = [
      { t: 0, o: 128, h: 132, l: 127, c: 131, v: 10 },
      { t: 0, o: 131, h: 136, l: 130, c: 135, v: 10 },
      { t: 0, o: 135, h: 140, l: 128, c: 139, v: 10 },
    ].map((c, i) => ({ ...c, t: windowCandles[WINDOW - 1].t + 900 * (i + 1) }));
    const series = [...windowCandles, ...tail];
    const K = 1000;
    const long = await runStructuralBacktest({ candles: series, windowSize: WINDOW, horizonBars: 3 });
    const short = await runStructuralBacktest({ candles: mirror(series, K), windowSize: WINDOW, horizonBars: 3 });
    expect(long.status).toBe('OK');
    expect(short.status).toBe('OK');
    expect(short.trials.length).toBe(long.trials.length);
    for (let i = 0; i < long.trials.length; i++) {
      const a = long.trials[i];
      const b = short.trials[i];
      expect(b.direction).toBe(a.direction === 'LONG' ? 'SHORT' : 'LONG');
      expect(b.decisionIndex).toBe(a.decisionIndex);
      expect(b.entry).toBeCloseTo(2 * K - a.entry, 8);
      expect(b.stop).toBeCloseTo(2 * K - a.stop, 8);
      expect(b.target).toBeCloseTo(2 * K - a.target, 8);
      expect(b.outcome).toBe(a.outcome);
      expect(b.riskReward).toBeCloseTo(a.riskReward, 8);
    }
  });

  it('DEDUP: trials da MESMA direção nunca se sobrepõem no tempo — um novo só abre depois do anterior resolver (a amostra nunca conta o mesmo cenário 2x em paralelo)', async () => {
    const windowCandles = ascendingZigzag(WINDOW + 24); // 24 frames extras com estrutura persistente
    const r = await runStructuralBacktest({ candles: windowCandles, windowSize: WINDOW, horizonBars: BACKTEST_DEFAULT_HORIZON_BARS });
    expect(r.status).toBe('OK');
    const longTrials = r.trials.filter((t: any) => t.direction === 'LONG');
    expect(longTrials.length).toBeGreaterThanOrEqual(1); // a estrutura persistente PRODUZ amostra real
    for (let i = 1; i < longTrials.length; i++) {
      const prev = longTrials[i - 1];
      // resolvido em N barras => último candle consumido = decisionIndex+N-1;
      // o próximo trial só pode decidir num frame ESTRITAMENTE posterior.
      expect(prev.outcome).not.toBe('NAO_RESOLVIDO'); // se houve sucessor, o anterior fechou por toque
      expect(longTrials[i].decisionIndex).toBeGreaterThan(prev.decisionIndex + (prev.barsToResolve ?? 0) - 1);
    }
  });
});

describe('runStructuralBacktest — fail-closed e fronteira de laboratório', () => {
  it('série vazia / menor que a janela / horizonte inválido => DADOS_INSUFICIENTES com motivo, nunca um resultado fabricado', async () => {
    expect((await runStructuralBacktest({ candles: [] })).status).toBe('DADOS_INSUFICIENTES');
    expect((await runStructuralBacktest({ candles: ascendingZigzag(50), windowSize: 60 })).status).toBe('DADOS_INSUFICIENTES');
    const badHorizon = await runStructuralBacktest({ candles: ascendingZigzag(80), windowSize: 60, horizonBars: 0 });
    expect(badHorizon.status).toBe('DADOS_INSUFICIENTES');
    expect(badHorizon.reason).toBe('horizonte_invalido');
  });

  it('FRONTEIRA (LEI 24): nenhum módulo de produção importa do laboratório de backtest — só testes', () => {
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
          if (src.includes('research/backtest/structural-backtest')) offenders.push(p);
        }
      }
    };
    for (const root of roots) walk(root);
    expect(offenders).toEqual([]);
  });

  it('o próprio fonte do laboratório declara a honestidade: aviso no contrato, zero rede/relógio/aleatoriedade', () => {
    const src = readFileSync(resolve(here, '../../src/research/backtest/structural-backtest.js'), 'utf8');
    expect(src).not.toMatch(/fetch\(|WebSocket|Math\.random|Date\.now/);
    expect(src).toContain('NUNCA probabilidade futura');
  });
});
