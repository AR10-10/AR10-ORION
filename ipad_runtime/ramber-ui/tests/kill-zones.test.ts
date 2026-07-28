// kill-zones.test.ts — Ferramentas Institucionais: execução real da
// derivação pura de ICT Kill Zones (janelas estreitas, NÃO uma partição
// contínua das 24h como market-session.ts — a maior parte do dia não tem
// nenhuma zona ativa, e duas zonas podem se sobrepor de propósito).
import { describe, it, expect } from 'vitest';
import { activeKillZones, nextKillZone, computeKillZoneSpans, KILL_ZONES, KILL_ZONE_CONTRACT_VERSION } from '../src/nexus/kill-zones';

const at = (hourUtc: number, minute = 0, second = 0) => new Date(Date.UTC(2026, 6, 14, hourUtc, minute, second));
const candleAt = (hourUtc: number, dayOffset = 0) => ({ time: at(hourUtc).getTime() / 1000 + dayOffset * 86400 });

describe('activeKillZones: janelas ESTREITAS, nunca uma partição de 24h', () => {
  it('00:00 => Ásia ativa (borda inicial inclusiva)', () => {
    expect(activeKillZones(at(0))?.active.map((z) => z.id)).toEqual(['ASIA']);
  });

  it('03:59 ainda Ásia; 04:00 já NENHUMA zona (borda final exclusiva)', () => {
    expect(activeKillZones(at(3, 59))?.active.map((z) => z.id)).toEqual(['ASIA']);
    expect(activeKillZones(at(4))?.active).toEqual([]);
  });

  it('hiato real entre Ásia e Londres (04:00–06:59): honestamente ZERO zonas ativas', () => {
    expect(activeKillZones(at(5))?.active).toEqual([]);
    expect(activeKillZones(at(6, 59))?.active).toEqual([]);
  });

  it('07:00 => Londres ativa; 10:00 encerra (hiato até Nova York às 12:00)', () => {
    expect(activeKillZones(at(7))?.active.map((z) => z.id)).toEqual(['LONDRES']);
    expect(activeKillZones(at(9, 59))?.active.map((z) => z.id)).toEqual(['LONDRES']);
    expect(activeKillZones(at(10))?.active).toEqual([]);
    expect(activeKillZones(at(11))?.active).toEqual([]);
  });

  it('12:00 => só Nova York; 14:00–14:59 => Nova York E Fechamento de Londres SOBREPOSTAS (nunca deduplicadas)', () => {
    expect(activeKillZones(at(12))?.active.map((z) => z.id)).toEqual(['NOVA_YORK']);
    expect(activeKillZones(at(13, 30))?.active.map((z) => z.id)).toEqual(['NOVA_YORK']);
    expect(activeKillZones(at(14))?.active.map((z) => z.id)).toEqual(['NOVA_YORK', 'LONDRES_CLOSE']);
    expect(activeKillZones(at(14, 59))?.active.map((z) => z.id)).toEqual(['NOVA_YORK', 'LONDRES_CLOSE']);
  });

  it('15:00 => Nova York encerrou, só Fechamento de Londres ativa; 16:00 => nenhuma', () => {
    expect(activeKillZones(at(15))?.active.map((z) => z.id)).toEqual(['LONDRES_CLOSE']);
    expect(activeKillZones(at(16))?.active).toEqual([]);
  });

  it('16:00–23:59: o maior hiato do dia, honestamente sem nenhuma kill zone (prova que isto NÃO é uma partição de 24h como market-session.ts)', () => {
    for (const h of [16, 18, 20, 22, 23]) {
      expect(activeKillZones(at(h))?.active, `hora ${h}`).toEqual([]);
    }
  });

  it('Date inválida => null honesto, nunca uma leitura fabricada', () => {
    expect(activeKillZones(new Date(NaN))).toBeNull();
  });

  it('contrato versionado presente em toda leitura real', () => {
    expect(activeKillZones(at(8))?.contractVersion).toBe(KILL_ZONE_CONTRACT_VERSION);
  });

  it('KILL_ZONES está em ordem cronológica real (garante a ordem de saída de active/nextKillZone)', () => {
    const starts = KILL_ZONES.map((z) => z.startHour);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
});

describe('nextKillZone: a próxima janela a abrir, nunca a que já está ativa', () => {
  it('05:00 (hiato real) => próxima é Londres em 2h', () => {
    const r = nextKillZone(at(5));
    expect(r?.window.id).toBe('LONDRES');
    expect(r?.hoursUntil).toBe(2);
  });

  it('02:30 (hiato fracionário) => próxima é Londres em 4.5h', () => {
    const r = nextKillZone(at(2, 30));
    expect(r?.window.id).toBe('LONDRES');
    expect(r?.hoursUntil).toBeCloseTo(4.5, 10);
  });

  it('00:00:00 exato (Ásia ACABOU de abrir) => próxima é Londres em 7h, nunca a própria Ásia já ativa', () => {
    const r = nextKillZone(at(0));
    expect(r?.window.id).toBe('LONDRES');
    expect(r?.hoursUntil).toBe(7);
  });

  it('13:00 (dentro de Nova York) => próxima é o Fechamento de Londres em 1h, mesmo com Nova York ainda ativa (overlap real)', () => {
    const r = nextKillZone(at(13));
    expect(r?.window.id).toBe('LONDRES_CLOSE');
    expect(r?.hoursUntil).toBe(1);
  });

  it('20:00 (todas as zonas de hoje já passaram) => avança pro dia seguinte, Ásia em 4h', () => {
    const r = nextKillZone(at(20));
    expect(r?.window.id).toBe('ASIA');
    expect(r?.hoursUntil).toBe(4);
  });

  it('16:00 (Fechamento de Londres ACABOU de encerrar) => avança pro dia seguinte, Ásia em 8h', () => {
    const r = nextKillZone(at(16));
    expect(r?.window.id).toBe('ASIA');
    expect(r?.hoursUntil).toBe(8);
  });

  it('Date inválida => null honesto', () => {
    expect(nextKillZone(new Date(NaN))).toBeNull();
  });
});

describe('computeKillZoneSpans: uma ocorrência real CONTÍGUA por zona, nunca uma partição de 24h e nunca mesclando dias diferentes', () => {
  it('entrada vazia devolve [] honesto', () => {
    expect(computeKillZoneSpans([])).toEqual([]);
  });

  it('candles inteiramente dentro de uma zona real (Ásia 00h-03h) => 1 span cobrindo o primeiro e o último candle real', () => {
    const candles = [candleAt(0), candleAt(1), candleAt(2), candleAt(3)];
    const spans = computeKillZoneSpans(candles);
    expect(spans).toHaveLength(1);
    expect(spans[0].id).toBe('ASIA');
    expect(spans[0].startTime).toBe(candles[0].time);
    expect(spans[0].endTime).toBe(candles[3].time);
  });

  it('candles num hiato real (05h-06h, sem zona nenhuma) => [] honesto, nunca um span fabricado', () => {
    expect(computeKillZoneSpans([candleAt(5), candleAt(6)])).toEqual([]);
  });

  it('overlap real Nova York × Fechamento de Londres (12h-16h): 2 spans concorrentes reais, nunca mesclados num só', () => {
    // 12,13,14 => NOVA_YORK ativa; 14,15 => LONDRES_CLOSE ativa (overlap real em 14h);
    // candle-grid horária resolve o fim de NOVA_YORK no último candle onde apareceu (14h).
    const candles = [candleAt(12), candleAt(13), candleAt(14), candleAt(15), candleAt(16)];
    const spans = computeKillZoneSpans(candles);
    expect(spans).toHaveLength(2);
    const ny = spans.find((s) => s.id === 'NOVA_YORK');
    const lc = spans.find((s) => s.id === 'LONDRES_CLOSE');
    expect(ny?.startTime).toBe(candleAt(12).time);
    expect(ny?.endTime).toBe(candleAt(14).time);
    expect(lc?.startTime).toBe(candleAt(14).time);
    expect(lc?.endTime).toBe(candleAt(15).time);
  });

  it('a MESMA zona em dias diferentes vira 2 spans reais separados, nunca um span gigante mesclando os dois dias', () => {
    // Série horária REAL (sem pulos artificiais): Ásia hoje, hiato real de
    // verdade (hora 5, sem zona nenhuma — mesmo espírito das grades
    // horárias reais que o app carrega), Ásia amanhã de novo.
    const candles = [candleAt(0), candleAt(1), candleAt(5), candleAt(0, 1), candleAt(1, 1)];
    const spans = computeKillZoneSpans(candles);
    expect(spans).toHaveLength(2);
    expect(spans.every((s) => s.id === 'ASIA')).toBe(true);
    expect(spans[0].endTime).toBeLessThan(spans[1].startTime); // dia 1 termina antes do dia 2 começar
  });

  it('zona ainda ATIVA no último candle real da série é fechada honestamente no fim da varredura (nunca perdida)', () => {
    const candles = [candleAt(0), candleAt(1)]; // série termina DENTRO da Ásia, nunca chega a fechar "naturalmente"
    const spans = computeKillZoneSpans(candles);
    expect(spans).toHaveLength(1);
    expect(spans[0].id).toBe('ASIA');
    expect(spans[0].endTime).toBe(candleAt(1).time);
  });
});
