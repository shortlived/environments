/**
 * kpsc — KeePass Secret Cache
 *
 * Entry point for the compiled binary. All real logic lives in `cli.ts`;
 * this module just dispatches and wires stdout/stderr.
 */

import { runCli } from "./cli.ts";

if (import.meta.main) {
  const result = await runCli(Deno.args);
  if (result.stdout) {
    await Deno.stdout.write(new TextEncoder().encode(result.stdout));
  }
  if (result.stderr) {
    await Deno.stderr.write(new TextEncoder().encode(result.stderr));
  }
  Deno.exit(result.code);
}

export { runCli };
