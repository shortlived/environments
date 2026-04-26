function .util.kpsc.with --description "Run any program (terraform, bicep, etc.) with cached secrets in env without setting them globally"
    if test (count $argv) -lt 1
        echo "usage: .util.kpsc.with <program> [args...]" >&2
        return 2
    end
    if not command -q kpsc
        echo "kpsc: binary not on PATH" >&2
        return 1
    end
    set -l joined (string join " " -- $argv)
    kpsc push $joined
end
