// publication/types.ts — Ordem "AR10 PUBLICATION STUDIO" §1/§2/§10: contrato
// da camada de EXPORTAÇÃO/COMPOSIÇÃO, nunca uma nova inteligência. O dado de
// mercado real (bias/plan/confluência/risco) já vive inteiro em
// MarketAnalysis (nexus/market-analysis.ts, Entrega 37) — este módulo só
// ACRESCENTA o que a leitura de mercado não carrega (candles reais para o
// mini-gráfico, preço vivo para o preço exibido) e nunca deriva um segundo
// Entry/Stop/Target/viés a partir deles.
import type { MarketAnalysis } from "../nexus/market-analysis";

// Mesmo shape estrutural de chartData em App.tsx (zero segundo tipo de
// candle) — campos extras (ex.: volume) continuam compatíveis por
// tipagem estrutural.
export interface PublicationCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// §1: "snapshot congelado" — analysis (a mesma fotografia do painel/X/Story
// da Entrega 37) + candles reais (a MESMA série que já alimenta o gráfico
// ao vivo, nunca uma segunda busca) + o preço vivo no instante da geração.
// Montado UMA vez; os 4 formatos leem exclusivamente este objeto.
export interface PublicationSnapshot {
  analysis: MarketAnalysis;
  candles: PublicationCandle[];
  livePrice: number | null;
}

export type PublicationFormat = "ANALYSIS" | "STORY" | "X" | "PREMIUM";

export interface PublicationFormatSpec {
  width: number;
  height: number;
  label: string;
  // §2: só A/B/C exigem "gráfico principal" no conteúdo; D (Card
  // Executivo) é deliberadamente números-only.
  needsChart: boolean;
}

// Dimensões reais de export por plataforma (não só a razão de aspecto):
// 16:9 Full HD (Análise), 9:16 nativo de Stories, 16:9 tamanho grande
// recomendado de imagem do X, 1:1 quadrado de feed. Nenhuma copiada de uma
// identidade visual de terceiros — só a resolução de pixel, que é
// especificação de plataforma, não estilo.
export const PUBLICATION_FORMAT_SPECS: Record<PublicationFormat, PublicationFormatSpec> = {
  ANALYSIS: { width: 1920, height: 1080, label: "Market Terminal", needsChart: true },
  STORY: { width: 1080, height: 1920, label: "Story", needsChart: true },
  X: { width: 1200, height: 675, label: "X", needsChart: true },
  PREMIUM: { width: 1080, height: 1080, label: "Premium", needsChart: false },
};

export const PUBLICATION_FORMAT_ORDER: PublicationFormat[] = ["ANALYSIS", "STORY", "X", "PREMIUM"];

// §2-A: "prioridade máxima para o gráfico" — mas um punhado de candles não
// forma uma leitura visual real. Abaixo disso, a peça que EXIGE gráfico é
// bloqueada (§5: "impedir a publicação daquela peça") em vez de desenhar
// um gráfico ilegível/vazio disfarçado de real.
export const MIN_CHART_CANDLES = 20;

// §2-A: candles recentes mostrados no mini-gráfico — legibilidade nos
// tamanhos de export (até 1920px), não a série inteira do terminal.
export const RECENT_CANDLES_FOR_EXPORT = 60;

export interface PublicationAsset {
  format: PublicationFormat;
  filename: string;
  blob: Blob;
  // Object URL (URL.createObjectURL) — muito mais barato que uma data URL
  // base64 pra pré-visualização; quem consome (a UI) é responsável por
  // URL.revokeObjectURL quando a sessão de publicação fecha/regenera.
  objectUrl: string;
}

// §5: fail-closed por peça — cada formato só é gerado quando o que ELE
// declara precisar (needsChart) está realmente disponível.
export function canPublishFormat(format: PublicationFormat, snapshot: PublicationSnapshot): boolean {
  const spec = PUBLICATION_FORMAT_SPECS[format];
  if (!spec.needsChart) return true;
  return snapshot.candles.length >= MIN_CHART_CANDLES;
}
