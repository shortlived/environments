/**
 * AES-256-GCM encrypt/decrypt wrappers.
 *
 * Layout: [12-byte random nonce][ciphertext][16-byte GCM tag]
 *
 * GCM (with authentication tag) is the only mode used. CBC is rejected because
 * it provides no integrity guarantee. Nonces are 12 random bytes prepended to
 * the output, so the caller never has to manage nonce storage.
 */

import { zeroBytes } from "../util/zeroize.ts";

const NONCE_BYTES = 12;
const KEY_BYTES = 32;

function assertKey(key: Uint8Array): void {
  if (key.byteLength !== KEY_BYTES) {
    throw new Error(`AES-256-GCM key must be ${KEY_BYTES} bytes`);
  }
}

async function importKey(key: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    key as unknown as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt `plaintext` using AES-256-GCM. Returns nonce-prefixed ciphertext. */
export async function aesEncrypt(
  key: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  assertKey(key);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const cryptoKey = await importKey(key);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as unknown as ArrayBuffer },
      cryptoKey,
      plaintext as unknown as ArrayBuffer,
    ),
  );
  const out = new Uint8Array(NONCE_BYTES + ct.byteLength);
  out.set(nonce, 0);
  out.set(ct, NONCE_BYTES);
  return out;
}

/** Decrypt `nonce || ciphertext || tag` produced by `aesEncrypt`. */
export async function aesDecrypt(
  key: Uint8Array,
  blob: Uint8Array,
): Promise<Uint8Array> {
  assertKey(key);
  if (blob.byteLength <= NONCE_BYTES) {
    throw new Error("ciphertext too short");
  }
  const nonce = blob.subarray(0, NONCE_BYTES);
  const ct = blob.subarray(NONCE_BYTES);
  const cryptoKey = await importKey(key);
  const pt = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce as unknown as ArrayBuffer },
      cryptoKey,
      ct as unknown as ArrayBuffer,
    ),
  );
  return pt;
}

/** Convenience: derive a fixed-length key from arbitrary bytes via SHA-256. */
export async function sha256Key(input: Uint8Array): Promise<Uint8Array> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", input as unknown as ArrayBuffer),
  );
  return digest;
}

/** Generate `n` cryptographically random bytes. */
export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** Concatenate any number of byte arrays. */
export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((acc, p) => acc + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

/** Constant-time equality check. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export { KEY_BYTES, NONCE_BYTES, zeroBytes };
