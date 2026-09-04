import { describe, it, expect } from 'vitest';
import { capOverlappingFillAlpha, rgbaWithAlpha, parseRgbaAlpha, type FillRectInput } from '../src/nexus/zone-fill-overlap';

const rect = (x1: number, x2: number, yTop: number, yBottom: number, alpha: number): FillRectInput => ({ x1, x2, yTop, yBottom, alpha });

describe('capOverlappingFillAlpha: preenchimento cross-kind nunca empilha — MESMO princípio de fuseLiquidityZones (max, nunca soma)', () => {
  it('array vazio => array vazio', () => {
    expect(capOverlappingFillAlpha([])).toEqual([]);
  });

  it('um único retângulo => sai inalterado (caso comum, zero mudança de comportamento pra zona isolada)', () => {
    const result = capOverlappingFillAlpha([rect(0, 100, 10, 20, 0.15)]);
    expect(result).toEqual([{ x1: 0, x2: 100, yTop: 10, yBottom: 20, alpha: 0.15 }]);
  });

  it('dois retângulos sem sobreposição real (Y distantes) => saem os dois, alphas próprios preservados', () => {
    const result = capOverlappingFillAlpha([rect(0, 100, 10, 20, 0.10), rect(0, 100, 50, 60, 0.20)]);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ x1: 0, x2: 100, yTop: 10, yBottom: 20, alpha: 0.10 });
    expect(result).toContainEqual({ x1: 0, x2: 100, yTop: 50, yBottom: 60, alpha: 0.20 });
  });

  it('dois retângulos EXATAMENTE sobrepostos (mesmo X e Y) com alphas diferentes => UM retângulo no alpha MÁXIMO, nunca a soma', () => {
    // 0.10 + 0.20 = 0.30 seria a soma ingênua (o defeito real "parede de cor");
    // o resultado correto é max(0.10, 0.20) = 0.20, um só retângulo.
    const result = capOverlappingFillAlpha([rect(0, 100, 10, 20, 0.10), rect(0, 100, 10, 20, 0.20)]);
    expect(result).toEqual([{ x1: 0, x2: 100, yTop: 10, yBottom: 20, alpha: 0.20 }]);
  });

  it('sobreposição PARCIAL em X (mesma faixa de preço, larguras diferentes — o caso real: cada zona começa no seu próprio candle de formação) decompõe em 2 regiões: só-A e A+B no alpha máximo', () => {
    // A vai de x=0 até plotRight=200 (formou mais cedo); B vai de x=80 até 200 (formou depois, mais estreita).
    const a = rect(0, 200, 10, 20, 0.10);
    const b = rect(80, 200, 10, 20, 0.20);
    const result = capOverlappingFillAlpha([a, b]);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ x1: 0, x2: 80, yTop: 10, yBottom: 20, alpha: 0.10 }); // só A, antes de B começar
    expect(result).toContainEqual({ x1: 80, x2: 200, yTop: 10, yBottom: 20, alpha: 0.20 }); // A+B sobrepostos, MAX(0.10,0.20)=0.20
  });

  it('sobreposição PARCIAL em Y (faixas de preço parcialmente coincidentes) decompõe em 3 bandas: só-A, A+B, só-B', () => {
    const a = rect(0, 100, 0, 30, 0.10);
    const b = rect(0, 100, 20, 50, 0.25);
    const result = capOverlappingFillAlpha([a, b]);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ x1: 0, x2: 100, yTop: 0, yBottom: 20, alpha: 0.10 });
    expect(result).toContainEqual({ x1: 0, x2: 100, yTop: 20, yBottom: 30, alpha: 0.25 }); // sobreposição real: MAX(0.10,0.25)
    expect(result).toContainEqual({ x1: 0, x2: 100, yTop: 30, yBottom: 50, alpha: 0.25 });
  });

  it('achado real reproduzido (harness Playwright, "o gráfico não tá legal"): 4 zonas do MESMO type (FVG/OB/Breaker/Mitigation) sobrepostas — a região de sobreposição total nunca excede a mais forte das 4 sozinha', () => {
    // Espelha a geometria real medida: FVG (mais larga/mais recente), OB,
    // Breaker, Mitigation (mais estreita/mais antiga) — cada uma com o
    // alpha próprio real da paleta (FVG=0.10, OB=0.15, Breaker=0.07,
    // Mitigation=0.05). A soma ingênua seria 0.37 (a "parede" que o
    // Operador viu); o teto real é max = 0.15 (OB).
    const fvg = rect(100, 800, 130, 260, 0.10);
    const ob = rect(80, 800, 150, 300, 0.15);
    const brk = rect(50, 800, 120, 280, 0.07);
    const mit = rect(30, 800, 140, 240, 0.05);
    const result = capOverlappingFillAlpha([fvg, ob, brk, mit]);
    const maxAlphaAnywhere = Math.max(...result.map((r) => r.alpha));
    expect(maxAlphaAnywhere).toBeCloseTo(0.15, 5); // nunca mais que a zona mais forte (OB) sozinha
    expect(maxAlphaAnywhere).toBeLessThan(0.10 + 0.15 + 0.07 + 0.05); // nunca a soma ingênua
    // Nenhum retângulo de saída se sobrepõe a outro (a garantia real que
    // evita reempilhar ao desenhar em sequência): checagem por amostragem
    // de grade fina — cada ponto (x,y) pertence a NO MÁXIMO um retângulo.
    for (let x = 0; x < 800; x += 25) {
      for (let y = 0; y < 320; y += 10) {
        const covering = result.filter((r) => r.x1 <= x && x < r.x2 && r.yTop <= y && y < r.yBottom);
        expect(covering.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('fail-closed: retângulos degenerados (x2<=x1, yBottom<=yTop, alpha<=0) ou não-finitos são descartados antes da decomposição, nunca desenham um palpite', () => {
    const degenerate: FillRectInput[] = [
      rect(100, 100, 10, 20, 0.1), // x2 === x1
      rect(0, 100, 20, 20, 0.1), // yBottom === yTop
      rect(0, 100, 10, 20, 0), // alpha zero
      rect(0, 100, 10, 20, -0.5), // alpha negativo
      rect(NaN, 100, 10, 20, 0.1), // não-finito
    ];
    expect(capOverlappingFillAlpha(degenerate)).toEqual([]);
    // mas um retângulo válido no MESMO array continua saindo normalmente
    const mixed = [...degenerate, rect(0, 100, 10, 20, 0.3)];
    expect(capOverlappingFillAlpha(mixed)).toEqual([{ x1: 0, x2: 100, yTop: 10, yBottom: 20, alpha: 0.3 }]);
  });
});

describe('rgbaWithAlpha / parseRgbaAlpha: reusam a MESMA tripla RGB já declarada na paleta, nunca uma segunda cor redigitada', () => {
  it('rgbaWithAlpha substitui só o alpha, preserva a tripla RGB exata', () => {
    expect(rgbaWithAlpha('rgba(242, 54, 69, 0.15)', 0.583)).toBe('rgba(242, 54, 69, 0.583)');
    expect(rgbaWithAlpha('rgba(8, 153, 129, 0.10)', 1)).toBe('rgba(8, 153, 129, 1.000)');
  });

  it('parseRgbaAlpha extrai o alpha real já embutido na paleta — a MESMA leitura inversa', () => {
    expect(parseRgbaAlpha('rgba(242, 54, 69, 0.15)')).toBe(0.15);
    expect(parseRgbaAlpha('rgba(8, 153, 129, 0.05)')).toBe(0.05);
  });

  it('round-trip: parseRgbaAlpha(rgbaWithAlpha(x, a)) === a, pra qualquer paleta real do arquivo', () => {
    for (const original of ['rgba(242, 54, 69, 0.10)', 'rgba(8, 153, 129, 0.15)', 'rgba(0, 98, 255, 0.35)', 'rgba(236, 81, 205, 0.85)']) {
      const replaced = rgbaWithAlpha(original, 0.472);
      expect(parseRgbaAlpha(replaced)).toBeCloseTo(0.472, 3);
    }
  });

  it('fail-closed: string fora do formato esperado — rgbaWithAlpha devolve inalterada, parseRgbaAlpha devolve 1 (opaco, nunca NaN/negativo)', () => {
    expect(rgbaWithAlpha('not-a-color', 0.5)).toBe('not-a-color');
    expect(rgbaWithAlpha('#f23645', 0.5)).toBe('#f23645');
    expect(parseRgbaAlpha('not-a-color')).toBe(1);
    expect(parseRgbaAlpha('#f23645')).toBe(1);
  });
});
