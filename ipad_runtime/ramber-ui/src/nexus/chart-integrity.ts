// chart-integrity.ts — ADITIVO V-MAX Etapa 17 (Chart Integrity Engine),
// achado real de auditoria: "nada bloqueia/avisa em desync entre o
// snapshot analisado e o que está na tela". O ciclo real
// (runRealAnalysisCycle, engine-bridge.ts) já evita a pior forma deste
// bug via o padrão `cancelled` do próprio efeito em App.tsx — trocar de
// símbolo/timeframe descarta o resultado de um ciclo antigo antes de
// aplicá-lo. O que faltava era uma camada INDEPENDENTE que verificasse e
// EXPUSESSE isso como um invariante ativo: hoje, se um refactor futuro
// remover ou quebrar o `cancelled`, nada avisaria o Operador. Função
// pura sobre campos que RealCycleResult/App.tsx já carregam — zero
// segunda coleta, zero segunda fonte de verdade.
import { TIMEFRAME_MS } from './aura-lifecycle';

export type ChartIntegrityStatus = 'SYNCED' | 'SYMBOL_MISMATCH' | 'STALE_DATA' | 'DADOS_INSUFICIENTES';

export interface ChartIntegrityReading {
  status: ChartIntegrityStatus;
  reason: string | null;
  candleAgeMs: number | null;
  maxAgeMs: number | null;
}

// Um candle "atrasado" de verdade é o feed parado — não o candle mais
// recente ainda em formação (idade normal e esperada de até ~1 intervalo
// do próprio timeframe). O limiar precisa ser MÚLTIPLO do intervalo real
// do timeframe selecionado (mesma fonte TIMEFRAME_MS já usada por
// aura-lifecycle.ts), nunca um número fixo em ms que só faria sentido
// para 1 prazo entre os 14 aceitos.
const STALE_MULTIPLIER = 3;

interface ChartIntegrityInput {
  selectedSymbol: string | null;
  selectedTimeframe: string | null;
  cycleSymbol: string | null;
  cycleTimeframe: string | null;
  candleAgeMs: number | null;
}

/** Compara o que está selecionado agora contra o que o último ciclo real
 *  do Core Engine de fato analisou. Nunca bloqueia nada (Regra de Ouro 4)
 *  — só produz uma leitura honesta para a UI exibir. */
export function computeChartIntegrity({
  selectedSymbol,
  selectedTimeframe,
  cycleSymbol,
  cycleTimeframe,
  candleAgeMs,
}: ChartIntegrityInput): ChartIntegrityReading {
  if (!selectedSymbol || !selectedTimeframe || !cycleSymbol || !cycleTimeframe) {
    return { status: 'DADOS_INSUFICIENTES', reason: 'sem_ciclo_real_ainda', candleAgeMs: null, maxAgeMs: null };
  }

  if (selectedSymbol !== cycleSymbol || selectedTimeframe !== cycleTimeframe) {
    return {
      status: 'SYMBOL_MISMATCH',
      reason: `selecionado_${selectedSymbol}:${selectedTimeframe}_mas_ultimo_ciclo_real_e_de_${cycleSymbol}:${cycleTimeframe}`,
      candleAgeMs: null,
      maxAgeMs: null,
    };
  }

  const barMs = TIMEFRAME_MS[selectedTimeframe] ?? null;
  if (barMs === null || typeof candleAgeMs !== 'number' || !Number.isFinite(candleAgeMs)) {
    return { status: 'DADOS_INSUFICIENTES', reason: 'timeframe_ou_idade_do_candle_desconhecidos', candleAgeMs: candleAgeMs ?? null, maxAgeMs: null };
  }

  const maxAgeMs = barMs * STALE_MULTIPLIER;
  if (candleAgeMs > maxAgeMs) {
    return {
      status: 'STALE_DATA',
      reason: `ultimo_candle_com_${Math.round(candleAgeMs / 1000)}s_de_idade_acima_do_limiar_de_${STALE_MULTIPLIER}x_o_intervalo_do_timeframe`,
      candleAgeMs,
      maxAgeMs,
    };
  }

  return { status: 'SYNCED', reason: null, candleAgeMs, maxAgeMs };
}
