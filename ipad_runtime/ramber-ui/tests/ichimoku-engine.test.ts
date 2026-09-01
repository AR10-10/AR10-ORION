// ichimoku-engine.test.ts — execução REAL do motor Ichimoku Kinko Hyo.
// Os valores esperados vêm da fórmula pesquisada aplicada à mão sobre
// fixtures construídas de propósito para cada caso, nunca de uma
// calculadora de terceiros sem conferência.
//
// O que estes testes protegem, em ordem de importância:
//  1. Que as linhas sejam PONTO MÉDIO DE EXTREMOS, não média de close (o
//     erro clássico — produz curvas parecidas e valores errados).
//  2. Que o deslocamento seja real nos DOIS sentidos, com o sinal certo.
//  3. Que a nuvem futura exista fora do array alinhado (nunca inventando
//     candle).
import { describe, it, expect } from 'vitest';
import {
  computeIchimoku,
  ichimokuCloudPosition,
  ICHIMOKU_TENKAN_PERIOD,
  ICHIMOKU_KIJUN_PERIOD,
  ICHIMOKU_SENKOU_B_PERIOD,
  ICHIMOKU_DISPLACEMENT,
  metadata,
} from '../../src/research/engines/ichimoku-engine.js';

type Candle = { high: number; low: number; close: number };

/** Série com máxima/mínima controladas: candle i tem high = base+i,
 *  low = base-i. Assim o ponto médio de qualquer janela é calculável à mão. */
function ramp(n: number, base = 100): Candle[] {
  return Array.from({ length: n }, (_, i) => ({ high: base + i, low: base - i, close: base }));
}

function flat(n: number, price: number): Candle[] {
  return Array.from({ length: n }, () => ({ high: price, low: price, close: price }));
}

describe('ichimoku-engine: constantes clássicas de Hosoda', () => {
  it('9 / 26 / 52 com deslocamento 26 — os períodos originais', () => {
    expect(ICHIMOKU_TENKAN_PERIOD).toBe(9);
    expect(ICHIMOKU_KIJUN_PERIOD).toBe(26);
    expect(ICHIMOKU_SENKOU_B_PERIOD).toBe(52);
    expect(ICHIMOKU_DISPLACEMENT).toBe(26);
  });
});

describe('ichimoku-engine: ponto médio de extremos, NUNCA média de close', () => {
  it('numa série onde close é constante mas os extremos abrem, Tenkan segue os EXTREMOS', () => {
    // ramp: close é sempre 100; high/low se afastam. Uma implementação com
    // SMA de close devolveria 100 sempre — este teste falharia na hora.
    const c = ramp(60);
    const r = computeIchimoku(c);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    // No índice 59: janela de 9 = índices 51..59. high máx = 100+59 = 159,
    // low mín = 100-59 = 41. Ponto médio = (159+41)/2 = 100.
    // (nesta fixture simétrica o médio volta a 100 — então uso uma série
    // assimétrica abaixo para separar de verdade.)
    expect(r.tenkan[59]).toBeCloseTo(100, 10);
  });

  it('série ASSIMÉTRICA separa ponto-médio-de-extremos de média-de-close sem ambiguidade', () => {
    // high sobe, low fica parado, close fica parado: o ponto médio TEM que
    // subir; uma média de close ficaria cravada em 50.
    const c: Candle[] = Array.from({ length: 60 }, (_, i) => ({ high: 50 + i, low: 50, close: 50 }));
    const r = computeIchimoku(c);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    // índice 59, janela 9 = 51..59 → high máx = 50+59 = 109, low mín = 50.
    // Ponto médio = (109+50)/2 = 79.5. Média de close seria 50.
    expect(r.tenkan[59]).toBeCloseTo(79.5, 10);
    expect(r.tenkan[59]).not.toBeCloseTo(50, 1);
    // Kijun, janela 26 = 34..59 → high máx = 109, low mín = 50 → 79.5 também.
    expect(r.kijun[59]).toBeCloseTo(79.5, 10);
    // Senkou B, janela 52 = 8..59 → high máx = 109, low mín = 50 → 79.5.
    // (é o valor CALCULADO em 59; o desenhado em 59 vem de 33 — ver abaixo)
  });

  it('Senkou A é a média de Tenkan e Kijun no MESMO índice de cálculo', () => {
    const c: Candle[] = Array.from({ length: 60 }, (_, i) => ({ high: 100 + i * 2, low: 100 - i, close: 100 }));
    const r = computeIchimoku(c);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    // Senkou A desenhado em i vem de (i-26). Então senkouA[59] = média de
    // tenkan[33] e kijun[33].
    const esperado = (r.tenkan[33] + r.kijun[33]) / 2;
    expect(r.senkouA[59]).toBeCloseTo(esperado, 10);
  });
});

describe('ichimoku-engine: deslocamento real nos dois sentidos', () => {
  it('Senkou A/B desenhadas em i são o valor calculado em i-26 (para FRENTE)', () => {
    const c = ramp(90);
    const r = computeIchimoku(c);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    // Reconstrói o valor de Senkou B calculado em 60 (janela 52 = 9..60):
    // high máx = 100+60 = 160, low mín = 100-60 = 40 → (160+40)/2 = 100.
    // Ele deve aparecer desenhado em 60+26 = 86.
    expect(r.senkouB[86]).toBeCloseTo(100, 10);
  });

  it('antes do deslocamento, Senkou A/B são NaN honesto — nunca extrapolam o começo do gráfico', () => {
    const r = computeIchimoku(ramp(90));
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    for (let i = 0; i < ICHIMOKU_DISPLACEMENT; i++) {
      expect(Number.isNaN(r.senkouA[i])).toBe(true);
      expect(Number.isNaN(r.senkouB[i])).toBe(true);
    }
    // A nuvem histórica só é real a partir do PRIMEIRO índice em que a
    // janela de 52 cabe (índice 51, base zero) mais o deslocamento de 26:
    // 51 + 26 = 77. Escrevi 78 na primeira versão deste teste contando o
    // aquecimento como se fosse base 1 — o motor estava certo, a conta à
    // mão é que estava errada em um.
    expect(Number.isNaN(r.senkouB[76])).toBe(true);
    expect(Number.isFinite(r.senkouB[77])).toBe(true);
  });

  it('Chikou desenhada em i é o fechamento de i+26 (para TRÁS)', () => {
    const c: Candle[] = Array.from({ length: 90 }, (_, i) => ({ high: 200, low: 100, close: 1000 + i }));
    const r = computeIchimoku(c);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(r.chikou[0]).toBeCloseTo(1000 + 26, 10);
    expect(r.chikou[10]).toBeCloseTo(1000 + 36, 10);
  });

  it('Chikou TERMINA 26 candles antes do fim — NaN ali é a resposta correta, não falha', () => {
    const r = computeIchimoku(ramp(90));
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(Number.isFinite(r.chikou[90 - 1 - ICHIMOKU_DISPLACEMENT])).toBe(true);
    expect(Number.isNaN(r.chikou[90 - ICHIMOKU_DISPLACEMENT])).toBe(true);
    expect(Number.isNaN(r.chikou[89])).toBe(true);
  });
});

describe('ichimoku-engine: nuvem futura fora do array alinhado', () => {
  it('devolve exatamente 26 pontos de nuvem além do último candle', () => {
    const r = computeIchimoku(ramp(90));
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(r.futureSenkouA).toHaveLength(ICHIMOKU_DISPLACEMENT);
    expect(r.futureSenkouB).toHaveLength(ICHIMOKU_DISPLACEMENT);
    // O último ponto futuro é o valor calculado no ÚLTIMO candle real.
    expect(Number.isFinite(r.futureSenkouA[ICHIMOKU_DISPLACEMENT - 1])).toBe(true);
  });

  it('os arrays alinhados NUNCA crescem além do número de candles (zero candle inventado)', () => {
    const r = computeIchimoku(ramp(90));
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    for (const serie of [r.tenkan, r.kijun, r.senkouA, r.senkouB, r.chikou]) {
      expect(serie).toHaveLength(90);
    }
  });
});

describe('ichimoku-engine: fail-closed (Regra de Ouro 3)', () => {
  it('menos de 52 candles => DADOS_INSUFICIENTES, nunca uma nuvem parcial fabricada', () => {
    expect(computeIchimoku(ramp(51)).status).toBe('DADOS_INSUFICIENTES');
    expect(computeIchimoku([]).status).toBe('DADOS_INSUFICIENTES');
    expect(computeIchimoku(null as unknown as Candle[]).status).toBe('DADOS_INSUFICIENTES');
  });

  it('exatamente 52 candles já produz as linhas do último candle', () => {
    const r = computeIchimoku(ramp(52));
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(Number.isFinite(r.tenkan[51])).toBe(true);
    expect(Number.isFinite(r.kijun[51])).toBe(true);
  });

  it('high/low não-finito na janela => aquele ponto vira NaN, nunca um médio sobre dado faltando', () => {
    const c = ramp(60);
    c[55].high = NaN;
    const r = computeIchimoku(c);
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    expect(Number.isNaN(r.tenkan[55])).toBe(true);
    expect(Number.isNaN(r.tenkan[59])).toBe(true); // janela 51..59 contém o furo
    expect(Number.isFinite(r.tenkan[54])).toBe(true); // antes do furo segue real
  });

  it('aceita {h,l,c} curto além de {high,low,close} — mesma tolerância do resto da pasta', () => {
    const longo = ramp(60);
    const curto = longo.map((c) => ({ h: c.high, l: c.low, c: c.close }));
    const a = computeIchimoku(longo);
    const b = computeIchimoku(curto as unknown as Candle[]);
    expect(a.status).toBe('OK');
    expect(b.status).toBe('OK');
    if (a.status !== 'OK' || b.status !== 'OK') return;
    expect(b.tenkan[59]).toBeCloseTo(a.tenkan[59], 10);
  });
});

describe('ichimoku-engine: leitura de nuvem é CONTEXTO, nunca direção (LEI 24)', () => {
  it('preço acima da nuvem => ACIMA; abaixo => ABAIXO; entre as duas => DENTRO', () => {
    const r = computeIchimoku(flat(90, 100));
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    // Série plana: nuvem colapsa em 100. Acima e abaixo são inequívocos.
    expect(ichimokuCloudPosition(r, 150)?.position).toBe('ACIMA');
    expect(ichimokuCloudPosition(r, 50)?.position).toBe('ABAIXO');
    expect(ichimokuCloudPosition(r, 100)?.position).toBe('DENTRO');
  });

  it('espessura da nuvem é percentual do preço (comparável entre ativos)', () => {
    const r = computeIchimoku(flat(90, 100));
    expect(r.status).toBe('OK');
    if (r.status !== 'OK') return;
    const leitura = ichimokuCloudPosition(r, 100);
    expect(leitura?.thicknessPct).toBeCloseTo(0, 10); // série plana: nuvem sem espessura
  });

  it('fail-closed: sem resultado OK ou sem preço real => null, nunca uma posição fabricada', () => {
    expect(ichimokuCloudPosition(null as never, 100)).toBeNull();
    expect(ichimokuCloudPosition({ status: 'DADOS_INSUFICIENTES' } as never, 100)).toBeNull();
    const r = computeIchimoku(ramp(90));
    expect(ichimokuCloudPosition(r, NaN)).toBeNull();
  });

  it('a metadata declara honestamente que não emite direção e que só usa 9/26/52', () => {
    expect(metadata.status).toBe('ACTIVE_READ_ONLY');
    const lim = metadata.limitations.join(' ');
    expect(lim).toContain('LEI 24');
    expect(lim).toContain('9/26/52');
  });
});
