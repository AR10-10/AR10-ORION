// types.ts — contrato comum que todo provedor GMIL implementa. Ver
// providers/*.ts para os conectores reais e README.md deste diretório para
// a lista de fontes avaliadas e por que cada uma foi aceita ou adiada.

// ATTENTION (V11.5 Fase 4): sinal de atenção de mercado (o que está sendo
// mais buscado agora), categoria distinta de SENTIMENT — "o que o mercado
// está olhando" não é o mesmo dado que "como o mercado se sente".
export type ProviderCategory = 'BLOCKCHAIN' | 'SENTIMENT' | 'ATTENTION';

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
