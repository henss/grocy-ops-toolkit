import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  DEFAULT_SYNTHETIC_GROCY_FIXTURE_ID,
  getSyntheticGrocyFixture,
  getSyntheticGrocyFixtureResponse,
  listSyntheticGrocyFixtures,
} from "./synthetic-grocy-fixtures.js";

export interface GrocyFixtureServerOptions {
  fixtureId?: string;
  host?: string;
  port?: number;
}

export interface GrocyFixtureServerHandle {
  fixtureId: string;
  host: string;
  port: number;
  baseUrl: string;
  close(): Promise<void>;
}

export interface GrocyFixtureServerManifest {
  fixtureId: string;
  fixtureLabel: string;
  host: string;
  port: number;
  baseUrl: string;
  supportedPaths: string[];
  fixtures: ReturnType<typeof listSyntheticGrocyFixtures>;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4010;
const SUPPORTED_PATHS = [
  "/api/system/info",
  "/api/stock",
  "/api/objects/products",
  "/api/objects/product_groups",
  "/api/objects/locations",
  "/api/objects/quantity_units",
  "/api/objects/product_barcodes",
  "/api/objects/shopping_lists",
  "/api/objects/shopping_list",
] as const;

function writeJson(response: http.ServerResponse, statusCode: number, value: unknown): void {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

export async function startGrocyFixtureServer(
  options: GrocyFixtureServerOptions = {},
): Promise<GrocyFixtureServerHandle> {
  const fixtureId = options.fixtureId ?? DEFAULT_SYNTHETIC_GROCY_FIXTURE_ID;
  getSyntheticGrocyFixture(fixtureId);
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  let runtimeHost = host;
  let runtimePort = port;

  const server = http.createServer((request, response) => {
    if (!request.url) {
      writeJson(response, 400, { error: "Request URL is required." });
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host ?? `${host}:${port}`}`);
    if (request.method !== "GET") {
      writeJson(response, 405, { error: "Synthetic fixture server is read-only." });
      return;
    }
    if (url.pathname === "/") {
      writeJson(response, 200, createGrocyFixtureServerManifest({ fixtureId, host: runtimeHost, port: runtimePort }));
      return;
    }

    const payload = getSyntheticGrocyFixtureResponse(fixtureId, url.pathname.replace(/^\/api/, ""));
    if (!payload) {
      writeJson(response, 404, {
        error: "Synthetic fixture endpoint not found.",
        requestedPath: url.pathname,
        fixtureId,
      });
      return;
    }
    writeJson(response, 200, payload);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Synthetic Grocy fixture server did not expose a TCP address.");
  }
  const resolvedHost = address.address;
  const resolvedPort = (address as AddressInfo).port;
  runtimeHost = resolvedHost;
  runtimePort = resolvedPort;

  return {
    fixtureId,
    host: resolvedHost,
    port: resolvedPort,
    baseUrl: `http://${resolvedHost}:${resolvedPort}/api`,
    async close(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

export function createGrocyFixtureServerManifest(
  options: Required<Pick<GrocyFixtureServerOptions, "fixtureId" | "host" | "port">>,
): GrocyFixtureServerManifest {
  const fixture = getSyntheticGrocyFixture(options.fixtureId);
  return {
    fixtureId: fixture.id,
    fixtureLabel: fixture.label,
    host: options.host,
    port: options.port,
    baseUrl: `http://${options.host}:${options.port}/api`,
    supportedPaths: [...SUPPORTED_PATHS],
    fixtures: listSyntheticGrocyFixtures(),
  };
}
