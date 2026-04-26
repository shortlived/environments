function .util.keepass.dir.acquiesce --description "Batch: pull every secret in a KeePass folder and seal the cache"
    if test (count $argv) -lt 1
        echo "usage: .util.keepass.dir.acquiesce <group-path>" >&2
        return 2
    end
    set -l group $argv[1]

    set -l token (.util.keepass.token.get)
    if test -z "$token"
        return 1
    end
    set -l db (printf '%s' $token | base64 -d 2>/dev/null)
    if test -z "$db"
        echo "kpsc: invalid token" >&2
        return 1
    end

    read --silent --prompt-str "KeePass password: " password
    if test -z "$password"
        echo "kpsc: empty password" >&2
        return 1
    end

    if not command -q kpsc
        set --erase password
        echo "kpsc: binary not on PATH" >&2
        return 1
    end

    printf '%s\n' $password | kpsc keepass dump $db $group | kpsc acquiesce
    set -l rc $pipestatus[3]
    set --erase password
    if test $rc -ne 0
        echo "kpsc: cache write failed" >&2
        return $rc
    end
    echo "kpsc: secrets cached. TTL: 28800s"
end
