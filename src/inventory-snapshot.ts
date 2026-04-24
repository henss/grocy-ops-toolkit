import fs from "node:fs";
import path from "node:path";
import { createGrocyLiveReadSurface, loadGrocyLiveConfig, type GrocyProductRecord, type GrocyStockRecord } from "./grocy-live.js";
import {
  GrocyInventorySnapshotSchema,
  type GrocyInventorySnapshot,
  type GrocyInventorySnapshotItem,
} from "./inventory-snapshot-schema.js";

export const GROCY_INVENTORY_SNAPSHOT_PATH = path.join("data", "grocy-inventory-snapshot.json");

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function getGeneratedAt(generatedAt?: string): string {
  return generatedAt ?? new Date().toISOString();
}

function createProductIndex(products: GrocyProductRecord[]): Map<string, GrocyProductRecord> {
  return new Map(products.filter((product) => product.productId).map((product) => [product.productId, product]));
}

function normalizeMinStockAmount(stock: GrocyStockRecord, product?: GrocyProductRecord): number | undefined {
  if (typeof stock.minStockAmount === "number" && Number.isFinite(stock.minStockAmount)) {
    return stock.minStockAmount;
  }
  if (!product?.minStockAmount) {
    return undefined;
  }
  const parsed = Number(product.minStockAmount);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sortSnapshotItems(items: GrocyInventorySnapshotItem[]): GrocyInventorySnapshotItem[] {
  return [...items].sort((left, right) => {
    const leftKey = [left.productName, left.productId ?? "", left.location ?? ""];
    const rightKey = [right.productName, right.productId ?? "", right.location ?? ""];
    return leftKey.join("::").localeCompare(rightKey.join("::"));
  });
}

export function createGrocyInventorySnapshot(input: {
  stock: GrocyStockRecord[];
  products: GrocyProductRecord[];
  generatedAt?: string;
}): GrocyInventorySnapshot {
  const productIndex = createProductIndex(input.products);
  const items = sortSnapshotItems(
    input.stock.map((stockRecord) => {
      const product = stockRecord.productId ? productIndex.get(stockRecord.productId) : undefined;
      const notes = [...(stockRecord.notes ?? []), product?.note]
        .filter((value): value is string => Boolean(value))
        .filter((value, index, values) => values.indexOf(value) === index);
      return {
        productId: stockRecord.productId,
        productName: stockRecord.productName,
        stockState: stockRecord.stockState,
        quantity: stockRecord.quantity,
        quantityNumeric: stockRecord.quantityNumeric,
        location: stockRecord.location,
        minStockAmount: normalizeMinStockAmount(stockRecord, product),
        quantityUnitPurchaseId: stockRecord.quantityUnitPurchaseId ?? product?.quantityUnitPurchaseId,
        quantityUnitStockId: stockRecord.quantityUnitStockId ?? product?.quantityUnitStockId,
        defaultBestBeforeDays: product?.defaultBestBeforeDays,
        dueType: product?.dueType,
        notes,
      };
    }),
  );

  const locations = new Set(items.map((item) => item.location).filter((value): value is string => Boolean(value)));
  return GrocyInventorySnapshotSchema.parse({
    kind: "grocy_inventory_snapshot",
    version: 1,
    generatedAt: getGeneratedAt(input.generatedAt),
    scope: "stock_products_read_only",
    source: {
      toolId: "grocy",
      surfaces: ["stock", "products"],
    },
    summary: {
      itemCount: items.length,
      inStockCount: items.filter((item) => item.stockState === "in_stock").length,
      lowStockCount: items.filter((item) => item.stockState === "low").length,
      outOfStockCount: items.filter((item) => item.stockState === "out").length,
      unknownCount: items.filter((item) => item.stockState === "unknown").length,
      locationCount: locations.size,
      productCount: new Set(items.map((item) => item.productId ?? item.productName)).size,
    },
    items,
    reviewNotes: [
      "Derived only from the Grocy stock and products read surfaces.",
      "Deliberately excludes shopping-list state, pantry policy, and recommendation logic.",
    ],
  });
}

export async function runGrocyInventorySnapshot(
  baseDir: string = process.cwd(),
  fetchImpl: typeof fetch = fetch,
  options: { generatedAt?: string; configPath?: string } = {},
): Promise<GrocyInventorySnapshot> {
  const config = loadGrocyLiveConfig(baseDir, options.configPath);
  if (!config) {
    throw new Error(`No Grocy live config found at ${path.resolve(baseDir, options.configPath ?? path.join("config", "grocy.local.json"))}.`);
  }

  const grocy = createGrocyLiveReadSurface(config, fetchImpl);
  const [stock, products] = await Promise.all([grocy.listStock(), grocy.listProducts()]);
  return createGrocyInventorySnapshot({
    stock,
    products,
    generatedAt: options.generatedAt,
  });
}

export function recordGrocyInventorySnapshot(
  snapshot: GrocyInventorySnapshot,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_INVENTORY_SNAPSHOT_PATH),
    snapshot,
    options.overwrite ?? true,
  );
}
