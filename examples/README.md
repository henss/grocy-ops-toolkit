# Synthetic Examples For grocy-ops-toolkit

Examples in this directory are placeholders for public-safe fixtures.

Rules:

- Prefer invented project names and generic identifiers.
- Keep examples small enough to audit in one pass.
- Do not copy real source-repo fixtures and then redact them later.
- Add a short note when an example intentionally models a private-repo behavior shape.

Config sync examples use synthetic product names and IDs. `config-apply-dry-run-report.example.json` shows the report shape produced before any reviewed apply write.

`grocy-config-diff-preview-report.example.json` shows the preview-first desired-state diff artifact emitted alongside the sync plan before any apply-focused dry run.

`grocy-desired-state-manifest-lint-report.example.json` shows the offline lint-gate report shape for a public-safe desired-state manifest.

`config-export.previous.example.json` and `grocy-config-drift-trend-report.example.json` show the public-safe offline trend report shape for comparing two config exports.

`grocy-config-migration-doctor-report.example.json` shows the offline GitOps upgrade review artifact emitted by `npm run grocy:config:migration-doctor`.

`grocy-health-diagnostics.example.json` shows the agent-readable health failure artifact shape. It uses only synthetic failure evidence and intentionally omits Grocy record contents, live URL values, and local absolute paths.

`grocy-health-badge.example.json` shows the compact badge-style JSON emitted by `npm run grocy:health:badge` for CI, docs, and agent receipts.

`grocy-install-doctor.example.json` shows the first-run preflight artifact emitted by `npm run grocy:install:doctor`.

`grocy-quickstart-proof-receipt.example.json` shows the compact receipt emitted by `npm run grocy:quickstart:proof` when the README quickstart recipes have been reproved with synthetic fixtures.

`grocy-evaluator-starter-pack.example.json` shows the evaluator-facing starter-pack receipt emitted by `npm run grocy:evaluator:starter-pack`.

`grocy-mock-smoke-report.example.json` shows the public-safe report shape emitted by `npm run grocy:smoke:mock`.

`grocy-mock-smoke-receipt.example.json` shows the compact run receipt emitted alongside the synthetic mock smoke report.

`grocy-secret-rotation-smoke-report.example.json` shows the synthetic credential and backup-key rotation report emitted by `npm run grocy:smoke:secret-rotation`.

`grocy-api-compatibility-matrix.example.json` shows the fixture-only matrix shape emitted by `npm run grocy:compatibility:matrix`.

`grocy-api-trace-harness.example.json` shows the prototype redacted trace artifact emitted by `npm run grocy:bug-report:trace`.

`grocy-api-deprecation-canary-report.example.json` shows the synthetic upgrade-risk report emitted by `npm run grocy:compatibility:deprecation-canary`.

`grocy-object-coverage-playground.example.json` shows the fixture-only object coverage playground emitted by `npm run grocy:coverage:playground`.

`grocy-inventory-snapshot.example.json` shows the prototype read-only inventory snapshot emitted by `npm run grocy:inventory:snapshot` from the `stock` and `products` read surfaces only.

`grocy-shopping-state-export.example.json` shows the read-only shopping-state export emitted by `npm run grocy:shopping-state:export` from the `shopping_lists` and `shopping_list` read surfaces only.

`grocy-review-dashboard.example.md` shows the public-safe Markdown dashboard shape rendered from existing synthetic JSON artifacts.

`grocy-public-artifact-redaction-audit.example.json` shows a passing public-boundary audit report for generated JSON and Markdown artifacts.

`grocy-support-bundle.example.json` shows the offline sanitized support bundle manifest emitted by `npm run grocy:support:bundle`.

`grocy-backup-restore-plan-dry-run-report.example.json` shows the no-write restore planning report emitted by `npm run grocy:backup:restore-plan`.

`grocy-backup-verification-report.example.json` shows the public-safe encrypted backup verification artifact emitted by `npm run grocy:backup:verify -- --output ...`.

`grocy-backup-retention-history.example.json` shows the synthetic-only history input used to simulate retention-policy footprint and storage cost.

`grocy-backup-retention-simulation-report.example.json` shows the synthetic retention simulation report emitted by `npm run grocy:backup:retention-simulate`.

`grocy-backup-restore-drill-report.example.json` shows the fixture-only checkpoint artifact emitted by `npm run grocy:backup:restore-drill`.

`grocy-backup-integrity-receipt.example.json` shows the signed backup evidence receipt emitted by `npm run grocy:backup:receipt` after snapshot verification and optional restore-plan or restore-drill evidence are available.

`grocy-backup-integrity-receipt-verification.example.json` shows the public-safe verifier result emitted by `npm run grocy:backup:receipt:verify` when the stored receipt still matches the manifest and proof artifacts.

For the quickest map from these example files to their matching commands and docs, see [Quickstart Fixture Gallery](../docs/quickstart-fixture-gallery.md).

For a built-checkout preview that uses `npx --no-install grocy-ops-toolkit` to regenerate the health and backup example shapes without a global install step, see the repository-level [No-Install Example Preview](../README.md#no-install-example-preview).

The repository-level [Synthetic Grocy Demo Lab](../docs/synthetic-demo-lab.md) shows how to combine these examples with generated local artifacts from a clean checkout.
