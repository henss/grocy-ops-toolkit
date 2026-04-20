import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyReviewDashboard,
  createGrocyReviewDashboardFromArtifacts,
  recordGrocyReviewDashboard,
} from "../src/review-dashboard.js";
import type {
  GrocyBackupManifest,
  GrocyConfigApplyDryRunReport,
  GrocyConfigDriftTrendReport,
  GrocyConfigSyncPlan,
  GrocyHealthDiagnosticsArtifact,
} from "../src/schemas.js";

const plan: GrocyConfigSyncPlan = {
  kind: "grocy_config_sync_plan",
  version: 1,
  generatedAt: "2026-04-19T10:05:00.000Z",
  manifestPath: "examples/desired-state.example.json",
  actions: [
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
  summary: { create: 0, update: 0, noop: 0, manualReview: 1 },
};

const dryRunReport: GrocyConfigApplyDryRunReport = {
  kind: "grocy_config_apply_dry_run_report",
  version: 1,
  generatedAt: "2026-04-19T10:10:00.000Z",
  planPath: "examples/config-sync-plan.example.json",
  summary: { wouldCreate: 1, wouldUpdate: 1, skipped: 1, manualReview: 1 },
  items: [
    {
      action: "would_create",
      key: "products.example-cocoa",
      entity: "products",
      name: "Example Cocoa",
      ownership: "repo_managed",
      reason: "Repo-managed item is missing from live Grocy.",
      changes: [],
    },
    {
      action: "would_update",
      key: "products.example-coffee",
      entity: "products",
      name: "Example Coffee",
      ownership: "repo_managed",
      liveId: "10",
      reason: "Repo-managed item differs from live Grocy.",
      changes: [{ field: "min_stock_amount", desired: 2, live: 1 }],
    },
  ],
};

const driftTrendReport: GrocyConfigDriftTrendReport = {
  kind: "grocy_config_drift_trend_report",
  version: 1,
  generatedAt: "2026-04-20T10:05:00.000Z",
  previousExportPath: "examples/config-export.previous.example.json",
  currentExportPath: "examples/config-export.example.json",
  period: {
    previousExportedAt: "2026-04-19T10:00:00.000Z",
    currentExportedAt: "2026-04-20T10:00:00.000Z",
  },
  summary: { added: 1, removed: 0, changed: 1, unchanged: 3 },
  entityBreakdown: {
    products: { added: 1, removed: 0, changed: 1, unchanged: 1 },
    product_groups: { added: 0, removed: 0, changed: 0, unchanged: 1 },
    locations: { added: 0, removed: 0, changed: 0, unchanged: 1 },
    quantity_units: { added: 0, removed: 0, changed: 0, unchanged: 0 },
    product_barcodes: { added: 0, removed: 0, changed: 0, unchanged: 0 },
    shopping_lists: { added: 0, removed: 0, changed: 0, unchanged: 0 },
    shopping_list: { added: 0, removed: 0, changed: 0, unchanged: 0 },
  },
  items: [
    {
      status: "changed",
      key: "products.example-coffee",
      entity: "products",
      name: "Example Coffee",
      changedFields: ["min_stock_amount"],
      changes: [{ field: "min_stock_amount", previous: 1, current: 2 }],
    },
    {
      status: "added",
      key: "products.example-cocoa",
      entity: "products",
      name: "Example Cocoa",
      changedFields: [],
      changes: [],
    },
  ],
};

const diagnostics: GrocyHealthDiagnosticsArtifact = {
  kind: "grocy_health_diagnostics",
  version: 1,
  generatedAt: "2026-04-19T10:15:00.000Z",
  toolId: "grocy",
  summary: { result: "fail", failureCount: 1, warningCount: 0 },
  checks: [],
  diagnostics: [
    {
      severity: "error",
      code: "grocy_unreachable",
      message: "Grocy live adapter check failed before all read probes completed.",
      agentAction: "Verify local config, Grocy availability, and API-key permissions, then rerun npm run grocy:health:diagnostics.",
      evidence: [],
    },
  ],
};

const backupManifest: GrocyBackupManifest = {
  kind: "grocy_backup_manifest",
  version: 1,
  updatedAt: "2026-04-19T10:20:00.000Z",
  records: [
    {
      id: "grocy-backup-20260419102000",
      createdAt: "2026-04-19T10:20:00.000Z",
      sourcePath: "source",
      archivePath: "backups/grocy-backup-20260419102000.grocy-backup.enc",
      locationLabel: "synthetic-local-encrypted",
      checksumSha256: "example-checksum",
      fileCount: 2,
      totalBytes: 123,
      restoreTestStatus: "verified",
      notes: [],
    },
  ],
};

function writeJson(baseDir: string, filePath: string, value: unknown): void {
  const absolutePath = path.join(baseDir, filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("Grocy review dashboard", () => {
  it("renders a concise Markdown review surface from loaded artifacts", () => {
    const dashboard = createGrocyReviewDashboard({
      generatedAt: "2026-04-19T10:30:00.000Z",
      plan,
      applyDryRunReport: dryRunReport,
      driftTrendReport,
      diagnostics,
      backupManifest,
      artifactPaths: {
        planPath: "data/grocy-config-sync-plan.json",
        applyDryRunReportPath: "data/grocy-config-apply-dry-run-report.json",
        driftTrendReportPath: "data/grocy-config-drift-trend-report.json",
        diagnosticsPath: "data/grocy-health-diagnostics.json",
        backupManifestPath: "data/grocy-backup-manifest.json",
      },
    });

    expect(dashboard).toContain("# Grocy Review Dashboard");
    expect(dashboard).toContain("Status: needs attention.");
    expect(dashboard).toContain("1 item requires manual review before apply.");
    expect(dashboard).toContain("| would_update | products.example-coffee | products | Repo-managed item differs from live Grocy. | min_stock_amount |");
    expect(dashboard).toContain("Period: 2026-04-19T10:00:00.000Z to 2026-04-20T10:00:00.000Z. Changed records: 2; unchanged: 3.");
    expect(dashboard).toContain("| changed | products.example-coffee | products | min_stock_amount |");
    expect(dashboard).toContain("| products.example-duplicate | products | Multiple live Grocy records match this manifest item. |");
    expect(dashboard).toContain("Latest record: grocy-backup-20260419102000; files: 2; bytes: 123; restore test: verified.");
  });

  it("loads conventional JSON artifact paths and writes the dashboard to data", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-review-dashboard-"));
    writeJson(baseDir, path.join("data", "grocy-config-sync-plan.json"), plan);
    writeJson(baseDir, path.join("data", "grocy-config-apply-dry-run-report.json"), dryRunReport);
    writeJson(baseDir, path.join("data", "grocy-config-drift-trend-report.json"), driftTrendReport);
    writeJson(baseDir, path.join("data", "grocy-health-diagnostics.json"), diagnostics);
    writeJson(baseDir, path.join("data", "grocy-backup-manifest.json"), backupManifest);

    const dashboard = createGrocyReviewDashboardFromArtifacts(baseDir, {
      generatedAt: "2026-04-19T10:30:00.000Z",
    });
    const outputPath = recordGrocyReviewDashboard(dashboard, { baseDir });

    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-review-dashboard.md"));
    expect(fs.readFileSync(outputPath, "utf8")).toContain("- Config sync plan: data/grocy-config-sync-plan.json");
    expect(fs.readFileSync(outputPath, "utf8")).toContain("- Config drift trend report: data/grocy-config-drift-trend-report.json");
  });

  it("redacts external artifact paths from the rendered source list", () => {
    const dashboard = createGrocyReviewDashboard({
      generatedAt: "2026-04-19T10:30:00.000Z",
      baseDir: "D:\\workspace\\grocy-ops-toolkit",
      plan,
      artifactPaths: {
        planPath: "D:\\workspace\\elsewhere\\plan.json",
      },
    });

    expect(dashboard).toContain("- Config sync plan: <external-path>");
    expect(dashboard).not.toContain("elsewhere");
  });
});
