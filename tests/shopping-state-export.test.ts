import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyShoppingStateExport,
  recordGrocyShoppingStateExport,
  runGrocyShoppingStateExport,
} from "../src/shopping-state-export.js";
import { GrocyShoppingStateExportSchema } from "../src/shopping-state-export-schema.js";
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

describe("Grocy shopping-state export", () => {
  it("builds a stable read-only shopping-state artifact from shopping-list reads", () => {
    const shoppingState = createGrocyShoppingStateExport({
      generatedAt: "2026-04-25T08:00:00.000Z",
      lists: [
        { listId: "list-2", listName: "Weekend shop" },
        { listId: "list-1", listName: "Main pantry run" },
      ],
      items: [
        {
          itemId: "item-2",
          listId: "list-1",
          productId: "product-2",
          productName: "Example Tea",
          quantity: "1",
          quantityNumeric: 1,
          done: false,
        },
        {
          itemId: "item-1",
          listId: "list-2",
          productId: "product-1",
          productName: "Example Coffee",
          quantity: "2",
          quantityNumeric: 2,
          note: "Synthetic reminder.",
          done: true,
        },
      ],
    });

    expect(shoppingState.summary).toEqual({
      listCount: 2,
      itemCount: 2,
      openItemCount: 1,
      completedItemCount: 1,
      productCount: 2,
      itemWithListAssignmentCount: 2,
    });
    expect(shoppingState.lists.map((list) => list.listName)).toEqual(["Main pantry run", "Weekend shop"]);
    expect(shoppingState.items[0]).toMatchObject({
      itemId: "item-2",
      listName: "Main pantry run",
      productName: "Example Tea",
      done: false,
    });
    expect(shoppingState.reviewNotes[0]).toContain("shopping_lists");
  });

  it("runs the live read surface against synthetic fixtures", async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-shopping-state-export-"));
    writeConfig(baseDir);

    const shoppingState = await runGrocyShoppingStateExport(baseDir, createSyntheticGrocyFetch(), {
      generatedAt: "2026-04-25T08:05:00.000Z",
    });

    expect(shoppingState.summary).toEqual({
      listCount: 1,
      itemCount: 1,
      openItemCount: 1,
      completedItemCount: 0,
      productCount: 1,
      itemWithListAssignmentCount: 0,
    });
    expect(shoppingState.items[0]).toMatchObject({
      productName: "Example Tea",
      done: false,
    });
  });

  it("writes the shopping-state artifact to the conventional data path", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-shopping-state-export-record-"));

    const outputPath = recordGrocyShoppingStateExport(
      createGrocyShoppingStateExport({
        generatedAt: "2026-04-25T08:10:00.000Z",
        lists: [],
        items: [],
      }),
      { baseDir },
    );

    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-shopping-state-export.json"));
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_shopping_state_export",
      scope: "shopping_lists_read_only",
      summary: { itemCount: 0 },
    });
  });

  it("keeps the public example fixture schema-valid", () => {
    const example = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "grocy-shopping-state-export.example.json"), "utf8"),
    ) as unknown;

    expect(() => GrocyShoppingStateExportSchema.parse(example)).not.toThrow();
  });
});
