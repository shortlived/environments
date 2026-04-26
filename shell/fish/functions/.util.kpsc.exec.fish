function .util.kpsc.exec --description "Helper: invoke kpsc binary with checked exit and pretty errors"
    if not command -q kpsc
        echo "kpsc: binary not on PATH; run 'brew install softdist/softdist/kpsc'" >&2
        return 1
    end
    kpsc $argv
end
