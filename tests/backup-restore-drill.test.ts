import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  createGrocyBackupRestoreDrillReport,
  DEFAULT_GROCY_BACKUP_RESTORE_DRILL_DIR,
  recordGrocyBackupRestoreDrillReport,
} from "../src/backup-restore-drill.js";
import { GrocyBackupRestoreDrillReportSchema } from "../src/schemas.js";

const envName = "GROCY_TEST_RESTORE_DRILL_PASSPHRASE";
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

function setupFixtureBackupBase(prefix: string): {
  baseDir: string;
  sourceFileCount: number;
  sourceContents: Record<string, string>;
} {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.cpSync(fixtureSourcePath, path.join(baseDir, "source"), { recursive: true });
  writeBackupConfig(baseDir);
  const sourceContents = readTreeContents(path.join(baseDir, "source"));
  return {
    baseDir,
    sourceFileCount: Object.keys(sourceContents).length,
    sourceContents,
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

describe("Grocy backup restore drill", () => {
  it("creates a fixture-only restore drill report with machine-checkable checkpoints", () => {
    const { baseDir, sourceFileCount, sourceContents } = setupFixtureBackupBase("grocy-restore-drill-");
    const report = createGrocyBackupRestoreDrillReport(baseDir, {
      restoreDir: path.join("restore", "fixture-check"),
      generatedAt: "2026-04-22T15:40:00.000Z",
      createdAt: "2026-04-22T15:40:00.000Z",
    });
    const outputPath = recordGrocyBackupRestoreDrillReport(report, { baseDir });

    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-backup-restore-drill-report.json"));
    expect(report.summary).toEqual({
      result: "pass",
      checkpointCount: 3,
      passedCount: 3,
      fileCount: sourceFileCount,
      totalBytes: Object.values(sourceContents).reduce((sum, content) => sum + Buffer.byteLength(content, "utf8"), 0),
      wouldCreate: sourceFileCount,
      wouldOverwrite: 0,
    });
    expect(report.checkpoints.map((checkpoint) => checkpoint.id)).toEqual([
      "snapshot_created",
      "restore_plan_ready",
      "restore_verification_succeeded",
    ]);
    expect(report.checkpoints.every((checkpoint) => checkpoint.status === "pass")).toBe(true);
    expect(report.checkpoints[1]).toMatchObject({
      command: "npm run grocy:backup:restore-plan -- --restore-dir restore/fixture-check",
      artifactPath: "data/grocy-backup-restore-plan-dry-run-report.json",
    });
    expect(report.checkpoints[2]).toMatchObject({
      artifactPath: "restore/fixture-check",
    });
    expect(readTreeContents(path.join(baseDir, "restore", "fixture-check"))).toEqual(sourceContents);
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, "data", "grocy-backup-manifest.json"), "utf8"))).toMatchObject({
      records: [{ restoreTestStatus: "verified" }],
    });
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, "data", "grocy-backup-restore-plan-dry-run-report.json"), "utf8"))).toMatchObject({
      kind: "grocy_backup_restore_plan_dry_run_report",
      summary: { result: "ready", fileCount: sourceFileCount, wouldCreate: sourceFileCount },
    });
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_backup_restore_drill_report",
      summary: { result: "pass", checkpointCount: 3 },
    });
  });

  it("emits the restore drill artifact from the CLI with the default restore directory", () => {
    const { baseDir } = setupFixtureBackupBase("grocy-restore-drill-cli-");
    const nodeCommand = process.execPath;
    const cliEntrypoint = path.join(process.cwd(), "src", "cli.ts");

    const stdout = execFileSync(nodeCommand, [path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), cliEntrypoint, "grocy:backup:restore-drill"], {
      cwd: baseDir,
      encoding: "utf8",
      env: { ...process.env, [envName]: "synthetic-passphrase" },
    });

    expect(JSON.parse(stdout)).toMatchObject({
      outputPath: expect.stringContaining(path.join("data", "grocy-backup-restore-drill-report.json")),
      summary: { result: "pass", checkpointCount: 3 },
    });
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, "data", "grocy-backup-restore-drill-report.json"), "utf8"))).toMatchObject({
      kind: "grocy_backup_restore_drill_report",
      restoreDir: DEFAULT_GROCY_BACKUP_RESTORE_DRILL_DIR.replace(/\\/g, "/"),
      summary: { result: "pass", checkpointCount: 3 },
    });
  });

  it("keeps the public example restore drill fixture schema-valid", () => {
    const example = JSON.parse(fs.readFileSync(path.join(process.cwd(), "examples", "grocy-backup-restore-drill-report.example.json"), "utf8")) as unknown;

    expect(GrocyBackupRestoreDrillReportSchema.parse(example)).toMatchObject({
      kind: "grocy_backup_restore_drill_report",
      scope: "synthetic_fixture_only",
      summary: { result: "pass", checkpointCount: 3, passedCount: 3 },
    });
  });
});
