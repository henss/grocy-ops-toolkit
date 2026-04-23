import { afterEach, describe, expect, it } from "vitest";
import {
  createGrocyFixtureServerManifest,
  startGrocyFixtureServer,
  type GrocyFixtureServerHandle,
} from "../src/fixture-server.js";

const openServers: GrocyFixtureServerHandle[] = [];

afterEach(async () => {
  while (openServers.length > 0) {
    await openServers.pop()?.close();
  }
});

describe("Grocy fixture server", () => {
  it("starts a local read-only synthetic API server", async () => {
    const server = await startGrocyFixtureServer({ fixtureId: "fixture-minimal-read-api", port: 0 });
    openServers.push(server);

    expect(server.baseUrl).toContain("/api");

    const systemInfo = await fetch(`${server.baseUrl}/system/info`);
    expect(await systemInfo.json()).toEqual({ grocy_version: "synthetic-minimal" });

    const products = await fetch(`${server.baseUrl}/objects/products`);
    expect(await products.json()).toEqual([{ id: "1", name: "Example Coffee" }]);

    const shoppingList = await fetch(`${server.baseUrl}/objects/shopping_list`);
    expect(await shoppingList.json()).toEqual([{ id: "1", product_id: "1", amount: 1 }]);
  });

  it("surfaces the supported endpoint manifest at the server root", async () => {
    const server = await startGrocyFixtureServer({ port: 0 });
    openServers.push(server);

    const manifestResponse = await fetch(server.baseUrl.replace(/\/api$/, "/"));
    expect(await manifestResponse.json()).toMatchObject({
      fixtureId: "fixture-current-object-api",
      fixtureLabel: "Current object API shape",
      supportedPaths: expect.arrayContaining(["/api/system/info", "/api/objects/products"]),
    });
  });

  it("returns 405 for non-read-only requests", async () => {
    const server = await startGrocyFixtureServer({ port: 0 });
    openServers.push(server);

    const response = await fetch(`${server.baseUrl}/objects/products`, {
      method: "POST",
      body: JSON.stringify({ name: "Should not write" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status).toBe(405);
    expect(await response.json()).toMatchObject({ error: "Synthetic fixture server is read-only." });
  });

  it("builds a public-safe manifest without starting the server", () => {
    expect(createGrocyFixtureServerManifest({
      fixtureId: "fixture-shopping-list-gap",
      host: "127.0.0.1",
      port: 4010,
    })).toMatchObject({
      fixtureId: "fixture-shopping-list-gap",
      baseUrl: "http://127.0.0.1:4010/api",
    });
  });
});
