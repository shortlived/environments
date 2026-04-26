function .util.keepass.acquiesce --description "Pull a single secret from KeePass at <path>"
    if test (count $argv) -lt 2
        echo "usage: .util.keepass.acquiesce <token> <path>" >&2
        return 2
    end
    set -l token $argv[1]
    set -l path $argv[2]

    set -l db (printf '%s' $token | base64 -d 2>/dev/null)
    if test -z "$db"
        echo "kpsc: token does not decode to a valid path" >&2
        return 1
    end

    read --silent --prompt-str "KeePass password: " password
    if test -z "$password"
        echo "kpsc: empty password" >&2
        return 1
    end

    printf '%s\n' $password | keepassxc-cli show -q -s -a Password $db $path
    set -l rc $status

    set --erase password
    return $rc
end
