// publication/formats.ts — Ordem "AR10 PUBLICATION STUDIO" §2 + Evolução
// Final §10/§11: os 4 formatos publicáveis. Cada render* função é pura
// composição sobre o MESMO PublicationSnapshot (zero segunda leitura de
// motor, §1/§10/§16) — todas leem literalmente os mesmos
// analysis.plan/bias/confluence/risk/narrative. Hierarquia (§4 original,
// §8 Evolução Final): candles + Entry/Stop/Target são os ÚNICOS elementos
// de mercado desenhados no mini-gráfico — nenhum overlay de contexto
// (VWAP/EMA/sessões/sweeps/BOS-CHOCH/zonas/Fibonacci/S-R) entra na
// composição publicável, a forma mais literal de garantir que nada tenha
// o mesmo peso visual do plano (ver cabeçalho de mini-chart.ts).
import type { MarketAnalysis, MarketAnalysisTarget } from "../nexus/market-analysis";
import { PUBLIC_BIAS_LABEL } from "../nexus/market-analysis";
import {
  MONO_FONT,
  PUB_COLORS,
  drawChip,
  drawRoundedRect,
  drawSilkLine,
  drawText,
  fmtPrice,
  paintBackground,
  truncateToWidth,
  wrapTextLines,
} from "./canvas-primitives";
import { drawMiniChart, type MiniChartPlan } from "./mini-chart";
import { publicationTimestampSlug } from "./filenames";
import { PUBLICATION_FORMAT_SPECS, type PublicationSnapshot } from "./types";

function toMiniChartPlan(analysis: MarketAnalysis, livePrice: number | null): MiniChartPlan {
  return {
    entryLow: analysis.plan?.entryLow ?? null,
    entryHigh: analysis.plan?.entryHigh ?? null,
    stopPrice: analysis.plan?.invalidationPrice ?? null,
    targets: analysis.plan?.targets.map((t: MarketAnalysisTarget) => ({ price: t.price, index: t.index, reached: t.reached })) ?? [],
    livePrice,
  };
}

function biasColor(bias: MarketAnalysis["bias"]): string {
  if (bias === "LONG_BIAS") return PUB_COLORS.long;
  if (bias === "SHORT_BIAS") return PUB_COLORS.short;
  if (bias === "CONFLICTED_BIAS") return PUB_COLORS.neutral;
  return PUB_COLORS.textMuted;
}

function biasArrow(bias: MarketAnalysis["bias"]): string {
  if (bias === "LONG_BIAS") return "▲";
  if (bias === "SHORT_BIAS") return "▼";
  if (bias === "CONFLICTED_BIAS") return "⚠";
  return "◆";
}

function generatedAtLabel(generatedAt: number): string {
  const { datePart, timePart } = publicationTimestampSlug(generatedAt);
  return `${datePart} ${timePart.slice(0, 2)}:${timePart.slice(2)}`;
}

// Evolução Final §11 ("distância até alvo"): MESMA fórmula já usada pelos
// rótulos do eixo do gráfico ao vivo (EnhancedChart_110_Percent.tsx,
// priceAxisLabels — distPct1/2/3) — zero segunda fórmula. Fail-closed: sem
// preço vivo real, nenhum sufixo (nunca uma distância fabricada a partir
// de um preço ausente).
function targetDistanceLabel(price: number, livePrice: number | null): string {
  if (livePrice === null || !Number.isFinite(livePrice) || livePrice <= 0) return "";
  return ` · ${((Math.abs(price - livePrice) * 100) / livePrice).toFixed(2)}%`;
}

function targetLineText(t: MarketAnalysisTarget, livePrice: number | null, checkmark: boolean): string {
  const rr = t.riskReward !== null ? ` · 1:${t.riskReward.toFixed(1)}` : "";
  const dist = targetDistanceLabel(t.price, livePrice);
  const reached = checkmark && t.reached ? " ✓" : "";
  return `${fmtPrice(t.price)}${rr}${dist}${reached}`;
}

function drawBrandFooter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  generatedAt: number,
  fontSize: number,
): void {
  drawText(ctx, `Gerado em ${generatedAtLabel(generatedAt)} · fotografia congelada`, x, y, {
    font: `500 ${fontSize}px ${MONO_FONT}`,
    color: PUB_COLORS.textFaint,
  });
  drawText(ctx, "AR10 CYBORG · confluência real, não é recomendação de investimento", x + w, y, {
    font: `700 ${fontSize}px ${MONO_FONT}`,
    color: PUB_COLORS.cyan,
    align: "right",
  });
}

// ── A — MARKET TERMINAL (1920×1080) ─────────────────────────────────────
export function renderAnalysis(ctx: CanvasRenderingContext2D, snapshot: PublicationSnapshot): void {
  const { width, height } = PUBLICATION_FORMAT_SPECS.ANALYSIS;
  const { analysis, candles, livePrice } = snapshot;
  paintBackground(ctx, width, height);
  const pad = 56;
  const color = biasColor(analysis.bias);

  drawText(ctx, analysis.symbol, pad, 96, { font: `800 48px ${MONO_FONT}`, color: PUB_COLORS.textPrimary });
  ctx.font = `800 48px ${MONO_FONT}`;
  let cursorX = pad + ctx.measureText(analysis.symbol).width + 24;
  const tfChip = drawChip(ctx, cursorX, 56, analysis.timeframe.toUpperCase(), PUB_COLORS.textMuted, 18);
  cursorX += tfChip.width + 12;
  drawChip(ctx, cursorX, 56, PUBLIC_BIAS_LABEL[analysis.bias], color, 18);

  if (typeof livePrice === "number" && Number.isFinite(livePrice)) {
    drawText(ctx, fmtPrice(livePrice), width - pad, 96, { font: `800 48px ${MONO_FONT}`, color, align: "right" });
  }
  drawSilkLine(ctx, pad, 138, width - pad, 138, PUB_COLORS.border, 1);

  // Evolução Final §11 ("leitura consolidada"): a MESMA sentença real do
  // painel "LEITURA CONSOLIDADA" (App.tsx), nunca uma segunda redação —
  // truncada em no máximo 2 linhas medidas de verdade (wrapTextLines),
  // nunca um chute de caracteres por linha.
  if (analysis.narrative) {
    const narrativeFont = `500 20px ${MONO_FONT}`;
    const narrativeLines = wrapTextLines(ctx, analysis.narrative, narrativeFont, width - pad * 2, 2);
    narrativeLines.forEach((line, i) => {
      drawText(ctx, line, pad, 172 + i * 26, { font: narrativeFont, color: PUB_COLORS.textMuted });
    });
  }

  // Altura do gráfico reduzida (era 552) para abrir espaço real à
  // narrativa acima, SEM mover nenhum elemento abaixo — a borda inferior
  // do gráfico permanece exatamente em 736, mesma posição de sempre.
  const chartRect = { x: pad, y: 222, width: width - pad * 2, height: 514 };
  drawMiniChart(ctx, chartRect, candles, toMiniChartPlan(analysis, livePrice), 16);
  drawSilkLine(ctx, pad, 736, width - pad, 736, PUB_COLORS.border, 1);

  const colW = (width - pad * 2) / 4;
  const colY = 764;
  // Evolução Final §11 (distância até alvo): ALVOS ganhou mais texto por
  // linha (R:R + distância) — achado real da verificação visual: a 30px o
  // texto do 3º alvo estourava a coluna e truncava exatamente onde a
  // distância aparece. fontSize agora é por-coluna (default 30, ALVOS usa
  // 22) em vez de travado — a mesma truncateToWidth continua como rede de
  // segurança final, nunca depende só do tamanho escolhido a olho.
  const drawCol = (i: number, label: string, lines: { text: string; color?: string }[], fontSize = 30) => {
    const x = pad + i * colW;
    drawText(ctx, label, x, colY, { font: `700 17px ${MONO_FONT}`, color: PUB_COLORS.textMuted, letterSpacing: 1.5 });
    lines.forEach((l, li) => {
      const font = `700 ${fontSize}px ${MONO_FONT}`;
      drawText(ctx, truncateToWidth(ctx, l.text, font, colW - 24), x, colY + 46 + li * 40, {
        font,
        color: l.color ?? PUB_COLORS.textPrimary,
      });
    });
  };

  drawCol(
    0,
    "CENÁRIO",
    [analysis.structureLabel ? { text: analysis.structureLabel } : null, analysis.regimeLabel ? { text: analysis.regimeLabel } : null].filter(
      (v): v is { text: string } => v !== null,
    ),
  );
  if (analysis.plan) {
    drawCol(1, "ENTRY", [{ text: `${fmtPrice(analysis.plan.entryLow)}–${fmtPrice(analysis.plan.entryHigh)}`, color: PUB_COLORS.cyan }]);
    drawCol(2, "STOP", [{ text: fmtPrice(analysis.plan.invalidationPrice), color: PUB_COLORS.short }]);
    drawCol(
      3,
      "ALVOS",
      analysis.plan.targets.map((t) => ({
        text: `TP${t.index + 1} ${targetLineText(t, livePrice, true)}`,
        color: PUB_COLORS.long,
      })),
      22,
    );
  } else if (analysis.planGapLabel) {
    drawCol(1, "PLANO", [{ text: truncateToWidth(ctx, analysis.planGapLabel, `700 26px ${MONO_FONT}`, colW * 2 - 24), color: PUB_COLORS.textMuted }]);
  }

  const secondaryY = 940;
  const secondaryParts = [
    `CONFLUÊNCIA: ${analysis.confluence}`,
    analysis.risk ? `RISCO: ${analysis.risk.state}` : null,
    analysis.retest ? `RETESTE: ${fmtPrice(analysis.retest.low)}–${fmtPrice(analysis.retest.high)}` : null,
    analysis.plan ? `INVALIDAÇÃO ABAIXO/ACIMA DE ${fmtPrice(analysis.plan.invalidationPrice)}` : null,
  ].filter((v): v is string => v !== null);
  drawText(ctx, secondaryParts.join("   ·   "), pad, secondaryY, { font: `600 19px ${MONO_FONT}`, color: PUB_COLORS.textMuted });

  drawSilkLine(ctx, pad, height - 56, width - pad, height - 56, PUB_COLORS.border, 1);
  drawBrandFooter(ctx, pad, height - 28, width - pad * 2, analysis.generatedAt, 15);
}

// ── B — INSTAGRAM STORY (1080×1920) ─────────────────────────────────────
export function renderStory(ctx: CanvasRenderingContext2D, snapshot: PublicationSnapshot): void {
  const { width, height } = PUBLICATION_FORMAT_SPECS.STORY;
  const { analysis, candles, livePrice } = snapshot;
  paintBackground(ctx, width, height);
  const pad = 64;
  const color = biasColor(analysis.bias);
  let y = 96;

  // 1. Ativo + timeframe
  drawText(ctx, analysis.symbol, pad, y, { font: `800 44px ${MONO_FONT}`, color: PUB_COLORS.textPrimary });
  drawText(ctx, analysis.timeframe.toUpperCase(), width - pad, y, { font: `700 30px ${MONO_FONT}`, color: PUB_COLORS.textMuted, align: "right" });
  y += 56;
  if (typeof livePrice === "number" && Number.isFinite(livePrice)) {
    drawText(ctx, fmtPrice(livePrice), pad, y, { font: `600 26px ${MONO_FONT}`, color: PUB_COLORS.textMuted });
    y += 44;
  }

  // 2. Direção/cenário
  y += 36;
  drawText(ctx, `${biasArrow(analysis.bias)} ${PUBLIC_BIAS_LABEL[analysis.bias]}`, width / 2, y, {
    font: `800 76px ${MONO_FONT}`,
    color,
    align: "center",
  });
  y += 44;
  const contextLine = [analysis.structureLabel, analysis.regimeLabel].filter(Boolean).join("  ·  ");
  if (contextLine) {
    drawText(ctx, truncateToWidth(ctx, contextLine, `600 24px ${MONO_FONT}`, width - pad * 2), width / 2, y, {
      font: `600 24px ${MONO_FONT}`,
      color: PUB_COLORS.textMuted,
      align: "center",
    });
  }
  y += 56;

  // 3. Gráfico — protagonista (§4): recebe o espaço que sobrar antes do
  // bloco de plano, nunca uma altura mínima que deixaria a marca AR10
  // flutuando sobre um vão vazio quando há menos alvos/sem reteste.
  const chartHeight = 700;
  drawMiniChart(ctx, { x: pad, y, width: width - pad * 2, height: chartHeight }, candles, toMiniChartPlan(analysis, livePrice), 18);
  y += chartHeight + 56;

  const rowH = 78;
  const drawPlanRow = (label: string, value: string, valueColor: string) => {
    drawRoundedRect(ctx, pad, y, width - pad * 2, rowH - 14, 10, "rgba(255,255,255,0.03)", PUB_COLORS.border);
    drawText(ctx, label, pad + 28, y + rowH / 2 - 3, { font: `700 22px ${MONO_FONT}`, color: PUB_COLORS.textMuted, baseline: "middle" });
    drawText(ctx, value, width - pad - 28, y + rowH / 2 - 3, { font: `800 32px ${MONO_FONT}`, color: valueColor, align: "right", baseline: "middle" });
    y += rowH;
  };

  if (analysis.plan) {
    // 4. Entry
    drawPlanRow("ENTRY", `${fmtPrice(analysis.plan.entryLow)}–${fmtPrice(analysis.plan.entryHigh)}`, PUB_COLORS.cyan);
    // 5. Targets (+ distância até alvo, §11)
    analysis.plan.targets.forEach((t) => {
      drawPlanRow(`ALVO ${t.index + 1}`, targetLineText(t, livePrice, false), PUB_COLORS.long);
    });
    // 6. Reteste (§11 — reintroduzido; omitido quando não há cenário real)
    if (analysis.retest) {
      drawPlanRow("RETESTE", `${fmtPrice(analysis.retest.low)}–${fmtPrice(analysis.retest.high)}`, PUB_COLORS.neutral);
    }
    // 7. Stop / invalidação
    drawPlanRow("STOP / INVALIDAÇÃO", fmtPrice(analysis.plan.invalidationPrice), PUB_COLORS.short);
  } else if (analysis.planGapLabel) {
    drawPlanRow("PLANO", analysis.planGapLabel, PUB_COLORS.textMuted);
  }
  y += 20;

  // 8. Leitura consolidada
  const readingParts = [`Confluência ${analysis.confluence}`, analysis.risk ? `Risco ${analysis.risk.state}` : null].filter(
    (v): v is string => v !== null,
  );
  drawText(ctx, readingParts.join("  ·  "), width / 2, y, { font: `600 24px ${MONO_FONT}`, color: PUB_COLORS.textMuted, align: "center" });
  y += 72;

  // 9. Identidade AR10 — segue o CONTEÚDO real (nunca um offset fixo do
  // fundo do canvas): achado real da 1a verificação visual — com menos
  // alvos a marca ficava presa lá embaixo, sobrando um vão vazio grande
  // no meio do card. y aqui já reflete exatamente quantas linhas de plano
  // existiram de verdade.
  drawSilkLine(ctx, pad, y, width - pad, y, PUB_COLORS.border, 1);
  y += 48;
  drawText(ctx, "AR10 CYBORG", width / 2, y, { font: `800 30px ${MONO_FONT}`, color: PUB_COLORS.cyan, align: "center", letterSpacing: 3 });
  y += 32;
  drawText(ctx, "confluência real, não é recomendação de investimento", width / 2, y, {
    font: `500 18px ${MONO_FONT}`,
    color: PUB_COLORS.textFaint,
    align: "center",
  });
}

// ── C — X (1200×675) ────────────────────────────────────────────────────
export function renderX(ctx: CanvasRenderingContext2D, snapshot: PublicationSnapshot): void {
  const { width, height } = PUBLICATION_FORMAT_SPECS.X;
  const { analysis, candles, livePrice } = snapshot;
  paintBackground(ctx, width, height);
  const pad = 40;
  const color = biasColor(analysis.bias);

  const chartW = width * 0.6 - pad * 1.5;
  const chartRect = { x: pad, y: 96, width: chartW, height: height - 96 - 40 };
  drawText(ctx, analysis.symbol, pad, 56, { font: `800 30px ${MONO_FONT}`, color: PUB_COLORS.textPrimary });
  ctx.font = `800 30px ${MONO_FONT}`;
  const symW = ctx.measureText(analysis.symbol).width;
  drawChip(ctx, pad + symW + 14, 30, analysis.timeframe.toUpperCase(), PUB_COLORS.textMuted, 14);
  drawMiniChart(ctx, chartRect, candles, toMiniChartPlan(analysis, livePrice), 12);

  const colX = pad + chartW + 32;
  const colW = width - colX - pad;
  let y = 56;
  drawText(ctx, `${biasArrow(analysis.bias)} ${PUBLIC_BIAS_LABEL[analysis.bias]}`, colX, y, { font: `800 32px ${MONO_FONT}`, color });
  if (typeof livePrice === "number" && Number.isFinite(livePrice)) {
    drawText(ctx, fmtPrice(livePrice), colX, y + 34, { font: `600 20px ${MONO_FONT}`, color: PUB_COLORS.textMuted });
  }
  y += 78;

  const drawRow = (label: string, value: string, valueColor: string) => {
    drawText(ctx, label, colX, y, { font: `700 14px ${MONO_FONT}`, color: PUB_COLORS.textMuted });
    drawText(ctx, truncateToWidth(ctx, value, `800 22px ${MONO_FONT}`, colW), colX, y + 26, { font: `800 22px ${MONO_FONT}`, color: valueColor });
    y += 56;
  };

  if (analysis.plan) {
    drawRow("ENTRY", `${fmtPrice(analysis.plan.entryLow)}–${fmtPrice(analysis.plan.entryHigh)}`, PUB_COLORS.cyan);
    // Achado real da 1a verificação visual (Entrega 38): 3 alvos numa única
    // linha ("TP1 · TP2 · TP3") transbordava a coluna e truncava pra "T…" —
    // cada alvo é a SUA PRÓPRIA linha, nunca cortado. Distância até alvo
    // (§11) reusa a mesma targetLineText do formato Story.
    analysis.plan.targets.forEach((t) => {
      drawRow(`ALVO ${t.index + 1}`, targetLineText(t, livePrice, false), PUB_COLORS.long);
    });
    if (analysis.retest) {
      drawRow("RETESTE", `${fmtPrice(analysis.retest.low)}–${fmtPrice(analysis.retest.high)}`, PUB_COLORS.neutral);
    }
    drawRow("STOP / INVALIDAÇÃO", fmtPrice(analysis.plan.invalidationPrice), PUB_COLORS.short);
  } else if (analysis.planGapLabel) {
    drawRow("PLANO", analysis.planGapLabel, PUB_COLORS.textMuted);
  }

  const contextParts = [`Confluência ${analysis.confluence}`, analysis.risk ? `Risco ${analysis.risk.state}` : null].filter(
    (v): v is string => v !== null,
  );
  drawText(ctx, contextParts.join("  ·  "), colX, y, { font: `600 15px ${MONO_FONT}`, color: PUB_COLORS.textMuted });
  y += 40;

  // AR10 segue o conteúdo real da coluna (mesmo achado do gap vazio do
  // Story) — nunca um offset fixo do fundo do canvas.
  drawSilkLine(ctx, colX, y, width - pad, y, PUB_COLORS.border, 1);
  y += 28;
  drawText(ctx, "AR10 CYBORG", colX, y, { font: `800 16px ${MONO_FONT}`, color: PUB_COLORS.cyan, letterSpacing: 2 });
}

// ── D — PREMIUM (1080×1080, sem gráfico por especificação) ──────────────
// Evolução Final §10-D ("versão visual mais sofisticada"): evolução real do
// antigo Card Executivo — antes só ENTRY + 1º alvo + STOP; agora TODOS os
// alvos reais (com R:R + distância), RETESTE quando existe, CONFLUÊNCIA e
// RISCO como campos próprios, organizados numa grade real de 2 colunas
// (referência visual estudada: grade de campos do Painel D) em vez de uma
// pilha de linhas. Decisão consciente de NÃO adotar o rating de estrelas
// da referência para "confiança": implicaria uma probabilidade calibrada
// ao leitor leigo — contradiria a Regra de Ouro 2 (confiança/confluência
// nunca é probabilidade). "Invalidação" também não vira um campo à parte:
// é o MESMO preço já mostrado em STOP (o único preço de invalidação real
// do plano) — um campo próprio duplicaria informação (§15: "nenhuma
// informação duplicada").
export function renderPremium(ctx: CanvasRenderingContext2D, snapshot: PublicationSnapshot): void {
  const { width, height } = PUBLICATION_FORMAT_SPECS.PREMIUM;
  const { analysis, livePrice } = snapshot;
  paintBackground(ctx, width, height);
  const pad = 72;
  const color = biasColor(analysis.bias);
  let y = 128;

  drawText(ctx, analysis.symbol, width / 2, y, { font: `800 40px ${MONO_FONT}`, color: PUB_COLORS.textPrimary, align: "center" });
  y += 42;
  drawText(ctx, analysis.timeframe.toUpperCase(), width / 2, y, { font: `700 22px ${MONO_FONT}`, color: PUB_COLORS.textMuted, align: "center" });
  y += 72;

  drawText(ctx, `${biasArrow(analysis.bias)} ${PUBLIC_BIAS_LABEL[analysis.bias]}`, width / 2, y, {
    font: `800 56px ${MONO_FONT}`,
    color,
    align: "center",
  });
  y += 38;
  const contextLine = [analysis.structureLabel, analysis.regimeLabel].filter(Boolean).join("  ·  ");
  if (contextLine) {
    drawText(ctx, truncateToWidth(ctx, contextLine, `600 19px ${MONO_FONT}`, width - pad * 2), width / 2, y, {
      font: `600 19px ${MONO_FONT}`,
      color: PUB_COLORS.textMuted,
      align: "center",
    });
  }
  y += 46;
  if (typeof livePrice === "number" && Number.isFinite(livePrice)) {
    drawText(ctx, fmtPrice(livePrice), width / 2, y, { font: `600 22px ${MONO_FONT}`, color: PUB_COLORS.textMuted, align: "center" });
    y += 40;
  }
  y += 20;

  // Campos reais, só os que existem (fail-closed) — layout mecânico em
  // grade de 2 colunas (índice par → esquerda, ímpar → direita), nunca um
  // pareamento manual frágil de campos específicos.
  type Field = { label: string; value: string; color: string };
  const fields: Field[] = [];
  if (analysis.plan) {
    fields.push({ label: "ENTRY", value: `${fmtPrice(analysis.plan.entryLow)}–${fmtPrice(analysis.plan.entryHigh)}`, color: PUB_COLORS.cyan });
    fields.push({ label: "STOP", value: fmtPrice(analysis.plan.invalidationPrice), color: PUB_COLORS.short });
    analysis.plan.targets.forEach((t) => {
      fields.push({ label: `ALVO ${t.index + 1}`, value: targetLineText(t, livePrice, false), color: PUB_COLORS.long });
    });
  } else if (analysis.planGapLabel) {
    fields.push({ label: "PLANO", value: analysis.planGapLabel, color: PUB_COLORS.textMuted });
  }
  if (analysis.retest) {
    fields.push({ label: "RETESTE", value: `${fmtPrice(analysis.retest.low)}–${fmtPrice(analysis.retest.high)}`, color: PUB_COLORS.neutral });
  }
  fields.push({ label: "CONFLUÊNCIA", value: analysis.confluence, color: PUB_COLORS.textPrimary });
  if (analysis.risk) {
    fields.push({ label: "RISCO", value: analysis.risk.state, color: PUB_COLORS.textPrimary });
  }

  const gridW = width - pad * 2;
  const colGap = 16;
  const cellW = (gridW - colGap) / 2;
  const cellH = 92;
  const rowGap = 14;
  fields.forEach((f, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = pad + col * (cellW + colGap);
    const cellY = y + row * (cellH + rowGap);
    drawRoundedRect(ctx, x, cellY, cellW, cellH, 10, "rgba(255,255,255,0.03)", PUB_COLORS.border);
    drawText(ctx, f.label, x + 20, cellY + 30, { font: `700 16px ${MONO_FONT}`, color: PUB_COLORS.textMuted, letterSpacing: 1 });
    drawText(ctx, truncateToWidth(ctx, f.value, `800 24px ${MONO_FONT}`, cellW - 40), x + 20, cellY + 64, {
      font: `800 24px ${MONO_FONT}`,
      color: f.color,
    });
  });
  const rows = Math.ceil(fields.length / 2);
  y += rows * (cellH + rowGap) + 12;

  // AR10 segue o conteúdo real (mesmo achado do gap vazio do Story/X) —
  // nunca um offset fixo do fundo do canvas.
  drawSilkLine(ctx, pad, y, width - pad, y, PUB_COLORS.border, 1);
  y += 40;
  drawText(ctx, "AR10 CYBORG", width / 2, y, { font: `800 24px ${MONO_FONT}`, color: PUB_COLORS.cyan, align: "center", letterSpacing: 2 });
}
