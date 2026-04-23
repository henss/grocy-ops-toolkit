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

export interface SyntheticGrocyFixtureMetadata {
  id: string;
  label: string;
  apiShape: string;
  notes: string[];
}

export interface SyntheticGrocyFixtureDefinition extends SyntheticGrocyFixtureMetadata {
  responses: Partial<Record<GrocyApiCompatibilitySurface, Record<string, unknown> | Array<Record<string, unknown>>>>;
}

export const DEFAULT_SYNTHETIC_GROCY_FIXTURE_ID = "fixture-current-object-api";

const SYNTHETIC_GROCY_FIXTURES: SyntheticGrocyFixtureDefinition[] = [
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
          product: { min_stock_amount: 1, qu_id_stock: "1", qu_id_purchase: "1" },
        },
      ],
      products: [
        { id: "1", name: "Example Coffee", min_stock_amount: 1, last_price: 12.34 },
        { id: "2", name: "Example Tea", min_stock_amount: 1, last_price: 4.56 },
      ],
      product_groups: [{ id: "1", name: "Example Staples" }],
      locations: [{ id: "1", name: "Example Shelf" }],
      quantity_units: [{ id: "1", name: "Example Unit", name_plural: "Example Units" }],
      product_barcodes: [{ id: "1", product_id: "1", barcode: "0000000000000" }],
      shopping_lists: [{ id: "1", name: "Example List" }],
      shopping_list: [{ id: "1", product_id: "2", product_name: "Example Tea", amount: 1, note: "Synthetic pending item", done: 0 }],
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
          product: { min_stock_amount: 1, qu_id_stock: "1", qu_id_purchase: "1" },
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

function cloneResponse(value: Record<string, unknown> | Array<Record<string, unknown>>): Record<string, unknown> | Array<Record<string, unknown>> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown> | Array<Record<string, unknown>>;
}

function resolveSurfaceFromPath(pathname: string): GrocyApiCompatibilitySurface | undefined {
  if (pathname === "/system/info") {
    return "system_info";
  }
  if (pathname === "/stock") {
    return "stock";
  }
  if (pathname.startsWith("/objects/")) {
    const entity = pathname.split("/")[2];
    if (
      entity === "products" ||
      entity === "product_groups" ||
      entity === "locations" ||
      entity === "quantity_units" ||
      entity === "product_barcodes" ||
      entity === "shopping_lists" ||
      entity === "shopping_list"
    ) {
      return entity;
    }
  }
  return undefined;
}

export function listSyntheticGrocyFixtures(): SyntheticGrocyFixtureMetadata[] {
  return SYNTHETIC_GROCY_FIXTURES.map(({ responses: _responses, ...fixture }) => fixture);
}

export function getSyntheticGrocyFixture(
  fixtureId: string = DEFAULT_SYNTHETIC_GROCY_FIXTURE_ID,
): SyntheticGrocyFixtureDefinition {
  const fixture = SYNTHETIC_GROCY_FIXTURES.find((candidate) => candidate.id === fixtureId);
  if (!fixture) {
    const knownIds = SYNTHETIC_GROCY_FIXTURES.map((candidate) => candidate.id).join(", ");
    throw new Error(`Unknown synthetic Grocy fixture '${fixtureId}'. Known fixtures: ${knownIds}.`);
  }
  return fixture;
}

export function getSyntheticGrocyFixtureResponse(
  fixtureId: string,
  pathname: string,
): Record<string, unknown> | Array<Record<string, unknown>> | undefined {
  const fixture = getSyntheticGrocyFixture(fixtureId);
  const surface = resolveSurfaceFromPath(pathname);
  if (!surface) {
    return undefined;
  }
  const response = fixture.responses[surface];
  return response ? cloneResponse(response) : undefined;
}

function responseJson(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export function createSyntheticGrocyFetch(
  fixtureId: string = DEFAULT_SYNTHETIC_GROCY_FIXTURE_ID,
): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const relativePath = url.pathname.replace(/^\/api/, "");
    const response = getSyntheticGrocyFixtureResponse(fixtureId, relativePath);

    return response
      ? responseJson(response)
      : new Response(JSON.stringify({ error: "Synthetic fixture endpoint not found." }), {
          status: 404,
          statusText: "Not Found",
          headers: { "Content-Type": "application/json" },
        });
  }) as typeof fetch;
}
