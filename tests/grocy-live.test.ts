import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createGrocyLiveReadSurface, loadGrocyLiveConfig, runGrocyHealthCheck } from "../src/grocy-live.js";

function writeConfig(baseDir: string): void {
  fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(baseDir, "config", "grocy.local.json"),
    JSON.stringify({
      baseUrl: "https://grocy.example.com",
      apiKey: "test-api-key",
      timeoutMs: 1000,
    }),
    "utf8",
  );
}

describe("Grocy live adapter", () => {
  it("normalizes base URL and sends the Grocy API key header", async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-live-"));
    writeConfig(baseDir);
    const config = loadGrocyLiveConfig(baseDir);
    const requests: Array<{ url: string; key?: string }> = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(input),
        key: init?.headers ? (init.headers as Record<string, string>)["GROCY-API-KEY"] : undefined,
      });
      return new Response("[]", { status: 200 });
    }) as typeof fetch;

    await createGrocyLiveReadSurface(config!, fetchImpl).listProducts();

    expect(config?.baseUrl).toBe("https://grocy.example.com/api");
    expect(requests).toEqual([
      {
        url: "https://grocy.example.com/api/objects/products",
        key: "test-api-key",
      },
    ]);
  });

  it("reports health failures without throwing", async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-health-"));
    writeConfig(baseDir);
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500, statusText: "Broken" })) as typeof fetch;

    const result = await runGrocyHealthCheck(baseDir, fetchImpl);

    expect(result.status.reachable).toBe(false);
    expect(result.status.notes.join("\n")).toContain("500 Broken");
  });

  it("allows callers to use a repo-specific config path", async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-custom-config-"));
    fs.mkdirSync(path.join(baseDir, "private-config"), { recursive: true });
    fs.writeFileSync(
      path.join(baseDir, "private-config", "grocy.local.json"),
      JSON.stringify({
        baseUrl: "https://grocy.example.com",
        apiKey: "test-api-key",
        timeoutMs: 1000,
      }),
      "utf8",
    );
    const fetchImpl = vi.fn(async () => new Response("[]", { status: 200 })) as typeof fetch;

    const result = await runGrocyHealthCheck(baseDir, fetchImpl, {
      configPath: path.join("private-config", "grocy.local.json"),
    });

    expect(result.status.reachable).toBe(true);
  });
});
