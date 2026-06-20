// storage.js — camada unificada OPFS (preferida) com fallback IndexedDB.
// Local-first: nada aqui sai do dispositivo. Sem rede, sem secret.

const DB_NAME = 'ar10_cyborg_ipad_runtime';
const DB_VERSION = 1;
const STORE = 'pack_files';
const META_STORE = 'meta';
const OPFS_DIR = 'ar10pack';

let dbPromise = null;
function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
            if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

function idbTx(storeName, mode) {
    return openDb().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

async function idbSet(storeName, key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
async function idbGet(storeName, key) {
    const store = await idbTx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function idbKeys(storeName) {
    const store = await idbTx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function idbDelete(storeName, key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
async function idbClearStore(storeName) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

let opfsCheckedOk = null;
export async function opfsAvailable() {
    if (opfsCheckedOk !== null) return opfsCheckedOk;
    try {
        if (!('storage' in navigator) || typeof navigator.storage.getDirectory !== 'function') {
            opfsCheckedOk = false;
            return false;
        }
        const root = await navigator.storage.getDirectory();
        const dir = await root.getDirectoryHandle(OPFS_DIR, { create: true });
        const fh = await dir.getFileHandle('__rw_probe.bin', { create: true });
        const w = await fh.createWritable();
        await w.write(new Uint8Array([1]));
        await w.close();
        await dir.removeEntry('__rw_probe.bin');
        opfsCheckedOk = true;
    } catch {
        opfsCheckedOk = false;
    }
    return opfsCheckedOk;
}

async function opfsDir(create = true) {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(OPFS_DIR, { create });
}

/** Backend efetivamente usado nesta sessao: 'opfs' | 'idb' */
export async function activeBackend() {
    return (await opfsAvailable()) ? 'opfs' : 'idb';
}

export async function saveFile(relPath, bytes) {
    if (await opfsAvailable()) {
        const dir = await opfsDir(true);
        const parts = relPath.split('/');
        let cur = dir;
        for (let i = 0; i < parts.length - 1; i++) {
            cur = await cur.getDirectoryHandle(parts[i], { create: true });
        }
        const fh = await cur.getFileHandle(parts[parts.length - 1], { create: true });
        const w = await fh.createWritable();
        await w.write(bytes);
        await w.close();
        return 'opfs';
    }
    await idbSet(STORE, relPath, bytes);
    return 'idb';
}

export async function readFile(relPath) {
    if (await opfsAvailable()) {
        try {
            const dir = await opfsDir(false);
            const parts = relPath.split('/');
            let cur = dir;
            for (let i = 0; i < parts.length - 1; i++) {
                cur = await cur.getDirectoryHandle(parts[i], { create: false });
            }
            const fh = await cur.getFileHandle(parts[parts.length - 1], { create: false });
            const file = await fh.getFile();
            return new Uint8Array(await file.arrayBuffer());
        } catch {
            return null;
        }
    }
    const v = await idbGet(STORE, relPath);
    return v ? new Uint8Array(v) : null;
}

/** Remove um unico arquivo (usado pela limpeza segura pos-atualizacao do
 *  pack-manager: nunca apaga nada antes do novo conteudo validado existir). */
export async function deleteFile(relPath) {
    if (await opfsAvailable()) {
        try {
            const dir = await opfsDir(false);
            const parts = relPath.split('/');
            let cur = dir;
            for (let i = 0; i < parts.length - 1; i++) {
                cur = await cur.getDirectoryHandle(parts[i], { create: false });
            }
            await cur.removeEntry(parts[parts.length - 1]);
        } catch { /* ja nao existia */ }
        return;
    }
    await idbDelete(STORE, relPath).catch(() => {});
}

export async function listFiles() {
    if (await opfsAvailable()) {
        const dir = await opfsDir(true);
        const out = [];
        async function walk(handle, prefix) {
            for await (const [name, entry] of handle.entries()) {
                if (entry.kind === 'directory') await walk(entry, `${prefix}${name}/`);
                else out.push(`${prefix}${name}`);
            }
        }
        await walk(dir, '');
        return out;
    }
    return idbKeys(STORE);
}

export async function clearAll() {
    if (await opfsAvailable()) {
        try {
            const root = await navigator.storage.getDirectory();
            await root.removeEntry(OPFS_DIR, { recursive: true });
        } catch { /* dir nao existia */ }
    }
    await idbClearStore(STORE).catch(() => {});
    await idbClearStore(META_STORE).catch(() => {});
}

export async function setMeta(key, value) { return idbSet(META_STORE, key, value); }
export async function getMeta(key) { return idbGet(META_STORE, key); }

export async function storageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
        try { return await navigator.storage.estimate(); } catch { return null; }
    }
    return null;
}

/** OK | LIMITED | FAIL — usado pelo painel de status. */
export async function storageHealth() {
    const opfsOk = await opfsAvailable();
    if (opfsOk) return 'OK';
    try {
        await idbSet(META_STORE, '__health', 1);
        const v = await idbGet(META_STORE, '__health');
        await idbDelete(META_STORE, '__health');
        return v === 1 ? 'LIMITED' : 'FAIL';
    } catch {
        return 'FAIL';
    }
}
