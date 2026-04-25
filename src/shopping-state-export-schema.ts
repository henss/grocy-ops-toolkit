import { z } from "zod";

export const GrocyShoppingStateListSchema = z.object({
  listId: z.string().min(1),
  listName: z.string().min(1),
});

export const GrocyShoppingStateItemSchema = z.object({
  itemId: z.string().min(1),
  listId: z.string().min(1).optional(),
  listName: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
  productName: z.string().min(1),
  quantity: z.string().min(1).optional(),
  quantityNumeric: z.number().finite().optional(),
  quantityUnitId: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
  done: z.boolean(),
});

export const GrocyShoppingStateExportSchema = z.object({
  kind: z.literal("grocy_shopping_state_export"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  scope: z.literal("shopping_lists_read_only"),
  source: z.object({
    toolId: z.literal("grocy"),
    surfaces: z.tuple([z.literal("shopping_lists"), z.literal("shopping_list")]),
  }),
  summary: z.object({
    listCount: z.number().int().nonnegative(),
    itemCount: z.number().int().nonnegative(),
    openItemCount: z.number().int().nonnegative(),
    completedItemCount: z.number().int().nonnegative(),
    productCount: z.number().int().nonnegative(),
    itemWithListAssignmentCount: z.number().int().nonnegative(),
  }),
  lists: z.array(GrocyShoppingStateListSchema).default([]),
  items: z.array(GrocyShoppingStateItemSchema).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export type GrocyShoppingStateList = z.infer<typeof GrocyShoppingStateListSchema>;
export type GrocyShoppingStateItem = z.infer<typeof GrocyShoppingStateItemSchema>;
export type GrocyShoppingStateExport = z.infer<typeof GrocyShoppingStateExportSchema>;
