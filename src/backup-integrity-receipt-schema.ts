import { z } from "zod";
import { GrocyBackupRestoreFailureCategorySchema } from "./schemas.js";

export const GrocyBackupIntegrityReceiptCheckIdSchema = z.enum([
  "archive_record_present",
  "archive_verification_passed",
  "restore_plan_reviewed",
  "restore_drill_verified",
]);

export const GrocyBackupIntegrityReceiptCheckSchema = z.object({
  id: GrocyBackupIntegrityReceiptCheckIdSchema,
  status: z.enum(["pass", "fail"]),
  artifactPath: z.string().min(1).optional(),
  evidence: z.array(z.string().min(1)).default([]),
});

export const GrocyBackupIntegrityReceiptSchema = z.object({
  kind: z.literal("grocy_backup_integrity_receipt"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  scope: z.literal("public_safe_metadata"),
  signature: z.object({
    algorithm: z.literal("hmac-sha256"),
    keySource: z.literal("backup_passphrase_env"),
    keyName: z.string().min(1),
    signedAt: z.string().min(1),
    value: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  archive: z.object({
    recordId: z.string().min(1),
    createdAt: z.string().min(1),
    sourcePath: z.string().min(1),
    archivePath: z.string().min(1),
    locationLabel: z.string().min(1),
    checksumSha256: z.string().min(1),
    fileCount: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
    restoreTestStatus: z.enum(["not_tested", "verified", "failed"]),
    restoreFailureCategory: GrocyBackupRestoreFailureCategorySchema.optional(),
  }),
  verification: z.object({
    command: z.literal("npm run grocy:backup:verify"),
    status: z.enum(["pass", "fail"]),
    checksumVerified: z.boolean(),
    fileCount: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
  }),
  summary: z.object({
    status: z.enum(["pass", "fail"]),
    checkCount: z.number().int().nonnegative(),
    passedCount: z.number().int().nonnegative(),
  }),
  artifacts: z.object({
    manifestPath: z.string().min(1),
    restorePlanReportPath: z.string().min(1).optional(),
    restoreDrillReportPath: z.string().min(1).optional(),
  }),
  checks: z.array(GrocyBackupIntegrityReceiptCheckSchema).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export const GrocyBackupIntegrityReceiptVerificationSchema = z.object({
  kind: z.literal("grocy_backup_integrity_receipt_verification"),
  version: z.literal(1),
  verifiedAt: z.string().min(1),
  receiptPath: z.string().min(1),
  summary: z.object({
    status: z.enum(["pass", "fail"]),
    checkCount: z.number().int().nonnegative(),
    passedCount: z.number().int().nonnegative(),
  }),
  checks: z.array(z.object({
    id: z.union([GrocyBackupIntegrityReceiptCheckIdSchema, z.literal("receipt_schema_valid"), z.literal("receipt_signature_valid")]),
    status: z.enum(["pass", "fail"]),
    message: z.string().min(1),
  })).default([]),
});

export type GrocyBackupIntegrityReceiptCheckId = z.infer<typeof GrocyBackupIntegrityReceiptCheckIdSchema>;
export type GrocyBackupIntegrityReceiptCheck = z.infer<typeof GrocyBackupIntegrityReceiptCheckSchema>;
export type GrocyBackupIntegrityReceipt = z.infer<typeof GrocyBackupIntegrityReceiptSchema>;
export type GrocyBackupIntegrityReceiptVerification = z.infer<typeof GrocyBackupIntegrityReceiptVerificationSchema>;
