// annotation-decay.ts — Ordem "Ciborgue Vivo" §1 ("pensa e depois esquece
// para não acumular peso"): decaimento real por IDADE EM CANDLES (não
// relógio de parede — o mesmo motor roda em qualquer timeframe, então só
// a contagem de candles é uma unidade honesta e comparável entre 1m e
// 1D). Extraído para um único módulo compartilhado depois que a mesma
// função nasceu duplicada em LiquidityZonesPlugin.tsx e
// StructureBreakMarkersPlugin.tsx — mesmo princípio de zero-repetição já
// aplicado a fractal-swings.js no lado dos motores.
//
// Uma anotação jovem (age <= fadeStartCandles) desenha na opacidade total;
// a partir daí esmaece linearmente até minAlpha em expireCandles; depois
// disso o alpha é 0 ("esquecida" — só da TELA, nunca do dado real: o
// caller decide separadamente o que faz com alpha<=0, normalmente não
// desenhar mais, mas o dado de origem em App.tsx segue intacto para
// qualquer outro consumidor).
export interface DecayConfig {
  fadeStartCandles: number;
  expireCandles: number;
  minAlpha: number;
}

export function ageAlpha(age: number, config: DecayConfig): number {
  const { fadeStartCandles, expireCandles, minAlpha } = config;
  if (age <= fadeStartCandles) return 1;
  if (age >= expireCandles) return 0;
  const t = (age - fadeStartCandles) / (expireCandles - fadeStartCandles);
  return 1 - t * (1 - minAlpha);
}
