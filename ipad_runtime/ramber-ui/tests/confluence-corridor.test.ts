// confluence-corridor.test.ts — OMEGA CORE V-MAX Fase 5 (Fusion §5, task
// já aprovado pelo Operador: "Corredor de Confluência"). Execução real da
// função pura — convenção deste repo para lógica de fronteira (ver
// CLAUDE.md). Regra de Ouro 2 é a asserção mais importante desta suíte:
// `intensity` nunca deve ser lido/rotulado como probabilidade — o próprio
// tipo (0-1, campo `intensity`, nunca `probability`) já impõe isso, e os
// testes abaixo provam que ausência de direção ativa (WAIT) nunca produz
// um corredor fabricado.
import { describe, it, expect } from 'vitest';
import {
  computeConfluenceCorridor,
  CONFLUENCE_CORRIDOR_CONTRACT_VERSION,
  type ConfluenceCorridorInput,
} from '../src/nexus/confluence-corridor';

const BASE: ConfluenceCorridorInput = {
  direction: null,
  opinionMass: null,
  institutionalScore: null,
  multiTimeframe: null,
  activeObstacleCount: null,
};

describe('computeConfluenceCorridor: fail-closed sem direção ativa (WAIT real do Core Engine)', () => {
  it('direction null => DADOS_INSUFICIENTES, mesmo com todos os outros insumos reais presentes', () => {
    const r = computeConfluenceCorridor({
      ...BASE,
      opinionMass: { long: 0.8, short: 0.1, neutral: 0.1 },
      institutionalScore: 90,
      multiTimeframe: { '15m': { confidenceStance: 'LONG' } },
      activeObstacleCount: 0,
    });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('sem_direcao_ativa_do_core_engine');
    expect(r.intensity).toBeNull();
  });

  it('nenhum componente real disponível (direção ativa mas tudo mais ausente) => DADOS_INSUFICIENTES honesto, nunca zero fabricado', () => {
    const r = computeConfluenceCorridor({ ...BASE, direction: 'LONG' });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('nenhum_componente_real_disponivel_ainda');
    expect(r.intensity).toBeNull();
  });
});

describe('computeConfluenceCorridor: componentes individuais, cada um real e independente', () => {
  it('opinionMass usa o lado LONG quando a direção ativa é LONG', () => {
    const r = computeConfluenceCorridor({ ...BASE, direction: 'LONG', opinionMass: { long: 0.7, short: 0.2, neutral: 0.1 } });
    expect(r.components.opinionMass).toBe(0.7);
  });

  it('opinionMass usa o lado SHORT quando a direção ativa é SHORT (nunca o LONG por engano)', () => {
    const r = computeConfluenceCorridor({ ...BASE, direction: 'SHORT', opinionMass: { long: 0.7, short: 0.2, neutral: 0.1 } });
    expect(r.components.opinionMass).toBe(0.2);
  });

  it('institutionalScore é normalizado de 0-100 para 0-1, nunca uma segunda escala inventada', () => {
    const r = computeConfluenceCorridor({ ...BASE, direction: 'LONG', institutionalScore: 84 });
    expect(r.components.institutionalScore).toBeCloseTo(0.84, 10);
  });

  it('mtfAgreement conta só prazos com confidenceStance real, ignora null (fail-closed por prazo)', () => {
    const r = computeConfluenceCorridor({
      ...BASE,
      direction: 'LONG',
      multiTimeframe: {
        '1m': { confidenceStance: 'LONG' },
        '5m': { confidenceStance: 'LONG' },
        '15m': { confidenceStance: 'SHORT' },
        '1h': { confidenceStance: null }, // sem leitura real — não conta no denominador
      },
    });
    expect(r.components.mtfAgreement).toBeCloseTo(2 / 3, 10);
  });

  it('mtfAgreement é null quando NENHUM prazo tem leitura real (nunca 0 fabricado)', () => {
    const r = computeConfluenceCorridor({
      ...BASE,
      direction: 'LONG',
      institutionalScore: 50, // mantém pelo menos 1 componente real para não cair no caso DADOS_INSUFICIENTES total
      multiTimeframe: { '1m': { confidenceStance: null } },
    });
    expect(r.components.mtfAgreement).toBeNull();
  });

  it('obstacleClearance é 1.0 com zero obstáculos reais e decresce (nunca zera) com mais obstáculos', () => {
    const zero = computeConfluenceCorridor({ ...BASE, direction: 'LONG', activeObstacleCount: 0 });
    const one = computeConfluenceCorridor({ ...BASE, direction: 'LONG', activeObstacleCount: 1 });
    const three = computeConfluenceCorridor({ ...BASE, direction: 'LONG', activeObstacleCount: 3 });
    expect(zero.components.obstacleClearance).toBe(1);
    expect(one.components.obstacleClearance).toBeCloseTo(0.5, 10);
    expect(three.components.obstacleClearance).toBeCloseTo(0.25, 10);
    expect(one.components.obstacleClearance! < zero.components.obstacleClearance!).toBe(true);
    expect(three.components.obstacleClearance! < one.components.obstacleClearance!).toBe(true);
    expect(three.components.obstacleClearance!).toBeGreaterThan(0); // nunca zera de vez
  });
});

describe('computeConfluenceCorridor: intensity é a média real só dos componentes presentes', () => {
  it('com os 4 componentes reais presentes, intensity é a média aritmética exata', () => {
    const r = computeConfluenceCorridor({
      direction: 'LONG',
      opinionMass: { long: 0.8, short: 0.1, neutral: 0.1 },
      institutionalScore: 80, // -> 0.8
      multiTimeframe: { '15m': { confidenceStance: 'LONG' }, '1h': { confidenceStance: 'LONG' } }, // -> 1.0
      activeObstacleCount: 1, // -> 0.5
    });
    // (0.8 + 0.8 + 1.0 + 0.5) / 4 = 0.775
    expect(r.status).toBe('OK');
    expect(r.intensity).toBeCloseTo(0.775, 10);
  });

  it('com só 1 dos 4 componentes reais presentes, intensity é EXATAMENTE esse componente — nunca dividido por 4 (nunca penaliza dado ausente como se fosse ruim)', () => {
    const r = computeConfluenceCorridor({ ...BASE, direction: 'LONG', institutionalScore: 60 });
    expect(r.status).toBe('OK');
    expect(r.intensity).toBeCloseTo(0.6, 10);
  });

  it('contractVersion sempre presente e estável', () => {
    const r = computeConfluenceCorridor({ ...BASE, direction: 'LONG', institutionalScore: 50 });
    expect(r.contractVersion).toBe(CONFLUENCE_CORRIDOR_CONTRACT_VERSION);
    expect(CONFLUENCE_CORRIDOR_CONTRACT_VERSION).toBe(1);
  });
});

describe('Regra de Ouro 2 (não-negociável): este contrato nunca expõe nem sugere uma probabilidade calibrada', () => {
  it('o tipo de saída não tem NENHUM campo chamado probability/probabilidade/chance', () => {
    const r = computeConfluenceCorridor({ ...BASE, direction: 'LONG', institutionalScore: 50 });
    const keys = JSON.stringify(Object.keys(r)) + JSON.stringify(Object.keys(r.components));
    expect(keys.toLowerCase()).not.toMatch(/probab|chance|odds/);
  });
});
