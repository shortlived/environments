/**
 * Backend selector — resolves `KPSC_KEYCHAIN_BACKEND` to a concrete Keychain.
 */

import { FILE_KEYCHAIN_ROOT, KEYCHAIN_BACKEND } from "../constants/config.ts";
import { fileKeychain } from "./file.ts";
import { macosKeychain } from "./macos.ts";
import type { Keychain } from "./types.ts";

let _override: Keychain | null = null;

/** Test hook: force a specific keychain instance for the current process. */
export function setKeychainOverride(kc: Keychain | null): void {
  _override = kc;
}

/** Resolve the configured keychain backend. */
export function selectKeychain(): Keychain {
  if (_override) return _override;
  const choice = KEYCHAIN_BACKEND.toLowerCase();
  switch (choice) {
    case "macos":
      return macosKeychain();
    case "file":
      return fileKeychain(FILE_KEYCHAIN_ROOT);
    case "auto":
    default:
      return Deno.build.os === "darwin" ? macosKeychain() : fileKeychain(FILE_KEYCHAIN_ROOT);
  }
}
