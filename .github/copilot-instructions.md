# Copilot Instructions for orchestras/deno template

## Project Overview

This is a Deno 2 TypeScript project template using Deno (runtime + toolchain),
Mise (task runner / tool manager), Lefthook (git hooks), and GHAS/CodeQL (security).

## Key Conventions

- **Runtime**: Deno 2 (`deno run`, `deno compile`, `deno task`)
- **Linter**: `deno lint` — enforces recommended + ban-untagged-todo rules
- **Formatter**: `deno fmt` — standard Deno formatter
- **Type checker**: `deno check` — full TypeScript type check
- **Test runner**: `deno test -A --reporter=pretty`
- **Task runner**: Mise (`mise run <task>`) — tasks are in `.mise/tasks/`
- **Version authority**: `deno.json` → synced to `src/version.ts` via `mise run build`
- **Import map**: JSR (`jsr:`) and npm (`npm:`) specifiers in `deno.json` imports

## Code Style

- Line width: 100 characters
- Indent: 2 spaces
- No explicit-any: allowed (excluded from lint rules)
- Use `export` for all public APIs
- `version.ts` is auto-generated — never edit manually

## Workflow

1. Feature branches off `develop`, rebased (never merged) via `mise run vcs:rebase`
2. PRs target `develop` — required status checks must pass (pr-check / lint, typecheck, test, security)
3. Releases: develop → main via `mise run vcs:release` → CI auto-tags → binaries compiled
4. Bumps: `mise run bump:patch/minor/major` (commits + tags locally), then `mise run tag:push`

## Tasks (in `.mise/tasks/`)

Run `mise tasks` to see all available tasks. Key ones:
- `mise run install`     — cache Deno deps
- `mise run ci`          — full CI pipeline
- `mise run lint`        — `deno lint`
- `mise run fmt:check`   — `deno fmt --check`
- `mise run fmt:fix`     — `deno fmt`
- `mise run typecheck`   — `deno check src/mod.ts`
- `mise run test`        — `deno test -A`
- `mise run build`       — regenerate `src/version.ts`
- `mise run bump:patch/minor/major` — version bump (commit + tag)
- `mise run tag:push`    — push tags → triggers release
- `mise run vcs:release` — rebase main onto develop, push
- `mise run hooks:sync`  — sync hooks from orchestras/dev-patterns

## Git Hooks (config/githooks/hooks/)

- `pre-commit`: deno fmt check, deno lint, debug guard, 5MB file cap
- `commit-msg`: Conventional Commits validation
- `pre-push`: full test suite + deno check

## Security

- CodeQL: javascript-typescript, security-extended+security-and-quality queries
- Dependency review on PRs (fail on high severity, deny GPL-3.0/AGPL-3.0)
- `mise run scan:deps` — `deno audit`
