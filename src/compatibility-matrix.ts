import fs from "node:fs";
import path from "node:path";

export const GROCY_API_COMPATIBILITY_MATRIX_PATH = path.join("data", "grocy-api-compatibility-matrix.json");

export type GrocyApiCompatibilityStatus = "supported" | "partial" | "unsupported";

export type GrocyApiCompatibilitySurface =
  | "system_info"
  | "stock"
  | "products"
  | "product_groups"
  | "locations"
  | "quantity_units"
  | "product_barcodes"
  | "shopping_lists"
  | "shopping_list";

export interface GrocyApiCompatibilityFixture {
  id: string;
  label: string;
  apiShape: string;
  notes: string[];
}

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

interface FixtureDefinition extends GrocyApiCompatibilityFixture {
  responses: Partial<Record<GrocyApiCompatibilitySurface, Record<string, unknown> | Array<Record<string, unknown>>>>;
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

const FIXTURES: FixtureDefinition[] = [
  {
    id: "fixture-current-object-api",
    label: "Current object API shape",
    apiShape: "Synthetic object endpoints include stable ids, names, and shopping-list records.",
    notes: ["Models the toolkit's preferred read path without live Grocy credentials."],
    responses: {
      system_info: { grocy_version: "synthetic-current" },
      stock: [
        {
          product_id: "1",
          product_name: "Example Coffee",
          amount_aggregated: 2,
          product: { min_stock_amount: 1 },
        },
      ],
      products: [{ id: "1", name: "Example Coffee", min_stock_amount: 1 }],
      product_groups: [{ id: "1", name: "Example Staples" }],
      locations: [{ id: "1", name: "Example Shelf" }],
      quantity_units: [{ id: "1", name: "Example Unit", name_plural: "Example Units" }],
      product_barcodes: [{ id: "1", product_id: "1", barcode: "0000000000000" }],
      shopping_lists: [{ id: "1", name: "Example List" }],
      shopping_list: [{ id: "1", product_id: "1", product_name: "Example Coffee", amount: 1, done: 0 }],
    },
  },
  {
    id: "fixture-minimal-read-api",
    label: "Minimal read API shape",
    apiShape: "Synthetic responses keep core object identifiers but omit some convenience fields.",
    notes: ["Highlights where the toolkit can continue reading but should avoid stronger automation claims."],
    responses: {
      system_info: { grocy_version: "synthetic-minimal" },
      stock: [{ product_id: "1", product_name: "Example Coffee", amount_aggregated: 2 }],
      products: [{ id: "1", name: "Example Coffee" }],
      product_groups: [{ id: "1", name: "Example Staples" }],
      locations: [{ id: "1", name: "Example Shelf" }],
      quantity_units: [{ id: "1", name: "Example Unit" }],
      product_barcodes: [{ id: "1", product_id: "1", barcode: "0000000000000" }],
      shopping_lists: [{ id: "1", name: "Example List" }],
      shopping_list: [{ id: "1", product_id: "1", amount: 1 }],
    },
  },
  {
    id: "fixture-shopping-list-gap",
    label: "Shopping-list gap shape",
    apiShape: "Synthetic object API lacks the shopping-list collection endpoint.",
    notes: ["Marks the specific surface as unsupported while keeping unrelated config reads scoped."],
    responses: {
      system_info: { grocy_version: "synthetic-shopping-list-gap" },
      stock: [
        {
          product_id: "1",
          product_name: "Example Coffee",
          amount_aggregated: 2,
          product: { min_stock_amount: 1 },
        },
      ],
      products: [{ id: "1", name: "Example Coffee" }],
      product_groups: [{ id: "1", name: "Example Staples" }],
      locations: [{ id: "1", name: "Example Shelf" }],
      quantity_units: [{ id: "1", name: "Example Unit", name_plural: "Example Units" }],
      product_barcodes: [{ id: "1", product_id: "1", barcode: "0000000000000" }],
      shopping_lists: [{ id: "1", name: "Example List" }],
    },
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
  fixture: FixtureDefinition,
  expectation: SurfaceExpectation,
): GrocyApiCompatibilityMatrixEntry {
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
  return {
    fixtureCount: FIXTURES.length,
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
  const entries = FIXTURES.flatMap((fixture) =>
    SURFACE_EXPECTATIONS.map((expectation) => evaluateFixtureSurface(fixture, expectation)),
  );

  return {
    kind: "grocy_api_compatibility_matrix",
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    scope: "synthetic_fixture_only",
    summary: summarize(entries),
    fixtures: FIXTURES.map(({ responses: _responses, ...fixture }) => fixture),
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
