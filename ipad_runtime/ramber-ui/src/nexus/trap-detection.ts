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
// sem deixar rastro do momento do sweep. `sweptPrices` expõe o preço
// real que sweptEqh/sweptEql já tinham EM ESCOPO aqui dentro (zero
// recálculo, zero parsing das strings de `evidence`) para o canvas
// desenhar uma price line no preço exato.
export const TRAP_CONTRACT_VERSION = 2 as const;

export type TrapKind =
  | "STOP_HUNT_TOPO" // EQH varrido (liquidez compradora tomada acima)
  | "STOP_HUNT_FUNDO" // EQL varrido (liquidez vendedora tomada abaixo)
  | "ABSORCAO_ANOMALA";

export interface TrapSignal {
  contractVersion: typeof TRAP_CONTRACT_VERSION;
  kind: TrapKind;
  confidence: number; // escada real de corroboração (documentada acima), 0..1
  evidence: string[]; // eventos reais citados
  at: number;
  // v2: preço(s) real(is) varrido(s) — só populado em STOP_HUNT_TOPO/FUNDO
  // (o preço exato do pool EQH/EQL que motivou este sinal); [] em
  // ABSORCAO_ANOMALA, que não tem um preço-âncora único real.
  sweptPrices: number[];
}

export interface TrapInputs {
  liquidityZones: Array<{ type: "EQUAL_HIGH" | "EQUAL_LOW"; price: number; swept: boolean }>;
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
      sweptPrices: sweptEqh.map((z) => z.price),
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
      sweptPrices: sweptEql.map((z) => z.price),
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
      sweptPrices: [],
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
export interface SweptPriceCluster {
  avgPrice: number;
  count: number;
}

export function clusterSweptPrices(prices: number[], proximityPct: number): SweptPriceCluster[] {
  const sorted = prices.filter((p) => Number.isFinite(p)).sort((a, b) => a - b);
  const clusters: SweptPriceCluster[] = [];
  let current: number[] = [];
  const flush = () => {
    if (current.length === 0) return;
    const avgPrice = current.reduce((sum, p) => sum + p, 0) / current.length;
    clusters.push({ avgPrice, count: current.length });
  };
  for (const price of sorted) {
    if (current.length === 0) {
      current.push(price);
      continue;
    }
    const anchor = current[0];
    const closeEnough = anchor !== 0 && (Math.abs(price - anchor) * 100) / anchor <= proximityPct;
    if (closeEnough) {
      current.push(price);
    } else {
      flush();
      current = [price];
    }
  }
  flush();
  return clusters;
}
