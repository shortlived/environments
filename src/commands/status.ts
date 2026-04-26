/**
 * `kpsc status` — report on the active cache without decrypting anything.
 */

import { CACHE_TTL_SECONDS } from "../constants/config.ts";
import { readSession, secondsRemaining } from "../keychain/session.ts";

export interface StatusReport {
  active: boolean;
  remainingSeconds: number;
  ttlSeconds: number;
  message: string;
}

export async function status(now: Date = new Date()): Promise<StatusReport> {
  const sess = await readSession();
  const remaining = secondsRemaining(sess, Math.floor(now.getTime() / 1000));

  if (remaining === null) {
    return {
      active: false,
      remainingSeconds: 0,
      ttlSeconds: CACHE_TTL_SECONDS,
      message: "No active cache. Run acquiesce.",
    };
  }
  if (remaining <= 0) {
    return {
      active: false,
      remainingSeconds: 0,
      ttlSeconds: CACHE_TTL_SECONDS,
      message: "Cache expired. Run acquiesce.",
    };
  }
  return {
    active: true,
    remainingSeconds: remaining,
    ttlSeconds: CACHE_TTL_SECONDS,
    message: `Cache active. TTL remaining: ${remaining}s (${formatHHMMSS(remaining)})`,
  };
}

export function formatHHMMSS(secs: number): string {
  if (secs < 0) secs = 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
