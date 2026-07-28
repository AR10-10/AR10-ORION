// radar-universe.ts — OMEGA CORE V-MAX Fase 7 (completar o Radar/OIH):
// universo de ativos do scanner v1 — decisão do Operador (AskUserQuestion,
// rodada anterior): a lista curada já real de
// configs/asset-universe.default.json, não uma descoberta ao vivo de
// "todos os pares suportados pela MEXC" (infraestrutura nova, não
// pesquisada, explicitamente adiada).
//
// Achado real de auditoria (antes de ligar o scanner): o arquivo tem 4
// grupos, mas só 3 são CRYPTO — o 4º (`mining_ai_hpc_equities`) lista
// tickers de AÇÕES (MARA, RIOT, CLSK...) sem par de futuros na Binance/
// MEXC. Alimentar esses símbolos no Market Data Bus como se fossem cripto
// falharia toda vez (sem `-PERP` real correspondente) — filtrado aqui,
// nunca escondido silenciosamente no scanner. BTC e DOGE aparecem em mais
// de um grupo real (crypto_top_liquidity e pow_mining_crypto) —
// deduplicado por símbolo, nunca escaneado duas vezes.
export interface AssetUniverseSymbolEntry {
  symbol: string;
  group: string;
  asset_class: string;
  status: string;
}

export interface AssetUniverseGroup {
  group: string;
  label: string;
  asset_class: string;
  symbols: AssetUniverseSymbolEntry[];
}

export interface AssetUniverseFile {
  groups: AssetUniverseGroup[];
}

/** Lista real e deduplicada de símbolos CRYPTO do arquivo de universo —
 *  pura, zero I/O, testável por execução real. */
export function extractRadarUniverseSymbols(universe: AssetUniverseFile): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of universe.groups ?? []) {
    if (group.asset_class !== "CRYPTO") continue;
    for (const entry of group.symbols ?? []) {
      if (entry.asset_class !== "CRYPTO") continue;
      if (seen.has(entry.symbol)) continue;
      seen.add(entry.symbol);
      out.push(entry.symbol);
    }
  }
  return out;
}
