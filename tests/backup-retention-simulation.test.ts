import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GROCY_BACKUP_RETENTION_SIMULATION_REPORT_PATH,
  createGrocyBackupRetentionSimulationReport,
  recordGrocyBackupRetentionSimulationReport,
} from "../src/backup-retention-simulation.js";
import {
  GrocyBackupRetentionHistorySchema,
  GrocyBackupRetentionSimulationReportSchema,
} from "../src/backup-retention-simulation-schema.js";

const retentionHistoryExamplePath = path.join(
  process.cwd(),
  "examples",
  "grocy-backup-retention-history.example.json",
);
const retentionSimulationExamplePath = path.join(
  process.cwd(),
  "examples",
  "grocy-backup-retention-simulation-report.example.json",
);

function createTempBaseDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeHistoryFixture(baseDir: string): string {
  const historyPath = path.join(baseDir, "data", "synthetic-history.json");
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.copyFileSync(retentionHistoryExamplePath, historyPath);
  return historyPath;
}

describe("Grocy backup retention simulation", () => {
  it("applies the synthetic retention policy and summarizes retained footprint and cost", () => {
    const baseDir = createTempBaseDir("grocy-backup-retention-");
    const historyPath = writeHistoryFixture(baseDir);

    const report = createGrocyBackupRetentionSimulationReport(baseDir, {
      historyPath: path.relative(baseDir, historyPath),
      generatedAt: "2026-04-25T08:00:00.000Z",
    });

    expect(report.historyPath).toBe("data/synthetic-history.json");
    expect(report.summary).toEqual({
      snapshotCount: 10,
      retainedSnapshotCount: 6,
      expiredSnapshotCount: 4,
      retainedStoredBytes: 718274560,
      retainedLogicalBytes: 6538919936,
      peakRetainedStoredBytes: 718274560,
      estimatedMonthlyCost: 0.1672,
      estimatedAnnualCost: 2.0064,
    });
    expect(report.retainedSnapshots.map((snapshot) => `${snapshot.id}:${snapshot.retainedBy.join("+")}`)).toEqual([
      "snap-2026-04-25-0800:daily+hourly+latest+monthly+weekly",
      "snap-2026-04-25-0200:hourly",
      "snap-2026-04-24-0800:daily",
      "snap-2026-04-18-0800:weekly",
      "snap-2026-04-11-0800:weekly",
      "snap-2026-03-28-0800:monthly",
    ]);
    expect(report.expiredSnapshots.map((snapshot) => snapshot.id)).toEqual([
      "snap-2026-04-23-0800",
      "snap-2026-04-04-0800",
      "snap-2026-03-01-0800",
      "snap-2026-02-01-0800",
    ]);
    expect(report.timeline.at(-1)).toEqual({
      evaluatedAt: "2026-04-25T08:00:00.000Z",
      snapshotId: "snap-2026-04-25-0800",
      retainedSnapshotCount: 6,
      retainedStoredBytes: 718274560,
      retainedLogicalBytes: 6538919936,
      estimatedMonthlyCost: 0.1672,
    });
  });

  it("records the report to the conventional data path", () => {
    const baseDir = createTempBaseDir("grocy-backup-retention-record-");
    const historyPath = writeHistoryFixture(baseDir);
    const report = createGrocyBackupRetentionSimulationReport(baseDir, {
      historyPath: path.relative(baseDir, historyPath),
      generatedAt: "2026-04-25T08:00:00.000Z",
    });

    const outputPath = recordGrocyBackupRetentionSimulationReport(report, { baseDir });

    expect(path.relative(baseDir, outputPath)).toBe(GROCY_BACKUP_RETENTION_SIMULATION_REPORT_PATH);
    expect(
      GrocyBackupRetentionSimulationReportSchema.parse(JSON.parse(fs.readFileSync(outputPath, "utf8"))),
    ).toMatchObject({
      kind: "grocy_backup_retention_simulation_report",
      summary: { retainedSnapshotCount: 6, expiredSnapshotCount: 4 },
    });
  });

  it("writes the CLI simulation artifact from a synthetic history file", () => {
    const baseDir = createTempBaseDir("grocy-backup-retention-cli-");
    writeHistoryFixture(baseDir);
    const nodeCommand = process.execPath;
    const cliEntrypoint = path.join(process.cwd(), "src", "cli.ts");
    const stdout = execFileSync(nodeCommand, [
      path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"),
      cliEntrypoint,
      "grocy:backup:retention-simulate",
      "--history",
      "data/synthetic-history.json",
      "--output",
      "data/simulated-retention.json",
      "--force",
    ], {
      cwd: baseDir,
      encoding: "utf8",
    });

    expect(JSON.parse(stdout)).toMatchObject({
      outputPath: path.join(baseDir, "data", "simulated-retention.json"),
      summary: { retainedSnapshotCount: 6, estimatedMonthlyCost: 0.1672 },
    });
    expect(
      GrocyBackupRetentionSimulationReportSchema.parse(
        JSON.parse(fs.readFileSync(path.join(baseDir, "data", "simulated-retention.json"), "utf8")),
      ),
    ).toMatchObject({
      kind: "grocy_backup_retention_simulation_report",
      summary: { retainedStoredBytes: 718274560 },
    });
  });

  it("keeps the public retention history and report examples schema-valid", () => {
    const historyExample = GrocyBackupRetentionHistorySchema.parse(
      JSON.parse(fs.readFileSync(retentionHistoryExamplePath, "utf8")) as unknown,
    );
    const reportExample = GrocyBackupRetentionSimulationReportSchema.parse(
      JSON.parse(fs.readFileSync(retentionSimulationExamplePath, "utf8")) as unknown,
    );

    expect(historyExample).toMatchObject({
      kind: "grocy_backup_retention_history",
      scope: "synthetic_fixture_only",
      policy: { hourly: 2, daily: 2, weekly: 3, monthly: 2 },
    });
    expect(reportExample).toMatchObject({
      kind: "grocy_backup_retention_simulation_report",
      summary: { retainedSnapshotCount: 6, expiredSnapshotCount: 4 },
    });
  });
});
