import fs from "node:fs";
import path from "node:path";
import { GROCY_CONFIG_MANIFEST_PATH } from "./config-sync.js";
import {
  GrocyConfigManifestSchema,
  GrocyDesiredStateManifestLintReportSchema,
  type GrocyConfigItem,
  type GrocyConfigManifest,
  type GrocyDesiredStateLintFinding,
  type GrocyDesiredStateManifestLintReport,
} from "./schemas.js";

export const GROCY_DESIRED_STATE_LINT_REPORT_PATH = path.join("data", "grocy-desired-state-manifest-lint-report.json");

const VOLATILE_FIELDS = new Set([
  "id",
  "row_created_timestamp",
  "last_price",
  "last_shopping_location_id",
  "last_purchased",
  "last_used",
  "amount",
  "done",
  "shopping_list_id",
  "note",
]);

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function normalizeCandidate(input: string): string {
  return slugify(input);
}

function createFinding(input: Omit<GrocyDesiredStateLintFinding, "severity"> & { severity?: GrocyDesiredStateLintFinding["severity"] }): GrocyDesiredStateLintFinding {
  return {
    severity: input.severity ?? "error",
    code: input.code,
    message: input.message,
    itemKey: input.itemKey,
    path: input.path,
  };
}

function lintItemKeys(items: GrocyConfigItem[]): GrocyDesiredStateLintFinding[] {
  const seen = new Map<string, number>();
  const findings: GrocyDesiredStateLintFinding[] = [];
  for (const [index, item] of items.entries()) {
    const previousIndex = seen.get(item.key);
    if (previousIndex !== undefined) {
      findings.push(createFinding({
        code: "duplicate_item_key",
        itemKey: item.key,
        path: `items[${index}].key`,
        message: `Item key "${item.key}" duplicates items[${previousIndex}].key.`,
      }));
    } else {
      seen.set(item.key, index);
    }
  }
  return findings;
}

function lintItemCandidates(items: GrocyConfigItem[]): GrocyDesiredStateLintFinding[] {
  const seen = new Map<string, { index: number; itemKey: string; source: string }>();
  const findings: GrocyDesiredStateLintFinding[] = [];

  for (const [index, item] of items.entries()) {
    const itemCandidates = new Map<string, string>([[item.name, `items[${index}].name`]]);
    for (const [aliasIndex, alias] of item.aliases.entries()) {
      const aliasPath = `items[${index}].aliases[${aliasIndex}]`;
      if (itemCandidates.has(alias)) {
        findings.push(createFinding({
          code: "duplicate_alias",
          itemKey: item.key,
          path: aliasPath,
          message: `Alias "${alias}" is duplicated within item "${item.key}".`,
        }));
        continue;
      }
      itemCandidates.set(alias, aliasPath);
    }

    for (const [candidate, sourcePath] of itemCandidates.entries()) {
      const normalized = normalizeCandidate(candidate);
      if (!normalized) {
        continue;
      }
      const candidateKey = `${item.entity}\0${normalized}`;
      const previous = seen.get(candidateKey);
      if (previous) {
        findings.push(createFinding({
          code: "duplicate_match_candidate",
          itemKey: item.key,
          path: sourcePath,
          message: `Match candidate "${candidate}" collides with ${previous.source} on entity "${item.entity}", which would make live matching ambiguous.`,
        }));
        continue;
      }
      seen.set(candidateKey, { index, itemKey: item.key, source: sourcePath });
    }
  }

  return findings;
}

function lintVolatileFields(items: GrocyConfigItem[]): GrocyDesiredStateLintFinding[] {
  const findings: GrocyDesiredStateLintFinding[] = [];
  for (const [index, item] of items.entries()) {
    for (const fieldName of Object.keys(item.fields).sort()) {
      if (!VOLATILE_FIELDS.has(fieldName)) {
        continue;
      }
      findings.push(createFinding({
        code: "volatile_field_declared",
        itemKey: item.key,
        path: `items[${index}].fields.${fieldName}`,
        message: `Field "${fieldName}" is volatile live Grocy state and must not be declared in desired-state manifests.`,
      }));
    }
  }
  return findings;
}

function summarizeFindings(findings: GrocyDesiredStateLintFinding[]): GrocyDesiredStateManifestLintReport["summary"] {
  const errorCount = findings.filter((finding) => finding.severity === "error").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  return {
    itemCount: 0,
    errorCount,
    warningCount,
    ready: errorCount === 0,
  };
}

export function loadGrocyConfigManifestForLint(
  baseDir: string = process.cwd(),
  manifestPath = GROCY_CONFIG_MANIFEST_PATH,
): GrocyConfigManifest {
  return GrocyConfigManifestSchema.parse(readJsonFile(path.resolve(baseDir, manifestPath)));
}

export function createGrocyDesiredStateManifestLintReport(input: {
  manifest: GrocyConfigManifest;
  manifestPath: string;
  generatedAt?: string;
}): GrocyDesiredStateManifestLintReport {
  const findings = [
    ...lintItemKeys(input.manifest.items),
    ...lintItemCandidates(input.manifest.items),
    ...lintVolatileFields(input.manifest.items),
  ];
  const summary = summarizeFindings(findings);
  summary.itemCount = input.manifest.items.length;

  return GrocyDesiredStateManifestLintReportSchema.parse({
    kind: "grocy_desired_state_manifest_lint_report",
    version: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    manifestPath: input.manifestPath,
    summary,
    findings,
  });
}

export function lintGrocyDesiredStateManifestFile(
  baseDir: string = process.cwd(),
  manifestPath = GROCY_CONFIG_MANIFEST_PATH,
  options: { generatedAt?: string } = {},
): { manifest: GrocyConfigManifest; report: GrocyDesiredStateManifestLintReport } {
  const manifest = loadGrocyConfigManifestForLint(baseDir, manifestPath);
  const report = createGrocyDesiredStateManifestLintReport({
    manifest,
    manifestPath,
    generatedAt: options.generatedAt,
  });
  return { manifest, report };
}

export function recordGrocyDesiredStateManifestLintReport(
  report: GrocyDesiredStateManifestLintReport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_DESIRED_STATE_LINT_REPORT_PATH),
    report,
    options.overwrite ?? true,
  );
}

export function assertGrocyDesiredStateManifestLintReady(report: GrocyDesiredStateManifestLintReport): void {
  if (report.summary.ready) {
    return;
  }
  const messages = report.findings
    .filter((finding) => finding.severity === "error")
    .map((finding) => `${finding.path}: ${finding.message}`);
  throw new Error(`Desired-state manifest lint failed:\n- ${messages.join("\n- ")}`);
}
