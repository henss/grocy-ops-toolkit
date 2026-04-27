import fs from "node:fs";
import path from "node:path";
import { verifyGrocyBackupSnapshot } from "./backups.js";
import {
  GrocyBackupRestoreDrillReportSchema,
  GrocyBackupRestorePlanDryRunReportSchema,
  type GrocyBackupManifest,
} from "./schemas.js";
import type {
  GrocyBackupIntegrityReceipt,
  GrocyBackupIntegrityReceiptVerification,
} from "./backup-integrity-receipt-schema.js";

type ReceiptVerificationCheck = GrocyBackupIntegrityReceiptVerification["checks"][number];

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
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

function buildVerificationCheck(
  id: ReceiptVerificationCheck["id"],
  status: "pass" | "fail",
  message: string,
): ReceiptVerificationCheck {
  return { id, status, message };
}

function readOptionalArtifact(
  baseDir: string,
  targetPath: string,
): { ok: true; value: unknown } | { ok: false; message: string } {
  const absolutePath = path.resolve(baseDir, targetPath);
  if (!fs.existsSync(absolutePath)) {
    return {
      ok: false,
      message: `Expected proof artifact is missing at ${toPublicSafePath(baseDir, absolutePath)}.`,
    };
  }

  try {
    return { ok: true, value: readJsonFile(absolutePath) };
  } catch (error) {
    return {
      ok: false,
      message: `Proof artifact at ${toPublicSafePath(baseDir, absolutePath)} could not be read as JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function buildArchiveVerificationCheck(params: {
  baseDir: string;
  configPath: string | undefined;
  manifestPath: string;
  record: GrocyBackupManifest["records"][number];
  receipt: GrocyBackupIntegrityReceipt;
}): ReceiptVerificationCheck {
  let matches = false;
  let message: string;
  try {
    const current = verifyGrocyBackupSnapshot(params.baseDir, {
      archivePath: params.record.archivePath,
      configPath: params.configPath,
      manifestPath: params.manifestPath,
    });
    matches = current.checksumVerified === params.receipt.verification.checksumVerified
      && current.fileCount === params.receipt.verification.fileCount
      && current.totalBytes === params.receipt.verification.totalBytes
      && params.receipt.verification.status === "pass";
    message = matches
      ? "Archive verification reran successfully and matched the receipt counts."
      : "Archive verification reran, but the receipt verification section no longer matches current results.";
  } catch (error) {
    message = `Archive verification failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  return buildVerificationCheck("archive_verification_passed", matches ? "pass" : "fail", message);
}

export function buildRestorePlanVerificationCheck(
  baseDir: string,
  restorePlanPath: string,
  receipt: GrocyBackupIntegrityReceipt,
): ReceiptVerificationCheck {
  const restorePlanArtifact = readOptionalArtifact(baseDir, restorePlanPath);
  if (!restorePlanArtifact.ok) {
    return buildVerificationCheck("restore_plan_reviewed", "fail", restorePlanArtifact.message);
  }
  const restorePlan = GrocyBackupRestorePlanDryRunReportSchema.parse(restorePlanArtifact.value);
  const matches = restorePlan.summary.result === "ready"
    && restorePlan.summary.checksumVerified
    && restorePlan.archiveRecordId === receipt.archive.recordId
    && restorePlan.summary.fileCount === receipt.archive.fileCount
    && restorePlan.summary.totalBytes === receipt.archive.totalBytes;
  return buildVerificationCheck(
    "restore_plan_reviewed",
    matches ? "pass" : "fail",
    matches
      ? "Restore-plan dry-run evidence still matches the receipt archive record and summary."
      : "Restore-plan dry-run evidence no longer matches the receipt archive record or summary.",
  );
}

export function buildRestoreDrillVerificationCheck(
  baseDir: string,
  restoreDrillPath: string,
  receipt: GrocyBackupIntegrityReceipt,
): ReceiptVerificationCheck {
  const restoreDrillArtifact = readOptionalArtifact(baseDir, restoreDrillPath);
  if (!restoreDrillArtifact.ok) {
    return buildVerificationCheck("restore_drill_verified", "fail", restoreDrillArtifact.message);
  }
  const restoreDrill = GrocyBackupRestoreDrillReportSchema.parse(restoreDrillArtifact.value);
  const matches = restoreDrill.summary.result === "pass"
    && restoreDrill.summary.fileCount === receipt.archive.fileCount
    && restoreDrill.summary.totalBytes === receipt.archive.totalBytes
    && restoreDrill.checkpoints.every((checkpoint) => checkpoint.status === "pass");
  return buildVerificationCheck(
    "restore_drill_verified",
    matches ? "pass" : "fail",
    matches
      ? "Restore-drill evidence still confirms the recorded backup through passing checkpoints."
      : "Restore-drill evidence no longer confirms the recorded backup through passing checkpoints.",
  );
}
