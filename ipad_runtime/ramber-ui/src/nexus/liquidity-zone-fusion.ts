// liquidity-zone-fusion.ts — Ordem de Fechamento (Operador: "no gráfico
// vai aparecer as coisa corretamente, não ficar poluído... só as marca
// perfeita e certeira") + pedido explícito anterior ("zonas de liquidez...
// fundir visualmente quando fizer sentido... evitar várias caixas
// sobrepostas... evitar 'paredes' de cor").
//
// Achado real de auditoria: LiquidityZonesPlugin.tsx desenha CADA FVG/
// Order Block bruto como seu próprio retângulo translúcido, do candle de
// formação até a borda direita do canvas — sem nenhuma consciência de
// outras zonas do MESMO tipo sobrepostas no preço. Com muitos FVG/OB reais
// ativos ao mesmo tempo (comum em mercado real, cada um individualmente
// honesto), o preenchimento de cada caixa EMPILHA visualmente sobre as
// outras (alpha composto: 2 zonas a 10% leem como ~19%, 3 como ~27%...) —
// a "parede de cor" literal que a Ordem descreve.
//
// O que este módulo faz: funde, só para EXIBIÇÃO, zonas cujo intervalo de
// preço [bottom,top] se sobrepõe ou fica a menos de proximityPct de
// distância — mesmo padrão real de "ordenar + varrer com âncora" já usado
// por clusterSweptPrices (trap-detection.ts), adaptado de PONTOS
// (zero-width) para INTERVALOS reais (a altura de cada zona nunca é
// descartada, só o preenchimento redundante). O chamador é responsável por
// só agrupar zonas do MESMO tipo/família (nunca funde BULLISH com BEARISH,
// nunca FVG com OB — são fenômenos estruturais reais distintos; fundir
// dados diferentes apagaria informação real, Regra de Ouro 4).
//
// Zero segundo cálculo de obstáculo/peso/idade: cada zona de entrada já
// chega com seu próprio alpha real (ageAlpha ou o peso do orçamento visual,
// resolvidos por quem chama) e sua própria flag de obstáculo
// (obstacleZonesInPath, já resolvida) — a fusão só decide COMO desenhar,
// nunca SE uma zona é relevante ou é obstáculo.

export interface FusableZoneInput {
  top: number;
  bottom: number;
  index: number;
  // Já resolvido pelo chamador (ageAlpha ou peso do orçamento visual) —
  // este módulo nunca recalcula decaimento.
  alpha: number;
  // Já resolvido pelo chamador (obstacleZonesInPath) — este módulo nunca
  // recalcula obstáculo.
  isObstacle: boolean;
}

export interface FusedLiquidityZone {
  top: number;
  bottom: number;
  // Formação mais ANTIGA do grupo (menor index) — a área de liquidez
  // existe visualmente desde o primeiro membro real que a formou.
  index: number;
  // MAIOR alpha real do grupo — nunca inventado, nunca amaciado pela
  // média: se um membro está fresco (alpha alto) e outro velho (alpha
  // baixo), a evidência mais forte e mais recente vence, nunca a mais
  // fraca.
  alpha: number;
  // true se QUALQUER membro real for obstáculo do plano ativo — nunca
  // escondido por estar agrupado com zonas que não são.
  isObstacle: boolean;
  // Quantas zonas reais fundiram neste grupo — 1 = zona isolada (nenhuma
  // mudança de composição visual), >1 = confluência real de múltiplas
  // formações no mesmo intervalo de preço.
  memberCount: number;
}

/** Funde zonas do MESMO grupo semântico (o chamador já filtrou por tipo/
 *  família) cujo intervalo de preço se sobrepõe ou fica a menos de
 *  `proximityPct` de distância (% do preço, mesma convenção real de
 *  LIQUIDITY_PROXIMITY_PCT — nunca um valor absoluto, que quebraria em
 *  ativos de preço muito diferente). Fail-closed: entradas não-finitas ou
 *  com bottom > top nunca desenham um palpite — são descartadas antes do
 *  agrupamento, nunca silenciosamente "corrigidas". */
export function fuseLiquidityZones(zones: FusableZoneInput[], proximityPct: number): FusedLiquidityZone[] {
  const valid = zones.filter(
    (z) => Number.isFinite(z.top) && Number.isFinite(z.bottom) && z.top >= z.bottom && Number.isFinite(z.index),
  );
  if (valid.length === 0) return [];

  const sorted = [...valid].sort((a, b) => a.bottom - b.bottom);
  const groups: FusableZoneInput[][] = [];
  let current: FusableZoneInput[] = [sorted[0]];
  let currentTop = sorted[0].top;

  for (let i = 1; i < sorted.length; i++) {
    const z = sorted[i];
    const gapPct = currentTop > 0 ? ((z.bottom - currentTop) * 100) / currentTop : Infinity;
    const overlapsOrClose = z.bottom <= currentTop || gapPct <= proximityPct;
    if (overlapsOrClose) {
      current.push(z);
      currentTop = Math.max(currentTop, z.top);
    } else {
      groups.push(current);
      current = [z];
      currentTop = z.top;
    }
  }
  groups.push(current);

  return groups.map((group) => ({
    top: Math.max(...group.map((z) => z.top)),
    bottom: Math.min(...group.map((z) => z.bottom)),
    index: Math.min(...group.map((z) => z.index)),
    alpha: Math.max(...group.map((z) => z.alpha)),
    isObstacle: group.some((z) => z.isObstacle),
    memberCount: group.length,
  }));
}
