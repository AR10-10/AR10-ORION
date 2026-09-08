// independent-reference-price.test.ts — execução REAL.
//
// O ponto de prova é a TOLERÂNCIA AUTO-REFERENTE: a referência só é
// "divergente" quando cai fora do spread que as próprias corretoras já
// exibem entre si. Zero constante inventada, e o piso se move sozinho com
// a condição de mercado. Vários testes abaixo existem só para travar isso.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  evaluateIndependentReference,
  describeIndependentReference,
} from '../src/nexus/independent-reference-price';

const v = (venue: string, price: number) => ({ venue, price });

describe('referência independente: fail-closed (Regra de Ouro 3)', () => {
  it('sem referência => DADOS_INSUFICIENTES, nunca um veredito', () => {
    for (const ref of [null, undefined, Number.NaN, 0, -1]) {
      const r = evaluateIndependentReference([v('BINANCE', 100), v('MEXC', 100.1)], ref as never);
      expect(r.status).toBe('DADOS_INSUFICIENTES');
      expect(r.verdict).toBe('DADOS_INSUFICIENTES');
      expect(r.divergencePct).toBeNull();
    }
  });

  it('UMA corretora só => recusa, porque não há spread real para ser a tolerância', () => {
    const r = evaluateIndependentReference([v('BINANCE', 100)], 100);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.venueCount).toBe(1);
    expect(r.reason).toContain('spread real entre corretoras');
    // O ponto: ausência de piso NUNCA vira piso fabricado.
    expect(r.venueSpreadPct).toBeNull();
  });

  it('zero corretoras / entradas inválidas => recusa, nunca lança', () => {
    expect(evaluateIndependentReference([], 100).status).toBe('DADOS_INSUFICIENTES');
    expect(evaluateIndependentReference(null, 100).status).toBe('DADOS_INSUFICIENTES');
    expect(evaluateIndependentReference(undefined, 100).status).toBe('DADOS_INSUFICIENTES');
  });

  it('corretora com preço inválido é descartada, não conta para o mínimo de 2', () => {
    const r = evaluateIndependentReference(
      [v('BINANCE', 100), v('MEXC', Number.NaN), v('', 100.2)] as never,
      100,
    );
    expect(r.venueCount).toBe(1);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
  });
});

describe('referência independente: a tolerância É o spread real das corretoras', () => {
  it('dentro do ruído: divergência menor que o spread que as corretoras já mostram', () => {
    // Binance 100 / MEXC 100.4 => spread 0.4%. Referência a 100.2 = o próprio meio.
    const r = evaluateIndependentReference([v('BINANCE', 100), v('MEXC', 100.4)], 100.2);
    expect(r.status).toBe('OK');
    expect(r.venueMid).toBeCloseTo(100.2, 10);
    expect(r.venueSpreadPct).toBeCloseTo(0.4, 10);
    expect(r.divergencePct).toBeCloseTo(0, 10);
    expect(r.verdict).toBe('DENTRO_DO_RUIDO_DAS_CORRETORAS');
  });

  it('fora do ruído: referência longe demais para o spread atual explicar', () => {
    // Corretoras muito juntas (spread 0.02%), referência 1% fora.
    const r = evaluateIndependentReference([v('BINANCE', 100), v('MEXC', 100.02)], 101);
    expect(r.status).toBe('OK');
    expect(r.venueSpreadPct).toBeCloseTo(0.02, 10);
    expect(r.divergencePct).toBeGreaterThan(r.venueSpreadPct!);
    expect(r.verdict).toBe('FORA_DO_RUIDO_DAS_CORRETORAS');
  });

  it('A MESMA divergência muda de veredito quando o spread do mercado muda', () => {
    // Esta é a invariante que prova que a tolerância é adaptativa e não fixa.
    const referencia = 100.5;
    const mercadoCalmo = evaluateIndependentReference([v('BINANCE', 100), v('MEXC', 100.01)], referencia);
    const mercadoEstressado = evaluateIndependentReference([v('BINANCE', 98), v('MEXC', 102)], referencia);
    expect(mercadoCalmo.verdict).toBe('FORA_DO_RUIDO_DAS_CORRETORAS');
    expect(mercadoEstressado.verdict).toBe('DENTRO_DO_RUIDO_DAS_CORRETORAS');
  });

  it('quatro corretoras concordando entre si tornam o piso mais exigente', () => {
    const r = evaluateIndependentReference(
      [v('BINANCE', 100), v('MEXC', 100.01), v('BYBIT', 100.005), v('OKX', 100.008)],
      100.9,
    );
    expect(r.venueCount).toBe(4);
    expect(r.verdict).toBe('FORA_DO_RUIDO_DAS_CORRETORAS');
  });

  it('o meio é (max+min)/2, nunca uma ponderação por liquidez desconhecida', () => {
    // 3 corretoras enviesadas para baixo não puxam o meio: o extremo define.
    const r = evaluateIndependentReference(
      [v('A', 100), v('B', 100), v('C', 100), v('D', 110)],
      105,
    );
    expect(r.venueMid).toBeCloseTo(105, 10);
    expect(r.divergencePct).toBeCloseTo(0, 10);
  });
});

describe('referência independente: pureza e apresentação', () => {
  it('não muta a entrada', () => {
    const venues = [v('BINANCE', 100), v('MEXC', 100.4)];
    const antes = JSON.parse(JSON.stringify(venues));
    evaluateIndependentReference(venues, 100.2);
    expect(JSON.parse(JSON.stringify(venues))).toEqual(antes);
  });

  it('determinística', () => {
    const venues = [v('BINANCE', 100), v('MEXC', 100.4)];
    expect(evaluateIndependentReference(venues, 100.2)).toEqual(evaluateIndependentReference(venues, 100.2));
  });

  it('a linha mostra Δ, spread e a contagem de corretoras — nunca só o veredito', () => {
    const linha = describeIndependentReference(
      evaluateIndependentReference([v('BINANCE', 100), v('MEXC', 100.4)], 101),
    );
    expect(linha).toContain('Δ');
    expect(linha).toContain('spread');
    expect(linha).toContain('2 corretoras');
  });

  it('sem dado => devolve a razão real, nunca um veredito', () => {
    const linha = describeIndependentReference(evaluateIndependentReference([v('A', 100)], 100));
    expect(linha).not.toContain('ruído');
    expect(linha.length).toBeGreaterThan(0);
  });
});

describe('referência independente: zero segunda implementação, zero limiar novo', () => {
  const src = readFileSync(new URL('../src/nexus/independent-reference-price.ts', import.meta.url), 'utf-8');

  it('a comparação é detectSourceConflict de schema.js, não uma cópia', () => {
    expect(src).toContain("from \"../../../js/real-data/schema.js\"");
    expect(src).toContain('detectSourceConflict(');
  });

  it('nenhuma constante de tolerância declarada aqui', () => {
    expect(src).not.toMatch(/const\s+\w*TOLERANCE\w*\s*=/);
    expect(src).not.toMatch(/const\s+\w*_PCT\s*=\s*[\d.]/);
  });

  it('a referência NUNCA é fundida no preço de uma venue (isolamento A2.1 §16)', () => {
    // Nenhuma soma/média entre referencePrice e preços de corretora.
    expect(src).not.toMatch(/referencePrice\s*\+\s*\w*[Pp]rice/);
    expect(src).not.toMatch(/\/\s*\(\s*validas\.length\s*\+\s*1\s*\)/);
  });
});

describe('referência independente: fiação real em App.tsx', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf-8');

  it('busca a referência com cadência própria, fora do caminho crítico do ciclo', () => {
    expect(app).toContain('fetchCoinGeckoReferencePrice(selectedAsset)');
    expect(app).toContain('setInterval(() => void buscar(), 60_000)');
    // Fail-closed: falha NUNCA congela o último preço como se fosse atual.
    expect(app).toContain('setReferencePriceUsd(r.ok ? r.priceUsd : null)');
  });

  it('o poller é desmontado junto com o efeito (sem vazamento nem cota queimada)', () => {
    const bloco = app.slice(app.indexOf('const [referencePriceUsd'), app.indexOf('// Preço real POR corretora'));
    expect(bloco).toContain('clearInterval(id)');
    expect(bloco).toContain('vivo = false');
  });

  it('o preço por corretora vem do book REAL de cada uma, nunca fundido', () => {
    expect(app).toContain('bestLevel(book.bids ?? [], "bid")');
    expect(app).toContain('bestLevel(book.asks ?? [], "ask")');
    expect(app).toContain('evaluateIndependentReference(venuePrices, referencePriceUsd)');
  });

  it('a referência NÃO alimenta o Núcleo nem o Trade Plan (LEI 24)', () => {
    expect(app).not.toMatch(/independentReference[^\n]*\b(engine\.|tradePlan|riskSuggestion|direction)\b/);
    expect(app).not.toMatch(/referencePriceUsd[^\n]*\b(engine\.|tradePlan|buildTradePlan)\b/);
  });

  it('só desenha com status OK — some inteira quando não há leitura real', () => {
    expect(app).toContain('independentReference?.status === "OK"');
    expect(app).toContain('describeIndependentReference(independentReference)');
  });
});
