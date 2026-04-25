# Read-Only Shopping-State Export

This note records the bounded public-safe scope for the toolkit's read-only shopping-state export seam.

It is a narrow export contract for current Grocy shopping state, not a broader shopping workflow, prioritization system, or recommendation commitment.

## Scope

Inside scope:

- Shopping-list definition reads from `/objects/shopping_lists`.
- Shopping-list item reads from `/objects/shopping_list`.
- Stable public-safe summaries of list and item state already present in those Grocy read surfaces.

Outside scope:

- Shopping intent, prioritization, or execution workflows.
- Pantry policy, replenishment thresholds, or recommendation logic.
- Calendar, task, reminder, or personal-ops integrations.
- Live household examples, private ledgers, or operator-specific operating rules.

## Implemented Seam

The current bounded export is:

1. `npm run grocy:shopping-state:export`
2. A stable JSON artifact at `data/grocy-shopping-state-export.json`
3. A synthetic public example at [`examples/grocy-shopping-state-export.example.json`](/abs/path/D:/workspace/grocy-ops-toolkit/examples/grocy-shopping-state-export.example.json:1)

The artifact stays inside the public-safe boundary by:

- reading only `shopping_lists` plus `shopping_list`
- exporting current list and item state without writing to Grocy
- excluding pantry policy, recommendation logic, calendar/task integrations, and private workflow context

## Why This Matters

This seam gives downstream consumers a stable, read-only shopping-state contract without forcing them to scrape Grocy responses directly or depend on private personal-ops logic. It also keeps the public toolkit bounded to observable Grocy state instead of promoting workflow policy as a public API.
