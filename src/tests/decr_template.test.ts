import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import {
  extractSuperSecretHex,
  renderDecrTemplate,
} from "../python/decr_template.ts";

Deno.test("renderDecrTemplate embeds super_secret_hex", () => {
  const src = renderDecrTemplate({
    superSecretHex: "deadbeef",
    generatedAtIsoUtc: "2026-04-26T00:00:00Z",
  });
  assertStringIncludes(src, 'super_secret_hex = "deadbeef"');
  assertStringIncludes(src, "decrypt_dict");
});

Deno.test("extractSuperSecretHex pulls value", () => {
  const src = renderDecrTemplate({
    superSecretHex: "abc123",
    generatedAtIsoUtc: "2026-04-26T00:00:00Z",
  });
  assertEquals(extractSuperSecretHex(src), "abc123");
});

Deno.test("extractSuperSecretHex throws on malformed", () => {
  assertThrows(() => extractSuperSecretHex("nothing here"));
});
