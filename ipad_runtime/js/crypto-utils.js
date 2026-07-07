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
