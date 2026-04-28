# Synthetic Evaluator Starter Pack

This is the shortest public-safe path for a new evaluator who wants one command, a review surface, and machine-readable proof artifacts without live Grocy credentials.

The starter pack stays inside the toolkit's synthetic boundary:

- invented Grocy config and backup fixtures only
- conventional local paths such as `config/`, `data/`, `backups/`, and `restore/`
- no household details, shopping intent workflows, pantry-monitoring policy, calendar/task integrations, or operator-specific operating policy

## One Command

Run the starter pack from a clean checkout:

```bash
npm install
npm run grocy:evaluator:starter-pack
```

Expected result: the command proves the public quickstart flow, refreshes the one-command demo artifacts, and writes `data/grocy-evaluator-starter-pack.json` as the top-level evaluator receipt.

## Start Here

After the command finishes, read the artifacts in this order:

1. `data/grocy-evaluator-starter-pack.json`
2. `data/demo-review-dashboard.md`
3. `data/grocy-quickstart-proof-receipt.json`
4. `data/demo-support-bundle.json`

The starter-pack receipt is the compact map. The dashboard is the shortest human-readable summary. The quickstart proof receipt shows the exact synthetic recipes that still pass. The support bundle is the shareability-oriented checksum manifest for the main generated artifacts.

## What The Command Proves

The starter pack reuses `npm run grocy:quickstart:proof`, which already stages the public-safe evidence families that evaluators usually need:

- workspace-init and install-doctor proof for a clean checkout
- diagnostics that intentionally show the missing live-config boundary
- passing synthetic mock smoke evidence
- offline desired-state lint, sync-plan, diff-preview, drift-trend, and apply dry-run artifacts
- synthetic backup, restore drill, backup integrity receipt, review dashboard, and redaction-audited support bundle

Because the command stays synthetic-only, it does not require a live Grocy instance, live API keys, real backup contents, or private local workflow context.

## Follow-On Paths

Use the starter pack when the goal is fast evaluation. Move to the other docs only when you need more detail:

- [Synthetic Grocy Demo Lab](./synthetic-demo-lab.md) for the underlying one-command evidence flow
- [Quickstart Fixture Gallery](./quickstart-fixture-gallery.md) for smaller fixture families and targeted follow-up commands
- [Synthetic Examples For grocy-ops-toolkit](../../examples/README.md) for the committed public-safe example shapes
