import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const walkthroughPath = path.join(repoRoot, "docs", "fixture-only-restore-drill-walkthrough.md");
const fixtureSourcePath = path.join(repoRoot, "examples", "synthetic-grocy-backup-source");
const backupConfigExamplePath = path.join(repoRoot, "examples", "grocy-backup.local.example.json");

const envName = "GROCY_TEST_FIXTURE_ONLY_RESTORE_DRILL_PASSPHRASE";

function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function extractValidationScript(walkthrough: string): string {
  const match = walkthrough.match(/node --input-type=module -e "([^"]+)"/);
  if (!match) {
    throw new Error("Walkthrough validation command not found.");
  }
  return match[1];
}

function setupFixtureDrillBaseDir(): string {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-fixture-restore-walkthrough-"));
  fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
  fs.cpSync(fixtureSourcePath, path.join(baseDir, "examples", "synthetic-grocy-backup-source"), { recursive: true });

  const config = JSON.parse(readText(backupConfigExamplePath)) as Record<string, unknown>;
  fs.writeFileSync(
    path.join(baseDir, "config", "grocy-backup.local.json"),
    `${JSON.stringify({ ...config, passphraseEnv: envName }, null, 2)}\n`,
    "utf8",
  );
  return baseDir;
}

function runFixtureOnlyRestoreDrill(baseDir: string): void {
  const nodeCommand = process.execPath;
  const cliEntrypoint = path.join(repoRoot, "src", "cli.ts");
  const tsxEntrypoint = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

  execFileSync(nodeCommand, [tsxEntrypoint, cliEntrypoint, "grocy:backup:restore-drill", "--restore-dir", "restore/fixture-only-restore-drill", "--output", "data/fixture-only-restore-drill-report.json", "--force"], {
    cwd: baseDir,
    encoding: "utf8",
    env: { ...process.env, [envName]: "synthetic-restore-drill-passphrase" },
  });
}

afterEach(() => {
  delete process.env[envName];
});

describe("Fixture-only restore drill walkthrough", () => {
  it("documents a machine-checkable validation command for the generated report", () => {
    const walkthrough = readText(walkthroughPath);

    expect(fs.existsSync(walkthroughPath)).toBe(true);
    expect(walkthrough).toContain("## Validate The Artifact");
    expect(walkthrough).toContain("node --input-type=module -e");
    expect(walkthrough).toContain("data/fixture-only-restore-drill-report.json");
    expect(walkthrough).toContain("Restore drill checkpoints validated.");
    expect(walkthrough).toContain("report.scope !== 'synthetic_fixture_only'");
    expect(walkthrough).toContain("report.summary?.wouldOverwrite !== 0");
    expect(walkthrough).toContain("checkpoint.status === 'pass'");
    expect(walkthrough).toContain("report.artifacts?.manifestPath === 'data/grocy-backup-manifest.json'");
    expect(walkthrough).toContain("report.checkpoints?.[2]?.artifactPath === 'restore/fixture-only-restore-drill'");
    expect(walkthrough).toContain("snapshot_created");
    expect(walkthrough).toContain("restore_plan_ready");
    expect(walkthrough).toContain("restore_verification_succeeded");
  });

  it("keeps the documented validation gate executable against the fixture-only restore drill output", () => {
    const walkthrough = readText(walkthroughPath);
    const validationScript = extractValidationScript(walkthrough);
    const baseDir = setupFixtureDrillBaseDir();

    runFixtureOnlyRestoreDrill(baseDir);

    const stdout = execFileSync(process.execPath, ["--input-type=module", "-e", validationScript], {
      cwd: baseDir,
      encoding: "utf8",
    });

    expect(stdout.trim()).toBe("Restore drill checkpoints validated.");
    expect(JSON.parse(readText(path.join(baseDir, "data", "fixture-only-restore-drill-report.json")))).toMatchObject({
      scope: "synthetic_fixture_only",
      summary: {
        result: "pass",
        checkpointCount: 3,
        passedCount: 3,
        wouldOverwrite: 0,
      },
      checkpoints: [
        { id: "snapshot_created", status: "pass", artifactPath: "data/grocy-backup-manifest.json" },
        { id: "restore_plan_ready", status: "pass", artifactPath: "data/grocy-backup-restore-plan-dry-run-report.json" },
        { id: "restore_verification_succeeded", status: "pass", artifactPath: "restore/fixture-only-restore-drill" },
      ],
      artifacts: {
        manifestPath: "data/grocy-backup-manifest.json",
        restorePlanReportPath: "data/grocy-backup-restore-plan-dry-run-report.json",
      },
    });
  });
});
