// paper-trading.ts — v16.0 PRO MAX §9.1/§9.4 ("Paper Trading / Simulação"),
// escopo decidido pelo Operador (AskUserQuestion, resposta explícita): SÓ
// painel manual, ZERO automação. Fechamento de posição e "ativação" de
// trailing stop NUNCA acontecem sozinhos — toda função de transição aqui
// só deve ser chamada pela UI em resposta a um clique real do Operador
// (nunca a partir de um useEffect de preço). Isso distingue esta posição
// simulada de signal-track-record.ts, que JÁ resolve automaticamente
// contra o preço — mas aquilo é um scorecard retrospectivo de precisão do
// Core Engine (propósito: "o motor acertou?"), nunca uma posição com P&L
// em dinheiro. Aqui não há resolução automática nenhuma, só leitura viva
// + ação manual (propósito: "e se eu tivesse entrado?").
//
// READ_ONLY / FAIL_CLOSED (CLAUDE.md): nunca toca em exchange real, nunca
// guarda credencial, nunca envia ordem — é aritmética local sobre um
// preço já lido pelo terminal e um tamanho nocional em USDT que o
// Operador digita. Nenhum "score"/"confiança" aparece aqui: P&L é
// medição real de variação de preço, nunca uma probabilidade.
//
// Pure functions of (state, input, now) — zero I/O, zero relógio próprio.
//
// ═══ CONTRATO v2 (Especificação de Transmissão em Tempo Real, pedido do
// Operador): conta simulada, DCA, alavancagem ═══
//
// O documento pedia 4 coisas que não existiam: saldo/curva de capital/
// drawdown, múltiplas entradas (DCA) com preço médio, alavancagem+margem,
// e o ativo da posição. Todas são ARITMÉTICA LOCAL — nenhuma toca exchange,
// credencial ou envio de ordem (a fronteira que o CLAUDE.md fixa continua
// exatamente onde estava; o que o documento chamou de "comando de ordem" é
// um clique que alimenta esta matemática, nunca uma ordem que sai daqui).
//
// O documento também pedia um canal WebSocket entre "motor" e "painel".
// Aqui não existe essa distância: o motor é este módulo, importado pelo
// painel no MESMO tab, e a store Zustand já entrega atualização instantânea
// (é literalmente o "state management rápido" que o documento pede, sem
// nenhum salto de rede). Um WebSocket local seria latência e complexidade
// a mais para o mesmo resultado — não construído, de propósito.
//
// ALAVANCAGEM SÓ ENTRA COM LIQUIDAÇÃO JUNTO. Simular 10x sem liquidar é
// fabricar um mundo onde a posição nunca morre — exatamente o tipo de
// conforto falso que a Regra de Ouro 1 proíbe. Por isso o par
// margem/preço-de-liquidação é calculado sempre que leverage > 1, a perda
// não-realizada é TRAVADA no teto da margem (em margem isolada não se perde
// mais que ela), e `paperLiquidationStatus()` reporta quando o preço já
// cruzou esse nível. É LEITURA derivada: nunca fecha a posição sozinha —
// o escopo "zero automação" decidido pelo Operador continua intacto.
//
// A amostragem da curva de capital (`recordPaperEquity`) é OBSERVAÇÃO, não
// transição: registra quanto a conta valeria agora, nunca abre/fecha nada.
//
// MIGRAÇÃO v1→v2: `rehydratePaperTrading` continua fail-closed por versão,
// então um estado v1 persistido volta VAZIO. Consequência real e assumida:
// uma posição simulada aberta antes desta mudança se perde no primeiro
// reload. Para uma simulação isso é ruído aceitável; fabricar campos v2
// ausentes (alavancagem/entries que aquele estado nunca teve) seria pior.
import type { TradePlan } from "./trade-plan";

export const PAPER_TRADING_CONTRACT_VERSION = 2 as const;

export type PaperCloseReason = "MANUAL" | "TARGET" | "STOP" | "LIQUIDATION";

/** Saldo inicial da conta simulada. CONVENÇÃO DECLARADA (mesmo espírito do
 *  `ASSUMED_WIN_RATE` do risk-engine): um número redondo para a conta ter um
 *  ponto de partida legível, nunca uma medição de nada. */
export const PAPER_INITIAL_BALANCE_USDT = 100_000;

/** Teto de alavancagem aceito. Declarado (é o máximo que a Binance USDT-M
 *  oferece nos pares mais líquidos), nunca lido da corretora — este módulo
 *  não fala com exchange nenhuma. */
export const PAPER_MAX_LEVERAGE = 125;

/** Taxa de margem de manutenção usada no cálculo de liquidação.
 *
 *  APROXIMAÇÃO DECLARADA, e é importante ser honesto sobre o que ela NÃO é:
 *  a Binance usa uma tabela ESCALONADA (a taxa sobe conforme o nocional da
 *  posição), que este módulo não tem como buscar (zero rede, por design).
 *  0,5% é um valor conservador próximo da faixa mais baixa real. Portanto
 *  `paperLiquidationPrice()` é uma ESTIMATIVA do nível, nunca o preço exato
 *  que a corretora usaria — e a UI nunca deve apresentá-lo como tal. */
export const PAPER_MAINTENANCE_MARGIN_RATE = 0.005;

/** Um aporte real na posição (DCA). Cada clique do Operador vira um destes. */
export interface PaperEntry {
  price: number; // preço no instante do aporte
  sizeUsdt: number; // nocional deste aporte, sempre > 0
  at: number;
}

export interface SimulatedPosition {
  /** Ativo em que a posição foi aberta. LACUNA REAL corrigida nesta versão
   *  (achado de auditoria, não pedido no documento): o `TradePlan` não
   *  carrega symbol, então até aqui uma posição aberta em BTC ficava órfã
   *  de contexto se o Operador trocasse de ativo. `null` = estado antigo/
   *  chamador que ainda não informa — honesto, nunca um símbolo chutado. */
  symbol: string | null;
  plan: TradePlan; // snapshot congelado no instante da abertura — nunca reavaliado ao vivo
  direction: "LONG" | "SHORT";
  /** Todos os aportes, em ordem cronológica. O primeiro é a abertura. */
  entries: PaperEntry[];
  entryPrice: number; // preço médio REAL ponderado por unidades (ver weightedAveragePrice)
  sizeUsdt: number; // nocional TOTAL somado de todos os aportes
  leverage: number; // 1 = sem alavancagem (comportamento idêntico ao contrato v1)
  openedAt: number;
  closedAt: number | null;
  closedPrice: number | null;
  closeReason: PaperCloseReason | null;
  realizedPnl: number | null; // só definido depois de fechada
}

/** Um ponto da curva de capital. Mesma forma do payload pedido no documento
 *  (`equity_curve_novo_ponto: [timestamp, equity]`), tipada. */
export interface PaperEquityPoint {
  t: number;
  equity: number;
}

export interface PaperTradingState {
  contractVersion: typeof PAPER_TRADING_CONTRACT_VERSION;
  /** Saldo REALIZADO — só muda quando uma posição fecha. O flutuante da
   *  posição aberta nunca entra aqui (entra na equity, ver paperEquity). */
  balance: number;
  position: SimulatedPosition | null; // no máximo 1 posição aberta por vez (MVP manual)
  history: SimulatedPosition[]; // fechadas, mais recente por último, ring-capped
  equityCurve: PaperEquityPoint[]; // ring-capped
  peakEquity: number; // maior equity já observada — base do drawdown
  maxDrawdownPct: number; // pior queda percentual desde um pico, já observada
}

export const PAPER_TRADING_HISTORY_CAP = 100;
export const PAPER_EQUITY_CURVE_CAP = 500;

/** Cadência de amostragem da curva de capital, em ms. Convenção declarada:
 *  a cada tick encheria o anel de PAPER_EQUITY_CURVE_CAP pontos em ~1
 *  minuto de ticker rápido (e a curva viraria zoom em ruído); 5s dá ~40
 *  minutos de história por anel, que é a janela real de uma operação
 *  simulada acompanhada ao vivo. O consumidor (App.tsx) só amostra com
 *  posição ABERTA — conta parada não gasta o anel com linha reta. */
export const PAPER_EQUITY_SAMPLE_MS = 5_000;

export const EMPTY_PAPER_TRADING_STATE: PaperTradingState = {
  contractVersion: PAPER_TRADING_CONTRACT_VERSION,
  balance: PAPER_INITIAL_BALANCE_USDT,
  position: null,
  history: [],
  equityCurve: [],
  peakEquity: PAPER_INITIAL_BALANCE_USDT,
  maxDrawdownPct: 0,
};

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function pushHistory(history: SimulatedPosition[], entry: SimulatedPosition): SimulatedPosition[] {
  const next = [...history, entry];
  return next.length > PAPER_TRADING_HISTORY_CAP ? next.slice(next.length - PAPER_TRADING_HISTORY_CAP) : next;
}

/** Preço médio REAL de uma lista de aportes em nocional USDT.
 *
 *  A conta que parece óbvia e está ERRADA: média ponderada pelo nocional
 *  (`Σ preço×nocional / Σ nocional`). Com nocional fixo, comprar $1000 a
 *  100 e $1000 a 50 daria 75 — mas o dinheiro comprou 10 + 20 = 30
 *  unidades por $2000, então o preço médio real é 2000/30 = 66,67.
 *  A fórmula certa é `Σ nocional / Σ (nocional/preço)` (total gasto
 *  dividido por total de unidades). Um teste real trava exatamente esse
 *  caso — é o tipo de erro sutil que passa despercebido para sempre. */
export function weightedAveragePrice(entries: PaperEntry[]): number | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  let totalUsdt = 0;
  let totalUnits = 0;
  for (const e of entries) {
    if (!fin(e?.price) || !fin(e?.sizeUsdt) || e.price <= 0 || e.sizeUsdt <= 0) return null;
    totalUsdt += e.sizeUsdt;
    totalUnits += e.sizeUsdt / e.price;
  }
  if (totalUnits <= 0) return null;
  return totalUsdt / totalUnits;
}

/** Alavancagem aceitável: finita, >= 1, <= teto declarado. Fora disso, cai
 *  em 1 (sem alavancagem) — nunca um valor inventado nem um erro silencioso
 *  que viraria margem/liquidação sem sentido. */
function sanitizeLeverage(leverage: number | undefined): number {
  if (!fin(leverage) || (leverage as number) < 1) return 1;
  return Math.min(leverage as number, PAPER_MAX_LEVERAGE);
}

/** Abre uma posição simulada a partir de um Trade Plan real e um tamanho
 *  nocional em USDT digitado pelo Operador. Fail-closed: sem plano, size
 *  inválido (<=0, não finito) ou já existe posição aberta => devolve o
 *  estado ORIGINAL sem mudança — esta função nunca substitui
 *  silenciosamente uma posição em aberto; a UI decide se avisa o
 *  Operador que precisa fechar a atual primeiro.
 *
 *  `symbol` e `leverage` são opcionais de propósito: o contrato antigo
 *  (4 argumentos) continua válido e produz exatamente o comportamento v1
 *  (sem alavancagem, símbolo honestamente null). */
export function openPaperPosition(
  state: PaperTradingState,
  plan: TradePlan | null,
  sizeUsdt: number,
  now: number,
  symbol?: string | null,
  leverage?: number,
): PaperTradingState {
  if (state.position !== null) return state;
  if (!plan || !fin(sizeUsdt) || sizeUsdt <= 0) return state;
  const entryPrice = (plan.entry.low + plan.entry.high) / 2;
  if (!fin(entryPrice) || entryPrice <= 0) return state;
  return {
    ...state,
    position: {
      symbol: typeof symbol === "string" && symbol.length > 0 ? symbol : null,
      plan,
      direction: plan.direction,
      entries: [{ price: entryPrice, sizeUsdt, at: now }],
      entryPrice,
      sizeUsdt,
      leverage: sanitizeLeverage(leverage),
      openedAt: now,
      closedAt: null,
      closedPrice: null,
      closeReason: null,
      realizedPnl: null,
    },
  };
}

/** DCA — acrescenta um aporte à posição ABERTA no preço atual, recalculando
 *  o preço médio real e o nocional total.
 *
 *  Fail-closed: sem posição aberta, preço/tamanho inválidos => estado
 *  ORIGINAL. Não existe "aporte contra a posição" aqui: reduzir/inverter é
 *  outra operação (fechar e reabrir), deliberadamente fora deste MVP manual
 *  para não virar um mini-OMS pela porta dos fundos. */
export function addPaperEntry(
  state: PaperTradingState,
  price: number,
  sizeUsdt: number,
  now: number,
): PaperTradingState {
  const pos = state.position;
  if (!pos) return state;
  if (!fin(price) || price <= 0 || !fin(sizeUsdt) || sizeUsdt <= 0) return state;
  const entries = [...pos.entries, { price, sizeUsdt, at: now }];
  const avg = weightedAveragePrice(entries);
  if (avg === null) return state;
  return {
    ...state,
    position: {
      ...pos,
      entries,
      entryPrice: avg,
      sizeUsdt: pos.sizeUsdt + sizeUsdt,
    },
  };
}

/** Margem realmente comprometida: nocional / alavancagem. Em 1x é o próprio
 *  nocional (nada de "margem" a menos). null sem posição. */
export function paperMarginUsed(position: SimulatedPosition | null): number | null {
  if (!position) return null;
  const lev = sanitizeLeverage(position.leverage);
  return position.sizeUsdt / lev;
}

/** Preço ESTIMADO de liquidação (margem isolada).
 *
 *  Long:  entrada × (1 − 1/alavancagem + taxa de manutenção)
 *  Short: entrada × (1 + 1/alavancagem − taxa de manutenção)
 *
 *  Em 1x o nível fica praticamente no zero (uma posição sem alavancagem não
 *  liquida), que é o comportamento correto. Ver PAPER_MAINTENANCE_MARGIN_RATE
 *  para por que isto é uma ESTIMATIVA e nunca o preço exato da corretora. */
export function paperLiquidationPrice(position: SimulatedPosition | null): number | null {
  if (!position || !fin(position.entryPrice) || position.entryPrice <= 0) return null;
  const lev = sanitizeLeverage(position.leverage);
  const move = 1 / lev - PAPER_MAINTENANCE_MARGIN_RATE;
  const raw = position.direction === "LONG"
    ? position.entryPrice * (1 - move)
    : position.entryPrice * (1 + move);
  return Math.max(0, raw);
}

/** O preço atual já cruzou o nível estimado de liquidação?
 *
 *  LEITURA derivada, nunca uma transição: esta função não fecha nada. A UI
 *  mostra o aviso e o Operador decide — mesmo contrato "zero automação" que
 *  vale para todo o resto do módulo. */
export function paperLiquidationStatus(
  position: SimulatedPosition | null,
  currentPrice: number,
): { liquidationPrice: number | null; breached: boolean } {
  const liquidationPrice = paperLiquidationPrice(position);
  if (!position || liquidationPrice === null || !fin(currentPrice)) {
    return { liquidationPrice, breached: false };
  }
  const breached = position.direction === "LONG"
    ? currentPrice <= liquidationPrice
    : currentPrice >= liquidationPrice;
  return { liquidationPrice, breached };
}

function signedPctMove(position: SimulatedPosition, currentPrice: number): number {
  const pct = (currentPrice - position.entryPrice) / position.entryPrice;
  return position.direction === "LONG" ? pct : -pct;
}

/** Variação percentual assinada do preço desde a entrada — positiva a
 *  favor da posição, negativa contra, independente do tamanho. null sem
 *  posição aberta ou preço não finito (nunca um zero fabricado). */
export function unrealizedPnlPct(position: SimulatedPosition | null, currentPrice: number): number | null {
  if (!position || !fin(currentPrice)) return null;
  return signedPctMove(position, currentPrice) * 100;
}

/** P&L não-realizado em USDT no preço ATUAL (signedPctMove × sizeUsdt),
 *  com a perda TRAVADA no teto da margem.
 *
 *  Por que o teto existe: em margem isolada não se perde mais do que a
 *  margem depositada — a posição é liquidada antes. Sem essa trava, uma
 *  simulação a 10x mostraria −$8.000 de prejuízo sobre $1.000 de margem,
 *  um número que não pode acontecer no mundo real. Em 1x a margem é o
 *  próprio nocional, então a trava só morde num cenário de −100% (preço a
 *  zero) e o comportamento v1 fica idêntico na prática.
 *
 *  null sem posição aberta ou preço não finito. */
export function unrealizedPnl(position: SimulatedPosition | null, currentPrice: number): number | null {
  if (!position || !fin(currentPrice)) return null;
  const raw = signedPctMove(position, currentPrice) * position.sizeUsdt;
  const margin = paperMarginUsed(position);
  if (margin === null) return raw;
  return Math.max(raw, -margin);
}

/** Fecha a posição aberta no preço ATUAL — SEMPRE por ação explícita do
 *  Operador. `reason` documenta só o PORQUÊ do clique (qual botão foi
 *  pressionado), nunca implica automação: mesmo um "TARGET"/"STOP" aqui é
 *  o Operador reconhecendo que o nível foi tocado e escolhendo fechar —
 *  esta função nunca é chamada por conta própria a partir de um tick de
 *  preço. Sem posição aberta, ou preço não finito => estado ORIGINAL. */
export function closePaperPosition(
  state: PaperTradingState,
  currentPrice: number,
  now: number,
  reason: PaperCloseReason,
): PaperTradingState {
  if (!state.position || !fin(currentPrice)) return state;
  const realizedPnl = unrealizedPnl(state.position, currentPrice);
  const closed: SimulatedPosition = {
    ...state.position,
    closedAt: now,
    closedPrice: currentPrice,
    closeReason: reason,
    realizedPnl,
  };
  // O resultado sai do flutuante e entra no saldo REALIZADO — é o único
  // momento em que `balance` muda. Pico/drawdown são reavaliados sobre o
  // saldo novo (com a posição já fechada, equity == balance).
  const balance = state.balance + (realizedPnl ?? 0);
  const peakEquity = Math.max(state.peakEquity, balance);
  const drawdownPct = peakEquity > 0 ? ((peakEquity - balance) / peakEquity) * 100 : 0;
  return {
    ...state,
    balance,
    peakEquity,
    maxDrawdownPct: Math.max(state.maxDrawdownPct, drawdownPct),
    position: null,
    history: pushHistory(state.history, closed),
  };
}

/** Equity = saldo realizado + flutuante da posição aberta (0 sem posição).
 *  É o número que a curva de capital desenha. */
export function paperEquity(state: PaperTradingState, currentPrice: number): number {
  const floating = unrealizedPnl(state.position, currentPrice);
  return state.balance + (floating ?? 0);
}

/** Drawdown atual e máximo, em percentual do pico de equity.
 *
 *  `currentPct` é uma leitura AO VIVO (inclui o flutuante da posição
 *  aberta); `maxPct` é o pior já observado e registrado no estado — só
 *  cresce, nunca "melhora" quando a conta se recupera, que é justamente o
 *  ponto de um drawdown máximo. */
export function paperDrawdown(
  state: PaperTradingState,
  currentPrice: number,
): { currentPct: number; maxPct: number; peakEquity: number } {
  const equity = paperEquity(state, currentPrice);
  const peakEquity = Math.max(state.peakEquity, equity);
  const currentPct = peakEquity > 0 ? Math.max(0, ((peakEquity - equity) / peakEquity) * 100) : 0;
  return { currentPct, maxPct: Math.max(state.maxDrawdownPct, currentPct), peakEquity };
}

/** Registra um ponto da curva de capital no instante `now`.
 *
 *  OBSERVAÇÃO, nunca transição: esta função não abre nem fecha nada — só
 *  anota quanto a conta valeria agora e atualiza pico/drawdown máximo. É a
 *  única função deste módulo que a UI pode chamar a partir de um tick de
 *  preço sem violar o escopo "zero automação" decidido pelo Operador,
 *  justamente porque não decide nada.
 *
 *  Fail-closed: preço não finito => estado ORIGINAL (nunca um ponto com
 *  equity fabricada). */
export function recordPaperEquity(
  state: PaperTradingState,
  currentPrice: number,
  now: number,
): PaperTradingState {
  if (!fin(currentPrice) || !fin(now)) return state;
  const equity = paperEquity(state, currentPrice);
  if (!fin(equity)) return state;
  const peakEquity = Math.max(state.peakEquity, equity);
  const drawdownPct = peakEquity > 0 ? Math.max(0, ((peakEquity - equity) / peakEquity) * 100) : 0;
  const next = [...state.equityCurve, { t: now, equity }];
  return {
    ...state,
    equityCurve: next.length > PAPER_EQUITY_CURVE_CAP ? next.slice(next.length - PAPER_EQUITY_CURVE_CAP) : next,
    peakEquity,
    maxDrawdownPct: Math.max(state.maxDrawdownPct, drawdownPct),
  };
}

export interface PaperPositionContext {
  distanceToStopPct: number | null;
  distanceToTarget1Pct: number | null;
  nearStop: boolean;
  nearTarget: boolean;
}

// Limiar puramente informativo (destaca visualmente "perto do alvo/stop"
// na UI) — nunca aciona fechamento nenhum sozinho.
export const PAPER_NEAR_THRESHOLD_PCT = 0.3;

/** Leitura de contexto só-informativa: distância real do preço atual até
 *  o stop do plano e até o 1º alvo (o mais próximo). Esta posição não tem
 *  ladder de alvos parciais — MVP manual, o Operador decide fechar tudo
 *  de uma vez, quando quiser. Nunca fecha nada por conta própria. */
export function paperPositionContext(position: SimulatedPosition | null, currentPrice: number): PaperPositionContext {
  if (!position || !fin(currentPrice)) {
    return { distanceToStopPct: null, distanceToTarget1Pct: null, nearStop: false, nearTarget: false };
  }
  const stopPrice = position.plan.stop.price;
  const target1 = position.plan.targets[0]?.price;
  const distanceToStopPct = fin(stopPrice) ? (Math.abs(currentPrice - stopPrice) / currentPrice) * 100 : null;
  const distanceToTarget1Pct = fin(target1) ? (Math.abs(currentPrice - (target1 as number)) / currentPrice) * 100 : null;
  return {
    distanceToStopPct,
    distanceToTarget1Pct,
    nearStop: distanceToStopPct !== null && distanceToStopPct <= PAPER_NEAR_THRESHOLD_PCT,
    nearTarget: distanceToTarget1Pct !== null && distanceToTarget1Pct <= PAPER_NEAR_THRESHOLD_PCT,
  };
}

/** Fail-closed rehydration: só aceita um estado estruturalmente válido da
 *  MESMA versão de contrato; qualquer outra coisa devolve o estado vazio
 *  honesto. Ao contrário de rehydrateTrackRecord (signal-track-record.ts),
 *  uma posição ABERTA sobrevive ao reload sem ser forçada a "fechada": não
 *  existe resolução automática aqui, então não há "caminho de preço não
 *  visto" a desconfiar — o painel volta a mostrar P&L ao vivo assim que o
 *  preço real voltar a fluir, e o Operador decide o que fazer. */
export function rehydratePaperTrading(raw: unknown): PaperTradingState {
  const r = raw as PaperTradingState | null | undefined;
  if (
    !r || typeof r !== "object" ||
    r.contractVersion !== PAPER_TRADING_CONTRACT_VERSION ||
    !Array.isArray(r.history) ||
    (r.position !== null && typeof r.position !== "object")
  ) {
    return EMPTY_PAPER_TRADING_STATE;
  }
  // Campos de conta do contrato v2: um estado que passou pela porta da
  // versão mas chegou sem eles (arquivo truncado, escrita interrompida)
  // seria pior que um estado vazio — `balance` ausente viraria NaN em toda
  // a curva de capital. Fail-closed pelo mesmo princípio da guarda acima.
  if (
    !fin(r.balance) || !fin(r.peakEquity) || !fin(r.maxDrawdownPct) ||
    !Array.isArray(r.equityCurve)
  ) {
    return EMPTY_PAPER_TRADING_STATE;
  }
  return r;
}
