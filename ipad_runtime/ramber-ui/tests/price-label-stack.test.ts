// price-label-stack.test.ts — execução REAL do resolvedor de colisão de
// rótulos de eixo (achado real de captura de tela do Operador: R1/VWAP/
// NL/último preço empilhados quando os valores reais ficam próximos).
import { describe, it, expect } from 'vitest';
import { resolveLabelStackPositions, resolveLabelTier, selectRelevantLabels, type RelevanceCandidate } from '../src/chart/price-label-stack';

describe('resolveLabelStackPositions: garantia absoluta de "nunca um objeto em cima do outro"', () => {
  it('vazio => vazio', () => {
    expect(resolveLabelStackPositions([], 16)).toEqual([]);
  });

  it('uma entrada sozinha nunca desloca', () => {
    const r = resolveLabelStackPositions([{ naturalY: 100, id: 'a' }], 16);
    expect(r).toEqual([{ naturalY: 100, id: 'a', resolvedY: 100 }]);
  });

  it('duas entradas LONGE (gap >= minGapPx) nunca deslocam — cada uma na própria posição natural', () => {
    const r = resolveLabelStackPositions([{ naturalY: 100 }, { naturalY: 200 }], 16);
    expect(r[0].resolvedY).toBe(100);
    expect(r[1].resolvedY).toBe(200);
  });

  it('exatamente NO limiar (gap === minGapPx) NÃO é colisão — fronteira estrita (< não <=)', () => {
    const r = resolveLabelStackPositions([{ naturalY: 100 }, { naturalY: 116 }], 16);
    expect(r[0].resolvedY).toBe(100);
    expect(r[1].resolvedY).toBe(116);
  });

  it('duas entradas colidindo: centraliza na MÉDIA das posições naturais, espaçadas exatamente minGapPx', () => {
    const r = resolveLabelStackPositions([{ naturalY: 100 }, { naturalY: 102 }], 16);
    // média = 101, k=2 => [101-8, 101+8]
    expect(r[0].resolvedY).toBeCloseTo(93, 10);
    expect(r[1].resolvedY).toBeCloseTo(109, 10);
    expect(r[1].resolvedY - r[0].resolvedY).toBeCloseTo(16, 10);
  });

  it('três entradas colidindo em cadeia (A-B perto, B-C perto, A-C longe na natural) viram UM grupo centrado', () => {
    // naturalY 100, 108, 116: A-B=8 (<16, colide), B-C=8 (<16, colide) — mas A-C=16 (não colidiria isolado)
    const r = resolveLabelStackPositions([{ naturalY: 100 }, { naturalY: 108 }, { naturalY: 116 }], 16);
    // média = 108, k=3 => [108-16, 108, 108+16] = [92, 108, 124]
    expect(r.map((e) => e.resolvedY)).toEqual([92, 108, 124]);
  });

  it('ordem relativa NUNCA inverte — quem tinha o menor naturalY continua com o menor resolvedY', () => {
    const r = resolveLabelStackPositions(
      [{ naturalY: 105, id: 'mid' }, { naturalY: 100, id: 'first' }, { naturalY: 101, id: 'second' }],
      16,
    );
    const byResolved = [...r].sort((a, b) => a.resolvedY - b.resolvedY).map((e) => e.id);
    const byNatural = [...r].sort((a, b) => a.naturalY - b.naturalY).map((e) => e.id);
    expect(byResolved).toEqual(byNatural);
  });

  it('garantia absoluta: em QUALQUER saída, nenhum par consecutivo fica a menos de minGapPx — mesmo em clusters adjacentes que colidiriam depois de centralizados', () => {
    // Dois clusters de 3 cada, colados um no outro (o centro do cluster
    // esquerdo pode empurrar sua borda direita para dentro do cluster
    // direito depois de centralizar) — exatamente o caso que a passada
    // de segurança existe para cobrir.
    const entries = [
      { naturalY: 0 }, { naturalY: 4 }, { naturalY: 8 },   // cluster 1 (span natural 8)
      { naturalY: 20 }, { naturalY: 24 }, { naturalY: 28 }, // cluster 2 (span natural 8), só 12px do cluster 1
    ];
    const r = resolveLabelStackPositions(entries, 16);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].resolvedY - r[i - 1].resolvedY).toBeGreaterThanOrEqual(16 - 1e-9);
    }
  });

  it('caso real (captura de tela do Operador, BTC/USDT 1H): 4 níveis próximos (R1/VWAP/NL/último preço) formam um grupo; EMA, bem mais longe, fica sozinho', () => {
    // Y natural crescente com a queda de preço (mais alto no eixo = Y menor).
    const entries = [
      { naturalY: 100, id: 'R1' },
      { naturalY: 108, id: 'VWAP' },
      { naturalY: 110, id: 'NL' },
      { naturalY: 118, id: 'last' },
      { naturalY: 260, id: 'EMA' }, // bem mais abaixo — nunca deveria deslocar nem ser deslocado
    ];
    const r = resolveLabelStackPositions(entries, 16);
    const ema = r.find((e) => e.id === 'EMA')!;
    expect(ema.resolvedY).toBe(260); // sozinho, nunca desloca
    // os 4 primeiros formam um grupo — nenhum par fica a menos de 16px
    const cluster = r.filter((e) => e.id !== 'EMA');
    for (let i = 1; i < cluster.length; i++) {
      expect(cluster[i].resolvedY - cluster[i - 1].resolvedY).toBeGreaterThanOrEqual(16 - 1e-9);
    }
    // e a ordem real (R1 acima de VWAP acima de NL acima do último preço) nunca inverte
    expect(cluster.map((e) => e.id)).toEqual(['R1', 'VWAP', 'NL', 'last']);
  });

  it('nunca perde nenhuma entrada — length da saída sempre igual à da entrada', () => {
    const entries = Array.from({ length: 7 }, (_, i) => ({ naturalY: i * 3 }));
    expect(resolveLabelStackPositions(entries, 16)).toHaveLength(7);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// selectRelevantLabels — achado real de captura de tela do Operador (iPad,
// ZECUSDT 1H ao vivo): 11 etiquetas de contexto empilhadas na lateral
// esquerda, cobrindo o primeiro terço das velas. Execução REAL (não padrão
// de fonte): o bug mais provável aqui é "a matemática de relevância está
// sutilmente errada" (podar o nível errado, podar uma leitura viva, ou
// apagar dois níveis distintos que só por acaso têm o mesmo texto), não
// "esqueceram de conectar A com B" — convenção mista do CLAUDE.md.
describe('selectRelevantLabels: hierarquia + teto de densidade, sem nunca apagar dado real', () => {
  // Mesma forma real que EnhancedChart_110_Percent.tsx empilha em
  // priceAxisLabels: side ausente = "acionável agora" (direita/primary),
  // side:"left" = mapa estrutural (context), tier explícito só no preço vivo.
  type Candidate = RelevanceCandidate;
  const ctx = (price: number, text: string): Candidate => ({ price, text, side: 'left' });
  const live = (price: number): Candidate => ({ price, text: String(price), tier: 'live' });
  const primary = (price: number, text: string): Candidate => ({ price, text });

  it('cenário REAL da captura (11 etiquetas de contexto à esquerda, preço vivo 481.40): sobram exatamente as 5 mais próximas do preço — as mais distantes saem primeiro', () => {
    const labels = [
      ctx(484.52, 'ÁSIA H 484.52'),
      ctx(483.90, '◆ Sessão Baixa + VWAP + Nexus Line'),
      ctx(481.10, 'ÁSIA L 481.10'),
      ctx(486.20, '⚡ SWEEP ZONE ↑ (3x)'),
      ctx(485.60, '◆ FVG Alta + Sweep'),
      ctx(487.10, '⚡ SWEEP ZONE ↑ (2x)'),
      ctx(488.40, '◆ FVG Alta + Sweep'),
      ctx(479.80, '⚡ SWEEP ↓'),
      ctx(478.90, '◆ Sweep + EQL'),
      ctx(477.20, '⚡ SWEEP ↓'),
      ctx(476.10, '◆ EQL + S1'),
      live(481.40),
    ];
    const out = selectRelevantLabels(labels, 481.40, 5);
    const kept = out.filter((l) => l.side === 'left').map((l) => l.price);
    expect(kept).toHaveLength(5);
    // as 5 realmente mais próximas de 481.40, nada além disso
    expect(new Set(kept)).toEqual(new Set([481.10, 479.80, 483.90, 484.52, 478.90]));
    // a distante (476.10, ~1.1% abaixo) não sobrevive
    expect(kept).not.toContain(476.10);
  });

  it('live e primary NUNCA são podados, por mais denso que o gráfico esteja — só contexto tem teto', () => {
    const labels = [
      live(481.40),
      primary(482.25, 'VWAP ↓ 482.25'),
      primary(482.51, 'NL ↓ 482.51'),
      primary(483.23, 'EMA 21 483.23'),
      primary(479.00, 'ST · BREACHED'),
      primary(490.00, 'TP1 · 1:2.10'),
      ...Array.from({ length: 12 }, (_, i) => ctx(500 + i, `CTX ${i}`)),
    ];
    const out = selectRelevantLabels(labels, 481.40, 5);
    expect(out.filter((l) => l.tier === 'live')).toHaveLength(1);
    expect(out.filter((l) => l.side !== 'left' && !l.tier)).toHaveLength(5);
    expect(out.filter((l) => l.side === 'left')).toHaveLength(5);
  });

  it('dois níveis DISTINTOS com o mesmo texto ("⚡ SWEEP ↓" em 2 preços) são dois níveis reais — nunca deduplicados por texto (Regra de Ouro 4: seria apagar um preço)', () => {
    const labels = [ctx(479.80, '⚡ SWEEP ↓'), ctx(477.20, '⚡ SWEEP ↓'), live(481.40)];
    const out = selectRelevantLabels(labels, 481.40, 5);
    expect(out.filter((l) => l.text === '⚡ SWEEP ↓')).toHaveLength(2);
  });

  it('redundância PURA (mesmo lado + mesmo texto + mesmo preço) sai — é o único caso indistinguível na tela', () => {
    const labels = [ctx(479.80, '⚡ SWEEP ↓'), ctx(479.80, '⚡ SWEEP ↓'), live(481.40)];
    const out = selectRelevantLabels(labels, 481.40, 5);
    expect(out.filter((l) => l.text === '⚡ SWEEP ↓')).toHaveLength(1);
  });

  it('fail-closed: sem preço de referência (antes do primeiro tick real), nunca inventa distância — mantém as N primeiras na ordem de montagem, determinístico', () => {
    const labels = Array.from({ length: 9 }, (_, i) => ctx(400 + i, `CTX ${i}`));
    const out = selectRelevantLabels(labels, null, 5);
    expect(out.map((l) => l.text)).toEqual(['CTX 0', 'CTX 1', 'CTX 2', 'CTX 3', 'CTX 4']);
    // e é estável: a mesma entrada devolve exatamente a mesma saída
    expect(selectRelevantLabels(labels, null, 5).map((l) => l.text)).toEqual(out.map((l) => l.text));
  });

  it('preço não-finito nunca vira etiqueta (fail-closed), mesmo declarando tier', () => {
    const labels = [ctx(NaN, 'S1 lixo'), ctx(Infinity, 'R1 lixo'), ctx(481.0, 'S1 real'), live(481.40)];
    const out = selectRelevantLabels(labels, 481.40, 5);
    expect(out.map((l) => l.text)).toEqual(['S1 real', '481.4']);
  });

  it('abaixo do teto, nada é tocado — a lista sai idêntica e na ordem original', () => {
    const labels = [ctx(479, 'A'), ctx(480, 'B'), live(481.40), primary(482, 'VWAP')];
    expect(selectRelevantLabels(labels, 481.40, 5)).toEqual(labels);
  });
});

describe('resolveLabelTier: o default deriva do lado, para nenhum dos ~20 pontos de push precisar declarar o campo', () => {
  it('esquerda = mapa estrutural = context; direita (e ausente) = acionável agora = primary', () => {
    expect(resolveLabelTier('left', undefined)).toBe('context');
    expect(resolveLabelTier('right', undefined)).toBe('primary');
    expect(resolveLabelTier(undefined, undefined)).toBe('primary');
  });

  it('tier explícito sempre vence o default — é assim que o preço vivo vira `live` mesmo estando à direita', () => {
    expect(resolveLabelTier('right', 'live')).toBe('live');
    expect(resolveLabelTier('left', 'primary')).toBe('primary');
  });
});

describe('resolveLabelTier: `critical` (Ordem "Lapidação Visual Final e Sincronia Operacional" §3, Nível A) nunca deriva por default — só tier explícito', () => {
  it('side sozinho NUNCA produz "critical" — só live/primary/context nascem de default', () => {
    expect(resolveLabelTier('right', undefined)).not.toBe('critical');
    expect(resolveLabelTier('left', undefined)).not.toBe('critical');
    expect(resolveLabelTier(undefined, undefined)).not.toBe('critical');
  });

  it('tier:"critical" explícito sempre vence, em qualquer lado', () => {
    expect(resolveLabelTier('right', 'critical')).toBe('critical');
    expect(resolveLabelTier('left', 'critical')).toBe('critical');
    expect(resolveLabelTier(undefined, 'critical')).toBe('critical');
  });
});

describe('selectRelevantLabels: `critical` nunca é podado — mesma garantia de live/primary, só context tem teto', () => {
  it('EN/ST/TP (critical) sobrevivem mesmo com o eixo cheio de contexto', () => {
    const live = { price: 481.4, text: '481.40', tier: 'live' as const };
    const critical = [
      { price: 480.0, text: 'EN LONG · retest', tier: 'critical' as const },
      { price: 478.5, text: 'ST · stop real', tier: 'critical' as const },
      { price: 490.0, text: 'TP1 · 2.10%', tier: 'critical' as const },
    ];
    const ctxFlood = Array.from({ length: 12 }, (_, i) => ({
      price: 500 + i,
      text: `CTX ${i}`,
      side: 'left' as const,
    }));
    const out = selectRelevantLabels([live, ...critical, ...ctxFlood], 481.4, 5);
    for (const c of critical) {
      expect(out.some((l) => l.text === c.text && l.price === c.price)).toBe(true);
    }
  });
});
