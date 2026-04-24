import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyInventorySnapshot,
  recordGrocyInventorySnapshot,
  runGrocyInventorySnapshot,
} from "../src/inventory-snapshot.js";
import { GrocyInventorySnapshotSchema } from "../src/inventory-snapshot-schema.js";
import { createSyntheticGrocyFetch } from "../src/synthetic-grocy-fixtures.js";

function writeConfig(baseDir: string): void {
  fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "config", "grocy.local.json"),
    JSON.stringify({
      baseUrl: "https://grocy.example.com",
      apiKey: "test-api-key",
      timeoutMs: 1000,
    }),
    "utf8",
  );
}

describe("Grocy inventory snapshot", () => {
  it("builds a stable read-only inventory artifact from stock and product reads", () => {
    const snapshot = createGrocyInventorySnapshot({
      generatedAt: "2026-04-24T06:00:00.000Z",
      stock: [
        {
          productId: "product-2",
          productName: "Example Tea",
          quantity: "0",
          quantityNumeric: 0,
          stockState: "out",
          notes: ["Shelf empty."],
        },
        {
          productId: "product-1",
          productName: "Example Coffee",
          quantity: "2",
          quantityNumeric: 2,
          location: "Example Shelf",
          stockState: "in_stock",
          minStockAmount: 1,
          quantityUnitStockId: "unit-stock",
          notes: ["Fresh batch."],
        },
      ],
      products: [
        {
          productId: "product-1",
          productName: "Example Coffee",
          minStockAmount: "1",
          quantityUnitPurchaseId: "unit-purchase",
          quantityUnitStockId: "unit-stock",
          defaultBestBeforeDays: "30",
          dueType: "best_before",
          note: "Synthetic pantry staple.",
        },
      ],
    });

    expect(snapshot.summary).toEqual({
      itemCount: 2,
      inStockCount: 1,
      lowStockCount: 0,
      outOfStockCount: 1,
      unknownCount: 0,
      locationCount: 1,
      productCount: 2,
    });
    expect(snapshot.items.map((item) => item.productName)).toEqual(["Example Coffee", "Example Tea"]);
    expect(snapshot.items[0]).toMatchObject({
      productId: "product-1",
      defaultBestBeforeDays: "30",
      dueType: "best_before",
      quantityUnitPurchaseId: "unit-purchase",
      notes: ["Fresh batch.", "Synthetic pantry staple."],
    });
    expect(snapshot.reviewNotes[1]).toContain("shopping-list");
  });

  it("runs the live read surface against synthetic fixtures without shopping-list coupling", async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-inventory-snapshot-"));
    writeConfig(baseDir);

    const snapshot = await runGrocyInventorySnapshot(baseDir, createSyntheticGrocyFetch("fixture-shopping-list-gap"), {
      generatedAt: "2026-04-24T06:05:00.000Z",
    });

    expect(snapshot.summary.itemCount).toBe(1);
    expect(snapshot.summary.productCount).toBe(1);
    expect(snapshot.items[0]).toMatchObject({
      productName: "Example Coffee",
      stockState: "in_stock",
      minStockAmount: 1,
    });
  });

  it("writes the snapshot artifact to the conventional data path", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-inventory-snapshot-record-"));

    const outputPath = recordGrocyInventorySnapshot(
      createGrocyInventorySnapshot({
        generatedAt: "2026-04-24T06:10:00.000Z",
        stock: [],
        products: [],
      }),
      { baseDir },
    );

    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-inventory-snapshot.json"));
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_inventory_snapshot",
      scope: "stock_products_read_only",
      summary: { itemCount: 0 },
    });
  });

  it("keeps the public example fixture schema-valid", () => {
    const example = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "grocy-inventory-snapshot.example.json"), "utf8"),
    ) as unknown;

    expect(() => GrocyInventorySnapshotSchema.parse(example)).not.toThrow();
  });
});
