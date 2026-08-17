// self-diagnostics.test.ts — Ordem "Ciborgue Vivo" §3: real-execution
// tests for buildDiagnosticReport/formatDiagnosticReportMarkdown. Every
// finding must trace back to a real signal already used elsewhere
// (TelemetryHealthWidget) — this suite locks that the severity rules
// match the SAME classifyFps/classifyCycleLatency thresholds already
// tested in market-regime.test.ts's sibling telemetry tests, not a
// second, drifted copy of the rules.
import { describe, it, expect } from 'vitest';
import { buildDiagnosticReport, formatDiagnosticReportMarkdown, type DiagnosticInput } from '../src/nexus/self-diagnostics';
import type { HealthSnapshot } from '../src/nexus/types';
import { STAGE_ORDER, type StageTrace } from '../src/nexus/stage-runner';

const HEALTHY_HEALTH: HealthSnapshot = { fps: 60, cycleLatencyMs: 300, memoryMb: 50, workersAlive: 1, lastUpdatedAt: 1 };

function baseInput(overrides: Partial<DiagnosticInput> = {}): DiagnosticInput {
  return {
    offline: false,
    isDataFresh: true,
    health: HEALTHY_HEALTH,
    engineStatus: 'ok',
    engineReason: null,
    dataQualityClassification: 'EXCELENTE',
    connections: {},
    // null honesto por padrão nesta suíte (a maioria dos casos aqui não
    // testa o pipeline causal) — ver describe dedicado abaixo.
    stageTrace: null,
    // null honesto por padrão (a maioria dos casos aqui não testa Evidence
    // Fusion) — ver describe dedicado abaixo.
    evidenceFusionFieldCoverage: null,
    ...overrides,
  };
}

// Fixture real (nunca fabricada à mão fora de forma): mesma estrutura que
// traceStages() de fato devolve, construída explicitamente para os 2
// cenários reais que importam aqui — cadeia completa e cadeia quebrada.
const completeTrace = (seq: number): StageTrace => ({
  seq,
  stages: STAGE_ORDER.map((id) => ({ id, ok: true, reason: 'ok real' })),
  reachedIndex: STAGE_ORDER.length - 1,
});
const brokenTrace = (seq: number): StageTrace => ({
  seq,
  stages: [
    { id: 'DATA', ok: true, reason: 'preço real recebido' },
    { id: 'CORE_ENGINE', ok: false, reason: 'ciclo real do motor falhou (rede/wasm) — nunca fabricar direção a partir daqui' },
    { id: 'COUNCIL', ok: false, reason: 'estágio anterior (CORE_ENGINE) sem insumo real' },
    { id: 'TRADE_PLAN', ok: false, reason: 'estágio anterior (COUNCIL) sem insumo real' },
    { id: 'NEXUS_DECISION', ok: false, reason: 'estágio anterior (TRADE_PLAN) sem insumo real' },
  ],
  reachedIndex: 0,
});

describe('buildDiagnosticReport: tudo saudável => severidade geral OK, nenhum achado real de alerta', () => {
  it('sinais todos bons => OK, zero achados WARN/CRITICAL', () => {
    const report = buildDiagnosticReport(baseInput());
    expect(report.overallSeverity).toBe('OK');
    expect(report.findings.every((f) => f.severity === 'OK')).toBe(true);
    expect(report.findings.length).toBeGreaterThan(0); // nunca um relatório vazio disfarçado
  });
});

describe('buildDiagnosticReport: cada sinal real degradado sobe a severidade honesta correspondente', () => {
  it('offline real => CRITICAL geral', () => {
    const report = buildDiagnosticReport(baseInput({ offline: true }));
    expect(report.overallSeverity).toBe('CRITICAL');
    expect(report.findings.find((f) => f.label === 'Conectividade')?.severity).toBe('CRITICAL');
  });

  it('engineStatus error real => CRITICAL geral, motivo real no detail', () => {
    const report = buildDiagnosticReport(baseInput({ engineStatus: 'error', engineReason: 'falha_de_rede_real' }));
    const finding = report.findings.find((f) => f.label === 'Motor de análise');
    expect(finding?.severity).toBe('CRITICAL');
    expect(finding?.detail).toContain('falha_de_rede_real');
  });

  it('dataQuality QUARENTENA real => CRITICAL geral', () => {
    const report = buildDiagnosticReport(baseInput({ dataQualityClassification: 'QUARENTENA' }));
    expect(report.overallSeverity).toBe('CRITICAL');
  });

  it('dataQuality DEGRADADA real => WARN (não CRITICAL) quando nada mais está ruim', () => {
    const report = buildDiagnosticReport(baseInput({ dataQualityClassification: 'DEGRADADA' }));
    expect(report.overallSeverity).toBe('WARN');
  });

  // Achado de auditoria (Data Quality Monitor unificado, corrigido nesta
  // rodada via classifyBusQuality): dataQualityClassification pode ser o
  // literal 'DADOS_INSUFICIENTES' (classifyScore real do Bus emite esse
  // valor quando score é null) — uma string truthy diferente de QUARENTENA/
  // DEGRADADA. A versão anterior desta função caía no ramo `quality ? OK :
  // ...` e reportava OK para uma fonte SEM dado real. Trava de regressão:
  // nunca mais pode voltar a ser OK.
  it('dataQuality literal DADOS_INSUFICIENTES (não null, a string real que classifyScore emite) => WARN, NUNCA OK', () => {
    const report = buildDiagnosticReport(baseInput({ dataQualityClassification: 'DADOS_INSUFICIENTES' }));
    const finding = report.findings.find((f) => f.label === 'Qualidade da fonte');
    expect(finding?.severity).toBe('WARN');
    expect(report.overallSeverity).not.toBe('OK');
  });

  it('fps real crítico (< 30) => CRITICAL geral — mesmo limiar real de classifyFps', () => {
    const report = buildDiagnosticReport(baseInput({ health: { ...HEALTHY_HEALTH, fps: 15 } }));
    expect(report.overallSeverity).toBe('CRITICAL');
  });

  it('fps real aceitável (30-49) => WARN — mesmo limiar real de classifyFps', () => {
    const report = buildDiagnosticReport(baseInput({ health: { ...HEALTHY_HEALTH, fps: 35 } }));
    expect(report.overallSeverity).toBe('WARN');
  });

  it('latência de ciclo real lenta (>= 1500ms) => WARN — mesmo limiar real de classifyCycleLatency', () => {
    const report = buildDiagnosticReport(baseInput({ health: { ...HEALTHY_HEALTH, cycleLatencyMs: 2000 } }));
    expect(report.overallSeverity).toBe('WARN');
  });

  it('nenhum worker WASM real vivo => CRITICAL geral', () => {
    const report = buildDiagnosticReport(baseInput({ health: { ...HEALTHY_HEALTH, workersAlive: 0 } }));
    expect(report.overallSeverity).toBe('CRITICAL');
  });

  it('conexão real OFFLINE de uma exchange => CRITICAL geral, achado nomeado pela exchange real', () => {
    const report = buildDiagnosticReport(baseInput({ connections: { BINANCE: 'OFFLINE', MEXC: 'LIVE' } }));
    expect(report.overallSeverity).toBe('CRITICAL');
    expect(report.findings.find((f) => f.label === 'Conexão · BINANCE')?.severity).toBe('CRITICAL');
    expect(report.findings.find((f) => f.label === 'Conexão · MEXC')?.severity).toBe('OK');
  });

  it('sem dado real ainda (offline=false mas isDataFresh=false, nada mais lido) => WARN honesto, nunca inventa OK', () => {
    const report = buildDiagnosticReport(
      baseInput({ isDataFresh: false, dataQualityClassification: null, health: { fps: null, cycleLatencyMs: null, memoryMb: null, workersAlive: 1, lastUpdatedAt: 0 } }),
    );
    expect(report.overallSeverity).not.toBe('OK');
  });
});

describe('EPC OMEGA FINAL Parte 3: memória real (heap JS) agora vira achado visível, sem limiar fabricado', () => {
  it('memoryMb real presente => achado OK com o número real, nunca um julgamento de severidade sem calibração', () => {
    const report = buildDiagnosticReport(baseInput({ health: { ...HEALTHY_HEALTH, memoryMb: 128.4 } }));
    const finding = report.findings.find((f) => f.label === 'Memória (heap JS)');
    expect(finding?.severity).toBe('OK');
    expect(finding?.detail).toContain('128MB');
  });

  it('memoryMb null (browser não expõe, ex. Firefox) => OK honesto, nunca WARN/CRITICAL por ausência de instrumentação', () => {
    const report = buildDiagnosticReport(baseInput({ health: { ...HEALTHY_HEALTH, memoryMb: null } }));
    const finding = report.findings.find((f) => f.label === 'Memória (heap JS)');
    expect(finding?.severity).toBe('OK');
    expect(finding?.detail).toContain('não expõe');
  });
});

// ORDEM OFICIAL Nº 01 (Autogovernança): traceStages() ganha seu primeiro
// consumidor ao vivo aqui — trava que o achado "Pipeline causal" reflete
// SÓ o StageTrace real recebido (zero segunda leitura, zero fabricação) e
// nunca escala a severidade geral além de WARN (a causa raiz de um
// estágio quebrado já é CRITICAL em outro achado — nunca um alarme
// duplicado).
describe('buildDiagnosticReport: "Pipeline causal" (ORDEM Nº 01) — traceStages() real, nunca uma segunda detecção', () => {
  it('stageTrace null (chamador ainda sem leitura real) => nenhum achado "Pipeline causal" fabricado', () => {
    const report = buildDiagnosticReport(baseInput({ stageTrace: null }));
    expect(report.findings.find((f) => f.label === 'Pipeline causal')).toBeUndefined();
  });

  it('cadeia real completa (reachedIndex = último estágio) => OK, lista a ordem real STAGE_ORDER', () => {
    const report = buildDiagnosticReport(baseInput({ stageTrace: completeTrace(7) }));
    const finding = report.findings.find((f) => f.label === 'Pipeline causal');
    expect(finding?.severity).toBe('OK');
    expect(finding?.detail).toBe(`Cadeia completa: ${STAGE_ORDER.join(' → ')}.`);
  });

  it('cadeia real quebrada (CORE_ENGINE falhou) => WARN, motivo é o `reason` REAL do estágio quebrado — zero re-redação', () => {
    const report = buildDiagnosticReport(baseInput({ stageTrace: brokenTrace(7) }));
    const finding = report.findings.find((f) => f.label === 'Pipeline causal');
    expect(finding?.severity).toBe('WARN');
    expect(finding?.detail).toContain('Alcançou até DATA');
    expect(finding?.detail).toContain('ciclo real do motor falhou (rede/wasm) — nunca fabricar direção a partir daqui');
  });

  it('"Pipeline causal" NUNCA escala overallSeverity além de WARN, mesmo com toda a cadeia quebrada e o resto do input saudável — a causa raiz já é CRITICAL em outro achado, nunca um alarme duplicado', () => {
    const report = buildDiagnosticReport(baseInput({ stageTrace: brokenTrace(1) }));
    expect(report.overallSeverity).toBe('WARN');
  });

  it('reachedIndex -1 (nem o primeiro estágio real) => "nenhum estágio" honesto, nunca um índice negativo vazando pro texto', () => {
    const allBroken: StageTrace = {
      seq: 1,
      stages: [{ id: 'DATA', ok: false, reason: 'sem tick real ainda (boot ou troca de ativo recente)' }],
      reachedIndex: -1,
    };
    const report = buildDiagnosticReport(baseInput({ stageTrace: allBroken }));
    const finding = report.findings.find((f) => f.label === 'Pipeline causal');
    expect(finding?.detail).toContain('Alcançou até nenhum estágio');
    expect(finding?.detail).not.toContain('-1');
  });
});

// Ordem Fechamento (§3, "Evidence Fusion... barramento inteligente"):
// primeiro consumidor real de evidenceFusion via a store — mesma
// disciplina de "Pipeline causal" acima (nunca uma 2ª medição, achado
// sempre OK porque este repositório não tem limiar calibrado, mesmo
// princípio de "Memória (heap JS)" acima).
describe('buildDiagnosticReport: "Evidence Fusion · cobertura do contrato" (Ordem Fechamento §3)', () => {
  it('evidenceFusionFieldCoverage null (nenhuma leitura publicada ainda) => OK honesto, texto explica a ausência', () => {
    const report = buildDiagnosticReport(baseInput({ evidenceFusionFieldCoverage: null }));
    const finding = report.findings.find((f) => f.label === 'Evidence Fusion · cobertura do contrato');
    expect(finding?.severity).toBe('OK');
    expect(finding?.detail).toContain('Ainda sem leitura real publicada');
  });

  it('evidenceFusionFieldCoverage real (0.5 = 5/10 campos) => OK, número real formatado como porcentagem, nunca WARN/CRITICAL sem limiar calibrado', () => {
    const report = buildDiagnosticReport(baseInput({ evidenceFusionFieldCoverage: 0.5 }));
    const finding = report.findings.find((f) => f.label === 'Evidence Fusion · cobertura do contrato');
    expect(finding?.severity).toBe('OK');
    expect(finding?.detail).toContain('50%');
  });

  it('evidenceFusionFieldCoverage nunca eleva overallSeverity (sempre OK, mesmo cobertura baixa) — mesmo princípio de "Memória (heap JS)"', () => {
    const report = buildDiagnosticReport(baseInput({ evidenceFusionFieldCoverage: 0.1 }));
    expect(report.overallSeverity).toBe('OK');
  });
});

describe('formatDiagnosticReportMarkdown: texto real, rastreável, nunca um resumo vago', () => {
  it('lista cada achado real com sua severidade e detalhe, mais o carimbo honesto de "nada foi fabricado"', () => {
    const report = buildDiagnosticReport(baseInput({ offline: true }));
    const md = formatDiagnosticReportMarkdown(report);
    expect(md).toContain('# AR10 CYBORG — Relatório de Autodiagnóstico');
    expect(md).toContain('Severidade geral: CRITICAL');
    expect(md).toContain('[CRITICAL] Conectividade');
    expect(md).toContain('nenhum número foi estimado ou fabricado');
  });
});
