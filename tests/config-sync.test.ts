import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  applyGrocyConfigSyncPlan,
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
});
