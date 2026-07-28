// candles-cache.ts — Achado real de auditoria (DIRETRIZES AVANÇADAS,
// auditoria de ecossistema/duplicação/gargalos): `candles` era o único
// campo acumulador de unified-snapshot-store.ts sem teto de memória — ao
// contrário de l2History (L2_HISTORY_CAPACITY, l2-history.ts)/
// orderflowHistory (ORDERFLOW_HISTORY_CAPACITY, orderflow-history.ts)/
// institutionalScoreHistory (CONVICTION_HISTORY_CAPACITY,
// institutional-score.ts)/trackRecord.history, cada símbolo já
// selecionado pelo Operador (via SmartOmnibox, não só os curados) ganhava
// uma entrada própria em `candles`, nunca removida. Crescimento mais
// lento que o do Market Data Bus (pautado por troca manual de ativo, não
// por ciclo de rede), mas real ao longo de uma sessão longa — Local-First,
// PWA pensada para ficar aberta.
//
// Teto = tamanho real do universo curado (ASSETS, App.tsx) — grande o
// bastante pra nunca despejar um símbolo do dia-a-dia sob uso normal,
// pequeno o bastante pra travar o crescimento de buscas avulsas via
// SmartOmnibox fora da lista curada. Convenção declarada (mesmo espírito
// do piso R:R 1:2 de rr-quality.ts), não medição.
export const CANDLES_SYMBOL_CAPACITY = 12;

/** LRU real por ORDEM DE INSERÇÃO do objeto (mesma técnica de um Map):
 *  remover a chave do símbolo tocado e reinseri-la sempre a devolve pro
 *  fim da ordem de enumeração — então o candidato a despejo é sempre
 *  `Object.keys(...)[0]`, o único símbolo que não foi tocado há mais
 *  tempo. Pura: recebe o mapa atual + o símbolo/entrada tocados agora,
 *  devolve o PRÓXIMO mapa completo — mesmo formato de retorno de
 *  pushOrderflowHistory/maybeSampleL2History, nunca uma mutação in-place. */
export function touchCandlesSymbol<T>(
  bySymbol: Record<string, T>,
  symbol: string,
  entry: T,
  capacity: number = CANDLES_SYMBOL_CAPACITY,
): Record<string, T> {
  const { [symbol]: _dropped, ...rest } = bySymbol;
  const next: Record<string, T> = { ...rest, [symbol]: entry };
  const keys = Object.keys(next);
  if (keys.length > capacity) {
    delete next[keys[0]];
  }
  return next;
}
