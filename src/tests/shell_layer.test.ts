/**
 * Shell layer integrity tests.
 *
 * - Every fish/bash/zsh function file must parse cleanly under its respective
 *   interpreter when one is installed. Missing interpreters produce a skipped
 *   test rather than a failure so this suite runs on any host.
 * - Bash function bodies are sourced into a sandbox subshell with a stub
 *   `kpsc` on PATH and exercised end-to-end so we have real coverage of the
 *   shell wrappers, not just static parsing.
 */

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const SHELL_DIR = join(REPO_ROOT, "shell");

async function which(bin: string): Promise<string | null> {
  try {
    const r = await new Deno.Command("which", {
      args: [bin],
      stdout: "piped",
      stderr: "null",
    }).output();
    if (r.code !== 0) return null;
    return new TextDecoder().decode(r.stdout).trim() || null;
  } catch {
    return null;
  }
}

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for await (const e of Deno.readDir(dir)) {
    if (e.isFile) out.push(join(dir, e.name));
  }
  return out;
}

Deno.test({
  name: "fish files parse with `fish -n` (skip if fish missing)",
  ignore: !(await which("fish")),
  fn: async () => {
    for (
      const dir of ["fish/functions", "fish/completions", "fish/conf.d"]
    ) {
      for (const file of await listFiles(join(SHELL_DIR, dir))) {
        const r = await new Deno.Command("fish", {
          args: ["-n", file],
          stderr: "piped",
          stdout: "null",
        }).output();
        assertEquals(
          r.code,
          0,
          `fish -n ${file}: ${new TextDecoder().decode(r.stderr)}`,
        );
      }
    }
  },
});

Deno.test({
  name: "bash files parse with `bash -n`",
  ignore: !(await which("bash")),
  fn: async () => {
    for (const file of await listFiles(join(SHELL_DIR, "bash"))) {
      const r = await new Deno.Command("bash", {
        args: ["-n", file],
        stderr: "piped",
        stdout: "null",
      }).output();
      assertEquals(
        r.code,
        0,
        `bash -n ${file}: ${new TextDecoder().decode(r.stderr)}`,
      );
    }
  },
});

Deno.test({
  name: "zsh files parse with `zsh -n` (skip if zsh missing)",
  ignore: !(await which("zsh")),
  fn: async () => {
    for (const file of [join(SHELL_DIR, "zsh/kpsc.zsh"), join(SHELL_DIR, "zsh/_kpsc")]) {
      const r = await new Deno.Command("zsh", {
        args: ["-n", file],
        stderr: "piped",
        stdout: "null",
      }).output();
      assertEquals(
        r.code,
        0,
        `zsh -n ${file}: ${new TextDecoder().decode(r.stderr)}`,
      );
    }
  },
});

/**
 * Build a temp directory that contains a stub `kpsc` binary recording its
 * argv to a log file and exit code 0 for any invocation.
 */
async function buildStubBin(): Promise<{ dir: string; log: string }> {
  const dir = await Deno.makeTempDir({ prefix: "kpsc-stub-" });
  const log = join(dir, "calls.log");
  const stub = `#!/usr/bin/env bash
echo "$@" >> "${log}"
if [[ "$1" == "acquiesce" ]]; then cat >/dev/null; fi
exit 0
`;
  const path = join(dir, "kpsc");
  await Deno.writeTextFile(path, stub);
  await Deno.chmod(path, 0o755);
  // Fake keepassxc-cli too.
  const kpx = join(dir, "keepassxc-cli");
  await Deno.writeTextFile(
    kpx,
    `#!/usr/bin/env bash
cat >/dev/null
echo "$@" >> "${log}"
exit 0
`,
  );
  await Deno.chmod(kpx, 0o755);
  return { dir, log };
}

Deno.test({
  name: "bash util_secrets_push delegates to kpsc binary",
  ignore: !(await which("bash")),
  fn: async () => {
    const { dir, log } = await buildStubBin();
    try {
      const r = await new Deno.Command("bash", {
        args: [
          "-c",
          `set -euo pipefail
source ${join(SHELL_DIR, "bash/kpsc.bash")}
util_secrets_push "echo hello"`,
        ],
        env: { PATH: `${dir}:${Deno.env.get("PATH") ?? ""}` },
        stdout: "piped",
        stderr: "piped",
      }).output();
      assertEquals(
        r.code,
        0,
        `stderr: ${new TextDecoder().decode(r.stderr)}`,
      );
      const contents = await Deno.readTextFile(log);
      assertStringIncludes(contents, "push");
      assertStringIncludes(contents, "echo hello");
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "bash util_secrets_push fails fast on empty argv",
  ignore: !(await which("bash")),
  fn: async () => {
    const r = await new Deno.Command("bash", {
      args: [
        "-c",
        `source ${join(SHELL_DIR, "bash/kpsc.bash")}
util_secrets_push`,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(r.code, 2);
  },
});

Deno.test({
  name: "bash util_keepass_hash_system reports missing kpsc",
  ignore: !(await which("bash")),
  fn: async () => {
      const tmp = await Deno.makeTempDir({ prefix: "kpsc-empty-" });
    const bashPath = (await which("bash")) ?? "/bin/bash";
    try {
      const r = await new Deno.Command(bashPath, {
        args: [
          "-c",
          `source ${join(SHELL_DIR, "bash/kpsc.bash")}
util_keepass_hash_system`,
        ],
        env: { PATH: tmp },
        stdout: "piped",
        stderr: "piped",
      }).output();
      assert(r.code !== 0);
      assertStringIncludes(new TextDecoder().decode(r.stderr), "kpsc");
    } finally {
      await Deno.remove(tmp, { recursive: true });
    }
  },
});

Deno.test({
  name: "zsh sources kpsc.zsh and exposes dotted functions",
  ignore: !(await which("zsh")),
  fn: async () => {
    const { dir } = await buildStubBin();
    try {
      const r = await new Deno.Command("zsh", {
        args: [
          "-c",
          `source ${join(SHELL_DIR, "zsh/kpsc.zsh")}
typeset -f .util.secrets.push >/dev/null && echo "ok"`,
        ],
        env: { PATH: `${dir}:${Deno.env.get("PATH") ?? ""}` },
        stdout: "piped",
        stderr: "piped",
      }).output();
      assertEquals(r.code, 0);
      assertStringIncludes(new TextDecoder().decode(r.stdout), "ok");
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "fish keybindings file binds the generic+artifactory acquiesce flows",
  fn: async () => {
    const text = await Deno.readTextFile(join(SHELL_DIR, "fish/conf.d/kpsc.fish"));
    assertStringIncludes(text, ".util.keepass.dir.acquiesce generic");
    assertStringIncludes(text, ".util.keepass.dir.acquiesce artifactory");
  },
});
