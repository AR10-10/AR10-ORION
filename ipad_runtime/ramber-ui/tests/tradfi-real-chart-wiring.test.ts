// tradfi-real-chart-wiring.test.ts — Ordem Market Data Fabric, Fase 1:
// trava de padrão no código-fonte (fiação App.tsx <-> instrument-registry.js
// <-> TradFiRealChart, "esqueceram de ligar A com B") — mesma convenção
// mista deste repositório usada em diretriz3-fixes.test.ts/chart-history-
// pagination.test.ts. Execução real dos motores puros (instrument-registry.js)
// já é coberta por tests/instrument-registry.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: resolvedTradFiInstrument liga selectedTradFiAsset ao Instrument Registry real', () => {
  it('importa findByLegacyTradFiAssetSymbol e TradFiRealChart (nunca uma segunda implementação do catálogo/gráfico)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { findByLegacyTradFiAssetSymbol } from "../../src/market-data-bus/index.js";');
    expect(app).toContain('import { TradFiRealChart } from "./omnibox/TradFiRealChart";');
  });

  it('resolvedTradFiInstrument é um useMemo real com dependência [selectedTradFiAsset] (recalcula só quando o ativo muda, nunca a cada render)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const resolvedTradFiInstrument = useMemo(');
    expect(app).toContain('() => (selectedTradFiAsset ? findByLegacyTradFiAssetSymbol(selectedTradFiAsset.symbol) : null),');
    expect(app).toContain('[selectedTradFiAsset],\n  );');
  });

  it('gráfico principal: TradFiRealChart quando resolvido, TradFiEmptyState honesto quando não — nunca os dois ao mesmo tempo nem nenhum', () => {
    const app = read('../src/App.tsx');
    const mainMatch = app.match(/\{widgets\.chart\.visible &&\s*\n\s*\(marketMode === "TRADFI" \? \(([\s\S]*?)\n {24}\) : \(/);
    expect(mainMatch, 'ternário do gráfico principal não encontrado com a estrutura esperada').not.toBeNull();
    const tradfiBranch = mainMatch![1];
    expect(tradfiBranch).toContain('resolvedTradFiInstrument ? (');
    expect(tradfiBranch).toContain('<TradFiRealChart instrument={resolvedTradFiInstrument} timeframe={chartTimeframe} />');
    expect(tradfiBranch).toContain('<TradFiEmptyState');
  });

  it('todo o resto do modo TRADFI (order book/flow/heatmap/Siriform/Council/Regime/ScoreContexto) continua em TradFiEmptyState — Fase 1 não expande escopo além do gráfico principal', () => {
    const app = read('../src/App.tsx');
    const tradfiEmptyStateCount = (app.match(/<TradFiEmptyState/g) ?? []).length;
    // 1 no branch sem mapeamento do gráfico principal + 9 nos painéis
    // crypto-específicos (Market Intelligence, Siriform, ScoreContextCard
    // [v16.0 PRO Fase 1], ExpectancyCard [Entrega 42, novo], Regime/Comitê,
    // Siriform detalhe, Order Book, Order Flow, Liquidity Map) — mesma
    // contagem de antes, +1 pelo novo card gated (Track Record/expectancy
    // não têm leitura real em TRADFI, mesmo gate que os demais).
    expect(tradfiEmptyStateCount).toBe(10);
  });
});

describe('TradFiRealChart: minimalista por design — zero import de Core Engine/Council (LEI 24 intacta)', () => {
  it('nunca importa nexus-core/council/decision-layer — não pode virar uma segunda superfície de LONG/SHORT/WAIT por acidente', () => {
    const chart = read('../src/omnibox/TradFiRealChart.tsx');
    const importLines = chart.split('\n').filter((line) => /^import /.test(line));
    for (const line of importLines) {
      expect(line).not.toMatch(/nexus-core|nexus\/council|decision-layer/);
    }
    expect(chart).toContain('import { getTradFiChartCandles } from "../engine-bridge";');
  });

  it('busca via getTradFiChartCandles(instrument.instrument_id, ...) — o MESMO caminho que a Ordem ligou ao conector real, nunca um fetch paralelo', () => {
    const chart = read('../src/omnibox/TradFiRealChart.tsx');
    expect(chart).toContain('getTradFiChartCandles(instrument.instrument_id, 200, timeframe)');
  });

  it('3 estados honestos exaustivos: LOADING/OK/DADOS_INSUFICIENTES — nunca um estado silencioso sem feedback ao Operador', () => {
    const chart = read('../src/omnibox/TradFiRealChart.tsx');
    expect(chart).toContain('"LOADING" | "OK" | "DADOS_INSUFICIENTES"');
    expect(chart).toContain('status === "LOADING"');
    expect(chart).toContain('status === "DADOS_INSUFICIENTES"');
    expect(chart).toContain('status === "OK" && lastCandle');
  });

  it('badge de proveniência declara DELAYED explicitamente — nunca finge tempo real (Ordem §3/§13)', () => {
    const chart = read('../src/omnibox/TradFiRealChart.tsx');
    expect(chart).toContain('DELAYED · Yahoo Finance (não-oficial)');
  });
});
