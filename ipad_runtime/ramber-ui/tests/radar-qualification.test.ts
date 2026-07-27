// radar-qualification.test.ts — OMEGA CORE V-MAX Fase 7 (Radar/OIH v1,
// escopo combinado com o Operador via AskUserQuestion: só o núcleo de
// qualificação/ranking nesta rodada, varredura em background fica para
// depois). Execução real da função pura — convenção deste repo para
// lógica de fronteira.
import { describe, it, expect } from 'vitest';
import {
  qualifyRadarCandidate,
  rankRadarCandidates,
  RADAR_MIN_CONFLUENCE_INTENSITY,
  type RadarCandidateInput,
} from '../src/nexus/radar-qualification';
import { buildTradePlan } from '../src/nexus/trade-plan';
import type { ConfluenceCorridorReading } from '../src/nexus/confluence-corridor';

const realPlan = () =>
  buildTradePlan({
    stance: 'LONG',
    riskGated: false,
    price: 50_000,
    zones: [{ low: 49_200, high: 49_500, kind: 'OB_BULLISH' }],
    levels: [
      { price: 48_800, kind: 'SR_SUPPORT_1' },
      { price: 51_000, kind: 'SR_RESISTANCE_1' },
    ],
  });

const goodConfluence = (intensity: number): ConfluenceCorridorReading => ({
  contractVersion: 2,
  status: 'OK',
  reason: null,
  intensity,
  components: { conviction: intensity, obstacleClearance: intensity },
  computedAt: Date.now(),
});

const BASE: RadarCandidateInput = {
  symbol: 'BTC',
  timeframe: '15m',
  structureLabel: 'ESTRUTURA_ALTA',
  direction: 'LONG',
  tradePlan: null,
  riskGated: false,
  confluence: { contractVersion: 2, status: 'DADOS_INSUFICIENTES', reason: 'x', intensity: null, components: { conviction: null, obstacleClearance: null }, computedAt: Date.now() },
  provider: 'BINANCE',
};

describe('qualifyRadarCandidate: filtro mínimo real (LEI 24 — nunca recalcula, nunca emite direção)', () => {
  it('qualifica quando TODOS os critérios reais estão satisfeitos', () => {
    const plan = realPlan();
    expect(plan).not.toBeNull(); // sanidade: motor real produziu plano
    const r = qualifyRadarCandidate({ ...BASE, tradePlan: plan, confluence: goodConfluence(0.8) });
    expect(r.qualifies).toBe(true);
    expect(r.qualityIndex).toBe(0.8);
    expect(r.direction).toBe('LONG');
    expect(r.riskRewardRatio).toBe(plan!.riskRewardRatios[0]);
  });

  it('reprova sem direção ativa do Core Engine (WAIT real)', () => {
    const r = qualifyRadarCandidate({ ...BASE, direction: null, tradePlan: realPlan(), confluence: goodConfluence(0.9) });
    expect(r.qualifies).toBe(false);
    expect(r.reason).toBe('sem_direcao_ativa_do_core_engine');
    expect(r.qualityIndex).toBeNull();
  });

  it('reprova com estrutura LATERAL (não confirmada direcionalmente)', () => {
    const r = qualifyRadarCandidate({ ...BASE, structureLabel: 'ESTRUTURA_LATERAL', tradePlan: realPlan(), confluence: goodConfluence(0.9) });
    expect(r.qualifies).toBe(false);
    expect(r.reason).toBe('estrutura_nao_confirmada_ou_lateral');
  });

  it('reprova com estrutura null (sem leitura real ainda)', () => {
    const r = qualifyRadarCandidate({ ...BASE, structureLabel: null, tradePlan: realPlan(), confluence: goodConfluence(0.9) });
    expect(r.qualifies).toBe(false);
    expect(r.reason).toBe('estrutura_nao_confirmada_ou_lateral');
  });

  it('reprova sem Trade Plan real (null)', () => {
    const r = qualifyRadarCandidate({ ...BASE, tradePlan: null, confluence: goodConfluence(0.9) });
    expect(r.qualifies).toBe(false);
    expect(r.reason).toBe('sem_trade_plan_valido');
  });

  it('reprova com risk gate travado — reusa CouncilDecision.riskGated real, nunca inventa gate novo', () => {
    const r = qualifyRadarCandidate({ ...BASE, tradePlan: realPlan(), riskGated: true, confluence: goodConfluence(0.9) });
    expect(r.qualifies).toBe(false);
    expect(r.reason).toBe('risk_gate_travado_pelo_conselho');
  });

  it('reprova quando o Corredor de Confluência está DADOS_INSUFICIENTES', () => {
    const r = qualifyRadarCandidate({ ...BASE, tradePlan: realPlan(), confluence: BASE.confluence });
    expect(r.qualifies).toBe(false);
    expect(r.reason).toBe('confluencia_real_indisponivel_nesta_janela');
  });

  it('reprova quando a confluência real está abaixo do piso documentado', () => {
    const r = qualifyRadarCandidate({ ...BASE, tradePlan: realPlan(), confluence: goodConfluence(RADAR_MIN_CONFLUENCE_INTENSITY - 0.01) });
    expect(r.qualifies).toBe(false);
    expect(r.reason).toContain('confluencia_abaixo_do_piso');
  });

  it('qualifica exatamente no piso (>=), nunca só estritamente acima', () => {
    const r = qualifyRadarCandidate({ ...BASE, tradePlan: realPlan(), confluence: goodConfluence(RADAR_MIN_CONFLUENCE_INTENSITY) });
    expect(r.qualifies).toBe(true);
  });

  it('qualityIndex é SEMPRE a mesma referência numérica do Corredor de Confluência — zero segunda fórmula', () => {
    const confluence = goodConfluence(0.73);
    const r = qualifyRadarCandidate({ ...BASE, tradePlan: realPlan(), confluence });
    expect(r.qualityIndex).toBe(confluence.intensity);
  });
});

describe('rankRadarCandidates: só lista oportunidades REALMENTE validadas, ordenadas por qualidade real', () => {
  it('filtra os que não qualificam e ordena os que qualificam por qualityIndex desc', () => {
    const plan = realPlan();
    const results = [
      qualifyRadarCandidate({ ...BASE, symbol: 'ETH', tradePlan: plan, confluence: goodConfluence(0.65) }),
      qualifyRadarCandidate({ ...BASE, symbol: 'SOL', tradePlan: null, confluence: goodConfluence(0.95) }), // sem plano: reprovado apesar da confluência alta
      qualifyRadarCandidate({ ...BASE, symbol: 'BNB', tradePlan: plan, confluence: goodConfluence(0.9) }),
    ];
    const ranked = rankRadarCandidates(results);
    expect(ranked.map((r) => r.symbol)).toEqual(['BNB', 'ETH']); // SOL fora, BNB (0.9) antes de ETH (0.65)
  });

  it('lista vazia quando nenhum candidato qualifica — nunca inventa uma oportunidade', () => {
    const ranked = rankRadarCandidates([qualifyRadarCandidate({ ...BASE, tradePlan: null, confluence: goodConfluence(0.9) })]);
    expect(ranked).toEqual([]);
  });
});

describe('ADITIVO V-MAX Etapa 9: provider é proveniência real, passthrough puro, nunca um critério de qualificação', () => {
  it('provider MEXC passa intocado até o resultado — mesmo candidato, mesma qualificação, só a origem muda', () => {
    const r = qualifyRadarCandidate({ ...BASE, tradePlan: realPlan(), confluence: goodConfluence(0.8), provider: 'MEXC' });
    expect(r.provider).toBe('MEXC');
    expect(r.qualifies).toBe(true);
  });

  it('provider BINANCE passa intocado — mesmo resultado que hoje, comportamento de sempre', () => {
    const r = qualifyRadarCandidate({ ...BASE, tradePlan: realPlan(), confluence: goodConfluence(0.8), provider: 'BINANCE' });
    expect(r.provider).toBe('BINANCE');
  });

  it('provider nunca influencia qualifies/reason — o mesmo candidato reprovado continua reprovado independente da exchange', () => {
    const binance = qualifyRadarCandidate({ ...BASE, tradePlan: null, provider: 'BINANCE' });
    const mexc = qualifyRadarCandidate({ ...BASE, tradePlan: null, provider: 'MEXC' });
    expect(binance.qualifies).toBe(false);
    expect(mexc.qualifies).toBe(false);
    expect(binance.reason).toBe(mexc.reason);
  });
});

describe('Regra de Ouro 2 (não-negociável): qualityIndex nunca é exposto/rotulado como probabilidade', () => {
  it('o tipo de saída não tem nenhum campo probability/probabilidade/chance/odds', () => {
    const r = qualifyRadarCandidate({ ...BASE, tradePlan: realPlan(), confluence: goodConfluence(0.8) });
    const keys = Object.keys(r).join(',').toLowerCase();
    expect(keys).not.toMatch(/probab|chance|odds/);
  });
});
