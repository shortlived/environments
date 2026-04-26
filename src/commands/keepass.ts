/**
 * `kpsc keepass …` — convenience wrappers around the KeePass CLI (`keepassxc-cli`).
 *
 * These are thin orchestrators: the real auth logic lives in the shell layer
 * (which prompts for the password and pipes it to keepassxc-cli). The kpsc
 * binary exposes them so all three shells can target a single, audited
 * implementation rather than reimplementing the keepass-cli invocation per
 * shell.
 *
 * Two subcommands:
 *
 *   kpsc keepass list <db> <group>
 *      → prints "<entry>\n<entry>\n…" of all entries directly under <group>.
 *
 *   kpsc keepass dump <db> <group>
 *      → prints "KEY=VALUE" lines for every entry's password under <group>,
 *        using the entry title (uppercased, hyphens → underscores) as KEY.
 *
 * In both cases the master password is read from stdin (newline-terminated),
 * matching keepassxc-cli's own behaviour. No password is ever written to a
 * file, an env var, or a process argument.
 */

const dec = new TextDecoder();

export interface KeepassRunner {
  run(
    args: string[],
    stdin: string,
  ): Promise<{ code: number; stdout: string; stderr: string }>;
}

const realRunner: KeepassRunner = {
  async run(args, stdin) {
    const cmd = new Deno.Command("keepassxc-cli", {
      args,
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });
    const child = cmd.spawn();
    const w = child.stdin.getWriter();
    await w.write(new TextEncoder().encode(stdin));
    await w.close();
    const out = await child.output();
    return {
      code: out.code,
      stdout: dec.decode(out.stdout),
      stderr: dec.decode(out.stderr),
    };
  },
};

let _runner: KeepassRunner = realRunner;

export function setKeepassRunner(r: KeepassRunner | null): void {
  _runner = r ?? realRunner;
}

/** List entries directly under `group` in `db`. Password read from stdin. */
export async function keepassList(
  db: string,
  group: string,
  password: string,
): Promise<string[]> {
  const r = await _runner.run(["ls", "-q", db, group], password + "\n");
  if (r.code !== 0) {
    throw new Error(`keepassxc-cli ls failed: ${r.stderr.trim()}`);
  }
  return r.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s !== "" && !s.endsWith("/"));
}

/** Read one entry's password (the only field kpsc cares about). */
export async function keepassShow(
  db: string,
  entryPath: string,
  password: string,
): Promise<string> {
  const r = await _runner.run(
    ["show", "-q", "-s", "-a", "Password", db, entryPath],
    password + "\n",
  );
  if (r.code !== 0) {
    throw new Error(`keepassxc-cli show failed: ${r.stderr.trim()}`);
  }
  return r.stdout.replace(/\r?\n$/, "");
}

/** Iterate `group` and emit a payload string of KEY=VALUE pairs. */
export async function keepassDump(
  db: string,
  group: string,
  password: string,
): Promise<string> {
  const entries = await keepassList(db, group, password);
  const lines: string[] = [];
  for (const entry of entries) {
    const value = await keepassShow(db, `${group}/${entry}`, password);
    const key = entry.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    lines.push(`${key}=${value}`);
  }
  return lines.join("\n") + (lines.length > 0 ? "\n" : "");
}
