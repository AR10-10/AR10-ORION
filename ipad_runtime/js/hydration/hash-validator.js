// hash-validator.js — validação SHA-256 por pacote do Hydration Engine.
// Reusa crypto-utils.sha256Hex (mesmo algoritmo usado por pack-manager.js e
// por tools/build_pack.py — uma única fonte de verdade para "como se calcula
// o hash" no projeto inteiro). FAIL_CLOSED: hash que não bate nunca é
// rebaixado a aviso — o pacote correspondente nunca é marcado pronto.

import { sha256Hex } from '../crypto-utils.js';

export const VALIDATION_RESULT = Object.freeze({
    PASS: 'PASS',
    FAIL: 'FAIL',
    NOT_APPLICABLE: 'NOT_APPLICABLE',
});

/**
 * @param {Uint8Array} bytes
 * @param {string|null} expectedSha256 - null/undefined => pacote agregado sem
 *   hash individual (ex.: app_shell); resultado NOT_APPLICABLE, nunca PASS.
 */
export async function validateBytes(bytes, expectedSha256) {
    if (!expectedSha256) {
        return { result: VALIDATION_RESULT.NOT_APPLICABLE, actual: null, expected: null };
    }
    if (!bytes) {
        return { result: VALIDATION_RESULT.FAIL, actual: null, expected: expectedSha256 };
    }
    const actual = await sha256Hex(bytes);
    const pass = actual === expectedSha256;
    return { result: pass ? VALIDATION_RESULT.PASS : VALIDATION_RESULT.FAIL, actual, expected: expectedSha256 };
}

/** Valida um HydrationPackage (contrato de manifest-reader.js) cujos bytes já
 *  foram lidos (decodificados do .ar10pack ou relidos do Vault). */
export async function validatePackage(pkg, bytes) {
    const { result, actual, expected } = await validateBytes(bytes, pkg.sha256);
    return { package_id: pkg.package_id, result, actual, expected };
}

export async function validateAll(packagesWithBytes) {
    const results = [];
    for (const { pkg, bytes } of packagesWithBytes) {
        results.push(await validatePackage(pkg, bytes));
    }
    const failed = results.filter((r) => r.result === VALIDATION_RESULT.FAIL);
    return { allOk: failed.length === 0, results, failed };
}
