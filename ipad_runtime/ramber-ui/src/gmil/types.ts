// types.ts — contrato comum que todo provedor GMIL implementa. Ver
// providers/*.ts para os conectores reais e README.md deste diretório para
// a lista de fontes avaliadas e por que cada uma foi aceita ou adiada.

// ATTENTION (V11.5 Fase 4): sinal de atenção de mercado (o que está sendo
// mais buscado agora), categoria distinta de SENTIMENT — "o que o mercado
// está olhando" não é o mesmo dado que "como o mercado se sente".
//
// Fase E (V15 Cap. 3/6, GMIL Expandido) — taxonomia completa da
// Constituição, mesmo para categorias ainda sem provedor ativo:
//   DERIVATIVES — feed combinado Spot×Perpetual (funding, basis, OI).
//                 1 provedor real ativo (derivatives-provider.ts).
//   ONCHAIN     — fluxos institucionais on-chain (Whale Alert, reservas,
//                 grandes movimentações). SEM provedor ativo: toda fonte
//                 prescrita exige chave de API (proibido permanentemente
//                 neste projeto — ver README.md "Fontes avaliadas"). O
//                 gancho existe: um provedor futuro é 1 arquivo + 1 linha
//                 de registro, e o viés desta categoria já viaja como
//                 null honesto no agregador.
//   MACRO       — DXY, Treasuries, calendário econômico. SEM provedor
//                 ativo: nenhuma fonte keyless/CORS-aberta verificada
//                 (mesma avaliação documentada no README). Mesmo gancho
//                 honesto: viés null até existir fonte real.
export type ProviderCategory =
  | 'BLOCKCHAIN'
  | 'SENTIMENT'
  | 'ATTENTION'
  | 'DERIVATIVES'
  | 'ONCHAIN'
  | 'MACRO';

export interface ProviderFetchResult {
  ok: boolean;
  reason?: string;
  fetchedAt: number;
  // Campos reais e crus da resposta — nunca um valor inventado; ausência
  // vira `null`, não um número aproximado.
  fields: Record<string, number | string | null>;
  // -1..1, normalização documentada no comentário de cada função de fetch.
  // null quando o campo-fonte do lean não veio na resposta.
  lean: number | null;
}

export interface GmilProviderDef {
  id: string;
  label: string;
  category: ProviderCategory;
  intervalMs: number;
  fetch: () => Promise<ProviderFetchResult>;
}
