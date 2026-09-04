// canvas-palette.test.ts — Achado 3.1 (Auditoria Visual Sistemática).
//
// Este arquivo tem DOIS papéis. O primeiro é o de sempre: execução real das
// funções puras. O segundo é o que importa mais — a TRAVA.
//
// O Achado 2.6 ensinou a lição do jeito difícil: a Kill Zone foi reclamada
// DUAS vezes pelo Operador, com quase as mesmas palavras, porque a primeira
// correção não deixou nenhum teste impedindo a regressão. Drift de cor é a
// mesma classe de problema, e pior: não volta de uma vez, volta um `rgba()`
// por vez, cada um parecendo inofensivo na revisão do próprio PR. Foi assim
// que chegamos a 30 tripletos distintos.
//
// Então este teste MEDE, a cada rodada, o matiz de toda cor do CÓDIGO de
// `chart/*` e falha se aparecer qualquer tom que não seja uma das 6 famílias
// canônicas (variação de luminosidade do mesmo matiz é legítima e passa).
// Revisão manual não é mais a defesa.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  chartBullishRgba,
  chartBearishRgba,
  chartPaletteRgba,
  chartRgbToHsl,
  chartHueDistance,
  CHART_BULLISH_HEX,
  CHART_BEARISH_HEX,
  CHART_PALETTE,
  CHART_CHROME,
  CHART_PALETTE_MIN_HUE_SEPARATION_DEG,
  CHART_PALETTE_CHROME_MAX_SATURATION,
  type ChartPaletteFamily,
} from '../src/chart/canvas-palette';

const here = dirname(fileURLToPath(import.meta.url));
const chartDir = resolve(here, '../src/chart');

/** Remove comentários antes de medir. Sem isto a trava acusaria as citações
 *  HISTÓRICAS dos tons antigos que vivem legitimamente nos comentários deste
 *  projeto ("era azul rgba(66,165,245,...)"), que documentam de onde o código
 *  veio e são exatamente o tipo de memória que o CLAUDE.md manda preservar.
 *  Mesma lição do Achado 2.5, onde um comentário próprio quebrou um teste de
 *  regex: a trava governa CÓDIGO, nunca prosa. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => {
      const t = line.trimStart();
      if (t.startsWith('//') || t.startsWith('*')) return '';
      if (line.includes('://')) return line; // URL, nunca comentário
      const idx = line.indexOf('//');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');
}

/** Todo tripleto `r, g, b` dentro de um rgb()/rgba() no CÓDIGO de chart/*, com
 *  o arquivo onde apareceu — a mesma medição que originou o achado. */
function collectChartTriplets(): { triplet: string; file: string }[] {
  const out: { triplet: string; file: string }[] = [];
  for (const name of readdirSync(chartDir)) {
    if (!/\.tsx?$/.test(name)) continue;
    if (name === 'canvas-palette.ts') continue; // a própria fonte da verdade
    const src = stripComments(readFileSync(resolve(chartDir, name), 'utf8'));
    for (const m of src.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) {
      out.push({ triplet: `${m[1]}, ${m[2]}, ${m[3]}`, file: name });
    }
  }
  return out;
}

/** Código de todos os plugins concatenado, já sem comentários. */
function allChartCode(): string {
  return readdirSync(chartDir)
    .filter((n) => /\.tsx?$/.test(n) && n !== 'canvas-palette.ts')
    .map((n) => stripComments(readFileSync(resolve(chartDir, n), 'utf8')))
    .join('\n');
}

const FAMILY_HUES = Object.fromEntries(
  (Object.keys(CHART_PALETTE) as ChartPaletteFamily[]).map((f) => [f, chartRgbToHsl(CHART_PALETTE[f]).h]),
) as Record<ChartPaletteFamily, number>;

const CHROME_TRIPLETS = new Set<string>(Object.values(CHART_CHROME));

describe('canvas-palette: funções puras (execução real)', () => {
  it('chartPaletteRgba compõe rgba real a partir da família', () => {
    expect(chartPaletteRgba('bullish', 0.5)).toBe('rgba(8, 153, 129, 0.5)');
    expect(chartPaletteRgba('bearish', 0.75)).toBe('rgba(242, 54, 69, 0.75)');
  });

  it('os apelidos bullish/bearish devolvem a MESMA cor da paleta — zero par duplicado que possa divergir', () => {
    expect(chartBullishRgba(0.5)).toBe(chartPaletteRgba('bullish', 0.5));
    expect(chartBearishRgba(0.5)).toBe(chartPaletteRgba('bearish', 0.5));
  });

  it('os hex exportados são a mesma cor-base das funções rgba (par TradingView, decisão explícita do Operador)', () => {
    expect(CHART_BULLISH_HEX).toBe('#089981');
    expect(CHART_BEARISH_HEX).toBe('#f23645');
    expect(chartRgbToHsl(CHART_PALETTE.bullish).h).toBe(170);
    expect(chartRgbToHsl(CHART_PALETTE.bearish).h).toBe(355);
  });

  it('chartRgbToHsl mede matiz/saturação/luminosidade reais — é a base da trava abaixo', () => {
    expect(chartRgbToHsl('255, 0, 0')).toEqual({ h: 0, s: 100, l: 50 });
    expect(chartRgbToHsl('0, 255, 0')).toEqual({ h: 120, s: 100, l: 50 });
    expect(chartRgbToHsl('128, 128, 128')).toEqual({ h: 0, s: 0, l: 50 });
    expect(chartRgbToHsl('245, 158, 11').h).toBe(38);
  });

  it('chartHueDistance trata matiz como circular — 350° e 10° estão a 20°, nunca a 340°', () => {
    expect(chartHueDistance(350, 10)).toBe(20);
    expect(chartHueDistance(10, 350)).toBe(20);
    expect(chartHueDistance(0, 180)).toBe(180);
    expect(chartHueDistance(38, 38)).toBe(0);
  });
});

describe('canvas-palette: a paleta em si é distinguível (limite profissional de 6-8 cores)', () => {
  it('são exatamente 6 famílias — Bloomberg Terminal opera com 5, TradingView com 7; tínhamos 30 tons antes desta rodada', () => {
    expect(Object.keys(CHART_PALETTE)).toHaveLength(6);
  });

  it('TODO par de famílias está acima da separação mínima de matiz — nenhuma dupla indistinguível numa linha de 1px', () => {
    const families = Object.keys(CHART_PALETTE) as ChartPaletteFamily[];
    const tooClose: string[] = [];
    for (let i = 0; i < families.length; i++) {
      for (let j = i + 1; j < families.length; j++) {
        const d = chartHueDistance(FAMILY_HUES[families[i]], FAMILY_HUES[families[j]]);
        if (d < CHART_PALETTE_MIN_HUE_SEPARATION_DEG) {
          tooClose.push(`${families[i]}(${FAMILY_HUES[families[i]]}°) x ${families[j]}(${FAMILY_HUES[families[j]]}°) = ${d}°`);
        }
      }
    }
    expect(tooClose, `famílias indistinguíveis: ${tooClose.join('; ')}`).toEqual([]);
  });

  it('regressão nomeada: institucional x baixa — o código dizia querer ~30° do vermelho mas implementava 14°; agora cumpre', () => {
    expect(chartHueDistance(326, 340)).toBe(14); // o que estava implementado (magenta 326 x neon 340)
    expect(chartHueDistance(FAMILY_HUES.institutional, FAMILY_HUES.bearish)).toBe(43); // o que temos agora
  });

  it('regressão nomeada: medição x alta — o ciano antigo (184°) ficaria a 14° do verde TradingView; o azul resolve', () => {
    expect(chartHueDistance(184, FAMILY_HUES.bullish)).toBe(14); // por que o ciano não podia ficar
    expect(chartHueDistance(FAMILY_HUES.measurement, FAMILY_HUES.bullish)).toBe(47); // o que temos agora
  });
});

describe('TRAVA anti-drift: nenhuma cor nova entra em chart/* sem ser da paleta', () => {
  const triplets = collectChartTriplets();

  it('a medição de fato encontra cor real nos plugins (o teste não passa por varrer nada)', () => {
    expect(triplets.length).toBeGreaterThan(50);
  });

  it('TODA cor saturada de chart/* pertence a uma das 6 famílias — matiz idêntico ao canônico, luminosidade/alpha livres', () => {
    const offenders: string[] = [];
    const seen = new Set<string>();
    for (const { triplet, file } of triplets) {
      const key = `${triplet}|${file}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (CHROME_TRIPLETS.has(triplet)) continue; // cromo declarado
      const { h, s } = chartRgbToHsl(triplet);
      if (s < CHART_PALETTE_CHROME_MAX_SATURATION) continue; // cinza/quase-cinza: cromo por construção
      const match = (Object.keys(FAMILY_HUES) as ChartPaletteFamily[]).find(
        (f) => chartHueDistance(FAMILY_HUES[f], h) <= 2,
      );
      if (!match) offenders.push(`rgba(${triplet}) matiz ${h}° em ${file}`);
    }
    expect(
      offenders,
      `cor fora da paleta (use chartPaletteRgba ou registre a família em canvas-palette.ts):\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  it('o par neon antigo (#00ffaa / #ff0055) não existe mais no código de chart/* — a troca pelo par TradingView foi completa, não parcial', () => {
    const raw = allChartCode();
    expect(raw).not.toMatch(/#00ffaa/i);
    expect(raw).not.toMatch(/#ff0055/i);
    expect(raw).not.toContain('0, 255, 170');
    expect(raw).not.toContain('255, 0, 85');
  });

  it('nenhum dos âmbares antigos sobrou — era o pior aglomerado medido (8 tons num intervalo de 17°)', () => {
    const raw = allChartCode();
    for (const old of ['255, 140, 0', '255, 176, 32', '255, 191, 0', '255, 213, 0', '240, 208, 111']) {
      expect(raw, `âmbar antigo ainda presente: ${old}`).not.toContain(old);
    }
  });
});
