import { z } from "zod";

export const GrocyConfigEntitySchema = z.enum([
  "products",
  "product_groups",
  "locations",
  "quantity_units",
  "product_barcodes",
  "shopping_lists",
  "shopping_list",
]);

export const GrocyConfigOwnershipSchema = z.enum([
  "repo_managed",
  "grocy_managed",
  "observed_only",
]);

export const GrocyJsonScalarSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export type GrocyJsonValue =
  | z.infer<typeof GrocyJsonScalarSchema>
  | GrocyJsonValue[]
  | { [key: string]: GrocyJsonValue };

export const GrocyJsonValueSchema: z.ZodType<GrocyJsonValue> = z.lazy(() =>
  z.union([
    GrocyJsonScalarSchema,
    z.array(GrocyJsonValueSchema),
    z.record(z.string(), GrocyJsonValueSchema),
  ]),
);

export const GrocyConfigProvenanceSchema = z.object({
  source: z.string().min(1),
  recordedAt: z.string().min(1).optional(),
  notes: z.array(z.string().min(1)).default([]),
});

export const GrocyConfigItemSchema = z.object({
  key: z.string().min(1),
  entity: GrocyConfigEntitySchema,
  name: z.string().min(1),
  ownership: GrocyConfigOwnershipSchema.default("repo_managed"),
  fields: z.record(z.string(), GrocyJsonValueSchema).default({}),
  aliases: z.array(z.string().min(1)).default([]),
  provenance: GrocyConfigProvenanceSchema,
  lastObservedLiveId: z.string().min(1).optional(),
  lastObservedAt: z.string().min(1).optional(),
});

export const GrocyConfigManifestSchema = z.object({
  kind: z.literal("grocy_config_manifest"),
  version: z.literal(1),
  updatedAt: z.string().min(1).optional(),
  notes: z.array(z.string().min(1)).default([]),
  items: z.array(GrocyConfigItemSchema).default([]),
});

export const GrocyConfigExportSchema = z.object({
  kind: z.literal("grocy_config_export"),
  version: z.literal(1),
  exportedAt: z.string().min(1),
  source: z.object({
    toolId: z.literal("grocy"),
    baseUrl: z.string().min(1).optional(),
    grocyVersion: z.string().min(1).optional(),
  }),
  counts: z.record(GrocyConfigEntitySchema, z.number().int().nonnegative()),
  items: z.array(GrocyConfigItemSchema).default([]),
});

export const GrocyConfigPlanActionSchema = z.enum([
  "create",
  "update",
  "noop",
  "manual_review",
]);

export const GrocyConfigPlanChangeSchema = z.object({
  field: z.string().min(1),
  desired: GrocyJsonValueSchema.optional(),
  live: GrocyJsonValueSchema.optional(),
});

export const GrocyConfigPlanItemSchema = z.object({
  action: GrocyConfigPlanActionSchema,
  key: z.string().min(1),
  entity: GrocyConfigEntitySchema,
  name: z.string().min(1),
  ownership: GrocyConfigOwnershipSchema,
  liveId: z.string().min(1).optional(),
  reason: z.string().min(1),
  changes: z.array(GrocyConfigPlanChangeSchema).default([]),
  desired: GrocyConfigItemSchema.optional(),
  live: GrocyConfigItemSchema.optional(),
});

export const GrocyConfigSyncPlanSchema = z.object({
  kind: z.literal("grocy_config_sync_plan"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  manifestPath: z.string().min(1),
  exportPath: z.string().min(1).optional(),
  actions: z.array(GrocyConfigPlanItemSchema).default([]),
  summary: z.object({
    create: z.number().int().nonnegative(),
    update: z.number().int().nonnegative(),
    noop: z.number().int().nonnegative(),
    manualReview: z.number().int().nonnegative(),
  }),
});

export const GrocyBackupRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  sourcePath: z.string().min(1),
  archivePath: z.string().min(1),
  locationLabel: z.string().min(1),
  checksumSha256: z.string().min(1),
  fileCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  grocyVersion: z.string().min(1).optional(),
  restoreTestStatus: z.enum(["not_tested", "verified", "failed"]).default("not_tested"),
  restoreTestedAt: z.string().min(1).optional(),
  notes: z.array(z.string().min(1)).default([]),
});

export const GrocyBackupManifestSchema = z.object({
  kind: z.literal("grocy_backup_manifest"),
  version: z.literal(1),
  updatedAt: z.string().min(1),
  records: z.array(GrocyBackupRecordSchema).default([]),
});

export type GrocyConfigEntity = z.infer<typeof GrocyConfigEntitySchema>;
export type GrocyConfigOwnership = z.infer<typeof GrocyConfigOwnershipSchema>;
export type GrocyConfigProvenance = z.infer<typeof GrocyConfigProvenanceSchema>;
export type GrocyConfigItem = z.infer<typeof GrocyConfigItemSchema>;
export type GrocyConfigManifest = z.infer<typeof GrocyConfigManifestSchema>;
export type GrocyConfigExport = z.infer<typeof GrocyConfigExportSchema>;
export type GrocyConfigPlanAction = z.infer<typeof GrocyConfigPlanActionSchema>;
export type GrocyConfigPlanChange = z.infer<typeof GrocyConfigPlanChangeSchema>;
export type GrocyConfigPlanItem = z.infer<typeof GrocyConfigPlanItemSchema>;
export type GrocyConfigSyncPlan = z.infer<typeof GrocyConfigSyncPlanSchema>;
export type GrocyBackupRecord = z.infer<typeof GrocyBackupRecordSchema>;
export type GrocyBackupManifest = z.infer<typeof GrocyBackupManifestSchema>;
