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
import { classifyBusQuality } from './data-quality-vocabulary';
import type { Exchange, ExchangeConnectionState, HealthSnapshot } from './types';
// ORDEM OFICIAL Nº 01 ("Autogovernança... detectar falhas ou
// comportamentos anormais"): traceStages() (stage-runner.ts) já é um
// observador real e testado do pipeline causal canônico (SYSTEM_HANDBOOK.md
// §2), mas nunca tinha ganho um consumidor ao vivo — gap honesto já
// documentado no próprio cabeçalho de stage-runner.ts desde a rodada
// anterior. Fechado aqui: zero motor novo, zero segunda leitura — este
// módulo só recebe o StageTrace já real e o traduz num achado a mais.
import { STAGE_ORDER, type StageTrace } from './stage-runner';

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
  // ORDEM Nº 01: leitura real já resolvida por traceStages() (stage-
  // runner.ts) — null honesto quando o chamador ainda não tem uma (nunca
  // fabricado por este módulo; a mesma disciplina fail-closed do resto do
  // arquivo).
  stageTrace: StageTrace | null;
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

  // Achado de auditoria (Data Quality Monitor unificado): a versão anterior
  // desta checagem tratava qualquer `quality` truthy que não fosse
  // QUARENTENA/DEGRADADA como severidade OK — incluindo o literal
  // 'DADOS_INSUFICIENTES' que classifyScore() do Bus pode de fato emitir
  // (string truthy, não bate com os 2 casos checados). Um relatório de
  // autodiagnóstico reportando "tudo OK" para uma fonte SEM dado real era
  // o oposto do que a Ordem "Ciborgue Vivo" §3 pede. classifyBusQuality
  // (data-quality-vocabulary.ts, mesmo mapeador agora usado por
  // TelemetryHealthWidget) fecha essa lacuna por construção — mesmo
  // vocabulário de 4 estados em todo lugar que interpreta a classificação
  // do Bus, nunca uma segunda leitura divergente.
  const quality = input.dataQualityClassification;
  const qualityState = classifyBusQuality(quality);
  findings.push(
    qualityState === 'FAIL'
      ? { severity: 'CRITICAL', label: 'Qualidade da fonte', detail: `Data Quality Layer classificou a fonte como ${quality} — degradada demais para confiança normal.` }
      : qualityState === 'WARNING'
        ? { severity: 'WARN', label: 'Qualidade da fonte', detail: `Data Quality Layer classificou a fonte como ${quality}.` }
        : qualityState === 'OK'
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

  // EPC OMEGA FINAL Parte 3 §2 (auditoria real): input.health.memoryMb já
  // era medido pelo Health Monitor (performance.memory.usedJSHeapSize)
  // desde antes desta rodada, mas nunca virava um achado — a única leitura
  // de memória do relatório ficava invisível pro Operador. Severidade
  // sempre OK (nunca WARN/CRITICAL): este repositório não tem backtest de
  // orçamento de memória por dispositivo pra calibrar um limiar honesto
  // (mesma disciplina de "nunca fabricar um corte sem medição real" já
  // documentada em layer-relevance.ts) — o valor real é reportado, o
  // julgamento de "é muito" fica para uma calibração futura.
  findings.push(
    input.health.memoryMb !== null
      ? { severity: 'OK', label: 'Memória (heap JS)', detail: `${input.health.memoryMb.toFixed(0)}MB reais em uso (performance.memory.usedJSHeapSize) — sem limiar calibrado, número honesto sem julgamento de severidade.` }
      : { severity: 'OK', label: 'Memória (heap JS)', detail: 'Navegador não expõe performance.memory (comum no Firefox) — ausência de instrumentação, não uma falha real.' },
  );

  findings.push(
    input.health.workersAlive === 0
      ? { severity: 'CRITICAL', label: 'Worker WASM', detail: 'Nenhum Worker do Quant Engine vivo — cálculo pesado não tem onde rodar.' }
      : { severity: 'OK', label: 'Worker WASM', detail: `${input.health.workersAlive} worker(s) real(is) vivo(s).` },
  );

  // ORDEM Nº 01 (Autogovernança): a VISÃO ENCADEADA real do pipeline
  // causal — até onde DATA→CORE_ENGINE→COUNCIL→TRADE_PLAN→NEXUS_DECISION
  // chegou de verdade nesta leitura. Severidade nunca passa de WARN: a
  // causa raiz de qualquer estágio quebrado já vira CRITICAL em outro
  // achado acima (ex.: offline => Conectividade CRITICAL; engineStatus
  // error => Motor de análise CRITICAL) — repetir a mesma causa como um
  // segundo CRITICAL aqui seria alarme duplicado, não informação nova
  // (Ordem Nº 01: "nenhum [motor] deverá competir entre si"). O valor
  // real deste achado é mostrar a CADEIA, não redetectar a falha.
  if (input.stageTrace) {
    const { stages, reachedIndex } = input.stageTrace;
    const complete = reachedIndex === stages.length - 1;
    const firstBroken = stages.find((s) => !s.ok) ?? null;
    findings.push(
      complete
        ? { severity: 'OK', label: 'Pipeline causal', detail: `Cadeia completa: ${STAGE_ORDER.join(' → ')}.` }
        : {
            severity: 'WARN',
            label: 'Pipeline causal',
            detail: `Alcançou até ${reachedIndex >= 0 ? STAGE_ORDER[reachedIndex] : 'nenhum estágio'} — ${firstBroken?.reason ?? 'motivo não reportado'}.`,
          },
    );
  }

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
