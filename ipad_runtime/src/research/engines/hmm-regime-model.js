// hmm-regime-model.js — Entrega 43 (Laboratório de Evolução): Hidden Markov
// Model de 3 estados para uma leitura PROBABILÍSTICA de regime de mercado,
// complementar ao classificador determinístico já real e graduado
// (market-regime/regime-engine.js — Wilder ADX/DI + percentil de banda de
// Bollinger). Este arquivo NUNCA reimplementa esse classificador.
//
// Contexto (Disciplina de trabalho item 7 do CLAUDE.md): um documento
// externo ("ENTREGA 43: REGIME DETECTOR + HMM") chegou endereçando "Agente
// 4" e assinado por outra persona fictícia ("AR10 ORION Product Owner"),
// acompanhado de um ZIP com código pronto para um `src/regime/` +
// `src/components/` + `src/hooks/` — estrutura de pastas que não existe
// neste projeto (App.tsx + nexus/*.ts flat; a decomposição em pastas é sua
// própria rodada isolada, já registrada em Próximos Passos). Confirmado com
// o Operador via AskUserQuestion: autoria real confirmada, mas a direção
// técnica escolhida foi "estender o regime-engine.js real, nunca duplicar"
// — o `RegimeDetector`/`ATRADXClassifier`/`RegimeCache`/`RegimeBadge` do
// ZIP foram REJEITADOS (não só adiados): duplicam regime-engine.js, e o
// `ATRADXClassifier.calculateADX()` do ZIP tem um bug real e confessado no
// próprio comentário — devolve DX puro sem suavização de Wilder e chama
// isso de "ADX" ("ADX verdadeiro requer smoothing, mas dx já é suficiente
// para regime"), enquanto regime-engine.js já tem ADX de Wilder verdadeiro
// (`computeAdx`, exportado). RegimeBadge também foi rejeitado por
// redundância real: ContextReadStrip (App.tsx) já mostra "Regime:
// {label} {direção}" sempre visível na Linha 2 do header, mesmo lugar que
// o documento pedia para o novo badge.
//
// O que ESTE arquivo constrói (a peça genuinamente nova, autorizada): a
// camada HMM/probabilística que não existe em NENHUMA forma no código —
// forward/backward/Baum-Welch/Viterbi (Rabiner 1989, "A Tutorial on Hidden
// Markov Models") sobre features derivadas de funções JÁ graduadas
// (computeAdx daqui de regime-engine.js, computeAtrPercent de
// lorentzian-classifier.js) — zero segunda curva de ADX/ATR.
//
// Achado real de auditoria antes de escrever este arquivo (comparando com o
// HMMAlgorithms.ts do ZIP rejeitado, mesmo processo de "nunca copiar sem
// verificar" já praticado nesta sessão): o forward/backward do ZIP não é
// escalonado. Para sequências de dezenas a centenas de observações (o
// próprio documento pedia treino sobre até ~90 dias — centenas a milhares
// de candles), os valores de alpha somem para 0 por underflow de ponto
// flutuante bem antes disso: com ~27 símbolos quase uniformes no início,
// cada passo multiplica por ~0.01-0.03, e por volta de 150-200 passos o
// valor já é menor que Number.MIN_VALUE. Com os `denom > 0` guards do ZIP,
// o Baum-Welch resultante silenciosamente PARA de aprender (cai no
// fallback `model.A[i][j]`) e reporta "convergência" falsa (log-likelihood
// grudado num valor constante) sem ter aprendido nada — bug real, nunca
// testado no próprio checklist do documento (que só pede sequências
// curtas). Corrigido aqui com o escalonamento padrão (Rabiner §V-A: c_t =
// 1/Σ_i α_t(i), reescala alpha_t/beta_t por c_t a cada passo,
// log-likelihood = −Σ log(c_t)) — técnica clássica, não uma variante
// inventada. Viterbi já roda em espaço-log (mesma razão, técnica
// diferente) — essa parte do ZIP estava correta e serviu de referência.
//
// Rotulação dos estados: o treinamento é NÃO-SUPERVISIONADO — o HMM não
// sabe que "estado 0 é trending". `labelHmmStates()` rotula cada estado
// anônimo por CONCORDÂNCIA empírica real com regime-engine.js (Viterbi
// decodifica o candle, comparamos com o regime real já classificado na
// mesma janela) — nunca uma suposição fixa de índice.
//
// Deliberadamente NÃO construído nesta entrega (documentado, não
// escondido): pipeline de treino em Web Worker, persistência IndexedDB,
// retreino semanal automático — a parte "ao vivo" exigiria rodar contra
// dado real de mercado que este sandbox nunca teve (zero egress Binance em
// toda a sessão, mesma limitação já documentada para HistoricalSignalCollector
// na Entrega 42); RegimeBadge (rejeitado, redundante); integração com
// ProfitabilityEngine (expectancy filtrada por regime — ideia real e válida
// para o futuro, mas depende de ter tanto um HMM treinado quanto trades
// suficientes rotulados por regime, nenhum dos dois existe ainda). Este
// arquivo fica em research/engines/ — Laboratório, não importado por
// nenhum caminho de produção (fronteira travada por teste, mesmo padrão de
// zigzag-engine.js — ver QUARANTINE.md).
import { computeAdx, classifyMarketRegime } from "../../market-regime/regime-engine.js";
import { computeAtrPercent } from "./lorentzian-classifier.js";

export const HMM_STATE_COUNT = 3;
export const HMM_SYMBOL_COUNT = 27; // 3 bins x 3 features (o1, o2, o3)
export const HMM_ADX_PERIOD = 14;
export const HMM_ATR_PERIOD = 14;
export const HMM_MIN_CANDLES_FOR_FEATURES = 2 * HMM_ADX_PERIOD + 2; // janela de ADX + 1 candle real
export const BAUM_WELCH_MAX_ITERATIONS = 100;
export const BAUM_WELCH_TOLERANCE = 1e-3;
const EPS = 1e-10;

// Prior de transição declarado (regimes são persistentes — diagonal
// dominante), mesmo espírito documentado de LIQUIDITY_PROXIMITY_PCT em
// layer-relevance.ts: convenção de partida para o Baum-Welch, NUNCA uma
// medição real (este sandbox não tem histórico real de mercado pra
// calibrar isso).
export const DEFAULT_TRANSITION_PRIOR = Object.freeze([
  Object.freeze([0.85, 0.1, 0.05]),
  Object.freeze([0.1, 0.8, 0.1]),
  Object.freeze([0.2, 0.3, 0.5]),
]);

// Limiares de binning das 3 features contínuas -> símbolo discreto 0..26 —
// convenção documentada, não uma calibração estatística real.
export const O1_BIN_EDGES = Object.freeze([-0.5, 0.5]); // retorno / ATR%
export const O2_BIN_EDGES = Object.freeze([0.8, 1.5]); // range / ATR%
export const O3_BIN_EDGES = Object.freeze([0.2, 0.4]); // ADX / 100

function ohlc(row) {
  return {
    o: Number(row.o ?? row.open),
    h: Number(row.h ?? row.high),
    l: Number(row.l ?? row.low),
    c: Number(row.c ?? row.close),
  };
}

/** Extrai a série real de features (o1, o2, o3) de uma série de candles —
 *  reusa computeAdx (regime-engine.js) e computeAtrPercent
 *  (lorentzian-classifier.js), ambos JÁ graduados — zero segunda curva de
 *  ADX/ATR. ADX usa uma janela recente limitada (2×period+1 candles, mesma
 *  convenção do ciclo real que já pede uma janela fixa ao Bus), nunca a
 *  história inteira a cada passo — mantém a extração O(n) no total.
 *  Candles insuficientes ou com ATR%/close degenerados (<=0) são pulados —
 *  nunca uma feature fabricada sobre denominador inválido. */
export function extractFeatureSeries(candles, { adxPeriod = HMM_ADX_PERIOD, atrPeriod = HMM_ATR_PERIOD } = {}) {
  if (!Array.isArray(candles) || candles.length < 2 * adxPeriod + 2) return [];
  const adxWindow = 2 * adxPeriod + 1;
  const atrPctSeries = computeAtrPercent(candles, atrPeriod);
  const out = [];
  for (let i = adxWindow - 1; i < candles.length; i++) {
    const atrPct = atrPctSeries[i];
    if (!Number.isFinite(atrPct) || atrPct <= 0) continue;
    const row = ohlc(candles[i]);
    if (!Number.isFinite(row.o) || !Number.isFinite(row.c) || row.c === 0) continue;
    const adxResult = computeAdx(candles.slice(i - adxWindow + 1, i + 1), adxPeriod);
    if (!adxResult) continue;
    const returnPct = ((row.c - row.o) / row.c) * 100;
    const rangePct = ((row.h - row.l) / row.c) * 100;
    out.push({
      index: i,
      timestamp: candles[i].t ?? candles[i].timestamp ?? null,
      o1: returnPct / atrPct,
      o2: rangePct / atrPct,
      o3: adxResult.adx / 100,
    });
  }
  return out;
}

function binOf(value, edges) {
  if (value < edges[0]) return 0;
  if (value < edges[1]) return 1;
  return 2;
}

/** feature -> símbolo discreto 0..26 (3 bins por eixo). */
export function discretizeObservation(feature) {
  const b1 = binOf(feature.o1, O1_BIN_EDGES);
  const b2 = binOf(feature.o2, O2_BIN_EDGES);
  const b3 = binOf(feature.o3, O3_BIN_EDGES);
  return b1 * 9 + b2 * 3 + b3;
}

function makeMatrix(rows, cols, fill = 0) {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

function emissionProb(B, state, symbol) {
  if (symbol < 0 || symbol >= B[state].length) return EPS;
  const p = B[state][symbol];
  return Number.isFinite(p) && p > 0 ? p : EPS;
}

/** Forward algorithm ESCALONADO (Rabiner 1989 §V-A). Retorna alpha já
 *  escalonado (soma 1 em cada instante t), os fatores de escala c_t, e o
 *  log-likelihood REAL da sequência (−Σ log(c_t)) — nunca underflow para
 *  sequências longas (ver header: essa era exatamente a falha real do
 *  forward/backward não-escalonado do documento externo rejeitado). */
export function forwardScaled(observations, A, B, pi) {
  const T = observations.length;
  const N = A.length;
  if (T === 0) return { alpha: [], c: [], logLikelihood: null };
  const alphaHat = makeMatrix(T, N);
  const c = new Array(T).fill(0);

  for (let i = 0; i < N; i++) alphaHat[0][i] = pi[i] * emissionProb(B, i, observations[0]);
  let raw = alphaHat[0].reduce((a, b) => a + b, 0);
  c[0] = raw > 0 ? 1 / raw : 1 / EPS;
  for (let i = 0; i < N; i++) alphaHat[0][i] *= c[0];

  for (let t = 1; t < T; t++) {
    for (let j = 0; j < N; j++) {
      let sum = 0;
      for (let i = 0; i < N; i++) sum += alphaHat[t - 1][i] * A[i][j];
      alphaHat[t][j] = sum * emissionProb(B, j, observations[t]);
    }
    raw = alphaHat[t].reduce((a, b) => a + b, 0);
    c[t] = raw > 0 ? 1 / raw : 1 / EPS;
    for (let j = 0; j < N; j++) alphaHat[t][j] *= c[t];
  }

  let logLikelihood = 0;
  for (let t = 0; t < T; t++) logLikelihood -= Math.log(c[t]);
  return { alpha: alphaHat, c, logLikelihood };
}

/** Backward algorithm ESCALONADO, usando OS MESMOS fatores c_t do forward
 *  desta mesma sequência/modelo (Rabiner §V-A eq. 95). */
export function backwardScaled(observations, A, B, c) {
  const T = observations.length;
  const N = A.length;
  const betaHat = makeMatrix(T, N);
  if (T === 0) return betaHat;
  for (let i = 0; i < N; i++) betaHat[T - 1][i] = c[T - 1];
  for (let t = T - 2; t >= 0; t--) {
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let j = 0; j < N; j++) {
        sum += A[i][j] * emissionProb(B, j, observations[t + 1]) * betaHat[t + 1][j];
      }
      betaHat[t][i] = sum * c[t];
    }
  }
  return betaHat;
}

/** Baum-Welch (EM) — reestima A/B/pi por máxima verossimilhança sobre uma
 *  sequência real de símbolos discretos. Usa forward/backward ESCALONADOS
 *  acima (nunca os brutos). Log-likelihood não decresce a cada iteração —
 *  propriedade real do EM (Rabiner §III-C), testada abaixo, não suposta. */
export function baumWelch(observations, numStates = HMM_STATE_COUNT, numSymbols = HMM_SYMBOL_COUNT, options = {}) {
  const { maxIterations = BAUM_WELCH_MAX_ITERATIONS, tolerance = BAUM_WELCH_TOLERANCE, initialA = null, initialPi = null } = options;
  const T = observations.length;
  const N = numStates;
  const M = numSymbols;
  if (T === 0) return null;

  let A = (initialA ?? DEFAULT_TRANSITION_PRIOR).map((row) => row.slice());
  let pi = (initialPi ?? Array.from({ length: N }, () => 1 / N)).slice();
  let B = Array.from({ length: N }, () => Array.from({ length: M }, () => 1 / M));

  let prevLogLikelihood = -Infinity;
  let logLikelihood = -Infinity;
  let iterations = 0;

  for (iterations = 1; iterations <= maxIterations; iterations++) {
    const forward = forwardScaled(observations, A, B, pi);
    const alpha = forward.alpha;
    const c = forward.c;
    logLikelihood = forward.logLikelihood;
    const beta = backwardScaled(observations, A, B, c);

    const gamma = makeMatrix(T, N);
    for (let t = 0; t < T; t++) {
      let denom = 0;
      for (let j = 0; j < N; j++) denom += alpha[t][j] * beta[t][j];
      for (let i = 0; i < N; i++) gamma[t][i] = denom > 0 ? (alpha[t][i] * beta[t][i]) / denom : 1 / N;
    }

    const xiSum = makeMatrix(N, N);
    const gammaSumExceptLast = new Array(N).fill(0);
    for (let t = 0; t < T - 1; t++) {
      let denom = 0;
      const num = makeMatrix(N, N);
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const v = alpha[t][i] * A[i][j] * emissionProb(B, j, observations[t + 1]) * beta[t + 1][j];
          num[i][j] = v;
          denom += v;
        }
      }
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) xiSum[i][j] += denom > 0 ? num[i][j] / denom : 0;
        gammaSumExceptLast[i] += gamma[t][i];
      }
    }

    const newPi = gamma[0].slice();
    const newA = makeMatrix(N, N);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        newA[i][j] = gammaSumExceptLast[i] > 0 ? xiSum[i][j] / gammaSumExceptLast[i] : A[i][j];
      }
    }

    const gammaSumAll = new Array(N).fill(0);
    const symbolSum = makeMatrix(N, M);
    for (let t = 0; t < T; t++) {
      for (let i = 0; i < N; i++) {
        gammaSumAll[i] += gamma[t][i];
        symbolSum[i][observations[t]] += gamma[t][i];
      }
    }
    const newB = makeMatrix(N, M);
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < M; k++) newB[i][k] = gammaSumAll[i] > 0 ? symbolSum[i][k] / gammaSumAll[i] : 1 / M;
    }

    A = newA;
    B = newB;
    pi = newPi;

    if (Number.isFinite(logLikelihood) && Number.isFinite(prevLogLikelihood) && Math.abs(logLikelihood - prevLogLikelihood) < tolerance) {
      prevLogLikelihood = logLikelihood;
      break;
    }
    prevLogLikelihood = logLikelihood;
  }

  return { A, B, pi, logLikelihood: prevLogLikelihood, iterations: Math.min(iterations, maxIterations) };
}

/** Viterbi em espaço-log — sequência de estados mais provável dado o
 *  modelo (nunca underflow, mesma razão do escalonamento acima, técnica
 *  distinta padrão para decodificação). */
export function viterbi(observations, A, B, pi) {
  const T = observations.length;
  const N = A.length;
  if (T === 0) return { states: [], logProbability: null };
  const delta = makeMatrix(T, N);
  const psi = makeMatrix(T, N);

  for (let i = 0; i < N; i++) {
    delta[0][i] = Math.log(pi[i] > 0 ? pi[i] : EPS) + Math.log(emissionProb(B, i, observations[0]));
  }

  for (let t = 1; t < T; t++) {
    for (let j = 0; j < N; j++) {
      let best = -Infinity;
      let bestI = 0;
      for (let i = 0; i < N; i++) {
        const v = delta[t - 1][i] + Math.log(A[i][j] > 0 ? A[i][j] : EPS);
        if (v > best) {
          best = v;
          bestI = i;
        }
      }
      delta[t][j] = best + Math.log(emissionProb(B, j, observations[t]));
      psi[t][j] = bestI;
    }
  }

  let bestFinal = -Infinity;
  let bestFinalState = 0;
  for (let i = 0; i < N; i++) {
    if (delta[T - 1][i] > bestFinal) {
      bestFinal = delta[T - 1][i];
      bestFinalState = i;
    }
  }

  const states = new Array(T).fill(0);
  states[T - 1] = bestFinalState;
  for (let t = T - 2; t >= 0; t--) states[t] = psi[t + 1][states[t + 1]];

  return { states, logProbability: bestFinal };
}

/** Rotula os estados ANÔNIMOS 0..N-1 descobertos pelo HMM (treinamento
 *  não-supervisionado — o modelo nunca soube que "estado 0 é trending")
 *  por CONCORDÂNCIA empírica real: para cada candle da janela de
 *  features, compara o estado mais provável (Viterbi) com o regime JÁ
 *  classificado por regime-engine.js na mesma janela recente (mesmas 100
 *  velas de convenção do ciclo real) e vota. O rótulo de cada estado é o
 *  regime real mais frequente entre os candles que o Viterbi atribuiu a
 *  esse estado — nunca uma suposição de índice fixo. Estado sem nenhum
 *  voto real (regime-engine.js nunca teve leitura OK nos candles daquele
 *  estado) fica `null` — nunca um rótulo fabricado. */
export function labelHmmStates(candles, features, states) {
  const stateCount = states.length ? Math.max(...states) + 1 : 0;
  const votes = Array.from({ length: stateCount }, () => new Map());
  for (let k = 0; k < features.length; k++) {
    const idx = features[k].index;
    const window = candles.slice(Math.max(0, idx - 99), idx + 1);
    const real = classifyMarketRegime({ ohlcv_series: window });
    if (real.status !== "OK") continue;
    const bucket = votes[states[k]];
    bucket.set(real.regime, (bucket.get(real.regime) ?? 0) + 1);
  }
  return votes.map((bucket) => {
    let best = null;
    let bestCount = 0;
    for (const [label, count] of bucket) {
      if (count > bestCount) {
        best = label;
        bestCount = count;
      }
    }
    return best;
  });
}
