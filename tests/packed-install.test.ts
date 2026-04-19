import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function createChildEnv(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(npm|pnpm)_/i.test(key)) {
      delete env[key];
    }
  }
  return { ...env, ...overrides };
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): string {
  const runsThroughCmd = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command);
  const executable = runsThroughCmd ? (process.env.ComSpec ?? "cmd.exe") : command;
  const executableArgs = runsThroughCmd ? ["/d", "/c", command, ...args] : args;
  return execFileSync(executable, executableArgs, {
    cwd,
    encoding: "utf8",
    env: createChildEnv(env),
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("packed npm install smoke test", () => {
  it(
    "installs the packed package and exercises the public export and bin",
    () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-packed-install-"));
      const stageDir = path.join(tempDir, "stage");
      const packDir = path.join(tempDir, "pack");
      const consumerDir = path.join(tempDir, "consumer");
      fs.mkdirSync(stageDir, { recursive: true });
      fs.mkdirSync(packDir, { recursive: true });
      fs.mkdirSync(consumerDir, { recursive: true });
      const npmEnv = {
        npm_config_cache: path.join(tempDir, "npm-cache"),
        npm_config_update_notifier: "false",
        TEMP: path.join(tempDir, "tmp"),
        TMP: path.join(tempDir, "tmp"),
        TMPDIR: path.join(tempDir, "tmp"),
      };
      fs.mkdirSync(npmEnv.TMP, { recursive: true });
      fs.writeFileSync(
        path.join(consumerDir, "package.json"),
        JSON.stringify({ private: true, type: "module", dependencies: {} }, null, 2),
      );

      run(npmCommand, ["run", "build"], repoRoot, npmEnv);
      // Stage package files so local workspace hardlinks cannot change npm's tarball layout.
      for (const entry of ["package.json", "README.md", "LICENSE", "dist"]) {
        fs.cpSync(path.join(repoRoot, entry), path.join(stageDir, entry), { recursive: true });
      }
      const packOutput = run(npmCommand, ["pack", "--pack-destination", packDir, "--json"], stageDir, npmEnv);
      const [packedPackage] = JSON.parse(packOutput) as Array<{ filename: string }>;
      const tarballPath = path.join(packDir, packedPackage.filename);

      run(npmCommand, ["install", "--no-audit", "--no-fund", tarballPath], consumerDir, npmEnv);

      const exportOutput = run(
        "node",
        [
          "--input-type=module",
          "--eval",
          "import { runGrocyMockSmokeTest } from 'grocy-ops-toolkit'; const report = await runGrocyMockSmokeTest(process.cwd(), { generatedAt: '2026-04-19T10:20:00.000Z' }); console.log(report.summary.result);",
        ],
        consumerDir,
      );
      const binOutput = run(
        npxCommand,
        ["--no-install", "grocy-ops-toolkit", "grocy:smoke:mock", "--output", "data/smoke.json"],
        consumerDir,
        npmEnv,
      );

      expect(exportOutput.trim()).toBe("pass");
      expect(JSON.parse(binOutput)).toMatchObject({ summary: { result: "pass" } });
      expect(JSON.parse(fs.readFileSync(path.join(consumerDir, "data", "smoke.json"), "utf8"))).toMatchObject({
        kind: "grocy_mock_smoke_report",
        summary: { result: "pass" },
      });
    },
    60_000,
  );
});
