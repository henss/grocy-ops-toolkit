# Grocy API Deprecation Canary Report

The deprecation canary report is a fixture-only upgrade-risk view over the toolkit's synthetic Grocy API compatibility data.

It is not a live Grocy deprecation feed, a release-note mirror, or a public version support promise.

## Generate The Report

```bash
npm run grocy:compatibility:deprecation-canary
```

By default, the generated JSON is written to:

```text
data/grocy-api-deprecation-canary-report.json
```

Use `--output <path>` to write the artifact somewhere else.

## Reading The Artifact

The canary report records:

- Synthetic upgrade-risk findings derived from compatibility-matrix rows that are `partial` or `unsupported`.
- A `riskLevel` of `upgrade_review` when optional compatibility fields are absent from a synthetic fixture.
- A `riskLevel` of `breaking` when required fields are absent from a synthetic fixture.
- Recommended review actions that stay inside fixture-based interpretation rather than claiming live Grocy support or breakage.

## Public Boundary

Keep canary inputs and outputs synthetic. Do not add live Grocy payloads, household details, shopping intent workflows, local absolute paths, credentials, or private operating policy.

Before turning a canary finding into a public compatibility or deprecation claim, add reviewed live adapter evidence outside this public repo slice and make a deliberate review decision.
