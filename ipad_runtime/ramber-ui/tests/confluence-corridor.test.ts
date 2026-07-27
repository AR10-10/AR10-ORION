// confluence-corridor.test.ts — OMEGA CORE V-MAX Fase 5 (Fusion §5, task
// já aprovado pelo Operador: "Corredor de Confluência"). Execução real da
// função pura — convenção deste repo para lógica de fronteira (ver
// CLAUDE.md). Regra de Ouro 2 é a asserção mais importante desta suíte:
// `intensity` nunca deve ser lido/rotulado como probabilidade — o próprio
// tipo (0-1, campo `intensity`, nunca `probability`) já impõe isso, e os
// testes abaixo provam que ausência de direção ativa (WAIT) nunca produz
// um corredor fabricado.
//
// Contrato v2 (achado de auditoria, completar Fase 7): a v1 tinha 4
// componentes (opinionMass/institutionalScore/multiTimeframe/obstacle) —
// institutionalScore já era uma cópia reescalada de ConvictionReading.
// conviction, que por sua vez já continha opinionMass e multiTimeframe
// dentro de si (confluence-engine.ts). Dois dos 4 "componentes
// independentes" contavam o MESMO sinal 2-3x. v2 consome UMA
// ConvictionReading inteira (zero dupla contagem) + obstacleClearance.
import { describe, it, expect } from 'vitest';
import {
  computeConfluenceCorridor,
  CONFLUENCE_CORRIDOR_CONTRACT_VERSION,
  type ConfluenceCorridorInput,
} from '../src/nexus/confluence-corridor';
import type { ConvictionReading } from '../src/nexus/confluence-engine';

/** Fixture real de ConvictionReading OK — mesma forma que buildConvictionReading
 *  de fato devolve, nunca um objeto solto inventado pelo teste. */
function okConviction(conviction: number, convictionAdjusted: number | null = null): ConvictionReading {
  return {
    status: 'OK',
    reason: null,
    coreDirection: 'LONG',
    conviction,
    convictionAdjusted,
    verdict: 'CONFIRMS',
    agreeingCount: 1,
    totalReadable: 1,
    members: [],
    computedAt: Date.now(),
  };
}

const insufficientConviction: ConvictionReading = {
  status: 'DADOS_INSUFICIENTES',
  reason: 'nenhum_subsistema_com_leitura_real_nesta_janela',
  coreDirection: 'LONG',
  conviction: null,
  convictionAdjusted: null,
  verdict: null,
  agreeingCount: 0,
  totalReadable: 0,
  members: [],
  computedAt: Date.now(),
};

const BASE: ConfluenceCorridorInput = {
  direction: null,
  conviction: null,
  activeObstacleCount: null,
};

describe('computeConfluenceCorridor: fail-closed sem direção ativa (WAIT real do Core Engine)', () => {
  it('direction null => DADOS_INSUFICIENTES, mesmo com todos os outros insumos reais presentes', () => {
    const r = computeConfluenceCorridor({
      ...BASE,
      conviction: okConviction(0.8),
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

  it('conviction com status DADOS_INSUFICIENTES conta como ausente, nunca como zero fabricado', () => {
    const r = computeConfluenceCorridor({ ...BASE, direction: 'LONG', conviction: insufficientConviction });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('nenhum_componente_real_disponivel_ainda');
    expect(r.components.conviction).toBeNull();
  });
});

describe('computeConfluenceCorridor: componentes individuais, cada um real e independente', () => {
  it('conviction prefere convictionAdjusted (amortecida por TrustScore) quando presente', () => {
    const r = computeConfluenceCorridor({ ...BASE, direction: 'LONG', conviction: okConviction(0.9, 0.7) });
    expect(r.components.conviction).toBeCloseTo(0.7, 10);
  });

  it('conviction cai para a massa bruta (conviction) quando convictionAdjusted é null (TrustScore ainda não medido)', () => {
    const r = computeConfluenceCorridor({ ...BASE, direction: 'LONG', conviction: okConviction(0.65, null) });
    expect(r.components.conviction).toBeCloseTo(0.65, 10);
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
  it('com os 2 componentes reais presentes, intensity é a média aritmética exata', () => {
    const r = computeConfluenceCorridor({
      direction: 'LONG',
      conviction: okConviction(0.8),
      activeObstacleCount: 1, // -> 0.5
    });
    // (0.8 + 0.5) / 2 = 0.65
    expect(r.status).toBe('OK');
    expect(r.intensity).toBeCloseTo(0.65, 10);
  });

  it('com só 1 dos 2 componentes reais presentes, intensity é EXATAMENTE esse componente — nunca dividido por 2 (nunca penaliza dado ausente como se fosse ruim)', () => {
    const r = computeConfluenceCorridor({ ...BASE, direction: 'LONG', conviction: okConviction(0.6) });
    expect(r.status).toBe('OK');
    expect(r.intensity).toBeCloseTo(0.6, 10);
  });

  it('contractVersion sempre presente e estável', () => {
    const r = computeConfluenceCorridor({ ...BASE, direction: 'LONG', conviction: okConviction(0.5) });
    expect(r.contractVersion).toBe(CONFLUENCE_CORRIDOR_CONTRACT_VERSION);
    expect(CONFLUENCE_CORRIDOR_CONTRACT_VERSION).toBe(2);
  });
});

describe('Não-regressão: v2 nunca reintroduz os componentes brutos sobrepostos da v1', () => {
  it('ConfluenceCorridorComponents não tem mais opinionMass/institutionalScore/mtfAgreement — só conviction (já o pool completo) e obstacleClearance', () => {
    const r = computeConfluenceCorridor({ ...BASE, direction: 'LONG', conviction: okConviction(0.5), activeObstacleCount: 0 });
    const keys = Object.keys(r.components).sort();
    expect(keys).toEqual(['conviction', 'obstacleClearance']);
  });
});

describe('Regra de Ouro 2 (não-negociável): este contrato nunca expõe nem sugere uma probabilidade calibrada', () => {
  it('o tipo de saída não tem NENHUM campo chamado probability/probabilidade/chance', () => {
    const r = computeConfluenceCorridor({ ...BASE, direction: 'LONG', conviction: okConviction(0.5) });
    const keys = JSON.stringify(Object.keys(r)) + JSON.stringify(Object.keys(r.components));
    expect(keys.toLowerCase()).not.toMatch(/probab|chance|odds/);
  });
});
