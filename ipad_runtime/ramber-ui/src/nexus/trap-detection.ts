// trap-detection.ts — V-MAX Fase 2 (Supremacia): detecção avançada de
// armadilhas institucionais.
//
// "Detecção" aqui significa CORROBORAÇÃO DE EVENTOS REAIS que já
// aconteceram — nunca inferência especulativa (Regra de Ouro 1). Os dois
// padrões institucionais clássicos detectáveis com o dado real desta
// árvore:
//
//   STOP HUNT (sweep de liquidez): um pool EQH/EQL real foi VARRIDO
//   (flag swept real do motor SMC — evento consumado, não previsão).
//   Corroboração: sinais reais de ABSORPTION/EXHAUSTION do Order Flow
//   Engine na janela recente — volume absorvido/exaurido junto do sweep é
//   a assinatura clássica de stop hunt institucional. Confiança =
//   (1 + corroborações) / 3, capada em 1: sweep sozinho = 1/3 (evento
//   real, interpretação fraca), +1 sinal = 2/3, +2 = 1.0 — escada
//   determinística documentada, mesma natureza do "3 fontes = confluência
//   plena" do FibonacciAgent.
//
//   ABSORÇÃO ANÔMALA: 2+ sinais reais de ABSORPTION na mesma janela —
//   volume grande sendo absorvido repetidamente sem deslocamento é o
//   precursor clássico de armadilha (alguém segurando o preço).
//   Confiança = min(1, contagem / 3).
//
// Sem evento real => lista vazia honesta, nunca uma armadilha "possível".
// Camada de análise/exibição — LEI 24 intacta.
//
// v2 (EPC OMEGA FINAL, Etapa 10 — "Liquidity Sweep: captura/direção/
// absorção"): auditoria da Etapa 1 encontrou a detecção real (abaixo) sem
// NENHUMA marca própria no gráfico — a zona EQH/EQL some da tela no
// instante em que é varrida (filtro !swept, EnhancedChart_110_Percent),
// sem deixar rastro do momento do sweep. `sweptLevels` expõe o preço E O
// ÍNDICE DE CANDLE reais que sweptEqh/sweptEql já tinham EM ESCOPO aqui
// dentro (zero recálculo, zero parsing das strings de `evidence`) para o
// canvas desenhar uma price line no preço exato.
//
// v3 (achado real de captura de tela do Operador — dezenas de rótulos
// "SWEEP" empilhados cobrindo o gráfico inteiro): a causa raiz NUNCA foi
// a clusterização por preço (v2/clusterSweptPrices abaixo já resolvia
// isso) — era que `swept` em LiquidityZone (engine-bridge.ts) é uma flag
// PERMANENTE: uma vez varrida, a zona nunca "desvarre". Sem decaimento
// por IDADE, TODA zona já varrida na história inteira carregada
// (potencialmente semanas) virava um rótulo permanente. `index` (já
// real, já calculado por clusterEqualLevels em fvg-order-block-engine.js,
// só nunca lido aqui) agora é exposto em `sweptLevels` — o consumidor
// real (EnhancedChart_110_Percent.tsx) usa `chartData.length-1-index`
// exatamente como já faz para BOS/CHOCH (annotation-decay.ts::ageAlpha)
// para esmaecer e eventualmente ocultar sweeps antigos, mesma disciplina
// já provada, nunca uma segunda técnica de decaimento inventada.
import { clusterByPriceProximity } from '../../../src/research/engines/price-clustering.js';
export const TRAP_CONTRACT_VERSION = 3 as const;

export type TrapKind =
  | "STOP_HUNT_TOPO" // EQH varrido (liquidez compradora tomada acima)
  | "STOP_HUNT_FUNDO" // EQL varrido (liquidez vendedora tomada abaixo)
  | "ABSORCAO_ANOMALA";

export interface SweptLevel {
  price: number;
  index: number; // índice real do candle em que este pool foi detectado (fvg-order-block-engine.js::clusterEqualLevels) — base real do decaimento por idade no canvas.
}

export interface TrapSignal {
  contractVersion: typeof TRAP_CONTRACT_VERSION;
  kind: TrapKind;
  confidence: number; // escada real de corroboração (documentada acima), 0..1
  evidence: string[]; // eventos reais citados
  at: number;
  // v2/v3: nível(is) real(is) varrido(s) — só populado em STOP_HUNT_TOPO/
  // FUNDO (o preço + índice exatos do pool EQH/EQL que motivou este
  // sinal); [] em ABSORCAO_ANOMALA, que não tem um preço-âncora único real.
  sweptLevels: SweptLevel[];
}

export interface TrapInputs {
  liquidityZones: Array<{ type: "EQUAL_HIGH" | "EQUAL_LOW"; price: number; index: number; swept: boolean }>;
  orderflowSignals: Array<{ type: string; timestamp?: number; confidence?: number }>;
  now: number;
  // Janela real de corroboração: 3 ciclos do poller de order flow (4s) +
  // folga — um sinal mais velho que isto não descreve o momento do sweep.
  windowMs?: number;
}

export const TRAP_CORROBORATION_WINDOW_MS = 60_000;

function recentSignals(signals: TrapInputs["orderflowSignals"], now: number, windowMs: number) {
  return signals.filter(
    (s) => (s.type === "ABSORPTION" || s.type === "EXHAUSTION")
      && Number.isFinite(s.timestamp)
      && now - (s.timestamp as number) <= windowMs,
  );
}

export function detectInstitutionalTraps(inputs: TrapInputs): TrapSignal[] {
  const windowMs = inputs.windowMs ?? TRAP_CORROBORATION_WINDOW_MS;
  const corroborating = recentSignals(inputs.orderflowSignals, inputs.now, windowMs);
  const out: TrapSignal[] = [];

  const sweptEqh = inputs.liquidityZones.filter((z) => z.type === "EQUAL_HIGH" && z.swept);
  const sweptEql = inputs.liquidityZones.filter((z) => z.type === "EQUAL_LOW" && z.swept);

  const sweepConfidence = Math.min(1, (1 + corroborating.length) / 3);
  const corroborationEvidence = corroborating.map((s) => `sinal real ${s.type} na janela`);

  if (sweptEqh.length > 0) {
    out.push({
      contractVersion: TRAP_CONTRACT_VERSION,
      kind: "STOP_HUNT_TOPO",
      confidence: sweepConfidence,
      evidence: [
        `${sweptEqh.length} EQH real(is) varrido(s): ${sweptEqh.map((z) => z.price.toFixed(2)).join(", ")}`,
        ...corroborationEvidence,
      ],
      at: inputs.now,
      sweptLevels: sweptEqh.map((z) => ({ price: z.price, index: z.index })),
    });
  }
  if (sweptEql.length > 0) {
    out.push({
      contractVersion: TRAP_CONTRACT_VERSION,
      kind: "STOP_HUNT_FUNDO",
      confidence: sweepConfidence,
      evidence: [
        `${sweptEql.length} EQL real(is) varrido(s): ${sweptEql.map((z) => z.price.toFixed(2)).join(", ")}`,
        ...corroborationEvidence,
      ],
      at: inputs.now,
      sweptLevels: sweptEql.map((z) => ({ price: z.price, index: z.index })),
    });
  }

  const absorptions = corroborating.filter((s) => s.type === "ABSORPTION");
  if (absorptions.length >= 2) {
    out.push({
      contractVersion: TRAP_CONTRACT_VERSION,
      kind: "ABSORCAO_ANOMALA",
      confidence: Math.min(1, absorptions.length / 3),
      evidence: [`${absorptions.length} sinais reais de ABSORPTION na janela de ${Math.round(windowMs / 1000)}s`],
      at: inputs.now,
      sweptLevels: [],
    });
  }

  return out;
}

// Companion function (Lapidação Institucional — diretiva "agrupar
// automaticamente eventos repetidos próximos, ex.: 8 SWEEPs consecutivos
// -> SWEEP ZONE (8 eventos)"): achado real, não especulativo — sweptEqh/
// sweptEql acima já podem conter 2+ zonas EQH/EQL DISTINTAS (cada uma já
// um cluster real de >=2 toques via clusterEqualLevels em
// fvg-order-block-engine.js) que ficam PRÓXIMAS entre si sem serem a
// MESMA zona; se todas forem varridas na mesma janela, cada preço vira
// um rótulo próprio no canvas. Mesmo idioma de clusterização por âncora
// FIXA (nunca média rodante) de clusterEqualLevels, reimplementado aqui
// porque ramber-ui e o engine .js legado vivem em pacotes/runtimes
// diferentes (nunca um import cross-package). Puro: zero rede/estado,
// testável por execução real.
//
// v2 (achado real de captura de tela — decaimento por idade): cada
// cluster agora carrega `latestIndex` (o MAIOR índice real entre seus
// membros — a evidência mais recente do grupo, nunca uma média, pelo
// mesmo motivo de "âncora fixa" documentado acima: um membro velho
// misturado com um recente não deveria "diluir" a idade real do grupo
// pra mais antiga). O caller decide o alpha real via
// annotation-decay.ts::ageAlpha(chartData.length-1-latestIndex, config).
export interface SweptPriceCluster {
  avgPrice: number;
  count: number;
  latestIndex: number;
}

export function clusterSweptPrices(levels: { price: number; index: number }[], proximityPct: number): SweptPriceCluster[] {
  // Fonte única do agrupamento (research/engines/price-clustering.js): este
  // laço era byte a byte o mesmo de institutional-zones.ts e o mesmo (em
  // outra unidade) de fvg-order-block-engine.js. Mesma remediação que
  // findSwings já recebeu quando estava triplicado.
  //
  // O filtro de `index` finito continua AQUI de propósito: é uma exigência
  // deste consumidor (a redução usa `latestIndex`), não do agrupamento —
  // price-clustering só garante preço real.
  const validos = levels.filter((l) => Number.isFinite(l.price) && Number.isFinite(l.index));
  return clusterByPriceProximity(validos, (l) => l.price, proximityPct).map((grupo) => ({
    avgPrice: grupo.reduce((sum, l) => sum + l.price, 0) / grupo.length,
    count: grupo.length,
    latestIndex: Math.max(...grupo.map((l) => l.index)),
  }));
}
