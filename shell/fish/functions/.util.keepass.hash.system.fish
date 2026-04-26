function .util.keepass.hash.system --description "Verify session nonce/cache state via the kpsc binary"
    if not command -q kpsc
        echo "kpsc: binary not on PATH; run 'brew install softdist/softdist/kpsc'" >&2
        return 1
    end
    kpsc status
end
