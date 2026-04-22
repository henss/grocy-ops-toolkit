import fs from "node:fs";
import path from "node:path";
import {
  GrocyConfigApplyDryRunReportSchema,
  GrocyConfigDriftTrendReportSchema,
  type GrocyConfigApplyDryRunReport,
  type GrocyConfigApplyDryRunReportItem,
  type GrocyConfigDriftTrendChange,
  type GrocyConfigDriftTrendReport,
  type GrocyConfigEntity,
  type GrocyConfigExport,
  type GrocyConfigItem,
  type GrocyConfigPlanItem,
  type GrocyConfigSyncPlan,
  type GrocyJsonValue,
} from "./schemas.js";

export const GROCY_CONFIG_APPLY_DRY_RUN_REPORT_PATH = path.join("data", "grocy-config-apply-dry-run-report.json");
export const GROCY_CONFIG_DRIFT_TREND_REPORT_PATH = path.join("data", "grocy-config-drift-trend-report.json");

const CONFIG_ENTITIES: GrocyConfigEntity[] = [
  "products",
  "product_groups",
  "locations",
  "quantity_units",
  "product_barcodes",
  "shopping_lists",
  "shopping_list",
];

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function itemPayload(item: GrocyConfigItem): Record<string, GrocyJsonValue> {
  return { name: item.name, ...item.fields };
}

function itemIdentity(item: GrocyConfigItem): string {
  return `${item.entity}\0${item.key}`;
}

function emptyDriftEntityBreakdown(): GrocyConfigDriftTrendReport["entityBreakdown"] {
  return Object.fromEntries(
    CONFIG_ENTITIES.map((entity) => [entity, { added: 0, removed: 0, changed: 0, unchanged: 0 }]),
  ) as GrocyConfigDriftTrendReport["entityBreakdown"];
}

function driftChangesBetween(previous: GrocyConfigItem, current: GrocyConfigItem): GrocyConfigDriftTrendChange[] {
  const previousPayload = itemPayload(previous);
  const currentPayload = itemPayload(current);
  const keys = Array.from(new Set([...Object.keys(previousPayload), ...Object.keys(currentPayload)])).sort();
  return keys
    .filter((key) => stableStringify(previousPayload[key]) !== stableStringify(currentPayload[key]))
    .map((key) => ({ field: key, previous: previousPayload[key], current: currentPayload[key] }));
}

function applyDryRunAction(item: GrocyConfigPlanItem): GrocyConfigApplyDryRunReportItem["action"] {
  if (item.action === "create" && item.ownership === "repo_managed" && item.desired) {
    return "would_create";
  }
  if (item.action === "update" && item.ownership === "repo_managed" && item.desired && item.liveId) {
    return "would_update";
  }
  return item.action === "noop" ? "skipped" : "manual_review";
}

function summarizeApplyDryRun(items: GrocyConfigApplyDryRunReportItem[]): GrocyConfigApplyDryRunReport["summary"] {
  return {
    wouldCreate: items.filter((item) => item.action === "would_create").length,
    wouldUpdate: items.filter((item) => item.action === "would_update").length,
    skipped: items.filter((item) => item.action === "skipped").length,
    manualReview: items.filter((item) => item.action === "manual_review").length,
  };
}

function createApplyReviewNotes(planPath: string): string[] {
  return [
    "This dry-run report is generated from an existing config sync plan and does not send live Grocy write requests.",
    `Review the plan at ${planPath} before confirming any create or update actions.`,
    "A real apply still requires an explicit follow-up run with grocy:apply-config -- --confirm-reviewed-write.",
  ];
}

export function createGrocyConfigApplyDryRunReport(input: {
  plan: GrocyConfigSyncPlan;
  planPath: string;
  generatedAt?: string;
}): GrocyConfigApplyDryRunReport {
  const items = input.plan.actions.map((item): GrocyConfigApplyDryRunReportItem => ({
    action: applyDryRunAction(item),
    key: item.key,
    entity: item.entity,
    name: item.name,
    ownership: item.ownership,
    liveId: item.liveId,
    reason: item.reason,
    changes: item.changes,
  }));

  return GrocyConfigApplyDryRunReportSchema.parse({
    kind: "grocy_config_apply_dry_run_report",
    version: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    planPath: input.planPath,
    summary: summarizeApplyDryRun(items),
    items,
    reviewNotes: createApplyReviewNotes(input.planPath),
  });
}

export function recordGrocyConfigApplyDryRunReport(
  report: GrocyConfigApplyDryRunReport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_CONFIG_APPLY_DRY_RUN_REPORT_PATH),
    report,
    options.overwrite ?? true,
  );
}

export function createGrocyConfigDriftTrendReport(input: {
  previousExport: GrocyConfigExport;
  currentExport: GrocyConfigExport;
  previousExportPath: string;
  currentExportPath: string;
  generatedAt?: string;
}): GrocyConfigDriftTrendReport {
  const previousItems = new Map(input.previousExport.items.map((item) => [itemIdentity(item), item]));
  const currentItems = new Map(input.currentExport.items.map((item) => [itemIdentity(item), item]));
  const identities = Array.from(new Set([...previousItems.keys(), ...currentItems.keys()])).sort();
  const entityBreakdown = emptyDriftEntityBreakdown();
  const summary: GrocyConfigDriftTrendReport["summary"] = { added: 0, removed: 0, changed: 0, unchanged: 0 };
  const items: GrocyConfigDriftTrendReport["items"] = [];

  for (const identity of identities) {
    const previous = previousItems.get(identity);
    const current = currentItems.get(identity);

    if (!previous && current) {
      summary.added += 1;
      entityBreakdown[current.entity].added += 1;
      items.push({
        status: "added",
        key: current.key,
        entity: current.entity,
        name: current.name,
        changedFields: [],
        changes: [],
      });
      continue;
    }

    if (previous && !current) {
      summary.removed += 1;
      entityBreakdown[previous.entity].removed += 1;
      items.push({
        status: "removed",
        key: previous.key,
        entity: previous.entity,
        name: previous.name,
        changedFields: [],
        changes: [],
      });
      continue;
    }

    if (previous && current) {
      const changes = driftChangesBetween(previous, current);
      if (changes.length > 0) {
        summary.changed += 1;
        entityBreakdown[current.entity].changed += 1;
        items.push({
          status: "changed",
          key: current.key,
          entity: current.entity,
          name: current.name,
          changedFields: changes.map((change) => change.field),
          changes,
        });
      } else {
        summary.unchanged += 1;
        entityBreakdown[current.entity].unchanged += 1;
      }
    }
  }

  return GrocyConfigDriftTrendReportSchema.parse({
    kind: "grocy_config_drift_trend_report",
    version: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    previousExportPath: input.previousExportPath,
    currentExportPath: input.currentExportPath,
    period: {
      previousExportedAt: input.previousExport.exportedAt,
      currentExportedAt: input.currentExport.exportedAt,
    },
    summary,
    entityBreakdown,
    items,
  });
}

export function recordGrocyConfigDriftTrendReport(
  report: GrocyConfigDriftTrendReport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_CONFIG_DRIFT_TREND_REPORT_PATH),
    report,
    options.overwrite ?? true,
  );
}
