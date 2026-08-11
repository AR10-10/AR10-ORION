// platt-calibration-wiring.test.ts — Escopo Cirúrgico (Operador, Fase 3:
// "Calibração de Probabilidade"). A matemática pura já tem execução real em
// nexus-platt-calibration.test.ts / nexus-model-fusion.test.ts — aqui
// trancam-se os pontos de conexão reais em App.tsx (mesma convenção de
// refinamento-final-wiring.test.ts: "esqueceram de ligar A com B" é o bug
// mais provável, não um erro de matemática).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const app = () => read('../src/App.tsx');
const wholeFunction = (src: string, signature: string): string => {
  const idx = src.indexOf(signature);
  if (idx === -1) return '';
  const nextFnIdx = src.indexOf('\nfunction ', idx + 1);
  return nextFnIdx === -1 ? src.slice(idx) : src.slice(idx, nextFnIdx);
};

describe('App: import real dos módulos da Fase 3 (zero segunda implementação inline)', () => {
  it('importa councilVotesToModelVotes/regimeModelVote/fuseModelVotes/alignFusedConfidence de nexus/model-fusion e calibrateConfidence de nexus/platt-calibration', () => {
    const a = app();
    expect(a).toContain('import { councilVotesToModelVotes, regimeModelVote, fuseModelVotes, alignFusedConfidence } from "./nexus/model-fusion";');
    expect(a).toContain('import { calibrateConfidence, type CalibrationResult } from "./nexus/platt-calibration";');
  });
});

describe('App: liveModelAgreement — mesma CouncilDecision do ciclo, regime real já bridgeado, orientado à direção do plano rastreado', () => {
  it('useMemo real: null sem plano ativo, senão councilVotesToModelVotes + regimeModelVote(engine.marketRegime.direction/adx) + fuseModelVotes + alignFusedConfidence(direction)', () => {
    const a = app();
    const m = a.match(/const liveModelAgreement = useMemo\(\(\) => \{([\s\S]*?)\}, \[([\s\S]*?)\]\);/);
    expect(m, 'liveModelAgreement não encontrado').not.toBeNull();
    const body = m![1];
    expect(body).toContain('const direction = trackRecordSlice.active?.plan.direction ?? null;');
    expect(body).toContain('if (direction === null) return null;');
    expect(body).toContain('...councilVotesToModelVotes(councilFromSnapshot?.votes ?? []),');
    expect(body).toContain('regimeModelVote(engine?.marketRegime?.direction ?? null, engine?.marketRegime?.adx ?? null),');
    expect(body).toContain('return alignFusedConfidence(fuseModelVotes(modelVotes), direction);');
    const deps = m![2];
    expect(deps).toContain('trackRecordSlice.active');
    expect(deps).toContain('councilFromSnapshot');
    expect(deps).toContain('engine?.marketRegime');
  });
});

describe('App: calibrationResult — mesmo Track Record real de expectancyFilter, zero segunda simulação', () => {
  it('trackRecordResults fatorado e compartilhado entre expectancyFilter e calibrationResult', () => {
    const a = app();
    expect(a).toContain('const trackRecordResults = useMemo(() => simulateTradeCostsBatch(trackRecordSlice.history), [trackRecordSlice.history]);');
    expect(a).toContain('() => evaluateSignalFilter(trackRecordResults),');
    expect(a).toContain('[trackRecordResults],');
  });

  it('calibrationResult: useMemo real chamando calibrateConfidence(liveModelAgreement, trackRecordResults)', () => {
    const a = app();
    const m = a.match(/const calibrationResult: CalibrationResult = useMemo\(\s*\(\) => calibrateConfidence\(liveModelAgreement, trackRecordResults\),\s*\[liveModelAgreement, trackRecordResults\],\s*\);/);
    expect(m, 'calibrationResult não encontrado ou com assinatura diferente da esperada').not.toBeNull();
  });
});

describe('App: stampPlanOpenContext carimba modelAgreement (Fase 3) usando o MESMO liveModelAgreement deste render — zero segunda fusão', () => {
  it('chamada real inclui modelAgreement: liveModelAgreement, e o efeito depende de liveModelAgreement', () => {
    const a = app();
    const idx = a.indexOf('useUnifiedSnapshotStore.getState().stampPlanOpenContext({');
    expect(idx, 'chamada de stampPlanOpenContext não encontrada').toBeGreaterThan(-1);
    const block = a.slice(idx, idx + 1300);
    expect(block).toContain('structureLabel: engine?.marketStructureLabel ?? null,');
    expect(block).toContain('modelAgreement: liveModelAgreement,');
    const depsMatch = block.match(/\}, \[([\s\S]*?)\]\);/);
    expect(depsMatch, 'array de dependências do efeito não encontrado').not.toBeNull();
    expect(depsMatch![1]).toContain('liveModelAgreement');
  });
});

describe('App: contextValue expõe calibrationResult (objeto + dependências) — mesmo padrão de expectancyFilter/displayConflicts', () => {
  it('propriedade presente no objeto retornado E no array de dependências do useMemo', () => {
    const a = app();
    const ctx = a.match(/const contextValue = useMemo\(\s*\(\) => \(\{([\s\S]*?)\}\),\s*\[([\s\S]*?)\],\s*\);/);
    expect(ctx, 'contextValue não encontrado').not.toBeNull();
    expect(ctx![1]).toContain('calibrationResult,');
    expect(ctx![2]).toContain('calibrationResult,');
  });
});

describe('ExpectancyCard: mostra a probabilidade calibrada real (Fase 3) — nunca "probabilidade" quando não calibrado', () => {
  it('consome calibrationResult do WidgetContext e só formata % quando calibrated===true', () => {
    const block = wholeFunction(app(), 'function ExpectancyCard(');
    expect(block).not.toBe('');
    expect(block).toContain('calibrationResult }: { expectancyFilter?: FilterResult; calibrationResult?: CalibrationResult }');
    expect(block).toContain('calibrationResult?.calibrated && calibrationResult.probability !== null ? `${calibrationResult.probability}%` : DASH;');
    expect(block).toContain('label="Prob. Calibrada"');
    // razão real (fail-closed) só aparece quando NÃO calibrado — nunca escondida, mesmo padrão do warning de expectancyFilter
    expect(block).toContain('{calibrationResult && !calibrationResult.calibrated && calibrationResult.reason && (');
  });
});
