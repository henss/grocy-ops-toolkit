# grocy-ops-toolkit

TypeScript toolkit for safe Grocy GitOps, health checks, and encrypted local backups.

## What It Does

- Reads Grocy stock, shopping-list, product, and master/config objects.
- Exports stable Grocy master/config records into a reviewable JSON manifest.
- Diffs a reviewed desired-state manifest against a live export.
- Applies only reviewed `repo_managed` creates and updates when explicitly confirmed.
- Creates and verifies encrypted local backup bundles.

## Privacy Boundary

Use synthetic examples by default. Do not publish real Grocy data, local filesystem paths, credentials, production hostnames, operational logs, or private planning context.

This scaffold is local-first. Creating a GitHub repository, changing visibility, adding remotes, pushing commits, or publishing packages remains approval-gated outside this repo.

## Local Setup

```bash
pnpm install
pnpm typecheck
pnpm test
```

Create `.runtime/config/grocy.local.json` from `examples/grocy.local.example.json`, then run:

```bash
pnpm grocy:config:status
pnpm grocy:health
pnpm grocy:export-config
pnpm grocy:diff-config
pnpm grocy:apply-config -- --plan .runtime/current/grocy-config-sync-plan.json --confirm-reviewed-write
```

For backups, create `.runtime/config/grocy-backup.local.json` from `examples/grocy-backup.local.example.json`, set the configured passphrase environment variable, then run:

```bash
pnpm grocy:backup:snapshot
pnpm grocy:backup:verify
```
