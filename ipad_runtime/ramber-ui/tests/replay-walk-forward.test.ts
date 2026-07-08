// replay-walk-forward.test.ts — Fase K, diretrizes 2 e 3 (V15 Cap. 18/20):
// o Motor de Replay Isolado e a prova de Reação Sistémica por walk-forward.
//
// O que se prova aqui, com os módulos REAIS de produção em cadeia
// (Bus → Qualidade → Regime → Ensemble → Risk), sobre a fixture versionada:
//   1. FIDELIDADE AO BUS: cada passo atravessa o MarketDataBus real (mesmo
//      pipeline de produção), com exatamente 1 coleta por passo (zero
//      duplicação) e sincronização temporal exata (asOf avança 900s).
//   2. REAÇÃO SISTÉMICA (diretriz 3): à medida que a janela avança e a
//      volatilidade sobe, o Risk Engine reduz a exposição sugerida —
//      teto de Kelly manda na calmaria, dimensionamento por volatilidade
//      assume o comando quando o ATR% cruza a fronteira. NUNCA se testa
//      lucratividade: não há portfólio, não há P&L — só a coerência da
//      resposta do sistema às mudanças de estado.
//   3. ACOPLAMENTOS DAS FASES C/D/F/H VIVOS: matriz de regime modulando a
//      força do comitê, peso de qualidade amortecendo forca_ajustada,
//      trava de confirmação comitê-vs-Core zerando a sugestão, fail-closed
//      e recuperação de fonte corrompida — tudo end-to-end.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createReplaySession, runWalkForward } from '../../src/replay/index.js';
import { opinionFromLabel, opinionFromVote } from '../../src/consensus/index.js';
import { getSensitivity } from '../../src/market-regime/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(resolve(here, 'fixtures/replay-fixture.v1.json'), 'utf8'));
const W = 120;
const TOTAL_FRAMES = fixture.count - W + 1; // 521 janelas completas

const sessionOpts = () => ({
  candles: fixture.candles,
  symbol: fixture.symbol,
  timeframe: fixture.interval,
  windowSize: W,
});

// Estímulo do cenário base: comitê constante ALTA (1 membro momentum — a
// família tem peso > 0 em TODOS os regimes da matriz, então o membro nunca
// é excluído) e plano LONG com stop fixo a 0.6%, risco 0.25%/trade, RR 2.
// Segurar o comitê e o stop CONSTANTES isola a variável sob teste da
// diretriz 3: só o ATR% se move. Com RR 2 e força 1 => teto de Kelly
// 0.5×(0.5−0.5/2)×100 = 12.5%; o dimensionamento por volatilidade
// (0.25/unidade×100) cruza esse teto quando a unidade de risco passa de
// 2% — exatamente o degrau que a fase EXPANSAO_VOLATIL da fixture cruza.
const memberAlta = () => [
  { id: 'estimulo_alta', familia: 'momentum', opiniao: opinionFromLabel('ALTA') },
];
const planLong = (ctx: any) => ({
  signal: 'LONG',
  entry: ctx.close,
  stop: ctx.close * (1 - 0.006),
  riskRewardRatio: 2,
  riskPerTradePct: 0.25,
});
const KELLY_CAP = 12.5;

describe('motor de replay: fidelidade ao Market Data Bus real', () => {
  it('cada passo entrega snapshot real do Bus: janela exata, congelada, asOf sincronizado, avanço de 900s', async () => {
    const session = createReplaySession(sessionOpts());
    let prevT: number | null = null;
    for (let i = 0; i < 5; i += 1) {
      const frame: any = await session.step();
      expect(frame.snapshot.ok).toBe(true);
      expect(frame.snapshot.candles).toHaveLength(W);
      expect(Object.isFrozen(frame.snapshot)).toBe(true);
      expect(Object.isFrozen(frame)).toBe(true);
      expect(frame.snapshot.asOf).toBe(frame.t * 1000); // sincronização temporal real
      if (prevT !== null) expect(frame.t - prevT).toBe(900); // zero pulo, zero repetição
      prevT = frame.t;
    }
    expect(session.stats.collects).toBe(5); // exatamente 1 coleta por passo
  });

  it('walk-forward completo: 521 janelas, 1 coleta por janela, sem exceção', async () => {
    const run = await runWalkForward({ ...sessionOpts(), memberFactory: memberAlta, riskPlanFactory: planLong });
    expect(run.frames).toHaveLength(TOTAL_FRAMES);
    expect(run.collects).toBe(TOTAL_FRAMES);
  });

  it('qualidade da Fase C acumulada sobre coletas reais da fixture: disponibilidade e consistência perfeitas, peso positivo', async () => {
    const run = await runWalkForward(sessionOpts());
    const q: any = run.frames[run.frames.length - 1].quality;
    expect(q.dimensions.availability).toBe(1);
    expect(q.dimensions.consistency).toBe(1); // espaçamento 900s exato, zero lacuna
    expect(['EXCELENTE', 'SAUDAVEL']).toContain(q.classification);
    expect(q.weight).toBeGreaterThanOrEqual(0.6);
  });

  it('fail-closed por padrão: sem estímulo injetado, comitê insuficiente e sugestão 0% em todos os passos', async () => {
    const run = await runWalkForward({ ...sessionOpts(), maxSteps: 3 });
    for (const frame of run.frames as any[]) {
      expect(frame.ensemble.status).toBe('DADOS_INSUFICIENTES');
      expect(frame.risk.status).toBe('SEM_SUGESTAO');
      expect(frame.risk.suggested_position_pct).toBe(0);
    }
  });

  it('janela menor que o mínimo do regime engine é recusada na criação (fail-closed, nunca meia-análise)', () => {
    expect(() => createReplaySession({ ...sessionOpts(), windowSize: 30 })).toThrow(/window_minima/);
  });
});

describe('walk-forward, diretriz 3: reação sistémica do Risk Engine à volatilidade', () => {
  let frames: any[] = [];
  it('a cadeia inteira responde OK em todas as 521 janelas do cenário base', async () => {
    const run = await runWalkForward({ ...sessionOpts(), memberFactory: memberAlta, riskPlanFactory: planLong });
    frames = run.frames as any[];
    for (const f of frames) expect(f.risk.status).toBe('OK');
  });

  it('a unidade de risco efetiva é max(stop%, ATR%) em cada janela — o acoplamento Risk/ATR da Fase H, vivo', () => {
    for (const f of frames) {
      const stopDistPct = (Math.abs(f.risk.inputs.entry - f.risk.inputs.stop) / f.risk.inputs.entry) * 100;
      expect(f.risk.effective_risk_unit_pct).toBeCloseTo(Math.max(stopDistPct, f.regime.evidence.atr_percent), 10);
    }
  });

  it('CALMARIA (fases 1-3): ATR% abaixo do piso de stop => teto de Kelly manda e a sugestão fica cravada em 12.5%', () => {
    const calm = frames.filter((f) => f.index <= 500);
    expect(calm.length).toBeGreaterThan(300);
    for (const f of calm) expect(f.risk.suggested_position_pct).toBeCloseTo(KELLY_CAP, 10);
  });

  it('EXPANSAO_VOLATIL (cauda): a volatilidade cruza a fronteira e o dimensionamento por volatilidade ASSUME — sugestão cai estritamente abaixo do teto, igual a risco/unidade', () => {
    const tail = frames.slice(-40);
    for (const f of tail) {
      expect(f.risk.suggested_position_pct).toBeLessThan(KELLY_CAP);
      expect(f.risk.suggested_position_pct).toBeCloseTo(
        (0.25 / f.risk.effective_risk_unit_pct) * 100,
        10,
      );
    }
    // e a QUEDA é substancial, não cosmética: média da cauda < 11% vs 12.5%
    const meanTail = tail.reduce((a, f) => a + f.risk.suggested_position_pct, 0) / tail.length;
    expect(meanTail).toBeLessThan(11);
  });

  it('monotonia sistémica: ordenando as 521 janelas por unidade de risco, a sugestão NUNCA sobe — volatilidade maior jamais gera exposição maior', () => {
    const pairs = frames
      .map((f) => [f.risk.effective_risk_unit_pct, f.risk.suggested_position_pct])
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < pairs.length; i += 1) {
      expect(pairs[i][1]).toBeLessThanOrEqual(pairs[i - 1][1] + 1e-10);
    }
  });

  it('o risco efetivo nunca excede o risco pedido (0.25%/trade) em nenhuma das 521 janelas', () => {
    for (const f of frames) expect(f.risk.effective_risk_pct).toBeLessThanOrEqual(0.25 + 1e-12);
  });

  it('coerência das transições: o arco COMPRESSAO → BREAKOUT:ALTA → TENDENCIA_FORTE:ALTA aparece nesta ordem cronológica nos frames', () => {
    const seq = frames.map((f) => `${f.regime.regime}${f.regime.direction ? ':' + f.regime.direction : ''}`);
    const iComp = seq.indexOf('COMPRESSAO');
    const iBreak = seq.findIndex((x, i) => i > iComp && x === 'BREAKOUT:ALTA');
    const iForte = seq.findIndex((x, i) => i > iBreak && x === 'TENDENCIA_FORTE:ALTA');
    expect(iComp).toBeGreaterThanOrEqual(0);
    expect(iBreak).toBeGreaterThan(iComp);
    expect(iForte).toBeGreaterThan(iBreak);
  });

  it('RegimeHistory determinístico: transições com timestamps do PRÓPRIO dado (asOf), estritamente crescentes, teto de 50', async () => {
    const run = await runWalkForward({ ...sessionOpts(), memberFactory: memberAlta, riskPlanFactory: planLong });
    expect(run.transitions.length).toBeLessThanOrEqual(50);
    let prevAt = -Infinity;
    for (const tr of run.transitions as any[]) {
      expect(tr.at).toBeGreaterThan(prevAt);
      expect(tr.at % 900_000).toBe(0); // sempre um asOf real da fixture, nunca Date.now()
      prevAt = tr.at;
    }
  });
});

describe('walk-forward: acoplamento matriz de regime (D) → comitê (F) → Kelly (H)', () => {
  // Dois membros: momentum (peso = getSensitivity(regime,'momentum')) +
  // membro sem família (peso fixo 1, como o GMIL em produção). O pool
  // linear dá força = (w+0.5)/(w+1) — a MATRIZ vira a variável observável.
  const twoMembers = () => [
    { id: 'estimulo_momentum', familia: 'momentum', opiniao: opinionFromLabel('ALTA') },
    { id: 'estimulo_externo', familia: null, opiniao: opinionFromVote('ALTA', 0.5) },
  ];

  it('a força do comitê segue exatamente o peso da matriz do regime vigente, janela a janela', async () => {
    const run = await runWalkForward({ ...sessionOpts(), memberFactory: twoMembers, riskPlanFactory: planLong });
    for (const f of run.frames as any[]) {
      const w = getSensitivity(f.regime.regime, 'momentum');
      expect(w).not.toBeNull(); // janela 120 >= mínimo => sempre um regime real
      const forcaEsperada = ((w as number) + 0.5) / ((w as number) + 1);
      expect(f.ensemble.forca).toBeCloseTo(forcaEsperada, 10);
    }
  });

  it('diretriz 1 da Fase L, viva na cadeia: o Risk Engine consome a forca_ajustada (= força × peso de qualidade REAL do Bus), e a fração de Kelly reage a ELA', async () => {
    // Nota de determinismo: o PESO em replay depende da dimensão
    // "stability" (CV de latências sub-ms — timing de plataforma), então
    // nenhuma asserção aqui fixa um peso específico; o que se trava é a
    // CADEIA — identidade do amortecedor, fiação ajustada->Risk e o
    // multiplicador de Kelly respondendo à força AJUSTADA, seja qual for
    // o peso real medido. O caso extremo determinístico (quarentena peso
    // 0 => sugestão 0%) é provado no teste de corrupção abaixo.
    const run = await runWalkForward({ ...sessionOpts(), memberFactory: twoMembers, riskPlanFactory: planLong });
    for (const f of run.frames as any[]) {
      // amortecedor da Fase C: identidade exata força_ajustada = força × peso
      expect(f.ensemble.forca_ajustada).toBeCloseTo(f.ensemble.forca * f.quality.weight, 10);
      // fiação da Fase L: o que ENTRA no Risk Engine é a ajustada, nunca a bruta
      expect(f.risk.inputs.ensemble_forca).toBeCloseTo(f.ensemble.forca_ajustada, 10);
      // e o multiplicador FIXO de Kelly responde à faixa da força AJUSTADA
      expect(f.risk.kelly_fraction_tier).toBe(f.ensemble.forca_ajustada >= 0.6 ? 0.5 : 0.25);
    }
  });
});

describe('walk-forward: trava de confirmação comitê-vs-Core sob transição de cenário', () => {
  it('comitê que vira CONTRA o sinal LONG zera a sugestão no mesmo passo, sem interromper a cadeia', async () => {
    const flipAt = 460; // dentro da tendência forte da P3
    const flipping = (ctx: any) => [
      { id: 'estimulo', familia: 'momentum', opiniao: opinionFromLabel(ctx.index > flipAt ? 'BAIXA' : 'ALTA') },
    ];
    const run = await runWalkForward({ ...sessionOpts(), memberFactory: flipping, riskPlanFactory: planLong });
    for (const f of run.frames as any[]) {
      if (f.index <= flipAt) {
        expect(f.risk.status).toBe('OK');
      } else {
        expect(f.ensemble.direcao).toBe('BAIXA'); // o comitê realmente virou
        expect(f.risk.status).toBe('SEM_SUGESTAO');
        expect(f.risk.reason).toBe('comite_sem_direcao_ou_contrario_ao_sinal_do_core');
        expect(f.risk.suggested_position_pct).toBe(0);
      }
    }
  });
});

describe('walk-forward: fonte corrompida no meio do replay — fail-closed e recuperação reais', () => {
  it('candle corrompido => Bus rejeita a série, serve o último snapshot bom, quarentena após 5 falhas, e recupera quando a janela passa do defeito', async () => {
    const corrupted = fixture.candles.map((c: any, i: number) =>
      i === 300 ? { ...c, h: c.l - 1 } : c, // high < low: o integrity-validator DEVE rejeitar
    );
    const run = await runWalkForward({
      candles: corrupted,
      symbol: fixture.symbol,
      timeframe: fixture.interval,
      windowSize: W,
      memberFactory: memberAlta,
      riskPlanFactory: planLong,
    });
    expect(run.frames).toHaveLength(TOTAL_FRAMES); // a cadeia nunca lança

    const tOf = (idx: number) => fixture.candles[idx].t;
    const byIndex = new Map((run.frames as any[]).map((f) => [f.index, f]));

    // Janelas que contêm o candle 300 (ends 301..420): o Bus serve o último
    // snapshot BOM (fail-closed da Fase B) — o relógio do replay congela.
    for (const idx of [305, 360, 420]) {
      expect(byIndex.get(idx).t).toBe(tOf(299));
    }
    // Quarentena da Fase C: a partir da 5ª falha consecutiva o peso zera.
    expect(byIndex.get(310).quality.weight).toBe(0);
    // ... o amortecedor da Fase F reflete isso (forca_ajustada = 0) e — a
    // diretriz 1 da Fase L — a quarentena ZERA a sugestão do Risk Engine:
    // a qualidade da rede impacta o lote final, fail-closed completo.
    expect(byIndex.get(310).ensemble.forca_ajustada).toBe(0);
    expect(byIndex.get(310).risk.status).toBe('SEM_SUGESTAO');
    expect(byIndex.get(310).risk.reason).toBe('comite_sem_forca_direcional_suficiente');
    expect(byIndex.get(310).risk.suggested_position_pct).toBe(0);

    // Recuperação: end 421 já não cobre o candle 300 — coleta volta a
    // validar, o relógio avança, o peso volta a ser positivo em 1 sucesso
    // e a sugestão volta a existir no MESMO passo.
    expect(byIndex.get(421).t).toBe(tOf(420));
    expect(byIndex.get(421).quality.weight).toBeGreaterThan(0);
    expect(byIndex.get(421).risk.status).toBe('OK');
    // ... e o replay segue até o fim da fixture com o relógio normal.
    expect(byIndex.get(640).t).toBe(tOf(639));
  });
});

describe('fronteira: o Motor de Replay é laboratório — nunca caminho de produção', () => {
  const here2 = dirname(fileURLToPath(import.meta.url));
  const read = (rel: string) => readFileSync(resolve(here2, rel), 'utf8');
  const importLines = (code: string): string[] =>
    code
      .split('\n')
      .filter((line) => /^\s*import[\s{("']/.test(line) || /import\s*\(/.test(line))
      .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line));

  it('nenhum módulo de produção (engine-bridge, App, Bus, regime, consensus, risk, gmil) importa src/replay', () => {
    const prodFiles = [
      '../src/engine-bridge.ts',
      '../src/App.tsx',
      '../../src/market-data-bus/bus.js',
      '../../src/market-regime/regime-engine.js',
      '../../src/consensus/ensemble-engine.js',
      '../../src/risk/risk-engine.js',
      '../src/gmil/gmil-orchestrator.ts',
    ];
    for (const file of prodFiles) {
      const offenders = importLines(read(file)).filter((l) => /replay/i.test(l));
      expect(offenders, `${file} não pode importar replay`).toEqual([]);
    }
  });

  it('o replay-engine importa EXCLUSIVAMENTE das portas oficiais (index.js) dos 4 domínios da cadeia', () => {
    const imports = importLines(read('../../src/replay/replay-engine.js'));
    const allowed = [
      '../market-data-bus/index.js',
      '../market-regime/index.js',
      '../consensus/index.js',
      '../risk/index.js',
    ];
    expect(imports).toHaveLength(allowed.length);
    for (const line of imports) {
      expect(allowed.some((a) => line.includes(a)), `import inesperado: ${line.trim()}`).toBe(true);
    }
  });
});
