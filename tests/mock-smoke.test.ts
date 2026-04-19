import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { recordGrocyMockSmokeReport, runGrocyMockSmokeTest } from "../src/mock-smoke.js";

describe("Grocy mock smoke test", () => {
  it("runs the synthetic health/export/plan/dry-run path without live Grocy", async () => {
    const report = await runGrocyMockSmokeTest(process.cwd(), {
      generatedAt: "2026-04-19T10:20:00.000Z",
    });

    expect(report.summary).toEqual({ result: "pass", checkCount: 4, failureCount: 0 });
    expect(report.checks.map((check) => check.id)).toEqual(["health", "export", "plan", "apply_dry_run"]);
    expect(JSON.stringify(report)).not.toContain("synthetic-api-key");
    expect(JSON.stringify(report)).not.toContain("https://grocy.example.test");
  });

  it("writes a generated smoke report to the conventional data path", async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-mock-smoke-report-"));
    const report = await runGrocyMockSmokeTest(baseDir, {
      generatedAt: "2026-04-19T10:20:00.000Z",
    });

    const outputPath = recordGrocyMockSmokeReport(report, { baseDir });

    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-mock-smoke-report.json"));
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_mock_smoke_report",
      summary: { result: "pass" },
    });
  });
});
