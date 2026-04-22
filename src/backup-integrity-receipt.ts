import fs from "node:fs";
import path from "node:path";
import {
  GROCY_BACKUP_MANIFEST_PATH,
  GROCY_BACKUP_RESTORE_PLAN_DRY_RUN_REPORT_PATH,
  verifyGrocyBackupSnapshot,
} from "./backups.js";
import { GROCY_BACKUP_RESTORE_DRILL_REPORT_PATH } from "./backup-restore-drill.js";
import {
  GrocyBackupManifestSchema,
  GrocyBackupRestoreDrillReportSchema,
  GrocyBackupRestorePlanDryRunReportSchema,
  type GrocyBackupManifest,
} from "./schemas.js";
import {
  GrocyBackupIntegrityReceiptSchema,
  GrocyBackupIntegrityReceiptVerificationSchema,
  type GrocyBackupIntegrityReceipt,
  type GrocyBackupIntegrityReceiptCheck,
  type GrocyBackupIntegrityReceiptCheckId,
  type GrocyBackupIntegrityReceiptVerification,
} from "./backup-integrity-receipt-schema.js";

export const GROCY_BACKUP_INTEGRITY_RECEIPT_PATH = path.join("data", "grocy-backup-integrity-receipt.json");

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

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

function resolveExistingPath(baseDir: string, targetPath: string): string | undefined {
  const absolutePath = path.resolve(baseDir, targetPath);
  return fs.existsSync(absolutePath) ? absolutePath : undefined;
}

function readOptionalArtifact(
  baseDir: string,
  targetPath: string,
): { ok: true; absolutePath: string; value: unknown } | { ok: false; message: string } {
  const absolutePath = path.resolve(baseDir, targetPath);
  if (!fs.existsSync(absolutePath)) {
    return {
      ok: false,
      message: `Expected proof artifact is missing at ${toPublicSafePath(baseDir, absolutePath)}.`,
    };
  }

  try {
    return {
      ok: true,
      absolutePath,
      value: readJsonFile(absolutePath),
    };
  } catch (error) {
    return {
      ok: false,
      message: `Proof artifact at ${toPublicSafePath(baseDir, absolutePath)} could not be read as JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function loadBackupManifest(baseDir: string, manifestPath: string): GrocyBackupManifest {
  const absoluteManifestPath = path.resolve(baseDir, manifestPath);
  if (!fs.existsSync(absoluteManifestPath)) {
    throw new Error(`Grocy backup manifest is missing at ${absoluteManifestPath}.`);
  }
  return GrocyBackupManifestSchema.parse(readJsonFile(absoluteManifestPath));
}

function findBackupRecord(manifest: GrocyBackupManifest, archivePath: string | undefined): GrocyBackupManifest["records"][number] {
  const record = archivePath
    ? manifest.records.find((item) => path.resolve(item.archivePath) === path.resolve(archivePath))
    : manifest.records[0];
  if (!record) {
    throw new Error("No Grocy backup record found to include in the integrity receipt.");
  }
  return record;
}

function findBackupRecordById(manifest: GrocyBackupManifest, recordId: string): GrocyBackupManifest["records"][number] {
  const record = manifest.records.find((item) => item.id === recordId);
  if (!record) {
    throw new Error(`Grocy backup record ${recordId} was not found in the manifest.`);
  }
  return record;
}

function buildCheck(
  id: GrocyBackupIntegrityReceiptCheckId,
  status: GrocyBackupIntegrityReceiptCheck["status"],
  evidence: string[],
  artifactPath?: string,
): GrocyBackupIntegrityReceiptCheck {
  return { id, status, artifactPath, evidence };
}

function summarizeChecks(checks: GrocyBackupIntegrityReceipt["checks"]): GrocyBackupIntegrityReceipt["summary"] {
  const passedCount = checks.filter((check) => check.status === "pass").length;
  return {
    status: passedCount === checks.length ? "pass" : "fail",
    checkCount: checks.length,
    passedCount,
  };
}

export function createGrocyBackupIntegrityReceipt(
  baseDir: string = process.cwd(),
  options: {
    archivePath?: string;
    generatedAt?: string;
    manifestPath?: string;
    restorePlanReportPath?: string;
    restoreDrillReportPath?: string;
    configPath?: string;
  } = {},
): GrocyBackupIntegrityReceipt {
  const manifestPath = options.manifestPath ?? GROCY_BACKUP_MANIFEST_PATH;
  const manifest = loadBackupManifest(baseDir, manifestPath);
  const record = findBackupRecord(manifest, options.archivePath);
  const verification = verifyGrocyBackupSnapshot(baseDir, {
    archivePath: record.archivePath,
    configPath: options.configPath,
    manifestPath,
  });
  const restorePlanAbsolutePath = resolveExistingPath(baseDir, options.restorePlanReportPath ?? GROCY_BACKUP_RESTORE_PLAN_DRY_RUN_REPORT_PATH);
  const restoreDrillAbsolutePath = resolveExistingPath(baseDir, options.restoreDrillReportPath ?? GROCY_BACKUP_RESTORE_DRILL_REPORT_PATH);
  const checks: GrocyBackupIntegrityReceipt["checks"] = [
    buildCheck(
      "archive_record_present",
      "pass",
      [
        `Manifest record ${record.id} points to ${record.fileCount} files and ${record.totalBytes} total bytes.`,
        `Location label is ${record.locationLabel}.`,
        `Archive checksum fingerprint is ${record.checksumSha256}.`,
      ],
      toPublicSafePath(baseDir, manifestPath),
    ),
    buildCheck(
      "archive_verification_passed",
      verification.checksumVerified ? "pass" : "fail",
      [
        `Archive verification used npm run grocy:backup:verify without restore writes.`,
        `Checksum verified=${String(verification.checksumVerified)}.`,
        `Archive decrypt and embedded file checks covered ${verification.fileCount} files and ${verification.totalBytes} total bytes.`,
      ],
    ),
  ];

  if (restorePlanAbsolutePath) {
    const restorePlan = GrocyBackupRestorePlanDryRunReportSchema.parse(readJsonFile(restorePlanAbsolutePath));
    const restorePlanPassed = restorePlan.summary.result === "ready"
      && restorePlan.summary.checksumVerified
      && restorePlan.archiveRecordId === record.id
      && restorePlan.summary.fileCount === record.fileCount
      && restorePlan.summary.totalBytes === record.totalBytes;
    checks.push(buildCheck(
      "restore_plan_reviewed",
      restorePlanPassed ? "pass" : "fail",
      [
        `Restore plan result=${restorePlan.summary.result} with checksumVerified=${String(restorePlan.summary.checksumVerified)}.`,
        `Dry-run wouldCreate=${restorePlan.summary.wouldCreate}, wouldOverwrite=${restorePlan.summary.wouldOverwrite}, blocked=${restorePlan.summary.blocked}.`,
        `Restore plan archive record id=${restorePlan.archiveRecordId ?? "missing"} was checked against manifest record ${record.id}.`,
      ],
      toPublicSafePath(baseDir, restorePlanAbsolutePath),
    ));
  }

  if (restoreDrillAbsolutePath) {
    const restoreDrill = GrocyBackupRestoreDrillReportSchema.parse(readJsonFile(restoreDrillAbsolutePath));
    const restoreDrillPassed = restoreDrill.summary.result === "pass"
      && restoreDrill.summary.fileCount === record.fileCount
      && restoreDrill.summary.totalBytes === record.totalBytes
      && restoreDrill.checkpoints.every((checkpoint) => checkpoint.status === "pass");
    checks.push(buildCheck(
      "restore_drill_verified",
      restoreDrillPassed ? "pass" : "fail",
      [
        `Restore drill result=${restoreDrill.summary.result} with ${restoreDrill.summary.passedCount}/${restoreDrill.summary.checkpointCount} checkpoints passing.`,
        `Confirmed restore proof covers ${restoreDrill.summary.fileCount} files and ${restoreDrill.summary.totalBytes} total bytes.`,
        `Checkpoint ids recorded: ${restoreDrill.checkpoints.map((checkpoint) => checkpoint.id).join(", ")}.`,
      ],
      toPublicSafePath(baseDir, restoreDrillAbsolutePath),
    ));
  }

  return GrocyBackupIntegrityReceiptSchema.parse({
    kind: "grocy_backup_integrity_receipt",
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    scope: "public_safe_metadata",
    archive: {
      recordId: record.id,
      createdAt: record.createdAt,
      sourcePath: toPublicSafePath(baseDir, record.sourcePath),
      archivePath: toPublicSafePath(baseDir, record.archivePath),
      locationLabel: record.locationLabel,
      checksumSha256: record.checksumSha256,
      fileCount: record.fileCount,
      totalBytes: record.totalBytes,
      restoreTestStatus: record.restoreTestStatus,
      restoreFailureCategory: record.restoreFailureCategory,
    },
    verification: {
      command: "npm run grocy:backup:verify",
      status: verification.checksumVerified ? "pass" : "fail",
      checksumVerified: verification.checksumVerified,
      fileCount: verification.fileCount,
      totalBytes: verification.totalBytes,
    },
    summary: summarizeChecks(checks),
    artifacts: {
      manifestPath: toPublicSafePath(baseDir, manifestPath),
      restorePlanReportPath: restorePlanAbsolutePath ? toPublicSafePath(baseDir, restorePlanAbsolutePath) : undefined,
      restoreDrillReportPath: restoreDrillAbsolutePath ? toPublicSafePath(baseDir, restoreDrillAbsolutePath) : undefined,
    },
    checks,
    reviewNotes: [
      "This receipt keeps only public-safe metadata and redacts archive or source paths that fall outside the current repo root.",
      "Treat the receipt as bounded backup evidence tied to the referenced manifest and optional restore-plan or restore-drill artifacts.",
      "Regenerate the receipt after new snapshots or restore drills so the recorded checksum, counts, and proof paths stay current.",
    ],
  });
}

function buildVerificationCheck(
  id: GrocyBackupIntegrityReceiptVerification["checks"][number]["id"],
  status: "pass" | "fail",
  message: string,
): GrocyBackupIntegrityReceiptVerification["checks"][number] {
  return { id, status, message };
}

export function verifyGrocyBackupIntegrityReceipt(
  baseDir: string = process.cwd(),
  options: {
    receiptPath?: string;
    manifestPath?: string;
    configPath?: string;
    restorePlanReportPath?: string;
    restoreDrillReportPath?: string;
  } = {},
): GrocyBackupIntegrityReceiptVerification {
  const receiptPath = options.receiptPath ?? GROCY_BACKUP_INTEGRITY_RECEIPT_PATH;
  const absoluteReceiptPath = path.resolve(baseDir, receiptPath);
  const receipt = GrocyBackupIntegrityReceiptSchema.parse(readJsonFile(absoluteReceiptPath));
  const checks: GrocyBackupIntegrityReceiptVerification["checks"] = [
    buildVerificationCheck("receipt_schema_valid", "pass", "Receipt parsed successfully against the published schema."),
  ];

  const manifestPath = options.manifestPath ?? receipt.artifacts.manifestPath;
  const manifest = loadBackupManifest(baseDir, manifestPath);
  const record = findBackupRecordById(manifest, receipt.archive.recordId);
  const manifestMatches = record.id === receipt.archive.recordId
    && record.createdAt === receipt.archive.createdAt
    && record.locationLabel === receipt.archive.locationLabel
    && record.checksumSha256 === receipt.archive.checksumSha256
    && record.fileCount === receipt.archive.fileCount
    && record.totalBytes === receipt.archive.totalBytes;
  checks.push(buildVerificationCheck(
    "archive_record_present",
    manifestMatches ? "pass" : "fail",
    manifestMatches
      ? `Manifest record ${record.id} still matches the receipt metadata.`
      : `Manifest record ${record.id} does not match the receipt archive metadata for ${receipt.archive.recordId}.`,
  ));

  const archiveVerification = verifyGrocyBackupSnapshot(baseDir, {
    archivePath: record.archivePath,
    configPath: options.configPath,
    manifestPath,
  });
  const verificationMatches = archiveVerification.checksumVerified === receipt.verification.checksumVerified
    && archiveVerification.fileCount === receipt.verification.fileCount
    && archiveVerification.totalBytes === receipt.verification.totalBytes
    && receipt.verification.status === "pass";
  checks.push(buildVerificationCheck(
    "archive_verification_passed",
    verificationMatches ? "pass" : "fail",
    verificationMatches
      ? "Archive verification reran successfully and matched the receipt counts."
      : "Archive verification reran, but the receipt verification section no longer matches current results.",
  ));

  const restorePlanPath = options.restorePlanReportPath ?? receipt.artifacts.restorePlanReportPath;
  if (restorePlanPath) {
    const restorePlanArtifact = readOptionalArtifact(baseDir, restorePlanPath);
    if (!restorePlanArtifact.ok) {
      checks.push(buildVerificationCheck("restore_plan_reviewed", "fail", restorePlanArtifact.message));
    } else {
      const restorePlan = GrocyBackupRestorePlanDryRunReportSchema.parse(restorePlanArtifact.value);
      const restorePlanMatches = restorePlan.summary.result === "ready"
        && restorePlan.summary.checksumVerified
        && restorePlan.archiveRecordId === receipt.archive.recordId
        && restorePlan.summary.fileCount === receipt.archive.fileCount
        && restorePlan.summary.totalBytes === receipt.archive.totalBytes;
      checks.push(buildVerificationCheck(
        "restore_plan_reviewed",
        restorePlanMatches ? "pass" : "fail",
        restorePlanMatches
          ? "Restore-plan dry-run evidence still matches the receipt archive record and summary."
          : "Restore-plan dry-run evidence no longer matches the receipt archive record or summary.",
      ));
    }
  }

  const restoreDrillPath = options.restoreDrillReportPath ?? receipt.artifacts.restoreDrillReportPath;
  if (restoreDrillPath) {
    const restoreDrillArtifact = readOptionalArtifact(baseDir, restoreDrillPath);
    if (!restoreDrillArtifact.ok) {
      checks.push(buildVerificationCheck("restore_drill_verified", "fail", restoreDrillArtifact.message));
    } else {
      const restoreDrill = GrocyBackupRestoreDrillReportSchema.parse(restoreDrillArtifact.value);
      const restoreDrillMatches = restoreDrill.summary.result === "pass"
        && restoreDrill.summary.fileCount === receipt.archive.fileCount
        && restoreDrill.summary.totalBytes === receipt.archive.totalBytes
        && restoreDrill.checkpoints.every((checkpoint) => checkpoint.status === "pass");
      checks.push(buildVerificationCheck(
        "restore_drill_verified",
        restoreDrillMatches ? "pass" : "fail",
        restoreDrillMatches
          ? "Restore-drill evidence still confirms the recorded backup through passing checkpoints."
          : "Restore-drill evidence no longer confirms the recorded backup through passing checkpoints.",
      ));
    }
  }

  const passedCount = checks.filter((check) => check.status === "pass").length;
  return GrocyBackupIntegrityReceiptVerificationSchema.parse({
    kind: "grocy_backup_integrity_receipt_verification",
    version: 1,
    verifiedAt: new Date().toISOString(),
    receiptPath: toPublicSafePath(baseDir, absoluteReceiptPath),
    summary: {
      status: passedCount === checks.length ? "pass" : "fail",
      checkCount: checks.length,
      passedCount,
    },
    checks,
  });
}

export function recordGrocyBackupIntegrityReceipt(
  receipt: GrocyBackupIntegrityReceipt,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_BACKUP_INTEGRITY_RECEIPT_PATH),
    receipt,
    options.overwrite ?? true,
  );
}
