function .util.secrets.push --description "Run a program with cached secrets injected into its environment"
    if test (count $argv) -lt 1
        echo "usage: .util.secrets.push \"<program> [args...]\"" >&2
        return 2
    end
    if not command -q kpsc
        echo "kpsc: binary not on PATH" >&2
        return 1
    end
    kpsc push $argv
end
