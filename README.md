# grocy-ops-toolkit

TypeScript toolkit for safe Grocy GitOps, health checks, and encrypted local backups.

## What It Does

- Reads Grocy stock, shopping-list, product, and master/config objects.
- Exports stable Grocy master/config records into a reviewable JSON manifest.
- Diffs a reviewed desired-state manifest against a live export.
- Applies only reviewed `repo_managed` creates and updates when explicitly confirmed.
- Creates and verifies encrypted local backup bundles.

## Local Setup

```bash
pnpm install
pnpm typecheck
pnpm test
```

Create `config/grocy.local.json` from `examples/grocy.local.example.json`, then run:

```bash
pnpm grocy:config:status
pnpm grocy:health
pnpm grocy:export-config
pnpm grocy:diff-config
pnpm grocy:apply-config -- --plan data/grocy-config-sync-plan.json --confirm-reviewed-write
```

For backups, create `config/grocy-backup.local.json` from `examples/grocy-backup.local.example.json`, set the configured passphrase environment variable, then run:

```bash
pnpm grocy:backup:snapshot
pnpm grocy:backup:verify
```
