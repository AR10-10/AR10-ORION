// andrews-pitchfork-engine.test.ts — Laboratório de Evolução: execução REAL
// da matemática pura, sem nenhuma ligação com App.tsx/Core Engine.
//
// O que estes testes precisam separar sem ambiguidade: a Median Line NÃO é
// "a reta entre P0 e P1", nem "a reta entre P0 e P2" — é a reta de P0 pelo
// PONTO MÉDIO de P1-P2. As três produzem curvas plausíveis, e a errada só
// aparece como um garfo torto que ninguém consegue provar errado no olho.
// Por isso os fixtures abaixo usam números onde as três divergem.
import { describe, it, expect } from 'vitest';
import {
  analyze,
  alternatingPivots,
  pitchforkPriceAt,
  metadata,
  MIN_CANDLES,
} from '../../src/research/engines/andrews-pitchfork-engine.js';

type Vela = { high: number; low: number; open: number; close: number; time: number };

/** Constrói candles com um vale/pico plantado em índices escolhidos, e uma
 *  banda plana no resto da série de forma que o fractal K=2 confirme
 *  EXATAMENTE os pivôs pedidos — nenhum a mais.
 *
 *  A primeira versão desta função usava uma banda fixa (99..101) e por isso
 *  um "fundo" plantado em 100 ficava ACIMA do piso plano: não virava swing
 *  low nenhum, e `analyze` devolvia DADOS_INSUFICIENTES corretamente
 *  enquanto o teste acusava o motor. O erro era do fixture. Agora a banda é
 *  DERIVADA dos pivôs: piso acima de todo fundo plantado, teto abaixo de
 *  todo topo plantado. */
function serie(pivos: { index: number; price: number; isHigh: boolean }[], n = 60): Vela[] {
  const fundos = pivos.filter((p) => !p.isHigh).map((p) => p.price);
  const topos = pivos.filter((p) => p.isHigh).map((p) => p.price);
  const tetoDosFundos = fundos.length ? Math.max(...fundos) : 0;
  const pisoDosTopos = topos.length ? Math.min(...topos) : tetoDosFundos + 100;
  const folga = Math.max(1, (pisoDosTopos - tetoDosFundos) / 4);
  const planoLow = tetoDosFundos + folga;
  const planoHigh = pisoDosTopos - folga;
  const meio = (planoLow + planoHigh) / 2;
  const out: Vela[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ time: 1700000000 + i * 3600, open: meio, close: meio, high: planoHigh, low: planoLow });
  }
  for (const p of pivos) {
    if (p.isHigh) out[p.index].high = p.price;
    else out[p.index].low = p.price;
  }
  return out;
}

describe('alternatingPivots: alternância real, nunca dois do mesmo tipo em sequência', () => {
  it('funde topos e fundos numa sequência cronológica alternada', () => {
    const c = serie([
      { index: 10, price: 90, isHigh: false },
      { index: 20, price: 120, isHigh: true },
      { index: 30, price: 95, isHigh: false },
    ]);
    const p = alternatingPivots(c);
    expect(p.map((x: { isHigh: boolean }) => x.isHigh)).toEqual([false, true, false]);
    expect(p.map((x: { index: number }) => x.index)).toEqual([10, 20, 30]);
  });

  it('dois pivôs do MESMO tipo em sequência => fica o mais extremo, nunca os dois', () => {
    // dois topos seguidos (20 e 26) sem fundo entre eles: vence o mais alto.
    const c = serie([
      { index: 10, price: 90, isHigh: false },
      { index: 20, price: 118, isHigh: true },
      { index: 26, price: 131, isHigh: true },
      { index: 34, price: 95, isHigh: false },
    ]);
    const p = alternatingPivots(c);
    expect(p.map((x: { isHigh: boolean }) => x.isHigh)).toEqual([false, true, false]);
    const topo = p.find((x: { isHigh: boolean }) => x.isHigh)!;
    expect(topo.price).toBe(131);
    expect(topo.index).toBe(26);
  });

  it('fundo mais BAIXO vence entre dois fundos seguidos (espelho da regra acima)', () => {
    const c = serie([
      { index: 10, price: 120, isHigh: true },
      { index: 18, price: 92, isHigh: false },
      { index: 24, price: 85, isHigh: false },
      { index: 32, price: 118, isHigh: true },
    ]);
    const p = alternatingPivots(c);
    const fundo = p.find((x: { isHigh: boolean }) => !x.isHigh)!;
    expect(fundo.price).toBe(85);
    expect(fundo.index).toBe(24);
  });
});

describe('analyze: a Median Line passa pelo PONTO MÉDIO de P1-P2, nunca por P1 nem por P2', () => {
  // Fixture escolhido para as três leituras divergirem:
  //   P0 = (10, 90) fundo · P1 = (20, 130) topo · P2 = (30, 100) fundo
  //   ponto médio de P1-P2 = (25, 115)
  //   slope CORRETO   = (115 - 90) / (25 - 10) = 25/15 = 1.6666…
  //   slope se fosse P1 = (130 - 90) / 10 = 4      ← bem diferente
  //   slope se fosse P2 = (100 - 90) / 20 = 0.5    ← bem diferente
  const c = serie([
    { index: 10, price: 90, isHigh: false },
    { index: 20, price: 130, isHigh: true },
    { index: 30, price: 100, isHigh: false },
  ]);
  const r = analyze({ ohlcv_series: c });

  it('devolve OK com os 3 pivôs reais', () => {
    expect(r.status).toBe('OK');
    expect(r.pitchfork.p0.index).toBe(10);
    expect(r.pitchfork.p1.index).toBe(20);
    expect(r.pitchfork.p2.index).toBe(30);
  });

  it('o ponto médio é o de P1-P2, em índice de barra e em preço', () => {
    expect(r.pitchfork.midpoint).toEqual({ index: 25, price: 115 });
  });

  it('a inclinação é a da mediana — e NÃO a de P0→P1 nem a de P0→P2', () => {
    expect(r.pitchfork.slope).toBeCloseTo(25 / 15, 10);
    expect(r.pitchfork.slope).not.toBeCloseTo(4, 3);   // P0→P1
    expect(r.pitchfork.slope).not.toBeCloseTo(0.5, 3); // P0→P2
  });

  it('a mediana realmente passa pelos DOIS pontos que a definem', () => {
    const { median, slope, midpoint, p0 } = r.pitchfork;
    expect(pitchforkPriceAt(median, slope, p0.index)).toBeCloseTo(p0.price, 10);
    expect(pitchforkPriceAt(median, slope, midpoint.index)).toBeCloseTo(midpoint.price, 10);
  });

  it('as duas paralelas passam EXATAMENTE por P1 e por P2', () => {
    const { upper, lower, slope, p1, p2 } = r.pitchfork;
    // garfo ascendente (P0 é fundo): superior ancorada em P1, inferior em P2
    expect(r.pitchfork.ascending).toBe(true);
    expect(pitchforkPriceAt(upper, slope, p1.index)).toBeCloseTo(p1.price, 10);
    expect(pitchforkPriceAt(lower, slope, p2.index)).toBeCloseTo(p2.price, 10);
  });

  it('as três retas são PARALELAS de verdade — mesma distância em qualquer barra', () => {
    const { upper, lower, median, slope } = r.pitchfork;
    const dist = (i: number) => ({
      cima: pitchforkPriceAt(upper, slope, i)! - pitchforkPriceAt(median, slope, i)!,
      baixo: pitchforkPriceAt(median, slope, i)! - pitchforkPriceAt(lower, slope, i)!,
    });
    const a = dist(0);
    for (const i of [15, 30, 120, 5000]) {
      expect(dist(i).cima).toBeCloseTo(a.cima, 9);
      expect(dist(i).baixo).toBeCloseTo(a.baixo, 9);
    }
  });

  it('a superior fica mesmo ACIMA da inferior, em qualquer barra', () => {
    const { upper, lower, slope } = r.pitchfork;
    for (const i of [0, 25, 60, 400]) {
      expect(pitchforkPriceAt(upper, slope, i)!).toBeGreaterThan(pitchforkPriceAt(lower, slope, i)!);
    }
  });
});

describe('garfo DESCENDENTE: espelho exato, e a orientação vem dos pivôs', () => {
  // P0 = topo → high-low-high
  const c = serie([
    { index: 10, price: 130, isHigh: true },
    { index: 20, price: 90, isHigh: false },
    { index: 30, price: 120, isHigh: true },
  ]);
  const r = analyze({ ohlcv_series: c });

  it('ascending=false quando P0 é topo', () => {
    expect(r.status).toBe('OK');
    expect(r.pitchfork.ascending).toBe(false);
  });

  it('as âncoras TROCAM: superior em P2, inferior em P1', () => {
    const { upper, lower, slope, p1, p2 } = r.pitchfork;
    expect(pitchforkPriceAt(upper, slope, p2.index)).toBeCloseTo(p2.price, 10);
    expect(pitchforkPriceAt(lower, slope, p1.index)).toBeCloseTo(p1.price, 10);
  });

  it('e a superior continua acima da inferior (a troca de âncora não inverte o garfo)', () => {
    const { upper, lower, slope } = r.pitchfork;
    for (const i of [0, 30, 200]) {
      expect(pitchforkPriceAt(upper, slope, i)!).toBeGreaterThan(pitchforkPriceAt(lower, slope, i)!);
    }
  });
});

describe('projeção para o FUTURO — o uso normal do garfo', () => {
  it('devolve preço em barras ALÉM do último candle real, sem inventar candle', () => {
    const c = serie([
      { index: 10, price: 90, isHigh: false },
      { index: 20, price: 130, isHigh: true },
      { index: 30, price: 100, isHigh: false },
    ]);
    const r = analyze({ ohlcv_series: c });
    const { median, slope } = r.pitchfork;
    const ultimo = c.length - 1;
    const futuro = pitchforkPriceAt(median, slope, ultimo + 40);
    expect(Number.isFinite(futuro)).toBe(true);
    // e continua sendo a MESMA reta: extrapolar não muda a inclinação
    const a = pitchforkPriceAt(median, slope, ultimo)!;
    const b = pitchforkPriceAt(median, slope, ultimo + 40)!;
    expect((b - a) / 40).toBeCloseTo(slope, 10);
  });
});

describe('fail-closed (Regra de Ouro 3): nunca uma leitura fabricada', () => {
  it('candles insuficientes => DADOS_INSUFICIENTES com o número real', () => {
    const r = analyze({ ohlcv_series: serie([], 5) });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.pitchfork).toBeNull();
    expect(r.reason).toContain('5');
    expect(r.reason).toContain(String(MIN_CANDLES));
  });

  it('menos de 3 pivôs alternados => DADOS_INSUFICIENTES, nunca um garfo com 2 pontos', () => {
    const r = analyze({ ohlcv_series: serie([{ index: 20, price: 130, isHigh: true }]) });
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.pitchfork).toBeNull();
    expect(r.reason).toContain('pivos_alternados');
  });

  it('entrada não-array / vazia não explode', () => {
    for (const ruim of [undefined, null, {}, { ohlcv_series: null }, { ohlcv_series: 'x' }]) {
      const r = analyze(ruim as never);
      expect(r.status).toBe('DADOS_INSUFICIENTES');
      expect(r.pitchfork).toBeNull();
    }
    expect(alternatingPivots(null as never)).toEqual([]);
  });

  it('pitchforkPriceAt devolve null em toda entrada inválida, nunca NaN disfarçado', () => {
    expect(pitchforkPriceAt(null, 1, 0)).toBeNull();
    expect(pitchforkPriceAt({ index: 0, price: NaN }, 1, 0)).toBeNull();
    expect(pitchforkPriceAt({ index: 0, price: 1 }, NaN, 0)).toBeNull();
    expect(pitchforkPriceAt({ index: 0, price: 1 }, 1, Infinity)).toBeNull();
  });
});

describe('LEI 24 e Regra de Ouro 2: geometria, nunca direção nem probabilidade', () => {
  it('a saída não tem nenhum campo de direção de trade', () => {
    const r = analyze({
      ohlcv_series: serie([
        { index: 10, price: 90, isHigh: false },
        { index: 20, price: 130, isHigh: true },
        { index: 30, price: 100, isHigh: false },
      ]),
    });
    const chaves = JSON.stringify(r).toUpperCase();
    for (const proibido of ['LONG', 'SHORT', 'BUY', 'SELL', 'WAIT']) {
      expect(chaves.includes(proibido), `saída contém "${proibido}"`).toBe(false);
    }
  });

  // A literatura repete "o preço volta à mediana ~80% das vezes", atribuído a
  // Andrews. Sem backtest real, reproduzir isso seria uma probabilidade
  // fabricada (Regra de Ouro 2). O teste trava a ausência.
  // A asserção original checava metadata + saída juntos e se contradizia com
  // o teste seguinte: as `limitations` CITAM os 80% de propósito, para
  // declarar a recusa. O lugar certo de proibir o número é a LEITURA
  // computada — é ela que chegaria à tela do Operador como se fosse medição
  // deste repositório.
  it('a leitura computada não carrega nenhuma probabilidade — só geometria', () => {
    const r = analyze({
      ohlcv_series: serie([
        { index: 10, price: 90, isHigh: false },
        { index: 20, price: 130, isHigh: true },
        { index: 30, price: 100, isHigh: false },
      ]),
    });
    const saida = JSON.stringify(r.pitchfork);
    expect(/\b80\s*%/.test(saida)).toBe(false);
    expect(/probabilit|confian|acerto|chance/i.test(saida)).toBe(false);
    // e o que ELA tem é geometria: âncoras, inclinação, pivôs.
    expect(Object.keys(r.pitchfork).sort()).toEqual(
      ['ascending', 'lower', 'median', 'midpoint', 'p0', 'p1', 'p2', 'slope', 'upper'],
    );
  });

  it('metadata declara as limitações reais, incluindo as variantes não implementadas', () => {
    const lim = metadata.limitations.join(' ');
    expect(lim).toContain('Schiff');
    expect(lim.toLowerCase()).toContain('80%');
    // ATENÇÃO — esta é a MESMA asserção que ficou obsoleta no
    // delta-divergence-engine e virou um dos nove casos de "declaração ≠
    // realidade" desta trilha: um teste travando `LABORATORIO` depois da
    // graduação, protegendo a mentira em vez de pegá-la. Aqui ela cumpriu o
    // papel — falhou no commit da graduação e forçou esta atualização.
    // Quem mudar o status de novo tem de mexer aqui no MESMO commit.
    expect(metadata.status).toBe('ACTIVE_READ_ONLY');
  });
});
