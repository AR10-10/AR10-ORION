// smc-harmonic-fusion-wiring.test.ts — trava permanente da FIAÇÃO entre
// smc-harmonic-fusion.ts (lógica pura, já coberta por execução real em
// smc-harmonic-fusion.test.ts) e o gráfico real. Teste de PADRÃO NO
// CÓDIGO-FONTE (mesmo espírito de ws-live-feed-futures-migration.test.ts):
// o risco aqui não é "a matemática está sutilmente errada" (isso já tem
// suíte própria) — é "esqueceram de conectar A com B", ou pior, "o
// gráfico continua desenhando o padrão SEM confluência real", que é
// exatamente a Regra de Ouro que o Operador pediu.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');
const app = () => read('../src/App.tsx');
const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

describe('App.tsx: SMC Harmonic Fusion é calculada a partir dos 4 motores reais já em paralelo, nunca um motor novo', () => {
  it('evaluateSmcHarmonicFusion recebe chartHarmonics/smcZones/POC/chartCandlePatterns reais — zero placeholder', () => {
    const a = app();
    expect(a).toContain('import { evaluateSmcHarmonicFusion, type SmcHarmonicFusionResult } from "./nexus/smc-harmonic-fusion";');
    expect(a).toContain('harmonicHits: chartHarmonics ?? [],');
    expect(a).toContain('orderBlocks: smcZones?.orderBlocks ?? [],');
    expect(a).toContain('fairValueGaps: smcZones?.fairValueGaps ?? [],');
    expect(a).toContain('liquidityZones: smcZones?.liquidityZones ?? [],');
    expect(a).toContain('pocPrice: volumeProfileSnapshot?.fixedRange?.pocPrice ?? null,');
    expect(a).toContain('candlePatterns: chartCandlePatterns ?? [],');
  });

  it('chartHarmonicsConfirmed filtra por r.confirmed (preserva ordem por fitScore) — nunca reordena nem refaz a detecção geométrica', () => {
    const a = app();
    expect(a).toContain('const chartHarmonicsConfirmed = useMemo(\n    () => harmonicFusionResults.filter((r) => r.confirmed).map((r) => r.hit),');
  });

  it('bestConfirmedHarmonicFusion é o primeiro confirmado (melhor fit entre os confirmados), tipado, nunca `any`', () => {
    const a = app();
    expect(a).toContain('const bestConfirmedHarmonicFusion: SmcHarmonicFusionResult | null = harmonicFusionResults.find((r) => r.confirmed) ?? null;');
  });

  it('o painel/relevância que lê chartHarmonics CRU continua intacto (Regra de Ouro 4: nunca esconder dado real) — só o gráfico recebe a lista filtrada', () => {
    const a = app();
    // harmonicBestFitScore (relevanceInput) e o painel ANALYSIS continuam
    // lendo a fatia crua da store, não a filtrada por confluência.
    expect(a).toContain('harmonicBestFitScore: chartHarmonics && chartHarmonics.length > 0 ? chartHarmonics[0].fitScore : null,');
  });
});

describe('EnhancedChart_110_Percent.tsx: seta de confluência só desenha quando App.tsx já confirmou', () => {
  it('importa e monta HarmonicConfluenceArrowPlugin, gateado por visibility.harmonics (mesmo toggle do zigzag/PRZ, nenhuma camada nova no painel)', () => {
    const c = chart();
    expect(c).toContain('import { HarmonicConfluenceArrowPlugin } from "./HarmonicConfluenceArrowPlugin";');
    expect(c).toContain('{visibility.harmonics && (\n        <HarmonicConfluenceArrowPlugin');
    expect(c).toContain('fusion={harmonicConfluence ?? null}');
  });

  it('a prop harmonicConfluence é tipada como SmcHarmonicFusionResult | null, nunca any', () => {
    const c = chart();
    expect(c).toContain('harmonicConfluence?: SmcHarmonicFusionResult | null;');
  });
});

describe('HarmonicConfluenceArrowPlugin.tsx: fail-closed real e mesma arquitetura de overlay já estabelecida', () => {
  it('nunca desenha sem fusion.confirmed === true — a checagem está no código-fonte, não só na intenção do comentário', () => {
    const p = read('../src/chart/HarmonicConfluenceArrowPlugin.tsx');
    expect(p).toContain('if (!f || !f.confirmed) return;');
  });

  it('usa o mesmo z-index da família harmonics (nunca uma camada nova no orçamento visual/registro)', () => {
    const p = read('../src/chart/HarmonicConfluenceArrowPlugin.tsx');
    expect(p).toContain('getChartLayerZIndex("harmonics")');
  });

  it('usa a paleta canônica (chartPaletteRgba) e drawCanvasLabel — nunca uma cor/rótulo redigitado de memória', () => {
    const p = read('../src/chart/HarmonicConfluenceArrowPlugin.tsx');
    expect(p).toContain('import { drawCanvasLabel } from "../nexus/canvas-label";');
    expect(p).toContain('import { chartPaletteRgba } from "./canvas-palette";');
    expect(p).not.toMatch(/rgba\(\d/); // nenhuma cor hardcoded — só via chartPaletteRgba
  });

  it('mesma arquitetura de canvas próprio (dirty-flag + rAF, ResizeObserver) dos outros plugins de evento', () => {
    const p = read('../src/chart/HarmonicConfluenceArrowPlugin.tsx');
    expect(p).toContain('requestAnimationFrame(() => {');
    expect(p).toContain('new ResizeObserver(markDirty)');
    expect(p).toContain('subscribeVisibleLogicalRangeChange(markDirty)');
  });
});
