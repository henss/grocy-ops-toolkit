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
npm install
npm run typecheck
npm run build
npm test
```

Create `config/grocy.local.json` from `examples/grocy.local.example.json`, then run:

```bash
npm run grocy:config:status
npm run grocy:health
npm run grocy:health:diagnostics
npm run grocy:smoke:mock
npm run grocy:export-config
npm run grocy:diff-config
npm run grocy:apply-config -- --plan data/grocy-config-sync-plan.json --dry-run
npm run grocy:apply-config -- --plan data/grocy-config-sync-plan.json --confirm-reviewed-write
```

The diagnostics command writes an agent-readable failure artifact to `data/grocy-health-diagnostics.json`. It records reachability checks and next actions without storing Grocy record contents, API keys, absolute local paths, or live URL values. Use `--output <path>` to write the artifact somewhere else.

The mock smoke command runs the health, config export, sync-plan, and apply dry-run path against synthetic Grocy responses. It is intended for CI environments that must not depend on live Grocy credentials. By default it writes `data/grocy-mock-smoke-report.json`; use `--output <path>` to write the report somewhere else.

The apply dry run reads an existing sync plan and writes a review report to `data/grocy-config-apply-dry-run-report.json` without requiring Grocy credentials or sending live write requests. Use `--output <path>` to write the report somewhere else.

For backups, create `config/grocy-backup.local.json` from `examples/grocy-backup.local.example.json`, set the configured passphrase environment variable, then run:

```bash
npm run grocy:backup:snapshot
npm run grocy:backup:verify
npm run grocy:backup:verify -- --restore-dir restore/grocy-backup-check --confirm-restore-write
```

The example backup source under `examples/synthetic-grocy-backup-source` is intentionally synthetic. Use it to test the snapshot, encrypted archive, verification, and restore loop before pointing a local config at private Grocy files.
