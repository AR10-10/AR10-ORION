// a11y-live-announcements.test.ts — execução real do módulo puro que
// decide o texto de uma região aria-live (mudança de direção do Núcleo /
// estado LIVE-OFF da conexão). Achado de auditoria desta rodada: zero
// aria-live em toda a base — o dado mais crítico da tela (LONG/SHORT/
// AWAITING, LIVE/OFF) nunca era anunciado pra quem usa leitor de tela.
import { describe, it, expect } from 'vitest';
import { buildLiveAnnouncement, type LiveAnnouncementState } from '../src/nexus/a11y-live-announcements';

const state = (direction: LiveAnnouncementState['direction'], wsLive: boolean): LiveAnnouncementState => ({
  direction,
  wsLive,
});

describe('buildLiveAnnouncement — fail-closed, nunca anuncia o que não mudou de verdade', () => {
  it('previous null (boot) nunca anuncia — não é uma transição real', () => {
    expect(buildLiveAnnouncement(null, state('LONG', true))).toBeNull();
    expect(buildLiveAnnouncement(null, state(null, false))).toBeNull();
  });

  it('nada mudou entre previous e current → null, mesmo com previous real', () => {
    const s = state('LONG', true);
    expect(buildLiveAnnouncement(s, state('LONG', true))).toBeNull();
  });

  it('direção AWAITING → LONG anuncia "Núcleo: LONG"', () => {
    expect(buildLiveAnnouncement(state(null, true), state('LONG', true))).toBe('Núcleo: LONG');
  });

  it('direção LONG → SHORT anuncia "Núcleo: SHORT" (nunca fica em silêncio numa reversão real)', () => {
    expect(buildLiveAnnouncement(state('LONG', true), state('SHORT', true))).toBe('Núcleo: SHORT');
  });

  it('direção LONG → null (WAIT real ou suprimido por LEI 24) anuncia "Núcleo: AWAITING" — nunca uma palavra nova', () => {
    expect(buildLiveAnnouncement(state('LONG', true), state(null, true))).toBe('Núcleo: AWAITING');
  });

  it('conexão LIVE → OFF anuncia perda + instrução de reconexão', () => {
    expect(buildLiveAnnouncement(state('LONG', true), state('LONG', false))).toBe('Conexão: OFF, reconectando');
  });

  it('conexão OFF → LIVE anuncia restabelecimento', () => {
    expect(buildLiveAnnouncement(state('LONG', false), state('LONG', true))).toBe('Conexão: LIVE');
  });

  it('as duas mudam na mesma atualização → as duas entram no mesmo anúncio, nenhuma se perde', () => {
    const text = buildLiveAnnouncement(state(null, false), state('SHORT', true));
    expect(text).toBe('Conexão: LIVE. Núcleo: SHORT');
  });

  it('nunca fala um valor de direção fabricado — só LONG/SHORT/AWAITING, o mesmo vocabulário do badge visível', () => {
    const text = buildLiveAnnouncement(state('SHORT', true), state('LONG', true));
    expect(text).toMatch(/^Núcleo: (LONG|SHORT|AWAITING)$/);
  });
});
