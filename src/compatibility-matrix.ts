import fs from "node:fs";
import path from "node:path";
import {
  type GrocyApiCompatibilitySurface,
  type SyntheticGrocyFixtureMetadata,
  getSyntheticGrocyFixture,
  listSyntheticGrocyFixtures,
} from "./synthetic-grocy-fixtures.js";

export const GROCY_API_COMPATIBILITY_MATRIX_PATH = path.join("data", "grocy-api-compatibility-matrix.json");

export type GrocyApiCompatibilityStatus = "supported" | "partial" | "unsupported";
export type GrocyApiCompatibilityFixture = SyntheticGrocyFixtureMetadata;

export interface GrocyApiCompatibilityMatrixEntry {
  fixtureId: string;
  surface: GrocyApiCompatibilitySurface;
  endpoint: string;
  status: GrocyApiCompatibilityStatus;
  requiredFields: string[];
  observedFields: string[];
  notes: string[];
}

export interface GrocyApiCompatibilityMatrix {
  kind: "grocy_api_compatibility_matrix";
  version: 1;
  generatedAt: string;
  scope: "synthetic_fixture_only";
  summary: {
    fixtureCount: number;
    supported: number;
    partial: number;
    unsupported: number;
  };
  fixtures: GrocyApiCompatibilityFixture[];
  entries: GrocyApiCompatibilityMatrixEntry[];
  reviewNotes: string[];
}

interface SurfaceExpectation {
  surface: GrocyApiCompatibilitySurface;
  endpoint: string;
  requiredFields: string[];
  partialFields?: string[];
}

const SURFACE_EXPECTATIONS: SurfaceExpectation[] = [
  {
    surface: "system_info",
    endpoint: "/system/info",
    requiredFields: ["grocy_version"],
  },
  {
    surface: "stock",
    endpoint: "/stock",
    requiredFields: ["product_id", "product_name", "amount_aggregated"],
    partialFields: ["product.min_stock_amount"],
  },
  {
    surface: "products",
    endpoint: "/objects/products",
    requiredFields: ["id", "name"],
  },
  {
    surface: "product_groups",
    endpoint: "/objects/product_groups",
    requiredFields: ["id", "name"],
  },
  {
    surface: "locations",
    endpoint: "/objects/locations",
    requiredFields: ["id", "name"],
  },
  {
    surface: "quantity_units",
    endpoint: "/objects/quantity_units",
    requiredFields: ["id", "name"],
    partialFields: ["name_plural"],
  },
  {
    surface: "product_barcodes",
    endpoint: "/objects/product_barcodes",
    requiredFields: ["id", "product_id", "barcode"],
  },
  {
    surface: "shopping_lists",
    endpoint: "/objects/shopping_lists",
    requiredFields: ["id", "name"],
  },
  {
    surface: "shopping_list",
    endpoint: "/objects/shopping_list",
    requiredFields: ["id", "product_id", "amount"],
    partialFields: ["product_name", "done"],
  },
];

function firstRecord(value: Record<string, unknown> | Array<Record<string, unknown>> | undefined): Record<string, unknown> | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function hasField(record: Record<string, unknown> | undefined, field: string): boolean {
  if (!record) {
    return false;
  }
  return field.split(".").reduce<unknown>((value, part) => {
    if (value && typeof value === "object" && part in value) {
      return (value as Record<string, unknown>)[part];
    }
    return undefined;
  }, record) !== undefined;
}

function observedFields(record: Record<string, unknown> | undefined): string[] {
  if (!record) {
    return [];
  }
  return Object.keys(record).sort();
}

function evaluateFixtureSurface(
  fixtureId: string,
  expectation: SurfaceExpectation,
): GrocyApiCompatibilityMatrixEntry {
  const fixture = getSyntheticGrocyFixture(fixtureId);
  const record = firstRecord(fixture.responses[expectation.surface]);
  const missingRequired = expectation.requiredFields.filter((field) => !hasField(record, field));
  const missingPartial = (expectation.partialFields ?? []).filter((field) => !hasField(record, field));
  const status: GrocyApiCompatibilityStatus = missingRequired.length > 0
    ? "unsupported"
    : missingPartial.length > 0
      ? "partial"
      : "supported";
  const notes = [
    missingRequired.length > 0 ? `Missing required fields: ${missingRequired.join(", ")}.` : "Required fields are present.",
    missingPartial.length > 0 ? `Missing optional compatibility fields: ${missingPartial.join(", ")}.` : "No optional compatibility gaps detected.",
  ];

  return {
    fixtureId: fixture.id,
    surface: expectation.surface,
    endpoint: expectation.endpoint,
    status,
    requiredFields: expectation.requiredFields,
    observedFields: observedFields(record),
    notes,
  };
}

function summarize(entries: GrocyApiCompatibilityMatrixEntry[]): GrocyApiCompatibilityMatrix["summary"] {
  const fixtures = listSyntheticGrocyFixtures();
  return {
    fixtureCount: fixtures.length,
    supported: entries.filter((entry) => entry.status === "supported").length,
    partial: entries.filter((entry) => entry.status === "partial").length,
    unsupported: entries.filter((entry) => entry.status === "unsupported").length,
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

export function createGrocyApiCompatibilityMatrix(
  options: { generatedAt?: string } = {},
): GrocyApiCompatibilityMatrix {
  const fixtures = listSyntheticGrocyFixtures();
  const entries = fixtures.flatMap((fixture) =>
    SURFACE_EXPECTATIONS.map((expectation) => evaluateFixtureSurface(fixture.id, expectation)),
  );

  return {
    kind: "grocy_api_compatibility_matrix",
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    scope: "synthetic_fixture_only",
    summary: summarize(entries),
    fixtures,
    entries,
    reviewNotes: [
      "This matrix is a fixture-only prototype and is not a live Grocy version support promise.",
      "Promote any row to a public support claim only after reviewed live adapter evidence exists.",
      "Keep fixture values synthetic and omit account details or private workflow data.",
    ],
  };
}

export function recordGrocyApiCompatibilityMatrix(
  matrix: GrocyApiCompatibilityMatrix,
  options: { baseDir?: string; outputPath?: string; overwrite?: boolean } = {},
): string {
  return writeJsonFile(
    path.resolve(options.baseDir ?? process.cwd(), options.outputPath ?? GROCY_API_COMPATIBILITY_MATRIX_PATH),
    matrix,
    options.overwrite ?? true,
  );
}
