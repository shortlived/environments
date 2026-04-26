# shellcheck shell=bash
# kpsc bash integration. Source from ~/.bashrc:
#   source /usr/local/share/kpsc/kpsc.bash
#
# Provides the same `.util.*` functions as the fish layer. Bash treats `.` as
# the source builtin, so we expose dot-prefixed names via `function` keyword
# and aliases — invoking them as `\.util.keepass.acquiesce ...` works in any
# shell mode. We also offer plain underscore aliases (`util_keepass_acquiesce`)
# for users who prefer them.

# shellcheck disable=SC2139
function _kpsc_require() {
    if ! command -v kpsc >/dev/null 2>&1; then
        printf 'kpsc: binary not on PATH; run "brew install softdist/softdist/kpsc"\n' >&2
        return 1
    fi
}

function util_keepass_token_get() {
    local config_path="${HOME}/.config/.devops/keepass.token"
    if [[ ! -f "$config_path" ]]; then
        printf 'kpsc: missing token at %s\n' "$config_path" >&2
        return 1
    fi
    cat "$config_path"
}

function util_keepass_hash_system() {
    _kpsc_require || return 1
    kpsc status
}

function util_keepass_acquiesce() {
    if [[ $# -lt 2 ]]; then
        printf 'usage: util_keepass_acquiesce <token> <path>\n' >&2
        return 2
    fi
    local token=$1 path=$2 db password
    db=$(printf '%s' "$token" | base64 -d 2>/dev/null)
    if [[ -z "$db" ]]; then
        printf 'kpsc: invalid token\n' >&2
        return 1
    fi
    IFS= read -rs -p "KeePass password: " password
    printf '\n' >&2
    if [[ -z "$password" ]]; then
        printf 'kpsc: empty password\n' >&2
        return 1
    fi
    printf '%s\n' "$password" | keepassxc-cli show -q -s -a Password "$db" "$path"
    local rc=$?
    unset password
    return $rc
}

function util_keepass_day_hash() {
    _kpsc_require || return 1
    if [[ -t 0 ]]; then
        printf 'kpsc: stdin is a TTY; pipe KEY=VALUE secrets in\n' >&2
        return 2
    fi
    kpsc acquiesce
}

function util_keepass_dir_acquiesce() {
    if [[ $# -lt 1 ]]; then
        printf 'usage: util_keepass_dir_acquiesce <group-path>\n' >&2
        return 2
    fi
    _kpsc_require || return 1
    local group=$1 token db password
    token=$(util_keepass_token_get) || return 1
    db=$(printf '%s' "$token" | base64 -d 2>/dev/null)
    if [[ -z "$db" ]]; then
        printf 'kpsc: invalid token\n' >&2
        return 1
    fi
    IFS= read -rs -p "KeePass password: " password
    printf '\n' >&2
    if [[ -z "$password" ]]; then
        printf 'kpsc: empty password\n' >&2
        return 1
    fi
    printf '%s\n' "$password" | kpsc keepass dump "$db" "$group" | kpsc acquiesce
    local rc=${PIPESTATUS[2]:-$?}
    unset password
    if [[ $rc -ne 0 ]]; then
        printf 'kpsc: cache write failed\n' >&2
        return $rc
    fi
    printf 'kpsc: secrets cached. TTL: 28800s\n'
}

function util_secrets_push() {
    if [[ $# -lt 1 ]]; then
        printf 'usage: util_secrets_push "<program> [args...]"\n' >&2
        return 2
    fi
    _kpsc_require || return 1
    kpsc push "$*"
}

function util_kpsc_with() {
    if [[ $# -lt 1 ]]; then
        printf 'usage: util_kpsc_with <program> [args...]\n' >&2
        return 2
    fi
    _kpsc_require || return 1
    kpsc push "$*"
}

function util_kpsc_terraform() { util_kpsc_with terraform "$@"; }
function util_kpsc_bicep()     { util_kpsc_with bicep "$@"; }

# Dot-prefixed aliases (matches fish names exactly). Bash treats these as
# valid function names so long as we declare them with `function`.
function .util.keepass.token.get()      { util_keepass_token_get "$@"; }
function .util.keepass.hash.system()    { util_keepass_hash_system "$@"; }
function .util.keepass.acquiesce()      { util_keepass_acquiesce "$@"; }
function .util.keepass.day.hash()       { util_keepass_day_hash "$@"; }
function .util.keepass.dir.acquiesce()  { util_keepass_dir_acquiesce "$@"; }
function .util.secrets.push()           { util_secrets_push "$@"; }
function .util.kpsc.with()              { util_kpsc_with "$@"; }
function .util.kpsc.terraform()         { util_kpsc_terraform "$@"; }
function .util.kpsc.bicep()             { util_kpsc_bicep "$@"; }
