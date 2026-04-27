import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  createGrocyBackupIntegrityReceipt,
  GROCY_BACKUP_INTEGRITY_RECEIPT_PATH,
  GROCY_BACKUP_INTEGRITY_RECEIPT_VERIFICATION_PATH,
  recordGrocyBackupIntegrityReceipt,
  verifyGrocyBackupIntegrityReceipt,
} from "../src/backup-integrity-receipt.js";
import {
  GrocyBackupIntegrityReceiptSchema,
  GrocyBackupIntegrityReceiptVerificationSchema,
} from "../src/backup-integrity-receipt-schema.js";
import {
  createGrocyBackupRestoreDrillReport,
  recordGrocyBackupRestoreDrillReport,
} from "../src/backup-restore-drill.js";
import {
  createGrocyBackupRestorePlanDryRunReport,
  createGrocyBackupSnapshot,
  recordGrocyBackupRestorePlanDryRunReport,
} from "../src/backups.js";
const envName = "GROCY_TEST_BACKUP_RECEIPT_PASSPHRASE";
const fixtureSourcePath = path.resolve("examples", "synthetic-grocy-backup-source");

afterEach(() => {
  delete process.env[envName];
});

function writeBackupConfig(baseDir: string, configPath = path.join("config", "grocy-backup.local.json")): void {
  fs.mkdirSync(path.dirname(path.join(baseDir, configPath)), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, configPath),
    JSON.stringify({
      sourcePath: "source",
      backupDir: "backups",
      passphraseEnv: envName,
      locationLabel: "synthetic-local-encrypted",
    }),
    "utf8",
  );
  process.env[envName] = "synthetic-passphrase";
}

function setupFixtureBackupBase(prefix: string, configPath?: string): string {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.cpSync(fixtureSourcePath, path.join(baseDir, "source"), { recursive: true });
  writeBackupConfig(baseDir, configPath);
  return baseDir;
}

function runReceiptCli(baseDir: string, args: string[]): unknown {
  const stdout = execFileSync(process.execPath, [
    path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(process.cwd(), "src", "cli.ts"),
    ...args,
  ], {
    cwd: baseDir,
    encoding: "utf8",
    env: { ...process.env, [envName]: "synthetic-passphrase" },
  });
  return JSON.parse(stdout) as unknown;
}

function readReceiptJson(filePath: string): unknown {
  return GrocyBackupIntegrityReceiptSchema.parse(JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown);
}

function readReceiptVerificationJson(filePath: string): unknown {
  return GrocyBackupIntegrityReceiptVerificationSchema.parse(JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown);
}

function createRestorePlanFixture(baseDir: string, createdAt: string, generatedAt: string, restoreDir: string): string {
  createGrocyBackupSnapshot(baseDir, { createdAt });
  return recordGrocyBackupRestorePlanDryRunReport(
    createGrocyBackupRestorePlanDryRunReport(baseDir, {
      restoreDir,
      generatedAt,
    }),
    { baseDir },
  );
}

function expectMissingProofArtifactVerification(): void {
  const baseDir = setupFixtureBackupBase("grocy-backup-receipt-missing-proof-");
  const restorePlanPath = createRestorePlanFixture(
    baseDir,
    "2026-04-22T17:34:00.000Z",
    "2026-04-22T17:35:00.000Z",
    path.join("restore", "missing-proof-check"),
  );
  recordGrocyBackupIntegrityReceipt(createGrocyBackupIntegrityReceipt(baseDir), { baseDir });
  fs.rmSync(restorePlanPath);

  const verification = verifyGrocyBackupIntegrityReceipt(baseDir);
  const missingArtifactCheck = verification.checks.find((check) => check.id === "restore_plan_reviewed");

  expect(verification.summary.status).toBe("fail");
  expect(missingArtifactCheck?.status).toBe("fail");
  expect(missingArtifactCheck?.message).toContain("Expected proof artifact is missing");
}

function expectReceiptVerifierCliOutput(): void {
  const baseDir = setupFixtureBackupBase("grocy-backup-receipt-cli-");
  createRestorePlanFixture(baseDir, "2026-04-22T17:40:00.000Z", "2026-04-22T17:41:00.000Z", path.join("restore", "cli-check"));
  recordGrocyBackupIntegrityReceipt(createGrocyBackupIntegrityReceipt(baseDir), { baseDir });

  expect(runReceiptCli(baseDir, ["grocy:backup:receipt:verify"])).toMatchObject({
    kind: "grocy_backup_integrity_receipt_verification",
    summary: { status: "pass", checkCount: 5, passedCount: 5 },
  });
}

function expectReceiptEmitterCliOutput(): void {
  const baseDir = setupFixtureBackupBase("grocy-backup-receipt-emit-cli-");
  createRestorePlanFixture(baseDir, "2026-04-22T17:38:00.000Z", "2026-04-22T17:39:00.000Z", path.join("restore", "emit-cli-check"));

  expect(runReceiptCli(baseDir, ["grocy:backup:receipt"])).toMatchObject({
    outputPath: path.join(baseDir, GROCY_BACKUP_INTEGRITY_RECEIPT_PATH),
    summary: { status: "pass", checkCount: 3, passedCount: 3 },
  });
  expect(readReceiptJson(path.join(baseDir, GROCY_BACKUP_INTEGRITY_RECEIPT_PATH))).toMatchObject({
    kind: "grocy_backup_integrity_receipt",
    summary: { status: "pass", checkCount: 3, passedCount: 3 },
  });
}

function expectReceiptVerifierCliOutputFile(): void {
  const baseDir = setupFixtureBackupBase("grocy-backup-receipt-cli-output-");
  createRestorePlanFixture(baseDir, "2026-04-22T17:42:00.000Z", "2026-04-22T17:43:00.000Z", path.join("restore", "cli-output-check"));
  recordGrocyBackupIntegrityReceipt(createGrocyBackupIntegrityReceipt(baseDir), { baseDir });

  expect(runReceiptCli(baseDir, [
    "grocy:backup:receipt:verify",
    "--output",
    GROCY_BACKUP_INTEGRITY_RECEIPT_VERIFICATION_PATH,
    "--force",
  ])).toMatchObject({
    outputPath: path.join(baseDir, GROCY_BACKUP_INTEGRITY_RECEIPT_VERIFICATION_PATH),
    summary: { status: "pass", checkCount: 5, passedCount: 5 },
  });
  expect(readReceiptVerificationJson(path.join(baseDir, GROCY_BACKUP_INTEGRITY_RECEIPT_VERIFICATION_PATH))).toMatchObject({
    kind: "grocy_backup_integrity_receipt_verification",
    summary: { status: "pass", checkCount: 5, passedCount: 5 },
  });
}

function expectCustomConfigReceiptCliOutput(): void {
  const configPath = path.join("config", "synthetic-backup.local.json");
  const baseDir = setupFixtureBackupBase("grocy-backup-receipt-custom-config-", configPath);
  createGrocyBackupSnapshot(baseDir, {
    configPath,
    createdAt: "2026-04-22T17:44:00.000Z",
  });

  expect(runReceiptCli(baseDir, [
    "grocy:backup:receipt",
    "--config",
    configPath,
    "--output",
    GROCY_BACKUP_INTEGRITY_RECEIPT_PATH,
    "--force",
  ])).toMatchObject({
    outputPath: path.join(baseDir, GROCY_BACKUP_INTEGRITY_RECEIPT_PATH),
    summary: { status: "pass", checkCount: 2, passedCount: 2 },
  });
  expect(runReceiptCli(baseDir, [
    "grocy:backup:receipt:verify",
    "--config",
    configPath,
  ])).toMatchObject({
    kind: "grocy_backup_integrity_receipt_verification",
    summary: { status: "pass", checkCount: 4, passedCount: 4 },
  });
}

describe("Grocy backup integrity receipt", () => {
  it("creates a public-safe receipt from synthetic backup evidence", () => {
    const baseDir = setupFixtureBackupBase("grocy-backup-receipt-");
    const report = createGrocyBackupRestoreDrillReport(baseDir, {
      restoreDir: path.join("restore", "fixture-check"),
      generatedAt: "2026-04-22T17:10:00.000Z",
      createdAt: "2026-04-22T17:10:00.000Z",
    });
    recordGrocyBackupRestoreDrillReport(report, { baseDir });
    const receipt = createGrocyBackupIntegrityReceipt(baseDir, {
      generatedAt: "2026-04-22T17:11:00.000Z",
    });
    const outputPath = recordGrocyBackupIntegrityReceipt(receipt, { baseDir });

    expect(path.relative(baseDir, outputPath)).toBe(GROCY_BACKUP_INTEGRITY_RECEIPT_PATH);
    expect(receipt.summary).toEqual({
      status: "pass",
      checkCount: 4,
      passedCount: 4,
    });
    expect(receipt.signature).toMatchObject({
      algorithm: "hmac-sha256",
      keySource: "backup_passphrase_env",
      keyName: envName,
    });
    expect(receipt.archive).toMatchObject({
      sourcePath: "source",
      archivePath: "backups/grocy-backup-20260422171000.grocy-backup.enc",
      fileCount: 3,
      totalBytes: 476,
      restoreTestStatus: "verified",
    });
    expect(receipt.artifacts).toEqual({
      manifestPath: "data/grocy-backup-manifest.json",
      restorePlanReportPath: "data/grocy-backup-restore-plan-dry-run-report.json",
      restoreDrillReportPath: "data/grocy-backup-restore-drill-report.json",
    });
    expect(readReceiptJson(outputPath)).toMatchObject({
      kind: "grocy_backup_integrity_receipt",
      summary: { status: "pass", checkCount: 4, passedCount: 4 },
    });
  });

  it("verifies a stored receipt against the current manifest and proof artifacts", () => {
    const baseDir = setupFixtureBackupBase("grocy-backup-receipt-verify-");
    const report = createGrocyBackupRestoreDrillReport(baseDir, {
      restoreDir: path.join("restore", "fixture-check"),
      generatedAt: "2026-04-22T17:20:00.000Z",
      createdAt: "2026-04-22T17:20:00.000Z",
    });
    recordGrocyBackupRestoreDrillReport(report, { baseDir });
    recordGrocyBackupIntegrityReceipt(createGrocyBackupIntegrityReceipt(baseDir), { baseDir });

    const verification = verifyGrocyBackupIntegrityReceipt(baseDir);

    expect(verification.summary).toEqual({
      status: "pass",
      checkCount: 6,
      passedCount: 6,
    });
    expect(verification.checks.map((check) => check.id)).toEqual([
      "receipt_schema_valid",
      "receipt_signature_valid",
      "archive_record_present",
      "archive_verification_passed",
      "restore_plan_reviewed",
      "restore_drill_verified",
    ]);
  });

  it("fails verification when the stored receipt no longer matches the manifest evidence", () => {
    const baseDir = setupFixtureBackupBase("grocy-backup-receipt-stale-");
    const report = createGrocyBackupRestoreDrillReport(baseDir, {
      restoreDir: path.join("restore", "fixture-check"),
      generatedAt: "2026-04-22T17:30:00.000Z",
      createdAt: "2026-04-22T17:30:00.000Z",
    });
    recordGrocyBackupRestoreDrillReport(report, { baseDir });
    const receiptPath = recordGrocyBackupIntegrityReceipt(createGrocyBackupIntegrityReceipt(baseDir), { baseDir });
    const staleReceipt = GrocyBackupIntegrityReceiptSchema.parse(JSON.parse(fs.readFileSync(receiptPath, "utf8")) as unknown);
    staleReceipt.archive.checksumSha256 = "0".repeat(64);
    fs.writeFileSync(receiptPath, `${JSON.stringify(staleReceipt, null, 2)}\n`, "utf8");

    const verification = verifyGrocyBackupIntegrityReceipt(baseDir);
    const archiveRecordCheck = verification.checks.find((check) => check.id === "archive_record_present");

    expect(verification.summary.status).toBe("fail");
    expect(archiveRecordCheck?.status).toBe("fail");
    expect(archiveRecordCheck?.message).toContain("does not match");
  });

  it("returns a failing verification check when the archive is no longer readable", () => {
    const baseDir = setupFixtureBackupBase("grocy-backup-receipt-corrupt-");
    const report = createGrocyBackupRestoreDrillReport(baseDir, {
      restoreDir: path.join("restore", "fixture-check"),
      generatedAt: "2026-04-22T17:32:00.000Z",
      createdAt: "2026-04-22T17:32:00.000Z",
    });
    recordGrocyBackupRestoreDrillReport(report, { baseDir });
    const receipt = createGrocyBackupIntegrityReceipt(baseDir);
    recordGrocyBackupIntegrityReceipt(receipt, { baseDir });
    fs.writeFileSync(path.join(baseDir, receipt.archive.archivePath), "not valid", "utf8");

    const verification = verifyGrocyBackupIntegrityReceipt(baseDir);
    const archiveVerificationCheck = verification.checks.find((check) => check.id === "archive_verification_passed");

    expect(verification.summary.status).toBe("fail");
    expect(archiveVerificationCheck?.status).toBe("fail");
    expect(archiveVerificationCheck?.message).toContain("Archive verification failed");
  });
});

describe("Grocy backup integrity receipt CLI and examples", () => {
  it("returns a failing verification check when referenced proof artifacts are missing", () => {
    expectMissingProofArtifactVerification();
  });

  it("emits the backup integrity receipt from the CLI", () => {
    expectReceiptEmitterCliOutput();
  });

  it("emits the receipt verifier result from the CLI", () => {
    expectReceiptVerifierCliOutput();
  });

  it("writes the receipt verifier result to an output artifact when requested", () => {
    expectReceiptVerifierCliOutputFile();
  });

  it("emits and verifies receipts from a non-default backup config path", () => {
    expectCustomConfigReceiptCliOutput();
  });

  it("keeps the public example receipt fixtures schema-valid", () => {
    const receiptExample = JSON.parse(fs.readFileSync(path.join(process.cwd(), "examples", "grocy-backup-integrity-receipt.example.json"), "utf8")) as unknown;
    const verificationExample = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "grocy-backup-integrity-receipt-verification.example.json"), "utf8"),
    ) as unknown;

    expect(GrocyBackupIntegrityReceiptSchema.parse(receiptExample)).toMatchObject({
      kind: "grocy_backup_integrity_receipt",
      signature: { algorithm: "hmac-sha256", keySource: "backup_passphrase_env" },
      summary: { status: "pass", checkCount: 4, passedCount: 4 },
    });
    expect(GrocyBackupIntegrityReceiptVerificationSchema.parse(verificationExample)).toMatchObject({
      kind: "grocy_backup_integrity_receipt_verification",
      summary: { status: "pass", checkCount: 6, passedCount: 6 },
    });
  });
});
