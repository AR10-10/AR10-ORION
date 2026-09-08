// model-governance.test.ts — execução REAL da esteira do §76.
//
// A pergunta central: um módulo que responde "pode ser promovido?" só é
// seguro se o padrão dele for NÃO. Cada bloco abaixo ataca uma forma de
// esse padrão vazar — ausência lida como aprovação, portão pulado,
// empate arredondado a favor da mudança, ou uma estatística própria
// entrando por baixo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { evaluatePromotion, describeGovernance } from '../src/nexus/model-governance';
import type { ShadowCalibrationReport } from '../src/nexus/shadow-calibration';
import type { WalkForwardReport } from '../src/nexus/walk-forward-calibration';
import type { CalibrationFreshness } from '../src/nexus/calibration-freshness';
import type { DriftReading } from '../src/nexus/drift-detector';

// ── fixtures: cada um representa "este portão aprova" ────────────────────
const shadowOk = (over: Partial<ShadowCalibrationReport> = {}): ShadowCalibrationReport => ({
  status: 'OK',
  reason: null,
  usableTrades: 80,
  frozenTrainSize: 30,
  liveTrainSize: 50,
  evalSize: 30,
  brierFrozen: 0.24,
  brierLive: 0.19,
  brierDelta: 0.05,
  verdict: 'REFIT_MELHOROU',
  ...over,
}) as ShadowCalibrationReport;

const wfOk = (over: Partial<WalkForwardReport> = {}): WalkForwardReport => ({
  status: 'OK',
  reason: null,
  brierSkillScore: 0.12,
  verdict: 'MELHOR_QUE_A_TAXA_BASE',
  ...over,
}) as WalkForwardReport;

const freshOk = (over: Partial<CalibrationFreshness> = {}): CalibrationFreshness => ({
  status: 'DENTRO_DO_MEDIDO',
  reason: null,
  ...over,
}) as CalibrationFreshness;

const driftOk = (over: Partial<DriftReading> = {}): DriftReading => ({
  status: 'OK',
  reason: null,
  state: 'STABLE',
  ...over,
}) as DriftReading;

const tudoOk = () => evaluatePromotion(shadowOk(), wfOk(), freshOk(), driftOk());

describe('governança: o padrão é NÃO PROMOVER', () => {
  it('nada medido => BLOQUEADO no primeiro portão, zero aprovações', () => {
    const r = evaluatePromotion(null, null, null, null);
    expect(r.stage).toBe('CANDIDATE');
    expect(r.gates.every((g) => !g.passed)).toBe(true);
    expect(r.blockedBy!.stage).toBe('CANDIDATE');
  });

  it('undefined nos quatro nunca lança e nunca aprova', () => {
    const r = evaluatePromotion(undefined, undefined, undefined, undefined);
    expect(r.stage).not.toBe('ELEGIVEL');
    expect(r.gates.filter((g) => g.passed)).toHaveLength(0);
  });

  it('ausência de evidência NUNCA é evidência de aprovação — portão a portão', () => {
    // Cada portão, sozinho, com tudo o mais aprovado: some a evidência
    // dele e ele tem de reprovar.
    expect(evaluatePromotion(null, wfOk(), freshOk(), driftOk()).stage).toBe('CANDIDATE');
    expect(evaluatePromotion(shadowOk(), null, freshOk(), driftOk()).stage).toBe('OOS');
    expect(evaluatePromotion(shadowOk(), wfOk(), null, driftOk()).stage).toBe('VALIDATION');
    expect(evaluatePromotion(shadowOk(), wfOk(), freshOk(), null).stage).toBe('VALIDATION');
  });

  it('DADOS_INSUFICIENTES em qualquer fonte reprova, com a razão REAL da fonte', () => {
    const r = evaluatePromotion(
      shadowOk({ status: 'DADOS_INSUFICIENTES', reason: 'faltam 61 trades com leitura de modelo' }),
      wfOk(), freshOk(), driftOk(),
    );
    expect(r.stage).toBe('CANDIDATE');
    // A razão vem do módulo de origem, nunca de uma frase genérica daqui.
    expect(r.blockedBy!.reason).toContain('faltam 61 trades');
  });
});

describe('governança: a esteira é SEQUENCIAL', () => {
  it('reprovar no shadow para em SHADOW, mesmo com validação impecável', () => {
    const r = evaluatePromotion(shadowOk({ verdict: 'REFIT_NAO_MELHOROU' }), wfOk(), freshOk(), driftOk());
    expect(r.stage).toBe('SHADOW');
    // não "está em validação" só porque a amostra está fresca
    expect(r.blockedBy!.stage).toBe('SHADOW');
  });

  it('os QUATRO portões aparecem sempre, na ordem, inclusive os não alcançados', () => {
    const r = evaluatePromotion(null, null, null, null);
    expect(r.gates.map((g) => g.stage)).toEqual(['CANDIDATE', 'SHADOW', 'OOS', 'VALIDATION']);
    // Esconder os posteriores daria a impressão de que não existem.
    expect(r.gates).toHaveLength(4);
  });

  it('cada portão declara qual módulo real o produziu (auditável sem ler o código)', () => {
    for (const g of tudoOk().gates) {
      expect(g.source).toMatch(/nexus\/[a-z-]+\.ts/);
      expect(g.reason.length).toBeGreaterThan(0);
    }
  });
});

describe('governança: cada portão reprova pelo motivo certo', () => {
  it('SHADOW: empate conta como não-melhorou (nunca arredonda a favor da mudança)', () => {
    const r = evaluatePromotion(
      shadowOk({ verdict: 'REFIT_NAO_MELHOROU', brierFrozen: 0.2, brierLive: 0.2, brierDelta: 0 }),
      wfOk(), freshOk(), driftOk(),
    );
    expect(r.stage).toBe('SHADOW');
    expect(r.blockedBy!.reason).toContain('perseguir ruído');
  });

  it('OOS: vencer o incumbente NÃO basta se nenhum dos dois bate a taxa base', () => {
    const r = evaluatePromotion(
      shadowOk(), // o desafiante venceu o incumbente...
      wfOk({ verdict: 'SEM_VALOR_PREDITIVO_DEMONSTRADO', brierSkillScore: -0.03 }),
      freshOk(), driftOk(),
    );
    expect(r.stage).toBe('OOS');
    expect(r.gates[1].passed).toBe(true); // shadow passou de verdade
    expect(r.blockedBy!.reason).toContain('taxa base');
  });

  it('VALIDATION: amostra EXTRAPOLANDO reprova — projetar além da evidência', () => {
    const r = evaluatePromotion(shadowOk(), wfOk(), freshOk({ status: 'EXTRAPOLANDO', reason: 'lacuna de 9d além do alcance de 2d' }), driftOk());
    expect(r.stage).toBe('VALIDATION');
    expect(r.blockedBy!.reason).toContain('9d');
  });

  it('VALIDATION: DRIFT_CONFIRMED e DEGRADED reprovam', () => {
    for (const state of ['DRIFT_CONFIRMED', 'DEGRADED'] as const) {
      const r = evaluatePromotion(shadowOk(), wfOk(), freshOk(), driftOk({ state }));
      expect(r.stage).toBe('VALIDATION');
    }
  });

  it('VALIDATION: RECOVERING NÃO reprova — mudou A FAVOR do Operador', () => {
    // drift-detector.ts distingue RECOVERING de DEGRADED exatamente por
    // isto; tratar "melhorou muito" como bloqueio puniria o candidato
    // pelo motivo errado.
    const r = evaluatePromotion(shadowOk(), wfOk(), freshOk(), driftOk({ state: 'RECOVERING' }));
    expect(r.stage).toBe('ELEGIVEL');
  });

  it('VALIDATION: WATCH e POSSIBLE_DRIFT não reprovam sozinhos (só o confirmado)', () => {
    for (const state of ['STABLE', 'WATCH', 'POSSIBLE_DRIFT'] as const) {
      expect(evaluatePromotion(shadowOk(), wfOk(), freshOk(), driftOk({ state })).stage).toBe('ELEGIVEL');
    }
  });
});

describe('governança: o estado final é ELEGÍVEL, nunca PROMOVIDO', () => {
  it('todos os portões passando => ELEGIVEL, com a promoção declarada como decisão do Operador', () => {
    const r = tudoOk();
    expect(r.stage).toBe('ELEGIVEL');
    expect(r.blockedBy).toBeNull();
    expect(r.gates.every((g) => g.passed)).toBe(true);
    expect(r.nextRequirement).toContain('decisão do Operador');
  });

  it('nenhum estado do tipo significa "trocado" — a esteira termina em elegibilidade', () => {
    const src = readFileSync(new URL('../src/nexus/model-governance.ts', import.meta.url), 'utf-8');
    expect(src).toContain('"ELEGIVEL"');
    expect(src).not.toMatch(/"PROMOVIDO"|"PROMOTED"|"SWAPPED"|"ATIVO"/);
  });
});

describe('governança: contrato — zero estatística própria (LEI 24 e §71)', () => {
  const src = readFileSync(new URL('../src/nexus/model-governance.ts', import.meta.url), 'utf-8');

  it('não existe uma única constante numérica de decisão neste arquivo', () => {
    // Um módulo de governança que inventasse os próprios critérios daria
    // autoridade de decisão a números que ninguém mediu.
    //
    // O que se afirma aqui é sobre CÓDIGO, então comentários E literais de
    // texto saem antes da varredura: a primeira versão deste teste
    // reprovou por causa do "§71" dentro da frase que o módulo devolve ao
    // Operador — uma citação da própria Ordem, não um limiar. Mesma classe
    // de falso positivo já paga duas vezes nesta base (grepar a palavra
    // "probabilidade" na frase que a proíbe; "importante" contendo
    // "import"): a asserção tem de olhar onde a afirmação vive.
    const codigo = src
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/`(?:[^`\\]|\\.)*`/g, '``')
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");
    const numeros = codigo.match(/(?<![\w.])\d+(\.\d+)?/g) ?? [];
    expect(numeros).toEqual(['4']); // só o toFixed(4), que é formatação
  });

  it('nenhuma matemática de comparação estatística mora aqui', () => {
    const semComentarios = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(semComentarios).not.toMatch(/Math\.(sqrt|exp|log|pow|abs)/);
    // As comparações são só de veredito (===/!==), nunca de grandeza.
    expect(semComentarios).not.toMatch(/[<>]=?\s*\d/);
  });

  it('não importa nada do Núcleo nem do plano — só os quatro vereditos', () => {
    expect(src).not.toMatch(/from "\.\/(trade-plan|nexus-core|decision-layer|expectancy)"/);
    const imports = src.match(/from "\.\/[a-z-]+"/g) ?? [];
    expect(imports.sort()).toEqual([
      'from "./calibration-freshness"',
      'from "./drift-detector"',
      'from "./shadow-calibration"',
      'from "./walk-forward-calibration"',
    ]);
  });
});

describe('governança: pureza', () => {
  it('determinística e sem mutação das entradas', () => {
    const s = shadowOk(), w = wfOk(), f = freshOk(), d = driftOk();
    const antes = JSON.stringify([s, w, f, d]);
    const a = evaluatePromotion(s, w, f, d);
    const b = evaluatePromotion(s, w, f, d);
    expect(a).toEqual(b);
    expect(JSON.stringify([s, w, f, d])).toBe(antes);
  });

  it('describeGovernance carrega a contagem real de portões', () => {
    expect(describeGovernance(tudoOk())).toContain('4/4');
    expect(describeGovernance(tudoOk())).toContain('ELEGÍVEL');
    const bloqueado = describeGovernance(evaluatePromotion(null, null, null, null));
    expect(bloqueado).toContain('0/4');
    expect(bloqueado).toContain('CANDIDATE');
  });

  it('nunca fabrica um número no lugar de "não medido"', () => {
    const r = evaluatePromotion(shadowOk(), wfOk({ brierSkillScore: null, verdict: 'SEM_VALOR_PREDITIVO_DEMONSTRADO' }), freshOk(), driftOk());
    expect(r.blockedBy!.reason).toContain('não medido');
    expect(r.blockedBy!.reason).not.toContain('0.0000');
  });
});

describe('governança: fiação real em App.tsx — display only (LEI 24 / §71)', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf-8');

  it('compõe os QUATRO vereditos já memoizados, uma vez só', () => {
    expect(app).toContain('evaluatePromotion(shadowReport, walkForwardReport, calibrationFreshness, driftReading)');
    expect(app.split('evaluatePromotion(').length - 1).toBe(1);
  });

  it('NÃO decide nada: nenhum caminho de governance para o Núcleo, plano ou risco', () => {
    expect(app).not.toMatch(/governance[^\n]*\b(direction|engine\.|tradePlan|riskSuggestion)\b/);
    // E o inverso também: nada lê a governança para escolher um modelo.
    expect(app).not.toMatch(/governance\.stage\s*===\s*"ELEGIVEL"\s*\?[^\n]*(calibrat|platt|model)/i);
  });

  it('a razão do bloqueio aparece na tela, nunca só no tooltip', () => {
    expect(app).toContain('{governance.nextRequirement}');
    expect(app).toContain('describeGovernance(governance)');
  });

  it('os quatro portões, com razão, ficam disponíveis para inspeção', () => {
    expect(app).toContain('governance.gates.map');
  });
});
