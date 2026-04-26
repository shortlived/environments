import { assertEquals, assertThrows } from "@std/assert";
import { parseSecretsPayload } from "../secrets/parse.ts";

Deno.test("parses simple KEY=VALUE", () => {
  const r = parseSecretsPayload("FOO=bar\nBAZ=qux\n");
  assertEquals(r, { FOO: "bar", BAZ: "qux" });
});

Deno.test("ignores blanks and comments", () => {
  const r = parseSecretsPayload("\n# c\nA=1\n  \n# trailing\nB=2");
  assertEquals(r, { A: "1", B: "2" });
});

Deno.test("strips matching surrounding quotes", () => {
  const r = parseSecretsPayload(`A="x"\nB='y'\nC="x'y"`);
  assertEquals(r, { A: "x", B: "y", C: "x'y" });
});

Deno.test("preserves = inside the value", () => {
  const r = parseSecretsPayload("DSN=postgres://u:p@h/d?ssl=true\n");
  assertEquals(r.DSN, "postgres://u:p@h/d?ssl=true");
});

Deno.test("rejects malformed line", () => {
  assertThrows(() => parseSecretsPayload("nokeyhere\n"));
});

Deno.test("rejects bad var name", () => {
  assertThrows(() => parseSecretsPayload("123BAD=1\n"));
  assertThrows(() => parseSecretsPayload("A-B=1\n"));
});
