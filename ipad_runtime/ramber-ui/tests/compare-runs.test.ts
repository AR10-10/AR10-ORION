// compare-runs.test.ts — execução REAL do mecanismo de comparação (Fase 9,
// "Autoevolução Controlada", Diretriz de Evolução Quantitativa e
// Aprendizado Real). Prova o two-proportion z-test agrupado com números
// verificados à mão (não só "roda e vê o que sai") + as guardas
// fail-closed (amostra insuficiente, variância nula, status != OK) + a
// fronteira de laboratório.
import { describe, it, expect } from 'vitest';
import {
  compareBacktestRuns,
  COMPARE_RUNS_AVISO,
  COMPARE_RUNS_FORMAT_VERSION,
  MIN_RESOLVED_PER_GROUP,
  Z_CRITICAL_95,
} from '../../src/research/backtest/compare-runs.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function fakeRun(targetHits: number, resolved: number, symbol = 'BTC', timeframe = '15m') {
  return {
    status: 'OK',
    provenance: { symbol, timeframe },
    aggregate: { targetHits, resolved },
  };
}

describe('compareBacktestRuns — two-proportion z-test agrupado, números verificados à mão', () => {
  it('MELHOROU: diferença real e grande (40% vs 70% em n=50 cada) cruza o limiar de 95% — z ≈ 3.015', () => {
    const r = compareBacktestRuns(fakeRun(20, 50), fakeRun(35, 50));
    expect(r.verdict).toBe('MELHOROU');
    expect(r.zScore).toBeCloseTo(3.0151, 3);
    expect(r.delta).toBeCloseTo(0.30, 10);
    expect(r.baseline).toEqual({ targetHits: 20, resolved: 50, rate: 0.4 });
    expect(r.candidate).toEqual({ targetHits: 35, resolved: 50, rate: 0.7 });
    expect(r.sameContext).toBe(true);
  });

  it('PIOROU: exatamente o espelho do caso MELHOROU (baseline/candidate trocados) — mesmo |z|, sinal invertido', () => {
    const r = compareBacktestRuns(fakeRun(35, 50), fakeRun(20, 50));
    expect(r.verdict).toBe('PIOROU');
    expect(r.zScore).toBeCloseTo(-3.0151, 3);
  });

  it('NEUTRO: diferença pequena (50% vs 56% em n=50 cada) fica DENTRO do limiar — z ≈ 0.601, nunca arredondado para MELHOROU só por candidate.rate > baseline.rate', () => {
    const r = compareBacktestRuns(fakeRun(25, 50), fakeRun(28, 50));
    expect(r.verdict).toBe('NEUTRO');
    expect(r.zScore).toBeCloseTo(0.6011, 3);
    expect(Math.abs(r.zScore!)).toBeLessThan(Z_CRITICAL_95);
    expect(r.delta).toBeGreaterThan(0); // candidate É numericamente melhor...
    // ...mas o veredito honesto continua NEUTRO: a diferença não é
    // estatisticamente distinguível de ruído amostral com esta amostra.
  });

  it('DADOS_INSUFICIENTES: amostra resolvida abaixo do mínimo declarado em QUALQUER um dos dois lados, mesmo que o outro lado tenha amostra grande', () => {
    const r1 = compareBacktestRuns(fakeRun(10, MIN_RESOLVED_PER_GROUP - 1), fakeRun(35, 50));
    expect(r1.verdict).toBe('DADOS_INSUFICIENTES');
    expect(r1.reason).toContain('abaixo_do_minimo_declarado');
    const r2 = compareBacktestRuns(fakeRun(20, 50), fakeRun(5, MIN_RESOLVED_PER_GROUP - 1));
    expect(r2.verdict).toBe('DADOS_INSUFICIENTES');
  });

  it('exatamente no mínimo declarado (resolved === MIN_RESOLVED_PER_GROUP) NÃO é insuficiente — passa para o z-test real', () => {
    const r = compareBacktestRuns(fakeRun(8, MIN_RESOLVED_PER_GROUP), fakeRun(9, MIN_RESOLVED_PER_GROUP));
    expect(r.verdict).not.toBe('DADOS_INSUFICIENTES');
    expect(r.zScore).not.toBeNull();
  });

  it('DADOS_INSUFICIENTES: nenhuma amostra resolvida (resolved=0) ou status != OK — nunca uma divisão por zero disfarçada', () => {
    expect(compareBacktestRuns(fakeRun(0, 0), fakeRun(20, 50)).verdict).toBe('DADOS_INSUFICIENTES');
    expect(compareBacktestRuns({ status: 'DADOS_INSUFICIENTES' }, fakeRun(20, 50)).verdict).toBe('DADOS_INSUFICIENTES');
    expect(compareBacktestRuns(null, fakeRun(20, 50)).verdict).toBe('DADOS_INSUFICIENTES');
  });

  it('DADOS_INSUFICIENTES: variância pooled nula (as duas amostras combinadas acertam 100%) — o teste não consegue distinguir nada sem dispersão, nunca um zScore Infinity/NaN escapando', () => {
    const r = compareBacktestRuns(fakeRun(50, 50), fakeRun(50, 50));
    expect(r.verdict).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('variancia_pooled_nula_amostra_sem_dispersao');
    expect(r.zScore).toBeNull();
    expect(Number.isFinite(r.zScore as any)).toBe(false); // nunca Infinity/NaN no contrato
  });

  it('sameContext: false quando symbol ou timeframe diferem — nunca escondido, mas nunca bloqueia a comparação (o Operador pode querer testar generalização)', () => {
    const rSymbol = compareBacktestRuns(fakeRun(20, 50, 'BTC', '15m'), fakeRun(35, 50, 'ETH', '15m'));
    expect(rSymbol.sameContext).toBe(false);
    expect(rSymbol.verdict).toBe('MELHOROU'); // continua comparando de verdade
    const rTf = compareBacktestRuns(fakeRun(20, 50, 'BTC', '15m'), fakeRun(35, 50, 'BTC', '1h'));
    expect(rTf.sameContext).toBe(false);
  });

  it('contrato honesto: formatVersion, aviso e nunca só o veredito sozinho — sempre os números completos para auditoria', () => {
    const r = compareBacktestRuns(fakeRun(20, 50), fakeRun(35, 50));
    expect(r.formatVersion).toBe(COMPARE_RUNS_FORMAT_VERSION);
    expect(r.aviso).toBe(COMPARE_RUNS_AVISO);
    expect(r.aviso).toContain('nunca uma aprovação automática de mudança em produção');
    expect(r.metric).toBe('taxaAlvoAmostra');
    expect(r.confidenceLevel).toBe(0.95);
    expect(Object.isFrozen(r)).toBe(true);
  });

  it('FRONTEIRA (LEI 24): só App.tsx (BacktestPanel) importa compare-runs.js — mais ninguém', () => {
    // GRADUAÇÃO (pedido do Operador: "organiza tudo que tem no laboratório e
    // deixa rodando"). A guarda NÃO foi afrouxada: ela ficou MAIS específica,
    // mesmo padrão real já usado quando structural-backtest.js/
    // history-capture.js graduaram via backtest-worker.ts
    // (structural-backtest.test.ts). Antes dizia "ninguém"; agora nomeia o
    // ÚNICO consumidor autorizado e continua proibindo todo o resto — um
    // segundo importador (num motor, no Core Engine) derruba a suíte.
    // App.tsx é o consumidor certo aqui, não um Worker novo:
    // compareBacktestRuns é um z-test síncrono sobre dois resultados JÁ
    // medidos, nada que justifique mais um Worker.
    const CONSUMIDOR_AUTORIZADO = 'src/App.tsx';
    const roots = [resolve(here, '../src'), resolve(here, '../../src')];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === 'backtest') continue;
          walk(p);
        } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
          const src = readFileSync(p, 'utf8');
          if (src.includes('research/backtest/compare-runs') && !p.replace(/\\/g, '/').endsWith(CONSUMIDOR_AUTORIZADO)) offenders.push(p);
        }
      }
    };
    for (const root of roots) walk(root);
    expect(offenders).toEqual([]);
  });

  it('zero rede/relógio/aleatoriedade — função pura de dois objetos já medidos', () => {
    const src = readFileSync(resolve(here, '../../src/research/backtest/compare-runs.js'), 'utf8');
    expect(src).not.toMatch(/fetch\(|WebSocket|Math\.random|Date\.now/);
  });
});
