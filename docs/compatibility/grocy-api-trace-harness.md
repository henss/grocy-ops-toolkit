# Grocy API Trace Harness

The API trace harness is a prototype bug-report surface for replaying Grocy read calls without sharing live Grocy traffic.

It records the current read endpoints as a compact JSON artifact and can replay those entries through a fetch-compatible adapter. The default path uses the repo's synthetic fixtures so the trace stays public-safe by default.

## Record A Synthetic Trace

```bash
npm run grocy:bug-report:trace
```

By default, the generated artifact is written to:

```text
data/grocy-api-trace-harness.json
```

Use `--fixture <id>` to switch between the current synthetic Grocy shapes such as `fixture-minimal-read-api` or `fixture-shopping-list-gap`.

## Capture A Live Trace Safely

```bash
npm run grocy:bug-report:trace -- --config config/grocy.local.json
```

The live path reads the same Grocy endpoints as the synthetic trace flow, but it redacts every response value into shape-preserving placeholders before serialization. The artifact therefore keeps request paths, status codes, field keys, and rough JSON structure while omitting Grocy payload values, base URLs, API keys, and household details.

## Replay The Trace

Import the recorded harness and create a replay fetch adapter:

```ts
import {
  createGrocyApiTraceHarnessFromSyntheticFixture,
  createGrocyReplayFetch,
} from "grocy-ops-toolkit";

const trace = createGrocyApiTraceHarnessFromSyntheticFixture();
const replayFetch = createGrocyReplayFetch(trace);
const response = await replayFetch("https://replay.grocy-ops.invalid/api/objects/products");
const products = await response.json();
```

The replay fetch adapter returns the recorded JSON body and status code for known trace entries and a `404` JSON error for unknown paths. It is intended for parser, adapter, and bug-report reproduction checks, not as a general-purpose fake Grocy server.

## Public Boundary

Keep trace artifacts redacted and read-only. Do not extend this prototype to store live base URLs, API keys, household identifiers, shopping intent workflows, pantry policy, calendar/task integrations, or other Stefan-specific operating context.

