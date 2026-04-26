## Summary

<!-- Briefly describe what this PR does and why -->

## Changes

<!-- List the key changes -->
-

## Testing

<!-- Describe how you tested these changes -->
- [ ] `mise run ci:all` passed locally (or `mise run lint && mise run typecheck && mise run test`)
- [ ] New tests added for new behaviour
- [ ] Existing tests pass

## Checklist

- [ ] Code follows project style (`mise run lint && mise run fmt:check`)
- [ ] Type annotations updated / added (`mise run typecheck`)
- [ ] `src/version.ts` is in sync (`mise run build`)
- [ ] CHANGELOG.md updated (if user-facing change)
- [ ] No secrets or credentials committed
- [ ] Branch is rebased onto `develop` (`mise run vcs:rebase`)

## Related Issues

<!-- e.g. Closes #123, Refs MCKB-2000 -->
