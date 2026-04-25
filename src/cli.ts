#!/usr/bin/env node

import {
  createGrocyApiTraceHarnessFromLiveConfig,
  createGrocyApiTraceHarnessFromSyntheticFixture,
  recordGrocyApiTraceHarness,
} from "./api-trace-harness.js";
import {
  applyGrocyConfigSyncPlan,
  createGrocyConfigApplyDryRunReport,
  createGrocyConfigDiffPreviewReport,
  createGrocyConfigDriftTrendReport,
  createGrocyConfigSyncPlan,
  exportGrocyConfig,
  GROCY_CONFIG_EXPORT_PATH,
  GROCY_CONFIG_PREVIOUS_EXPORT_PATH,
  loadGrocyConfigExport,
  loadGrocyConfigSyncPlan,
  recordGrocyConfigDiffPreviewReport,
  recordGrocyConfigDriftTrendReport,
  recordGrocyConfigApplyDryRunReport,
  recordGrocyConfigExport,
  recordGrocyConfigSyncPlan,
} from "./config-sync.js";
import {
  recordGrocyConfigMigrationDoctorReport,
  runGrocyConfigMigrationDoctor,
} from "./config-migration-doctor.js";
import {
  assertGrocyDesiredStateManifestLintReady,
  lintGrocyDesiredStateManifestFile,
  recordGrocyDesiredStateManifestLintReport,
} from "./desired-state-lint.js";
import { handleGrocyBackupCommand } from "./backup-cli.js";
import { createGrocyDemoEnvironment, recordGrocyDemoEnvironmentReport } from "./demo-lab.js";
import {
  createGrocyReadmeQuickstartProofReceipt,
  recordGrocyReadmeQuickstartProofReceipt,
} from "./quickstart-proof.js";
import {
  createGrocyEvaluatorStarterPack,
  recordGrocyEvaluatorStarterPack,
} from "./evaluator-starter-pack.js";
import { getGrocyConfigStatus, runGrocyHealthCheck } from "./grocy-live.js";
import { recordGrocyHealthBadgeArtifact, runGrocyHealthBadge } from "./health-badge.js";
import { recordGrocyHealthDiagnosticsArtifact, runGrocyHealthDiagnostics } from "./health-diagnostics.js";
import { recordGrocyInventorySnapshot, runGrocyInventorySnapshot } from "./inventory-snapshot.js";
import { initializeGrocyWorkspace } from "./init-workspace.js";
import { recordGrocyInstallDoctorArtifact, runGrocyInstallDoctor } from "./install-doctor.js";
import { createGrocyApiCompatibilityMatrix, recordGrocyApiCompatibilityMatrix } from "./compatibility-matrix.js";
import { createGrocyApiDeprecationCanaryReport, recordGrocyApiDeprecationCanaryReport } from "./deprecation-canary.js";
import { startGrocyFixtureServer } from "./fixture-server.js";
import { recordGrocyMockSmokeReport, runGrocyMockSmokeTest } from "./mock-smoke.js";
import { createGrocyObjectCoveragePlayground, recordGrocyObjectCoveragePlayground } from "./object-coverage-playground.js";
import {
  createGrocySchemaFixtureCaptureFromLiveConfig,
  createGrocySchemaFixtureCaptureFromSyntheticFixture,
  recordGrocySchemaFixtureCapture,
} from "./schema-fixture-capture.js";
import { auditGrocyPublicArtifacts, recordGrocyPublicArtifactRedactionAudit } from "./redaction-audit.js";
import { createGrocyReviewDashboardFromArtifacts, recordGrocyReviewDashboard } from "./review-dashboard.js";
import { createGrocyMockSmokeRunReceipt, recordGrocyToolkitRunReceipt } from "./run-receipt.js";
import {
  recordGrocySecretRotationSmokeReport,
  runGrocySecretRotationSmokeTest,
} from "./secret-rotation-smoke.js";
import { recordGrocyShoppingStateExport, runGrocyShoppingStateExport } from "./shopping-state-export.js";
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
  if (command === "grocy:init:workspace") {
    printJson(initializeGrocyWorkspace(process.cwd(), {
      overwrite: process.argv.includes("--force"),
    }));
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
    printJson({ outputPath, summary: artifact.summary, triage: artifact.triage, nextActions: artifact.nextActions });
    return;
  }
  if (command === "grocy:inventory:snapshot") {
    const snapshot = await runGrocyInventorySnapshot(process.cwd());
    const outputPath = recordGrocyInventorySnapshot(snapshot, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: snapshot.summary });
    return;
  }
  if (command === "grocy:shopping-state:export") {
    const shoppingState = await runGrocyShoppingStateExport(process.cwd());
    const outputPath = recordGrocyShoppingStateExport(shoppingState, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: shoppingState.summary });
    return;
  }
  if (command === "grocy:install:doctor") {
    const artifact = runGrocyInstallDoctor(process.cwd());
    const outputPath = recordGrocyInstallDoctorArtifact(artifact, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: artifact.summary, nextActions: artifact.nextActions });
    if (artifact.summary.failureCount > 0) {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "grocy:demo:lab") {
    const report = await createGrocyDemoEnvironment(process.cwd());
    const outputPath = recordGrocyDemoEnvironmentReport(report, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: report.summary, artifacts: report.artifacts });
    if (report.summary.result !== "pass") {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "grocy:quickstart:proof") {
    const receipt = await createGrocyReadmeQuickstartProofReceipt(process.cwd());
    const outputPath = recordGrocyReadmeQuickstartProofReceipt(receipt, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: receipt.summary, recipes: receipt.recipes });
    if (receipt.summary.status !== "pass") {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "grocy:evaluator:starter-pack") {
    const starterPack = await createGrocyEvaluatorStarterPack(process.cwd());
    const outputPath = recordGrocyEvaluatorStarterPack(starterPack, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: starterPack.summary, entrypoints: starterPack.entrypoints });
    if (starterPack.summary.status !== "pass") {
      process.exitCode = 1;
    }
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
  if (command === "grocy:smoke:secret-rotation") {
    const report = await runGrocySecretRotationSmokeTest(process.cwd());
    const outputPath = recordGrocySecretRotationSmokeReport(report, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: report.summary });
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
  if (command === "grocy:compatibility:schema-capture") {
    if (parseFlag("--fixture") && parseFlag("--config")) {
      throw new Error("Use either --fixture <id> or --config <path>, not both.");
    }
    const capture = parseFlag("--config")
      ? await createGrocySchemaFixtureCaptureFromLiveConfig(process.cwd(), { configPath: parseFlag("--config") })
      : createGrocySchemaFixtureCaptureFromSyntheticFixture(parseFlag("--fixture"));
    const outputPath = recordGrocySchemaFixtureCapture(capture, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: capture.summary, source: capture.source });
    return;
  }
  if (command === "grocy:bug-report:trace") {
    if (parseFlag("--fixture") && parseFlag("--config")) {
      throw new Error("Use either --fixture <id> or --config <path>, not both.");
    }
    const trace = parseFlag("--config")
      ? await createGrocyApiTraceHarnessFromLiveConfig(process.cwd(), { configPath: parseFlag("--config") })
      : createGrocyApiTraceHarnessFromSyntheticFixture(parseFlag("--fixture"));
    const outputPath = recordGrocyApiTraceHarness(trace, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: trace.summary, source: trace.source });
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
    const previewReport = createGrocyConfigDiffPreviewReport({ plan });
    const outputPath = recordGrocyConfigSyncPlan(plan, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    const previewOutputPath = recordGrocyConfigDiffPreviewReport(previewReport, {
      outputPath: parseFlag("--preview-output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--preview-output"),
    });
    printJson({ outputPath, previewOutputPath, summary: plan.summary });
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
  if (command === "grocy:config:migration-doctor") {
    const report = runGrocyConfigMigrationDoctor(process.cwd(), {
      manifestPath: parseFlag("--manifest"),
      previousExportPath: parseFlag("--previous"),
      currentExportPath: parseFlag("--current"),
      planPath: parseFlag("--plan"),
    });
    const outputPath = recordGrocyConfigMigrationDoctorReport(report, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, summary: report.summary });
    if (report.summary.result !== "ready") {
      process.exitCode = 1;
    }
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
  if (handleGrocyBackupCommand(command, {
    argv: process.argv,
    baseDir: process.cwd(),
    parseFlag,
    printJson,
  })) {
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
