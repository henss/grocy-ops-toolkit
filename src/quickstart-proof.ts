import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createGrocyConfigApplyDryRunReport,
  createGrocyConfigDiffPreviewReport,
  createGrocyConfigDriftTrendReport,
  createGrocyConfigSyncPlan,
  loadGrocyConfigExport,
  recordGrocyConfigApplyDryRunReport,
  recordGrocyConfigDiffPreviewReport,
  recordGrocyConfigDriftTrendReport,
  recordGrocyConfigSyncPlan,
} from "./config-sync.js";
import {
  createGrocyDemoEnvironment,
  GROCY_DEMO_ENVIRONMENT_PATH,
  GROCY_DEMO_REDACTION_AUDIT_PATH,
  GROCY_DEMO_REVIEW_DASHBOARD_PATH,
  GROCY_DEMO_SUPPORT_BUNDLE_PATH,
} from "./demo-lab.js";
import {
  lintGrocyDesiredStateManifestFile,
  recordGrocyDesiredStateManifestLintReport,
} from "./desired-state-lint.js";
import {
  runGrocyHealthDiagnostics,
  recordGrocyHealthDiagnosticsArtifact,
} from "./health-diagnostics.js";
import {
  runGrocyInstallDoctor,
  recordGrocyInstallDoctorArtifact,
} from "./install-doctor.js";
import { initializeGrocyWorkspace } from "./init-workspace.js";
import {
  runGrocyMockSmokeTest,
  recordGrocyMockSmokeReport,
} from "./mock-smoke.js";
import {
  createGrocyMockSmokeRunReceipt,
  recordGrocyToolkitRunReceipt,
} from "./run-receipt.js";
import {
  GrocyReadmeQuickstartProofReceiptSchema,
  type GrocyReadmeQuickstartProofArtifact,
  type GrocyReadmeQuickstartProofCheck,
  type GrocyReadmeQuickstartProofRecipe,
  type GrocyReadmeQuickstartProofRecipeId,
  type GrocyReadmeQuickstartProofReceipt,
} from "./quickstart-proof-schema.js";

export const GROCY_README_QUICKSTART_PROOF_RECEIPT_PATH = path.join("data", "grocy-quickstart-proof-receipt.json");
export const GROCY_README_QUICKSTART_INSTALL_DOCTOR_PATH = path.join("data", "quickstart-install-doctor.json");
export const GROCY_README_QUICKSTART_HEALTH_DIAGNOSTICS_PATH = path.join("data", "quickstart-health-diagnostics.json");
export const GROCY_README_QUICKSTART_MOCK_SMOKE_REPORT_PATH = path.join("data", "quickstart-mock-smoke-report.json");
export const GROCY_README_QUICKSTART_MOCK_SMOKE_RECEIPT_PATH = path.join("data", "quickstart-mock-smoke-receipt.json");
export const GROCY_README_QUICKSTART_LINT_PATH = path.join("data", "quickstart-desired-state-lint-report.json");
export const GROCY_README_QUICKSTART_SYNC_PLAN_PATH = path.join("data", "quickstart-config-sync-plan.json");
export const GROCY_README_QUICKSTART_DIFF_PREVIEW_PATH = path.join("data", "quickstart-config-diff-preview-report.json");
export const GROCY_README_QUICKSTART_DRIFT_TREND_PATH = path.join("data", "quickstart-config-drift-trend-report.json");
export const GROCY_README_QUICKSTART_APPLY_DRY_RUN_PATH = path.join("data", "quickstart-apply-dry-run-report.json");

const QUICKSTART_REQUIRED_FILES = [
  path.join("examples", "desired-state.example.json"),
  path.join("examples", "config-export.example.json"),
  path.join("examples", "config-export.previous.example.json"),
  path.join("examples", "synthetic-grocy-backup-source"),
] as const;

const QUICKSTART_COPY_BACK_PATHS = [
  GROCY_README_QUICKSTART_HEALTH_DIAGNOSTICS_PATH,
  GROCY_README_QUICKSTART_MOCK_SMOKE_REPORT_PATH,
  GROCY_README_QUICKSTART_MOCK_SMOKE_RECEIPT_PATH,
  GROCY_README_QUICKSTART_LINT_PATH,
  GROCY_README_QUICKSTART_SYNC_PLAN_PATH,
  GROCY_README_QUICKSTART_DIFF_PREVIEW_PATH,
  GROCY_README_QUICKSTART_DRIFT_TREND_PATH,
  GROCY_README_QUICKSTART_APPLY_DRY_RUN_PATH,
  GROCY_DEMO_ENVIRONMENT_PATH,
  GROCY_DEMO_REDACTION_AUDIT_PATH,
  GROCY_DEMO_REVIEW_DASHBOARD_PATH,
  GROCY_DEMO_SUPPORT_BUNDLE_PATH,
  path.join("config", "grocy-demo-backup.local.json"),
  path.join("backups", "demo", "grocy-backup-manifest.json"),
] as const;

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function toPortablePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function copyRepoFixtureIntoWorkspace(repoBaseDir: string, workspaceDir: string, relativePath: string): void {
  const sourcePath = path.resolve(repoBaseDir, relativePath);
  const targetPath = path.resolve(workspaceDir, relativePath);
  const sourceStat = fs.statSync(sourcePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (sourceStat.isDirectory()) {
    fs.cpSync(sourcePath, targetPath, { recursive: true });
    return;
  }
  fs.copyFileSync(sourcePath, targetPath);
}

function createScratchWorkspace(repoBaseDir: string): string {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-quickstart-proof-"));
  for (const relativePath of QUICKSTART_REQUIRED_FILES) {
    copyRepoFixtureIntoWorkspace(repoBaseDir, workspaceDir, relativePath);
  }
  return workspaceDir;
}

function ensureRecipeWorkspace(workspaceDir: string): void {
  for (const relativePath of ["config", "data", "restore"]) {
    fs.mkdirSync(path.resolve(workspaceDir, relativePath), { recursive: true });
  }
}

function copyWorkspaceArtifactToRepo(workspaceDir: string, repoBaseDir: string, relativePath: string, overwrite: boolean): void {
  const sourcePath = path.resolve(workspaceDir, relativePath);
  const targetPath = path.resolve(repoBaseDir, relativePath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Expected proof artifact at ${sourcePath}`);
  }
  if (!overwrite && fs.existsSync(targetPath)) {
    throw new Error(`Refusing to overwrite existing file at ${targetPath}`);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function createCheck(id: string, status: "pass" | "fail", message: string): GrocyReadmeQuickstartProofCheck {
  return { id, status, message };
}

function createRecipe(input: {
  id: GrocyReadmeQuickstartProofRecipeId;
  title: string;
  checks: GrocyReadmeQuickstartProofCheck[];
  summary: string;
  artifactPaths: string[];
}): GrocyReadmeQuickstartProofRecipe {
  const status = input.checks.every((check) => check.status === "pass") ? "pass" : "fail";
  return {
    id: input.id,
    title: input.title,
    status,
    summary: input.summary,
    checks: input.checks,
    artifactPaths: input.artifactPaths,
  };
}

export function recordGrocyReadmeQuickstartProofReceipt(
  receipt: GrocyReadmeQuickstartProofReceipt,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_README_QUICKSTART_PROOF_RECEIPT_PATH),
    receipt,
    options.overwrite ?? true,
  );
}

export async function createGrocyReadmeQuickstartProofReceipt(
  baseDir: string = process.cwd(),
  options: { generatedAt?: string } = {},
): Promise<GrocyReadmeQuickstartProofReceipt> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const workspaceDir = createScratchWorkspace(baseDir);
  const quickStartWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-init-quickstart-proof-"));

  try {
    const initWorkspace = initializeGrocyWorkspace(quickStartWorkspaceDir);
    const installDoctor = runGrocyInstallDoctor(quickStartWorkspaceDir, { generatedAt });
    recordGrocyInstallDoctorArtifact(installDoctor, {
      baseDir: quickStartWorkspaceDir,
      outputPath: GROCY_README_QUICKSTART_INSTALL_DOCTOR_PATH,
      overwrite: true,
    });

    ensureRecipeWorkspace(workspaceDir);

    const diagnostics = await runGrocyHealthDiagnostics(workspaceDir, fetch, { generatedAt });
    recordGrocyHealthDiagnosticsArtifact(diagnostics, {
      baseDir: workspaceDir,
      outputPath: GROCY_README_QUICKSTART_HEALTH_DIAGNOSTICS_PATH,
      overwrite: true,
    });

    const mockSmokeReport = await runGrocyMockSmokeTest(workspaceDir, { generatedAt });
    const mockSmokeReportPath = recordGrocyMockSmokeReport(mockSmokeReport, {
      baseDir: workspaceDir,
      outputPath: GROCY_README_QUICKSTART_MOCK_SMOKE_REPORT_PATH,
      overwrite: true,
    });
    const mockSmokeReceipt = createGrocyMockSmokeRunReceipt({
      baseDir: workspaceDir,
      report: mockSmokeReport,
      reportPath: mockSmokeReportPath,
    });
    recordGrocyToolkitRunReceipt(mockSmokeReceipt, {
      baseDir: workspaceDir,
      outputPath: GROCY_README_QUICKSTART_MOCK_SMOKE_RECEIPT_PATH,
      overwrite: true,
    });

    const { manifest, report: lintReport } = lintGrocyDesiredStateManifestFile(workspaceDir, path.join("examples", "desired-state.example.json"));
    recordGrocyDesiredStateManifestLintReport(lintReport, {
      baseDir: workspaceDir,
      outputPath: GROCY_README_QUICKSTART_LINT_PATH,
      overwrite: true,
    });

    const exportPath = path.join("examples", "config-export.example.json");
    const previousExportPath = path.join("examples", "config-export.previous.example.json");
    const syncPlan = createGrocyConfigSyncPlan({
      manifest,
      liveExport: loadGrocyConfigExport(path.resolve(workspaceDir, exportPath)),
      manifestPath: path.join("examples", "desired-state.example.json"),
      exportPath,
      generatedAt,
    });
    recordGrocyConfigSyncPlan(syncPlan, {
      baseDir: workspaceDir,
      outputPath: GROCY_README_QUICKSTART_SYNC_PLAN_PATH,
      overwrite: true,
    });

    const diffPreview = createGrocyConfigDiffPreviewReport({
      plan: syncPlan,
      generatedAt,
    });
    recordGrocyConfigDiffPreviewReport(diffPreview, {
      baseDir: workspaceDir,
      outputPath: GROCY_README_QUICKSTART_DIFF_PREVIEW_PATH,
      overwrite: true,
    });

    const driftTrendReport = createGrocyConfigDriftTrendReport({
      previousExport: loadGrocyConfigExport(path.resolve(workspaceDir, previousExportPath)),
      currentExport: loadGrocyConfigExport(path.resolve(workspaceDir, exportPath)),
      previousExportPath,
      currentExportPath: exportPath,
      generatedAt,
    });
    recordGrocyConfigDriftTrendReport(driftTrendReport, {
      baseDir: workspaceDir,
      outputPath: GROCY_README_QUICKSTART_DRIFT_TREND_PATH,
      overwrite: true,
    });

    const applyDryRunReport = createGrocyConfigApplyDryRunReport({
      plan: syncPlan,
      planPath: GROCY_README_QUICKSTART_SYNC_PLAN_PATH,
      generatedAt,
    });
    recordGrocyConfigApplyDryRunReport(applyDryRunReport, {
      baseDir: workspaceDir,
      outputPath: GROCY_README_QUICKSTART_APPLY_DRY_RUN_PATH,
      overwrite: true,
    });

    const demoEnvironment = await createGrocyDemoEnvironment(workspaceDir, { generatedAt });

    copyWorkspaceArtifactToRepo(quickStartWorkspaceDir, baseDir, GROCY_README_QUICKSTART_INSTALL_DOCTOR_PATH, true);
    for (const relativePath of QUICKSTART_COPY_BACK_PATHS) {
      copyWorkspaceArtifactToRepo(workspaceDir, baseDir, relativePath, true);
    }

    const quickStartRecipe = createRecipe({
      id: "quick_start_preflight",
      title: "Workspace Init Quick Start",
      checks: [
        createCheck(
          "workspace_init_created_conventional_paths",
          (
            initWorkspace.directories.length === 4
            && initWorkspace.directories.every((directory) => directory.status === "created")
          )
            ? "pass"
            : "fail",
          "Workspace init created the conventional config, data, backups, and restore paths.",
        ),
        createCheck(
          "workspace_init_wrote_starter_configs",
          (
            initWorkspace.files.length === 2
            && initWorkspace.files.every((file) => file.status === "written")
          )
            ? "pass"
            : "fail",
          "Workspace init wrote starter Grocy live and backup config files.",
        ),
        createCheck(
          "install_doctor_after_init_action_required",
          installDoctor.summary.status === "action_required" ? "pass" : "fail",
          `Install doctor reported ${installDoctor.summary.status} after starter workspace setup.`,
        ),
        createCheck(
          "install_doctor_only_flags_backup_source",
          (
            installDoctor.summary.warningCount === 1
            && installDoctor.summary.failureCount === 0
            && installDoctor.checks.some((check) => check.id === "backup_source" && check.code === "backup_source_missing")
          )
            ? "pass"
            : "fail",
          "Install doctor kept the starter setup public-safe and only flagged the placeholder backup source path.",
        ),
      ],
      summary: "Proved the README workspace-init recipe on a clean synthetic checkout and captured the post-init install-doctor artifact.",
      artifactPaths: [toPortablePath(GROCY_README_QUICKSTART_INSTALL_DOCTOR_PATH)],
    });

    const coldStartRecipe = createRecipe({
      id: "fresh_agent_cold_start_loop",
      title: "Fresh-Agent Cold-Start Loop",
      checks: [
        createCheck(
          "diagnostics_config_gap_only",
          (
            diagnostics.summary.result === "fail"
            && diagnostics.diagnostics.every((diagnostic) => diagnostic.code === "config_missing")
          )
            ? "pass"
            : "fail",
          "Diagnostics stayed public-safe and only reported the missing local config boundary.",
        ),
        createCheck(
          "mock_smoke_passed",
          mockSmokeReport.summary.result === "pass"
            ? "pass"
            : "fail",
          "Mock smoke passed and emitted the matching run receipt.",
        ),
        createCheck(
          "lint_ready",
          lintReport.summary.ready
            ? "pass"
            : "fail",
          "Desired-state lint stayed ready on the synthetic manifest.",
        ),
        createCheck(
          "diff_preview_generated",
          (syncPlan.summary.update === 1 && diffPreview.summary.update === 1)
            ? "pass"
            : "fail",
          "Config diff and preview artifacts captured the expected reviewed update.",
        ),
        createCheck(
          "drift_trend_generated",
          driftTrendReport.summary.changed === 1
            ? "pass"
            : "fail",
          "Config drift trend proved the expected synthetic change set.",
        ),
        createCheck(
          "apply_dry_run_generated",
          applyDryRunReport.summary.wouldUpdate === 1
            ? "pass"
            : "fail",
          "Apply dry run stayed no-write and preserved the reviewed update count.",
        ),
      ],
      summary: "Proved the README cold-start loop with public-safe diagnostics, mock smoke evidence, and offline config review artifacts.",
      artifactPaths: [
        GROCY_README_QUICKSTART_HEALTH_DIAGNOSTICS_PATH,
        GROCY_README_QUICKSTART_MOCK_SMOKE_REPORT_PATH,
        GROCY_README_QUICKSTART_MOCK_SMOKE_RECEIPT_PATH,
        GROCY_README_QUICKSTART_LINT_PATH,
        GROCY_README_QUICKSTART_SYNC_PLAN_PATH,
        GROCY_README_QUICKSTART_DIFF_PREVIEW_PATH,
        GROCY_README_QUICKSTART_DRIFT_TREND_PATH,
        GROCY_README_QUICKSTART_APPLY_DRY_RUN_PATH,
      ].map(toPortablePath),
    });

    const demoRecipe = createRecipe({
      id: "demo_lab_one_command",
      title: "Synthetic Demo Lab",
      checks: [
        createCheck(
          "demo_environment_passed",
          demoEnvironment.summary.result === "pass"
            ? "pass"
            : "fail",
          "The one-command demo lab finished successfully.",
        ),
        createCheck(
          "demo_shareability_ready",
          demoEnvironment.summary.shareability === "ready_to_share"
            ? "pass"
            : "fail",
          "The demo lab remained ready to share after the redaction audit.",
        ),
      ],
      summary: "Proved the one-command README recipe that bundles diagnostics, review artifacts, backup proof, dashboard output, and support-bundle evidence.",
      artifactPaths: [
        GROCY_DEMO_ENVIRONMENT_PATH,
        GROCY_DEMO_REDACTION_AUDIT_PATH,
        GROCY_DEMO_REVIEW_DASHBOARD_PATH,
        GROCY_DEMO_SUPPORT_BUNDLE_PATH,
      ].map(toPortablePath),
    });

    const recipes = [quickStartRecipe, coldStartRecipe, demoRecipe];
    const artifacts: GrocyReadmeQuickstartProofArtifact[] = [
      { kind: "grocy_install_doctor", path: toPortablePath(GROCY_README_QUICKSTART_INSTALL_DOCTOR_PATH) },
      { kind: "grocy_health_diagnostics", path: toPortablePath(GROCY_README_QUICKSTART_HEALTH_DIAGNOSTICS_PATH) },
      { kind: "grocy_mock_smoke_report", path: toPortablePath(GROCY_README_QUICKSTART_MOCK_SMOKE_REPORT_PATH) },
      { kind: "grocy_toolkit_run_receipt", path: toPortablePath(GROCY_README_QUICKSTART_MOCK_SMOKE_RECEIPT_PATH) },
      { kind: "grocy_desired_state_manifest_lint_report", path: toPortablePath(GROCY_README_QUICKSTART_LINT_PATH) },
      { kind: "grocy_config_sync_plan", path: toPortablePath(GROCY_README_QUICKSTART_SYNC_PLAN_PATH) },
      { kind: "grocy_config_diff_preview_report", path: toPortablePath(GROCY_README_QUICKSTART_DIFF_PREVIEW_PATH) },
      { kind: "grocy_config_drift_trend_report", path: toPortablePath(GROCY_README_QUICKSTART_DRIFT_TREND_PATH) },
      { kind: "grocy_config_apply_dry_run_report", path: toPortablePath(GROCY_README_QUICKSTART_APPLY_DRY_RUN_PATH) },
      { kind: "grocy_demo_environment", path: toPortablePath(GROCY_DEMO_ENVIRONMENT_PATH) },
      { kind: "grocy_public_artifact_redaction_audit", path: toPortablePath(GROCY_DEMO_REDACTION_AUDIT_PATH) },
      { kind: "grocy_review_dashboard", path: toPortablePath(GROCY_DEMO_REVIEW_DASHBOARD_PATH) },
      { kind: "grocy_support_bundle", path: toPortablePath(GROCY_DEMO_SUPPORT_BUNDLE_PATH) },
    ];

    return GrocyReadmeQuickstartProofReceiptSchema.parse({
      kind: "grocy_readme_quickstart_proof_receipt",
      version: 1,
      generatedAt,
      scope: "synthetic_fixture_only",
      command: {
        id: "grocy:quickstart:proof",
        cli: "npm run grocy:quickstart:proof",
      },
      summary: {
        status: recipes.every((recipe) => recipe.status === "pass") ? "pass" : "fail",
        recipeCount: recipes.length,
        artifactCount: artifacts.length,
      },
      recipes,
      artifacts,
      reviewNotes: [
        "This receipt proves the README quickstart recipes with synthetic fixtures only and does not require live Grocy credentials.",
        "The workspace-init starter configs intentionally stay placeholder-only, so install doctor still flags the backup source path until a local sourcePath is configured.",
        "The proof run copies public-safe artifacts back into conventional repo paths so the README and docs can reference stable evidence files.",
        "A failed install doctor or diagnostics artifact can still count as expected proof when the recipe is validating the clean-checkout boundary instead of live readiness.",
      ],
    });
  } finally {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
    fs.rmSync(quickStartWorkspaceDir, { recursive: true, force: true });
  }
}
