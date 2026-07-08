// access-gate-crypto.ts — hashing puro para o portão de acesso (ver
// access-gate.tsx). SHA-256 via Web Crypto (globalThis.crypto.subtle),
// disponível tanto no browser quanto em Node >= 19 — por isso testável em
// vitest (ambiente node) sem nenhum polyfill. A senha em texto puro NUNCA
// é comparada por igualdade de string nem persistida em lugar nenhum —
// só o hash entra no bundle e só o hash é comparado.
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(input: string, expectedHashHex: string): Promise<boolean> {
  if (!input) return false;
  const hash = await sha256Hex(input);
  return hash === expectedHashHex;
}
