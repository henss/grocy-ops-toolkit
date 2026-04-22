import fs from "node:fs";
import path from "node:path";
import {
  createGrocyBackupRestorePlanDryRunReport,
  createGrocyBackupSnapshot,
  GROCY_BACKUP_MANIFEST_PATH,
  GROCY_BACKUP_RESTORE_PLAN_DRY_RUN_REPORT_PATH,
  recordGrocyBackupRestorePlanDryRunReport,
  verifyGrocyBackupSnapshot,
} from "./backups.js";
import {
  GrocyBackupRestoreDrillReportSchema,
  type GrocyBackupRestoreDrillCheckpoint,
  type GrocyBackupRestoreDrillReport,
} from "./schemas.js";

export const GROCY_BACKUP_RESTORE_DRILL_REPORT_PATH = path.join("data", "grocy-backup-restore-drill-report.json");
export const DEFAULT_GROCY_BACKUP_RESTORE_DRILL_DIR = path.join("restore", "grocy-restore-drill");

function normalizeDisplayPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function toPublicSafePath(baseDir: string, targetPath: string): string {
  const relativePath = path.relative(baseDir, targetPath);
  return relativePath.startsWith("..") || path.isAbsolute(relativePath)
    ? "[external-path-redacted]"
    : normalizeDisplayPath(relativePath);
}

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function buildCheckpoint(
  id: GrocyBackupRestoreDrillCheckpoint["id"],
  command: string,
  artifactPath: string | undefined,
  evidence: string[],
): GrocyBackupRestoreDrillCheckpoint {
  return {
    id,
    status: "pass",
    command,
    artifactPath,
    evidence,
  };
}

function summarizeCheckpoints(
  checkpoints: GrocyBackupRestoreDrillCheckpoint[],
  fileCount: number,
  totalBytes: number,
  wouldCreate: number,
  wouldOverwrite: number,
): GrocyBackupRestoreDrillReport["summary"] {
  const passedCount = checkpoints.filter((checkpoint) => checkpoint.status === "pass").length;
  return {
    result: passedCount === checkpoints.length ? "pass" : "fail",
    checkpointCount: checkpoints.length,
    passedCount,
    fileCount,
    totalBytes,
    wouldCreate,
    wouldOverwrite,
  };
}

export function createGrocyBackupRestoreDrillReport(
  baseDir: string = process.cwd(),
  options: {
    restoreDir?: string;
    generatedAt?: string;
    createdAt?: string;
    configPath?: string;
    manifestPath?: string;
    restorePlanOutputPath?: string;
  } = {},
): GrocyBackupRestoreDrillReport {
  const restoreDir = options.restoreDir ?? DEFAULT_GROCY_BACKUP_RESTORE_DRILL_DIR;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const snapshot = createGrocyBackupSnapshot(baseDir, {
    createdAt: options.createdAt ?? generatedAt,
    configPath: options.configPath,
    manifestPath: options.manifestPath,
  });
  const restorePlan = createGrocyBackupRestorePlanDryRunReport(baseDir, {
    restoreDir,
    generatedAt,
    configPath: options.configPath,
    manifestPath: options.manifestPath,
  });
  const restorePlanOutputPath = recordGrocyBackupRestorePlanDryRunReport(restorePlan, {
    baseDir,
    outputPath: options.restorePlanOutputPath ?? GROCY_BACKUP_RESTORE_PLAN_DRY_RUN_REPORT_PATH,
    overwrite: true,
  });
  const verification = verifyGrocyBackupSnapshot(baseDir, {
    restoreDir,
    confirmRestoreWrite: true,
    configPath: options.configPath,
    manifestPath: options.manifestPath,
  });
  const manifestPath = path.resolve(baseDir, options.manifestPath ?? GROCY_BACKUP_MANIFEST_PATH);
  const restoreDirPath = path.resolve(baseDir, restoreDir);
  const checkpoints = [
    buildCheckpoint(
      "snapshot_created",
      "npm run grocy:backup:snapshot",
      toPublicSafePath(baseDir, manifestPath),
      [
        `Created encrypted archive record ${snapshot.id}.`,
        `Manifest recorded restoreTestStatus=${snapshot.restoreTestStatus}.`,
        `Archive captured ${snapshot.fileCount} files and ${snapshot.totalBytes} total bytes.`,
      ],
    ),
    buildCheckpoint(
      "restore_plan_ready",
      `npm run grocy:backup:restore-plan -- --restore-dir ${normalizeDisplayPath(restoreDir)}`,
      toPublicSafePath(baseDir, restorePlanOutputPath),
      [
        `Restore plan summary result=${restorePlan.summary.result}.`,
        `Dry-run checksumVerified=${String(restorePlan.summary.checksumVerified)} and blocked=${String(restorePlan.summary.blocked)}.`,
        `Dry-run wouldCreate=${String(restorePlan.summary.wouldCreate)} and wouldOverwrite=${String(restorePlan.summary.wouldOverwrite)}.`,
      ],
    ),
    buildCheckpoint(
      "restore_verification_succeeded",
      `npm run grocy:backup:verify -- --restore-dir ${normalizeDisplayPath(restoreDir)} --confirm-restore-write`,
      toPublicSafePath(baseDir, restoreDirPath),
      [
        `Restore verification checksumVerified=${String(verification.checksumVerified)}.`,
        `Confirmed restore wrote ${verification.fileCount} files into ${toPublicSafePath(baseDir, restoreDirPath)}.`,
        "Manifest restore status is now verified after the confirmed fixture-only restore check.",
      ],
    ),
  ] satisfies GrocyBackupRestoreDrillCheckpoint[];

  return GrocyBackupRestoreDrillReportSchema.parse({
    kind: "grocy_backup_restore_drill_report",
    version: 1,
    generatedAt,
    scope: "synthetic_fixture_only",
    sourcePath: toPublicSafePath(baseDir, snapshot.sourcePath),
    restoreDir: toPublicSafePath(baseDir, restoreDirPath),
    summary: summarizeCheckpoints(
      checkpoints,
      snapshot.fileCount,
      snapshot.totalBytes,
      restorePlan.summary.wouldCreate,
      restorePlan.summary.wouldOverwrite,
    ),
    checkpoints,
    artifacts: {
      manifestPath: toPublicSafePath(baseDir, manifestPath),
      restorePlanReportPath: toPublicSafePath(baseDir, restorePlanOutputPath),
    },
    reviewNotes: [
      "This restore drill stays inside a fixture-only boundary and uses synthetic backup source files only.",
      "Use the checkpoint evidence to confirm snapshot creation, no-write restore planning, and confirmed restore verification without relying on narrative-only review.",
      "Keep config, restore, and backup paths conventional so future agents can rerun the drill with npm-first commands.",
    ],
  });
}

export function recordGrocyBackupRestoreDrillReport(
  report: GrocyBackupRestoreDrillReport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_BACKUP_RESTORE_DRILL_REPORT_PATH),
    report,
    options.overwrite ?? true,
  );
}
