// regime-secondary.test.ts — execução REAL.
//
// O defeito de origem: classifyMarketRegime é uma cascata winner-take-all
// que devolve o PRIMEIRO regime que casa e descarta em silêncio os outros
// que também são verdadeiros. O caso central abaixo (ADX forte E banda
// comprimida ao mesmo tempo) é exatamente o que a cascata apaga.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readRegimeSecondary, describeRegimeSecondary } from '../src/nexus/regime-secondary';
import {
  ADX_STRONG,
  ADX_MODERATE,
  SQUEEZE_PERCENTILE,
} from '../../src/market-regime/regime-engine.js';

describe('regime secundário: fail-closed', () => {
  it('regime ausente/insuficiente => DADOS_INSUFICIENTES', () => {
    for (const p of [null, undefined, '', 'DADOS_INSUFICIENTES']) {
      const r = readRegimeSecondary(p as never, { adx: 40 });
      expect(r.status).toBe('DADOS_INSUFICIENTES');
      expect(r.primary).toBeNull();
      expect(r.secondary).toEqual([]);
    }
  });

  it('sem evidência => recusa, nunca deduz de um rótulo sozinho', () => {
    const r = readRegimeSecondary('TENDENCIA_FORTE', null);
    expect(r.status).toBe('DADOS_INSUFICIENTES');
    expect(r.marginToThreshold).toBeNull();
  });

  it('evidência com números não-finitos é ausência, nunca leitura', () => {
    const r = readRegimeSecondary('TENDENCIA_FORTE', { adx: Number.NaN, bandwidth_percentile: Number.NaN });
    expect(r.status).toBe('OK');
    expect(r.marginToThreshold).toBeNull();
    expect(r.secondary).toEqual([]);
    expect(r.transition).toBe('DESCONHECIDA');
  });
});

describe('regime secundário: o que a cascata descartava', () => {
  it('ADX forte E banda comprimida => COMPRESSAO reaparece como secundário', () => {
    // Este é o caso real: a cascata testa TENDENCIA_FORTE antes de
    // COMPRESSAO, devolve a primeira, e a segunda some.
    const r = readRegimeSecondary('TENDENCIA_FORTE', {
      adx: ADX_STRONG + 10,
      bandwidth_percentile: SQUEEZE_PERCENTILE - 0.05,
    });
    expect(r.status).toBe('OK');
    expect(r.primary).toBe('TENDENCIA_FORTE');
    expect(r.secondary).toContain('COMPRESSAO');
  });

  it('BREAKOUT com ADX forte => TENDENCIA_FORTE reaparece como secundário', () => {
    const r = readRegimeSecondary('BREAKOUT', { adx: ADX_STRONG + 5, close_position: 'ACIMA_BANDA_SUPERIOR' });
    expect(r.secondary).toContain('TENDENCIA_FORTE');
  });

  it('o primário NUNCA aparece na própria lista de secundários', () => {
    const r = readRegimeSecondary('COMPRESSAO', { bandwidth_percentile: SQUEEZE_PERCENTILE - 0.1 });
    expect(r.secondary).not.toContain('COMPRESSAO');
  });

  it('nada mais verdadeiro => lista vazia, nunca um secundário fabricado', () => {
    const r = readRegimeSecondary('CONSOLIDACAO', {
      adx: ADX_MODERATE - 5,
      bandwidth_percentile: SQUEEZE_PERCENTILE + 0.3,
    });
    expect(r.secondary).toEqual([]);
  });

  it('o primário é passthrough LITERAL — nunca reescrito (LEI 24)', () => {
    const r = readRegimeSecondary('TENDENCIA_MODERADA', { adx: ADX_STRONG + 50 });
    // Mesmo com ADX que "mereceria" FORTE, o primário do motor é intocado.
    expect(r.primary).toBe('TENDENCIA_MODERADA');
  });
});

describe('regime secundário: margem, nunca probabilidade', () => {
  it('ADX no fio do limiar => margem ~0; ADX folgado => margem grande', () => {
    const fio = readRegimeSecondary('TENDENCIA_FORTE', { adx: ADX_STRONG });
    const folgado = readRegimeSecondary('TENDENCIA_FORTE', { adx: ADX_STRONG * 2 });
    expect(fio.marginToThreshold).toBeCloseTo(0, 10);
    expect(folgado.marginToThreshold).toBeCloseTo(1, 10);
    // O ponto: os DOIS têm o mesmo rótulo. A margem é o que os separa.
    expect(fio.primary).toBe(folgado.primary);
  });

  it('COMPRESSAO mede folga ABAIXO do piso (quanto mais comprimido, maior)', () => {
    const r = readRegimeSecondary('COMPRESSAO', { bandwidth_percentile: SQUEEZE_PERCENTILE / 2 });
    expect(r.marginToThreshold).toBeCloseTo(0.5, 10);
  });

  it('regimes SEM limiar numérico próprio => margem null, nunca uma régua inventada', () => {
    // BREAKOUT é decidido por posição de fechamento; CONSOLIDACAO é o
    // "nenhum dos outros". Nenhum dos dois tem limiar próprio.
    expect(readRegimeSecondary('BREAKOUT', { adx: 40 }).marginToThreshold).toBeNull();
    expect(readRegimeSecondary('CONSOLIDACAO', { adx: 5 }).marginToThreshold).toBeNull();
  });

  it('a margem NÃO é apresentada como probabilidade (Regra de Ouro 2)', () => {
    const src = readFileSync(new URL('../src/nexus/regime-secondary.ts', import.meta.url), 'utf-8');
    // Grepar a PALAVRA "probabilidade" seria um teste ruim: o cabeçalho a
    // usa justamente na frase que proíbe essa leitura. O que importa é o
    // CONTRATO — nenhum campo chamado confidence/probability, que é o que
    // convidaria a leitura errada num consumidor futuro.
    expect(src).not.toMatch(/^\s*confidence[?]?:/m);
    expect(src).not.toMatch(/^\s*probability[?]?:/m);
    // E o nome real do campo é explícito sobre o que ele mede.
    expect(src).toMatch(/^\s*marginToThreshold: number \| null;/m);
  });
});

describe('regime secundário: transição real', () => {
  it('banda estreitando => COMPRIMINDO; alargando => EXPANDINDO', () => {
    expect(readRegimeSecondary('CONSOLIDACAO', { bandwidth_percentile: 0.3, prev_bandwidth_percentile: 0.5 }).transition).toBe('COMPRIMINDO');
    expect(readRegimeSecondary('CONSOLIDACAO', { bandwidth_percentile: 0.6, prev_bandwidth_percentile: 0.4 }).transition).toBe('EXPANDINDO');
    expect(readRegimeSecondary('CONSOLIDACAO', { bandwidth_percentile: 0.4, prev_bandwidth_percentile: 0.4 }).transition).toBe('ESTAVEL');
  });

  it('sem leitura anterior => DESCONHECIDA, nunca "ESTAVEL" fabricado', () => {
    // Ausência de histórico NÃO é estabilidade observada.
    const r = readRegimeSecondary('CONSOLIDACAO', { bandwidth_percentile: 0.4 });
    expect(r.transition).toBe('DESCONHECIDA');
  });
});

describe('regime secundário: limiares importados, nunca redeclarados', () => {
  const src = readFileSync(new URL('../src/nexus/regime-secondary.ts', import.meta.url), 'utf-8');

  it('os três limiares vêm do motor que os declara', () => {
    expect(src).toContain('from "../../../src/market-regime/regime-engine.js"');
    expect(src).toContain('ADX_STRONG');
    expect(src).toContain('ADX_MODERATE');
    expect(src).toContain('SQUEEZE_PERCENTILE');
  });

  it('nenhum número mágico redeclarado aqui', () => {
    expect(src).not.toMatch(/const\s+ADX_\w+\s*=\s*\d/);
    expect(src).not.toMatch(/const\s+SQUEEZE\w*\s*=\s*[\d.]/);
  });

  it('pureza: não muta a evidência recebida', () => {
    const ev = { adx: 40, bandwidth_percentile: 0.2, prev_bandwidth_percentile: 0.3 };
    const antes = JSON.parse(JSON.stringify(ev));
    readRegimeSecondary('TENDENCIA_FORTE', ev);
    expect(JSON.parse(JSON.stringify(ev))).toEqual(antes);
  });
});

describe('regime secundário: describeRegimeSecondary', () => {
  it('mostra secundário, margem e transição juntos', () => {
    const linha = describeRegimeSecondary(
      readRegimeSecondary('TENDENCIA_FORTE', {
        adx: ADX_STRONG * 2,
        bandwidth_percentile: SQUEEZE_PERCENTILE - 0.05,
        prev_bandwidth_percentile: 0.5,
      }),
    );
    expect(linha).toContain('também COMPRESSAO');
    expect(linha).toContain('margem +100% do limiar');
    expect(linha).toContain('comprimindo');
  });

  it('sem leitura => razão real, nunca um veredito', () => {
    expect(describeRegimeSecondary(readRegimeSecondary(null, null))).not.toContain('margem');
  });
});

describe('regime secundário: fiação real', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf-8');
  const bridge = readFileSync(new URL('../src/engine-bridge.ts', import.meta.url), 'utf-8');

  it('prevBandwidthPercentile atravessa a ponte — sem ele não há transição', () => {
    // A ponte já recebia prev_bandwidth_percentile do motor e o descartava.
    expect(bridge).toContain('prevBandwidthPercentile: regimeResult.evidence.prev_bandwidth_percentile ?? null');
    expect(bridge).toContain('prevBandwidthPercentile: number | null;');
  });

  it('lê a evidência REAL do motor, nunca recalcula ADX/banda', () => {
    expect(app).toContain('readRegimeSecondary(regime?.regime ?? null');
    expect(app).toContain('adx: regime?.adx ?? null');
    expect(app).toContain('prev_bandwidth_percentile: regime?.prevBandwidthPercentile ?? null');
  });

  it('o regime primário do motor continua sendo a linha oficial (LEI 24)', () => {
    expect(app).toContain('<Row label="REGIME (MOTOR OFICIAL)" value={regimeLabel}');
    // A leitura secundária nunca substitui regimeLabel nem vira direção.
    expect(app).not.toMatch(/regimeLabel\s*=\s*[^;\n]*regimeSecondary/);
    expect(app).not.toMatch(/regimeSecondary[^\n]*\b(direction|engine\.|tradePlan)\b/);
  });

  it('só desenha quando há algo real a dizer', () => {
    expect(app).toContain('regimeSecondary.secondary.length > 0 || regimeSecondary.marginToThreshold !== null');
  });
});
