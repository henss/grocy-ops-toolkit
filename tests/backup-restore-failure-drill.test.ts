import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  createGrocyBackupRestoreFailureDrillReport,
  DEFAULT_GROCY_BACKUP_RESTORE_FAILURE_DRILL_DIR,
  recordGrocyBackupRestoreFailureDrillReport,
} from "../src/backup-restore-failure-drill.js";
import { GrocyBackupRestoreFailureDrillReportSchema } from "../src/backup-restore-failure-drill-schema.js";

const envName = "GROCY_TEST_RESTORE_FAILURE_DRILL_PASSPHRASE";
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

describe("Grocy backup restore failure drill", () => {
  it("creates a fixture-only failure drill report for corruption, wrong passphrase, and path escape", () => {
    const baseDir = setupFixtureBackupBase("grocy-restore-failure-drill-");
    const report = createGrocyBackupRestoreFailureDrillReport(baseDir, {
      restoreDir: path.join("restore", "failure-check"),
      generatedAt: "2026-04-25T09:15:00.000Z",
    });
    const outputPath = recordGrocyBackupRestoreFailureDrillReport(report, { baseDir });
    const manifest = JSON.parse(fs.readFileSync(path.join(baseDir, "data", "grocy-backup-manifest.json"), "utf8")) as {
      records: Array<{ restoreFailureCategory?: string }>;
    };

    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-backup-restore-failure-drill-report.json"));
    expect(report.summary).toEqual({
      result: "pass",
      scenarioCount: 3,
      passedCount: 3,
    });
    expect(report.scenarios.map((scenario) => scenario.id)).toEqual([
      "corruption_detected",
      "wrong_passphrase_rejected",
      "path_escape_blocked",
    ]);
    expect(report.scenarios.map((scenario) => scenario.observedFailureCategory)).toEqual([
      "manifest_checksum_mismatch",
      "archive_decryption_failed",
      "restore_path_escape",
    ]);
    expect(report.scenarios.every((scenario) => scenario.status === "pass")).toBe(true);
    expect(report.restoreDir).toBe("restore/failure-check");
    expect(report.artifacts).toEqual({
      manifestPath: "data/grocy-backup-manifest.json",
    });
    expect(manifest.records.map((record) => record.restoreFailureCategory)).toEqual([
      "restore_path_escape",
      "archive_decryption_failed",
      "manifest_checksum_mismatch",
    ]);
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_backup_restore_failure_drill_report",
      summary: { result: "pass", scenarioCount: 3 },
    });
  });

  it("emits the failure drill artifact from the CLI with the default restore directory", () => {
    const baseDir = setupFixtureBackupBase("grocy-restore-failure-drill-cli-");
    const nodeCommand = process.execPath;
    const cliEntrypoint = path.join(process.cwd(), "src", "cli.ts");

    const stdout = execFileSync(nodeCommand, [path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), cliEntrypoint, "grocy:backup:restore-failure-drill"], {
      cwd: baseDir,
      encoding: "utf8",
      env: { ...process.env, [envName]: "synthetic-passphrase" },
    });

    expect(JSON.parse(stdout)).toMatchObject({
      outputPath: expect.stringContaining(path.join("data", "grocy-backup-restore-failure-drill-report.json")),
      summary: { result: "pass", scenarioCount: 3 },
    });
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, "data", "grocy-backup-restore-failure-drill-report.json"), "utf8"))).toMatchObject({
      kind: "grocy_backup_restore_failure_drill_report",
      restoreDir: DEFAULT_GROCY_BACKUP_RESTORE_FAILURE_DRILL_DIR.replace(/\\/g, "/"),
      summary: { result: "pass", scenarioCount: 3 },
    });
  });

  it("keeps the public example restore failure drill fixture schema-valid", () => {
    const example = JSON.parse(fs.readFileSync(path.join(process.cwd(), "examples", "grocy-backup-restore-failure-drill-report.example.json"), "utf8")) as unknown;

    expect(GrocyBackupRestoreFailureDrillReportSchema.parse(example)).toMatchObject({
      kind: "grocy_backup_restore_failure_drill_report",
      scope: "synthetic_fixture_only",
      summary: { result: "pass", scenarioCount: 3, passedCount: 3 },
    });
  });
});
