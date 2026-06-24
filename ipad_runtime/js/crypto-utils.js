// crypto-utils.js — checksum local via Web Crypto (sem libs externas).

export async function sha256Hex(data) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return bufferToHex(digest);
}

export function bufferToHex(buf) {
    const bytes = new Uint8Array(buf);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
    return hex;
}

export function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

export function bytesToBase64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
}

// Mesmo algoritmo usado por tools/build_pack.py para o checksum agregado:
// sha256( join("\n", sorted("path:hash" for cada arquivo)) )
export async function packageChecksum(checksumsByPath) {
    const lines = Object.keys(checksumsByPath)
        .filter((k) => k !== '_package')
        .sort()
        .map((k) => `${k}:${checksumsByPath[k]}`);
    const text = lines.join('\n');
    const bytes = new TextEncoder().encode(text);
    return sha256Hex(bytes);
}
