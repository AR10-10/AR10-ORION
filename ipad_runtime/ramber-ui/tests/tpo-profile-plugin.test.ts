// tpo-profile-plugin.test.ts — Falha #3 (AR10_AUDITORIA_ECOSSISTEMA.md /
// AR10_ORDEM_POS_AUDITORIA.md): TpoProfilePlugin era 1 dos 2 únicos plugins
// de 15 sem teste de padrão no código-fonte. Mesmo padrão dos outros 13
// (volume-profile-plugin.test.ts / zigzag-engine.test.ts): ambiente node,
// sem canvas real — a verificação visual real é feita via Playwright antes
// do commit. Não testa o motor puro (já coberto por tpo-profile.test.ts) —
// só a fiação: import, montagem, CHART_LAYER_IDS, visibility gate, Fio de
// Seda, fail-closed.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('TpoProfilePlugin: Fio de Seda + geometria real + dirty-flag (mesmas leis dos outros plugins)', () => {
  const src = () => read('../src/chart/TpoProfilePlugin.tsx');

  it('nunca chama setLineDash — POC e Initial Balance são linhas sólidas', () => {
    expect(src()).not.toMatch(/\.setLineDash\(/);
  });

  it('POC e Initial Balance são lineWidth = 1 (fio de seda), nunca maior', () => {
    const s = src();
    expect(s).toContain('ctx.lineWidth = 1');
    expect(s).not.toMatch(/ctx\.lineWidth = [2-9]/);
  });

  it('resolve preço→pixel via series.priceToCoordinate real da lib (nunca pixel fabricado)', () => {
    expect(src()).toContain('series.priceToCoordinate(');
  });

  it('linha fora da área visível nunca é desenhada (Fail-Closed, nunca extrapola)', () => {
    expect(src()).toMatch(/if \(yLow === null \|\| yHigh === null\) continue;/);
  });

  it('sem perfil real (DADOS_INSUFICIENTES) => nada desenhado; zero Math.random', () => {
    const s = src();
    expect(s).toContain('if (!result) return;');
    expect(s).not.toMatch(/Math\.random/);
  });

  it('Initial Balance só desenhado quando os 2 primeiros períodos já fecharam de verdade (nunca um IB parcial apresentado como final)', () => {
    expect(src()).toContain('if (result.initialBalanceComplete) {');
  });

  it('dirty-flag + requestAnimationFrame + ResizeObserver + desmontagem limpa (mesma disciplina)', () => {
    const s = src();
    expect(s).toContain('requestAnimationFrame(');
    expect(s).toMatch(/if \(rafScheduled\) return;/);
    expect(s).toContain('subscribeVisibleLogicalRangeChange(');
    expect(s).toContain('unsubscribeVisibleLogicalRangeChange(');
    expect(s).toContain('new ResizeObserver(');
    expect(s).toContain('resizeObserver.disconnect()');
  });

  it('computa o perfil real via computeTpoProfile a partir da prop `data` (mesma série já threadada a SessionKeyLevelsPlugin/KillZoneBandsPlugin) — zero fetch próprio', () => {
    const s = src();
    expect(s).toContain('computeTpoProfile(dataRef.current)');
    expect(s).not.toMatch(/fetch\(/);
  });

  it('cache por identidade de referência: só recomputa quando `data` de fato muda (mesmo padrão de SessionKeyLevelsPlugin)', () => {
    expect(src()).toContain('if (cacheRef.current.data === dataRef.current)');
  });

  it('Lapidação de matiz: linhas TPO em azul-neutro e POC em âmbar — deliberadamente distintos do cyan/magenta do Volume Profile (os dois perfis podem estar ligados ao mesmo tempo); Initial Balance reusa a dupla estrutural de Session Key Levels', () => {
    const s = src();
    expect(s).toContain('const ROW_FILL = "rgba(138, 180, 248, 0.10)";');
    expect(s).toContain('const ROW_FILL_VALUE_AREA = "rgba(138, 180, 248, 0.24)";');
    expect(s).toContain('const POC_LINE = "rgba(240, 193, 111, 0.85)";');
    expect(s).toContain('const IB_HIGH = "rgba(242, 54, 69, 0.5)";');
    expect(s).toContain('const IB_LOW = "rgba(8, 153, 129, 0.5)";');
    expect(s).not.toContain('const POC_LINE = "rgba(236, 81, 205');
  });
});

describe('EnhancedChart: TpoProfilePlugin montado (CHART_LAYER_IDS + visibilidade padrão + wiring real)', () => {
  const chart = () => read('../src/chart/EnhancedChart_110_Percent.tsx');

  it('CHART_LAYER_IDS + visibilidade padrão + plugin de canvas montado condicionalmente (mesmo padrão de ZigZag/VolumeProfile)', () => {
    const s = chart();
    expect(s).toContain('"tpo_profile",');
    expect(s).toContain('tpo_profile: true,');
    expect(s).toContain('import { TpoProfilePlugin } from "./TpoProfilePlugin";');
    expect(s).toContain('visibility.tpo_profile && (');
  });

  it('montado com chart/série reais e a MESMA `data` já usada pelos outros overlays (nunca null fabricado por padrão, zero segunda fonte)', () => {
    const s = chart();
    expect(s).toMatch(/TpoProfilePlugin[\s\S]{0,120}chart=\{chartReady\?\.chart \?\? null\}/);
    const start = s.indexOf('<TpoProfilePlugin');
    const block = s.slice(start, start + 200);
    expect(block).toContain('series={chartReady?.series ?? null}');
    expect(block).toContain('data={data}');
  });
});
