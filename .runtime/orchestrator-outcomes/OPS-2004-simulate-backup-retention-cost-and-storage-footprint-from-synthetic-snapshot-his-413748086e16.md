# Domain Execution Outcome: Simulate backup retention cost and storage footprint from synthetic snapshot histories

## Summary
Implemented OPS-2004 as a public-safe backup retention simulator for synthetic snapshot histories. The toolkit now reads an invented history artifact, applies hourly/daily/weekly/monthly retention buckets, and emits a machine-checkable footprint and storage-cost report with retained snapshots, expired snapshots, and a growth timeline.

## What changed
- Added a new synthetic-only backup retention simulation surface in `src/backup-retention-simulation.ts` with a dedicated schema module in `src/backup-retention-simulation-schema.ts`.
- Added CLI and npm entry support for `grocy:backup:retention-simulate` plus package exports for library consumers.
- Added synthetic example input/output artifacts and focused tests covering report generation, conventional output recording, CLI execution, and example-schema validity.
- Updated public repo docs to describe the new retention simulation flow and example files.

## Why it mattered
This gives the toolkit a bounded way to estimate backup retention footprint and cost without using live Grocy archives, private household data, or repo-external ledgers. It also keeps the new surface isolated from the already near-limit backup and schema files, which reduces future token and maintenance waste.

## Structured Outcome Data
- Output classification: code
- Linear issue: OPS-2004
- Verification:
  - `npm run typecheck`
  - `npm run build`
  - `npm test`
- Scout/adoption note: not applicable; this slice adds a repo-local synthetic report and schema rather than reusable shared tooling or a new dependency.
- Efficiency reflection: early expectations for overlapping weekly/monthly retention buckets were wrong; the root-cause fix was to anchor the example report and assertions to the implementation's exact simulated output instead of maintaining hand-derived totals.

## Continuation Decision
- Action: complete
- Confidence: high
- Recommended next step: if backup planning needs more realism later, add an optional scenario comparison command that evaluates multiple synthetic policies against the same history file rather than widening this first command into policy authoring or live archive analysis.
