/**
 * macOS Keychain backend, driven via the `security` CLI.
 *
 * The Deno binary calls `/usr/bin/security` to add/find/delete generic
 * password entries. This avoids native FFI and keeps the binary fully
 * statically linked to Deno's runtime.
 */

import { KEYCHAIN_SERVICE } from "../constants/config.ts";
import type { Keychain } from "./types.ts";

const SECURITY = "/usr/bin/security";

export interface SecurityRunner {
  (args: string[]): Promise<{ code: number; stdout: string; stderr: string }>;
}

const realRun: SecurityRunner = async (args) => {
  const cmd = new Deno.Command(SECURITY, {
    args,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await cmd.output();
  return {
    code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
};

/**
 * Construct the macOS Keychain backend.
 *
 * `service` defaults to the configured `KEYCHAIN_SERVICE` so all entries are
 * grouped under a single namespace.
 */
export function macosKeychain(
  service: string = KEYCHAIN_SERVICE,
  run: SecurityRunner = realRun,
): Keychain {
  return {
    backend: "macos-security",
    async get(name: string): Promise<string | null> {
      const r = await run([
        "find-generic-password",
        "-s",
        service,
        "-a",
        name,
        "-w",
      ]);
      if (r.code !== 0) return null;
      return r.stdout.trim();
    },
    async set(name: string, value: string): Promise<void> {
      const r = await run([
        "add-generic-password",
        "-U",
        "-s",
        service,
        "-a",
        name,
        "-w",
        value,
      ]);
      if (r.code !== 0) {
        throw new Error(`security add-generic-password failed: ${r.stderr}`);
      }
    },
    async delete(name: string): Promise<void> {
      await run(["delete-generic-password", "-s", service, "-a", name]);
    },
  };
}
