// pack-manager.js — Local Pack Manager.
// Baixa/importa/verifica/instala/limpa o AR10_CYBORG_LOCAL_PACK_V1.ar10pack.
//
// Formato escolhido para o .ar10pack: container JSON (UTF-8) com arquivos
// embutidos em base64 + manifesto + checksums SHA-256. Decisao documentada
// em README.md ("Por que JSON e nao ZIP"): zero dependencia externa (sem
// lib de descompressao via CDN, sem eval, sem WASM de terceiros para abrir
// o pacote) e parsing nativo do Safari via JSON.parse — robusto e auditavel
// a olho nu. Nao e um executavel; e um pacote de instalacao local inerte.

import { sha256Hex, base64ToBytes, packageChecksum } from './crypto-utils.js';
import * as storage from './storage.js';

// Resolvidas explicitamente contra a URL do documento (nao do modulo):
// fetch()/Worker() resolvem URLs relativas contra a pagina, nao contra o
// arquivo .js que faz a chamada — confirmado empiricamente antes de fechar
// este caminho. index.html e estes dois arquivos vivem no mesmo nivel.
const PACK_URL = new URL('./AR10_CYBORG_LOCAL_PACK_V1.ar10pack', window.location.href).href;
const REPLAY_FALLBACK_URL = new URL('./data/btcusdt_replay.json', window.location.href).href;
const VAULT_META_KEY = 'vault_state';

let loadedPack = null; // bytes do pacote atualmente em memoria (download ou import)
let loadedPackJson = null;

export function getLoadedPack() { return loadedPackJson; }

export async function downloadLocalPack(onLog) {
    onLog?.(`Buscando pacote local em ${PACK_URL} (mesma origem HTTPS, sem CDN externo)...`, 'info');
    const resp = await fetch(PACK_URL, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ao buscar o pacote`);
    const buf = await resp.arrayBuffer();
    loadedPack = buf;
    loadedPackJson = JSON.parse(new TextDecoder().decode(buf));

    // Tambem oferece uma copia real para o app Arquivos (download nativo do Safari)
    const blob = new Blob([buf], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AR10_CYBORG_LOCAL_PACK_V1.ar10pack';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    onLog?.(`Pacote recebido: ${buf.byteLength} bytes. Oferecido para download no app Arquivos.`, 'ok');
    return loadedPackJson;
}

export async function importLocalPackFromFile(file, onLog) {
    onLog?.(`Importando ${file.name} (${file.size} bytes) do app Arquivos...`, 'info');
    const text = await file.text();
    loadedPackJson = JSON.parse(text);
    loadedPack = new TextEncoder().encode(text).buffer;
    onLog?.('Pacote importado e parseado com sucesso.', 'ok');
    return loadedPackJson;
}

export async function verifySha256(onLog) {
    if (!loadedPackJson) throw new Error('Nenhum pacote carregado (baixe ou importe primeiro)');
    const { files, checksums } = loadedPackJson;
    if (!files || !checksums) throw new Error('Pacote sem campos files/checksums');

    const report = [];
    let allOk = true;
    for (const relPath of Object.keys(files)) {
        const bytes = base64ToBytes(files[relPath]);
        const hash = await sha256Hex(bytes);
        const expected = checksums[relPath];
        const ok = hash === expected;
        allOk = allOk && ok;
        report.push({ relPath, ok, hash, expected });
        onLog?.(`${ok ? 'PASS' : 'FAIL'}  ${relPath}  sha256=${hash.slice(0, 16)}...`, ok ? 'ok' : 'fail');
    }

    const pkgHash = await packageChecksum(checksums);
    const pkgOk = pkgHash === checksums._package;
    allOk = allOk && pkgOk;
    report.push({ relPath: '_package', ok: pkgOk, hash: pkgHash, expected: checksums._package });
    onLog?.(`${pkgOk ? 'PASS' : 'FAIL'}  _package (checksum agregado)  ${pkgHash.slice(0, 16)}...`, pkgOk ? 'ok' : 'fail');

    onLog?.(allOk ? 'VERIFICACAO SHA-256: TODOS OS ARQUIVOS OK' : 'VERIFICACAO SHA-256: FALHOU — instalacao bloqueada (FAIL_CLOSED)', allOk ? 'ok' : 'fail');
    return { allOk, report };
}

export async function installToSafariStorage(onLog) {
    const { allOk } = await verifySha256(onLog);
    if (!allOk) {
        await storage.setMeta(VAULT_META_KEY, { status: 'LOCKED', reason: 'checksum_failed', ts: Date.now() });
        throw new Error('FAIL_CLOSED: checksum invalido, instalacao abortada');
    }

    const { files, checksums, manifest, models_manifest: modelsManifest, runtime_config: runtimeConfig } = loadedPackJson;
    const backend = await storage.activeBackend();
    for (const relPath of Object.keys(files)) {
        const bytes = base64ToBytes(files[relPath]);
        await storage.saveFile(relPath, bytes);
        onLog?.(`gravado em ${backend.toUpperCase()}: ${relPath} (${bytes.length} bytes)`, 'dim');
    }
    await storage.saveFile('_meta/manifest.pack.json', new TextEncoder().encode(JSON.stringify(manifest || {})));
    await storage.saveFile('_meta/manifest.models.json', new TextEncoder().encode(JSON.stringify(modelsManifest || {})));
    await storage.saveFile('_meta/runtime_config.json', new TextEncoder().encode(JSON.stringify(runtimeConfig || {})));

    await storage.setMeta(VAULT_META_KEY, {
        status: 'READY',
        backend,
        checksums,
        installedAt: Date.now(),
        fileCount: Object.keys(files).length,
    });
    onLog?.(`VAULT: READY (backend=${backend}, arquivos=${Object.keys(files).length})`, 'ok');
    return { backend, fileCount: Object.keys(files).length };
}

/** Reabre o estado do vault no boot, re-verificando os hashes (FAIL_CLOSED real,
 *  nao apenas uma flag salva: se os bytes guardados nao baterem mais com o
 *  checksum gravado, o vault volta para LOCKED). */
export async function reloadVaultState(onLog) {
    const meta = await storage.getMeta(VAULT_META_KEY);
    if (!meta || meta.status !== 'READY') return { status: 'LOCKED' };

    try {
        for (const relPath of Object.keys(meta.checksums || {})) {
            if (relPath === '_package') continue;
            const bytes = await storage.readFile(relPath);
            if (!bytes) throw new Error(`arquivo ausente: ${relPath}`);
            const hash = await sha256Hex(bytes);
            if (hash !== meta.checksums[relPath]) throw new Error(`checksum divergente: ${relPath}`);
        }
        onLog?.('VAULT: re-verificado no boot — integro (READY)', 'ok');
        return meta;
    } catch (err) {
        onLog?.(`VAULT: integridade falhou no boot (${err.message}) — bloqueando (LOCKED)`, 'fail');
        await storage.setMeta(VAULT_META_KEY, { status: 'LOCKED', reason: String(err.message) });
        return { status: 'LOCKED' };
    }
}

export async function clearAndReinstall(onLog) {
    await storage.clearAll();
    loadedPack = null;
    loadedPackJson = null;
    onLog?.('Vault local limpo (OPFS/IndexedDB). O PWA em si permanece instalado.', 'warn');
    return { status: 'LOCKED' };
}

export async function loadReplayDataset(onLog) {
    const installed = await storage.readFile('data/btcusdt_replay.json');
    if (installed) {
        onLog?.('Replay carregado do Vault local (instalado).', 'dim');
        return JSON.parse(new TextDecoder().decode(installed));
    }
    onLog?.('Vault sem replay instalado — usando copia do app shell (mesma origem) como demo.', 'dim');
    const resp = await fetch(REPLAY_FALLBACK_URL);
    if (!resp.ok) throw new Error('replay dataset indisponivel');
    return resp.json();
}
