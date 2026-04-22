import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const tscCommand = process.platform === "win32"
  ? path.join(repoRoot, "node_modules", ".bin", "tsc.cmd")
  : path.join(repoRoot, "node_modules", ".bin", "tsc");

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

function installPackedPackage(consumerDir: string, npmEnv: NodeJS.ProcessEnv): void {
  const tempDir = path.dirname(consumerDir);
  const stageDir = path.join(tempDir, "stage");
  const packDir = path.join(tempDir, "pack");
  fs.mkdirSync(stageDir, { recursive: true });
  fs.mkdirSync(packDir, { recursive: true });
  // Stage package files so local workspace hardlinks cannot change npm's tarball layout.
  for (const entry of ["package.json", "README.md", "LICENSE", "dist"]) {
    fs.cpSync(path.join(repoRoot, entry), path.join(stageDir, entry), { recursive: true });
  }
  const packOutput = run(npmCommand, ["pack", "--pack-destination", packDir, "--json"], stageDir, npmEnv);
  const [packedPackage] = JSON.parse(packOutput) as Array<{ filename: string }>;
  const tarballPath = path.join(packDir, packedPackage.filename);

  run(npmCommand, ["install", "--no-audit", "--no-fund", tarballPath], consumerDir, npmEnv);
}

function writeSyntheticBackupFixture(consumerDir: string, passphraseEnvName: string): void {
  fs.mkdirSync(path.join(consumerDir, "config"), { recursive: true });
  fs.mkdirSync(path.join(consumerDir, "source", "data"), { recursive: true });
  fs.writeFileSync(path.join(consumerDir, "source", "config.php"), "<?php return ['mode' => 'synthetic'];\n", "utf8");
  fs.writeFileSync(
    path.join(consumerDir, "source", "data", "grocy-demo.json"),
    `${JSON.stringify({
      products: [
        { id: "example-coffee", name: "Example Coffee" },
      ],
    }, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(consumerDir, "config", "grocy-backup.local.json"),
    `${JSON.stringify({
      sourcePath: "source",
      backupDir: path.join("backups", "grocy"),
      passphraseEnv: passphraseEnvName,
      locationLabel: "synthetic-package-preview",
    }, null, 2)}\n`,
    "utf8",
  );
}

function resolveInstalledBinCommand(consumerDir: string): string {
  return process.platform === "win32"
    ? path.join(consumerDir, "node_modules", ".bin", "grocy-ops-toolkit.cmd")
    : path.join(consumerDir, "node_modules", ".bin", "grocy-ops-toolkit");
}

describe("packed npm install smoke test", () => {
  it(
    "installs the packed package and exercises the public export and installed bin commands",
    () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-packed-install-"));
      const consumerDir = path.join(tempDir, "consumer");
      const backupPassphraseEnv = "GROCY_PACKAGE_PREVIEW_PASSPHRASE";
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
      installPackedPackage(consumerDir, npmEnv);
      writeSyntheticBackupFixture(consumerDir, backupPassphraseEnv);
      const installedBinCommand = resolveInstalledBinCommand(consumerDir);

      const exportOutput = run(
        "node",
        [
          "--input-type=module",
          "--eval",
          "import { runGrocyMockSmokeTest } from 'grocy-ops-toolkit'; const report = await runGrocyMockSmokeTest(process.cwd(), { generatedAt: '2026-04-19T10:20:00.000Z' }); console.log(report.summary.result);",
        ],
        consumerDir,
      );
      const smokeOutput = run(
        installedBinCommand,
        ["grocy:smoke:mock", "--output", "data/smoke.json"],
        consumerDir,
        npmEnv,
      );
      const healthBadgeOutput = run(
        installedBinCommand,
        ["grocy:health:badge", "--output", "data/health-badge.json", "--force"],
        consumerDir,
        npmEnv,
      );
      const healthDiagnosticsOutput = run(
        installedBinCommand,
        ["grocy:health:diagnostics", "--output", "data/health-diagnostics.json", "--force"],
        consumerDir,
        npmEnv,
      );
      const backupSnapshotOutput = run(
        installedBinCommand,
        ["grocy:backup:snapshot"],
        consumerDir,
        { ...npmEnv, [backupPassphraseEnv]: "synthetic-package-preview-passphrase" },
      );
      const backupRestorePlanOutput = run(
        installedBinCommand,
        [
          "grocy:backup:restore-plan",
          "--restore-dir",
          "restore/preview-backup-check",
          "--output",
          "data/backup-restore-plan.json",
          "--force",
        ],
        consumerDir,
        { ...npmEnv, [backupPassphraseEnv]: "synthetic-package-preview-passphrase" },
      );

      expect(exportOutput.trim()).toBe("pass");
      expect(JSON.parse(smokeOutput)).toMatchObject({ summary: { result: "pass" } });
      expect(JSON.parse(smokeOutput)).toMatchObject({
        receiptPath: expect.stringContaining(path.join("data", "grocy-mock-smoke-receipt.json")),
      });
      expect(JSON.parse(healthBadgeOutput)).toMatchObject({
        outputPath: expect.stringContaining(path.join("data", "health-badge.json")),
        summary: { status: "fail", failureCodes: ["config_missing"] },
        badge: { label: "grocy health", color: "red" },
      });
      expect(JSON.parse(healthDiagnosticsOutput)).toMatchObject({
        outputPath: expect.stringContaining(path.join("data", "health-diagnostics.json")),
        summary: { result: "fail", failureCount: 1 },
      });
      expect(JSON.parse(backupSnapshotOutput)).toMatchObject({
        locationLabel: "synthetic-package-preview",
        fileCount: 2,
      });
      expect(JSON.parse(backupRestorePlanOutput)).toMatchObject({
        outputPath: expect.stringContaining(path.join("data", "backup-restore-plan.json")),
        summary: { result: "ready", fileCount: 2, wouldCreate: 2, wouldOverwrite: 0 },
      });
      expect(JSON.parse(fs.readFileSync(path.join(consumerDir, "data", "smoke.json"), "utf8"))).toMatchObject({
        kind: "grocy_mock_smoke_report",
        summary: { result: "pass" },
      });
      expect(JSON.parse(fs.readFileSync(path.join(consumerDir, "data", "grocy-mock-smoke-receipt.json"), "utf8"))).toMatchObject({
        kind: "grocy_toolkit_run_receipt",
        verification: { command: "npm run grocy:smoke:mock", status: "pass" },
      });
      expect(JSON.parse(fs.readFileSync(path.join(consumerDir, "data", "health-badge.json"), "utf8"))).toMatchObject({
        kind: "grocy_health_badge",
        summary: { status: "fail", failureCodes: ["config_missing"] },
      });
      expect(JSON.parse(fs.readFileSync(path.join(consumerDir, "data", "health-diagnostics.json"), "utf8"))).toMatchObject({
        kind: "grocy_health_diagnostics",
        summary: { result: "fail", failureCount: 1 },
      });
      expect(JSON.parse(fs.readFileSync(path.join(consumerDir, "data", "backup-restore-plan.json"), "utf8"))).toMatchObject({
        kind: "grocy_backup_restore_plan_dry_run_report",
        summary: { result: "ready", fileCount: 2, wouldCreate: 2, wouldOverwrite: 0 },
      });
    },
    60_000,
  );

  it(
    "supports a synthetic TypeScript package consumer through the public package edge",
    () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-package-consumer-"));
      const consumerDir = path.join(tempDir, "consumer");
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
        JSON.stringify({ private: true, name: "synthetic-grocy-consumer", type: "module" }, null, 2),
      );
      fs.writeFileSync(
        path.join(consumerDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            skipLibCheck: true,
            outDir: "dist",
          },
          include: ["consumer-contract.ts"],
        }, null, 2),
      );
      fs.writeFileSync(
        path.join(consumerDir, "consumer-contract.ts"),
        `
import {
  DEFAULT_GROCY_CONFIG_PATH,
  GROCY_CONFIG_EXPORT_PATH,
  GROCY_CONFIG_MANIFEST_PATH,
  GROCY_CONFIG_PLAN_PATH,
  createGrocyConfigApplyDryRunReport,
  createGrocyConfigSyncPlan,
  createGrocyReviewDashboard,
  runGrocyMockSmokeTest,
  type GrocyConfigExport,
  type GrocyConfigManifest,
} from "grocy-ops-toolkit";

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(\`Expected \${String(expected)}, received \${String(actual)}\`);
  }
}

function assertIncludes(actual: string, expected: string): void {
  if (!actual.includes(expected)) {
    throw new Error(\`Expected text to include \${expected}\`);
  }
}

function assertExcludesPattern(actual: string, pattern: RegExp): void {
  if (pattern.test(actual)) {
    throw new Error(\`Expected text not to match \${String(pattern)}\`);
  }
}

const manifest: GrocyConfigManifest = {
  kind: "grocy_config_manifest",
  version: 1,
  updatedAt: "2026-04-20T09:30:00.000Z",
  notes: ["Synthetic package-consumer fixture."],
  items: [
    {
      key: "products.example-cocoa",
      entity: "products",
      name: "Example Cocoa",
      ownership: "repo_managed",
      fields: { min_stock_amount: 2, location: "Example Shelf" },
      aliases: [],
      provenance: { source: "synthetic-consumer-contract", notes: [] },
    },
  ],
};

const liveExport: GrocyConfigExport = {
  kind: "grocy_config_export",
  version: 1,
  exportedAt: "2026-04-20T09:31:00.000Z",
  source: { toolId: "grocy", grocyVersion: "synthetic" },
  counts: {
    products: 0,
    product_groups: 0,
    locations: 0,
    quantity_units: 0,
    product_barcodes: 0,
    shopping_lists: 0,
    shopping_list: 0,
  },
  items: [],
};

assertEqual(DEFAULT_GROCY_CONFIG_PATH, ${JSON.stringify(path.join("config", "grocy.local.json"))});
assertEqual(GROCY_CONFIG_MANIFEST_PATH, ${JSON.stringify(path.join("config", "desired-state.json"))});
assertEqual(GROCY_CONFIG_EXPORT_PATH, ${JSON.stringify(path.join("data", "grocy-config-export.json"))});
assertEqual(GROCY_CONFIG_PLAN_PATH, ${JSON.stringify(path.join("data", "grocy-config-sync-plan.json"))});

const plan = createGrocyConfigSyncPlan({
  manifest,
  liveExport,
  manifestPath: GROCY_CONFIG_MANIFEST_PATH,
  exportPath: GROCY_CONFIG_EXPORT_PATH,
  generatedAt: "2026-04-20T09:32:00.000Z",
});
assertEqual(plan.summary.create, 1);
assertEqual(plan.actions[0]?.key, "products.example-cocoa");

const dryRunReport = createGrocyConfigApplyDryRunReport({
  plan,
  planPath: GROCY_CONFIG_PLAN_PATH,
  generatedAt: "2026-04-20T09:33:00.000Z",
});
assertEqual(dryRunReport.summary.wouldCreate, 1);

const dashboard = createGrocyReviewDashboard({
  generatedAt: "2026-04-20T09:34:00.000Z",
  plan,
  applyDryRunReport: dryRunReport,
});
assertIncludes(dashboard, "products.example-cocoa");
assertExcludesPattern(dashboard, /api-key|token|secret/i);

const smokeReport = await runGrocyMockSmokeTest(".", {
  generatedAt: "2026-04-20T09:35:00.000Z",
});
assertEqual(smokeReport.summary.result, "pass");
console.log("contract-ok");
`.trimStart(),
      );

      run(npmCommand, ["run", "build"], repoRoot, npmEnv);
      installPackedPackage(consumerDir, npmEnv);
      run(tscCommand, ["-p", "tsconfig.json"], consumerDir, npmEnv);
      const output = run("node", [path.join("dist", "consumer-contract.js")], consumerDir, npmEnv);

      expect(output.trim()).toBe("contract-ok");
    },
    60_000,
  );
});
