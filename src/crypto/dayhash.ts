/**
 * Dayhash derivation.
 *
 * dayhash_input = day || month || year || systemhash || session_nonce
 *                 || gh_auth_token || compiletimehash
 *
 * dayhashB64 = filesystem-safe Base64URL of dayhash_input
 * dayhashCBC = HMAC-SHA256(key=compiletimehash, data=dayhash_input)
 *              encoded as filesystem-safe Base64URL
 *
 * The "CBC" name is preserved in the spec for historical reasons; the actual
 * primitive is HMAC-SHA256, chosen because directory names must be
 * deterministic for a given input set yet unguessable without the keying
 * material. AES-GCM with a random nonce is unsuitable for naming because the
 * output is non-deterministic. (The cache *files themselves* are still
 * AES-GCM authenticated.)
 */

import { encodeBase64Url } from "@std/encoding/base64url";
import { concatBytes, sha256Key } from "./aes.ts";

export interface DayhashInputs {
  day: number;
  month: number;
  year: number;
  systemhash: Uint8Array;
  sessionNonce: Uint8Array;
  ghAuthToken: Uint8Array;
  compiletimehash: Uint8Array;
}

export interface DayhashResult {
  /** Filesystem-safe directory name for the decr.py cache. */
  dayhashB64: string;
  /** Filesystem-safe directory name for the dict.py cache. */
  dayhashCBC: string;
  /** Combined raw inputs (callers should zeroize after use). */
  rawInput: Uint8Array;
}

const enc = new TextEncoder();

/**
 * Build the dayhash material and the two directory names used for caching.
 *
 * Both directory names are deterministic given identical inputs but
 * unpredictable without the full set of inputs. The B64 form is used as a
 * directory name and is therefore filesystem-safe.
 */
export async function deriveDayhash(
  inputs: DayhashInputs,
): Promise<DayhashResult> {
  const dateStr = `${pad2(inputs.day)}${pad2(inputs.month)}${inputs.year}`;
  const rawInput = concatBytes(
    enc.encode(dateStr),
    inputs.systemhash,
    inputs.sessionNonce,
    inputs.ghAuthToken,
    inputs.compiletimehash,
  );

  const dayhashB64 = encodeBase64Url(rawInput);

  const hmacKey = await crypto.subtle.importKey(
    "raw",
    inputs.compiletimehash as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      hmacKey,
      rawInput as unknown as ArrayBuffer,
    ),
  );
  const dayhashCBC = encodeBase64Url(mac);

  return { dayhashB64, dayhashCBC, rawInput };
}

/**
 * Derive the AES-GCM key used to encrypt/decrypt decr.py.
 *
 * decr_key = SHA-256( dayhashCBC || dayhashB64 || compiletimehash )
 */
export async function deriveDecrKey(
  dayhashCBC: string,
  dayhashB64: string,
  compiletimehash: Uint8Array,
): Promise<Uint8Array> {
  const material = concatBytes(
    enc.encode(dayhashCBC),
    enc.encode(dayhashB64),
    compiletimehash,
  );
  return await sha256Key(material);
}

/** Zero-pad a number to 2 digits. */
export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Today's date components in local time. */
export function todayParts(now: Date = new Date()): {
  day: number;
  month: number;
  year: number;
} {
  return {
    day: now.getDate(),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}
