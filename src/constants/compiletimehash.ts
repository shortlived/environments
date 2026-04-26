/**
 * Build-time-injected compiletimehash.
 *
 * This file is overwritten by CI prior to `deno compile`. It is also listed
 * in `.gitignore` for the `softdist/kpsc` build repo.
 *
 * The default below is the literal string `"DEV"` — a deliberately obvious
 * sentinel that prevents accidental production use of an unbuilt binary.
 *
 * Tests override this via `setCompiletimehashOverride()` so the source value
 * is never required for unit testing.
 */

let _override: string | null = null;

/** Returns the current compiletimehash. */
export function getCompiletimehash(): string {
  if (_override !== null) return _override;
  return Deno.env.get("KPSC_COMPILETIMEHASH") ?? "DEV";
}

/** Test hook — supply an override for this process. */
export function setCompiletimehashOverride(value: string | null): void {
  _override = value;
}
