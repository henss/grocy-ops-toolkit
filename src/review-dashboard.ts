import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  GROCY_BACKUP_MANIFEST_PATH,
} from "./backups.js";
import {
  GROCY_CONFIG_APPLY_DRY_RUN_REPORT_PATH,
  GROCY_CONFIG_DRIFT_TREND_REPORT_PATH,
  GROCY_CONFIG_PLAN_PATH,
} from "./config-sync.js";
import { GROCY_HEALTH_DIAGNOSTICS_PATH } from "./health-diagnostics.js";
import { GROCY_MOCK_SMOKE_REPORT_PATH } from "./mock-smoke.js";
import {
  GrocyBackupManifestSchema,
  GrocyConfigApplyDryRunReportSchema,
  GrocyConfigDriftTrendReportSchema,
  GrocyConfigSyncPlanSchema,
  GrocyHealthDiagnosticsArtifactSchema,
  type GrocyBackupManifest,
  type GrocyConfigApplyDryRunReport,
  type GrocyConfigApplyDryRunReportItem,
  type GrocyConfigDriftTrendReport,
  type GrocyConfigSyncPlan,
  type GrocyHealthDiagnosticsArtifact,
} from "./schemas.js";

export const GROCY_REVIEW_DASHBOARD_PATH = path.join("data", "grocy-review-dashboard.md");

const GrocyMockSmokeReportSchema = z.object({
  kind: z.literal("grocy_mock_smoke_report"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  summary: z.object({
    result: z.enum(["pass", "fail"]),
    checkCount: z.number().int().nonnegative(),
    failureCount: z.number().int().nonnegative(),
  }),
  checks: z.array(z.object({
    id: z.enum(["health", "export", "plan", "apply_dry_run"]),
    status: z.enum(["pass", "fail"]),
    message: z.string().min(1),
  })).default([]),
  artifacts: z.object({
    planPath: z.string().min(1),
    dryRunReportPath: z.string().min(1),
  }),
});

type GrocyMockSmokeReport = z.infer<typeof GrocyMockSmokeReportSchema>;

export interface GrocyReviewDashboardArtifacts {
  plan?: GrocyConfigSyncPlan;
  applyDryRunReport?: GrocyConfigApplyDryRunReport;
  driftTrendReport?: GrocyConfigDriftTrendReport;
  diagnostics?: GrocyHealthDiagnosticsArtifact;
  backupManifest?: GrocyBackupManifest;
  mockSmokeReport?: GrocyMockSmokeReport;
}

export interface GrocyReviewDashboardArtifactPaths {
  planPath?: string;
  applyDryRunReportPath?: string;
  driftTrendReportPath?: string;
  diagnosticsPath?: string;
  backupManifestPath?: string;
  mockSmokeReportPath?: string;
}

export interface GrocyReviewDashboardInput extends GrocyReviewDashboardArtifacts {
  generatedAt?: string;
  artifactPaths?: GrocyReviewDashboardArtifactPaths;
  baseDir?: string;
}

function writeMarkdownFile(filePath: string, value: string, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
  return filePath;
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

function loadOptionalArtifact<T>(
  baseDir: string,
  explicitPath: string | undefined,
  defaultPath: string,
  schema: z.ZodType<T>,
): T | undefined {
  const artifactPath = path.resolve(baseDir, explicitPath ?? defaultPath);
  if (!fs.existsSync(artifactPath)) {
    if (explicitPath) {
      throw new Error(`Artifact path does not exist: ${explicitPath}`);
    }
    return undefined;
  }
  return schema.parse(readJsonFile(artifactPath));
}

function isPathInside(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function displayArtifactPath(baseDir: string, value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    return value;
  }
  const absoluteValue = path.resolve(baseDir, value);
  return isPathInside(baseDir, absoluteValue) ? path.relative(baseDir, absoluteValue).replace(/\\/g, "/") : "<external-path>";
}

function escapeCell(value: unknown): string {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function plural(count: number, singular: string, pluralValue = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function summarizeApplyRisk(report: GrocyConfigApplyDryRunReport | undefined): string {
  if (!report) {
    return "No apply dry-run report was loaded.";
  }
  const writeCount = report.summary.wouldCreate + report.summary.wouldUpdate;
  if (report.summary.manualReview > 0) {
    return `${plural(report.summary.manualReview, "item")} ${report.summary.manualReview === 1 ? "requires" : "require"} manual review before apply.`;
  }
  if (writeCount > 0) {
    return `${plural(writeCount, "reviewed write")} would run if confirmed.`;
  }
  return "No reviewed writes are pending.";
}

function renderChangeFields(item: GrocyConfigApplyDryRunReportItem): string {
  if (item.changes.length === 0) {
    return "-";
  }
  return item.changes.map((change) => change.field).join(", ");
}

function renderApplyItems(report: GrocyConfigApplyDryRunReport | undefined): string[] {
  if (!report || report.items.length === 0) {
    return ["No apply dry-run items were loaded."];
  }
  const reviewItems = report.items.filter((item) => item.action !== "skipped");
  if (reviewItems.length === 0) {
    return ["All apply dry-run items were skipped."];
  }
  return [
    "| Action | Key | Entity | Reason | Change fields |",
    "| --- | --- | --- | --- | --- |",
    ...reviewItems.map((item) =>
      `| ${escapeCell(item.action)} | ${escapeCell(item.key)} | ${escapeCell(item.entity)} | ${escapeCell(item.reason)} | ${escapeCell(renderChangeFields(item))} |`,
    ),
  ];
}

function renderDriftTrend(report: GrocyConfigDriftTrendReport | undefined): string[] {
  if (!report) {
    return ["No config drift trend report was loaded."];
  }
  const changedCount = report.summary.added + report.summary.removed + report.summary.changed;
  const header = `Period: ${report.period.previousExportedAt} to ${report.period.currentExportedAt}. Changed records: ${changedCount}; unchanged: ${report.summary.unchanged}.`;
  if (report.items.length === 0) {
    return [header, "No drift items were detected between the loaded exports."];
  }
  return [
    header,
    "",
    "| Status | Key | Entity | Change fields |",
    "| --- | --- | --- | --- |",
    ...report.items.map((item) =>
      `| ${escapeCell(item.status)} | ${escapeCell(item.key)} | ${escapeCell(item.entity)} | ${escapeCell(item.changedFields.length > 0 ? item.changedFields.join(", ") : "-")} |`,
    ),
  ];
}

function renderManualReview(plan: GrocyConfigSyncPlan | undefined): string[] {
  const manualReviewItems = plan?.actions.filter((item) => item.action === "manual_review") ?? [];
  if (manualReviewItems.length === 0) {
    return ["No manual-review plan actions were loaded."];
  }
  return [
    "| Key | Entity | Reason |",
    "| --- | --- | --- |",
    ...manualReviewItems.map((item) =>
      `| ${escapeCell(item.key)} | ${escapeCell(item.entity)} | ${escapeCell(item.reason)} |`,
    ),
  ];
}

function renderDiagnostics(diagnostics: GrocyHealthDiagnosticsArtifact | undefined): string[] {
  if (!diagnostics) {
    return ["No health diagnostics artifact was loaded."];
  }
  return [
    `Result: ${diagnostics.summary.result}; failures: ${diagnostics.summary.failureCount}; warnings: ${diagnostics.summary.warningCount}.`,
    "",
    "| Severity | Code | Action |",
    "| --- | --- | --- |",
    ...diagnostics.diagnostics.map((item) =>
      `| ${escapeCell(item.severity)} | ${escapeCell(item.code)} | ${escapeCell(item.agentAction)} |`,
    ),
  ];
}

function renderBackups(manifest: GrocyBackupManifest | undefined): string[] {
  if (!manifest || manifest.records.length === 0) {
    return ["No backup manifest records were loaded."];
  }
  const latest = manifest.records[0];
  const lines = [
    `Latest record: ${latest.id}; files: ${latest.fileCount}; bytes: ${latest.totalBytes}; restore test: ${latest.restoreTestStatus}.`,
    `Location label: ${latest.locationLabel}.`,
  ];
  if (latest.restoreFailureCategory) {
    lines.push(`Restore failure category: ${latest.restoreFailureCategory}.`);
  }
  return lines;
}

function renderSmoke(report: GrocyMockSmokeReport | undefined): string[] {
  if (!report) {
    return ["No mock smoke report was loaded."];
  }
  return [
    `Result: ${report.summary.result}; checks: ${report.summary.checkCount}; failures: ${report.summary.failureCount}.`,
    "",
    "| Check | Status | Message |",
    "| --- | --- | --- |",
    ...report.checks.map((check) =>
      `| ${escapeCell(check.id)} | ${escapeCell(check.status)} | ${escapeCell(check.message)} |`,
    ),
  ];
}

function createSection(title: string, lines: string[]): string[] {
  return ["", `## ${title}`, "", ...lines];
}

export function createGrocyReviewDashboard(input: GrocyReviewDashboardInput = {}): string {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const baseDir = input.baseDir ?? process.cwd();
  const loadedArtifacts = [
    input.plan ? "config sync plan" : undefined,
    input.applyDryRunReport ? "apply dry-run report" : undefined,
    input.driftTrendReport ? "config drift trend report" : undefined,
    input.diagnostics ? "health diagnostics" : undefined,
    input.backupManifest ? "backup manifest" : undefined,
    input.mockSmokeReport ? "mock smoke report" : undefined,
  ].filter((item): item is string => Boolean(item));

  const dashboardStatus = input.diagnostics?.summary.result === "fail" || input.mockSmokeReport?.summary.result === "fail"
    ? "needs attention"
    : input.applyDryRunReport?.summary.manualReview || input.plan?.summary.manualReview
      ? "needs review"
      : "reviewable";

  const sections: string[] = [];
  if (input.applyDryRunReport) {
    sections.push(...createSection("Planned Apply Review", renderApplyItems(input.applyDryRunReport)));
  }
  if (input.plan) {
    sections.push(...createSection("Manual Review Reasons", renderManualReview(input.plan)));
  }
  if (input.driftTrendReport) {
    sections.push(...createSection("Config Drift Trend", renderDriftTrend(input.driftTrendReport)));
  }
  if (input.diagnostics) {
    sections.push(...createSection("Health Diagnostics", renderDiagnostics(input.diagnostics)));
  }
  if (input.backupManifest) {
    sections.push(...createSection("Backup Verification", renderBackups(input.backupManifest)));
  }
  if (input.mockSmokeReport) {
    sections.push(...createSection("Mock Smoke Check", renderSmoke(input.mockSmokeReport)));
  }

  return [
    "# Grocy Review Dashboard",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "## Review Status",
    "",
    `Status: ${dashboardStatus}.`,
    `Loaded artifacts: ${loadedArtifacts.length > 0 ? loadedArtifacts.join(", ") : "none"}.`,
    summarizeApplyRisk(input.applyDryRunReport),
    "",
    "## Artifact Sources",
    "",
    `- Config sync plan: ${displayArtifactPath(baseDir, input.artifactPaths?.planPath) ?? "not loaded"}`,
    `- Apply dry-run report: ${displayArtifactPath(baseDir, input.artifactPaths?.applyDryRunReportPath) ?? "not loaded"}`,
    `- Config drift trend report: ${displayArtifactPath(baseDir, input.artifactPaths?.driftTrendReportPath) ?? "not loaded"}`,
    `- Health diagnostics: ${displayArtifactPath(baseDir, input.artifactPaths?.diagnosticsPath) ?? "not loaded"}`,
    `- Backup manifest: ${displayArtifactPath(baseDir, input.artifactPaths?.backupManifestPath) ?? "not loaded"}`,
    `- Mock smoke report: ${displayArtifactPath(baseDir, input.artifactPaths?.mockSmokeReportPath) ?? "not loaded"}`,
    ...sections,
    "",
  ].join("\n");
}

export function createGrocyReviewDashboardFromArtifacts(
  baseDir: string = process.cwd(),
  options: GrocyReviewDashboardArtifactPaths & { generatedAt?: string } = {},
): string {
  const useDefaults = [
    options.planPath,
    options.applyDryRunReportPath,
    options.driftTrendReportPath,
    options.diagnosticsPath,
    options.backupManifestPath,
    options.mockSmokeReportPath,
  ].every((value) => value === undefined);
  const artifacts: GrocyReviewDashboardArtifacts = {
    plan: loadOptionalArtifact(
      baseDir,
      options.planPath,
      useDefaults ? GROCY_CONFIG_PLAN_PATH : "__explicit_only__",
      GrocyConfigSyncPlanSchema,
    ),
    applyDryRunReport: loadOptionalArtifact(
      baseDir,
      options.applyDryRunReportPath,
      useDefaults ? GROCY_CONFIG_APPLY_DRY_RUN_REPORT_PATH : "__explicit_only__",
      GrocyConfigApplyDryRunReportSchema,
    ),
    driftTrendReport: loadOptionalArtifact(
      baseDir,
      options.driftTrendReportPath,
      useDefaults ? GROCY_CONFIG_DRIFT_TREND_REPORT_PATH : "__explicit_only__",
      GrocyConfigDriftTrendReportSchema,
    ),
    diagnostics: loadOptionalArtifact(
      baseDir,
      options.diagnosticsPath,
      useDefaults ? GROCY_HEALTH_DIAGNOSTICS_PATH : "__explicit_only__",
      GrocyHealthDiagnosticsArtifactSchema,
    ),
    backupManifest: loadOptionalArtifact(
      baseDir,
      options.backupManifestPath,
      useDefaults ? GROCY_BACKUP_MANIFEST_PATH : "__explicit_only__",
      GrocyBackupManifestSchema,
    ),
    mockSmokeReport: loadOptionalArtifact(
      baseDir,
      options.mockSmokeReportPath,
      useDefaults ? GROCY_MOCK_SMOKE_REPORT_PATH : "__explicit_only__",
      GrocyMockSmokeReportSchema,
    ),
  };

  return createGrocyReviewDashboard({
    ...artifacts,
    generatedAt: options.generatedAt,
    baseDir,
    artifactPaths: {
      planPath: artifacts.plan ? options.planPath ?? GROCY_CONFIG_PLAN_PATH : undefined,
      applyDryRunReportPath: artifacts.applyDryRunReport
        ? options.applyDryRunReportPath ?? GROCY_CONFIG_APPLY_DRY_RUN_REPORT_PATH
        : undefined,
      driftTrendReportPath: artifacts.driftTrendReport
        ? options.driftTrendReportPath ?? GROCY_CONFIG_DRIFT_TREND_REPORT_PATH
        : undefined,
      diagnosticsPath: artifacts.diagnostics ? options.diagnosticsPath ?? GROCY_HEALTH_DIAGNOSTICS_PATH : undefined,
      backupManifestPath: artifacts.backupManifest ? options.backupManifestPath ?? GROCY_BACKUP_MANIFEST_PATH : undefined,
      mockSmokeReportPath: artifacts.mockSmokeReport ? options.mockSmokeReportPath ?? GROCY_MOCK_SMOKE_REPORT_PATH : undefined,
    },
  });
}

export function recordGrocyReviewDashboard(
  dashboard: string,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeMarkdownFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_REVIEW_DASHBOARD_PATH),
    dashboard,
    options.overwrite ?? true,
  );
}
