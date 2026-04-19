#!/usr/bin/env node

import {
  applyGrocyConfigSyncPlan,
  createGrocyConfigApplyDryRunReport,
  createGrocyConfigSyncPlan,
  exportGrocyConfig,
  loadGrocyConfigExport,
  loadGrocyConfigManifest,
  loadGrocyConfigSyncPlan,
  recordGrocyConfigApplyDryRunReport,
  recordGrocyConfigExport,
  recordGrocyConfigSyncPlan,
} from "./config-sync.js";
import { createGrocyBackupSnapshot, verifyGrocyBackupSnapshot } from "./backups.js";
import { getGrocyConfigStatus, runGrocyHealthCheck } from "./grocy-live.js";
import { recordGrocyHealthDiagnosticsArtifact, runGrocyHealthDiagnostics } from "./health-diagnostics.js";
import { createGrocyApiCompatibilityMatrix, recordGrocyApiCompatibilityMatrix } from "./compatibility-matrix.js";
import { recordGrocyMockSmokeReport, runGrocyMockSmokeTest } from "./mock-smoke.js";
import { auditGrocyPublicArtifacts, recordGrocyPublicArtifactRedactionAudit } from "./redaction-audit.js";
import { createGrocyReviewDashboardFromArtifacts, recordGrocyReviewDashboard } from "./review-dashboard.js";

function parseFlag(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseFlags(flag: string): string[] {
  return process.argv.flatMap((value, index) => value === flag && process.argv[index + 1] ? [process.argv[index + 1]] : []);
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
    printJson({ outputPath, summary: report.summary });
    return;
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
  if (command === "grocy:export-config") {
    const exportData = await exportGrocyConfig(process.cwd());
    const outputPath = recordGrocyConfigExport(exportData, {
      outputPath: parseFlag("--output"),
      overwrite: process.argv.includes("--force") || !parseFlag("--output"),
    });
    printJson({ outputPath, exportedAt: exportData.exportedAt, counts: exportData.counts, items: exportData.items.length });
    return;
  }
  if (command === "grocy:diff-config") {
    const manifestPath = parseFlag("--manifest");
    const exportPath = parseFlag("--export");
    const liveExport = exportPath ? loadGrocyConfigExport(exportPath) : await exportGrocyConfig(process.cwd());
    const plan = createGrocyConfigSyncPlan({
      manifest: loadGrocyConfigManifest(process.cwd(), manifestPath),
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
  if (command === "grocy:review:dashboard") {
    const dashboard = createGrocyReviewDashboardFromArtifacts(process.cwd(), {
      planPath: parseFlag("--plan"),
      applyDryRunReportPath: parseFlag("--dry-run-report"),
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
  throw new Error("Unsupported command.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
