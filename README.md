<!-- markdownlint-disable MD041 MD012 -->

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
