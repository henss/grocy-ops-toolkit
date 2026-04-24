import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  recordGrocySecretRotationSmokeReport,
  runGrocySecretRotationSmokeTest,
} from "../src/secret-rotation-smoke.js";

describe("Grocy secret rotation smoke test", () => {
  it("runs the synthetic credential and backup-key rotation path without real secrets", async () => {
    const report = await runGrocySecretRotationSmokeTest(process.cwd(), {
      generatedAt: "2026-04-24T10:10:00.000Z",
    });

    expect(report.summary).toEqual({ result: "pass", checkCount: 6, failureCount: 0 });
    expect(report.checks.map((check) => check.id)).toEqual([
      "credential_baseline",
      "credential_stale_rejected",
      "credential_rotated",
      "backup_key_baseline",
      "backup_key_stale_rejected",
      "backup_key_rotated",
    ]);
    expect(JSON.stringify(report)).not.toContain("synthetic-api-key-v1");
    expect(JSON.stringify(report)).not.toContain("synthetic-api-key-v2");
    expect(JSON.stringify(report)).not.toContain("synthetic-backup-passphrase-v1");
    expect(JSON.stringify(report)).not.toContain("synthetic-backup-passphrase-v2");
    expect(JSON.stringify(report)).not.toContain("https://grocy.example.test");
  });

  it("writes a generated secret-rotation smoke report to the conventional data path", async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-secret-rotation-report-"));
    const report = await runGrocySecretRotationSmokeTest(baseDir, {
      generatedAt: "2026-04-24T10:10:00.000Z",
    });

    const outputPath = recordGrocySecretRotationSmokeReport(report, { baseDir });

    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-secret-rotation-smoke-report.json"));
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_secret_rotation_smoke_report",
      summary: { result: "pass" },
    });
  });

  it("runs through the CLI", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-secret-rotation-cli-"));
    const nodeCommand = process.execPath;
    const cliEntrypoint = path.join(process.cwd(), "src", "cli.ts");

    const stdout = execFileSync(nodeCommand, [path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), cliEntrypoint, "grocy:smoke:secret-rotation"], {
      cwd: baseDir,
      encoding: "utf8",
    });

    expect(JSON.parse(stdout)).toMatchObject({
      outputPath: expect.stringContaining(path.join("data", "grocy-secret-rotation-smoke-report.json")),
      summary: { result: "pass", checkCount: 6, failureCount: 0 },
    });
    expect(JSON.parse(fs.readFileSync(path.join(baseDir, "data", "grocy-secret-rotation-smoke-report.json"), "utf8"))).toMatchObject({
      kind: "grocy_secret_rotation_smoke_report",
      summary: { result: "pass", checkCount: 6, failureCount: 0 },
    });
  });
});
