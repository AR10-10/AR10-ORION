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

  // 6. Ordem "Ciborgue Vivo" §2: rompimento REAL de estrutura (BOS/CHOCH,
  // bos-choch-engine.js) — a chave (tipo+índice) muda só quando um
  // rompimento NOVO acontece; o mesmo evento ainda vivo na tela (mesma
  // chave) nunca repete o alerta. CHOCH é o evento mais significativo
  // (primeiro sinal real de possível reversão); BOS é confirmatório
  // (continuação já esperada), mesma graduação de severidade do resto
  // deste arquivo (CRITICAL/ALERT para o inesperado, INFO para a
  // confirmação).
  if (next.structureBreakKey && next.structureBreakKey !== prev.structureBreakKey) {
    const dir = next.structureBreakDirection === 'ALTA' ? 'de alta' : 'de baixa';
    if (next.structureBreakType === 'CHOCH') {
      alerts.push({ text: `Mudança de caráter ${dir}. Estrutura pode estar revertendo.`, priority: 'ALERT' });
    } else {
      alerts.push({ text: `Rompimento de estrutura ${dir} confirma continuação.`, priority: 'INFO' });
    }
  }

  // 7. Neural Market Aura ("Comunicação por Voz"): ciclo de vida REAL do
  // Trade Plan (nexus/trade-plan.ts + signal-track-record.ts) — mesma
  // regra anti-ruído de chave-muda-uma-vez-por-evento do item 6 acima.
  if (next.tradePlanOpenKey && next.tradePlanOpenKey !== prev.tradePlanOpenKey) {
    alerts.push({
      text: `Entrada ${next.tradePlanDirection === 'LONG' ? 'de compra' : 'de venda'} identificada pelo Trade Plan real.`,
      priority: 'INFO',
    });
  }
  if (!prev.inEntryZone && next.inEntryZone) {
    alerts.push({ text: 'Preço real na região ideal de entrada do plano ativo.', priority: 'INFO' });
  }
  // v2 (Diretriz Complementar §2/§4): progresso real de alvo ENQUANTO o
  // plano continua aberto — evento distinto da resolução final abaixo,
  // dispara uma vez por alvo real adicional provado ("Alvo 1 alcançado",
  // "Alvo 2 alcançado"...), nunca na abertura do plano (targetsHit=0 aí).
  if (next.tradePlanTargetProgressKey && next.tradePlanTargetProgressKey !== prev.tradePlanTargetProgressKey && next.tradePlanTargetsHit > 0) {
    alerts.push({
      text: `Alvo ${next.tradePlanTargetsHit} do Trade Plan alcançado. Stop movido para break-even.`,
      priority: 'ALERT',
    });
  }
  if (next.tradePlanResolutionKey && next.tradePlanResolutionKey !== prev.tradePlanResolutionKey) {
    if (next.tradePlanResolutionStatus === 'TARGET_HIT') {
      alerts.push({ text: 'Alvo real do Trade Plan alcançado.', priority: 'ALERT' });
    } else if (next.tradePlanResolutionStatus === 'PARTIAL_HIT') {
      alerts.push({ text: 'Plano encerrado em break-even após alcançar pelo menos um alvo real.', priority: 'INFO' });
    } else if (next.tradePlanResolutionStatus === 'STOP_HIT') {
      alerts.push({ text: 'Stop real atingido. Estrutura do plano perdida.', priority: 'ALERT' });
    } else if (next.tradePlanResolutionStatus === 'REPLACED') {
      alerts.push({ text: 'Plano substituído por uma leitura de estrutura mais recente.', priority: 'INFO' });
    }
  }
  // Convicção real caindo (Confluence Engine) — só entre duas leituras
  // reais (nunca a partir de null/sem-leitura, que não é "reduzida", é
  // "indisponível"). CONFIRMS > MIXED > CONTRADICTS.
  const verdictRank: Record<'CONFIRMS' | 'MIXED' | 'CONTRADICTS', number> = { CONFIRMS: 2, MIXED: 1, CONTRADICTS: 0 };
  if (
    prev.convictionVerdict && next.convictionVerdict &&
    verdictRank[next.convictionVerdict] < verdictRank[prev.convictionVerdict]
  ) {
    alerts.push({ text: 'Convicção real reduzida entre os subsistemas de confluência.', priority: 'ALERT' });
  }

  return alerts;
}
