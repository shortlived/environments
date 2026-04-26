import { assertEquals } from "@std/assert";
import { wipeStringSlot, zeroAll, zeroBytes } from "../util/zeroize.ts";

Deno.test("zeroBytes overwrites in place", () => {
  const b = new Uint8Array([1, 2, 3]);
  zeroBytes(b);
  assertEquals(Array.from(b), [0, 0, 0]);
});

Deno.test("zeroBytes is null-safe", () => {
  zeroBytes(null);
  zeroBytes(undefined);
});

Deno.test("zeroAll wipes multiple buffers", () => {
  const a = new Uint8Array([7]);
  const b = new Uint8Array([8, 9]);
  zeroAll(a, b, null);
  assertEquals(a[0], 0);
  assertEquals(Array.from(b), [0, 0]);
});

Deno.test("wipeStringSlot is callable", () => {
  wipeStringSlot("anything");
});
