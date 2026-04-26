import { assertEquals, assertMatch } from "jsr:@std/assert";
import { generatedVersion } from "../version.ts";

// ─── Version consistency ─────────────────────────────────────────────────────

Deno.test("generatedVersion matches deno.json", async () => {
  const raw = await Deno.readTextFile("deno.json");
  const config = JSON.parse(raw);
  assertEquals(generatedVersion, config.version);
});

Deno.test("generatedVersion is a semver string", () => {
  const semverish = /^v?\d+\.\d+\.\d+/;
  assertMatch(generatedVersion, semverish);
});

Deno.test("generatedVersion starts with 'v'", () => {
  assertEquals(generatedVersion.startsWith("v"), true);
});

// ─── version.ts file integrity ───────────────────────────────────────────────

Deno.test("version.ts contains auto-generated comment", async () => {
  const content = await Deno.readTextFile("src/version.ts");
  assertEquals(
    content.includes("auto-generated"),
    true,
    "version.ts should contain the auto-generated notice",
  );
});

Deno.test("version.ts exports generatedVersion", async () => {
  const content = await Deno.readTextFile("src/version.ts");
  assertMatch(content, /export const generatedVersion/);
});

// ─── deno.json schema ────────────────────────────────────────────────────────

Deno.test("deno.json has required fields", async () => {
  const raw = await Deno.readTextFile("deno.json");
  const config = JSON.parse(raw);

  assertEquals(typeof config.version, "string", "version must be a string");
  assertEquals(typeof config.name, "string", "name must be a string");
  assertEquals(typeof config.exports, "string", "exports must be a string");
});

Deno.test("deno.json version format matches semver pattern", async () => {
  const raw = await Deno.readTextFile("deno.json");
  const config = JSON.parse(raw);
  assertMatch(config.version, /^v\d+\.\d+\.\d+/);
});
