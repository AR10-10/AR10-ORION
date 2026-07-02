// voice-dispatcher.ts — IRON-VOICE camada 4: alertas executivos event-driven.
//
// FUNÇÃO PURA de decisão: compara o snapshot anterior com o atual e devolve
// os alertas que uma TRANSIÇÃO REAL de estado justifica. Quem chama (um
// useEffect no App) entrega o resultado à fila do voice-engine. Nada aqui
// consulta rede, DOM ou timers — por isso é testável em node e incapaz de
// bloquear renderização, WebGPU ou WebSocket (exigência do protocolo).
//
// Regra anti-ruído: um alerta por transição, nunca por repetição do mesmo
// estado — a comparação com o snapshot anterior é o que impede a voz de
// repetir "vetor long confirmado" a cada ciclo de 60s.

import type { TerminalSnapshot } from './voice-intents';
import type { VoicePriority } from './voice-engine';

export interface VoiceAlert {
  text: string;
  priority: VoicePriority;
}

export function computeAlerts(
  prev: TerminalSnapshot | null,
  next: TerminalSnapshot,
): VoiceAlert[] {
  const alerts: VoiceAlert[] = [];
  if (!prev) return alerts; // primeiro snapshot: sem histórico, sem alerta

  // 1. Mudança de vetor confirmada pelo motor real (o evento mais relevante).
  if (next.direction && next.direction !== prev.direction) {
    alerts.push({
      text: `Atenção. Vetor ${next.direction === 'LONG' ? 'de alta' : 'de baixa'} confirmado pelo motor real.`,
      priority: 'CRITICAL',
    });
  } else if (!next.direction && prev.direction) {
    alerts.push({
      text: 'Vetor invalidado. Sistema de volta a aguardar confirmação.',
      priority: 'ALERT',
    });
  }

  // 2. Divergência REAL surgindo entre motor e classificador independente.
  const nextDiverges =
    next.direction && next.lorentzianOk && next.lorentzianClassification &&
    next.lorentzianClassification !== 'NEUTRAL' &&
    next.direction !== next.lorentzianClassification;
  const prevDiverges =
    prev.direction && prev.lorentzianOk && prev.lorentzianClassification &&
    prev.lorentzianClassification !== 'NEUTRAL' &&
    prev.direction !== prev.lorentzianClassification;
  if (nextDiverges && !prevDiverges) {
    alerts.push({
      text: 'Divergência entre motor e classificador Lorentziano. Cautela.',
      priority: 'ALERT',
    });
  }

  // 3. Liquidações institucionais novas no feed real (forceOrder Binance).
  if (next.recentLiquidationCount > prev.recentLiquidationCount) {
    alerts.push({
      text: 'Liquidez institucional detectada. Liquidação relevante no feed real.',
      priority: 'ALERT',
    });
  }

  // 4. Absorção surgindo no fluxo real (sinal do motor de order flow).
  const hadAbsorption = prev.recentOrderflowTypes.some((t) => /ABSOR/i.test(t));
  const hasAbsorption = next.recentOrderflowTypes.some((t) => /ABSOR/i.test(t));
  if (hasAbsorption && !hadAbsorption) {
    alerts.push({ text: 'Absorção institucional detectada no fluxo real.', priority: 'ALERT' });
  }

  // 5. Saúde do sistema — perda e recuperação do motor real.
  if (next.engineStatus === 'error' && prev.engineStatus === 'ok') {
    alerts.push({ text: 'Falha no motor de análise. Verifique o diagnóstico.', priority: 'CRITICAL' });
  } else if (next.engineStatus === 'ok' && prev.engineStatus !== 'ok') {
    alerts.push({ text: 'Motor de análise operacional.', priority: 'INFO' });
  }

  return alerts;
}
