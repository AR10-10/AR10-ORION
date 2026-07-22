// rr-quality.test.ts — execução REAL do piso declarado de R:R (fecho da
// pendência "R:R mínimo"). O ponto central provado aqui: é um AVISO de
// exibição com parâmetro declarado — nunca esconde/bloqueia nada, nunca
// reinterpreta ausência de dado como julgamento.
import { describe, it, expect } from 'vitest';
import { rrBelowFloor, rrFloorSuffix, RR_QUALITY_FLOOR } from '../src/nexus/rr-quality';

describe('rrBelowFloor — piso declarado (1:2, convenção de mesa), nunca uma medição', () => {
  it('piso declarado é 2 (documentado e ajustável no módulo — mesma natureza dos limiares 70/30 do RSI)', () => {
    expect(RR_QUALITY_FLOOR).toBe(2);
  });

  it('R:R real abaixo do piso => true; no piso ou acima => false (estritamente menor-que)', () => {
    expect(rrBelowFloor(1.22)).toBe(true);
    expect(rrBelowFloor(1.99)).toBe(true);
    expect(rrBelowFloor(2)).toBe(false); // exatamente no piso não é "abaixo"
    expect(rrBelowFloor(2.44)).toBe(false);
  });

  it('fail-closed: null/undefined/NaN/Infinity/zero/negativo NUNCA viram um julgamento — ausência é ausência, nunca "ruim"', () => {
    expect(rrBelowFloor(null)).toBe(false);
    expect(rrBelowFloor(undefined)).toBe(false);
    expect(rrBelowFloor(Number.NaN)).toBe(false);
    expect(rrBelowFloor(Number.POSITIVE_INFINITY)).toBe(false);
    expect(rrBelowFloor(0)).toBe(false); // R:R 0/negativo já é filtrado pelo próprio Trade Plan antes daqui
    expect(rrBelowFloor(-1)).toBe(false);
  });

  it('piso customizado (parâmetro opcional) é honrado — o default exportado nunca é hardcoded na comparação', () => {
    expect(rrBelowFloor(2.5, 3)).toBe(true);
    expect(rrBelowFloor(2.5, 2)).toBe(false);
  });

  it('rrFloorSuffix: sufixo curto pronto quando abaixo do piso, string VAZIA (nunca placeholder) caso contrário', () => {
    expect(rrFloorSuffix(1.22)).toBe(' (abaixo do piso 1:2)');
    expect(rrFloorSuffix(2.44)).toBe('');
    expect(rrFloorSuffix(null)).toBe('');
  });

  it('LEI 24 no nível do fonte: o módulo só LÊ e anota — nunca importa Trade Plan/decisão, nunca escreve em store, zero rede', () => {
    const src = require('node:fs').readFileSync(require.resolve('../src/nexus/rr-quality.ts'), 'utf8');
    expect(src).not.toMatch(/import .*trade-plan|import .*decision-layer|useUnifiedSnapshotStore|fetch\(|Math\.random/);
    expect(src).toContain('PARÂMETRO DECLARADO'); // a natureza honesta do número está documentada no próprio fonte
  });
});
