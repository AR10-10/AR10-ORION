// microstructure-readout.ts — LEITURA VISÍVEL DA MICROESTRUTURA.
//
// ── O ACHADO QUE ORIGINOU ESTE MÓDULO ──────────────────────────────────
// Auditoria por AST ("calculado e nunca lido", varrendo objetos literais
// devolvidos por funções exportadas de nexus/ contra todo acesso de
// propriedade em src/ e tests/). Ela substituiu uma varredura por texto
// que dava falso positivo — e encontrou, num módulo só, QUATRO leituras
// reais que `composeMicrostructureSnapshot()` computa a cada mudança de
// order flow / trap / CVD / book, grava na store, e que NENHUM consumidor
// jamais lê:
//
//   absorptionState  — a distinção ABSORPTION_OBSERVED vs _CONFIRMED
//                      (Ordem A2.1 §7), corroborada por trap-detection
//   bidWalls/askWalls — muros reais do book (order-book-depth.ts)
//   eventIntensity   — "intensidade ≠ direção" (Ordem A2.1 §9)
//
// O seletor `useMicrostructureSnapshot` existia na store e também nunca
// tinha sido consumido. Mesma família dos achados anteriores (resolvedAt,
// contextAtOpen.score, computeLevelStrength): **o dado sempre esteve lá e
// morria na fronteira** — só que aqui a fronteira era a própria tela.
//
// ── A REGRA QUE NÃO PODE SER QUEBRADA AQUI ─────────────────────────────
// `MicrostructureSnapshot.depth` é `Partial<Record<Exchange, ...>>` porque
// a Ordem A2.1 §16 proíbe misturar books de venues diferentes. Este módulo
// **conta muros por venue** e nunca soma os dois num número único: dois
// muros na Binance e um na MEXC não são "três muros" — são duas leituras
// independentes que por acaso concordam. Somar apagaria exatamente a
// informação que torna a concordância interessante.
//
// ── REGRA DE OURO 3 ────────────────────────────────────────────────────
// Fail-closed em toda ponta: sem snapshot, com qualidade INSUFFICIENT_DATA,
// ou sem nenhuma leitura real acima do trivial, o resultado é
// `visible: false` e a UI não desenha nada. Nunca um "0 muros / NONE /
// LOW" fabricado ocupando espaço para dizer que não há nada.
//
// LEI 24: leitura de evidência. Zero direção, zero decisão.
import type {
  AbsorptionState,
  EventIntensityReading,
  MicrostructureDataQuality,
  MicrostructureSnapshot,
} from "./microstructure-snapshot";

export interface VenueWallCount {
  /** Nome real da venue, sempre junto da contagem — nunca uma soma anônima. */
  venue: string;
  bid: number;
  ask: number;
}

export interface MicrostructureReadout {
  /** false = nada real a mostrar; a UI não desenha o bloco (zero poluição). */
  visible: boolean;
  quality: MicrostructureDataQuality | null;
  /** null quando NONE — "nenhuma absorção observada" não merece uma linha. */
  absorption: AbsorptionState | null;
  /** Só venues que realmente têm ao menos um muro. Nunca somadas entre si. */
  walls: VenueWallCount[];
  /** null quando não houve NENHUM evento real na janela. */
  intensity: EventIntensityReading | null;
}

const NADA: MicrostructureReadout = {
  visible: false,
  quality: null,
  absorption: null,
  walls: [],
  intensity: null,
};

const contarMuros = (flags: readonly boolean[] | null | undefined): number =>
  Array.isArray(flags) ? flags.reduce((n, f) => (f === true ? n + 1 : n), 0) : 0;

/**
 * Reduz o snapshot real a exatamente o que vale ocupar espaço na tela.
 * Função pura.
 */
export function buildMicrostructureReadout(
  snapshot: MicrostructureSnapshot | null | undefined,
): MicrostructureReadout {
  if (!snapshot) return NADA;
  // Qualidade insuficiente NÃO vira uma leitura fraca: vira ausência.
  if (snapshot.quality === "INSUFFICIENT_DATA") return { ...NADA, quality: snapshot.quality };

  const absorptionBruta = snapshot.tradeFlow?.absorptionState ?? null;
  const absorption = absorptionBruta && absorptionBruta !== "NONE" ? absorptionBruta : null;

  const walls: VenueWallCount[] = [];
  const depth = snapshot.depth ?? {};
  // Ordem estável por nome de venue — a UI nunca deve reordenar sozinha
  // entre dois renders com o mesmo dado.
  for (const venue of Object.keys(depth).sort()) {
    const evidencia = depth[venue as keyof typeof depth];
    if (!evidencia) continue;
    // Book obsoleto não conta muro: um muro de 20s atrás pode não existir
    // mais, e mostrá-lo como atual seria afirmar o que não se mediu.
    if (evidencia.quality === "STALE" || evidencia.quality === "INSUFFICIENT_DATA") continue;
    const bid = contarMuros(evidencia.bidWalls);
    const ask = contarMuros(evidencia.askWalls);
    if (bid > 0 || ask > 0) walls.push({ venue, bid, ask });
  }

  const leituraIntensidade = snapshot.eventIntensity ?? null;
  const intensity =
    leituraIntensidade && Number.isFinite(leituraIntensidade.eventCount) && leituraIntensidade.eventCount > 0
      ? leituraIntensidade
      : null;

  const visible = absorption !== null || walls.length > 0 || intensity !== null;
  return { visible, quality: snapshot.quality, absorption, walls, intensity };
}

const ABSORPTION_LABEL: Record<Exclude<AbsorptionState, "NONE">, string> = {
  ABSORPTION_OBSERVED: "ABSORÇÃO OBSERVADA",
  // A distinção é o ponto: CONFIRMADA exigiu corroboração real posterior
  // (trap-detection.ts), OBSERVADA é só o sinal de order flow sozinho.
  ABSORPTION_CONFIRMED: "ABSORÇÃO CONFIRMADA",
};

/** Linha curta para a UI. Só monta o que existe de verdade — nunca um
 *  placeholder para o que não foi medido. */
export function describeMicrostructureReadout(r: MicrostructureReadout): string {
  if (!r.visible) return "";
  const partes: string[] = [];
  if (r.absorption) partes.push(ABSORPTION_LABEL[r.absorption]);
  for (const w of r.walls) {
    const lados = [w.bid > 0 ? `${w.bid} compra` : null, w.ask > 0 ? `${w.ask} venda` : null].filter(Boolean);
    partes.push(`muros ${w.venue} ${lados.join("/")}`);
  }
  if (r.intensity) {
    const segundos = Math.round(r.intensity.windowMs / 1000);
    partes.push(`${r.intensity.eventCount} eventos/${segundos}s (${r.intensity.level})`);
  }
  return partes.join(" · ");
}
