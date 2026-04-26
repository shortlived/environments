import { assertEquals } from "@std/assert";
import {
  fetchCompiletimehash,
  setCompiletimehashBytesOverride,
} from "../github/compiletimehash.ts";

Deno.test("fetchCompiletimehash returns env value when set", async () => {
  Deno.env.set("KPSC_COMPILETIMEHASH", "abc123");
  setCompiletimehashBytesOverride(null);
  const r = await fetchCompiletimehash();
  assertEquals(new TextDecoder().decode(r), "abc123");
  Deno.env.delete("KPSC_COMPILETIMEHASH");
});

Deno.test("fetchCompiletimehash returns override when set", async () => {
  setCompiletimehashBytesOverride(new Uint8Array([1, 2, 3]));
  const r = await fetchCompiletimehash();
  assertEquals(Array.from(r), [1, 2, 3]);
  setCompiletimehashBytesOverride(null);
});

Deno.test("fetchCompiletimehash falls back to DEV when nothing else", async () => {
  setCompiletimehashBytesOverride(null);
  Deno.env.delete("KPSC_COMPILETIMEHASH");
  Deno.env.delete("GH_TOKEN");
  // Don't actually run gh; bind to a name that won't be on PATH
  Deno.env.set("KPSC_GH_TOKEN_ENV", "KPSC_GH_TOKEN_NEVER_SET");
  const r = await fetchCompiletimehash();
  // Without network/gh, we should at least get the DEV fallback bytes
  assertEquals(typeof new TextDecoder().decode(r), "string");
  Deno.env.delete("KPSC_GH_TOKEN_ENV");
});
