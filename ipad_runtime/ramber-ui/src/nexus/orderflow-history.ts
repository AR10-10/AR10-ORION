// orderflow-history.ts — V-MAX Fase 1.2: histórico real do Order Flow
// (CVD ao longo do tempo + trades grandes reais) para o
// OrderFlowHeatmapPlugin desenhar a "bolha" e a linha de CVD do Blueprint
// (§3.1) — nenhum dos dois existia como SÉRIE até aqui: App.tsx só
// guardava o CVD como um escalar (o valor atual), e os ticks individuais
// do poller real do MEXC nunca saíam de dentro do worker (engine-bridge.ts
// já foi estendido para expor onTrades com os MESMOS ticks reais que o
// worker já recebe, zero sonda de rede nova).
//
// "Trade grande" (bolha) nunca é um limiar fixo — seria um número
// inventado que a Regra de Ouro 1 proíbe. É calculado como um percentil
// real da distribuição de volumes efetivamente observada nos últimos
// trades reais (amostra deslizante). Sem amostra suficiente ainda,
// honestamente nenhum trade é marcado como grande — nunca um palpite
// antes de dado real suficiente.
import { realPercentile } from "./percentile";

export interface OrderflowTrade {
  time: number; // ms real (Tick.timestamp)
  price: number;
  volume: number;
  side: "BUY" | "SELL";
}

export interface OrderflowHistoryEntry {
  time: number; // ms real
  cvd: number;
  largeTrades: OrderflowTrade[];
}

// ~1 HORA real de histórico na cadência real do poller MEXC (4s/ciclo,
// mesma cadência já em produção — engine-bridge.ts's startMexcOrderflowFeed).
//
// ERA 120 (~8 min), e essa retenção curta era a limitação mais citada do
// sistema: é ela que empurra CVD/heatmaps para "unfit" acima de 1h
// (timeframe-layer-profile.ts) e que mantém delta-divergence-engine.js em
// quarentena.
//
// EU MESMO REGISTREI, EM RODADAS ANTERIORES, QUE O BLOQUEIO ERA O CUSTO
// O(n) POR PUSH — "trocar o ring por uma estrutura O(1) ANTES de subir a
// capacidade". A MEDIÇÃO DESMENTIU ISSO, e fica registrado porque a
// afirmação errada circulou em commit e PR:
//
//   capacidade | ms por push (média de 500) | memória aprox. do ring
//        120   |          0,0031 ms         |    ~24 kB
//        900   |          0,0085 ms         |   ~183 kB
//       2700   |          0,0067 ms         |   ~548 kB
//       5400   |          0,0179 ms         |  ~1097 kB
//
// A 4 segundos por ciclo, 0,0085 ms é 0,0002% do orçamento do ciclo. A cópia
// por push nunca foi o problema — e, num store Immer, criar um array novo é
// o padrão CORRETO, não um descuido (um ring mutável quebraria a igualdade
// referencial de que os seletores dependem para recomputar).
//
// O bloqueio REAL era outro, e estava invisível: `computeOrderflowTrend`
// dividia o histórico INTEIRO ao meio, então subir a retenção mudaria em
// silêncio o significado de uma leitura já exibida. Resolvido primeiro
// (ORDERFLOW_TREND_WINDOW abaixo); só então esta capacidade pôde subir.
//
// POR QUE 900 E NÃO MAIS: 1 hora é exatamente a faixa em que o perfil de
// camadas já considera o fluxo core-ou-contexto, custa ~183 kB, e não
// promete um passado que a sessão raramente terá. O limite honesto aqui não
// é CPU nem memória — é que o ring começa VAZIO a cada sessão e enche a
// 4s/ciclo: ter 1 hora de CVD exige a aba aberta por 1 hora. Nenhuma
// mudança de código encurta isso.
export const ORDERFLOW_HISTORY_CAPACITY = 900;

const LARGE_TRADE_PERCENTILE = 0.9; // top 10% por tamanho DENTRO da amostra real recente.
const VOLUME_SAMPLE_WINDOW = 200; // últimos N volumes reais usados para calcular o percentil.
const MIN_SAMPLE_FOR_THRESHOLD = 20; // amostra curta demais → nenhum trade marcado, nunca um chute.

export interface OrderflowThresholdState {
  recentVolumes: number[];
}

export const EMPTY_THRESHOLD_STATE: OrderflowThresholdState = { recentVolumes: [] };

/** Percentil real (não interpolado — o valor real mais próximo da amostra,
 *  nunca um número sintetizado entre dois pontos reais) da amostra de
 *  volumes observados. null com amostra curta demais. Fórmula compartilhada
 *  com volume-profile.ts via percentile.ts (achado real de auditoria, FASE
 *  Ω Priority 3 — as duas reimplementavam a mesma conta separadamente). */
export function computeLargeTradeThreshold(recentVolumes: number[]): number | null {
  if (recentVolumes.length < MIN_SAMPLE_FOR_THRESHOLD) return null;
  const sorted = [...recentVolumes].sort((a, b) => a - b);
  return realPercentile(sorted, LARGE_TRADE_PERCENTILE);
}

/** Função pura: dado o estado real anterior da amostra + um lote real novo
 *  de trades (mesmo ciclo de poll), devolve quais deste lote são "grandes"
 *  pelo limiar calculado ANTES deste lote (um trade nunca influencia o
 *  próprio julgamento de significância) e o próximo estado da amostra. */
export function ingestTradesForLargeDetection(
  state: OrderflowThresholdState,
  trades: OrderflowTrade[],
): { large: OrderflowTrade[]; nextState: OrderflowThresholdState } {
  const threshold = computeLargeTradeThreshold(state.recentVolumes);
  const large = threshold === null ? [] : trades.filter((t) => t.volume >= threshold);
  const merged = [...state.recentVolumes, ...trades.map((t) => t.volume)];
  const recentVolumes = merged.length > VOLUME_SAMPLE_WINDOW ? merged.slice(merged.length - VOLUME_SAMPLE_WINDOW) : merged;
  return { large, nextState: { recentVolumes } };
}

/** Ring real do histórico (CVD + trades grandes por ciclo de poll) — mesmo
 *  padrão de teto de l2-history.ts, nunca acumula sem limite. */
export function pushOrderflowHistory(
  ring: OrderflowHistoryEntry[],
  entry: OrderflowHistoryEntry,
  capacity: number = ORDERFLOW_HISTORY_CAPACITY,
): OrderflowHistoryEntry[] {
  const next = ring.length === 0 ? [entry] : [...ring, entry];
  return next.length > capacity ? next.slice(next.length - capacity) : next;
}

// Diretriz Complementar §18 ("tendência de força do fluxo"): não existia,
// em todo o codebase, nenhuma redução real da série de CVD já retida
// (acima) numa TENDÊNCIA — só leituras instantâneas/percentis (achado real
// de auditoria). Isto NÃO é uma segunda medida de CVD: consome a mesma
// série já real que o heatmap consome, e não fabrica nenhum ponto novo.
export type OrderflowTrend = "FORTALECENDO" | "ENFRAQUECENDO" | "ESTAVEL";

export interface OrderflowTrendReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  reason: string | null;
  trend: OrderflowTrend | null;
  // CVD líquido por ciclo de poll em cada metade real da janela — a base
  // verificável exposta para a UI, nunca recalculada por ela.
  recentSlope: number | null;
  priorSlope: number | null;
  computedAt: number;
}

// Precisa de janela real dos dois lados (nunca uma tendência de 2 pontos) —
// parâmetro documentado, não uma medição.
const MIN_ENTRIES_FOR_TREND = 10;

/** Janela da leitura de TENDÊNCIA do fluxo, em ciclos de poll (~4s cada) —
 *  120 ≈ 8 minutos.
 *
 *  POR QUE ISTO EXISTE AGORA, e é um defeito real corrigido, não um
 *  parâmetro novo por gosto: `computeOrderflowTrend` dividia o histórico
 *  INTEIRO ao meio. Enquanto retenção e janela de leitura eram o mesmo
 *  número (capacidade 120), isso passava despercebido — mas são duas
 *  perguntas diferentes, e ficaram acopladas por acidente:
 *
 *    · RETENÇÃO  = quanto passado o sistema guarda (assunto do horizonte
 *                  das camadas, e agora de motores que precisam cobrir
 *                  várias velas);
 *    · JANELA DE TENDÊNCIA = sobre quanto tempo a frase "fluxo
 *                  FORTALECENDO/ENFRAQUECENDO" fala.
 *
 *  Duas consequências reais do acoplamento:
 *  1. Subir a retenção mudaria em SILÊNCIO o significado de uma leitura já
 *     exibida ao Operador — com capacidade 900 a mesma frase passaria a
 *     comparar os últimos 30 min contra os 30 min anteriores, sem nada na
 *     tela mudando de nome.
 *  2. Mesmo hoje, com capacidade fixa, a leitura já muda de significado
 *     ENQUANTO o ring enche: aos 10 ciclos ela fala de 40 segundos; aos 120,
 *     de 8 minutos. Mesma frase, escalas diferentes.
 *
 *  Fixando a janela, a leitura passa a significar sempre a mesma coisa, e a
 *  retenção fica livre para crescer pelo motivo dela. */
export const ORDERFLOW_TREND_WINDOW = 120;
// Zona-morta real (Regra de Ouro 1): a diferença entre as inclinações das
// duas metades precisa superar o movimento TÍPICO POR CICLO observado nesta
// própria janela — nunca um limiar de CVD absoluto inventado (o CVD não tem
// escala universal entre símbolos/timeframes). Mesma natureza relativa dos
// limiares 70/30 do RSI.
//
// DEFEITO REAL CORRIGIDO — ERRO DE DIMENSÃO, medido, não suposto:
// a versão anterior era `deadband = amplitudeTotal * 0.05`, comparada contra
// `delta = recentSlope - priorSlope`. Amplitude é um NÍVEL (CVD); delta é uma
// TAXA (CVD por ciclo). Como a amplitude cresce com o número de amostras e a
// taxa não, o limiar subia junto com a janela. Medição do resultado:
//
//   janela | menor aceleração que sai de ESTAVEL (metade anterior parada)
//      20  | 1
//      40  | NENHUMA — sempre ESTAVEL, por maior que seja
//      60  | NENHUMA
//     120  | NENHUMA
//
// Ou seja: acima de ~40 amostras a leitura era MATEMATICAMENTE INCAPAZ de
// sair de ESTAVEL. Como o ring de produção enche 120 amostras em ~2,5 min,
// a tendência de fluxo era ESTAVEL permanentemente desde sempre — e, pior,
// silenciosamente: `orderflowTrendActive` (App.tsx) é
// `trend !== "ESTAVEL"`, e layer-relevance.ts usa isso para decidir a
// relevância da camada CVD. A camada CVD, portanto, NUNCA aparecia em modo
// automático. Os testes não pegaram porque todos usavam séries de 20
// amostras — o único tamanho onde a fórmula ainda funcionava.
//
// A correção divide a amplitude pelo tamanho real da janela, devolvendo a
// comparação para a mesma unidade dos dois lados. O MÚLTIPLO foi escolhido
// para preservar exatamente o comportamento calibrado e testado em n=20
// (lá o limiar antigo era 0,05 × amplitude = 1,0 × amplitude/20), nunca um
// número novo por gosto: a diferença entre as duas inclinações precisa
// superar o movimento médio por ciclo da janela.
//
// O QUE NÃO FOI "CORRIGIDO", E POR QUÊ (honestidade sobre o limite):
// medindo a fórmula contra um passeio aleatório PURO (CVD sem tendência
// real), ela rotula ~47% dos ciclos como FORTALECENDO/ENFRAQUECENDO em
// n=120 — e ~54% em n=20, que é exatamente o comportamento que a fórmula
// original já tinha no único tamanho em que funcionava. Ou seja: a
// sensibilidade a ruído NÃO piorou com esta correção, ela só passou a
// existir em todos os tamanhos em vez de só num.
//
// Deixar o múltiplo mais estrito deixaria a leitura mais "limpa", mas seria
// escolher um número sem nenhum dado que o sustente — não há backtest nem
// série real arquivada aqui para calibrar contra acerto de mercado, e a
// Regra de Ouro 1 proíbe exatamente esse tipo de invenção. Fica registrado
// como característica medida e conhecida, para o Operador decidir, em vez de
// disfarçado numa constante escolhida a olho. (Ressalva real: CVD não é um
// passeio aleatório — é volume assinado acumulado, que tem autocorrelação —
// então 47% é um limite superior de falso positivo, não a taxa esperada em
// mercado.)
const TREND_DEADBAND_MULTIPLE = 1;

function insufficientTrend(reason: string, computedAt: number): OrderflowTrendReading {
  return { status: "DADOS_INSUFICIENTES", reason, trend: null, recentSlope: null, priorSlope: null, computedAt };
}

/** Tendência real de força do fluxo: compara a inclinação líquida do CVD
 *  (Δcvd médio por ciclo de poll) entre a metade mais RECENTE e a metade
 *  ANTERIOR da janela retida. FORTALECENDO = a pressão compradora líquida
 *  está acelerando (ou a vendedora está perdendo força); ENFRAQUECENDO = o
 *  oposto; ESTAVEL = a diferença não supera a zona-morta real. Nunca uma
 *  "probabilidade" (Regra de Ouro 2) — é uma leitura de inclinação real de
 *  uma série já real. */
export function computeOrderflowTrend(
  history: OrderflowHistoryEntry[],
  now: number = Date.now(),
  window: number = ORDERFLOW_TREND_WINDOW,
): OrderflowTrendReading {
  if (!Array.isArray(history) || history.length < MIN_ENTRIES_FOR_TREND) {
    return insufficientTrend("historico_real_insuficiente_para_tendencia", now);
  }
  // A leitura fala sempre da MESMA janela de tempo, independente de quanto
  // passado o ring esteja guardando. Com o ring ainda curto, usa o que há —
  // e o piso de MIN_ENTRIES_FOR_TREND acima continua sendo quem barra uma
  // afirmação sobre amostra pequena demais.
  const janela = Number.isFinite(window) && window >= MIN_ENTRIES_FOR_TREND ? Math.floor(window) : ORDERFLOW_TREND_WINDOW;
  const recorte = history.length > janela ? history.slice(history.length - janela) : history;

  const mid = Math.floor(recorte.length / 2);
  const priorSlope = (recorte[mid - 1].cvd - recorte[0].cvd) / mid;
  const recentSlope = (recorte[recorte.length - 1].cvd - recorte[mid].cvd) / (recorte.length - 1 - mid);
  const delta = recentSlope - priorSlope;

  const cvdValues = recorte.map((h) => h.cvd);
  const totalRange = Math.max(...cvdValues) - Math.min(...cvdValues);
  // Amplitude POR CICLO — a mesma unidade de `delta` (CVD/ciclo). Dividir
  // pelo tamanho real da janela é o que impede o limiar de crescer junto
  // com ela (ver o cabeçalho de TREND_DEADBAND_MULTIPLE).
  const movimentoTipicoPorCiclo = totalRange / recorte.length;
  const deadband = movimentoTipicoPorCiclo * TREND_DEADBAND_MULTIPLE;

  const trend: OrderflowTrend = Math.abs(delta) <= deadband ? "ESTAVEL" : delta > 0 ? "FORTALECENDO" : "ENFRAQUECENDO";
  return { status: "OK", reason: null, trend, recentSlope, priorSlope, computedAt: now };
}
