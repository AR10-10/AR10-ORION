// market-session.test.ts — Refinamento Final §1: execução real da derivação
// pura de sessão (a matemática de fronteira de janela é exatamente o tipo
// de coisa fácil de errar em silêncio — convenção: lógica pura => teste de
// execução real).
import { describe, it, expect } from 'vitest';
import { marketSessionFromUtc, MARKET_SESSION_CONTRACT_VERSION } from '../src/nexus/market-session';

const at = (hourUtc: number, minute = 0) => new Date(Date.UTC(2026, 6, 14, hourUtc, minute, 0));

describe('marketSessionFromUtc: janelas fixas UTC, 24h cobertas sem buraco', () => {
  it('00:00 => ÁSIA (borda inicial inclusiva)', () => {
    expect(marketSessionFromUtc(at(0))?.id).toBe('ASIA');
  });

  it('06:59 => ÁSIA; 07:00 => LONDRES (borda exclusiva/inclusiva correta)', () => {
    expect(marketSessionFromUtc(at(6, 59))?.id).toBe('ASIA');
    expect(marketSessionFromUtc(at(7))?.id).toBe('LONDRES');
  });

  it('12:00 => LONDRES+NY (o overlap real de maior volume)', () => {
    expect(marketSessionFromUtc(at(12))?.id).toBe('LONDRES_NY');
    expect(marketSessionFromUtc(at(15, 59))?.id).toBe('LONDRES_NY');
  });

  it('16:00 => NOVA YORK; 20:59 ainda NOVA YORK', () => {
    expect(marketSessionFromUtc(at(16))?.id).toBe('NOVA_YORK');
    expect(marketSessionFromUtc(at(20, 59))?.id).toBe('NOVA_YORK');
  });

  it('21:00 => PACÍFICO; 23:59 => PACÍFICO (fecha o ciclo de 24h)', () => {
    expect(marketSessionFromUtc(at(21))?.id).toBe('PACIFICO');
    expect(marketSessionFromUtc(at(23, 59))?.id).toBe('PACIFICO');
  });

  it('todas as 24 horas devolvem alguma sessão — zero buraco', () => {
    for (let h = 0; h < 24; h++) {
      expect(marketSessionFromUtc(at(h)), `hora ${h}`).not.toBeNull();
    }
  });

  it('Date inválida => null honesto, nunca uma sessão fabricada', () => {
    expect(marketSessionFromUtc(new Date(NaN))).toBeNull();
  });

  it('contrato versionado + janela verificável divulgando a aproximação DST no texto', () => {
    const r = marketSessionFromUtc(at(9));
    expect(r?.contractVersion).toBe(MARKET_SESSION_CONTRACT_VERSION);
    expect(r?.windowUtc).toContain('UTC');
    expect(r?.windowUtc).toContain('DST');
  });
});
