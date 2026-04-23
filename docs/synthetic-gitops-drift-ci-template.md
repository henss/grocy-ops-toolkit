# Synthetic GitOps Drift CI Template

Use this template when you want a GitHub Actions workflow that proves the toolkit's desired-state review path stays public-safe and synthetic.

It is intentionally narrow:

- synthetic desired state only
- synthetic config exports only
- npm-first install and command surface only
- CI artifacts under `data/` only
- no live Grocy credentials, household details, shopping workflows, pantry-monitoring policy, calendar/task integrations, or Stefan-specific operating policy

The committed reusable/manual workflow lives at [`.github/workflows/synthetic-gitops-drift-template.yml`](../.github/workflows/synthetic-gitops-drift-template.yml).

## What It Runs

The template defends the normal package edge first:

```bash
npm install
npm run typecheck
npm run build
npm test
```

Then it runs the synthetic desired-state drift review path:

```bash
npm run grocy:desired-state:lint -- --manifest examples/desired-state.example.json --output data/ci-desired-state-lint-report.json --force
npm run grocy:diff-config -- --manifest examples/desired-state.example.json --export examples/config-export.example.json --output data/ci-config-sync-plan.json --force
npm run grocy:config:drift-trend -- --previous examples/config-export.previous.example.json --current examples/config-export.example.json --output data/ci-config-drift-trend-report.json --force
npm run grocy:apply-config -- --plan data/ci-config-sync-plan.json --dry-run --output data/ci-config-apply-dry-run-report.json --force
npm run grocy:review:dashboard -- --plan data/ci-config-sync-plan.json --dry-run-report data/ci-config-apply-dry-run-report.json --drift-trend-report data/ci-config-drift-trend-report.json --output data/ci-gitops-drift-review-dashboard.md --force
```

Expected result: CI uploads a lint report, sync plan, drift trend report, apply dry-run report, and Markdown review dashboard built from the same synthetic example files that already ship in the public repo.

## GitHub Actions Usage

Run the committed workflow manually with `workflow_dispatch`, or reuse it through `workflow_call` from another workflow:

```yaml
jobs:
  synthetic-gitops-drift:
    uses: ./.github/workflows/synthetic-gitops-drift-template.yml
```

This keeps the review path inside the repository's existing GitHub Actions surface and avoids adding a separate workflow framework or new package dependency.

## Uploaded Artifacts

The template uploads these review artifacts:

- `data/ci-desired-state-lint-report.json`
- `data/ci-config-sync-plan.json`
- `data/ci-config-drift-trend-report.json`
- `data/ci-config-apply-dry-run-report.json`
- `data/ci-gitops-drift-review-dashboard.md`

These artifacts are review-only. They do not export live Grocy config, perform confirmed writes, or imply support for private household workflows.

## When To Use It

Use this template when:

- a pull request changes desired-state manifests, config mapping, or config review logic
- you want a stable synthetic artifact bundle for code review
- you need a CI proof that drift analysis still works without live credentials

Use [Recovery Confidence Routing Review](recovery-confidence-routing-review.md) when you need to choose between config review, mock smoke, and backup/recovery evidence paths.
