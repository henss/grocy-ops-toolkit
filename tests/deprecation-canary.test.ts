import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyApiDeprecationCanaryReport,
  recordGrocyApiDeprecationCanaryReport,
} from "../src/deprecation-canary.js";

describe("Grocy API deprecation canary report", () => {
  it("derives upgrade-risk findings from synthetic compatibility gaps", () => {
    const report = createGrocyApiDeprecationCanaryReport({
      generatedAt: "2026-04-21T08:00:00.000Z",
    });

    expect(report.scope).toBe("synthetic_fixture_only");
    expect(report.summary).toEqual({
      findingCount: 4,
      upgradeReview: 3,
      breaking: 1,
      highestRisk: "breaking",
    });
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        fixtureId: "fixture-shopping-list-gap",
        surface: "shopping_list",
        compatibilityStatus: "unsupported",
        riskLevel: "breaking",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        fixtureId: "fixture-minimal-read-api",
        surface: "stock",
        compatibilityStatus: "partial",
        riskLevel: "upgrade_review",
      }),
    );
    expect(report.reviewNotes.join(" ")).toContain("does not inspect a live Grocy instance");
  });

  it("writes the canary report to the conventional data path", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-api-deprecation-canary-"));
    const report = createGrocyApiDeprecationCanaryReport({
      generatedAt: "2026-04-21T08:00:00.000Z",
    });

    const outputPath = recordGrocyApiDeprecationCanaryReport(report, { baseDir });

    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-api-deprecation-canary-report.json"));
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_api_deprecation_canary_report",
      scope: "synthetic_fixture_only",
      summary: { findingCount: 4, breaking: 1 },
    });
  });

  it("does not serialize live credentials, URLs, local paths, or private workflow language", () => {
    const report = createGrocyApiDeprecationCanaryReport({
      generatedAt: "2026-04-21T08:00:00.000Z",
    });
    const serialized = JSON.stringify(report);

    expect(serialized).not.toContain("apiKey");
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("D:\\");
    expect(serialized).not.toContain("household");
    expect(serialized).not.toContain("Stefan");
    expect(serialized).not.toContain("shopping intent");
  });
});
