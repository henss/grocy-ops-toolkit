import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createGrocyHealthDiagnosticsArtifact,
  recordGrocyHealthDiagnosticsArtifact,
  runGrocyHealthDiagnostics,
} from "../src/health-diagnostics.js";
import { GrocyHealthDiagnosticsArtifactSchema } from "../src/schemas.js";

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

describe("Grocy health diagnostics", () => {
  it("records a config-missing artifact without absolute local paths", async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-health-diagnostics-missing-"));

    const artifact = await runGrocyHealthDiagnostics(baseDir, fetch, {
      generatedAt: "2026-04-19T10:15:00.000Z",
    });

    expect(artifact.summary).toEqual({ result: "fail", failureCount: 1, warningCount: 0 });
    expect(artifact.triage).toEqual({
      classification: "setup_required",
      severity: "error",
      summary: "Local Grocy config is missing, so live health checks cannot run yet.",
    });
    expect(artifact.nextActions).toEqual([
      "Run npm run grocy:init:workspace if the conventional local directories or starter config files are missing.",
      "Copy examples/grocy.local.example.json to config/grocy.local.json and set baseUrl plus apiKey for the local Grocy instance.",
      "Rerun npm run grocy:health:diagnostics after the local config is in place.",
    ]);
    expect(artifact.diagnostics[0]).toMatchObject({
      severity: "error",
      code: "config_missing",
      message: "Grocy live config was not found at config\\grocy.local.json.",
    });
    expect(JSON.stringify(artifact)).not.toContain(baseDir);
  });

  it("sanitizes failed live-check evidence for agents", async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-health-diagnostics-failure-"));
    writeConfig(baseDir);
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 503, statusText: "Service Unavailable" })) as typeof fetch;

    const artifact = await runGrocyHealthDiagnostics(baseDir, fetchImpl, {
      generatedAt: "2026-04-19T10:15:00.000Z",
    });

    expect(artifact.summary.result).toBe("fail");
    expect(artifact.triage.classification).toBe("investigate_live_api");
    expect(artifact.nextActions).toHaveLength(3);
    expect(artifact.diagnostics[0]).toMatchObject({
      code: "grocy_unreachable",
      evidence: ["Grocy request failed: 503 Service Unavailable for /stock"],
    });
    expect(JSON.stringify(artifact)).not.toContain("https://grocy.example.com");
  });

  it("reports invalid local config as an artifact", async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-health-diagnostics-invalid-"));
    fs.mkdirSync(path.join(baseDir, "config"), { recursive: true });
    fs.writeFileSync(path.join(baseDir, "config", "grocy.local.json"), "{}", "utf8");

    const artifact = await runGrocyHealthDiagnostics(baseDir, fetch, {
      generatedAt: "2026-04-19T10:15:00.000Z",
    });

    expect(artifact.summary.result).toBe("fail");
    expect(artifact.triage.classification).toBe("repair_required");
    expect(artifact.checks).toContainEqual({
      id: "live_api",
      status: "skipped",
      message: "Live API probes were skipped because local config is unavailable.",
    });
    expect(artifact.diagnostics[0]).toMatchObject({
      code: "config_invalid",
      evidence: ["Grocy config is missing baseUrl."],
    });
  });

  it("omits live record counts from a passing artifact", () => {
    const artifact = createGrocyHealthDiagnosticsArtifact({
      generatedAt: "2026-04-19T10:15:00.000Z",
      health: {
        status: {
          toolId: "grocy",
          reachable: true,
          mode: "write_enabled",
          notes: ["Grocy live adapter is reachable at https://grocy.example.com/api."],
        },
        stockCount: 2,
        shoppingListCount: 1,
        productCount: 3,
      },
    });

    expect(artifact.summary.result).toBe("pass");
    expect(artifact.triage).toEqual({
      classification: "healthy",
      severity: "info",
      summary: "Grocy health checks passed, so no immediate operator follow-up is required.",
    });
    expect(artifact.nextActions).toEqual([]);
    expect(JSON.stringify(artifact)).not.toContain("stockCount");
    expect(JSON.stringify(artifact)).not.toContain("shoppingListCount");
    expect(JSON.stringify(artifact)).not.toContain("productCount");
  });

  it("writes the diagnostics artifact to the conventional data path", () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocy-health-diagnostics-record-"));
    const outputPath = recordGrocyHealthDiagnosticsArtifact(
      createGrocyHealthDiagnosticsArtifact({
        generatedAt: "2026-04-19T10:15:00.000Z",
        health: {
          status: {
            toolId: "grocy",
            reachable: false,
            mode: "write_enabled",
            notes: ["Grocy request failed: 503 Service Unavailable for /stock"],
          },
        },
      }),
      { baseDir },
    );

    expect(path.relative(baseDir, outputPath)).toBe(path.join("data", "grocy-health-diagnostics.json"));
    expect(JSON.parse(fs.readFileSync(outputPath, "utf8"))).toMatchObject({
      kind: "grocy_health_diagnostics",
      summary: { result: "fail" },
      triage: { classification: "investigate_live_api" },
      nextActions: expect.any(Array),
    });
  });

  it("keeps the public example fixture schema-valid", () => {
    const example = JSON.parse(fs.readFileSync(path.join(process.cwd(), "examples", "grocy-health-diagnostics.example.json"), "utf8")) as unknown;

    expect(() => GrocyHealthDiagnosticsArtifactSchema.parse(example)).not.toThrow();
  });
});
