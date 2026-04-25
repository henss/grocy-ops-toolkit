# Quickstart Fixture Gallery

This gallery is the shortest public-safe way to understand the toolkit's synthetic fixtures, example artifacts, and no-credential command paths.

Everything linked here stays inside the public boundary:

- synthetic Grocy API fixtures only
- invented product and config records only
- conventional local paths such as `config/`, `data/`, `backups/`, and `restore/`
- no household details, shopping intent workflows, pantry-monitoring policy, calendar/task integrations, or operator-specific operating policy

## Quick Verification Loop

Start with the standard repo checks:

```bash
npm install
npm run grocy:init:workspace
npm run grocy:evaluator:starter-pack
npm run grocy:quickstart:proof
npm run grocy:install:doctor -- --output data/gallery-install-doctor.json --force
npm run typecheck
npm run build
npm test
```

`npm run grocy:init:workspace` creates the conventional local starter paths and starter config files used by the toolkit.

To refresh the starter files later, rerun it with `--force`:

```bash
npm run grocy:init:workspace -- --force
```

PowerShell:

```powershell
npm run grocy:init:workspace -- --force
```

Use this section when you need to confirm a clean checkout before reviewing any individual fixture family.

Expected result: workspace init lays down public-safe starter files, and the install doctor confirms that setup while still flagging any remaining local placeholders before the deeper fixture loops begin.

When you want the shortest evaluator-facing command instead of choosing fixture families manually, use `npm run grocy:evaluator:starter-pack`. It refreshes the README quickstart proof and points directly at the main dashboard, proof receipt, and support bundle artifacts.

When you need a compact receipt that proves the README quickstart recipes still regenerate their public-safe artifacts, use `npm run grocy:quickstart:proof`. It writes `data/grocy-quickstart-proof-receipt.json` and stages the matching quickstart evidence files under conventional repo paths.

- Example artifact: `examples/grocy-quickstart-proof-receipt.example.json`

## Gallery Map

### 1. Health Failure Fixtures

Use these when you want the smallest no-credential proof that the toolkit emits public-safe health artifacts.

- Command: `npm run grocy:install:doctor -- --output data/gallery-install-doctor.json --force`
- Command: `npm run grocy:health:badge -- --output data/preview-health-badge.json --force`
- Command: `npm run grocy:health:diagnostics -- --output data/preview-health-diagnostics.json --force`
- Example artifact: `examples/grocy-install-doctor.example.json`
- Example artifact: `examples/grocy-health-badge.example.json`
- Example artifact: `examples/grocy-health-diagnostics.example.json`

Expected result: the install-doctor and health artifacts report synthetic first-run gaps without live Grocy URLs, record contents, or private local paths.

### 2. Config Review Fixtures

Use these when you need an offline desired-state and drift-review path built from synthetic config records.

- Command: `npm run grocy:desired-state:lint -- --manifest examples/desired-state.example.json --output data/gallery-desired-state-lint.json --force`
- Command: `npm run grocy:diff-config -- --manifest examples/desired-state.example.json --export examples/config-export.example.json --output data/gallery-config-sync-plan.json --preview-output data/gallery-config-diff-preview.json --force`
- Command: `npm run grocy:config:drift-trend -- --previous examples/config-export.previous.example.json --current examples/config-export.example.json --output data/gallery-config-drift-trend.json --force`
- Command: `npm run grocy:apply-config -- --plan data/gallery-config-sync-plan.json --dry-run --output data/gallery-apply-dry-run.json --force`
- Example artifact: `examples/grocy-desired-state-manifest-lint-report.example.json`
- Example artifact: `examples/config-sync-plan.example.json`
- Example artifact: `examples/grocy-config-diff-preview-report.example.json`
- Example artifact: `examples/grocy-config-drift-trend-report.example.json`
- Example artifact: `examples/config-apply-dry-run-report.example.json`

Expected result: the gallery remains review-only and shows invented product/config changes such as `Example Coffee` first in the diff preview, then in the later apply dry-run artifact, without widening into live apply writes.

### 3. Fixture API Shapes

Use these when you need Grocy-like HTTP reads or synthetic API-shape review without a live Grocy instance.

- Command: `npm run grocy:fixtures:serve`
- Command: `npm run grocy:compatibility:matrix -- --output data/gallery-compatibility-matrix.json --force`
- Command: `npm run grocy:compatibility:deprecation-canary -- --output data/gallery-deprecation-canary.json --force`
- Command: `npm run grocy:coverage:playground -- --output data/gallery-object-coverage.json --force`
- Example artifact: `examples/grocy-api-compatibility-matrix.example.json`
- Example artifact: `examples/grocy-api-deprecation-canary-report.example.json`
- Example artifact: `examples/grocy-object-coverage-playground.example.json`
- Reference doc: [Synthetic Grocy Fixture Server](synthetic-fixture-server.md)
- Reference doc: [Synthetic Object Coverage Playground](synthetic-object-coverage-playground.md)

Expected result: you can inspect supported and degraded synthetic API shapes without implying live Grocy certification or support guarantees.

### 4. Backup And Recovery Fixtures

Use these when you need synthetic encrypted backup evidence, restore planning, or restore-proof walkthroughs.

- Command: `npm run grocy:backup:snapshot`
- Command: `npm run grocy:backup:restore-plan -- --restore-dir restore/gallery-backup-check --output data/gallery-backup-restore-plan.json --force`
- Command: `npm run grocy:backup:verify -- --output data/gallery-backup-verification.json --force`
- Command: `npm run grocy:backup:restore-drill -- --restore-dir restore/gallery-restore-drill --output data/gallery-restore-drill.json --force`
- Command: `npm run grocy:backup:receipt -- --output data/gallery-backup-receipt.json --force`
- Command: `npm run grocy:backup:receipt:verify -- --receipt data/gallery-backup-receipt.json --output data/gallery-backup-receipt-verification.json --force`
- Example artifact: `examples/grocy-backup-verification-report.example.json`
- Example artifact: `examples/grocy-backup-restore-plan-dry-run-report.example.json`
- Example artifact: `examples/grocy-backup-restore-drill-report.example.json`
- Example artifact: `examples/grocy-backup-integrity-receipt.example.json`
- Example artifact: `examples/grocy-backup-integrity-receipt-verification.example.json`
- Reference doc: [Fixture-Only Restore Drill Walkthrough](fixture-only-restore-drill-walkthrough.md)

Before running the backup commands, copy `examples/grocy-backup.local.example.json` to `config/grocy-backup.local.json` and set `GROCY_BACKUP_PASSPHRASE` to a synthetic value for the current shell.

Expected result: the toolkit generates machine-checkable synthetic recovery evidence, including a persisted encrypted-backup verification report and a signed receipt, without private source files or live Grocy credentials.

### 5. Review And Boundary Fixtures

Use these when you need a concise Markdown summary or a final public-boundary audit across generated artifacts.

- Command: `npm run grocy:smoke:mock -- --output data/gallery-mock-smoke-report.json --force`
- Command: `npm run grocy:review:dashboard -- --plan data/gallery-config-sync-plan.json --dry-run-report data/gallery-apply-dry-run.json --drift-trend-report data/gallery-config-drift-trend.json --diagnostics data/preview-health-diagnostics.json --backup-manifest data/grocy-backup-manifest.json --smoke-report data/gallery-mock-smoke-report.json --output data/gallery-review-dashboard.md --force`
- Command: `npm run grocy:artifacts:audit-redaction -- --output data/gallery-redaction-audit.json --force`
- Command: `npm run grocy:support:bundle -- --output data/gallery-support-bundle.json --force`
- Example artifact: `examples/grocy-mock-smoke-report.example.json`
- Example artifact: `examples/grocy-review-dashboard.example.md`
- Example artifact: `examples/grocy-public-artifact-redaction-audit.example.json`
- Example artifact: `examples/grocy-support-bundle.example.json`

Expected result: the dashboard and audit artifacts stay legible for human review and agent ingestion while checking for boundary leaks such as private URLs, credentials, and absolute paths.

## Recommended Paths

Pick the smallest slice that answers the current question:

- For a first public-safe run, use the health failure fixtures and config review fixtures.
- For HTTP prototyping or API-shape checks, use the fixture API shapes.
- For recovery confidence, use the backup and recovery fixtures.
- For one command sequence that combines multiple fixture families, use [Synthetic Grocy Demo Lab](synthetic-demo-lab.md).
- For a compact machine-readable proof that the README quickstart recipes still work, use `npm run grocy:quickstart:proof`.
- For the full example file inventory, use [Synthetic Examples For grocy-ops-toolkit](../examples/README.md).

## Public Boundary Reminder

Keep this gallery synthetic. Do not replace these examples with real Grocy exports, household data, shopping records, personal ledgers, or private operating policy.
