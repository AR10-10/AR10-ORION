// supertrend-engine.test.ts — execução REAL do motor puro SuperTrend.
// Convenção deste repositório (CLAUDE.md): matemática de fronteira ganha
// teste de EXECUÇÃO REAL, nunca padrão de código-fonte. O bug mais
// provável aqui não é "esqueceram de ligar A com B", é "a catraca da
// banda está sutilmente errada" — que é exatamente a parte que o
// documento de pesquisa que motivou o motor OMITIA. Por isso a maior
// parte deste arquivo prova INVARIANTES do algoritmo (verdadeiras por
// definição do método), não números mágicos copiados de uma execução:
// invariante quebra quando a lógica quebra, número mágico só documenta o
// que o código já faz.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  computeSuperTrend,
  SUPERTREND_DEFAULT_PERIOD,
  SUPERTREND_DEFAULT_MULTIPLIER,
  metadata,
} from '../../src/research/engines/supertrend-engine.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

type Candle = { h: number; l: number; c: number };

/** Série que sobe de forma estável — tendência real de alta. */
function rising(n: number, start = 100, step = 1): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const base = start + i * step;
    return { h: base + 0.5, l: base - 0.5, c: base + 0.3 };
  });
}

/** Série que cai de forma estável — tendência real de baixa. */
function falling(n: number, start = 300, step = 1): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const base = start - i * step;
    return { h: base + 0.5, l: base - 0.5, c: base - 0.3 };
  });
}

/** Série lateral perfeita (sem direção real). */
function flat(n: number, price = 100): Candle[] {
  return Array.from({ length: n }, () => ({ h: price + 1, l: price - 1, c: price }));
}

describe('supertrend-engine: fail-closed (DADOS_INSUFICIENTES, nunca um ponto fabricado)', () => {
  it('entrada não-array devolve DADOS_INSUFICIENTES', () => {
    // fronteira real: o motor é .js e chamadores JS podem passar qualquer
    // coisa — o guarda Array.isArray tem que segurar sozinho.
    expect(computeSuperTrend(null as never).status).toBe('DADOS_INSUFICIENTES');
    expect(computeSuperTrend(undefined as never).status).toBe('DADOS_INSUFICIENTES');
    expect(computeSuperTrend({} as never).status).toBe('DADOS_INSUFICIENTES');
  });

  it('candles insuficientes para aquecer o ATR de Wilder nunca produzem ponto', () => {
    const r = computeSuperTrend(rising(SUPERTREND_DEFAULT_PERIOD), SUPERTREND_DEFAULT_PERIOD);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.points).toEqual([]);
  });

  it('parâmetros inválidos (period<=0, multiplier<=0, não-finitos) são rejeitados', () => {
    const c = rising(60);
    expect(computeSuperTrend(c, 0).status).toBe('DADOS_INSUFICIENTES');
    expect(computeSuperTrend(c, -5).status).toBe('DADOS_INSUFICIENTES');
    expect(computeSuperTrend(c, 10, 0).status).toBe('DADOS_INSUFICIENTES');
    expect(computeSuperTrend(c, 10, -3).status).toBe('DADOS_INSUFICIENTES');
    expect(computeSuperTrend(c, NaN).status).toBe('DADOS_INSUFICIENTES');
    expect(computeSuperTrend(c, 10, Infinity).status).toBe('DADOS_INSUFICIENTES');
  });

  it('série lateral PERFEITA (range real, mas zero deslocamento) ainda produz leitura OK — é dado real, não falta de dado', () => {
    const r = computeSuperTrend(flat(60));
    expect(r.status).toBe('OK');
    expect(r.points.length).toBeGreaterThan(0);
  });
});

describe('supertrend-engine: CATRACA da banda (a regra que o documento de pesquisa omitia)', () => {
  // ACHADO REAL DESTA SUÍTE (registrado de propósito): a primeira versão
  // destes 2 testes usava só `rising()`/`falling()` de passo constante e
  // passava IGUAL com a catraca REMOVIDA — porque numa série que sobe de
  // forma suave a banda básica já sobe sozinha, então monotonicidade não
  // distingue "travado" de "não travado". Verificado por teste de mutação
  // (catraca removida do motor => estes 2 continuavam verdes). As
  // fixtures abaixo foram redesenhadas para conter exatamente o momento
  // em que a banda básica RECUARIA: só a catraca real segura a linha.
  it('ALTA + expansão de volatilidade: a banda básica recuaria, a catraca NÃO deixa a linha descer', () => {
    // sobe estável (firma trend=UP e uma banda inferior alta), depois um
    // candle de range MUITO maior: o ATR explode, basicLower despenca —
    // mas o fechamento segue acima da banda travada, então a linha real
    // tem que ficar PARADA, nunca acompanhar o basicLower pra baixo.
    const candles = rising(60);
    candles[55] = { h: candles[55].h + 30, l: candles[55].l - 30, c: candles[55].c };
    candles[56] = { h: candles[56].h + 25, l: candles[56].l - 25, c: candles[56].c };
    const r = computeSuperTrend(candles);
    expect(r.status).toBe('OK');

    const upRun = r.points.filter((p) => p.trend === 'UP');
    expect(upRun.length).toBeGreaterThan(10);
    let sawFlatHold = false; // prova positiva de que a catraca AGIU
    for (let i = 1; i < upRun.length; i++) {
      if (upRun[i].index !== upRun[i - 1].index + 1) continue;
      expect(upRun[i].line).toBeGreaterThanOrEqual(upRun[i - 1].line - 1e-9);
      if (Math.abs(upRun[i].line - upRun[i - 1].line) < 1e-9) sawFlatHold = true;
    }
    expect(sawFlatHold).toBe(true);
  });

  it('BAIXA + expansão de volatilidade: a banda básica subiria, a catraca NÃO deixa a linha subir', () => {
    const candles = falling(60);
    candles[55] = { h: candles[55].h + 30, l: candles[55].l - 30, c: candles[55].c };
    candles[56] = { h: candles[56].h + 25, l: candles[56].l - 25, c: candles[56].c };
    const r = computeSuperTrend(candles);
    expect(r.status).toBe('OK');

    const downRun = r.points.filter((p) => p.trend === 'DOWN');
    expect(downRun.length).toBeGreaterThan(10);
    let sawFlatHold = false;
    for (let i = 1; i < downRun.length; i++) {
      if (downRun[i].index !== downRun[i - 1].index + 1) continue;
      expect(downRun[i].line).toBeLessThanOrEqual(downRun[i - 1].line + 1e-9);
      if (Math.abs(downRun[i].line - downRun[i - 1].line) < 1e-9) sawFlatHold = true;
    }
    expect(sawFlatHold).toBe(true);
  });

  it('a linha fica ABAIXO do preço em alta e ACIMA do preço em baixa — é um stop que trilha, nunca um oscilador centrado', () => {
    const upCandles = rising(120);
    const up = computeSuperTrend(upCandles);
    for (const p of up.points) {
      if (p.trend !== 'UP') continue;
      expect(p.line).toBeLessThan(upCandles[p.index].c);
    }

    const downCandles = falling(120);
    const down = computeSuperTrend(downCandles);
    for (const p of down.points) {
      if (p.trend !== 'DOWN') continue;
      expect(p.line).toBeGreaterThan(downCandles[p.index].c);
    }
  });
});

describe('supertrend-engine: flip só por FECHAMENTO real (nunca por pavio)', () => {
  it('pavio que perfura a banda sem fechar além dela NÃO inverte a tendência', () => {
    // Alta estável o bastante pra firmar trend=UP e afastar a banda, e
    // então UM candle com pavio inferior enorme que fecha de volta no
    // topo — exatamente o desenho de um sweep de liquidez.
    const candles = rising(80);
    const withWick = candles.map((c, i) =>
      i === 75 ? { h: c.h, l: c.l - 40, c: c.c } : c,
    );
    const base = computeSuperTrend(candles);
    const wicked = computeSuperTrend(withWick);
    const trendAt = (r: ReturnType<typeof computeSuperTrend>, idx: number) =>
      r.points.find((p) => p.index === idx)?.trend ?? null;

    // o pavio alarga o ATR (efeito real e esperado), mas a DIREÇÃO no
    // próprio candle do pavio continua a mesma: não houve fechamento
    // além da banda oposta.
    expect(trendAt(base, 75)).toBe('UP');
    expect(trendAt(wicked, 75)).toBe('UP');
  });

  it('reversão real e sustentada (fechamentos além da banda) INVERTE a tendência e marca flipped:true exatamente uma vez', () => {
    // sobe 70, depois desaba 60 — a virada tem que ser detectada.
    const upLeg = rising(70, 100, 1);
    const downLeg = falling(60, 168, 2);
    const r = computeSuperTrend([...upLeg, ...downLeg]);
    expect(r.status).toBe('OK');

    const trends = new Set(r.points.map((p) => p.trend));
    expect(trends.has('UP')).toBe(true);
    expect(trends.has('DOWN')).toBe(true);

    // todo flip marcado corresponde a uma troca real de direção entre
    // pontos consecutivos — nunca um flip anunciado sem mudança.
    for (let i = 1; i < r.points.length; i++) {
      const changed = r.points[i].trend !== r.points[i - 1].trend;
      expect(r.points[i].flipped).toBe(changed);
    }
  });

  it('o SEED nunca é anunciado como flip (é ponto de partida, não cruzamento)', () => {
    const r = computeSuperTrend(rising(60));
    expect(r.points[0].flipped).toBe(false);
  });
});

describe('supertrend-engine: reuso real do ATR de Wilder (Regra de Ouro 4 — zero segunda matemática)', () => {
  it('importa computeAtrPercent de lorentzian-classifier.js e NUNCA reimplementa True Range/suavização de Wilder', () => {
    const src = read('../../src/research/engines/supertrend-engine.js');
    expect(src).toContain("import { computeAtrPercent } from './lorentzian-classifier.js';");
    // nenhuma segunda curva de ATR: o motor não pode conter seu próprio
    // loop de True Range nem a recorrência de Wilder.
    expect(src).not.toMatch(/Math\.max\(\s*high\s*-\s*low/);
    expect(src).not.toMatch(/\(atr\s*\*\s*\(period\s*-\s*1\)/);
  });

  it('multiplicador maior afasta a linha do preço — prova que o ATR real está de fato escalando a banda', () => {
    const candles = rising(120);
    const tight = computeSuperTrend(candles, 10, 1);
    const wide = computeSuperTrend(candles, 10, 5);
    const last = (r: ReturnType<typeof computeSuperTrend>) => r.points[r.points.length - 1];
    const close = candles[last(tight).index].c;
    // em alta, a linha fica abaixo do preço: multiplicador maior => mais longe.
    expect(close - last(wide).line).toBeGreaterThan(close - last(tight).line);
  });
});

describe('supertrend-engine: determinismo e contrato', () => {
  it('mesma entrada => mesma saída, sempre', () => {
    const candles = rising(90);
    expect(computeSuperTrend(candles)).toEqual(computeSuperTrend(candles));
  });

  it('devolve os parâmetros REAIS usados (nunca só os defaults presumidos)', () => {
    const r = computeSuperTrend(rising(90), 7, 2.5);
    expect(r.period).toBe(7);
    expect(r.multiplier).toBe(2.5);
  });

  it('defaults são os REAIS de mercado (ATR 10 / multiplicador 3), confirmados por pesquisa', () => {
    expect(SUPERTREND_DEFAULT_PERIOD).toBe(10);
    expect(SUPERTREND_DEFAULT_MULTIPLIER).toBe(3);
  });

  it('índices dos pontos são estritamente crescentes e apontam para candles reais da série', () => {
    const candles = rising(90);
    const r = computeSuperTrend(candles);
    for (let i = 1; i < r.points.length; i++) {
      expect(r.points[i].index).toBeGreaterThan(r.points[i - 1].index);
    }
    for (const p of r.points) {
      expect(candles[p.index]).toBeDefined();
      expect(Number.isFinite(p.line)).toBe(true);
    }
  });

  it('metadata declara LABORATORIO (ainda não graduado) e as limitações honestas', () => {
    expect(metadata.status).toBe('LABORATORIO');
    expect(metadata.limitations.join(' ')).toContain('SEED');
    expect(metadata.limitations.join(' ')).toContain('nenhum backtest local');
  });

  it('o próprio fonte declara zero rede/relógio/aleatoriedade (função pura de cálculo)', () => {
    const src = read('../../src/research/engines/supertrend-engine.js');
    expect(src).not.toMatch(/fetch\(|WebSocket|Math\.random|Date\.now/);
  });
});
