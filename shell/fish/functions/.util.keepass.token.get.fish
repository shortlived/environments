function .util.keepass.token.get --description "Print base64-encoded KeePass safe location token"
    set -l config_path "$HOME/.config/.devops/keepass.token"
    if not test -f $config_path
        echo "kpsc: missing token at $config_path" >&2
        return 1
    end
    cat $config_path
end
