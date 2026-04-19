import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyApiCompatibilityMatrix,
  recordGrocyApiCompatibilityMatrix,
} from "../src/compatibility-matrix.js";

describe("Grocy API compatibility matrix", () => {
  it("creates a synthetic fixture-only compatibility matrix", () => {
    const matrix = createGrocyApiCompatibilityMatrix({
      generatedAt: "2026-04-19T12:00:00.000Z",
    });

    expect(matrix.scope).toBe("synthetic_fixture_only");
    expect(matrix.summary).toEqual({ fixtureCount: 3, supported: 23, partial: 3, unsupported: 1 });
    expect(matrix.entries).toHaveLength(27);
    expect(matrix.entries).toContainEqual(
      expect.objectContaining({
        fixtureId: "fixture-shopping-list-gap",
        surface: "shopping_list",
        status: "unsupported",
      }),
    );
    expect(matrix.reviewNotes.join(" ")).toContain("not a live Grocy version support promise");
  });

  it("writes the generated matrix to the conventional data path", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-api-compatibility-matrix-"));
    const matrix = createGrocyApiCompatibilityMatrix({
      generatedAt: "2026-04-19T12:00:00.000Z",
    });

    const outputPath = recordGrocyApiCompatibilityMatrix(matrix, { baseDir });

    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-api-compatibility-matrix.json"));
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_api_compatibility_matrix",
      scope: "synthetic_fixture_only",
      summary: { unsupported: 1 },
    });
  });

  it("does not serialize live credentials, URLs, local paths, or private workflow language", () => {
    const matrix = createGrocyApiCompatibilityMatrix({
      generatedAt: "2026-04-19T12:00:00.000Z",
    });
    const serialized = JSON.stringify(matrix);

    expect(serialized).not.toContain("apiKey");
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("D:\\");
    expect(serialized).not.toContain("household");
    expect(serialized).not.toContain("Stefan");
    expect(serialized).not.toContain("shopping intent");
  });
});
