import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  applyGrocyConfigSyncPlan,
  createGrocyConfigApplyDryRunReport,
  createGrocyConfigDriftTrendReport,
  createGrocyConfigSyncPlan,
  exportGrocyConfig,
  recordGrocyConfigSyncPlan,
} from "../src/config-sync.js";
import type { GrocyConfigExport, GrocyConfigManifest } from "../src/schemas.js";

function writeConfig(baseDir: string): void {
  fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "config", "grocy.local.json"),
    JSON.stringify({
      baseUrl: "https://grocy.example.com/api",
      apiKey: "test-api-key",
      timeoutMs: 1000,
    }),
    "utf8",
  );
}

describe("Grocy config sync", () => {
  it("exports stable records without volatile fields", async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-export-"));
    writeConfig(baseDir);
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/system/info")) {
        return new Response(JSON.stringify({ grocy_version: "4.0.0" }), { status: 200 });
      }
      if (url.endsWith("/objects/products")) {
        return new Response(
          JSON.stringify([{ id: 1, name: "Example Coffee", min_stock_amount: 1, last_price: 12 }]),
          { status: 200 },
        );
      }
      return new Response("[]", { status: 200 });
    }) as typeof fetch;

    const exportData = await exportGrocyConfig(baseDir, {
      fetchImpl,
      exportedAt: "2026-04-19T10:00:00.000Z",
    });

    expect(exportData.items.find((item) => item.entity === "products")?.fields).toEqual({
      min_stock_amount: 1,
      name: "Example Coffee",
    });
  });

  it("diffs creates, updates, noops, and manual-review duplicates", () => {
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
          fields: { min_stock_amount: 2 },
          aliases: [],
          provenance: { source: "synthetic", notes: [] },
        },
        {
          key: "products.example-tea",
          entity: "products",
          name: "Example Tea",
          ownership: "repo_managed",
          fields: { min_stock_amount: 1 },
          aliases: [],
          provenance: { source: "synthetic", notes: [] },
        },
        {
          key: "products.example-duplicate",
          entity: "products",
          name: "Example Duplicate",
          ownership: "repo_managed",
          fields: {},
          aliases: [],
          provenance: { source: "synthetic", notes: [] },
        },
        {
          key: "products.example-observed",
          entity: "products",
          name: "Example Observed",
          ownership: "observed_only",
          fields: {},
          aliases: [],
          provenance: { source: "synthetic", notes: [] },
        },
      ],
    };
    const liveExport: GrocyConfigExport = {
      kind: "grocy_config_export",
      version: 1,
      exportedAt: "2026-04-19T10:00:00.000Z",
      source: { toolId: "grocy" },
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
          fields: { name: "Example Coffee", min_stock_amount: 1 },
          aliases: [],
          provenance: { source: "live", notes: [] },
          lastObservedLiveId: "1",
        },
        {
          key: "products.example-duplicate-a",
          entity: "products",
          name: "Example Duplicate",
          ownership: "observed_only",
          fields: {},
          aliases: [],
          provenance: { source: "live", notes: [] },
          lastObservedLiveId: "2",
        },
        {
          key: "products.example-duplicate-b",
          entity: "products",
          name: "Example Duplicate",
          ownership: "observed_only",
          fields: {},
          aliases: [],
          provenance: { source: "live", notes: [] },
          lastObservedLiveId: "3",
        },
      ],
    };

    const plan = createGrocyConfigSyncPlan({
      manifest,
      liveExport,
      manifestPath: "examples/desired-state.example.json",
      generatedAt: "2026-04-19T10:05:00.000Z",
    });

    expect(plan.summary).toEqual({ create: 1, update: 1, noop: 1, manualReview: 1 });
  });

  it("requires reviewed confirmation before applying", async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-apply-"));
    writeConfig(baseDir);
    const planPath = recordGrocyConfigSyncPlan(
      {
        kind: "grocy_config_sync_plan",
        version: 1,
        generatedAt: "2026-04-19T10:00:00.000Z",
        manifestPath: "examples/desired-state.example.json",
        actions: [],
        summary: { create: 0, update: 0, noop: 0, manualReview: 0 },
      },
      { baseDir, outputPath: "plan.json" },
    );

    await expect(applyGrocyConfigSyncPlan(planPath, baseDir)).rejects.toThrow("confirm-reviewed-write");
  });

  it("creates a reviewable apply dry-run report without live writes", () => {
    const plan = {
      kind: "grocy_config_sync_plan" as const,
      version: 1 as const,
      generatedAt: "2026-04-19T10:00:00.000Z",
      manifestPath: "examples/desired-state.example.json",
      actions: [
        {
          action: "create" as const,
          key: "products.example-tea",
          entity: "products" as const,
          name: "Example Tea",
          ownership: "repo_managed" as const,
          reason: "Repo-managed item is missing from live Grocy.",
          changes: [],
          desired: {
            key: "products.example-tea",
            entity: "products" as const,
            name: "Example Tea",
            ownership: "repo_managed" as const,
            fields: { min_stock_amount: 1 },
            aliases: [],
            provenance: { source: "synthetic", notes: [] },
          },
        },
        {
          action: "update" as const,
          key: "products.example-coffee",
          entity: "products" as const,
          name: "Example Coffee",
          ownership: "repo_managed" as const,
          liveId: "10",
          reason: "Repo-managed item differs from live Grocy.",
          changes: [{ field: "min_stock_amount", desired: 2, live: 1 }],
          desired: {
            key: "products.example-coffee",
            entity: "products" as const,
            name: "Example Coffee",
            ownership: "repo_managed" as const,
            fields: { min_stock_amount: 2 },
            aliases: [],
            provenance: { source: "synthetic", notes: [] },
          },
        },
        {
          action: "manual_review" as const,
          key: "products.example-duplicate",
          entity: "products" as const,
          name: "Example Duplicate",
          ownership: "repo_managed" as const,
          reason: "Multiple live Grocy records match this manifest item.",
          changes: [],
        },
      ],
      summary: { create: 1, update: 1, noop: 0, manualReview: 1 },
    };

    const report = createGrocyConfigApplyDryRunReport({
      plan,
      planPath: "examples/config-sync-plan.example.json",
      generatedAt: "2026-04-19T10:10:00.000Z",
    });

    expect(report.summary).toEqual({ wouldCreate: 1, wouldUpdate: 1, skipped: 0, manualReview: 1 });
    expect(report.items.map((item) => item.action)).toEqual(["would_create", "would_update", "manual_review"]);
    expect(report.items[1]).toMatchObject({
      key: "products.example-coffee",
      liveId: "10",
      changes: [{ field: "min_stock_amount", desired: 2, live: 1 }],
    });
  });

  it("reports config drift trends between two exports", () => {
    const previousExport: GrocyConfigExport = {
      kind: "grocy_config_export",
      version: 1,
      exportedAt: "2026-04-19T10:00:00.000Z",
      source: { toolId: "grocy" },
      counts: {
        products: 2,
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
          fields: { min_stock_amount: 1 },
          aliases: [],
          provenance: { source: "synthetic", notes: [] },
        },
        {
          key: "products.example-removed",
          entity: "products",
          name: "Example Removed",
          ownership: "observed_only",
          fields: {},
          aliases: [],
          provenance: { source: "synthetic", notes: [] },
        },
      ],
    };
    const currentExport: GrocyConfigExport = {
      kind: "grocy_config_export",
      version: 1,
      exportedAt: "2026-04-20T10:00:00.000Z",
      source: { toolId: "grocy" },
      counts: {
        products: 2,
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
          fields: { min_stock_amount: 2 },
          aliases: [],
          provenance: { source: "synthetic", notes: [] },
        },
        {
          key: "products.example-added",
          entity: "products",
          name: "Example Added",
          ownership: "observed_only",
          fields: {},
          aliases: [],
          provenance: { source: "synthetic", notes: [] },
        },
      ],
    };

    const report = createGrocyConfigDriftTrendReport({
      previousExport,
      currentExport,
      previousExportPath: "examples/config-export.previous.example.json",
      currentExportPath: "examples/config-export.example.json",
      generatedAt: "2026-04-20T10:05:00.000Z",
    });

    expect(report.summary).toEqual({ added: 1, removed: 1, changed: 1, unchanged: 0 });
    expect(report.entityBreakdown.products).toEqual({ added: 1, removed: 1, changed: 1, unchanged: 0 });
    expect(report.items.map((item) => `${item.status}:${item.key}`)).toEqual([
      "added:products.example-added",
      "changed:products.example-coffee",
      "removed:products.example-removed",
    ]);
    expect(report.items.find((item) => item.status === "changed")?.changedFields).toEqual(["min_stock_amount"]);
  });

  it("uses caller-provided config paths for custom repo layouts", async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-custom-layout-"));
    fs.mkdirSync(path.join(baseDir, "private-config"), { recursive: true });
    fs.writeFileSync(
      path.join(baseDir, "private-config", "grocy.local.json"),
      JSON.stringify({
        baseUrl: "https://grocy.example.com/api",
        apiKey: "test-api-key",
        timeoutMs: 1000,
      }),
      "utf8",
    );
    const fetchImpl = vi.fn(async () => new Response("[]", { status: 200 })) as typeof fetch;

    const exportData = await exportGrocyConfig(baseDir, {
      fetchImpl,
      exportedAt: "2026-04-19T10:00:00.000Z",
      configPath: path.join("private-config", "grocy.local.json"),
    });

    expect(exportData.source.baseUrl).toBe("https://grocy.example.com/api");
  });
});
