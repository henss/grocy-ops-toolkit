# Fixture-Only Restore Drill Walkthrough

This walkthrough teaches the public backup recovery loop using synthetic files only.

It is intentionally machine-checkable. Instead of asking an operator to infer whether the drill "looked right", the toolkit emits a dedicated restore-drill artifact that records three explicit checkpoints:

1. an encrypted snapshot was created
2. a no-write restore plan was ready
3. a confirmed restore verification succeeded

Use this walkthrough when you want one bounded recovery-confidence rehearsal without live Grocy credentials, household data, or narrative-only signoff.

## Setup

Install dependencies and create the conventional local directories:

```bash
npm install
npm run typecheck
npm run build
npm test
mkdir -p config data restore
cp examples/grocy-backup.local.example.json config/grocy-backup.local.json
export GROCY_BACKUP_PASSPHRASE="synthetic-restore-drill-passphrase"
```

PowerShell:

```powershell
npm install
npm run typecheck
npm run build
npm test
New-Item -ItemType Directory -Force config, data, restore | Out-Null
Copy-Item examples/grocy-backup.local.example.json config/grocy-backup.local.json
$env:GROCY_BACKUP_PASSPHRASE = "synthetic-restore-drill-passphrase"
```

The example backup config already points at `examples/synthetic-grocy-backup-source`, so the drill stays inside the public fixture boundary.

## Run The Drill

Run the dedicated restore-drill command:

```bash
npm run grocy:backup:restore-drill -- --restore-dir restore/fixture-only-restore-drill --output data/fixture-only-restore-drill-report.json --force
```

PowerShell uses the same command.

Expected result: the command writes:

- `data/fixture-only-restore-drill-report.json`
- `data/grocy-backup-manifest.json`
- `data/grocy-backup-restore-plan-dry-run-report.json`
- synthetic restored files under `restore/fixture-only-restore-drill`

## Checkpoints

The canonical drill artifact is `data/fixture-only-restore-drill-report.json`.

Treat these fields as the machine-checkable signoff surface:

- `summary.result` must be `pass`
- `summary.checkpointCount` must be `3`
- `summary.passedCount` must be `3`
- `checkpoints[0].id` must be `snapshot_created`
- `checkpoints[1].id` must be `restore_plan_ready`
- `checkpoints[2].id` must be `restore_verification_succeeded`
- `artifacts.manifestPath` should point at the generated backup manifest
- `artifacts.restorePlanReportPath` should point at the generated dry-run restore plan

For a representative public-safe shape, see [`examples/grocy-backup-restore-drill-report.example.json`](../examples/grocy-backup-restore-drill-report.example.json).

## Why This Matters

This drill proves recovery understanding with evidence instead of memory:

- the snapshot checkpoint proves the encrypted archive exists and was recorded in the manifest
- the restore-plan checkpoint proves the no-write preview was clean before any restore write happened
- the restore-verification checkpoint proves the confirmed restore wrote only synthetic fixture files

Because the artifact records each checkpoint with its rerun command and evidence, future contributors can validate the recovery loop without reverse-engineering the backup flow from several docs or logs.
