# Synthetic Object Coverage Playground

The object coverage playground is a fixture-only review artifact for the Grocy object and stock endpoints the toolkit currently reads.

It is not a live Grocy support claim. Each scenario is derived from synthetic fixtures so maintainers can inspect where coverage is complete, degraded, or missing before making any broader compatibility statement.

## Command

```bash
npm run grocy:coverage:playground
```

By default, the command writes:

```text
data/grocy-object-coverage-playground.json
```

## What It Shows

- Scenario-level coverage slices built from the existing synthetic compatibility fixtures.
- Per-surface coverage states of `covered`, `degraded`, or `missing`.
- The endpoint path, required fields, and observed fields for each synthetic surface.
- Review notes that keep the artifact inside the public-safe fixture boundary.

## Intended Use

Use the playground when you want a quick, synthetic answer to questions like:

- Which Grocy read surfaces are fully represented in the current fixtures?
- Which surfaces still read but have degraded optional compatibility fields?
- Which specific object endpoint gaps need a future fixture or adapter review?

## Boundary Notes

Keep playground inputs synthetic. Do not add live Grocy payloads, household details, shopping intent workflows, private paths, credentials, or Stefan-specific operating policy.
