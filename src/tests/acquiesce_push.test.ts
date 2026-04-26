import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { acquiesce } from "../commands/acquiesce.ts";
import {
  CacheExpiredError,
  CacheMissingError,
  push,
  tokenizeCommand,
} from "../commands/push.ts";
import { rotate } from "../commands/rotate.ts";
import { status } from "../commands/status.ts";
import { setKeychainOverride } from "../keychain/select.ts";
import { fileKeychain } from "../keychain/file.ts";
import { setCompiletimehashBytesOverride } from "../github/compiletimehash.ts";

interface Harness {
  cacheRoot: string;
  cleanup: () => Promise<void>;
}

async function makeHarness(): Promise<Harness> {
  const cacheRoot = await Deno.makeTempDir({ prefix: "kpsc-cache-" });
  const kcDir = await Deno.makeTempDir({ prefix: "kpsc-kc-" });
  setKeychainOverride(fileKeychain(kcDir));
  setCompiletimehashBytesOverride(new Uint8Array(32).fill(0x42));
  return {
    cacheRoot,
    cleanup: async () => {
      setKeychainOverride(null);
      setCompiletimehashBytesOverride(null);
      try {
        await Deno.remove(cacheRoot, { recursive: true });
      } catch { /* ignore */ }
      try {
        await Deno.remove(kcDir, { recursive: true });
      } catch { /* ignore */ }
    },
  };
}

Deno.test("acquiesce → push round-trips secrets via env injection", async () => {
  const h = await makeHarness();
  try {
    const result = await acquiesce({
      payload: "FOO=bar\nDB_URL=postgres://u:p@h/d\n",
      cacheRoot: h.cacheRoot,
    });
    assertEquals(result.ttlSeconds, 28_800);

    const stat = await Deno.stat(result.decrFile);
    assertEquals(stat.isFile, true);

    const dry = await push("echo hello world", { cacheRoot: h.cacheRoot, dryRun: true });
    if (typeof dry === "number") throw new Error("expected dry-run payload");
    assertEquals(dry.program, "echo");
    assertEquals(dry.args, ["hello", "world"]);
    assertEquals(dry.secrets.FOO, "bar");
    assertEquals(dry.secrets.DB_URL, "postgres://u:p@h/d");
  } finally {
    await h.cleanup();
  }
});

Deno.test("push rejects empty command string", async () => {
  const h = await makeHarness();
  try {
    await acquiesce({ payload: "A=1\n", cacheRoot: h.cacheRoot });
    await assertRejects(() => push("", { cacheRoot: h.cacheRoot }));
  } finally {
    await h.cleanup();
  }
});

Deno.test("push raises CacheExpiredError after TTL elapses", async () => {
  const h = await makeHarness();
  try {
    const baseDate = new Date("2026-04-26T08:00:00Z");
    await acquiesce({ payload: "A=1\n", cacheRoot: h.cacheRoot, now: baseDate });
    const future = new Date(baseDate.getTime() + 9 * 3600 * 1000);
    await assertRejects(
      () => push("echo", { cacheRoot: h.cacheRoot, now: future }),
      CacheExpiredError,
    );
  } finally {
    await h.cleanup();
  }
});

Deno.test("push raises CacheMissingError when files removed", async () => {
  const h = await makeHarness();
  try {
    await acquiesce({ payload: "A=1\n", cacheRoot: h.cacheRoot });
    await Deno.remove(h.cacheRoot, { recursive: true });
    await Deno.mkdir(h.cacheRoot, { recursive: true });
    await assertRejects(
      () => push("echo", { cacheRoot: h.cacheRoot }),
      CacheMissingError,
    );
  } finally {
    await h.cleanup();
  }
});

Deno.test("rotate invalidates the existing cache", async () => {
  const h = await makeHarness();
  try {
    await acquiesce({ payload: "A=1\n", cacheRoot: h.cacheRoot });
    await rotate();
    await assertRejects(
      () => push("echo", { cacheRoot: h.cacheRoot }),
      CacheMissingError,
    );
  } finally {
    await h.cleanup();
  }
});

Deno.test("status reports active and expired states", async () => {
  const h = await makeHarness();
  try {
    const before = await status();
    assertStringIncludes(before.message, "No active cache");
    assertEquals(before.active, false);

    const baseDate = new Date("2026-04-26T08:00:00Z");
    await acquiesce({ payload: "A=1\n", cacheRoot: h.cacheRoot, now: baseDate });
    const r = await status(baseDate);
    assertEquals(r.active, true);
    assertStringIncludes(r.message, "TTL remaining");

    const future = new Date(baseDate.getTime() + 9 * 3600 * 1000);
    const r2 = await status(future);
    assertEquals(r2.active, false);
    assertStringIncludes(r2.message, "expired");
  } finally {
    await h.cleanup();
  }
});

Deno.test("tokenizeCommand handles quoted segments", () => {
  assertEquals(tokenizeCommand(`a b "c d" 'e f'`), ["a", "b", "c d", "e f"]);
  assertEquals(tokenizeCommand(`x  --flag=value`), ["x", "--flag=value"]);
  assertEquals(tokenizeCommand(`prog "with \\"escaped\\" quote"`), [
    "prog",
    'with "escaped" quote',
  ]);
});
