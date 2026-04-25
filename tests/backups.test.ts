import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GrocyBackupVerificationReportSchema } from "../src/backup-verification-schema.js";
import {
  createGrocyBackupVerificationReport,
  GROCY_BACKUP_VERIFICATION_REPORT_PATH,
  recordGrocyBackupVerificationReport,
} from "../src/backup-verification-report.js";
import {
  createGrocyBackupRestorePlanDryRunReport,
  createGrocyBackupSnapshot,
  GrocyBackupRestoreError,
  recordGrocyBackupRestorePlanDryRunReport,
  verifyGrocyBackupSnapshot,
} from "../src/backups.js";

const envName = "GROCY_TEST_BACKUP_PASSPHRASE";
const fixtureSourcePath = path.resolve("examples", "synthetic-grocy-backup-source");

afterEach(() => {
  delete process.env[envName];
});

function setupBackupBase(): string {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-backup-"));
  fs.mkdirSync(path.join(baseDir, "source"), { recursive: true });
  fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
  fs.writeFileSync(path.join(baseDir, "source", "config.php"), "<?php return [];\n", "utf8");
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
  return baseDir;
}

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

function setBackupPassphrase(passphrase: string): void {
  process.env[envName] = passphrase;
}

function setupFixtureBackupBase(prefix: string): {
  baseDir: string;
  sourceContents: Record<string, string>;
  sourceFileCount: number;
} {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.cpSync(fixtureSourcePath, path.join(baseDir, "source"), { recursive: true });
  writeBackupConfig(baseDir);
  const sourceContents = readTreeContents(path.join(baseDir, "source"));
  return {
    baseDir,
    sourceContents,
    sourceFileCount: Object.keys(sourceContents).length,
  };
}

function readTreeContents(rootPath: string): Record<string, string> {
  const entries: Record<string, string> = {};
  function walk(currentPath: string): void {
    const stat = fs.statSync(currentPath);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(currentPath).sort()) {
        walk(path.join(currentPath, child));
      }
      return;
    }
    entries[path.relative(rootPath, currentPath).replace(/\\/g, "/")] = fs.readFileSync(currentPath, "utf8");
  }
  walk(rootPath);
  return entries;
}

function readRestoreState(baseDir: string): { restoreTestStatus: string; restoreFailureCategory?: string } {
  const manifest = JSON.parse(fs.readFileSync(path.join(baseDir, "data", "grocy-backup-manifest.json"), "utf8")) as {
    records: Array<{ restoreTestStatus: string; restoreFailureCategory?: string }>;
  };
  return manifest.records[0];
}

function expectRecordedRestorePlanReport(baseDir: string, sourceFileCount: number): void {
  const outputPath = path.join(baseDir, "data", "grocy-backup-restore-plan-dry-run-report.json");
  expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-backup-restore-plan-dry-run-report.json"));
  expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
    kind: "grocy_backup_restore_plan_dry_run_report",
    summary: {
      result: "ready",
      fileCount: sourceFileCount,
      wouldOverwrite: 1,
    },
  });
}

function expectVerifiedFixtureRestore(params: {
  baseDir: string;
  sourceContents: Record<string, string>;
  sourceFileCount: number;
  record: { fileCount: number; totalBytes: number; archivePath: string };
  verification: { checksumVerified: boolean; fileCount: number; restoredTo?: string };
}): void {
  const { baseDir, sourceContents, sourceFileCount, record, verification } = params;
  const expectedBytes = Object.values(sourceContents).reduce((sum, content) => sum + Buffer.byteLength(content, "utf8"), 0);
  const archiveText = fs.readFileSync(record.archivePath, "utf8");
  expect(record.fileCount).toBe(sourceFileCount);
  expect(record.totalBytes).toBe(expectedBytes);
  expect(archiveText).toContain("grocy_backup_archive");
  expect(archiveText).not.toContain("Example oats");
  expect(archiveText).not.toContain("FEATURE_FLAG_SYNTHETIC_FIXTURE");
  expect(verification.checksumVerified).toBe(true);
  expect(verification.fileCount).toBe(sourceFileCount);
  expect(verification.restoredTo).toBe(path.join(baseDir, "restore"));
  expect(readTreeContents(path.join(baseDir, "restore"))).toEqual(sourceContents);
  const manifest = JSON.parse(fs.readFileSync(path.join(baseDir, "data", "grocy-backup-manifest.json"), "utf8")) as {
    records: Array<{ restoreTestStatus: string; restoreTestedAt?: string }>;
  };
  expect(manifest.records[0].restoreTestStatus).toBe("verified");
  expect(manifest.records[0].restoreTestedAt).toBeDefined();
}

function expectRestorePlanReport(params: {
  baseDir: string;
  sourceFileCount: number;
  report: ReturnType<typeof createGrocyBackupRestorePlanDryRunReport>;
  existingRestorePath: string;
}): void {
  const { baseDir, sourceFileCount, report, existingRestorePath } = params;
  expect(report.summary).toEqual({
    result: "ready",
    checksumVerified: true,
    fileCount: sourceFileCount,
    totalBytes: report.items.reduce((sum, item) => sum + item.size, 0),
    wouldCreate: sourceFileCount - 1,
    wouldOverwrite: 1,
    blocked: 0,
  });
  expect(report.items.map((item) => `${item.action}:${item.path}`)).toContain("would_overwrite:config.php");
  expect(report.items.filter((item) => item.action === "would_create")).toHaveLength(sourceFileCount - 1);
  expect(fs.readFileSync(existingRestorePath, "utf8")).toBe("<?php return ['old' => true];\n");
  expectRecordedRestorePlanReport(baseDir, sourceFileCount);
}

function expectVerificationReport(baseDir: string, sourceFileCount: number): void {
  const report = createGrocyBackupVerificationReport(baseDir, {
    generatedAt: "2026-04-19T10:17:00.000Z",
  });
  const outputPath = recordGrocyBackupVerificationReport(report, { baseDir });

  expect(path.relative(baseDir, outputPath)).toBe(GROCY_BACKUP_VERIFICATION_REPORT_PATH);
  expect(report).toMatchObject({
    kind: "grocy_backup_verification_report",
    verification: {
      command: "npm run grocy:backup:verify",
      status: "pass",
      checksumVerified: true,
      fileCount: sourceFileCount,
    },
  });
  expect(GrocyBackupVerificationReportSchema.parse(JSON.parse(fs.readFileSync(outputPath, "utf8")))).toMatchObject({
    kind: "grocy_backup_verification_report",
    verification: { status: "pass", fileCount: sourceFileCount },
  });
}

function expectBackupVerifyCliOutputFile(baseDir: string, sourceFileCount: number): void {
  const nodeCommand = process.execPath;
  const cliEntrypoint = path.join(process.cwd(), "src", "cli.ts");
  const stdout = execFileSync(nodeCommand, [
    path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"),
    cliEntrypoint,
    "grocy:backup:verify",
    "--output",
    GROCY_BACKUP_VERIFICATION_REPORT_PATH,
    "--force",
  ], {
    cwd: baseDir,
    encoding: "utf8",
    env: { ...process.env, [envName]: "synthetic-passphrase" },
  });

  expect(JSON.parse(stdout)).toMatchObject({
    outputPath: path.join(baseDir, GROCY_BACKUP_VERIFICATION_REPORT_PATH),
    verification: {
      status: "pass",
      checksumVerified: true,
      fileCount: sourceFileCount,
    },
  });
  expect(JSON.parse(fs.readFileSync(path.join(baseDir, GROCY_BACKUP_VERIFICATION_REPORT_PATH), "utf8"))).toMatchObject({
    kind: "grocy_backup_verification_report",
    verification: {
      status: "pass",
      checksumVerified: true,
      fileCount: sourceFileCount,
    },
  });
}

function expectWrongPassphraseFailure(baseDir: string): void {
  setBackupPassphrase("synthetic-passphrase-rotated");
  expect(() => verifyGrocyBackupSnapshot(baseDir)).toThrow("could not be decrypted");
  expect(readRestoreState(baseDir)).toMatchObject({
    restoreTestStatus: "failed",
    restoreFailureCategory: "archive_decryption_failed",
  });
}

function expectRecoveredVerification(baseDir: string): void {
  setBackupPassphrase("synthetic-passphrase");
  expect(verifyGrocyBackupSnapshot(baseDir).checksumVerified).toBe(true);
}

describe("Grocy backups", () => {
  it("creates and verifies encrypted backup archives", () => {
    const baseDir = setupBackupBase();

    const record = createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:00:00.000Z",
    });
    const verification = verifyGrocyBackupSnapshot(baseDir);

    expect(fs.existsSync(record.archivePath)).toBe(true);
    expect(verification.checksumVerified).toBe(true);
    expect(verification.fileCount).toBe(1);
  });

  it("snapshots, verifies, and restores the public synthetic encrypted fixture loop", () => {
    const { baseDir, sourceContents, sourceFileCount } = setupFixtureBackupBase("grocy-backup-fixture-");
    const record = createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:10:00.000Z",
    });
    const verification = verifyGrocyBackupSnapshot(baseDir, {
      restoreDir: "restore",
      confirmRestoreWrite: true,
    });
    expectVerifiedFixtureRestore({ baseDir, sourceContents, sourceFileCount, record, verification });
  });

  it("creates a no-write restore plan dry-run report for the synthetic fixture loop", () => {
    const { baseDir, sourceFileCount } = setupFixtureBackupBase("grocy-backup-restore-plan-");
    createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:15:00.000Z",
    });

    const existingRestorePath = path.join(baseDir, "restore", "config.php");
    fs.mkdirSync(path.dirname(existingRestorePath), { recursive: true });
    fs.writeFileSync(existingRestorePath, "<?php return ['old' => true];\n", "utf8");

    const report = createGrocyBackupRestorePlanDryRunReport(baseDir, {
      restoreDir: path.join("restore"),
      generatedAt: "2026-04-19T10:16:00.000Z",
    });
    recordGrocyBackupRestorePlanDryRunReport(report, { baseDir });
    expectRestorePlanReport({ baseDir, sourceFileCount, report, existingRestorePath });
  });

  it("records a public-safe encrypted backup verification report", () => {
    const { baseDir, sourceFileCount } = setupFixtureBackupBase("grocy-backup-verify-report-");
    createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:16:00.000Z",
    });

    expectVerificationReport(baseDir, sourceFileCount);
  });

  it("writes the encrypted backup verifier CLI result to an output artifact when requested", () => {
    const { baseDir, sourceFileCount } = setupFixtureBackupBase("grocy-backup-verify-cli-");
    createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:17:00.000Z",
    });

    expectBackupVerifyCliOutputFile(baseDir, sourceFileCount);
  });

  it("keeps the public backup verification example fixture schema-valid", () => {
    const verificationExample = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "grocy-backup-verification-report.example.json"), "utf8"),
    ) as unknown;

    expect(GrocyBackupVerificationReportSchema.parse(verificationExample)).toMatchObject({
      kind: "grocy_backup_verification_report",
      verification: { status: "pass", checksumVerified: true, fileCount: 3 },
    });
  });
});

describe("Grocy backup failure handling", () => {
  it("rejects invalid archives during verification", () => {
    const baseDir = setupBackupBase();
    const record = createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:00:00.000Z",
    });
    fs.writeFileSync(record.archivePath, "not valid", "utf8");

    let thrown: unknown;
    try {
      verifyGrocyBackupSnapshot(baseDir);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(GrocyBackupRestoreError);
    expect(thrown).toMatchObject({
      category: "archive_unreadable",
      message: "Grocy backup archive could not be read as JSON.",
    });
    expect(readRestoreState(baseDir)).toMatchObject({
      restoreTestStatus: "failed",
      restoreFailureCategory: "archive_unreadable",
    });
  });

  it("rejects archives whose manifest checksum does not match", () => {
    const baseDir = setupBackupBase();
    createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:00:00.000Z",
    });
    const manifestPath = path.join(baseDir, "data", "grocy-backup-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { records: Array<{ checksumSha256: string }> };
    manifest.records[0].checksumSha256 = "0".repeat(64);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    expect(() => verifyGrocyBackupSnapshot(baseDir)).toThrow("checksum verification failed");
    expect(readRestoreState(baseDir)).toMatchObject({
      restoreTestStatus: "failed",
      restoreFailureCategory: "manifest_checksum_mismatch",
    });
  });

  it("records archive_decryption_failed when verification uses the wrong passphrase", () => {
    const baseDir = setupBackupBase();
    createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:00:00.000Z",
    });
    expectWrongPassphraseFailure(baseDir);
    expectRecoveredVerification(baseDir);
  });

  it("requires confirmation before writing restore files", () => {
    const baseDir = setupBackupBase();
    createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:00:00.000Z",
    });

    expect(() => verifyGrocyBackupSnapshot(baseDir, { restoreDir: "restore" })).toThrow("confirm-restore-write");
    expect(readRestoreState(baseDir)).toMatchObject({
      restoreTestStatus: "failed",
      restoreFailureCategory: "restore_write_unconfirmed",
    });
  });
});

describe("Grocy backup custom layouts", () => {
  it("uses caller-provided config and manifest paths for custom repo layouts", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-backup-custom-layout-"));
    fs.mkdirSync(path.join(baseDir, "source"), { recursive: true });
    fs.mkdirSync(path.join(baseDir, "private-config"), { recursive: true });
    fs.writeFileSync(path.join(baseDir, "source", "config.php"), "<?php return [];\n", "utf8");
    fs.writeFileSync(
      path.join(baseDir, "private-config", "grocy-backup.local.json"),
      JSON.stringify({
        sourcePath: "source",
        backupDir: "backups",
        passphraseEnv: envName,
      }),
      "utf8",
    );
    process.env[envName] = "synthetic-passphrase";

    const record = createGrocyBackupSnapshot(baseDir, {
      createdAt: "2026-04-19T10:00:00.000Z",
      configPath: path.join("private-config", "grocy-backup.local.json"),
      manifestPath: path.join("manifests", "grocy-backup-manifest.json"),
    });

    expect(record.manifestPath).toBe(path.join(baseDir, "manifests", "grocy-backup-manifest.json"));
    expect(
      verifyGrocyBackupSnapshot(baseDir, {
        configPath: path.join("private-config", "grocy-backup.local.json"),
        manifestPath: path.join("manifests", "grocy-backup-manifest.json"),
      }).checksumVerified,
    ).toBe(true);
  });
});
