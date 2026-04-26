complete -c .util.secrets.push -f -a "(commandline -ct | string split ' ' | head -n 1 | xargs -I {} fish -c 'complete -C \"{} \"' )"
