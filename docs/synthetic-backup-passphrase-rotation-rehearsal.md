# Synthetic Backup Passphrase Rotation Rehearsal

This rehearsal exercises backup passphrase rotation behavior with synthetic fixture files only. It proves three public-safe outcomes:

1. Existing encrypted archives fail verification when the shell uses the wrong passphrase.
2. The failure is recorded as `archive_decryption_failed` without exposing archive contents, Grocy records, or real secrets.
3. Verification succeeds again when the correct passphrase is restored, and a fresh archive can then be created under the rotated passphrase.

Use this rehearsal before introducing any private Grocy files or real secret-management workflow.

## Setup

Install dependencies and prepare conventional local paths:

```bash
npm install
mkdir -p config data backups restore
cp examples/grocy-backup.local.example.json config/grocy-backup.local.json
```

PowerShell:

```powershell
npm install
New-Item -ItemType Directory -Force config, data, backups, restore | Out-Null
Copy-Item examples/grocy-backup.local.example.json config/grocy-backup.local.json
```

The copied example already points at `examples/synthetic-grocy-backup-source`.

## Rehearsal

### 1. Create a baseline archive with the old synthetic passphrase

```bash
export GROCY_BACKUP_PASSPHRASE="synthetic-passphrase-v1"
npm run grocy:backup:snapshot
```

PowerShell:

```powershell
$env:GROCY_BACKUP_PASSPHRASE = "synthetic-passphrase-v1"
npm run grocy:backup:snapshot
```

Expected result: `data/grocy-backup-manifest.json` records a new archive with `restoreTestStatus: "not_tested"`.

### 2. Rehearse the rotation failure mode with the new synthetic passphrase

Switch the shell to the rotated passphrase and verify the existing archive:

```bash
export GROCY_BACKUP_PASSPHRASE="synthetic-passphrase-v2"
npm run grocy:backup:verify
```

PowerShell:

```powershell
$env:GROCY_BACKUP_PASSPHRASE = "synthetic-passphrase-v2"
npm run grocy:backup:verify
```

Expected result: verification fails because the existing archive was encrypted with the old passphrase. The latest manifest record should now include:

- `restoreTestStatus: "failed"`
- `restoreFailureCategory: "archive_decryption_failed"`

This is the expected synthetic rehearsal signal for a mismatched passphrase during rotation.

### 3. Confirm the old archive still verifies with the old passphrase

```bash
export GROCY_BACKUP_PASSPHRASE="synthetic-passphrase-v1"
npm run grocy:backup:verify -- --restore-dir restore/passphrase-rotation-check --confirm-restore-write
```

PowerShell:

```powershell
$env:GROCY_BACKUP_PASSPHRASE = "synthetic-passphrase-v1"
npm run grocy:backup:verify -- --restore-dir restore/passphrase-rotation-check --confirm-restore-write
```

Expected result: verification succeeds with `checksumVerified: true`, and the restore check writes only synthetic fixture files into `restore/passphrase-rotation-check`.

### 4. Create a fresh archive under the rotated passphrase

After the old archive is validated, set the rotated passphrase again and create a new encrypted archive:

```bash
export GROCY_BACKUP_PASSPHRASE="synthetic-passphrase-v2"
npm run grocy:backup:snapshot
npm run grocy:backup:verify
```

PowerShell:

```powershell
$env:GROCY_BACKUP_PASSPHRASE = "synthetic-passphrase-v2"
npm run grocy:backup:snapshot
npm run grocy:backup:verify
```

Expected result: the newest manifest entry verifies successfully under the rotated passphrase, proving the archive lifecycle still works after the rehearsal.

## Cleanup

```bash
rm -rf data backups restore config/grocy-backup.local.json
```

PowerShell:

```powershell
Remove-Item -Recurse -Force data, backups, restore -ErrorAction SilentlyContinue
Remove-Item -Force config/grocy-backup.local.json -ErrorAction SilentlyContinue
```
