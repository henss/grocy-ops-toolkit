# Backup Workflow

Use this workflow to create encrypted local backup bundles, verify them, and plan restore writes before changing a restore directory.

## Create And Verify A Backup

Create a local backup config from the example:

```bash
cp examples/grocy-backup.local.example.json config/grocy-backup.local.json
```

Set the configured passphrase environment variable, then create and verify a backup:

```bash
npm run grocy:backup:snapshot
npm run grocy:backup:verify
```

When you want a machine-checkable verification artifact for the encrypted archive itself, write the backup verifier output directly:

```bash
npm run grocy:backup:verify -- --output data/grocy-backup-verification-report.json --force
```

The verification report records the selected archive record id, public-safe paths, checksum result, and optional restore target without embedding decrypted file contents.

## Plan And Confirm Restores

Generate a restore-plan dry-run report before a confirmed restore write:

```bash
npm run grocy:backup:restore-plan -- --restore-dir restore/grocy-backup-check
```

By default, the restore-plan dry-run report is written to:

```text
data/grocy-backup-restore-plan-dry-run-report.json
```

The report inspects the latest encrypted archive, verifies the manifest checksum, and records which files would be created or overwritten in the requested restore directory. It does not write restore files. Use `--archive <path>` to point at a different archive record and `--output <path>` to write the report somewhere else.

To verify by restoring into a local restore directory, explicitly confirm the restore write:

```bash
npm run grocy:backup:verify -- --restore-dir restore/grocy-backup-check --confirm-restore-write
```

## Retention Simulation

Model how a synthetic snapshot history would age under an hourly/daily/weekly/monthly retention policy:

```bash
npm run grocy:backup:retention-simulate -- --history examples/grocy-backup-retention-history.example.json
```

By default, the retention simulation report is written to:

```text
data/grocy-backup-retention-simulation-report.json
```

The simulator is synthetic-only. It reads an invented snapshot history, applies the history's retention policy, and reports the retained snapshot set, deduplicated `storedBytes` footprint, retained logical bytes, and estimated monthly and annual storage cost. Use `--output <path>` to write the report somewhere else.

## Integrity Receipts

Generate a signed integrity receipt after snapshot verification and any available restore evidence:

```bash
npm run grocy:backup:receipt
```

By default, the receipt is written to:

```text
data/grocy-backup-integrity-receipt.json
```

The receipt records public-safe metadata about the latest backup record, reruns archive verification without restore writes, signs the receipt body with an HMAC derived from the configured backup passphrase environment variable, and links any conventional restore-plan or restore-drill artifacts that are already present. Use `--output <path>` to write the receipt somewhere else, `--config <path>` to read a non-default backup config, `--archive <path>` to target a specific manifest record, and `--restore-plan-report` or `--restore-drill-report` to point at non-default evidence files.

Verify an existing receipt against the current manifest and proof artifacts:

```bash
npm run grocy:backup:receipt:verify
```

Use `--config <path>` when the receipt was generated from a non-default backup config. Use `--output <path>` to persist the verification result as a public-safe JSON artifact.

The verifier reruns schema validation, validates the receipt signature against the configured backup passphrase environment variable, checks the manifest record, reruns `grocy:backup:verify` without restore writes, and compares any referenced restore-plan or restore-drill artifacts. It exits non-zero when the receipt no longer matches current evidence.

## Restore Drills

The example backup source under `examples/synthetic-grocy-backup-source` is intentionally synthetic. Use it to test the snapshot, encrypted archive, verification, and restore loop before pointing a local config at private Grocy files.

For a synthetic passphrase-rotation rehearsal that intentionally verifies the wrong-passphrase failure mode before creating a fresh archive, see [Synthetic Backup Passphrase Rotation Rehearsal](synthetic-backup-passphrase-rotation-rehearsal.md).

For a single command walkthrough that records explicit recovery checkpoints, see [Fixture-Only Restore Drill Walkthrough](fixture-only-restore-drill-walkthrough.md).

For route selection guidance across config preview, mock smoke, and backup recovery evidence, see [Recovery Confidence Routing Review](recovery-confidence-routing-review.md).

Run the drill with:

```bash
npm run grocy:backup:restore-drill -- --restore-dir restore/fixture-only-restore-drill
```

By default, the restore drill report is written to:

```text
data/grocy-backup-restore-drill-report.json
```

Run the failure-injection drill with:

```bash
npm run grocy:backup:restore-failure-drill -- --restore-dir restore/fixture-only-restore-failure-drill
```

By default, the failure drill report is written to:

```text
data/grocy-backup-restore-failure-drill-report.json
```

The failure drill records three machine-checkable rejection scenarios: corruption detected as `manifest_checksum_mismatch`, wrong-passphrase rejection as `archive_decryption_failed`, and restore path escape rejection as `restore_path_escape`.

## Restore Failure Categories

When restore verification fails, the backup manifest records `restoreTestStatus: "failed"` and a public-safe `restoreFailureCategory` when a backup record is available:

- `archive_unreadable`: the encrypted archive file could not be read or parsed.
- `archive_format_unsupported`: the archive envelope is not a supported toolkit backup format.
- `archive_decryption_failed`: the archive could not be decrypted with the configured passphrase.
- `manifest_checksum_mismatch`: the archive hash differs from the manifest record.
- `bundle_file_checksum_mismatch`: a restored bundle file does not match its embedded checksum.
- `restore_write_unconfirmed`: a restore directory was requested without `--confirm-restore-write`.
- `restore_path_escape`: a bundle path attempted to write outside the requested restore directory.
- `restore_write_failed`: the restore check could not create directories or write files.
