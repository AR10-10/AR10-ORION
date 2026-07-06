// replay-fixture.test.ts — Fase K, diretriz 1 (V15 Cap. 18/20): a Fixture
// Versionada de replay. Duas travas aqui:
//   1. PROVENIÊNCIA: o JSON commitado é EXATAMENTE a saída do gerador
//      versionado com a seed fixa — regenerado em memória e comparado
//      deep-equal. Ninguém edita a fixture na mão sem o CI gritar, e a
//      "versão" da fixture é matematicamente a dupla (gerador, seed).
//   2. DESENHO VALIDADO PELO ENGINE REAL: as fases declaradas no bloco
//      `phases` (calma → compressão → rompimento/tendência → expansão
//      volátil) não são auto-proclamadas — o Market Regime Engine de
//      PRODUÇÃO precisa enxergá-las janela a janela, senão o teste falha.
//      Se um dia a fixture for substituída por candles reais (mesmo
//      schema), estas mesmas asserções validam a nova janela histórica.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  generateReplayFixture,
  FIXTURE_SEED,
  FIXTURE_COUNT,
  FIXTURE_STEP_S,
  FIXTURE_T0,
} from '../../tools/generate-replay-fixture.mjs';
import { validateCandleSeries } from '../../src/market-data-bus/index.js';
import { classifyMarketRegime } from '../../src/market-regime/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(resolve(here, 'fixtures/replay-fixture.v1.json'), 'utf8'));

describe('fixture: proveniência bit-a-bit (gerador + seed => arquivo commitado)', () => {
  it('o JSON commitado é deep-equal à regeneração em memória com a seed oficial', () => {
    expect(fixture).toEqual(generateReplayFixture());
  });

  it('a seed oficial está gravada no próprio arquivo (auditável sem abrir o gerador)', () => {
    expect(fixture.seed).toBe(FIXTURE_SEED);
    expect(fixture.version).toBe(1);
  });
});

describe('fixture: honestidade de proveniência declarada nos metadados', () => {
  it('nunca se apresenta como dado de mercado real', () => {
    expect(fixture.kind).toBe('SERIE_DETERMINISTICA_DE_ENGENHARIA');
    expect(fixture.live).toBe(false);
    expect(fixture.exchange_connection).toBe('NONE');
    expect(fixture.symbol).toBe('REPLAY-FIXTURE'); // nunca um ticker real
    expect(String(fixture.warning).length).toBeGreaterThan(30);
    expect(String(fixture.motivo_nao_real)).toContain('sem_egress');
  });

  it('declara gerador e comando de reprodução', () => {
    expect(fixture.generator).toBe('ipad_runtime/tools/generate-replay-fixture.mjs');
    expect(String(fixture.reproducao)).toContain('node');
  });
});

describe('fixture: schema canônico do Bus e integridade estrutural', () => {
  it('passa no integrity-validator REAL do Market Data Bus', () => {
    const verdict = validateCandleSeries(fixture.candles);
    expect(verdict.valid).toBe(true);
    expect(verdict.errors).toEqual([]);
  });

  it('640 candles com espaçamento exato do timeframe (900s), t em segundos', () => {
    expect(fixture.candles).toHaveLength(FIXTURE_COUNT);
    expect(fixture.interval).toBe('15m');
    expect(fixture.candles[0].t).toBe(FIXTURE_T0);
    for (let i = 1; i < fixture.candles.length; i += 1) {
      expect(fixture.candles[i].t - fixture.candles[i - 1].t).toBe(FIXTURE_STEP_S);
    }
  });

  it('bloco phases cobre [0, count) de forma contígua, na ordem do arco desenhado', () => {
    expect(fixture.phases.map((p: any) => p.name)).toEqual([
      'CALMA', 'COMPRESSAO', 'IMPULSO_ALTA', 'EXPANSAO_VOLATIL',
    ]);
    let cursor = 0;
    for (const phase of fixture.phases) {
      expect(phase.start).toBe(cursor);
      expect(phase.end).toBeGreaterThan(phase.start);
      cursor = phase.end;
    }
    expect(cursor).toBe(fixture.count);
  });
});

// ---------------------------------------------------------------------------
// Desenho das fases validado pelo classificador de PRODUÇÃO, janela a janela
// (window 120 — a mesma do walk-forward). Nenhum mock: é o engine da Fase D.
// ---------------------------------------------------------------------------
const W = 120;
type Frame = { end: number; regime: string; dir: string | null; atr: number; bwp: number | null };
const frames: Frame[] = [];
for (let end = W; end <= fixture.candles.length; end += 1) {
  const r: any = classifyMarketRegime({ ohlcv_series: fixture.candles.slice(end - W, end), timeframe: fixture.interval });
  frames.push({ end, regime: r.regime, dir: r.direction, atr: r.evidence.atr_percent, bwp: r.evidence.bandwidth_percentile });
}
const inRange = (a: number, b: number) => frames.filter((f) => f.end > a && f.end <= b);
const modal = (rows: Frame[]) =>
  Object.entries(rows.reduce<Record<string, number>>((m, f) => ((m[f.regime] = (m[f.regime] ?? 0) + 1), m), {}))
    .sort((x, y) => y[1] - x[1])[0][0];
const meanAtr = (rows: Frame[]) => rows.reduce((a, f) => a + f.atr, 0) / rows.length;

describe('fixture: o Market Regime Engine REAL enxerga o arco desenhado', () => {
  it('P1 CALMA: regime modal calmo (CONSOLIDACAO/TENDENCIA_MODERADA), zero TENDENCIA_FORTE', () => {
    const p1 = inRange(W - 1, 180);
    expect(['CONSOLIDACAO', 'TENDENCIA_MODERADA']).toContain(modal(p1));
    expect(p1.some((f) => f.regime === 'TENDENCIA_FORTE')).toBe(false);
  });

  it('P2 COMPRESSAO: modal COMPRESSAO na metade final, squeeze sustentado até a fronteira', () => {
    expect(modal(inRange(280, 320))).toBe('COMPRESSAO');
    for (const f of inRange(312, 320)) expect(f.bwp).toBeLessThanOrEqual(0.25);
  });

  it('ignição da P3: BREAKOUT com direção ALTA dispara na saída do squeeze (ends 321..330)', () => {
    expect(frames.some((f) => f.regime === 'BREAKOUT' && f.dir === 'ALTA' && f.end > 320 && f.end <= 330)).toBe(true);
  });

  it('P3 IMPULSO_ALTA: modal TENDENCIA_FORTE e toda leitura forte tem direção ALTA', () => {
    const p3 = inRange(380, 500);
    expect(modal(p3)).toBe('TENDENCIA_FORTE');
    for (const f of p3.filter((x) => x.regime === 'TENDENCIA_FORTE')) expect(f.dir).toBe('ALTA');
  });

  it('arco de volatilidade da diretriz 3: ATR% médio das últimas 100 janelas >= 3x o das primeiras 100', () => {
    expect(meanAtr(frames.slice(-100)) / meanAtr(frames.slice(0, 100))).toBeGreaterThanOrEqual(3);
  });

  it('P4 EXPANSAO_VOLATIL: cauda inteira (40 janelas) sustenta ATR% >= 2.0 — acima da fronteira onde o dimensionamento por volatilidade assume o comando', () => {
    for (const f of frames.slice(-40)) expect(f.atr).toBeGreaterThanOrEqual(2.0);
  });
});
