import { assertEquals, assertNotEquals, assertRejects } from "@std/assert";
import {
  aesDecrypt,
  aesEncrypt,
  concatBytes,
  constantTimeEqual,
  randomBytes,
  sha256Key,
} from "../crypto/aes.ts";
import {
  deriveDayhash,
  deriveDecrKey,
  pad2,
  todayParts,
} from "../crypto/dayhash.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();

Deno.test("aesEncrypt round-trips", async () => {
  const key = randomBytes(32);
  const pt = enc.encode("hello kpsc");
  const ct = await aesEncrypt(key, pt);
  const out = await aesDecrypt(key, ct);
  assertEquals(dec.decode(out), "hello kpsc");
});

Deno.test("aesEncrypt produces fresh nonce per call", async () => {
  const key = randomBytes(32);
  const pt = enc.encode("same message");
  const a = await aesEncrypt(key, pt);
  const b = await aesEncrypt(key, pt);
  assertNotEquals(constantTimeEqual(a, b), true);
});

Deno.test("aesDecrypt rejects wrong key", async () => {
  const k1 = randomBytes(32);
  const k2 = randomBytes(32);
  const ct = await aesEncrypt(k1, enc.encode("x"));
  await assertRejects(() => aesDecrypt(k2, ct));
});

Deno.test("aesDecrypt rejects truncated blob", async () => {
  const key = randomBytes(32);
  await assertRejects(() => aesDecrypt(key, new Uint8Array(5)));
});

Deno.test("aesEncrypt rejects wrong-size key", async () => {
  await assertRejects(() => aesEncrypt(new Uint8Array(16), enc.encode("x")));
});

Deno.test("sha256Key produces 32 bytes", async () => {
  const k = await sha256Key(enc.encode("seed"));
  assertEquals(k.byteLength, 32);
});

Deno.test("constantTimeEqual matches semantics", () => {
  assertEquals(constantTimeEqual(enc.encode("ab"), enc.encode("ab")), true);
  assertEquals(constantTimeEqual(enc.encode("ab"), enc.encode("ac")), false);
  assertEquals(constantTimeEqual(enc.encode("a"), enc.encode("ab")), false);
});

Deno.test("concatBytes joins all parts", () => {
  const r = concatBytes(new Uint8Array([1, 2]), new Uint8Array([3])); 
  assertEquals(Array.from(r), [1, 2, 3]);
});

Deno.test("pad2 zero-pads", () => {
  assertEquals(pad2(1), "01");
  assertEquals(pad2(12), "12");
});

Deno.test("todayParts returns local date components", () => {
  const p = todayParts(new Date(2026, 0, 5));
  assertEquals(p, { day: 5, month: 1, year: 2026 });
});

Deno.test("deriveDayhash is deterministic for identical inputs", async () => {
  const inputs = {
    day: 1,
    month: 2,
    year: 2026,
    systemhash: new Uint8Array(32).fill(7),
    sessionNonce: new Uint8Array(32).fill(8),
    ghAuthToken: enc.encode("token"),
    compiletimehash: enc.encode("cth"),
  };
  const a = await deriveDayhash(inputs);
  const b = await deriveDayhash({ ...inputs });
  assertEquals(a.dayhashB64, b.dayhashB64);
  assertEquals(a.dayhashCBC, b.dayhashCBC);
});

Deno.test("deriveDayhash B64 changes when any input changes", async () => {
  const base = {
    day: 1,
    month: 2,
    year: 2026,
    systemhash: new Uint8Array(32).fill(7),
    sessionNonce: new Uint8Array(32).fill(8),
    ghAuthToken: enc.encode("t"),
    compiletimehash: enc.encode("c"),
  };
  const a = await deriveDayhash(base);
  const b = await deriveDayhash({ ...base, day: 2 });
  assertNotEquals(a.dayhashB64, b.dayhashB64);
});

Deno.test("deriveDecrKey is 32 bytes and stable", async () => {
  const k1 = await deriveDecrKey("cbc", "b64", enc.encode("cth"));
  const k2 = await deriveDecrKey("cbc", "b64", enc.encode("cth"));
  assertEquals(k1.byteLength, 32);
  assertEquals(constantTimeEqual(k1, k2), true);
});

Deno.test("deriveDecrKey changes when inputs change", async () => {
  const k1 = await deriveDecrKey("a", "b", enc.encode("c"));
  const k2 = await deriveDecrKey("a", "b", enc.encode("d"));
  assertEquals(constantTimeEqual(k1, k2), false);
});
