# Project Contract Status

This repository does not currently record a separate project contract beyond the public package surfaces already committed here.

For an active agent or maintainer execution, a runtime launch packet may still be the authoritative execution contract for that bounded session. The absence of a separate recorded contract artifact does not override that packet; use the packet for session scope, deliverables, review gates, and continuation handling, while keeping this repository's public contract limited to the committed surfaces below.

Use these surfaces as the current public contract:

- `README.md` for the project purpose, default setup paths, npm-first commands, and routine validation commands.
- `package.json` for the package name, scripts, supported Node.js version, package exports, and package contents.
- `docs/README.md` for the maintained documentation map.
- `examples/README.md` and `examples/` for synthetic, public-safe artifact shapes.
- `CONTRIBUTING.md` for contribution and public-support safety rules.

## Current Scope

`grocy-ops-toolkit` is a TypeScript utility toolkit for safe Grocy GitOps, health checks, synthetic evaluation, and encrypted local backups. Public defaults should stay conventional for that role: npm-first commands, no committed package-manager lockfile, simple `config/`, `data/`, `backups/`, and `restore/` paths, and CI-defended `typecheck`, `build`, and `test` checks.

The repository should be treated as support infrastructure for Grocy operations and related tooling, not as a standalone product roadmap. New docs or examples should explain the existing toolkit surfaces without implying package publication, release automation, broader compatibility promises, or new public API commitments unless those decisions are reviewed explicitly.

## Public Boundary

Committed examples, fixtures, tests, and docs must remain synthetic or generic. Do not commit live Grocy data, household details, personal operations ledgers, shopping-intent workflows, pantry-monitoring policy, calendar or task integrations, private account details, or source-specific operating policy.

If a proposed change depends on those private details, keep that reasoning outside the public repository and land only the generic, public-safe contract here.

## Review Points

Stop for explicit review before:

- publishing the package or adding release automation
- changing the license or public positioning
- expanding package exports or making broader API commitments
- claiming support for a real Grocy release without reviewed evidence
- adding examples or workflows that could expose private household, shopping, planning, account, or operations data
