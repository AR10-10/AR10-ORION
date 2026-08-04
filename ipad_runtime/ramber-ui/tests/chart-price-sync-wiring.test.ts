// chart-price-sync-wiring.test.ts — Ordem "Unificação da Inteligência
// Operacional" §4 (Sincronicidade): trava o fechamento de um gap real de
// timing entre TopBar e o preço do gráfico. Convenção mista do repositório
// (CLAUDE.md): isto é fiação entre módulos (App.tsx), não matemática pura —
// o bug mais provável é "alguém reintroduz o hop indireto", não "a conta
// está errada" — então teste de PADRÃO no código-fonte.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const app = readFileSync(join(__dirname, '../src/App.tsx'), 'utf8');

describe('ChartWidget: livePrice sincronizado com a TopBar, zero hop indireto pela store', () => {
  it('recebe priceData como prop no call site — mesma variável de estado que TopBar já usa', () => {
    expect(app).toContain('<TopBar data={priceData} />');
    expect(app).toContain(
      '<ChartWidget chartData={chartData} onRequestOlderCandles={handleRequestOlderCandles} priceData={priceData} />',
    );
  });

  it('a assinatura de ChartWidget destructura priceData', () => {
    expect(app).toContain('function ChartWidget({ chartData, onRequestOlderCandles, priceData }: any) {');
  });

  it('livePrice deriva de priceData por valor (useMemo), nunca mais de usePriceSnapshot() — o espelho Zustand que causava o atraso de 1 commit de render', () => {
    const start = app.indexOf('function ChartWidget({');
    const end = app.indexOf('\nfunction ', start + 1);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = app.slice(start, end);

    expect(body).toContain('const livePrice = useMemo(() => ({ price: priceData?.price ?? null }), [priceData?.price]);');
    // Regressão específica: nenhuma chamada a usePriceSnapshot() dentro do
    // corpo de ChartWidget (outros call sites do hook em App.tsx — TopBar
    // sync button, etc. — continuam intocados, fora deste corpo).
    expect(body).not.toContain('usePriceSnapshot()');
  });

  it('useMemo é KEYED por priceData?.price (o número), nunca pela referência do objeto priceData inteiro — senão recomputaria a cada tick de delta/volume sem o preço ter mudado', () => {
    expect(app).toContain('[priceData?.price]');
  });
});
