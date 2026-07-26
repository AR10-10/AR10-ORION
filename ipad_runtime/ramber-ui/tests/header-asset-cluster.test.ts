// header-asset-cluster.test.ts — achado real de captura de tela do
// Operador: a fileira de botões-atalho de ativo (ASSETS.map) no cluster
// de identidade do header era 100% redundante com o gatilho do
// SmartOmnibox bem ao lado — os dois disparam a MESMA transição de
// estado, mas o Omnibox já busca qualquer par real da Binance, não só os
// 12 fixos. Com a lista expandida (rodada anterior, 5→12), a fileira
// "comia" o espaço do header e cortava/escondia o preço/variação ao vivo
// em telas reais (evidência: captura de tela mostrando "+1.4" cortado).
// Removida por inteiro — zero capacidade perdida (o Omnibox cobre o
// mesmo caminho real, com mais alcance).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const app = () => readFileSync(resolve(here, '../src/App.tsx'), 'utf8');

describe('Header: cluster de identidade do ativo — sem fileira de botões redundante com o Omnibox', () => {
  it('o cluster (badge do ativo atual + SmartOmnibox) não contém mais a fileira ASSETS.map de botões de atalho', () => {
    const s = app();
    const startIdx = s.indexOf('pr-2 md:pr-3 border-r border-[#00f0ff20] h-[70%] shrink-0');
    expect(startIdx, 'cluster de identidade do ativo não encontrado').toBeGreaterThan(-1);
    const endIdx = s.indexOf('<SmartOmnibox', startIdx);
    expect(endIdx, 'SmartOmnibox não encontrado logo após o badge').toBeGreaterThan(startIdx);
    const cluster = s.slice(startIdx, endIdx);
    expect(cluster).not.toContain('ASSETS.map');
    expect(cluster).not.toContain('hidden lg:flex items-center gap-1');
  });

  it('o badge do ativo ATUAL (ícone ₿/primeira letra) continua real e intacto no canto', () => {
    const s = app();
    expect(s).toContain('selectedAsset === "BTC"\n                    ? "₿"\n                    : selectedAsset?.[0]}');
  });

  it('SmartOmnibox continua sendo o único caminho real de troca de ativo no header — mesma transição de estado que os botões removidos faziam', () => {
    const s = app();
    const idx = s.indexOf('<SmartOmnibox');
    const block = s.slice(idx, s.indexOf('/>', s.indexOf('onSelectTradFi', idx)));
    expect(block).toContain('selectedLabel={marketMode === "TRADFI" ? (selectedTradFiAsset?.symbol ?? "Buscar ativo") : `${selectedAsset}USDT`}');
    expect(block).toContain('setMarketMode?.("CRYPTO");');
    expect(block).toContain('setSelectedTradFiAsset?.(null);');
    expect(block).toContain('setSelectedAsset?.(baseAsset);');
  });

  it('ASSETS continua real e em uso (AssetHeatmapWidget) — nunca apagado, só realocado para onde ainda faz sentido (Regra de Ouro 4)', () => {
    const s = app();
    expect(s).toContain('const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "DOT", "TON", "TRX"] as const;');
    const heatmapIdx = s.indexOf('function AssetHeatmapWidget()');
    expect(heatmapIdx).toBeGreaterThan(-1);
    const heatmapBlock = s.slice(heatmapIdx, s.indexOf('\n}', heatmapIdx));
    expect(heatmapBlock).toContain('ASSETS.map((a) => {');
  });

  it('nenhuma outra ocorrência de código real ASSETS.map( sobrevive além do AssetHeatmapWidget (a fileira do header foi mesmo removida, não duplicada em outro lugar; a única outra menção no arquivo é prosa dentro de um comentário explicativo, não código)', () => {
    const s = app();
    // ASSETS.map( com parêntese de abertura logo em seguida = uso real de
    // código (callback); "ASSETS.map)" (parêntese de FECHAMENTO) é só a
    // própria prosa do comentário que documenta esta remoção — distinção
    // real, não uma coincidência de contagem.
    const codeOccurrences = s.match(/ASSETS\.map\(\(/g) ?? [];
    expect(codeOccurrences.length).toBe(1);
  });
});
