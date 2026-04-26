/**
 * `kpsc rotate` — force immediate cache invalidation.
 *
 * Generates fresh systemhash and session_nonce values and overwrites
 * session_start with the current epoch. Old /tmp dirs are left in place but
 * become permanently unreadable because their key material no longer exists.
 */

import { rotateSession } from "../keychain/session.ts";

export async function rotate(now: Date = new Date()): Promise<void> {
  await rotateSession(Math.floor(now.getTime() / 1000));
}
