// zone-member-codes.ts — forma CURTA do nome de cada ferramenta que compõe
// uma Zona Institucional.
//
// DEFEITO RELATADO (Operador, duas mensagens diferentes sobre a mesma
// coisa): "nome Grandão, um monte de letra... mais padrão, mais
// profissional" e, sobre a tela atual, "o tamanho das etiquetas".
//
// MEDIÇÃO NAS CAPTURAS REAIS:
//
//   ZEC/USDT 15m   "VWAP + FVG Baixa ×2 + Sweep ×2 + Nexus Line"   43 car.
//   WLFI/USDT 15m  "EMA21 + Sweep + VWAP + POC + Sessão Alta"      40 car.
//
// A etiqueta atravessava as velas na horizontal — a mesma reclamação que já
// tinha eliminado o prefixo "Kill Zone · " (session-codes.ts) e a palavra
// "ASCENDING" do Trend Channel (TREND_DIRECTION_GLYPH). Este arquivo é a
// terceira aplicação do MESMO princípio, não uma ideia nova.
//
// REGRA DE OURO 4 — NADA É APAGADO. A contagem de fontes não muda, nenhum
// membro some da lista, nenhum "+3 outros" esconde ferramenta. Cada nome é
// substituído por um código mais curto que diz exatamente a mesma coisa:
// mesma quantidade de itens, mesma ordem, mesma agregação "×N". É
// tipografia, nunca poda.
//
// VOCABULÁRIO: as setas ↑/↓ já são o vocabulário direcional do gráfico
// inteiro (FVG↑/OB↓ no LiquidityZonesPlugin, ↑/↓/• em LINE_STATE_GLYPH,
// ↑/↓/→ em TREND_DIRECTION_GLYPH) — reusadas aqui, nunca uma convenção
// nova para o Operador aprender.

/** Mapa exato dos rótulos fixos produzidos por institutional-zones.ts.
 *  EMA é o único com sufixo variável (o período real) e é tratado à parte
 *  abaixo — nunca por adivinhação de prefixo em cima deste mapa. */
const CODIGOS: Record<string, string> = {
  VWAP: "VWAP", // já é a forma curta padrão do mercado
  "Nexus Line": "NL",
  S1: "S1",
  R1: "R1",
  "FVG Alta": "FVG↑",
  "FVG Baixa": "FVG↓",
  "OB Alta": "OB↑",
  "OB Baixa": "OB↓",
  EQH: "EQH",
  EQL: "EQL",
  POC: "POC",
  "Sessão Alta": "SES↑",
  "Sessão Baixa": "SES↓",
  Sweep: "SWP",
  "Swing H": "SW↑",
  "Swing L": "SW↓",
};

/**
 * Código curto de um membro de zona.
 *
 * Fail-closed (Regra de Ouro 3): rótulo desconhecido volta INTEIRO, nunca
 * um corte cego no meio da palavra. Um motor novo que produza um label
 * ainda não mapeado aparece por extenso — longo, porém correto — em vez de
 * virar uma sigla inventada que o Operador não sabe ler.
 */
export function zoneMemberCode(label: string): string {
  const exato = CODIGOS[label];
  if (exato !== undefined) return exato;
  // EMA carrega o período real no nome ("EMA21", "EMA200") — a informação
  // ESTÁ no número, então ele nunca é removido; o nome já é curto.
  if (/^EMA\d+$/.test(label)) return label;
  return label;
}

/**
 * Linha secundária da etiqueta de Zona Institucional: as ferramentas reais
 * que caem neste preço, agregadas por nome.
 *
 * @param labels rótulos dos membros, na ordem real em que o motor os
 *   produziu (nunca reordenados aqui — a ordem é a do motor).
 */
export function formatZoneMemberList(labels: string[]): string {
  // Agrega repetidos com contagem real ("SWP×2") em vez de repetir o nome —
  // comportamento que já existia inline no gráfico, preservado palavra por
  // palavra; só o nome de cada item encurtou. Sem espaço antes do ×: é a
  // mesma forma compacta que "FVG↑" usa no LiquidityZonesPlugin.
  const contagem = new Map<string, number>();
  for (const l of labels) {
    const c = zoneMemberCode(l);
    contagem.set(c, (contagem.get(c) ?? 0) + 1);
  }
  return [...contagem.entries()].map(([c, n]) => (n > 1 ? `${c}×${n}` : c)).join(" + ");
}
