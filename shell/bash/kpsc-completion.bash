# shellcheck shell=bash
# kpsc bash completions.
# Source from ~/.bashrc after kpsc.bash:
#   source /usr/local/share/kpsc/kpsc-completion.bash

_kpsc_complete() {
    local cur prev cmds keepass_subs
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    cmds="acquiesce push rotate status keepass version help"
    keepass_subs="list dump"

    if [[ ${COMP_CWORD} -eq 1 ]]; then
        # shellcheck disable=SC2207
        COMPREPLY=( $(compgen -W "${cmds}" -- "${cur}") )
        return 0
    fi
    if [[ ${COMP_WORDS[1]} == "keepass" ]] && [[ ${COMP_CWORD} -eq 2 ]]; then
        # shellcheck disable=SC2207
        COMPREPLY=( $(compgen -W "${keepass_subs}" -- "${cur}") )
        return 0
    fi
    return 0
}
complete -F _kpsc_complete kpsc

_util_kpsc_with_complete() {
    local cur
    cur="${COMP_WORDS[COMP_CWORD]}"
    # Complete program names from PATH
    # shellcheck disable=SC2207
    COMPREPLY=( $(compgen -c -- "${cur}") )
}
complete -F _util_kpsc_with_complete util_kpsc_with
complete -F _util_kpsc_with_complete .util.kpsc.with
complete -F _util_kpsc_with_complete util_secrets_push
complete -F _util_kpsc_with_complete .util.secrets.push

_util_keepass_dir_complete() {
    local cur
    cur="${COMP_WORDS[COMP_CWORD]}"
    # shellcheck disable=SC2207
    COMPREPLY=( $(compgen -W "generic artifactory dev staging prod" -- "${cur}") )
}
complete -F _util_keepass_dir_complete util_keepass_dir_acquiesce
complete -F _util_keepass_dir_complete .util.keepass.dir.acquiesce
