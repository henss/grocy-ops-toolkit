import fs from "node:fs";
import path from "node:path";
import { GROCY_BACKUP_MANIFEST_PATH, verifyGrocyBackupSnapshot } from "./backups.js";
import {
  GrocyBackupVerificationReportSchema,
  type GrocyBackupVerificationReport,
} from "./backup-verification-schema.js";

export const GROCY_BACKUP_VERIFICATION_REPORT_PATH = path.join("data", "grocy-backup-verification-report.json");

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function normalizeDisplayPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function toPublicSafePath(baseDir: string, targetPath: string): string {
  const absolutePath = path.resolve(baseDir, targetPath);
  const relativePath = path.relative(baseDir, absolutePath);
  return relativePath.startsWith("..") || path.isAbsolute(relativePath)
    ? "[external-path-redacted]"
    : normalizeDisplayPath(relativePath);
}

export function createGrocyBackupVerificationReport(
  baseDir: string = process.cwd(),
  options: {
    archivePath?: string;
    restoreDir?: string;
    confirmRestoreWrite?: boolean;
    configPath?: string;
    manifestPath?: string;
    generatedAt?: string;
  } = {},
): GrocyBackupVerificationReport {
  const verification = verifyGrocyBackupSnapshot(baseDir, options);
  const manifestPath = options.manifestPath ?? GROCY_BACKUP_MANIFEST_PATH;

  return GrocyBackupVerificationReportSchema.parse({
    kind: "grocy_backup_verification_report",
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    archiveRecordId: verification.recordId,
    archivePath: toPublicSafePath(baseDir, verification.archivePath),
    manifestPath: toPublicSafePath(baseDir, manifestPath),
    verification: {
      command: "npm run grocy:backup:verify",
      status: verification.checksumVerified ? "pass" : "fail",
      checksumVerified: verification.checksumVerified,
      fileCount: verification.fileCount,
      totalBytes: verification.totalBytes,
      restoredTo: verification.restoredTo ? toPublicSafePath(baseDir, verification.restoredTo) : undefined,
    },
    reviewNotes: [
      "This report keeps verification output public-safe by redacting paths outside the current repo root.",
      "Use --confirm-restore-write only when you intentionally want restore proof written into the requested restore directory.",
    ],
  });
}

export function recordGrocyBackupVerificationReport(
  report: GrocyBackupVerificationReport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_BACKUP_VERIFICATION_REPORT_PATH),
    report,
    options.overwrite ?? true,
  );
}
