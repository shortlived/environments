# Changelog

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
