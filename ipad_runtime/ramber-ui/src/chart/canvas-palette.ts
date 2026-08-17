// canvas-palette.ts — paleta canônica única do canvas.
//
// ============================================================================
// Achado 3.1 (Auditoria Visual Sistemática, pedido direto do Operador:
// "julgamento da parte gráfica do sistema todinho... pra não ficar poluído
// demais... pesquisa nos terminais mais profissionais do mundo").
// ============================================================================
//
// MEDIÇÃO REAL (não impressão): grep de todo `rgba(r, g, b` em `chart/*`
// encontrou 30 tripletos RGB distintos. Convertidos para HSL e ordenados por
// matiz, o padrão real apareceu — não são 30 cores, são ~7 famílias
// semânticas espalhadas em 2 a 8 tons quase idênticos cada:
//
//   matiz 33-50   → 8 tons de âmbar/amarelo em um intervalo de 17°
//   matiz 160-170 → 3 tons de verde/teal
//   matiz 184-193 → 3 tons de ciano
//   matiz 253-278 → 3 tons de lavanda/roxo
//   matiz 312-326 → 2 tons de magenta
//   matiz 340-355 → 3 tons de vermelho/rosa
//   matiz 207-217 → 2 azuis saturados (+ 3 slates dessaturados)
//
// PESQUISA REAL (autorizada explicitamente pelo Operador): o limite prático de
// uma paleta categórica é 6-8 cores — acima de ~6, matizes bem escolhidos já
// ficam difíceis de distinguir em elementos pequenos, que é exatamente o caso
// de uma linha de 1px num gráfico. Bloomberg Terminal opera com 5 cores;
// a paleta padrão do TradingView, com 7 (+ preto/branco). Nós tínhamos 30 —
// e a discriminação de matiz humana em alta saturação precisa de ~15-25° para
// ler "outra cor", então os 8 âmbares num intervalo de 17° são,
// perceptualmente, UMA cor fingindo ser oito. O princípio de fundo é o
// data-ink ratio de Tufte (a base usada por FT/Economist/Bloomberg): tinta que
// não carrega informação nova é ruído.
//
// CORREÇÃO DE UMA CONCLUSÃO ANTERIOR DESTE REPO: a versão anterior deste
// arquivo argumentava que a maior parte dos 25+ tons era "engenharia de matiz
// deliberada", citando que o magenta do POC ficava "a ~30° tanto da família
// roxa quanto do vermelho SHORT". Esse argumento está CERTO para os intervalos
// ENTRE famílias — e por isso ele foi preservado aqui. Mas ele nunca foi
// medido, e a medição mostra duas coisas que ele errou:
//   1. Não havia argumento nenhum para os agrupamentos DENTRO de cada família
//      (8 âmbares, 3 vermelhos) — esse é drift puro, sem nenhum comentário no
//      código defendendo qualquer um deles.
//   2. O magenta que o código de fato usava no POC (255,60,172, matiz 326) está
//      a 14° do vermelho SHORT (matiz 340), não a 30°. A intenção declarada
//      estava certa; o valor implementado não a cumpria. O tom escolhido abaixo
//      (236,81,205, matiz 312) é o outro magenta que já existia no código e
//      cumpre a intenção original de verdade: 28° do vermelho.
//
// REGRA DE DECISÃO aplicada (mecânica, não gosto): dois tons saturados a menos
// de ~15° de matiz são perceptualmente o mesmo — colapsam num token só.
// Intervalos acima de ~24° são distinção real e foram preservados. Nenhum tom
// NOVO foi inventado: cada token abaixo é o tom que JÁ era o mais usado (ou o
// que melhor cumpria a intenção já documentada) da sua própria família.
//
// O que NÃO colapsa: luminosidade e alpha seguem livres dentro de cada família
// (um rótulo claro e um preenchimento escuro do mesmo âmbar continuam sendo o
// mesmo token, só com L/alpha diferentes) — é assim que a hierarquia visual
// deste projeto sempre funcionou (opacidade = força real, ver
// nexus/visual-budget.ts) e a paleta reforça isso em vez de competir.
//
// A GARANTIA (a parte que importa mais que a limpeza em si): o Achado 2.6
// ensinou, do jeito difícil, que correção sem trava volta — a altura da Kill
// Zone foi reclamada duas vezes porque a primeira correção não deixou nenhum
// teste impedindo a regressão. Então `tests/canvas-palette.test.ts` MEDE os
// matizes de todo `chart/*` a cada rodada e falha se qualquer cor saturada não
// for uma das famílias abaixo, ou se duas famílias chegarem a menos de 24° uma
// da outra. Drift novo não passa mais por revisão manual.
// ============================================================================

/** Uma família semântica real do canvas. O matiz é a identidade; luminosidade
 *  e alpha continuam livres para hierarquia dentro da família. */
export type ChartPaletteFamily =
  | "attention"
  | "bullish"
  | "measurement"
  | "projection"
  | "institutional"
  | "bearish";

/** Os tripletos canônicos, um por família, em ordem de matiz. Todo `rgba()` de
 *  `chart/*` que carregue SIGNIFICADO usa um destes (ou uma variação de
 *  luminosidade do MESMO matiz) — nunca um tom redigitado de memória, que é a
 *  causa raiz medida do drift. */
export const CHART_PALETTE: Record<ChartPaletteFamily, string> = {
  // matiz 38 — âmbar: nível a OBSERVAR e contexto de tempo (S1/R1, Kill Zone,
  // sessões-chave, sweep, entrada do plano). Absorve os 8 tons que estavam
  // espalhados entre 33° e 50°.
  attention: "245, 158, 11",
  // matiz 170 — verde TradingView (#089981). Alta, LONG, bid, alvo. Escolha
  // explícita do Operador nesta rodada: o par neon #00ffaa/#ff0055 (21 usos
  // cada) ficava a 10-15° deste par e os dois não podiam coexistir. Venceu o
  // par do terminal mais usado do mundo — menos fluorescente para sessão
  // longa, e a mesma direção que o Operador já tinha aprovado só para o Trade
  // Plan (task #325) e na saída do estilo neon/CRT (tasks #242-246).
  bullish: "8, 153, 129",
  // matiz 217 — azul: MEDIÇÃO e referência sem viés direcional. Uma família
  // só para tudo que mede onde o preço esteve sem opinar para onde vai:
  // Fibonacci, Volume Profile, VWAP, Equilibrium/Premium-Discount, TPO,
  // ZigZag, aura neutra. Absorve o ciano (184-193°), que ficaria a apenas 14°
  // do verde TradingView e seria indistinguível dele numa linha de 1px.
  measurement: "138, 180, 248",
  // matiz 255 — lavanda: o que ainda NÃO aconteceu (projeção de cenário,
  // padrão harmônico à espera de completar). Absorve o roxo 278°, que estava a
  // 23° daqui e significava a mesma coisa: uma forma que o sistema acha que
  // pode se completar.
  projection: "167, 139, 250",
  // matiz 312 — magenta: zona/perfil INSTITUCIONAL (POC, zonas consolidadas).
  // Ver a correção #2 no cabeçalho: este é o tom que cumpre a separação de 28°
  // do vermelho que o próprio código já dizia querer, e que o tom que estava
  // implementado (326°, a 14°) não cumpria.
  institutional: "236, 81, 205",
  // matiz 355 — vermelho TradingView (#f23645). Baixa, SHORT, ask, stop,
  // invalidação. Mesma decisão do Operador que definiu o verde acima.
  bearish: "242, 54, 69",
};

/** Cromo — fundo, grade, texto, borda de painel. NÃO entra na regra de
 *  separação de matiz: não carrega significado de mercado, e a trava do teste
 *  o reconhece pelo valor declarado aqui, nunca por heurística. */
export const CHART_CHROME = {
  neutral: "148, 163, 184", // slate: contexto de fundo (faixa de sessões, divisores)
  neutralSoft: "203, 213, 225", // mesmo slate, mais claro (texto secundário)
  neutralBright: "226, 232, 240", // mesmo slate, texto de destaque
  ink: "255, 255, 255", // contraste máximo
  grid: "42, 46, 57", // grade do gráfico
  surface: "5, 8, 16", // fundo de etiqueta/painel
} as const;

/** Separação mínima de matiz (graus) exigida entre duas famílias. Abaixo disto
 *  o Operador não consegue distinguir as duas numa linha de 1px — é o número
 *  que a regra de decisão do cabeçalho aplica, e o teste o verifica. */
export const CHART_PALETTE_MIN_HUE_SEPARATION_DEG = 24;

/** Saturação a partir da qual uma cor conta como "carrega significado" e
 *  portanto tem de ser uma das 6 famílias. Abaixo disto é cromo. */
export const CHART_PALETTE_CHROME_MAX_SATURATION = 40;

/** rgba() real de uma família, com o alpha do chamador. É por aqui que todo
 *  plugin pega cor — assinatura única, zero hex redigitado. */
export function chartPaletteRgba(family: ChartPaletteFamily, alpha: number): string {
  return `rgba(${CHART_PALETTE[family]}, ${alpha})`;
}

/** Matiz/saturação/luminosidade reais de um tripleto "r, g, b" — usado pelo
 *  teste de trava e disponível para qualquer plugin que precise derivar um tom
 *  mais claro/escuro da MESMA família em vez de inventar um vizinho. */
export function chartRgbToHsl(triplet: string): { h: number; s: number; l: number } {
  const [r, g, b] = triplet.split(",").map((v) => Number(v.trim()) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Distância angular real entre 2 matizes (0..180) — matiz é circular, então
 *  350° e 10° estão a 20°, nunca a 340°. */
export function chartHueDistance(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

// ---------------------------------------------------------------------------
// Compatibilidade: o par bullish/bearish já era importado por plugins com
// estes nomes. Mantidos como apelidos finos sobre a paleta acima (mesma cor
// real de sempre, zero mudança de valor) em vez de um segundo par de
// constantes que poderia divergir.
// ---------------------------------------------------------------------------
export const CHART_BULLISH_HEX = "#089981";
export const CHART_BEARISH_HEX = "#f23645";

export function chartBullishRgba(alpha: number): string {
  return chartPaletteRgba("bullish", alpha);
}

export function chartBearishRgba(alpha: number): string {
  return chartPaletteRgba("bearish", alpha);
}
