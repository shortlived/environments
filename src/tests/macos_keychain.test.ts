import { assertEquals, assertRejects } from "@std/assert";
import { macosKeychain, type SecurityRunner } from "../keychain/macos.ts";

function fakeStore(): {
  runner: SecurityRunner;
  state: Map<string, string>;
  calls: string[][];
} {
  const state = new Map<string, string>();
  const calls: string[][] = [];
  const runner: SecurityRunner = async (args) => {
    await Promise.resolve();
    calls.push(args);
    const [verb] = args;
    const a = args.indexOf("-a");
    const name = a !== -1 ? args[a + 1] : "";
    if (verb === "find-generic-password") {
      const v = state.get(name);
      return v
        ? { code: 0, stdout: v + "\n", stderr: "" }
        : { code: 44, stdout: "", stderr: "not found" };
    }
    if (verb === "add-generic-password") {
      const w = args.indexOf("-w");
      state.set(name, args[w + 1]);
      return { code: 0, stdout: "", stderr: "" };
    }
    if (verb === "delete-generic-password") {
      state.delete(name);
      return { code: 0, stdout: "", stderr: "" };
    }
    return { code: 1, stdout: "", stderr: "unknown" };
  };
  return { runner, state, calls };
}

Deno.test("macosKeychain set/get/delete via fake security runner", async () => {
  const { runner, state } = fakeStore();
  const kc = macosKeychain("kpsc-test", runner);
  assertEquals(await kc.get("missing"), null);
  await kc.set("x", "secret");
  assertEquals(state.get("x"), "secret");
  assertEquals(await kc.get("x"), "secret");
  await kc.delete("x");
  assertEquals(state.has("x"), false);
});

Deno.test("macosKeychain throws when security add fails", async () => {
  const runner: SecurityRunner = async () => {
    await Promise.resolve();
    return { code: 1, stdout: "", stderr: "boom" };
  };
  const kc = macosKeychain("kpsc-test", runner);
  await assertRejects(() => kc.set("y", "v"));
});
