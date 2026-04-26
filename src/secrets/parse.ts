/**
 * KEY=VALUE secret payload parser.
 *
 * Accepts the format `KEY=VALUE\nKEY=VALUE\n...` produced by the fish/bash/zsh
 * acquiesce wrappers. Supports:
 *   - blank lines (ignored)
 *   - `# comment` lines (ignored)
 *   - values containing `=` (only the first `=` is the separator)
 *   - optional surrounding quotes on the value (single or double, stripped)
 *
 * Keys must match `[A-Za-z_][A-Za-z0-9_]*` so they are valid environment
 * variable names. Anything else throws.
 */

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseSecretsPayload(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq < 1) {
      throw new Error(`Malformed secret line (missing '='): ${redact(line)}`);
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1);

    if (!KEY_RE.test(key)) {
      throw new Error(`Invalid environment variable name: ${key}`);
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }
  return out;
}

function redact(s: string): string {
  if (s.length <= 8) return "***";
  return `${s.slice(0, 4)}…${s.slice(-2)}`;
}
