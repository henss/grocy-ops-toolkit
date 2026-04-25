import { z } from "zod";

export const GrocyBackupVerificationReportSchema = z.object({
  kind: z.literal("grocy_backup_verification_report"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  archiveRecordId: z.string().min(1),
  archivePath: z.string().min(1),
  manifestPath: z.string().min(1),
  verification: z.object({
    command: z.literal("npm run grocy:backup:verify"),
    status: z.enum(["pass", "fail"]),
    checksumVerified: z.boolean(),
    fileCount: z.number().int().nonnegative(),
    totalBytes: z.number().int().nonnegative(),
    restoredTo: z.string().min(1).optional(),
  }),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export type GrocyBackupVerificationReport = z.infer<typeof GrocyBackupVerificationReportSchema>;
