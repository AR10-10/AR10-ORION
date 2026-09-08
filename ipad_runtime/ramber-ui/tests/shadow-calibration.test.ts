// shadow-calibration.test.ts — execução REAL. A pergunta é "a comparação
// é honesta?", e as três coisas que a tornariam desonesta são: vazar a
// janela de avaliação para dentro de algum treino, comparar dois ajustes
// idênticos (veredito vazio), e tratar ausência de leitura de modelo como
// 0/neutro. Cada uma tem seu teste.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  evaluateShadowCalibration,
  describeShadowCalibration,
  MIN_SHADOW_SAMPLE,
  SHADOW_FROZEN_TRAIN,
  SHADOW_EVAL_WINDOW,
} from '../src/nexus/shadow-calibration';
import { MIN_TRADES_FOR_VALID_EXPECTANCY } from '../src/nexus/expectancy';
import type { TradeCostResult } from '../src/nexus/trade-simulation';

const trade = (modelAgreement: number | null, netR: number): TradeCostResult => ({
  status: netR > 0 ? 'TARGET_HIT' : 'STOP_HIT',
  direction: 'LONG',
  entryMid: 100,
  riskPoints: 10,
  grossR: netR,
  commissionR: 0,
  slippageR: 0,
  fundingR: 0,
  netR,
  holdingMs: 60_000,
  resolvedAt: 1_700_000_000_000,
  regime: null,
  fingerprint: null,
  institutionalScore: null,
  volatilityAtOpen: null,
  observedMfeR: null,
  observedMaeR: null,
  firstTargetR: null,
  modelAgreement,
});

/** Amostra em que o score REALMENTE prediz o resultado — sinal limpo, do
 *  tipo que um reajuste com mais dados deveria conseguir aproveitar. */
const preditiva = (n: number, offset = 0): TradeCostResult[] =>
  Array.from({ length: n }, (_, i) => {
    const win = (i + offset) % 3 !== 0; // ~67% de acerto
    return trade(win ? 0.8 : -0.8, win ? 1 : -1);
  });

describe('shadow-calibration: fail-closed antes de qualquer veredito', () => {
  it('amostra vazia => DADOS_INSUFICIENTES com razão real', () => {
    const r = evaluateShadowCalibration([]);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.verdict).toBe('DADOS_INSUFICIENTES');
    expect(r.brierFrozen).toBeNull();
    expect(r.brierLive).toBeNull();
    expect(r.brierDelta).toBeNull();
    expect(r.reason).toContain(String(MIN_SHADOW_SAMPLE));
  });

  it('null/undefined => DADOS_INSUFICIENTES (nunca lança)', () => {
    expect(evaluateShadowCalibration(null).status).toBe('DADOS_INSUFICIENTES');
    expect(evaluateShadowCalibration(undefined).status).toBe('DADOS_INSUFICIENTES');
  });

  it('exatamente 1 abaixo do mínimo ainda recusa; no mínimo, decide', () => {
    expect(evaluateShadowCalibration(preditiva(MIN_SHADOW_SAMPLE - 1)).status).toBe('DADOS_INSUFICIENTES');
    expect(evaluateShadowCalibration(preditiva(MIN_SHADOW_SAMPLE)).status).toBe('OK');
  });

  it('trades sem modelAgreement real são EXCLUÍDOS, nunca lidos como 0', () => {
    // Amostra suficiente em contagem bruta, mas sem leitura de modelo.
    const semLeitura = Array.from({ length: MIN_SHADOW_SAMPLE + 20 }, (_, i) => trade(null, i % 2 ? 1 : -1));
    const r = evaluateShadowCalibration(semLeitura);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.usableTrades).toBe(0);
  });

  it('modelAgreement NaN é ausência, nunca uma leitura', () => {
    const r = evaluateShadowCalibration(Array.from({ length: MIN_SHADOW_SAMPLE }, () => trade(Number.NaN, 1)));
    expect(r.usableTrades).toBe(0);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
  });

  it('mistura: só os trades com leitura real contam para o mínimo', () => {
    const mistura = [...preditiva(MIN_SHADOW_SAMPLE - 1), ...Array.from({ length: 50 }, () => trade(null, 1))];
    const r = evaluateShadowCalibration(mistura);
    expect(r.usableTrades).toBe(MIN_SHADOW_SAMPLE - 1);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
  });
});

describe('shadow-calibration: o desenho não vaza futuro', () => {
  const amostra = preditiva(MIN_SHADOW_SAMPLE + 19); // 80 usáveis
  const r = evaluateShadowCalibration(amostra);

  it('a janela de avaliação é a MAIS RECENTE e fica fora dos dois treinos', () => {
    expect(r.status).toBe('OK');
    expect(r.evalSize).toBe(SHADOW_EVAL_WINDOW);
    // treino ao vivo = tudo ANTES da janela; treino congelado = os mais antigos
    expect(r.liveTrainSize).toBe(r.usableTrades - SHADOW_EVAL_WINDOW);
    expect(r.frozenTrainSize).toBe(SHADOW_FROZEN_TRAIN);
    // Nenhum treino alcança a janela de avaliação.
    expect(r.liveTrainSize + r.evalSize).toBe(r.usableTrades);
    expect(r.frozenTrainSize).toBeLessThan(r.liveTrainSize);
  });

  it('os dois Brier são reais, finitos e na faixa possível [0,1]', () => {
    for (const b of [r.brierFrozen!, r.brierLive!]) {
      expect(Number.isFinite(b)).toBe(true);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
    expect(r.brierDelta).toBeCloseTo(r.brierFrozen! - r.brierLive!, 12);
  });

  it('o veredito é exatamente "quem errou menos", com empate contando como não-melhorou', () => {
    expect(r.verdict).toBe(r.brierLive! < r.brierFrozen! ? 'REFIT_MELHOROU' : 'REFIT_NAO_MELHOROU');
    expect(['REFIT_MELHOROU', 'REFIT_NAO_MELHOROU']).toContain(r.verdict);
  });

  it('crescer a amostra muda o treino AO VIVO, nunca o CONGELADO', () => {
    const maior = evaluateShadowCalibration(preditiva(MIN_SHADOW_SAMPLE + 39));
    expect(maior.frozenTrainSize).toBe(r.frozenTrainSize); // parado no tempo, por construção
    expect(maior.liveTrainSize).toBeGreaterThan(r.liveTrainSize);
  });

  it('o veredito responde ao dado: sinal limpo e recente é aproveitado pelo ajuste fresco', () => {
    // Primeira metade sem relação score→resultado (ruído), segunda metade
    // com relação forte. A versão congelada treina só no ruído; a ao vivo
    // enxerga o sinal. Esperado: o reajuste ajuda.
    const ruido = Array.from({ length: 40 }, (_, i) => trade(i % 2 ? 0.9 : -0.9, i % 3 ? 1 : -1));
    const sinal = Array.from({ length: 40 }, (_, i) => (i % 4 === 0 ? trade(-0.9, -1) : trade(0.9, 1)));
    const r2 = evaluateShadowCalibration([...ruido, ...sinal]);
    expect(r2.status).toBe('OK');
    expect(r2.verdict).toBe('REFIT_MELHOROU');
    expect(r2.brierDelta!).toBeGreaterThan(0);
  });
});

describe('shadow-calibration: pureza e limiares', () => {
  it('não muta a amostra recebida', () => {
    const amostra = preditiva(MIN_SHADOW_SAMPLE + 5);
    const antes = JSON.parse(JSON.stringify(amostra));
    evaluateShadowCalibration(amostra);
    expect(JSON.parse(JSON.stringify(amostra))).toEqual(antes);
  });

  it('determinística: mesma entrada, mesma saída', () => {
    const amostra = preditiva(MIN_SHADOW_SAMPLE + 5);
    expect(evaluateShadowCalibration(amostra)).toEqual(evaluateShadowCalibration(amostra));
  });

  it('os limiares vêm de expectancy.ts; o mínimo total é 2×piso+1', () => {
    expect(SHADOW_FROZEN_TRAIN).toBe(MIN_TRADES_FOR_VALID_EXPECTANCY);
    expect(SHADOW_EVAL_WINDOW).toBe(MIN_TRADES_FOR_VALID_EXPECTANCY);
    // O "+1" é a condição de existência da comparação, não estética.
    expect(MIN_SHADOW_SAMPLE).toBe(2 * MIN_TRADES_FOR_VALID_EXPECTANCY + 1);
  });

  it('nenhum limiar redeclarado no módulo', () => {
    const src = readFileSync(new URL('../src/nexus/shadow-calibration.ts', import.meta.url), 'utf-8');
    expect(src).toContain('MIN_TRADES_FOR_VALID_EXPECTANCY');
    expect(src).not.toMatch(/=\s*30\b/);
  });

  it('reusa trainPlattScaling/applyPlattScaling — zero 2ª implementação de Platt', () => {
    const src = readFileSync(new URL('../src/nexus/shadow-calibration.ts', import.meta.url), 'utf-8');
    expect(src).toContain('trainPlattScaling(');
    expect(src).toContain('applyPlattScaling(');
    // Nenhuma sigmoide própria escondida aqui.
    expect(src).not.toMatch(/1\s*\/\s*\(1\s*\+\s*Math\.exp/);
  });
});

describe('shadow-calibration: describeShadowCalibration', () => {
  it('mostra os DOIS Brier e os três n — nunca só o veredito', () => {
    const linha = describeShadowCalibration(evaluateShadowCalibration(preditiva(MIN_SHADOW_SAMPLE + 19)));
    expect(linha).toContain('congelada');
    expect(linha).toContain('ao vivo');
    expect(linha).toContain(`em ${SHADOW_EVAL_WINDOW} retidos`);
  });

  it('sem amostra => devolve a razão real, nunca um veredito', () => {
    const linha = describeShadowCalibration(evaluateShadowCalibration([]));
    expect(linha).not.toContain('ajudou');
    expect(linha.length).toBeGreaterThan(0);
  });
});

describe('shadow-calibration: fiação real em App.tsx', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf-8');

  it('roda sobre a MESMA amostra dos outros memos, uma vez só', () => {
    expect(app).toContain('evaluateShadowCalibration(trackRecordResults)');
    expect(app.split('evaluateShadowCalibration(').length - 1).toBe(1);
  });

  it('o candidato NÃO decide nada: nenhum consumidor além da exibição', () => {
    // shadowReport só pode aparecer no memo, no contexto (valor+deps), no
    // destructure/tipo do card, no gate de maturidade e no bloco de
    // exibição. Nunca dentro de engine.direction, do filtro de expectativa
    // ou de qualquer cálculo de plano (LEI 24).
    expect(app).not.toMatch(/shadowReport[^\n]*\b(direction|engine\.|tradePlan|riskSuggestion)\b/);
    expect(app).not.toContain('shadowReport.verdict === "REFIT_MELHOROU" ? "LONG"');
  });

  it('a razão de escassez entra na linha de maturidade, não vira 4ª frase', () => {
    expect(app).toContain('const shadowGate = { label: "shadow"');
    // Trava a FORMA, não a contagem: a lista cresce por CAPACIDADE (o 5º
    // degrau é o drift, §29). Fixar o número faria toda capacidade nova
    // quebrar um teste que não é sobre ela — foi exatamente o que
    // aconteceu aqui, e a lição já valeu uma vez em
    // platt-calibration-wiring.test.ts.
    expect(app).toMatch(/buildSampleMaturity\(\[expectancyGate, calibrationGate, walkForwardGate, shadowGate[^\]]*\]\)/);
    expect(app).toContain('reasonStillNeeded(shadowReport?.reason, shadowGate)');
  });

  it('os dois Brier e os n aparecem na tela, nunca só o veredito', () => {
    expect(app).toContain('describeShadowCalibration(shadowReport)');
  });
});
