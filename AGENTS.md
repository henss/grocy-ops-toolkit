# AGENTS.md

Repo-local agent entrypoint for `grocy-ops-toolkit`.

## What this repo is

A toolkit for safe, reviewable Grocy configuration management and encrypted backups, built around an export → diff → apply workflow with explicit confirm-before-write guards and backup/restore drills.

## Working in this repo

- Read this file and the README before non-trivial work; prefer repo-local conventions and verification commands over generic assumptions.
- Treat writes as consequential: preview/diff before apply, and require explicit confirmation for applied changes.
- Run the narrowest repo-local lint/typecheck/test command before stopping.
- Commit and push a coherent increment once it passes verification; stage only task-owned files.
