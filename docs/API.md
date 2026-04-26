# kpsc — CLI API Reference

This document is the canonical, exhaustive reference for the `kpsc`
("KeePass Secret Cache") binary and its companion shell layers (fish, bash,
zsh). It is generated alongside the [README](../README.md) and
[CHANGELOG](../CHANGELOG.md); any change to behaviour MUST land in lockstep
with an update here.

> **Stability:** unstable until `kpsc-v1.0.0`. Subcommand surfaces, exit
> codes, and environment variables documented in this file are observed by
> the test suite (see `src/tests/ci_workflow.test.ts` and
> `src/tests/cli*.test.ts`).

---

## 1. Binary surface

```
kpsc <subcommand> [args…]
```

| Subcommand                       | Stdin           | Effect                                                         | Exit codes |
|----------------------------------|-----------------|----------------------------------------------------------------|-----------:|
| `kpsc acquiesce`                 | `KEY=VALUE\n…`  | Encrypts payload into the cache, rotates session state.        | 0          |
| `kpsc push <command-string>`     | inherited       | Decrypts cache, execs target with secrets injected as env.     | child rc / 1 / 2 |
| `kpsc rotate`                    | none            | Forces a fresh systemhash + session_nonce + session_start.     | 0          |
| `kpsc status`                    | none            | Prints active/expired/missing state with TTL remaining.        | 0 / 1      |
| `kpsc keepass list <db> <group>` | password line   | Lists entry names directly under `<group>`.                    | 0 / 1 / 2  |
| `kpsc keepass dump <db> <group>` | password line   | Emits `KEY=VALUE\n` for every entry's password under `<group>`.| 0 / 1 / 2  |
| `kpsc version`                   | none            | Prints the binary's `version.ts` value.                        | 0          |
| `kpsc help`                      | none            | Prints usage block.                                            | 0          |

### 1.1 `kpsc acquiesce`

Reads the entire stdin into memory, parses it as
[`KEY=VALUE`](#payload-format), and produces:

```
$KPSC_CACHE_ROOT/$dayhashB64/decr.py     ← AES-GCM blob (key = decr_key)
$KPSC_CACHE_ROOT/$dayhashCBC/dict.py     ← AES-GCM blob (key = super_secret)
```

Side effects:

* Generates a fresh 32-byte `super_secret` and embeds it in the rendered
  `decr.py` (encrypted at rest).
* Calls `rotateSession()` → writes new `kpsc.systemhash`, `kpsc.session_nonce`,
  and `kpsc.session_start` to the active keychain.
* `chmod 700` on both directories, `chmod 600` on both files.

Failure modes: any malformed `KEY=VALUE` line throws and the run aborts
without writing the cache.

### 1.2 `kpsc push <command-string>`

```
kpsc push "terraform plan -var-file=prod.tfvars"
```

Quoting is parsed via the built-in POSIX-ish tokenizer (single quotes,
double quotes, and `\` escapes are honoured). Pipes, redirects, and shell
operators are returned as ordinary tokens — wrap such usage in `bash -c`
explicitly.

Behaviour:

1. Reads `kpsc.session_start` from the keychain. If absent → `CacheMissingError`
   (exit 1). If older than `KPSC_TTL_SECONDS` → `CacheExpiredError` (exit 1).
2. Resolves `compiletimehash` (env > `gh auth token` > build constant).
3. Re-derives `dayhash_input`, `dayhashB64`, `dayhashCBC`, `decr_key`.
4. Decrypts `decr.py` → extracts `super_secret_hex` → decrypts `dict.py`.
5. Spawns the target command with `env = process.env ∪ secrets` and inherits
   stdin/stdout/stderr.
6. Returns the child's exit code.

Programmatically callable via `push(cmd, { dryRun: true })` to obtain the
resolved program/args/secrets without spawning — this is the contract used
by tests.

### 1.3 `kpsc rotate`

Generates fresh systemhash, session_nonce, session_start values. The old
`/tmp/$dayhashB64` and `/tmp/$dayhashCBC` directories are intentionally not
removed: their cache files become permanently undecryptable because the
keying material is already gone. The OS's normal `/tmp` cleanup will
eventually reclaim them.

### 1.4 `kpsc status`

Reads only `kpsc.session_start` and emits one of:

```
No active cache. Run acquiesce.
Cache active. TTL remaining: {N}s ({hh:mm:ss})
Cache expired. Run acquiesce.
```

Exit code is 0 iff the cache is active and within TTL.

### 1.5 `kpsc keepass list|dump`

Convenience helpers around `keepassxc-cli`. The KeePass database master
password is read from stdin (a single line, newline-terminated). The shell
wrappers always pipe it in so the password never appears in argv or env.

Output of `dump` is the canonical payload format consumed by `acquiesce`,
allowing the typical end-to-end pipeline:

```sh
printf '%s\n' "$pw" | kpsc keepass dump "$DB" /dev | kpsc acquiesce
```

---

## 2. Payload format

```
KEY=VALUE
ANOTHER_KEY=value with spaces is fine
DSN=postgres://u:p@h/d?ssl=true
# comments and blanks are ignored

QUOTED="double quotes are stripped"
SINGLE='same for single quotes'
```

* Keys must match `[A-Za-z_][A-Za-z0-9_]*`.
* Only the first `=` is the separator.
* Surrounding matched single or double quotes on the value are stripped.
* Lines beginning with `#` and blank lines are ignored.
* Bad keys, missing `=`, or unterminated quotes abort the run with an
  error.

---

## 3. Environment variables

| Variable                   | Default            | Purpose                                                        |
|----------------------------|--------------------|----------------------------------------------------------------|
| `KPSC_TTL_SECONDS`         | `28800`            | Cache lifetime in seconds (8 h).                               |
| `KPSC_KEYCHAIN_BACKEND`    | `auto`             | `auto` \| `macos` \| `file`. `auto` → `macos` on Darwin else `file`. |
| `KPSC_KEYCHAIN_SERVICE`    | `kpsc`             | `security` service name namespace.                             |
| `KPSC_FILE_KEYCHAIN_ROOT`  | `~/.config/kpsc/keychain` | Root directory when the file backend is active.         |
| `KPSC_CACHE_ROOT`          | `/tmp`             | Root for `$dayhashB64`/`$dayhashCBC` directories.              |
| `KPSC_GITHUB_API`          | `https://api.github.com` | API host for compiletimehash retrieval (Enterprise OK).  |
| `KPSC_SECRETS_REPO`        | `softdist/kpsc-secrets`   | Repo containing `compiletimehash.txt`.                  |
| `KPSC_SECRETS_PATH`        | `compiletimehash.txt`     | Path inside the secrets repo.                          |
| `KPSC_GH_TOKEN_ENV`        | `GH_TOKEN`         | Name of the env var holding an override gh token.              |
| `KPSC_COMPILETIMEHASH`     | unset              | Force the compiletimehash bytes (CI/test only).                |
| `KPSC_GH_TOKEN`            | unset              | Used in the dayhash material as `gh_auth_token` placeholder.   |

All variables follow 12-factor: read-only at process start, no globals
mutated for runtime side effects.

---

## 4. Shell layer API

### 4.1 fish (canonical names)

```
.util.keepass.token.get                      → safe location token (file read)
.util.keepass.hash.system                    → kpsc status
.util.keepass.acquiesce <token> <path>       → single-secret pull (pipe to consumer)
.util.keepass.day.hash                       → kpsc acquiesce (stdin pre-piped)
.util.keepass.dir.acquiesce <group>          → batch pull + cache seal
.util.secrets.push   "<program> [args…]"     → kpsc push
.util.kpsc.exec      <args…>                 → low-level kpsc invoker
.util.kpsc.with      <program> [args…]       → ergonomic argv-passthrough push
.util.kpsc.terraform [args…]                 → .util.kpsc.with terraform
.util.kpsc.bicep     [args…]                 → .util.kpsc.with bicep
```

Keybindings (configurable, see `shell/fish/conf.d/kpsc.fish`):

```
Alt+0  → .util.keepass.dir.acquiesce generic
Alt+9  → .util.keepass.dir.acquiesce artifactory
F1     → .util.keepass.hash.system
```

### 4.2 bash

Bash cannot bind dot-prefixed function names to keys reliably, so every
`.util.*` function is exposed under two names:

```
util_keepass_token_get          ↔ .util.keepass.token.get
util_keepass_hash_system        ↔ .util.keepass.hash.system
util_keepass_acquiesce          ↔ .util.keepass.acquiesce
util_keepass_day_hash           ↔ .util.keepass.day.hash
util_keepass_dir_acquiesce      ↔ .util.keepass.dir.acquiesce
util_secrets_push               ↔ .util.secrets.push
util_kpsc_with                  ↔ .util.kpsc.with
util_kpsc_terraform             ↔ .util.kpsc.terraform
util_kpsc_bicep                 ↔ .util.kpsc.bicep
```

Completions ship in `shell/bash/kpsc-completion.bash`.

### 4.3 zsh

Identical surface to fish — zsh permits dotted function names natively.
Completion is provided by `shell/zsh/_kpsc` (drop into any directory in
`$fpath`).

---

## 5. Cryptographic contract

```
dayhash_input  = day || month || year
                || systemhash         (32 random bytes, keychain)
                || session_nonce      (32 random bytes, keychain)
                || gh_auth_token      (opaque bytes)
                || compiletimehash    (private repo bytes)

dayhashB64     = Base64URL(dayhash_input)
dayhashCBC     = Base64URL(HMAC-SHA256(key=compiletimehash, data=dayhash_input))

decr_key       = SHA-256(dayhashCBC || dayhashB64 || compiletimehash)
super_secret   = 32 random bytes (per-acquiesce)

decr.py blob   = AES-256-GCM(decr_key, render_decr_template(super_secret))
dict.py blob   = AES-256-GCM(super_secret, JSON.stringify(secrets))
```

Both ciphertext blobs prepend a 12-byte random nonce. AES-GCM authentication
tags catch tampering — there is no separate MAC.

---

## 6. Exit codes (binary)

| Code | Meaning                                                     |
|-----:|-------------------------------------------------------------|
| 0    | Success.                                                    |
| 1    | Operation failed (e.g. cache expired/missing, KeePass error). |
| 2    | Usage error (missing args, unknown subcommand).             |
| ≥126 | Forwarded child process exit code from `kpsc push`.         |

---

## 7. Programmatic API (Deno)

```ts
import {
  acquiesce, push, rotate, status, keepassDump, runCli,
} from "@softdist/orchestras";
```

The module exports `runCli(argv: string[]): Promise<CliResult>` — the same
function used by the binary. Tests in `src/tests/` exercise this surface
directly, so any documented behaviour is observable from a Deno program.
