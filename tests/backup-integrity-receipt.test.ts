import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  createGrocyBackupIntegrityReceipt,
  GROCY_BACKUP_INTEGRITY_RECEIPT_PATH,
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

function writeBackupConfig(baseDir: string): void {
  fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "config", "grocy-backup.local.json"),
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

function setupFixtureBackupBase(prefix: string): string {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.cpSync(fixtureSourcePath, path.join(baseDir, "source"), { recursive: true });
  writeBackupConfig(baseDir);
  return baseDir;
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

  expect(verification.summary.status).toBe("fail");
  expect(verification.checks).toContainEqual({ id: "restore_plan_reviewed", status: "fail", message: expect.stringContaining("Expected proof artifact is missing") });
}

function expectReceiptVerifierCliOutput(): void {
  const baseDir = setupFixtureBackupBase("grocy-backup-receipt-cli-");
  createRestorePlanFixture(baseDir, "2026-04-22T17:40:00.000Z", "2026-04-22T17:41:00.000Z", path.join("restore", "cli-check"));
  recordGrocyBackupIntegrityReceipt(createGrocyBackupIntegrityReceipt(baseDir), { baseDir });

  const nodeCommand = process.execPath;
  const cliEntrypoint = path.join(process.cwd(), "src", "cli.ts");
  const stdout = execFileSync(nodeCommand, [path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), cliEntrypoint, "grocy:backup:receipt:verify"], {
    cwd: baseDir,
    encoding: "utf8",
    env: { ...process.env, [envName]: "synthetic-passphrase" },
  });

  expect(JSON.parse(stdout)).toMatchObject({
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
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
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
      checkCount: 5,
      passedCount: 5,
    });
    expect(verification.checks.map((check) => check.id)).toEqual([
      "receipt_schema_valid",
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
    const staleReceipt = JSON.parse(fs.readFileSync(receiptPath, "utf8")) as {
      archive: { checksumSha256: string };
    };
    staleReceipt.archive.checksumSha256 = "0".repeat(64);
    fs.writeFileSync(receiptPath, `${JSON.stringify(staleReceipt, null, 2)}\n`, "utf8");

    const verification = verifyGrocyBackupIntegrityReceipt(baseDir);

    expect(verification.summary.status).toBe("fail");
    expect(verification.checks).toContainEqual({
      id: "archive_record_present",
      status: "fail",
      message: expect.stringContaining("does not match"),
    });
  });

  it("returns a failing verification check when referenced proof artifacts are missing", () => {
    expectMissingProofArtifactVerification();
  });

  it("emits the receipt verifier result from the CLI", () => {
    expectReceiptVerifierCliOutput();
  });

  it("keeps the public example receipt fixtures schema-valid", () => {
    const receiptExample = JSON.parse(fs.readFileSync(path.join(process.cwd(), "examples", "grocy-backup-integrity-receipt.example.json"), "utf8")) as unknown;
    const verificationExample = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "grocy-backup-integrity-receipt-verification.example.json"), "utf8"),
    ) as unknown;

    expect(GrocyBackupIntegrityReceiptSchema.parse(receiptExample)).toMatchObject({
      kind: "grocy_backup_integrity_receipt",
      summary: { status: "pass", checkCount: 4, passedCount: 4 },
    });
    expect(GrocyBackupIntegrityReceiptVerificationSchema.parse(verificationExample)).toMatchObject({
      kind: "grocy_backup_integrity_receipt_verification",
      summary: { status: "pass", checkCount: 5, passedCount: 5 },
    });
  });
});
