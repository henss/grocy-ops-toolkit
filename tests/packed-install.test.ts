import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const gitCommand = "git";

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

function packPackageFromCleanCheckout(tempDir: string, npmEnv: NodeJS.ProcessEnv): string {
  const checkoutDir = path.join(tempDir, "packed-checkout");
  const packDir = path.join(tempDir, "pack");
  fs.mkdirSync(checkoutDir, { recursive: true });
  fs.mkdirSync(packDir, { recursive: true });

  // Pack from a clean checkout-shaped snapshot so the tarball matches an npm-first consumer path.
  for (const entry of ["package.json", "README.md", "LICENSE", ".gitignore", "dist"]) {
    fs.cpSync(path.join(repoRoot, entry), path.join(checkoutDir, entry), { recursive: true });
  }
  run(gitCommand, ["init"], checkoutDir);
  run(gitCommand, ["config", "user.email", "grocy-ops-toolkit-tests@example.test"], checkoutDir);
  run(gitCommand, ["config", "user.name", "grocy-ops-toolkit tests"], checkoutDir);
  run(gitCommand, ["add", ".gitignore", "LICENSE", "README.md", "package.json"], checkoutDir);
  run(gitCommand, ["commit", "-m", "fixture"], checkoutDir);

  const packOutput = run(npmCommand, ["pack", "--pack-destination", packDir, "--json"], checkoutDir, npmEnv);
  const [packedPackage] = JSON.parse(packOutput) as Array<{ filename: string }>;
  return path.join(packDir, packedPackage.filename);
}

function installPackedPackage(consumerDir: string, tarballPath: string, npmEnv: NodeJS.ProcessEnv): void {
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

function createNpmEnv(tempDir: string): NodeJS.ProcessEnv & { TMP: string } {
  return {
    npm_config_cache: path.join(tempDir, "npm-cache"),
    npm_config_update_notifier: "false",
    TEMP: path.join(tempDir, "tmp"),
    TMP: path.join(tempDir, "tmp"),
    TMPDIR: path.join(tempDir, "tmp"),
  };
}

function setupPackedConsumer(tempPrefix: string): {
  tempDir: string;
  consumerDir: string;
  npmEnv: NodeJS.ProcessEnv & { TMP: string };
} {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), tempPrefix));
  const consumerDir = path.join(tempDir, "consumer");
  const npmEnv = createNpmEnv(tempDir);
  fs.mkdirSync(consumerDir, { recursive: true });
  fs.mkdirSync(npmEnv.TMP, { recursive: true });
  return { tempDir, consumerDir, npmEnv };
}

function runInstalledPreviewScenario(params: {
  consumerDir: string;
  npmEnv: NodeJS.ProcessEnv;
  backupPassphraseEnv: string;
}): Record<string, unknown> {
  const { consumerDir, npmEnv, backupPassphraseEnv } = params;
  const installedBinCommand = resolveInstalledBinCommand(consumerDir);
  const backupEnv = { ...npmEnv, [backupPassphraseEnv]: "synthetic-package-preview-passphrase" };

  return {
    exportOutput: run(
      "node",
      [
        "--input-type=module",
        "--eval",
        "import { runGrocyMockSmokeTest } from 'grocy-ops-toolkit'; const report = await runGrocyMockSmokeTest(process.cwd(), { generatedAt: '2026-04-19T10:20:00.000Z' }); console.log(report.summary.result);",
      ],
      consumerDir,
    ),
    smokeOutput: run(
      installedBinCommand,
      ["grocy:smoke:mock", "--output", "data/smoke.json"],
      consumerDir,
      npmEnv,
    ),
    healthBadgeOutput: run(
      installedBinCommand,
      ["grocy:health:badge", "--output", "data/health-badge.json", "--force"],
      consumerDir,
      npmEnv,
    ),
    healthDiagnosticsOutput: run(
      installedBinCommand,
      ["grocy:health:diagnostics", "--output", "data/health-diagnostics.json", "--force"],
      consumerDir,
      npmEnv,
    ),
    backupSnapshotOutput: run(
      installedBinCommand,
      ["grocy:backup:snapshot"],
      consumerDir,
      backupEnv,
    ),
    backupRestorePlanOutput: run(
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
      backupEnv,
    ),
    backupRestoreDrillOutput: run(
      installedBinCommand,
      [
        "grocy:backup:restore-drill",
        "--restore-dir",
        "restore/package-restore-drill",
        "--output",
        "data/backup-restore-drill.json",
        "--force",
      ],
      consumerDir,
      backupEnv,
    ),
  };
}

function assertInstalledPreviewScenario(params: {
  consumerDir: string;
  outputs: Record<string, unknown>;
}): void {
  const { consumerDir, outputs } = params;

  expect(String(outputs.exportOutput).trim()).toBe("pass");
  expect(JSON.parse(String(outputs.smokeOutput))).toMatchObject({ summary: { result: "pass" } });
  expect(JSON.parse(String(outputs.smokeOutput))).toMatchObject({
    receiptPath: expect.stringContaining(path.join("data", "grocy-mock-smoke-receipt.json")),
  });
  expect(JSON.parse(String(outputs.healthBadgeOutput))).toMatchObject({
    outputPath: expect.stringContaining(path.join("data", "health-badge.json")),
    summary: { status: "fail", failureCodes: ["config_missing"] },
    badge: { label: "grocy health", color: "red" },
  });
  expect(JSON.parse(String(outputs.healthDiagnosticsOutput))).toMatchObject({
    outputPath: expect.stringContaining(path.join("data", "health-diagnostics.json")),
    summary: { result: "fail", failureCount: 1 },
  });
  expect(JSON.parse(String(outputs.backupSnapshotOutput))).toMatchObject({
    locationLabel: "synthetic-package-preview",
    fileCount: 2,
  });
  expect(JSON.parse(String(outputs.backupRestorePlanOutput))).toMatchObject({
    outputPath: expect.stringContaining(path.join("data", "backup-restore-plan.json")),
    summary: { result: "ready", fileCount: 2, wouldCreate: 2, wouldOverwrite: 0 },
  });
  expect(JSON.parse(String(outputs.backupRestoreDrillOutput))).toMatchObject({
    outputPath: expect.stringContaining(path.join("data", "backup-restore-drill.json")),
    summary: { result: "pass", checkpointCount: 3, passedCount: 3 },
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
  expect(JSON.parse(fs.readFileSync(path.join(consumerDir, "data", "backup-restore-drill.json"), "utf8"))).toMatchObject({
    kind: "grocy_backup_restore_drill_report",
    restoreDir: "restore/package-restore-drill",
    summary: { result: "pass", checkpointCount: 3, passedCount: 3 },
  });
}

describe("packed npm install smoke test", () => {
  it(
    "installs the packed package and exercises the public export and installed bin commands",
    () => {
      const { consumerDir, npmEnv } = setupPackedConsumer("grocy-packed-install-");
      const backupPassphraseEnv = "GROCY_PACKAGE_PREVIEW_PASSPHRASE";
      fs.writeFileSync(
        path.join(consumerDir, "package.json"),
        JSON.stringify({ private: true, type: "module", dependencies: {} }, null, 2),
      );

      run(npmCommand, ["run", "build"], repoRoot, npmEnv);
      const tarballPath = packPackageFromCleanCheckout(path.dirname(consumerDir), npmEnv);
      installPackedPackage(consumerDir, tarballPath, npmEnv);
      writeSyntheticBackupFixture(consumerDir, backupPassphraseEnv);
      const outputs = runInstalledPreviewScenario({ consumerDir, npmEnv, backupPassphraseEnv });

      assertInstalledPreviewScenario({ consumerDir, outputs });
    },
    60_000,
  );

  it(
    "supports a synthetic TypeScript package consumer through the public package edge",
    () => {
      const { consumerDir, npmEnv } = setupPackedConsumer("grocy-package-consumer-");
      fs.writeFileSync(
        path.join(consumerDir, "package.json"),
        JSON.stringify({
          private: true,
          name: "synthetic-grocy-consumer",
          type: "module",
          scripts: {
            build: "tsc -p tsconfig.json",
            smoke: "node dist/consumer-contract.js",
          },
        }, null, 2),
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
      const tarballPath = packPackageFromCleanCheckout(path.dirname(consumerDir), npmEnv);
      installPackedPackage(consumerDir, tarballPath, npmEnv);
      run(
        npmCommand,
        ["install", "--no-audit", "--no-fund", "--save-dev", path.join(repoRoot, "node_modules", "typescript")],
        consumerDir,
        npmEnv,
      );
      run(npmCommand, ["run", "build"], consumerDir, npmEnv);
      const output = run(npmCommand, ["run", "smoke"], consumerDir, npmEnv);

      expect(output).toContain("contract-ok");
    },
    60_000,
  );
});
