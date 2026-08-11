// platt-calibration.ts — Escopo Cirúrgico (Operador, Fase 3: "Calibração de
// Probabilidade"), auditado antes de codar (Disciplina item 2/3 do
// CLAUDE.md — pesquisa real via WebSearch do método com nome próprio antes
// de implementar uma variante possivelmente imprecisa).
//
// O QUE O DOCUMENTO PEDIA vs. O QUE ESTE ARQUIVO FAZ (3 correções reais):
//
// 1) ALVOS DE TREINO. O documento treina o sigmoide contra rótulos 0/1
//    crus (`outcome === 'WIN' ? 1 : 0`). O paper real (Platt, J. "Probabilistic
//    Outputs for Support Vector Machines and Comparisons to Regularized
//    Likelihood Methods", 1999) NUNCA usa 0/1 cru — usa alvos suavizados
//    via Laplace smoothing / Bayes com prior uniforme sobre rótulos fora da
//    amostra: t+ = (N+ + 1)/(N+ + 2), t- = 1/(N- + 2), onde N+/N- são as
//    contagens reais de WIN/LOSS na amostra de treino (pesquisado via
//    WebSearch, confirmado por múltiplas fontes independentes — ver PR).
//    Isso importa exatamente aqui: com 0/1 crus, um sigmoide treinado por
//    gradiente numa amostra PEQUENA (o regime realista deste terminal
//    read-only, que nunca terá milhares de trades) satura em direção a
//    0%/100% — reivindicando uma certeza que a amostra não sustenta,
//    exatamente o tipo de dado fabricado que a Regra de Ouro 3 proíbe. Os
//    alvos suavizados limitam matematicamente a saída (ex.: N=30 só WIN =>
//    teto real de 31/32 ≈ 96,9%, nunca 100%) — testado abaixo.
//
// 2) GRADIENTE. O documento usa `error * prob * (1-prob) * score` — essa é
//    a derivada de ERRO QUADRÁTICO through-a-sigmoid, não de log-loss (a
//    função de perda que o próprio documento descreve em prosa: "máxima
//    verossimilhança"). A derivada real de log-loss em relação a
//    (A·score+B), sob a convenção p=1/(1+exp(A·score+B)) usada aqui e no
//    paper (nunca sigmoid(z) padrão — o sinal de A é invertido de
//    propósito), é (alvo - p), SEM o fator p·(1-p) extra — os dois se
//    cancelam por construção (essa é a razão real de log-loss+sigmoid
//    serem sempre combinados). O fator espúrio do documento faz o
//    gradiente desaparecer perto de p≈0/1 (sigmoide saturado) — exatamente
//    onde uma amostra pequena e desbalanceada tende a cair primeiro,
//    deixando A/B presos perto da inicialização (0,0) por 1000 épocas:
//    um resultado "calibrado" que na prática nunca se afastou de um
//    palpite neutro. Derivação conferida à mão + checagem numérica direta
//    (ver testes) antes de codar.
//
// 3) ARQUITETURA. O documento propõe uma classe com estado mutável
//    (`samples: []`, `addSample()` chamado no fechamento de cada Trade
//    Plan, recalibração a cada 50 amostras). Este código-base não tem NENHUM
//    precedente de uma instância de classe viva/singleton em nexus/ — tudo
//    aqui é função pura sobre um array já existente (mesmo padrão de
//    computeExpectancy/evaluateSignalFilter em expectancy.ts). A fonte real
//    de trades resolvidos JÁ existe (simulateTradeCostsBatch sobre
//    trackRecordSlice.history) — treinar de novo a cada chamada sobre esse
//    array (2 parâmetros, ≤TRACK_RECORD_HISTORY_CAP=100 amostras, 1000
//    épocas) custa microssegundos; não há necessidade real de estado
//    incremental, e introduzir um singleton abriria uma pergunta de
//    persistência/ciclo-de-vida que o documento não endereça. calibrateConfidence
//    abaixo espelha a MESMA forma de evaluateSignalFilter: recebe o array
//    real já filtrado pelo chamador para o escopo desejado (nunca faz sua
//    própria estratificação — mesmo espírito), reusa
//    MIN_TRADES_FOR_VALID_EXPECTANCY (zero segunda constante "30").
//
// O campo `fingerprint` do CalibrationSample do documento (definido mas
// nunca usado no train()/calibrate() propostos) não existe aqui por
// desenho, não por descuido: TradeCostResult já carrega `fingerprint`
// (Fase 1) — um chamador que queira calibração por cenário específico
// filtra `results.filter(r => r.fingerprint === x)` ANTES de chamar
// calibrateConfidence, mesmo padrão já declarado em evaluateSignalFilter.
// Calibrar por fingerprint HOJE fragmentaria uma amostra já escassa em
// células que dificilmente atingiriam 30 — fica como evolução real quando
// o volume justificar, nunca como filtro fabricado agora.
import { MIN_TRADES_FOR_VALID_EXPECTANCY } from "./expectancy";
import type { TradeCostResult } from "./trade-simulation";

export interface PlattCalibrationSample {
  score: number; // modelAgreement real (-1..1), nunca um score fabricado
  outcome: boolean; // true = WIN, mesma definição de expectancy.ts (netR > 0)
}

export interface PlattParams {
  a: number;
  b: number;
}

const PLATT_LEARNING_RATE = 0.01;
const PLATT_EPOCHS = 1000;

/** Treina A/B por gradiente descendente sobre alvos suavizados reais de
 *  Platt (1999) — ver header para a derivação e a pesquisa que a
 *  sustenta. Pura: sem piso de amostra mínima aqui (mesma filosofia de
 *  computeExpectancy — o piso de significância é responsabilidade do
 *  chamador, calibrateConfidence). null só quando a amostra está
 *  genuinamente vazia — nunca um ajuste fabricado sobre zero dado. */
export function trainPlattScaling(samples: PlattCalibrationSample[]): PlattParams | null {
  if (samples.length === 0) return null;

  const nPos = samples.filter((s) => s.outcome).length;
  const nNeg = samples.length - nPos;
  const targetWin = (nPos + 1) / (nPos + 2);
  const targetLoss = 1 / (nNeg + 2);

  let a = 0;
  let b = 0;
  for (let epoch = 0; epoch < PLATT_EPOCHS; epoch++) {
    let gradA = 0;
    let gradB = 0;
    for (const s of samples) {
      const target = s.outcome ? targetWin : targetLoss;
      const p = 1 / (1 + Math.exp(a * s.score + b));
      // dL/dz do log-loss real, sob p=1/(1+exp(A·score+B)): (alvo - p) —
      // ver header (item 2) para a derivação completa. NUNCA multiplicar
      // por p·(1-p): isso seria a derivada de erro quadrático, não de
      // log-loss, e satura perto de p≈0/1 (ver header).
      const residual = target - p;
      gradA += residual * s.score;
      gradB += residual;
    }
    a -= (PLATT_LEARNING_RATE * gradA) / samples.length;
    b -= (PLATT_LEARNING_RATE * gradB) / samples.length;
  }
  return { a, b };
}

/** p=1/(1+exp(A·score+B)) — mesma convenção do paper (A negativo quando
 *  score alto realmente correlaciona com WIN). Retorna 0..1 real. */
export function applyPlattScaling(rawScore: number, params: PlattParams): number {
  return 1 / (1 + Math.exp(params.a * rawScore + params.b));
}

export interface CalibrationResult {
  calibrated: boolean;
  probability: number | null; // 0-100 arredondado; null quando não calibrável
  rawScore: number | null;
  sampleSize: number; // amostra REAL usável (modelAgreement != null)
  reason: string | null; // motivo do não-calibrado — sempre que probability é null
}

/** Camada de política — mesma forma de evaluateSignalFilter (expectancy.ts):
 *  `results` já deve vir filtrado pelo chamador para o escopo desejado
 *  (symbol:timeframe, ou um fingerprint específico); esta função nunca
 *  faz sua própria estratificação. WIN = netR > 0, mesma definição de
 *  expectancy.ts (zero segunda fonte do que conta como acerto). Amostra
 *  usável exclui resultados sem modelAgreement real (registros antigos,
 *  ou nenhum modelo com voto real na abertura) — nunca conta um trade sem
 *  score real rumo ao piso de significância. Dois motivos reais e
 *  distintos para `calibrated: false`: amostra insuficiente, ou nenhum
 *  score ATUAL para calibrar (sem plano ativo agora) — nunca um só
 *  "insuficiente" genérico escondendo qual dos dois é real. */
export function calibrateConfidence(rawScore: number | null, results: TradeCostResult[]): CalibrationResult {
  const usable = results.filter((r): r is TradeCostResult & { modelAgreement: number } => r.modelAgreement !== null);

  if (usable.length < MIN_TRADES_FOR_VALID_EXPECTANCY) {
    return {
      calibrated: false,
      probability: null,
      rawScore,
      sampleSize: usable.length,
      reason: `Amostra real de ${usable.length} trades com leitura de modelo — mínimo ${MIN_TRADES_FOR_VALID_EXPECTANCY} para calibração válida.`,
    };
  }

  if (rawScore === null) {
    return {
      calibrated: false,
      probability: null,
      rawScore: null,
      sampleSize: usable.length,
      reason: "Sem plano ativo com leitura real de modelo agora — nada para calibrar.",
    };
  }

  const samples: PlattCalibrationSample[] = usable.map((r) => ({ score: r.modelAgreement, outcome: r.netR > 0 }));
  const params = trainPlattScaling(samples);
  // usable.length >= MIN_TRADES_FOR_VALID_EXPECTANCY > 0 aqui, então
  // params nunca é null — mas o fail-closed fica explícito de qualquer
  // forma, nunca um cast silencioso.
  if (params === null) {
    return { calibrated: false, probability: null, rawScore, sampleSize: usable.length, reason: "DADOS_INSUFICIENTES_PARA_CALIBRACAO" };
  }

  const probability = applyPlattScaling(rawScore, params);
  return {
    calibrated: true,
    probability: Math.round(probability * 100),
    rawScore,
    sampleSize: usable.length,
    reason: null,
  };
}
