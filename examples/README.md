# Synthetic Examples For grocy-ops-toolkit

Examples in this directory are placeholders for public-safe fixtures.

Rules:

- Prefer invented project names and generic identifiers.
- Keep examples small enough to audit in one pass.
- Do not copy real source-repo fixtures and then redact them later.
- Add a short note when an example intentionally models a private-repo behavior shape.

Config sync examples use synthetic product names and IDs. `config-apply-dry-run-report.example.json` shows the report shape produced before any reviewed apply write.

`grocy-health-diagnostics.example.json` shows the agent-readable health failure artifact shape. It uses only synthetic failure evidence and intentionally omits Grocy record contents, live URL values, and local absolute paths.
