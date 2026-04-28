# grocy-ops-toolkit

TypeScript toolkit for safe Grocy GitOps, health checks, and encrypted local backups.

## Overview

`grocy-ops-toolkit` helps operators manage Grocy through reviewable files and repeatable commands instead of one-off manual changes.

Use it to:

- Manage Grocy configuration as reviewed desired state.
- Export and compare live Grocy config before applying changes.
- Inspect health and diagnostics.
- Export read-only inventory and shopping-state snapshots.
- Create encrypted local backup bundles, verify them, and plan restores before writing files.
- Generate synthetic demo artifacts when you need public-safe evaluation without live Grocy credentials.

## Requirements

- Node.js 20 or newer.
- npm.
- Grocy credentials for live health, export, diff, and apply workflows.

## Quick Start

Install dependencies and create the conventional local workspace:

```bash
npm install
npm run grocy:init:workspace
npm run grocy:install:doctor -- --output data/install-doctor.json --force
```

`npm run grocy:init:workspace` creates:

- `config/`
- `data/`
- `backups/`
- `restore/`
- `config/grocy.local.json`
- `config/grocy-backup.local.json`

Edit `config/grocy.local.json` for your Grocy instance, then run:

```bash
npm run grocy:config:status
npm run grocy:health
```

Run the normal project checks when you are validating the checkout itself:

```bash
npm run typecheck
npm run build
npm test
```

No live Grocy instance yet? Run the public-safe synthetic demo instead:

```bash
npm run grocy:demo:lab
```

See [Synthetic Grocy Demo Lab](docs/evaluation/synthetic-demo-lab.md) for the generated artifacts and expected results.

## Core Workflows

The toolkit has four common operator paths:

- **Configuration management:** export live config, lint desired state, generate a no-write diff, then apply only reviewed writes.
- **Backups:** create encrypted local snapshots, verify archive integrity, and produce restore plans before confirmed restore writes.
- **Health and diagnostics:** emit compact status artifacts or detailed troubleshooting artifacts without secrets.
- **Read-only state exports:** export inventory and shopping-state artifacts for private consumers.

For the full documentation map, see [Docs Index](docs/README.md).

## Configuration Management

Use this workflow to export Grocy configuration, review changes, and apply only explicitly approved writes.

```bash
npm run grocy:export-config
npm run grocy:desired-state:lint
npm run grocy:diff-config
npm run grocy:apply-config -- --plan data/grocy-config-sync-plan.json --dry-run
```

Review the generated plan and dry-run report, then apply the reviewed writes:

```bash
npm run grocy:apply-config -- --plan data/grocy-config-sync-plan.json --confirm-reviewed-write
```

Useful generated artifacts:

- `data/grocy-config-export.json`
- `data/grocy-desired-state-manifest-lint-report.json`
- `data/grocy-config-sync-plan.json`
- `data/grocy-config-diff-preview-report.json`
- `data/grocy-config-apply-dry-run-report.json`

See [Configuration Workflow](docs/configuration-workflow.md) for custom paths, drift trends, and migration review.

## Backups

Create a local backup config from the example:

```bash
cp examples/grocy-backup.local.example.json config/grocy-backup.local.json
```

Set the configured passphrase environment variable, then create and verify a backup:

```bash
npm run grocy:backup:snapshot
npm run grocy:backup:verify
```

Generate a no-write restore plan before any confirmed restore:

```bash
npm run grocy:backup:restore-plan -- --restore-dir restore/grocy-backup-check
```

To verify by restoring into a local restore directory, explicitly confirm the restore write:

```bash
npm run grocy:backup:verify -- --restore-dir restore/grocy-backup-check --confirm-restore-write
```

See [Backup Workflow](docs/backup-workflow.md) for restore drills, integrity receipts, retention simulation, and failure categories.

## Health And Diagnostics

Run the compact badge command when CI, docs, or automation needs a stable machine-readable health summary:

```bash
npm run grocy:health:badge
```

Run diagnostics when health checks fail or when an agent-readable troubleshooting artifact is useful:

```bash
npm run grocy:health:diagnostics
```

Generated health artifacts intentionally omit Grocy record contents, API keys, absolute local paths, and live URL values.

See [Health And Diagnostics](docs/health-and-diagnostics.md) for artifact shapes and troubleshooting notes.

## Docs Index

- [Documentation index](docs/README.md)
- [Configuration workflow](docs/configuration-workflow.md)
- [Backup workflow](docs/backup-workflow.md)
- [Health and diagnostics](docs/health-and-diagnostics.md)
- [Synthetic demo lab](docs/evaluation/synthetic-demo-lab.md)
- [Quickstart fixture gallery](docs/evaluation/quickstart-fixture-gallery.md)
- [Synthetic examples](examples/README.md)

## Contributing / Security

Contributions should keep examples generic and safe to share. See [CONTRIBUTING.md](CONTRIBUTING.md).

Do not file public issues containing secrets, personal data, customer data, or production configuration.
