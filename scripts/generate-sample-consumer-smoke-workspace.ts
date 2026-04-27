import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const gitCommand = "git";

type WorkspaceSummary = {
  workspacePath: string;
  tarballPath: string;
  packageName: string;
  installDoctorPath: string;
  smokeReportPath: string;
  smokeReceiptPath: string;
  healthBadgePath: string;
  healthDiagnosticsPath: string;
  supportBundlePath: string;
  backupRestorePlanPath: string;
  backupRestoreDrillPath: string;
  backupVerificationPath: string;
  backupRestoreFailureDrillPath: string;
  buildCommand: string;
  smokeCommand: string;
  contractResult: string;
  mockSmokeResult: string;
  supportBundleReadiness: string;
  supportBundleIssueTitle: string;
};

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

function parseFlag(flagName: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flagName);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flagName}`);
  }

  return path.resolve(repoRoot, value);
}

function createNpmEnv(tempDir: string): NodeJS.ProcessEnv & { TMP: string } {
  return {
    npm_config_cache: path.join(tempDir, "npm-cache"),
    npm_config_package_lock: "false",
    npm_config_update_notifier: "false",
    TEMP: path.join(tempDir, "tmp"),
    TMP: path.join(tempDir, "tmp"),
    TMPDIR: path.join(tempDir, "tmp"),
  };
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createWorkspaceRoot(outputDir: string | undefined): { tempDir: string; workspacePath: string } {
  if (outputDir) {
    if (fs.existsSync(outputDir)) {
      throw new Error(`Refusing to overwrite existing output directory: ${outputDir}`);
    }

    ensureDir(outputDir);
    return {
      tempDir: path.dirname(outputDir),
      workspacePath: outputDir,
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-sample-consumer-smoke-"));
  const workspacePath = path.join(tempDir, "workspace");
  ensureDir(workspacePath);
  return { tempDir, workspacePath };
}

function packPackageFromCleanCheckout(tempDir: string, npmEnv: NodeJS.ProcessEnv): { tarballPath: string; packageName: string } {
  const checkoutDir = path.join(tempDir, "packed-checkout");
  const packDir = path.join(tempDir, "pack");
  ensureDir(checkoutDir);
  ensureDir(packDir);

  for (const entry of ["package.json", "README.md", "LICENSE", ".gitignore", "dist"]) {
    fs.cpSync(path.join(repoRoot, entry), path.join(checkoutDir, entry), { recursive: true });
  }

  run(gitCommand, ["init"], checkoutDir);
  run(gitCommand, ["config", "user.email", "grocy-ops-toolkit-tests@example.test"], checkoutDir);
  run(gitCommand, ["config", "user.name", "grocy-ops-toolkit sample consumer"], checkoutDir);
  run(gitCommand, ["add", ".gitignore", "LICENSE", "README.md", "package.json"], checkoutDir);
  run(gitCommand, ["commit", "-m", "fixture"], checkoutDir);

  const packOutput = run(npmCommand, ["pack", "--pack-destination", packDir, "--json"], checkoutDir, npmEnv);
  const [packedPackage] = JSON.parse(packOutput) as Array<{ filename: string }>;
  return {
    tarballPath: path.join(packDir, packedPackage.filename),
    packageName: packedPackage.filename,
  };
}

function buildConsumerContractSource(): string {
  return `
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
`.trimStart();
}

function writeConsumerPackageJson(workspacePath: string): void {
  fs.writeFileSync(
    path.join(workspacePath, "package.json"),
    `${JSON.stringify({
      private: true,
      name: "synthetic-grocy-consumer-smoke",
      type: "module",
      scripts: {
        build: "tsc -p tsconfig.json",
        smoke: "node dist/consumer-contract.js",
      },
    }, null, 2)}\n`,
    "utf8",
  );
}

function writeConsumerTsConfig(workspacePath: string): void {
  fs.writeFileSync(
    path.join(workspacePath, "tsconfig.json"),
    `${JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        skipLibCheck: true,
        outDir: "dist",
      },
      include: ["consumer-contract.ts"],
    }, null, 2)}\n`,
    "utf8",
  );
}

function writeConsumerFiles(workspacePath: string): void {
  writeConsumerPackageJson(workspacePath);
  writeConsumerTsConfig(workspacePath);
  fs.writeFileSync(
    path.join(workspacePath, "consumer-contract.ts"),
    buildConsumerContractSource(),
    "utf8",
  );
}

function writeSyntheticBackupFixture(workspacePath: string, passphraseEnvName: string): void {
  ensureDir(path.join(workspacePath, "config"));
  ensureDir(path.join(workspacePath, "source", "data"));
  fs.writeFileSync(path.join(workspacePath, "source", "config.php"), "<?php return ['mode' => 'synthetic'];\n", "utf8");
  fs.writeFileSync(
    path.join(workspacePath, "source", "data", "grocy-demo.json"),
    `${JSON.stringify({
      products: [
        { id: "example-coffee", name: "Example Coffee" },
      ],
    }, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(workspacePath, "config", "grocy-backup.local.json"),
    `${JSON.stringify({
      sourcePath: "source",
      backupDir: path.join("backups", "grocy"),
      passphraseEnv: passphraseEnvName,
      locationLabel: "synthetic-package-preview",
    }, null, 2)}\n`,
    "utf8",
  );
}

function resolveInstalledBinCommand(workspacePath: string): string {
  return process.platform === "win32"
    ? path.join(workspacePath, "node_modules", ".bin", "grocy-ops-toolkit.cmd")
    : path.join(workspacePath, "node_modules", ".bin", "grocy-ops-toolkit");
}

function runInstalledToolkitArtifacts(
  workspacePath: string,
  installedBinCommand: string,
  npmEnv: NodeJS.ProcessEnv,
  backupEnv: NodeJS.ProcessEnv,
): void {
  run(
    installedBinCommand,
    ["grocy:install:doctor", "--output", "data/install-doctor.json", "--force"],
    workspacePath,
    npmEnv,
  );
  run(installedBinCommand, ["grocy:smoke:mock", "--output", "data/smoke.json"], workspacePath, npmEnv);
  run(
    installedBinCommand,
    ["grocy:health:badge", "--output", "data/health-badge.json", "--force"],
    workspacePath,
    npmEnv,
  );
  run(
    installedBinCommand,
    ["grocy:health:diagnostics", "--output", "data/health-diagnostics.json", "--force"],
    workspacePath,
    npmEnv,
  );
  run(installedBinCommand, ["grocy:backup:snapshot"], workspacePath, backupEnv);
  run(
    installedBinCommand,
    [
      "grocy:backup:restore-plan",
      "--restore-dir",
      "restore/preview-backup-check",
      "--output",
      "data/backup-restore-plan.json",
      "--force",
    ],
    workspacePath,
    backupEnv,
  );
  run(
    installedBinCommand,
    [
      "grocy:backup:restore-drill",
      "--restore-dir",
      "restore/package-restore-drill",
      "--output",
      "data/backup-restore-drill.json",
      "--force",
    ],
    workspacePath,
    backupEnv,
  );
  run(
    installedBinCommand,
    ["grocy:backup:verify", "--output", "data/grocy-backup-verification-report.json", "--force"],
    workspacePath,
    backupEnv,
  );
  run(
    installedBinCommand,
    [
      "grocy:backup:restore-failure-drill",
      "--restore-dir",
      "restore/package-restore-failure-drill",
      "--output",
      "data/grocy-backup-restore-failure-drill-report.json",
      "--force",
    ],
    workspacePath,
    backupEnv,
  );
  run(
    installedBinCommand,
    [
      "grocy:support:bundle",
      "--output",
      "data/grocy-support-bundle.json",
      "--artifact",
      "data/health-diagnostics.json",
      "--artifact",
      "data/smoke.json",
      "--artifact",
      "data/grocy-backup-verification-report.json",
      "--artifact",
      "data/grocy-backup-restore-failure-drill-report.json",
      "--audit-path",
      "data/health-diagnostics.json",
      "--audit-path",
      "data/smoke.json",
      "--audit-path",
      "data/grocy-backup-verification-report.json",
      "--audit-path",
      "data/grocy-backup-restore-failure-drill-report.json",
      "--force",
    ],
    workspacePath,
    backupEnv,
  );
}

function generateWorkspace(): WorkspaceSummary {
  const outputDir = parseFlag("--output-dir");
  const { tempDir, workspacePath } = createWorkspaceRoot(outputDir);
  const npmEnv = createNpmEnv(tempDir);
  const backupPassphraseEnv = "GROCY_SAMPLE_CONSUMER_PASSPHRASE";

  ensureDir(npmEnv.TMP);
  writeConsumerFiles(workspacePath);

  run(npmCommand, ["run", "build"], repoRoot, npmEnv);
  const { tarballPath, packageName } = packPackageFromCleanCheckout(tempDir, npmEnv);
  run(npmCommand, ["install", "--no-audit", "--no-fund", "--no-package-lock", tarballPath], workspacePath, npmEnv);
  run(
    npmCommand,
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      "--save-dev",
      path.join(repoRoot, "node_modules", "typescript"),
    ],
    workspacePath,
    npmEnv,
  );

  writeSyntheticBackupFixture(workspacePath, backupPassphraseEnv);

  const installedBinCommand = resolveInstalledBinCommand(workspacePath);
  const backupEnv = { ...npmEnv, [backupPassphraseEnv]: "synthetic-package-preview-passphrase" };

  runInstalledToolkitArtifacts(workspacePath, installedBinCommand, npmEnv, backupEnv);

  const buildCommand = "npm run build";
  const smokeCommand = "npm run smoke";
  run(npmCommand, ["run", "build"], workspacePath, npmEnv);
  const contractResult = run(npmCommand, ["run", "smoke"], workspacePath, npmEnv).trim();
  const mockSmokeResult = JSON.parse(fs.readFileSync(path.join(workspacePath, "data", "smoke.json"), "utf8")) as {
    summary?: { result?: string };
  };
  const supportBundle = JSON.parse(
    fs.readFileSync(path.join(workspacePath, "data", "grocy-support-bundle.json"), "utf8"),
  ) as {
    summary?: { readiness?: string };
    issueReport?: { title?: string };
  };

  return {
    workspacePath,
    tarballPath,
    packageName,
    installDoctorPath: path.join(workspacePath, "data", "install-doctor.json"),
    smokeReportPath: path.join(workspacePath, "data", "smoke.json"),
    smokeReceiptPath: path.join(workspacePath, "data", "grocy-mock-smoke-receipt.json"),
    healthBadgePath: path.join(workspacePath, "data", "health-badge.json"),
    healthDiagnosticsPath: path.join(workspacePath, "data", "health-diagnostics.json"),
    supportBundlePath: path.join(workspacePath, "data", "grocy-support-bundle.json"),
    backupRestorePlanPath: path.join(workspacePath, "data", "backup-restore-plan.json"),
    backupRestoreDrillPath: path.join(workspacePath, "data", "backup-restore-drill.json"),
    backupVerificationPath: path.join(workspacePath, "data", "grocy-backup-verification-report.json"),
    backupRestoreFailureDrillPath: path.join(workspacePath, "data", "grocy-backup-restore-failure-drill-report.json"),
    buildCommand,
    smokeCommand,
    contractResult,
    mockSmokeResult: mockSmokeResult.summary?.result ?? "unknown",
    supportBundleReadiness: supportBundle.summary?.readiness ?? "unknown",
    supportBundleIssueTitle: supportBundle.issueReport?.title ?? "unknown",
  };
}

const summary = generateWorkspace();
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
