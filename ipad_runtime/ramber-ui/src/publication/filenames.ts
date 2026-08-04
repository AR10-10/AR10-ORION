// publication/filenames.ts — Ordem "AR10 PUBLICATION STUDIO" §8: nomes
// automáticos, mesmo timestamp identificando as 4 peças como uma única
// análise (derivado de analysis.generatedAt, nunca Date.now() da UI — a
// mesma hora real do NexusDecision congelado, nunca a hora em que o
// Operador clicou "Baixar").
import type { PublicationFormat } from "./types";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export interface PublicationTimestampSlug {
  datePart: string; // YYYY-MM-DD
  timePart: string; // HHmm
}

export function publicationTimestampSlug(generatedAt: number): PublicationTimestampSlug {
  const d = new Date(generatedAt);
  return {
    datePart: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    timePart: `${pad2(d.getHours())}${pad2(d.getMinutes())}`,
  };
}

function cleanToken(v: string): string {
  return v.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

// Ex.: AR10_BTCUSDT_1H_2026-08-04_1032_ANALISE.png
export function buildPublicationFilename(
  symbol: string,
  timeframe: string,
  generatedAt: number,
  format: PublicationFormat,
): string {
  const { datePart, timePart } = publicationTimestampSlug(generatedAt);
  return `AR10_${cleanToken(symbol)}_${cleanToken(timeframe)}_${datePart}_${timePart}_${format}.png`;
}
