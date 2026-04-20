# grocy-ops-toolkit

TypeScript toolkit for safe Grocy GitOps, health checks, and encrypted local backups.

## Overview

`grocy-ops-toolkit` helps manage Grocy configuration and local backup workflows in a reviewable, automation-friendly way.

It can:

- Read Grocy stock, shopping-list, product, and master/config objects.
- Export stable Grocy master/config records into a reviewable JSON manifest.
- Diff a reviewed desired-state manifest against a live export.
- Report config drift trends between two offline exports.
- Apply only reviewed `repo_managed` creates and updates when explicitly confirmed.
- Create and verify encrypted local backup bundles.
- Render a Markdown review dashboard from generated artifacts.
- Audit generated public artifacts for private-path, URL, credential, and boundary-term leaks.
- Generate a synthetic Grocy API compatibility matrix for fixture-only API-shape review.

## Requirements

- Node.js 20 or newer.
- npm.
- Grocy credentials for live Grocy health, export, diff, and apply workflows.

Live credentials are not required for the synthetic demo, mock smoke test, apply dry run from an existing plan, or backup verification against synthetic files.

## Quick Start

Install dependencies and verify the project:

```bash
npm install
npm run typecheck
npm run build
npm test
```

Create a local Grocy config from the example:

```bash
cp examples/grocy.local.example.json config/grocy.local.json
```

Then run the basic status and health checks:

```bash
npm run grocy:config:status
npm run grocy:health
npm run grocy:health:diagnostics
```

## Configuration Workflow

Use this workflow to export Grocy configuration, review changes, and apply only explicitly approved writes.

### 1. Export Live Configuration

```bash
npm run grocy:export-config
```

### 2. Diff Desired State Against Live State

```bash
npm run grocy:diff-config
```

### 3. Review The Apply Plan

Run a dry run first. This reads an existing sync plan and writes a review report without sending live write requests.

```bash
npm run grocy:apply-config -- --plan data/grocy-config-sync-plan.json --dry-run
```

By default, the dry-run report is written to:

```text
data/grocy-config-apply-dry-run-report.json
```

Use `--output <path>` to write the report somewhere else.

### 4. Compare Exports Over Time

Render a longitudinal drift report from two existing config exports. This is offline and does not require live Grocy credentials.

```bash
npm run grocy:config:drift-trend -- --previous data/grocy-config-export.previous.json --current data/grocy-config-export.json
```

By default, the report is written to:

```text
data/grocy-config-drift-trend-report.json
```

Use `--output <path>` to write the report somewhere else.

### 5. Apply Reviewed Writes

Only run this after reviewing the generated plan and dry-run report.

```bash
npm run grocy:apply-config -- --plan data/grocy-config-sync-plan.json --confirm-reviewed-write
```

## Health And Diagnostics

Run diagnostics when health checks fail or when an agent-readable troubleshooting artifact is useful.

```bash
npm run grocy:health:diagnostics
```

By default, diagnostics are written to:

```text
data/grocy-health-diagnostics.json
```

The diagnostics artifact records reachability checks and next actions. It does not store Grocy record contents, API keys, absolute local paths, or live URL values.

Use `--output <path>` to write the artifact somewhere else.

## Mock Smoke Test

The mock smoke command runs the health, config export, sync-plan, and apply dry-run path against synthetic Grocy responses. It is intended for CI environments that must not depend on live Grocy credentials.

```bash
npm run grocy:smoke:mock
```

By default, the mock smoke report is written to:

```text
data/grocy-mock-smoke-report.json
```

Use `--output <path>` to write the report somewhere else.

## API Compatibility Matrix

Generate a fixture-only compatibility matrix for the Grocy API response shapes the toolkit reads:

```bash
npm run grocy:compatibility:matrix
```

By default, the matrix is written to:

```text
data/grocy-api-compatibility-matrix.json
```

The matrix uses synthetic fixtures only. It is intended to show expected API shapes and gaps, not to make live Grocy version support claims. For details, see [Grocy API Compatibility Matrix](docs/grocy-api-compatibility-matrix.md).

## Review Dashboard

Render a Markdown dashboard from existing JSON artifacts:

```bash
npm run grocy:review:dashboard
```

By default, the dashboard is written to:

```text
data/grocy-review-dashboard.md
```

The dashboard can summarize:

- Config sync plans.
- Apply dry-run reports.
- Config drift trend reports.
- Health diagnostics.
- Backup manifests.
- Mock smoke reports.

Use these options to point at specific local artifacts:

- `--plan`
- `--dry-run-report`
- `--drift-trend-report`
- `--diagnostics`
- `--backup-manifest`
- `--smoke-report`
- `--output <path>`

## Public Artifact Redaction Audit

Audit generated JSON and Markdown artifacts before sharing or committing public examples:

```bash
npm run grocy:artifacts:audit-redaction
```

By default, the audit scans:

```text
data
examples
```

The audit report is written to:

```text
data/grocy-public-artifact-redaction-audit.json
```

The report lists finding codes, line numbers, and repo-relative file paths only. It does not echo matched snippets. Use `--path <path>` one or more times to scan specific repo-local artifact paths, and `--output <path>` to write the report somewhere else.

## Backup Workflow

Create a local backup config from the example:

```bash
cp examples/grocy-backup.local.example.json config/grocy-backup.local.json
```

Set the configured passphrase environment variable, then create and verify a backup:

```bash
npm run grocy:backup:snapshot
npm run grocy:backup:verify
```

To verify by restoring into a local restore directory, explicitly confirm the restore write:

```bash
npm run grocy:backup:verify -- --restore-dir restore/grocy-backup-check --confirm-restore-write
```

The example backup source under `examples/synthetic-grocy-backup-source` is intentionally synthetic. Use it to test the snapshot, encrypted archive, verification, and restore loop before pointing a local config at private Grocy files.

## Synthetic Demo Lab

For a clean-checkout walkthrough that uses synthetic data only, see [Synthetic Grocy Demo Lab](docs/synthetic-demo-lab.md).

The demo combines:

- Diagnostics.
- Mock smoke.
- Config diff.
- Apply dry run.
- Backup verification.
- Dashboard rendering.

## Common Commands

```bash
npm run grocy:config:status
npm run grocy:health
npm run grocy:health:diagnostics
npm run grocy:compatibility:matrix
npm run grocy:smoke:mock
npm run grocy:export-config
npm run grocy:diff-config
npm run grocy:config:drift-trend -- --previous data/grocy-config-export.previous.json --current data/grocy-config-export.json
npm run grocy:apply-config -- --plan data/grocy-config-sync-plan.json --dry-run
npm run grocy:apply-config -- --plan data/grocy-config-sync-plan.json --confirm-reviewed-write
npm run grocy:backup:snapshot
npm run grocy:backup:verify
npm run grocy:backup:verify -- --restore-dir restore/grocy-backup-check --confirm-restore-write
npm run grocy:review:dashboard
npm run grocy:artifacts:audit-redaction
```
