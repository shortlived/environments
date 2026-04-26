import { assertEquals } from "@std/assert";
import { selectKeychain, setKeychainOverride } from "../keychain/select.ts";

Deno.test("selectKeychain honours override", () => {
  const fake = {
    backend: "fake",
    // deno-lint-ignore require-await
    async get() { return null; },
    // deno-lint-ignore require-await
    async set() {},
    // deno-lint-ignore require-await
    async delete() {},
  };
  setKeychainOverride(fake);
  assertEquals(selectKeychain().backend, "fake");
  setKeychainOverride(null);
});

Deno.test("selectKeychain returns a backend by default", () => {
  const kc = selectKeychain();
  // backend will be either macos-security or file depending on host
  assertEquals(typeof kc.backend, "string");
});
