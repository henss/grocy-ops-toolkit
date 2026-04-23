import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createGrocyConfigApplyDryRunReport,
  createGrocyConfigSyncPlan,
  exportGrocyConfig,
  recordGrocyConfigApplyDryRunReport,
  recordGrocyConfigSyncPlan,
} from "./config-sync.js";
import { runGrocyHealthCheck } from "./grocy-live.js";
import type { GrocyConfigEntity, GrocyConfigManifest } from "./schemas.js";
import { createSyntheticGrocyFetch } from "./synthetic-grocy-fixtures.js";

export const GROCY_MOCK_SMOKE_REPORT_PATH = path.join("data", "grocy-mock-smoke-report.json");

export interface GrocyMockSmokeReportCheck {
  id: "health" | "export" | "plan" | "apply_dry_run";
  status: "pass" | "fail";
  message: string;
}

export interface GrocyMockSmokeReport {
  kind: "grocy_mock_smoke_report";
  version: 1;
  generatedAt: string;
  summary: {
    result: "pass" | "fail";
    checkCount: number;
    failureCount: number;
  };
  checks: GrocyMockSmokeReportCheck[];
  artifacts: {
    planPath: string;
    dryRunReportPath: string;
  };
}

const MOCK_BASE_URL = "https://grocy.example.test/api";

const MOCK_MANIFEST: GrocyConfigManifest = {
  kind: "grocy_config_manifest",
  version: 1,
  updatedAt: "2026-04-19T10:00:00.000Z",
  notes: ["Synthetic manifest used by the mock Grocy smoke test."],
  items: [
    {
      key: "products.example-coffee",
      entity: "products",
      name: "Example Coffee",
      ownership: "repo_managed",
      fields: { min_stock_amount: 1 },
      aliases: [],
      provenance: { source: "synthetic-smoke", notes: [] },
    },
    {
      key: "products.example-tea",
      entity: "products",
      name: "Example Tea",
      ownership: "repo_managed",
      fields: { min_stock_amount: 2 },
      aliases: [],
      provenance: { source: "synthetic-smoke", notes: [] },
    },
    {
      key: "products.example-cocoa",
      entity: "products",
      name: "Example Cocoa",
      ownership: "repo_managed",
      fields: { min_stock_amount: 1 },
      aliases: [],
      provenance: { source: "synthetic-smoke", notes: [] },
    },
  ],
};

function writeMockConfig(baseDir: string): void {
  fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "config", "grocy.local.json"),
    JSON.stringify({ baseUrl: MOCK_BASE_URL, apiKey: "synthetic-api-key", timeoutMs: 1000 }, null, 2),
    "utf8",
  );
}

export function createMockGrocyFetch(): typeof fetch {
  return createSyntheticGrocyFetch();
}

function assertCheck(condition: boolean, id: GrocyMockSmokeReportCheck["id"], message: string): GrocyMockSmokeReportCheck {
  if (!condition) {
    throw new Error(message);
  }
  return { id, status: "pass", message };
}

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

export function recordGrocyMockSmokeReport(
  report: GrocyMockSmokeReport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_MOCK_SMOKE_REPORT_PATH),
    report,
    options.overwrite ?? true,
  );
}

export async function runGrocyMockSmokeTest(
  baseDir: string = process.cwd(),
  options: { generatedAt?: string; outputPath?: string } = {},
): Promise<GrocyMockSmokeReport> {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-mock-smoke-"));
  const fetchImpl = createMockGrocyFetch();
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  try {
    writeMockConfig(workspace);

    const health = await runGrocyHealthCheck(workspace, fetchImpl);
    const exportData = await exportGrocyConfig(workspace, { fetchImpl, exportedAt: generatedAt });
    const plan = createGrocyConfigSyncPlan({
      manifest: MOCK_MANIFEST,
      liveExport: exportData,
      manifestPath: "synthetic://mock-smoke/desired-state.json",
      exportPath: "synthetic://mock-smoke/grocy-config-export.json",
      generatedAt,
    });
    const planPath = recordGrocyConfigSyncPlan(plan, {
      baseDir: workspace,
      outputPath: path.join("data", "grocy-config-sync-plan.json"),
    });
    const dryRunReport = createGrocyConfigApplyDryRunReport({
      plan,
      planPath: "synthetic://mock-smoke/grocy-config-sync-plan.json",
      generatedAt,
    });
    const dryRunReportPath = recordGrocyConfigApplyDryRunReport(dryRunReport, {
      baseDir: workspace,
      outputPath: path.join("data", "grocy-config-apply-dry-run-report.json"),
    });

    const checks = [
      assertCheck(health.status.reachable, "health", "Synthetic Grocy health check passed."),
      assertCheck(exportData.items.length > 0, "export", "Synthetic Grocy config export produced records."),
      assertCheck(
        plan.summary.create === 1 && plan.summary.update === 1 && plan.summary.noop === 1 && plan.summary.manualReview === 0,
        "plan",
        "Synthetic desired state produced create, update, and noop plan actions.",
      ),
      assertCheck(
        dryRunReport.summary.wouldCreate === 1 &&
          dryRunReport.summary.wouldUpdate === 1 &&
          dryRunReport.summary.skipped === 1 &&
          dryRunReport.summary.manualReview === 0,
        "apply_dry_run",
        "Synthetic apply dry run summarized the planned non-live writes.",
      ),
    ];

    const report: GrocyMockSmokeReport = {
      kind: "grocy_mock_smoke_report",
      version: 1,
      generatedAt,
      summary: { result: "pass", checkCount: checks.length, failureCount: 0 },
      checks,
      artifacts: {
        planPath: path.relative(workspace, planPath),
        dryRunReportPath: path.relative(workspace, dryRunReportPath),
      },
    };

    if (options.outputPath) {
      recordGrocyMockSmokeReport(report, { baseDir, outputPath: options.outputPath });
    }

    return report;
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}
