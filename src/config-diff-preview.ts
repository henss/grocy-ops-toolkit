import fs from "node:fs";
import path from "node:path";
import {
  GrocyConfigDiffPreviewReportSchema,
  type GrocyConfigDiffPreviewItem,
  type GrocyConfigDiffPreviewReport,
} from "./config-diff-preview-schema.js";
import type { GrocyConfigPlanItem, GrocyConfigSyncPlan } from "./schemas.js";

export const GROCY_CONFIG_DIFF_PREVIEW_REPORT_PATH = path.join("data", "grocy-config-diff-preview-report.json");

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

function createDiffReviewNotes(plan: GrocyConfigSyncPlan): string[] {
  return [
    "This diff preview is generated from desired-state and export artifacts only. It does not send live Grocy write requests.",
    `Review ${plan.manifestPath} against ${plan.exportPath ?? "the generated live export"} before confirming any apply step.`,
    "Use grocy:apply-config -- --plan <path> --dry-run when you want the later apply-focused no-write report.",
  ];
}

function isPreviewAction(item: GrocyConfigPlanItem): item is GrocyConfigPlanItem & { action: "create" | "update" | "manual_review" } {
  return item.action !== "noop";
}

function toPreviewItems(plan: GrocyConfigSyncPlan): GrocyConfigDiffPreviewItem[] {
  return plan.actions
    .filter(isPreviewAction)
    .map((item) => ({
      action: item.action,
      key: item.key,
      entity: item.entity,
      name: item.name,
      ownership: item.ownership,
      liveId: item.liveId,
      reason: item.reason,
      changeCount: item.changes.length,
      changes: item.changes,
    }));
}

export function createGrocyConfigDiffPreviewReport(input: {
  plan: GrocyConfigSyncPlan;
  generatedAt?: string;
}): GrocyConfigDiffPreviewReport {
  const items = toPreviewItems(input.plan);
  const reviewedChangeCount = items.reduce((count, item) => count + item.changeCount, 0);

  return GrocyConfigDiffPreviewReportSchema.parse({
    kind: "grocy_config_diff_preview_report",
    version: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    manifestPath: input.plan.manifestPath,
    exportPath: input.plan.exportPath,
    summary: {
      ...input.plan.summary,
      reviewedChangeCount,
    },
    items,
    reviewNotes: createDiffReviewNotes(input.plan),
  });
}

export function recordGrocyConfigDiffPreviewReport(
  report: GrocyConfigDiffPreviewReport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_CONFIG_DIFF_PREVIEW_REPORT_PATH),
    report,
    options.overwrite ?? true,
  );
}
