import fs from "node:fs";
import path from "node:path";
import {
  createGrocyConfigReadSurface,
  createGrocyConfigWriteSurface,
  loadGrocyLiveConfig,
  type GrocyObjectRecord,
} from "./grocy-live.js";
import {
  GrocyConfigEntitySchema,
  GrocyConfigExportSchema,
  GrocyConfigManifestSchema,
  GrocyConfigSyncPlanSchema,
  type GrocyConfigEntity,
  type GrocyConfigExport,
  type GrocyConfigItem,
  type GrocyConfigManifest,
  type GrocyConfigPlanChange,
  type GrocyConfigPlanItem,
  type GrocyConfigSyncPlan,
  type GrocyJsonValue,
} from "./schemas.js";
export {
  createGrocyConfigDiffPreviewReport,
  GROCY_CONFIG_DIFF_PREVIEW_REPORT_PATH,
  recordGrocyConfigDiffPreviewReport,
} from "./config-diff-preview.js";
export {
  createGrocyConfigApplyDryRunReport,
  createGrocyConfigDriftTrendReport,
  GROCY_CONFIG_APPLY_DRY_RUN_REPORT_PATH,
  GROCY_CONFIG_DRIFT_TREND_REPORT_PATH,
  recordGrocyConfigApplyDryRunReport,
  recordGrocyConfigDriftTrendReport,
} from "./config-review.js";

export const GROCY_CONFIG_MANIFEST_PATH = path.join("config", "desired-state.json");
export const GROCY_CONFIG_EXPORT_PATH = path.join("data", "grocy-config-export.json");
export const GROCY_CONFIG_PREVIOUS_EXPORT_PATH = path.join("data", "grocy-config-export.previous.json");
export const GROCY_CONFIG_PLAN_PATH = path.join("data", "grocy-config-sync-plan.json");

const CONFIG_ENTITIES: GrocyConfigEntity[] = [
  "products",
  "product_groups",
  "locations",
  "quantity_units",
  "product_barcodes",
  "shopping_lists",
  "shopping_list",
];

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

function normalizeName(value: string): string {
  return slugify(value);
}

function getObjectName(record: GrocyObjectRecord): string {
  const name = record.fields.name;
  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }
  const productName = record.fields.product_name;
  if (typeof productName === "string" && productName.trim()) {
    return productName.trim();
  }
  const barcode = record.fields.barcode;
  return typeof barcode === "string" && barcode.trim()
    ? barcode.trim()
    : `${record.entity}-${record.id ?? "unknown"}`;
}

function toJsonField(value: unknown): GrocyJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(toJsonField).filter((item): item is GrocyJsonValue => item !== undefined);
  }
  if (typeof value === "object") {
    const output: Record<string, GrocyJsonValue> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const mapped = toJsonField(nested);
      if (mapped !== undefined) {
        output[key] = mapped;
      }
    }
    return output;
  }
  return String(value);
}

function normalizeFields(fields: Record<string, unknown>): Record<string, GrocyJsonValue> {
  const output: Record<string, GrocyJsonValue> = {};
  for (const [key, value] of Object.entries(fields).sort(([left], [right]) => left.localeCompare(right))) {
    if (!VOLATILE_FIELDS.has(key)) {
      const mapped = toJsonField(value);
      if (mapped !== undefined) {
        output[key] = mapped;
      }
    }
  }
  return output;
}

function normalizeLiveRecord(record: GrocyObjectRecord, exportedAt: string): GrocyConfigItem {
  const name = getObjectName(record);
  return {
    key: `${record.entity}.${slugify(name || record.id || "unknown")}`,
    entity: record.entity,
    name,
    ownership: "observed_only",
    fields: normalizeFields(record.fields),
    aliases: [],
    provenance: { source: "live-grocy-export", recordedAt: exportedAt, notes: [] },
    lastObservedLiveId: record.id,
    lastObservedAt: exportedAt,
  };
}

function sortItems<T extends { entity: string; key: string; name: string }>(items: T[]): T[] {
  return [...items].sort((left, right) =>
    left.entity.localeCompare(right.entity) || left.key.localeCompare(right.key) || left.name.localeCompare(right.name),
  );
}

function summarizePlan(actions: GrocyConfigPlanItem[]): GrocyConfigSyncPlan["summary"] {
  return {
    create: actions.filter((item) => item.action === "create").length,
    update: actions.filter((item) => item.action === "update").length,
    noop: actions.filter((item) => item.action === "noop").length,
    manualReview: actions.filter((item) => item.action === "manual_review").length,
  };
}

function itemPayload(item: GrocyConfigItem): Record<string, GrocyJsonValue> {
  return { name: item.name, ...item.fields };
}

function changesBetween(desired: GrocyConfigItem, live: GrocyConfigItem): GrocyConfigPlanChange[] {
  const desiredPayload = itemPayload(desired);
  const livePayload = itemPayload(live);
  const keys = Array.from(new Set([...Object.keys(desiredPayload), ...Object.keys(livePayload)])).sort();
  return keys
    .filter((key) => stableStringify(desiredPayload[key]) !== stableStringify(livePayload[key]))
    .map((key) => ({ field: key, desired: desiredPayload[key], live: livePayload[key] }));
}

function findLiveMatches(desired: GrocyConfigItem, liveItems: GrocyConfigItem[]): GrocyConfigItem[] {
  const sameEntity = liveItems.filter((item) => item.entity === desired.entity);
  if (desired.lastObservedLiveId) {
    const byId = sameEntity.filter((item) => item.lastObservedLiveId === desired.lastObservedLiveId);
    if (byId.length > 0) {
      return byId;
    }
  }
  const candidateNames = new Set([desired.name, ...desired.aliases].map(normalizeName));
  return sameEntity.filter((item) => candidateNames.has(normalizeName(item.name)));
}

export function loadGrocyConfigManifest(
  baseDir: string = process.cwd(),
  manifestPath = GROCY_CONFIG_MANIFEST_PATH,
): GrocyConfigManifest {
  const absolutePath = path.resolve(baseDir, manifestPath);
  if (!fs.existsSync(absolutePath)) {
    return GrocyConfigManifestSchema.parse({
      kind: "grocy_config_manifest",
      version: 1,
      notes: ["Start by promoting reviewed live exports into repo_managed items."],
      items: [],
    });
  }
  return GrocyConfigManifestSchema.parse(readJsonFile(absolutePath));
}

export function loadGrocyConfigExport(exportPath: string): GrocyConfigExport {
  return GrocyConfigExportSchema.parse(readJsonFile(exportPath));
}

export async function exportGrocyConfig(
  baseDir: string = process.cwd(),
  options: { fetchImpl?: typeof fetch; exportedAt?: string; configPath?: string } = {},
): Promise<GrocyConfigExport> {
  const config = loadGrocyLiveConfig(baseDir, options.configPath);
  if (!config) {
    throw new Error("Grocy live config is missing. Run the config status command first.");
  }

  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const readSurface = createGrocyConfigReadSurface(config, options.fetchImpl ?? fetch);
  const systemInfo = await readSurface.getSystemInfo();
  const items: GrocyConfigItem[] = [];
  const counts = Object.fromEntries(CONFIG_ENTITIES.map((entity) => [entity, 0])) as Record<GrocyConfigEntity, number>;

  for (const entity of CONFIG_ENTITIES) {
    const records = await readSurface.listObjects(entity);
    counts[entity] = records.length;
    items.push(...records.map((record) => normalizeLiveRecord(record, exportedAt)));
  }

  return GrocyConfigExportSchema.parse({
    kind: "grocy_config_export",
    version: 1,
    exportedAt,
    source: {
      toolId: "grocy",
      baseUrl: config.baseUrl,
      grocyVersion: typeof systemInfo?.grocy_version === "string" ? systemInfo.grocy_version : undefined,
    },
    counts,
    items: sortItems(items),
  });
}

export function recordGrocyConfigExport(
  exportData: GrocyConfigExport,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_CONFIG_EXPORT_PATH),
    exportData,
    options.overwrite ?? true,
  );
}

export function createGrocyConfigSyncPlan(input: {
  manifest: GrocyConfigManifest;
  liveExport: GrocyConfigExport;
  manifestPath: string;
  exportPath?: string;
  generatedAt?: string;
}): GrocyConfigSyncPlan {
  const actions: GrocyConfigPlanItem[] = [];
  for (const desired of sortItems(input.manifest.items)) {
    const matches = findLiveMatches(desired, input.liveExport.items);
    if (matches.length > 1) {
      actions.push({
        action: "manual_review",
        key: desired.key,
        entity: desired.entity,
        name: desired.name,
        ownership: desired.ownership,
        reason: "Multiple live Grocy records match this manifest item.",
        changes: [],
        desired,
        live: matches[0],
      });
      continue;
    }

    const live = matches[0];
    if (!live) {
      actions.push({
        action: desired.ownership === "repo_managed" ? "create" : desired.ownership === "grocy_managed" ? "manual_review" : "noop",
        key: desired.key,
        entity: desired.entity,
        name: desired.name,
        ownership: desired.ownership,
        reason: desired.ownership === "repo_managed" ? "Repo-managed item is missing from live Grocy." : "Item is not applied from Git.",
        changes: [],
        desired,
      });
      continue;
    }

    if (desired.ownership !== "repo_managed") {
      actions.push({
        action: "noop",
        key: desired.key,
        entity: desired.entity,
        name: desired.name,
        ownership: desired.ownership,
        liveId: live.lastObservedLiveId,
        reason: `${desired.ownership} items are not applied from Git.`,
        changes: [],
        desired,
        live,
      });
      continue;
    }

    const changes = changesBetween(desired, live);
    actions.push({
      action: changes.length > 0 ? "update" : "noop",
      key: desired.key,
      entity: desired.entity,
      name: desired.name,
      ownership: desired.ownership,
      liveId: live.lastObservedLiveId,
      reason: changes.length > 0 ? "Repo-managed item differs from live Grocy." : "Live Grocy already matches desired state.",
      changes,
      desired,
      live,
    });
  }

  return GrocyConfigSyncPlanSchema.parse({
    kind: "grocy_config_sync_plan",
    version: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    manifestPath: input.manifestPath,
    exportPath: input.exportPath,
    actions: sortItems(actions),
    summary: summarizePlan(actions),
  });
}

export function recordGrocyConfigSyncPlan(
  plan: GrocyConfigSyncPlan,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_CONFIG_PLAN_PATH),
    plan,
    options.overwrite ?? true,
  );
}

export function loadGrocyConfigSyncPlan(planPath: string): GrocyConfigSyncPlan {
  return GrocyConfigSyncPlanSchema.parse(readJsonFile(planPath));
}

export async function applyGrocyConfigSyncPlan(
  planPath: string,
  baseDir: string = process.cwd(),
  options: { confirmReviewedWrite?: boolean; fetchImpl?: typeof fetch; configPath?: string } = {},
): Promise<{ planPath: string; created: number; updated: number; skipped: number; manualReview: number }> {
  if (!options.confirmReviewedWrite) {
    throw new Error("Refusing to apply Grocy config sync without --confirm-reviewed-write.");
  }
  const config = loadGrocyLiveConfig(baseDir, options.configPath);
  if (!config) {
    throw new Error("Grocy live config is missing. Run the config status command first.");
  }

  const absolutePlanPath = path.resolve(baseDir, planPath);
  const plan = loadGrocyConfigSyncPlan(absolutePlanPath);
  const readSurface = createGrocyConfigReadSurface(config, options.fetchImpl ?? fetch);
  const writeSurface = createGrocyConfigWriteSurface(config, options.fetchImpl ?? fetch);
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let manualReview = 0;

  for (const item of plan.actions) {
    if (item.action === "manual_review") {
      manualReview += 1;
    } else if (item.action === "noop") {
      skipped += 1;
    } else if (item.ownership !== "repo_managed" || !item.desired || !GrocyConfigEntitySchema.safeParse(item.entity).success) {
      manualReview += 1;
    } else if (item.action === "create") {
      await writeSurface.createObject(item.entity, itemPayload(item.desired));
      created += 1;
    } else if (item.action === "update" && item.liveId) {
      // GET the full live object first so volatile fields (e.g. amount for shopping_list)
      // are preserved in the PUT, then overlay only the declared managed fields on top.
      // Strip id and userfields: Grocy returns them in GET but rejects them in PUT.
      const { id: _id, userfields: _userfields, ...livePutFields } = await readSurface.getObject(item.entity, item.liveId);
      await writeSurface.updateObject(item.entity, item.liveId, { ...livePutFields, ...item.desired.fields });
      updated += 1;
    } else {
      manualReview += 1;
    }
  }

  return { planPath: absolutePlanPath, created, updated, skipped, manualReview };
}
