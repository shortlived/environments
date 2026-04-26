# ┌────────────────────────────────────────────────────────────────┐
# │  All tasks have moved to mise.toml.                          │
# │  Run: mise tasks            — list all tasks                 │
# │  Run: mise run <task>       — execute a task                 │
# │  Run: mise run completions  — install shell completions      │
# │                                                              │
# │  This Makefile is kept only for muscle-memory compatibility. │
# │  It forwards every target to `mise run`.                     │
# └────────────────────────────────────────────────────────────────┘
SHELL := /bin/bash
.DEFAULT_GOAL := help
export PATH := $(HOME)/.local/bin:$(PATH)

help:
	@mise tasks 2>/dev/null || echo "mise not found — install: curl https://mise.run | sh"

%:
	@task=$$(echo "$@" | sed 's/-/:/g'); mise run "$$task" 2>/dev/null || mise run "$@"

.PHONY: help
