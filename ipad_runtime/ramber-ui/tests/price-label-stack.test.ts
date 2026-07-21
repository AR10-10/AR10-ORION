// price-label-stack.test.ts — execução REAL do resolvedor de colisão de
// rótulos de eixo (achado real de captura de tela do Operador: R1/VWAP/
// NL/último preço empilhados quando os valores reais ficam próximos).
import { describe, it, expect } from 'vitest';
import { resolveLabelStackPositions } from '../src/chart/price-label-stack';

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
