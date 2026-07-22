// persistence.ts — V-MAX Fase 0.3: persistência Local-First real via
// IndexedDB (Blueprint §5.1: "IndexedDB (Dexie/idb): candles, L2,
// snapshot do Núcleo... Offline: ... chart usa cache").
//
// Escopo desta Fase 0, deliberado: candles + um resumo do snapshot
// (símbolo/timeframe ativos, estado de conexão por exchange) são
// persistidos — preferências de widget já têm seu próprio caminho real
// (localStorage, ramber_widget_prefs_v2, App.tsx) e não são duplicadas
// aqui. L2 (livro de ofertas) NÃO é persistido nesta fase: um livro de
// ofertas de horas atrás não é "último estado conhecido útil", é
// ativamente enganoso se reexibido sem um aviso de idade extremo — a
// mesma regra de honestidade (Regra de Ouro 1, zero dado fabricado ou
// enganoso) que já rege todo o resto do sistema. Candles reais antigos
// continuam genuinely úteis para contexto mesmo stale; um book de horas
// atrás não.
//
// Best-effort by design: QUALQUER falha de IndexedDB (quota excedida,
// modo privado do Safari que desliga IndexedDB, navegador antigo) é
// silenciosamente absorvida — Local-First nunca pode ser um novo ponto
// de falha do caminho real de dados (mesmo fail-closed já usado em toda
// chamada de rede deste sistema).
import { openDB, type IDBPDatabase } from "idb";
import type { Candle, Exchange, ExchangeConnectionState, Timeframe } from "./types";

const DB_NAME = "ar10-cyborg-nexus";
const DB_VERSION = 1;
const CANDLES_STORE = "candles";
const SNAPSHOT_STORE = "snapshot";

interface PersistedCandles {
  key: string;
  candles: Candle[];
  savedAt: number;
}

export interface PersistedSnapshotSummary {
  key: "latest";
  activeSymbol: string;
  activeTimeframe: Timeframe;
  connections: Partial<Record<Exchange, ExchangeConnectionState>>;
  savedAt: number;
}

/** Chave real da store de candles — função pura, testável sem IndexedDB. */
export function candleKey(symbol: string, tf: Timeframe): string {
  return `${symbol}:${tf}`;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(CANDLES_STORE)) {
          db.createObjectStore(CANDLES_STORE, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
          db.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveCandles(symbol: string, tf: Timeframe, candles: Candle[]): Promise<void> {
  try {
    const db = await getDb();
    const record: PersistedCandles = { key: candleKey(symbol, tf), candles, savedAt: Date.now() };
    await db.put(CANDLES_STORE, record);
  } catch {
    // best-effort — ver header do arquivo.
  }
}

/** null quando nunca foi salvo antes, OU a leitura falhou — os dois
 *  casos honestos de "sem cache local", nunca distintos artificialmente
 *  (o chamador trata os dois do mesmo jeito: segue esperando o dado
 *  real da rede). */
export async function loadCandles(symbol: string, tf: Timeframe): Promise<Candle[] | null> {
  try {
    const db = await getDb();
    const record = (await db.get(CANDLES_STORE, candleKey(symbol, tf))) as PersistedCandles | undefined;
    return record?.candles ?? null;
  } catch {
    return null;
  }
}

export async function saveSnapshotSummary(
  summary: Omit<PersistedSnapshotSummary, "key" | "savedAt">,
): Promise<void> {
  try {
    const db = await getDb();
    const record: PersistedSnapshotSummary = { key: "latest", ...summary, savedAt: Date.now() };
    await db.put(SNAPSHOT_STORE, record);
  } catch {
    // best-effort — ver header do arquivo.
  }
}

// Autonomy order: the signal track record survives reloads — accumulating
// accuracy over sessions is the whole point of measuring it. Same
// best-effort/fail-closed discipline as everything else in this file; the
// caller re-validates the shape (rehydrateTrackRecord) before trusting it.
export async function saveTrackRecord(state: unknown): Promise<void> {
  try {
    const db = await getDb();
    await db.put(SNAPSHOT_STORE, { key: "track-record", state, savedAt: Date.now() });
  } catch {
    // best-effort — see file header.
  }
}

export async function loadTrackRecord(): Promise<unknown | null> {
  try {
    const db = await getDb();
    const record = (await db.get(SNAPSHOT_STORE, "track-record")) as { state?: unknown } | undefined;
    return record?.state ?? null;
  } catch {
    return null;
  }
}

// ─── Consolidação Operacional §5: envelhecimento/compactação automática ───
// A store de candles ganha uma chave por symbol:timeframe visitado e nunca
// perdia nenhuma — crescimento indefinido real (um Operador curioso no
// omnibox × 9 timeframes acumula centenas de registros ao longo de meses).
// Compactar aqui NÃO viola a Regra de Ouro 4 ("nunca apagar dado real"):
// esta store é um CACHE de instant-paint (o gráfico pinta a última sessão
// real enquanto a rede responde) — a fonte da verdade é a exchange, e um
// registro não tocado há semanas é substituído pelo fetch real assim que
// aquele par é reaberto. Envelhecer um cache é manutenção honesta; apagar
// um dado-fonte seria violação. O track record (SNAPSHOT_STORE) nunca é
// tocado por esta função — aquele SIM é conhecimento acumulado real, e já
// é ring-capped na própria estrutura (TRACK_RECORD_HISTORY_CAP).
export const CANDLE_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 dias sem uso => expirado
export const CANDLE_CACHE_MAX_RECORDS = 64; // teto: ~7 ativos de rotação real × 9 timeframes

export interface CandleCompactionResult {
  scanned: number;
  expired: number; // removidos por idade (savedAt além do TTL)
  evicted: number; // removidos por excesso além do teto (os mais antigos primeiro)
}

/** Roda uma vez por boot (App.tsx), fire-and-forget. Mantém os registros
 *  MAIS RECENTES por savedAt; null quando o IndexedDB falhou (mesmo
 *  best-effort de todo este arquivo — compactação nunca pode virar um novo
 *  ponto de falha do caminho real). */
export async function compactPersistedCandles(
  now: number = Date.now(),
  maxAgeMs: number = CANDLE_CACHE_MAX_AGE_MS,
  maxRecords: number = CANDLE_CACHE_MAX_RECORDS,
): Promise<CandleCompactionResult | null> {
  try {
    const db = await getDb();
    const records = (await db.getAll(CANDLES_STORE)) as PersistedCandles[];
    const expired = records.filter((r) => now - r.savedAt > maxAgeMs);
    const alive = records
      .filter((r) => now - r.savedAt <= maxAgeMs)
      .sort((a, b) => b.savedAt - a.savedAt);
    const evicted = alive.slice(maxRecords);
    if (expired.length > 0 || evicted.length > 0) {
      const tx = db.transaction(CANDLES_STORE, "readwrite");
      for (const r of [...expired, ...evicted]) await tx.store.delete(r.key);
      await tx.done;
    }
    return { scanned: records.length, expired: expired.length, evicted: evicted.length };
  } catch {
    return null;
  }
}

export async function loadSnapshotSummary(): Promise<PersistedSnapshotSummary | null> {
  try {
    const db = await getDb();
    const record = (await db.get(SNAPSHOT_STORE, "latest")) as PersistedSnapshotSummary | undefined;
    return record ?? null;
  } catch {
    return null;
  }
}

/** Só para testes: fecha a conexão real e libera o singleton, para que
 *  o próximo teste comece de um banco limpo (uma conexão aberta bloqueia
 *  indexedDB.deleteDatabase indefinidamente — mesmo comportamento do
 *  IndexedDB real, não uma peculiaridade do fake-indexeddb). Nunca
 *  chamado pelo caminho real do app: a conexão fica aberta pela vida da
 *  aba de propósito (reabrir a cada save/load seria custo real sem
 *  ganho nenhum). */
export async function __closeDbConnectionForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
  }
  dbPromise = null;
}
