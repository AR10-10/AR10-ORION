// publication/generate.ts — Ordem "AR10 PUBLICATION STUDIO" §1/§6: o
// orquestrador. UMA fotografia (PublicationSnapshot) já congelada entra;
// cada formato lê exclusivamente esse mesmo objeto — nenhuma função aqui
// consulta motor/decision/candle de novo (§6: "proibido cada formato
// consultar novamente os motores e produzir uma leitura diferente").
// Fail-closed por peça (§5): canPublishFormat decide ANTES de desenhar —
// um formato que não pode ser gerado nunca aparece na lista de saída
// (nunca um asset vazio/quebrado disfarçado de real).
import { buildPublicationFilename } from "./filenames";
import { renderAnalysis, renderPremium, renderStory, renderX } from "./formats";
import { canPublishFormat, PUBLICATION_FORMAT_ORDER, PUBLICATION_FORMAT_SPECS } from "./types";
import type { PublicationAsset, PublicationFormat, PublicationSnapshot } from "./types";

const RENDERERS: Record<PublicationFormat, (ctx: CanvasRenderingContext2D, snapshot: PublicationSnapshot) => void> = {
  ANALYSIS: renderAnalysis,
  STORY: renderStory,
  X: renderX,
  PREMIUM: renderPremium,
};

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

async function renderOneFormat(format: PublicationFormat, snapshot: PublicationSnapshot): Promise<PublicationAsset | null> {
  const spec = PUBLICATION_FORMAT_SPECS[format];
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  RENDERERS[format](ctx, snapshot);
  const blob = await canvasToBlob(canvas);
  if (!blob) return null;
  return {
    format,
    filename: buildPublicationFilename(snapshot.analysis.symbol, snapshot.analysis.timeframe, snapshot.analysis.generatedAt, format),
    blob,
    objectUrl: URL.createObjectURL(blob),
  };
}

// §7: gera as peças PUBLICÁVEIS (bloqueadas por canPublishFormat ficam de
// fora da lista, nunca um placeholder quebrado no resultado) na mesma
// ordem sempre (PUBLICATION_FORMAT_ORDER) — resultado determinístico.
export async function renderPublicationAssets(snapshot: PublicationSnapshot): Promise<PublicationAsset[]> {
  const formats = PUBLICATION_FORMAT_ORDER.filter((f) => canPublishFormat(f, snapshot));
  const assets = await Promise.all(formats.map((f) => renderOneFormat(f, snapshot)));
  return assets.filter((a): a is PublicationAsset => a !== null);
}

export function revokePublicationAssets(assets: PublicationAsset[]): void {
  assets.forEach((a) => URL.revokeObjectURL(a.objectUrl));
}
