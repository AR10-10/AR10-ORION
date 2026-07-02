// voice-intents.ts — IRON-VOICE camada 3: assistente conversacional.
//
// FUNÇÕES PURAS, testáveis em node sem navegador. A resposta é construída
// EXCLUSIVAMENTE a partir do TerminalSnapshot — um espelho somente-leitura
// dos campos reais que o App já computa (motor WASM, k-NN Lorentziano,
// order flow MEXC, liquidações Binance). Campo ausente vira "aguardando";
// nunca um número inventado. Nenhum intent dispara ordem: este terminal é
// READ_ONLY/FAIL_CLOSED por projeto e o vocabulário aqui reflete isso.

export interface TerminalSnapshot {
  // Motor WASM real (trade-setup-matrix / target-tracker)
  direction: 'LONG' | 'SHORT' | null;
  confidence: string | null;
  marketStructure: string | null;
  entry: number | null;
  target: number | null;
  stop: number | null;
  support: number | null;
  resistance: number | null;
  rationale: string | null;
  engineStatus: 'ok' | 'error' | 'pending';
  engineReason: string | null;
  // Classificador k-NN Lorentziano (sinal independente)
  lorentzianOk: boolean;
  lorentzianClassification: string | null;
  lorentzianConfidence: number | null; // 0..1
  lorentzianSampleSize: number | null;
  // Fluxo real
  lastPrice: number | null;
  cvd: number | null;
  recentOrderflowTypes: string[]; // ex.: ['ABSORPTION','EXHAUSTION']
  orderflowState: string; // 'LIVE' | 'ERROR' | 'pending'
  recentLiquidationCount: number;
  liquidationState: string;
  wsLive: boolean;
  // Previsão multi-horizonte real (k-NN re-rotulado por horizonte).
  forecast: Array<{
    horizonBars: number;
    ok: boolean;
    classification?: string;
    confidence?: number; // 0..1
    sampleSize?: number;
  }>;
}

export type VoiceIntent =
  | 'TREND'
  | 'REASON'
  | 'CONFIDENCE'
  | 'RISK'
  | 'ABSORPTION'
  | 'REFRESH'
  | 'CONSENSUS'
  | 'DIAGNOSTICS'
  | 'PRICE'
  | 'PREDICTION'
  | 'UNKNOWN';

const AWAITING = 'aguardando dados reais';

// Ordem importa: padrões mais específicos primeiro. Tudo minúsculo e sem
// acento para casar com qualquer variação do reconhecedor.
const INTENT_PATTERNS: Array<[VoiceIntent, RegExp]> = [
  ['PREDICTION', /previs[aã]o|prever|proje[cç][aã]o|horizonte|futuro/],
  ['ABSORPTION', /absor[cç][aã]o|institucional/],
  ['CONSENSUS', /consenso|validar|diverg/],
  ['DIAGNOSTICS', /diagn[oó]stico|auditoria|status do sistema|sa[uú]de/],
  ['REFRESH', /atualizar|refresh|recarregar|nova leitura/],
  ['CONFIDENCE', /confian[cç]a|probabilidade/],
  ['REASON', /motivo|por que|porque|explique|racional/],
  ['RISK', /risco|stop|invalida/],
  ['PRICE', /pre[cç]o|cota[cç][aã]o|quanto (est[aá]|custa)/],
  ['TREND', /tend[eê]ncia|dire[cç][aã]o|vetor|long ou short|cen[aá]rio/],
];

const stripAccents = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function matchIntent(transcript: string): VoiceIntent {
  const t = transcript.toLowerCase().trim();
  for (const [intent, pattern] of INTENT_PATTERNS) {
    // Testa com e sem acentos — reconhecedores oscilam entre os dois.
    if (pattern.test(t) || pattern.test(stripAccents(t))) return intent;
  }
  return 'UNKNOWN';
}

const fmt = (v: number | null): string =>
  v === null || !Number.isFinite(v) ? AWAITING : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** Resposta institucional curta, só com dados reais do snapshot. */
export function buildResponse(intent: VoiceIntent, s: TerminalSnapshot): string {
  switch (intent) {
    case 'TREND': {
      if (s.engineStatus !== 'ok') return `Motor real ${s.engineStatus === 'pending' ? 'inicializando' : 'em falha'}. Vetor ${AWAITING}.`;
      if (!s.direction) return `Sem confirmação direcional. Estrutura ${s.marketStructure ?? AWAITING}. Suporte ${fmt(s.support)}. Resistência ${fmt(s.resistance)}.`;
      return `Vetor ${s.direction} confirmado. Estrutura ${s.marketStructure ?? AWAITING}. Alvo ${fmt(s.target)}. Stop ${fmt(s.stop)}.`;
    }
    case 'REASON': {
      if (s.rationale) return s.rationale;
      return `Racional ${AWAITING} — o motor ainda não emitiu uma justificativa para este ciclo.`;
    }
    case 'CONFIDENCE': {
      const wasm = s.confidence ? `Confiança do motor: ${s.confidence}.` : `Confiança do motor ${AWAITING}.`;
      const knn = s.lorentzianOk && s.lorentzianConfidence !== null && s.lorentzianSampleSize !== null
        ? ` Classificador Lorentziano: ${s.lorentzianClassification} com ${Math.round(s.lorentzianConfidence * 100)} por cento, amostra de ${s.lorentzianSampleSize} pontos.`
        : '';
      return wasm + knn;
    }
    case 'RISK': {
      const stopPart = s.stop !== null ? `Invalidação estrutural em ${fmt(s.stop)}.` : `Invalidação ${AWAITING}.`;
      const liqPart = s.recentLiquidationCount > 0
        ? ` ${s.recentLiquidationCount} liquidação${s.recentLiquidationCount > 1 ? 'ões' : ''} institucional${s.recentLiquidationCount > 1 ? 'is' : ''} recentes no feed real.`
        : '';
      return stopPart + liqPart;
    }
    case 'ABSORPTION': {
      const has = s.recentOrderflowTypes.some((t) => /ABSOR/i.test(t));
      if (s.orderflowState !== 'LIVE') return `Feed de order flow ${s.orderflowState === 'pending' ? 'conectando' : 'indisponível'} — leitura de absorção ${AWAITING}.`;
      if (has) return `Sim. Absorção detectada no fluxo real recente. CVD da sessão: ${fmt(s.cvd)}.`;
      return `Sem absorção institucional no fluxo real recente. CVD da sessão: ${fmt(s.cvd)}.`;
    }
    case 'CONSENSUS': {
      if (!s.direction || !s.lorentzianOk || !s.lorentzianClassification) {
        return `Consenso incompleto: ${!s.direction ? 'motor sem sinal' : 'classificador sem amostra suficiente'}.`;
      }
      const agree = s.direction === s.lorentzianClassification;
      return agree
        ? `Consenso validado: motor e classificador Lorentziano apontam ${s.direction}.`
        : `Divergência real: motor ${s.direction}, classificador ${s.lorentzianClassification}. Cautela.`;
    }
    case 'DIAGNOSTICS': {
      const parts = [
        `Preço ${s.wsLive ? 'ao vivo' : 'sem stream'}`,
        `motor ${s.engineStatus === 'ok' ? 'conectado' : s.engineStatus === 'pending' ? 'inicializando' : 'em falha'}`,
        `order flow ${s.orderflowState === 'LIVE' ? 'ao vivo' : s.orderflowState.toLowerCase()}`,
        `liquidações ${s.liquidationState === 'LIVE' ? 'ao vivo' : s.liquidationState.toLowerCase()}`,
      ];
      return `Diagnóstico: ${parts.join(', ')}. Modo somente leitura, sem ordens, sem chaves.`;
    }
    case 'PREDICTION': {
      const valid = s.forecast.filter((f) => f.ok && f.classification);
      if (!valid.length) return `Previsão multi-horizonte ${AWAITING} — amostra real insuficiente nos horizontes.`;
      const parts = valid.map((f) => {
        const pct = f.confidence !== undefined ? `${Math.round(f.confidence * 100)} por cento` : 'confiança indefinida';
        return `${f.horizonBars} velas: ${f.classification} com ${pct}`;
      });
      const smallest = Math.min(...valid.map((f) => f.sampleSize ?? 0));
      return `Previsão estatística real por horizonte: ${parts.join('; ')}. Amostra mínima ${smallest} pontos — leitura probabilística, não garantia.`;
    }
    case 'PRICE':
      return s.lastPrice !== null ? `BTC a ${fmt(s.lastPrice)} dólares.` : `Preço ${AWAITING}.`;
    case 'REFRESH':
      return 'Reinicializando ciclos de leitura real.';
    case 'UNKNOWN':
      return 'Comando não reconhecido. Pergunte por tendência, previsão, confiança, risco, absorção, consenso, preço ou diagnóstico.';
  }
}
