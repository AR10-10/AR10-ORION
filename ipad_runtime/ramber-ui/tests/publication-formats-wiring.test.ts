// publication-formats-wiring.test.ts — Ordem "AR10 PUBLICATION STUDIO"
// §1/§4/§6/§10: travas de padrão-de-fonte (fiação/composição, não
// matemática) — nenhum dos 4 formatos consulta motor de novo, nenhum
// desenha overlay de contexto do terminal (a hierarquia do §4 é garantida
// pela AUSÊNCIA estrutural desses overlays, não por uma dimensão de peso
// visual), e as dimensões de export batem com a especificação real de
// plataforma.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('formats.ts: as 4 render* funções são PURA composição — zero segunda consulta a motor/decision', () => {
  const src = read('../src/publication/formats.ts');

  it('assinatura de cada render* é (ctx, snapshot) — nunca um parâmetro extra que poderia carregar leitura independente', () => {
    expect(src).toContain('export function renderAnalise(ctx: CanvasRenderingContext2D, snapshot: PublicationSnapshot): void {');
    expect(src).toContain('export function renderStory(ctx: CanvasRenderingContext2D, snapshot: PublicationSnapshot): void {');
    expect(src).toContain('export function renderX(ctx: CanvasRenderingContext2D, snapshot: PublicationSnapshot): void {');
    expect(src).toContain('export function renderCard(ctx: CanvasRenderingContext2D, snapshot: PublicationSnapshot): void {');
  });

  it('nunca importa buildMarketAnalysis/buildNexusDecision/engine-bridge — só o TIPO MarketAnalysis e a tradução pública já existente PUBLIC_BIAS_LABEL', () => {
    expect(src).not.toContain('buildMarketAnalysis');
    expect(src).not.toContain('buildNexusDecision');
    expect(src).not.toContain('engine-bridge');
    expect(src).toContain('import { PUBLIC_BIAS_LABEL } from "../nexus/market-analysis";');
  });

  it('nunca busca rede (fetch/XMLHttpRequest/axios) — composição pura sobre dado já em memória', () => {
    expect(src).not.toContain('fetch(');
    expect(src).not.toContain('XMLHttpRequest');
    expect(src).not.toContain('axios');
  });

  it('cada formato lê analysis.plan/bias/confluence/risk direto do snapshot — nunca uma variável local recalculando entry/stop/target', () => {
    // toMiniChartPlan é o ÚNICO adaptador (mapeia analysis.plan -> formato
    // esperado pelo mini-gráfico) — nunca uma segunda fórmula de preço.
    expect(src).toContain('entryLow: analysis.plan?.entryLow ?? null,');
    expect(src).toContain('stopPrice: analysis.plan?.invalidationPrice ?? null,');
    expect(src).not.toMatch(/entryLow\s*=\s*analysis\.plan\.entryLow\s*[+\-*/]/);
    expect(src).not.toMatch(/invalidationPrice\s*[+\-*/]/);
  });
});

// Remove comentários antes de varrer por overlays proibidos — o próprio
// cabeçalho de mini-chart.ts NOMEIA VWAP/EMA/sessão/sweep/BOS-CHOCH/
// Fibonacci ao EXPLICAR por que eles ficam de fora (documentação honesta
// da decisão), o que faria uma varredura ingênua do texto inteiro do
// arquivo achar um falso positivo dentro da própria explicação. O teste
// real é sobre CÓDIGO executável, nunca sobre a prosa que descreve o
// código.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

describe('Hierarquia (§4): nenhum overlay de contexto do terminal é desenhado na composição publicável', () => {
  const chartSrc = stripComments(read('../src/publication/mini-chart.ts'));
  const formatsSrc = stripComments(read('../src/publication/formats.ts'));
  const combined = `${chartSrc}\n${formatsSrc}`;

  it('candles + Entry/Stop/Target são os ÚNICOS elementos de mercado desenhados — nenhuma referência a VWAP/EMA/sessão/sweep/BOS-CHOCH/Fibonacci/zona institucional', () => {
    const forbidden = [
      /vwap/i,
      /\bema\b/i,
      /session/i,
      /sweep/i,
      /bos.?choch/i,
      /fibonacci/i,
      /institutional.?zone/i,
      /liquidity.?zone/i,
      /trendChannel/i,
    ];
    for (const pattern of forbidden) {
      expect(combined).not.toMatch(pattern);
    }
  });
});

describe('types.ts: dimensões reais de export por plataforma (não estilo copiado — especificação de pixel)', () => {
  const src = read('../src/publication/types.ts');

  it('ANALISE 16:9 Full HD, STORY 9:16 nativo de Stories, X 16:9 compacto, CARD 1:1', () => {
    expect(src).toContain('ANALISE: { width: 1920, height: 1080, label: "Análise Completa", needsChart: true },');
    expect(src).toContain('STORY: { width: 1080, height: 1920, label: "Story", needsChart: true },');
    expect(src).toContain('X: { width: 1200, height: 675, label: "X", needsChart: true },');
    expect(src).toContain('CARD: { width: 1080, height: 1080, label: "Card Executivo", needsChart: false },');
  });

  it('CARD é o único sem gráfico (§2-D não lista "gráfico" no conteúdo) — os outros 3 exigem', () => {
    const specMatch = src.match(/PUBLICATION_FORMAT_SPECS[\s\S]*?=\s*\{([\s\S]*?)\};/);
    expect(specMatch, 'PUBLICATION_FORMAT_SPECS não encontrado').not.toBeNull();
    const body = specMatch![1];
    const needsChartTrueCount = (body.match(/needsChart: true/g) ?? []).length;
    const needsChartFalseCount = (body.match(/needsChart: false/g) ?? []).length;
    expect(needsChartTrueCount).toBe(3);
    expect(needsChartFalseCount).toBe(1);
  });
});

describe('generate.ts: gate ANTES de desenhar (§5) — um formato bloqueado nunca chega a alocar canvas', () => {
  const src = read('../src/publication/generate.ts');

  it('renderPublicationAssets filtra por canPublishFormat antes de qualquer render', () => {
    const idx = src.indexOf('export async function renderPublicationAssets');
    expect(idx).toBeGreaterThan(-1);
    const body = src.slice(idx, idx + 400);
    expect(body).toContain('PUBLICATION_FORMAT_ORDER.filter((f) => canPublishFormat(f, snapshot));');
  });

  it('cada asset carrega o nome de arquivo real (buildPublicationFilename), nunca um nome genérico fixo', () => {
    expect(src).toContain('filename: buildPublicationFilename(snapshot.analysis.symbol, snapshot.analysis.timeframe, snapshot.analysis.generatedAt, format),');
  });

  it('revokePublicationAssets existe — nenhum object URL fica vazando memória entre gerações', () => {
    expect(src).toContain('export function revokePublicationAssets(assets: PublicationAsset[]): void {');
    expect(src).toContain('URL.revokeObjectURL(a.objectUrl)');
  });
});
