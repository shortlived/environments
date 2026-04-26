# kpsc keybindings.
#
# True ctrl+0 / ctrl+9 are not distinguishable from plain `0` and `9` in most
# terminal emulators (xterm, iTerm2, kitty, alacritty all collapse them). We
# therefore bind to Alt+0 / Alt+9 by default, which every terminal forwards
# unambiguously, and additionally to the function-key escape sequences
# `\e[0;5~` / `\e[9;5~` for terminals that *do* support ctrl+digit (Apple
# Terminal with custom mapping, Windows Terminal).
#
# Override these in your own conf.d/kpsc.local.fish if you have a different
# preferred binding.

if status is-interactive
    bind \e0 '.util.keepass.dir.acquiesce generic'
    bind \e9 '.util.keepass.dir.acquiesce artifactory'
    bind -k f1 '.util.keepass.hash.system' 2>/dev/null
end
