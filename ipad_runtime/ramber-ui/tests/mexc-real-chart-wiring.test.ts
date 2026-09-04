// mexc-real-chart-wiring.test.ts — Ordem "MEXC ASSET DISCOVERY + NATIVE
// MARKET DATA" / "UNIVERSAL ASSET DISCOVERY": trava de padrão no
// código-fonte (fiação App.tsx <-> universal-symbol.ts <-> MexcRealChart,
// "esqueceram de ligar A com B") — mesma convenção mista deste repositório
// usada em tradfi-real-chart-wiring.test.ts/diretriz3-fixes.test.ts.
// Execução real dos motores puros (universal-symbol.ts, getMexcChartCandles)
// já é coberta por universal-symbol.test.ts/engine-bridge-mexc.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('App.tsx: marketMode "MEXC" liga o Omnibox ao gráfico real da MEXC', () => {
  it('importa MexcRealChart e UniversalCryptoSymbol (nunca uma segunda implementação do gráfico/catálogo)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('import { MexcRealChart } from "./omnibox/MexcRealChart";');
    expect(app).toContain('import type { UniversalCryptoSymbol } from "./omnibox/universal-symbol";');
  });

  it('marketMode é uma união de 3 valores (CRYPTO/TRADFI/MEXC) — nunca voltou a ser binária', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('useState<"CRYPTO" | "TRADFI" | "MEXC">(() => restoredSession.marketMode)');
  });

  it('selectedMexcAsset é estado PRÓPRIO (nunca reaproveita selectedAsset/selectedTradFiAsset)', () => {
    const app = read('../src/App.tsx');
    expect(app).toContain('const [selectedMexcAsset, setSelectedMexcAsset] = useState<UniversalCryptoSymbol | null>(null);');
  });

  it('gráfico principal: MexcRealChart quando selectedMexcAsset existe, TradFiEmptyState honesto quando não', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('marketMode === "MEXC" ? (');
    expect(idx, 'branch MEXC do gráfico principal não encontrado').toBeGreaterThan(-1);
    const branch = app.slice(idx, idx + 700);
    expect(branch).toContain('selectedMexcAsset ? (');
    expect(branch).toContain('<MexcRealChart asset={selectedMexcAsset} timeframe={chartTimeframe} />');
    expect(branch).toContain('<TradFiEmptyState assetLabel="MEXC" reason={nonCryptoEmptyStateReason} />');
  });

  it('onSelectCrypto despacha por exchange: MEXC vira marketMode MEXC + selectedMexcAsset, BINANCE continua CRYPTO + selectedAsset — nunca os dois estados MEXC/Binance simultaneamente', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('onSelectCrypto={(selection: UniversalCryptoSymbol) => {');
    expect(idx, 'onSelectCrypto não encontrado com a assinatura esperada').toBeGreaterThan(-1);
    const handler = app.slice(idx, app.indexOf('onSelectTradFi=', idx));
    expect(handler).toContain('if (selection.exchange === "MEXC") {');
    expect(handler).toContain('setMarketMode?.("MEXC");');
    expect(handler).toContain('setSelectedMexcAsset?.(selection);');
    expect(handler).toContain('setMarketMode?.("CRYPTO");');
    expect(handler).toContain('setSelectedMexcAsset?.(null);');
    expect(handler).toContain('setSelectedAsset?.(selection.baseAsset);');
  });

  it('painéis Binance-only (Order Book/Order Flow/Liquidity Map/Council/Siriform/Regime) ficam honestos em modo MEXC — nunca mostram dado do último selectedAsset Binance sob o rótulo errado', () => {
    const app = read('../src/App.tsx');
    // isFullCryptoMode = marketMode === "CRYPTO" é o gate real — MEXC e
    // TRADFI ficam do mesmo lado (nunca "tudo que não é TRADFI é cripto
    // pleno", que vazaria dado Binance estale sob um ativo MEXC).
    expect(app).toContain('const isFullCryptoMode = marketMode === "CRYPTO";');
    expect(app).toContain('{isFullCryptoMode && widgets.council?.visible && <CouncilWidget />}');
    const orderBookIdx = app.indexOf('<OrderBookWidget');
    expect(app.slice(orderBookIdx - 260, orderBookIdx)).toContain('!isFullCryptoMode ? (');
  });

  it('preço do header nunca mostra o feed Binance estale do último selectedAsset quando marketMode é MEXC', () => {
    const app = read('../src/App.tsx');
    const idx = app.indexOf('marketMode === "TRADFI" ? (\n            <div className="flex items-center gap-1.5 pr-2 md:pr-3 border-r border-[#00f0ff20] whitespace-nowrap">');
    expect(idx, 'ternário de preço do header não encontrado').toBeGreaterThan(-1);
    const block = app.slice(idx, idx + 700);
    expect(block).toContain('marketMode === "MEXC" ? (');
    expect(block).toContain('Preço real no gráfico · MEXC');
  });
});

describe('MexcRealChart: minimalista por design — zero import de Core Engine/Council/orderflow (LEI 24 intacta)', () => {
  it('nunca importa nexus-core/council/decision-layer/orderflow — não pode virar uma segunda superfície de LONG/SHORT/WAIT por acidente', () => {
    const chart = read('../src/omnibox/MexcRealChart.tsx');
    const importLines = chart.split('\n').filter((line) => /^import /.test(line));
    for (const line of importLines) {
      expect(line).not.toMatch(/nexus-core|nexus\/council|decision-layer|orderflow/);
    }
    expect(chart).toContain('import { getMexcChartCandles } from "../engine-bridge";');
  });

  it('busca via getMexcChartCandles(asset.baseAsset, ...) — o MESMO caminho já provado por scanRadarCandidate, nunca um fetch paralelo', () => {
    const chart = read('../src/omnibox/MexcRealChart.tsx');
    expect(chart).toContain('getMexcChartCandles(asset.baseAsset, 200, timeframe)');
  });

  it('4 estados honestos exaustivos: LOADING/OK/HISTORICO_INSUFICIENTE/DADOS_INSUFICIENTES — nunca um estado silencioso sem feedback ao Operador', () => {
    const chart = read('../src/omnibox/MexcRealChart.tsx');
    expect(chart).toContain('"LOADING" | "OK" | "HISTORICO_INSUFICIENTE" | "DADOS_INSUFICIENTES"');
    expect(chart).toContain('status === "LOADING"');
    expect(chart).toContain('status === "DADOS_INSUFICIENTES"');
    expect(chart).toContain('status === "HISTORICO_INSUFICIENTE"');
    expect(chart).toContain('status === "OK" && lastCandle');
  });

  it('histórico insuficiente é honesto (Ordem §9/§13) — nunca fabrica candle/estrutura quando a amostra é pequena demais', () => {
    const chart = read('../src/omnibox/MexcRealChart.tsx');
    expect(chart).toContain('candles.length < MIN_CANDLES_FOR_SUFFICIENT_HISTORY ? "HISTORICO_INSUFICIENTE" : "OK"');
  });

  it('badge de proveniência declara MEXC/FUTURES/tempo-real explicitamente — nunca esconde a exchange (Ordem §7/§12)', () => {
    const chart = read('../src/omnibox/MexcRealChart.tsx');
    expect(chart).toContain('MEXC · FUTURES (Tempo Real)');
  });
});
