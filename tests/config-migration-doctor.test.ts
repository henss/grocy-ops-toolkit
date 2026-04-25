import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyConfigMigrationDoctorReport,
  GROCY_CONFIG_MIGRATION_DOCTOR_REPORT_PATH,
  recordGrocyConfigMigrationDoctorReport,
  runGrocyConfigMigrationDoctor,
} from "../src/config-migration-doctor.js";
import type { GrocyConfigExport, GrocyConfigManifest, GrocyConfigSyncPlan } from "../src/schemas.js";

function writeJson(baseDir: string, relativePath: string, value: unknown): string {
  const absolutePath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return absolutePath;
}

function createManifest(): GrocyConfigManifest {
  return {
    kind: "grocy_config_manifest",
    version: 1,
    updatedAt: "2026-04-25T10:00:00.000Z",
    notes: ["Synthetic desired state for migration-doctor coverage."],
    items: [
      {
        key: "products.example-coffee",
        entity: "products",
        name: "Example Coffee",
        ownership: "repo_managed",
        fields: { min_stock_amount: 2 },
        aliases: [],
        provenance: { source: "synthetic-example", notes: [] },
      },
      {
        key: "products.example-spice",
        entity: "products",
        name: "Example Spice",
        ownership: "repo_managed",
        fields: { min_stock_amount: 1 },
        aliases: [],
        provenance: { source: "synthetic-example", notes: [] },
      },
      {
        key: "products.example-duplicate",
        entity: "products",
        name: "Example Duplicate",
        ownership: "repo_managed",
        fields: {},
        aliases: [],
        provenance: { source: "synthetic-example", notes: [] },
      },
    ],
  };
}

function createPreviousExport(): GrocyConfigExport {
  return {
    kind: "grocy_config_export",
    version: 1,
    exportedAt: "2026-04-24T10:00:00.000Z",
    source: { toolId: "grocy", grocyVersion: "4.0.0" },
    counts: {
      products: 3,
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
        fields: { min_stock_amount: 1, name: "Example Coffee" },
        aliases: [],
        provenance: { source: "live-grocy-export", recordedAt: "2026-04-24T10:00:00.000Z", notes: [] },
        lastObservedLiveId: "10",
        lastObservedAt: "2026-04-24T10:00:00.000Z",
      },
      {
        key: "products.example-spice",
        entity: "products",
        name: "Example Spice",
        ownership: "observed_only",
        fields: { min_stock_amount: 1, name: "Example Spice" },
        aliases: [],
        provenance: { source: "live-grocy-export", recordedAt: "2026-04-24T10:00:00.000Z", notes: [] },
        lastObservedLiveId: "11",
        lastObservedAt: "2026-04-24T10:00:00.000Z",
      },
      {
        key: "products.example-duplicate",
        entity: "products",
        name: "Example Duplicate",
        ownership: "observed_only",
        fields: { name: "Example Duplicate" },
        aliases: [],
        provenance: { source: "live-grocy-export", recordedAt: "2026-04-24T10:00:00.000Z", notes: [] },
        lastObservedLiveId: "12",
        lastObservedAt: "2026-04-24T10:00:00.000Z",
      },
    ],
  };
}

function createCurrentExport(): GrocyConfigExport {
  return {
    kind: "grocy_config_export",
    version: 1,
    exportedAt: "2026-04-25T10:00:00.000Z",
    source: { toolId: "grocy", grocyVersion: "4.1.0" },
    counts: {
      products: 3,
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
        fields: { min_stock_amount: 1, name: "Example Coffee" },
        aliases: [],
        provenance: { source: "live-grocy-export", recordedAt: "2026-04-25T10:00:00.000Z", notes: [] },
        lastObservedLiveId: "10",
        lastObservedAt: "2026-04-25T10:00:00.000Z",
      },
      {
        key: "products.example-duplicate-a",
        entity: "products",
        name: "Example Duplicate",
        ownership: "observed_only",
        fields: { name: "Example Duplicate" },
        aliases: [],
        provenance: { source: "live-grocy-export", recordedAt: "2026-04-25T10:00:00.000Z", notes: [] },
        lastObservedLiveId: "12",
        lastObservedAt: "2026-04-25T10:00:00.000Z",
      },
      {
        key: "products.example-duplicate-b",
        entity: "products",
        name: "Example Duplicate",
        ownership: "observed_only",
        fields: { name: "Example Duplicate" },
        aliases: [],
        provenance: { source: "live-grocy-export", recordedAt: "2026-04-25T10:00:00.000Z", notes: [] },
        lastObservedLiveId: "13",
        lastObservedAt: "2026-04-25T10:00:00.000Z",
      },
    ],
  };
}

describe("Grocy config migration doctor", () => {
  it("builds a review-required report from synthetic GitOps upgrade evidence", () => {
    const report = createGrocyConfigMigrationDoctorReport({
      manifest: createManifest(),
      manifestPath: "examples/desired-state.example.json",
      previousExport: createPreviousExport(),
      previousExportPath: "examples/config-export.previous.example.json",
      currentExport: createCurrentExport(),
      currentExportPath: "examples/config-export.example.json",
      generatedAt: "2026-04-25T10:10:00.000Z",
    });

    expect(report.summary).toMatchObject({
      result: "review_required",
      warningCount: 3,
      errorCount: 2,
      repoManagedItemCount: 3,
      repoManagedUpgradeChangeCount: 2,
      createCount: 1,
      updateCount: 1,
      manualReviewCount: 1,
    });
    expect(report.findings.map((finding) => finding.code)).toEqual([
      "grocy_version_changed",
      "repo_managed_item_removed",
      "sync_plan_create_pending",
      "sync_plan_update_pending",
      "sync_plan_manual_review",
    ]);
    expect(report.findings.find((finding) => finding.code === "repo_managed_item_removed")?.itemKeys).toEqual([
      "products.example-duplicate",
      "products.example-spice",
    ]);
  });

  it("loads conventional offline artifacts, adds review notes, and writes the default report path", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-config-migration-doctor-"));
    writeJson(baseDir, path.join("config", "desired-state.json"), createManifest());
    writeJson(baseDir, path.join("data", "grocy-config-export.previous.json"), createPreviousExport());
    writeJson(baseDir, path.join("data", "grocy-config-export.json"), createCurrentExport());

    const report = runGrocyConfigMigrationDoctor(baseDir, {
      generatedAt: "2026-04-25T10:10:00.000Z",
    });

    expect(report.reviewNotes).toEqual([
      "This migration doctor reads manifest, export, and sync-plan artifacts only. It does not send live Grocy write requests.",
      "Review the computed sync plan against data\\grocy-config-export.json before any confirmed apply step.",
      "Treat Grocy version changes, repo-managed drift, and manual-review items as upgrade checkpoints for the GitOps migration.",
    ]);

    const outputPath = recordGrocyConfigMigrationDoctorReport(report, { baseDir });
    expect(path.relative(baseDir, outputPath)).toBe(GROCY_CONFIG_MIGRATION_DOCTOR_REPORT_PATH);
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_config_migration_doctor_report",
      summary: { result: "review_required" },
    });
  });

  it("uses a provided sync plan path and reports a ready state when no migration findings remain", () => {
    const manifest: GrocyConfigManifest = {
      kind: "grocy_config_manifest",
      version: 1,
      notes: [],
      items: [
        {
          key: "products.example-coffee",
          entity: "products",
          name: "Example Coffee",
          ownership: "repo_managed",
          fields: { min_stock_amount: 1 },
          aliases: [],
          provenance: { source: "synthetic-example", notes: [] },
        },
      ],
    };
    const previousExport: GrocyConfigExport = {
      kind: "grocy_config_export",
      version: 1,
      exportedAt: "2026-04-24T10:00:00.000Z",
      source: { toolId: "grocy", grocyVersion: "4.0.0" },
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
          fields: { min_stock_amount: 1, name: "Example Coffee" },
          aliases: [],
          provenance: { source: "live-grocy-export", recordedAt: "2026-04-24T10:00:00.000Z", notes: [] },
          lastObservedLiveId: "10",
          lastObservedAt: "2026-04-24T10:00:00.000Z",
        },
      ],
    };
    const currentExport: GrocyConfigExport = {
      ...previousExport,
      exportedAt: "2026-04-25T10:00:00.000Z",
      source: { toolId: "grocy", grocyVersion: "4.0.0" },
      items: [
        {
          key: "products.example-coffee",
          entity: "products",
          name: "Example Coffee",
          ownership: "observed_only",
          fields: { min_stock_amount: 1, name: "Example Coffee" },
          aliases: [],
          provenance: { source: "live-grocy-export", recordedAt: "2026-04-25T10:00:00.000Z", notes: [] },
          lastObservedLiveId: "10",
          lastObservedAt: "2026-04-25T10:00:00.000Z",
        },
      ],
    };
    const plan: GrocyConfigSyncPlan = {
      kind: "grocy_config_sync_plan",
      version: 1,
      generatedAt: "2026-04-25T10:05:00.000Z",
      manifestPath: "examples/desired-state.example.json",
      exportPath: "examples/config-export.example.json",
      actions: [
        {
          action: "noop",
          key: "products.example-coffee",
          entity: "products",
          name: "Example Coffee",
          ownership: "repo_managed",
          liveId: "10",
          reason: "Live Grocy already matches desired state.",
          changes: [],
        },
      ],
      summary: { create: 0, update: 0, noop: 1, manualReview: 0 },
    };

    const report = createGrocyConfigMigrationDoctorReport({
      manifest,
      manifestPath: "examples/desired-state.example.json",
      previousExport,
      previousExportPath: "examples/config-export.previous.example.json",
      currentExport,
      currentExportPath: "examples/config-export.example.json",
      plan,
      planPath: "examples/config-sync-plan.example.json",
      generatedAt: "2026-04-25T10:10:00.000Z",
    });

    expect(report.summary).toMatchObject({
      result: "ready",
      infoCount: 1,
      warningCount: 0,
      errorCount: 0,
    });
    expect(report.findings).toEqual([
      expect.objectContaining({
        code: "migration_ready",
        severity: "info",
      }),
    ]);
  });
});
