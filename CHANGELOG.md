# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/) and the project version
exposed by `kpsc version` is sourced from `deno.json` via `mise run build`.

## [Unreleased]

### Added — Short-Lived Environments (`kpsc`)

The repository now hosts the **`kpsc`** ("KeePass Secret Cache") short-lived
environment toolkit. Highlights:

- **Deno 2 binary `kpsc`** with subcommands:
  - `acquiesce` — read `KEY=VALUE\n…` from stdin, encrypt into the cache,
    rotate session state.
  - `push <command>` — decrypt cache, exec target with secrets injected
    as environment variables (never argv).
  - `rotate` — invalidate the cache by rotating systemhash + session_nonce
    + session_start.
  - `status` — print TTL remaining without decrypting anything.
  - `keepass list|dump` — convenience wrappers around `keepassxc-cli`.
  - `version`, `help`.
- **Shell integration** for fish, bash, and zsh:
  - `.util.keepass.token.get`
  - `.util.keepass.hash.system`
  - `.util.keepass.acquiesce <token> <path>`
  - `.util.keepass.day.hash`
  - `.util.keepass.dir.acquiesce <group>`
  - `.util.secrets.push "<program> [args…]"`
  - `.util.kpsc.exec`, `.util.kpsc.with`, `.util.kpsc.terraform`,
    `.util.kpsc.bicep` (helpers for environment-acquiesced program runs).
  - Completions for all three shells.
  - fish keybindings (`conf.d/kpsc.fish`) for `Alt+0` / `Alt+9` / `F1`.
- **Cryptography**:
  - AES-256-GCM (Web Crypto) for both `decr.py` and `dict.py`.
  - HMAC-SHA256 (compiletimehash key) for the `dayhashCBC` directory name —
    deterministic yet unguessable without the keying material.
  - 12-byte random nonces prepended to every ciphertext blob.
- **Keychain abstraction** with two backends:
  - `macos-security` (production; `/usr/bin/security` CLI).
  - `file` (encrypted-at-rest fallback for CI/Linux dev).
- **CI pipelines**:
  - `.github/workflows/kpsc-ci.yml` — lint, fmt, typecheck, test, 80% line
    coverage gate, plus a macOS smoke compile.
  - `.github/workflows/kpsc-build-release.yml` — Apple Silicon + Intel
    `deno compile`, GitHub Release upload, brew formula regeneration,
    `kpsc-secrets` repo update.
- **Brew tap formula template** at `tap/Formula/kpsc.rb`.
- **Documentation**:
  - `docs/API.md` — exhaustive CLI and shell API reference.
  - `README.md` updated with usage, architecture, threat model, runbook,
    and rationale (see `Short-Lived Environments` section).
- **Tests**: 90+ Deno test cases across unit, integration, CLI, shell-layer,
  and CI-workflow surfaces; line coverage measured at ≥85%.

### Notes

- The shell-layer keybindings default to `Alt+0`/`Alt+9` because fish and
  most terminal emulators cannot disambiguate `Ctrl+0`/`Ctrl+9` from
  unmodified digit keys. Users can override in their own
  `conf.d/kpsc.local.fish`.
- The `compiletimehash` is gitignored at `src/constants/compiletimehash.ts`
  and injected only by CI prior to `deno compile`. On developer machines
  the binary falls back to `"DEV"` so it remains obviously unsuitable for
  production.

---

## v0.1.4

### Added

- **mise.toml** — all tools (Deno 2.0.2, Node 22) and tasks managed by mise
- **Tag management from remote** — `tag:fetch`, `tag:remote`, `tag:sync`,
  `tag:clean` (only deletes local tags if remote has none)
- **Bump tasks read from git remote** — `bump:patch`, `bump:minor`,
  `bump:major`, `bump:build` all fetch the latest remote tag before computing
  the next version
- **`vcs:release`** — fast-forward main to develop (linear rebase) and push
- **`vcs:protect`** — apply branch protection ruleset to both develop and main
  in a single GitHub API call
- **`gh:token`** — display gh CLI auth status; token stays in memory only
- **`scan:ghas`** — trigger GitHub Advanced Security (CodeQL) scan via
  workflow dispatch; also runs weekly on schedule
- **`completions`** — unified task that detects shell (bash/zsh/fish), prompts
  for install location, and writes completion files
- **`project:init`** — full init flow: tag sync → version init → version sync
  → secrets bootstrap
- **GHAS workflow** — `.github/workflows/ghas-scan.yml` (CodeQL analysis,
  manual dispatch + weekly schedule)
- **CHANGELOG.md** — this file

### Changed

- **Bump tasks** now fetch latest version from git remote instead of reading
  `.semver.*` cache files — eliminates stale-version bugs where cached tags
  delayed version bumps
- **Makefile** reduced to a thin alias layer; all logic lives in `mise.toml`
- **`deno.json` tasks** cleaned up — removed circular `make` references
- **lefthook.yml** hooks use `mise run` commands
- **README** fully rewritten with task reference tables

### Removed

- `.semver.version.tag`, `.semver.build.tag`, `.semver.commit.tag`,
  `.semver.author.gpg.tag` — flat-file version caches eliminated
- `.dvmrc` — replaced by `mise.toml` `[tools]`
- Old shell scripts: `bump_*.sh`, `version.sh`, `scan.sh`, `setup_brew.sh`,
  `setup_fish.sh`, `bin.sh`, `copy_template.sh`, `set_paths.sh`,
  `set_template.sh`, `docker_build.sh`
- Interactive prompts from build scripts
