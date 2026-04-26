/**
 * Runtime compiletimehash retrieval.
 *
 * Order of resolution:
 *  1. `KPSC_COMPILETIMEHASH` env var (CI/test override).
 *  2. `gh auth token` → GitHub Contents API on the configured repo path.
 *  3. Build-time fallback returned by `getCompiletimehash()`.
 *
 * The retrieved value is returned as raw bytes. Callers are responsible for
 * zeroizing the buffer once derivation completes.
 */

import { decodeBase64 } from "@std/encoding/base64";
import {
  COMPILETIMEHASH_PATH,
  COMPILETIMEHASH_REPO,
  GH_TOKEN_ENV,
  GITHUB_API,
} from "../constants/config.ts";
import { getCompiletimehash } from "../constants/compiletimehash.ts";

const enc = new TextEncoder();

let _override: Uint8Array | null = null;

/** Test hook: pre-supply the bytes the resolver should return. */
export function setCompiletimehashBytesOverride(
  bytes: Uint8Array | null,
): void {
  _override = bytes;
}

/** Try resolving from env / gh / build constant, in that order.
 *
 * Always returns a *fresh* buffer so that callers can safely zeroize it after
 * derivation without affecting subsequent invocations. */
export async function fetchCompiletimehash(): Promise<Uint8Array> {
  if (_override) return new Uint8Array(_override);

  const envHex = Deno.env.get("KPSC_COMPILETIMEHASH");
  if (envHex && envHex !== "DEV") return enc.encode(envHex);

  // Try the gh subprocess + GitHub API path; fall back to constant on any
  // failure so the binary degrades gracefully in offline/dev scenarios.
  try {
    const token = await ghAuthToken();
    if (token) {
      const body = await fetchGitHubFile(token);
      if (body) {
        return decodeBase64(body);
      }
    }
  } catch { /* swallow — fall through to constant */ }

  const constant = getCompiletimehash();
  return enc.encode(constant);
}

async function ghAuthToken(): Promise<string | null> {
  const envToken = Deno.env.get(GH_TOKEN_ENV);
  if (envToken && envToken.length > 0) return envToken;

  try {
    const cmd = new Deno.Command("gh", {
      args: ["auth", "token"],
      stdout: "piped",
      stderr: "null",
    });
    const { code, stdout } = await cmd.output();
    if (code !== 0) return null;
    return new TextDecoder().decode(stdout).trim();
  } catch {
    return null;
  }
}

async function fetchGitHubFile(token: string): Promise<string | null> {
  const url = `${GITHUB_API}/repos/${COMPILETIMEHASH_REPO}/contents/${COMPILETIMEHASH_PATH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "kpsc",
    },
  });
  if (!res.ok) {
    await res.body?.cancel();
    return null;
  }
  const json = await res.json() as { content?: string };
  return json.content ?? null;
}
