import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createGrocyInstallDoctorArtifact,
  GROCY_INSTALL_DOCTOR_PATH,
  recordGrocyInstallDoctorArtifact,
  runGrocyInstallDoctor,
} from "../src/install-doctor.js";

function writeGrocyConfig(baseDir: string): void {
  fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "config", "grocy.local.json"),
    `${JSON.stringify({
      baseUrl: "https://grocy.example.test",
      apiKey: "synthetic-api-key",
      timeoutMs: 5000,
    }, null, 2)}\n`,
    "utf8",
  );
}

function writeBackupConfig(baseDir: string, sourcePath = "source"): void {
  fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "config", "grocy-backup.local.json"),
    `${JSON.stringify({
      sourcePath,
      backupDir: "backups/grocy",
      passphraseEnv: "GROCY_BACKUP_PASSPHRASE",
      locationLabel: "synthetic-local",
    }, null, 2)}\n`,
    "utf8",
  );
}

describe("Grocy install doctor", () => {
  it("reports first-run gaps with conventional next actions", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-install-doctor-missing-"));

    const artifact = runGrocyInstallDoctor(baseDir, {
      generatedAt: "2026-04-24T06:00:00.000Z",
      nodeVersion: "v20.12.0",
    });

    expect(artifact.summary).toEqual({
      status: "action_required",
      failureCount: 0,
      warningCount: 5,
      skippedCount: 1,
      passCount: 1,
    });
    expect(artifact.checks).toContainEqual({
      id: "node_version",
      status: "pass",
      code: "node_version_supported",
      message: "Node.js v20.12.0 satisfies the toolkit requirement.",
      action: "No action required.",
      evidence: [],
    });
    expect(artifact.checks).toContainEqual({
      id: "grocy_config",
      status: "warn",
      code: "grocy_config_missing",
      message: "Local Grocy config is missing at config\\grocy.local.json.",
      action: "Run npm run grocy:init:workspace to create starter local config files and conventional directories. Create config/grocy.local.json with baseUrl, apiKey, and timeoutMs before running live Grocy commands.",
      evidence: [],
    });
    expect(artifact.checks).toContainEqual({
      id: "backup_source",
      status: "skipped",
      code: "backup_source_skipped",
      message: "Backup source path check was skipped because local backup config is missing.",
      action: "Create config\\grocy-backup.local.json before running backup workflows.",
      evidence: [],
    });
  });

  it("passes when conventional directories and local configs are ready", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-install-doctor-ready-"));
    fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
    fs.mkdirSync(path.join(baseDir, "data"), { recursive: true });
    fs.mkdirSync(path.join(baseDir, "restore"), { recursive: true });
    fs.mkdirSync(path.join(baseDir, "source"), { recursive: true });
    writeGrocyConfig(baseDir);
    writeBackupConfig(baseDir);

    const artifact = runGrocyInstallDoctor(baseDir, {
      generatedAt: "2026-04-24T06:00:00.000Z",
      nodeVersion: "v22.4.0",
    });

    expect(artifact.summary).toEqual({
      status: "ready",
      failureCount: 0,
      warningCount: 0,
      skippedCount: 0,
      passCount: 7,
    });
    expect(artifact.nextActions).toEqual([]);
    expect(artifact.checks).toContainEqual({
      id: "backup_source",
      status: "pass",
      code: "backup_source_ready",
      message: "Backup source path source exists.",
      action: "No action required.",
      evidence: [],
    });
  });

  it("fails unsupported Node versions and invalid local configs", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-install-doctor-invalid-"));
    fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
    fs.writeFileSync(path.join(baseDir, "config", "grocy.local.json"), "{}\n", "utf8");
    fs.writeFileSync(path.join(baseDir, "config", "grocy-backup.local.json"), "{\"sourcePath\":\"\"}\n", "utf8");

    const artifact = createGrocyInstallDoctorArtifact({
      baseDir,
      generatedAt: "2026-04-24T06:00:00.000Z",
      nodeVersion: "v18.19.0",
    });

    expect(artifact.summary.status).toBe("action_required");
    expect(artifact.summary.failureCount).toBe(3);
    expect(artifact.checks).toContainEqual({
      id: "node_version",
      status: "fail",
      code: "node_version_unsupported",
      message: "Node.js v18.19.0 is below the supported >=20 requirement.",
      action: "Upgrade Node.js to version 20 or newer, then rerun npm run grocy:install:doctor.",
      evidence: [],
    });
    expect(artifact.checks.find((check) => check.id === "grocy_config")).toMatchObject({
      status: "fail",
      code: "grocy_config_invalid",
      evidence: ["Grocy config is missing baseUrl."],
    });
    expect(artifact.checks.find((check) => check.id === "backup_config")).toMatchObject({
      status: "fail",
      code: "backup_config_invalid",
      evidence: ["Grocy backup config requires sourcePath and backupDir."],
    });
  });

  it("writes the default artifact path under data/", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-install-doctor-record-"));

    const outputPath = recordGrocyInstallDoctorArtifact(
      runGrocyInstallDoctor(baseDir, {
        generatedAt: "2026-04-24T06:00:00.000Z",
        nodeVersion: "v20.12.0",
      }),
      { baseDir },
    );

    expect(path.relative(baseDir, outputPath)).toBe(GROCY_INSTALL_DOCTOR_PATH);
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_install_doctor",
      summary: { status: "action_required" },
    });
  });
});
