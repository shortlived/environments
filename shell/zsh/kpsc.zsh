# kpsc zsh integration. Source from ~/.zshrc:
#   source /usr/local/share/kpsc/kpsc.zsh
#
# zsh allows dots in function names natively, so the `.util.*` names can be
# defined directly. The function bodies are intentionally identical to the
# bash layer for ease of audit.

emulate -L zsh

_kpsc_require() {
    if ! command -v kpsc >/dev/null 2>&1; then
        print -u2 'kpsc: binary not on PATH; run "brew install softdist/softdist/kpsc"'
        return 1
    fi
}

.util.keepass.token.get() {
    local config_path="${HOME}/.config/.devops/keepass.token"
    if [[ ! -f "$config_path" ]]; then
        print -u2 "kpsc: missing token at $config_path"
        return 1
    fi
    cat "$config_path"
}

.util.keepass.hash.system() {
    _kpsc_require || return 1
    kpsc status
}

.util.keepass.acquiesce() {
    if (( $# < 2 )); then
        print -u2 'usage: .util.keepass.acquiesce <token> <path>'
        return 2
    fi
    local token=$1 path=$2 db password
    db=$(printf '%s' "$token" | base64 -d 2>/dev/null)
    if [[ -z "$db" ]]; then
        print -u2 'kpsc: invalid token'
        return 1
    fi
    print -n "KeePass password: " >&2
    read -rs password
    print '' >&2
    if [[ -z "$password" ]]; then
        print -u2 'kpsc: empty password'
        return 1
    fi
    printf '%s\n' "$password" | keepassxc-cli show -q -s -a Password "$db" "$path"
    local rc=$?
    unset password
    return $rc
}

.util.keepass.day.hash() {
    _kpsc_require || return 1
    if [[ -t 0 ]]; then
        print -u2 'kpsc: stdin is a TTY; pipe KEY=VALUE secrets in'
        return 2
    fi
    kpsc acquiesce
}

.util.keepass.dir.acquiesce() {
    if (( $# < 1 )); then
        print -u2 'usage: .util.keepass.dir.acquiesce <group-path>'
        return 2
    fi
    _kpsc_require || return 1
    local group=$1 token db password
    token=$(.util.keepass.token.get) || return 1
    db=$(printf '%s' "$token" | base64 -d 2>/dev/null)
    if [[ -z "$db" ]]; then
        print -u2 'kpsc: invalid token'
        return 1
    fi
    print -n "KeePass password: " >&2
    read -rs password
    print '' >&2
    if [[ -z "$password" ]]; then
        print -u2 'kpsc: empty password'
        return 1
    fi
    printf '%s\n' "$password" | kpsc keepass dump "$db" "$group" | kpsc acquiesce
    local rc=${pipestatus[3]:-$?}
    unset password
    if (( rc != 0 )); then
        print -u2 'kpsc: cache write failed'
        return $rc
    fi
    print 'kpsc: secrets cached. TTL: 28800s'
}

.util.secrets.push() {
    if (( $# < 1 )); then
        print -u2 'usage: .util.secrets.push "<program> [args...]"'
        return 2
    fi
    _kpsc_require || return 1
    kpsc push "$*"
}

.util.kpsc.with() {
    if (( $# < 1 )); then
        print -u2 'usage: .util.kpsc.with <program> [args...]'
        return 2
    fi
    _kpsc_require || return 1
    kpsc push "$*"
}

.util.kpsc.terraform() { .util.kpsc.with terraform "$@"; }
.util.kpsc.bicep()     { .util.kpsc.with bicep "$@"; }
