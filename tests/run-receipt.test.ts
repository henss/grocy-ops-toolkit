import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runGrocyMockSmokeTest } from "../src/mock-smoke.js";
import {
  createGrocyMockSmokeRunReceipt,
  GROCY_MOCK_SMOKE_RECEIPT_PATH,
  recordGrocyToolkitRunReceipt,
} from "../src/run-receipt.js";
import { GrocyToolkitRunReceiptSchema } from "../src/schemas.js";

describe("Grocy toolkit run receipt", () => {
  it("captures the mock smoke command, fixture set, artifacts, verification command, and result", async () => {
    const report = await runGrocyMockSmokeTest(process.cwd(), {
      generatedAt: "2026-04-21T08:00:00.000Z",
    });

    const receipt = createGrocyMockSmokeRunReceipt({
      baseDir: process.cwd(),
      report,
      reportPath: path.join("data", "grocy-mock-smoke-report.json"),
    });

    expect(receipt.command).toEqual({
      id: "grocy:smoke:mock",
      cli: "npm run grocy:smoke:mock",
    });
    expect(receipt.fixtureSet).toMatchObject({
      id: "synthetic_mock_smoke",
      scope: "synthetic_fixture_only",
    });
    expect(receipt.artifacts).toEqual([
      {
        role: "primary_report",
        kind: "grocy_mock_smoke_report",
        path: "data/grocy-mock-smoke-report.json",
      },
      {
        role: "derived_plan",
        kind: "grocy_config_sync_plan",
        path: "data/grocy-config-sync-plan.json",
      },
      {
        role: "derived_dry_run_report",
        kind: "grocy_config_apply_dry_run_report",
        path: "data/grocy-config-apply-dry-run-report.json",
      },
    ]);
    expect(receipt.verification).toEqual({
      command: "npm run grocy:smoke:mock",
      status: "pass",
    });
    expect(receipt.result).toEqual({
      status: "pass",
      checkCount: 4,
      failureCount: 0,
    });
  });

  it("writes the receipt to the conventional data path", async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-run-receipt-"));
    const report = await runGrocyMockSmokeTest(baseDir, {
      generatedAt: "2026-04-21T08:00:00.000Z",
    });

    const outputPath = recordGrocyToolkitRunReceipt(
      createGrocyMockSmokeRunReceipt({
        baseDir,
        report,
        reportPath: path.join("data", "grocy-mock-smoke-report.json"),
      }),
      { baseDir },
    );

    expect(path.relative(baseDir, outputPath)).toBe(GROCY_MOCK_SMOKE_RECEIPT_PATH);
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_toolkit_run_receipt",
      verification: { command: "npm run grocy:smoke:mock", status: "pass" },
      result: { status: "pass", checkCount: 4, failureCount: 0 },
    });
  });

  it("keeps the public example fixture schema-valid", () => {
    const example = JSON.parse(fs.readFileSync(path.join(process.cwd(), "examples", "grocy-mock-smoke-receipt.example.json"), "utf8")) as unknown;

    expect(() => GrocyToolkitRunReceiptSchema.parse(example)).not.toThrow();
  });
});
