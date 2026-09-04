// nexus-trap-detection.test.ts — V-MAX Fase 2: trava a detecção de
// armadilhas por CORROBORAÇÃO de eventos reais — sem evento, lista vazia;
// nunca uma armadilha especulativa.
import { describe, it, expect } from 'vitest';
import { detectInstitutionalTraps, TRAP_CORROBORATION_WINDOW_MS, clusterSweptPrices } from '../src/nexus/trap-detection';

const NOW = 1_000_000_000;
// index é irrelevante pro comportamento de detectInstitutionalTraps em si
// (só é repassado adiante pro canvas decidir decaimento por idade —
// achado real de captura de tela, v3) — valor fixo nos testes que não
// verificam sweptLevels[].index especificamente.
const eqh = (price: number, swept: boolean, index = 5) => ({ type: 'EQUAL_HIGH' as const, price, index, swept });
const eql = (price: number, swept: boolean, index = 5) => ({ type: 'EQUAL_LOW' as const, price, index, swept });
const sig = (type: string, ageMs: number) => ({ type, timestamp: NOW - ageMs });

describe('detectInstitutionalTraps: só eventos REAIS contam', () => {
  it('sem sweep e sem sinais => lista vazia honesta', () => {
    expect(detectInstitutionalTraps({ liquidityZones: [eqh(110, false), eql(90, false)], orderflowSignals: [], now: NOW })).toEqual([]);
  });

  it('EQH varrido sozinho => STOP_HUNT_TOPO com confiança 1/3 (evento real, interpretação fraca)', () => {
    const traps = detectInstitutionalTraps({ liquidityZones: [eqh(110, true)], orderflowSignals: [], now: NOW });
    expect(traps).toHaveLength(1);
    expect(traps[0].kind).toBe('STOP_HUNT_TOPO');
    expect(traps[0].confidence).toBeCloseTo(1 / 3, 12);
    expect(traps[0].evidence[0]).toContain('110.00');
  });

  it('sweep + 1 sinal real na janela => 2/3; + 2 sinais => 1.0 (escada documentada)', () => {
    const one = detectInstitutionalTraps({
      liquidityZones: [eql(90, true)],
      orderflowSignals: [sig('ABSORPTION', 5_000)],
      now: NOW,
    });
    expect(one[0].kind).toBe('STOP_HUNT_FUNDO');
    expect(one[0].confidence).toBeCloseTo(2 / 3, 12);

    const two = detectInstitutionalTraps({
      liquidityZones: [eql(90, true)],
      orderflowSignals: [sig('ABSORPTION', 5_000), sig('EXHAUSTION', 10_000)],
      now: NOW,
    });
    expect(two[0].confidence).toBe(1);
  });

  it('sinal FORA da janela real não corrobora', () => {
    const traps = detectInstitutionalTraps({
      liquidityZones: [eqh(110, true)],
      orderflowSignals: [sig('ABSORPTION', TRAP_CORROBORATION_WINDOW_MS + 1)],
      now: NOW,
    });
    expect(traps[0].confidence).toBeCloseTo(1 / 3, 12);
  });

  it('sinais OFI não contam como corroboração de sweep (só ABSORPTION/EXHAUSTION)', () => {
    const traps = detectInstitutionalTraps({
      liquidityZones: [eqh(110, true)],
      orderflowSignals: [sig('OFI', 1_000)],
      now: NOW,
    });
    expect(traps[0].confidence).toBeCloseTo(1 / 3, 12);
  });

  it('2+ ABSORPTION reais na janela => ABSORCAO_ANOMALA mesmo sem sweep', () => {
    const traps = detectInstitutionalTraps({
      liquidityZones: [],
      orderflowSignals: [sig('ABSORPTION', 1_000), sig('ABSORPTION', 8_000)],
      now: NOW,
    });
    expect(traps).toHaveLength(1);
    expect(traps[0].kind).toBe('ABSORCAO_ANOMALA');
    expect(traps[0].confidence).toBeCloseTo(2 / 3, 12);
  });

  it('1 ABSORPTION sozinha NÃO vira armadilha (2+ exigidos — nunca alarme de evento único)', () => {
    expect(detectInstitutionalTraps({
      liquidityZones: [],
      orderflowSignals: [sig('ABSORPTION', 1_000)],
      now: NOW,
    })).toEqual([]);
  });

  it('sweeps dos dois lados => as duas armadilhas reportadas separadas com evidência própria', () => {
    const traps = detectInstitutionalTraps({
      liquidityZones: [eqh(110, true), eql(90, true)],
      orderflowSignals: [],
      now: NOW,
    });
    expect(traps.map((t) => t.kind).sort()).toEqual(['STOP_HUNT_FUNDO', 'STOP_HUNT_TOPO']);
  });
});

describe('EPC OMEGA FINAL Etapa 10 (v3): sweptLevels — preço E índice real de candle expostos, sem recalcular', () => {
  it('STOP_HUNT_TOPO carrega o preço E o índice reais do(s) EQH varrido(s), mesmo número já usado em evidence', () => {
    const traps = detectInstitutionalTraps({ liquidityZones: [eqh(110, true, 42)], orderflowSignals: [], now: NOW });
    expect(traps[0].sweptLevels).toEqual([{ price: 110, index: 42 }]);
  });

  it('STOP_HUNT_FUNDO carrega o preço E o índice reais do(s) EQL varrido(s)', () => {
    const traps = detectInstitutionalTraps({ liquidityZones: [eql(90, true, 7)], orderflowSignals: [], now: NOW });
    expect(traps[0].sweptLevels).toEqual([{ price: 90, index: 7 }]);
  });

  it('múltiplos EQH varridos no mesmo ciclo => todos os níveis reais na lista, nenhum perdido', () => {
    const traps = detectInstitutionalTraps({
      liquidityZones: [eqh(110, true, 3), eqh(111.5, true, 9)],
      orderflowSignals: [],
      now: NOW,
    });
    expect(traps[0].sweptLevels.slice().sort((a, b) => a.price - b.price)).toEqual([
      { price: 110, index: 3 },
      { price: 111.5, index: 9 },
    ]);
  });

  it('ABSORCAO_ANOMALA não tem preço-âncora único real => sweptLevels vazio, nunca um nível fabricado', () => {
    const traps = detectInstitutionalTraps({
      liquidityZones: [],
      orderflowSignals: [sig('ABSORPTION', 1_000), sig('ABSORPTION', 8_000)],
      now: NOW,
    });
    expect(traps[0].sweptLevels).toEqual([]);
  });
});

// index é irrelevante pra CLUSTERIZAÇÃO em si (só o preço decide o
// agrupamento — mesma lógica de sempre); usado aqui só pra confirmar
// que latestIndex real (o MAIOR índice do grupo, nunca uma média) é
// calculado corretamente, base real do decaimento por idade no canvas.
const lvl = (price: number, index: number) => ({ price, index });

describe('clusterSweptPrices: agrupa preços varridos próximos (Lapidação Institucional — "8 SWEEPs consecutivos -> SWEEP ZONE") + latestIndex real (decaimento por idade)', () => {
  it('lista vazia => nenhum cluster', () => {
    expect(clusterSweptPrices([], 0.5)).toEqual([]);
  });

  it('1 nível => 1 cluster de tamanho 1, avgPrice = o próprio preço, latestIndex = o próprio índice', () => {
    expect(clusterSweptPrices([lvl(110, 12)], 0.5)).toEqual([{ avgPrice: 110, count: 1, latestIndex: 12 }]);
  });

  it('2 preços bem afastados (>proximityPct) => 2 clusters separados, cada um com seu próprio latestIndex', () => {
    // 110 -> 120: (10*100)/110 ≈ 9.09% >> 0.5% de proximityPct
    expect(clusterSweptPrices([lvl(110, 1), lvl(120, 2)], 0.5)).toEqual([
      { avgPrice: 110, count: 1, latestIndex: 1 },
      { avgPrice: 120, count: 1, latestIndex: 2 },
    ]);
  });

  it('caso hand-verified: [100@idx10, 100.3@idx20, 105@idx5] a 0.5% => cluster [100,100.3] (avg 100.15, latestIndex=MAX(10,20)=20) + cluster [105] isolado (latestIndex=5)', () => {
    // âncora fixa = 100 (primeiro membro real do cluster, nunca média rodante):
    //   100.3: (0.3*100)/100 = 0.30% <= 0.5% -> mesmo cluster
    //   105:   (5*100)/100   = 5.00% >  0.5% -> novo cluster (comparado à ÂNCORA 100, não a 100.3)
    const clusters = clusterSweptPrices([lvl(100, 10), lvl(100.3, 20), lvl(105, 5)], 0.5);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].count).toBe(2);
    expect(clusters[0].avgPrice).toBeCloseTo(100.15, 10);
    expect(clusters[0].latestIndex).toBe(20); // MAX real, nunca média — evidência mais recente do grupo
    expect(clusters[1]).toEqual({ avgPrice: 105, count: 1, latestIndex: 5 });
  });

  it('latestIndex é o MAIOR índice do grupo mesmo quando o membro mais recente NÃO é o de maior preço', () => {
    // cluster único (todos dentro de 0.5%): o preço mais alto (65030) tem o índice mais VELHO (1);
    // o preço mais baixo (65000) tem o índice mais NOVO (99) — latestIndex tem que pegar 99, não seguir a ordem de preço.
    const clusters = clusterSweptPrices([lvl(65000, 99), lvl(65010, 50), lvl(65030, 1)], 0.5);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].latestIndex).toBe(99);
  });

  it('ordem de entrada não importa — a função ordena internamente antes de agrupar', () => {
    const a = clusterSweptPrices([lvl(105, 3), lvl(100, 1), lvl(100.3, 2)], 0.5);
    const b = clusterSweptPrices([lvl(100.3, 2), lvl(105, 3), lvl(100, 1)], 0.5);
    expect(a).toEqual(b);
  });

  it('âncora fixa (nunca média rodante): 3 preços em degraus de 0.4% cada não encadeiam além do que a ÂNCORA permite', () => {
    // 100 -> 100.4 (0.40% da âncora 100, entra) -> 100.8 (0.80% da âNCORA 100, NÃO entra —
    // se fosse média rodante a partir de 100.2 teria ficado mais perto e poderia enganar).
    const clusters = clusterSweptPrices([lvl(100, 1), lvl(100.4, 2), lvl(100.8, 3)], 0.5);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toEqual({ avgPrice: 100.2, count: 2, latestIndex: 2 });
    expect(clusters[1]).toEqual({ avgPrice: 100.8, count: 1, latestIndex: 3 });
  });

  it('preços não-finitos são descartados, nunca propagados a um cluster fabricado', () => {
    expect(clusterSweptPrices([lvl(110, 1), lvl(NaN, 2), lvl(Infinity, 3), lvl(-Infinity, 4)], 0.5)).toEqual([
      { avgPrice: 110, count: 1, latestIndex: 1 },
    ]);
  });

  it('todos os preços dentro da mesma vizinhança => 1 cluster só, contagem real de todos os membros', () => {
    const clusters = clusterSweptPrices([lvl(65000, 1), lvl(65010, 2), lvl(65020, 3), lvl(65030, 4)], 0.5);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(4);
    expect(clusters[0].avgPrice).toBeCloseTo(65015, 10);
    expect(clusters[0].latestIndex).toBe(4);
  });
});
