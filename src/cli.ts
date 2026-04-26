/**
 * kpsc CLI entrypoint.
 *
 * Subcommands:
 *   acquiesce        — read KEY=VALUE secrets from stdin, encrypt cache
 *   push <command>   — decrypt cache, exec command with secrets in env
 *   rotate           — invalidate cache (rotate session_nonce + systemhash)
 *   status           — print TTL remaining
 *   keepass list <db> <group>     — list entries under a group
 *   keepass dump <db> <group>     — emit KEY=VALUE for each entry
 *   version          — print version
 *   help             — print usage
 */

import { generatedVersion } from "./version.ts";
import { acquiesce } from "./commands/acquiesce.ts";
import { CacheExpiredError, CacheMissingError, push } from "./commands/push.ts";
import { rotate } from "./commands/rotate.ts";
import { status } from "./commands/status.ts";
import { keepassDump, keepassList } from "./commands/keepass.ts";

const HELP = `kpsc ${generatedVersion} — KeePass Secret Cache

Usage:
  kpsc acquiesce                            Read KEY=VALUE from stdin → encrypted cache
  kpsc push <command-string>                Decrypt cache, exec command with secrets in env
  kpsc rotate                               Force cache invalidation
  kpsc status                               Show cache TTL remaining
  kpsc keepass list <db> <group>            (helper) list entries in a group
  kpsc keepass dump <db> <group>            (helper) emit KEY=VALUE for entries (password on stdin)
  kpsc version                              Print binary version
  kpsc help                                 This message

Environment:
  KPSC_TTL_SECONDS              Cache TTL override (default 28800)
  KPSC_KEYCHAIN_BACKEND         auto | macos | file (default: auto)
  KPSC_FILE_KEYCHAIN_ROOT       Root for file-backed keychain (Linux/CI)
  KPSC_CACHE_ROOT               Cache directory root (default /tmp)
  KPSC_GH_TOKEN                 Override gh token (for tests)
  KPSC_COMPILETIMEHASH          Override compile-time hash (CI only)
`;

export interface CliResult {
  code: number;
  stdout?: string;
  stderr?: string;
}

export async function runCli(argv: string[]): Promise<CliResult> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      return { code: 0, stdout: HELP };

    case "version":
    case "--version":
    case "-v":
      return { code: 0, stdout: `${generatedVersion}\n` };

    case "acquiesce": {
      const result = await acquiesce();
      return {
        code: 0,
        stdout: `Cache initialized. TTL: ${result.ttlSeconds}s\n`,
      };
    }

    case "push": {
      const cmdString = rest.join(" ");
      try {
        const r = await push(cmdString);
        if (typeof r === "number") return { code: r };
        return { code: 0 };
      } catch (err) {
        if (err instanceof CacheExpiredError || err instanceof CacheMissingError) {
          return { code: 1, stderr: `${err.message}\n` };
        }
        throw err;
      }
    }

    case "rotate": {
      await rotate();
      return {
        code: 0,
        stdout: "Cache rotated. Old /tmp entries are permanently unreadable.\n",
      };
    }

    case "status": {
      const r = await status();
      return {
        code: r.active ? 0 : 1,
        stdout: `${r.message}\n`,
      };
    }

    case "keepass": {
      const [sub, db, group] = rest;
      if (!sub || !db || !group) {
        return {
          code: 2,
          stderr: "usage: kpsc keepass <list|dump> <db> <group>\n",
        };
      }
      const password = await readPasswordStdin();
      try {
        if (sub === "list") {
          const entries = await keepassList(db, group, password);
          return { code: 0, stdout: entries.join("\n") + "\n" };
        }
        if (sub === "dump") {
          const payload = await keepassDump(db, group, password);
          return { code: 0, stdout: payload };
        }
        return {
          code: 2,
          stderr: `unknown keepass subcommand: ${sub}\n`,
        };
      } catch (err) {
        return { code: 1, stderr: `${(err as Error).message}\n` };
      }
    }

    default:
      return {
        code: 2,
        stderr: `unknown subcommand: ${cmd}\nRun 'kpsc help' for usage.\n`,
      };
  }
}

async function readPasswordStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = Deno.stdin.readable.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch { /* ignore */ }
  }
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(buf).replace(/\r?\n$/, "");
}
