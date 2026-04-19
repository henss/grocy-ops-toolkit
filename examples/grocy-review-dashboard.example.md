# Grocy Review Dashboard

Generated at: 2026-04-19T10:30:00.000Z

## Review Status

Status: needs attention.
Loaded artifacts: config sync plan, apply dry-run report, health diagnostics, backup manifest, mock smoke report.
1 reviewed write would run if confirmed.

## Artifact Sources

- Config sync plan: examples/config-sync-plan.example.json
- Apply dry-run report: examples/config-apply-dry-run-report.example.json
- Health diagnostics: examples/grocy-health-diagnostics.example.json
- Backup manifest: examples/backup-manifest.example.json
- Mock smoke report: examples/grocy-mock-smoke-report.example.json

## Planned Apply Review

| Action | Key | Entity | Reason | Change fields |
| --- | --- | --- | --- | --- |
| would_update | products.example-coffee | products | Repo-managed item differs from live Grocy on non-destructive fields. | min_stock_amount |

## Manual Review Reasons

No manual-review plan actions were loaded.

## Health Diagnostics

Result: fail; failures: 1; warnings: 0.

| Severity | Code | Action |
| --- | --- | --- |
| error | grocy_unreachable | Verify local config, Grocy availability, and API-key permissions, then rerun npm run grocy:health:diagnostics. |

## Backup Verification

Latest record: grocy-backup-20260419101000; files: 2; bytes: 381; restore test: not_tested.
Location label: synthetic-local-encrypted.

## Mock Smoke Check

Result: pass; checks: 4; failures: 0.

| Check | Status | Message |
| --- | --- | --- |
| health | pass | Synthetic Grocy health check passed. |
| export | pass | Synthetic Grocy config export produced records. |
| plan | pass | Synthetic desired state produced create, update, and noop plan actions. |
| apply_dry_run | pass | Synthetic apply dry run summarized the planned non-live writes. |
