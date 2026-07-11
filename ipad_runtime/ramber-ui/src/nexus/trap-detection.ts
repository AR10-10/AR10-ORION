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
export const TRAP_CONTRACT_VERSION = 1 as const;

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
    });
  }

  return out;
}
