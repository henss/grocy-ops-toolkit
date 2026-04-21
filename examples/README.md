# Synthetic Examples For grocy-ops-toolkit

Examples in this directory are placeholders for public-safe fixtures.

Rules:

- Prefer invented project names and generic identifiers.
- Keep examples small enough to audit in one pass.
- Do not copy real source-repo fixtures and then redact them later.
- Add a short note when an example intentionally models a private-repo behavior shape.

Config sync examples use synthetic product names and IDs. `config-apply-dry-run-report.example.json` shows the report shape produced before any reviewed apply write.

`grocy-desired-state-manifest-lint-report.example.json` shows the offline lint-gate report shape for a public-safe desired-state manifest.

`config-export.previous.example.json` and `grocy-config-drift-trend-report.example.json` show the public-safe offline trend report shape for comparing two config exports.

`grocy-health-diagnostics.example.json` shows the agent-readable health failure artifact shape. It uses only synthetic failure evidence and intentionally omits Grocy record contents, live URL values, and local absolute paths.

`grocy-mock-smoke-report.example.json` shows the public-safe report shape emitted by `npm run grocy:smoke:mock`.

`grocy-api-compatibility-matrix.example.json` shows the fixture-only matrix shape emitted by `npm run grocy:compatibility:matrix`.

`grocy-review-dashboard.example.md` shows the public-safe Markdown dashboard shape rendered from existing synthetic JSON artifacts.

`grocy-public-artifact-redaction-audit.example.json` shows a passing public-boundary audit report for generated JSON and Markdown artifacts.

`grocy-support-bundle.example.json` shows the offline sanitized support bundle manifest emitted by `npm run grocy:support:bundle`.

The repository-level [Synthetic Grocy Demo Lab](../docs/synthetic-demo-lab.md) shows how to combine these examples with generated local artifacts from a clean checkout.
