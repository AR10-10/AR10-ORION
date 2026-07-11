// fibonacci-confluence.ts — V-MAX Fase 1.4: Matriz de Confluência
// Fibonacci ("agente transversal" do Blueprint — cruza a saída de VÁRIOS
// motores reais, nunca cria um dado primário próprio).
//
// Auditoria de zero-repetição ANTES de construir: o único motor Fibonacci
// existente é a EXTENSÃO 61.8% do support-resistance-engine.js (uma
// projeção de alvo). O RETRACEMENT está explicitamente documentado como
// "sem motor implementado nesta fase" (research-engine.js) — é ISSO que
// este módulo adiciona, sobre a MESMA definição de perna real do motor de
// S/R (último swing high fractal + último swing low fractal, direção =
// qual veio depois), nunca uma segunda definição de swing.
//
// Confluência: cada nível de retração é cruzado contra FONTES reais que
// os outros motores já produzem (S1/R1 do motor de S/R, bordas de FVG/OB
// do motor SMC, EQH/EQL, POC/HVN do Volume Profile da Fase 1.3). Score =
// quantas fontes independentes caem na janela do nível. Zero score é um
// resultado honesto e comum — a matriz NUNCA fabrica confluência.
//
// Camada de exibição/análise (como o Comitê da Fase F): NÃO alimenta o
// Core Engine, não gera sinal, não executa nada — LEI 24 intacta.

export const FIB_RETRACEMENT_RATIOS = [0.236, 0.382, 0.5, 0.618, 0.786] as const;

// Tolerância de confluência proporcional à PERNA real sendo retracionada
// (2% do range da perna) — escala com a estrutura efetivamente medida,
// nunca uma distância absoluta de preço inventada. Parâmetro documentado,
// mesma natureza do percentil 90 do orderflow-history.
const CONFLUENCE_TOLERANCE_LEG_FRACTION = 0.02;

export interface ConfluenceSource {
  kind: string; // ex.: 'SR_SUPPORT_1', 'FVG_BULLISH', 'OB_BEARISH', 'EQH', 'VP_POC', 'VP_HVN'
  // Fontes pontuais (S/R, EQH, POC): priceLow === priceHigh.
  // Fontes de ÁREA (FVG/OB): a faixa real [bottom, top] da zona — um nível
  // dentro da zona é confluência verdadeira, não só proximidade da borda.
  priceLow: number;
  priceHigh: number;
}

export interface FibConfluenceLevel {
  ratio: number;
  price: number;
  score: number; // nº de fontes reais na janela — 0 é honesto e comum
  matches: ConfluenceSource[];
}

export interface FibonacciConfluenceMatrix {
  legLow: number;
  legHigh: number;
  legIsUp: boolean;
  toleranceAbs: number; // janela real usada (fração da perna), para a UI exibir
  levels: FibConfluenceLevel[]; // ordem fixa por ratio ascendente
  computedAt: number;
}

/** Níveis de retração reais da perna [legLow, legHigh]:
 *  perna de ALTA retraciona DESCENDO do high; perna de BAIXA retraciona
 *  SUBINDO do low — mesma convenção da extensão 61.8% já em produção. */
export function computeFibRetracements(
  legLow: number,
  legHigh: number,
  legIsUp: boolean,
): Array<{ ratio: number; price: number }> {
  const range = legHigh - legLow;
  return FIB_RETRACEMENT_RATIOS.map((ratio) => ({
    ratio,
    price: legIsUp ? legHigh - range * ratio : legLow + range * ratio,
  }));
}

/** Matriz completa. null (FAIL_CLOSED) para perna inválida — não-finita ou
 *  range zero/negativo: sem perna real confirmada não existe retração a
 *  publicar, nunca um nível chutado. Fontes vazias são válidas: a matriz
 *  sai com score 0 em tudo (ausência real de confluência, não erro). */
export function buildFibonacciConfluence(
  legLow: number,
  legHigh: number,
  legIsUp: boolean,
  sources: ConfluenceSource[],
): FibonacciConfluenceMatrix | null {
  if (!Number.isFinite(legLow) || !Number.isFinite(legHigh) || legHigh <= legLow) return null;
  const toleranceAbs = (legHigh - legLow) * CONFLUENCE_TOLERANCE_LEG_FRACTION;
  const valid = sources.filter(
    (s) => Number.isFinite(s.priceLow) && Number.isFinite(s.priceHigh) && s.priceHigh >= s.priceLow,
  );
  const levels = computeFibRetracements(legLow, legHigh, legIsUp).map(({ ratio, price }) => {
    const matches = valid.filter(
      (s) => price >= s.priceLow - toleranceAbs && price <= s.priceHigh + toleranceAbs,
    );
    return { ratio, price, score: matches.length, matches };
  });
  return { legLow, legHigh, legIsUp, toleranceAbs, levels, computedAt: Date.now() };
}
