// organism-health.ts — ADITIVO V-MAX Etapa 19 ("Organism Health: widget
// persistente"): veredito agregado LEVE e SEMPRE VISÍVEL, zero segunda
// medição. `self-diagnostics.ts` continua sendo o relatório PROFUNDO sob
// demanda (10 achados com texto, só ao clicar) — este módulo não o
// substitui nem duplica seu cálculo; é uma segunda SÍNTESE do MESMO tipo
// de sinais reais, granularidade oposta (1 veredito sempre no ar, em vez
// de uma lista sob clique). As entradas já são os rótulos de classificação
// que TelemetryHealthWidget calcula linha a linha (QUALIDADE DA FONTE,
// SUFICIÊNCIA, GMIL, INTEGRIDADE DO GRÁFICO, FPS, LATÊNCIA DO CICLO) mais
// offline/workersAlive do Health Monitor — nenhum valor bruto é lido de
// novo aqui.
//
// AGUARDANDO nunca é mascarado como OK nem como CRITICAL: ausência real
// de medição (DADOS_INSUFICIENTES/null, mesmo vocabulário do resto da
// base) é seu próprio degrau de honestidade — pior que um sinal
// positivamente OK (não dá pra confirmar que está tudo bem), melhor que
// um WARN/CRITICAL positivamente confirmado (Regra de Ouro 3: nunca
// fabricar uma leitura neutra/boa quando falta dado real).
import type { DataQualityLabel } from './data-quality-vocabulary';

export type OrganismHealthVerdict = 'OK' | 'WARN' | 'CRITICAL' | 'AGUARDANDO';

const VERDICT_RANK: Record<OrganismHealthVerdict, number> = {
  OK: 0,
  AGUARDANDO: 1,
  WARN: 2,
  CRITICAL: 3,
};

function fromDataQuality(label: DataQualityLabel): OrganismHealthVerdict {
  switch (label) {
    case 'OK':
      return 'OK';
    case 'WARNING':
      return 'WARN';
    case 'FAIL':
      return 'CRITICAL';
    default:
      return 'AGUARDANDO';
  }
}

function fromFpsClass(fpsClass: 'FLUIDO' | 'ACEITAVEL' | 'CRITICO' | null): OrganismHealthVerdict {
  if (fpsClass === 'FLUIDO') return 'OK';
  if (fpsClass === 'ACEITAVEL') return 'WARN';
  if (fpsClass === 'CRITICO') return 'CRITICAL';
  return 'AGUARDANDO';
}

function fromCycleClass(cycleClass: 'RAPIDO' | 'OK' | 'LENTO' | null): OrganismHealthVerdict {
  if (cycleClass === 'RAPIDO' || cycleClass === 'OK') return 'OK';
  if (cycleClass === 'LENTO') return 'WARN';
  return 'AGUARDANDO';
}

export interface OrganismHealthInput {
  offline: boolean;
  workersAlive: number;
  busQuality: DataQualityLabel;
  sufficiencyQuality: DataQualityLabel;
  gmilQuality: DataQualityLabel;
  chartIntegrityQuality: DataQualityLabel;
  fpsClass: 'FLUIDO' | 'ACEITAVEL' | 'CRITICO' | null;
  cycleClass: 'RAPIDO' | 'OK' | 'LENTO' | null;
}

export interface OrganismHealthReading {
  verdict: OrganismHealthVerdict;
  // Rótulo do sinal real responsável pelo veredito — nunca uma caixa
  // preta, mesmo princípio de `firstBroken` em self-diagnostics.ts
  // (Pipeline causal) e de `chart-integrity.ts` (reason por status).
  worstSignal: string;
}

/** Reduz os mesmos sinais reais já classificados linha a linha para 1
 *  veredito — a MESMA disciplina "pior sinal real vence" de self-
 *  diagnostics.ts (worse()/overallSeverity), com um 4º degrau
 *  (AGUARDANDO) que o relatório profundo não precisa ter porque cada
 *  achado dele já é reportado separadamente por sinal. */
export function computeOrganismHealth(input: OrganismHealthInput): OrganismHealthReading {
  const signals: Array<[string, OrganismHealthVerdict]> = [
    ['Conectividade', input.offline ? 'CRITICAL' : 'OK'],
    ['Worker WASM', input.workersAlive === 0 ? 'CRITICAL' : 'OK'],
    ['Integridade do gráfico', fromDataQuality(input.chartIntegrityQuality)],
    ['Qualidade da fonte', fromDataQuality(input.busQuality)],
    ['Suficiência de dados', fromDataQuality(input.sufficiencyQuality)],
    ['GMIL', fromDataQuality(input.gmilQuality)],
    ['FPS', fromFpsClass(input.fpsClass)],
    ['Latência do ciclo', fromCycleClass(input.cycleClass)],
  ];

  let worst = signals[0];
  for (const signal of signals) {
    if (VERDICT_RANK[signal[1]] > VERDICT_RANK[worst[1]]) worst = signal;
  }
  return { verdict: worst[1], worstSignal: worst[0] };
}
