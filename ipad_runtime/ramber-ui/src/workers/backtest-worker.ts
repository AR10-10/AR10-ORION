// backtest-worker.ts — a taxa de acerto REAL, medida dentro do próprio app.
//
// PEDIDO DO OPERADOR: rodar o backtest na versão da nuvem, no iPad, sem
// depender de um computador com terminal.
//
// POR QUE ISTO PODE EXISTIR AGORA, e não existia antes: os dois motores já
// estavam prontos e testados — `history-capture.js` (paginação real com
// proveniência) e `structural-backtest.js` (walk-forward zero-lookahead).
// O cabeçalho do primeiro dizia, com todas as letras, que faltava só a
// decisão de superfície: "este módulo não tem, ainda, nenhum gatilho de UI
// — é a peça de código pronta para quando essa decisão for tomada
// explicitamente". O Operador tomou essa decisão. Este arquivo é o gatilho.
//
// ═══ REGRA DE OURO 6: MAIN THREAD SAGRADA ═══
//
// O walk-forward roda um frame de replay por candle, e em cada frame
// executa DOIS motores graduados (estrutura + S/R) sobre a janela inteira.
// Com 5000 candles isso é milhares de análises — segundos de CPU. No main
// thread, o gráfico congelaria e os 60 FPS do iPad iriam junto. Por isso
// este worker existe: é a segunda camada deste projeto com trabalho pesado
// próprio (a primeira foi conviction-cyclone-worker.ts), pelo mesmo motivo.
//
// ═══ LEI 24: DISPLAY ONLY ═══
//
// Nada aqui emite LONG/SHORT/WAIT, nada altera o Core Engine, nada realimenta
// decisão. O resultado é CONTAGEM de desfechos históricos exibida ao
// Operador. Um backtest que virasse entrada de decisão seria um segundo
// emissor — proibido.
//
// ═══ REGRA DE OURO 2: NUNCA "PROBABILIDADE" ═══
//
// `taxaAlvoAmostra` é a fração REAL da amostra resolvida que tocou o alvo
// antes do stop. É aritmética sobre eventos contados, do passado — nunca
// uma probabilidade calibrada do próximo trade. O motor já carrega o aviso
// em `aviso`, e ele é repassado intacto: nenhuma camada aqui o remove.

import { captureHistoricalCandles } from "../../../src/research/backtest/history-capture.js";
import { runStructuralBacktest } from "../../../src/research/backtest/structural-backtest.js";

export interface BacktestWorkerRequest {
  type: "run";
  symbol: string;
  timeframe: string;
  targetCandleCount: number;
}

export type BacktestWorkerResponse =
  | { type: "progress"; fase: "capturando" | "medindo"; detalhe: string }
  | { type: "done"; resultado: unknown }
  | { type: "error"; motivo: string; detalhe?: string };

/** Teto de amostra. Convenção declarada, nunca medição: acima disso a
 *  captura pagina demais e o Operador espera sem ganho de significância
 *  proporcional. Ele pode pedir menos; mais do que isto é recusado com a
 *  razão dita, nunca truncado em silêncio. */
export const BACKTEST_MAX_CANDLES = 5000;
/** Piso de amostra. Abaixo disso a janela de análise (120 do replay) come a
 *  série quase inteira e sobram poucos trials — um número saído daí seria
 *  ruído apresentado como medida. */
export const BACKTEST_MIN_CANDLES = 500;

/**
 * Valida o pedido ANTES de gastar rede. Pura e exportada para ser testável
 * de verdade — a validação é a parte que mais erra em silêncio.
 */
export function validarPedido(req: Partial<BacktestWorkerRequest>): { ok: true } | { ok: false; motivo: string } {
  if (typeof req.symbol !== "string" || !/^[A-Z0-9]{5,20}$/.test(req.symbol)) {
    return { ok: false, motivo: "simbolo_invalido" };
  }
  if (typeof req.timeframe !== "string" || req.timeframe.length === 0) {
    return { ok: false, motivo: "timeframe_invalido" };
  }
  const n = req.targetCandleCount;
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, motivo: "quantidade_invalida" };
  }
  if (n < BACKTEST_MIN_CANDLES) return { ok: false, motivo: `amostra_minima_${BACKTEST_MIN_CANDLES}` };
  if (n > BACKTEST_MAX_CANDLES) return { ok: false, motivo: `amostra_maxima_${BACKTEST_MAX_CANDLES}` };
  return { ok: true };
}

/**
 * A MESMA trava de proveniência do executor de linha de comando
 * (tools/run-backtest.mjs), reimplementada aqui pelo motivo oposto do
 * habitual: este worker NUNCA lê arquivo, então não há payload externo para
 * inspecionar — o que ele precisa provar é que a captura que ele mesmo fez
 * veio de rede real e completou.
 *
 * Fail-closed: sem candles suficientes, ou com a captura interrompida, não
 * existe número. Devolver "0% de acerto" ou uma amostra parcial silenciosa
 * seria pior do que não devolver nada.
 */
export function capturaUtilizavel(captura: {
  candles?: unknown[];
  stopReason?: string;
}): { ok: true } | { ok: false; motivo: string } {
  const n = Array.isArray(captura?.candles) ? captura.candles.length : 0;
  if (n === 0) return { ok: false, motivo: captura?.stopReason ?? "captura_vazia" };
  if (n < BACKTEST_MIN_CANDLES) return { ok: false, motivo: `amostra_real_insuficiente_${n}` };
  return { ok: true };
}

/**
 * O handler, extraído da amarração com `self` — e essa extração é uma lição
 * aplicada imediatamente: o commit anterior a este corrigiu exatamente o
 * mesmo defeito em `js/real-data/probe.js` (`self` de topo de módulo
 * quebrando execução em Node). Registrar `self.onmessage` na CARGA do módulo
 * torna o arquivo inimportável fora de um Worker — inclusive pela suíte, que
 * é justamente quem precisa exercitar a validação e o fail-closed.
 *
 * Com o handler separado, o comportamento inteiro é testável por execução
 * real, com um `responder` injetado — nenhuma parte fica coberta só por
 * regex no fonte.
 */
export async function executarPedido(
  req: BacktestWorkerRequest,
  responder: (msg: BacktestWorkerResponse) => void,
  deps: {
    capturar?: typeof captureHistoricalCandles;
    medir?: typeof runStructuralBacktest;
  } = {},
): Promise<void> {
  const capturar = deps.capturar ?? captureHistoricalCandles;
  const medir = deps.medir ?? runStructuralBacktest;

  if (!req || req.type !== "run") return;

  const valido = validarPedido(req);
  if (valido.ok === false) {
    responder({ type: "error", motivo: valido.motivo });
    return;
  }

  try {
    responder({
      type: "progress",
      fase: "capturando",
      detalhe: `${req.symbol} ${req.timeframe} — buscando ${req.targetCandleCount} candles reais`,
    });

    const captura = await capturar({
      symbol: req.symbol,
      timeframe: req.timeframe,
      targetCandleCount: req.targetCandleCount,
    });

    const util = capturaUtilizavel(captura);
    if (util.ok === false) {
      responder({ type: "error", motivo: "captura_incompleta", detalhe: util.motivo });
      return;
    }

    responder({
      type: "progress",
      fase: "medindo",
      detalhe: `${captura.candles.length} candles reais capturados — medindo desfechos`,
    });

    const resultado = await medir({
      candles: captura.candles,
      symbol: req.symbol,
      timeframe: req.timeframe,
    });

    responder({ type: "done", resultado });
  } catch (err) {
    // Nunca engole a causa: um backtest que falha em silêncio vira "sem
    // resultado" e o Operador não sabe se é rede, dado ou defeito.
    responder({
      type: "error",
      motivo: "falha_na_execucao",
      detalhe: err instanceof Error ? err.message : String(err),
    });
  }
}

// Registro do Worker — condicional de propósito (ver executarPedido acima).
// Em Node, `self` não existe e este bloco simplesmente não roda, deixando os
// exports puros importáveis pela suíte.
declare const self: { postMessage: (m: unknown) => void; onmessage: ((e: MessageEvent<BacktestWorkerRequest>) => void) | null } | undefined;
if (typeof self !== "undefined" && typeof self.postMessage === "function") {
  const escopo = self;
  escopo.onmessage = (e: MessageEvent<BacktestWorkerRequest>) => {
    void executarPedido(e.data, (msg) => escopo.postMessage(msg));
  };
}
