// nexus-institutional-zones.test.ts — DIRETIVA FINAL §4 ("Consolidação
// de zonas"): execução real do clustering por proximidade de preço entre
// ferramentas independentes. Casos hand-verified com preços redondos para
// tornar a aritmética conferível a olho nu.
import { describe, it, expect } from 'vitest';
import {
  computeInstitutionalZones,
  INSTITUTIONAL_ZONE_CONTRACT_VERSION,
  INSTITUTIONAL_ZONE_PROXIMITY_PCT,
  MIN_DISTINCT_SOURCES_FOR_ZONE,
  MAX_INSTITUTIONAL_ZONES,
  type InstitutionalZoneInput,
} from '../src/nexus/institutional-zones';

const emptyInput: InstitutionalZoneInput = {
  ema: null,
  vwap: null,
  nexusLine: null,
  fairValueGaps: [],
  orderBlocks: [],
  liquidityZones: [],
  support: null,
  resistance: null,
  volumeProfilePoc: null,
  sessionKeyLevel: null,
  liquiditySweeps: [],
  lastSwingHigh: null,
  lastSwingLow: null,
};

describe('constantes do contrato', () => {
  it('versão e limiares reais expostos', () => {
    expect(INSTITUTIONAL_ZONE_CONTRACT_VERSION).toBe(1);
    expect(INSTITUTIONAL_ZONE_PROXIMITY_PCT).toBeGreaterThan(0);
    expect(MIN_DISTINCT_SOURCES_FOR_ZONE).toBe(2);
    expect(MAX_INSTITUTIONAL_ZONES).toBeGreaterThan(0);
  });
});

describe('computeInstitutionalZones: honestidade fail-closed', () => {
  it('entrada totalmente vazia => [] honesto', () => {
    expect(computeInstitutionalZones(emptyInput)).toEqual([]);
  });

  it('uma ÚNICA ferramenta real disponível (só EMA) => [] — nunca uma "zona" de 1 fonte', () => {
    const r = computeInstitutionalZones({ ...emptyInput, ema: { period: 21, value: 100000 } });
    expect(r).toEqual([]);
  });

  it('valores não-finitos são omitidos silenciosamente (NaN/Infinity nunca viram membro)', () => {
    const r = computeInstitutionalZones({
      ...emptyInput,
      ema: { period: 21, value: NaN },
      vwap: Infinity,
      nexusLine: 100000,
    });
    expect(r).toEqual([]); // só nexusLine sobra real — 1 fonte, sem confluência
  });

  it('EMA com período inválido (<=0 ou não-finito) é omitida mesmo com valor real', () => {
    const r = computeInstitutionalZones({
      ...emptyInput,
      ema: { period: 0, value: 100000 },
      vwap: 100000,
    });
    expect(r).toEqual([]); // EMA descartada por período inválido — só VWAP sobra, 1 fonte
  });
});

describe('computeInstitutionalZones: confluência real cruzada', () => {
  it('2 ferramentas DISTINTAS próximas => 1 Zona Institucional real', () => {
    const r = computeInstitutionalZones({
      ...emptyInput,
      ema: { period: 21, value: 100000 },
      vwap: 100200, // 0.2% de distância, dentro do limiar padrão (0.35%)
    });
    expect(r).toHaveLength(1);
    expect(r[0].distinctSourceCount).toBe(2);
    expect(r[0].members.map((m) => m.sourceKind).sort()).toEqual(['EMA', 'VWAP']);
  });

  it('ACHADO ADVERSARIAL (mesma disciplina de clusterSweptPrices): 2 instâncias da MESMA ferramenta (2 Order Blocks) nunca formam confluência sozinhas', () => {
    const r = computeInstitutionalZones({
      ...emptyInput,
      orderBlocks: [
        { type: 'BULLISH', top: 100100, bottom: 99900 }, // mid 100000
        { type: 'BEARISH', top: 100300, bottom: 100100 }, // mid 100200 — BULLISH/BEARISH são o MESMO sourceKind (ORDER_BLOCK)
      ],
    });
    expect(r).toEqual([]);
  });

  it('mesma dupla de Order Blocks acima + 1 EMA real na mesma região => AGORA vira Zona Institucional real (3 membros, 2 ferramentas distintas)', () => {
    const r = computeInstitutionalZones({
      ...emptyInput,
      ema: { period: 21, value: 100050 },
      orderBlocks: [
        { type: 'BULLISH', top: 100100, bottom: 99900 },
        { type: 'BEARISH', top: 100300, bottom: 100100 },
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0].members).toHaveLength(3);
    expect(r[0].distinctSourceCount).toBe(2); // EMA + ORDER_BLOCK — 2 FERRAMENTAS, não 3 instâncias
  });

  it('Diretriz Consolidação §6: Suporte/Resistência (S1/R1) agora alimenta o consolidador — 2 ferramentas distintas (S1 + EMA) formam zona real', () => {
    const r = computeInstitutionalZones({
      ...emptyInput,
      ema: { period: 21, value: 100000 },
      support: 100150, // 0.15% de distância, dentro do limiar padrão (0.35%)
    });
    expect(r).toHaveLength(1);
    expect(r[0].distinctSourceCount).toBe(2);
    expect(r[0].members.map((m) => m.sourceKind).sort()).toEqual(['EMA', 'SUPPORT_RESISTANCE']);
    expect(r[0].members.find((m) => m.sourceKind === 'SUPPORT_RESISTANCE')?.label).toBe('S1');
  });

  it('S1 e R1 são a MESMA ferramenta (SUPPORT_RESISTANCE) — juntos sozinhos nunca formam confluência cruzada', () => {
    const r = computeInstitutionalZones({
      ...emptyInput,
      support: 100000,
      resistance: 100100, // perto o bastante de se agrupar, mas ambos SUPPORT_RESISTANCE
    });
    expect(r).toEqual([]); // 1 ferramenta só (2 instâncias), mesma disciplina do teste adversarial de Order Blocks acima
  });

  it('3 ferramentas distintas concordando => distinctSourceCount real 3', () => {
    const r = computeInstitutionalZones({
      ...emptyInput,
      ema: { period: 21, value: 100000 },
      vwap: 100100,
      nexusLine: 99950,
    });
    expect(r).toHaveLength(1);
    expect(r[0].distinctSourceCount).toBe(3);
  });

  it('envelope top/bottom real: usa o TOP/BOTTOM verdadeiro de zonas (FVG), nunca só o ponto médio', () => {
    const r = computeInstitutionalZones({
      ...emptyInput,
      ema: { period: 21, value: 100420 },
      fairValueGaps: [{ type: 'BULLISH', top: 100500, bottom: 100300 }], // mid 100400, perto da EMA (100420)
    });
    expect(r).toHaveLength(1);
    expect(r[0].top).toBe(100500); // top real do FVG, nunca o mid
    expect(r[0].bottom).toBe(100300); // bottom real do FVG
  });
});

describe('computeInstitutionalZones: clustering por ÂNCORA FIXA (nunca média móvel)', () => {
  it('achado adversarial: um membro no limite do grupo NUNCA arrasta a âncora — divide em 2 zonas reais mesmo com vizinhos próximos em cadeia', () => {
    // proximityPct=0.5% de 100000 = limiar de 500 em preço absoluto.
    const r = computeInstitutionalZones({
      ema: { period: 21, value: 100000 }, // âncora do grupo 1
      vwap: 100400, // 400 de distância da âncora 100000 <= 500 → entra no grupo 1
      nexusLine: 100800, // 800 de distância da âncora 100000 → NÃO entra no grupo 1 (mesmo estando a só 400 do VWAP); vira âncora do grupo 2
      fairValueGaps: [],
      orderBlocks: [],
      support: null,
      resistance: null,
      liquidityZones: [{ type: 'EQUAL_HIGH', price: 101100 }], // 300 de distância da âncora 100800 <= 500 → entra no grupo 2
      volumeProfilePoc: null,
      sessionKeyLevel: null,
      liquiditySweeps: [],
      lastSwingHigh: null,
      lastSwingLow: null,
      proximityPct: 0.5,
    });
    expect(r).toHaveLength(2);
    const g1 = r.find((z) => z.members.some((m) => m.sourceKind === 'EMA'))!;
    const g2 = r.find((z) => z.members.some((m) => m.sourceKind === 'NEXUS_LINE'))!;
    expect(g1.members.map((m) => m.sourceKind).sort()).toEqual(['EMA', 'VWAP']);
    expect(g1.bottom).toBe(100000);
    expect(g1.top).toBe(100400);
    expect(g2.members.map((m) => m.sourceKind).sort()).toEqual(['LIQUIDITY_EQH', 'NEXUS_LINE']);
    expect(g2.bottom).toBe(100800);
    expect(g2.top).toBe(101100);
  });

  it('Evolução Total (Ordem Nº 03 §3 executada): lastSwingHigh/lastSwingLow são a 11ª fonte real — formam confluência com outra ferramenta', () => {
    const r = computeInstitutionalZones({
      ...emptyInput,
      vwap: 100050,
      lastSwingHigh: 100000, // a 0.05% do VWAP — mesmo grupo real
    });
    expect(r).toHaveLength(1);
    expect(r[0].distinctSourceCount).toBe(2);
    const swing = r[0].members.find((m) => m.sourceKind === 'MARKET_STRUCTURE_SWING');
    expect(swing).toBeDefined();
    expect(swing!.label).toBe('Swing H');
    expect(swing!.price).toBe(100000);
  });

  it('swing sozinho nunca vira zona (1 fonte); high e low são a MESMA ferramenta (distinctSourceCount não dobra)', () => {
    // Sozinho: nenhuma zona.
    expect(computeInstitutionalZones({ ...emptyInput, lastSwingHigh: 100000 })).toEqual([]);
    // High + Low da mesma ferramenta juntos no mesmo cluster: 2 membros,
    // mas 1 ferramenta distinta — segue sem zona (MIN_DISTINCT_SOURCES=2
    // exige ferramentas DIFERENTES, mesma regra das 2 Order Blocks vizinhas).
    expect(
      computeInstitutionalZones({ ...emptyInput, lastSwingHigh: 100000, lastSwingLow: 99950 }),
    ).toEqual([]);
  });

  it('swing não-finito é omitido silenciosamente (fail-closed, nunca membro fabricado)', () => {
    const r = computeInstitutionalZones({
      ...emptyInput,
      vwap: 100050,
      lastSwingHigh: NaN,
      lastSwingLow: null,
    });
    expect(r).toEqual([]); // só VWAP sobra real — 1 fonte, sem confluência
  });

  it('borda exata do limiar (<=) inclui; um tick além exclui', () => {
    const atThreshold = computeInstitutionalZones({
      ...emptyInput,
      ema: { period: 21, value: 100000 },
      vwap: 101000, // exatamente 1% de 100000
      proximityPct: 1,
    });
    expect(atThreshold).toHaveLength(1);

    const justBeyond = computeInstitutionalZones({
      ...emptyInput,
      ema: { period: 21, value: 100000 },
      vwap: 101000.01, // 1 tick além de 1%
      proximityPct: 1,
    });
    expect(justBeyond).toEqual([]);
  });
});

describe('computeInstitutionalZones: ordenação e teto real', () => {
  it('zona com mais ferramentas distintas vem primeiro, independente da ordem de preço', () => {
    const r = computeInstitutionalZones({
      ema: { period: 21, value: 200000 }, // grupo distante, só 2 fontes
      vwap: 200100,
      nexusLine: 100100, // grupo de preço MENOR, mas 3 fontes reais
      fairValueGaps: [{ type: 'BULLISH', top: 100150, bottom: 100050 }],
      orderBlocks: [{ type: 'BULLISH', top: 100120, bottom: 100080 }],
      liquidityZones: [],
      support: null,
      resistance: null,
      volumeProfilePoc: null,
      sessionKeyLevel: null,
      liquiditySweeps: [],
      lastSwingHigh: null,
      lastSwingLow: null,
    });
    expect(r.length).toBeGreaterThanOrEqual(2);
    expect(r[0].distinctSourceCount).toBe(3); // NEXUS_LINE + FVG + OB (200000-region só tem 2: EMA + VWAP)
    expect(r[0].centerPrice).toBeLessThan(r[1].centerPrice);
  });

  it('mais de MAX_INSTITUTIONAL_ZONES clusters reais => corta nas mais fortes, nunca retorna sem limite', () => {
    // 6 clusters bem separados (>>proximityPct entre si), cada um com 2 fontes reais.
    const liquidityZones: { type: 'EQUAL_HIGH'; price: number }[] = [];
    for (let i = 0; i < 6; i++) liquidityZones.push({ type: 'EQUAL_HIGH', price: 100000 * (i + 1) });
    const orderBlocks = liquidityZones.map((z) => ({ type: 'BULLISH' as const, top: z.price + 10, bottom: z.price - 10 }));
    const r = computeInstitutionalZones({ ...emptyInput, liquidityZones, orderBlocks });
    expect(r.length).toBe(MAX_INSTITUTIONAL_ZONES);
    for (const z of r) expect(z.distinctSourceCount).toBeGreaterThanOrEqual(MIN_DISTINCT_SOURCES_FOR_ZONE);
  });
});

describe('EPC OMEGA FINAL Parte 2 §7: 3 fontes novas (Volume Profile POC, Session Key Level, Liquidity Sweep)', () => {
  it('POC + suporte reais na mesma faixa formam a zona VOLUME_PROFILE_POC+SUPPORT_RESISTANCE que a diretiva pede (Volume Profile+S/R)', () => {
    const r = computeInstitutionalZones({ ...emptyInput, volumeProfilePoc: 100000, support: 100100 });
    expect(r).toHaveLength(1);
    expect(r[0].members.map((m) => m.sourceKind).sort()).toEqual(['SUPPORT_RESISTANCE', 'VOLUME_PROFILE_POC']);
  });

  it('sessionKeyLevel: high e low reais viram 2 membros do MESMO sourceKind (nunca inflam distinctSourceCount sozinhos)', () => {
    const r = computeInstitutionalZones({ ...emptyInput, sessionKeyLevel: { high: 100050, low: 99950 }, vwap: 100000 });
    // high(100050) e low(99950) ficam a 0.1% de distância um do outro — dentro
    // do proximityPct default (0.35%) — então os 3 membros (high/low/vwap)
    // caem no mesmo grupo; SESSION_KEY_LEVEL conta como 1 fonte distinta só.
    expect(r).toHaveLength(1);
    const kinds = r[0].members.map((m) => m.sourceKind);
    expect(kinds.filter((k) => k === 'SESSION_KEY_LEVEL')).toHaveLength(2);
    expect(r[0].distinctSourceCount).toBe(2); // SESSION_KEY_LEVEL + VWAP, nunca 3
  });

  it('sweep real + FVG na mesma faixa formam a zona FAIR_VALUE_GAP+LIQUIDITY_SWEEP que a diretiva pede (FVG+Sweep)', () => {
    const r = computeInstitutionalZones({
      ...emptyInput,
      liquiditySweeps: [{ price: 100000 }],
      fairValueGaps: [{ type: 'BULLISH', top: 100100, bottom: 99950 }],
    });
    expect(r).toHaveLength(1);
    expect(r[0].members.map((m) => m.sourceKind).sort()).toEqual(['FAIR_VALUE_GAP', 'LIQUIDITY_SWEEP']);
  });

  it('múltiplos sweeps reais viram múltiplos membros LIQUIDITY_SWEEP, um por cluster recebido', () => {
    const r = computeInstitutionalZones({
      ...emptyInput,
      liquiditySweeps: [{ price: 100000 }, { price: 100050 }],
      vwap: 100010,
    });
    expect(r).toHaveLength(1);
    expect(r[0].members.filter((m) => m.sourceKind === 'LIQUIDITY_SWEEP')).toHaveLength(2);
  });

  it('fail-closed: POC/sessionKeyLevel/sweeps não-finitos ou ausentes nunca viram membro fabricado', () => {
    expect(computeInstitutionalZones({ ...emptyInput, volumeProfilePoc: NaN, vwap: 100000 })).toEqual([]);
    expect(computeInstitutionalZones({ ...emptyInput, sessionKeyLevel: null, vwap: 100000 })).toEqual([]);
    expect(computeInstitutionalZones({ ...emptyInput, liquiditySweeps: [{ price: NaN }], vwap: 100000 })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// FONTES 12 E 13 — SuperTrend e Breaker/Mitigation Block.
//
// ACHADO DE AUDITORIA (pedido do Operador: "ver o que que tá faltando pra
// adicionar"): as duas camadas graduadas na rodada anterior chegavam ao
// gráfico mas NÃO alimentavam este consolidador — a mesma classe de lacuna
// de fiação que já tinha acontecido com S1/R1 e com os swings fractais.
//
// O efeito era o contrário do que o Operador quer: um SuperTrend parado
// exatamente sobre VWAP+OB é uma ferramenta independente A MAIS
// concordando naquele preço, e a contagem exibida ("4F") saía menor que a
// realidade. E consolidar REDUZ desenho repetido — é o mecanismo que existe
// justamente para isso.
// ---------------------------------------------------------------------------
describe('SuperTrend como fonte real de confluência', () => {
  it('entra como membro pontual, igual a EMA/VWAP/Nexus Line', () => {
    const zonas = computeInstitutionalZones({
      ...emptyInput,
      vwap: 100,
      superTrendLine: 100.1,
    });
    expect(zonas).toHaveLength(1);
    expect(zonas[0].members.map((m) => m.label).sort()).toEqual(['SuperTrend', 'VWAP']);
    expect(zonas[0].distinctSourceCount).toBe(2);
  });

  it('AUMENTA a contagem real quando concorda com outras ferramentas', () => {
    const semST = computeInstitutionalZones({ ...emptyInput, vwap: 100, support: 100.1 });
    const comST = computeInstitutionalZones({
      ...emptyInput,
      vwap: 100,
      support: 100.1,
      superTrendLine: 100.05,
    });
    expect(semST[0].distinctSourceCount).toBe(2);
    expect(comST[0].distinctSourceCount).toBe(3);
  });

  it('sozinho NUNCA vira zona — a regra de 2 fontes independentes vale para ele também', () => {
    expect(computeInstitutionalZones({ ...emptyInput, superTrendLine: 100 })).toEqual([]);
  });

  it('fail-closed: ausente ou não-finito => resultado idêntico ao de antes desta fonte existir', () => {
    const base = computeInstitutionalZones({ ...emptyInput, vwap: 100, support: 100.1 });
    for (const v of [undefined, null, NaN, Infinity]) {
      expect(
        computeInstitutionalZones({ ...emptyInput, vwap: 100, support: 100.1, superTrendLine: v as number }),
        `superTrendLine ${String(v)}`,
      ).toEqual(base);
    }
  });
});

describe('Breaker / Mitigation Block como fontes reais de confluência', () => {
  it('entram como membros de FAIXA, igual a FVG/Order Block', () => {
    const zonas = computeInstitutionalZones({
      ...emptyInput,
      vwap: 100,
      institutionalBlocks: [{ kind: 'BREAKER', top: 100.2, bottom: 99.9 }],
    });
    expect(zonas).toHaveLength(1);
    const breaker = zonas[0].members.find((m) => m.label === 'Breaker');
    expect(breaker, 'membro Breaker ausente').toBeDefined();
    expect(breaker!.top).toBe(100.2);
    expect(breaker!.bottom).toBe(99.9);
  });

  it('BREAKER e MITIGATION são sourceKinds DISTINTOS — nunca fundidos num só', () => {
    // São fenômenos estruturais diferentes (um varreu liquidez antes de
    // falhar, o outro não). Tratá-los como a mesma fonte inflaria a
    // contagem com uma concordância que não existe, ou apagaria informação
    // real (Regra de Ouro 4) — depende do lado do erro.
    const zonas = computeInstitutionalZones({
      ...emptyInput,
      institutionalBlocks: [
        { kind: 'BREAKER', top: 100.1, bottom: 100 },
        { kind: 'MITIGATION', top: 100.15, bottom: 100.05 },
      ],
    });
    expect(zonas).toHaveLength(1);
    expect(zonas[0].distinctSourceCount).toBe(2);
    expect(zonas[0].members.map((m) => m.label).sort()).toEqual(['Breaker', 'Mitigation']);
  });

  it('dois blocos do MESMO tipo contam como UMA fonte — concordância real, não repetição', () => {
    const zonas = computeInstitutionalZones({
      ...emptyInput,
      vwap: 100,
      institutionalBlocks: [
        { kind: 'BREAKER', top: 100.1, bottom: 100 },
        { kind: 'BREAKER', top: 100.15, bottom: 100.05 },
      ],
    });
    expect(zonas).toHaveLength(1);
    // 2 membros Breaker, mas UMA fonte distinta + VWAP = 2.
    expect(zonas[0].distinctSourceCount).toBe(2);
  });

  it('fail-closed: lista ausente, vazia ou com faixa inválida não muda nada', () => {
    const base = computeInstitutionalZones({ ...emptyInput, vwap: 100, support: 100.1 });
    expect(computeInstitutionalZones({ ...emptyInput, vwap: 100, support: 100.1 })).toEqual(base);
    expect(
      computeInstitutionalZones({ ...emptyInput, vwap: 100, support: 100.1, institutionalBlocks: [] }),
    ).toEqual(base);
    expect(
      computeInstitutionalZones({
        ...emptyInput,
        vwap: 100,
        support: 100.1,
        institutionalBlocks: [{ kind: 'BREAKER', top: NaN, bottom: 99 }],
      }),
    ).toEqual(base);
  });
});

describe('as fontes novas não mexem em nada que já funcionava', () => {
  it('sem nenhuma das duas, toda leitura anterior é byte a byte a mesma', () => {
    const antes: InstitutionalZoneInput = {
      ...emptyInput,
      ema: { period: 21, value: 100 },
      vwap: 100.1,
      nexusLine: 100.05,
      support: 99.95,
      volumeProfilePoc: 100.2,
      liquiditySweeps: [{ price: 100.15 }],
      lastSwingHigh: 100.25,
    };
    const depois = computeInstitutionalZones({ ...antes, superTrendLine: null, institutionalBlocks: [] });
    expect(depois).toEqual(computeInstitutionalZones(antes));
  });
});
