// nexus-orderflow-history.test.ts — V-MAX Fase 1.2: trava a detecção real
// de trades grandes (percentil real da amostra observada, nunca um limiar
// fixo) e o ring de histórico CVD+bolhas. Lógica pura, sem rede.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  computeLargeTradeThreshold,
  ingestTradesForLargeDetection,
  pushOrderflowHistory,
  computeOrderflowTrend,
  EMPTY_THRESHOLD_STATE,
  ORDERFLOW_HISTORY_CAPACITY,
  ORDERFLOW_TREND_WINDOW,
  type OrderflowTrade,
  type OrderflowHistoryEntry,
} from '../src/nexus/orderflow-history';

const trade = (volume: number, t = 1000, side: 'BUY' | 'SELL' = 'BUY'): OrderflowTrade => ({
  time: t, price: 100, volume, side,
});

describe('computeLargeTradeThreshold: percentil real da amostra observada, nunca um número fixo', () => {
  it('devolve null honesto com amostra curta demais — nunca um limiar de exemplo', () => {
    const small = Array.from({ length: 10 }, (_, i) => i + 1);
    expect(computeLargeTradeThreshold(small)).toBeNull();
  });

  it('com amostra suficiente, devolve um valor real presente na própria amostra (percentil ~90)', () => {
    const volumes = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    const threshold = computeLargeTradeThreshold(volumes);
    expect(threshold).not.toBeNull();
    expect(volumes).toContain(threshold); // sempre um valor REAL da amostra, nunca interpolado/sintetizado
    expect(threshold).toBeGreaterThanOrEqual(89);
    expect(threshold).toBeLessThanOrEqual(91);
  });

  it('amostra toda igual devolve esse mesmo valor real (nunca quebra em caso degenerado)', () => {
    const volumes = Array.from({ length: 50 }, () => 5);
    expect(computeLargeTradeThreshold(volumes)).toBe(5);
  });
});

describe('ingestTradesForLargeDetection: um trade nunca influencia o próprio julgamento de significância', () => {
  it('sem amostra suficiente ainda, nenhum trade é marcado grande — nunca um chute antes de dado real', () => {
    const { large } = ingestTradesForLargeDetection(EMPTY_THRESHOLD_STATE, [trade(999999)]);
    expect(large).toEqual([]);
  });

  it('depois de amostra real suficiente, um trade real acima do percentil é marcado grande', () => {
    let state = EMPTY_THRESHOLD_STATE;
    // Constrói amostra real: 30 trades pequenos (volume 1) primeiro.
    for (let i = 0; i < 30; i++) {
      const r = ingestTradesForLargeDetection(state, [trade(1)]);
      state = r.nextState;
    }
    const r = ingestTradesForLargeDetection(state, [trade(1000)]); // real trade muito maior que a amostra recente
    expect(r.large).toEqual([trade(1000)]);
  });

  it('trades reais pequenos (abaixo do percentil observado) nunca são marcados grandes', () => {
    let state = EMPTY_THRESHOLD_STATE;
    // Amostra real com variância: volumes de 1 a 30 (não todos iguais —
    // um trade exatamente no percentil de uma amostra uniforme SERIA
    // "grande" por definição, então o teste precisa de variância real
    // para verificar a exclusão de verdade).
    for (let i = 1; i <= 30; i++) {
      const r = ingestTradesForLargeDetection(state, [trade(i)]);
      state = r.nextState;
    }
    const r = ingestTradesForLargeDetection(state, [trade(2)]); // bem abaixo do percentil 90 real (~27)
    expect(r.large).toEqual([]);
  });

  it('a amostra de volumes respeita o teto real (VOLUME_SAMPLE_WINDOW=200), nunca acumula sem limite', () => {
    let state = EMPTY_THRESHOLD_STATE;
    for (let i = 0; i < 250; i++) {
      const r = ingestTradesForLargeDetection(state, [trade(i)]);
      state = r.nextState;
    }
    expect(state.recentVolumes.length).toBe(200);
  });
});

describe('pushOrderflowHistory: ring real de CVD+bolhas, respeita o teto, nunca fabrica uma entrada', () => {
  const entry = (t: number, cvd: number): OrderflowHistoryEntry => ({ time: t, cvd, largeTrades: [] });

  it('ring vazio aceita a primeira entrada real', () => {
    expect(pushOrderflowHistory([], entry(1000, 5))).toEqual([entry(1000, 5)]);
  });

  it('respeita o teto real de capacidade — entrada mais antiga cai', () => {
    let ring: OrderflowHistoryEntry[] = [];
    for (let i = 0; i < 5; i++) ring = pushOrderflowHistory(ring, entry(i, i), 3);
    expect(ring).toHaveLength(3);
    expect(ring.map((e) => e.time)).toEqual([2, 3, 4]);
  });

  it('usa ORDERFLOW_HISTORY_CAPACITY por padrão quando nenhum teto é passado', () => {
    let ring: OrderflowHistoryEntry[] = [];
    for (let i = 0; i < ORDERFLOW_HISTORY_CAPACITY + 5; i++) ring = pushOrderflowHistory(ring, entry(i, i));
    expect(ring).toHaveLength(ORDERFLOW_HISTORY_CAPACITY);
  });
});

describe('computeOrderflowTrend: tendência real de força do fluxo (Diretriz Complementar §18) — inclinação recente vs. anterior da MESMA série de CVD já real', () => {
  const entry = (t: number, cvd: number): OrderflowHistoryEntry => ({ time: t, cvd, largeTrades: [] });

  it('FAIL_CLOSED: histórico curto demais (< 10 entradas) => DADOS_INSUFICIENTES, nunca uma tendência fabricada', () => {
    const short = Array.from({ length: 9 }, (_, i) => entry(i, i));
    const r = computeOrderflowTrend(short);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.reason).toBe('historico_real_insuficiente_para_tendencia');
    expect(r.trend).toBeNull();
  });

  it('FORTALECENDO: a metade recente acelera bem além da zona-morta real', () => {
    const history: OrderflowHistoryEntry[] = [
      ...Array.from({ length: 10 }, (_, i) => entry(i, i)), // slope ~0.9 na metade anterior
      ...Array.from({ length: 10 }, (_, i) => entry(10 + i, 9 + (i + 1) * 10)), // slope 10 na metade recente
    ];
    const r = computeOrderflowTrend(history);
    expect(r.status).toBe('OK');
    expect(r.trend).toBe('FORTALECENDO');
    expect(r.recentSlope).toBeGreaterThan(r.priorSlope!);
  });

  it('ENFRAQUECENDO: a metade recente desacelera bem além da zona-morta real', () => {
    const history: OrderflowHistoryEntry[] = [
      ...Array.from({ length: 10 }, (_, i) => entry(i, i * 10)), // slope 10 na metade anterior
      ...Array.from({ length: 10 }, (_, i) => entry(10 + i, 90 + (i + 1))), // slope 1 na metade recente
    ];
    const r = computeOrderflowTrend(history);
    expect(r.status).toBe('OK');
    expect(r.trend).toBe('ENFRAQUECENDO');
    expect(r.recentSlope).toBeLessThan(r.priorSlope!);
  });

  it('ESTAVEL: inclinação real constante em toda a janela — a diferença fica dentro da zona-morta', () => {
    const history = Array.from({ length: 20 }, (_, i) => entry(i, i)); // slope 1 constante
    const r = computeOrderflowTrend(history);
    expect(r.status).toBe('OK');
    expect(r.trend).toBe('ESTAVEL');
  });

  it('CVD real completamente parado (amplitude 0) => ESTAVEL honesto, nunca NaN/erro', () => {
    const history = Array.from({ length: 15 }, (_, i) => entry(i, 100));
    const r = computeOrderflowTrend(history);
    expect(r.status).toBe('OK');
    expect(r.trend).toBe('ESTAVEL');
    expect(Number.isFinite(r.recentSlope)).toBe(true);
    expect(Number.isFinite(r.priorSlope)).toBe(true);
  });

  it('determinística: mesma série real, mesma leitura', () => {
    const history = Array.from({ length: 20 }, (_, i) => entry(i, i * (i % 2 === 0 ? 3 : 1)));
    expect(computeOrderflowTrend(history, 5_000)).toEqual(computeOrderflowTrend(history, 5_000));
  });

  it('a palavra "probabilidade" não aparece — tendência de fluxo é inclinação real, nunca chance de acerto (Regra de Ouro 2)', () => {
    const history = Array.from({ length: 20 }, (_, i) => entry(i, i));
    const r = computeOrderflowTrend(history);
    expect(JSON.stringify(r).toLowerCase()).not.toContain('probabilidade');
  });
});

// ---------------------------------------------------------------------------
// RETENÇÃO ≠ JANELA DE LEITURA (defeito real corrigido).
//
// `computeOrderflowTrend` dividia o histórico INTEIRO ao meio. Enquanto
// retenção e janela eram o mesmo número (capacidade 120), isso passava
// despercebido — mas são duas perguntas diferentes que ficaram acopladas por
// acidente. Ao subir a retenção para 900 (~1h), a MESMA frase exibida ao
// Operador ("fluxo FORTALECENDO/ENFRAQUECENDO") passaria a comparar os
// últimos 30 min contra os 30 anteriores, sem nada na tela mudar de nome.
//
// Estes testes travam a separação por EXECUÇÃO REAL — a matemática é o que
// pode estar sutilmente errado aqui, não a fiação.
// ---------------------------------------------------------------------------
describe('a leitura de tendência não muda de significado quando a retenção cresce', () => {
  const entry = (t: number, cvd: number): OrderflowHistoryEntry => ({ time: t, cvd, largeTrades: [] });

  /** Série com um passado LONGO e plano e um final recente em aceleração
   *  forte. Se a função olhasse o histórico inteiro, o passado plano diluiria
   *  a aceleração; olhando só a janela, ela aparece. */
  const passadoPlanoDepoisAceleracao = (totalAntigo: number) => [
    ...Array.from({ length: totalAntigo }, (_, i) => entry(i, 0)), // CVD parado
    ...Array.from({ length: 60 }, (_, i) => entry(totalAntigo + i, i * 0.1)), // subida leve
    ...Array.from({ length: 60 }, (_, i) => entry(totalAntigo + 60 + i, 6 + (i + 1) * 25)), // aceleração real
  ];

  it('a mesma janela recente dá a MESMA leitura, com 200 ou com 5000 entradas retidas', () => {
    const curto = computeOrderflowTrend(passadoPlanoDepoisAceleracao(200));
    const longo = computeOrderflowTrend(passadoPlanoDepoisAceleracao(5000));
    expect(curto.status).toBe('OK');
    expect(longo.status).toBe('OK');
    expect(longo.trend).toBe(curto.trend);
    // e não só o rótulo: as inclinações reais são idênticas, porque o
    // recorte avaliado é literalmente o mesmo.
    expect(longo.recentSlope).toBe(curto.recentSlope);
    expect(longo.priorSlope).toBe(curto.priorSlope);
  });

  it('sem a janela, a leitura falaria de OUTRO intervalo de tempo — a prova de que isto importa', () => {
    // Reproduz o comportamento antigo passando uma janela = tamanho total.
    const serie = passadoPlanoDepoisAceleracao(2000);
    const comJanela = computeOrderflowTrend(serie);
    const historicoInteiro = computeOrderflowTrend(serie, Date.now(), serie.length);
    expect(comJanela.trend).toBe('FORTALECENDO');

    // A assertiva certa aqui é sobre a INCLINAÇÃO, não sobre o rótulo. Com o
    // erro de dimensão corrigido, os dois podem até concordar no rótulo
    // nesta série — mas descrevem intervalos completamente diferentes, e é
    // isso que tornaria a frase exibida ao Operador ambígua conforme o ring
    // enchesse. A aceleração real dos últimos ciclos aparece diluída quando
    // espalhada por 2000 pontos parados.
    expect(historicoInteiro.recentSlope).not.toBe(comJanela.recentSlope);
    expect(Math.abs(historicoInteiro.recentSlope!)).toBeLessThan(Math.abs(comJanela.recentSlope!) / 5);
  });

  it('a leitura é ESCALÁVEL: a mesma aceleração é detectada em QUALQUER janela', () => {
    // ESTE é o teste que faltava e que teria pego o erro de dimensão: a
    // suíte inteira usava séries de 20 amostras, o único tamanho em que a
    // fórmula antiga ainda funcionava. Acima de ~40 ela era incapaz de sair
    // de ESTAVEL por maior que fosse a aceleração.
    const rampa = (n: number, r: number) => {
      const h = n / 2;
      return [
        ...Array.from({ length: h }, (_, i) => entry(i, 0)),
        ...Array.from({ length: h }, (_, i) => entry(h + i, (i + 1) * r)),
      ];
    };
    for (const n of [20, 40, 60, 120, 240]) {
      expect(computeOrderflowTrend(rampa(n, 10), Date.now(), n).trend, `janela ${n}`).toBe('FORTALECENDO');
    }
  });

  it('a zona-morta é IDÊNTICA à antiga em n=20 — a correção não recalibrou nada', () => {
    // O múltiplo foi escolhido para preservar byte a byte o comportamento no
    // único tamanho onde a fórmula original de fato funcionava (e onde ela
    // foi calibrada e testada): 1 x amplitude/20 === 0,05 x amplitude.
    // Sem isso, "corrigir a dimensão" viraria disfarce para escolher um
    // limiar novo a olho, sem dado que o sustente.
    const src = readFileSync(resolve(__dirname, '../src/nexus/orderflow-history.ts'), 'utf8');
    expect(src).toContain('const TREND_DEADBAND_MULTIPLE = 1;');
    expect(src).toContain('const movimentoTipicoPorCiclo = totalRange / recorte.length;');
    // e a fórmula antiga (amplitude sem dividir) não pode voltar
    expect(src).not.toMatch(/deadband\s*=\s*totalRange\s*\*/);
  });

  it('a janela é a declarada, e o recorte é o FINAL da série (o mais recente)', () => {
    expect(ORDERFLOW_TREND_WINDOW).toBe(120);
    // Um final em queda depois de um começo em alta só pode dar
    // ENFRAQUECENDO se o recorte for mesmo o final.
    const serie = [
      ...Array.from({ length: 500 }, (_, i) => entry(i, i * 10)), // alta forte, antiga
      ...Array.from({ length: 60 }, (_, i) => entry(500 + i, 5000 + i * 0.1)), // quase parado
      ...Array.from({ length: 60 }, (_, i) => entry(560 + i, 5006 - (i + 1) * 30)), // queda real
    ];
    expect(computeOrderflowTrend(serie).trend).toBe('ENFRAQUECENDO');
  });

  it('com o ring ainda curto usa o que há — e o piso de amostra continua mandando', () => {
    // Início de sessão: o ring tem menos que a janela. Não é motivo para
    // recusar leitura, mas abaixo de 10 entradas continua fail-closed.
    const nove = Array.from({ length: 9 }, (_, i) => entry(i, i));
    expect(computeOrderflowTrend(nove).status).toBe('DADOS_INSUFICIENTES');
    const vinte = [
      ...Array.from({ length: 10 }, (_, i) => entry(i, i)),
      ...Array.from({ length: 10 }, (_, i) => entry(10 + i, 9 + (i + 1) * 10)),
    ];
    expect(computeOrderflowTrend(vinte).status).toBe('OK');
  });

  it('fail-closed no próprio parâmetro: janela inválida cai na declarada, nunca num recorte absurdo', () => {
    const serie = passadoPlanoDepoisAceleracao(300);
    const esperado = computeOrderflowTrend(serie).trend;
    for (const ruim of [0, -5, 3, NaN, Infinity]) {
      expect(computeOrderflowTrend(serie, Date.now(), ruim as number).trend, `janela ${ruim}`).toBe(esperado);
    }
  });
});

describe('a retenção subiu, e o custo real disso foi medido antes', () => {
  it('a capacidade é a nova, e continua sendo um teto de verdade', () => {
    expect(ORDERFLOW_HISTORY_CAPACITY).toBe(900);
    let ring: OrderflowHistoryEntry[] = [];
    for (let i = 0; i < ORDERFLOW_HISTORY_CAPACITY + 50; i++) {
      ring = pushOrderflowHistory(ring, { time: i, cvd: i, largeTrades: [] });
    }
    expect(ring.length).toBe(ORDERFLOW_HISTORY_CAPACITY);
    // e o que sobrou é o FINAL da série, nunca o começo
    expect(ring[ring.length - 1].time).toBe(ORDERFLOW_HISTORY_CAPACITY + 49);
  });

  it('a retenção é MAIOR que a janela de tendência — senão a separação seria decorativa', () => {
    expect(ORDERFLOW_HISTORY_CAPACITY).toBeGreaterThan(ORDERFLOW_TREND_WINDOW);
  });
});
