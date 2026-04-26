/**
 * File-backed keychain (development & CI fallback).
 *
 * Each entry is stored as a separate file under the configured root.
 * Permissions: directory mode 0700, file mode 0600.
 *
 * This backend is NOT a substitute for macOS Keychain in production. It exists
 * so the same code paths can be exercised on Linux without depending on
 * `security`. Production deploys MUST use the macOS backend.
 */

import { dirname, join } from "@std/path";
import { ensureDir } from "@std/fs/ensure-dir";
import type { Keychain } from "./types.ts";

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function fileKeychain(root: string): Keychain {
  const entryPath = (name: string) => join(root, `${safeName(name)}.entry`);

  return {
    backend: "file",
    async get(name: string): Promise<string | null> {
      try {
        return await Deno.readTextFile(entryPath(name));
      } catch (err) {
        if (err instanceof Deno.errors.NotFound) return null;
        throw err;
      }
    },
    async set(name: string, value: string): Promise<void> {
      const path = entryPath(name);
      await ensureDir(dirname(path));
      try {
        await Deno.chmod(dirname(path), 0o700);
      } catch { /* ignore on platforms without chmod */ }
      await Deno.writeTextFile(path, value);
      try {
        await Deno.chmod(path, 0o600);
      } catch { /* ignore */ }
    },
    async delete(name: string): Promise<void> {
      try {
        await Deno.remove(entryPath(name));
      } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) throw err;
      }
    },
  };
}
