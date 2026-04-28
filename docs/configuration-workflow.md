# Configuration Workflow

Use this workflow to export Grocy configuration, review changes, and apply only explicitly approved writes.

## Export Live Configuration

```bash
npm run grocy:export-config
```

By convention, the export is written to `data/grocy-config-export.json`.

## Diff Desired State Against Live State

Lint the manifest first when you want a reviewable offline report. The diff command also runs the same gate automatically and fails before any live export when the manifest is not safe to use.

```bash
npm run grocy:desired-state:lint
```

By default, the lint report is written to:

```text
data/grocy-desired-state-manifest-lint-report.json
```

Use `--manifest <path>` to point at a different desired-state file, and `--output <path>` to write the report somewhere else.

Then diff the desired state against the live export:

```bash
npm run grocy:diff-config
```

By default, the diff command writes the sync plan to:

```text
data/grocy-config-sync-plan.json
```

It also writes a preview-first diff report to:

```text
data/grocy-config-diff-preview-report.json
```

Use `--output <path>` to override the sync plan path and `--preview-output <path>` to override the preview report path.

## Review The Apply Plan

Start with the diff preview report for desired-state review. Then run a dry run when you want the later apply-focused report from an existing sync plan without sending live write requests.

```bash
npm run grocy:apply-config -- --plan data/grocy-config-sync-plan.json --dry-run
```

By default, the dry-run report is written to:

```text
data/grocy-config-apply-dry-run-report.json
```

Use `--output <path>` to write the report somewhere else.

The report includes explicit review notes that restate the no-write boundary and point back to the reviewed plan path before any confirmed apply step.

## Compare Exports Over Time

Render a longitudinal drift report from two existing config exports. This is offline and does not require live Grocy credentials.

```bash
npm run grocy:config:drift-trend -- --previous data/grocy-config-export.previous.json --current data/grocy-config-export.json
```

By default, the report is written to:

```text
data/grocy-config-drift-trend-report.json
```

Use `--output <path>` to write the report somewhere else.

## Diagnose GitOps Upgrade Migrations

When an upgrade changes Grocy versions or config behavior, generate an offline migration-doctor report from the desired state plus previous/current exports. The report recomputes the current sync plan unless you pass an existing `--plan <path>`.

```bash
npm run grocy:config:migration-doctor -- --manifest config/desired-state.json --previous data/grocy-config-export.previous.json --current data/grocy-config-export.json
```

By default, the report is written to:

```text
data/grocy-config-migration-doctor-report.json
```

Use `--plan <path>` when you want the report to point at an already-reviewed sync plan, and `--output <path>` to write the report somewhere else.

The report stays offline and highlights migration-sensitive findings such as Grocy version changes, repo-managed items removed or changed across exports, pending creates or updates, and manual-review matches that would block a safe GitOps apply.

## Apply Reviewed Writes

Only run this after reviewing the generated plan and dry-run report.

```bash
npm run grocy:apply-config -- --plan data/grocy-config-sync-plan.json --confirm-reviewed-write
```
