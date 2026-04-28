# Grocy Schema Fixture Capture

The schema fixture capture command produces a schema-only artifact for Grocy read surfaces that matter to upgrade tests.

It records endpoint coverage, field paths, value kinds, and whether a field appears on every inspected record. It never stores payload values, account details, credentials, base URLs, or private household workflow data.

## Generate A Synthetic Capture

```bash
npm run grocy:compatibility:schema-capture
```

By default, the generated JSON is written to:

```text
data/grocy-schema-fixture-capture.json
```

Use `--fixture <id>` to inspect a different synthetic shape such as `fixture-minimal-read-api` or `fixture-shopping-list-gap`.

## Capture A Live Upgrade Shape Safely

```bash
npm run grocy:compatibility:schema-capture -- --config config/grocy.local.json
```

That path reads the configured Grocy API and emits only schema metadata. It is suitable for upgrade review when you need to compare a real Grocy instance against the toolkit's synthetic expectations without serializing record contents.

## Reading The Artifact

The capture records:

- A `source.mode` of `synthetic_fixture` or `live_config`.
- A per-surface `status` of `captured` or `missing`.
- Field paths such as `product.min_stock_amount`.
- Value kinds such as `string`, `number`, `object`, and `array`.
- Field `presence` as `always` or `sometimes`.

## Public Boundary

Keep captures schema-only. Do not extend the artifact to store response values, local absolute paths, Grocy credentials, account identifiers, or private operations policy.
