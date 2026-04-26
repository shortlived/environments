import { assertEquals } from "@std/assert";
import { fileKeychain } from "../keychain/file.ts";
import {
  clearSession,
  isSessionValid,
  readSession,
  rotateSession,
  secondsRemaining,
} from "../keychain/session.ts";
import { setKeychainOverride } from "../keychain/select.ts";

async function withTempKeychain<T>(fn: () => Promise<T>): Promise<T> {
  const dir = await Deno.makeTempDir({ prefix: "kpsc-kc-" });
  setKeychainOverride(fileKeychain(dir));
  try {
    return await fn();
  } finally {
    setKeychainOverride(null);
    try {
      await Deno.remove(dir, { recursive: true });
    } catch { /* ignore */ }
  }
}

Deno.test("file keychain set/get/delete round-trip", async () => {
  await withTempKeychain(async () => {
    const dir = await Deno.makeTempDir({ prefix: "kpsc-kc2-" });
    const kc = fileKeychain(dir);
    assertEquals(await kc.get("missing"), null);
    await kc.set("hello", "world");
    assertEquals(await kc.get("hello"), "world");
    await kc.delete("hello");
    assertEquals(await kc.get("hello"), null);
    await kc.delete("hello"); // idempotent
    await Deno.remove(dir, { recursive: true });
  });
});

Deno.test("rotateSession persists three values", async () => {
  await withTempKeychain(async () => {
    const s = await rotateSession(1000);
    assertEquals(s.systemhash.byteLength, 32);
    assertEquals(s.sessionNonce.byteLength, 32);
    assertEquals(s.sessionStart, 1000);

    const r = await readSession();
    assertEquals(r?.sessionStart, 1000);
    assertEquals(r?.systemhash.byteLength, 32);
  });
});

Deno.test("readSession returns null when missing", async () => {
  await withTempKeychain(async () => {
    assertEquals(await readSession(), null);
  });
});

Deno.test("secondsRemaining + isSessionValid honour TTL", async () => {
  await withTempKeychain(async () => {
    const start = 10_000;
    await rotateSession(start);
    const s = await readSession();
    assertEquals(secondsRemaining(s, start), 28_800);
    assertEquals(isSessionValid(s, start), true);
    assertEquals(isSessionValid(s, start + 28_800), false);
    assertEquals(isSessionValid(s, start + 1_000_000), false);
  });
});

Deno.test("clearSession wipes all entries", async () => {
  await withTempKeychain(async () => {
    await rotateSession(123);
    await clearSession();
    assertEquals(await readSession(), null);
  });
});
