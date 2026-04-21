import fs from "node:fs";
import path from "node:path";
import {
  createGrocyApiCompatibilityMatrix,
  type GrocyApiCompatibilityMatrix,
  type GrocyApiCompatibilityMatrixEntry,
  type GrocyApiCompatibilityStatus,
} from "./compatibility-matrix.js";

export const GROCY_API_DEPRECATION_CANARY_REPORT_PATH = path.join("data", "grocy-api-deprecation-canary-report.json");

export type GrocyApiDeprecationCanaryRiskLevel = "upgrade_review" | "breaking";

export interface GrocyApiDeprecationCanaryFinding {
  fixtureId: string;
  fixtureLabel: string;
  apiShape: string;
  surface: GrocyApiCompatibilityMatrixEntry["surface"];
  endpoint: string;
  compatibilityStatus: Exclude<GrocyApiCompatibilityStatus, "supported">;
  riskLevel: GrocyApiDeprecationCanaryRiskLevel;
  canaryReason: string;
  recommendedAction: string;
  compatibilityNotes: string[];
}

export interface GrocyApiDeprecationCanaryReport {
  kind: "grocy_api_deprecation_canary_report";
  version: 1;
  generatedAt: string;
  scope: "synthetic_fixture_only";
  source: {
    kind: GrocyApiCompatibilityMatrix["kind"];
    version: GrocyApiCompatibilityMatrix["version"];
    fixtureCount: number;
  };
  summary: {
    findingCount: number;
    upgradeReview: number;
    breaking: number;
    highestRisk: "none" | GrocyApiDeprecationCanaryRiskLevel;
  };
  findings: GrocyApiDeprecationCanaryFinding[];
  reviewNotes: string[];
}

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function createCanaryReason(status: Exclude<GrocyApiCompatibilityStatus, "supported">): string {
  return status === "unsupported"
    ? "Required read fields are missing in this synthetic fixture, so a future Grocy shape change could break the current toolkit read path."
    : "Optional compatibility fields are missing in this synthetic fixture, so richer diagnostics or review flows may degrade across an upgrade.";
}

function createRecommendedAction(status: Exclude<GrocyApiCompatibilityStatus, "supported">): string {
  return status === "unsupported"
    ? "Treat this surface as upgrade-blocking until reviewed adapter evidence restores the required fields."
    : "Review this surface before promoting a broader upgrade or compatibility claim.";
}

function createFinding(
  matrix: GrocyApiCompatibilityMatrix,
  entry: GrocyApiCompatibilityMatrixEntry,
): GrocyApiDeprecationCanaryFinding | undefined {
  if (entry.status === "supported") {
    return undefined;
  }

  const fixture = matrix.fixtures.find((candidate) => candidate.id === entry.fixtureId);
  if (!fixture) {
    throw new Error(`Compatibility matrix fixture is missing for entry ${entry.fixtureId}`);
  }

  return {
    fixtureId: fixture.id,
    fixtureLabel: fixture.label,
    apiShape: fixture.apiShape,
    surface: entry.surface,
    endpoint: entry.endpoint,
    compatibilityStatus: entry.status,
    riskLevel: entry.status === "unsupported" ? "breaking" : "upgrade_review",
    canaryReason: createCanaryReason(entry.status),
    recommendedAction: createRecommendedAction(entry.status),
    compatibilityNotes: entry.notes,
  };
}

function summarize(findings: GrocyApiDeprecationCanaryFinding[]): GrocyApiDeprecationCanaryReport["summary"] {
  const upgradeReview = findings.filter((finding) => finding.riskLevel === "upgrade_review").length;
  const breaking = findings.filter((finding) => finding.riskLevel === "breaking").length;
  return {
    findingCount: findings.length,
    upgradeReview,
    breaking,
    highestRisk: breaking > 0 ? "breaking" : upgradeReview > 0 ? "upgrade_review" : "none",
  };
}

export function createGrocyApiDeprecationCanaryReport(
  options: { generatedAt?: string; matrix?: GrocyApiCompatibilityMatrix } = {},
): GrocyApiDeprecationCanaryReport {
  const matrix = options.matrix ?? createGrocyApiCompatibilityMatrix({
    generatedAt: options.generatedAt,
  });
  const findings = matrix.entries
    .map((entry) => createFinding(matrix, entry))
    .filter((finding): finding is GrocyApiDeprecationCanaryFinding => Boolean(finding));

  return {
    kind: "grocy_api_deprecation_canary_report",
    version: 1,
    generatedAt: options.generatedAt ?? matrix.generatedAt,
    scope: "synthetic_fixture_only",
    source: {
      kind: matrix.kind,
      version: matrix.version,
      fixtureCount: matrix.fixtures.length,
    },
    summary: summarize(findings),
    findings,
    reviewNotes: [
      "This canary report is derived from synthetic compatibility fixtures and does not inspect a live Grocy instance.",
      "Treat the report as upgrade-risk interpretation for current read assumptions, not as a public deprecation or version-support promise.",
      "Promote any finding into a public compatibility claim only after reviewed live adapter evidence exists.",
    ],
  };
}

export function recordGrocyApiDeprecationCanaryReport(
  report: GrocyApiDeprecationCanaryReport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_API_DEPRECATION_CANARY_REPORT_PATH),
    report,
    options.overwrite ?? true,
  );
}
