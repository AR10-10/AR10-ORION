// directional-gauge.ts — "constrói uma bola... um só aparece, tipo longo ou
// short, quando tivesse essa porcentagem, X por cento pra long ou short,
// bem profissional" (pedido direto do Operador).
//
// ═══ O QUE ELE PEDIU, TRADUZIDO ═══
//
// Um medidor circular único: mostra UM lado por vez (o que o Núcleo está
// emitindo agora), com a porcentagem real dentro, "bem profissional" — o
// desenho padrão de qualquer terminal institucional (um anel de progresso,
// não uma lista de números).
//
// ═══ POR QUE ISTO NÃO É UM NÚMERO NOVO ═══
//
// Este módulo não inventa matemática. Ele só desenha, em geometria de SVG, a
// MESMA leitura já calculada em directional-consensus.ts
// (DirectionalConsensusReading.alignmentRatio) — quantas das 7 fontes reais
// do ecossistema concordam com a direção que o Núcleo está emitindo agora.
// Zero segunda fonte, zero probabilidade nova.
//
// A HONESTIDADE DO NÚMERO DENTRO DA BOLA (repetida aqui de propósito, porque
// um medidor circular grande e bonito é exatamente o tipo de superfície que
// convida a mal-entendido): o percentual é CONSISTÊNCIA INTERNA do
// ecossistema — quantas leituras já resolvidas por outros motores apontam
// para o mesmo lado que o Núcleo — nunca uma probabilidade calibrada de
// acerto do trade (Regra de Ouro 2). O rótulo desenhado deixa isso escrito.
//
// ═══ GEOMETRIA ═══
//
// Anel (donut) de 270°, não um círculo fechado — a abertura embaixo é onde
// vive o rótulo do valor central, convenção real de gauge profissional
// (velocímetro/medidor de bateria). stroke-dasharray/stroke-dashoffset é a
// técnica padrão para "ATR de progresso circular" em SVG; a matemática pura
// abaixo é só geometria de círculo, sem nada do DOM — o componente React
// consome os números prontos.
import type { Direction } from "./direction-semantics";
import { directionColor } from "./direction-semantics";
import type { DirectionalConsensusReading } from "./directional-consensus";

/** Quantos graus de arco o anel cobre — 270° (3/4 de volta) é a convenção
 *  real de velocímetro/medidor de bateria: deixa uma "boca" de 90° embaixo,
 *  livre para o número central, e ainda lê como "cheio" perto do topo. */
export const GAUGE_ARC_DEGREES = 270;
/** Onde o arco começa, em graus, medido a partir do topo (12h) andando no
 *  sentido horário. -225° faz o arco nascer no canto inferior-esquerdo e
 *  terminar no inferior-direito, com o topo no meio do percurso — a MESMA
 *  orientação de qualquer velocímetro real. */
export const GAUGE_START_DEGREES = -225;

export interface GaugeGeometry {
  /** Raio real do anel, em unidades do viewBox (SVG 0..100). */
  radius: number;
  /** Circunferência TOTAL de um círculo completo deste raio — a base do
   *  cálculo de stroke-dasharray. */
  circumference: number;
  /** Comprimento do traço de FUNDO (o anel inteiro, cinza, sempre visível
   *  por trás do preenchimento — mostra a escala 0–100% mesmo sem dado). */
  trackLength: number;
  /** Comprimento do traço PREENCHIDO — a fração real do arco que representa
   *  o alignmentRatio. 0 quando não há leitura. */
  fillLength: number;
  /** stroke-dashoffset a aplicar no traço de fundo, para ele ocupar só os
   *  270° do arco (não os 360° completos) a partir do ponto de início. */
  trackOffset: number;
  /** stroke-dashoffset do traço preenchido — MESMO ponto de início do
   *  fundo, cresce no mesmo sentido. */
  fillOffset: number;
  /** Rotação real do <svg>, em graus, para o arco nascer no ângulo certo
   *  (SVG desenha círculos a partir das 3h por padrão — isto corrige para
   *  GAUGE_START_DEGREES). */
  rotationDegrees: number;
}

/** Geometria pura do anel — o mesmo raio para qualquer leitura, já que o
 *  tamanho visual é decidido pelo componente (viewBox), não pelo dado. */
export function gaugeTrackGeometry(radius = 40): Pick<GaugeGeometry, "radius" | "circumference" | "trackLength" | "trackOffset" | "rotationDegrees"> {
  const circumference = 2 * Math.PI * radius;
  const trackLength = circumference * (GAUGE_ARC_DEGREES / 360);
  return {
    radius,
    circumference,
    trackLength,
    trackOffset: 0,
    rotationDegrees: GAUGE_START_DEGREES,
  };
}

export interface GaugeReading {
  status: "OK" | "DADOS_INSUFICIENTES";
  /** O lado que o anel representa — a MESMA referência do Núcleo, nunca
   *  recalculada. `null` sem direção real (o anel fica vazio/cinza). */
  side: Direction | null;
  /** 0..100 — a mesma alignmentRatio, só multiplicada por 100. `null` sem
   *  leitura real (nunca um 0 que se leria como "zero por cento real"). */
  percent: number | null;
  /** Cor real do lado — reusa direction-semantics.ts, nunca um hex solto
   *  aqui (a mesma disciplina que a guarda de inversão protege). */
  color: string;
  geometry: GaugeGeometry;
}

const EMPTY_GEOMETRY: GaugeGeometry = {
  ...gaugeTrackGeometry(),
  fillLength: 0,
  fillOffset: 0,
};

/**
 * Traduz a leitura de consenso real (já calculada em directional-consensus.ts)
 * para os números que o SVG do anel precisa desenhar.
 *
 * Fail-closed: sem leitura OK ou sem `core` real, devolve `percent: null` e
 * geometria de anel vazio — o componente decide então mostrar cinza/"—",
 * nunca inventa uma fração.
 */
export function computeGaugeReading(
  r: DirectionalConsensusReading | null | undefined,
  radius = 40,
): GaugeReading {
  const track = gaugeTrackGeometry(radius);
  if (!r || r.status !== "OK" || r.core === null || r.core === "NEUTRO" || r.alignmentRatio === null) {
    return {
      status: "DADOS_INSUFICIENTES",
      side: r?.core ?? null,
      percent: null,
      color: directionColor(null),
      geometry: { ...track, fillLength: 0, fillOffset: 0 },
    };
  }
  const percent = r.alignmentRatio * 100;
  const fillLength = track.trackLength * r.alignmentRatio;
  return {
    status: "OK",
    side: r.core,
    percent,
    color: directionColor(r.core),
    geometry: { ...track, fillLength, fillOffset: 0 },
  };
}

/** Formata o percentual do anel — piso "<1%" pelo mesmo motivo dos outros
 *  formatadores desta sessão: "0%" se confundiria com "sem leitura". */
export function formatGaugePercent(percent: number | null | undefined): string {
  if (!Number.isFinite(percent)) return "—";
  const p = percent as number;
  if (p === 0) return "0%";
  if (p < 1) return "<1%";
  return `${Math.round(p)}%`;
}

// Reexport para quem só quer a constante de geometria vazia num teste/estado
// inicial, sem chamar a função.
export { EMPTY_GEOMETRY as GAUGE_EMPTY_GEOMETRY };
