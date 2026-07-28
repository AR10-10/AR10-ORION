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
