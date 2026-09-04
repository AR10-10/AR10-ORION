// macd-wiring.test.ts — Diretriz Final de Integração Total: fiação real da
// graduação do MACD (nexus/macd.ts, construído e testado na rodada
// anterior, EPC OMEGA FINAL, mas isolado). A matemática pura já tem
// execução real em macd.test.ts — aqui trancam-se os pontos de conexão
// reais (mesma convenção mista de sempre: fiação entre módulos ganha
// teste de padrão no código-fonte).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: currentMacd computado UMA vez sobre a MESMA chartData já real, mesmo padrão exato de currentRsi', () => {
  it('importa o motor puro real', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { computeMacdSeries, latestMacd } from "./nexus/macd";');
  });

  it('useMemo real sobre chartData, mesma dependência de currentRsi — zero segunda série de candles', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('const currentMacd = useMemo(');
    expect(idx).toBeGreaterThan(-1);
    const block = app.slice(idx, idx + 400);
    expect(block).toContain('computeMacdSeries(chartData.map(');
    expect(block).toContain('latestMacd(series)');
    expect(block).toContain('}, [chartData]);');
  });

  it('TDZ real: currentMacd declarado logo após currentRsi, ambos antes de contextValue', () => {
    const app = read('../src/App.tsx');
    const rsiIdx = app.indexOf('const currentRsi = useMemo(');
    const macdIdx = app.indexOf('const currentMacd = useMemo(');
    const contextIdx = app.indexOf('const contextValue = useMemo(');
    expect(rsiIdx).toBeGreaterThan(-1);
    expect(rsiIdx).toBeLessThan(macdIdx);
    expect(macdIdx).toBeLessThan(contextIdx);
  });

  it('contextValue expõe currentMacd (objeto e deps), sempre junto de currentRsi', () => {
    const app = read('../src/App.tsx');
    const memoMatch = app.match(/const contextValue = useMemo\(\s*\(\) => \(\{([\s\S]*?)\}\),/);
    expect(memoMatch).not.toBeNull();
    expect(memoMatch![1]).toContain('currentRsi,\n      currentMacd,');
    const depsMatch = app.match(/const contextValue = useMemo\([\s\S]*?\[([\s\S]*?)\],\s*\);/);
    expect(depsMatch).not.toBeNull();
    expect(depsMatch![1]).toContain('currentRsi,\n      currentMacd,');
  });

  it('WidgetContext destructuring inclui currentMacd', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const { engine, cvd, currentRsi, currentMacd, chartTimeframe, orderflowTrend } = useContext(WidgetContext) || {};');
  });
});

describe('MarketRegimeWidget: MACD vira Row real ao lado de RSI/ATR%, nunca um novo plugin de canvas (baixo risco de poluição visual)', () => {
  it('Row "MACD (12,26,9)" presente, mesma paleta direcional teal/rosa já usada em toda a UI', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('<Row label="MACD (12,26,9)" value={macdLabel} valueClass={macdColor} />');
    const idx = app.indexOf('const macdLabel = num(currentMacd?.histogram)');
    expect(idx).toBeGreaterThan(-1);
    const block = app.slice(idx, idx + 400);
    expect(block).toContain('"text-[#00ffaa]"'); // histograma > 0 = comprador
    expect(block).toContain('"text-[#ff0055]"'); // histograma < 0 = vendedor
    expect(block).toContain('"text-[#8ab4f8]"'); // sem leitura real = neutro
  });

  it('AWAIT honesto quando ainda não há histórico real — nunca um valor fabricado', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('const macdLabel = num(currentMacd?.histogram)');
    expect(app.slice(idx, idx + 120)).toContain('? currentMacd.histogram.toFixed(1) : AWAIT');
  });
});
