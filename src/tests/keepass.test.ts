import { assertEquals, assertRejects } from "@std/assert";
import {
  type KeepassRunner,
  keepassDump,
  keepassList,
  keepassShow,
  setKeepassRunner,
} from "../commands/keepass.ts";

class FakeRunner implements KeepassRunner {
  public calls: { args: string[]; stdin: string }[] = [];
  constructor(
    private respond: (
      args: string[],
      stdin: string,
    ) => { code: number; stdout: string; stderr: string },
  ) {}
  // deno-lint-ignore require-await
  async run(args: string[], stdin: string) {
    this.calls.push({ args, stdin });
    return this.respond(args, stdin);
  }
}

Deno.test("keepassList parses entry names and trims trailing dirs", async () => {
  const fake = new FakeRunner(() => ({
    code: 0,
    stdout: "github_token\njfrog_pypi\nold_dir/\n",
    stderr: "",
  }));
  setKeepassRunner(fake);
  const r = await keepassList("safe.kdbx", "/dev", "pw");
  assertEquals(r, ["github_token", "jfrog_pypi"]);
  assertEquals(fake.calls[0].args, ["ls", "-q", "safe.kdbx", "/dev"]);
  assertEquals(fake.calls[0].stdin, "pw\n");
  setKeepassRunner(null);
});

Deno.test("keepassShow returns the password line", async () => {
  setKeepassRunner(new FakeRunner(() => ({ code: 0, stdout: "ssss\n", stderr: "" })));
  const v = await keepassShow("safe.kdbx", "/dev/x", "pw");
  assertEquals(v, "ssss");
  setKeepassRunner(null);
});

Deno.test("keepassDump emits KEY=VALUE lines", async () => {
  let n = 0;
  setKeepassRunner(
    new FakeRunner((args) => {
      if (args[0] === "ls") {
        return { code: 0, stdout: "alpha\nbeta-key\n", stderr: "" };
      }
      n++;
      return { code: 0, stdout: `value${n}\n`, stderr: "" };
    }),
  );
  const out = await keepassDump("safe.kdbx", "/dev", "pw");
  assertEquals(out, "ALPHA=value1\nBETA_KEY=value2\n");
  setKeepassRunner(null);
});

Deno.test("keepassList surfaces non-zero exit", async () => {
  setKeepassRunner(
    new FakeRunner(() => ({ code: 1, stdout: "", stderr: "bad password" })),
  );
  await assertRejects(() => keepassList("a", "/g", "p"));
  setKeepassRunner(null);
});
