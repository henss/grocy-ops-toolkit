# Documentation Index

Use this index to find the right `grocy-ops-toolkit` workflow. The docs root keeps the operator-facing starting points visible; evaluator, compatibility, and maintainer material lives one level deeper.

## Operate Grocy

- [Configuration Workflow](configuration-workflow.md) covers export, desired-state linting, diff previews, dry runs, reviewed applies, drift trends, and migration review.
- [Backup Workflow](backup-workflow.md) covers encrypted snapshots, restore-plan dry runs, verification, integrity receipts, restore drills, retention simulation, and failure categories.
- [Health And Diagnostics](health-and-diagnostics.md) covers health badges, diagnostics artifacts, and first-run install checks.
- [Read-Only Pantry Boundary Probe](read-only-pantry-boundary-probe.md) explains the inventory snapshot boundary.
- [Read-Only Shopping-State Export](read-only-shopping-state-export.md) explains shopping-list state export scope.

## Evaluate Safely Without Live Grocy

- [Synthetic Grocy Demo Lab](./evaluation/synthetic-demo-lab.md) runs the main public-safe demo environment.
- [Synthetic Evaluator Starter Pack](./evaluation/synthetic-evaluator-starter-pack.md) gives the shortest evaluator-facing walkthrough.
- [Quickstart Fixture Gallery](./evaluation/quickstart-fixture-gallery.md) maps commands, docs, and example artifacts.
- [Synthetic GitOps Drift CI Template](./evaluation/synthetic-gitops-drift-ci-template.md) shows a reusable GitHub Actions path.
- [Recovery Confidence Routing Review](./evaluation/recovery-confidence-routing-review.md) helps choose between config preview, mock smoke, and backup recovery evidence.
- [Synthetic Backup Passphrase Rotation Rehearsal](./evaluation/synthetic-backup-passphrase-rotation-rehearsal.md) documents a public-safe rotation rehearsal.
- [Fixture-Only Restore Drill Walkthrough](./evaluation/fixture-only-restore-drill-walkthrough.md) records restore-drill checkpoint evidence.
- [Multi-Instance Namespace Prototype](./evaluation/multi-instance-namespace-prototype.md) documents the fixture-only namespace layout proof.
- [Synthetic Examples](../examples/README.md) lists committed public-safe example artifact shapes.

## Compatibility And Debugging

- [Synthetic Grocy Fixture Server](./compatibility/synthetic-fixture-server.md) documents the local read-only fixture server.
- [Grocy API Compatibility Matrix](./compatibility/grocy-api-compatibility-matrix.md) summarizes fixture-only API-shape coverage.
- [Grocy Schema Fixture Capture](./compatibility/grocy-schema-fixture-capture.md) records schema-only endpoint shapes.
- [Grocy API Trace Harness](./compatibility/grocy-api-trace-harness.md) records and replays redacted API traces.
- [Grocy API Deprecation Canary Report](./compatibility/grocy-api-deprecation-canary-report.md) interprets compatibility gaps as upgrade-risk signals.
- [Synthetic Object Coverage Playground](./compatibility/synthetic-object-coverage-playground.md) shows covered, degraded, and missing object-surface scenarios.
## Maintainer / Contributor Workflows

- [Package Consumer Smoke](./maintainers/package-consumer-smoke.md) documents the npm-first sample consumer check and no-install preview path.
- [Public Artifacts And Support](./maintainers/public-artifacts-and-support.md) covers review dashboards, redaction audits, and sanitized support bundles.
- [Agent-Surface Pre-Edit Check](./maintainers/agent-surface-preedit.md) documents the repo-local surface guard.
- [Contributing](../CONTRIBUTING.md) covers public-safe contribution expectations.
- Sensitive-data reports should stay private; if a repository security policy file is present, follow it.
