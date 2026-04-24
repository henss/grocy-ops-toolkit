import { z } from "zod";

export const GrocySecretRotationSmokeReportCheckSchema = z.object({
  id: z.enum([
    "credential_baseline",
    "credential_stale_rejected",
    "credential_rotated",
    "backup_key_baseline",
    "backup_key_stale_rejected",
    "backup_key_rotated",
  ]),
  status: z.enum(["pass", "fail"]),
  message: z.string().min(1),
});

export const GrocySecretRotationSmokeReportSchema = z.object({
  kind: z.literal("grocy_secret_rotation_smoke_report"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  scope: z.literal("synthetic_fixture_only"),
  summary: z.object({
    result: z.enum(["pass", "fail"]),
    checkCount: z.number().int().nonnegative(),
    failureCount: z.number().int().nonnegative(),
  }),
  checks: z.array(GrocySecretRotationSmokeReportCheckSchema).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export type GrocySecretRotationSmokeReportCheck = z.infer<typeof GrocySecretRotationSmokeReportCheckSchema>;
export type GrocySecretRotationSmokeReport = z.infer<typeof GrocySecretRotationSmokeReportSchema>;
