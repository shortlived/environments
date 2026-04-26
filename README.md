<!-- markdownlint-disable MD041 MD012 -->

# kpsc — KeePass Secret Cache (Short-Lived Environments)

> Time-boxed encrypted secret injection. The KeePass safe opens for seconds,
> closes immediately, and any program you run afterward gets its secrets as
> child-process environment variables only — never in shell history, argv,
> a process tree, or a long-lived shell session.

`kpsc` is the **Short-Lived Environments (SLE)** toolkit: a small Deno 2
binary plus thin fish/bash/zsh wrappers that pull a folder of KeePass
entries in one batch, encrypt them with a key only the binary can derive,
and inject them on demand into individual child processes. Designed to keep
secrets out of every place an AI coding agent (or anything else with shell
access) might read them.

[![kpsc CI](https://img.shields.io/github/actions/workflow/status/softdist/kpsc/kpsc-ci.yml?branch=develop&label=kpsc%20CI)](.github/workflows/kpsc-ci.yml)
[![Build & Release](https://img.shields.io/github/actions/workflow/status/softdist/kpsc/kpsc-build-release.yml?label=release)](.github/workflows/kpsc-build-release.yml)

- **API reference**: [`docs/API.md`](docs/API.md)
- **Changelog**: [`CHANGELOG.md`](CHANGELOG.md)

---

## Why this exists

KeePass keeps secrets safe at rest. Most shell workflows don't keep them
short-lived once you've opened the safe — they end up in `~/.bashrc`-style
exports, in `direnv` files, in process arguments, in shell history, or
just persistently sourced into the shell that an AI agent runs in.

`kpsc` reduces the live-secret window to "the few seconds the safe is
open". After that, the secrets exist only as encrypted blobs in `/tmp`
keyed by material the calling shell does not (and cannot) know. Each
program invocation opens a fresh sealed envelope, runs the program with
the secrets in its environment, then exits — secrets never persist in any
parent shell.

## Architecture in one diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ FISH / BASH / ZSH LAYER  (readable on the work machine)         │
│   .util.keepass.token.get        → safe location token          │
│   .util.keepass.hash.system      → kpsc status                  │
│   .util.keepass.acquiesce        → single secret pull           │
│   .util.keepass.day.hash         → trigger cache init           │
│   .util.keepass.dir.acquiesce    → batch pull + seal cache      │
│   .util.secrets.push             → run program with secrets     │
│   .util.kpsc.with / terraform / bicep — env-acquiesced helpers  │
├─────────────────────────────────────────────────────────────────┤
│ ← HARD BOUNDARY: everything below is opaque to the shell →      │
├─────────────────────────────────────────────────────────────────┤
│ DENO BINARY  (compiled on a separate MacBook, brew tap install) │
│   acquiesce | push | rotate | status | keepass list/dump        │
│   knows: dayhash formula, compiletimehash retrieval, keychain   │
│          I/O, AES-256-GCM, child-process env injection          │
├─────────────────────────────────────────────────────────────────┤
│ ENCRYPTED CACHE (ephemeral, /tmp only)                          │
│   /tmp/$dayhashB64/decr.py    AES-GCM(decr_key, … super_secret) │
│   /tmp/$dayhashCBC/dict.py    AES-GCM(super_secret, secrets)    │
└─────────────────────────────────────────────────────────────────┘
```

The shell layer is trivial: just enough fish/bash/zsh to talk to KeePass,
prompt for the password, and pipe payloads to the binary. The binary
holds every cryptographic invariant.

## Quick start

```sh
# 1. Install
brew tap softdist/softdist
brew install softdist/softdist/kpsc

# 2. Drop the shell layer into place (pick the shell you use)
ln -s "$(brew --prefix)/share/kpsc/fish/functions/"*.fish ~/.config/fish/functions/
ln -s "$(brew --prefix)/share/kpsc/fish/conf.d/kpsc.fish"  ~/.config/fish/conf.d/
ln -s "$(brew --prefix)/share/kpsc/fish/completions/"*.fish ~/.config/fish/completions/

# 3. Make sure gh is authenticated
gh auth login

# 4. Try it
kpsc status                       # → "No active cache. Run acquiesce."
.util.keepass.dir.acquiesce dev   # → prompts password, seals the cache
.util.secrets.push "terraform plan -var-file=prod.tfvars"
kpsc status                       # → TTL remaining
```

`Alt+0` and `Alt+9` are bound (in fish) to seal the `generic` and
`artifactory` folders respectively. Customise in your own
`~/.config/fish/conf.d/kpsc.local.fish`.

## Day-to-day usage

```sh
# Re-seal whenever your secrets change in KeePass
kpsc rotate
.util.keepass.dir.acquiesce dev

# Run any program with the cached secrets in its environment, scoped
# strictly to that child process:
.util.secrets.push "docker build --build-arg=NPM_TOKEN ."
.util.kpsc.terraform plan
.util.kpsc.bicep build infra.bicep

# Check how long the cache has left
kpsc status                       # → "Cache active. TTL remaining: 24103s (06:41:43)"
```

## Threat model (summary — see `docs/API.md` for full detail)

| Threat                                          | Mitigation                                                       |
|-------------------------------------------------|------------------------------------------------------------------|
| AI agent reads shell functions to learn algo   | Algorithm lives only inside the compiled Deno binary             |
| AI agent reads `/tmp` cache files               | AES-256-GCM; unreadable without all five key components          |
| `ps aux` snooping on secrets                    | Secrets pass via stdin pipes and child env, never argv           |
| Long-lived open safe                            | Safe is opened for seconds, closed before pipe is read           |
| Cache survives suspend/resume                   | TTL=8h measured from acquiesce; `kpsc rotate` zeroes immediately |
| Bit-flipping the cache files                   | AES-GCM authentication tag detects tampering                     |
| Compromised binary swap                         | Brew formula pins SHA-256 of every release artifact              |

The single residual risk is full macOS Keychain compromise (admin/biometric
required) — outside scope for any secret-management tool.

## Repository layout

```
src/
  cli.ts                        Subcommand router
  mod.ts                        Binary entry point
  commands/                     acquiesce, push, rotate, status, keepass
  crypto/                       aes.ts (AES-GCM), dayhash.ts (HMAC-SHA256)
  keychain/                     macos.ts, file.ts, session.ts, select.ts
  github/compiletimehash.ts     gh auth token + GitHub API runtime fetch
  python/decr_template.ts       decr.py template + super_secret extraction
  cache/paths.ts                /tmp directory layout
  secrets/parse.ts              KEY=VALUE payload parser
  constants/                    config.ts, compiletimehash.ts (gitignored)
  util/zeroize.ts               best-effort buffer scrubbing
  tests/                        Deno test suite (90+ cases, ≥85% line cov)
shell/
  fish/{functions,completions,conf.d}/
  bash/{kpsc.bash,kpsc-completion.bash}
  zsh/{kpsc.zsh,_kpsc}
tap/Formula/kpsc.rb             Brew formula template (CI rewrites on release)
.github/workflows/
  kpsc-ci.yml                   Lint + typecheck + test + 80% coverage gate
  kpsc-build-release.yml        deno compile → release → tap update
docs/API.md                     Canonical CLI / shell API reference
CHANGELOG.md
```

## Releasing

Tag with the `kpsc-vX.Y.Z` prefix (kept distinct from the template's
semver tags) and push:

```sh
git tag kpsc-v1.0.0
git push origin kpsc-v1.0.0
```

CI will compile both architectures, upload the release artifacts, push a
fresh `compiletimehash` to the `kpsc-secrets` repo, and rewrite the
`Formula/kpsc.rb` in the brew tap. Work-machine users update with:

```sh
brew upgrade softdist/softdist/kpsc
kpsc rotate          # invalidate the old cache
.util.keepass.dir.acquiesce dev   # re-seal with new keying material
```

## Required CI secrets

| Secret                      | Where           | Purpose                                  |
|-----------------------------|-----------------|------------------------------------------|
| `COMPILETIMEHASH`           | repo secret     | Embedded into binary build               |
| `KPSC_SECRETS_DEPLOY_KEY`   | repo secret     | Push compiletimehash to `kpsc-secrets`   |
| `HOMEBREW_TAP_DEPLOY_KEY`   | repo secret     | Push the formula to the brew tap         |
| `KPSC_SECRETS_REPO`         | repo variable   | Override default repo (optional)         |
| `HOMEBREW_TAP_REPO`         | repo variable   | Override default tap repo (optional)     |

---

## Underlying template

The repository was bootstrapped from the
[orchestras/deno](https://github.com/orchestras/deno) template, whose
features remain available below.

---

# orchestras/deno

> Deno TypeScript template — Deno · Mise · GHAS · GitHooks · JSR/npm

A batteries-included Deno project template modelled after [orchestras/python3](https://github.com/orchestras/python3). All automation lives in `.mise/tasks/` as executable scripts, making tasks portable for the upcoming `mise-sync` engine. Git hooks are managed via the `deno1a` channel in [orchestras/dev-patterns](https://github.com/orchestras/dev-patterns).

[![CI](https://img.shields.io/github/actions/workflow/status/orchestras/deno/ci.yml?branch=develop&label=CI)](../../actions/workflows/ci.yml)
[![GHAS](https://img.shields.io/github/actions/workflow/status/orchestras/deno/ghas-scan.yml?label=GHAS)](../../actions/workflows/ghas-scan.yml)
[![mise](https://img.shields.io/badge/managed%20by-mise-blue)](https://mise.jdx.dev/)
[![JSR](https://jsr.io/badges/@softdist/orchestras)](https://jsr.io/@softdist/orchestras)

---

## Features

| Tool | Role |
|------|------|
| [Deno 2](https://deno.com) | TypeScript runtime + built-in lint/fmt/test/check |
| [Mise](https://mise.jdx.dev) | Tool version manager + task runner |
| [Lefthook](https://lefthook.dev) | Git hook manager |
| [GHAS / CodeQL](https://github.com/features/security) | GitHub Advanced Security scanning |
| [Dependabot](https://docs.github.com/en/code-security/dependabot) | Automated dependency updates |
| [dev-patterns deno1a](https://github.com/orchestras/dev-patterns) | Shared hooks + task channel |

---

## Quick Start

```bash
# 1. Install mise
curl https://mise.run | sh
echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc && source ~/.bashrc

# 2. Clone and initialise
git clone https://github.com/orchestras/deno my-project
cd my-project

# 3. Full project init (installs tools, syncs version, configures git, installs hooks)
mise run project:init

# 4. Run the app
mise run run
```

---

## Task Reference

Run `mise tasks` to list all tasks with descriptions. All tasks live in `.mise/tasks/`.

### Development

```bash
mise run execute      # deno run src/mod.ts
mise run build        # sync version.ts from deno.json
mise run install      # cache all Deno dependencies
```

### Code Quality

```bash
mise run lint:check   # deno lint
mise run lint:fix     # deno lint --fix
mise run fmt:fix      # deno fmt
mise run fmt:check    # deno fmt --check (CI-safe)
mise run typecheck    # deno check src/mod.ts
```

### Testing

```bash
mise run test         # deno test -A --reporter=pretty
```

### CI

```bash
mise run ci           # full pipeline: lint:check → fmt:check → typecheck → test → build → execute
```

### Scanning & SAST

```bash
mise run scan:deps        # deno audit — known vulnerability check
mise run scan:sast        # deno lint with security + hardcoded-secret heuristics
mise run scan:complexity  # cyclomatic complexity analysis
mise run scan:ghas        # trigger CodeQL via mise (local dispatch)
```

### Version Bumping

```bash
mise run version:show       # show current version
mise run bump:patch         # v0.1.5 → v0.1.6  (auto-cascades at 9)
mise run bump:minor         # v0.1.5 → v0.2.0
mise run bump:major         # v0.1.5 → v1.0.0
mise run bump:prerel alpha  # v0.1.5 → v0.1.5-alpha.1
mise run tag:push           # push tags → triggers release.yml
```

### Dispatch Workflows

```bash
mise run dispatch:autobump [auto|patch|minor|major] [--dry-run]
# → triggers dispatch-autobump-release.yml on GitHub Actions

mise run dispatch:configure [--dry-run]
# → triggers dispatch-autoconfigure-rulesets.yml (3 branch rulesets)

mise run dispatch:ghas
# → triggers ghas-scan.yml
```

### Git & VCS

```bash
mise run git:config              # configure delta, GPG, rebase-only, hooks path
mise run vcs:rebase              # rebase feature branch onto origin/develop
mise run vcs:integrate feat/xyz  # integrate feature → develop (rebase, no merge commits)
mise run vcs:release             # release develop → main (rebase + force push)
mise run vcs:protect             # apply 3 branch rulesets via GitHub API
```

### Git Hooks & Patterns

```bash
mise run hooks:sync     # sync hooks from orchestras/dev-patterns (deno1a channel)
mise run hooks:install  # register config/githooks/hooks path in git config
mise run patterns:sync  # full sync: hooks + record .patterns-hash
```

### Binary Compilation

```bash
mise run deno:compile   # cross-compile binaries for all 5 platforms to ./bin/
```

> For automated cross-platform release binaries, push a version tag — the
> [release workflow](.github/workflows/release.yml) compiles on Linux AMD64/ARM64,
> macOS ARM64/AMD64, and Windows AMD64 in parallel and publishes a GitHub Release.

---

## Project Structure

```
.
├── .devcontainer/           # VS Code Dev Container
├── .github/
│   ├── workflows/           # CI/CD pipelines
│   ├── dependabot.yml       # Dependabot config
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
├── .mise/
│   └── tasks/               # All mise tasks (executable scripts)
│       ├── run, test, typecheck, build, ci, install
│       ├── bump/patch, minor, major, prerel
│       ├── tag/push, list, sync, remote, fetch, create, clean
│       ├── vcs/rebase, integrate, release, protect
│       ├── version/show, sync, init
│       ├── scan/ghas, deps, sast
│       ├── hooks/sync, install
│       ├── git/config
│       ├── gh/token
│       ├── deno/compile, upgrade
│       ├── fmt/fix, check
│       ├── patterns/sync
│       ├── secrets/init, resolve
│       ├── npm/set-registry, reset-registry
│       ├── project/init
│       └── completions
├── config/
│   └── githooks/
│       ├── hooks/           # Git hooks (commit-msg, pre-commit, pre-push)
│       └── githooks.toml    # Channel manifest
├── scripts/                 # Shared bash utilities (colors, semver, secrets)
├── src/
│   ├── mod.ts               # Application entry point
│   ├── version.ts           # Auto-generated — do not edit
│   ├── make_version.ts      # Build script for version.ts
│   └── tests/
│       └── mod.test.ts      # Test suite
├── AGENTS.md                # AI agent instructions
├── CHANGELOG.md             # Changelog
├── CONTRIBUTING.md          # Contributor guide
├── deno.json                # Deno config (imports, lint, fmt, tasks)
├── lefthook.yml             # Lefthook git hook config
└── mise.toml                # Tool versions + task discovery
```

---

## Branch Workflow

```
feature/xyz → develop → main → tag → release
```

**No merge commits.** Every integration is a rebase.

### Keep your feature branch current

```bash
mise run vcs:rebase
# → git pull --rebase origin develop
```

### Integrate a feature branch into develop

```bash
mise run vcs:integrate feat/my-feature
# 1. Rebase feature onto origin/develop
# 2. git checkout develop && git pull
# 3. git rebase feat/my-feature
# 4. git push --force-with-lease origin develop
```

### Release develop → main

```bash
mise run vcs:release
# 1. git checkout main
# 2. git rebase origin/develop
# 3. git push --force-with-lease origin main
```

Then bump and tag:

```bash
mise run bump:patch   # (or :minor / :major)
mise run tag:push     # triggers binary + Docker release CI
```

---

## GitHub Status Checks Setup

For required status checks in branch rulesets to work:

1. Push this template to GitHub (on `develop` branch)
2. Open one PR to trigger the `pr-check` workflow — this registers the check names
3. Run `mise run vcs:protect` to apply the ruleset via GitHub API
4. The following checks will be required:
   - `pr-check / lint`
   - `pr-check / typecheck`
   - `pr-check / test`
   - `pr-check / security`

---

## Artifactory Promotion

Separate from VCS promotion. Operates on build artifacts:

```
GitHub Release → Artifactory DEV → UAT → PROD
```

See workflows: `artifactory-push-binary.yml`, `artifactory-push-image.yml`,
`promote-binary.yml`, `promote-image.yml`.

---

## Supported Platforms

darwin (amd64, arm64) · linux (amd64, arm64) · windows (amd64)

---

## License

MIT © [ørchestras](https://github.com/orchestras) 2025
