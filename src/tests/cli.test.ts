import { assertEquals, assertStringIncludes } from "@std/assert";
import { runCli } from "../cli.ts";
import { setKeychainOverride } from "../keychain/select.ts";
import { fileKeychain } from "../keychain/file.ts";
import { setCompiletimehashBytesOverride } from "../github/compiletimehash.ts";

async function withHarness<T>(fn: (cacheRoot: string) => Promise<T>): Promise<T> {
  const cacheRoot = await Deno.makeTempDir({ prefix: "kpsc-cli-" });
  const kcDir = await Deno.makeTempDir({ prefix: "kpsc-kc-" });
  setKeychainOverride(fileKeychain(kcDir));
  setCompiletimehashBytesOverride(new Uint8Array(32).fill(9));
  Deno.env.set("KPSC_CACHE_ROOT", cacheRoot);
  try {
    return await fn(cacheRoot);
  } finally {
    Deno.env.delete("KPSC_CACHE_ROOT");
    setKeychainOverride(null);
    setCompiletimehashBytesOverride(null);
    try {
      await Deno.remove(cacheRoot, { recursive: true });
    } catch { /* ignore */ }
    try {
      await Deno.remove(kcDir, { recursive: true });
    } catch { /* ignore */ }
  }
}

Deno.test("runCli help prints usage", async () => {
  const r = await runCli(["help"]);
  assertEquals(r.code, 0);
  assertStringIncludes(r.stdout!, "kpsc");
  assertStringIncludes(r.stdout!, "acquiesce");
});

Deno.test("runCli version prints version", async () => {
  const r = await runCli(["version"]);
  assertEquals(r.code, 0);
  assertStringIncludes(r.stdout!, "v");
});

Deno.test("runCli unknown subcommand exits 2", async () => {
  const r = await runCli(["nope"]);
  assertEquals(r.code, 2);
  assertStringIncludes(r.stderr!, "unknown subcommand");
});

Deno.test("runCli status w/o cache returns code 1", async () => {
  await withHarness(async () => {
    const r = await runCli(["status"]);
    assertEquals(r.code, 1);
    assertStringIncludes(r.stdout!, "No active cache");
  });
});

Deno.test("runCli rotate succeeds even with no cache", async () => {
  await withHarness(async () => {
    const r = await runCli(["rotate"]);
    assertEquals(r.code, 0);
    assertStringIncludes(r.stdout!, "rotated");
  });
});

Deno.test("runCli push reports missing cache cleanly", async () => {
  await withHarness(async () => {
    const r = await runCli(["push", "echo", "hi"]);
    assertEquals(r.code, 1);
    assertStringIncludes(r.stderr!, "Cache");
  });
});
