# Public Artifacts And Support

Use these workflows when preparing review dashboards, sanitized support evidence, or public-safe artifacts for issues and examples.

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

When you pass one or more explicit artifact flags, the dashboard stays scoped to those requested inputs instead of auto-loading other default artifacts from `data/`. This keeps a config diff plus apply dry-run review focused on the exact files under review.

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

## Offline Support Bundle

Generate a sanitized support bundle manifest from local generated artifacts:

```bash
npm run grocy:support:bundle
```

By default, the bundle is written to:

```text
data/grocy-support-bundle.json
```

The bundle records repo-relative artifact paths, file checksums, file sizes, safe summary fields, a sample support issue report, a rendered Markdown issue template, structured evidence groups, replay commands, and snippet-free redaction evidence. The redaction section includes scanned paths, rule codes, rule descriptions, finding locations, and the current readiness result without matched sensitive snippets. It does not embed artifact contents, Grocy record payloads, credentials, absolute local paths, or encrypted backup archives. If the redaction audit finds issues, the command exits non-zero and the bundle summary is marked `needs_redaction_review`.

Use `issueReport.bodyMarkdown` when opening a health or backup debugging issue. It gives a public-safe title, labels, body sections, evidence groups, attachment checklist, and replay commands such as `npm run grocy:health:diagnostics`, `npm run grocy:backup:verify -- --output data/grocy-backup-verification-report.json --force`, and `npm run grocy:backup:restore-failure-drill -- --restore-dir restore/grocy-restore-failure-drill`.

Attach only the support bundle and referenced public-safe artifacts. Keep live exports, decrypted backup files, credentials, and unreviewed local logs out of the issue.

Use `--artifact <path>` one or more times to include specific repo-local generated artifacts, `--audit-path <path>` one or more times to limit the redaction scan to the intended attachment set, and `--output <path>` to write the bundle somewhere else.
