import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { GROCY_BACKUP_MANIFEST_PATH } from "./backups.js";
import { GROCY_BACKUP_INTEGRITY_RECEIPT_PATH, GROCY_BACKUP_INTEGRITY_RECEIPT_VERIFICATION_PATH } from "./backup-integrity-receipt.js";
import { GROCY_BACKUP_RESTORE_DRILL_REPORT_PATH } from "./backup-restore-drill.js";
import { GROCY_BACKUP_RESTORE_FAILURE_DRILL_REPORT_PATH } from "./backup-restore-failure-drill.js";
import { GROCY_BACKUP_VERIFICATION_REPORT_PATH } from "./backup-verification-report.js";
import {
  GROCY_CONFIG_APPLY_DRY_RUN_REPORT_PATH,
  GROCY_CONFIG_DRIFT_TREND_REPORT_PATH,
  GROCY_CONFIG_PLAN_PATH,
} from "./config-sync.js";
import { GROCY_API_COMPATIBILITY_MATRIX_PATH } from "./compatibility-matrix.js";
import { GROCY_HEALTH_DIAGNOSTICS_PATH } from "./health-diagnostics.js";
import { GROCY_MOCK_SMOKE_REPORT_PATH } from "./mock-smoke.js";
import { GROCY_PUBLIC_ARTIFACT_REDACTION_AUDIT_PATH, auditGrocyPublicArtifacts } from "./redaction-audit.js";
import { GROCY_REVIEW_DASHBOARD_PATH } from "./review-dashboard.js";
import { GrocyJsonValueSchema, type GrocyJsonValue } from "./schemas.js";
import {
  createGrocySupportIssueReport,
  GrocySupportBundleIssueReportSchema,
} from "./support-bundle-issue-report.js";

export { GrocySupportBundleIssueReportSchema, type GrocySupportBundleIssueReport } from "./support-bundle-issue-report.js";

export const GROCY_SUPPORT_BUNDLE_PATH = path.join("data", "grocy-support-bundle.json");

const DEFAULT_SUPPORT_ARTIFACT_PATHS = [
  GROCY_HEALTH_DIAGNOSTICS_PATH,
  GROCY_MOCK_SMOKE_REPORT_PATH,
  GROCY_API_COMPATIBILITY_MATRIX_PATH,
  GROCY_BACKUP_MANIFEST_PATH,
  GROCY_BACKUP_VERIFICATION_REPORT_PATH,
  GROCY_BACKUP_RESTORE_DRILL_REPORT_PATH,
  GROCY_BACKUP_RESTORE_FAILURE_DRILL_REPORT_PATH,
  GROCY_BACKUP_INTEGRITY_RECEIPT_PATH,
  GROCY_BACKUP_INTEGRITY_RECEIPT_VERIFICATION_PATH,
  GROCY_CONFIG_PLAN_PATH,
  GROCY_CONFIG_APPLY_DRY_RUN_REPORT_PATH,
  GROCY_CONFIG_DRIFT_TREND_REPORT_PATH,
  GROCY_REVIEW_DASHBOARD_PATH,
  GROCY_PUBLIC_ARTIFACT_REDACTION_AUDIT_PATH,
];

export const GrocySupportBundleArtifactSchema = z.object({
  path: z.string().min(1),
  type: z.enum(["json", "markdown", "text", "other"]),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().min(1),
  kind: z.string().min(1).optional(),
  version: z.union([z.string(), z.number()]).optional(),
  generatedAt: z.string().min(1).optional(),
  updatedAt: z.string().min(1).optional(),
  summary: GrocyJsonValueSchema.optional(),
});

export const GrocySupportBundleRedactionRuleSchema = z.object({
  code: z.string().min(1),
  checkedFor: z.string().min(1),
});

export const GrocySupportBundleRedactionFindingSchema = z.object({
  filePath: z.string().min(1),
  line: z.number().int().positive(),
  code: z.string().min(1),
  message: z.string().min(1),
});

export const GrocySupportBundleSchema = z.object({
  kind: z.literal("grocy_support_bundle"),
  version: z.literal(1),
  generatedAt: z.string().min(1),
  summary: z.object({
    readiness: z.enum(["ready_to_share", "needs_redaction_review"]),
    artifactCount: z.number().int().nonnegative(),
    redactionFindingCount: z.number().int().nonnegative(),
  }),
  artifacts: z.array(GrocySupportBundleArtifactSchema).default([]),
  redactionAudit: z.object({
    result: z.enum(["pass", "fail"]),
    scannedPaths: z.array(z.string().min(1)).default([]),
    scannedFileCount: z.number().int().nonnegative(),
    findingCount: z.number().int().nonnegative(),
    findingCodes: z.array(z.string().min(1)).default([]),
    findingLocations: z.array(GrocySupportBundleRedactionFindingSchema).default([]),
    ruleSet: z.array(GrocySupportBundleRedactionRuleSchema).default([]),
    snippetPolicy: z.literal("finding_locations_only_no_matched_snippets"),
  }),
  issueReport: GrocySupportBundleIssueReportSchema,
  omitted: z.array(z.string().min(1)).default([]),
});

export type GrocySupportBundle = z.infer<typeof GrocySupportBundleSchema>;
export type GrocySupportBundleArtifact = z.infer<typeof GrocySupportBundleArtifactSchema>;

const REDACTION_RULE_SET = [
  {
    code: "absolute_local_path",
    checkedFor: "Windows, POSIX, workspace, home, webroot, and system absolute path shapes.",
  },
  {
    code: "private_url",
    checkedFor: "HTTP(S) URLs outside example, localhost, and loopback hosts.",
  },
  {
    code: "credential_value",
    checkedFor: "Credential-shaped JSON fields and environment assignments unless they use placeholder values.",
  },
  {
    code: "private_boundary_term",
    checkedFor: "Private-boundary terms for household, personal workflow, orchestrator, shopping, calendar, and task context.",
  },
] as const;

export interface GrocySupportBundleOptions {
  baseDir?: string;
  artifactPaths?: string[];
  auditPaths?: string[];
  generatedAt?: string;
}

function sha256(value: Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isPathInside(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function displayPath(baseDir: string, filePath: string): string {
  return path.relative(baseDir, filePath).replace(/\\/g, "/");
}

function artifactType(filePath: string): GrocySupportBundleArtifact["type"] {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".json") {
    return "json";
  }
  if (extension === ".md") {
    return "markdown";
  }
  if (extension === ".txt") {
    return "text";
  }
  return "other";
}

function isSensitiveSummaryString(value: string): boolean {
  return (
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.startsWith("/") ||
    /^https?:\/\//i.test(value) ||
    /\b(?:api[_-]?key|token|secret|password|passphrase)\b/i.test(value) ||
    !/^[a-z0-9_.:-]+$/i.test(value)
  );
}

function sanitizeSummaryValue(value: unknown): GrocyJsonValue | undefined {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return isSensitiveSummaryString(value) ? "<redacted-summary-value>" : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSummaryValue(item) ?? "<redacted-summary-value>");
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitizeSummaryValue(item) ?? "<redacted-summary-value>",
      ]),
    );
  }
  return undefined;
}

function readJsonMetadata(filePath: string): Partial<GrocySupportBundleArtifact> {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  return {
    kind: typeof parsed.kind === "string" ? parsed.kind : undefined,
    version: typeof parsed.version === "string" || typeof parsed.version === "number" ? parsed.version : undefined,
    generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : undefined,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
    summary: sanitizeSummaryValue(parsed.summary),
  };
}

function collectSupportArtifacts(baseDir: string, artifactPaths: string[]): GrocySupportBundleArtifact[] {
  const artifacts: GrocySupportBundleArtifact[] = [];
  const seen = new Set<string>();
  for (const inputPath of artifactPaths) {
    const absolutePath = path.resolve(baseDir, inputPath);
    if (!isPathInside(baseDir, absolutePath)) {
      throw new Error(`Support bundle artifacts must stay inside the repository: ${inputPath}`);
    }
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      continue;
    }
    const relativePath = displayPath(baseDir, absolutePath);
    if (seen.has(relativePath)) {
      continue;
    }
    seen.add(relativePath);
    const content = fs.readFileSync(absolutePath);
    const type = artifactType(absolutePath);
    const metadata = type === "json" ? readJsonMetadata(absolutePath) : {};
    artifacts.push(GrocySupportBundleArtifactSchema.parse({
      path: relativePath,
      type,
      bytes: content.byteLength,
      sha256: sha256(content),
      ...metadata,
    }));
  }
  return artifacts;
}

export function createGrocySupportBundle(options: GrocySupportBundleOptions = {}): GrocySupportBundle {
  const baseDir = path.resolve(options.baseDir ?? process.cwd());
  const redactionAudit = auditGrocyPublicArtifacts({
    baseDir,
    paths: options.auditPaths ?? ["data", "examples"],
    generatedAt: options.generatedAt,
  });
  const artifacts = collectSupportArtifacts(baseDir, options.artifactPaths ?? DEFAULT_SUPPORT_ARTIFACT_PATHS);
  const findingCodes = [...new Set(redactionAudit.findings.map((finding) => finding.code))].sort();
  return GrocySupportBundleSchema.parse({
    kind: "grocy_support_bundle",
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    summary: {
      readiness: redactionAudit.summary.findingCount === 0 ? "ready_to_share" : "needs_redaction_review",
      artifactCount: artifacts.length,
      redactionFindingCount: redactionAudit.summary.findingCount,
    },
    artifacts,
    redactionAudit: {
      result: redactionAudit.summary.result,
      scannedPaths: redactionAudit.scannedPaths,
      scannedFileCount: redactionAudit.summary.scannedFileCount,
      findingCount: redactionAudit.summary.findingCount,
      findingCodes,
      findingLocations: redactionAudit.findings.map((finding) => ({
        filePath: finding.filePath,
        line: finding.line,
        code: finding.code,
        message: finding.message,
      })),
      ruleSet: REDACTION_RULE_SET,
      snippetPolicy: "finding_locations_only_no_matched_snippets",
    },
    issueReport: createGrocySupportIssueReport(artifacts),
    omitted: [
      "Live Grocy credentials.",
      "Raw Grocy record payloads.",
      "Absolute local filesystem paths.",
      "Encrypted backup archives.",
      "Unreviewed generated snippets.",
    ],
  });
}

export function recordGrocySupportBundle(
  bundle: GrocySupportBundle,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  const outputPath = path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_SUPPORT_BUNDLE_PATH);
  if (options.overwrite === false && fs.existsSync(outputPath)) {
    throw new Error(`Refusing to overwrite existing file at ${outputPath}`);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  return outputPath;
}
