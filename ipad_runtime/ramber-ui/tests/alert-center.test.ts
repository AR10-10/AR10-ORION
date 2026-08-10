// alert-center.test.ts — execução REAL do primeiro assinante do evento
// ORGANISM.TRACK_RECORD.UPDATED (v16.0 DEFINITIVO §9). Prova em especial o
// motivo de comparar por IDENTIDADE da última entrada em vez de
// comprimento do array: `history` é ring-capped, e um teste ingênuo por
// `.length` pararia de detectar transições reais depois que o teto fosse
// atingido — exatamente o bug que este desenho evita.
import { describe, it, expect } from 'vitest';
import { deriveTrackRecordAlert } from '../src/nexus/alert-center';
import { TRACK_RECORD_CONTRACT_VERSION, TRACK_RECORD_HISTORY_CAP, type TrackedPlan, type TrackRecordState } from '../src/nexus/signal-track-record';
import type { TradePlan } from '../src/nexus/trade-plan';

function makePlan(direction: 'LONG' | 'SHORT', entryLow: number, entryHigh: number, stopPrice: number, targetPrices: number[]): TradePlan {
  return {
    contractVersion: 2,
    direction,
    entry: { low: entryLow, high: entryHigh, basis: 'SR_SUPPORT_1' },
    stop: { price: stopPrice, basis: 'SR_SUPPORT_1' },
    targets: targetPrices.map((price) => ({ price, basis: 'SR_RESISTANCE_1' })),
    riskRewardRatios: targetPrices.map(() => 1),
    computedAt: 1_700_000_000_000,
  };
}

function makeTracked(status: TrackedPlan['status'], opts: Partial<TrackedPlan> = {}): TrackedPlan {
  return {
    plan: makePlan('LONG', 99, 101, 90, [110, 120]),
    openedAt: 1_700_000_000_000,
    status,
    resolvedAt: 1_700_000_500_000,
    resolvedPrice: 111,
    targetsHit: 1,
    breakEvenSuggested: false,
    ...opts,
  };
}

function makeRecord(history: TrackedPlan[]): TrackRecordState {
  return {
    contractVersion: TRACK_RECORD_CONTRACT_VERSION,
    active: null,
    history,
    targetHits: 0,
    partialHits: 0,
    stopHits: 0,
    replaced: 0,
  };
}

describe('alert-center: deriveTrackRecordAlert', () => {
  it('histórico vazio => null (nunca um alerta fabricado sem transição real)', () => {
    expect(deriveTrackRecordAlert(null, makeRecord([]))).toBeNull();
  });

  it('mesma última entrada (por referência) => null — nada novo aconteceu', () => {
    const entry = makeTracked('TARGET_HIT');
    const record = makeRecord([entry]);
    expect(deriveTrackRecordAlert(entry, record)).toBeNull();
  });

  it('TARGET_HIT => alerta success com direção/preço/contagem de alvos reais', () => {
    const entry = makeTracked('TARGET_HIT', { targetsHit: 2, resolvedPrice: 120.5 });
    const record = makeRecord([entry]);
    const alert = deriveTrackRecordAlert(null, record);
    expect(alert).not.toBeNull();
    expect(alert!.tone).toBe('success');
    expect(alert!.title).toBe('Alvo atingido');
    expect(alert!.message).toContain('LONG');
    expect(alert!.message).toContain('2/2');
    expect(alert!.message).toContain('120.50');
    expect(alert!.createdAt).toBe(1_700_000_500_000);
  });

  it('PARTIAL_HIT => alerta info, distingue de win/loss puro', () => {
    const entry = makeTracked('PARTIAL_HIT', { targetsHit: 1, resolvedPrice: 100 });
    const alert = deriveTrackRecordAlert(null, makeRecord([entry]));
    expect(alert!.tone).toBe('info');
    expect(alert!.title).toBe('Parcial validado');
    expect(alert!.message).toContain('1/2');
  });

  it('STOP_HIT => alerta danger, zero alvo provado', () => {
    const entry = makeTracked('STOP_HIT', { targetsHit: 0, resolvedPrice: 90 });
    const alert = deriveTrackRecordAlert(null, makeRecord([entry]));
    expect(alert!.tone).toBe('danger');
    expect(alert!.title).toBe('Stop atingido');
    expect(alert!.message).toContain('zero alvo real provado');
  });

  it('REPLACED como última entrada => null — leitura substituída não é resultado real (mesma exclusão de hitRate())', () => {
    const entry = makeTracked('REPLACED', { resolvedPrice: null });
    expect(deriveTrackRecordAlert(null, makeRecord([entry]))).toBeNull();
  });

  it('resolvedPrice null (defensivo) => mensagem honesta em vez de fabricar um preço', () => {
    const entry = makeTracked('STOP_HIT', { resolvedPrice: null });
    const alert = deriveTrackRecordAlert(null, makeRecord([entry]));
    expect(alert!.message).toContain('preço indisponível');
  });

  it('sequência real: 2ª chamada com o MESMO record não repete o alerta; uma NOVA resolução gera um novo', () => {
    const first = makeTracked('TARGET_HIT');
    const record1 = makeRecord([first]);
    const alert1 = deriveTrackRecordAlert(null, record1);
    expect(alert1).not.toBeNull();

    // watermark avança para `first` — mesma leitura de novo não deve repetir
    expect(deriveTrackRecordAlert(first, record1)).toBeNull();

    const second = makeTracked('STOP_HIT', { resolvedAt: 1_700_001_000_000, resolvedPrice: 90, targetsHit: 0 });
    const record2 = makeRecord([first, second]);
    const alert2 = deriveTrackRecordAlert(first, record2);
    expect(alert2).not.toBeNull();
    expect(alert2!.title).toBe('Stop atingido');
    expect(alert2!.id).not.toBe(alert1!.id);
  });

  it('regressão do teto do ring buffer: history.length parado no CAP ainda detecta a transição real (comparação por identidade, nunca por tamanho)', () => {
    const capped: TrackedPlan[] = Array.from({ length: TRACK_RECORD_HISTORY_CAP }, (_, i) =>
      makeTracked('REPLACED', { resolvedAt: 1_700_000_000_000 + i, resolvedPrice: null }),
    );
    const prevLast = capped[capped.length - 1];
    const record1 = makeRecord(capped);
    expect(record1.history.length).toBe(TRACK_RECORD_HISTORY_CAP);
    expect(deriveTrackRecordAlert(prevLast, record1)).toBeNull(); // nada novo ainda

    // Um push real além do teto: a mais antiga sai, uma nova entrada real entra —
    // o comprimento continua o MESMO (ring-capped), só a identidade da última muda.
    const pushed = [...capped.slice(1), makeTracked('TARGET_HIT', { resolvedAt: 1_700_009_999_999, resolvedPrice: 200, targetsHit: 2 })];
    const record2 = makeRecord(pushed);
    expect(record2.history.length).toBe(TRACK_RECORD_HISTORY_CAP); // mesmo tamanho do record1
    const alert = deriveTrackRecordAlert(prevLast, record2);
    expect(alert).not.toBeNull(); // mas a transição real foi detectada
    expect(alert!.title).toBe('Alvo atingido');
  });
});
