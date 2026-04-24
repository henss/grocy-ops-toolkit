import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyConfigApplyDryRunReport,
  createGrocyConfigDriftTrendReport,
  GROCY_CONFIG_APPLY_DRY_RUN_REPORT_PATH,
  GROCY_CONFIG_DRIFT_TREND_REPORT_PATH,
  recordGrocyConfigApplyDryRunReport,
  recordGrocyConfigDriftTrendReport,
} from "../src/config-review.js";
import {
  createGrocyConfigDiffPreviewReport,
  GROCY_CONFIG_DIFF_PREVIEW_REPORT_PATH,
  recordGrocyConfigDiffPreviewReport,
} from "../src/config-sync.js";
import type { GrocyConfigExport, GrocyConfigSyncPlan } from "../src/schemas.js";

function createPreviewPlan(): GrocyConfigSyncPlan {
  return {
    kind: "grocy_config_sync_plan",
    version: 1,
    generatedAt: "2026-04-19T10:00:00.000Z",
    manifestPath: "examples/desired-state.example.json",
    exportPath: "examples/config-export.example.json",
    actions: [
      {
        action: "update",
        key: "products.example-coffee",
        entity: "products",
        name: "Example Coffee",
        ownership: "repo_managed",
        liveId: "10",
        reason: "Repo-managed item differs from live Grocy.",
        changes: [{ field: "min_stock_amount", desired: 2, live: 1 }],
      },
      {
        action: "noop",
        key: "products.example-tea",
        entity: "products",
        name: "Example Tea",
        ownership: "repo_managed",
        liveId: "11",
        reason: "Live Grocy already matches desired state.",
        changes: [],
      },
      {
        action: "manual_review",
        key: "products.example-duplicate",
        entity: "products",
        name: "Example Duplicate",
        ownership: "repo_managed",
        reason: "Multiple live Grocy records match this manifest item.",
        changes: [],
      },
    ],
    summary: { create: 0, update: 1, noop: 1, manualReview: 1 },
  };
}

function createApplyPlan(): GrocyConfigSyncPlan {
  return {
    kind: "grocy_config_sync_plan",
    version: 1,
    generatedAt: "2026-04-19T10:00:00.000Z",
    manifestPath: "examples/desired-state.example.json",
    actions: [
      {
        action: "update",
        key: "products.example-coffee",
        entity: "products",
        name: "Example Coffee",
        ownership: "repo_managed",
        liveId: "10",
        reason: "Repo-managed item differs from live Grocy.",
        changes: [{ field: "min_stock_amount", desired: 2, live: 1 }],
        desired: {
          key: "products.example-coffee",
          entity: "products",
          name: "Example Coffee",
          ownership: "repo_managed",
          fields: { min_stock_amount: 2 },
          aliases: [],
          provenance: { source: "synthetic", notes: [] },
        },
      },
    ],
    summary: { create: 0, update: 1, noop: 0, manualReview: 0 },
  };
}

function createDriftExport(exportedAt: string, minStockAmount: number): GrocyConfigExport {
  return {
    kind: "grocy_config_export",
    version: 1,
    exportedAt,
    source: { toolId: "grocy" },
    counts: {
      products: 1,
      product_groups: 0,
      locations: 0,
      quantity_units: 0,
      product_barcodes: 0,
      shopping_lists: 0,
      shopping_list: 0,
    },
    items: [
      {
        key: "products.example-coffee",
        entity: "products",
        name: "Example Coffee",
        ownership: "observed_only",
        fields: { min_stock_amount: minStockAmount },
        aliases: [],
        provenance: { source: "synthetic", notes: [] },
      },
    ],
  };
}

describe("Grocy config review reports", () => {
  it("builds a preview-first diff report from the sync plan and writes it to the conventional path", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-config-review-preview-"));
    const report = createGrocyConfigDiffPreviewReport({
      plan: createPreviewPlan(),
      generatedAt: "2026-04-19T10:08:00.000Z",
    });

    expect(report.summary).toEqual({
      create: 0,
      update: 1,
      noop: 1,
      manualReview: 1,
      reviewedChangeCount: 1,
    });
    expect(report.reviewNotes).toEqual([
      "This diff preview is generated from desired-state and export artifacts only. It does not send live Grocy write requests.",
      "Review examples/desired-state.example.json against examples/config-export.example.json before confirming any apply step.",
      "Use grocy:apply-config -- --plan <path> --dry-run when you want the later apply-focused no-write report.",
    ]);
    expect(report.items.map((item) => item.action)).toEqual(["update", "manual_review"]);

    const outputPath = recordGrocyConfigDiffPreviewReport(report, { baseDir });
    expect(path.relative(baseDir, outputPath)).toBe(GROCY_CONFIG_DIFF_PREVIEW_REPORT_PATH);
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_config_diff_preview_report",
      summary: { reviewedChangeCount: 1 },
    });
  });

  it("adds no-write review notes and writes the apply dry-run report to the conventional path", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-config-review-apply-"));
    const report = createGrocyConfigApplyDryRunReport({
      plan: createApplyPlan(),
      planPath: "examples/config-sync-plan.example.json",
      generatedAt: "2026-04-19T10:10:00.000Z",
    });

    expect(report.reviewNotes).toEqual([
      "This dry-run report is generated from an existing config sync plan and does not send live Grocy write requests.",
      "Review the plan at examples/config-sync-plan.example.json before confirming any create or update actions.",
      "A real apply still requires an explicit follow-up run with grocy:apply-config -- --confirm-reviewed-write.",
    ]);

    const outputPath = recordGrocyConfigApplyDryRunReport(report, { baseDir });
    expect(path.relative(baseDir, outputPath)).toBe(GROCY_CONFIG_APPLY_DRY_RUN_REPORT_PATH);
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_config_apply_dry_run_report",
      reviewNotes: report.reviewNotes,
    });
  });

  it("writes the drift trend report to the conventional path after the report seam extraction", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-config-review-drift-"));
    const report = createGrocyConfigDriftTrendReport({
      previousExport: createDriftExport("2026-04-19T10:00:00.000Z", 1),
      currentExport: createDriftExport("2026-04-20T10:00:00.000Z", 2),
      previousExportPath: "examples/config-export.previous.example.json",
      currentExportPath: "examples/config-export.example.json",
      generatedAt: "2026-04-20T10:05:00.000Z",
    });

    const outputPath = recordGrocyConfigDriftTrendReport(report, { baseDir });
    expect(path.relative(baseDir, outputPath)).toBe(GROCY_CONFIG_DRIFT_TREND_REPORT_PATH);
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_config_drift_trend_report",
      summary: { added: 0, removed: 0, changed: 1, unchanged: 0 },
    });
  });
});
