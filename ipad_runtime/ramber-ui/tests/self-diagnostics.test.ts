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

const HEALTHY_HEALTH: HealthSnapshot = { fps: 60, cycleLatencyMs: 300, memoryMb: 50, workersAlive: 1, isOnline: true, lastUpdatedAt: 1 };

function baseInput(overrides: Partial<DiagnosticInput> = {}): DiagnosticInput {
  return {
    offline: false,
    isDataFresh: true,
    health: HEALTHY_HEALTH,
    engineStatus: 'ok',
    engineReason: null,
    dataQualityClassification: 'EXCELENTE',
    connections: {},
    ...overrides,
  };
}

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
      baseInput({ isDataFresh: false, dataQualityClassification: null, health: { fps: null, cycleLatencyMs: null, memoryMb: null, workersAlive: 1, isOnline: true, lastUpdatedAt: 0 } }),
    );
    expect(report.overallSeverity).not.toBe('OK');
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
