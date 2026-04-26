/**
 * Keychain backend interface.
 *
 * Implementations are pluggable: the macOS `security` CLI is the production
 * backend; an encrypted file-based backend is provided for tests, CI, and
 * Linux development. The contract is identical for all backends.
 */

export interface Keychain {
  /** Read a stored entry, or null if missing. */
  get(name: string): Promise<string | null>;
  /** Write a stored entry, replacing any existing one. */
  set(name: string, value: string): Promise<void>;
  /** Delete an entry. Idempotent — missing entries are a no-op. */
  delete(name: string): Promise<void>;
  /** Backend name for diagnostics. */
  readonly backend: string;
}
