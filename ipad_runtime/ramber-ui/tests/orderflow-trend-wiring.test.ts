// orderflow-trend-wiring.test.ts — Diretriz Complementar (Nexus Predictive
// Engine) §18: fiação real da tendência de força do fluxo. A matemática
// pura já tem execução real em nexus-orderflow-history.test.ts — aqui
// trancam-se os pontos de conexão (mesma convenção mista de sempre).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: orderflowTrend computado UMA vez sobre a MESMA série já real, compartilhado via contextValue', () => {
  it('importa o motor puro real', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { computeOrderflowTrend } from "./nexus/orderflow-history";');
  });

  it('reaproveita o MESMO hook de histórico já usado pelo heatmap — zero segunda série/fetch', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('useOrderflowHistory');
    expect(app).toContain('const orderflowTrend = useMemo(() => computeOrderflowTrend(orderflowHistoryForTrend), [orderflowHistoryForTrend]);');
  });

  it('TDZ real: orderflowTrend declarada DEPOIS de confidenceZone e ANTES de contextValue', () => {
    const app = read('../src/App.tsx');
    const zoneIdx = app.indexOf('const confidenceZone = useMemo(');
    const trendIdx = app.indexOf('const orderflowTrend = useMemo(');
    const contextIdx = app.indexOf('const contextValue = useMemo(');
    expect(zoneIdx).toBeGreaterThan(-1);
    expect(zoneIdx).toBeLessThan(trendIdx);
    expect(trendIdx).toBeLessThan(contextIdx);
  });

  it('contextValue expõe orderflowTrend (objeto e deps)', () => {
    const app = read('../src/App.tsx');
    const memoMatch = app.match(/const contextValue = useMemo\(\s*\(\) => \(\{([\s\S]*?)\}\),/);
    expect(memoMatch).not.toBeNull();
    expect(memoMatch![1]).toContain('confidenceZone,\n      orderflowTrend,');
    const depsMatch = app.match(/const contextValue = useMemo\([\s\S]*?\[([\s\S]*?)\],\s*\);/);
    expect(depsMatch).not.toBeNull();
    expect(depsMatch![1]).toContain('confidenceZone,\n      orderflowTrend,');
  });
});

describe('MarketRegimeWidget: exibe a tendência real de força do fluxo, honestamente distinta do CVD instantâneo', () => {
  it('destrutura orderflowTrend do WidgetContext', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const { engine, cvd, currentRsi, currentMacd, chartTimeframe, orderflowTrend } = useContext(WidgetContext) || {};');
  });

  it('AWAIT honesto quando o histórico ainda não é real/suficiente — nunca uma tendência fabricada', () => {
    const app = read('../src/App.tsx');
    const m = app.match(/const flowTrendLabel =\s*([\s\S]*?);\n  const flowTrendColor/);
    expect(m, 'flowTrendLabel não encontrado').not.toBeNull();
    expect(m![1]).toContain('orderflowTrend?.status === "OK" && orderflowTrend.trend');
    expect(m![1]).toContain('AWAIT');
  });

  it('a linha "TENDÊNCIA DO FLUXO" é uma pergunta diferente de "MOMENTUM (CVD)" — ambas presentes, nenhuma remove a outra', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('<Row label="MOMENTUM (CVD)" value={momentumLabel} valueClass={momentumColor} />');
    expect(app).toContain('<Row label="TENDÊNCIA DO FLUXO" value={flowTrendLabel} valueClass={flowTrendColor} />');
  });
});

describe('LEI 24 + Regras de Ouro: computeOrderflowTrend é puro e honesto', () => {
  it('zero escrita de volta, zero rede, zero Math.random', () => {
    const src = read('../src/nexus/orderflow-history.ts');
    expect(src).not.toContain('setOrderflowHistory(');
    expect(src).not.toContain('useUnifiedSnapshotStore');
    expect(src).not.toContain('fetch(');
    expect(src).not.toMatch(/Math\.random/);
  });

  it('"probabilidade" só aparece como disclaimer de negação (Regra de Ouro 2), nunca rotulando um valor exibido', () => {
    const src = read('../src/nexus/orderflow-history.ts');
    expect(src.toLowerCase()).not.toContain('probabilidade de acerto');
    expect(src.toLowerCase()).not.toContain('probabilidade real');
  });
});
