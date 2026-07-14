// self-diagnostics.ts — Ordem "Ciborgue Vivo" §3 ("detectar falhas ou
// comportamentos anormais... gerar relatórios claros para nós"). Pura
// função de síntese: recebe os MESMOS sinais reais já medidos pelo Health
// Monitor (Fase J), pelo Data Quality Layer (Fase C) e pelo estado de
// conexão por exchange (nexus/types.ts) e produz um relatório legível —
// zero segunda medição, zero número fabricado. Autocorreção real já
// existe nas camadas de dado (reconexão de WS com backoff, fail-closed do
// Market Data Bus servindo o último snapshot bom por chave); este arquivo
// não duplica isso — só torna o estado real visível de forma honesta e
// centralizada quando o Operador pede.
import { classifyFps, classifyCycleLatency } from '../../../src/telemetry/index.js';
import type { Exchange, ExchangeConnectionState, HealthSnapshot } from './types';

export type DiagnosticSeverity = 'OK' | 'WARN' | 'CRITICAL';

export interface DiagnosticFinding {
  severity: DiagnosticSeverity;
  label: string;
  detail: string;
}

export interface DiagnosticInput {
  offline: boolean;
  isDataFresh: boolean;
  health: HealthSnapshot;
  engineStatus: 'ok' | 'error' | 'pending';
  engineReason: string | null;
  dataQualityClassification: string | null;
  connections: Partial<Record<Exchange, ExchangeConnectionState>>;
}

export interface DiagnosticReport {
  generatedAt: number;
  overallSeverity: DiagnosticSeverity;
  findings: DiagnosticFinding[];
}

const SEVERITY_RANK: Record<DiagnosticSeverity, number> = { OK: 0, WARN: 1, CRITICAL: 2 };
const worse = (a: DiagnosticSeverity, b: DiagnosticSeverity): DiagnosticSeverity =>
  SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;

/** Síntese real e determinística — mesma entrada sempre produz o mesmo
 *  relatório (nenhum relógio além de `generatedAt`, nenhum Math.random()). */
export function buildDiagnosticReport(input: DiagnosticInput): DiagnosticReport {
  const findings: DiagnosticFinding[] = [];

  findings.push(
    input.offline
      ? { severity: 'CRITICAL', label: 'Conectividade', detail: 'Navegador offline (navigator.onLine) — nenhum dado real pode chegar agora.' }
      : { severity: 'OK', label: 'Conectividade', detail: 'Navegador online.' },
  );

  findings.push(
    !input.isDataFresh
      ? { severity: 'WARN', label: 'Frescor dos dados', detail: 'Último preço/livro real está além do limiar de frescor do Health Monitor.' }
      : { severity: 'OK', label: 'Frescor dos dados', detail: 'Preço/livro real dentro do limiar de frescor esperado.' },
  );

  findings.push(
    input.engineStatus === 'error'
      ? { severity: 'CRITICAL', label: 'Motor de análise', detail: `Ciclo real falhou: ${input.engineReason ?? 'motivo não reportado'}.` }
      : input.engineStatus === 'pending'
        ? { severity: 'WARN', label: 'Motor de análise', detail: 'Aguardando o primeiro ciclo real bem-sucedido.' }
        : { severity: 'OK', label: 'Motor de análise', detail: 'Último ciclo real concluído com sucesso.' },
  );

  const quality = input.dataQualityClassification;
  findings.push(
    quality === 'QUARENTENA'
      ? { severity: 'CRITICAL', label: 'Qualidade da fonte', detail: 'Data Quality Layer classificou a fonte como QUARENTENA — degradada demais para confiança normal.' }
      : quality === 'DEGRADADA'
        ? { severity: 'WARN', label: 'Qualidade da fonte', detail: 'Data Quality Layer classificou a fonte como DEGRADADA.' }
        : quality
          ? { severity: 'OK', label: 'Qualidade da fonte', detail: `Data Quality Layer classificou a fonte como ${quality}.` }
          : { severity: 'WARN', label: 'Qualidade da fonte', detail: 'Ainda sem classificação real (aguardando primeiro snapshot do Bus).' },
  );

  const fpsClass = classifyFps(input.health.fps);
  findings.push(
    fpsClass === 'CRITICO'
      ? { severity: 'CRITICAL', label: 'FPS da UI', detail: `${input.health.fps}fps real — abaixo de 30fps, a interface está travando de verdade.` }
      : fpsClass === 'ACEITAVEL'
        ? { severity: 'WARN', label: 'FPS da UI', detail: `${input.health.fps}fps real — aceitável, abaixo do ideal de 50+.` }
        : fpsClass === 'FLUIDO'
          ? { severity: 'OK', label: 'FPS da UI', detail: `${input.health.fps}fps real — fluido.` }
          : { severity: 'WARN', label: 'FPS da UI', detail: 'Ainda sem amostra real de FPS.' },
  );

  const cycleClass = classifyCycleLatency(input.health.cycleLatencyMs);
  findings.push(
    cycleClass === 'LENTO'
      ? { severity: 'WARN', label: 'Latência do ciclo', detail: `${input.health.cycleLatencyMs}ms reais — rede ou motor degradados.` }
      : cycleClass
        ? { severity: 'OK', label: 'Latência do ciclo', detail: `${input.health.cycleLatencyMs}ms reais (${cycleClass}).` }
        : { severity: 'WARN', label: 'Latência do ciclo', detail: 'Ainda sem amostra real de latência do ciclo.' },
  );

  findings.push(
    input.health.workersAlive === 0
      ? { severity: 'CRITICAL', label: 'Worker WASM', detail: 'Nenhum Worker do Quant Engine vivo — cálculo pesado não tem onde rodar.' }
      : { severity: 'OK', label: 'Worker WASM', detail: `${input.health.workersAlive} worker(s) real(is) vivo(s).` },
  );

  for (const [exchange, state] of Object.entries(input.connections) as Array<[Exchange, ExchangeConnectionState | undefined]>) {
    if (!state) continue;
    const severity: DiagnosticSeverity =
      state === 'OFFLINE' ? 'CRITICAL' : state === 'DEGRADED' || state === 'STALE' ? 'WARN' : 'OK';
    findings.push({ severity, label: `Conexão · ${exchange}`, detail: `Estado real: ${state}.` });
  }

  const overallSeverity = findings.reduce<DiagnosticSeverity>((acc, f) => worse(acc, f.severity), 'OK');
  return { generatedAt: Date.now(), overallSeverity, findings };
}

/** Formato Markdown real, pronto para copiar/exportar — mesmos achados do
 *  relatório, nenhuma segunda síntese. */
export function formatDiagnosticReportMarkdown(report: DiagnosticReport): string {
  const stamp = new Date(report.generatedAt).toISOString();
  const lines: string[] = [
    '# AR10 CYBORG — Relatório de Autodiagnóstico',
    '',
    `Gerado em: ${stamp}`,
    `Severidade geral: ${report.overallSeverity}`,
    '',
    '## Achados reais',
    '',
  ];
  for (const f of report.findings) {
    lines.push(`- [${f.severity}] ${f.label} — ${f.detail}`);
  }
  lines.push('');
  lines.push('---');
  lines.push(
    'Todos os valores acima vêm de medições reais (Health Monitor, Data Quality Layer, estado de conexão por exchange) — nenhum número foi estimado ou fabricado para este relatório.',
  );
  return lines.join('\n');
}
