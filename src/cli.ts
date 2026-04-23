#!/usr/bin/env node

import {
  applyGrocyConfigSyncPlan,
  createGrocyConfigDriftTrendReport,
  createGrocyConfigApplyDryRunReport,
  createGrocyConfigSyncPlan,
  exportGrocyConfig,
  GROCY_CONFIG_EXPORT_PATH,
  GROCY_CONFIG_PREVIOUS_EXPORT_PATH,
  loadGrocyConfigExport,
  loadGrocyConfigSyncPlan,
  recordGrocyConfigDriftTrendReport,
  recordGrocyConfigApplyDryRunReport,
  recordGrocyConfigExport,
  recordGrocyConfigSyncPlan,
} from "./config-sync.js";
import {
  assertGrocyDesiredStateManifestLintReady,
  lintGrocyDesiredStateManifestFile,
  recordGrocyDesiredStateManifestLintReport,
} from "./desired-state-lint.js";
import {
  createGrocyBackupIntegrityReceipt,
  recordGrocyBackupIntegrityReceipt,
  verifyGrocyBackupIntegrityReceipt,
} from "./backup-integrity-receipt.js";
import {
  createGrocyBackupRestorePlanDryRunReport,
  createGrocyBackupSnapshot,
  recordGrocyBackupRestorePlanDryRunReport,
  verifyGrocyBackupSnapshot,
} from "./backups.js";
import {
  createGrocyBackupRestoreDrillReport,
  DEFAULT_GROCY_BACKUP_RESTORE_DRILL_DIR,
  recordGrocyBackupRestoreDrillReport,
} from "./backup-restore-drill.js";
import { getGrocyConfigStatus, runGrocyHealthCheck } from "./grocy-live.js";
import { recordGrocyHealthBadgeArtifact, runGrocyHealthBadge } from "./health-badge.js";
import { recordGrocyHealthDiagnosticsArtifact, runGrocyHealthDiagnostics } from "./health-diagnostics.js";
import { createGrocyApiCompatibilityMatrix, recordGrocyApiCompatibilityMatrix } from "./compatibility-matrix.js";
import { createGrocyApiDeprecationCanaryReport, recordGrocyApiDeprecationCanaryReport } from "./deprecation-canary.js";
import { startGrocyFixtureServer } from "./fixture-server.js";
import { recordGrocyMockSmokeReport, runGrocyMockSmokeTest } from "./mock-smoke.js";
import { createGrocyObjectCoveragePlayground, recordGrocyObjectCoveragePlayground } from "./object-coverage-playground.js";
import { auditGrocyPublicArtifacts, recordGrocyPublicArtifactRedactionAudit } from "./redaction-audit.js";
import { createGrocyReviewDashboardFromArtifacts, recordGrocyReviewDashboard } from "./review-dashboard.js";
import { createGrocyMockSmokeRunReceipt, recordGrocyToolkitRunReceipt } from "./run-receipt.js";
import { createGrocySupportBundle, recordGrocySupportBundle } from "./support-bundle.js";

function parseFlag(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseFlags(flag: string): string[] {
  return process.argv.flatMap((value, index) => value === flag && process.argv[index + 1] ? [process.argv[index + 1]] : []);
}

function parseNumberFlag(flag: string): number | undefined {
  const value = parseFlag(flag);
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected ${flag} to be a non-negative integer.`);
  }
  return parsed;
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "grocy:config:status") {
    printJson(getGrocyConfigStatus(process.cwd()));
    return;
  }
  if (command === "grocy:health") {
    printJson(await runGrocyHealthCheck(process.cwd()));
    return;
  }
  if (command === "grocy:health:badge") {
    const artifact = await runGrocyHealthBadge(process.cwd());
    const outputPath = recordGrocyHealthBadgeArtifact(artifact, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: artifact.summary, badge: artifact.badge });
    return;
  }
  if (command === "grocy:health:diagnostics") {
    const artifact = await runGrocyHealthDiagnostics(process.cwd());
    const outputPath = recordGrocyHealthDiagnosticsArtifact(artifact, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: artifact.summary });
    return;
  }
  if (command === "grocy:smoke:mock") {
    const report = await runGrocyMockSmokeTest(process.cwd());
    const outputPath = recordGrocyMockSmokeReport(report, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    const receipt = createGrocyMockSmokeRunReceipt({
      baseDir: process.cwd(),
      report,
      reportPath: outputPath,
    });
    const receiptPath = recordGrocyToolkitRunReceipt(receipt, {
      outputPath: parseFlag("--receipt-output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--receipt-output"),
    });
    printJson({ outputPath, receiptPath, summary: report.summary });
    return;
  }
  if (command === "grocy:fixtures:serve") {
    const server = await startGrocyFixtureServer({
      fixtureId: parseFlag("--fixture"),
      host: parseFlag("--host"),
      port: parseNumberFlag("--port"),
    });
    printJson({
      status: "listening",
      fixtureId: server.fixtureId,
      host: server.host,
      port: server.port,
      baseUrl: server.baseUrl,
      stop: "Press Ctrl+C to stop the synthetic fixture server.",
    });
    const shutdown = async (): Promise<void> => {
      await server.close();
      process.exit(0);
    };
    process.once("SIGINT", () => void shutdown());
    process.once("SIGTERM", () => void shutdown());
    return await new Promise<void>(() => {});
  }
  if (command === "grocy:compatibility:matrix") {
    const matrix = createGrocyApiCompatibilityMatrix();
    const outputPath = recordGrocyApiCompatibilityMatrix(matrix, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: matrix.summary });
    return;
  }
  if (command === "grocy:compatibility:deprecation-canary") {
    const report = createGrocyApiDeprecationCanaryReport();
    const outputPath = recordGrocyApiDeprecationCanaryReport(report, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: report.summary });
    return;
  }
  if (command === "grocy:coverage:playground") {
    const playground = createGrocyObjectCoveragePlayground();
    const outputPath = recordGrocyObjectCoveragePlayground(playground, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: playground.summary });
    return;
  }
  if (command === "grocy:export-config") {
    const exportData = await exportGrocyConfig(process.cwd());
    const outputPath = recordGrocyConfigExport(exportData, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, exportedAt: exportData.exportedAt, counts: exportData.counts, items: exportData.items.length });
    return;
  }
  if (command === "grocy:desired-state:lint") {
    const manifestPath = parseFlag("--manifest");
    const { report } = lintGrocyDesiredStateManifestFile(process.cwd(), manifestPath);
    const outputPath = recordGrocyDesiredStateManifestLintReport(report, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: report.summary });
    if (!report.summary.ready) {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "grocy:diff-config") {
    const manifestPath = parseFlag("--manifest");
    const { manifest, report } = lintGrocyDesiredStateManifestFile(process.cwd(), manifestPath);
    assertGrocyDesiredStateManifestLintReady(report);
    const exportPath = parseFlag("--export");
    const liveExport = exportPath ? loadGrocyConfigExport(exportPath) : await exportGrocyConfig(process.cwd());
    const plan = createGrocyConfigSyncPlan({
      manifest,
      liveExport,
      manifestPath: manifestPath ?? "registry/grocy/desired-state.json",
      exportPath,
    });
    const outputPath = recordGrocyConfigSyncPlan(plan, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: plan.summary });
    return;
  }
  if (command === "grocy:config:drift-trend") {
    const previousExportPath = parseFlag("--previous") ?? GROCY_CONFIG_PREVIOUS_EXPORT_PATH;
    const currentExportPath = parseFlag("--current") ?? GROCY_CONFIG_EXPORT_PATH;
    const report = createGrocyConfigDriftTrendReport({
      previousExport: loadGrocyConfigExport(previousExportPath),
      currentExport: loadGrocyConfigExport(currentExportPath),
      previousExportPath,
      currentExportPath,
    });
    const outputPath = recordGrocyConfigDriftTrendReport(report, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: report.summary, period: report.period });
    return;
  }
  if (command === "grocy:apply-config") {
    const planPath = parseFlag("--plan");
    if (!planPath) {
      throw new Error("Usage: grocy:apply-config -- --plan <path> --dry-run|--confirm-reviewed-write");
    }
    if (process.argv.includes("--dry-run")) {
      const report = createGrocyConfigApplyDryRunReport({
        plan: loadGrocyConfigSyncPlan(planPath),
        planPath,
      });
      const outputPath = recordGrocyConfigApplyDryRunReport(report, {
        outputPath: parseFlag("--output"),
        overwrite: process.argv.includes("--force") || !parseFlag("--output"),
      });
      printJson({ outputPath, summary: report.summary });
      return;
    }
    printJson(await applyGrocyConfigSyncPlan(planPath, process.cwd(), {
      confirmReviewedWrite: process.argv.includes("--confirm-reviewed-write"),
    }));
    return;
  }
  if (command === "grocy:backup:snapshot") {
    printJson(createGrocyBackupSnapshot(process.cwd()));
    return;
  }
  if (command === "grocy:backup:verify") {
    printJson(verifyGrocyBackupSnapshot(process.cwd(), {
      archivePath: parseFlag("--archive"),
      restoreDir: parseFlag("--restore-dir"),
      confirmRestoreWrite: process.argv.includes("--confirm-restore-write"),
    }));
    return;
  }
  if (command === "grocy:backup:receipt") {
    const receipt = createGrocyBackupIntegrityReceipt(process.cwd(), {
      archivePath: parseFlag("--archive"),
      manifestPath: parseFlag("--manifest"),
      restorePlanReportPath: parseFlag("--restore-plan-report"),
      restoreDrillReportPath: parseFlag("--restore-drill-report"),
    });
    const outputPath = recordGrocyBackupIntegrityReceipt(receipt, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: receipt.summary });
    if (receipt.summary.status !== "pass") {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "grocy:backup:receipt:verify") {
    const verification = verifyGrocyBackupIntegrityReceipt(process.cwd(), {
      receiptPath: parseFlag("--receipt"),
      manifestPath: parseFlag("--manifest"),
      restorePlanReportPath: parseFlag("--restore-plan-report"),
      restoreDrillReportPath: parseFlag("--restore-drill-report"),
    });
    printJson(verification);
    if (verification.summary.status !== "pass") {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "grocy:backup:restore-plan") {
    const restoreDir = parseFlag("--restore-dir");
    if (!restoreDir) {
      throw new Error("Usage: grocy:backup:restore-plan -- --restore-dir <path>");
    }
    const report = createGrocyBackupRestorePlanDryRunReport(process.cwd(), {
      archivePath: parseFlag("--archive"),
      restoreDir,
    });
    const outputPath = recordGrocyBackupRestorePlanDryRunReport(report, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: report.summary });
    if (report.summary.result !== "ready") {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "grocy:backup:restore-drill") {
    const report = createGrocyBackupRestoreDrillReport(process.cwd(), {
      restoreDir: parseFlag("--restore-dir") ?? DEFAULT_GROCY_BACKUP_RESTORE_DRILL_DIR,
    });
    const outputPath = recordGrocyBackupRestoreDrillReport(report, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: report.summary });
    if (report.summary.result !== "pass") {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "grocy:review:dashboard") {
    const dashboard = createGrocyReviewDashboardFromArtifacts(process.cwd(), {
      planPath: parseFlag("--plan"),
      applyDryRunReportPath: parseFlag("--dry-run-report"),
      driftTrendReportPath: parseFlag("--drift-trend-report"),
      diagnosticsPath: parseFlag("--diagnostics"),
      backupManifestPath: parseFlag("--backup-manifest"),
      mockSmokeReportPath: parseFlag("--smoke-report"),
    });
    const outputPath = recordGrocyReviewDashboard(dashboard, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath });
    return;
  }
  if (command === "grocy:artifacts:audit-redaction") {
    const audit = auditGrocyPublicArtifacts({
      baseDir: process.cwd(),
      paths: parseFlags("--path"),
    });
    const outputPath = recordGrocyPublicArtifactRedactionAudit(audit, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: audit.summary });
    if (audit.summary.findingCount > 0) {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "grocy:support:bundle") {
    const bundle = createGrocySupportBundle({
      baseDir: process.cwd(),
      artifactPaths: parseFlags("--artifact").length > 0 ? parseFlags("--artifact") : undefined,
    });
    const outputPath = recordGrocySupportBundle(bundle, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: bundle.summary });
    if (bundle.summary.readiness !== "ready_to_share") {
      process.exitCode = 1;
    }
    return;
  }
  throw new Error("Unsupported command.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
