// nexus-conflict-detector.test.ts — Auditoria MarketBrain (Fase 1 real e
// pequena): execução real do módulo puro (docs/historico/AUDITORIA_MARKETBRAIN.md
// §3), mesmo padrão de nexus-line.test.ts (nexusConfluenceVerdict).
import { describe, it, expect } from 'vitest';
import { regimeStructureVerdict, riskConfluenceVerdict, collectConflicts } from '../src/nexus/conflict-detector';

describe('regimeStructureVerdict: Regime (ADX/Bollinger) x Structure (HH/HL fractal)', () => {
  it('mesma direção real => ALINHADA', () => {
    expect(regimeStructureVerdict('ALTA', 'ESTRUTURA_ALTA')).toBe('ALINHADA');
    expect(regimeStructureVerdict('BAIXA', 'ESTRUTURA_BAIXA')).toBe('ALINHADA');
  });

  it('direções opostas => CONFLITO_ESTRUTURAL', () => {
    expect(regimeStructureVerdict('ALTA', 'ESTRUTURA_BAIXA')).toBe('CONFLITO_ESTRUTURAL');
    expect(regimeStructureVerdict('BAIXA', 'ESTRUTURA_ALTA')).toBe('CONFLITO_ESTRUTURAL');
  });

  it('sem leitura direcional real de um dos lados => null honesto, nunca fabricado', () => {
    expect(regimeStructureVerdict(null, 'ESTRUTURA_ALTA')).toBeNull();
    expect(regimeStructureVerdict('ALTA', null)).toBeNull();
    expect(regimeStructureVerdict('ALTA', 'ESTRUTURA_LATERAL')).toBeNull();
  });
});

describe('riskConfluenceVerdict: Risk Engine (buildRiskSuggestion) x Conselho (agreement real)', () => {
  it('Risk OK + Conselho fortemente direcional => ALINHADA', () => {
    expect(riskConfluenceVerdict('OK', 'LONG', 0.85)).toBe('ALINHADA');
    expect(riskConfluenceVerdict('OK', 'SHORT', 0.7)).toBe('ALINHADA');
  });

  it('§3.2 Regra 3 do documento: SEM_SUGESTAO + Conselho fortemente direcional => CONFLITO_ESTRUTURAL', () => {
    expect(riskConfluenceVerdict('SEM_SUGESTAO', 'LONG', 0.85)).toBe('CONFLITO_ESTRUTURAL');
  });

  it('concordância do Conselho abaixo do limiar => null (não é um conflito digno de nome)', () => {
    expect(riskConfluenceVerdict('SEM_SUGESTAO', 'LONG', 0.5)).toBeNull();
    expect(riskConfluenceVerdict('SEM_SUGESTAO', 'LONG', null)).toBeNull();
  });

  it('Conselho ABSTAIN/NEUTRAL ou Risk sem leitura => null honesto', () => {
    expect(riskConfluenceVerdict('SEM_SUGESTAO', 'ABSTAIN', 0.9)).toBeNull();
    expect(riskConfluenceVerdict('SEM_SUGESTAO', 'NEUTRAL', 0.9)).toBeNull();
    expect(riskConfluenceVerdict(null, 'LONG', 0.9)).toBeNull();
  });
});

describe('collectConflicts: lista central nomeada (o gap real identificado na auditoria)', () => {
  it('sem conflitos reais => lista vazia', () => {
    expect(collectConflicts({ regimeStructure: 'ALINHADA', riskConfluence: 'ALINHADA' })).toEqual([]);
    expect(collectConflicts({ regimeStructure: null, riskConfluence: null })).toEqual([]);
  });

  it('conflito real em um par => 1 entrada nomeada com severidade', () => {
    const result = collectConflicts({ regimeStructure: 'CONFLITO_ESTRUTURAL', riskConfluence: 'ALINHADA' });
    expect(result).toHaveLength(1);
    expect(result[0].motorA).toBe('regime');
    expect(result[0].motorB).toBe('structure');
    expect(result[0].severity).toBe('ALTO');
  });

  it('conflito em ambos os pares => 2 entradas, risk x council é CRITICO', () => {
    const result = collectConflicts({ regimeStructure: 'CONFLITO_ESTRUTURAL', riskConfluence: 'CONFLITO_ESTRUTURAL' });
    expect(result).toHaveLength(2);
    const riskConflict = result.find((c) => c.motorA === 'risk');
    expect(riskConflict?.severity).toBe('CRITICO');
  });
});
