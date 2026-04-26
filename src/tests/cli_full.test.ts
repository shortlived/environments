import { assertEquals, assertStringIncludes } from "@std/assert";
import { runCli } from "../cli.ts";
import { setKeychainOverride } from "../keychain/select.ts";
import { fileKeychain } from "../keychain/file.ts";
import { setCompiletimehashBytesOverride } from "../github/compiletimehash.ts";
import { setKeepassRunner } from "../commands/keepass.ts";

async function withHarness<T>(fn: () => Promise<T>): Promise<T> {
  const cacheRoot = await Deno.makeTempDir({ prefix: "kpsc-cli2-" });
  const kcDir = await Deno.makeTempDir({ prefix: "kpsc-kc2-" });
  setKeychainOverride(fileKeychain(kcDir));
  setCompiletimehashBytesOverride(new Uint8Array(32).fill(7));
  Deno.env.set("KPSC_CACHE_ROOT", cacheRoot);
  try {
    return await fn();
  } finally {
    Deno.env.delete("KPSC_CACHE_ROOT");
    setKeychainOverride(null);
    setCompiletimehashBytesOverride(null);
    try {
      await Deno.remove(cacheRoot, { recursive: true });
    } catch { /* ignore */ }
    try {
      await Deno.remove(kcDir, { recursive: true });
    } catch { /* ignore */ }
  }
}

async function pipeStdin(input: string, fn: () => Promise<unknown>): Promise<unknown> {
  // Replace Deno.stdin with a piped reader for the duration of fn().
  // We can't override the global, so construct a temporary reader via a
  // ReadableStream and rebind Deno.stdin.readable for this call.
  const original = Deno.stdin.readable;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(input));
      controller.close();
    },
  });
  Object.defineProperty(Deno.stdin, "readable", {
    value: stream,
    configurable: true,
  });
  try {
    return await fn();
  } finally {
    Object.defineProperty(Deno.stdin, "readable", {
      value: original,
      configurable: true,
    });
  }
}

Deno.test("acquiesce CLI initialises cache from stdin payload", async () => {
  await withHarness(async () => {
    await pipeStdin("HELLO=world\n", async () => {
      const r = await runCli(["acquiesce"]);
      assertEquals(r.code, 0);
      assertStringIncludes(r.stdout!, "Cache initialized");
    });
  });
});

Deno.test("status CLI reports active cache after acquiesce", async () => {
  await withHarness(async () => {
    await pipeStdin("X=1\n", () => runCli(["acquiesce"]));
    const r = await runCli(["status"]);
    assertEquals(r.code, 0);
    assertStringIncludes(r.stdout!, "Cache active");
  });
});

Deno.test("keepass cli requires sub/db/group", async () => {
  const r = await runCli(["keepass"]);
  assertEquals(r.code, 2);
  assertStringIncludes(r.stderr!, "usage");
});

Deno.test("keepass list cli routes through runner", async () => {
  setKeepassRunner({
    // deno-lint-ignore require-await
    async run() {
      return { code: 0, stdout: "alpha\nbeta\n", stderr: "" };
    },
  });
  await pipeStdin("pwd\n", async () => {
    const r = await runCli(["keepass", "list", "safe.kdbx", "/dev"]);
    assertEquals(r.code, 0);
    assertStringIncludes(r.stdout!, "alpha");
  });
  setKeepassRunner(null);
});

Deno.test("keepass dump cli produces KEY=VALUE", async () => {
  let phase = 0;
  setKeepassRunner({
    // deno-lint-ignore require-await
    async run(args) {
      if (args[0] === "ls") {
        return { code: 0, stdout: "alpha\n", stderr: "" };
      }
      phase++;
      return { code: 0, stdout: "v1\n", stderr: "" };
    },
  });
  await pipeStdin("pwd\n", async () => {
    const r = await runCli(["keepass", "dump", "safe.kdbx", "/dev"]);
    assertEquals(r.code, 0);
    assertStringIncludes(r.stdout!, "ALPHA=v1");
  });
  assertEquals(phase, 1);
  setKeepassRunner(null);
});

Deno.test("keepass cli unknown subcommand exits 2", async () => {
  await pipeStdin("pwd\n", async () => {
    const r = await runCli(["keepass", "wat", "db", "g"]);
    assertEquals(r.code, 2);
    assertStringIncludes(r.stderr!, "unknown keepass subcommand");
  });
});

Deno.test("keepass cli surfaces runner error as code 1", async () => {
  setKeepassRunner({
    // deno-lint-ignore require-await
    async run() {
      return { code: 1, stdout: "", stderr: "kaboom" };
    },
  });
  await pipeStdin("pwd\n", async () => {
    const r = await runCli(["keepass", "list", "db", "g"]);
    assertEquals(r.code, 1);
    assertStringIncludes(r.stderr!, "kaboom");
  });
  setKeepassRunner(null);
});
