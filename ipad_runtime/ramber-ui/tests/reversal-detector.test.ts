// reversal-detector.test.ts — Laboratório de Evolução: execução REAL
// (CLAUDE.md — o bug provável aqui é "a matemática/o gate está sutilmente
// errado", nunca fiação; este motor ainda não tem fiação nenhuma, de propósito).
import { describe, it, expect } from 'vitest';
import {
  computeReversalReading,
  measureReversalLead,
  describeReversalReading,
  REVERSAL_MAX_BARS_AGO,
  type BosChochResult,
  type SuperTrendResult,
} from '../src/nexus/reversal-detector';
// O trendBias REAL do Núcleo, importado — nunca reimplementado aqui.
import { trendBias } from '../../js/research/research-engine.js';

const choch = (direction: 'ALTA' | 'BAIXA', index: number, type: 'CHOCH' | 'BOS' = 'CHOCH'): BosChochResult => ({
  status: 'OK',
  break: { type, direction, level: 100, index, time: 1_700_000_000 + index * 60 },
  structure_label: direction === 'ALTA' ? 'ESTRUTURA_BAIXA' : 'ESTRUTURA_ALTA',
});

const superTrend = (trend: 'UP' | 'DOWN', flipIndex: number): SuperTrendResult => ({
  status: 'OK',
  points: [
    { index: flipIndex - 1, line: 99, trend: trend === 'UP' ? 'DOWN' : 'UP', flipped: false },
    { index: flipIndex, line: 100, trend, flipped: true },
  ],
});

describe('computeReversalReading: fail-closed real (Regra de Ouro 3)', () => {
  it('sem nenhum detector legível => DADOS_INSUFICIENTES, nunca uma direção fabricada', () => {
    const r = computeReversalReading({ bosChoch: null, superTrend: null, lastIndex: 50, coreDirection: 'LONG' });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.direction).toBeNull();
    expect(r.strength).toBeNull();
    expect(r.reason).toContain('nenhum detector');
  });

  it('detector presente mas sem evento => DADOS_INSUFICIENTES preservando o denominador honesto', () => {
    const r = computeReversalReading({
      bosChoch: { status: 'OK', break: null },
      superTrend: { status: 'OK', points: [] },
      lastIndex: 50,
      coreDirection: 'LONG',
    });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.totalReadable).toBe(2); // os 2 detectores responderam; só não havia reversão
    expect(r.reason).toContain('nenhuma reversão real');
  });

  it('lastIndex inválido não produz frescor negativo inventado', () => {
    const r = computeReversalReading({ bosChoch: choch('ALTA', 10), superTrend: null, lastIndex: Number.NaN, coreDirection: null });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
  });

  it('evento mais velho que a janela é DESCARTADO — reversão velha não é reversão', () => {
    const r = computeReversalReading({
      bosChoch: choch('ALTA', 10),
      superTrend: null,
      lastIndex: 10 + REVERSAL_MAX_BARS_AGO + 1,
      coreDirection: 'SHORT',
    });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
  });

  it('evento exatamente no limite da janela ainda conta (fronteira inclusiva)', () => {
    const r = computeReversalReading({
      bosChoch: choch('ALTA', 10),
      superTrend: null,
      lastIndex: 10 + REVERSAL_MAX_BARS_AGO,
      coreDirection: 'SHORT',
    });
    expect(r.status).toBe('OK');
    expect(r.barsAgo).toBe(REVERSAL_MAX_BARS_AGO);
  });
});

describe('computeReversalReading: BOS NÃO é reversão (a distinção mais fácil de errar)', () => {
  it('BOS é continuação e nunca vira evidência de reversão', () => {
    // Se isto falhar, o sistema estaria lendo "tendência forte" como "virou" —
    // o sinal EXATAMENTE invertido, e no pior momento possível.
    const r = computeReversalReading({
      bosChoch: choch('ALTA', 48, 'BOS'),
      superTrend: null,
      lastIndex: 50,
      coreDirection: 'SHORT',
    });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.evidence).toHaveLength(0);
  });

  it('CHOCH na mesma posição, esse sim, é reversão', () => {
    const r = computeReversalReading({
      bosChoch: choch('ALTA', 48, 'CHOCH'),
      superTrend: null,
      lastIndex: 50,
      coreDirection: 'SHORT',
    });
    expect(r.status).toBe('OK');
    expect(r.direction).toBe('LONG');
    expect(r.evidence[0].source).toBe('CHOCH');
  });
});

describe('computeReversalReading: a leitura real', () => {
  it('CHoCH de baixa aponta SHORT e reporta contradição com um Núcleo em LONG', () => {
    const r = computeReversalReading({ bosChoch: choch('BAIXA', 49), superTrend: null, lastIndex: 50, coreDirection: 'LONG' });
    expect(r.direction).toBe('SHORT');
    expect(r.contradictsCore).toBe(true);
    expect(r.barsAgo).toBe(1);
  });

  it('não contradiz quando aponta para o MESMO lado do Núcleo', () => {
    const r = computeReversalReading({ bosChoch: choch('ALTA', 49), superTrend: null, lastIndex: 50, coreDirection: 'LONG' });
    expect(r.contradictsCore).toBe(false);
  });

  it('Núcleo em WAIT (sem direção) => contradictsCore null, nunca false fabricado', () => {
    const r = computeReversalReading({ bosChoch: choch('ALTA', 49), superTrend: null, lastIndex: 50, coreDirection: null });
    expect(r.contradictsCore).toBeNull();
  });

  it('dois detectores concordando dão massa 1.0 (nunca chamada de probabilidade)', () => {
    const r = computeReversalReading({
      bosChoch: choch('BAIXA', 48),
      superTrend: superTrend('DOWN', 49),
      lastIndex: 50,
      coreDirection: 'LONG',
    });
    expect(r.direction).toBe('SHORT');
    expect(r.agreeingCount).toBe(2);
    expect(r.totalReadable).toBe(2);
    expect(r.strength).toBe(1);
  });

  it('detectores DISCORDANDO: vence o mais recente e a massa cai para 0.5, discordância visível', () => {
    const r = computeReversalReading({
      bosChoch: choch('ALTA', 40),      // mais velho
      superTrend: superTrend('DOWN', 49), // mais novo
      lastIndex: 50,
      coreDirection: null,
    });
    expect(r.direction).toBe('SHORT');  // o evento mais novo descreve o agora
    expect(r.strength).toBe(0.5);       // e a discordância não fica escondida
    expect(r.evidence).toHaveLength(2);
  });

  it('evidências vêm ordenadas da mais recente para a mais antiga', () => {
    const r = computeReversalReading({
      bosChoch: choch('BAIXA', 35),
      superTrend: superTrend('DOWN', 49),
      lastIndex: 50,
      coreDirection: null,
    });
    expect(r.evidence.map((e) => e.barsAgo)).toEqual([1, 15]);
  });

  it('pureza: mesma entrada, mesma saída', () => {
    const args = { bosChoch: choch('ALTA', 45), superTrend: superTrend('UP', 47), lastIndex: 50, coreDirection: 'SHORT' as const };
    expect(computeReversalReading(args)).toEqual(computeReversalReading(args));
  });
});

describe('trendBias REAL do Núcleo — importado, nunca reimplementado', () => {
  it('é a mesma função que decide o sistema, e responde como o mapa documentou', () => {
    // Se esta importação quebrar, a medição abaixo teria virado uma segunda
    // implementação paralela da decisão — exatamente o que o repositório proíbe.
    expect(typeof trendBias).toBe('function');
    expect(trendBias({ last_price: 110, sma: 100, ema: 105 })).toBe('ALTA');
    expect(trendBias({ last_price: 90, sma: 100, ema: 95 })).toBe('BAIXA');
    expect(trendBias({ last_price: 110, sma: 100, ema: 95 })).toBe('NEUTRO'); // preço acima, EMA abaixo
    expect(trendBias({ last_price: Number.NaN, sma: 100, ema: 95 })).toBe('INDEFINIDO');
  });
});

describe('measureReversalLead: o número que decide se a troca vale a pena', () => {
  it('mede a vantagem real em barras entre a evidência e a virada do Núcleo', () => {
    // Núcleo vira para LONG na barra 10; a evidência estrutural virou na 4.
    const biasByBar = [
      ...Array(10).fill('BAIXA'),
      ...Array(6).fill('ALTA'),
    ];
    const m = measureReversalLead({ biasByBar, events: [{ direction: 'LONG', atIndex: 4 }] });
    expect(m.status).toBe('OK');
    expect(m.samples).toHaveLength(1);
    expect(m.samples[0].leadBars).toBe(6); // 6 barras de vantagem real
    expect(m.medianLeadBars).toBe(6);
    expect(m.earlierCount).toBe(1);
    expect(m.laterCount).toBe(0);
  });

  it('usa MEDIANA — um único caso extremo não define o resultado', () => {
    const biasByBar = [
      'BAIXA', 'ALTA',                      // vira na 1
      'ALTA', 'BAIXA',                      // vira na 3
      'BAIXA', 'ALTA',                      // vira na 5
    ];
    const m = measureReversalLead({
      biasByBar,
      events: [
        { direction: 'LONG', atIndex: 0 },  // lead 1
        { direction: 'SHORT', atIndex: 2 }, // lead 1
        { direction: 'LONG', atIndex: 0 },  // lead 5 (o extremo)
      ],
    });
    expect(m.status).toBe('OK');
    // média seria puxada pelo 5; a mediana fica junto dos casos típicos
    expect(m.medianLeadBars).toBeLessThanOrEqual(2);
  });

  // ==========================================================================
  // ANTI-VIÉS DE SELEÇÃO — o teste mais importante deste arquivo.
  //
  // A primeira versão deste motor só emparelhava evidência ANTERIOR à virada
  // (`lead >= 0`). Com isso `laterCount` era zero POR CONSTRUÇÃO e a mediana
  // só podia sair favorável: um número que pareceria medido e seria fabricado
  // — exatamente o que esta entrega inteira existe para não fazer. A janela
  // passou a ser simétrica. Estes 2 testes travam a correção.
  // ==========================================================================
  it('mede o ATRASO com sinal negativo quando a evidência chegou DEPOIS do Núcleo', () => {
    // Núcleo vira na barra 10; a evidência estrutural só veio na 12.
    const biasByBar = [...Array(10).fill('BAIXA'), ...Array(8).fill('ALTA')];
    const m = measureReversalLead({ biasByBar, events: [{ direction: 'LONG', atIndex: 12 }] });
    expect(m.status).toBe('OK');
    expect(m.samples[0].leadBars).toBe(-2); // atraso real, com sinal
    expect(m.laterCount).toBe(1);
    expect(m.earlierCount).toBe(0);
  });

  it('mediana pode dizer HONESTAMENTE que a troca não vale a pena', () => {
    // 3 viradas do Núcleo (barras 3, 6 e 9) e, em TODAS, a estrutura só
    // chegou 2 barras depois. Cenário em que a evidência é pior que as médias.
    const biasByBar = [
      'BAIXA', 'BAIXA', 'BAIXA',
      'ALTA', 'ALTA', 'ALTA',
      'BAIXA', 'BAIXA', 'BAIXA',
      'ALTA',
    ];
    const m = measureReversalLead({
      biasByBar,
      events: [
        { direction: 'LONG', atIndex: 5 },   // virada em 3 → lead −2
        { direction: 'SHORT', atIndex: 8 },  // virada em 6 → lead −2
        { direction: 'LONG', atIndex: 11 },  // virada em 9 → lead −2
      ],
    });
    expect(m.status).toBe('OK');
    expect(m.medianLeadBars!).toBeLessThan(0); // o motor não esconde o resultado ruim
    expect(m.laterCount).toBeGreaterThan(0);
  });

  it('NEUTRO->LONG conta como virada; LONG->NEUTRO não (parar de emitir não é inverter)', () => {
    const biasByBar = ['NEUTRO', 'ALTA', 'NEUTRO'];
    const m = measureReversalLead({ biasByBar, events: [{ direction: 'LONG', atIndex: 0 }] });
    expect(m.samples).toHaveLength(1);
    expect(m.samples[0].coreIndex).toBe(1);
  });

  it('evento fora da janela de lookback não é creditado como causa da virada', () => {
    const biasByBar = [...Array(40).fill('BAIXA'), 'ALTA'];
    const m = measureReversalLead({ biasByBar, events: [{ direction: 'LONG', atIndex: 0 }], maxLookbackBars: 5 });
    expect(m.status).toBe('DADOS_INSUFICIENTES');
  });

  it('série sem virada nenhuma => DADOS_INSUFICIENTES honesto', () => {
    const m = measureReversalLead({ biasByBar: Array(30).fill('ALTA'), events: [{ direction: 'LONG', atIndex: 3 }] });
    expect(m.status).toBe('DADOS_INSUFICIENTES');
  });

  it('a medição roda de ponta a ponta sobre o trendBias REAL, não sobre um mock', () => {
    // Série real de frames: preço cruzando a média para cima na barra 5.
    const frames = [
      { last_price: 90, sma: 100, ema: 95 },
      { last_price: 92, sma: 100, ema: 96 },
      { last_price: 95, sma: 100, ema: 97 },
      { last_price: 98, sma: 100, ema: 99 },
      { last_price: 99, sma: 100, ema: 99 },
      { last_price: 105, sma: 100, ema: 101 }, // ← aqui o Núcleo REAL vira
      { last_price: 108, sma: 100, ema: 103 },
    ];
    const biasByBar = frames.map((f) => trendBias(f));
    expect(biasByBar[4]).toBe('BAIXA');
    expect(biasByBar[5]).toBe('ALTA'); // virada real, medida pela função real

    const m = measureReversalLead({ biasByBar, events: [{ direction: 'LONG', atIndex: 2 }] });
    expect(m.status).toBe('OK');
    expect(m.samples[0].leadBars).toBe(3); // 3 barras antes do Núcleo real
  });
});

describe('describeReversalReading: frase honesta', () => {
  it('sem leitura devolve a razão real', () => {
    const r = computeReversalReading({ bosChoch: null, superTrend: null, lastIndex: 10, coreDirection: null });
    expect(describeReversalReading(r)).toBe(r.reason);
  });

  it('com leitura nomeia fontes, frescor e a contradição', () => {
    const r = computeReversalReading({
      bosChoch: choch('BAIXA', 48),
      superTrend: superTrend('DOWN', 49),
      lastIndex: 50,
      coreDirection: 'LONG',
    });
    const txt = describeReversalReading(r);
    expect(txt).toContain('reversão SHORT');
    expect(txt).toContain('2/2');
    expect(txt).toContain('CONTRA o sinal atual');
  });
});

describe('ISOLAMENTO: o Laboratório não toca o sistema ao vivo (CLAUDE.md §3)', () => {
  it('nenhum consumidor real importa este motor ainda — a LEI 24 continua intacta', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const app = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf-8');
    const bridge = readFileSync(resolve(__dirname, '../src/engine-bridge.ts'), 'utf-8');
    expect(app).not.toContain('reversal-detector');
    expect(bridge).not.toContain('reversal-detector');
  });

  it('exportar trendBias foi ADITIVO: research-engine.js segue usando a sua própria função', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(__dirname, '../../js/research/research-engine.js'), 'utf-8');
    expect(src).toContain('export function trendBias');
    expect(src).toContain('const bias = trendBias(frame);'); // o uso interno continua idêntico
  });
});
