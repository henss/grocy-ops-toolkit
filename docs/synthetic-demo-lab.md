# Synthetic Grocy Demo Lab

This lab exercises the public toolkit with synthetic data only. It is intended for a clean checkout, CI review, or agent validation when no live Grocy credentials are available.

The lab uses conventional local paths:

- `config/` for local-only configuration copied from examples.
- `data/` for generated reports and review artifacts.
- `backups/` for generated encrypted backup archives.
- `restore/` for an optional local restore check.

These generated paths are ignored by git.

## Setup

Install dependencies and verify the package surface:

```bash
npm install
npm run typecheck
npm run build
npm test
```

Create local directories:

```bash
mkdir -p config data restore
```

PowerShell:

```powershell
New-Item -ItemType Directory -Force config, data, restore | Out-Null
```

## Diagnostics Without Credentials

Run diagnostics before creating a live Grocy config. This produces an agent-readable failure artifact without storing credentials, local absolute paths, live URLs, or Grocy record contents.

```bash
npm run grocy:health:diagnostics -- --output data/demo-health-diagnostics.json --force
```

Expected result: the command completes and writes a `fail` artifact that tells the user to create local config before running live checks.

## Mock Smoke

Run the synthetic mock smoke path. This covers health, config export, config diff planning, and apply dry-run behavior against mock Grocy responses.

```bash
npm run grocy:smoke:mock -- --output data/demo-mock-smoke-report.json --force
```

Expected result: the summary reports `pass` with checks for `health`, `export`, `plan`, and `apply_dry_run`.

## Config Diff

Lint the public desired-state example first. This is an offline safety gate and should pass before any diff step.

```bash
npm run grocy:desired-state:lint -- --manifest examples/desired-state.example.json --output data/demo-desired-state-lint-report.json --force
```

Expected result: the generated lint report is `ready: true` with zero findings.

Create a synthetic sync plan from the public desired-state and export examples.

```bash
npm run grocy:diff-config -- --manifest examples/desired-state.example.json --export examples/config-export.example.json --output data/demo-config-sync-plan.json --force
```

Expected result: the generated plan contains one reviewed update for `Example Coffee`.

## Config Drift Trend

Create an offline trend report from two synthetic config exports.

```bash
npm run grocy:config:drift-trend -- --previous examples/config-export.previous.example.json --current examples/config-export.example.json --output data/demo-config-drift-trend-report.json --force
```

Expected result: the generated report shows one changed `Example Coffee` record and no live write.

## Apply Dry Run

Render the apply review report from the generated synthetic plan. This does not send write requests and does not require Grocy credentials.

```bash
npm run grocy:apply-config -- --plan data/demo-config-sync-plan.json --dry-run --output data/demo-apply-dry-run-report.json --force
```

Expected result: the report shows one `would_update` action and no live write.

## Backup Snapshot And Verification

Copy the synthetic backup config into the local config path and set a synthetic passphrase for this shell.

```bash
cp examples/grocy-backup.local.example.json config/grocy-backup.local.json
export GROCY_BACKUP_PASSPHRASE="synthetic-demo-passphrase"
```

PowerShell:

```powershell
Copy-Item examples/grocy-backup.local.example.json config/grocy-backup.local.json
$env:GROCY_BACKUP_PASSPHRASE = "synthetic-demo-passphrase"
```

Create an encrypted backup bundle from `examples/synthetic-grocy-backup-source`, then render a no-write restore plan before the confirmed restore check:

```bash
npm run grocy:backup:snapshot
npm run grocy:backup:restore-plan -- --restore-dir restore/demo-grocy-backup-check --output data/demo-backup-restore-plan-dry-run-report.json --force
npm run grocy:backup:verify
npm run grocy:backup:verify -- --restore-dir restore/demo-grocy-backup-check --confirm-restore-write
```

Expected result: the dry-run report shows which synthetic files would be created or overwritten, verification reports `checksumVerified: true`, and the restore check writes only the synthetic fixture files.

## Review Dashboard

Render one Markdown review surface from the generated lab artifacts:

```bash
npm run grocy:review:dashboard -- --plan data/demo-config-sync-plan.json --dry-run-report data/demo-apply-dry-run-report.json --drift-trend-report data/demo-config-drift-trend-report.json --diagnostics data/demo-health-diagnostics.json --backup-manifest data/grocy-backup-manifest.json --smoke-report data/demo-mock-smoke-report.json --output data/demo-review-dashboard.md --force
```

Expected result: the dashboard is reviewable and shows the diagnostic config gap, mock smoke pass, apply dry-run action, config drift trend, and latest synthetic backup verification state.

## Cleanup

Remove generated demo outputs when finished:

```bash
rm -rf data backups restore config/grocy-backup.local.json
```

PowerShell:

```powershell
Remove-Item -Recurse -Force data, backups, restore -ErrorAction SilentlyContinue
Remove-Item -Force config/grocy-backup.local.json -ErrorAction SilentlyContinue
```
