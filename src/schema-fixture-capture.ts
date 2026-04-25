import fs from "node:fs";
import path from "node:path";
import { loadGrocyLiveConfig } from "./grocy-live.js";
import {
  GrocySchemaFixtureCaptureSchema,
  type GrocySchemaCaptureField,
  type GrocySchemaCaptureSurface,
  type GrocySchemaCaptureSurfaceEntry,
  type GrocySchemaCaptureValueKind,
  type GrocySchemaFixtureCapture,
} from "./schema-fixture-capture-schema.js";
import {
  DEFAULT_SYNTHETIC_GROCY_FIXTURE_ID,
  getSyntheticGrocyFixture,
  getSyntheticGrocyFixtureResponse,
  type GrocyApiCompatibilitySurface,
} from "./synthetic-grocy-fixtures.js";

export const GROCY_SCHEMA_FIXTURE_CAPTURE_PATH = path.join("data", "grocy-schema-fixture-capture.json");

export interface GrocySchemaCaptureSurfaceDefinition {
  surface: GrocyApiCompatibilitySurface;
  endpoint: string;
  entity?: GrocySchemaCaptureSurfaceEntry["entity"];
}

export const GROCY_SCHEMA_CAPTURE_SURFACES: GrocySchemaCaptureSurfaceDefinition[] = [
  { surface: "system_info", endpoint: "/system/info" },
  { surface: "stock", endpoint: "/stock" },
  { surface: "products", endpoint: "/objects/products", entity: "products" },
  { surface: "product_groups", endpoint: "/objects/product_groups", entity: "product_groups" },
  { surface: "locations", endpoint: "/objects/locations", entity: "locations" },
  { surface: "quantity_units", endpoint: "/objects/quantity_units", entity: "quantity_units" },
  { surface: "product_barcodes", endpoint: "/objects/product_barcodes", entity: "product_barcodes" },
  { surface: "shopping_lists", endpoint: "/objects/shopping_lists", entity: "shopping_lists" },
  { surface: "shopping_list", endpoint: "/objects/shopping_list", entity: "shopping_list" },
];

interface FieldObservation {
  kinds: Set<GrocySchemaCaptureValueKind>;
  recordCount: number;
}

function toValueKind(value: unknown): GrocySchemaCaptureValueKind {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "object") {
    return "object";
  }
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  return "string";
}

function recordFieldObservation(
  observations: Map<string, FieldObservation>,
  pathValue: string,
  kind: GrocySchemaCaptureValueKind,
  seenPaths: Set<string>,
): void {
  seenPaths.add(pathValue);
  const current = observations.get(pathValue) ?? { kinds: new Set<GrocySchemaCaptureValueKind>(), recordCount: 0 };
  current.kinds.add(kind);
  observations.set(pathValue, current);
}

function observeRecordValue(
  value: unknown,
  currentPath: string,
  observations: Map<string, FieldObservation>,
  seenPaths: Set<string>,
): void {
  const kind = toValueKind(value);
  recordFieldObservation(observations, currentPath, kind, seenPaths);

  if (Array.isArray(value)) {
    for (const item of value) {
      observeNestedValue(item, `${currentPath}[]`, observations, seenPaths);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      observeNestedValue(nestedValue, `${currentPath}.${key}`, observations, seenPaths);
    }
  }
}

function observeNestedValue(
  value: unknown,
  currentPath: string,
  observations: Map<string, FieldObservation>,
  seenPaths: Set<string>,
): void {
  const kind = toValueKind(value);
  recordFieldObservation(observations, currentPath, kind, seenPaths);

  if (Array.isArray(value)) {
    for (const item of value) {
      observeNestedValue(item, `${currentPath}[]`, observations, seenPaths);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      observeNestedValue(nestedValue, `${currentPath}.${key}`, observations, seenPaths);
    }
  }
}

function finalizeFieldObservations(observations: Map<string, FieldObservation>, recordTotal: number): GrocySchemaCaptureField[] {
  return [...observations.entries()]
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .map(([pathValue, observation]) => ({
      path: pathValue,
      presence: observation.recordCount === recordTotal ? "always" : "sometimes",
      kinds: [...observation.kinds].sort(),
    }));
}

function captureSchemaFromPayload(
  definition: GrocySchemaCaptureSurfaceDefinition,
  payload: unknown,
): GrocySchemaCaptureSurfaceEntry {
  if (payload === undefined) {
    return {
      surface: definition.surface as GrocySchemaCaptureSurface,
      endpoint: definition.endpoint,
      status: "missing",
      rootKinds: ["object"],
      entity: definition.entity,
      fields: [],
      reviewNotes: ["The target did not expose this endpoint in the inspected shape capture."],
    };
  }

  const rootKinds = [toValueKind(payload)];
  const records = Array.isArray(payload) ? payload : [payload];
  const observations = new Map<string, FieldObservation>();

  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }
    const seenPaths = new Set<string>();
    for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
      observeRecordValue(value, key, observations, seenPaths);
    }
    for (const seenPath of seenPaths) {
      const observation = observations.get(seenPath);
      if (observation) {
        observation.recordCount += 1;
      }
    }
  }

  return {
    surface: definition.surface as GrocySchemaCaptureSurface,
    endpoint: definition.endpoint,
    status: "captured",
    rootKinds,
    entity: definition.entity,
    fields: finalizeFieldObservations(observations, Math.max(records.length, 1)),
    reviewNotes: Array.isArray(payload)
      ? ["Array payload values were reduced to field-path shape metadata only."]
      : ["Object payload values were reduced to field-path shape metadata only."],
  };
}

async function fetchLivePayload(
  baseDir: string,
  configPath: string | undefined,
  endpoint: string,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const config = loadGrocyLiveConfig(baseDir, configPath);
  if (!config) {
    throw new Error(`No Grocy live config found at ${path.resolve(baseDir, configPath ?? path.join("config", "grocy.local.json"))}.`);
  }

  const response = await fetchImpl(`${config.baseUrl}${endpoint}`, {
    headers: {
      "GROCY-API-KEY": config.apiKey,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`Grocy request failed: ${response.status} ${response.statusText} for ${endpoint}`);
  }
  return await response.json();
}

function summarizeCapture(surfaces: GrocySchemaCaptureSurfaceEntry[]): GrocySchemaFixtureCapture["summary"] {
  return {
    capturedSurfaceCount: surfaces.filter((surface) => surface.status === "captured").length,
    missingSurfaceCount: surfaces.filter((surface) => surface.status === "missing").length,
    fieldCount: surfaces.reduce((sum, surface) => sum + surface.fields.length, 0),
  };
}

function writeJsonFile(filePath: string, value: unknown, overwrite: boolean): string {
  if (!overwrite && fs.existsSync(filePath)) {
    throw new Error(`Refusing to overwrite existing file at ${filePath}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

export function createGrocySchemaFixtureCaptureFromSyntheticFixture(
  fixtureId: string = DEFAULT_SYNTHETIC_GROCY_FIXTURE_ID,
  options: { generatedAt?: string } = {},
): GrocySchemaFixtureCapture {
  const fixture = getSyntheticGrocyFixture(fixtureId);
  const surfaces = GROCY_SCHEMA_CAPTURE_SURFACES.map((definition) =>
    captureSchemaFromPayload(definition, getSyntheticGrocyFixtureResponse(fixture.id, definition.endpoint)),
  );

  return GrocySchemaFixtureCaptureSchema.parse({
    kind: "grocy_schema_fixture_capture",
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    scope: "schema_only",
    source: {
      mode: "synthetic_fixture",
      fixtureId: fixture.id,
      fixtureLabel: fixture.label,
    },
    summary: summarizeCapture(surfaces),
    surfaces,
    reviewNotes: [
      "The capture stores only field-path metadata and value kinds, never Grocy payload values.",
      "Synthetic fixture captures are suitable for fixture-only upgrade-shape tests and schema reviews.",
    ],
  });
}

export async function createGrocySchemaFixtureCaptureFromLiveConfig(
  baseDir: string = process.cwd(),
  options: { generatedAt?: string; configPath?: string; fetchImpl?: typeof fetch } = {},
): Promise<GrocySchemaFixtureCapture> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const surfaces = await Promise.all(
    GROCY_SCHEMA_CAPTURE_SURFACES.map(async (definition) =>
      captureSchemaFromPayload(
        definition,
        await fetchLivePayload(baseDir, options.configPath, definition.endpoint, fetchImpl),
      )),
  );

  return GrocySchemaFixtureCaptureSchema.parse({
    kind: "grocy_schema_fixture_capture",
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    scope: "schema_only",
    source: {
      mode: "live_config",
      configPath: options.configPath ?? path.join("config", "grocy.local.json"),
    },
    summary: summarizeCapture(surfaces),
    surfaces,
    reviewNotes: [
      "The capture stores only field-path metadata and value kinds, never live Grocy payload values.",
      "No base URL, API key, local absolute path, or record value is serialized into this artifact.",
    ],
  });
}

export function findSchemaCaptureSurface(
  capture: GrocySchemaFixtureCapture,
  surface: GrocyApiCompatibilitySurface,
): GrocySchemaCaptureSurfaceEntry | undefined {
  return capture.surfaces.find((entry) => entry.surface === surface);
}

export function recordGrocySchemaFixtureCapture(
  capture: GrocySchemaFixtureCapture,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_SCHEMA_FIXTURE_CAPTURE_PATH),
    capture,
    options.overwrite ?? true,
  );
}
