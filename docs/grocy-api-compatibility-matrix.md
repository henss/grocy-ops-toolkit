# Grocy API Compatibility Matrix

The compatibility matrix is a fixture-only prototype for checking which Grocy API response shapes the toolkit currently expects.

It is not a live Grocy version support promise. Each row is based on synthetic examples, and promotion to a public support claim needs reviewed live adapter evidence.

## Generate The Matrix

```bash
npm run grocy:compatibility:matrix
```

By default, the generated JSON is written to:

```text
data/grocy-api-compatibility-matrix.json
```

Use `--output <path>` to write the artifact somewhere else.

## Reading The Artifact

The matrix records:

- Synthetic fixture scenarios.
- Toolkit read surfaces such as `/system/info`, `/stock`, and `/objects/*`.
- Required fields for the current toolkit read path.
- A status of `supported`, `partial`, or `unsupported` for each fixture and surface.

`partial` means the core required fields are present, but optional compatibility fields used for richer diagnostics or safer review are absent. `unsupported` means at least one required field is missing for that surface.

## Public Boundary

Keep matrix fixtures synthetic. Do not add live Grocy record data, account details, local file paths, credentials, or private operations policy.

Before describing a real Grocy release as supported, add reviewed evidence outside this public fixture and then make a deliberate public-support decision.
