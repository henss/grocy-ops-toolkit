import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocySchemaFixtureCaptureFromLiveConfig,
  createGrocySchemaFixtureCaptureFromSyntheticFixture,
  recordGrocySchemaFixtureCapture,
} from "../src/schema-fixture-capture.js";
import { createSyntheticGrocyFetch } from "../src/synthetic-grocy-fixtures.js";

describe("Grocy schema fixture capture", () => {
  it("captures schema-only fixture metadata without payload values", () => {
    const capture = createGrocySchemaFixtureCaptureFromSyntheticFixture("fixture-shopping-list-gap", {
      generatedAt: "2026-04-25T09:00:00.000Z",
    });

    expect(capture.summary).toEqual({
      capturedSurfaceCount: 8,
      missingSurfaceCount: 1,
      fieldCount: expect.any(Number),
    });
    expect(capture.source).toMatchObject({
      mode: "synthetic_fixture",
      fixtureId: "fixture-shopping-list-gap",
    });
    expect(capture.surfaces).toContainEqual(
      expect.objectContaining({
        surface: "shopping_list",
        status: "missing",
      }),
    );
    expect(capture.surfaces).toContainEqual(
      expect.objectContaining({
        surface: "stock",
        status: "captured",
        fields: expect.arrayContaining([
          expect.objectContaining({ path: "product_id", kinds: ["string"], presence: "always" }),
          expect.objectContaining({ path: "product.min_stock_amount", kinds: ["number"], presence: "always" }),
        ]),
      }),
    );

    const serialized = JSON.stringify(capture);
    expect(serialized).not.toContain("Example Coffee");
    expect(serialized).not.toContain("Synthetic pending item");
  });

  it("captures a live-config shape without serializing config secrets or URLs", async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-schema-capture-"));
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

    const capture = await createGrocySchemaFixtureCaptureFromLiveConfig(workspace, {
      generatedAt: "2026-04-25T09:00:00.000Z",
      fetchImpl: createSyntheticGrocyFetch("fixture-current-object-api"),
    });

    expect(capture.source).toEqual({
      mode: "live_config",
      configPath: path.join("config", "grocy.local.json"),
    });
    expect(capture.summary.capturedSurfaceCount).toBe(9);

    const serialized = JSON.stringify(capture);
    expect(serialized).not.toContain("https://grocy.example.test/api");
    expect(serialized).not.toContain("synthetic-secret");
    expect(serialized).not.toContain("Example Coffee");
  });

  it("writes the conventional capture artifact path", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-schema-capture-artifact-"));
    const capture = createGrocySchemaFixtureCaptureFromSyntheticFixture("fixture-minimal-read-api", {
      generatedAt: "2026-04-25T09:00:00.000Z",
    });

    const outputPath = recordGrocySchemaFixtureCapture(capture, { baseDir });

    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-schema-fixture-capture.json"));
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_schema_fixture_capture",
      scope: "schema_only",
      source: {
        mode: "synthetic_fixture",
        fixtureId: "fixture-minimal-read-api",
      },
    });
  });
});
