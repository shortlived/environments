# AGENTS.md

## Cursor Cloud Agent Instructions

### Overview

Deno 2.0.2 TypeScript template managed by **mise en place**. All tasks in
`.mise/tasks/` as executable scripts. Run `mise tasks` for the full
auto-documented list.

Patterns channel: **`deno1a`** from [orchestras/dev-patterns](https://github.com/orchestras/dev-patterns).

### Key commands

```sh
mise run execute        # run app
mise run lint:check     # lint
mise run lint:fix       # auto-fix lint issues
mise run fmt:check      # check formatting
mise run typecheck      # type-check
mise run test           # tests
mise run build          # regenerate version.ts
mise run ci             # full CI pipeline (lint:check → fmt:check → typecheck → test → build → execute)

mise run version:sync   # fetch remote tags, sync deno.json
mise run bump:patch     # bump from latest remote tag
mise run tag:push       # push tags to origin
mise run vcs:release    # rebase main onto develop, push
mise run scan:ghas      # trigger CodeQL scan (local)
mise run scan:sast      # SAST + secret heuristics
mise run scan:complexity  # complexity analysis
mise run dispatch:autobump [auto|patch|minor|major]  # trigger GitHub autobump workflow
mise run dispatch:configure  # trigger GitHub repo autoconfigure workflow
mise run hooks:sync     # sync hooks from orchestras/dev-patterns
```

### Task structure

All tasks live in `.mise/tasks/` as executable scripts (not inline TOML).
Task directories use `/` for namespacing:

- `execute`, `test`, `typecheck`, `build`, `ci`, `install` — core
- `lint/check`, `lint/fix` — lint tasks
- `dispatch/autobump`, `dispatch/configure`, `dispatch/ghas` — workflow triggers
- `bump/patch`, `bump/minor`, `bump/major`, `bump/prerel` — versioning
- `tag/push`, `tag/list`, `tag/sync`, `tag/fetch`, `tag/remote`, `tag/create`, `tag/clean`
- `vcs/rebase`, `vcs/integrate`, `vcs/release`, `vcs:protect`
- `version/show`, `version/sync`, `version/init`
- `scan/ghas`, `scan/deps`, `scan/sast`
- `hooks/sync`, `hooks/install`
- `git/config`, `gh/token`
- `deno/compile`, `deno/upgrade`
- `fmt/fix`, `fmt/check`
- `patterns/sync`
- `secrets/init`, `secrets/resolve`
- `npm/set-registry`, `npm/reset-registry`
- `project/init`, `completions`

### Version management

Version comes from git remote tags — no `.semver.*` caches. Bump tasks fetch
the latest tag from remote before computing the next version, commit
`deno.json` + `version.ts`, create the tag, but do NOT push automatically.
Use `mise run tag:push` to push after all commits are ready.

### Branching

Linear rebase model: `feature/*` → `develop` → `main`.

- `vcs:integrate` — merge feature into develop (rebase, no merge commits)
- `vcs:release` — fast-forward main to develop (rebase + force-push)
- Both branches protected by shared ruleset (`mise run vcs:protect`)

### Git Hooks

Hooks are in `config/githooks/hooks/`:
- `pre-commit` — fmt check, lint, debug-statement guard
- `commit-msg` — Conventional Commits validation
- `pre-push` — full test suite + type check

Register via: `mise run hooks:install` or `mise run git:config`
Sync latest from dev-patterns: `mise run hooks:sync`

### CI Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR/push to develop | Sequential full pipeline |
| `pr-check.yml` | PRs to develop/main | Parallel jobs (lint/typecheck/test/security) |
| `ghas-scan.yml` | push/PR/weekly | CodeQL + dependency review |
| `bump.yml` | push to main | Sync version.ts, create/push tag |
| `release.yml` | push `v*` tag | Cross-compile binaries + Docker + GitHub Release |
| `dependabot-auto-merge.yml` | Dependabot PRs | Auto-merge patch/minor |

### Required status checks (PR ruleset)

After first PR run, `mise run vcs:protect` registers:
- `pr-check / lint`
- `pr-check / typecheck`
- `pr-check / test`
- `pr-check / security`

### Makefile

Thin alias layer only. All logic is in `.mise/tasks/`.

### LEFTHOOK

Hooks call mise tasks. Use `LEFTHOOK=0` to skip.
