# Read-Only Pantry Boundary Probe

This note records the current public-safe boundary for a Wave 2 pantry-oriented read path.

It is a proposal and evidence summary, not a runtime change or a public support commitment.

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

This means the repo already contains the raw read ingredients for a pantry-safe slice, but the public live adapter currently couples that slice to shopping-list reads that are out of scope for this Wave 2 boundary probe.

## Proposed Boundary

For Wave 2 public-safe work, treat the pantry boundary as:

- A read-only inventory view over stock plus product metadata.
- A synthetic review surface that can demonstrate missing or degraded pantry reads without implying shopping recommendations.
- A conventional TypeScript toolkit surface that remains npm-first and fixture-friendly.

Do not treat the following as part of the public pantry boundary:

- Any inference that a low-stock item should become a shopping action.
- Any extraction of preferred reorder thresholds beyond directly observed Grocy fields already present in product records.
- Any synthesis of shopping-list state into pantry recommendations or operational policy.

## Recommendation

The next coherent bounded step is a docs-or-fixture-level follow-up that makes the pantry-safe subset explicit without broadening the runtime API yet.

Preferred follow-up:

1. Add a synthetic pantry-read fixture or report shape that only references stock and product surfaces.
2. Keep shopping-list coverage in the generic compatibility and object-coverage artifacts, but do not use it as a prerequisite for a pantry-safe read-only slice.
3. If a later session proposes a reusable pantry-specific runtime helper, review that change explicitly as a public API decision instead of slipping it in through the existing live adapter.

## Why This Matters

This boundary keeps the public toolkit useful for inventory-style Grocy inspection while avoiding accidental drift into shopping-policy extraction or private personal-ops behavior. It also gives future agents a concrete public-safe interpretation of OPS-1146 without requiring them to infer intent from broader Grocy read coverage.
