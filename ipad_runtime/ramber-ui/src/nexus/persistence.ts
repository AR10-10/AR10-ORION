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
