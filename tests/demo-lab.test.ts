import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createGrocyDemoEnvironment,
  GROCY_DEMO_APPLY_DRY_RUN_PATH,
  GROCY_DEMO_BACKUP_INTEGRITY_RECEIPT_PATH,
  GROCY_DEMO_BACKUP_MANIFEST_PATH,
  GROCY_DEMO_BACKUP_RESTORE_DRILL_PATH,
  GROCY_DEMO_CONFIG_DRIFT_TREND_PATH,
  GROCY_DEMO_CONFIG_SYNC_PLAN_PATH,
  GROCY_DEMO_DESIRED_STATE_LINT_PATH,
  GROCY_DEMO_ENVIRONMENT_PATH,
  GROCY_DEMO_HEALTH_DIAGNOSTICS_PATH,
  GROCY_DEMO_MOCK_SMOKE_RECEIPT_PATH,
  GROCY_DEMO_MOCK_SMOKE_REPORT_PATH,
  GROCY_DEMO_REDACTION_AUDIT_PATH,
  GROCY_DEMO_REVIEW_DASHBOARD_PATH,
  GROCY_DEMO_SUPPORT_BUNDLE_PATH,
  recordGrocyDemoEnvironmentReport,
} from "../src/demo-lab.js";

const repoExamplesDir = path.resolve("examples");
const cliEntrypoint = path.resolve("src", "cli.ts");
const tsxEntrypoint = path.resolve("node_modules", "tsx", "dist", "cli.mjs");

afterEach(() => {
  delete process.env.GROCY_DEMO_BACKUP_PASSPHRASE;
});

function setupDemoBase(prefix: string): string {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(baseDir, "examples"), { recursive: true });
  for (const fileName of [
    "desired-state.example.json",
    "config-export.example.json",
    "config-export.previous.example.json",
  ]) {
    fs.copyFileSync(path.join(repoExamplesDir, fileName), path.join(baseDir, "examples", fileName));
  }
  fs.cpSync(
    path.join(repoExamplesDir, "synthetic-grocy-backup-source"),
    path.join(baseDir, "examples", "synthetic-grocy-backup-source"),
    { recursive: true },
  );
  return baseDir;
}

describe("Grocy demo lab", () => {
  it("creates a one-command synthetic demo environment with shareable artifacts", async () => {
    const baseDir = setupDemoBase("grocy-demo-lab-");

    const report = await createGrocyDemoEnvironment(baseDir, {
      generatedAt: "2026-04-24T10:00:00.000Z",
    });
    const outputPath = recordGrocyDemoEnvironmentReport(report, { baseDir });

    expect(path.relative(baseDir, outputPath)).toBe(GROCY_DEMO_ENVIRONMENT_PATH);
    expect(report.summary).toEqual({
      result: "pass",
      shareability: "ready_to_share",
      artifactCount: 14,
    });
    expect(report.command.cli).toBe("npm run grocy:demo:lab");
    expect(report.environment).toMatchObject({
      syntheticOnly: true,
      backupConfigPath: "config/grocy-demo-backup.local.json",
      backupManifestPath: "backups/demo/grocy-backup-manifest.json",
      restoreDir: "restore/demo-grocy-backup-check",
    });

    for (const artifactPath of [
      GROCY_DEMO_HEALTH_DIAGNOSTICS_PATH,
      GROCY_DEMO_MOCK_SMOKE_REPORT_PATH,
      GROCY_DEMO_MOCK_SMOKE_RECEIPT_PATH,
      GROCY_DEMO_DESIRED_STATE_LINT_PATH,
      GROCY_DEMO_CONFIG_SYNC_PLAN_PATH,
      GROCY_DEMO_CONFIG_DRIFT_TREND_PATH,
      GROCY_DEMO_APPLY_DRY_RUN_PATH,
      GROCY_DEMO_BACKUP_RESTORE_DRILL_PATH,
      GROCY_DEMO_BACKUP_INTEGRITY_RECEIPT_PATH,
      GROCY_DEMO_REVIEW_DASHBOARD_PATH,
      GROCY_DEMO_REDACTION_AUDIT_PATH,
      GROCY_DEMO_SUPPORT_BUNDLE_PATH,
      GROCY_DEMO_ENVIRONMENT_PATH,
    ]) {
      expect(fs.existsSync(path.join(baseDir, artifactPath))).toBe(true);
    }

    expect(fs.existsSync(path.join(baseDir, GROCY_DEMO_BACKUP_MANIFEST_PATH))).toBe(true);

    expect(JSON.parse(fs.readFileSync(path.join(baseDir, GROCY_DEMO_REDACTION_AUDIT_PATH), "utf8"))).toMatchObject({
      summary: { result: "pass", findingCount: 0 },
    });
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, GROCY_DEMO_SUPPORT_BUNDLE_PATH), "utf8"))).toMatchObject({
      kind: "grocy_support_bundle",
      summary: { readiness: "ready_to_share", redactionFindingCount: 0 },
    });
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, GROCY_DEMO_BACKUP_INTEGRITY_RECEIPT_PATH), "utf8"))).toMatchObject({
      kind: "grocy_backup_integrity_receipt",
      summary: { status: "pass" },
      artifacts: {
        manifestPath: "backups/demo/grocy-backup-manifest.json",
      },
    });
  });

  it("runs the demo lab through the CLI", () => {
    const baseDir = setupDemoBase("grocy-demo-lab-cli-");

    const stdout = execFileSync(process.execPath, [tsxEntrypoint, cliEntrypoint, "grocy:demo:lab"], {
      cwd: baseDir,
      encoding: "utf8",
    });

    expect(JSON.parse(stdout)).toMatchObject({
      summary: { result: "pass", shareability: "ready_to_share" },
      artifacts: {
        supportBundlePath: "data/demo-support-bundle.json",
        reviewDashboardPath: "data/demo-review-dashboard.md",
      },
    });
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, GROCY_DEMO_ENVIRONMENT_PATH), "utf8"))).toMatchObject({
      kind: "grocy_demo_environment",
      summary: { result: "pass", shareability: "ready_to_share" },
    });
  });
});
