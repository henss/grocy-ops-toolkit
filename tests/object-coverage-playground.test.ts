import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyObjectCoveragePlayground,
  recordGrocyObjectCoveragePlayground,
} from "../src/object-coverage-playground.js";
import { GrocyObjectCoveragePlaygroundSchema } from "../src/schemas.js";

describe("Grocy object coverage playground", () => {
  it("creates a fixture-only object coverage playground", () => {
    const playground = createGrocyObjectCoveragePlayground({
      generatedAt: "2026-04-21T10:30:00.000Z",
    });

    expect(playground.scope).toBe("synthetic_fixture_only");
    expect(playground.summary).toEqual({
      scenarioCount: 3,
      fixtureCount: 3,
      surfaceCount: 9,
      covered: 23,
      degraded: 3,
      missing: 1,
    });
    expect(playground.entries).toHaveLength(27);
    expect(playground.entries).toContainEqual(
      expect.objectContaining({
        scenarioId: "scenario-shopping-list-gap",
        fixtureId: "fixture-shopping-list-gap",
        surface: "shopping_list",
        playgroundStatus: "missing",
        compatibilityStatus: "unsupported",
      }),
    );
    expect(playground.reviewNotes.join(" ")).toContain("fixture-only");
  });

  it("writes the generated playground to the conventional data path", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-object-coverage-playground-"));
    const playground = createGrocyObjectCoveragePlayground({
      generatedAt: "2026-04-21T10:30:00.000Z",
    });

    const outputPath = recordGrocyObjectCoveragePlayground(playground, { baseDir });

    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-object-coverage-playground.json"));
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_object_coverage_playground",
      scope: "synthetic_fixture_only",
      summary: { missing: 1, degraded: 3 },
    });
  });

  it("keeps the public example fixture schema-valid", () => {
    const examplePath = path.resolve("examples", "grocy-object-coverage-playground.example.json");
    const parsed = JSON.parse(fs.readFileSync(examplePath, "utf8"));

    expect(GrocyObjectCoveragePlaygroundSchema.parse(parsed)).toMatchObject({
      kind: "grocy_object_coverage_playground",
      scope: "synthetic_fixture_only",
      summary: { scenarioCount: 3, surfaceCount: 9 },
    });
  });

  it("does not serialize live credentials, URLs, local paths, or private workflow language", () => {
    const playground = createGrocyObjectCoveragePlayground({
      generatedAt: "2026-04-21T10:30:00.000Z",
    });
    const serialized = JSON.stringify(playground);

    expect(serialized).not.toContain("apiKey");
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("D:\\");
    expect(serialized).not.toContain("household");
    expect(serialized).not.toContain("Stefan");
    expect(serialized).not.toContain("shopping intent");
  });
});
