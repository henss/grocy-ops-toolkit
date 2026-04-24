import { z } from "zod";
import {
  GrocyConfigOwnershipSchema,
  GrocyConfigPlanActionSchema,
  GrocyConfigPlanChangeSchema,
  GrocyConfigEntitySchema,
} from "./schemas.js";

export const GrocyConfigDiffPreviewItemSchema = z.object({
  action: GrocyConfigPlanActionSchema.exclude(["noop"]),
  key: z.string().min(1),
  entity: GrocyConfigEntitySchema,
  name: z.string().min(1),
  ownership: GrocyConfigOwnershipSchema,
  liveId: z.string().min(1).optional(),
  reason: z.string().min(1),
  changeCount: z.number().int().nonnegative(),
  changes: z.array(GrocyConfigPlanChangeSchema).default([]),
});

export const GrocyConfigDiffPreviewReportSchema = z.object({
  kind: z.literal("grocy_config_diff_preview_report"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  manifestPath: z.string().min(1),
  exportPath: z.string().min(1).optional(),
  summary: z.object({
    create: z.number().int().nonnegative(),
    update: z.number().int().nonnegative(),
    noop: z.number().int().nonnegative(),
    manualReview: z.number().int().nonnegative(),
    reviewedChangeCount: z.number().int().nonnegative(),
  }),
  items: z.array(GrocyConfigDiffPreviewItemSchema).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export type GrocyConfigDiffPreviewItem = z.infer<typeof GrocyConfigDiffPreviewItemSchema>;
export type GrocyConfigDiffPreviewReport = z.infer<typeof GrocyConfigDiffPreviewReportSchema>;
