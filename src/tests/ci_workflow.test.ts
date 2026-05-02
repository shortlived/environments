/**
 * CI workflow integrity tests.
 *
 * These ensure the build/release pipeline keeps the contract the docs and
 * runbook depend on: tag pattern, secrets referenced, target architectures,
 * and the brew formula generation flow.
 */

import { assert, assertStringIncludes } from "@std/assert";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;

async function readWorkflow(name: string): Promise<string> {
  return await Deno.readTextFile(`${REPO_ROOT}.github/workflows/${name}`);
}

Deno.test("kpsc-build-release.yml triggers on kpsc-v* tags", async () => {
  const text = await readWorkflow("kpsc-build-release.yml");
  assertStringIncludes(text, "kpsc-v*.*.*");
  assertStringIncludes(text, "macos-latest");
});

Deno.test("kpsc-build-release.yml compiles both Apple Silicon and Intel", async () => {
  const text = await readWorkflow("kpsc-build-release.yml");
  assertStringIncludes(text, "aarch64-apple-darwin");
  assertStringIncludes(text, "x86_64-apple-darwin");
});

Deno.test("kpsc-build-release.yml references required secrets", async () => {
  const text = await readWorkflow("kpsc-build-release.yml");
  assertStringIncludes(text, "secrets.COMPILETIMEHASH");
  assertStringIncludes(text, "secrets.KPSC_SECRETS_DEPLOY_KEY");
  assertStringIncludes(text, "secrets.HOMEBREW_TAP_DEPLOY_KEY");
});

Deno.test("kpsc-build-release.yml regenerates the brew formula", async () => {
  const text = await readWorkflow("kpsc-build-release.yml");
  assertStringIncludes(text, "Formula/kpsc.rb");
  assertStringIncludes(text, "class Kpsc < Formula");
  assertStringIncludes(text, "Hardware::CPU.arm?");
});

Deno.test("kpsc-ci.yml enforces lint, typecheck, test, coverage gate", async () => {
  const text = await readWorkflow("kpsc-ci.yml");
  assertStringIncludes(text, "deno fmt --check");
  assertStringIncludes(text, "deno lint");
  assertStringIncludes(text, "deno check src/mod.ts");
  assertStringIncludes(text, "deno test -A");
  assertStringIncludes(text, "Enforce 80% line coverage");
  // Coverage must be parsed from LCOV (machine-readable) rather than the
  // human-formatted table, which contains ANSI color escapes that break
  // awk-based field extraction.
  assertStringIncludes(text, "--lcov");
  assertStringIncludes(text, "LH:");
  assertStringIncludes(text, "LF:");
});

Deno.test("brew formula stub matches expected layout", async () => {
  const text = await Deno.readTextFile(`${REPO_ROOT}tap/Formula/kpsc.rb`);
  assert(text.includes("class Kpsc < Formula"));
  assert(text.includes('bin.install "kpsc-aarch64"'));
  assert(text.includes('bin.install "kpsc-x86_64"'));
});
