# Recovery Confidence Routing Review

This note explains how the existing public toolkit surfaces answer the operator question, "Can I trust this change and recover from it?" It does not add new runtime behavior. It routes the reader to the right existing artifact for the risk they are reviewing.

The current recovery-confidence story is intentionally split into three bounded paths:

1. Config review for "what would change?"
2. Mock smoke for "does the public toolkit still execute the expected review loop?"
3. Backup review for "could I recover synthetic local state if the change went badly?"

Use the smallest path that answers the review question in front of you.

## Route 1: Config Diff And Apply Dry Run

Use the config-review path when the risk is "I changed desired state, config mapping, or sync planning logic and need a reviewable preview before any live write."

Run:

```bash
npm run grocy:desired-state:lint -- --manifest examples/desired-state.example.json --output data/review-desired-state-lint.json --force
npm run grocy:diff-config -- --manifest examples/desired-state.example.json --export examples/config-export.example.json --output data/review-config-sync-plan.json --force
npm run grocy:apply-config -- --plan data/review-config-sync-plan.json --dry-run --output data/review-apply-dry-run.json --force
```

Evidence produced:

- `grocy_desired_state_manifest_lint_report` proves the manifest is public-safe and structurally ready for review.
- `grocy_config_sync_plan` shows the exact creates and updates the toolkit would propose.
- `grocy_config_apply_dry_run_report` records the no-write execution result and preserves the explicit reviewed-write boundary.

Use this route when you need preview-first confidence. Stop here when backup or package-install evidence is not relevant to the change.

## Route 2: Mock Smoke

Use the mock smoke path when the risk is "I changed shared CLI or orchestration behavior and need one synthetic pass/fail artifact that proves the core review loop still works without live Grocy access."

Run:

```bash
npm run grocy:smoke:mock -- --output data/review-mock-smoke.json --receipt-output data/review-mock-smoke-receipt.json --force
```

Evidence produced:

- `grocy_mock_smoke_report` covers health, export, plan, and apply dry-run behavior against synthetic responses.
- `grocy_toolkit_run_receipt` gives a compact rerun contract for CI, handoff, or future agent review.

Use this route when you need execution confidence across the public package surface, especially for CI-backed review or npm-installed package checks.

## Route 3: Backup Snapshot, Integrity Receipt, Restore Plan, And Restore Verification

Use the backup path when the risk is "I changed local backup or recovery logic and need evidence that synthetic files can be archived, inspected, and restored safely."

Run:

```bash
cp examples/grocy-backup.local.example.json config/grocy-backup.local.json
export GROCY_BACKUP_PASSPHRASE="synthetic-routing-review-passphrase"
npm run grocy:backup:snapshot
npm run grocy:backup:receipt
npm run grocy:backup:restore-plan -- --restore-dir restore/routing-review-check --output data/review-backup-restore-plan.json --force
npm run grocy:backup:verify
npm run grocy:backup:receipt:verify
npm run grocy:backup:verify -- --restore-dir restore/routing-review-check --confirm-restore-write
```

PowerShell:

```powershell
Copy-Item examples/grocy-backup.local.example.json config/grocy-backup.local.json
$env:GROCY_BACKUP_PASSPHRASE = "synthetic-routing-review-passphrase"
npm run grocy:backup:snapshot
npm run grocy:backup:receipt
npm run grocy:backup:restore-plan -- --restore-dir restore/routing-review-check --output data/review-backup-restore-plan.json --force
npm run grocy:backup:verify
npm run grocy:backup:receipt:verify
npm run grocy:backup:verify -- --restore-dir restore/routing-review-check --confirm-restore-write
```

Evidence produced:

- `grocy_backup_manifest` records the synthetic archive metadata and latest restore verification state.
- `grocy_backup_integrity_receipt` ties checksum verification to the manifest plus optional restore-plan and restore-drill evidence in one public-safe artifact.
- `grocy_backup_restore_plan_dry_run_report` shows what would be written before any restore write happens.
- `grocy_backup_integrity_receipt_verification` proves the stored receipt still matches the current manifest and proof artifacts.
- Verified restore status or a public-safe failure category shows whether recovery assumptions still hold.

Use this route when you need recovery confidence, not just config preview confidence.

When you need a more guided rehearsal after Route 3, use the existing backup walkthroughs instead of inventing a new flow:

- [Fixture-Only Restore Drill Walkthrough](fixture-only-restore-drill-walkthrough.md) for the shortest checkpoint-driven recovery rehearsal.
- [Synthetic Backup Passphrase Rotation Rehearsal](synthetic-backup-passphrase-rotation-rehearsal.md) when the review question is specifically about wrong-passphrase failure evidence and re-verification under a rotated passphrase.

## Recommended Review Routing

Choose the route by the change under review:

- Config schema, desired-state examples, or sync planning logic: start with Route 1.
- CLI packaging, installed-bin behavior, or CI-backed review surfaces: start with Route 2.
- Backup archive, restore planning, restore verification, or encrypted local recovery behavior: start with Route 3.
- Cross-cutting review that touches more than one seam: run Route 1 plus Route 2 first, then add Route 3 only if the change can affect recovery behavior.

When a single Markdown summary is useful, render the existing review dashboard after generating the relevant JSON artifacts:

```bash
npm run grocy:review:dashboard -- --plan data/review-config-sync-plan.json --dry-run-report data/review-apply-dry-run.json --backup-manifest data/grocy-backup-manifest.json --smoke-report data/review-mock-smoke.json --output data/review-dashboard.md --force
```

The dashboard is the aggregation surface. It is not a substitute for the underlying artifact families when the review question is narrow.

## What This Review Does Not Claim

This routing review does not add live recovery automation, public support promises for real Grocy releases, or any guarantee about private household workflows. It only clarifies how to use the synthetic, review-first evidence that the toolkit already produces.
