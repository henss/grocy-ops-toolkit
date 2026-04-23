import { describe, expect, it } from "vitest";
import {
  createSyntheticGrocyFetch,
  DEFAULT_SYNTHETIC_GROCY_FIXTURE_ID,
  getSyntheticGrocyFixture,
  getSyntheticGrocyFixtureResponse,
  listSyntheticGrocyFixtures,
} from "../src/synthetic-grocy-fixtures.js";

describe("synthetic Grocy fixtures", () => {
  it("lists the public-safe fixture variants", () => {
    expect(listSyntheticGrocyFixtures().map((fixture) => fixture.id)).toEqual([
      "fixture-current-object-api",
      "fixture-minimal-read-api",
      "fixture-shopping-list-gap",
    ]);
  });

  it("returns synthetic endpoint payloads for the default fixture", () => {
    expect(getSyntheticGrocyFixture(DEFAULT_SYNTHETIC_GROCY_FIXTURE_ID)).toMatchObject({
      label: "Current object API shape",
    });
    expect(getSyntheticGrocyFixtureResponse(DEFAULT_SYNTHETIC_GROCY_FIXTURE_ID, "/objects/products")).toEqual([
      { id: "1", name: "Example Coffee", min_stock_amount: 1, last_price: 12.34 },
      { id: "2", name: "Example Tea", min_stock_amount: 1, last_price: 4.56 },
    ]);
  });

  it("uses the shared fixture responses to implement fetch-compatible reads", async () => {
    const fetchImpl = createSyntheticGrocyFetch("fixture-shopping-list-gap");

    const supportedResponse = await fetchImpl("https://grocy.example.test/api/system/info");
    expect(await supportedResponse.json()).toEqual({ grocy_version: "synthetic-shopping-list-gap" });

    const unsupportedResponse = await fetchImpl("https://grocy.example.test/api/objects/shopping_list");
    expect(unsupportedResponse.status).toBe(404);
    expect(await unsupportedResponse.json()).toMatchObject({
      error: "Synthetic fixture endpoint not found.",
    });
  });

  it("rejects unknown fixture ids with the available fixture list", () => {
    expect(() => getSyntheticGrocyFixture("fixture-does-not-exist")).toThrow(/Known fixtures/);
  });
});
