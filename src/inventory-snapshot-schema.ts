import { z } from "zod";

export const GrocyInventorySnapshotItemSchema = z.object({
  productId: z.string().min(1).optional(),
  productName: z.string().min(1),
  stockState: z.enum(["in_stock", "low", "out", "unknown"]),
  quantity: z.string().min(1).optional(),
  quantityNumeric: z.number().finite().optional(),
  location: z.string().min(1).optional(),
  minStockAmount: z.number().finite().optional(),
  quantityUnitPurchaseId: z.string().min(1).optional(),
  quantityUnitStockId: z.string().min(1).optional(),
  defaultBestBeforeDays: z.string().min(1).optional(),
  dueType: z.string().min(1).optional(),
  notes: z.array(z.string().min(1)).default([]),
});

export const GrocyInventorySnapshotSchema = z.object({
  kind: z.literal("grocy_inventory_snapshot"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  scope: z.literal("stock_products_read_only"),
  source: z.object({
    toolId: z.literal("grocy"),
    surfaces: z.tuple([z.literal("stock"), z.literal("products")]),
  }),
  summary: z.object({
    itemCount: z.number().int().nonnegative(),
    inStockCount: z.number().int().nonnegative(),
    lowStockCount: z.number().int().nonnegative(),
    outOfStockCount: z.number().int().nonnegative(),
    unknownCount: z.number().int().nonnegative(),
    locationCount: z.number().int().nonnegative(),
    productCount: z.number().int().nonnegative(),
  }),
  items: z.array(GrocyInventorySnapshotItemSchema).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export type GrocyInventorySnapshotItem = z.infer<typeof GrocyInventorySnapshotItemSchema>;
export type GrocyInventorySnapshot = z.infer<typeof GrocyInventorySnapshotSchema>;
