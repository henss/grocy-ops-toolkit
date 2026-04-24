import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

type WorkspaceSummary = {
  workspacePath: string;
  tarballPath: string;
  packageName: string;
  smokeReportPath: string;
  smokeReceiptPath: string;
  contractResult: string;
  mockSmokeResult: string;
};

function run(command: string, args: string[], cwd: string): string {
  const runsThroughCmd = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command);
  const executable = runsThroughCmd ? (process.env.ComSpec ?? "cmd.exe") : command;
  const executableArgs = runsThroughCmd ? ["/d", "/c", command, ...args] : args;
  return execFileSync(executable, executableArgs, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("sample consumer smoke workspace generator", () => {
  it(
    "creates a disposable packed-tarball consumer workspace with synthetic smoke artifacts",
    () => {
      const outputDir = path.join(
        fs.mkdtempSync(path.join(os.tmpdir(), "grocy-sample-consumer-test-")),
        "consumer-workspace",
      );
      const stdout = run(
        npmCommand,
        ["--silent", "run", "sample-consumer:smoke:workspace", "--", "--output-dir", outputDir],
        repoRoot,
      );
      const summary = JSON.parse(stdout) as WorkspaceSummary;

      expect(summary.workspacePath).toBe(outputDir);
      expect(summary.packageName).toMatch(/^grocy-ops-toolkit-.*\.tgz$/);
      expect(summary.contractResult).toContain("contract-ok");
      expect(summary.mockSmokeResult).toBe("pass");
      expect(fs.existsSync(path.join(outputDir, "package-lock.json"))).toBe(false);
      expect(fs.existsSync(path.join(outputDir, "config", "grocy-backup.local.json"))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, "source", "data", "grocy-demo.json"))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, "dist", "consumer-contract.js"))).toBe(true);
      expect(JSON.parse(fs.readFileSync(summary.smokeReportPath, "utf8"))).toMatchObject({
        kind: "grocy_mock_smoke_report",
        summary: { result: "pass" },
      });
      expect(JSON.parse(fs.readFileSync(summary.smokeReceiptPath, "utf8"))).toMatchObject({
        kind: "grocy_toolkit_run_receipt",
        verification: { command: "npm run grocy:smoke:mock", status: "pass" },
      });
      expect(JSON.parse(fs.readFileSync(path.join(outputDir, "data", "backup-restore-drill.json"), "utf8"))).toMatchObject({
        kind: "grocy_backup_restore_drill_report",
        restoreDir: "restore/package-restore-drill",
        summary: { result: "pass" },
      });
    },
    120_000,
  );
});
