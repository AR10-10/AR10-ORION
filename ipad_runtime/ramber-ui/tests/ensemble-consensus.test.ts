// ensemble-consensus.test.ts — permanent regression suite for the Fase F
// Consensus Engine (linear opinion pool). Imports the REAL modules from
// src/consensus/ and the REAL regime weight matrix from src/market-regime/
// — the ensemble is the official consumer the Fase D contract promised,
// and these tests prove the wiring, not a mock of it.
import { describe, it, expect } from 'vitest';
import {
  buildEnsembleConsensus,
  opinionFromLabel,
  opinionFromLean,
  opinionFromVote,
} from '../../src/consensus/ensemble-engine.js';
import { REGIMES, getSensitivity } from '../../src/market-regime/index.js';

const sum = (o: { alta: number; baixa: number; neutro: number }) => o.alta + o.baixa + o.neutro;

describe('ensemble: mapeadores de opinião — distribuições reais, nunca votos fabricados', () => {
  it('opinionFromLabel: rótulo determinístico vira opinião integral; LATERAL vira NEUTRO; null fica fora', () => {
    expect(opinionFromLabel('ALTA')).toEqual({ alta: 1, baixa: 0, neutro: 0 });
    expect(opinionFromLabel('BAIXA')).toEqual({ alta: 0, baixa: 1, neutro: 0 });
    expect(opinionFromLabel('LATERAL')).toEqual({ alta: 0, baixa: 0, neutro: 1 });
    expect(opinionFromLabel(null)).toBeNull();
  });

  it('opinionFromLean: massa direcional proporcional ao módulo, resto NEUTRO, soma exata 1', () => {
    expect(opinionFromLean(0.6)).toEqual({ alta: 0.6, baixa: 0, neutro: 0.4 });
    expect(opinionFromLean(-0.25)).toEqual({ alta: 0, baixa: 0.25, neutro: 0.75 });
    expect(opinionFromLean(0)).toEqual({ alta: 0, baixa: 0, neutro: 1 });
    expect(sum(opinionFromLean(0.37)!)).toBeCloseTo(1, 12);
  });

  it('opinionFromLean: clampa fora de [-1,1] e rejeita não-finito', () => {
    expect(opinionFromLean(5)).toEqual({ alta: 1, baixa: 0, neutro: 0 });
    expect(opinionFromLean(NaN)).toBeNull();
    expect(opinionFromLean(null)).toBeNull();
  });

  it('opinionFromVote: a massa não-votada (1−confiança) vai para NEUTRO, nunca para o lado oposto', () => {
    expect(opinionFromVote('LONG', 0.75)).toEqual({ alta: 0.75, baixa: 0, neutro: 0.25 });
    expect(opinionFromVote('SHORT', 0.6)).toEqual({ alta: 0, baixa: 0.6, neutro: 0.4 });
    expect(opinionFromVote('NEUTRAL', 0.9)).toEqual({ alta: 0, baixa: 0, neutro: 1 });
    expect(opinionFromVote('LONG', NaN)).toBeNull();
    expect(opinionFromVote(null, 0.5)).toBeNull();
  });
});

describe('ensemble: linear opinion pool — matemática clássica verificável à mão', () => {
  it('sem regime (null), pesos são todos 1: pool é a média simples das opiniões', () => {
    const result = buildEnsembleConsensus({
      members: [
        { id: 'a', familia: null, opiniao: { alta: 1, baixa: 0, neutro: 0 } },
        { id: 'b', familia: null, opiniao: { alta: 0, baixa: 1, neutro: 0 } },
        { id: 'c', familia: null, opiniao: { alta: 0, baixa: 0, neutro: 1 } },
      ],
      regime: null,
    });
    expect(result.status).toBe('OK');
    expect(result.opiniao!.alta).toBeCloseTo(1 / 3, 12);
    expect(result.opiniao!.baixa).toBeCloseTo(1 / 3, 12);
    expect(result.opiniao!.neutro).toBeCloseTo(1 / 3, 12);
    expect(sum(result.opiniao!)).toBeCloseTo(1, 12);
  });

  it('a distribuição agregada sempre soma 1 (é uma distribuição de opinião de verdade)', () => {
    const result = buildEnsembleConsensus({
      members: [
        { id: 'a', familia: 'momentum', opiniao: { alta: 0.7, baixa: 0, neutro: 0.3 } },
        { id: 'b', familia: 'fluxo_ordens', opiniao: { alta: 0, baixa: 1, neutro: 0 } },
        { id: 'c', familia: null, opiniao: { alta: 0.2, baixa: 0.2, neutro: 0.6 } },
      ],
      regime: REGIMES.TENDENCIA_FORTE,
    });
    expect(sum(result.opiniao!)).toBeCloseTo(1, 12);
  });

  it('membro sem leitura (opiniao null) fica FORA do comitê — nunca vira voto neutro fabricado', () => {
    const result = buildEnsembleConsensus({
      members: [
        { id: 'vivo', familia: null, opiniao: { alta: 1, baixa: 0, neutro: 0 } },
        { id: 'sem_leitura', familia: null, opiniao: null },
      ],
      regime: null,
    });
    expect(result.membros.map((m: any) => m.id)).toEqual(['vivo']);
    expect(result.opiniao!.alta).toBe(1);
  });

  it('comitê vazio => DADOS_INSUFICIENTES honesto, nunca uma direção inventada', () => {
    const result = buildEnsembleConsensus({ members: [], regime: null });
    expect(result.status).toBe('DADOS_INSUFICIENTES');
    expect(result.direcao).toBeNull();
    const semLeitura = buildEnsembleConsensus({
      members: [{ id: 'a', familia: null, opiniao: null }],
      regime: null,
    });
    expect(semLeitura.status).toBe('DADOS_INSUFICIENTES');
  });
});

describe('ensemble: matriz de regime da Fase D é o ponderador dinâmico OFICIAL (diretriz 2)', () => {
  const momentumUp = { id: 'momentum_up', familia: 'momentum', opiniao: { alta: 1, baixa: 0, neutro: 0 } };
  const flowDown = { id: 'flow_down', familia: 'fluxo_ordens', opiniao: { alta: 0, baixa: 1, neutro: 0 } };

  it('os pesos aplicados são EXATAMENTE getSensitivity(regime, familia) — fiação real, não cópia', () => {
    const result = buildEnsembleConsensus({
      members: [momentumUp, flowDown],
      regime: REGIMES.TENDENCIA_FORTE,
    });
    const pesoMomentum = result.membros.find((m: any) => m.id === 'momentum_up')!.peso;
    const pesoFluxo = result.membros.find((m: any) => m.id === 'flow_down')!.peso;
    expect(pesoMomentum).toBe(getSensitivity(REGIMES.TENDENCIA_FORTE, 'momentum'));
    expect(pesoFluxo).toBe(getSensitivity(REGIMES.TENDENCIA_FORTE, 'fluxo_ordens'));
  });

  it('o MESMO comitê muda de leitura quando o regime muda (a modulação é real)', () => {
    // TENDENCIA_FORTE: momentum 1.0 vs fluxo 0.9 => ALTA vence por pouco.
    const emTendencia = buildEnsembleConsensus({
      members: [momentumUp, flowDown],
      regime: REGIMES.TENDENCIA_FORTE,
    });
    // COMPRESSAO: momentum 0.2 vs fluxo 1.0 => BAIXA domina.
    const emCompressao = buildEnsembleConsensus({
      members: [momentumUp, flowDown],
      regime: REGIMES.COMPRESSAO,
    });
    expect(emTendencia.opiniao!.alta).toBeGreaterThan(emTendencia.opiniao!.baixa);
    expect(emCompressao.opiniao!.baixa).toBeGreaterThan(emCompressao.opiniao!.alta);
  });

  it('membro externo (familia null, ex.: GMIL) tem peso fixo 1 — regime local não modula contexto global', () => {
    const result = buildEnsembleConsensus({
      members: [{ id: 'gmil_contexto', familia: null, opiniao: { alta: 0.5, baixa: 0, neutro: 0.5 } }],
      regime: REGIMES.CONSOLIDACAO,
    });
    expect(result.membros[0].peso).toBe(1);
  });

  it('regime DADOS_INSUFICIENTES => sem modulação (todos os pesos 1), nunca um peso chutado', () => {
    const result = buildEnsembleConsensus({
      members: [momentumUp, flowDown],
      regime: REGIMES.DADOS_INSUFICIENTES,
    });
    expect(result.membros.every((m: any) => m.peso === 1)).toBe(true);
    expect(result.regime_aplicado).toBe(REGIMES.DADOS_INSUFICIENTES);
  });
});

describe('ensemble: direção, força e o amortecedor de qualidade da Fase C (diretriz 2)', () => {
  it('direção é a maior massa; empate exato alta==baixa => NEUTRO (comitê dividido não tem direção)', () => {
    const dividido = buildEnsembleConsensus({
      members: [
        { id: 'a', familia: null, opiniao: { alta: 1, baixa: 0, neutro: 0 } },
        { id: 'b', familia: null, opiniao: { alta: 0, baixa: 1, neutro: 0 } },
      ],
      regime: null,
    });
    expect(dividido.direcao).toBe('NEUTRO');
    expect(dividido.forca).toBeCloseTo(0, 12);
  });

  it('força = |alta − baixa| — comitê unânime tem força 1', () => {
    const unanime = buildEnsembleConsensus({
      members: [
        { id: 'a', familia: null, opiniao: { alta: 1, baixa: 0, neutro: 0 } },
        { id: 'b', familia: null, opiniao: { alta: 1, baixa: 0, neutro: 0 } },
      ],
      regime: null,
    });
    expect(unanime.direcao).toBe('ALTA');
    expect(unanime.forca).toBe(1);
  });

  it('forca_ajustada = forca × peso de qualidade do Bus — dado ruim ENFRAQUECE, nunca inverte', () => {
    const members = [{ id: 'a', familia: null, opiniao: { alta: 1, baixa: 0, neutro: 0 } }];
    const comQualidade = buildEnsembleConsensus({ members, regime: null, dataQualityWeight: 0.5 });
    expect(comQualidade.forca_ajustada).toBeCloseTo(0.5, 12);
    expect(comQualidade.direcao).toBe('ALTA'); // direção intacta
    const semQualidade = buildEnsembleConsensus({ members, regime: null, dataQualityWeight: null });
    expect(semQualidade.forca_ajustada).toBeNull(); // não medido => null, nunca 0 fingido
  });

  it('explicabilidade (V15 Cap. 13): membros[] expõe id, família, peso aplicado e opinião real de cada um', () => {
    const result = buildEnsembleConsensus({
      members: [{ id: 'lorentzian_knn', familia: 'momentum', opiniao: { alta: 0.8, baixa: 0, neutro: 0.2 } }],
      regime: REGIMES.TENDENCIA_MODERADA,
    });
    expect(result.membros[0]).toMatchObject({
      id: 'lorentzian_knn',
      familia: 'momentum',
      peso: getSensitivity(REGIMES.TENDENCIA_MODERADA, 'momentum'),
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.membros)).toBe(true);
  });

  it('é determinístico e sem estado: mesmas entradas => exatamente a mesma saída', () => {
    const input = {
      members: [
        { id: 'a', familia: 'momentum', opiniao: { alta: 0.7, baixa: 0.1, neutro: 0.2 } },
        { id: 'b', familia: null, opiniao: { alta: 0, baixa: 0.4, neutro: 0.6 } },
      ],
      regime: REGIMES.BREAKOUT,
      dataQualityWeight: 0.9,
    };
    expect(buildEnsembleConsensus(input)).toEqual(buildEnsembleConsensus(input));
  });
});
