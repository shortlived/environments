/**
 * `kpsc acquiesce` — read KEY=VALUE secrets from stdin, encrypt them into the
 * cache, and zeroize all working memory before returning.
 */

import { encodeHex } from "@std/encoding/hex";
import { CACHE_ROOT, CACHE_TTL_SECONDS } from "../constants/config.ts";
import { aesEncrypt, randomBytes, zeroBytes } from "../crypto/aes.ts";
import { deriveDayhash, deriveDecrKey, todayParts } from "../crypto/dayhash.ts";
import { fetchCompiletimehash } from "../github/compiletimehash.ts";
import { rotateSession } from "../keychain/session.ts";
import { cachePaths, prepareCacheDirs } from "../cache/paths.ts";
import { renderDecrTemplate } from "../python/decr_template.ts";
import { parseSecretsPayload } from "../secrets/parse.ts";

const enc = new TextEncoder();

export interface AcquiesceOptions {
  /** Pre-read payload (used for testing); defaults to reading stdin. */
  payload?: string;
  /** Override cache root (used for testing). */
  cacheRoot?: string;
  /** Override "now" for deterministic tests. */
  now?: Date;
}

export interface AcquiesceResult {
  decrFile: string;
  dictFile: string;
  ttlSeconds: number;
}

export async function acquiesce(
  opts: AcquiesceOptions = {},
): Promise<AcquiesceResult> {
  const payload = opts.payload ?? (await readStdin());
  const secrets = parseSecretsPayload(payload);
  const now = opts.now ?? new Date();
  const cacheRoot = opts.cacheRoot ?? CACHE_ROOT;

  const compiletimehash = await fetchCompiletimehash();
  const session = await rotateSession(Math.floor(now.getTime() / 1000));
  const date = todayParts(now);

  const ghAuthToken = enc.encode(Deno.env.get("KPSC_GH_TOKEN") ?? "anon");

  const dh = await deriveDayhash({
    ...date,
    systemhash: session.systemhash,
    sessionNonce: session.sessionNonce,
    ghAuthToken,
    compiletimehash,
  });

  const paths = cachePaths(dh.dayhashB64, dh.dayhashCBC, cacheRoot);
  await prepareCacheDirs(paths);

  const superSecret = randomBytes(32);
  const superSecretHex = encodeHex(superSecret);
  const decrPySource = renderDecrTemplate({
    superSecretHex,
    generatedAtIsoUtc: now.toISOString(),
  });

  const decrKey = await deriveDecrKey(
    dh.dayhashCBC,
    dh.dayhashB64,
    compiletimehash,
  );
  const encryptedDecr = await aesEncrypt(decrKey, enc.encode(decrPySource));
  await Deno.writeFile(paths.decrFile, encryptedDecr);
  try {
    await Deno.chmod(paths.decrFile, 0o600);
  } catch { /* non-POSIX */ }

  const dictJson = JSON.stringify(secrets);
  const encryptedDict = await aesEncrypt(superSecret, enc.encode(dictJson));
  await Deno.writeFile(paths.dictFile, encryptedDict);
  try {
    await Deno.chmod(paths.dictFile, 0o600);
  } catch { /* non-POSIX */ }

  zeroBytes(superSecret);
  zeroBytes(decrKey);
  zeroBytes(dh.rawInput);
  zeroBytes(compiletimehash);
  zeroBytes(ghAuthToken);

  return {
    decrFile: paths.decrFile,
    dictFile: paths.dictFile,
    ttlSeconds: CACHE_TTL_SECONDS,
  };
}

async function readStdin(): Promise<string> {
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
  const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}
