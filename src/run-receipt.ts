import fs from "node:fs";
import path from "node:path";
import type { GrocyMockSmokeReport } from "./mock-smoke.js";
import { GrocyToolkitRunReceiptSchema, type GrocyToolkitRunReceipt } from "./schemas.js";

export const GROCY_MOCK_SMOKE_RECEIPT_PATH = path.join("data", "grocy-mock-smoke-receipt.json");

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function isPathInside(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function toPublicArtifactPath(baseDir: string, value: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    return value;
  }
  const absoluteValue = path.resolve(baseDir, value);
  return isPathInside(baseDir, absoluteValue)
    ? path.relative(baseDir, absoluteValue).replace(/\\/g, "/")
    : "<external-path>";
}

export function createGrocyMockSmokeRunReceipt(input: {
  baseDir?: string;
  report: GrocyMockSmokeReport;
  reportPath: string;
}): GrocyToolkitRunReceipt {
  const baseDir = input.baseDir ?? process.cwd();

  return GrocyToolkitRunReceiptSchema.parse({
    kind: "grocy_toolkit_run_receipt",
    version: 1,
    generatedAt: input.report.generatedAt,
    command: {
      id: "grocy:smoke:mock",
      cli: "npm run grocy:smoke:mock",
    },
    fixtureSet: {
      id: "synthetic_mock_smoke",
      scope: "synthetic_fixture_only",
      notes: [
        "Uses only synthetic Grocy response fixtures and a temporary local config.",
        "Does not require live Grocy credentials, household data, or private workflow state.",
      ],
    },
    artifacts: [
      {
        role: "primary_report",
        kind: input.report.kind,
        path: toPublicArtifactPath(baseDir, input.reportPath),
      },
      {
        role: "derived_plan",
        kind: "grocy_config_sync_plan",
        path: toPublicArtifactPath(baseDir, input.report.artifacts.planPath),
      },
      {
        role: "derived_dry_run_report",
        kind: "grocy_config_apply_dry_run_report",
        path: toPublicArtifactPath(baseDir, input.report.artifacts.dryRunReportPath),
      },
    ],
    verification: {
      command: "npm run grocy:smoke:mock",
      status: input.report.summary.result,
    },
    result: {
      status: input.report.summary.result,
      checkCount: input.report.summary.checkCount,
      failureCount: input.report.summary.failureCount,
    },
    reviewNotes: [
      "Inspect this receipt instead of rereading terminal logs when the synthetic smoke path is enough evidence.",
      "Treat this receipt as command-local evidence, not as a broader CI replacement or public support claim.",
    ],
  });
}

export function recordGrocyToolkitRunReceipt(
  receipt: GrocyToolkitRunReceipt,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_MOCK_SMOKE_RECEIPT_PATH),
    receipt,
    options.overwrite ?? true,
  );
}
