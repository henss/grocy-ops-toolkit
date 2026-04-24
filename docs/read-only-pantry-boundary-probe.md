# Read-Only Pantry Boundary Probe

This note records the current public-safe boundary for a Wave 2 pantry-oriented read path.

It is an evidence summary for the bounded prototype inventory snapshot seam, not a broader shopping-workflow or recommendation commitment.

## Scope

The bounded public-safe pantry slice is the read-only subset that answers inventory-style questions from existing Grocy reads without extracting shopping policy or introducing write behavior.

Inside scope:

- Stock reads from `/stock`.
- Product reads from `/objects/products`.
- Synthetic fixture coverage and compatibility review for those read surfaces.
- Public-safe summaries derived from stock state, quantities, locations, and static product metadata already exposed by the toolkit.

Outside scope:

- Shopping intent or replenishment policy.
- Shopping-list prioritization, recommendations, or execution flows.
- Pantry-monitoring automation or threshold policy extraction.
- Calendar, task, reminder, or personal-ops integrations.
- Live household examples, private ledgers, or Stefan-specific operating rules.

## Current Evidence

The current live read adapter already exposes three inventory-adjacent methods in [`src/grocy-live.ts`](/abs/path/D:/workspace/grocy-ops-toolkit/src/grocy-live.ts:279):

- `listStock()`
- `listShoppingList()`
- `listProducts()`

The current health check also treats all three surfaces as one reachability bundle in [`runGrocyHealthCheck`](/abs/path/D:/workspace/grocy-ops-toolkit/src/grocy-live.ts:338).

The fixture-only public review surfaces already show the same coupling:

- [`docs/synthetic-object-coverage-playground.md`](/abs/path/D:/workspace/grocy-ops-toolkit/docs/synthetic-object-coverage-playground.md:1) frames coverage in terms of stock plus Grocy object endpoints.
- [`docs/grocy-api-compatibility-matrix.md`](/abs/path/D:/workspace/grocy-ops-toolkit/docs/grocy-api-compatibility-matrix.md:1) documents `/stock` and `/objects/*` compatibility using synthetic fixtures only.

The repo now also contains a prototype inventory artifact seam in [`src/inventory-snapshot.ts`](/abs/path/D:/workspace/grocy-ops-toolkit/src/inventory-snapshot.ts:1). That seam consumes only stock and product reads and emits a stable `grocy_inventory_snapshot` artifact.

## Proposed Boundary

For Wave 2 public-safe work, treat the pantry boundary as:

- A read-only inventory view over stock plus product metadata.
- A synthetic review surface that can demonstrate missing or degraded pantry reads without implying shopping recommendations.
- A conventional TypeScript toolkit surface that remains npm-first and fixture-friendly.

Do not treat the following as part of the public pantry boundary:

- Any inference that a low-stock item should become a shopping action.
- Any extraction of preferred reorder thresholds beyond directly observed Grocy fields already present in product records.
- Any synthesis of shopping-list state into pantry recommendations or operational policy.

## Implemented Prototype

The current bounded prototype is:

1. `npm run grocy:inventory:snapshot`
2. A stable JSON artifact at `data/grocy-inventory-snapshot.json`
3. A synthetic public example at [`examples/grocy-inventory-snapshot.example.json`](/abs/path/D:/workspace/grocy-ops-toolkit/examples/grocy-inventory-snapshot.example.json:1)

The artifact stays inside the pantry-safe boundary by:

- reading only `stock` plus `products`
- enriching stock rows with static product metadata already exposed by Grocy
- excluding shopping-list state, recommendation logic, and policy inference

## Recommendation

The next coherent bounded follow-up is to let private consumers prove the snapshot contract against their own adapters without broadening the public toolkit into shopping workflows.

Preferred follow-up:

1. Add consumer-side contract checks that read `grocy_inventory_snapshot` without depending on Grocy shopping-list surfaces.
2. Keep shopping-list coverage in the generic compatibility and object-coverage artifacts, but do not use it as a prerequisite for the inventory snapshot seam.
3. Review any later pantry-specific recommendation helper as a separate public API decision.

## Why This Matters

This boundary keeps the public toolkit useful for inventory-style Grocy inspection while avoiding accidental drift into shopping-policy extraction or private personal-ops behavior. It also gives future agents a concrete public-safe interpretation of the current pantry-safe slice without requiring them to infer intent from broader Grocy read coverage.
