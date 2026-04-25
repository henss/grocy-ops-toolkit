import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  createGrocyConfigDriftTrendReport,
  createGrocyConfigSyncPlan,
  GROCY_CONFIG_EXPORT_PATH,
  GROCY_CONFIG_MANIFEST_PATH,
  GROCY_CONFIG_PREVIOUS_EXPORT_PATH,
  loadGrocyConfigExport,
  loadGrocyConfigManifest,
  loadGrocyConfigSyncPlan,
} from "./config-sync.js";
import type {
  GrocyConfigDriftTrendItem,
  GrocyConfigDriftTrendReport,
  GrocyConfigExport,
  GrocyConfigManifest,
  GrocyConfigSyncPlan,
} from "./schemas.js";

export const GROCY_CONFIG_MIGRATION_DOCTOR_REPORT_PATH = path.join("data", "grocy-config-migration-doctor-report.json");

export const GrocyConfigMigrationDoctorSeveritySchema = z.enum(["info", "warning", "error"]);
export const GrocyConfigMigrationDoctorFindingCodeSchema = z.enum([
  "migration_ready",
  "grocy_version_changed",
  "repo_managed_item_removed",
  "repo_managed_item_changed",
  "sync_plan_create_pending",
  "sync_plan_update_pending",
  "sync_plan_manual_review",
]);

export const GrocyConfigMigrationDoctorFindingSchema = z.object({
  severity: GrocyConfigMigrationDoctorSeveritySchema,
  code: GrocyConfigMigrationDoctorFindingCodeSchema,
  message: z.string().min(1),
  itemKeys: z.array(z.string().min(1)).default([]),
  evidence: z.array(z.string().min(1)).default([]),
  recommendedAction: z.string().min(1),
});

export const GrocyConfigMigrationDoctorReportSchema = z.object({
  kind: z.literal("grocy_config_migration_doctor_report"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  artifacts: z.object({
    manifestPath: z.string().min(1),
    previousExportPath: z.string().min(1),
    currentExportPath: z.string().min(1),
    planPath: z.string().min(1).optional(),
  }),
  upgrade: z.object({
    previousExportedAt: z.string().min(1),
    currentExportedAt: z.string().min(1),
    previousGrocyVersion: z.string().min(1).optional(),
    currentGrocyVersion: z.string().min(1).optional(),
  }),
  summary: z.object({
    result: z.enum(["ready", "review_required"]),
    infoCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    repoManagedItemCount: z.number().int().nonnegative(),
    repoManagedUpgradeChangeCount: z.number().int().nonnegative(),
    createCount: z.number().int().nonnegative(),
    updateCount: z.number().int().nonnegative(),
    manualReviewCount: z.number().int().nonnegative(),
  }),
  planSummary: z.object({
    create: z.number().int().nonnegative(),
    update: z.number().int().nonnegative(),
    noop: z.number().int().nonnegative(),
    manualReview: z.number().int().nonnegative(),
  }),
  driftSummary: z.object({
    added: z.number().int().nonnegative(),
    removed: z.number().int().nonnegative(),
    changed: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
  }),
  findings: z.array(GrocyConfigMigrationDoctorFindingSchema).default([]),
  reviewNotes: z.array(z.string().min(1)).default([]),
});

export type GrocyConfigMigrationDoctorSeverity = z.infer<typeof GrocyConfigMigrationDoctorSeveritySchema>;
export type GrocyConfigMigrationDoctorFindingCode = z.infer<typeof GrocyConfigMigrationDoctorFindingCodeSchema>;
export type GrocyConfigMigrationDoctorFinding = z.infer<typeof GrocyConfigMigrationDoctorFindingSchema>;
export type GrocyConfigMigrationDoctorReport = z.infer<typeof GrocyConfigMigrationDoctorReportSchema>;

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function createFinding(input: Omit<GrocyConfigMigrationDoctorFinding, "itemKeys" | "evidence"> & {
  itemKeys?: string[];
  evidence?: string[];
}): GrocyConfigMigrationDoctorFinding {
  return {
    ...input,
    itemKeys: input.itemKeys ?? [],
    evidence: input.evidence ?? [],
  };
}

function summarizeFindings(findings: GrocyConfigMigrationDoctorFinding[]): GrocyConfigMigrationDoctorReport["summary"] {
  return {
    result: findings.some((finding) => finding.severity !== "info") ? "review_required" : "ready",
    infoCount: findings.filter((finding) => finding.severity === "info").length,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    errorCount: findings.filter((finding) => finding.severity === "error").length,
    repoManagedItemCount: 0,
    repoManagedUpgradeChangeCount: 0,
    createCount: 0,
    updateCount: 0,
    manualReviewCount: 0,
  };
}

function collectRepoManagedUpgradeChanges(
  report: GrocyConfigDriftTrendReport,
  repoManagedKeys: Set<string>,
): GrocyConfigDriftTrendItem[] {
  return report.items.filter((item) => repoManagedKeys.has(item.key));
}

function createReviewNotes(report: GrocyConfigMigrationDoctorReport): string[] {
  return [
    "This migration doctor reads manifest, export, and sync-plan artifacts only. It does not send live Grocy write requests.",
    report.artifacts.planPath
      ? `Review ${report.artifacts.planPath} together with ${report.artifacts.currentExportPath} before any confirmed apply step.`
      : `Review the computed sync plan against ${report.artifacts.currentExportPath} before any confirmed apply step.`,
    "Treat Grocy version changes, repo-managed drift, and manual-review items as upgrade checkpoints for the GitOps migration.",
  ];
}

function buildFindings(input: {
  previousExport: GrocyConfigExport;
  currentExport: GrocyConfigExport;
  plan: GrocyConfigSyncPlan;
  driftReport: GrocyConfigDriftTrendReport;
  repoManagedKeys: Set<string>;
}): GrocyConfigMigrationDoctorFinding[] {
  const findings: GrocyConfigMigrationDoctorFinding[] = [];
  const previousVersion = input.previousExport.source.grocyVersion;
  const currentVersion = input.currentExport.source.grocyVersion;

  if (previousVersion && currentVersion && previousVersion !== currentVersion) {
    findings.push(createFinding({
      severity: "warning",
      code: "grocy_version_changed",
      message: `Grocy version changed from ${previousVersion} to ${currentVersion} across the compared exports.`,
      evidence: [
        `Previous export: ${input.previousExport.exportedAt}`,
        `Current export: ${input.currentExport.exportedAt}`,
      ],
      recommendedAction: "Review the repo-managed config diff and migration doctor findings before approving the upgrade PR.",
    }));
  }

  const repoManagedRemoved = input.driftReport.items
    .filter((item) => item.status === "removed" && input.repoManagedKeys.has(item.key));
  if (repoManagedRemoved.length > 0) {
    findings.push(createFinding({
      severity: "error",
      code: "repo_managed_item_removed",
      message: `${repoManagedRemoved.length} repo-managed item(s) disappeared between the previous and current exports.`,
      itemKeys: repoManagedRemoved.map((item) => item.key),
      evidence: repoManagedRemoved.map((item) => `${item.entity}:${item.name}`),
      recommendedAction: "Confirm whether the upgrade removed or renamed these records, then update desired state or add migration follow-up before apply.",
    }));
  }

  const repoManagedChanged = input.driftReport.items
    .filter((item) => item.status === "changed" && input.repoManagedKeys.has(item.key));
  if (repoManagedChanged.length > 0) {
    findings.push(createFinding({
      severity: "warning",
      code: "repo_managed_item_changed",
      message: `${repoManagedChanged.length} repo-managed item(s) changed across the compared exports.`,
      itemKeys: repoManagedChanged.map((item) => item.key),
      evidence: repoManagedChanged.map((item) => `${item.key}: ${item.changedFields.join(", ")}`),
      recommendedAction: "Review these changed fields as migration-sensitive config before approving a follow-up sync apply.",
    }));
  }

  const createItems = input.plan.actions.filter((item) => item.action === "create");
  if (createItems.length > 0) {
    findings.push(createFinding({
      severity: "warning",
      code: "sync_plan_create_pending",
      message: `${createItems.length} repo-managed item(s) would be created against the current export after the upgrade.`,
      itemKeys: createItems.map((item) => item.key),
      evidence: createItems.map((item) => item.reason),
      recommendedAction: "Confirm these creates are intentional migration outcomes before running a reviewed write.",
    }));
  }

  const updateItems = input.plan.actions.filter((item) => item.action === "update");
  if (updateItems.length > 0) {
    findings.push(createFinding({
      severity: "warning",
      code: "sync_plan_update_pending",
      message: `${updateItems.length} repo-managed item(s) still differ from the current export and would require updates.`,
      itemKeys: updateItems.map((item) => item.key),
      evidence: updateItems.map((item) => `${item.key}: ${item.changes.map((change) => change.field).join(", ")}`),
      recommendedAction: "Review the pending updates and confirm they still match the post-upgrade desired state before apply.",
    }));
  }

  const manualReviewItems = input.plan.actions.filter((item) => item.action === "manual_review");
  if (manualReviewItems.length > 0) {
    findings.push(createFinding({
      severity: "error",
      code: "sync_plan_manual_review",
      message: `${manualReviewItems.length} item(s) require manual review before a safe GitOps apply.`,
      itemKeys: manualReviewItems.map((item) => item.key),
      evidence: manualReviewItems.map((item) => item.reason),
      recommendedAction: "Resolve duplicate matches or ownership ambiguity before approving any write step.",
    }));
  }

  if (findings.length === 0) {
    findings.push(createFinding({
      severity: "info",
      code: "migration_ready",
      message: "No migration-specific upgrade findings were detected in the compared config artifacts.",
      recommendedAction: "Keep the report with the upgrade review so future changes can be compared against the same baseline.",
    }));
  }

  return findings;
}

function resolvePlan(input: {
  manifest: GrocyConfigManifest;
  manifestPath: string;
  currentExport: GrocyConfigExport;
  currentExportPath: string;
  plan?: GrocyConfigSyncPlan;
}): GrocyConfigSyncPlan {
  if (input.plan) {
    return input.plan;
  }
  return createGrocyConfigSyncPlan({
    manifest: input.manifest,
    liveExport: input.currentExport,
    manifestPath: input.manifestPath,
    exportPath: input.currentExportPath,
  });
}

export function createGrocyConfigMigrationDoctorReport(input: {
  manifest: GrocyConfigManifest;
  manifestPath: string;
  previousExport: GrocyConfigExport;
  previousExportPath: string;
  currentExport: GrocyConfigExport;
  currentExportPath: string;
  plan?: GrocyConfigSyncPlan;
  planPath?: string;
  generatedAt?: string;
}): GrocyConfigMigrationDoctorReport {
  const plan = resolvePlan({
    manifest: input.manifest,
    manifestPath: input.manifestPath,
    currentExport: input.currentExport,
    currentExportPath: input.currentExportPath,
    plan: input.plan,
  });
  const driftReport = createGrocyConfigDriftTrendReport({
    previousExport: input.previousExport,
    currentExport: input.currentExport,
    previousExportPath: input.previousExportPath,
    currentExportPath: input.currentExportPath,
    generatedAt: input.generatedAt,
  });
  const repoManagedKeys = new Set(
    input.manifest.items
      .filter((item) => item.ownership === "repo_managed")
      .map((item) => item.key),
  );
  const repoManagedUpgradeChanges = collectRepoManagedUpgradeChanges(driftReport, repoManagedKeys);
  const findings = buildFindings({
    previousExport: input.previousExport,
    currentExport: input.currentExport,
    plan,
    driftReport,
    repoManagedKeys,
  });
  const summary = summarizeFindings(findings);

  return GrocyConfigMigrationDoctorReportSchema.parse({
    kind: "grocy_config_migration_doctor_report",
    version: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    artifacts: {
      manifestPath: input.manifestPath,
      previousExportPath: input.previousExportPath,
      currentExportPath: input.currentExportPath,
      planPath: input.planPath,
    },
    upgrade: {
      previousExportedAt: input.previousExport.exportedAt,
      currentExportedAt: input.currentExport.exportedAt,
      previousGrocyVersion: input.previousExport.source.grocyVersion,
      currentGrocyVersion: input.currentExport.source.grocyVersion,
    },
    summary: {
      ...summary,
      repoManagedItemCount: repoManagedKeys.size,
      repoManagedUpgradeChangeCount: repoManagedUpgradeChanges.length,
      createCount: plan.summary.create,
      updateCount: plan.summary.update,
      manualReviewCount: plan.summary.manualReview,
    },
    planSummary: plan.summary,
    driftSummary: driftReport.summary,
    findings,
    reviewNotes: [],
  });
}

export function runGrocyConfigMigrationDoctor(
  baseDir: string = process.cwd(),
  options: {
    manifestPath?: string;
    previousExportPath?: string;
    currentExportPath?: string;
    planPath?: string;
    generatedAt?: string;
  } = {},
): GrocyConfigMigrationDoctorReport {
  const manifestPath = options.manifestPath ?? GROCY_CONFIG_MANIFEST_PATH;
  const previousExportPath = options.previousExportPath ?? GROCY_CONFIG_PREVIOUS_EXPORT_PATH;
  const currentExportPath = options.currentExportPath ?? GROCY_CONFIG_EXPORT_PATH;
  const manifest = loadGrocyConfigManifest(baseDir, manifestPath);
  const previousExport = loadGrocyConfigExport(path.resolve(baseDir, previousExportPath));
  const currentExport = loadGrocyConfigExport(path.resolve(baseDir, currentExportPath));
  const plan = options.planPath ? loadGrocyConfigSyncPlan(path.resolve(baseDir, options.planPath)) : undefined;

  const report = createGrocyConfigMigrationDoctorReport({
    manifest,
    manifestPath,
    previousExport,
    previousExportPath,
    currentExport,
    currentExportPath,
    plan,
    planPath: options.planPath,
    generatedAt: options.generatedAt,
  });

  return {
    ...report,
    reviewNotes: createReviewNotes(report),
  };
}

export function recordGrocyConfigMigrationDoctorReport(
  report: GrocyConfigMigrationDoctorReport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_CONFIG_MIGRATION_DOCTOR_REPORT_PATH),
    report,
    options.overwrite ?? true,
  );
}
