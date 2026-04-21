# Public User Pain Scan

Bounded proposal artifact for Linear issue `OPS-1388`.

Scope:

- Current public repo surface only.
- Evidence limited to `README.md`, `CONTRIBUTING.md`, `examples/README.md`, package scripts, and representative tests.
- No live Grocy data, household details, private ledgers, shopping workflows, pantry policy, or Stefan-specific operating policy.

## Method

This scan treats the current repository as the public product surface and looks for friction that a new TypeScript toolkit user would feel before bringing real Grocy credentials or private data into the loop.

Primary evidence:

- `package.json` for the command surface and npm-first defaults.
- `README.md` for the first-run, day-one, and feature-ordering experience.
- `docs/synthetic-demo-lab.md` and `examples/README.md` for the synthetic/public-safe evaluation path.
- `tests/packed-install.test.ts`, `tests/mock-smoke.test.ts`, `tests/health-diagnostics.test.ts`, and `tests/backups.test.ts` for the seams the repo already defends.

## Top User Pains

### 1. First-run command sprawl is still high

The toolkit is disciplined, but the public entry surface is wide for a `0.1.0` package. `package.json` exposes many top-level scripts, and `README.md` walks through health, diagnostics, desired-state linting, diffing, apply dry runs, backups, restore planning, dashboard rendering, redaction audit, support bundles, compatibility matrix generation, and deprecation canaries.

The result is that a new user must decide very early whether they are evaluating:

- the package edge
- the synthetic demo path
- live Grocy health
- config review/apply
- backups
- support and artifact hygiene

That breadth is useful for operators, but it raises the “where do I start?” cost for a public toolkit reader.

### 2. The landing docs mix safe-evaluation and live-ops paths too quickly

`README.md` does contain a clean synthetic path, but it is surrounded by live-config, live-health, config-apply, and backup sections. A first-time reader can see that synthetic evaluation exists without immediately seeing which commands are safe to run with no live Grocy instance.

The tests tell a clearer story than the docs here:

- `tests/mock-smoke.test.ts` shows a full synthetic pass path.
- `tests/packed-install.test.ts` proves the packed package and `npx --no-install` preview flow.
- `tests/health-diagnostics.test.ts` shows a public-safe “config missing” failure artifact.

Those are strong onboarding seams, but they are not yet the dominant narrative on the landing surface.

### 3. The package promise is narrow, but the docs expose several distinct mini-products

The current public package promise is “safe Grocy GitOps, health checks, and encrypted local backups.” In practice, the repo also exposes:

- config drift analysis
- apply dry-run review reports
- review dashboards
- public-artifact redaction audits
- support bundle manifests
- compatibility matrices
- deprecation canaries

Each one is reasonable, but the aggregate impression is a toolkit with several partially independent centers of gravity. That can make the package feel more advanced than it really is for a casual public evaluator, while still feeling incomplete to a serious operator who wants a single guided path.

### 4. Backup and restore validation are well-defended but feel heavy for early evaluation

The backup workflow is careful and public-safe. `tests/backups.test.ts` defends encrypted snapshots, restore-plan dry runs, explicit restore confirmation, wrong-passphrase failure handling, and checksum verification.

That is a strength, but it also means the backup story asks a new user to care about:

- local config placement
- environment-variable passphrases
- backup directories
- restore directories
- dry-run versus confirmed restore behavior

This is appropriate for operators. It is not the best first proof point for a user deciding whether the package is worth trying at all.

### 5. Public-safety discipline is a strength, but it slightly obscures the “happy path”

`CONTRIBUTING.md`, `examples/README.md`, the health diagnostics tests, and the mock smoke tests all show strong sanitation discipline. The toolkit avoids absolute paths, credentials, live URLs, and live record contents in generated artifacts.

That is the right tradeoff for a public repo. The downside is that the “happy path” is described mostly through sanitized reports and synthetic fixtures rather than through one minimal end-to-end story. Public safety is not the problem; the problem is that the safest story is spread across several sections and files.

## Keep / Drop / Defer

### Keep

- Keep the npm-first command surface. It matches public TypeScript expectations and the packet’s boundary requirements.
- Keep conventional local paths such as `config/`, `data/`, `backups/`, and `restore/`.
- Keep the synthetic mock smoke path, health diagnostics, and packed-package preview as the main public-safe proof points.
- Keep redaction audit and support bundle artifacts as repo-safe support surfaces.
- Keep CI-backed `typecheck`, `build`, and `test` as the minimum public trust contract.

### Drop or de-emphasize from the first-touch story

- De-emphasize live write and restore-confirmation flows in the primary landing experience.
- De-emphasize compatibility-matrix and deprecation-canary artifacts as primary onboarding material; they read more like maintainer tools than first-user value.
- Avoid presenting every script as equal-weight entry documentation. The toolkit has breadth, but the public docs do not need to surface all of it at the same level.

### Defer pending explicit review

- Package publication or release-automation promises.
- Public Grocy version-support claims beyond the current synthetic compatibility artifacts.
- License or repo-positioning changes.
- Any adapter, connector, or workflow that starts to encode private personal-ops logic.
- Any broader stable API commitment for the TypeScript library edge beyond the currently tested seams.

## Ranked Recommendations

### Highest value next

Split the public onboarding story into two explicit tracks:

- `Evaluate safely with synthetic data`
- `Operate against a live Grocy instance`

The repo already has the underlying commands and tests for this split. The main change needed is information architecture, not new tooling.

### Next after that

Create one short “start here” doc that picks only three first-run proofs:

1. `npm run grocy:health:diagnostics`
2. `npm run grocy:smoke:mock`
3. `npx --no-install grocy-ops-toolkit ...`

This would reduce decision load without changing the public package contract.

### Defer unless the repo direction changes

Do not add more generic workflow surface until the current public entry story is simpler. The repo already covers more public-safe operator ground than the landing docs currently organize well.
