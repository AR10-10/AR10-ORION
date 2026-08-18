// directional-consensus.ts — "sincroniza o LONG e o SHORT com todo o
// ecossistema... o operador não pode ter dúvida na entrada, se é long ou
// short" (pedido direto do Operador).
//
// ═══ O DEFEITO REAL, MEDIDO ═══
//
// Auditoria por grep de toda superfície que mostra direção ou percentual
// direcional em App.tsx encontrou QUATRO números diferentes na tela ao mesmo
// tempo, sem nada que declare como eles se relacionam:
//
//   engine.buyPercent / sellPercent   "BID 54%"    → parcela do LIVRO parado
//   council.opinionMass               "L 62 · S 21" → massa do pool de opinião
//   derivatives.longShortRatio        "1.84"        → contas long/short globais
//   engine.direction                  "SHORT"       → a ÚNICA decisão (LEI 24)
//
// Nenhum deles está errado. Cada um mede uma coisa diferente e real. Mas o
// Operador olha "BID 54%" ao lado de um badge "SHORT" e a tela parece se
// contradizer — porque nada na interface diz que um é liquidez parada e o
// outro é viés de tendência. É essa a dúvida na entrada que ele descreve.
//
// ═══ O QUE ESTE MOTOR NÃO FAZ ═══
//
// NÃO funde os quatro num "score único de LONG". Isso seria fabricar: são
// grandezas de naturezas diferentes e uma média delas não mede nada real.
// E NÃO produz probabilidade (Regra de Ouro 2) — nenhum número aqui é
// "chance de acerto".
//
// ═══ O QUE ELE FAZ ═══
//
// Responde a pergunta que o Operador realmente tem: "as leituras do sistema
// concordam com o LONG/SHORT que o Núcleo está emitindo?"
//
// Para isso lê APENAS direções que outros motores JÁ resolveram — zero
// matemática nova, zero segunda fonte (o mesmo contrato de
// conflict-detector.ts, que já faz isso para 2 pares). Normaliza cada uma
// para LONG/SHORT/NEUTRO/ausente, compara contra o Núcleo, e devolve a
// contagem real de alinhamento.
//
// O NÚCLEO NÃO É UM VOTANTE. Ele é a REFERÊNCIA contra a qual todos são
// comparados (LEI 24: é o único emissor). O alinhamento é contexto exibido —
// nunca vira, altera ou bloqueia a decisão.
//
// ═══ A HONESTIDADE DO DENOMINADOR ═══
//
// Fonte sem leitura real (null) fica FORA da conta — nunca é contada como
// "neutra" nem como "concordando". Contar um silêncio como voto é o erro
// clássico que faria "6 de 8 concordam" quando na verdade 3 fontes nem
// falaram. O resultado sempre declara quantas fontes REALMENTE opinaram.
//
// E "alinhamento" não é qualidade: 8 de 8 fontes concordando não significa
// que o trade vai dar certo. Significa que o sistema está coerente consigo
// mesmo. É uma medida de CONSISTÊNCIA INTERNA, e o texto exibido diz isso.

export type DirectionalSide = "LONG" | "SHORT" | "NEUTRO";

/** Uma leitura direcional real já resolvida por outro motor. */
export interface DirectionalSource {
  /** Código curto para a tela (as iniciais que o Operador pediu). */
  code: string;
  /** Nome real da fonte, para o tooltip. */
  name: string;
  /** O que ESTA fonte lê agora. `null` = sem leitura real (fica fora da conta). */
  side: DirectionalSide | null;
  /** O que a fonte mede, em uma frase — para o Operador nunca confundir
   *  "liquidez parada no livro" com "viés de tendência". É a explicação que
   *  faltava na tela e que gerava a dúvida. */
  measures: string;
}

export interface DirectionalSourceVerdict extends DirectionalSource {
  /** true = aponta para o MESMO lado do Núcleo. `null` quando esta fonte não
   *  opinou, ou quando o próprio Núcleo não tem direção. */
  agrees: boolean | null;
}

export interface DirectionalConsensusReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  /** A decisão real do Núcleo — a referência, nunca um voto. */
  core: DirectionalSide | null;
  /** Toda fonte, na ordem de entrada, já com o veredito de alinhamento. */
  sources: DirectionalSourceVerdict[];
  /** Quantas fontes REALMENTE opinaram (o denominador honesto). */
  reporting: number;
  /** Quantas dessas apontam para o mesmo lado do Núcleo. */
  aligned: number;
  /** Quantas apontam para o lado CONTRÁRIO (nunca as neutras). */
  opposed: number;
  /** aligned / reporting em 0..1. `null` sem fonte alguma opinando — nunca
   *  um 0 que se leria como "ninguém concorda". */
  alignmentRatio: number | null;
}

const EMPTY: DirectionalConsensusReading = {
  status: "DADOS_INSUFICIENTES",
  core: null,
  sources: [],
  reporting: 0,
  aligned: 0,
  opposed: 0,
  alignmentRatio: null,
};

/** Normaliza os vocabulários reais que convivem no repositório para um só.
 *  ALTA/ESTRUTURA_ALTA/COMPRADOR/LONG são a mesma direção escrita de 4
 *  jeitos diferentes por motores diferentes — esta é a única tradução, e ela
 *  vive aqui para não existir uma quinta variante espalhada pela UI. */
export function normalizeSide(raw: string | null | undefined): DirectionalSide | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const v = raw.toUpperCase();
  if (v === "LONG" || v === "ALTA" || v === "ESTRUTURA_ALTA" || v === "COMPRADOR" || v === "BULLISH") return "LONG";
  if (v === "SHORT" || v === "BAIXA" || v === "ESTRUTURA_BAIXA" || v === "VENDEDOR" || v === "BEARISH") return "SHORT";
  if (v === "NEUTRO" || v === "NEUTRAL" || v === "ESTRUTURA_LATERAL" || v === "LATERAL") return "NEUTRO";
  // Vocabulário desconhecido (ABSTAIN, WAIT, DADOS_INSUFICIENTES, qualquer
  // string nova) = SEM leitura. Fail-closed: nunca chuta um lado.
  return null;
}

/** Direção a partir de um número com sinal (CVD, desequilíbrio do livro).
 *  `deadZone` é a faixa em torno de zero tratada como NEUTRO — sem ela, um
 *  desequilíbrio de 0.001 viraria um "voto LONG" que não significa nada. */
export function sideFromSigned(value: number | null | undefined, deadZone = 0): DirectionalSide | null {
  if (!Number.isFinite(value)) return null;
  const v = value as number;
  if (Math.abs(v) <= deadZone) return "NEUTRO";
  return v > 0 ? "LONG" : "SHORT";
}

/**
 * Alinhamento real das leituras do ecossistema com a decisão do Núcleo.
 *
 * `core` é a referência. `sources` são as leituras já resolvidas em outros
 * motores — passadas prontas por quem chama, nunca calculadas aqui.
 */
export function computeDirectionalConsensus(
  core: DirectionalSide | null,
  sources: DirectionalSource[],
): DirectionalConsensusReading {
  if (!Array.isArray(sources) || sources.length === 0) return { ...EMPTY, core };

  // NEUTRO conta como "opinou" (é uma leitura real: 'não há direção aqui'),
  // mas nunca como alinhado nem como oposto — é exatamente o que ele diz.
  const verdicts: DirectionalSourceVerdict[] = sources.map((s) => ({
    ...s,
    agrees: s.side === null || core === null || core === "NEUTRO" ? null : s.side === core,
  }));

  const reporting = verdicts.filter((v) => v.side !== null).length;
  const aligned = verdicts.filter((v) => v.side !== null && v.side !== "NEUTRO" && v.side === core).length;
  const opposed = verdicts.filter(
    (v) => v.side !== null && v.side !== "NEUTRO" && core !== null && core !== "NEUTRO" && v.side !== core,
  ).length;

  return {
    status: reporting > 0 ? "OK" : "DADOS_INSUFICIENTES",
    core,
    sources: verdicts,
    reporting,
    aligned,
    opposed,
    alignmentRatio: reporting > 0 ? aligned / reporting : null,
  };
}

/** Frase honesta do consenso — o texto que vai ao tooltip. Nunca fala em
 *  probabilidade nem em qualidade do trade. */
export function describeDirectionalConsensus(r: DirectionalConsensusReading): string {
  if (r.status !== "OK") return "Nenhuma leitura direcional real disponível ainda.";
  if (r.core === null || r.core === "NEUTRO") {
    return (
      `O Núcleo não emite direção agora, então não há referência para alinhar. ` +
      `${r.reporting} leitura(s) real(is) disponível(is) no ecossistema.`
    );
  }
  const contra = r.opposed > 0 ? ` ${r.opposed} aponta(m) para o lado contrário.` : "";
  return (
    `${r.aligned} de ${r.reporting} leituras reais do ecossistema apontam para o mesmo lado do Núcleo (${r.core}).${contra} ` +
    `É consistência interna do sistema, medida agora — nunca probabilidade de acerto do trade. ` +
    `A decisão continua sendo só do Núcleo (LEI 24).`
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LIQUIDEZ ACIMA E ABAIXO — "mostrar no gráfico onde tem liquidez que é
// possível buscar, FVG e essas coisas, em cima e embaixo" (Operador)
// ═══════════════════════════════════════════════════════════════════════
//
// As zonas já são todas calculadas e desenhadas (FVG, Order Block, Void,
// pools de liquidez). O que NÃO existia era a leitura DIRECIONAL delas: o
// Operador via as caixas mas não tinha, em lugar nenhum, "o alvo de liquidez
// mais próximo acima está a X% e abaixo a Y%".
//
// Isto é geometria pura sobre dado real já pronto — zero motor novo.

export interface LiquidityTarget {
  /** Preço real da zona (topo se está abaixo, base se está acima — a borda
   *  que o preço encontra PRIMEIRO ao se mover naquela direção). */
  price: number;
  /** Código curto da família, o mesmo já desenhado no canvas. */
  kind: string;
}

export interface LiquiditySideReading {
  /** Quantas zonas reais existem deste lado do preço. */
  count: number;
  /** A mais próxima — a primeira que o preço encontraria. `null` se não há. */
  nearest: LiquidityTarget | null;
  /** Distância até a mais próxima, em % do preço atual. `null` se não há. */
  distancePercent: number | null;
}

export interface LiquidityMapReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  above: LiquiditySideReading;
  below: LiquiditySideReading;
}

const EMPTY_SIDE: LiquiditySideReading = { count: 0, nearest: null, distancePercent: null };

/**
 * Onde está a liquidez que o preço pode buscar, acima e abaixo.
 *
 * Fail-closed: sem preço real válido, devolve DADOS_INSUFICIENTES — nunca
 * uma distância calculada contra um preço inventado.
 */
export function computeLiquidityMap(
  livePrice: number | null | undefined,
  targets: LiquidityTarget[],
): LiquidityMapReading {
  if (!Number.isFinite(livePrice) || (livePrice as number) <= 0 || !Array.isArray(targets)) {
    return { status: "DADOS_INSUFICIENTES", above: EMPTY_SIDE, below: EMPTY_SIDE };
  }
  const p = livePrice as number;
  const valid = targets.filter((t) => t && Number.isFinite(t.price) && t.price > 0);

  const build = (list: LiquidityTarget[], isAbove: boolean): LiquiditySideReading => {
    if (list.length === 0) return EMPTY_SIDE;
    // A mais próxima do preço atual — a primeira que o preço encontraria
    // andando naquela direção.
    const nearest = list.reduce((best, t) =>
      Math.abs(t.price - p) < Math.abs(best.price - p) ? t : best,
    );
    const distancePercent = (Math.abs(nearest.price - p) / p) * 100;
    // isAbove entra só para deixar explícito no tipo de retorno de quem
    // chama qual lado é qual; a matemática é a mesma dos dois lados.
    void isAbove;
    return { count: list.length, nearest, distancePercent };
  };

  return {
    status: "OK",
    // Empate exato (zona no preço) não pertence a nenhum dos lados: o preço
    // já está DENTRO dela, não tem que "buscá-la". Excluída dos dois, nunca
    // contada duas vezes.
    above: build(valid.filter((t) => t.price > p), true),
    below: build(valid.filter((t) => t.price < p), false),
  };
}

/** Para onde há mais liquidez a buscar. Deliberadamente NÃO é uma previsão
 *  de direção: é a leitura de onde estão os alvos. Devolve null quando os
 *  dois lados empatam em contagem — anunciar um vencedor num empate seria
 *  inventar assimetria onde não há. */
export function liquidityBias(map: LiquidityMapReading): "ACIMA" | "ABAIXO" | null {
  if (map.status !== "OK") return null;
  if (map.above.count === map.below.count) return null;
  return map.above.count > map.below.count ? "ACIMA" : "ABAIXO";
}
