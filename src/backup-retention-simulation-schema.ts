import { z } from "zod";

export const GrocyBackupRetentionPolicySchema = z.object({
  hourly: z.number().int().nonnegative().default(0),
  daily: z.number().int().nonnegative().default(0),
  weekly: z.number().int().nonnegative().default(0),
  monthly: z.number().int().nonnegative().default(0),
});

export const GrocyBackupRetentionPricingSchema = z.object({
  currencyCode: z.string().trim().length(3),
  storagePricePerGiBMonth: z.number().nonnegative(),
});

export const GrocyBackupRetentionSnapshotHistoryEntrySchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  logicalBytes: z.number().int().nonnegative(),
  storedBytes: z.number().int().nonnegative(),
  notes: z.array(z.string().min(1)).default([]),
});

export const GrocyBackupRetentionHistorySchema = z.object({
  kind: z.literal("grocy_backup_retention_history"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  scope: z.literal("synthetic_fixture_only"),
  policy: GrocyBackupRetentionPolicySchema,
  pricing: GrocyBackupRetentionPricingSchema,
  snapshots: z.array(GrocyBackupRetentionSnapshotHistoryEntrySchema).min(1),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export const GrocyBackupRetentionBucketSchema = z.enum([
  "latest",
  "hourly",
  "daily",
  "weekly",
  "monthly",
]);

export const GrocyBackupRetentionSimulationSnapshotSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  logicalBytes: z.number().int().nonnegative(),
  storedBytes: z.number().int().nonnegative(),
  retained: z.boolean(),
  retainedBy: z.array(GrocyBackupRetentionBucketSchema).default([]),
  notes: z.array(z.string().min(1)).default([]),
});

export const GrocyBackupRetentionSimulationTimelineEntrySchema = z.object({
  evaluatedAt: z.string().min(1),
  snapshotId: z.string().min(1),
  retainedSnapshotCount: z.number().int().nonnegative(),
  retainedStoredBytes: z.number().int().nonnegative(),
  retainedLogicalBytes: z.number().int().nonnegative(),
  estimatedMonthlyCost: z.number().nonnegative(),
});

export const GrocyBackupRetentionSimulationReportSchema = z.object({
  kind: z.literal("grocy_backup_retention_simulation_report"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  scope: z.literal("synthetic_fixture_only"),
  historyPath: z.string().min(1),
  policy: GrocyBackupRetentionPolicySchema,
  pricing: GrocyBackupRetentionPricingSchema,
  summary: z.object({
    snapshotCount: z.number().int().nonnegative(),
    retainedSnapshotCount: z.number().int().nonnegative(),
    expiredSnapshotCount: z.number().int().nonnegative(),
    retainedStoredBytes: z.number().int().nonnegative(),
    retainedLogicalBytes: z.number().int().nonnegative(),
    peakRetainedStoredBytes: z.number().int().nonnegative(),
    estimatedMonthlyCost: z.number().nonnegative(),
    estimatedAnnualCost: z.number().nonnegative(),
  }),
  retainedSnapshots: z.array(GrocyBackupRetentionSimulationSnapshotSchema).default([]),
  expiredSnapshots: z.array(GrocyBackupRetentionSimulationSnapshotSchema).default([]),
  timeline: z.array(GrocyBackupRetentionSimulationTimelineEntrySchema).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export type GrocyBackupRetentionPolicy = z.infer<typeof GrocyBackupRetentionPolicySchema>;
export type GrocyBackupRetentionPricing = z.infer<typeof GrocyBackupRetentionPricingSchema>;
export type GrocyBackupRetentionSnapshotHistoryEntry = z.infer<typeof GrocyBackupRetentionSnapshotHistoryEntrySchema>;
export type GrocyBackupRetentionHistory = z.infer<typeof GrocyBackupRetentionHistorySchema>;
export type GrocyBackupRetentionBucket = z.infer<typeof GrocyBackupRetentionBucketSchema>;
export type GrocyBackupRetentionSimulationSnapshot = z.infer<typeof GrocyBackupRetentionSimulationSnapshotSchema>;
export type GrocyBackupRetentionSimulationTimelineEntry = z.infer<typeof GrocyBackupRetentionSimulationTimelineEntrySchema>;
export type GrocyBackupRetentionSimulationReport = z.infer<typeof GrocyBackupRetentionSimulationReportSchema>;
