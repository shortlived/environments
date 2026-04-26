/**
 * Non-secret runtime constants for the kpsc binary.
 *
 * Anything in this file is fully visible in the compiled binary
 * (and in the source repo). It must NEVER contain key material —
 * the compiletimehash is loaded from `compiletimehash.ts` (gitignored)
 * and from the runtime fetch in `github/compiletimehash.ts`.
 *
 * 12-factor: configuration that is environment-dependent reads from
 * `Deno.env`. Defaults are sensible and override-friendly.
 */

const env = (key: string, fallback: string): string => Deno.env.get(key) ?? fallback;

const envInt = (key: string, fallback: number): number => {
  const raw = Deno.env.get(key);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Cache TTL in seconds. 8 hours = 28,800 seconds. */
export const CACHE_TTL_SECONDS = envInt("KPSC_TTL_SECONDS", 28_800);

/** Service name used for all macOS Keychain entries. */
export const KEYCHAIN_SERVICE = env("KPSC_KEYCHAIN_SERVICE", "kpsc");

/** Names of keychain entries managed by kpsc. */
export const KEYCHAIN_ENTRIES = {
  systemhash: "kpsc.systemhash",
  sessionNonce: "kpsc.session_nonce",
  sessionStart: "kpsc.session_start",
} as const;

/** Default repository hosting the runtime-fetched compiletimehash. */
export const COMPILETIMEHASH_REPO = env(
  "KPSC_SECRETS_REPO",
  "softdist/kpsc-secrets",
);

/** File path inside the repo. */
export const COMPILETIMEHASH_PATH = env(
  "KPSC_SECRETS_PATH",
  "compiletimehash.txt",
);

/** Cache root. Override-able for tests; production is /tmp. */
export const CACHE_ROOT = env("KPSC_CACHE_ROOT", "/tmp");

/** GitHub API host. Override-able for GitHub Enterprise installs. */
export const GITHUB_API = env("KPSC_GITHUB_API", "https://api.github.com");

/**
 * Backend selector for keychain/secret storage.
 *
 * - `auto` — pick `macos` if running on Darwin, otherwise `file` (dev fallback).
 * - `macos` — force the macOS `security` CLI backend.
 * - `file`  — encrypted-on-disk fallback rooted at `KPSC_FILE_KEYCHAIN_ROOT`.
 *             Intended for CI, Linux dev, and tests. NEVER for production secrets.
 */
export const KEYCHAIN_BACKEND = env("KPSC_KEYCHAIN_BACKEND", "auto");

/** Filesystem-backed keychain root (used only when backend=file). */
export const FILE_KEYCHAIN_ROOT = env(
  "KPSC_FILE_KEYCHAIN_ROOT",
  `${Deno.env.get("HOME") ?? "/tmp"}/.config/kpsc/keychain`,
);

/** Source for the gh OAuth token — overridable for tests/CI. */
export const GH_TOKEN_ENV = env("KPSC_GH_TOKEN_ENV", "GH_TOKEN");
