function .util.keepass.day.hash --description "Initialise the encrypted cache (delegates to kpsc binary)"
    if not command -q kpsc
        echo "kpsc: binary not on PATH" >&2
        return 1
    end
    if not isatty stdin
        kpsc acquiesce
        return $status
    end
    echo "kpsc: stdin is a TTY; pipe KEY=VALUE secrets in" >&2
    return 2
end
