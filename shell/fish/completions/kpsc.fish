complete -c kpsc -f
complete -c kpsc -n "__fish_use_subcommand" -a "acquiesce" -d "Read KEY=VALUE from stdin → encrypted cache"
complete -c kpsc -n "__fish_use_subcommand" -a "push"      -d "Run command with secrets injected"
complete -c kpsc -n "__fish_use_subcommand" -a "rotate"    -d "Force cache invalidation"
complete -c kpsc -n "__fish_use_subcommand" -a "status"    -d "Show TTL remaining"
complete -c kpsc -n "__fish_use_subcommand" -a "keepass"   -d "KeePass helpers (list/dump)"
complete -c kpsc -n "__fish_use_subcommand" -a "version"   -d "Print binary version"
complete -c kpsc -n "__fish_use_subcommand" -a "help"      -d "Show usage"

complete -c kpsc -n "__fish_seen_subcommand_from keepass" -a "list" -d "List entries under <group>"
complete -c kpsc -n "__fish_seen_subcommand_from keepass" -a "dump" -d "Dump KEY=VALUE for entries under <group>"
