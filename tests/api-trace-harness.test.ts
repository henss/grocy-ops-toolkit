import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyApiTraceHarnessFromLiveConfig,
  createGrocyApiTraceHarnessFromSyntheticFixture,
  createGrocyReplayFetch,
  recordGrocyApiTraceHarness,
} from "../src/api-trace-harness.js";

describe("Grocy API trace harness", () => {
  it("records a synthetic trace and replays it through a fetch-compatible adapter", async () => {
    const trace = createGrocyApiTraceHarnessFromSyntheticFixture("fixture-minimal-read-api", {
      generatedAt: "2026-04-25T10:00:00.000Z",
    });
    const replayFetch = createGrocyReplayFetch(trace);

    expect(trace.summary).toEqual({
      entryCount: 9,
      successCount: 9,
      missingCount: 0,
      redactedValueCount: 0,
    });

    const productsResponse = await replayFetch("https://replay.grocy-ops.invalid/api/objects/products");
    expect(productsResponse.status).toBe(200);
    expect(await productsResponse.json()).toEqual([{ id: "1", name: "Example Coffee" }]);

    const missingResponse = await replayFetch("https://replay.grocy-ops.invalid/api/objects/unknown");
    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.json()).toEqual({ error: "Recorded trace entry not found." });
  });

  it("redacts live-config payload values while keeping replayable shapes", async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-api-trace-live-"));
    fs.mkdirSync(path.join(workspace, "config"), { recursive: true });
    fs.writeFileSync(
      path.join(workspace, "config", "grocy.local.json"),
      JSON.stringify({
        baseUrl: "https://grocy.example.test/api",
        apiKey: "synthetic-secret",
        timeoutMs: 1000,
      }),
      "utf8",
    );

    const trace = await createGrocyApiTraceHarnessFromLiveConfig(workspace, {
      generatedAt: "2026-04-25T10:00:00.000Z",
      fetchImpl: async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/objects/products")) {
          return new Response(JSON.stringify([{ id: "42", name: "Private product", note: "Household detail" }]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Missing" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    const serialized = JSON.stringify(trace);
    const productEntry = trace.entries.find((entry) => entry.surface === "products");

    expect(trace.source).toEqual({
      mode: "live_config",
      configPath: path.join("config", "grocy.local.json"),
      redactionMode: "shape_placeholders",
    });
    expect(trace.summary).toMatchObject({
      entryCount: 9,
      successCount: 1,
      missingCount: 8,
    });
    expect(productEntry).toMatchObject({
      request: { headers: { "grocy-api-key": "<redacted>" } },
      response: {
        body: [{ id: "<redacted-id-1>", name: "<redacted-string-2>", note: "<redacted-string-3>" }],
      },
    });
    expect(serialized).not.toContain("https://grocy.example.test/api");
    expect(serialized).not.toContain("synthetic-secret");
    expect(serialized).not.toContain("Private product");
    expect(serialized).not.toContain("Household detail");
  });

  it("writes the conventional trace artifact path and supports the CLI command", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-api-trace-artifact-"));
    const trace = createGrocyApiTraceHarnessFromSyntheticFixture("fixture-shopping-list-gap", {
      generatedAt: "2026-04-25T10:00:00.000Z",
    });

    const outputPath = recordGrocyApiTraceHarness(trace, { baseDir });
    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-api-trace-harness.json"));

    const cliStdout = execFileSync(
      process.execPath,
      [path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), path.join(process.cwd(), "src", "cli.ts"), "grocy:bug-report:trace"],
      {
        cwd: baseDir,
        encoding: "utf8",
      },
    );

    expect(JSON.parse(cliStdout)).toMatchObject({
      outputPath: expect.stringContaining(path.join("data", "grocy-api-trace-harness.json")),
      summary: { entryCount: 9 },
      source: { mode: "synthetic_fixture", fixtureId: "fixture-current-object-api" },
    });
  });
});
