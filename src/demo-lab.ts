import fs from "node:fs";
import path from "node:path";
import {
  createGrocyBackupIntegrityReceipt,
  recordGrocyBackupIntegrityReceipt,
} from "./backup-integrity-receipt.js";
import {
  createGrocyBackupRestoreDrillReport,
  recordGrocyBackupRestoreDrillReport,
} from "./backup-restore-drill.js";
import {
  createGrocyConfigDriftTrendReport,
  createGrocyConfigApplyDryRunReport,
  createGrocyConfigSyncPlan,
  loadGrocyConfigExport,
  recordGrocyConfigDriftTrendReport,
  recordGrocyConfigApplyDryRunReport,
  recordGrocyConfigSyncPlan,
} from "./config-sync.js";
import {
  lintGrocyDesiredStateManifestFile,
  recordGrocyDesiredStateManifestLintReport,
} from "./desired-state-lint.js";
import {
  recordGrocyHealthDiagnosticsArtifact,
  runGrocyHealthDiagnostics,
} from "./health-diagnostics.js";
import {
  recordGrocyMockSmokeReport,
  runGrocyMockSmokeTest,
} from "./mock-smoke.js";
import {
  createGrocyMockSmokeRunReceipt,
  recordGrocyToolkitRunReceipt,
} from "./run-receipt.js";
import {
  auditGrocyPublicArtifacts,
  recordGrocyPublicArtifactRedactionAudit,
} from "./redaction-audit.js";
import {
  createGrocyReviewDashboardFromArtifacts,
  recordGrocyReviewDashboard,
} from "./review-dashboard.js";
import {
  createGrocySupportBundle,
  recordGrocySupportBundle,
} from "./support-bundle.js";

export const GROCY_DEMO_COMMAND = "npm run grocy:demo:lab";
export const GROCY_DEMO_ENVIRONMENT_PATH = path.join("data", "grocy-demo-environment.json");
export const GROCY_DEMO_BACKUP_CONFIG_PATH = path.join("config", "grocy-demo-backup.local.json");
export const GROCY_DEMO_BACKUP_MANIFEST_PATH = path.join("backups", "demo", "grocy-backup-manifest.json");
export const GROCY_DEMO_RESTORE_DIR = path.join("restore", "demo-grocy-backup-check");
export const GROCY_DEMO_HEALTH_DIAGNOSTICS_PATH = path.join("data", "demo-health-diagnostics.json");
export const GROCY_DEMO_MOCK_SMOKE_REPORT_PATH = path.join("data", "demo-mock-smoke-report.json");
export const GROCY_DEMO_MOCK_SMOKE_RECEIPT_PATH = path.join("data", "demo-mock-smoke-receipt.json");
export const GROCY_DEMO_DESIRED_STATE_LINT_PATH = path.join("data", "demo-desired-state-lint-report.json");
export const GROCY_DEMO_CONFIG_SYNC_PLAN_PATH = path.join("data", "demo-config-sync-plan.json");
export const GROCY_DEMO_CONFIG_DRIFT_TREND_PATH = path.join("data", "demo-config-drift-trend-report.json");
export const GROCY_DEMO_APPLY_DRY_RUN_PATH = path.join("data", "demo-apply-dry-run-report.json");
export const GROCY_DEMO_BACKUP_RESTORE_PLAN_PATH = path.join("data", "demo-backup-restore-plan-dry-run-report.json");
export const GROCY_DEMO_BACKUP_RESTORE_DRILL_PATH = path.join("data", "demo-backup-restore-drill-report.json");
export const GROCY_DEMO_BACKUP_INTEGRITY_RECEIPT_PATH = path.join("data", "demo-backup-integrity-receipt.json");
export const GROCY_DEMO_REVIEW_DASHBOARD_PATH = path.join("data", "demo-review-dashboard.md");
export const GROCY_DEMO_REDACTION_AUDIT_PATH = path.join("data", "demo-public-artifact-redaction-audit.json");
export const GROCY_DEMO_SUPPORT_BUNDLE_PATH = path.join("data", "demo-support-bundle.json");

const GROCY_DEMO_BACKUP_PASSPHRASE_ENV = "GROCY_DEMO_BACKUP_PASSPHRASE";
const GROCY_DEMO_BACKUP_SOURCE_PATH = path.join("examples", "synthetic-grocy-backup-source");
const GROCY_DEMO_BACKUP_DIR = path.join("backups", "demo");
const GROCY_DEMO_MANIFEST_PATH = path.join("examples", "desired-state.example.json");
const GROCY_DEMO_EXPORT_PATH = path.join("examples", "config-export.example.json");
const GROCY_DEMO_PREVIOUS_EXPORT_PATH = path.join("examples", "config-export.previous.example.json");
const GROCY_DEMO_ARTIFACT_PATHS = [
  GROCY_DEMO_HEALTH_DIAGNOSTICS_PATH,
  GROCY_DEMO_MOCK_SMOKE_REPORT_PATH,
  GROCY_DEMO_MOCK_SMOKE_RECEIPT_PATH,
  GROCY_DEMO_DESIRED_STATE_LINT_PATH,
  GROCY_DEMO_CONFIG_SYNC_PLAN_PATH,
  GROCY_DEMO_CONFIG_DRIFT_TREND_PATH,
  GROCY_DEMO_APPLY_DRY_RUN_PATH,
  GROCY_DEMO_BACKUP_RESTORE_PLAN_PATH,
  GROCY_DEMO_BACKUP_RESTORE_DRILL_PATH,
  GROCY_DEMO_BACKUP_INTEGRITY_RECEIPT_PATH,
  GROCY_DEMO_REVIEW_DASHBOARD_PATH,
] as const;

export interface GrocyDemoEnvironmentReport {
  kind: "grocy_demo_environment";
  version: 1;
  generatedAt: string;
  summary: {
    result: "pass" | "fail";
    shareability: "ready_to_share" | "needs_redaction_review";
    artifactCount: number;
  };
  command: {
    id: "grocy:demo:lab";
    cli: string;
  };
  environment: {
    syntheticOnly: true;
    backupConfigPath: string;
    backupManifestPath: string;
    restoreDir: string;
  };
  artifacts: {
    diagnosticsPath: string;
    mockSmokeReportPath: string;
    mockSmokeReceiptPath: string;
    desiredStateLintReportPath: string;
    configSyncPlanPath: string;
    configDriftTrendReportPath: string;
    applyDryRunReportPath: string;
    backupRestorePlanReportPath: string;
    backupRestoreDrillReportPath: string;
    backupIntegrityReceiptPath: string;
    reviewDashboardPath: string;
    redactionAuditPath: string;
    supportBundlePath: string;
  };
  reviewNotes: string[];
}

function writeJsonFile(filePath: string, value: unknown, overwrite = true): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function ensureDemoWorkspace(baseDir: string): void {
  for (const relativePath of ["config", "data", "restore", "backups"]) {
    fs.mkdirSync(path.resolve(baseDir, relativePath), { recursive: true });
  }
  fs.rmSync(path.resolve(baseDir, GROCY_DEMO_BACKUP_DIR), { recursive: true, force: true });
  fs.rmSync(path.resolve(baseDir, GROCY_DEMO_RESTORE_DIR), { recursive: true, force: true });
}

function writeDemoBackupConfig(baseDir: string): string {
  const absoluteConfigPath = path.resolve(baseDir, GROCY_DEMO_BACKUP_CONFIG_PATH);
  writeJsonFile(absoluteConfigPath, {
    sourcePath: GROCY_DEMO_BACKUP_SOURCE_PATH,
    backupDir: GROCY_DEMO_BACKUP_DIR,
    passphraseEnv: GROCY_DEMO_BACKUP_PASSPHRASE_ENV,
    locationLabel: "synthetic-demo-encrypted",
  });
  return absoluteConfigPath;
}

function relativeDisplayPath(baseDir: string, filePath: string): string {
  return path.relative(baseDir, filePath).replace(/\\/g, "/");
}

function toPortablePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function recordGrocyDemoEnvironmentReport(
  report: GrocyDemoEnvironmentReport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_DEMO_ENVIRONMENT_PATH),
    report,
    options.overwrite ?? true,
  );
}

export async function createGrocyDemoEnvironment(
  baseDir: string = process.cwd(),
  options: { generatedAt?: string } = {},
): Promise<GrocyDemoEnvironmentReport> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  ensureDemoWorkspace(baseDir);
  process.env[GROCY_DEMO_BACKUP_PASSPHRASE_ENV] ??= "synthetic-demo-passphrase";
  const backupConfigPath = writeDemoBackupConfig(baseDir);

  const diagnostics = await runGrocyHealthDiagnostics(baseDir, fetch, { generatedAt });
  recordGrocyHealthDiagnosticsArtifact(diagnostics, {
    baseDir,
    outputPath: GROCY_DEMO_HEALTH_DIAGNOSTICS_PATH,
    overwrite: true,
  });

  const mockSmokeReport = await runGrocyMockSmokeTest(baseDir, { generatedAt });
  const mockSmokeReportPath = recordGrocyMockSmokeReport(mockSmokeReport, {
    baseDir,
    outputPath: GROCY_DEMO_MOCK_SMOKE_REPORT_PATH,
    overwrite: true,
  });
  const mockSmokeReceipt = createGrocyMockSmokeRunReceipt({
    baseDir,
    report: mockSmokeReport,
    reportPath: mockSmokeReportPath,
  });
  recordGrocyToolkitRunReceipt(mockSmokeReceipt, {
    baseDir,
    outputPath: GROCY_DEMO_MOCK_SMOKE_RECEIPT_PATH,
    overwrite: true,
  });

  const { manifest, report: lintReport } = lintGrocyDesiredStateManifestFile(baseDir, GROCY_DEMO_MANIFEST_PATH);
  recordGrocyDesiredStateManifestLintReport(lintReport, {
    baseDir,
    outputPath: GROCY_DEMO_DESIRED_STATE_LINT_PATH,
    overwrite: true,
  });

  const configSyncPlan = createGrocyConfigSyncPlan({
    manifest,
    liveExport: loadGrocyConfigExport(path.resolve(baseDir, GROCY_DEMO_EXPORT_PATH)),
    manifestPath: GROCY_DEMO_MANIFEST_PATH,
    exportPath: GROCY_DEMO_EXPORT_PATH,
    generatedAt,
  });
  recordGrocyConfigSyncPlan(configSyncPlan, {
    baseDir,
    outputPath: GROCY_DEMO_CONFIG_SYNC_PLAN_PATH,
    overwrite: true,
  });

  const driftTrendReport = createGrocyConfigDriftTrendReport({
    previousExport: loadGrocyConfigExport(path.resolve(baseDir, GROCY_DEMO_PREVIOUS_EXPORT_PATH)),
    currentExport: loadGrocyConfigExport(path.resolve(baseDir, GROCY_DEMO_EXPORT_PATH)),
    previousExportPath: GROCY_DEMO_PREVIOUS_EXPORT_PATH,
    currentExportPath: GROCY_DEMO_EXPORT_PATH,
    generatedAt,
  });
  recordGrocyConfigDriftTrendReport(driftTrendReport, {
    baseDir,
    outputPath: GROCY_DEMO_CONFIG_DRIFT_TREND_PATH,
    overwrite: true,
  });

  const applyDryRunReport = createGrocyConfigApplyDryRunReport({
    plan: configSyncPlan,
    planPath: GROCY_DEMO_CONFIG_SYNC_PLAN_PATH,
    generatedAt,
  });
  recordGrocyConfigApplyDryRunReport(applyDryRunReport, {
    baseDir,
    outputPath: GROCY_DEMO_APPLY_DRY_RUN_PATH,
    overwrite: true,
  });

  const restoreDrillReport = createGrocyBackupRestoreDrillReport(baseDir, {
    restoreDir: GROCY_DEMO_RESTORE_DIR,
    generatedAt,
    createdAt: generatedAt,
    configPath: GROCY_DEMO_BACKUP_CONFIG_PATH,
    manifestPath: GROCY_DEMO_BACKUP_MANIFEST_PATH,
    restorePlanOutputPath: GROCY_DEMO_BACKUP_RESTORE_PLAN_PATH,
  });
  recordGrocyBackupRestoreDrillReport(restoreDrillReport, {
    baseDir,
    outputPath: GROCY_DEMO_BACKUP_RESTORE_DRILL_PATH,
    overwrite: true,
  });

  const backupIntegrityReceipt = createGrocyBackupIntegrityReceipt(baseDir, {
    generatedAt,
    manifestPath: GROCY_DEMO_BACKUP_MANIFEST_PATH,
    restorePlanReportPath: GROCY_DEMO_BACKUP_RESTORE_PLAN_PATH,
    restoreDrillReportPath: GROCY_DEMO_BACKUP_RESTORE_DRILL_PATH,
    configPath: GROCY_DEMO_BACKUP_CONFIG_PATH,
  });
  recordGrocyBackupIntegrityReceipt(backupIntegrityReceipt, {
    baseDir,
    outputPath: GROCY_DEMO_BACKUP_INTEGRITY_RECEIPT_PATH,
    overwrite: true,
  });

  const dashboard = createGrocyReviewDashboardFromArtifacts(baseDir, {
    planPath: GROCY_DEMO_CONFIG_SYNC_PLAN_PATH,
    applyDryRunReportPath: GROCY_DEMO_APPLY_DRY_RUN_PATH,
    driftTrendReportPath: GROCY_DEMO_CONFIG_DRIFT_TREND_PATH,
    diagnosticsPath: GROCY_DEMO_HEALTH_DIAGNOSTICS_PATH,
    backupManifestPath: GROCY_DEMO_BACKUP_MANIFEST_PATH,
    mockSmokeReportPath: GROCY_DEMO_MOCK_SMOKE_REPORT_PATH,
    generatedAt,
  });
  recordGrocyReviewDashboard(dashboard, {
    baseDir,
    outputPath: GROCY_DEMO_REVIEW_DASHBOARD_PATH,
    overwrite: true,
  });

  const redactionAudit = auditGrocyPublicArtifacts({
    baseDir,
    paths: [...GROCY_DEMO_ARTIFACT_PATHS],
    generatedAt,
  });
  recordGrocyPublicArtifactRedactionAudit(redactionAudit, {
    baseDir,
    outputPath: GROCY_DEMO_REDACTION_AUDIT_PATH,
    overwrite: true,
  });

  const report: GrocyDemoEnvironmentReport = {
    kind: "grocy_demo_environment",
    version: 1,
    generatedAt,
    summary: {
      result: redactionAudit.summary.result === "pass" ? "pass" : "fail",
      shareability: redactionAudit.summary.result === "pass" ? "ready_to_share" : "needs_redaction_review",
      artifactCount: GROCY_DEMO_ARTIFACT_PATHS.length + 3,
    },
    command: {
      id: "grocy:demo:lab",
      cli: GROCY_DEMO_COMMAND,
    },
    environment: {
      syntheticOnly: true,
      backupConfigPath: relativeDisplayPath(baseDir, backupConfigPath),
      backupManifestPath: toPortablePath(GROCY_DEMO_BACKUP_MANIFEST_PATH),
      restoreDir: toPortablePath(GROCY_DEMO_RESTORE_DIR),
    },
    artifacts: {
      diagnosticsPath: toPortablePath(GROCY_DEMO_HEALTH_DIAGNOSTICS_PATH),
      mockSmokeReportPath: toPortablePath(GROCY_DEMO_MOCK_SMOKE_REPORT_PATH),
      mockSmokeReceiptPath: toPortablePath(GROCY_DEMO_MOCK_SMOKE_RECEIPT_PATH),
      desiredStateLintReportPath: toPortablePath(GROCY_DEMO_DESIRED_STATE_LINT_PATH),
      configSyncPlanPath: toPortablePath(GROCY_DEMO_CONFIG_SYNC_PLAN_PATH),
      configDriftTrendReportPath: toPortablePath(GROCY_DEMO_CONFIG_DRIFT_TREND_PATH),
      applyDryRunReportPath: toPortablePath(GROCY_DEMO_APPLY_DRY_RUN_PATH),
      backupRestorePlanReportPath: toPortablePath(GROCY_DEMO_BACKUP_RESTORE_PLAN_PATH),
      backupRestoreDrillReportPath: toPortablePath(GROCY_DEMO_BACKUP_RESTORE_DRILL_PATH),
      backupIntegrityReceiptPath: toPortablePath(GROCY_DEMO_BACKUP_INTEGRITY_RECEIPT_PATH),
      reviewDashboardPath: toPortablePath(GROCY_DEMO_REVIEW_DASHBOARD_PATH),
      redactionAuditPath: toPortablePath(GROCY_DEMO_REDACTION_AUDIT_PATH),
      supportBundlePath: toPortablePath(GROCY_DEMO_SUPPORT_BUNDLE_PATH),
    },
    reviewNotes: [
      "This command stays inside a synthetic-only boundary and does not require live Grocy credentials.",
      "The backup manifest stays under backups/demo so the shareable data artifacts remain redaction-audit clean.",
      `Rerun ${GROCY_DEMO_COMMAND} to refresh the dashboard, receipt, and support bundle after doc or fixture changes.`,
    ],
  };

  recordGrocyDemoEnvironmentReport(report, {
    baseDir,
    outputPath: GROCY_DEMO_ENVIRONMENT_PATH,
    overwrite: true,
  });

  const supportBundle = createGrocySupportBundle({
    baseDir,
    artifactPaths: [...GROCY_DEMO_ARTIFACT_PATHS, GROCY_DEMO_REDACTION_AUDIT_PATH, GROCY_DEMO_ENVIRONMENT_PATH],
    auditPaths: [...GROCY_DEMO_ARTIFACT_PATHS, GROCY_DEMO_ENVIRONMENT_PATH],
    generatedAt,
  });
  recordGrocySupportBundle(supportBundle, {
    baseDir,
    outputPath: GROCY_DEMO_SUPPORT_BUNDLE_PATH,
    overwrite: true,
  });

  return report;
}
