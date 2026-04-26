/**
 * `kpsc push <command>` — decrypt the cache and exec the target command with
 * secrets injected as environment variables for the child process only.
 */

import { CACHE_ROOT } from "../constants/config.ts";
import { aesDecrypt, zeroBytes } from "../crypto/aes.ts";
import { deriveDayhash, deriveDecrKey, todayParts } from "../crypto/dayhash.ts";
import { fetchCompiletimehash } from "../github/compiletimehash.ts";
import { isSessionValid, readSession } from "../keychain/session.ts";
import { cachePaths } from "../cache/paths.ts";
import { extractSuperSecretHex } from "../python/decr_template.ts";
import { decodeHex } from "@std/encoding/hex";

const enc = new TextEncoder();
const dec = new TextDecoder();

export class CacheExpiredError extends Error {}
export class CacheMissingError extends Error {}

export interface PushOptions {
  /** Override cache root (used for tests). */
  cacheRoot?: string;
  /** Override "now" for deterministic tests. */
  now?: Date;
  /** When set, skip exec and return secrets to the caller (used for tests). */
  dryRun?: boolean;
}

export interface PushDryRunResult {
  program: string;
  args: string[];
  secrets: Record<string, string>;
}

/**
 * Decrypt the cache and either exec the requested command or, if `dryRun` is
 * set, return the resolved secrets and command tokens without spawning.
 */
export async function push(
  cmdString: string,
  opts: PushOptions = {},
): Promise<number | PushDryRunResult> {
  if (!cmdString || cmdString.trim() === "") {
    throw new Error("usage: kpsc push <command>");
  }

  const session = await readSession();
  const now = opts.now ?? new Date();
  if (!isSessionValid(session, Math.floor(now.getTime() / 1000))) {
    throw new CacheExpiredError(
      "Cache expired. Run acquiesce.",
    );
  }
  const sess = session!;

  const compiletimehash = await fetchCompiletimehash();
  const date = todayParts(now);
  const ghAuthToken = enc.encode(Deno.env.get("KPSC_GH_TOKEN") ?? "anon");

  const dh = await deriveDayhash({
    ...date,
    systemhash: sess.systemhash,
    sessionNonce: sess.sessionNonce,
    ghAuthToken,
    compiletimehash,
  });

  const paths = cachePaths(dh.dayhashB64, dh.dayhashCBC, opts.cacheRoot ?? CACHE_ROOT);

  const decrKey = await deriveDecrKey(
    dh.dayhashCBC,
    dh.dayhashB64,
    compiletimehash,
  );

  let encryptedDecr: Uint8Array;
  try {
    encryptedDecr = await Deno.readFile(paths.decrFile);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      throw new CacheMissingError("Cache files missing. Run acquiesce.");
    }
    throw err;
  }

  const decrSourceBytes = await aesDecrypt(decrKey, encryptedDecr);
  const decrSource = dec.decode(decrSourceBytes);
  zeroBytes(decrSourceBytes);
  zeroBytes(decrKey);

  const superSecretHex = extractSuperSecretHex(decrSource);
  const superSecret = decodeHex(superSecretHex);

  const encryptedDict = await Deno.readFile(paths.dictFile);
  const dictBytes = await aesDecrypt(superSecret, encryptedDict);
  const dictJson = dec.decode(dictBytes);
  zeroBytes(dictBytes);
  zeroBytes(superSecret);
  zeroBytes(dh.rawInput);
  zeroBytes(compiletimehash);
  zeroBytes(ghAuthToken);

  const secrets = JSON.parse(dictJson) as Record<string, string>;

  const tokens = tokenizeCommand(cmdString);
  const [program, ...args] = tokens;
  if (!program) throw new Error("usage: kpsc push <command>");

  if (opts.dryRun) {
    return { program, args, secrets };
  }

  const child = new Deno.Command(program, {
    args,
    env: { ...Deno.env.toObject(), ...secrets },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();

  const status = await child.status;

  // Best-effort wipe — strings are immutable, but drop the references.
  for (const k of Object.keys(secrets)) delete secrets[k];

  return status.code;
}

/**
 * POSIX-ish command tokenizer. Handles single quotes, double quotes, and
 * backslash escapes. Sufficient for the simple `program --flag value`
 * invocations the spec calls for. NOT a full shell parser — operators like
 * `|`, `&&`, `>` are returned as ordinary tokens so callers can detect them.
 */
export function tokenizeCommand(input: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let inSingle = false;
  let inDouble = false;
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (inSingle) {
      if (ch === "'") inSingle = false;
      else cur += ch;
    } else if (inDouble) {
      if (ch === '"') inDouble = false;
      else if (ch === "\\" && i + 1 < input.length) {
        cur += input[++i];
      } else cur += ch;
    } else {
      if (ch === "'") inSingle = true;
      else if (ch === '"') inDouble = true;
      else if (ch === "\\" && i + 1 < input.length) cur += input[++i];
      else if (/\s/.test(ch)) {
        if (cur !== "") {
          tokens.push(cur);
          cur = "";
        }
      } else cur += ch;
    }
    i++;
  }
  if (cur !== "") tokens.push(cur);
  if (inSingle || inDouble) {
    throw new Error("unterminated quote in command string");
  }
  return tokens;
}
