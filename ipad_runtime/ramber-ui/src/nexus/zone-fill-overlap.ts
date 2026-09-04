// zone-fill-overlap.ts — achado real (captura de tela do Operador,
// BTC/USDT 30m: "o jeito que tá o gráfico agora não tá legal"). FVG/OB/
// Breaker/Mitigation do MESMO type (BULLISH/BEARISH) nunca se fundem
// entre kinds diferentes (liquidity-zone-fusion.ts, por design — preserva
// identidade estrutural real, Regra de Ouro 4: um Order Block e o FVG que
// ele gerou ao lado são fenômenos distintos, fundi-los apagaria
// informação real). Quando 2+ desses kinds se sobrepõem no mesmo preço
// (comum: um Order Block costuma gerar um FVG logo ao lado; um OB que
// falha vira Breaker, depois Mitigation), cada um continua desenhando seu
// próprio fillRect translúcido — e o Canvas 2D compõe cada camada sobre a
// anterior via "source-over" padrão, então o preenchimento EMPILHA.
// MEDIDO num harness real (nunca no app ao vivo): 4 zonas reais sobrepostas
// compõem até ~55-60% de opacidade onde se cruzam, contra ~10% de uma
// zona sozinha — a MESMA classe "parede de cor" que liquidity-zone-
// fusion.ts já resolveu para o caso intra-kind (comentário own dali:
// "2 zonas a 10% leem como ~19%, 3 como ~27%..."), nunca medida nem
// resolvida para o caso cross-kind.
//
// MESMO PRINCÍPIO que fuseLiquidityZones já usa (`alpha: Math.max(...)`,
// nunca soma) — só que aqui a fusão em si não é permitida (kinds
// diferentes continuam kinds diferentes, cada um com sua própria borda e
// etiqueta, desenhadas à parte por quem chama). Este módulo resolve só o
// PREENCHIMENTO compartilhado: decompõe um conjunto de retângulos
// preenchidos (cada um já com seu alpha efetivo real resolvido pelo
// chamador) em regiões SEM sobreposição entre si, cada uma no alpha
// MÁXIMO real dentre os retângulos de entrada que a cobrem. Desenhar o
// resultado uma vez cada nunca reproduz o empilhamento, porque nenhum par
// de retângulos de saída toca o mesmo pixel duas vezes.
export interface FillRectInput {
  x1: number;
  x2: number;
  yTop: number;
  yBottom: number;
  /** Alpha efetivo já resolvido pelo chamador (ex.: zone.alpha × alpha
   *  próprio da paleta) — este módulo nunca recalcula decaimento/peso. */
  alpha: number;
}

export interface CappedFillRect {
  x1: number;
  x2: number;
  yTop: number;
  yBottom: number;
  alpha: number;
}

/** Decompõe um conjunto de retângulos preenchidos em regiões
 *  NÃO-SOBREPOSTAS, cada uma no alpha MÁXIMO real dentre os retângulos de
 *  entrada que a cobrem — nunca a soma. Fail-closed: entradas não-finitas
 *  ou degeneradas (x2<=x1, yBottom<=yTop, alpha<=0) são descartadas antes
 *  da decomposição, nunca desenham um palpite. Células adjacentes no
 *  MESMO Y-band com o MESMO alpha resultante são fundidas de volta numa
 *  só (evita costura visível de antialiasing entre células vizinhas sem
 *  diferença real nenhuma). */
export function capOverlappingFillAlpha(rects: FillRectInput[]): CappedFillRect[] {
  const valid = rects.filter(
    (r) =>
      Number.isFinite(r.x1) &&
      Number.isFinite(r.x2) &&
      Number.isFinite(r.yTop) &&
      Number.isFinite(r.yBottom) &&
      Number.isFinite(r.alpha) &&
      r.x2 > r.x1 &&
      r.yBottom > r.yTop &&
      r.alpha > 0,
  );
  if (valid.length === 0) return [];

  const ys = [...new Set(valid.flatMap((r) => [r.yTop, r.yBottom]))].sort((a, b) => a - b);
  const out: CappedFillRect[] = [];

  for (let yi = 0; yi < ys.length - 1; yi++) {
    const yTop = ys[yi];
    const yBottom = ys[yi + 1];
    const yMid = (yTop + yBottom) / 2;
    const coveringY = valid.filter((r) => r.yTop <= yMid && r.yBottom >= yMid);
    if (coveringY.length === 0) continue;

    const xs = [...new Set(coveringY.flatMap((r) => [r.x1, r.x2]))].sort((a, b) => a - b);
    let runStart: number | null = null;
    let runAlpha = 0;
    const flushRun = (endX: number) => {
      if (runStart !== null) out.push({ x1: runStart, x2: endX, yTop, yBottom, alpha: runAlpha });
      runStart = null;
    };
    for (let xi = 0; xi < xs.length - 1; xi++) {
      const x1 = xs[xi];
      const x2 = xs[xi + 1];
      const xMid = (x1 + x2) / 2;
      const coveringXY = coveringY.filter((r) => r.x1 <= xMid && r.x2 >= xMid);
      const alpha = coveringXY.length > 0 ? Math.max(...coveringXY.map((r) => r.alpha)) : 0;
      if (alpha <= 0) {
        flushRun(x1);
        continue;
      }
      if (runStart === null) {
        runStart = x1;
        runAlpha = alpha;
      } else if (alpha !== runAlpha) {
        flushRun(x1);
        runStart = x1;
        runAlpha = alpha;
      }
    }
    flushRun(xs[xs.length - 1]);
  }

  return out;
}

/** Substitui o alpha embutido numa cor `rgba(r, g, b, a)` já existente
 *  (ex.: a `fill` de uma ZonePalette real) pelo alpha capado — reusa a
 *  MESMA tripla RGB já declarada na paleta de origem, nunca uma segunda
 *  cor redigitada à parte (todos os kinds do mesmo `type` já compartilham
 *  a mesma tripla real: 242,54,69 para BEARISH / 8,153,129 para BULLISH,
 *  só o alpha difere entre FVG/OB/Breaker/Mitigation). Fail-closed: uma
 *  string fora do formato esperado volta inalterada, nunca quebra o
 *  desenho por um regex que não casou. */
export function rgbaWithAlpha(rgba: string, alpha: number): string {
  const match = rgba.match(/^(rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*)[\d.]+(\s*\))$/);
  if (!match) return rgba;
  return `${match[1]}${alpha.toFixed(3)}${match[2]}`;
}

/** Extrai o alpha embutido numa cor `rgba(r, g, b, a)` já existente — a
 *  MESMA leitura inversa de rgbaWithAlpha, usada pelo chamador para achar
 *  o "alpha próprio" real de cada palette.fill sem redigitar o número em
 *  outro lugar. Fail-closed: string fora do formato devolve 1 (opaco),
 *  nunca um valor negativo/NaN que quebraria o cálculo a jusante. */
export function parseRgbaAlpha(rgba: string): number {
  const match = rgba.match(/,\s*([\d.]+)\s*\)$/);
  const value = match ? Number(match[1]) : NaN;
  return Number.isFinite(value) ? value : 1;
}
