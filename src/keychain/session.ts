/**
 * High-level session helpers: read/write the systemhash, session_nonce,
 * and session_start values backed by whichever keychain is active.
 *
 * All three values rotate together on `acquiesce` and `rotate`.
 */

import { decodeHex, encodeHex } from "@std/encoding/hex";
import { CACHE_TTL_SECONDS, KEYCHAIN_ENTRIES } from "../constants/config.ts";
import { randomBytes } from "../crypto/aes.ts";
import { selectKeychain } from "./select.ts";

export interface SessionState {
  systemhash: Uint8Array;
  sessionNonce: Uint8Array;
  sessionStart: number;
}

const SYSTEMHASH_BYTES = 32;
const NONCE_BYTES = 32;

/** Read all three session values. Returns null if any are missing. */
export async function readSession(): Promise<SessionState | null> {
  const kc = selectKeychain();
  const [shHex, nonceHex, startStr] = await Promise.all([
    kc.get(KEYCHAIN_ENTRIES.systemhash),
    kc.get(KEYCHAIN_ENTRIES.sessionNonce),
    kc.get(KEYCHAIN_ENTRIES.sessionStart),
  ]);
  if (!shHex || !nonceHex || !startStr) return null;
  const start = Number.parseInt(startStr, 10);
  if (!Number.isFinite(start)) return null;
  return {
    systemhash: decodeHex(shHex),
    sessionNonce: decodeHex(nonceHex),
    sessionStart: start,
  };
}

/**
 * Generate fresh systemhash/session_nonce/session_start and persist them.
 * Caller is responsible for triggering this on `acquiesce` and `rotate`.
 */
export async function rotateSession(
  now: number = Math.floor(Date.now() / 1000),
): Promise<SessionState> {
  const kc = selectKeychain();
  const systemhash = randomBytes(SYSTEMHASH_BYTES);
  const sessionNonce = randomBytes(NONCE_BYTES);
  const sessionStart = now;

  await kc.set(KEYCHAIN_ENTRIES.systemhash, encodeHex(systemhash));
  await kc.set(KEYCHAIN_ENTRIES.sessionNonce, encodeHex(sessionNonce));
  await kc.set(KEYCHAIN_ENTRIES.sessionStart, String(sessionStart));

  return { systemhash, sessionNonce, sessionStart };
}

/** Forget all session state (invalidates the cache). */
export async function clearSession(): Promise<void> {
  const kc = selectKeychain();
  await Promise.all([
    kc.delete(KEYCHAIN_ENTRIES.systemhash),
    kc.delete(KEYCHAIN_ENTRIES.sessionNonce),
    kc.delete(KEYCHAIN_ENTRIES.sessionStart),
  ]);
}

/** Seconds remaining; negative means expired. Null when no session exists. */
export function secondsRemaining(
  state: SessionState | null,
  now: number = Math.floor(Date.now() / 1000),
): number | null {
  if (!state) return null;
  const elapsed = now - state.sessionStart;
  return CACHE_TTL_SECONDS - elapsed;
}

/** Convenience: true if state is present and within TTL. */
export function isSessionValid(
  state: SessionState | null,
  now: number = Math.floor(Date.now() / 1000),
): boolean {
  const r = secondsRemaining(state, now);
  return r !== null && r > 0;
}
