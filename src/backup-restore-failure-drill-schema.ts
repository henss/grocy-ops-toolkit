import { z } from "zod";
import { GrocyBackupRestoreFailureCategorySchema } from "./schemas.js";

export const GrocyBackupRestoreFailureDrillScenarioSchema = z.object({
  id: z.enum([
    "corruption_detected",
    "wrong_passphrase_rejected",
    "path_escape_blocked",
  ]),
  status: z.enum(["pass", "fail"]),
  expectedFailureCategory: GrocyBackupRestoreFailureCategorySchema,
  observedFailureCategory: GrocyBackupRestoreFailureCategorySchema.optional(),
  command: z.string().min(1),
  artifactPath: z.string().min(1).optional(),
  evidence: z.array(z.string().min(1)).default([]),
});

export const GrocyBackupRestoreFailureDrillReportSchema = z.object({
  kind: z.literal("grocy_backup_restore_failure_drill_report"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  scope: z.literal("synthetic_fixture_only"),
  sourcePath: z.string().min(1),
  restoreDir: z.string().min(1),
  summary: z.object({
    result: z.enum(["pass", "fail"]),
    scenarioCount: z.number().int().nonnegative(),
    passedCount: z.number().int().nonnegative(),
  }),
  scenarios: z.array(GrocyBackupRestoreFailureDrillScenarioSchema).default([]),
  artifacts: z.object({
    manifestPath: z.string().min(1),
  }),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export type GrocyBackupRestoreFailureDrillScenario = z.infer<typeof GrocyBackupRestoreFailureDrillScenarioSchema>;
export type GrocyBackupRestoreFailureDrillReport = z.infer<typeof GrocyBackupRestoreFailureDrillReportSchema>;
