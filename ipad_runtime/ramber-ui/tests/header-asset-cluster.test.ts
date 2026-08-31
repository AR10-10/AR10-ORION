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

  it('a fileira de atalhos VOLTOU, mas NUNCA dentro da linha do preço — o defeito que causou a remoção não pode voltar', () => {
    // HISTÓRICO, para o próximo que ler isto: a fileira foi removida a
    // pedido do Operador porque, dentro da linha 1 (h-[46px]), os 12 botões
    // "comiam" o espaço e CORTAVAM o preço/variação ao vivo em telas reais.
    // Depois o Operador relatou a falta dela no iPad e pediu de volta.
    //
    // O contrato que este teste guarda mudou junto, e ficou MAIS forte: não
    // é mais "a fileira não pode existir" (isso era o remédio), é "a fileira
    // não pode dividir espaço com o preço" (isso era a doença).
    const s = app();

    // Ela existe de novo — 2 usos reais: o heatmap e a fileira do header.
    const codeOccurrences = s.match(/ASSETS\.map\(\(/g) ?? [];
    expect(codeOccurrences.length).toBe(2);

    // E vive FORA da linha do preço: a linha 1 da TopBar (h-[46px]) tem de
    // fechar ANTES de a fileira começar. Se alguém a mover pra dentro dela
    // outra vez, este índice inverte e o teste quebra.
    const topBarIdx = s.indexOf('function TopBar(');
    expect(topBarIdx).toBeGreaterThan(-1);
    const linhaDoPreco = s.indexOf('h-[46px] flex items-center justify-between', topBarIdx);
    const fileira = s.indexOf('aria-label="Atalhos de ativo"', topBarIdx);
    expect(linhaDoPreco).toBeGreaterThan(-1);
    expect(fileira).toBeGreaterThan(linhaDoPreco);

    // E rola em vez de espremer: sem overflow interno, um iPad estreito
    // voltaria a comprimir os vizinhos — que é literalmente o defeito antigo.
    const blocoFileira = s.slice(fileira - 400, fileira + 1400);
    expect(blocoFileira).toContain('overflow-x-auto');
    expect(blocoFileira).toContain('shrink-0');
  });
});
