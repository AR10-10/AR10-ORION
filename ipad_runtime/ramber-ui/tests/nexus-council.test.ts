// nexus-council.test.ts — V-MAX Fase 1 item 4: trava o Conselho
// Multi-Agente. Cada agente é puro: sem dado real => ABSTAIN honesto,
// nunca um voto fabricado. O Meta-Agent delega a agregação ao linear
// opinion pool REAL da Fase F (zero repetição) e aplica quórum + gate de
// risco fail-closed por cima.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  liquidityAgentVote,
  structureAgentVote,
  orderflowAgentVote,
  riskAgentVote,
  manipulationAgentVote,
  fibonacciAgentVote,
  momentumAgentVote,
  aggregateCouncil,
  buildCouncilDecision,
  COUNCIL_CONTRACT_VERSION,
  type CouncilVote,
  type CouncilLiquidityZone,
} from '../src/nexus/council';
import type { FibonacciConfluenceMatrix } from '../src/nexus/fibonacci-confluence';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const eqh = (price: number, swept = false): CouncilLiquidityZone => ({ type: 'EQUAL_HIGH', price, swept });
const eql = (price: number, swept = false): CouncilLiquidityZone => ({ type: 'EQUAL_LOW', price, swept });

const healthyRisk = { offline: false, isDataFresh: true, engineStatus: 'ok' as const };

const vote = (agent: CouncilVote['agent'], stance: CouncilVote['stance'], confidence: number | null): CouncilVote => ({
  agent, stance, confidence, rationale: 'fixture', evidence: [],
});

describe('LiquidityAgent: draw on liquidity real (pools EQH/EQL não varridos vs preço)', () => {
  it('ABSTAIN sem preço real de referência', () => {
    expect(liquidityAgentVote([eqh(110)], null).stance).toBe('ABSTAIN');
  });

  it('ABSTAIN sem nenhum pool intacto mapeado', () => {
    expect(liquidityAgentVote([], 100).stance).toBe('ABSTAIN');
    // pools varridos não contam como intactos
    expect(liquidityAgentVote([eqh(110, true), eql(90, true)], 100).stance).toBe('ABSTAIN');
  });

  it('mais EQH intactos acima => LONG com confiança do desequilíbrio real', () => {
    const v = liquidityAgentVote([eqh(110), eqh(115), eql(90)], 100);
    expect(v.stance).toBe('LONG');
    expect(v.confidence).toBeCloseTo(1 / 3, 10); // |2-1|/3
  });

  it('mais EQL intactos abaixo => SHORT; equilíbrio exato => NEUTRAL conf 0', () => {
    expect(liquidityAgentVote([eql(90), eql(85)], 100).stance).toBe('SHORT');
    const n = liquidityAgentVote([eqh(110), eql(90)], 100);
    expect(n.stance).toBe('NEUTRAL');
    expect(n.confidence).toBe(0);
  });
});

describe('StructureAgent: rótulos reais 15m+1H, confiança = desequilíbrio entre leituras', () => {
  it('ABSTAIN sem nenhum rótulo real', () => {
    expect(structureAgentVote(null, null).stance).toBe('ABSTAIN');
  });

  it('duas leituras concordando => confiança 1', () => {
    const v = structureAgentVote('ALTA', 'ALTA');
    expect(v.stance).toBe('LONG');
    expect(v.confidence).toBe(1);
  });

  it('conflito direto de timeframes reais => NEUTRAL conf 0', () => {
    const v = structureAgentVote('ALTA', 'BAIXA');
    expect(v.stance).toBe('NEUTRAL');
    expect(v.confidence).toBe(0);
  });

  it('uma única leitura real disponível vota sozinha com confiança 1', () => {
    const v = structureAgentVote('BAIXA', null);
    expect(v.stance).toBe('SHORT');
    expect(v.confidence).toBe(1);
  });

  it('LATERAL real => NEUTRAL, nunca inventa direção', () => {
    expect(structureAgentVote('LATERAL', 'LATERAL').stance).toBe('NEUTRAL');
  });
});

describe('OrderflowAgent: CVD real dá a direção; OFI reais corroboram a confiança', () => {
  it('ABSTAIN sem CVD real', () => {
    expect(orderflowAgentVote(null, []).stance).toBe('ABSTAIN');
  });

  it('CVD positivo com OFI concordando => LONG com confiança = fração real', () => {
    const v = orderflowAgentVote(120, [
      { type: 'OFI', metadata: { imbalance: 0.4 } },
      { type: 'OFI', metadata: { imbalance: -0.2 } },
      { type: 'OFI', metadata: { imbalance: 0.7 } },
    ]);
    expect(v.stance).toBe('LONG');
    expect(v.confidence).toBeCloseTo(2 / 3, 10);
  });

  it('sem OFI na janela => direção nua com confiança 0 honesta (nunca um chute)', () => {
    const v = orderflowAgentVote(-50, [{ type: 'ABSORPTION', metadata: {} }]);
    expect(v.stance).toBe('SHORT');
    expect(v.confidence).toBe(0);
  });

  it('CVD exatamente zero => NEUTRAL', () => {
    expect(orderflowAgentVote(0, []).stance).toBe('NEUTRAL');
  });
});

describe('RiskAgent: nunca vota direção; degradação real => ABSTAIN (gate)', () => {
  it('operação viável => NEUTRAL com confiança 1', () => {
    const v = riskAgentVote(healthyRisk);
    expect(v.stance).toBe('NEUTRAL');
    expect(v.confidence).toBe(1);
  });

  it('offline/stale/motor-erro/pending => ABSTAIN listando as falhas reais', () => {
    expect(riskAgentVote({ ...healthyRisk, offline: true }).stance).toBe('ABSTAIN');
    expect(riskAgentVote({ ...healthyRisk, isDataFresh: false }).stance).toBe('ABSTAIN');
    expect(riskAgentVote({ ...healthyRisk, engineStatus: 'error' }).stance).toBe('ABSTAIN');
    const v = riskAgentVote({ offline: true, isDataFresh: false, engineStatus: 'pending' });
    expect(v.stance).toBe('ABSTAIN');
    expect(v.evidence.length).toBe(3);
  });
});

describe('ManipulationAgent: só sweeps REAIS contam como evidência', () => {
  it('ABSTAIN sem nenhum sweep real na janela', () => {
    expect(manipulationAgentVote([eqh(110), eql(90)]).stance).toBe('ABSTAIN');
  });

  it('EQH varrido (liquidez compradora tomada) => leitura SHORT', () => {
    const v = manipulationAgentVote([eqh(110, true), eql(90)]);
    expect(v.stance).toBe('SHORT');
    expect(v.confidence).toBe(1);
  });

  it('EQL varrido => leitura LONG; sweeps iguais dos dois lados => NEUTRAL', () => {
    expect(manipulationAgentVote([eql(90, true)]).stance).toBe('LONG');
    expect(manipulationAgentVote([eqh(110, true), eql(90, true)]).stance).toBe('NEUTRAL');
  });
});

describe('FibonacciAgent: vota da matriz real (fontes já incluem POC/HVN do WASM)', () => {
  const matrix = (bestScore: number, legIsUp: boolean): FibonacciConfluenceMatrix => ({
    legLow: 100, legHigh: 200, legIsUp, toleranceAbs: 2,
    levels: [
      { ratio: 0.382, price: legIsUp ? 161.8 : 138.2, score: 0, matches: [] },
      {
        ratio: 0.618, price: legIsUp ? 138.2 : 161.8, score: bestScore,
        matches: Array.from({ length: bestScore }, (_, i) => ({ kind: i === 0 ? 'VP_POC' : `SRC_${i}`, priceLow: 0, priceHigh: 0 })),
      },
    ],
    computedAt: 1,
  });

  it('ABSTAIN sem matriz (sem perna real confirmada)', () => {
    expect(fibonacciAgentVote(null).stance).toBe('ABSTAIN');
  });

  it('ABSTAIN com níveis reais mas zero confluência', () => {
    expect(fibonacciAgentVote(matrix(0, true)).stance).toBe('ABSTAIN');
  });

  it('confluência real em perna de alta => LONG; 3+ fontes => confiança plena', () => {
    const v = fibonacciAgentVote(matrix(3, true));
    expect(v.stance).toBe('LONG');
    expect(v.confidence).toBe(1);
    expect(v.evidence).toContain('VP_POC'); // o cruzamento transversal com o WASM é visível no debate
  });

  it('perna de baixa => SHORT; 1 fonte => confiança parcial (1/3)', () => {
    const v = fibonacciAgentVote(matrix(1, false));
    expect(v.stance).toBe('SHORT');
    expect(v.confidence).toBeCloseTo(1 / 3, 10);
  });
});

describe('MomentumAgent: RSI de Wilder real (computeRSI, mesma função do k-NN — zero segunda matemática)', () => {
  it('ABSTAIN sem histórico real suficiente (null) ou RSI não-finito (NaN)', () => {
    expect(momentumAgentVote(null).stance).toBe('ABSTAIN');
    expect(momentumAgentVote(NaN).stance).toBe('ABSTAIN');
  });

  it('sobrecompra (>=70) => SHORT; confiança escala linearmente até o extremo 100', () => {
    const v = momentumAgentVote(85);
    expect(v.stance).toBe('SHORT');
    expect(v.confidence).toBeCloseTo(0.5, 10); // (85-70)/30
    const extreme = momentumAgentVote(100);
    expect(extreme.confidence).toBe(1);
  });

  it('sobrevenda (<=30) => LONG; confiança escala linearmente até o extremo 0', () => {
    const v = momentumAgentVote(15);
    expect(v.stance).toBe('LONG');
    expect(v.confidence).toBeCloseTo(0.5, 10); // (30-15)/30
    const extreme = momentumAgentVote(0);
    expect(extreme.confidence).toBe(1);
  });

  it('fronteiras exatas (70 e 30) já contam como leitura extrema, mas com confiança 0 honesta', () => {
    const overbought = momentumAgentVote(70);
    expect(overbought.stance).toBe('SHORT');
    expect(overbought.confidence).toBe(0);
    const oversold = momentumAgentVote(30);
    expect(oversold.stance).toBe('LONG');
    expect(oversold.confidence).toBe(0);
  });

  it('zona neutra (30-70) => NEUTRAL honesto, nunca um voto forçado', () => {
    const v = momentumAgentVote(50);
    expect(v.stance).toBe('NEUTRAL');
    expect(v.confidence).toBe(0);
  });
});

describe('Meta-Agent: quórum + gate de risco + pool real da Fase F', () => {
  it('RiskAgent ABSTAIN trava o conselho inteiro (fail-closed), mas o debate sai completo', () => {
    const votes = [
      vote('LIQUIDITY', 'LONG', 1),
      vote('STRUCTURE', 'LONG', 1),
      vote('ORDERFLOW', 'LONG', 1),
      vote('RISK', 'ABSTAIN', null),
      vote('MANIPULATION', 'LONG', 1),
      vote('FIBONACCI', 'LONG', 1),
    ];
    const d = aggregateCouncil(votes, 123);
    expect(d.stance).toBe('ABSTAIN');
    expect(d.riskGated).toBe(true);
    expect(d.agreement).toBeNull();
    expect(d.votes).toHaveLength(6);
    expect(d.contractVersion).toBe(COUNCIL_CONTRACT_VERSION);
  });

  it('quórum zero (todos os direcionais ABSTAIN) => conselho ABSTAIN mesmo com risco ok', () => {
    const votes = [
      vote('LIQUIDITY', 'ABSTAIN', null),
      vote('STRUCTURE', 'ABSTAIN', null),
      vote('ORDERFLOW', 'ABSTAIN', null),
      vote('RISK', 'NEUTRAL', 1),
      vote('MANIPULATION', 'ABSTAIN', null),
      vote('FIBONACCI', 'ABSTAIN', null),
    ];
    const d = aggregateCouncil(votes, 123);
    expect(d.stance).toBe('ABSTAIN');
    expect(d.riskGated).toBe(false);
    expect(d.quorum).toBe(0);
  });

  it('maioria real LONG => stance LONG com agreement = desequilíbrio do pool', () => {
    const votes = [
      vote('LIQUIDITY', 'LONG', 1),
      vote('STRUCTURE', 'LONG', 1),
      vote('ORDERFLOW', 'SHORT', 0.5),
      vote('RISK', 'NEUTRAL', 1),
      vote('MANIPULATION', 'ABSTAIN', null),
      vote('FIBONACCI', 'LONG', 1),
    ];
    const d = aggregateCouncil(votes, 123);
    expect(d.stance).toBe('LONG');
    expect(d.quorum).toBe(4);
    expect(d.agreement).toBeGreaterThan(0);
    expect(d.agreement).toBeLessThanOrEqual(1);
  });

  it('conselho perfeitamente dividido => NEUTRAL (nunca fabrica direção)', () => {
    const votes = [
      vote('LIQUIDITY', 'LONG', 1),
      vote('STRUCTURE', 'SHORT', 1),
      vote('ORDERFLOW', 'ABSTAIN', null),
      vote('RISK', 'NEUTRAL', 1),
      vote('MANIPULATION', 'ABSTAIN', null),
      vote('FIBONACCI', 'ABSTAIN', null),
    ];
    const d = aggregateCouncil(votes, 123);
    expect(d.stance).toBe('NEUTRAL');
  });
});

describe('buildCouncilDecision: composição de ponta a ponta com dados reais mínimos', () => {
  it('cenário saudável e concordante produz decisão direcional com 7 votos', () => {
    const d = buildCouncilDecision({
      price: 100,
      liquidityZones: [eqh(110), eqh(112), eql(95)],
      structure15: 'ALTA',
      structure1h: 'ALTA',
      cvd: 250,
      orderflowSignals: [{ type: 'OFI', metadata: { imbalance: 0.5 } }],
      offline: false,
      isDataFresh: true,
      engineStatus: 'ok',
      fibonacci: null, // fib ABSTAIN — quórum segue real com os demais
      rsi: null, // MOMENTUM ABSTAIN aqui — sua contribuição ao pool já é coberta pelos testes dedicados acima, este teste prova só a composição de 7 votos
    }, 999);
    expect(d.votes).toHaveLength(7);
    expect(d.stance).toBe('LONG');
    expect(d.riskGated).toBe(false);
    expect(d.computedAt).toBe(999);
  });

  it('boot frio (nada real ainda) => ABSTAIN honesto via gate de risco', () => {
    const d = buildCouncilDecision({
      price: null,
      liquidityZones: [],
      structure15: null,
      structure1h: null,
      cvd: null,
      orderflowSignals: [],
      offline: false,
      isDataFresh: false,
      engineStatus: 'pending',
      fibonacci: null,
      rsi: null,
    });
    expect(d.stance).toBe('ABSTAIN');
    expect(d.riskGated).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// EPC §5/§6 (Diretriz de Evolução Suprema, prioridade máxima): achado real
// de auditoria — pool.direcao é um argmax honesto SEM margem nenhuma sobre
// um pool que recomputa a cada tick de preço (App.tsx). Perto de qualquer
// fronteira de decisão, o stance publicado podia piscar LONG↔NEUTRAL a
// cada tick, criando e destruindo o Trade Plan repetidamente — o sintoma
// relatado ("frequentemente deixa de mostrar ENTRY/STOP/TARGET"). Testes
// de EXECUÇÃO REAL (matemática de fronteira, convenção deste projeto) para
// councilStanceWithHysteresis — a margem é calculada à mão a partir da
// MESMA fórmula real de opinionFromVote (peso 1 sem modulação de regime:
// pooled = média aritmética simples com 1 único agente direcional real).
// ─────────────────────────────────────────────────────────────────────────
import { councilStanceWithHysteresis, COUNCIL_STANCE_ENTER_MARGIN, COUNCIL_STANCE_EXIT_MARGIN } from '../src/nexus/council';

// 1 agente real votando (LIQUIDITY) + RISK saudável — quórum 1, peso 1 sem
// modulação: pooled = a própria opinião do agente (opinionFromVote), zero
// média com outros votos para manter a margem sob controle exato.
const singleVote = (stance: 'LONG' | 'SHORT', confidence: number, prevStance: Parameters<typeof aggregateCouncil>[2] = 'NEUTRAL') =>
  aggregateCouncil([vote('LIQUIDITY', stance, confidence), vote('RISK', 'NEUTRAL', 1)], 1, prevStance);

describe('councilStanceWithHysteresis: função pura, execução real — nunca fabrica direção, só atrasa a transição', () => {
  it('margem clara (>= ENTER) reivindica um lado NOVO mesmo sem stance anterior', () => {
    expect(councilStanceWithHysteresis('NEUTRAL', 'ALTA', { alta: 0.6, baixa: 0, neutro: 0.4 })).toBe('LONG');
    expect(councilStanceWithHysteresis('NEUTRAL', 'BAIXA', { alta: 0, baixa: 0.6, neutro: 0.4 })).toBe('SHORT');
  });

  it('zona morta (entre EXIT e ENTER): gruda no MESMO lado se prev já era esse lado', () => {
    const pooled = { alta: 0.54, baixa: 0, neutro: 0.46 }; // margem 0.08, entre 0.04 e 0.12
    expect(councilStanceWithHysteresis('LONG', 'ALTA', pooled)).toBe('LONG');
  });

  it('zona morta: NUNCA reivindica um lado novo (prev era NEUTRAL) — ENTER é obrigatório pra estrear', () => {
    const pooled = { alta: 0.54, baixa: 0, neutro: 0.46 }; // mesma margem 0.08 do teste acima
    expect(councilStanceWithHysteresis('NEUTRAL', 'ALTA', pooled)).toBe('NEUTRAL');
  });

  it('margem abaixo de EXIT: solta o lado mesmo com prev grudado (a favor não é o bastante pra segurar)', () => {
    const pooled = { alta: 0.51, baixa: 0, neutro: 0.49 }; // margem 0.02 < EXIT (0.04)
    expect(councilStanceWithHysteresis('LONG', 'ALTA', pooled)).toBe('NEUTRAL');
  });

  it('argmax cruzou pro lado OPOSTO: nunca herda o stance antigo, mesmo em zona morta do lado novo', () => {
    const pooled = { alta: 0, baixa: 0.54, neutro: 0.46 }; // BAIXA em zona morta (margem 0.08)
    expect(councilStanceWithHysteresis('LONG', 'BAIXA', pooled)).toBe('NEUTRAL'); // não vira SHORT sem ENTER, e não fica LONG (argmax não é mais ALTA)
  });

  it('argmax genuinamente NEUTRO nunca gruda, mesmo com prev direcional forte', () => {
    expect(councilStanceWithHysteresis('LONG', 'NEUTRO', { alta: 0.4, baixa: 0.1, neutro: 0.5 })).toBe('NEUTRAL');
    expect(councilStanceWithHysteresis('SHORT', 'NEUTRO', { alta: 0.1, baixa: 0.4, neutro: 0.5 })).toBe('NEUTRAL');
  });

  it('constantes são as documentadas no código-fonte (parâmetro declarado, nunca medição — mesma convenção de TARGET_LABEL_COMPACT_PCT)', () => {
    expect(COUNCIL_STANCE_ENTER_MARGIN).toBe(0.12);
    expect(COUNCIL_STANCE_EXIT_MARGIN).toBe(0.04);
    expect(COUNCIL_STANCE_EXIT_MARGIN).toBeLessThan(COUNCIL_STANCE_ENTER_MARGIN); // exit sempre mais estreito, senão a histerese não existe
  });
});

describe('aggregateCouncil: histerese fim-a-fim com votos reais (execução real, não só a função pura isolada)', () => {
  it('1º tick forte estabelece LONG; ticks seguintes na zona morta NÃO piscam de volta pra NEUTRAL — a cadeia real de prevStance segura', () => {
    const tick1 = singleVote('LONG', 0.60); // margem 0.20, ENTER claro
    expect(tick1.stance).toBe('LONG');
    const tick2 = singleVote('LONG', 0.54, tick1.stance); // margem 0.08, zona morta — SEM histerese isto seria NEUTRAL
    expect(tick2.stance).toBe('LONG');
    const tick3 = singleVote('LONG', 0.53, tick2.stance); // margem 0.06, ainda zona morta
    expect(tick3.stance).toBe('LONG');
  });

  it('mesma sequência SEM encadear prevStance (o bug original, prevStance sempre default NEUTRAL) — reproduz o flicker relatado', () => {
    const tick1 = singleVote('LONG', 0.60);
    expect(tick1.stance).toBe('LONG');
    const tick2 = singleVote('LONG', 0.54); // prevStance NÃO encadeado (default NEUTRAL) — mesma margem 0.08 do teste acima
    expect(tick2.stance).toBe('NEUTRAL'); // prova viva do sintoma: SEM a cadeia real de prevStance, o mesmo dado pisca
  });

  it('uma queda REAL abaixo de EXIT solta o LONG mesmo dentro da cadeia real', () => {
    const tick1 = singleVote('LONG', 0.60);
    const tick2 = singleVote('LONG', 0.51, tick1.stance); // margem 0.02 < EXIT
    expect(tick2.stance).toBe('NEUTRAL');
  });

  it('buildCouncilDecision aceita prevStance como 3º parâmetro opcional (default "NEUTRAL", nunca quebra um chamador de 2 argumentos)', () => {
    const withDefault = buildCouncilDecision({
      price: 100, liquidityZones: [], structure15: null, structure1h: null, cvd: null,
      orderflowSignals: [], offline: false, isDataFresh: true, engineStatus: 'ok', fibonacci: null, rsi: null,
    }, 1);
    expect(withDefault.stance).toBe('ABSTAIN'); // quórum 0, sem votos reais — comportamento intocado
  });
});

describe('App.tsx: prevStance lido da PRÓPRIA store (getState síncrono) antes de escrever a nova decisão — fiação real, nunca uma closure velha', () => {
  it('lê council?.stance da store real ANTES do buildCouncilDecision, e passa como 3º argumento', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('const prevStance = useUnifiedSnapshotStore.getState().council?.stance ?? "NEUTRAL";');
    expect(idx, 'leitura de prevStance não encontrada').toBeGreaterThan(-1);
    const block = app.slice(idx, idx + 550);
    expect(block).toContain('}, Date.now(), prevStance);');
  });
});
